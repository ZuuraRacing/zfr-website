/* =====================================================
   ZUURA Racing — main.js
   Shared chrome + canvas BG + cursor + nav drawer
   ===================================================== */

/* ---------- NAV + SPONSOR + FOOTER DATA ---------- */
const NAV = [
  {label:"Home",           href:"index.html"},
  {label:"Legacy Builds",  href:"cars.html"},
  {label:"Departments",    href:"departments.html"},
  {label:"Team",           href:"team.html"},
  {label:"Contests",       href:"contests.html"},
  {label:"Workshops",      href:"flagship.html"},
  {label:"Track Record",   href:"history.html"},
  {label:"Updates",        href:"news.html"},
  {label:"Arcade",         href:"racer.html"},
  {label:"Sponsors",       href:"sponsors.html"},
  {label:"Contact",        href:"contact.html"},
];

/* Marquee uses the same partner logos shown in the page footer strip */
const MARQUEE_SPONSORS = [
  {name:"KW Keizer Aluminium Wheels", img:"assets/images/sponsors/KWKeizerAluminumWheels.jpeg"},
  {name:"MRF",                        img:"assets/images/sponsors/MRF.jpg"},
  {name:"MATLAB",                     img:"assets/images/sponsors/MATLAB.png"},
  {name:"Ricardo",                    img:"assets/images/sponsors/Ricardo.jpg"},
  {name:"ThingSpeak",                 img:"assets/images/sponsors/ThingSpeak.png"},
  {name:"PPT Power Tools",            img:"assets/images/sponsors/PPT Power Tools.png"},
  {name:"ANSYS",                      img:"assets/images/sponsors/Ansys.png"},
  {name:"DS SolidWorks",              img:"assets/images/sponsors/DS SolidWorks.png"},
  {name:"Agni Motors",                img:"assets/images/sponsors/Agni Motors.png"},
  {name:"ASAP Motorsports",           img:"assets/images/sponsors/ASAP Motorsports.png"},
  {name:"Bender",                     img:"assets/images/sponsors/Bender.png"},
  {name:"Kelly",                      img:"assets/images/sponsors/Kelly.jpg"},
  {name:"Flauta Customs",             img:"assets/images/sponsors/Flauta Customs.jpg"},
  {name:"CustomWorks",                img:"assets/images/sponsors/CustomWorks.png"},
  {name:"Drexler Automotive",         img:"assets/images/sponsors/Drexler Automotive.png"},
];

const FOOT_COLS = [
  {title:"Navigate", links:[
    {label:"Home",        href:"index.html"},
    {label:"Cars",        href:"cars.html"},
    {label:"Departments", href:"departments.html"},
    {label:"Team",        href:"team.html"},
  ]},
  {title:"Compete", links:[
    {label:"Contests",    href:"contests.html"},
    {label:"Flagship",    href:"flagship.html"},
    {label:"History",     href:"history.html"},
    {label:"News",        href:"news.html"},
  ]},
  {title:"Connect", links:[
    {label:"Join Team",    href:"contact.html"},
    {label:"Sponsor Us",   href:"sponsors.html"},
    {label:"Press",        href:"contact.html"},
    {label:"Partnerships", href:"contact.html"},
  ]},
];

