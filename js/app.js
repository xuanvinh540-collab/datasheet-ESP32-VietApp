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

  /* ---------- Chọn board ---------- */
  function renderBoardList() {
    const box = $("#boards"); box.innerHTML = "";
    BOARDS.forEach(b => {
      const btn = h("button", "board-card", `<span class="bc-name">${esc(b.name)}</span><span class="bc-chip">${esc(b.chip)}</span><span class="bc-logic l${b.logic === "5 V" ? 5 : 3}">${esc(b.logic)}</span>`);
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
  function syncHash() {
    const hsh = "#" + state.b.id + (state.sel ? "/" + encodeURIComponent(state.sel.name) : "");
    if (location.hash !== hsh) history.replaceState(null, "", hsh);
  }

  /* ---------- Bộ lọc ---------- */
  function renderFilters() {
    const box = $("#filters"); box.innerHTML = "";
    const used = new Set(pins.flatMap(p => p.flags));
    Object.entries(FLAGS).filter(([k]) => used.has(k)).forEach(([k, label]) => {
      const c = h("button", "chip", esc(label)); c.setAttribute("aria-pressed", state.flag === k);
      c.onclick = () => { state.flag = state.flag === k ? null : k; renderFilters(); applyDim(); };
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
  const TW = 10.5, TH = 2.1, AW = 13, FS = 1.32;
  const showAlt = () => innerWidth >= 600 || state.zoom > 1;
  function short(p) {
    if (!showAlt() || ["power", "gnd", "ctl", "nc"].includes(p.cat)) return "";
    const f = p.fn.find(x => !/^Arduino|^PIO|^Ground|^GPIO\d/.test(x));
    return f ? f.replace(/ \(.*\)$/, "").replace(" · ", "·").slice(0, 16) : "";
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
    el("rect", { x: 0, y: 0, width: b.w, height: b.h, rx: 1.2, fill, stroke: edge, "stroke-width": .5 }, board);
    el("rect", { x: .6, y: .6, width: b.w - 1.2, height: b.h - 1.2, rx: .8, fill: "none", stroke: "rgba(255,255,255,.07)", "stroke-width": .25 }, board);
    b.parts.forEach(pt => drawPart(board, pt));

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

  /* ---------- Vẽ schematic ---------- */
  function drawSch(svg) {
    const b = state.b, row = 2.54, groups = {};
    b.headers.forEach(hd => { const k = hd.sch || hd.id; (groups[k] = groups[k] || []).push(hd); });
    const left = [], right = [];
    Object.values(groups).forEach(gs => (gs[0].side === "L" || gs[0].side === "T" ? left : right).push(gs));
    if (!left.length) left.push(right.shift());
    const NET = 14, W = 7;
    const drawConn = (gs, x, y, dir) => {
      const dual = gs.length > 1;
      const list = dual ? null : gs[0].pins;
      const n = dual ? Math.max(...gs.map(g => g.pins.length)) : list.length;
      const bw = dual ? 10 : W, H = n * row + 2;
      el("rect", { x, y, width: bw, height: H, class: "symbox" }, svg);
      el("text", { x: x + bw / 2, y: y - 1.2, "text-anchor": "middle", "font-size": 1.5, class: "symtitle" }, svg, gs[0].sch || gs[0].id);
      const sides = dual ? [[gs[0], -1], [gs[1], 1]] : [[gs[0], dir]];
      sides.forEach(([hd, d]) => hd.pins.forEach((p, k) => {
        const i = pins.indexOf(p), yy = y + 1 + row / 2 + k * row, col = labelColors(p);
        const x0 = d < 0 ? x : x + bw, x1 = x0 + d * 4;
        const g = el("g", { class: "pin", tabindex: 0, role: "button", "data-i": i, "aria-label": p.name }, svg);
        el("line", { x1: x0, y1: yy, x2: x1, y2: yy, class: "wire" }, g);
        el("circle", { cx: x1, cy: yy, r: .35, class: "node" }, g);
        el("text", { x: x0 - d * .6, y: yy, "text-anchor": d < 0 ? "start" : "end", "dominant-baseline": "central", "font-size": 1.15, class: "pnum" }, g, p.pn);
        const tx = d < 0 ? x1 - TW : x1;
        el("path", { d: d < 0 ? `M${x1} ${yy} l-1 -${TH / 2} h-${TW - 1} v${TH} h${TW - 1}z` : `M${x1} ${yy} l1 -${TH / 2} h${TW - 1} v${TH} h-${TW - 1}z`, fill: col.bg, class: "tab" }, g);
        el("text", { x: tx + TW / 2 + d * .4, y: yy + .02, "text-anchor": "middle", "dominant-baseline": "central", "font-size": FS, fill: col.fg, class: "tl" }, g, p.name);
        const alt = short(p);
        if (alt) el("text", { x: d < 0 ? tx - .6 : tx + TW + .6, y: yy, "text-anchor": d < 0 ? "end" : "start", "dominant-baseline": "central", "font-size": 1.05, class: "alt" }, g, alt);
      }));
      return { w: bw, h: H };
    };
    let yL = 3, yR = 3, maxH = 0;
    const xL = NET + AW + 2, xC = xL + W + 6, CW = 16, xR = xC + CW + 6;
    const single = left.length + right.length === 1;
    if (single) { const r = drawConn(left[0], xL + 8, 3, -1); maxH = r.h; }
    else {
      left.forEach(gs => { const r = drawConn(gs, xL, yL, -1); yL += r.h + 5; });
      right.forEach(gs => { const r = drawConn(gs, xR, yR, 1); yR += r.h + 5; });
      maxH = Math.max(yL, yR) - 5;
      el("rect", { x: xC, y: 3, width: CW, height: maxH - 3, class: "mcu" }, svg);
      el("text", { x: xC + CW / 2, y: 3 + (maxH - 3) / 2, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 1.6, class: "symtitle", transform: `rotate(-90 ${xC + CW / 2} ${3 + (maxH - 3) / 2})` }, svg, b.chip);
    }
    const totalW = single ? xL + 8 + 10 + NET + AW + 4 : xR + W + NET + AW + 2;
    svg.setAttribute("viewBox", `0 -1 ${totalW} ${maxH + 6}`);
  }

  function draw() {
    const svg = $("#svg"); svg.innerHTML = "";
    svg.classList.toggle("sch", state.view === "sch");
    if (state.view === "pcb") drawPCB(svg); else drawSch(svg);
    svg.style.width = state.zoom * 100 + "%";
    svg.querySelectorAll(".pin").forEach(g => {
      g.addEventListener("click", () => pick(pins[+g.dataset.i]));
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(pins[+g.dataset.i]); } });
    });
    $("#viewPcb").setAttribute("aria-pressed", state.view === "pcb");
    $("#viewSch").setAttribute("aria-pressed", state.view === "sch");
    $("#bTitle").textContent = state.b.name;
    $("#bSub").textContent = `${state.b.vendor} · ${state.b.chip} · logic ${state.b.logic}`;
    $("#bNote").textContent = state.b.note || "";
    $("#bNote").hidden = !state.b.note;
    applyDim();
  }

  /* ---------- Chi tiết ---------- */
  function pick(p) {
    state.sel = state.sel === p ? null : p;
    applyDim(); renderDetail(); syncHash();
    if (state.sel && matchMedia("(max-width: 899px)").matches) $("#detail").classList.add("open");
  }
  const STATUS = { ok: ["Dùng tự do", "ok"], warn: ["Dùng có điều kiện", "warn"], ban: ["Không dùng", "ban"], info: ["Nguồn / điều khiển", "info"] };
  const SRC = { ds: "Datasheet", hdg: "Design guide", std: "Thực hành" };
  function renderDetail() {
    const box = $("#detailBody"), b = state.b, p = state.sel;
    if (!p) {
      box.innerHTML = `<div class="d-head"><div><div class="d-kicker">Board</div><h2>${esc(b.name)}</h2></div></div>
        <p class="muted">${esc(b.summary)}</p>
        <dl class="facts">${b.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <div class="d-sec">Tài liệu hãng</div>${docList(b.docs)}
        <p class="hint">Chạm vào một chân trên hình để xem chức năng, cảnh báo và linh kiện gợi ý.</p>`;
      return;
    }
    const st = STATUS[p.status], cat = CATS[p.cat];
    box.innerHTML = `<div class="d-head"><div><div class="d-kicker">${esc(p.hdr)} · chân ${p.pn}${p.gpio != null ? " · GPIO " + p.gpio : ""}</div>
        <h2 class="mono">${esc(p.name)}</h2></div><button class="icon-btn" id="dClose" aria-label="Đóng">✕</button></div>
      <div class="badges"><span class="badge" style="--b:${cv(cat.c)}">${esc(cat.label)}</span><span class="st ${st[1]}">${st[0]}</span></div>
      ${p.fn.length ? `<div class="d-sec">Chức năng</div><div class="fns">${p.fn.map(f => `<span>${esc(f)}</span>`).join("")}</div>` : ""}
      ${p.warn ? `<div class="warn ${p.status}">${esc(p.warn)}</div>` : ""}
      ${p.notes.length ? `<div class="d-sec">Ghi chú</div><ul class="notes">${p.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      ${p.parts.length ? `<div class="d-sec">Linh kiện gợi ý</div><table class="parts">${p.parts.map(([k, v, s]) => `<tr><th>${esc(k)}</th><td>${esc(v)} <span class="src">${SRC[s] || s}</span></td></tr>`).join("")}</table>` : ""}
      <div class="d-sec">Nguồn</div><p class="muted small">${esc(b.src)}. <a href="${esc(b.docs[0][2])}" target="_blank" rel="noopener">Mở datasheet ↗</a></p>`;
    $("#dClose").onclick = () => { state.sel = null; $("#detail").classList.remove("open"); applyDim(); renderDetail(); syncHash(); };
  }
  const KIND = { datasheet: "Datasheet", manual: "Manual", guide: "Hướng dẫn", schematic: "Schematic", pinout: "Pinout", errata: "Errata", code: "Code" };
  const docList = docs => `<ul class="docs">${docs.map(([k, label, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener"><span class="dk">${KIND[k] || k}</span><span>${esc(label)}</span><span class="ext">↗</span></a></li>`).join("")}</ul>`;
  function renderDocs() {
    $("#docsAll").innerHTML = BOARDS.map(b => `<section class="card"><h3>${esc(b.name)}</h3><p class="muted small">${esc(b.chip)} · ${esc(b.vendor)}</p>${docList(b.docs)}</section>`).join("");
  }

  /* ---------- Thông số chip ---------- */
  function renderSpec(i = 0) {
    const sp = (window.SPECS || {})[state.b.id];
    $("#spec").hidden = !sp; $("#ref").hidden = !(sp && sp.ref);
    if (!sp) return;
    $("#specNote").textContent = sp.note || "";
    const tabs = $("#specTabs"); tabs.innerHTML = "";
    sp.tabs.forEach(([t], k) => { const c = h("button", "chip", esc(t)); c.setAttribute("aria-pressed", k === i); c.onclick = () => renderSpec(k); tabs.appendChild(c); });
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
  $("#zin").onclick = () => { state.zoom = Math.min(3, state.zoom + .5); draw(); };
  $("#zout").onclick = () => { state.zoom = Math.max(1, state.zoom - .5); draw(); };
  let rw = innerWidth; addEventListener("resize", () => { if ((rw >= 600) !== (innerWidth >= 600)) draw(); rw = innerWidth; });
  $("#q").oninput = e => { state.q = e.target.value; applyDim(); };
  document.querySelectorAll("#calc input, #calc select").forEach(i => i.addEventListener("input", calc));
  $("#theme").onclick = () => {
    const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", r.dataset.theme); } catch (e) { }
  };
  try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) { }
  const fromHash = () => { const [hid, hpin] = location.hash.slice(1).split("/"); selectBoard(hid || BOARDS[0].id, hpin && decodeURIComponent(hpin)); };
  addEventListener("hashchange", fromHash);
  fromHash();
  setTab("pins"); calc();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
})();
