/* Tab BUILD: khu vẽ riêng kiểu node (Blender). Module là node kéo được; kéo dây từ socket của chân module,
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
  const B = { boardId: null, bus: {}, mods: [], tab: "mods", cam: null, arm: null, spread: 1.1, style: 0, arrMode: 0, dropOpen: true, q: "" };
  const CATS = [
    ["Màn hình & Hiển thị", ["ssd1306", "st7789", "sevseg", "ws2812"]],
    ["Cảm biến", ["hcsr04", "vl53l0x", "mpu6050", "dht22", "ldr"]],
    ["Âm thanh & Còi", ["buzzer", "max98357a", "inmp441"]],
    ["Điều khiển & Cơ bản", ["button", "led"]]
  ];
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
  const used = () => new Set([...Object.values(B.bus), ...B.mods.flatMap(m => Object.entries(m.pins).filter(([l]) => { const r = roleOf(m, l); return r && !POWER.includes(r); }).map(x => x[1]))].filter(Boolean));
  const roleOf = (m, label) => (M[m.type].pins.find(x => x[0] === label) || [])[1];
  const getPin = (m, label) => { const r = roleOf(m, label); return SHARED.includes(r) ? B.bus[r] : m.pins[label]; };
  function setPin(m, label, name) { const r = roleOf(m, label); if (SHARED.includes(r)) { if (name) B.bus[r] = name; else delete B.bus[r]; } else if (name) m.pins[label] = name; else delete m.pins[label]; }
  function best(role, b, taken) { let top = null, ts = -1e8; for (const p of A.pins) { if (taken.has(p.name) && !POWER.includes(role)) continue; const s = score(p, role, b); if (s > ts) { ts = s; top = p; } } return top; }
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
  function sockPos(m, k) {
    const d = M[m.type], pin = d.pins[k];
    if (d.svg && pin[3] != null) {
      const [vx, vy, vw, vh] = d.vb.length === 4 ? d.vb : [0, 0, d.vb[0], d.vb[1]];
      return { x: m.pos.x + (pin[3] - vx) / vw * d.w, y: m.pos.y + (pin[4] - vy) / vh * d.h, dir: pin[5] || d.pinDir || "T", k, m };
    }
    return { x: m.pos.x, y: m.pos.y + HH + k * RH + RH / 2, dir: "L", k, m };
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
  const sideOf = p => (board().headers.find(h => h.pins.includes(p)) || {}).side || "R";
  const boardBounds = b => {
    let y0 = 0, y1 = b.h;
    for (const pt of b.parts || []) { if (pt.y != null) { y0 = Math.min(y0, pt.y); y1 = Math.max(y1, pt.y + (pt.h || 0)); } }
    return { y0, y1 };
  };
  const modSideOf = m => (m.pos.x + modW(M[m.type]) / 2 < board().w / 2) ? "L" : "R";

  // 3 phương án tự động sắp xếp linh kiện quanh main board (nhấn Sắp xếp tự nhảy ngay không ghi chú)
  function arrangeModules() {
    if (!B.mods.length) return;
    B.mods.forEach(autoAssign);
    const b = board(), mode = B.arrMode % 3;
    B.arrMode = (B.arrMode + 1) % 3;
    const L = [], R = [];
    for (const [idx, m] of B.mods.entries()) {
      const d = M[m.type];
      let left = 0, right = 0, sigL = 0, sigR = 0, sumY = 0, cnt = 0;
      for (const [label, role] of d.pins) {
        const p = pinByName(getPin(m, label) || "");
        if (!p) continue;
        const sd = sideOf(p), isL = sd === "L" || (sd !== "R" && p.x < b.w / 2);
        if (isL) { left++; if (!POWER.includes(role)) sigL++; }
        else { right++; if (!POWER.includes(role)) sigR++; }
        sumY += p.y; cnt++;
      }
      const avgY = cnt ? sumY / cnt : b.h / 2;
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
    const bx1 = boardBox ? Math.max(b.w, boardBox.x + boardBox.w) : b.w + 6;
    const placeCol = (col, isLeft) => {
      if (!col.length) return;
      const vGap = Math.max(9, (mode === 1 ? 10 : 7.5) * B.spread);
      const totalH = col.reduce((s, x) => s + modH(x.d), 0) + (col.length - 1) * vGap;
      let y = b.h / 2 - totalH / 2;
      const mid = (col.length - 1) / 2;
      col.forEach(({ m, d }, i) => {
        const w = modW(d), h = modH(d);
        // Mode 1: cong vòng cung quanh board; Mode 2: so le bậc thang
        const archOff = mode === 1 ? Math.abs(i - mid) * 7 : mode === 2 ? (i % 2) * 8 : 0;
        const x = isLeft ? (bx0 - corridor - w + archOff) : (bx1 + corridor - archOff);
        m.pos = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
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
    const b = board(), { y0, y1 } = boardBounds(b), sp = B.spread;
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
                 : a.dir === "B" ? m.pos.y + modH(d) + (2.1 * sp + pinOrder * pinStep) : a.y;
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
      const { a, p, ay, mSide, pSide } = w, start = (a.dir === "T" || a.dir === "B") ? [[a.x, a.y], [a.x, ay]] : [[a.x, a.y]];
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
    const s = svg(); s.innerHTML = "";
    A.drawPCB(s, true);                                   // board không nhãn lớn, chỉ pad + tên nhỏ
    const vb = s.viewBox.baseVal; boardBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    let ny = boardBox.y + 4;                               // vị trí mặc định cho node mới: cột bên phải board
    for (const m of B.mods) { const d = M[m.type]; if (!m.pos) m.pos = { x: boardBox.x + boardBox.w + 26, y: ny }; ny = Math.max(ny, m.pos.y) + modH(d) + (d.svg ? 12 : 4); }
    const glow = el("g", { id: "glow" }, s), wires = el("g", { id: "wires" }, s), nodes = el("g", {}, s);
    const { map: routeMap, count: lane } = computeRoutes();
    for (const [mi, m] of B.mods.entries()) {
      const d = M[m.type], w = modW(d), h = modH(d);
      d.pins.forEach(([label, role]) => { const p = pinByName(getPin(m, label) || ""); if (!p) return;
        const c = COLOR[role] || d.color, info = routeMap[`${mi}:${label}`]; if (!info) return;
        const { pts, w: wObj } = info;
        if (B.style === 2) {
          const bp = blenderPath(wObj);
          el("path", { d: bp.d, stroke: c, class: "bwire" }, wires);
          el("text", { x: bp.mx, y: bp.my - .55, "text-anchor": "middle", "font-size": 1.1, class: "wlabel", fill: c }, wires, label);
        } else {
          const pd = pathOf(pts);
          el("path", { d: pd, stroke: c, class: "bwire" }, wires);
          let li = 1, ll = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (l > ll && i < pts.length - 1) { ll = l; li = i; } }
          const [x0, y0] = pts[li - 1], [x1, y1] = pts[li], vert = Math.abs(x0 - x1) < .01, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          if (ll > 6) el("text", { x: mx, y: my - (vert ? 0 : .55), "text-anchor": "middle", "font-size": 1.1, class: "wlabel", fill: c, transform: vert ? `rotate(-90 ${mx} ${my}) translate(0 -.55)` : "" }, wires, label);
          const hit = el("path", { d: pd, class: "whit" }, wires);
          hit.addEventListener("pointerdown", e => dragSeg(e, mi, label, pts));
        }
        const end = el("circle", { cx: p.x, cy: p.y, r: 1.25, fill: c, "fill-opacity": .35, stroke: c, "stroke-width": .5, class: "wend" }, wires);
        end.addEventListener("pointerdown", e => startWire(e, mi, label, true)); });
      const g = el("g", { class: "bnode", "data-m": mi }, nodes);
      const head = el("g", { class: "bhead", "data-m": mi }, g);
      if (d.svg) {
        // Vẽ trực tiếp ảnh SVG của module, nối dây thẳng vào chân trên SVG
        el("image", { href: d.svgData || d.svg, x: m.pos.x, y: m.pos.y, width: w, height: h, preserveAspectRatio: "none" }, head);
        d.pins.forEach(([label, role], k) => {
          const a = sockPos(m, k), n = getPin(m, label), armed = B.arm && B.arm.m === mi && B.arm.label === label;
          const rc = COLOR[role] || d.color;
          const so = el("circle", { cx: a.x, cy: a.y, r: .85, fill: n ? rc : "rgba(0,0,0,.35)", "fill-opacity": n ? .85 : .5, stroke: armed ? "#fff" : rc, "stroke-width": armed ? .65 : .4, class: "sock" + (armed ? " armed" : ""), "data-m": mi, "data-l": label }, g);
          el("title", {}, so, `${d.short} · ${label}${n ? " → " + n : " (kéo để nối)"}`);
          so.addEventListener("pointerdown", e => startWire(e, mi, label));
        });
      } else {
        el("rect", { x: m.pos.x, y: m.pos.y, width: NW, height: h, rx: 1, class: "modbox", stroke: d.color }, g);
        el("rect", { x: m.pos.x, y: m.pos.y, width: NW, height: HH - .4, rx: 1, fill: d.color }, head);
        el("text", { x: m.pos.x + 1.2, y: m.pos.y + HH / 2 - .2, "dominant-baseline": "central", "font-size": 1.5, class: "modt" }, head, d.short);
        el("text", { x: m.pos.x + NW - 1.2, y: m.pos.y + HH / 2 - .2, "text-anchor": "end", "dominant-baseline": "central", "font-size": 1.1, class: "modt" }, head, d.vcc);
        d.pins.forEach(([label], k) => {
          const a = sockPos(m, k), n = getPin(m, label), armed = B.arm && B.arm.m === mi && B.arm.label === label;
          el("text", { x: a.x + 2, y: a.y, "dominant-baseline": "central", "font-size": 1.25, class: "mptxt" }, g, label);
          el("text", { x: a.x + NW - 1, y: a.y, "text-anchor": "end", "dominant-baseline": "central", "font-size": 1.1, class: "mpval" }, g, n || "kéo ●");
          const rc = COLOR[d.pins[k][1]] || d.color;
          const so = el("circle", { cx: a.x, cy: a.y, r: .95, fill: n ? rc : "var(--surface)", stroke: rc, "stroke-width": .45, class: "sock" + (armed ? " armed" : ""), "data-m": mi, "data-l": label }, g);
          so.addEventListener("pointerdown", e => startWire(e, mi, label));
        });
      }
      head.addEventListener("pointerdown", e => startNode(e, mi));
    }
    if (B.arm) showGlow(B.mods[B.arm.m], B.arm.label);
    // khung nhìn: board + toàn bộ node cả bên Trái lẫn bên Phải, có thể pan/zoom
    const minX = B.mods.map(m => m.pos.x - 8), maxX = B.mods.map(m => m.pos.x + modW(M[m.type]) + 8);
    const minY = B.mods.map(m => m.pos.y - 10), maxY = B.mods.map(m => m.pos.y + modH(M[m.type]) + 10);
    const pad = 4 + lane * 1.2 * B.spread;
    const world = { x: Math.min(boardBox.x - pad, ...minX), y: Math.min(boardBox.y - pad, ...minY), w: 0, h: 0 };
    world.w = Math.max(boardBox.x + boardBox.w + (B.mods.length ? pad : 50), ...maxX) - world.x;
    world.h = Math.max(boardBox.y + boardBox.h + pad, ...maxY) - world.y;
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
    setPin(m, label, p.name); if (m.route) delete m.route[label]; save(); return true;
  }
  function startWire(e, mi, label, fromEnd) {
    e.stopPropagation(); e.preventDefault();
    const m = B.mods[mi], k = M[m.type].pins.findIndex(x => x[0] === label), a = sockPos(m, k), s = svg();
    showGlow(m, label);
    if (fromEnd) $("#wires").querySelectorAll("path,circle").forEach(x => x.style.opacity = .25);   // làm mờ dây khác khi đang nắm đầu dây
    const tmp = el("path", { d: "", stroke: COLOR[M[m.type].pins[k][1]] || M[m.type].color, class: "bwire tmp" }, $("#wires"));
    let moved = false;
    const mv = ev => { moved = true; const pt = toSvg(ev), near = nearestPad(pt); tmp.setAttribute("d", wirePath(a, near ? { x: near.x, y: near.y } : pt)); };
    const up = ev => {
      s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up);
      if (!moved) { B.arm = B.arm && B.arm.m === mi && B.arm.label === label ? null : { m: mi, label }; return refresh(); }   // chạm (không kéo) = chọn rồi chạm pad
      const p = nearestPad(toSvg(ev));
      if (p) connect(m, label, p); else if (getPin(m, label)) { setPin(m, label, null); if (m.route) delete m.route[label]; save(); A.toast("Đã gỡ dây " + label); }
      B.arm = null; refresh();
    };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }
  function dragSeg(e, mi, label, pts) {
    e.stopPropagation(); e.preventDefault();
    const m = B.mods[mi], b = board(), s = svg(), pt = toSvg(e);
    let seg = -1, bd = 1e9;                                   // đoạn gần con trỏ nhất (bỏ đoạn đầu & cuối vì gắn vào socket/pad)
    for (let i = 2; i < pts.length - 1; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const d = Math.abs(x0 - x1) < .01 ? Math.abs(pt.x - x0) + Math.max(0, Math.min(y0, y1) - pt.y, pt.y - Math.max(y0, y1)) : Math.abs(pt.y - y0) + Math.max(0, Math.min(x0, x1) - pt.x, pt.x - Math.max(x0, x1));
      if (d < bd) { bd = d; seg = i; } }
    if (seg < 0) return;
    const [x0, y0] = pts[seg - 1], [x1] = pts[seg], vert = Math.abs(x0 - x1) < .01;
    const key = vert ? (x0 > b.w / 2 ? "rx" : "lx") : "yv", top = y0 < b.h / 2;
    const clamp = v => key === "rx" ? Math.min(Math.max(v, b.w + 1), 220) : key === "lx" ? Math.min(Math.max(v, -220), -1) : top ? Math.min(Math.max(v, -90), -1) : Math.max(Math.min(v, b.h + 90), b.h + 1);
    m.route = m.route || {}; m.route[label] = { ...(m.route[label] || {}) };
    const mv = ev => { const q = toSvg(ev); m.route[label][key] = clamp(vert ? q.x : q.y); draw(); };
    const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); save(); };
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
    const bar = document.querySelector(".bbar"), zoomBox = bar && bar.querySelector(".zoom");
    if (bar) {
      bar.querySelectorAll("span.muted").forEach(n => n.remove());
      if (!$("#btools")) {
        const tools = document.createElement("div");
        tools.id = "btools"; tools.className = "btools";
        tools.innerHTML = `<button type="button" class="bbtn" id="barr">🧲 Sắp xếp</button>`
          + `<button type="button" class="bbtn" id="bstyle">🔀 Đi dây</button>`
          + `<label class="bslider"><span>↔ Dãn dây</span><input id="bspread" type="range" min="0.6" max="2.8" step="0.1" value="${B.spread}"></label>`;
        bar.insertBefore(tools, zoomBox);
        $("#barr").onclick = () => arrangeModules();
        $("#bstyle").onclick = () => {
          B.style = (B.style + 1) % 4;
          for (const m of B.mods) delete m.route;
          save(); draw();
        };
        $("#bspread").oninput = e => { B.spread = +e.target.value; draw(); };
        $("#bspread").onchange = () => save();
      }
    }
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
  function renderCatList(b) {
    const q = (B.q || "").trim().toLowerCase();
    return CATS.map(([catName, keys]) => {
      const filtered = keys.filter(k => {
        const d = M[k]; if (!d) return false;
        if (!q) return true;
        return d.name.toLowerCase().includes(q) || d.short.toLowerCase().includes(q) || d.iface.toLowerCase().includes(q) || k.includes(q);
      });
      if (!filtered.length) return "";
      const items = filtered.map(k => {
        const d = M[k], on = B.mods.some(m => m.type === k), ok = modOK(d, b);
        return `<button class="mitem${on ? " on" : ""}" data-add="${k}"${ok ? "" : " disabled"} style="--mc:${d.color}"><span>${on ? "✓" : "+"}</span><span class="mn">${esc(d.short)}</span><span class="mi">${esc(d.iface.split(" ")[0])}</span></button>`;
      }).join("");
      return `<div class="mcat"><div class="mcat-h">${esc(catName)}</div><div class="mlist">${items}</div></div>`;
    }).join("") || `<div class="muted small">Không tìm thấy linh kiện phù hợp.</div>`;
  }
  function bindAddBtns(root) {
    root.querySelectorAll("[data-add]").forEach(x => x.onclick = () => {
      const k = x.dataset.add, i = B.mods.findIndex(m => m.type === k);
      if (i >= 0) B.mods.splice(i, 1); else B.mods.push({ type: k, pins: {} });
      cleanBus(); B.arm = null; save(); refresh();
    });
  }
  function side() {
    const box = $("#bside"), b = board();
    $("#bboard").innerHTML = BOARDS.map(x => `<option value="${x.id}"${x.id === b.id ? " selected" : ""}>${esc(x.name)}</option>`).join("");
    if (!supported(b)) { box.innerHTML = `<p class="wtext">Chưa hỗ trợ board này.</p>`; return; }
    const W = warnings();
    const cards = B.mods.map((m, i) => { const d = M[m.type]; return `<div class="bcard" style="--mc:${d.color}"><div class="bc-h"><b>${esc(d.name)}</b><span>${esc(d.iface)} · ${esc(d.vcc)}</span><button class="icon-btn bx" data-del="${i}" aria-label="Bỏ">✕</button></div>
      <table class="btbl">${d.pins.map(([label]) => { const n = getPin(m, label); return `<tr><th>${esc(label)}</th><td>${n ? `<b>${esc(n)}</b>` : '<span class="muted">chưa nối</span>'}</td><td>${n ? `<button class="tap" data-un="${i}" data-l="${esc(label)}" title="Gỡ dây">✕</button>` : ""}</td></tr>`; }).join("")}</table></div>`; }).join("");
    box.innerHTML = `<div class="seg btabs"><button data-tab="mods" aria-pressed="${B.tab === "mods"}">Module</button><button data-tab="code" aria-pressed="${B.tab === "code"}">Code</button></div>
      ${B.tab === "mods" ? `<div class="mdrop">
          <button type="button" class="mdrop-btn" id="mdropBtn"><span>🧩 Linh kiện (${B.mods.length}/${Object.keys(M).length})</span><span>${B.dropOpen ? "▴" : "▾"}</span></button>
          <div class="mdrop-body" id="mdropBody"${B.dropOpen ? "" : " hidden"}>
            <label class="msearch"><span>⌕</span><input id="mq" type="search" placeholder="Tìm linh kiện, I2C, SPI..." value="${esc(B.q)}" autocomplete="off"></label>
            <div id="mcats">${renderCatList(b)}</div>
          </div>
        </div>
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
  function cleanBus() { const need = new Set(B.mods.flatMap(m => M[m.type].pins.map(x => x[1]))); for (const r in B.bus) if (!need.has(r)) delete B.bus[r]; }
  function refresh() { draw(); side(); }

  /* ---------- Lưu / export ---------- */
  const dump = () => ({ board: board().id, bus: B.bus, mods: B.mods, spread: B.spread, style: B.style });
  function load(o) {
    if (!o || o.board !== board().id) { A.toast("File này của board khác."); return; }
    B.bus = o.bus || {}; B.mods = (o.mods || []).filter(m => M[m.type]);
    if (typeof o.spread === "number") B.spread = o.spread;
    if (typeof o.style === "number") B.style = o.style % 4;
    if ($("#bspread")) $("#bspread").value = B.spread;
    B.cam = null; save();
  }
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