/* ---------- BUILD CHROME (called by every page) ---------- */
function buildChrome(){
  // background canvas + cursor (skippable per-page for perf, e.g. the racer)
  let bg = null;
  if (!window.ZUURA_DISABLE_BG_CANVAS){
    bg = document.createElement("canvas"); bg.id = "bg-canvas";
    document.body.prepend(bg);
  }
  let ring = null, dot = null;
  if (!window.ZUURA_DISABLE_CURSOR){
    ring = document.createElement("div"); ring.className = "cursor-ring";
    dot  = document.createElement("div"); dot.className = "cursor-dot";
    document.body.append(ring, dot);
  }

  // hamburger button
  const btn = document.createElement("button");
  btn.className = "menu-btn"; btn.setAttribute("aria-label","Open menu");
  btn.innerHTML = "<span></span><span></span><span></span>";
  document.body.append(btn);

  // brand mark
  const brand = document.createElement("a");
  brand.className = "brand-mark"; brand.href = "index.html";
  brand.innerHTML =
    '<img src="assets/images/logo/Logo.png" alt="ZUURA">' +
    '<div class="label">ZUURA <span>RACING</span></div>';
  document.body.append(brand);

  // nav drawer + backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop";
  document.body.append(backdrop);

  const drawer = document.createElement("nav");
  drawer.className = "nav-drawer";
  const currentPage = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  drawer.innerHTML =
    '<div class="drawer-brand">' +
      '<img src="assets/images/logo/Logo.png" alt="ZUURA">' +
      '<div class="label">ZUURA <span>RACING</span></div>' +
    '</div>' +
    '<ul>' +
      NAV.map(n => {
        const isActive = n.href.toLowerCase() === currentPage;
        return '<li><a class="' + (isActive ? 'is-active' : '') + '" href="'+n.href+'">'+
          n.label + ' <span class="arrow">\u25B6</span></a></li>';
      }).join('') +
    '</ul>' +
    '<a href="contact.html" class="drawer-cta">Join The Team</a>';
  document.body.append(drawer);

  // marquee + footer
  const footer = document.createElement("footer");
  const marqueeImgs = [...MARQUEE_SPONSORS, ...MARQUEE_SPONSORS, ...MARQUEE_SPONSORS]
    .map(s => '<img src="'+s.img+'" alt="'+s.name+'">').join('');
  footer.innerHTML =
    '<div class="marquee">' +
      '<div class="heading">Our Partners &amp; Sponsors</div>' +
      '<div class="track">'+marqueeImgs+'</div>' +
    '</div>' +
    '<div class="foot">' +
      '<div class="foot-cols">' +
        '<div class="foot-brand">' +
          '<div class="head">' +
            '<img src="assets/images/logo/Logo.png" alt="ZUURA">' +
            '<div class="name">ZUURA <span>RACING</span></div>' +
          '</div>' +
          '<p>Student-run formula racing team. Engineering excellence &mdash; on and off the track.</p>' +
          '<div class="socials">' +
            '<a href="https://www.instagram.com/zuuraformularacing/" target="_blank" rel="noopener noreferrer"><img src="assets/images/icons/ig.png" alt="Instagram"></a>' +
            '<a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer"><img src="assets/images/icons/linkedin.png" alt="LinkedIn"></a>' +
            '<a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer"><img src="assets/images/icons/yt.png" alt="YouTube"></a>' +
          '</div>' +
        '</div>' +
        FOOT_COLS.map(c =>
          '<div class="foot-col"><div class="title">'+c.title+'</div>'+
            '<ul>'+c.links.map(l => '<li><a href="'+l.href+'">'+l.label+'</a></li>').join('')+'</ul>'+
          '</div>'
        ).join('') +
      '</div>' +
      '<div class="foot-bottom">' +
        '<div class="credit">by Srishtee Gupta; \u00A9 ZUURA Racing. All rights reserved.</div>' +
        '<div class="legal"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Media</a></div>' +
      '</div>' +
    '</div>';
  document.body.append(footer);

  // wire everything up
  initNavDrawer(btn, drawer, backdrop);
  if (ring && dot) initCursor(ring, dot);
  if (bg) initCanvasBg(bg);
}

/* ---------- nav drawer toggle ---------- */
function initNavDrawer(btn, drawer, backdrop){
  const setOpen = (open) => {
    drawer.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    btn.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    document.dispatchEvent(new CustomEvent("zuura:drawer", { detail: { open } }));
  };
  const toggle = () => setOpen(!drawer.classList.contains("is-open"));
  btn.addEventListener("click", toggle);
  backdrop.addEventListener("click", () => setOpen(false));
  drawer.querySelectorAll("a").forEach(a =>
    a.addEventListener("click", () => setOpen(false))
  );
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) setOpen(false);
  });
}

