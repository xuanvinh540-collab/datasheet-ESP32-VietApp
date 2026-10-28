/* Tab WIRING (tên cũ Build/Connect, id vẫn là "build"): khu vẽ riêng kiểu node (Blender). Module là node kéo được; kéo dây từ socket của chân module,
   các pad phù hợp trên board sáng lên (xanh = an toàn, cam = có lưu ý), thả vào pad để nối.
   Chấm điểm chân dựa trên cờ trong boards.js (strap/usb/uart/jtag/adc…). */
(function () {
  const A = window.APP, M = window.MODULES, esc = A.esc, el = A.el, $ = s => document.querySelector(s);
  const SHARED = ["spi.sck", "spi.mosi", "spi.miso", "i2c.sda", "i2c.scl"];
  const POWER = ["pwr.3v3", "pwr.5v", "gnd"];                       // nhiều module dùng chung một pad nguồn
  const COLOR = { "pwr.3v3": "#e2442f", "pwr.5v": "#ff7a45", gnd: "#9aa0a6", "i2c.sda": "#29adff", "i2c.scl": "#f5d63d", "spi.sck": "#ff8a00", "spi.mosi": "#b26bff",
    "spi.miso": "#2fd6c3", "spi.cs": "#ff4fa3", "i2s.bclk": "#ff8a00", "i2s.ws": "#f5d63d", "i2s.dout": "#2fd36b", "i2s.din": "#2fd36b", out: "#7fd1c4", in: "#c3e88d", pwm: "#e879f9", adc: "#a78bfa" };
  const LEGEND = [["pwr.3v3", "VCC 3V3"], ["pwr.5v", "VCC 5V"], ["gnd", "GND"], ["i2c.sda", "SDA"], ["i2c.scl", "SCL"], ["spi.sck", "SCK / BCLK"], ["spi.mosi", "MOSI"], ["spi.miso", "MISO"], ["spi.cs", "CS"], ["i2s.dout", "I2S data"], ["out", "Tín hiệu ra"], ["in", "Tín hiệu vào"], ["pwm", "PWM"]];
  // thêm VCC/GND vào đầu danh sách chân của mỗi module (một lần)
  for (const d of Object.values(M)) {
    if (!d.svg && !d.pins.some(x => x[1] === "gnd")) d.pins.unshift(["VCC", d.vcc === "5V" ? "pwr.5v" : "pwr.3v3"], ["GND", "gnd"]);
    if (d.svg && !d.svgData) fetch(d.svg).then(r => r.text()).then(t => { d.svgData = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(t); if (B.boardId) draw(); }).catch(() => {});
  }
  const B = { boardId: null, buses: [{}], mods: [], tab: "mods", cam: null, arm: null, spread: 1.1, style: 0, arrMode: 0, arrLast: null, selM: null, selW: null, dropOpen: true, q: "", brot: 0, needPlace: false, bb: { on: false, n: 1, board: null } };
  Object.defineProperty(B, "bus", { get() { return B.buses[CUR] || (B.buses[CUR] = {}); }, set(v) { B.buses[CUR] = v; } });
  const CATS = window.MOD_CATS || [];
  // tên hiển thị góc phải trên khung vẽ
  const ARR_NAMES = ["Gần chân nhất", "Vòng cung cân bằng", "Tách Bus / GPIO"];
  const STYLE_NAMES = ["Vuông góc gọn", "Vuông góc tách nhóm", "Cong mềm (Node)", "Vát 45° kiểu PCB"];
  /* ---------- Nhiều board trong một mạch (chế độ breadboard) ----------
     Host 0 = board chính (A.state.b), host k = B.bb.extra[k-1]. Mỗi linh kiện có m.host; mỗi host có bus SPI/I2C riêng (B.buses[k]).
     Các hàm chấm điểm / tự nối chân dùng board() và B.bus của host hiện hành CUR – withHost() đổi host tạm thời. */
  let CUR = 0;
  const hostBoard = h => h ? window.BOARDS.find(x => x.id === ((B.bb.extra || [])[h - 1] || {}).id) || A.state.b : A.state.b;
  const board = () => hostBoard(CUR);
  const hostOf = m => (m && m.host) || 0;
  function withHost(h, fn) { const p = CUR; CUR = h; try { return fn(); } finally { CUR = p; } }
  const hosts = () => [0, ...(B.bb.extra || []).map((x, i) => i + 1)];

  /* ---------- Xoay 0-90-180-270° (theo chiều kim đồng hồ) ----------
     Board vẽ trong <g transform> rồi đặt lại vào góc phần tư dương: khung board luôn là [0, bw()] × [0, bh()].
     PADS là bản sao chân board đã đổi sang toạ độ khung vẽ, mọi phép tính dây dùng PADS thay cho A.pins. */
  const ROT_SIDE = { L: "T", T: "R", R: "B", B: "L" };
  const rotSide = (sd, r) => { for (let i = 0; i < ((r || 0) / 90 | 0) % 4; i++) sd = ROT_SIDE[sd] || sd; return sd; };
  const brot = () => B.brot || 0;
  const bw = () => brot() % 180 ? board().h : board().w;
  const bh = () => brot() % 180 ? board().w : board().h;
  function bpt(x, y) { const b = board(), r = brot(); return r === 90 ? { x: b.h - y, y: x } : r === 180 ? { x: b.w - x, y: b.h - y } : r === 270 ? { x: y, y: b.w - x } : { x, y }; }
  const bTransform = () => { const b = board(), r = brot(); return r === 90 ? `translate(${b.h} 0) rotate(90)` : r === 180 ? `translate(${b.w} ${b.h}) rotate(180)` : r === 270 ? `translate(0 ${b.w}) rotate(270)` : ""; };
  let PADS = [], padsKey = "";
  function pads() {
    const key = board().id + ":" + brot();
    if (key !== padsKey) {
      PADS = []; padsKey = key;
      for (const h of board().headers) for (const p of h.pins) { const q = bpt(p.x, p.y); PADS.push(Object.assign(Object.create(p), { x: q.x, y: q.y, side: rotSide(h.side, brot()) })); }
    }
    return PADS;
  }
  const pinByName = n => pads().find(p => p.name === n);
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
    if (role === "gnd") return p.cat === "gnd" && p.name !== "AGND" ? 100 : -1e9;
    if (role === "pwr.3v3") return p.cat === "power" && /^(3V3|3\.3V)$/.test(p.name) ? 100 : -1e9;
    if (role === "pwr.5v") return p.cat === "power" && /^(5V|VBUS)$/.test(p.name) ? 100 : -1e9;
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
  const used = () => new Set([...Object.values(B.bus), ...B.mods.filter(m => hostOf(m) === CUR).flatMap(m => Object.entries(m.pins).filter(([l]) => { const r = roleOf(m, l); return r && !POWER.includes(r); }).map(x => x[1]))].filter(Boolean));
  const roleOf = (m, label) => (M[m.type].pins.find(x => x[0] === label) || [])[1];
  const getPin = (m, label) => withHost(hostOf(m), () => { const r = roleOf(m, label); return SHARED.includes(r) ? B.bus[r] : m.pins[label]; });
  function setPin(m, label, name) { return withHost(hostOf(m), () => setPinH(m, label, name)); }
  function setPinH(m, label, name) { const r = roleOf(m, label); if (SHARED.includes(r)) { if (name) B.bus[r] = name; else delete B.bus[r]; } else if (name) m.pins[label] = name; else delete m.pins[label]; }
  function best(role, b, taken) { let top = null, ts = -1e8; for (const p of pads()) { if (taken.has(p.name) && !POWER.includes(role)) continue; const s = score(p, role, b); if (s > ts) { ts = s; top = p; } } return top; }
  function autoAssign(m) { return withHost(hostOf(m), () => autoAssignH(m)); }
  function autoAssignH(m) {
    const b = board(), taken = used();
    for (const [label, role] of M[m.type].pins) {
      if (getPin(m, label)) continue;
      let p = null;
      if (b.family === "RP2" && role === "i2s.ws") { const bl = pinByName(getPin(m, M[m.type].pins.find(x => x[1] === "i2s.bclk")[0]) || ""); p = bl && pads().find(x => x.gpio === bl.gpio + 1 && !taken.has(x.name)); }
      p = p || best(role, b, taken);
      if (p) { setPin(m, label, p.name); taken.add(p.name); }
    }
  }

  /* ---------- Cảnh báo ---------- */
  const forHosts = fn => hosts().flatMap(h => { const all = B.mods, mine = all.filter(m => hostOf(m) === h); if (h && !mine.length) return []; B.mods = mine; try { return withHost(h, () => fn(h)); } finally { B.mods = all; } });
  const warnings = () => forHosts(h => warnFor().map(([t, x]) => [t, (hosts().length > 1 ? `[${board().name}] ` : "") + x]));
  const code = () => forHosts(h => [codeFor()]).join("\n\n");
  function warnFor() {
    const b = board(), out = [];
    if (b.logic !== "5 V") out.push(["info", "Board chạy logic 3.3 V: không nối thẳng tín hiệu 5 V vào GPIO."]);
    const busy = {};
    for (const m of B.mods) {
      const d = M[m.type];
      for (const [label, role, v5] of d.pins) {
        const n = getPin(m, label), p = n && pinByName(n);
        if (!p) { out.push(["todo", `${d.short} ${label}: chưa nối.`]); continue; }
        if (!SHARED.includes(role) && !POWER.includes(role)) (busy[n] = busy[n] || []).push(d.short + " " + label);
        const s = score(p, role, b);
        if (s <= -1e8) out.push(["ban", `${d.short} ${label} → ${p.name}: chân này không làm được ${label}.`]);
        else if (s < 60 && p.warn) out.push(["warn", `${d.short} ${label} → ${p.name}: ${p.warn}`]);
        if (v5 && b.logic !== "5 V") out.push(["warn", `${d.short} ${label} ra mức 5 V: thêm cầu chia áp 1 kΩ + 2 kΩ trước ${p.name}.`]);
      }
      if (m.type === "ws2812" && b.logic !== "5 V") out.push(["info", "WS2812 cấp 5 V: tín hiệu 3.3 V thường chạy được với dây ngắn; dải dài nên thêm IC chuyển mức (74AHCT125)."]);
      const ib = d.pins.find(x => x[1] === "i2s.bclk"), iw = d.pins.find(x => x[1] === "i2s.ws");
      if (b.family === "RP2" && ib && iw) {
        const bc = pinByName(getPin(m, ib[0]) || ""), ws = pinByName(getPin(m, iw[0]) || "");
        if (bc && ws && ws.gpio !== bc.gpio + 1) out.push(["warn", `${d.short}: trên Pico chân ${iw[0]} phải là GP${bc.gpio + 1} (BCLK + 1).`]);
      }
    }
    for (const n in busy) if (busy[n].length > 1) out.push(["ban", `${n} bị dùng 2 lần: ${busy[n].join(", ")}.`]);
    if (B.bus["i2c.sda"]) out.push(["info", "Bus I2C dùng chung: cần pull-up 4.7 kΩ trên SDA/SCL (nhiều module đã có sẵn)."]);
    return out;
  }

  /* ---------- Sinh #define ---------- */
  const val = n => { const p = pinByName(n || ""); if (!p) return "-1 /* chưa nối */"; return board().family === "AVR" && /^A\d/.test(p.name) ? p.name : String(p.gpio); };
  const busNo = (n, kind) => { const p = pinByName(n || ""); const m = p && p.fn.join(" ").match(new RegExp(kind + "(\\d)")); return m ? +m[1] : 0; };
  const PFX = { button: "BTN", led: "LED1", buzzer: "BUZ", sevseg: "SEG", ssd1306: "OLED", ldr: "LDR", dht22: "DHT", st7789: "TFT", ws2812: "LED", hcsr04: "US", vl53l0x: "TOF", mpu6050: "MPU", max98357a: "I2S", inmp441: "MIC" };
  function codeFor() {
    const b = board(), f = b.family, L = [`// ${b.name} – Pindex Wiring (pindexio.com)`];
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
      const d = M[m.type], p = PFX[m.type] || m.type.toUpperCase(), g = l => `${p}_${l}`;
      L.push("", `// ${d.name} – thư viện: ${d.lib}`);
      for (const [label] of d.pins.filter(x => !SHARED.includes(x[1]) && !POWER.includes(x[1]))) L.push(`#define ${(p + "_" + label.replace(/\W/g, "")).padEnd(10)} ${val(m.pins[label])}`);
      if (m.type === "button") L.push(`// setup(): pinMode(${g("SIG")}, INPUT_PULLUP);`);
      if (m.type === "led") L.push(`// setup(): pinMode(${g("A")}, OUTPUT);`);
      if (m.type === "buzzer") L.push(`// tone(${g("SIG")}, 440, 200);`);
      if (m.type === "ssd1306") L.push("// Adafruit_SSD1306 display(128, 64, &Wire, -1); // 0x3C");
      if (m.type === "ws2812") L.push("#define LED_COUNT  8");
      if (m.type === "max98357a") L.push(f === "ESP32" ? `// setup(): i2s.setPins(${g("BCLK")}, ${g("LRC")}, ${g("DIN")});` : `// setup(): i2s.setBCLK(${g("BCLK")}); i2s.setDATA(${g("DIN")});   // LRC = BCLK + 1`);
      if (m.type === "inmp441") L.push(f === "ESP32" ? `// setup(): mic.setPins(${g("SCK")}, ${g("WS")}, -1, ${g("SD")});` : `// setup(): mic.setBCLK(${g("SCK")}); mic.setDATA(${g("SD")});   // WS = SCK + 1`);
      if (m.type === "st7789") L.push(`// Adafruit_ST7789 tft(-1, ${g("DC")}, ${g("RES")});`);
    }
    return L.join("\n");
  }

  /* ---------- Khu vẽ node & thuật toán sắp xếp / đi dây ---------- */
  const NW = 22, RH = 2.8, HH = 3.6;
  const modW = d => d.w || NW;
  const modH = d => d.h || (HH + d.pins.length * RH);
  const svg = () => $("#bsvg");
  const toSvg = e => { const s = svg(), pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(s.getScreenCTM().inverse()); };
  const mrot = m => m.rot || 0;
  const mw = m => mrot(m) % 180 ? modH(M[m.type]) : modW(M[m.type]);     // kích thước khung sau khi xoay
  const mh = m => mrot(m) % 180 ? modW(M[m.type]) : modH(M[m.type]);
  const rotPt = (x, y, cx, cy, r) => { const dx = x - cx, dy = y - cy; return r === 90 ? { x: cx - dy, y: cy + dx } : r === 180 ? { x: cx - dx, y: cy - dy } : r === 270 ? { x: cx + dy, y: cy - dx } : { x, y }; };
  const mCenter = m => ({ x: m.pos.x + mw(m) / 2, y: m.pos.y + mh(m) / 2 });
  function sockPos(m, k) {
    const d = M[m.type], pin = d.pins[k], r = mrot(m), c = mCenter(m);
    const x0 = c.x - modW(d) / 2, y0 = c.y - modH(d) / 2;             // góc trên-trái khi chưa xoay
    let u, dir;
    if (d.svg && pin[3] != null) {
      const [vx, vy, vw, vh] = d.vb.length === 4 ? d.vb : [0, 0, d.vb[0], d.vb[1]];
      u = { x: x0 + (pin[3] - vx) / vw * d.w, y: y0 + (pin[4] - vy) / vh * d.h }; dir = pin[5] || d.pinDir || "T";
    } else { u = { x: x0, y: y0 + HH + k * RH + RH / 2 }; dir = "L"; }
    const q = rotPt(u.x, u.y, c.x, c.y, r);
    return { x: q.x, y: q.y, dir: rotSide(dir, r), k, m };
  }
  const wirePath = (a, p) => {
    if (a.dir === "T" || a.dir === "B") {
      const dy = (a.dir === "T" ? -1 : 1) * Math.max(8, Math.abs(a.y - p.y) * .45);
      return `M${a.x} ${a.y} C${a.x} ${a.y + dy} ${p.x + 8} ${p.y} ${p.x} ${p.y}`;
    }
    const dx = Math.max(6, Math.abs(a.x - p.x) * .5);
    return `M${a.x} ${a.y} C${a.x - dx} ${a.y} ${p.x + dx} ${p.y} ${p.x} ${p.y}`;
  };
  let boardBox = null;
  const sideOf = p => p.side || "R";
  const modSideOf = m => (m.pos.x + mw(m) / 2 < bw() / 2) ? "L" : "R";

  // Đặt linh kiện quanh board, cân 2 cột trái/phải, rồi thu khung nhìn vừa đủ nên linh kiện mới luôn hiện trong màn hình.
  // Linh kiện đã kéo tay (manual) thì giữ chỗ; linh kiện mới xếp tiếp bên dưới cột đó.
  function autoPlace() {
    if (!boardBox) return;
    const auto = B.mods.filter(m => !m.manual || !m.pos); if (!auto.length) return;
    const totalWires = B.mods.reduce((n, m) => n + M[m.type].pins.length, 0);
    const corridor = Math.max(14, (6 + totalWires * 0.8) * B.spread), vGap = 8 * B.spread;
    const man = B.mods.filter(m => m.manual && m.pos), hs = { L: 0, R: 0 }, cols = { L: [], R: [] };
    for (const m of man) hs[modSideOf(m)] += mh(m) + vGap;
    for (const m of auto) { const sd = hs.L < hs.R ? "L" : "R"; cols[sd].push(m); hs[sd] += mh(m) + vGap; }
    const cy = boardBox.y + boardBox.h / 2, xL = Math.min(0, boardBox.x) - corridor, xR = Math.max(bw(), boardBox.x + boardBox.w) + corridor;
    for (const sd of ["L", "R"]) {
      const col = cols[sd]; if (!col.length) continue;
      const mine = man.filter(m => modSideOf(m) === sd), H = col.reduce((n, m) => n + mh(m), 0) + (col.length - 1) * vGap;
      let y = mine.length ? Math.max(...mine.map(m => m.pos.y + mh(m))) + vGap : cy - H / 2;
      for (const m of col) {
        m.pos = { x: Math.round((sd === "L" ? xL - mw(m) : xR) * 10) / 10, y: Math.round(y * 10) / 10 };
        m.manual = false; delete m.route; y += mh(m) + vGap;
      }
    }
  }
  function rotateMod(i) {
    const m = B.mods[i]; if (!m) return;
    const c = mCenter(m); m.rot = (mrot(m) + 90) % 360; m.pos = { x: c.x - mw(m) / 2, y: c.y - mh(m) / 2 };
    delete m.route; save(); refresh();
  }
  function rotateBoard() {
    B.brot = (brot() + 90) % 360;
    for (const m of B.mods) { m.manual = false; delete m.route; }       // board đổi hình dạng: xếp lại toàn bộ linh kiện
    B.needPlace = true; B.cam = null; save(); refresh();
  }

  // 3 phương án tự động sắp xếp linh kiện quanh main board (nhấn Sắp xếp tự nhảy ngay không ghi chú)
  function arrangeModules() {
    if (!B.mods.length) return;
    B.mods.forEach(autoAssign);
    const b = board(), BW = bw(), BH = bh(), mode = B.arrMode % 3;
    B.arrMode = (B.arrMode + 1) % 3; B.arrLast = mode;
    const L = [], R = [];
    for (const [idx, m] of B.mods.entries()) {
      const d = M[m.type];
      let left = 0, right = 0, sigL = 0, sigR = 0, sumY = 0, cnt = 0;
      for (const [label, role] of d.pins) {
        const p = pinByName(getPin(m, label) || "");
        if (!p) continue;
        const sd = sideOf(p), isL = sd === "L" || (sd !== "R" && p.x < BW / 2);
        if (isL) { left++; if (!POWER.includes(role)) sigL++; }
        else { right++; if (!POWER.includes(role)) sigR++; }
        sumY += p.y; cnt++;
      }
      const avgY = cnt ? sumY / cnt : BH / 2;
      let goLeft;
      if (mode === 0) {
        // Phương án 1: Ưu tiên tuyệt đối phía có nhiều chân cắm hơn
        goLeft = left > right || (left === right && (sigL > sigR || (sigL === sigR && L.length < R.length)));
      } else if (mode === 1) {
        // Phương án 2: Cân bằng đối xứng 2 bên + vây vòng cung quanh main board
        goLeft = (sigL > sigR) || (sigL === sigR && L.length <= R.length);
      } else {
        // Phương án 3: Phân nhóm Bus (I2C/SPI/I2S) và GPIO/Cảm biến sang 2 bên đối diện
        const isBus = /I2C|SPI|I2S/.test(d.iface);
        goLeft = isBus ? (left >= right) : (left > right || L.length <= R.length);
      }
      (goLeft ? L : R).push({ m, d, avgY, idx });
    }
    if (mode === 0) {
      L.sort((a, b) => a.avgY - b.avgY);
      R.sort((a, b) => a.avgY - b.avgY);
    } else if (mode === 1) {
      // Xếp theo số chân nhiều ra giữa, ít ra rìa tạo dáng vòng cung
      L.sort((a, b) => b.d.pins.length - a.d.pins.length || a.avgY - b.avgY);
      R.sort((a, b) => b.d.pins.length - a.d.pins.length || a.avgY - b.avgY);
    } else {
      // Đảo thứ tự dọc và so le bậc thang
      L.sort((a, b) => b.avgY - a.avgY);
      R.sort((a, b) => b.avgY - a.avgY);
    }
    const totalWires = B.mods.reduce((s, m) => s + M[m.type].pins.length, 0);
    const corridor = Math.max(16, (7 + totalWires * 0.9) * B.spread);
    const bx0 = boardBox ? Math.min(0, boardBox.x) : -6;
    const bx1 = boardBox ? Math.max(BW, boardBox.x + boardBox.w) : BW + 6;
    const placeCol = (col, isLeft) => {
      if (!col.length) return;
      const vGap = Math.max(9, (mode === 1 ? 10 : 7.5) * B.spread);
      const totalH = col.reduce((s, x) => s + mh(x.m), 0) + (col.length - 1) * vGap;
      let y = BH / 2 - totalH / 2;
      const mid = (col.length - 1) / 2;
      col.forEach(({ m, d }, i) => {
        const w = mw(m), h = mh(m);
        // Mode 1: cong vòng cung quanh board; Mode 2: so le bậc thang
        const archOff = mode === 1 ? Math.abs(i - mid) * 7 : mode === 2 ? (i % 2) * 8 : 0;
        const x = isLeft ? (bx0 - corridor - w + archOff) : (bx1 + corridor - archOff);
        m.pos = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }; m.manual = true;   // bố cục đã chọn: giữ nguyên khi thêm linh kiện
        delete m.route;
        y += h + vGap;
      });
    };
    placeCol(L, true);
    placeCol(R, false);
    B.cam = null;
    save(); refresh();
  }

  // Tiền tính toán toàn bộ làn dây (pre-compute):
  // B.style = 0 (Vuông góc 1 - Ngắn nhất), 1 (Vuông góc 2 - Tách nhóm), 2 (Dây cong mềm Blender Node), 3 (Bẻ góc 45 độ PCB)
  function computeRoutes() {
    const b = { w: bw(), h: bh() }, y0 = Math.min(0, boardBox ? boardBox.y : 0), y1 = Math.max(b.h, boardBox ? boardBox.y + boardBox.h : b.h), sp = B.spread;
    const step = 1.25 * sp, baseGap = 2.6 * sp, pinStep = 1.12 * sp;
    const items = [];
    for (const [mi, m] of B.mods.entries()) {
      const d = M[m.type], mSide = modSideOf(m), nPins = d.pins.length;
      d.pins.forEach(([label, role], k) => {
        const p = pinByName(getPin(m, label) || "");
        if (!p) return;
        const a = sockPos(m, k), pSide = sideOf(p);
        const pinOrder = mSide === "R" ? k : (nPins - 1 - k);
        const ay = a.dir === "T" ? m.pos.y - (2.1 * sp + pinOrder * pinStep)
                 : a.dir === "B" ? m.pos.y + mh(m) + (2.1 * sp + pinOrder * pinStep) : a.y;
        const sameSide = (mSide === "R" && pSide === "R") || (mSide === "L" && pSide === "L");
        const band = POWER.includes(role) ? 2 : SHARED.includes(role) ? 1 : 0;
        items.push({ key: `${mi}:${label}`, mi, m, d, k, label, role, a, p, mSide, pSide, ay, sameSide, band });
      });
    }
    const grouped = B.style === 1;
    const cross = items.filter(w => !w.sameSide && (w.pSide === "L" || w.pSide === "R"));
    for (const w of cross) {
      w.wrap = grouped ? (w.band === 2 ? "B" : "T") : (((w.ay + w.p.y) / 2 < b.h / 2) ? "T" : "B");
    }
    for (const w of items) if (!w.wrap) w.wrap = w.pSide === "T" ? "T" : "B";

    const topWires = items.filter(w => (!w.sameSide || w.pSide === "T") && w.wrap === "T");
    const botWires = items.filter(w => (!w.sameSide || w.pSide === "B") && w.wrap === "B");
    topWires.sort((u, v) => grouped ? (u.band - v.band || u.p.y - v.p.y) : (u.p.y - v.p.y || u.ay - v.ay));
    botWires.sort((u, v) => grouped ? (u.band - v.band || v.p.y - u.p.y) : (v.p.y - u.p.y || v.ay - u.ay));
    topWires.forEach((w, i) => { const extra = grouped ? w.band * 0.7 * step : 0; w.yv = y0 - baseGap - i * step - extra; });
    botWires.forEach((w, i) => { const extra = grouped ? w.band * 0.7 * step : 0; w.yv = y1 + baseGap + i * step + extra; });

    const rightSegs = [], leftSegs = [];
    for (const w of items) {
      if (w.mSide === "R") rightSegs.push({ w, yA: w.ay, yB: w.sameSide ? w.p.y : w.yv });
      if (w.mSide === "L") leftSegs.push({ w, yA: w.ay, yB: w.sameSide ? w.p.y : w.yv });
      if (!w.sameSide && w.pSide === "R") rightSegs.push({ w, yA: w.yv, yB: w.p.y });
      if (!w.sameSide && w.pSide === "L") leftSegs.push({ w, yA: w.yv, yB: w.p.y });
    }
    const sortVert = (u, v) => {
      if (grouped) return u.w.band - v.w.band || u.w.p.y - v.w.p.y || u.w.ay - v.w.ay;
      if (u.w.sameSide !== v.w.sameSide) return u.w.sameSide ? -1 : 1;
      return Math.abs(u.yA - u.yB) - Math.abs(v.yA - v.yB) || u.w.p.y - v.w.p.y;
    };
    rightSegs.sort(sortVert);
    leftSegs.sort(sortVert);
    rightSegs.forEach((s, i) => { s.w.rx = b.w + baseGap + i * step + (grouped ? s.w.band * 0.85 * step : 0); s.w.laneIdx = i; });
    leftSegs.forEach((s, i) => { s.w.lx = -(baseGap + i * step + (grouped ? s.w.band * 0.85 * step : 0)); if (s.w.laneIdx == null) s.w.laneIdx = i; });

    const map = {};
    for (const w of items) {
      const ov = (w.m.route || {})[w.label] || {};
      const rx = ov.rx ?? w.rx ?? (b.w + baseGap), lx = ov.lx ?? w.lx ?? -baseGap, yv = ov.yv ?? w.yv ?? (y0 - baseGap);
      const { a, p, ay, mSide, pSide } = w, stub = 2.1 * B.spread + (w.k % 6) * 0.6 * B.spread;
      // chân hướng lên/xuống: ra một đoạn dọc; chân hướng trái/phải (linh kiện đã xoay): ra một đoạn ngang
      const start = (a.dir === "T" || a.dir === "B") ? [[a.x, a.y], [a.x, ay]] : [[a.x, a.y], [a.x + (a.dir === "R" ? stub : -stub), a.y]];
      const sy = start[start.length - 1][1];
      let pts;
      if (mSide === "R" && pSide === "R") pts = [...start, [rx, sy], [rx, p.y], [p.x, p.y]];
      else if (mSide === "L" && pSide === "L") pts = [...start, [lx, sy], [lx, p.y], [p.x, p.y]];
      else if (mSide === "R" && pSide === "L") pts = [...start, [rx, sy], [rx, yv], [lx, yv], [lx, p.y], [p.x, p.y]];
      else if (mSide === "L" && pSide === "R") pts = [...start, [lx, sy], [lx, yv], [rx, yv], [rx, p.y], [p.x, p.y]];
      else if (mSide === "R") pts = [...start, [rx, sy], [rx, yv], [p.x, yv], [p.x, p.y]];
      else pts = [...start, [lx, sy], [lx, yv], [p.x, yv], [p.x, p.y]];
      map[w.key] = { pts, w };
    }
    return { map, count: items.length };
  }

  // Bo góc nhỏ (cho 2 kiểu dây vuông góc 0 & 1) hoặc vát góc 45 độ chuẩn mạch PCB (cho kiểu 3)
  function pathOf(pts) {
    if (B.style === 3) return pathOf45(pts);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], r = .8;
      const l1 = Math.hypot(x1 - x0, y1 - y0) || 1, l2 = Math.hypot(x2 - x1, y2 - y1) || 1, k1 = Math.min(r, l1 / 2) / l1, k2 = Math.min(r, l2 / 2) / l2;
      d += ` L${x1 - (x1 - x0) * k1} ${y1 - (y1 - y0) * k1} Q${x1} ${y1} ${x1 + (x2 - x1) * k2} ${y1 + (y2 - y1) * k2}`;
    }
    const z = pts[pts.length - 1]; return d + ` L${z[0]} ${z[1]}`;
  }
  // Bẻ góc 45 độ (chamfered 45° corners)
  function pathOf45(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    const ch = 3.4 * B.spread;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const l1 = Math.hypot(x1 - x0, y1 - y0) || 1, l2 = Math.hypot(x2 - x1, y2 - y1) || 1;
      const c = Math.min(ch, l1 * 0.44, l2 * 0.44), k1 = c / l1, k2 = c / l2;
      d += ` L${x1 - (x1 - x0) * k1} ${y1 - (y1 - y0) * k1} L${x1 + (x2 - x1) * k2} ${y1 + (y2 - y1) * k2}`;
    }
    const z = pts[pts.length - 1]; return d + ` L${z[0]} ${z[1]}`;
  }
  // Dây cong mềm như Blender Node (Cubic Bezier với độ tách làn theo B.spread)
  function blenderPath(w) {
    const { a, p, mSide, pSide, k } = w, sp = B.spread;
    const dist = Math.hypot(a.x - p.x, a.y - p.y);
    const pull = Math.max(10, dist * 0.38) * (0.75 + 0.25 * sp);
    const fan = (k - (w.d.pins.length - 1) / 2) * 2.2 * sp;
    let c1x = a.x, c1y = a.y;
    if (a.dir === "T") { c1y -= pull * 0.75; c1x += (mSide === "R" ? -1 : 1) * Math.abs(fan); }
    else if (a.dir === "B") { c1y += pull * 0.75; c1x += (mSide === "R" ? -1 : 1) * Math.abs(fan); }
    else if (a.dir === "L") { c1x -= pull; c1y += fan; }
    else { c1x += pull; c1y += fan; }
    const padSign = pSide === "L" ? -1 : pSide === "R" ? 1 : 0;
    const c2x = p.x + padSign * (pull * 0.85 + (w.laneIdx || 0) * 1.1 * sp);
    const c2y = p.y + (a.y - p.y) * 0.18 + fan * 0.4;
    const mx = 0.125 * a.x + 0.375 * c1x + 0.375 * c2x + 0.125 * p.x;
    const my = 0.125 * a.y + 0.375 * c1y + 0.375 * c2y + 0.125 * p.y;
    return { d: `M${a.x} ${a.y} C${c1x} ${c1y} ${c2x} ${c2y} ${p.x} ${p.y}`, mx, my };
  }

  function draw() {
    if (B.bb.on && window.BBOARD && BBOARD.ok()) return BBOARD.draw();
    const s = svg(); s.innerHTML = "";
    const bg = el("g", { class: "brd" }, s); if (brot()) bg.setAttribute("transform", bTransform());
    A.drawPCB(bg, true);                                  // board không nhãn lớn, chỉ pad + tên nhỏ
    const [vx, vy, vw, vh] = (bg.getAttribute("viewBox") || "0 0 0 0").split(" ").map(Number); bg.removeAttribute("viewBox");
    const c1 = bpt(vx, vy), c2 = bpt(vx + vw, vy + vh);
    boardBox = { x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y), w: Math.abs(c2.x - c1.x), h: Math.abs(c2.y - c1.y) };
    if (B.needPlace || B.mods.some(m => !m.pos)) { autoPlace(); B.needPlace = false; B.cam = null; save(); }
    const glow = el("g", { id: "glow" }, s), wires = el("g", { id: "wires" }, s), nodes = el("g", {}, s);
    const { map: routeMap, count: lane } = computeRoutes();
    for (const [mi, m] of B.mods.entries()) {
      const d = M[m.type], w = modW(d), h = modH(d);
      d.pins.forEach(([label, role]) => { if (hostOf(m)) return; const p = pinByName(getPin(m, label) || ""); if (!p) return;
        const c = COLOR[role] || d.color, info = routeMap[`${mi}:${label}`]; if (!info) return;
        const { pts, w: wObj } = info;
        const isSel = B.selW && B.selW.m === mi && B.selW.label === label, tag = { "data-wm": mi, "data-wl": label };
        const pd = B.style === 2 ? blenderPath(wObj).d : pathOf(pts);
        const pe = el("path", { d: pd, stroke: c, class: "bwire" + (isSel ? " sel" : ""), ...tag }, wires);
        wireLabels(pe, label, c, tag, wires);
        const hit = el("path", { d: pd, class: "whit", ...tag }, wires);
        hit.addEventListener("pointerdown", e => {
          if (e.button === 2) return;
          selectWire(mi, label);
          if (B.style === 2) e.stopPropagation(); else dragSeg(e, mi, label, pts);
        });
        const end = el("circle", { cx: p.x, cy: p.y, r: 1.25, fill: c, "fill-opacity": .35, stroke: c, "stroke-width": .5, class: "wend", "data-wm": mi, "data-wl": label }, wires);
        end.addEventListener("pointerdown", e => startWire(e, mi, label, true)); });
      const g = el("g", { class: "bnode", "data-m": mi }, nodes);
      const head = el("g", { class: "bhead", "data-m": mi }, g);
      if (d.svg) {
        // Vẽ trực tiếp ảnh SVG của module, nối dây thẳng vào chân trên SVG
        const c = mCenter(m), img = el("image", { href: d.svgData || d.svg, x: c.x - w / 2, y: c.y - h / 2, width: w, height: h, preserveAspectRatio: "none" }, head);
        if (mrot(m)) img.setAttribute("transform", `rotate(${mrot(m)} ${c.x} ${c.y})`);
        d.pins.forEach(([label, role], k) => {
          const a = sockPos(m, k), n = getPin(m, label), armed = B.arm && B.arm.m === mi && B.arm.label === label;
          const rc = COLOR[role] || d.color;
          const so = el("circle", { cx: a.x, cy: a.y, r: .85, fill: n ? rc : "rgba(0,0,0,.35)", "fill-opacity": n ? .85 : .5, stroke: armed ? "#fff" : rc, "stroke-width": armed ? .65 : .4, class: "sock" + (armed ? " armed" : ""), "data-m": mi, "data-l": label }, g);
          el("title", {}, so, `${d.short} · ${label}${n ? " → " + n : " (kéo để nối)"}`);
          so.addEventListener("pointerdown", e => startWire(e, mi, label));
        });
      } else {
        // hộp linh kiện: vẽ ở toạ độ chưa xoay rồi xoay cả nhóm quanh tâm
        const c = mCenter(m), o = { x: c.x - w / 2, y: c.y - h / 2 }, tf = mrot(m) ? { transform: `rotate(${mrot(m)} ${c.x} ${c.y})` } : {};
        const bx = el("g", tf, g); if (mrot(m)) head.setAttribute("transform", tf.transform);
        el("rect", { x: o.x, y: o.y, width: NW, height: h, rx: 1, class: "modbox", stroke: d.color }, bx);
        el("rect", { x: o.x, y: o.y, width: NW, height: HH - .4, rx: 1, fill: d.color }, head);
        el("text", { x: o.x + 1.2, y: o.y + HH / 2 - .2, "dominant-baseline": "central", "font-size": 1.5, class: "modt" }, head, d.short);
        el("text", { x: o.x + NW - 1.2, y: o.y + HH / 2 - .2, "text-anchor": "end", "dominant-baseline": "central", "font-size": 1.1, class: "modt" }, head, d.vcc);
        d.pins.forEach(([label], k) => {
          const a = { x: o.x, y: o.y + HH + k * RH + RH / 2 }, n = getPin(m, label), armed = B.arm && B.arm.m === mi && B.arm.label === label;
          el("text", { x: a.x + 2, y: a.y, "dominant-baseline": "central", "font-size": 1.25, class: "mptxt" }, bx, label);
          el("text", { x: a.x + NW - 1, y: a.y, "text-anchor": "end", "dominant-baseline": "central", "font-size": 1.1, class: "mpval" }, bx, n || "kéo ●");
          const rc = COLOR[d.pins[k][1]] || d.color;
          const so = el("circle", { cx: a.x, cy: a.y, r: .95, fill: n ? rc : "var(--surface)", stroke: rc, "stroke-width": .45, class: "sock" + (armed ? " armed" : ""), "data-m": mi, "data-l": label }, bx);
          so.addEventListener("pointerdown", e => startWire(e, mi, label));
        });
      }
      head.addEventListener("pointerdown", e => { if (e.button !== 2) startNode(e, mi); });
      if (B.selM === mi) el("rect", { x: m.pos.x - 1, y: m.pos.y - 1, width: mw(m) + 2, height: mh(m) + 2, rx: 1, class: "bsel" }, g);
    }
    // dây đang chọn: tên 2 chân ở 2 đầu, góc trái trên khung vẽ
    const wi = $("#bwinfo"), sw = B.selW && B.mods[B.selW.m];
    if (wi) {
      wi.hidden = !sw;
      if (sw) {
        const d = M[sw.type], n = getPin(sw, B.selW.label), p = pinByName(n || "");
        wi.innerHTML = `<b>${esc(d.short)} · ${esc(B.selW.label)}</b><span>⟷</span><b>${esc(board().name)} · ${esc(n || "?")}${p && p.gpio != null ? ` (GPIO${p.gpio})` : ""}</b>`;
        wi.style.top = svg().getBoundingClientRect().top - svg().parentElement.getBoundingClientRect().top + 10 + "px";
      }
    }
    const nm = $("#bname");
    if (nm) {   // tên bố cục / kiểu dây: góc phải TRÊN khung vẽ
      nm.innerHTML = `<div><span>Bố cục:</span> ${esc(B.arrLast == null ? "Tự do" : ARR_NAMES[B.arrLast])}</div><div><span>Dây:</span> ${esc(STYLE_NAMES[B.style])}</div>${brot() ? `<div><span>Board:</span> ${brot()}°</div>` : ""}`;
      nm.style.top = svg().getBoundingClientRect().top - svg().parentElement.getBoundingClientRect().top + 10 + "px";
    }
    if (B.arm) showGlow(B.mods[B.arm.m], B.arm.label);
    // khung nhìn: board + toàn bộ node cả bên Trái lẫn bên Phải, có thể pan/zoom
    const minX = B.mods.map(m => m.pos.x - 8), maxX = B.mods.map(m => m.pos.x + mw(m) + 8);
    const minY = B.mods.map(m => m.pos.y - 10), maxY = B.mods.map(m => m.pos.y + mh(m) + 10);
    const pad = 4 + lane * 1.2 * B.spread;
    const world = { x: Math.min(boardBox.x - pad, ...minX), y: Math.min(boardBox.y - pad, ...minY), w: 0, h: 0 };
    world.w = Math.max(boardBox.x + boardBox.w + (B.mods.length ? pad : 50), ...maxX) - world.x;
    world.h = Math.max(boardBox.y + boardBox.h + pad, ...maxY) - world.y;
    if (!B.cam) B.cam = { ...world };
    s.setAttribute("viewBox", `${B.cam.x} ${B.cam.y} ${B.cam.w} ${B.cam.h}`);
  }
  // tên dây: 1 nhãn; dây dài thêm tới 3 nhãn rải đều dọc dây
  function wireLabels(pe, label, c, tag, parent) {
    const L = pe.getTotalLength(); if (L < 6) return;
    const n = L > 70 ? 3 : L > 35 ? 2 : 1;
    for (let i = 1; i <= n; i++) {
      const t = L * i / (n + 1), p = pe.getPointAtLength(t), q = pe.getPointAtLength(Math.min(L, t + .6));
      const vert = Math.abs(q.x - p.x) < Math.abs(q.y - p.y) * .4;
      el("text", { x: p.x, y: p.y, "text-anchor": "middle", "font-size": 1.45, class: "wlabel", ...tag,
        transform: vert ? `rotate(-90 ${p.x} ${p.y}) translate(0 -.55)` : "translate(0 -.55)" }, parent, label);
    }
  }
  function showGlow(m, label) {
    const g = $("#glow"); g.innerHTML = ""; const role = roleOf(m, label), b = board(), taken = used(), cur = getPin(m, label);
    for (const p of pads()) {
      const s = score(p, role, b); if (s <= -1e8) continue;
      const busy = taken.has(p.name) && p.name !== cur && !SHARED.includes(role);
      el("circle", { cx: p.x, cy: p.y, r: 1.9, class: "glow " + (busy ? "busy" : s >= 90 ? "ok" : "warn") }, g);
    }
  }
  function nearestPad(pt) { let best = null, bd = 2.6; for (const p of pads()) { const d = Math.hypot(p.x - pt.x, p.y - pt.y); if (d < bd) { bd = d; best = p; } } return best; }
  // chân linh kiện gần con trỏ nhất – để rút đầu dây phía linh kiện sang chân khác
  function nearestSock(pt, skip) {
    let best = null, bd = 2.6;
    for (const [mi, m] of B.mods.entries()) M[m.type].pins.forEach(([label], k) => {
      if (skip && skip.m === mi && skip.label === label) return;
      const a = sockPos(m, k), d = Math.hypot(a.x - pt.x, a.y - pt.y);
      if (d < bd) { bd = d; best = { m: mi, label, x: a.x, y: a.y }; }
    });
    return best;
  }
  // chuyển dây sang chân linh kiện khác, giữ nguyên chân board
  function moveWire(from, to, padName) {
    const src = B.mods[from.m], dst = B.mods[to.m];
    if (score(pinByName(padName), roleOf(dst, to.label), board()) <= -1e8) { A.toast(padName + " không dùng được cho " + to.label + "."); return false; }
    setPin(src, from.label, null); if (src.route) delete src.route[from.label];
    setPin(dst, to.label, padName); if (dst.route) delete dst.route[to.label];
    save(); A.toast("Đã chuyển dây sang " + M[dst.type].short + " · " + to.label); return true;
  }
  function connect(m, label, p) {
    if (score(p, roleOf(m, label), board()) <= -1e8) { A.toast(`${p.name} không dùng được cho ${label}.`); return false; }
    setPin(m, label, p.name); if (m.route) delete m.route[label]; save(); return true;
  }
  function startWire(e, mi, label, fromEnd) {
    e.stopPropagation(); e.preventDefault();
    const m = B.mods[mi], k = M[m.type].pins.findIndex(x => x[0] === label), a = sockPos(m, k), s = svg();
    const padPin = pinByName(getPin(m, label) || "");
    // nắm đầu nào thì đầu đó rút ra: đầu board giữ chân linh kiện, đầu linh kiện giữ chân board
    const loose = !fromEnd && padPin ? "sock" : "pad";
    if (loose === "pad") showGlow(m, label); else $("#glow").innerHTML = "";
    // dây đang nối của chân này ẩn đi, thay bằng dây tạm bám theo con trỏ (khi nắm đầu dây thì làm mờ dây khác)
    const mine = x => x.dataset.wm === String(mi) && x.dataset.wl === label;
    $("#wires").querySelectorAll("path,circle,text").forEach(x => { if (mine(x)) x.style.display = "none"; else x.style.opacity = .25; });
    const anchor = loose === "sock" ? { x: padPin.x, y: padPin.y, dir: "L" } : a;
    const far = loose === "sock" ? a : padPin;
    const tmp = el("path", { d: padPin ? wirePath(anchor, far) : "", stroke: COLOR[M[m.type].pins[k][1]] || M[m.type].color, class: "bwire" + (padPin ? "" : " tmp") }, $("#wires"));
    let moved = false;
    const mv = ev => {
      moved = true; const pt = toSvg(ev);
      const near = loose === "sock" ? nearestSock(pt) : nearestPad(pt);
      tmp.setAttribute("d", wirePath(anchor, near ? { x: near.x, y: near.y } : pt));
    };
    const up = ev => {
      s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up);
      if (!moved) { B.arm = B.arm && B.arm.m === mi && B.arm.label === label ? null : { m: mi, label }; return refresh(); }   // chạm (không kéo) = chọn rồi chạm pad
      const pt = toSvg(ev), drop = () => { setPin(m, label, null); if (m.route) delete m.route[label]; save(); A.toast("Đã gỡ dây " + label); };
      if (loose === "sock") { const sk = nearestSock(pt, { m: mi, label }); if (sk) moveWire({ m: mi, label }, sk, padPin.name); else if (!nearestSock(pt)) drop(); }
      else { const p = nearestPad(pt); if (p) connect(m, label, p); else if (getPin(m, label)) drop(); }
      B.arm = null; refresh();
    };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }
  function dragSeg(e, mi, label, pts) {
    e.stopPropagation(); e.preventDefault();
    const m = B.mods[mi], b = { w: bw(), h: bh() }, s = svg(), pt = toSvg(e);
    let seg = -1, bd = 1e9;                                   // đoạn gần con trỏ nhất (bỏ đoạn đầu & cuối vì gắn vào socket/pad)
    for (let i = 2; i < pts.length - 1; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const d = Math.abs(x0 - x1) < .01 ? Math.abs(pt.x - x0) + Math.max(0, Math.min(y0, y1) - pt.y, pt.y - Math.max(y0, y1)) : Math.abs(pt.y - y0) + Math.max(0, Math.min(x0, x1) - pt.x, pt.x - Math.max(x0, x1));
      if (d < bd) { bd = d; seg = i; } }
    if (seg < 0) return;
    // làn của một đoạn: đoạn dọc → rx/lx, đoạn ngang vòng trên/dưới board → yv (đoạn ngang đầu tiên gắn chân linh kiện thì không kéo)
    const lane = i => {
      if (i < 2 || i > pts.length - 2) return null;
      const [x0, y0] = pts[i - 1], [x1] = pts[i], vert = Math.abs(x0 - x1) < .01;
      if (!vert && i === 2) return null;
      const key = vert ? (x0 > b.w / 2 ? "rx" : "lx") : "yv", top = y0 < b.h / 2;
      return { vert, key, clamp: v => key === "rx" ? Math.min(Math.max(v, b.w + 1), 220) : key === "lx" ? Math.min(Math.max(v, -220), -1) : top ? Math.min(Math.max(v, -90), -1) : Math.max(Math.min(v, b.h + 90), b.h + 1) };
    };
    // kéo 2 trục cùng lúc: đoạn đang nắm + đoạn vuông góc liền kề ở đầu gần con trỏ (góc cua đi theo chuột)
    const L1 = lane(seg) || lane(seg + 1); if (!L1) return;
    const [ax, ay] = pts[seg - 1], [bx, by] = pts[seg], near = Math.hypot(pt.x - ax, pt.y - ay) < Math.hypot(pt.x - bx, pt.y - by) ? seg - 1 : seg + 1;
    let L2 = lane(near); if (!L2 || L2.vert === L1.vert || L2.key === L1.key) L2 = lane(near === seg - 1 ? seg + 1 : seg - 1);
    if (L2 && (L2.vert === L1.vert || L2.key === L1.key)) L2 = null;
    m.route = m.route || {}; m.route[label] = { ...(m.route[label] || {}) };
    const mv = ev => { const q = toSvg(ev), r = m.route[label]; for (const L of [L1, L2]) if (L) r[L.key] = L.clamp(L.vert ? q.x : q.y); draw(); };
    const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); save(); };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }
  function startNode(e, mi) {
    e.stopPropagation(); e.preventDefault();
    const m = B.mods[mi], s = svg(), p0 = toSvg(e), o = { ...m.pos };
    B.selM = mi; B.selW = null; draw();                       // chọn linh kiện (Delete để xoá)
    const mv = ev => { const pt = toSvg(ev); m.pos = { x: o.x + pt.x - p0.x, y: o.y + pt.y - p0.y }; m.manual = true; B.arrLast = null; draw(); };
    const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); save(); };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }

  /* ---------- Chọn & xoá: Delete/Backspace hoặc chuột phải ---------- */
  function selectWire(mi, label, quiet) { B.selW = { m: mi, label }; B.selM = null; B.selX = null; if (!quiet) draw(); }
  function removeMod(i) {
    const d = M[B.mods[i].type]; B.mods.splice(i, 1);
    B.selM = B.selW = null; B.arm = null; cleanBus(); save(); refresh(); A.toast("Đã xoá " + d.short);
  }
  function removeWire(mi, label) {
    const m = B.mods[mi]; if (!m) return;
    setPin(m, label, null); if (m.route) delete m.route[label];
    B.selW = null; save(); refresh(); A.toast("Đã xoá dây " + label);
  }
  function unwireMod(i, quiet) {
    const m = B.mods[i]; if (!m) return;
    for (const [label] of M[m.type].pins) setPin(m, label, null);
    m.route = {}; B.selW = null;
    if (!quiet) { save(); refresh(); A.toast("Đã xoá nối dây " + M[m.type].short); }
  }
  function autoMod(i) { const m = B.mods[i]; if (!m) return; autoAssign(m); save(); refresh(); A.toast("Đã tự nối chân " + M[m.type].short); }
  function rewire(mi, label) {
    const m = B.mods[mi]; if (!m) return;
    setPin(m, label, null); if (m.route) delete m.route[label];
    autoAssign(m); save(); refresh(); A.toast(`Đã nối lại ${label} → ${getPin(m, label) || "?"}`);
  }
  // menu chuột phải (nhấn giữ trên điện thoại cũng mở)
  const closeMenu = () => document.querySelectorAll(".bmenu").forEach(x => x.remove());
  function ctxMenu(e, items) {
    closeMenu();
    const st = svg().parentElement, r = st.getBoundingClientRect(), mn = document.createElement("div");
    mn.className = "bmenu"; mn.setAttribute("role", "menu");
    items.forEach(it => {
      if (it === "-") { if (mn.lastChild && mn.lastChild.tagName === "BUTTON") mn.appendChild(Object.assign(document.createElement("hr"), { className: "bmsep" })); return; }
      const [t, fn, key] = it, b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem");
      b.innerHTML = `<span>${esc(t)}</span>${key ? `<kbd>${key}</kbd>` : ""}`; b.onclick = () => { closeMenu(); fn(); }; mn.appendChild(b);
    });
    st.appendChild(mn);
    const x = Math.min(e.clientX - r.left, r.width - mn.offsetWidth - 8), y = Math.min(e.clientY - r.top, r.height - mn.offsetHeight - 8);
    mn.style.left = Math.max(8, x) + "px"; mn.style.top = Math.max(8, y) + "px";
    mn.querySelector("button").focus();
  }
  // dãn dây / kiểu dây: thanh công cụ + menu chuột phải
  function setSpread(v) {
    B.spread = Math.round(Math.min(2.8, Math.max(0.6, v)) * 10) / 10;
    for (const [i, v] of [["#bspread", "#bspreadv"], ["#bbspread", "#bbspreadv"]]) { const r = $(i), o = $(v); if (r) r.value = B.spread; if (o) o.textContent = "×" + B.spread; }
    draw(); save();
  }
  function cycleStyle() { B.style = (B.style + 1) % 4; for (const m of B.mods) delete m.route; save(); draw(); }
  const WIRE_ITEMS = () => ["-", ["🔀 Đổi kiểu đi dây", cycleStyle], ["↔ Dãn dây rộng hơn", () => setSpread(B.spread + 0.2), "+"], ["↕ Thu dây gọn hơn", () => setSpread(B.spread - 0.2), "−"]];

  /* ---------- Cài đặt xuất ảnh ---------- */
  const RATIOS = { auto: [1200, 0, "Tự do"], "16:9": [1600, 900, "16:9"], "3:2": [1500, 1000, "3:2"], "1:1": [1200, 1200, "1:1"], "9:16": [900, 1600, "9:16"] };
  const EXP_DEF = { scale: 2, bg: "white", ratio: "auto", wire: true, sch: true, code: true, logo: true };
  const EXP = (() => { try { const o = { ...EXP_DEF, ...JSON.parse(localStorage.getItem("build:exp2") || "{}") }; if (!["orig", "white", "none"].includes(o.bg)) o.bg = "white"; if (!RATIOS[o.ratio]) o.ratio = "auto"; return o; } catch (e) { return { ...EXP_DEF }; } })();
  const saveExp = () => { try { localStorage.setItem("build:exp2", JSON.stringify(EXP)); } catch (e) { } };
  function toggleSet(on) {
    const p = $("#bset"), bt = $("#bsetBtn"); if (!p) return;
    on = on == null ? p.hidden : on; p.hidden = !on; if (bt) bt.setAttribute("aria-expanded", on);
  }
  function settingsPanel() {
    const p = document.createElement("div"); p.id = "bset"; p.className = "bset"; p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Cài đặt xuất ảnh");
    const opt = (k, v, inner) => `<button type="button" data-v="${v}" aria-pressed="${String(EXP[k]) === String(v)}">${inner}</button>`;
    const ico = r => { const [w, h, t] = RATIOS[r]; return `<i class="rico${h ? "" : " auto"}"${h ? ` style="width:${Math.round(18 * Math.min(1, w / h))}px;height:${Math.round(18 * Math.min(1, h / w))}px"` : ""}></i>${t}`; };
    const chk = (k, t) => `<label class="bchk"><input type="checkbox" data-c="${k}"${EXP[k] ? " checked" : ""}> ${t}</label>`;
    p.innerHTML = `<div class="bset-t">Xuất ảnh PNG</div>
      <fieldset><legend>Khung ảnh</legend><div class="bopts bratio" data-k="ratio">${Object.keys(RATIOS).map(r => opt("ratio", r, ico(r))).join("")}</div></fieldset>
      <fieldset><legend>Độ phân giải</legend><div class="bopts" data-k="scale">${[1, 2, 3, 4].map(s => opt("scale", s, s + "×")).join("")}</div><div class="bpx" id="bsetPx"></div></fieldset>
      <fieldset><legend>Nền</legend><div class="bopts" data-k="bg">${opt("bg", "orig", '<i class="bsw" style="background:var(--canvas)"></i>Nguyên bản')}${opt("bg", "white", '<i class="bsw" style="background:#fff"></i>Trắng')}${opt("bg", "none", '<i class="bsw bchecker"></i>Không nền')}</div></fieldset>
      <fieldset><legend>Nội dung</legend><div class="bchks">${chk("wire", "Sơ đồ đấu dây")}${chk("sch", "Sơ đồ nguyên lý")}${chk("code", "Code #define")}${chk("logo", "Logo pindexio")}</div></fieldset>
      <div class="bset-f"><button type="button" class="bbtn" id="bsetClose">Đóng</button><button type="button" class="bbtn primary" id="bsetPng"><i>⬇</i><span>Xuất PNG</span></button></div>`;
    const px = () => { const [w, h] = RATIOS[EXP.ratio]; p.querySelector("#bsetPx").textContent = h ? `${w * EXP.scale} × ${h * EXP.scale} px` : `Rộng ${w * EXP.scale} px, cao theo nội dung`; };
    p.querySelectorAll(".bopts button").forEach(b => b.onclick = () => {
      const k = b.parentElement.dataset.k; EXP[k] = k === "scale" ? +b.dataset.v : b.dataset.v; saveExp();
      b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); px();
    });
    p.querySelectorAll("[data-c]").forEach(c => c.onchange = () => { EXP[c.dataset.c] = c.checked; saveExp(); });
    p.querySelector("#bsetClose").onclick = () => toggleSet(false);
    p.querySelector("#bsetPng").onclick = () => exportAs("png");
    px();
    return p;
  }

  // sơ đồ nguyên lý gọn kiểu KiCad: MCU giữa, linh kiện chia hai bên cho cân, nối ngang thẳng; nguồn/GND vẽ ký hiệu
  function schemLayout() {
    const RH = 22, HD = 26, GAP = 26, MW = 130, DW = 150, LINK = 120, isPwr = r => r === "gnd" || r.startsWith("pwr");
    const items = B.mods.map((m, i) => ({ m, i, d: M[m.type], h: HD + M[m.type].pins.length * RH + 8 }));
    const tot = items.reduce((s, x) => s + x.h, 0), side = { L: [], R: [] }, hgt = { L: 0, R: 0 };
    for (const it of items) { const s = items.length > 1 && tot > 260 && hgt.L < hgt.R ? "L" : "R"; side[s].push(it); hgt[s] += it.h + GAP; }
    const two = side.L.length > 0, mx = two ? DW + LINK : 0, W = mx + MW + LINK + DW + 8, top = 30;
    const H = top + Math.max(hgt.L, hgt.R, 60) + 4;
    return { w: W, h: H, draw(g, ink, muted) {
      g.save(); g.lineWidth = 1.6; g.textBaseline = "middle";
      const box = (x, y, w, h) => { g.fillStyle = "rgba(245,214,61,.12)"; g.fillRect(x, y, w, h); g.strokeStyle = ink; g.strokeRect(x, y, w, h); };
      const mt = 4, mh = H - mt - 4; box(mx, mt, MW, mh);
      g.fillStyle = ink; g.font = "bold 13px sans-serif"; g.textAlign = "center"; g.fillText(board().name, mx + MW / 2, mt + 14, MW - 8);
      g.fillStyle = muted; g.font = "11px sans-serif"; g.fillText("U1", mx + MW / 2, mt + mh - 10);
      for (const s of ["L", "R"]) {
        let y = top; const dir = s === "R" ? 1 : -1, edge = s === "R" ? mx + MW : mx, xd = s === "R" ? edge + LINK : edge - LINK - DW, din = s === "R" ? xd : xd + DW;
        for (const { m, i, d, h } of side[s]) {
          box(xd, y, DW, h - 8);
          g.fillStyle = ink; g.font = "bold 12.5px sans-serif"; g.textAlign = "center"; g.fillText(d.short, xd + DW / 2, y + 12, DW - 30);
          g.fillStyle = muted; g.font = "10.5px sans-serif"; g.textAlign = s === "R" ? "right" : "left"; g.fillText("U" + (i + 2), s === "R" ? xd + DW - 5 : xd + 5, y + 12);
          d.pins.forEach(([label, role], k) => {
            const py = y + HD + k * RH + RH / 2, n = getPin(m, label), col = COLOR[role] || ink;
            g.fillStyle = ink; g.font = "12px Consolas, monospace"; g.textAlign = s === "R" ? "left" : "right"; g.fillText(label, din + dir * 8, py);
            g.strokeStyle = ink; g.beginPath();
            if (!n) { const c = din - dir * 10; g.moveTo(din, py); g.lineTo(c, py); g.moveTo(c - 4, py - 4); g.lineTo(c + 4, py + 4); g.moveTo(c + 4, py - 4); g.lineTo(c - 4, py + 4); g.stroke(); return; }
            if (isPwr(role)) {   // ký hiệu nguồn ngay cạnh chân, không kéo dây về MCU
              const sx = din - dir * 26; g.strokeStyle = col; g.moveTo(din, py); g.lineTo(sx, py); g.stroke(); g.strokeStyle = ink; g.beginPath();
              if (role === "gnd") for (const [o, l] of [[0, 7], [4, 4.5], [8, 2]]) { g.moveTo(sx - dir * o, py - l); g.lineTo(sx - dir * o, py + l); }
              else { g.moveTo(sx, py - 7); g.lineTo(sx, py + 7); }
              g.stroke(); g.fillStyle = ink; g.font = "bold 11px sans-serif"; g.textAlign = s === "R" ? "right" : "left"; g.fillText(role === "gnd" ? "GND" : n, sx - dir * (role === "gnd" ? 12 : 4), py);
              return;
            }
            g.strokeStyle = col; g.lineWidth = 2; g.moveTo(edge, py); g.lineTo(din, py); g.stroke(); g.lineWidth = 1.6;
            g.fillStyle = ink; g.beginPath(); g.arc(edge, py, 2.6, 0, 7); g.fill();
            g.font = "bold 12px Consolas, monospace"; g.textAlign = s === "R" ? "right" : "left"; g.fillText(n, edge - dir * 6, py);
          });
          y += h + GAP;
        }
      }
      g.restore();
    } };
  }
  function deleteSel() {
    if (B.selW) removeWire(B.selW.m, B.selW.label);
    else if (B.selM != null && B.mods[B.selM]) removeMod(B.selM);
    else if (B.bb.on && B.selX && B.selX.t === "board") removeExtra(B.selX.k);
    else if (B.bb.on && B.selX && B.selX.t === "bb" && window.BBOARD) { if (B.bb.n <= 1) return A.toast("Cần giữ ít nhất 1 breadboard."); B.bb.sel = B.selX.i; BBOARD.removeBB(); B.selX = null; save(); refresh(); A.toast("Đã xoá breadboard"); }
  }
  function initCanvas() {
    const s = svg();
    const bar = document.querySelector(".bbar"), zoomBox = bar && bar.querySelector(".zoom");
    if (bar) {
      bar.querySelectorAll("span.muted").forEach(n => n.remove());
      if (!$("#btools")) {
        const tools = document.createElement("div");
        tools.id = "btools"; tools.className = "btools";
        // thanh công cụ kiểu KiCad: nút phẳng icon + chữ, ngăn nhóm bằng vạch dọc
        const tb = (id, ic, t, tip) => `<button type="button" class="bbtn" id="${id}" title="${tip}"><i aria-hidden="true">${ic}</i><span>${t}</span></button>`;
        // chế độ: Nối dây (mặc định) | Breadboard – bấm Breadboard lần nữa để đổi 1 → 2 → 3 tấm
        tools.innerHTML = `<span class="bmode" role="group" aria-label="Chế độ">` + tb("bmwire", "🔌", "Nối dây", "Chế độ nối dây mặc định") + tb("bbtog", "▦", "Breadboard", "Cắm lên breadboard; bấm lần nữa để đổi số tấm 1 → 2 → 3") + `</span><span class="bsep"></span>`
          + `<span class="bwtools">` + tb("barr", "🧲", "Sắp xếp", "Đổi cách sắp xếp linh kiện") + tb("bstyle", "🔀", "Đi dây", "Đổi kiểu đi dây") + tb("brot", "⟳", "Xoay board", "Xoay board 90°")
          + `<span class="bsep"></span><label class="bslider" title="Dãn dây"><i aria-hidden="true">↔</i><input id="bspread" type="range" min="0.6" max="2.8" step="0.1" value="${B.spread}" aria-label="Dãn dây"><output id="bspreadv">×${B.spread}</output></label></span>`
          + `<span class="bbtools" hidden>` + tb("bbstyle", "🔀", "Đi dây", "Đổi kiểu dây: vuông góc / tách / cong / vát 45°") + `<label class="bslider" title="Dãn dây"><i aria-hidden="true">↔</i><input id="bbspread" type="range" min="0.6" max="2.8" step="0.1" value="${B.spread}" aria-label="Dãn dây"><output id="bbspreadv">×${B.spread}</output></label>`
          + `<label class="bslider bop" title="Độ rõ linh kiện"><i aria-hidden="true">◐</i><input id="bbop" type="range" min="0.1" max="1" step="0.05" value="${B.bb.op ?? .5}" aria-label="Độ rõ linh kiện"><output id="bbopv">${Math.round((B.bb.op ?? .5) * 100)}%</output></label></span>`
          + `<span class="bsep"></span>` + tb("breset", "⟲", "Reset", "Xoá hết linh kiện và dây, còn 1 breadboard") + tb("bpng", "⬇", "PNG", "Xuất ảnh PNG theo cài đặt")
          + `<button type="button" class="bbtn" id="bsetBtn" aria-expanded="false" title="Cài đặt xuất ảnh"><i aria-hidden="true">⚙</i><span>Cài đặt</span></button>`;
        bar.insertBefore(tools, zoomBox);
        bar.appendChild(settingsPanel());
        $("#barr").onclick = () => arrangeModules();
        $("#brot").onclick = () => rotateBoard();
        $("#bstyle").onclick = () => cycleStyle();
        $("#bspread").oninput = e => setSpread(+e.target.value);
        $("#bpng").onclick = () => exportAs("png");
        $("#breset").onclick = () => resetView();
        $("#bmwire").onclick = () => { if (B.bb.on) { B.bb.on = false; B.cam = null; save(); refresh(); } };
        $("#bbtog").onclick = () => toggleBB();
        $("#bbspread").oninput = e => setSpread(+e.target.value);
        $("#bbstyle").onclick = () => { cycleStyle(); A.toast("Dây: " + STYLE_NAMES[B.style]); };
        $("#bbop").oninput = e => { B.bb.op = +e.target.value; $("#bbopv").textContent = Math.round(B.bb.op * 100) + "%"; svg().querySelectorAll(".bbmod > g[opacity], .bbmcu[opacity]").forEach(g => g.setAttribute("opacity", B.bb.op)); const w = svg().querySelector("#wires"); if (w) w.setAttribute("opacity", Math.max(.25, B.bb.op)); };
        $("#bbop").onchange = () => save();
        $("#bsetBtn").onclick = () => toggleSet();
      }
    }
    if (!$("#btitle")) { const t = document.createElement("div"); t.id = "btitle"; t.className = "btitle"; $("#bboard").after(t); }
    if (!$("#bname")) { const nm = document.createElement("div"); nm.id = "bname"; nm.className = "bname"; s.after(nm); }
    if (!$("#buyBtnW")) { const bb = document.createElement("a"); bb.id = "buyBtnW"; bb.className = "buy-btn"; bb.hidden = true; bb.target = "_blank"; bb.rel = "noopener sponsored nofollow"; s.after(bb); A.redrawBuy(); }   // nút Mua tại đây, góc phải dưới
    if (!$("#bwinfo")) { const wi = document.createElement("div"); wi.id = "bwinfo"; wi.className = "bwinfo"; wi.hidden = true; s.after(wi); }
    // chuột phải: menu Xoá / Tự nối chân
    s.addEventListener("contextmenu", e => {
      const node = e.target.closest(".bnode"), w = e.target.closest("[data-wm]"), mcu = B.bb.on && e.target.closest(".bbmcu");
      e.preventDefault();
      if (mcu) {
        const k = +mcu.dataset.h; B.selX = { t: "board", k }; B.selM = B.selW = null; B.bb.cur = k; draw();
        ctxMenu(e, k ? [["🗑 Xoá board " + hostBoard(k).name, () => removeExtra(k), "Del"]] : [["★ Board chính – đổi trong danh sách Dev board", () => { }]]);
      } else if (node) {
        const i = +node.dataset.m; B.selM = i; B.selW = null; draw();
        const mv = B.bb.on ? hosts().filter(h => h !== hostOf(B.mods[i])).map(h => ["🔁 Cắm vào " + hostBoard(h).name, () => { const m = B.mods[i]; unwireMod(i, true); m.host = h; autoAssign(m); cleanBus(); save(); refresh(); }]) : [];
        ctxMenu(e, [...mv, ...(mv.length ? ["-"] : []), ["⟳ Xoay 90°", () => rotateMod(i), "R"], ["✨ Tự nối chân", () => autoMod(i)], "-", ["🔌 Xoá nối dây linh kiện", () => unwireMod(i)], ["🗑 Xoá linh kiện", () => removeMod(i), "Del"], ...WIRE_ITEMS()]);
      } else if (w) {
        const i = +w.dataset.wm, l = w.dataset.wl; selectWire(i, l);
        ctxMenu(e, [["✨ Tự nối lại chân này", () => rewire(i, l)], ["✨ Tự nối chân linh kiện", () => autoMod(i)], "-", ["🔌 Xoá nối dây", () => removeWire(i, l), "Del"], ["🔌 Xoá nối dây linh kiện", () => unwireMod(i)], ...WIRE_ITEMS()]);
      } else if (B.bb.on && window.BBOARD) {
        const bi = BBOARD.bbAt(toSvg(e));
        ctxMenu(e, [["＋ Thêm breadboard", () => { if (B.bb.n >= 3) return A.toast("Tối đa 3 breadboard."); B.bb.n++; B.cam = null; save(); refresh(); }], ...(B.bb.n > 1 ? [["－ Xoá breadboard này", () => { B.bb.sel = bi; BBOARD.removeBB(); save(); refresh(); }]] : []), ...WIRE_ITEMS().filter(x => x === "-" || !/kiểu đi dây/.test(x[0])), "-", ["⬇ Xuất ảnh PNG", () => exportAs("png")]]);
      } else ctxMenu(e, [["🧲 Sắp xếp linh kiện", arrangeModules], ["⟳ Xoay board 90°", rotateBoard], ...(B.mods.length ? ["-", ["✨ Tự nối tất cả chân", () => { B.mods.forEach(autoAssign); save(); refresh(); }], ["🔌 Xoá hết nối dây", () => { B.mods.forEach((m, j) => unwireMod(j, true)); save(); refresh(); A.toast("Đã xoá hết nối dây"); }]] : []), ...WIRE_ITEMS(), "-", ["⬇ Xuất ảnh PNG", () => exportAs("png")]]);
    });
    document.addEventListener("pointerdown", e => { if (!e.target.closest(".bmenu")) closeMenu(); if (!e.target.closest(".bset, #bsetBtn")) toggleSet(false); }, true);
    addEventListener("keydown", e => {
      if (e.key === "Escape") { closeMenu(); toggleSet(false); }
      if (A.state.tab === "build" && (e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && B.selM != null && !(e.target.closest && e.target.closest("input, textarea, select, [contenteditable]"))) { e.preventDefault(); rotateMod(B.selM); return; }
      if (A.state.tab !== "build" || !["Delete", "Backspace"].includes(e.key) || e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (B.selW || B.selM != null || (B.bb.on && B.selX)) { e.preventDefault(); deleteSel(); }
    });
    // kéo nền = di chuyển khung nhìn; cuộn = zoom; chạm pad khi đang chọn socket = nối
    s.addEventListener("pointerdown", e => {
      if (e.target.closest(".bnode") || e.button === 2) return;
      if (B.selM != null || B.selW) { B.selM = B.selW = null; draw(); }
      const pt = toSvg(e), pad = nearestPad(pt);
      if (B.arm && pad) { connect(B.mods[B.arm.m], B.arm.label, pad); B.arm = null; return refresh(); }
      const c0 = { ...B.cam }, x0 = e.clientX, y0 = e.clientY, r = s.getBoundingClientRect(), k = c0.w / r.width;
      const mv = ev => { B.cam.x = c0.x - (ev.clientX - x0) * k; B.cam.y = c0.y - (ev.clientY - y0) * k; s.setAttribute("viewBox", `${B.cam.x} ${B.cam.y} ${B.cam.w} ${B.cam.h}`); };
      const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); };
      s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
    });
    s.addEventListener("pointermove", e => { if (B.bb.on && window.BBOARD && e.buttons === 0) BBOARD.hover(toSvg(e)); });
    s.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1 / 1.15 : 1.15, toSvg(e)); }, { passive: false });
    $("#bzin").onclick = () => zoom(1 / 1.3); $("#bzout").onclick = () => zoom(1.3); $("#bfit").onclick = () => { B.cam = null; draw(); };
  }
  // breadboard: tải js/breadboard.js lần đầu bật
  function syncBB() {
    const on = !!(B.bb.on && window.BBOARD && BBOARD.ok()), t = $("#bbtog"), w = $("#bmwire");
    if (t) { t.setAttribute("aria-pressed", on); t.querySelector("span").textContent = on ? `Breadboard ×${B.bb.n}` : "Breadboard"; } if (w) w.setAttribute("aria-pressed", !on);
    const wt = document.querySelector(".bwtools"), bt = document.querySelector(".bbtools"); if (wt) wt.hidden = on; if (bt) bt.hidden = !on;
    const op = $("#bbop"); if (op) { op.value = B.bb.op ?? .5; $("#bbopv").textContent = Math.round((B.bb.op ?? .5) * 100) + "%"; }
  }
  // Reset: board chính về nguyên trạng, linh kiện xếp lại, khung nhìn vừa màn hình (giữ nguyên các mối nối)
  // Reset: xoá hết linh kiện và dây, board chính về chỗ cũ, breadboard còn 1 tấm
  function resetView() {
    if (B.mods.length && !confirm("Xoá hết linh kiện và dây nối, chỉ giữ board chính và 1 breadboard?")) return;
    B.mods = []; B.buses = [{}]; B.brot = 0; B.arrLast = null; B.arm = null;
    if (window.BBOARD) BBOARD.resetAll(); else B.bb = { ...B.bb, n: 1, board: null };
    B.cam = null; B.selM = B.selW = null; save(); refresh(); A.toast("Đã reset");
  }
  async function toggleBB() {
    if (!window.BBOARD) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "js/breadboard.js?v=118"; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    if (!BBOARD.ok()) { A.toast("Board này không cắm breadboard được."); return; }
    if (B.bb.on) B.bb.n = B.bb.n % 3 + 1; else { B.bb.on = true; B.bb.n = 1; }   // vào tab breadboard luôn bắt đầu 1 tấm     // đang bật: bấm lần nữa xoay vòng 1 → 2 → 3 tấm
    B.cam = null; B.selM = B.selW = null; save(); refresh();
  }
  window.BUILD_API = { B, M, A, el, COLOR, esc, svg, toSvg, save, refresh, draw: () => draw(), hostBoard, hostOf, hosts, getPin, autoAssign, unwireMod, selectWire, closeMenu };
  function zoom(f, c) { const k = B.cam; c = c || { x: k.x + k.w / 2, y: k.y + k.h / 2 }; k.x = c.x - (c.x - k.x) * f; k.y = c.y - (c.y - k.y) * f; k.w *= f; k.h *= f; svg().setAttribute("viewBox", `${k.x} ${k.y} ${k.w} ${k.h}`); }

  /* ---------- Thanh bên ---------- */
  // icon board tí hon: thân PCB + 2 hàng chân, màu theo dòng chip
  const BD_COL = { ESP32: "#24272b", RP2: "#2e7d4f", AVR: "#1c6fa8" };
  const bdIcon = x => `<svg class="bdico" viewBox="0 0 30 26" aria-hidden="true"><rect x="3" y="4" width="24" height="18" rx="2" fill="${BD_COL[x.family] || "#3a3d36"}" stroke="#0006"/>${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${6 + i * 3.6}" cy="7" r="1" fill="#d9b64a"/><circle cx="${6 + i * 3.6}" cy="19" r="1" fill="#d9b64a"/>`).join("")}<rect x="11" y="10" width="8" height="6" rx="1" fill="#111" stroke="#666" stroke-width=".5"/></svg>`;
  function boardItems(b, q) {
    const extra = (B.bb.extra || []).map(x => x.id);
    const L = window.BOARDS.filter(x => !x.mod && (!q || x.name.toLowerCase().includes(q) || x.family.toLowerCase().includes(q) || "board dev".includes(q)));
    if (!L.length) return "";
    const items = L.map(x => {
      const main = x.id === b.id, ex = extra.includes(x.id), canBB = ["ESP32", "RP2"].includes(x.family), ok = B.bb.on ? canBB || main : supported(x);
      const mark = main ? "★" : ex ? "✓" : B.bb.on ? "+" : "⇄", tip = main ? "Board chính" : B.bb.on ? (ex ? "Bỏ board này khỏi mạch" : "Cắm thêm board vào cùng mạch") : "Đổi board chính";
      return `<button class="mitem bdi${main || ex ? " on" : ""}" data-bd="${x.id}"${ok ? "" : " disabled"} title="${tip}" style="--mc:#f5d63d"><span>${mark}</span>${bdIcon(x)}<span class="mn">${esc(x.name.replace(/^Raspberry Pi /, "RPi "))}</span><span class="mi">${esc(x.family === "Raspberry Pi" ? "RPi" : x.family)}</span></button>`;
    }).join("");
    return `<div class="mcat"><div class="mcat-h"><span aria-hidden="true">🧠</span> Dev board ${B.bb.on ? "· ★ chính, + cắm thêm" : "· ⇄ đổi board chính"}</div><div class="mlist">${items}</div></div>`;
  }
  // bỏ board phụ thứ k: linh kiện của nó chuyển về board chính
  function removeExtra(k) {
    if (!k) return A.toast("Không xoá được board chính – đổi board chính trong danh sách Dev board.");
    const name = hostBoard(k).name;
    B.mods.forEach((m, i) => { if (hostOf(m) === k) { unwireMod(i, true); m.host = 0; m.fresh = true; delete m.bb; } else if (hostOf(m) > k) m.host--; });
    B.bb.extra.splice(k - 1, 1); B.buses.splice(k, 1); B.bb.cur = 0; B.selX = null; cleanBus(); save(); refresh(); A.toast("Đã bỏ " + name);
  }
  function boardClick(id) {
    const b = A.state.b;
    if (!B.bb.on) { if (id === b.id) return; A.selectBoard(id); window.BUILD.open(); return; }
    if (id === b.id) return A.toast("Đây là board chính.");
    B.bb.extra = B.bb.extra || [];
    const k = B.bb.extra.findIndex(x => x.id === id) + 1;
    if (k) return removeExtra(k);
    else { if (B.bb.extra.length >= 2) return A.toast("Tối đa 3 board trong một mạch."); B.bb.extra.push({ id }); B.buses.push({}); B.bb.cur = B.bb.extra.length; }
    save(); refresh();
  }
  function renderCatList(b) {
    const q = (B.q || "").trim().toLowerCase();
    return CATS.map(([catName, icon, keys]) => {
      const filtered = keys.filter(k => {
        const d = M[k]; if (!d) return false;
        if (!q) return true;
        return d.name.toLowerCase().includes(q) || d.short.toLowerCase().includes(q) || d.iface.toLowerCase().includes(q) || k.includes(q);
      });
      if (!filtered.length) return "";
      const items = filtered.map(k => {
        const d = M[k], on = B.mods.some(m => m.type === k), ok = modOK(d, b);
        return `<button class="mitem${on ? " on" : ""}" data-add="${k}"${ok ? "" : " disabled"} style="--mc:${d.color}"><span>${on ? "✓" : "+"}</span><img src="${esc(d.svg)}" alt="" loading="lazy"><span class="mn">${esc(d.short)}</span><span class="mi">${esc(d.iface.split(" ")[0])}</span></button>`;
      }).join("");
      return `<div class="mcat"><div class="mcat-h"><span aria-hidden="true">${icon}</span> ${esc(catName)}</div><div class="mlist">${items}</div></div>`;
    }).join("") + boardItems(b, q) || `<div class="muted small">Không tìm thấy linh kiện phù hợp.</div>`;   // Dev board để cuối danh sách
  }
  function bindAddBtns(root) {
    root.querySelectorAll("[data-bd]").forEach(x => x.onclick = () => boardClick(x.dataset.bd));
    root.querySelectorAll("[data-add]").forEach(x => x.onclick = () => {
      const k = x.dataset.add, i = B.mods.findIndex(m => m.type === k);
      if (i >= 0) B.mods.splice(i, 1); else { B.mods.push({ type: k, pins: {}, ...(B.bb.on ? { fresh: true, host: Math.min(B.bb.cur || 0, (B.bb.extra || []).length) } : {}) }); if (!B.bb.on) B.cam = null; }
      cleanBus(); B.arm = null; save(); refresh();
    });
  }
  function side() {
    const box = $("#bside"), b = board();
    $("#bboard").hidden = true;
    const bt = $("#btitle"); if (bt) bt.textContent = b.name;
    if (!supported(b)) { box.innerHTML = `<p class="wtext">Chưa hỗ trợ board này.</p>`; return; }
    const W = warnings();
    const cards = B.mods.map((m, i) => { const d = M[m.type]; return `<div class="bcard" style="--mc:${d.color}"><div class="bc-h"><b>${esc(d.name)}</b><span>${esc(d.iface)} · ${esc(d.vcc)}</span><button class="icon-btn bx" data-del="${i}" aria-label="Bỏ">✕</button></div>
      <table class="btbl">${d.pins.map(([label]) => { const n = getPin(m, label); return `<tr><th>${esc(label)}</th><td>${n ? `<b>${esc(n)}</b>` : '<span class="muted">chưa nối</span>'}</td><td>${n ? `<button class="tap" data-un="${i}" data-l="${esc(label)}" title="Gỡ dây">✕</button>` : ""}</td></tr>`; }).join("")}</table></div>`; }).join("");
    box.innerHTML = `<div class="seg btabs"><button data-tab="mods" aria-pressed="${B.tab === "mods"}">Module</button><button data-tab="code" aria-pressed="${B.tab === "code"}">Code</button></div>
      ${B.tab === "mods" ? `        <div class="mdrop">
          <button type="button" class="mdrop-btn" id="mdropBtn"><span>🧩 Linh kiện (${B.mods.length}/${Object.keys(M).length})</span><span>${B.dropOpen ? "▴" : "▾"}</span></button>
          <div class="mdrop-body" id="mdropBody"${B.dropOpen ? "" : " hidden"}>
            <label class="msearch"><span>⌕</span><input id="mq" type="search" placeholder="Tìm linh kiện, I2C, SPI..." value="${esc(B.q)}" autocomplete="off"></label>
            <div id="mcats">${renderCatList(b)}</div>
          </div>
        </div>
        <p class="muted small bhint">Chọn linh kiện hoặc dây rồi nhấn Delete, hoặc nhấp chuột phải để mở menu Xoá / Tự nối chân / Xoay. Phím R xoay linh kiện đang chọn.</p>
        <div class="blegend">${LEGEND.map(([r, t]) => `<span><i style="background:${COLOR[r]}"></i>${t}</span>`).join("")}</div>${B.mods.length ? `<button class="btn-auto" data-auto>✨ Tự nối chân</button>` : ""}
        ${W.length ? `<div class="bwarn">${W.map(([t, s]) => `<div class="w-${t}">${t === "ban" ? "⛔" : t === "warn" ? "⚠" : t === "todo" ? "○" : "ℹ"} ${esc(s)}</div>`).join("")}</div>` : ""}${cards}`
      : `<pre class="code bcode">${esc(code())}</pre><button class="btn-share" data-copy>Copy #define</button>`}
      <div class="bexp"><button data-exp="png">⬇ Ảnh PNG</button><button data-exp="json">⬇ File .json</button><button data-exp="link">🔗 Link</button><label>⬆ Mở .json<input type="file" accept=".json,application/json" hidden></label></div>`;
    const mdropBtn = box.querySelector("#mdropBtn");
    if (mdropBtn) mdropBtn.onclick = () => { B.dropOpen = !B.dropOpen; side(); };
    const mq = box.querySelector("#mq");
    if (mq) mq.oninput = e => { B.q = e.target.value; const mc = box.querySelector("#mcats"); if (mc) { mc.innerHTML = renderCatList(b); bindAddBtns(mc); } };
    bindAddBtns(box);
    box.querySelectorAll("[data-del]").forEach(x => x.onclick = () => { B.mods.splice(+x.dataset.del, 1); cleanBus(); B.arm = null; save(); refresh(); });
    box.querySelectorAll("[data-un]").forEach(x => x.onclick = () => { setPin(B.mods[+x.dataset.un], x.dataset.l, null); save(); refresh(); });
    const au = box.querySelector("[data-auto]"); if (au) au.onclick = () => { B.mods.forEach(autoAssign); save(); refresh(); };
    box.querySelectorAll("[data-tab]").forEach(x => x.onclick = () => { B.tab = x.dataset.tab; side(); });
    const cp = box.querySelector("[data-copy]"); if (cp) cp.onclick = () => navigator.clipboard.writeText(code()).then(() => A.toast("Đã copy"));
    box.querySelectorAll("[data-exp]").forEach(x => x.onclick = () => exportAs(x.dataset.exp));
    box.querySelector("input[type=file]").onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { load(JSON.parse(t)); refresh(); }); };
  }
  function cleanBus() { for (const h of hosts()) withHost(h, () => { const need = new Set(B.mods.filter(m => hostOf(m) === h).flatMap(m => M[m.type].pins.map(x => x[1]))); for (const r in B.bus) if (!need.has(r)) delete B.bus[r]; }); }
  function refresh() { draw(); side(); syncBB(); }

  /* ---------- Lưu / export ---------- */
  const dump = () => ({ board: A.state.b.id, bus: B.buses[0] || {}, buses: B.buses, mods: B.mods, spread: B.spread, style: B.style, brot: brot(), bb: B.bb });
  function load(o) {
    if (!o || o.board !== board().id) { A.toast("File này của board khác."); return; }
    B.buses = Array.isArray(o.buses) ? o.buses.map(x => x || {}) : [o.bus || {}]; B.mods = (o.mods || []).filter(m => M[m.type]);
    if (typeof o.spread === "number") B.spread = o.spread;
    if (typeof o.style === "number") B.style = o.style % 4;
    B.brot = [0, 90, 180, 270].includes(o.brot) ? o.brot : 0;
    B.bb = o.bb && typeof o.bb === "object" ? { on: !!o.bb.on, n: Math.min(3, Math.max(1, o.bb.n | 0 || 1)), board: o.bb.board || null, extra: Array.isArray(o.bb.extra) ? o.bb.extra.filter(x => window.BOARDS.some(b => b.id === x.id)) : [], cur: 0, op: typeof o.bb.op === "number" ? o.bb.op : .5, sel: 0 } : { on: false, n: 1, board: null };
    if ($("#bspread")) { $("#bspread").value = B.spread; $("#bspreadv").textContent = "×" + B.spread; }
    B.cam = null; save();
  }
  function save() { try { localStorage.setItem("build:" + board().id, JSON.stringify(dump())); } catch (e) { } }
  function restore() { CUR = 0; B.boardId = board().id; B.buses = [{}]; B.mods = []; B.arm = null; B.cam = null; B.brot = 0; B.bb = { on: false, n: 1, board: null, extra: [], cur: 0 }; try { const o = JSON.parse(localStorage.getItem("build:" + B.boardId) || "null"); if (o) load(o); } catch (e) { } }
  const dl = (name, href) => { const a = document.createElement("a"); a.href = href; a.download = name; a.click(); };
  // ảnh ngoài (ảnh board thật) không tải được trong SVG xuất ảnh: nhúng thành data URL trước khi chụp
  const IMG_CACHE = {};
  async function inlineImages(root) {
    for (const im of root.querySelectorAll("image")) {
      const h = im.getAttribute("href"); if (!h || h.startsWith("data:")) continue;
      try { IMG_CACHE[h] = IMG_CACHE[h] || await fetch(h).then(r => r.blob()).then(bl => new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(bl); })); im.setAttribute("href", IMG_CACHE[h]); } catch (e) { }
    }
  }
  async function exportAs(kind) {
    const b = board();
    if (kind === "json") return dl(`pindex-${b.id}.json`, URL.createObjectURL(new Blob([JSON.stringify(dump(), null, 1)], { type: "application/json" })));
    if (kind === "link") { const u = location.href.split("#")[0] + "#build=" + btoa(unescape(encodeURIComponent(JSON.stringify(dump())))); try { await navigator.clipboard.writeText(u); A.toast("Đã copy link Wiring"); } catch (e) { A.toast(u); } return; }
    toggleSet(false);
    let img = null, logo = null;
    if (EXP.wire) {
      const keep = { ...B.cam }; B.cam = null; draw();               // chụp toàn cảnh rồi trả lại khung nhìn cũ
      await inlineImages(svg());
      let u = A.svgDataUrl(svg());
      u ="data:image/svg+xml;charset=utf-8," + encodeURIComponent(decodeURIComponent(u.split(",").slice(1).join(",")).replace(/(<svg[^>]*?)\sstyle="background:[^"]*"/, "$1"));   // bỏ nền tối để vùng đấu dây cùng màu nền ảnh
      img = new Image(); img.src = u; await img.decode(); B.cam = keep; draw();
    }
    if (EXP.logo) { logo = new Image(); logo.src = "icon.svg"; try { await logo.decode(); } catch (e) { logo = null; } }
    // nền chung cho cả ảnh lẫn vùng đấu dây: Nguyên bản = màu canvas app, Trắng, hoặc trong suốt
    const orig = EXP.bg === "orig", bg = orig ? getComputedStyle(svg()).backgroundColor : EXP.bg === "white" ? "#fff" : null;
    const ink = orig ? getComputedStyle(document.body).color : "#1d232a", muted = orig ? "#8a93a0" : "#5b6570";
    const k = EXP.scale, rs = Math.min(k * 2, 6);
    // mỗi phần là một khối riêng (kèm tiêu đề) vẽ sẵn ở độ phân giải cao, rồi xếp vào khung ảnh
    const leaf = (title, w, h, fn) => {
      const T = title ? 34 : 0, c = document.createElement("canvas"); c.width = Math.ceil(w * rs); c.height = Math.ceil((h + T) * rs);
      const g = c.getContext("2d"); g.scale(rs, rs);
      if (title) { g.fillStyle = ink; g.font = "bold 18px sans-serif"; g.textBaseline = "alphabetic"; g.fillText(title, 0, 20); }
      g.translate(0, T); fn(g);
      return { w, h: h + T, draw: (G, x, y, s) => G.drawImage(c, x, y, w * s, (h + T) * s) };
    };
    const group = (list, row, gap = 32) => list.length === 1 ? list[0] : {
      w: row ? list.reduce((a, x) => a + x.w, 0) + gap * (list.length - 1) : Math.max(...list.map(x => x.w)),
      h: row ? Math.max(...list.map(x => x.h)) : list.reduce((a, x) => a + x.h, 0) + gap * (list.length - 1),
      draw(G, x, y, s) { for (const it of list) { it.draw(G, x, y, s); if (row) x += (it.w + gap) * s; else y += (it.h + gap) * s; } }
    };
    const others = [];
    if (EXP.sch && B.mods.length) { const L = schemLayout(); others.push(leaf("Sơ đồ nguyên lý", L.w, L.h, g => L.draw(g, ink, muted))); }
    if (EXP.code) {
      // khối code hẹp lại: dòng dài (comment hay code) tự xuống hàng, dòng nối thụt vào
      const wrap = (l, W = 40) => { if (l.length <= W) return [l]; const cm = l.trim().startsWith("//"), out = []; let r = l;
        while (r.length > W) { let k = r.lastIndexOf(" ", W); if (k < W * .5) k = W; out.push(r.slice(0, k)); r = (cm ? "//   " : "    ") + r.slice(k).trimStart(); }
        return [...out, r]; };
      const lines = code().split("\n").flatMap(l => wrap(l)), lh = 20, mg = document.createElement("canvas").getContext("2d"); mg.font = "14px Consolas, monospace";
      others.push(leaf("Code #define", Math.max(200, ...lines.map(l => mg.measureText(l).width)) + 4, lines.length * lh, g => {
        g.font = "14px Consolas, monospace"; g.textBaseline = "middle"; lines.forEach((l, i) => { g.fillStyle = l.trim().startsWith("//") ? muted : ink; g.fillText(l, 0, i * lh + lh / 2); });
      }));
    }
    let wire = null;
    if (img) {   // cắt bỏ lề trống quanh sơ đồ đấu dây (theo điểm ảnh không trong suốt)
      const TW = 2400, th = Math.round(img.height * TW / img.width), t = document.createElement("canvas"); t.width = TW; t.height = th;
      const tg = t.getContext("2d"); tg.drawImage(img, 0, 0, TW, th);
      const a = tg.getImageData(0, 0, TW, th).data; let x0 = TW, y0 = th, x1 = 0, y1 = 0;
      for (let y = 0; y < th; y += 2) for (let x = 0; x < TW; x += 2) if (a[(y * TW + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 > x0) {
        const m = 16, cx = Math.max(0, x0 - m), cy = Math.max(0, y0 - m), cw = Math.min(TW, x1 + m) - cx, ch = Math.min(th, y1 + m) - cy, ww = 1100, wh = ch * ww / cw;
        wire = leaf("", ww, wh, g => g.drawImage(t, cx, cy, cw, ch, 0, 0, ww, wh));
      }
    }
    // thử mọi cách xếp (ngang/dọc ở cả hai tầng), chọn cách cho nội dung to nhất trong khung
    const cands = [];
    for (const gr of [true, false]) {
      const og = others.length ? group(others, gr) : null;
      for (const tr of [true, false]) cands.push(wire && og ? group([wire, og], tr, 40) : wire || og);
      if (!wire) break;
    }
    const [RW, RH] = RATIOS[EXP.ratio], P = 40, HEAD = 70, FOOT = logo ? 76 : 28;
    let W = RW, H = RH, best = cands[0], s = 1;
    if (best) {
      if (!RH) {   // Tự do: rộng cố định, cao theo nội dung; ưu tiên cách xếp ít bị thu nhỏ rồi thấp nhất
        const sc = c => Math.min(1.2, (W - 2 * P) / c.w);
        best = cands.reduce((a, c) => sc(c) > sc(a) + .05 || (Math.abs(sc(c) - sc(a)) <= .05 && c.h * sc(c) < a.h * sc(a)) ? c : a);
        s = sc(best); H = Math.ceil(HEAD + best.h * s + FOOT);
      } else {
        const sc = c => Math.min(2, (W - 2 * P) / c.w, (H - HEAD - FOOT) / c.h);
        best = cands.reduce((a, c) => sc(c) > sc(a) ? c : a); s = sc(best);
      }
    } else if (!H) H = HEAD + FOOT + 40;
    const c = document.createElement("canvas"); c.width = W * k; c.height = H * k;
    const g = c.getContext("2d"); g.scale(k, k);
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    g.fillStyle = ink; g.font = "bold 26px sans-serif"; g.textBaseline = "alphabetic"; g.fillText(`${b.name} · Pindex Wiring`, P, 46);
    if (best) best.draw(g, (W - best.w * s) / 2, HEAD + (H - HEAD - FOOT - best.h * s) / 2, s);
    if (logo) {   // logo pindexio to rõ góc phải dưới
      const z = 40; g.font = "bold 28px sans-serif"; g.textAlign = "right"; g.textBaseline = "middle";
      const tw = g.measureText("pindexio.com").width, ly = H - 20 - z / 2;
      g.fillStyle = ink; g.fillText("pindexio.com", W - P, ly); g.drawImage(logo, W - P - tw - 12 - z, ly - z / 2, z, z);
    }
    dl(`pindex-${b.id}.png`, c.toDataURL("image/png"));
  }
  function importHash(h) { try { load(JSON.parse(decodeURIComponent(escape(atob(h))))); } catch (e) { A.toast("Link Wiring không hợp lệ."); } }

  let inited = false;
  window.BUILD = {
    open(h) {
      if (!inited) { initCanvas(); inited = true; }
      if (B.boardId !== board().id) restore();
      if (h) importHash(h);
      refresh();
      if (B.bb.on && !window.BBOARD) { B.bb.on = false; toggleBB(); }
      syncBB();
    }
  };
})();
