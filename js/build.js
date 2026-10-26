/* Tab BUILD: khu vẽ riêng kiểu node (Blender). Module là node kéo được; kéo dây từ socket của chân module,
   các pad phù hợp trên board sáng lên (xanh = an toàn, cam = có lưu ý), thả vào pad để nối.
   Chấm điểm chân dựa trên cờ trong boards.js (strap/usb/uart/jtag/adc…). */
(function () {
  const A = window.APP, M = window.MODULES, esc = A.esc, el = A.el, $ = s => document.querySelector(s);
  const SHARED = ["spi.sck", "spi.mosi", "spi.miso", "i2c.sda", "i2c.scl"];
  const B = { boardId: null, bus: {}, mods: [], tab: "mods", cam: null, arm: null };
  const pinByName = n => A.pins.find(p => p.name === n);
  const board = () => A.state.b;
  const supported = b => ["ESP32", "RP2", "AVR"].includes(b.family);
  const modOK = (m, b) => !m.family || m.family.includes(b.family);

  /* ---------- Chấm điểm chân ---------- */
  const usable = p => p.gpio != null && !["power", "gnd", "ctl", "nc", "ban"].includes(p.cat);
  const RE = {
    ESP32: { "spi.sck": /Arduino SCK/, "spi.mosi": /Arduino MOSI/, "spi.miso": /Arduino MISO/, "spi.cs": /Arduino SS/, "i2c.sda": /Arduino SDA|I2C SDA/, "i2c.scl": /Arduino SCL|I2C SCL/ },
    RP2: { "spi.sck": /SPI\d SCK/, "spi.mosi": /SPI\d TX/, "spi.miso": /SPI\d RX/, "i2c.sda": /I2C\d SDA/, "i2c.scl": /I2C\d SCL/ },
    AVR: { "spi.cs": /SPI SS/, "spi.sck": /SPI SCK/, "spi.mosi": /SPI MOSI/, "spi.miso": /SPI MISO/, "i2c.sda": /I2C SDA/, "i2c.scl": /I2C SCL/ }
  };
  const PICO_DEF = { "spi.sck": 18, "spi.mosi": 19, "spi.miso": 16, "i2c.sda": 4, "i2c.scl": 5 };
  function score(p, role, b) {
    if (!usable(p)) return -1e9;
    const fn = p.fn.join(" "), re = (RE[b.family] || {})[role];
    if (b.family !== "ESP32" && re && !re.test(fn)) return -1e9;          // RP2/AVR: bus phần cứng bắt buộc đúng chân
    if (role === "adc" && !p.flags.includes("adc")) return -1e9;
    let s = 100;
    if (p.flags.includes("strap")) s -= 60;
    if (p.flags.includes("usb")) s -= 90;
    if (/U0TXD|U0RXD|Serial (TX|RX)|UART0 TXD|UART0 RXD/.test(fn) || p.name === "TX" || p.name === "RX" || (b.family === "RP2" && p.gpio <= 1)) s -= 70;
    if (p.flags.includes("jtag")) s -= 25;
    if (p.flags.includes("led")) s -= 20;
    if (p.adc2 || /ADC2/.test(fn)) s -= role === "adc" ? 40 : 5;
    if (re && re.test(fn)) s += 50;
    if (b.family === "RP2" && PICO_DEF[role] === p.gpio) s += 30;
    if (role === "pwm" && b.family === "AVR" && !p.flags.includes("pwm")) s -= 50;
    if (!/^(spi|i2c)\./.test(role) && (/Arduino (SCK|MOSI|MISO|SS|SDA|SCL)|^SPI |I2C S/.test(fn) || (b.family === "RP2" && Object.values(PICO_DEF).includes(p.gpio)))) s -= 15;
    if (role !== "adc" && p.flags.includes("adc") && b.family === "AVR") s -= 10;
    if (b.family === "RP2" && /ADC\d/.test(fn) && role !== "adc") s -= 10;
    return s;
  }
  const used = () => new Set([...Object.values(B.bus), ...B.mods.flatMap(m => Object.values(m.pins))].filter(Boolean));
  const roleOf = (m, label) => M[m.type].pins.find(x => x[0] === label)[1];
  const getPin = (m, label) => { const r = roleOf(m, label); return SHARED.includes(r) ? B.bus[r] : m.pins[label]; };
  function setPin(m, label, name) { const r = roleOf(m, label); if (SHARED.includes(r)) { if (name) B.bus[r] = name; else delete B.bus[r]; } else if (name) m.pins[label] = name; else delete m.pins[label]; }
  function best(role, b, taken) { let top = null, ts = -1e8; for (const p of A.pins) { if (taken.has(p.name)) continue; const s = score(p, role, b); if (s > ts) { ts = s; top = p; } } return top; }
  function autoAssign(m) {
    const b = board(), taken = used();
    for (const [label, role] of M[m.type].pins) {
      if (getPin(m, label)) continue;
      let p = null;
      if (b.family === "RP2" && role === "i2s.ws") { const bl = pinByName(getPin(m, M[m.type].pins.find(x => x[1] === "i2s.bclk")[0]) || ""); p = bl && A.pins.find(x => x.gpio === bl.gpio + 1 && !taken.has(x.name)); }
      p = p || best(role, b, taken);
      if (p) { setPin(m, label, p.name); taken.add(p.name); }
    }
  }

  /* ---------- Cảnh báo ---------- */
  function warnings() {
    const b = board(), out = [];
    if (b.logic !== "5 V") out.push(["info", "Board chạy logic 3.3 V: không nối thẳng tín hiệu 5 V vào GPIO."]);
    const busy = {};
    for (const m of B.mods) {
      const d = M[m.type];
      for (const [label, role, v5] of d.pins) {
        const n = getPin(m, label), p = n && pinByName(n);
        if (!p) { out.push(["todo", `${d.short} ${label}: chưa nối.`]); continue; }
        if (!SHARED.includes(role)) (busy[n] = busy[n] || []).push(d.short + " " + label);
        const s = score(p, role, b);
        if (s <= -1e8) out.push(["ban", `${d.short} ${label} → ${p.name}: chân này không làm được ${label}.`]);
        else if (s < 60 && p.warn) out.push(["warn", `${d.short} ${label} → ${p.name}: ${p.warn}`]);
        if (v5 && b.logic !== "5 V") out.push(["warn", `${d.short} ${label} ra mức 5 V: thêm cầu chia áp 1 kΩ + 2 kΩ trước ${p.name}.`]);
      }
      if (m.type === "ws2812" && b.logic !== "5 V") out.push(["info", "WS2812 cấp 5 V: tín hiệu 3.3 V thường chạy được với dây ngắn; dải dài nên thêm IC chuyển mức (74AHCT125)."]);
      if (b.family === "RP2" && /^i2s/.test(d.pins[0][1])) {
        const bc = pinByName(getPin(m, d.pins[0][0]) || ""), ws = pinByName(getPin(m, d.pins[1][0]) || "");
        if (bc && ws && ws.gpio !== bc.gpio + 1) out.push(["warn", `${d.short}: trên Pico chân ${d.pins[1][0]} phải là GP${bc.gpio + 1} (BCLK + 1).`]);
      }
    }
    for (const n in busy) if (busy[n].length > 1) out.push(["ban", `${n} bị dùng 2 lần: ${busy[n].join(", ")}.`]);
    if (B.bus["i2c.sda"]) out.push(["info", "Bus I2C dùng chung: cần pull-up 4.7 kΩ trên SDA/SCL (nhiều module đã có sẵn)."]);
    return out;
  }

  /* ---------- Sinh #define ---------- */
  const val = n => { const p = pinByName(n || ""); if (!p) return "-1 /* chưa nối */"; return board().family === "AVR" && /^A\d/.test(p.name) ? p.name : String(p.gpio); };
  const busNo = (n, kind) => { const p = pinByName(n || ""); const m = p && p.fn.join(" ").match(new RegExp(kind + "(\\d)")); return m ? +m[1] : 0; };
  const PFX = { st7789: "TFT", ws2812: "LED", hcsr04: "US", vl53l0x: "TOF", mpu6050: "MPU", max98357a: "I2S", inmp441: "MIC" };
  function code() {
    const b = board(), f = b.family, L = [`// ${b.name} – Pindex Build (pindex.pages.dev)`];
    const has = r => B.mods.some(m => M[m.type].pins.some(x => x[1] === r));
    if (has("spi.sck")) {
      L.push("", "// SPI (dùng chung)", `#define SPI_SCK   ${val(B.bus["spi.sck"])}`, `#define SPI_MOSI  ${val(B.bus["spi.mosi"])}`);
      if (has("spi.miso")) L.push(`#define SPI_MISO  ${val(B.bus["spi.miso"])}`);
      if (f === "ESP32") L.push(`// setup(): SPI.begin(SPI_SCK, ${has("spi.miso") ? "SPI_MISO" : "-1"}, SPI_MOSI);`);
      if (f === "RP2") { const s = busNo(B.bus["spi.sck"], "SPI") ? "SPI1" : "SPI"; L.push(`// setup(): ${s}.setSCK(SPI_SCK); ${s}.setTX(SPI_MOSI);${has("spi.miso") ? ` ${s}.setRX(SPI_MISO);` : ""} ${s}.begin();`); }
      if (f === "AVR") L.push("// setup(): SPI.begin();   // Uno: SCK D13, MOSI D11, MISO D12 cố định");
    }
    if (has("i2c.sda")) {
      L.push("", "// I2C (dùng chung)", `#define I2C_SDA   ${val(B.bus["i2c.sda"])}`, `#define I2C_SCL   ${val(B.bus["i2c.scl"])}`);
      if (f === "ESP32") L.push("// setup(): Wire.begin(I2C_SDA, I2C_SCL);");
      if (f === "RP2") { const w = busNo(B.bus["i2c.sda"], "I2C") ? "Wire1" : "Wire"; L.push(`// setup(): ${w}.setSDA(I2C_SDA); ${w}.setSCL(I2C_SCL); ${w}.begin();`); }
      if (f === "AVR") L.push("// setup(): Wire.begin();  // Uno: SDA A4, SCL A5 cố định");
    }
    for (const m of B.mods) {
      const d = M[m.type], p = PFX[m.type], g = l => `${p}_${l}`;
      L.push("", `// ${d.name} – thư viện: ${d.lib}`);
      for (const [label] of d.pins.filter(x => !SHARED.includes(x[1]))) L.push(`#define ${(p + "_" + label.replace(/\W/g, "")).padEnd(10)} ${val(m.pins[label])}`);
      if (m.type === "ws2812") L.push("#define LED_COUNT  8");
      if (m.type === "max98357a") L.push(f === "ESP32" ? `// setup(): i2s.setPins(${g("BCLK")}, ${g("LRC")}, ${g("DIN")});` : `// setup(): i2s.setBCLK(${g("BCLK")}); i2s.setDATA(${g("DIN")});   // LRC = BCLK + 1`);
      if (m.type === "inmp441") L.push(f === "ESP32" ? `// setup(): mic.setPins(${g("SCK")}, ${g("WS")}, -1, ${g("SD")});` : `// setup(): mic.setBCLK(${g("SCK")}); mic.setDATA(${g("SD")});   // WS = SCK + 1`);
      if (m.type === "st7789") L.push(`// Adafruit_ST7789 tft(${g("CS")}, ${g("DC")}, ${g("RST")});`);
    }
    return L.join("\n");
  }

  /* ---------- Khu vẽ node ---------- */
  const NW = 22, RH = 2.8, HH = 3.6;
  const svg = () => $("#bsvg");
  const toSvg = e => { const s = svg(), pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(s.getScreenCTM().inverse()); };
  const sockPos = (m, k) => ({ x: m.pos.x, y: m.pos.y + HH + k * RH + RH / 2 });
  const wirePath = (a, p) => { const dx = Math.max(6, Math.abs(a.x - p.x) * .5); return `M${a.x} ${a.y} C${a.x - dx} ${a.y} ${p.x + dx} ${p.y} ${p.x} ${p.y}`; };
  let boardBox = null;
  const sideOf = p => (board().headers.find(h => h.pins.includes(p)) || {}).side || "R";
  // đường gấp khúc bo góc, các dây tách làn theo thứ tự lane để không chồng lên nhau
  function route(a, p, lane) {
    const b = board(), gap = 2.2 + lane * 1.1, right = b.w + gap, left = -gap, top = -gap - 1, bot = b.h + gap + 1, sd = sideOf(p);
    let pts;
    if (sd === "R") pts = [[a.x, a.y], [right, a.y], [right, p.y], [p.x, p.y]];
    else if (sd === "L") { const yv = p.y < b.h / 2 ? top : bot; pts = [[a.x, a.y], [right, a.y], [right, yv], [left, yv], [left, p.y], [p.x, p.y]]; }
    else { const yv = sd === "T" ? top : bot; pts = [[a.x, a.y], [right, a.y], [right, yv], [p.x, yv], [p.x, p.y]]; }
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {                  // bo góc r = 0.8
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], r = .8;
      const l1 = Math.hypot(x1 - x0, y1 - y0) || 1, l2 = Math.hypot(x2 - x1, y2 - y1) || 1, k1 = Math.min(r, l1 / 2) / l1, k2 = Math.min(r, l2 / 2) / l2;
      d += ` L${x1 - (x1 - x0) * k1} ${y1 - (y1 - y0) * k1} Q${x1} ${y1} ${x1 + (x2 - x1) * k2} ${y1 + (y2 - y1) * k2}`;
    }
    return d + ` L${p.x} ${p.y}`;
  }
  function draw() {
    const s = svg(); s.innerHTML = "";
    A.drawPCB(s, true);                                   // board không nhãn lớn, chỉ pad + tên nhỏ
    const vb = s.viewBox.baseVal; boardBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    let ny = boardBox.y;                                   // vị trí mặc định cho node mới: cột bên phải board
    for (const m of B.mods) { if (!m.pos) m.pos = { x: boardBox.x + boardBox.w + 26, y: ny }; ny = Math.max(ny, m.pos.y) + HH + M[m.type].pins.length * RH + 4; }
    const glow = el("g", { id: "glow" }, s), wires = el("g", { id: "wires" }, s), nodes = el("g", {}, s);
    let lane = 0;
    for (const [mi, m] of B.mods.entries()) {
      const d = M[m.type], h = HH + d.pins.length * RH;
      d.pins.forEach(([label], k) => { const p = pinByName(getPin(m, label) || ""); if (!p) return;
        el("path", { d: route(sockPos(m, k), p, lane++), stroke: d.color, class: "bwire" }, wires);
        el("circle", { cx: p.x, cy: p.y, r: 1.55, fill: "none", stroke: d.color, "stroke-width": .5 }, wires); });
      const g = el("g", { class: "bnode", "data-m": mi }, nodes);
      el("rect", { x: m.pos.x, y: m.pos.y, width: NW, height: h, rx: 1, class: "modbox", stroke: d.color }, g);
      const head = el("g", { class: "bhead", "data-m": mi }, g);
      el("rect", { x: m.pos.x, y: m.pos.y, width: NW, height: HH - .4, rx: 1, fill: d.color }, head);
      el("text", { x: m.pos.x + 1.2, y: m.pos.y + HH / 2 - .2, "dominant-baseline": "central", "font-size": 1.5, class: "modt" }, head, d.short);
      el("text", { x: m.pos.x + NW - 1.2, y: m.pos.y + HH / 2 - .2, "text-anchor": "end", "dominant-baseline": "central", "font-size": 1.1, class: "modt" }, head, d.vcc);
      d.pins.forEach(([label], k) => {
        const a = sockPos(m, k), n = getPin(m, label), armed = B.arm && B.arm.m === mi && B.arm.label === label;
        el("text", { x: a.x + 2, y: a.y, "dominant-baseline": "central", "font-size": 1.25, class: "mptxt" }, g, label);
        el("text", { x: a.x + NW - 1, y: a.y, "text-anchor": "end", "dominant-baseline": "central", "font-size": 1.1, class: "mpval" }, g, n || "kéo ●");
        const so = el("circle", { cx: a.x, cy: a.y, r: .95, fill: n ? d.color : "var(--surface)", stroke: d.color, "stroke-width": .45, class: "sock" + (armed ? " armed" : ""), "data-m": mi, "data-l": label }, g);
        so.addEventListener("pointerdown", e => startWire(e, mi, label));
      });
      head.addEventListener("pointerdown", e => startNode(e, mi));
    }
    if (B.arm) showGlow(B.mods[B.arm.m], B.arm.label);
    // khung nhìn: board + toàn bộ node, có thể pan/zoom
    const xs = B.mods.map(m => m.pos.x + NW + 2), ys = B.mods.map(m => m.pos.y + HH + M[m.type].pins.length * RH + 2);
    const pad = 3 + lane * 1.1, world = { x: boardBox.x - pad, y: Math.min(boardBox.y - pad, ...B.mods.map(m => m.pos.y - 2)), w: 0 };
    world.w = Math.max(boardBox.x + boardBox.w + 50, ...xs) - world.x;
    world.h = Math.max(boardBox.y + boardBox.h + pad, ...ys) - world.y;
    if (!B.cam) B.cam = { ...world };
    s.setAttribute("viewBox", `${B.cam.x} ${B.cam.y} ${B.cam.w} ${B.cam.h}`);
  }
  function showGlow(m, label) {
    const g = $("#glow"); g.innerHTML = ""; const role = roleOf(m, label), b = board(), taken = used(), cur = getPin(m, label);
    for (const p of A.pins) {
      const s = score(p, role, b); if (s <= -1e8) continue;
      const busy = taken.has(p.name) && p.name !== cur && !SHARED.includes(role);
      el("circle", { cx: p.x, cy: p.y, r: 1.9, class: "glow " + (busy ? "busy" : s >= 90 ? "ok" : "warn") }, g);
    }
  }
  function nearestPad(pt) { let best = null, bd = 2.6; for (const p of A.pins) { const d = Math.hypot(p.x - pt.x, p.y - pt.y); if (d < bd) { bd = d; best = p; } } return best; }
  function connect(m, label, p) {
    if (score(p, roleOf(m, label), board()) <= -1e8) { A.toast(`${p.name} không dùng được cho ${label}.`); return false; }
    setPin(m, label, p.name); save(); return true;
  }
  function startWire(e, mi, label) {
    e.stopPropagation(); e.preventDefault();
    const m = B.mods[mi], k = M[m.type].pins.findIndex(x => x[0] === label), a = sockPos(m, k), s = svg();
    showGlow(m, label);
    const tmp = el("path", { d: "", stroke: M[m.type].color, class: "bwire tmp" }, $("#wires"));
    let moved = false;
    const mv = ev => { moved = true; const pt = toSvg(ev), near = nearestPad(pt); tmp.setAttribute("d", wirePath(a, near ? { x: near.x, y: near.y } : pt)); };
    const up = ev => {
      s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up);
      if (!moved) { B.arm = B.arm && B.arm.m === mi && B.arm.label === label ? null : { m: mi, label }; return refresh(); }   // chạm (không kéo) = chọn rồi chạm pad
      const p = nearestPad(toSvg(ev)); if (p) connect(m, label, p); B.arm = null; refresh();
    };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }
  function startNode(e, mi) {
    e.stopPropagation(); e.preventDefault();
    const m = B.mods[mi], s = svg(), p0 = toSvg(e), o = { ...m.pos };
    const mv = ev => { const pt = toSvg(ev); m.pos = { x: o.x + pt.x - p0.x, y: o.y + pt.y - p0.y }; draw(); };
    const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); save(); };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }
  function initCanvas() {
    const s = svg();
    // kéo nền = di chuyển khung nhìn; cuộn = zoom; chạm pad khi đang chọn socket = nối
    s.addEventListener("pointerdown", e => {
      if (e.target.closest(".bnode")) return;
      const pt = toSvg(e), pad = nearestPad(pt);
      if (B.arm && pad) { connect(B.mods[B.arm.m], B.arm.label, pad); B.arm = null; return refresh(); }
      const c0 = { ...B.cam }, x0 = e.clientX, y0 = e.clientY, r = s.getBoundingClientRect(), k = c0.w / r.width;
      const mv = ev => { B.cam.x = c0.x - (ev.clientX - x0) * k; B.cam.y = c0.y - (ev.clientY - y0) * k; s.setAttribute("viewBox", `${B.cam.x} ${B.cam.y} ${B.cam.w} ${B.cam.h}`); };
      const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); };
      s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
    });
    s.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1 / 1.15 : 1.15, toSvg(e)); }, { passive: false });
    $("#bzin").onclick = () => zoom(1 / 1.3); $("#bzout").onclick = () => zoom(1.3); $("#bfit").onclick = () => { B.cam = null; draw(); };
  }
  function zoom(f, c) { const k = B.cam; c = c || { x: k.x + k.w / 2, y: k.y + k.h / 2 }; k.x = c.x - (c.x - k.x) * f; k.y = c.y - (c.y - k.y) * f; k.w *= f; k.h *= f; svg().setAttribute("viewBox", `${k.x} ${k.y} ${k.w} ${k.h}`); }

  /* ---------- Thanh bên ---------- */
  function side() {
    const box = $("#bside"), b = board();
    $("#bboard").innerHTML = BOARDS.map(x => `<option value="${x.id}"${x.id === b.id ? " selected" : ""}>${esc(x.name)}</option>`).join("");
    if (!supported(b)) { box.innerHTML = `<p class="wtext">Build hỗ trợ board ESP32, Raspberry Pi Pico và Arduino. Raspberry Pi chạy Linux nên chưa hỗ trợ.</p>`; return; }
    const W = warnings();
    const chips = Object.entries(M).map(([k, d]) => { const on = B.mods.some(m => m.type === k), ok = modOK(d, b);
      return `<button class="bchip${on ? " on" : ""}" data-add="${k}"${ok ? "" : " disabled"} style="--mc:${d.color}">${on ? "✓ " : "+ "}${esc(d.short)}</button>`; }).join("");
    const cards = B.mods.map((m, i) => { const d = M[m.type]; return `<div class="bcard" style="--mc:${d.color}"><div class="bc-h"><b>${esc(d.name)}</b><span>${esc(d.iface)} · ${esc(d.vcc)}</span><button class="icon-btn bx" data-del="${i}" aria-label="Bỏ">✕</button></div>
      <table class="btbl">${d.pins.map(([label]) => { const n = getPin(m, label); return `<tr><th>${esc(label)}</th><td>${n ? `<b>${esc(n)}</b>` : '<span class="muted">chưa nối</span>'}</td><td>${n ? `<button class="tap" data-un="${i}" data-l="${esc(label)}" title="Gỡ dây">✕</button>` : ""}</td></tr>`; }).join("")}</table>
      <p class="small muted">${esc(d.note)}</p></div>`; }).join("");
    box.innerHTML = `<div class="seg btabs"><button data-tab="mods" aria-pressed="${B.tab === "mods"}">Module</button><button data-tab="code" aria-pressed="${B.tab === "code"}">Code</button></div>
      ${B.tab === "mods" ? `<p class="hint">Thêm module, rồi nhấn giữ chấm ● ở chân module và kéo tới pad trên board: pad xanh = an toàn, cam = có lưu ý. Trên điện thoại có thể chạm ● rồi chạm pad.</p>
        <div class="bchips">${chips}</div>${B.mods.length ? `<button class="btn-auto" data-auto>✨ Gợi ý tự động các chân chưa nối</button>` : ""}
        ${W.length ? `<div class="bwarn">${W.map(([t, s]) => `<div class="w-${t}">${t === "ban" ? "⛔" : t === "warn" ? "⚠" : t === "todo" ? "○" : "ℹ"} ${esc(s)}</div>`).join("")}</div>` : ""}${cards}`
      : `<pre class="code bcode">${esc(code())}</pre><button class="btn-share" data-copy>Copy #define</button>`}
      <div class="bexp"><button data-exp="png">⬇ Ảnh PNG</button><button data-exp="json">⬇ File .json</button><button data-exp="link">🔗 Link</button><label>⬆ Mở .json<input type="file" accept=".json,application/json" hidden></label></div>`;
    box.querySelectorAll("[data-add]").forEach(x => x.onclick = () => { const k = x.dataset.add, i = B.mods.findIndex(m => m.type === k);
      if (i >= 0) B.mods.splice(i, 1); else B.mods.push({ type: k, pins: {} }); cleanBus(); B.arm = null; save(); refresh(); });
    box.querySelectorAll("[data-del]").forEach(x => x.onclick = () => { B.mods.splice(+x.dataset.del, 1); cleanBus(); B.arm = null; save(); refresh(); });
    box.querySelectorAll("[data-un]").forEach(x => x.onclick = () => { setPin(B.mods[+x.dataset.un], x.dataset.l, null); save(); refresh(); });
    const au = box.querySelector("[data-auto]"); if (au) au.onclick = () => { B.mods.forEach(autoAssign); save(); refresh(); };
    box.querySelectorAll("[data-tab]").forEach(x => x.onclick = () => { B.tab = x.dataset.tab; side(); });
    const cp = box.querySelector("[data-copy]"); if (cp) cp.onclick = () => navigator.clipboard.writeText(code()).then(() => A.toast("Đã copy"));
    box.querySelectorAll("[data-exp]").forEach(x => x.onclick = () => exportAs(x.dataset.exp));
    box.querySelector("input[type=file]").onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { load(JSON.parse(t)); refresh(); }); };
  }
  function cleanBus() { const need = new Set(B.mods.flatMap(m => M[m.type].pins.map(x => x[1]))); for (const r in B.bus) if (!need.has(r)) delete B.bus[r]; }
  function refresh() { draw(); side(); }

  /* ---------- Lưu / export ---------- */
  const dump = () => ({ board: board().id, bus: B.bus, mods: B.mods });
  function load(o) { if (!o || o.board !== board().id) { A.toast("File này của board khác."); return; } B.bus = o.bus || {}; B.mods = (o.mods || []).filter(m => M[m.type]); B.cam = null; save(); }
  function save() { try { localStorage.setItem("build:" + board().id, JSON.stringify(dump())); } catch (e) { } }
  function restore() { B.boardId = board().id; B.bus = {}; B.mods = []; B.arm = null; B.cam = null; try { const o = JSON.parse(localStorage.getItem("build:" + B.boardId) || "null"); if (o) load(o); } catch (e) { } }
  const dl = (name, href) => { const a = document.createElement("a"); a.href = href; a.download = name; a.click(); };
  async function exportAs(kind) {
    const b = board();
    if (kind === "json") return dl(`pindex-${b.id}.json`, URL.createObjectURL(new Blob([JSON.stringify(dump(), null, 1)], { type: "application/json" })));
    if (kind === "link") { const u = location.href.split("#")[0] + "#build=" + btoa(unescape(encodeURIComponent(JSON.stringify(dump())))); try { await navigator.clipboard.writeText(u); A.toast("Đã copy link Build"); } catch (e) { A.toast(u); } return; }
    const keep = { ...B.cam }; B.cam = null; draw();               // chụp toàn cảnh rồi trả lại khung nhìn cũ
    const img = new Image(); img.src = A.svgDataUrl(svg()); await img.decode(); B.cam = keep; draw();
    const lines = code().split("\n"), W = 1600, ih = Math.round(img.height * W / img.width), lh = 28, c = document.createElement("canvas");
    c.width = W; c.height = ih + 80 + lines.length * lh + 40;
    const g = c.getContext("2d");
    g.fillStyle = getComputedStyle(document.body).backgroundColor; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, W, ih);
    g.fillStyle = getComputedStyle(document.body).color; g.font = "bold 34px sans-serif"; g.fillText(`${b.name} · Pindex Build`, 40, ih + 50);
    g.font = "22px Consolas, monospace"; lines.forEach((l, i) => g.fillText(l, 40, ih + 90 + i * lh));
    dl(`pindex-${b.id}.png`, c.toDataURL("image/png"));
  }
  function importHash(h) { try { load(JSON.parse(decodeURIComponent(escape(atob(h))))); } catch (e) { A.toast("Link Build không hợp lệ."); } }

  let inited = false;
  window.BUILD = {
    open(h) {
      if (!inited) { initCanvas(); $("#bboard").onchange = e => { A.selectBoard(e.target.value); B.boardId = null; BUILD.open(); }; inited = true; }
      if (B.boardId !== board().id) restore();
      if (h) importHash(h);
      refresh();
    }
  };
})();
