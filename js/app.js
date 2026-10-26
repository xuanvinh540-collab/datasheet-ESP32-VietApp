/* Pin Explorer: vẽ PCB/schematic từ dữ liệu boards.js, panel chi tiết, bộ tính toán. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const $ = s => document.querySelector(s);
  const el = (t, a = {}, parent, text) => {
    const e = document.createElementNS(NS, t);
    for (const k in a) e.setAttribute(k, a[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const h = (t, cls, html) => { const e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cv = v => `var(${v})`;
  const PCB = { green: ["#1f5a3f", "#123826"], green2: ["#1d6b47", "#114a30"], black: ["#202422", "#0d0f0e"], blue: ["#16609c", "#0d416d"] };

  const state = { b: null, view: "pcb", sel: null, flag: null, q: "", zoom: 1, tab: "pins" };
  let pins = [];

  // Chuẩn hoá: gán key, số chân header, trạng thái
  BOARDS.forEach(b => b.headers.forEach(hd => hd.pins.forEach((p, i) => {
    p.hdr = hd.sch || hd.id; p.pn = p.pn || i + 1;
    p.status = p.cat === "ban" || p.cat === "nc" ? "ban" : p.warn && ["gpio", "adc", "comm", "strap", "usb"].includes(p.cat) ? "warn" : ["power", "gnd", "ctl"].includes(p.cat) ? "info" : "ok";
  })));

  /* Icon board: thu nhỏ chính dữ liệu PCB (viền, linh kiện, chân) thành SVG */
  function boardIcon(b) {
    const [fill, edge] = PCB[b.pcb] || PCB.green, m = 2, vb = `${-m} ${-m} ${b.w + 2 * m} ${b.h + 2 * m}`;
    const r = Math.max(b.w, b.h) / 40;
    const parts = b.parts.filter(p => p.t !== "hole" && p.t !== "ant" && p.t !== "led").map(p =>
      `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${r}" fill="${["usb", "btn", "shield"].includes(p.t) ? "#c9cfd2" : p.t === "jack" ? "#111" : "#16191a"}"/>`).join("");
    const pads = b.headers.flatMap(hd => hd.pins).map(p => `<circle cx="${p.x}" cy="${p.y}" r="${Math.max(.7, r * 1.1)}" fill="#e2c063"/>`).join("");
    return `<svg viewBox="${vb}" aria-hidden="true"><rect width="${b.w}" height="${b.h}" rx="${r * 2}" fill="${fill}" stroke="${edge}" stroke-width="${r}"/>${parts}${pads}</svg>`;
  }

  /* ---------- Chọn board ---------- */
  function renderBoardList() {
    const box = $("#boards"); box.innerHTML = "";
    BOARDS.forEach(b => {
      const fam = { ESP32: "esp", RP2: "rp", "Raspberry Pi": "rp", AVR: "avr" }[b.family] || "esp";
      const btn = h("button", "board-card", `<span class="bc-icon ${fam}">${boardIcon(b)}<b>${esc(b.tag)}</b></span><span class="bc-txt"><span class="bc-name">${esc(b.name)}</span><span class="bc-chip">${esc(b.chip)} · ${esc(b.logic)}</span></span>`);
      btn.title = b.name;
      btn.setAttribute("aria-pressed", b === state.b);
      btn.onclick = () => selectBoard(b.id);
      box.appendChild(btn);
    });
  }
  function selectBoard(id, pinName) {
    state.b = BOARDS.find(b => b.id === id) || BOARDS[0];
    pins = state.b.headers.flatMap(hd => hd.pins);
    state.sel = pinName ? pins.find(p => p.name === pinName) || null : null;
    state.flag = null; state.q = ""; $("#q").value = "";
    renderBoardList(); renderFilters(); draw(); renderDetail(); renderDocs(); renderSpec(); syncHash();
    const active = $("#boards [aria-pressed=true]"); if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
  }
  // URL dạng <gốc app>/[en/]<board>/#<chân> – mỗi board là một trang thật (xem tools/build-seo.js)
  const appRoot = new URL(".", document.baseURI).href;
  function syncHash() {
    const en = document.documentElement.lang === "en";
    const url = appRoot + (en ? "en/" : "") + state.b.id + "/" + (state.sel ? "#" + encodeURIComponent(state.sel.name) : "");
    if (location.href !== url) history.replaceState(null, "", url);
  }
  window.onLangChange = () => { if (state.b) { draw(); syncHash(); } };

  /* ---------- Bộ lọc ---------- */
  function renderFilters() {
    const box = $("#filters"); box.innerHTML = "";
    const used = new Set(pins.flatMap(p => p.flags));
    Object.entries(FLAGS).filter(([k]) => used.has(k)).forEach(([k, label]) => {
      const c = h("button", "chip", esc(label)); c.setAttribute("aria-pressed", state.flag === k);
      c.onclick = () => {
        state.flag = state.flag === k ? null : k; state.sel = null;
        renderFilters(); applyDim(); renderDetail(); syncHash();
        if (state.flag && matchMedia("(max-width: 899px)").matches) $("#detail").classList.add("open");
      };
      box.appendChild(c);
    });
    const legend = $("#legend"); legend.innerHTML = "";
    const cats = new Set(pins.map(p => p.cat));
    Object.entries(CATS).filter(([k]) => cats.has(k) && k !== "nc").forEach(([k, v]) => legend.appendChild(h("span", "lg", `<i style="background:${cv(v.c)}"></i>${esc(v.label)}`)));
  }
  const matches = p => {
    if (state.flag && !p.flags.includes(state.flag)) return false;
    if (!state.q) return true;
    const q = state.q.toLowerCase().trim();
    const hay = [p.name, p.gpio != null ? "gpio" + p.gpio : "", p.gpio != null ? String(p.gpio) : "", ...p.fn].join(" ").toLowerCase();
    return /^\d+$/.test(q) ? p.gpio === +q || hay.split(/[^a-z0-9]+/).includes(q) : hay.includes(q);
  };
  function applyDim() {
    const any = state.flag || state.q;
    document.querySelectorAll("#svg .pin").forEach(g => {
      const p = pins[+g.dataset.i];
      g.classList.toggle("dim", !!any && !matches(p));
      g.classList.toggle("sel", p === state.sel);
    });
    const n = any ? pins.filter(matches).length : null;
    $("#count").textContent = n == null ? `${pins.length} chân` : `${n}/${pins.length} chân khớp`;
  }

  /* ---------- Vẽ PCB ---------- */
  const TW = 11.5, TH = 2.3, AW = 13, FS = 1.55;
  const showAlt = () => innerWidth >= 600 || state.zoom > 1;
  function short(p) {
    if (!showAlt() || ["power", "gnd", "ctl", "nc"].includes(p.cat)) return "";
    const f = p.fn.find(x => !/^Arduino|^PIO|^Ground|^GPIO\d|^IO\d/.test(x)), a = p.fn.find(x => /^Arduino (SDA|SCL|MOSI|MISO|SCK|SS)$/.test(x));
    const main = f ? f.replace(/ \(.*\)$/, "").replace(" · ", "·") : "";
    return (a ? a.slice(8) + (main ? " · " + main : "") : main).slice(0, 20);
  }
  function labelColors(p) { return { bg: cv(CATS[p.cat].c), fg: ["strap", "nc"].includes(p.cat) ? "#1a1a1a" : "#fff" }; }

  function drawPCB(svg) {
    const b = state.b, [fill, edge] = PCB[b.pcb] || PCB.green;
    const bb = { x0: 0, y0: 0, x1: b.w, y1: b.h };
    const grow = (x, y) => { bb.x0 = Math.min(bb.x0, x); bb.y0 = Math.min(bb.y0, y); bb.x1 = Math.max(bb.x1, x); bb.y1 = Math.max(bb.y1, y); };
    const defs = el("defs", {}, svg);
    const mg = el("linearGradient", { id: "metal", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#e4e7e8" }, mg); el("stop", { offset: .55, "stop-color": "#a9afb3" }, mg); el("stop", { offset: 1, "stop-color": "#cfd4d6" }, mg);
    const hp = el("pattern", { id: "hatch", width: 1.2, height: 1.2, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 1.2, stroke: "#d8c27a", "stroke-width": .35 }, hp);

    const board = el("g", { class: "board" }, svg);
    if (!b.photo) el("rect", { x: 0, y: 0, width: b.w, height: b.h, rx: 1.2, fill, stroke: edge, "stroke-width": .5 }, board);
    el("rect", { x: .6, y: .6, width: b.w - 1.2, height: b.h - 1.2, rx: .8, fill: "none", stroke: "rgba(255,255,255,.07)", "stroke-width": .25 }, board);
    // Có ảnh board chính thức thì dùng ảnh làm nền (đã cắt khớp toạ độ chân), không vẽ linh kiện giả
    if (b.photo) { const [px, py, pw2, ph] = b.photo.box || [0, 0, b.w, b.h]; el("image", { href: b.photo.src, x: px, y: py, width: pw2, height: ph, preserveAspectRatio: "none" }, board); grow(px, py); grow(px + pw2, py + ph); }
    else b.parts.forEach(pt => drawPart(board, pt));

    b.headers.forEach(hd => {
      const lead = el("g", { class: "leads" }, svg);
      hd.pins.forEach(p => {
        const i = pins.indexOf(p), col = labelColors(p);
        const g = el("g", { class: "pin", tabindex: 0, role: "button", "data-i": i, "aria-label": `${p.name} ${p.fn.join(", ")}` }, svg);
        const vert = hd.side === "T" || hd.side === "B";
        const alt = short(p);
        if (!vert) {
          const L = hd.side === "L", tx = L ? hd.at - TW : hd.at, ax = L ? tx - .5 - AW : tx + TW + .5;
          el("line", { x1: p.x, y1: p.y, x2: hd.at, y2: p.y, stroke: col.bg, "stroke-width": .3, class: "lead" }, lead);
          el("rect", { x: tx, y: p.y - TH / 2, width: TW, height: TH, rx: .45, fill: col.bg, class: "tab" }, g);
          el("text", { x: tx + TW / 2, y: p.y + .02, "text-anchor": "middle", "dominant-baseline": "central", "font-size": FS, fill: col.fg, class: "tl" }, g, (p.cat === "strap" ? "⚠" : "") + p.name);
          if (alt && !hd.inner) {
            el("text", { x: L ? ax + AW : ax, y: p.y + .02, "text-anchor": L ? "end" : "start", "dominant-baseline": "central", "font-size": 1.05, class: "alt" }, g, alt);
            grow(L ? ax : ax + AW, p.y);
          }
          if (hd.inner) el("text", { x: tx + .5, y: p.y + .02, "dominant-baseline": "central", "font-size": .8, fill: col.fg, opacity: .75 }, g, p.pn);
          grow(tx, p.y - TH); grow(tx + TW, p.y + TH);
        } else {
          const T = hd.side === "T", ty = T ? hd.at - TW : hd.at;
          el("line", { x1: p.x, y1: p.y, x2: p.x, y2: hd.at, stroke: col.bg, "stroke-width": .3, class: "lead" }, lead);
          el("rect", { x: p.x - TH / 2, y: ty, width: TH, height: TW, rx: .45, fill: col.bg, class: "tab" }, g);
          el("text", { x: p.x, y: ty + TW / 2, "text-anchor": "middle", "dominant-baseline": "central", "font-size": FS, fill: col.fg, transform: `rotate(-90 ${p.x} ${ty + TW / 2})`, class: "tl" }, g, p.name);
          grow(p.x - TH, ty); grow(p.x + TH, ty + TW);
        }
        // pad mạ vàng + lỗ khoan; chân 1 dùng pad vuông như PCB thật
        const sq = p.pn === 1 && hd === b.headers[0];
        if (sq) el("rect", { x: p.x - .85, y: p.y - .85, width: 1.7, height: 1.7, class: "pad" }, g);
        else el("circle", { cx: p.x, cy: p.y, r: .85, class: "pad" }, g);
        el("circle", { cx: p.x, cy: p.y, r: .42, class: "drill" }, g);
        el("circle", { cx: p.x, cy: p.y, r: 1.25, class: "ring", fill: "none" }, g);
        el("circle", { cx: p.x, cy: p.y, r: 1.27, fill: "transparent" }, g);
      });
    });
    b.parts.forEach(pt => grow(pt.x, pt.y));
    const pad = 1.5;
    svg.setAttribute("viewBox", `${bb.x0 - pad} ${bb.y0 - pad} ${bb.x1 - bb.x0 + 2 * pad} ${bb.y1 - bb.y0 + 2 * pad}`);
  }

  function drawPart(g, pt) {
    const t = pt.t;
    if (t === "hole") { el("circle", { cx: pt.x, cy: pt.y, r: pt.r + .7, fill: "#c9a94a" }, g); el("circle", { cx: pt.x, cy: pt.y, r: pt.r, class: "drill" }, g); return; }
    const r = { x: pt.x, y: pt.y, width: pt.w, height: pt.h };
    const cx = pt.x + pt.w / 2, cy = pt.y + pt.h / 2;
    const txt = (s, y, size, cls = "silk", fill) => el("text", { x: cx, y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": size, class: cls, ...(fill ? { fill } : {}) }, g, s);
    if (t === "module") {
      el("rect", { ...r, rx: .4, fill: "#1b1f1d", stroke: "#000", "stroke-width": .2 }, g);
      el("rect", { x: pt.x, y: pt.y, width: pt.w, height: pt.ant, fill: "url(#hatch)", opacity: .7 }, g);
      el("rect", { x: pt.x + 1, y: pt.y + pt.ant + .8, width: pt.w - 2, height: pt.h - pt.ant - 1.8, rx: .4, fill: "url(#metal)" }, g);
      txt(pt.label, pt.y + pt.ant + (pt.h - pt.ant) / 2 - .9, 1.9, "engr");
      txt(pt.sub, pt.y + pt.ant + (pt.h - pt.ant) / 2 + 1.3, 1.2, "engr");
    } else if (t === "shield") {
      el("rect", { ...r, rx: .4, fill: "url(#metal)", stroke: "#8b9196", "stroke-width": .2 }, g); txt(pt.label, cy, 1.2, "engr");
    } else if (t === "chip" || t === "dip") {
      el("rect", { ...r, rx: .3, fill: "#151716", stroke: "#000", "stroke-width": .15 }, g);
      if (t === "dip") for (let i = 0; i < 14; i++) { const y = pt.y + 1.3 + i * 2.54 * (pt.h - 2.6) / (13 * 2.54); el("rect", { x: pt.x - .8, y: y - .3, width: .8, height: .6, fill: "#c0c4c6" }, g); el("rect", { x: pt.x + pt.w, y: y - .3, width: .8, height: .6, fill: "#c0c4c6" }, g); }
      el("circle", { cx: pt.x + .7, cy: pt.y + .7, r: .25, fill: "#444" }, g);
      if (t === "dip") el("text", { x: cx, y: cy, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 1.6, class: "chiptxt", transform: `rotate(90 ${cx} ${cy})` }, g, pt.label);
      else { txt(pt.label, pt.sub ? cy - .6 : cy, pt.small ? .8 : 1.25, "chiptxt"); if (pt.sub) txt(pt.sub, cy + .8, .9, "chiptxt"); }
    } else if (t === "usb" || t === "jack") {
      el("rect", { ...r, rx: .6, fill: t === "jack" ? "#111" : "url(#metal)", stroke: "#6f767a", "stroke-width": .2 }, g);
      txt(pt.label, cy, Math.min(1.3, pt.w / 5), t === "jack" ? "silk" : "engr");
    } else if (t === "btn") {
      el("rect", { ...r, rx: .3, fill: "url(#metal)" }, g);
      el("circle", { cx, cy, r: Math.min(pt.w, pt.h) * .3, fill: "#2b2b2b" }, g);
      txt(pt.label, pt.y + pt.h + .9, .9);
    } else if (t === "led") {
      el("rect", { ...r, rx: .15, fill: pt.color, class: "led" }, g); txt(pt.label, pt.y + pt.h + .8, .8);
    } else if (t === "ant") {
      el("rect", { ...r, rx: .3, fill: "none", stroke: "#d8c27a", "stroke-width": .2, "stroke-dasharray": ".6 .4" }, g);
      el("path", { d: `M${pt.x + 1} ${cy} h${pt.w / 6} v-1 h${pt.w / 6} v2 h${pt.w / 6} v-2 h${pt.w / 6} v1 h${pt.w / 6 - 1}`, fill: "none", stroke: "#d8c27a", "stroke-width": .3 }, g);
      txt(pt.label, pt.y + pt.h - .7, .8);
    }
  }

  /* ---------- Kiến trúc module: chip ở giữa, khối ngoại vi hai bên, đường nối ghi tên bus/chân ---------- */
  function drawArch(svg) {
    const b = state.b, A = b.arch, BW = 30, BH = 10, GAP = 4, BUS = 26;
    const L = A.blocks.filter(x => x.side === "L"), R = A.blocks.filter(x => x.side === "R");
    const rows = Math.max(L.length, R.length), H = rows * (BH + GAP) - GAP;
    const xL = 0, xC = BW + BUS, CW = 30, xR = xC + CW + BUS, cy0 = 8;
    el("rect", { x: xC, y: cy0, width: CW, height: H, rx: 1.5, class: "mcu" }, svg);
    el("text", { x: xC + CW / 2, y: cy0 + H / 2 - 2, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 2.6, class: "symtitle" }, svg, A.core);
    el("text", { x: xC + CW / 2, y: cy0 + H / 2 + 2, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 1.5, class: "pnum" }, svg, A.coreSub || "");
    const KC = { power: "--c-power", usb: "--c-usb", comm: "--c-comm", mem: "--c-adc", io: "--c-gpio", ctl: "--c-ctl", rf: "--c-strap" };
    const block = (blk, i, left) => {
      const list = left ? L : R, y = cy0 + i * (BH + GAP) + (H - (list.length * (BH + GAP) - GAP)) / 2, x = left ? xL : xR;
      const g = el("g", { class: "blk" }, svg), c = cv(KC[blk.k] || "--c-ctl");
      el("rect", { x, y, width: BW, height: BH, rx: 1.2, class: "symbox" }, g);
      el("rect", { x: left ? x : x + BW - 1, y, width: 1, height: BH, fill: c }, g);
      el("text", { x: x + BW / 2, y: y + 3.8, "text-anchor": "middle", "font-size": 1.8, class: "symtitle" }, g, blk.n);
      el("text", { x: x + BW / 2, y: y + 7, "text-anchor": "middle", "font-size": 1.25, class: "pnum" }, g, blk.s || "");
      const yy = y + BH / 2, x0 = left ? x + BW : xC + CW, x1 = left ? xC : x;
      el("line", { x1: x0, y1: yy, x2: x1, y2: yy, stroke: c, "stroke-width": .45 }, g);
      el("text", { x: (x0 + x1) / 2, y: yy - 1, "text-anchor": "middle", "font-size": 1.2, class: "buslbl" }, g, blk.bus || "");
    };
    L.forEach((blk, i) => block(blk, i, true)); R.forEach((blk, i) => block(blk, i, false));
    el("text", { x: 0, y: 3.5, "font-size": 1.6, class: "pnum" }, svg, "Sơ đồ khối board: khối ngoại vi và bus/chân nối vào chip");
    svg.setAttribute("viewBox", `-1 0 ${xR + BW + 2} ${H + cy0 + 4}`);
  }

  function draw() {
    const oem = state.b.oem, isOem = state.view === "oem" && oem;
    if (state.view === "oem" && !oem) state.view = "pcb";
    $("#viewOem").hidden = !oem;
    $("#viewOem").setAttribute("aria-pressed", !!isOem);
    ["#canvas", "#filters", ".stage-foot", ".search"].forEach(s => $(s).hidden = !!isOem);
    ["#filters", ".stage-foot", ".search"].forEach(s => { if (state.view === "sch") $(s).hidden = true; });
    $("#oem").hidden = !isOem;
    if (isOem) {
      $("#oem").innerHTML = oem.pages.map(([src, t]) => `<figure><figcaption>${esc(t)}</figcaption><div class="oem-img"><img src="${src}" alt="${esc(t)}" loading="lazy" style="width:${state.zoom * 100}%"></div></figure>`).join("") +
        `<p class="credit">Nguồn: <b>${esc(oem.by)}</b> – <a href="${esc(oem.url)}" target="_blank" rel="noopener">${esc(oem.file)} ↗</a>${oem.license ? ` · Giấy phép ${esc(oem.license)}` : ""}. Ảnh chuyển từ PDF gốc, giữ nguyên nội dung; bản quyền thuộc ${esc(oem.by)}.${oem.note ? " " + esc(oem.note) : ""}</p>`;
    }
    const svg = $("#svg"); svg.innerHTML = "";
    svg.classList.toggle("sch", state.view === "sch");
    if (state.view === "pcb") drawPCB(svg); else drawArch(svg);
    svg.style.width = state.zoom * 100 + "%";
    svg.querySelectorAll(".pin").forEach(g => {
      g.addEventListener("click", () => pick(pins[+g.dataset.i]));
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(pins[+g.dataset.i]); } });
    });
    $("#viewPcb").setAttribute("aria-pressed", state.view === "pcb");
    $("#viewSch").setAttribute("aria-pressed", state.view === "sch");
    $("#bTitle").textContent = state.b.name;
    renderSeoTable();
    document.title = document.documentElement.lang === "en" ? `${state.b.name} Pinout – GPIO, ADC, I2C, SPI reference | Pindex` : `Sơ đồ chân ${state.b.name} (Pinout) – GPIO, ADC, I2C, SPI | Pindex`;
    $("#bSub").textContent = `${state.b.vendor} · ${state.b.chip} · logic ${state.b.logic}`;
    const note = [state.b.note, state.view === "pcb" && state.b.photo ? state.b.photo.credit : ""].filter(Boolean).join(" · ");
    $("#bNote").textContent = note; $("#bNote").hidden = !note;
    applyDim();
  }

  /* ---------- Chi tiết ---------- */
  function pick(p) {
    state.sel = state.sel === p ? null : p;
    applyDim(); renderDetail(); syncHash();
    if (state.sel && matchMedia("(max-width: 899px)").matches) $("#detail").classList.add("open");
  }
  const STATUS = { ok: ["Dùng tự do", "ok", "✅"], warn: ["Dùng được nhưng cần chú ý", "warn", "⚠"], ban: ["Không dùng làm GPIO", "ban", "⛔"], info: ["Chân nguồn / điều khiển", "info", "ℹ"] };
  const SRC = { ds: "Datasheet", hdg: "HDG", std: "Thông lệ" };
  function renderDetail() {
    const box = $("#detailBody"), b = state.b, p = state.sel;
    const L = !p && state.flag && window.LEARN && LEARN[state.flag];
    if (L) {
      const hit = pins.filter(x => x.flags.includes(state.flag));
      const li = a => `<ul class="notes">${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
      box.innerHTML = `<div class="d-head"><div><div class="d-kicker">Kiến thức · ${esc(FLAGS[state.flag])}</div><h2 class="learn-h">${esc(L.title)}</h2></div>
          <button class="icon-btn" id="dClose" aria-label="Đóng">✕</button></div>
        <p class="wtext">${esc(L.def)}</p>
        <div class="d-sec">Nguyên lý</div><p class="small">${esc(L.how)}</p>
        <div class="d-sec">Ứng dụng</div>${li(L.use)}
        <div class="procon"><div><div class="d-sec ok">▲ Ưu điểm</div>${li(L.pro)}</div><div><div class="d-sec bad">▼ Nhược điểm</div>${li(L.con)}</div></div>
        <div class="d-sec">Chân trên ${esc(b.name)} (${hit.length})</div>
        <div class="fns">${hit.map(x => `<button class="pinchip" data-i="${pins.indexOf(x)}">${esc(x.name)}</button>`).join("")}</div>
        <div class="d-sec">Ví dụ nối dây</div><p class="small">${esc(L.ex)}</p>
        <pre class="code">${esc(L.code)}</pre>`;
      box.querySelectorAll(".pinchip").forEach(bt => bt.onclick = () => pick(pins[+bt.dataset.i]));
      $("#dClose").onclick = () => { state.flag = null; $("#detail").classList.remove("open"); renderFilters(); applyDim(); renderDetail(); };
      return;
    }
    if (!p) {
      box.innerHTML = `<div class="d-head"><div><div class="d-kicker">Board</div><h2>${esc(b.name)}</h2></div></div>
        <p class="muted">${esc(b.summary)}</p>
        <dl class="facts">${b.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <button class="btn-share share">⤴ Chia sẻ board này</button>
        <div class="d-sec">Tài liệu hãng</div>${docList(b.docs)}
        <p class="hint">Chạm vào một chân trên hình để xem chức năng, cảnh báo và linh kiện gợi ý.</p>`;
      return;
    }
    const st = STATUS[p.status], cat = CATS[p.cat];
    const elec = p.gpio != null && b.elec ? b.elec.map(([k, v]) => [k, typeof v === "function" ? v(p) : v]) : [];
    box.innerHTML = `<div class="d-head"><div><h2 class="mono">${esc(p.name)}</h2>
        <div class="d-kicker">${p.gpio != null ? "GPIO" + p.gpio + " · " : ""}${esc(p.hdr)}-${p.pn} · ${esc(cat.label)}</div></div>
        <div class="d-act"><button class="icon-btn share" aria-label="Chia sẻ">⤴</button><button class="icon-btn" id="dClose" aria-label="Đóng">✕</button></div></div>
      <div class="status ${st[1]}">${st[2]} ${st[0]}</div>
      ${p.warn ? `<p class="wtext">${esc(p.warn)}</p>` : ""}
      ${p.notes.length ? `<ul class="notes">${p.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      ${p.fn.length ? `<div class="fns">${p.fn.map(f => `<span>${esc(f)}</span>`).join("")}</div>` : ""}
      ${elec.length ? `<dl class="elec">${elec.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
      ${p.parts.length ? `<div class="d-sec">Linh kiện đi kèm</div><div class="pparts">${p.parts.map(([k, v, s]) => `<div class="pp"><b>${esc(k)}</b><div>${esc(v)}</div><span class="tag ${s}">${SRC[s] || s}</span></div>`).join("")}</div>` : ""}
      <p class="srcline">📄 Nguồn: ${esc(b.src)} · <a href="${esc(b.docs[0][2])}" target="_blank" rel="noopener">datasheet ↗</a></p>`;
    $("#dClose").onclick = () => { state.sel = null; $("#detail").classList.remove("open"); applyDim(); renderDetail(); syncHash(); };
  }
  // Chia sẻ: Web Share API trên điện thoại (Zalo, Messenger…), máy tính thì copy link
  async function share() {
    const en = document.documentElement.lang === "en", p = state.sel, b = state.b;
    const title = p ? `${b.name} – ${p.name}` : (en ? `${b.name} pinout` : `Sơ đồ chân ${b.name}`);
    const text = p ? `${p.name}: ${p.fn.slice(0, 4).join(", ")}${p.warn ? " ⚠" : ""}` : (en ? "Pin functions, warnings and datasheet links" : "Chức năng từng chân, cảnh báo, link datasheet");
    const url = location.href;
    try { if (navigator.share) return await navigator.share({ title, text, url }); } catch (e) { return; }
    try { await navigator.clipboard.writeText(url); toast(en ? "Link copied" : "Đã copy link"); } catch (e) { prompt("Link:", url); }
  }
  function toast(t) { const d = h("div", "toast", esc(t)); document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }
  $("#detailBody").addEventListener("click", e => { if (e.target.closest(".share")) share(); });

  const KIND = { datasheet: "Datasheet", manual: "Manual", guide: "Hướng dẫn", schematic: "Schematic", pinout: "Pinout", errata: "Errata", code: "Code" };
  const docList = docs => `<ul class="docs">${docs.map(([k, label, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener"><span class="dk">${KIND[k] || k}</span><span>${esc(label)}</span><span class="ext">↗</span></a></li>`).join("")}</ul>`;
  function renderDocs() {
    $("#docsAll").innerHTML = BOARDS.map(b => `<section class="card"><h3>${esc(b.name)}</h3><p class="muted small">${esc(b.chip)} · ${esc(b.vendor)}</p>${docList(b.docs)}</section>`).join("");
  }

  /* Bảng chân dạng chữ (trang tĩnh viết sẵn cho SEO); khi đổi board trong app thì vẽ lại theo board đang chọn */
  function renderSeoTable() {
    const box = document.querySelector(".seo"); if (!box || !window.PAGE_BOARD && !box.dataset.dyn) { if (!box || !window.PAGE_BOARD) return; }
    if (state.b.id === window.PAGE_BOARD && !box.dataset.dyn) return;
    const b = state.b;
    const rows = pins.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.hdr)}-${p.pn}</td><td>${p.gpio != null ? p.gpio : "–"}</td><td>${esc(CATS[p.cat].label)}</td><td>${esc(p.fn.join(", "))}</td><td>${esc(p.warn || "")}</td></tr>`).join("");
    box.dataset.dyn = 1;
    box.innerHTML = `<h2>Bảng chân ${esc(b.name)}</h2><p class="muted">${esc(b.summary)}</p><dl class="facts">${b.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <div class="tw"><table><thead><tr><th>Chân</th><th>Vị trí</th><th>GPIO</th><th>Loại</th><th>Chức năng</th><th>Lưu ý</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- Thông số chip ---------- */
  function renderSpec(i = 0) {
    const sp = (window.SPECS || {})[state.b.id];
    $("#spec").hidden = !sp; $("#ref").hidden = !(sp && sp.ref);
    if (!sp) return;
    $("#specNote").textContent = sp.note || "";
    const tabs = $("#specTabs"); tabs.innerHTML = "";
    sp.tabs.forEach(([t], k) => { const c = h("button", "stab", esc(t)); c.setAttribute("aria-pressed", k === i); c.onclick = () => renderSpec(k); tabs.appendChild(c); });
    $("#specBody").innerHTML = sp.tabs[i][1];
    if (sp.ref) $("#refBody").innerHTML = sp.ref;
  }

  /* ---------- Tính toán ---------- */
  const E24 = [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
  const e24 = (r, up) => {
    if (!(r > 0) || !isFinite(r)) return NaN;
    const d = Math.pow(10, Math.floor(Math.log10(r)));
    const c = E24.map(v => v * d).concat([10 * d]);
    return up ? c.find(v => v >= r * 0.999) : c.reduce((a, v) => Math.abs(v - r) < Math.abs(a - r) ? v : a);
  };
  const fmtR = r => !isFinite(r) ? "—" : r >= 1e6 ? +(r / 1e6).toFixed(2) + " MΩ" : r >= 1e3 ? +(r / 1e3).toFixed(2) + " kΩ" : +r.toFixed(1) + " Ω";
  const num = id => parseFloat($(id).value.replace(",", "."));
  function calc() {
    // LED
    const vs = num("#ledV"), vf = num("#ledVf"), ifm = num("#ledI") / 1000;
    const r = (vs - vf) / ifm, rs = e24(r, true), ia = (vs - vf) / rs;
    $("#ledOut").innerHTML = vs > vf && ifm > 0 ? `R tính = <b>${fmtR(r)}</b> → chọn E24 <b>${fmtR(rs)}</b><br>Dòng thực ${(ia * 1000).toFixed(1)} mA · công suất R ${(ia * ia * rs * 1000).toFixed(0)} mW${ia > 0.02 ? ' <span class="bad">(> 20 mA: dùng transistor/MOSFET)</span>' : ""}` : `<span class="bad">Cần Vnguồn > Vf và dòng > 0</span>`;
    // Phân áp
    const vin = num("#dvIn"), vmax = num("#dvMax"), r2 = num("#dvR2") * 1000;
    const r1 = r2 * (vin / vmax - 1), r1s = e24(r1, true), vout = vin * r2 / (r1s + r2);
    $("#dvOut").innerHTML = vin > vmax && r2 > 0 ? `R1 tính = <b>${fmtR(r1)}</b> → chọn <b>${fmtR(r1s)}</b> (R2 = ${fmtR(r2)})<br>Vout tại Vin max = <b>${vout.toFixed(3)} V</b> · hệ số nhân ×${((r1s + r2) / r2).toFixed(4)} · dòng ${(vin / (r1s + r2) * 1e6).toFixed(0)} µA` : `<span class="bad">Cần Vin max > V ADC max</span>`;
    // I2C
    const vdd = num("#i2V"), cb = num("#i2C") * 1e-12, mode = $("#i2M").value;
    const tr = mode === "100" ? 1000e-9 : mode === "400" ? 300e-9 : 120e-9, iol = mode === "1000" ? 0.02 : 0.003;
    const rmin = (vdd - 0.4) / iol, rmax = tr / (0.8473 * cb);
    $("#i2Out").innerHTML = cb > 0 ? `Rp min = <b>${fmtR(rmin)}</b> · Rp max = <b>${fmtR(rmax)}</b><br>${rmax > rmin ? `Gợi ý: <b>${fmtR(e24(Math.sqrt(rmin * Math.min(rmax, 10e3)), false))}</b>` : '<span class="bad">Không có giá trị hợp lệ: giảm điện dung bus hoặc giảm tốc độ</span>'}<br><span class="muted small">Theo NXP UM10204: Rmin = (VDD−0.4)/IOL, Rmax = tr/(0.8473·Cb)</span>` : "—";
    // RC
    const rr = num("#rcR") * 1000, cc = num("#rcC") * 1e-6;
    $("#rcOut").innerHTML = rr > 0 && cc > 0 ? `τ = RC = <b>${(rr * cc * 1000).toFixed(2)} ms</b> · lên 63% sau 1τ, ~99% sau 5τ (${(5 * rr * cc * 1000).toFixed(1)} ms)<br>Tần số cắt lọc thông thấp f = 1/(2πRC) = <b>${(1 / (2 * Math.PI * rr * cc)).toFixed(2)} Hz</b>` : "—";
  }

  /* ---------- Khởi tạo ---------- */
  function setTab(t) {
    state.tab = t;
    document.querySelectorAll(".tabbar button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
    document.querySelectorAll("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== t);
  }
  document.querySelectorAll(".tabbar button").forEach(b => b.onclick = () => setTab(b.dataset.tab));
  $("#viewPcb").onclick = () => { state.view = "pcb"; draw(); };
  $("#viewSch").onclick = () => { state.view = "sch"; draw(); };
  $(".grab").onclick = () => $("#detail").classList.toggle("open");
  /* Popup zoom ảnh: kéo để di chuyển, cuộn chuột / 2 ngón để zoom, chạm đúp để phóng to */
  const lb = $("#lightbox"), lbImg = $("#lbImg"), V = { s: 1, x: 0, y: 0 }, pts = new Map();
  let last = null, pinch = null, tap = 0;
  const lbApply = () => lbImg.style.transform = `translate(${V.x}px, ${V.y}px) scale(${V.s})`;
  const lbZoom = (f, cx, cy) => {
    const r = $("#lbStage").getBoundingClientRect(); cx = (cx ?? r.left + r.width / 2) - r.left; cy = (cy ?? r.top + r.height / 2) - r.top;
    const ns = Math.min(12, Math.max(1, V.s * f)), k = ns / V.s;
    V.x = cx - (cx - V.x) * k; V.y = cy - (cy - V.y) * k; V.s = ns; if (ns === 1) { V.x = 0; V.y = 0; } lbApply();
  };
  const lbOpen = (src, cap) => { lbImg.src = src; $("#lbCap").textContent = cap; Object.assign(V, { s: 1, x: 0, y: 0 }); lbApply(); lb.hidden = false; document.body.style.overflow = "hidden"; };
  const lbClose = () => { lb.hidden = true; document.body.style.overflow = ""; };
  $("#oem").addEventListener("click", e => { const im = e.target.closest("img"); if (im) lbOpen(im.src, im.alt); });
  // Sơ đồ kiến trúc: chép style tính toán vào từng phần tử rồi xuất SVG thành ảnh để zoom
  $("#svg").addEventListener("click", () => {
    if (state.view !== "sch") return;
    const src = $("#svg"), cl = src.cloneNode(true), a = src.querySelectorAll("*"), b = cl.querySelectorAll("*");
    a.forEach((n, i) => { const cs = getComputedStyle(n); b[i].setAttribute("style", ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight", "opacity"].map(k => `${k}:${cs.getPropertyValue(k)}`).join(";")); });
    const vb = src.viewBox.baseVal; cl.setAttribute("width", vb.width * 40); cl.setAttribute("height", vb.height * 40);
    cl.setAttribute("style", "background:" + getComputedStyle(document.body).backgroundColor);
    lbOpen("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(cl)), state.b.name + " – Kiến trúc");
  });
  $("#lbClose").onclick = lbClose; $("#lbIn").onclick = () => lbZoom(1.6); $("#lbOut").onclick = () => lbZoom(1 / 1.6);
  addEventListener("keydown", e => { if (!lb.hidden && e.key === "Escape") lbClose(); });
  const stg = $("#lbStage");
  stg.addEventListener("wheel", e => { e.preventDefault(); lbZoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false });
  stg.addEventListener("pointerdown", e => {
    stg.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY];
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    const now = Date.now(); if (now - tap < 300 && pts.size === 1) lbZoom(V.s > 1.5 ? 1 / V.s : 2.5, e.clientX, e.clientY); tap = now;
  });
  stg.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      lbZoom(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch = d;
    } else if (pts.size === 1 && last) { V.x += e.clientX - last[0]; V.y += e.clientY - last[1]; last = [e.clientX, e.clientY]; lbApply(); }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; last = pts.size ? [...pts.values()][0] : null; };
  stg.addEventListener("pointerup", up); stg.addEventListener("pointercancel", up);

  $("#viewOem").onclick = () => { state.view = "oem"; draw(); };
  $("#zin").onclick = () => { state.zoom = Math.min(4, state.zoom + .5); draw(); };
  $("#zout").onclick = () => { state.zoom = Math.max(1, state.zoom - .5); draw(); };
  let rw = innerWidth; addEventListener("resize", () => { if ((rw >= 600) !== (innerWidth >= 600)) draw(); rw = innerWidth; });
  $("#q").oninput = e => { state.q = e.target.value; applyDim(); };
  document.querySelectorAll("#calc input, #calc select").forEach(i => i.addEventListener("input", calc));
  // Mặt trời = sáng, mặt trăng = tối; chưa chọn thì theo hệ điều hành
  const setTheme = t => {
    document.documentElement.dataset.theme = t;
    $("#tLight").setAttribute("aria-pressed", t === "light"); $("#tDark").setAttribute("aria-pressed", t === "dark");
    try { localStorage.setItem("theme", t); } catch (e) { }
  };
  $("#tLight").onclick = () => setTheme("light"); $("#tDark").onclick = () => setTheme("dark");
  { let t = null; try { t = localStorage.getItem("theme"); } catch (e) { }
    setTheme(t || "dark"); }
  // Chọn bộ giao diện: bật/tắt file CSS tương ứng; SVG vẽ lại để nhận font mới
  const setSkin = k => {
    $("#skin-8bit").disabled = k !== "8bit"; $("#skin-pinout").disabled = k !== "pinout" && k !== "amber"; $("#skin-amber").disabled = k !== "amber";
    document.documentElement.dataset.skin = k; $("#skin").value = k;
    try { localStorage.setItem("skin", k); } catch (e) { }
    if (state.b) draw();
  };
  $("#skin").onchange = e => setSkin(e.target.value);
  let sk = "pinout"; try { sk = localStorage.getItem("skin") || sk; } catch (e) { }
  setSkin(sk);
  // Hỗ trợ cả link cũ "#board/chân" lẫn link mới "/board/#chân"
  const fromHash = () => {
    const h = decodeURIComponent(location.hash.slice(1)), [a, b] = h.split("/");
    if (BOARDS.some(x => x.id === a)) return selectBoard(a, b);
    selectBoard(window.PAGE_BOARD || (state.b && state.b.id) || BOARDS[0].id, h || undefined);
  };
  addEventListener("hashchange", fromHash);
  fromHash();
  setTab("pins"); calc();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
})();