/* ---------- custom cursor (desktop) ---------- */
function initCursor(ring, dot){
  if (matchMedia("(hover:none),(max-width:768px)").matches) return;
  const target = {x:0,y:0}, smooth = {x:0,y:0};
  addEventListener("mousemove", e => { target.x = e.clientX; target.y = e.clientY; });
  const tick = () => {
    smooth.x += (target.x - smooth.x) * 0.12;
    smooth.y += (target.y - smooth.y) * 0.12;
    dot.style.transform  = "translate("+(target.x-5)+"px,"+(target.y-5)+"px)";
    ring.style.transform = "translate("+(smooth.x-18)+"px,"+(smooth.y-18)+"px)";
    requestAnimationFrame(tick);
  };
  tick();
}

/* ---------- background canvas: streaks + perspective lines + vignette ---------- */
function initCanvasBg(canvas){
  const ctx = canvas.getContext("2d");
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize();
  addEventListener("resize", resize);

  const streaks = Array.from({length:70}, () => ({
    x: Math.random()*innerWidth,
    y: Math.random()*innerHeight,
    speed: 0.5 + 2.5*Math.random(),
    len:   40  + 120*Math.random(),
    opacity: 0.1 + 0.35*Math.random(),
    gold: Math.random() > 0.7,
  }));
  let off = 0;

  const line = (x1,y1,x2,y2,color,w=1) => {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  };

  const tick = () => {
    const w = canvas.width, h = canvas.height;
    const cx = w/2, cy = h/2;
    off = (off + 1.4) % 80;
    ctx.fillStyle = "#080706"; ctx.fillRect(0,0,w,h);

    const u = 0.55*w;
    line(cx-u, h, cx, cy, "rgba(212,160,23,.18)", 1.5);
    line(cx+u, h, cx, cy, "rgba(212,160,23,.18)", 1.5);
    for (let t=1; t<=5; t++){
      const e = t/6;
      const a = 0.04 + 0.06*e;
      line(cx, cy, cx-u*e, h-(h-cy)*(1-0.7*e), "rgba(212,160,23,"+a+")", 0.5);
      line(cx, cy, cx+u*e, h-(h-cy)*(1-0.7*e), "rgba(212,160,23,"+a+")", 0.5);
    }
    for (let t=0; t<16; t++){
      const e = (t/16 + off/1280) % 1;
      const r = ((t+0.45)/16 + off/1280) % 1;
      line(cx, cy+(h-cy)*e, cx, cy+(h-cy)*r, "rgba(212,160,23,"+(0.08+0.25*e)+")", 0.8);
    }

    streaks.forEach(s => {
      s.y -= s.speed;
      if (s.y + s.len < 0){ s.y = h + s.len; s.x = Math.random()*w; }
      const g = ctx.createLinearGradient(s.x, s.y, s.x, s.y+s.len);
      g.addColorStop(0, "transparent");
      g.addColorStop(.5, s.gold
        ? "rgba(212,160,23,"+s.opacity+")"
        : "rgba(255,255,255,"+(0.7*s.opacity)+")");
      g.addColorStop(1, "transparent");
      ctx.strokeStyle = g; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y+s.len); ctx.stroke();
    });

    const v = ctx.createRadialGradient(cx,cy,0, cx,cy, 0.75*Math.max(w,h));
    v.addColorStop(0, "transparent");
    v.addColorStop(1, "rgba(8,7,6,.82)");
    ctx.fillStyle = v; ctx.fillRect(0,0,w,h);
    requestAnimationFrame(tick);
  };
  tick();
}

/* ---------- helpers exposed for page-specific scripts ---------- */
function el(tag, attrs={}, ...kids){
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  kids.flat().forEach(k => n.append(k instanceof Node ? k : document.createTextNode(k)));
  return n;
}

document.addEventListener("DOMContentLoaded", buildChrome);
