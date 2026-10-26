/* Chế độ BUILD: ghép module vào board, tự gợi ý chân an toàn, chạm để nối, sinh #define, export.
   Dùng dữ liệu chân của boards.js (cờ strap/usb/uart/jtag/adc…) để chấm điểm từng chân cho từng vai trò. */
(function () {
  const A = window.APP, M = window.MODULES, esc = A.esc;
  const SHARED = ["spi.sck", "spi.mosi", "spi.miso", "i2c.sda", "i2c.scl"];
  const B = { boardId: null, bus: {}, mods: [], sel: null, tab: "mods" };
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
    if (role !== "adc" && p.flags.includes("adc") && b.family === "AVR") s -= 10;    // Uno: chừa A0–A5 cho analog
    // chân tín hiệu thường: chừa các chân bus mặc định (SPI/I2C) cho module cần bus
    if (!/^(spi|i2c)\./.test(role) && (/Arduino (SCK|MOSI|MISO|SS|SDA|SCL)|^SPI |I2C S/.test(fn) || (b.family === "RP2" && Object.values(PICO_DEF).includes(p.gpio)))) s -= 15;
    if (b.family === "RP2" && /ADC\d/.test(fn) && role !== "adc") s -= 10;              // để dành chân ADC
    return s;
  }
  const used = () => new Set([...Object.values(B.bus), ...B.mods.flatMap(m => Object.values(m.pins))].filter(Boolean));
  const roleOf = (m, label) => M[m.type].pins.find(x => x[0] === label)[1];
  const getPin = (m, label) => { const r = roleOf(m, label); return SHARED.includes(r) ? B.bus[r] : m.pins[label]; };
  function setPin(m, label, name) { const r = roleOf(m, label); if (SHARED.includes(r)) B.bus[r] = name; else m.pins[label] = name; }
  function best(role, b, taken) {
    let top = null, ts = -1e8;
    for (const p of A.pins) { if (taken.has(p.name)) continue; const s = score(p, role, b); if (s > ts) { ts = s; top = p; } }
    return top;
  }
  function autoAssign(m) {
    const b = board(), taken = used();
    for (const [label, role] of M[m.type].pins) {
      if (getPin(m, label)) continue;
      let p = null;
      if (b.family === "RP2" && role === "i2s.ws") {           // arduino-pico: LRCLK/WS phải là BCLK + 1
        const bl = pinByName(getPin(m, M[m.type].pins.find(x => x[1] === "i2s.bclk")[0]) || "");
        p = bl && A.pins.find(x => x.gpio === bl.gpio + 1 && !taken.has(x.name));
      }
      p = p || best(role, b, taken);
      if (p) { setPin(m, label, p.name); taken.add(p.name); }
    }
  }

  /* ---------- Cảnh báo ---------- */
  function warnings() {
    const b = board(), out = [];
    if (b.logic !== "5 V") out.push(["info", "Board chạy logic 3.3 V: không nối thẳng tín hiệu 5 V vào GPIO."]);
    for (const m of B.mods) {
      const d = M[m.type];
      for (const [label, role, v5] of d.pins) {
        const n = getPin(m, label), p = n && pinByName(n);
        if (!p) { out.push(["ban", `${d.short} ${label}: không còn chân phù hợp.`]); continue; }
        const s = score(p, role, b);
        if (s < 60 && p.warn) out.push(["warn", `${d.short} ${label} → ${p.name}: ${p.warn}`]);
        if (s <= -1e8) out.push(["ban", `${d.short} ${label} → ${p.name}: chân này không làm được ${role}.`]);
        if (v5 && b.logic !== "5 V") out.push(["warn", `${d.short} ${label} ra mức 5 V: thêm cầu chia áp 1 kΩ + 2 kΩ trước ${p.name}.`]);
      }
      if (d.vcc === "5V" && b.logic !== "5 V" && m.type === "ws2812") out.push(["info", "WS2812 cấp 5 V: tín hiệu 3.3 V thường chạy được với dây ngắn; dải dài nên thêm IC chuyển mức (74AHCT125)."]);
      if (b.family === "RP2" && /^i2s/.test(d.pins[0][1])) {
        const bc = pinByName(getPin(m, d.pins[0][0]) || ""), ws = pinByName(getPin(m, d.pins[1][0]) || "");
        if (bc && ws && ws.gpio !== bc.gpio + 1) out.push(["warn", `${d.short}: trên Pico chân ${d.pins[1][0]} phải là GP${bc.gpio + 1} (BCLK + 1).`]);
      }
    }
    const pinsUsed = {};
    for (const m of B.mods) for (const [label, role] of M[m.type].pins) { if (SHARED.includes(role)) continue; const n = getPin(m, label); if (n) (pinsUsed[n] = pinsUsed[n] || []).push(M[m.type].short + " " + label); }
    for (const n in pinsUsed) if (pinsUsed[n].length > 1) out.push(["ban", `${n} bị dùng 2 lần: ${pinsUsed[n].join(", ")}.`]);
    if (B.bus["i2c.sda"]) out.push(["info", "Bus I2C dùng chung: cần pull-up 4.7 kΩ trên SDA/SCL (nhiều module đã có sẵn)."]);
    return out;
  }

  /* ---------- Sinh #define ---------- */
  const val = n => { const p = pinByName(n || ""); if (!p) return "-1 /* chưa gán */"; return board().family === "AVR" && /^A\d/.test(p.name) ? p.name : String(p.gpio); };
  const busNo = (n, kind) => { const p = pinByName(n || ""); const m = p && p.fn.join(" ").match(new RegExp(kind + "(\\d)")); return m ? +m[1] : 0; };
  const PFX = { st7789: "TFT", ws2812: "LED", hcsr04: "US", vl53l0x: "TOF", mpu6050: "MPU", max98357a: "I2S", inmp441: "MIC" };
  function code() {
    const b = board(), f = b.family, L = [`// ${b.name} – Pindex Build (pindex.pages.dev)`];
    const has = r => B.mods.some(m => M[m.type].pins.some(x => x[1] === r));
    if (has("spi.sck")) {
      L.push("", "// SPI (dùng chung)", `#define SPI_SCK   ${val(B.bus["spi.sck"])}`, `#define SPI_MOSI  ${val(B.bus["spi.mosi"])}`);
      if (has("spi.miso")) L.push(`#define SPI_MISO  ${val(B.bus["spi.miso"])}`);
      const miso = has("spi.miso") ? "SPI_MISO" : "-1";
      if (f === "ESP32") L.push(`// setup(): SPI.begin(SPI_SCK, ${miso}, SPI_MOSI);`);
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
      const d = M[m.type], p = PFX[m.type];
      const own = d.pins.filter(x => !SHARED.includes(x[1]));
      L.push("", `// ${d.name} – thư viện: ${d.lib}`);
      for (const [label] of own) L.push(`#define ${(p + "_" + label.replace(/\W/g, "")).padEnd(10)} ${val(m.pins[label])}`);
      if (m.type === "ws2812") L.push("#define LED_COUNT  8");
      const g = l => `${p}_${l}`;
      if (m.type === "max98357a") L.push(f === "ESP32" ? `// setup(): i2s.setPins(${g("BCLK")}, ${g("LRC")}, ${g("DIN")});` : `// setup(): i2s.setBCLK(${g("BCLK")}); i2s.setDATA(${g("DIN")});   // LRC = BCLK + 1`);
      if (m.type === "inmp441") L.push(f === "ESP32" ? `// setup(): mic.setPins(${g("SCK")}, ${g("WS")}, -1, ${g("SD")});` : `// setup(): mic.setBCLK(${g("SCK")}); mic.setDATA(${g("SD")});   // WS = SCK + 1`);
      if (m.type === "st7789") L.push(`// Adafruit_ST7789 tft(${g("CS")}, ${g("DC")}, ${g("RST")});`);
    }
    return L.join("\n");
  }

  /* ---------- Vẽ module + dây lên SVG của board ---------- */
  function decorate(svg) {
    if (!B.mods.length) return;
    const vb = svg.viewBox.baseVal, x0 = vb.x + vb.width + 6, W = 20, RH = 2.6;
    const total = B.mods.reduce((s, m) => s + 4 + M[m.type].pins.length * RH + 3, 0);
    let y = Math.max(vb.y, vb.y + (vb.height - total) / 2);
    const wires = A.el("g", { class: "wires" }, svg);
    svg.insertBefore(wires, svg.firstChild.nextSibling);
    for (const [mi, m] of B.mods.entries()) {
      const d = M[m.type], h = 4 + d.pins.length * RH;
      const g = A.el("g", { class: "mod" }, svg);
      A.el("rect", { x: x0, y, width: W, height: h, rx: .8, class: "modbox", stroke: d.color }, g);
      A.el("rect", { x: x0, y, width: W, height: 3.4, rx: .8, fill: d.color }, g);
      A.el("text", { x: x0 + W / 2, y: y + 1.75, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 1.5, class: "modt" }, g, d.short);
      d.pins.forEach(([label], k) => {
        const yy = y + 4 + k * RH + RH / 2, sel = B.sel && B.sel.m === mi && B.sel.label === label;
        const r = A.el("g", { class: "mpin" + (sel ? " on" : ""), "data-m": mi, "data-l": label }, g);
        A.el("rect", { x: x0 + .4, y: yy - RH / 2 + .2, width: W - .8, height: RH - .4, rx: .4, class: "mprow" }, r);
        A.el("circle", { cx: x0, cy: yy, r: .6, fill: d.color }, r);
        A.el("text", { x: x0 + 1.4, y: yy, "dominant-baseline": "central", "font-size": 1.2, class: "mptxt" }, r, label);
        const p = pinByName(getPin(m, label) || "");
        A.el("text", { x: x0 + W - 1, y: yy, "text-anchor": "end", "dominant-baseline": "central", "font-size": 1.1, class: "mpval" }, r, p ? p.name : "—");
        if (p) {
          A.el("path", { d: `M${x0} ${yy} C${x0 - 12} ${yy} ${p.x + 14} ${p.y} ${p.x} ${p.y}`, stroke: d.color, "stroke-width": .4, fill: "none", opacity: .9 }, wires);
          A.el("circle", { cx: p.x, cy: p.y, r: 1.55, fill: "none", stroke: d.color, "stroke-width": .45 }, wires);
        }
        r.addEventListener("click", e => { e.stopPropagation(); B.sel = sel ? null : { m: mi, label }; A.draw(); A.renderDetail(); });
      });
      y += h + 3;
    }
    // gợi ý chân khi đang chọn một chân module: xanh = an toàn, cam = dùng được nhưng có lưu ý
    if (B.sel) {
      const m = B.mods[B.sel.m], role = roleOf(m, B.sel.label), b = board();
      for (const p of A.pins) {
        const s = score(p, role, b); if (s <= -1e8) continue;
        A.el("circle", { cx: p.x, cy: p.y, r: 1.9, fill: "none", stroke: s >= 90 ? "#2fd36b" : "#ffa300", "stroke-width": .3, "stroke-dasharray": ".6 .4", class: "hint" }, wires);
      }
    }
    const right = x0 + W + 2, bottom = Math.max(vb.y + vb.height, y);
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${right - vb.x} ${bottom - vb.y}`);
  }

  // chạm chân board khi đang chọn chân module → nối
  function onPin(p) {
    if (!B.sel) { A.toast("Chọn một chân của module (khung bên phải hình) trước, rồi chạm chân board."); return true; }
    const m = B.mods[B.sel.m], role = roleOf(m, B.sel.label);
    if (score(p, role, board()) <= -1e8) { A.toast(`${p.name} không dùng được cho ${B.sel.label}.`); return true; }
    setPin(m, B.sel.label, p.name); B.sel = null; save(); A.draw(); A.renderDetail(); return true;
  }

  /* ---------- Panel bên phải ---------- */
  function panel(box) {
    const b = board();
    if (!supported(b)) { box.innerHTML = `<div class="d-head"><div><div class="d-kicker">Build</div><h2>${esc(b.name)}</h2></div></div><p class="wtext">Build hiện hỗ trợ board ESP32, Raspberry Pi Pico và Arduino. Raspberry Pi chạy Linux nên chưa hỗ trợ.</p>`; return; }
    const W = warnings();
    const opts = (m, label) => {
      const role = roleOf(m, label), cur = getPin(m, label), taken = used();
      return A.pins.map(p => [p, score(p, role, b)]).filter(([, s]) => s > -1e8).sort((x, y) => y[1] - x[1])
        .map(([p, s]) => `<option value="${esc(p.name)}"${p.name === cur ? " selected" : ""}>${esc(p.name)}${s >= 90 ? " ✓" : " ⚠"}${taken.has(p.name) && p.name !== cur ? " (đang dùng)" : ""}</option>`).join("");
    };
    const chips = Object.entries(M).map(([k, d]) => { const on = B.mods.some(m => m.type === k), ok = modOK(d, b);
      return `<button class="bchip${on ? " on" : ""}" data-add="${k}"${ok ? "" : " disabled title=\"Board này không hỗ trợ\""} style="--mc:${d.color}">${on ? "✓ " : "+ "}${esc(d.short)}</button>`; }).join("");
    const cards = B.mods.map((m, i) => { const d = M[m.type]; return `<div class="bcard" style="--mc:${d.color}"><div class="bc-h"><b>${esc(d.name)}</b><span>${esc(d.iface)} · ${esc(d.vcc)}</span><button class="icon-btn bx" data-del="${i}" aria-label="Bỏ">✕</button></div>
      <table class="btbl">${d.pins.map(([label]) => `<tr${B.sel && B.sel.m === i && B.sel.label === label ? ' class="on"' : ""}><th>${esc(label)}</th><td><select data-m="${i}" data-l="${esc(label)}">${opts(m, label)}</select></td><td><button class="tap" data-m="${i}" data-l="${esc(label)}" title="Chạm chân trên board">☝</button></td></tr>`).join("")}</table>
      <p class="small muted">${esc(d.note)}</p></div>`; }).join("");
    box.innerHTML = `<div class="d-head"><div><div class="d-kicker">⚡ Build · ${esc(b.name)}</div><h2>Ghép module</h2></div></div>
      <div class="seg btabs"><button data-tab="mods" aria-pressed="${B.tab === "mods"}">Module</button><button data-tab="code" aria-pressed="${B.tab === "code"}">Code</button></div>
      ${B.tab === "mods" ? `<p class="hint">Chọn module: app tự gán chân an toàn (✓). Đổi chân bằng danh sách, hoặc bấm ☝ rồi chạm chân trên board (vòng xanh = an toàn, cam = có lưu ý).</p>
        <div class="bchips">${chips}</div>${W.length ? `<div class="bwarn">${W.map(([t, s]) => `<div class="w-${t}">${t === "ban" ? "⛔" : t === "warn" ? "⚠" : "ℹ"} ${esc(s)}</div>`).join("")}</div>` : ""}${cards}`
      : `<pre class="code bcode">${esc(code())}</pre><button class="btn-share" data-copy>Copy #define</button>`}
      <div class="bexp"><button data-exp="png">⬇ Ảnh PNG</button><button data-exp="json">⬇ File .json</button><button data-exp="link">🔗 Link</button><label>⬆ Mở .json<input type="file" accept=".json,application/json" hidden></label></div>`;
    box.querySelectorAll("[data-add]").forEach(x => x.onclick = () => { const k = x.dataset.add, i = B.mods.findIndex(m => m.type === k);
      if (i >= 0) B.mods.splice(i, 1); else { const m = { type: k, pins: {} }; B.mods.push(m); autoAssign(m); } cleanBus(); B.sel = null; save(); A.draw(); panel(box); });
    box.querySelectorAll("[data-del]").forEach(x => x.onclick = () => { B.mods.splice(+x.dataset.del, 1); cleanBus(); B.sel = null; save(); A.draw(); panel(box); });
    box.querySelectorAll("select[data-m]").forEach(x => x.onchange = () => { setPin(B.mods[+x.dataset.m], x.dataset.l, x.value); save(); A.draw(); panel(box); });
    box.querySelectorAll(".tap").forEach(x => x.onclick = () => { B.sel = { m: +x.dataset.m, label: x.dataset.l }; A.draw(); panel(box); A.closeSheet(); });
    box.querySelectorAll("[data-tab]").forEach(x => x.onclick = () => { B.tab = x.dataset.tab; panel(box); });
    const cp = box.querySelector("[data-copy]"); if (cp) cp.onclick = () => navigator.clipboard.writeText(code()).then(() => A.toast("Đã copy"));
    box.querySelectorAll("[data-exp]").forEach(x => x.onclick = () => exportAs(x.dataset.exp));
    box.querySelector("input[type=file]").onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { load(JSON.parse(t)); A.draw(); panel(box); }); };
  }
  function cleanBus() { const need = new Set(B.mods.flatMap(m => M[m.type].pins.map(x => x[1]))); for (const r in B.bus) if (!need.has(r)) delete B.bus[r]; for (const m of B.mods) autoAssign(m); }

  /* ---------- Lưu / export ---------- */
  const dump = () => ({ board: board().id, bus: B.bus, mods: B.mods });
  function load(o) { if (!o || o.board !== board().id) { A.toast("File này của board khác."); return; } B.bus = o.bus || {}; B.mods = (o.mods || []).filter(m => M[m.type]); save(); }
  function save() { try { localStorage.setItem("build:" + board().id, JSON.stringify(dump())); } catch (e) { } }
  function restore() { B.boardId = board().id; B.bus = {}; B.mods = []; B.sel = null; try { const o = JSON.parse(localStorage.getItem("build:" + B.boardId) || "null"); if (o) load(o); } catch (e) { } }
  const dl = (name, href) => { const a = document.createElement("a"); a.href = href; a.download = name; a.click(); };
  async function exportAs(kind) {
    const b = board();
    if (kind === "json") return dl(`pindex-${b.id}.json`, URL.createObjectURL(new Blob([JSON.stringify(dump(), null, 1)], { type: "application/json" })));
    if (kind === "link") { const u = location.href.split("#")[0] + "#build=" + btoa(unescape(encodeURIComponent(JSON.stringify(dump())))); try { await navigator.clipboard.writeText(u); A.toast("Đã copy link Build"); } catch (e) { A.toast(u); } return; }
    // PNG: hình board + module + dây, bên dưới là bảng chân và #define
    const svgUrl = A.svgDataUrl(), img = new Image(); img.src = svgUrl; await img.decode();
    const lines = code().split("\n"), W = 1600, ih = Math.round(img.height * W / img.width), lh = 28, c = document.createElement("canvas");
    c.width = W; c.height = ih + 80 + lines.length * lh + 40;
    const g = c.getContext("2d"), bg = getComputedStyle(document.body).backgroundColor;
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, W, ih);
    g.fillStyle = getComputedStyle(document.body).color; g.font = "bold 34px sans-serif"; g.fillText(`${b.name} · Pindex Build`, 40, ih + 50);
    g.font = "22px Consolas, monospace"; lines.forEach((l, i) => g.fillText(l, 40, ih + 90 + i * lh));
    dl(`pindex-${b.id}.png`, c.toDataURL("image/png"));
  }
  function importHash(h) { try { load(JSON.parse(decodeURIComponent(escape(atob(h))))); } catch (e) { A.toast("Link Build không hợp lệ."); } }

  window.BUILD = {
    enter() { if (B.boardId !== board().id) restore(); },
    decorate, onPin, panel, importHash,
    active: () => B.mods.length > 0
  };
})();
