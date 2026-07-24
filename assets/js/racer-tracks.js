/* =====================================================
   ZUURA Racer — track library + geometry helpers
   Original stylized circuit layouts (homages, not traced
   from any official map). Plain place names only.
   Exposes window.RACER_TRACKS and window.RTRACK utils.
   ===================================================== */
(function () {
  "use strict";

  // Control points in an arbitrary ~[-100,100] space; the engine fits/scales them.
  // widthMul scales the road width relative to the engine's base width.
  var TRACKS = [
    {
      id: "zuura", name: "Zuura GP", country: "Home Circuit", widthMul: 1.0,
      points: [[0, -95], [35, -88], [62, -66], [72, -30], [58, -2], [78, 30], [70, 62], [40, 84], [-2, 90], [-40, 82], [-66, 60], [-56, 28], [-78, 2], [-84, -40], [-58, -74], [-28, -90]]
    },
    {
      id: "monza", name: "Monza", country: "Italy \u00b7 inspired by", widthMul: 1.0,
      points: [[48, -86], [52, -40], [34, -18], [52, 2], [50, 46], [40, 74], [8, 86], [-30, 82], [-52, 58], [-46, 22], [-58, 2], [-50, -36], [-52, -74], [-26, -90], [10, -92], [34, -92]]
    },
    {
      id: "monaco", name: "Monaco", country: "Monte Carlo \u00b7 inspired by", widthMul: 0.78,
      points: [[58, -44], [68, -8], [52, 18], [60, 42], [40, 58], [18, 46], [24, 22], [2, 30], [-16, 52], [-46, 56], [-56, 30], [-34, 14], [-52, -6], [-58, -38], [-34, -56], [2, -58], [34, -54]]
    },
    {
      id: "silverstone", name: "Silverstone", country: "Great Britain \u00b7 inspired by", widthMul: 1.1,
      points: [[-86, -16], [-52, -44], [-12, -50], [18, -34], [8, -8], [42, -16], [74, -26], [88, 2], [64, 28], [34, 22], [40, 52], [8, 66], [-34, 58], [-58, 32], [-78, 12]]
    },
    {
      id: "spa", name: "Spa", country: "Belgium \u00b7 inspired by", widthMul: 1.05,
      points: [[-88, 28], [-54, 52], [-12, 56], [18, 38], [12, 8], [46, 2], [82, 12], [90, -22], [56, -42], [12, -44], [-22, -38], [-30, -62], [-62, -56], [-84, -22]]
    },
    {
      id: "suzuka", name: "Suzuka", country: "Japan \u00b7 inspired by", widthMul: 0.95,
      points: [[68, -52], [80, -14], [58, 12], [70, 42], [42, 60], [8, 52], [24, 28], [-6, 18], [-32, 36], [-30, 60], [-58, 56], [-72, 22], [-50, 6], [-72, -16], [-60, -50], [-22, -64], [16, -56], [46, -62]]
    }
  ];

  var TARGET = 2600;   // fit each track so its larger bbox dimension == TARGET (world units)
  var DENSE = 14;      // Catmull-Rom samples per control segment
  var NPTS = 240;      // uniform-resampled centerline resolution

  function catmullClosed(pts, samples) {
    var out = [], n = pts.length, i, s;
    for (i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (s = 0; s < samples; s++) {
        var t = s / samples, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          y: 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        });
      }
    }
    return out;
  }

  function fit(points) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i;
    for (i = 0; i < points.length; i++) { var p = points[i]; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, scale = TARGET / Math.max(maxX - minX, maxY - minY);
    for (i = 0; i < points.length; i++) { points[i].x = (points[i].x - cx) * scale; points[i].y = (points[i].y - cy) * scale; }
    return points;
  }

  // Resample a closed polyline to N points spaced evenly by arc length.
  function resampleClosed(points, N) {
    var n = points.length, cum = [0], i, total = 0;
    for (i = 1; i <= n; i++) { var a = points[i - 1], b = points[i % n]; total += Math.hypot(b.x - a.x, b.y - a.y); cum.push(total); }
    var out = [], step = total / N, seg = 0;
    for (i = 0; i < N; i++) {
      var d = i * step;
      while (seg < n && cum[seg + 1] < d) seg++;
      var a2 = points[seg % n], b2 = points[(seg + 1) % n], segLen = cum[seg + 1] - cum[seg] || 1, t = (d - cum[seg]) / segLen;
      out.push({ x: a2.x + (b2.x - a2.x) * t, y: a2.y + (b2.y - a2.y) * t });
    }
    return out;
  }

  // Build the playable centerline for a track: smooth -> fit -> uniform resample.
  function buildCenterline(track) {
    var dense = catmullClosed(track.points, DENSE);
    fit(dense);
    var pts = resampleClosed(dense, NPTS);
    var total = 0, n = pts.length;
    for (var i = 0; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; total += Math.hypot(b.x - a.x, b.y - a.y); }
    return { points: pts, length: total };
  }

  // Apex-cutting racing line: Laplacian shortening, but each point is projected
  // back onto the centerline NORMAL and its signed offset is clamped to the road
  // corridor — so the line is guaranteed to stay on the track (per review).
  function deriveRacingLine(center, maxOffset, iters) {
    var n = center.length, R = center.map(function (p) { return { x: p.x, y: p.y }; }), it, i;
    var N = []; for (i = 0; i < n; i++) N.push(normalAt(center, i));
    iters = iters || 160;
    for (it = 0; it < iters; it++) {
      var prev = R.map(function (p) { return { x: p.x, y: p.y }; });
      for (i = 0; i < n; i++) {
        var a = prev[(i - 1 + n) % n], b = prev[(i + 1) % n];
        R[i].x += ((a.x + b.x) / 2 - R[i].x) * 0.4;
        R[i].y += ((a.y + b.y) / 2 - R[i].y) * 0.4;
        var signed = (R[i].x - center[i].x) * N[i].x + (R[i].y - center[i].y) * N[i].y;
        if (signed > maxOffset) signed = maxOffset; else if (signed < -maxOffset) signed = -maxOffset;
        R[i].x = center[i].x + N[i].x * signed;
        R[i].y = center[i].y + N[i].y * signed;
      }
    }
    return R;
  }

  // Curvature magnitude per point (0..~1), for placing curbs at corners.
  function curvatures(points) {
    var n = points.length, out = new Array(n), i;
    for (i = 0; i < n; i++) {
      var a = points[(i - 1 + n) % n], b = points[i], c = points[(i + 1) % n];
      var v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
      var l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1;
      var dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
      out[i] = Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI; // 0 straight .. 1 sharp
    }
    return out;
  }

  // Normal (perpendicular, unit) at a point index for offsetting/curb placement.
  function normalAt(points, i) {
    var n = points.length, a = points[(i - 1 + n) % n], b = points[(i + 1) % n];
    var tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    return { x: -ty / l, y: tx / l };
  }

  window.RACER_TRACKS = TRACKS;
  window.RTRACK = { buildCenterline: buildCenterline, deriveRacingLine: deriveRacingLine, curvatures: curvatures, normalAt: normalAt, TARGET: TARGET, NPTS: NPTS };
})();
