/* Pindexio PCB Lab: bo 1 lớp làm tại nhà. Chạy độc lập (pcb-lab/pcb-proto.html) hoặc nhúng trong Pindexio (js/pcblab.js).
   Đơn vị mm, lưới 2,54 mm (linh kiện) và 0,635 mm (đường đồng). Mọi thứ dựng trong phần tử #pcblab, id có tiền tố pl… */
(function () {
  "use strict";
  const ROOT = document.getElementById("pcblab"); if (!ROOT || window.PCBLAB) return;   // chỉ chạy 1 lần
  ROOT.classList.add("pcblab");
  ROOT.innerHTML = `<aside class="pl-list" id="plList"></aside><nav class="pl-bar" id="plBar"></nav>
    <section class="pl-stage" id="plStage"><svg id="plSvg" xmlns="http://www.w3.org/2000/svg"></svg><div id="plTip"></div><div id="plHint"></div><div id="plToast"></div><div id="plCtx"></div></section>
    <nav class="pl-vbar" id="plVbar"></nav><aside class="pl-side"><div id="plPanel"></div></aside>`;
  const $ = s => ROOT.querySelector(s), $$ = s => ROOT.querySelectorAll(s);
  // song ngữ: theo <html lang> (Pindexio đổi bằng nút cờ); L("tiếng Việt", "English")
  const EN = () => document.documentElement.lang === "en", L = (vi, en) => EN() ? en : vi;
  const SITE = !!window.MODULES;   // đang nhúng trong Pindexio: tên + icon linh kiện lấy từ thư viện module của site
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a = {}, p, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e; };
  const G = 2.54, Q = G / 4, CLR = 0.5, PAD_R = 1.0, DRILL_R = 0.5, EDGE = 1.0;   // pad Ø2, khoan Ø1,0 (chân header 0,64 vuông)
  // lỗ dây nhảy; dài tối thiểu 5,08 mm (2 ô): bắc qua 1 đường cần ≥ 3,6 mm, dây 0,5 mm uốn kìm thực tế ≥ 5 mm
  const JP_R = 0.8, JP_DRILL = 0.4, JP_MIN = 2 * G, JP_OVER = .3;   // JP_OVER: dây trần ở mặt trên cách chân khác mạng (ngoài mép pad)
  const W_SIG = 1.0, W_PWR = 1.5, PWR = new Set(["GND", "3V3", "5V"]);
  const snap = (v, s) => Math.round(v / s) * s;
  const r3 = v => Math.round(v * 1000) / 1000;

  /* ---------- footprint (toạ độ cục bộ, gốc = chân 1) ---------- */
  const S3L = ["3V3", "3V3", "RST", "IO4", "IO5", "IO6", "IO7", "IO15", "IO16", "IO17", "IO18", "IO8", "IO3", "IO46", "IO9", "IO10", "IO11", "IO12", "IO13", "IO14", "5V", "GND"];
  const S3R = ["GND", "TX", "RX", "IO1", "IO2", "IO42", "IO41", "IO40", "IO39", "IO38", "IO37", "IO36", "IO35", "IO0", "IO45", "IO48", "IO47", "IO21", "IO20", "IO19", "GND", "GND"];
  // chân: "TÊN/vai trò" – g GND, 3 3V3, 5 5V, d SDA (IO8), c SCL (IO9), k SCK (IO12), m MOSI (IO11), s tín hiệu (GPIO trống),
  // n không tự nối (chân trống, hoặc phải qua điện trở mới được vào GPIO)
  const pinsOf = spec => spec.split(" ").map(s => { const [name, role = "n"] = s.split("/"); return { name, role }; });
  function hdr(spec, w, h, side, label, more) {   // module 1 hàng header: T chân ở mép trên, B mép dưới, L mép trái (dọc)
    const ps = pinsOf(spec), span = (ps.length - 1) * G;
    const pads = ps.map((p, i) => side === "L" ? { ...p, x: 0, y: i * G } : { ...p, x: i * G, y: 0 });
    const body = side === "L" ? { x: -2.2, y: span / 2 - h / 2, w, h } : { x: span / 2 - w / 2, y: side === "T" ? -2.2 : -(h - 2.2), w, h };
    return { pads, body, label, ...more };
  }
  const at = (spec, xy) => pinsOf(spec).map((p, i) => ({ ...p, x: xy[i][0], y: xy[i][1] }));
  // linh kiện của Pindexio (tab Sơ đồ chân / Nối dây), kích thước theo hàng phổ biến (mm). "~" = ước lượng, nên đo bo thật
  const FP0 = {
    // DevKitC-1 62,74 dài, 2 hàng chân cách 25,4 (1"), ăng-ten vượt quá chân 1
    S3: { pads: [...S3L.map((n, i) => ({ name: n, x: 0, y: i * G })), ...S3R.map((n, i) => ({ name: n, x: 10 * G, y: i * G }))], body: { x: -1.3, y: -7.4, w: 28, h: 62.74 }, label: "ESP32-S3-DevKitC-1", inner: true },
    ssd1306: hdr("SDA/d SCL/c VCC/3 GND/g", 27.3, 27.8, "T", "OLED 0.96\""),                       // 27,3 × 27,8, thứ tự chân theo Pindexio
    st7789: hdr("GND/g VCC/3 SCL/k SDA/m RES/s DC/s BLK/s", 27.78, 39.22, "T", "ST7789 240×240"),  // 1,3": 27,78 × 39,22
    sevseg: { pads: at("E D GND/g C DP G F GND/g A B", [0, 1, 2, 3, 4, 0, 1, 2, 3, 4].map((k, i) => [k * G, i < 5 ? 0 : -6 * G])), body: { x: -1.17, y: -17.12, w: 12.5, h: 19 }, label: "8", inner: true },   // 0,56": 2 hàng cách 15,24, 2 chân COM nối trong
    ws2812: hdr("GND/g VCC/5 DIN/s", 30, 25, "T", "WS2812 RGB"),                                     // ~ module LED rất đa dạng
    tb6612fng: { pads: at("VM/5 VCC/3 GND/g A01 A02 B02 B01 GND2/g PWMA/s AIN2/s AIN1/s STBY/s BIN1/s BIN2/s PWMB/s GND3/g", [...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [0, i * G]), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [7 * G, i * G])]), body: { x: -2.54, y: -1.14, w: 20.32, h: 20.32 }, label: "TB6612", inner: true },   // SparkFun 0,8" × 0,8", 2 hàng 8 chân cách 0,7"
    servo: hdr("SIG/s VCC/5 GND/g", 3 * G, G, "L", "Servo"),   // chỉ hàng header 3 chân cắm giắc servo (thân servo ở ngoài bo)
    hcsr04: hdr("VCC/5 TRIG/s ECHO GND/g", 45, 20, "B", "HC-SR04"),                                // 45 × 20, 2 mắt Ø16. ECHO ra 5 V: không nối thẳng
    vl53l0x: hdr("VCC/3 GND/g SCL/c SDA/d GPIO1 XSHUT/s", 25, 10.7, "T", "VL53L0X"),               // ~ GY-VL53L0XV2 25 × 10,7
    mpu6050: hdr("VCC/3 GND/g SCL/c SDA/d XDA XCL AD0 INT/s", 21, 16, "T", "MPU6050"),             // GY-521 ~21 × 16, 8 chân
    dht22: hdr("VCC/3 SDA/s NC GND/g", 15.1, 25, "B", "DHT22"),                                     // thân 15,1 × 25, 4 chân (chân 3 bỏ trống)
    ldr: hdr("VCC/3 GND/g DO/s AO/s", 32, 14, "L", "LDR"),                                          // module LM393 ~32 × 14
    buzzer: { pads: at("SIG/s GND/g", [[0, 0], [7.6, 0]]), body: { x: -2.2, y: -6, w: 12, h: 12 }, label: "", round: true },   // còi Ø12, chân cách 7,6
    max98357a: hdr("LRC/s BCLK/s DIN/s GAIN SD GND/g VCC/5", 17.8, 19.3, "B", "MAX98357A"),       // breakout 7 chân ~17,8 × 19,3
    inmp441: { pads: at("SD/s VCC/3 GND/g SCK/s WS/s LR/g", [[0, 0], [G, 0], [2 * G, 0], [0, -G], [G, -G], [2 * G, -G]]), body: { x: -4.71, y: -8.52, w: 14.5, h: 14.5 }, label: "INMP441", round: true },   // ~ bo tròn Ø14,5, 2 × 3 chân
    button: { pads: at("SIG/s SIG/s GND/g GND/g", [[0, 0], [6.5, 0], [0, 4.5], [6.5, 4.5]]), body: { x: .25, y: -.75, w: 6, h: 6 }, label: "", inner: true },   // nút 6 × 6, 4 chân, cặp cùng tên nối trong
    led: { pads: at("A GND/g", [[0, 0], [G, 0]]), body: { x: -1.63, y: -2.9, w: 5.8, h: 5.8 }, label: "", round: true },     // LED 5 mm: A phải qua điện trở 220–330 Ω
    R: { pads: at("1 2", [[0, 0], [4 * G, 0]]), body: { x: 1.93, y: -1.25, w: 6.3, h: 2.5 }, label: "", val: "1k" },          // điện trở 1/4 W: thân 6,3 × 2,5, chân cách 10,16
    C: { pads: at("1/3 2/g", [[0, 0], [2 * G, 0]]), body: { x: -.96, y: -1.5, w: 7, h: 3 }, label: "", round: true, val: "100n" }   // tụ gốm chân cách 5,08 (mặc định lọc nguồn 3V3)
  };
  // board khác ESP32-S3 (Arduino, Raspberry Pi, Pico…): không cắm thẳng lên bo mà nối dây Dupont qua hàng rào header J1.
  // Footprint J1 sinh theo tên khoá "HDR:GND,3V3,D2,…": 1 hàng chân 2,54, mỗi chân mang tên chân của board (cũng là tên mạng)
  function hdrFP(key) {
    if (FP0[key]) return FP0[key];
    const names = key.slice(4).split(","), span = (names.length - 1) * G;
    return FP0[key] = { pads: names.map((n, i) => ({ name: n, x: i * G, y: 0 })), body: { x: -1.5, y: -1.5, w: span + 3, h: 3 }, label: "", hdr: true };
  }
  // board 2 hàng chân 2,54 (C3, SuperMini, Pico 2/2W, T-Display S3): cắm thẳng lên bo như ESP32-S3. Footprint sinh từ toạ độ chân
  // trong dữ liệu sơ đồ chân của Pindexio (chỉ 2 hàng chính, bỏ chân debug), bắt về lưới 2,54 tính từ chân 1
  const FULL = new Set(["esp32-c3-devkitm-1", "esp32-c3-supermini", "pico-2", "pico-2-w", "lilygo-t-display-s3"]);
  function brdFP(key) {
    if (FP0[key]) return FP0[key];
    const b = SITE && window.BOARDS && BOARDS.find(x => x.id === key.slice(4)); if (!b) return undefined;
    const ps = b.headers.flatMap(h => h.pins), xs = ps.map(p => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const row = ps.filter(p => Math.abs(p.x - x0) < .3 || Math.abs(p.x - x1) < .3), y0 = Math.min(...row.map(p => p.y));
    const pads = row.map(p => ({ name: p.name, x: Math.abs(p.x - x0) < .3 ? 0 : Math.round((x1 - x0) / G) * G, y: Math.round((p.y - y0) / G) * G }));
    return FP0[key] = { pads, body: { x: -x0, y: -y0, w: b.w, h: b.h }, label: b.name, inner: true, brd: true };
  }
  const FP = new Proxy(FP0, { get: (t, k) => t[k] || (typeof k === "string" ? (k.startsWith("HDR:") ? hdrFP(k) : k.startsWith("BRD:") ? brdFP(k) : undefined) : undefined) });
  // [tiếng Việt, English, tên ngắn]. Trong Pindexio, module lấy tên từ MODULES (dịch qua từ điển của site)
  const NAMES = { S3: ["ESP32-S3 DevKitC-1", "ESP32-S3 DevKitC-1", "ESP32-S3"], ssd1306: ["OLED SSD1306 0.96\"", "OLED SSD1306 0.96\"", "OLED 0.96\""], st7789: ["Màn TFT ST7789", "ST7789 TFT display", "ST7789"], sevseg: ["LED 7 đoạn", "7-segment LED", "LED 7 đoạn"], ws2812: ["LED RGB WS2812", "WS2812 RGB LED", "WS2812"], hcsr04: ["Siêu âm HC-SR04", "HC-SR04 ultrasonic", "HC-SR04"], tb6612fng: ["Driver động cơ TB6612FNG", "TB6612FNG motor driver", "TB6612FNG"], servo: ["Động cơ Servo SG90", "SG90 servo", "Servo"], vl53l0x: ["ToF VL53L0X", "VL53L0X ToF", "VL53L0X"], mpu6050: ["IMU MPU6050", "MPU6050 IMU", "MPU6050"], dht22: ["Nhiệt ẩm DHT22", "DHT22 temp/humidity", "DHT22"], ldr: ["Ánh sáng LDR", "LDR light sensor", "LDR"], buzzer: ["Còi buzzer", "Buzzer", "Buzzer"], max98357a: ["Ampli I2S MAX98357A", "MAX98357A I2S amp", "MAX98357A"], inmp441: ["Micro I2S INMP441", "INMP441 I2S mic", "INMP441"], button: ["Nút bấm", "Push button", "Nút bấm"], led: ["Đèn LED 5 mm", "5 mm LED", "Đèn LED"], R: ["Điện trở", "Resistor", "Điện trở"], C: ["Tụ điện", "Capacitor", "Tụ điện"] };
  const tr = s => (EN() && window.trEN ? window.trEN(s) : s);
  const NAME = new Proxy({}, { get: (_, k) => SITE && MODULES[k] ? tr(MODULES[k].name) : NAMES[k] ? L(NAMES[k][0], NAMES[k][1]) : k });
  const SHORT = k => SITE && MODULES[k] ? tr(MODULES[k].short) : NAMES[k] ? (EN() ? NAMES[k][1] : NAMES[k][2]) : k;
  const CATS = () => [[L("Board", "Board"), "🧠", ["S3"]], [L("Màn hình & hiển thị", "Displays"), "🖥️", ["ssd1306", "st7789", "sevseg", "ws2812"]], [L("Cảm biến", "Sensors"), "📡", ["hcsr04", "vl53l0x", "mpu6050", "dht22", "ldr"]], [L("Âm thanh & còi", "Audio & buzzers"), "🔊", ["buzzer", "max98357a", "inmp441"]], [L("Động cơ", "Motors"), "⚙️", ["servo", "tb6612fng"]], [L("Cơ bản", "Basics"), "🎛️", ["button", "led", "R", "C"]]];
  // lưu ý khi thêm (theo ghi chú linh kiện của Pindexio)
  const TIPS = { hcsr04: ["ECHO ra 5 V: để trống, nối qua chia áp R 1k + 2k rồi mới vào GPIO.", "ECHO outputs 5 V: left open, wire it through a 1k + 2k divider before a GPIO."], dht22: ["Thêm R 10k kéo SDA lên 3V3.", "Add a 10k pull-up from SDA to 3V3."], led: ["Chân A để trống: nối qua R 220–330 Ω rồi mới vào GPIO.", "Pin A is left open: wire it through 220–330 Ω before a GPIO."], sevseg: ["Các đoạn A–G, DP để trống: mỗi đoạn qua R 220–330 Ω.", "Segments A–G, DP are left open: each needs a 220–330 Ω resistor."], ws2812: ["Nên thêm R 330 Ω nối tiếp DIN.", "Add a 330 Ω series resistor on DIN."], inmp441: ["L/R nối GND = kênh trái. Chỉ chạy 3,3 V.", "L/R to GND = left channel. 3.3 V only."], max98357a: ["GAIN, SD để trống = 9 dB, bật.", "GAIN, SD left open = 9 dB, enabled."] };
  const TIP = new Proxy({}, { get: (_, k) => TIPS[k] && L(TIPS[k][0], TIPS[k][1]) });
  const PRE = { S3: "U", R: "R", C: "C", led: "D", button: "SW", buzzer: "BZ" };
  // GPIO ESP32-S3 dùng được: hàng phải trước (gần module), IO8/9/11/12 để dành cho I2C / SPI. Tránh IO35–37 (PSRAM), TX/RX
  const PREF = "1 2 42 41 40 39 38 21 47 48 4 5 6 7 15 16 17 18 10 13 14 8 9 11 12".split(" ").map(n => "IO" + n);
  const RISKY = ["IO0", "IO3", "IO45", "IO46", "IO19", "IO20"];   // strapping / USB: dùng được nhưng dễ lỗi khởi động
  const BUS = { d: "IO8", c: "IO9", k: "IO12", m: "IO11" };
  const S3ID = "esp32-s3-devkitc-1";
  const isHost = c => c.fp === "S3" || c.fp.startsWith("HDR:") || c.fp.startsWith("BRD:");
  // thông tin board đang làm (S.mcu): tên chân dùng được, chân ưu tiên / dễ lỗi, chân bus I2C / SPI, logic 5 V hay 3,3 V.
  // Chân bus lấy theo chức năng ghi trong dữ liệu sơ đồ chân của Pindexio (giống cách tab Wiring chấm điểm chân)
  const BUS_RE = { ESP32: { d: /Arduino SDA|I2C SDA/, c: /Arduino SCL|I2C SCL/, k: /Arduino SCK/, m: /Arduino MOSI/ }, RP2: { d: /I2C0 SDA/, c: /I2C0 SCL/, k: /SPI0 SCK/, m: /SPI0 TX/ }, AVR: { d: /I2C SDA/, c: /I2C SCL/, k: /SPI SCK/, m: /SPI MOSI/ }, "Raspberry Pi": { d: /SDA1|I2C1 SDA|SDA/, c: /SCL1|I2C1 SCL|SCL/, k: /SCLK|SPI0 SCLK/, m: /MOSI/ } };
  const HOSTS = {};
  function hostInfo() {
    const id = S && S.mcu || S3ID, b = SITE && id !== S3ID && window.BOARDS && BOARDS.find(x => x.id === id);
    if (!b) return HOSTS.S3 = HOSTS.S3 || { s3: true, id: S3ID, name: "ESP32-S3-DevKitC-1", tag: "S3", v5: false, pins: new Set(FP0.S3.pads.map(p => p.name)), pref: PREF, risky: RISKY, bus: BUS, order: () => 0 };
    if (HOSTS[id]) return HOSTS[id];
    const ps = b.headers.flatMap(h => h.pins), usable = p => p.gpio != null && !["power", "gnd", "ctl", "nc", "ban", "usb"].includes(p.cat);
    const seen = new Set(), sig = ps.filter(p => usable(p) && !seen.has(p.name) && seen.add(p.name)), re = BUS_RE[b.family] || BUS_RE.ESP32, bus = {};
    for (const k in re) { const p = sig.find(q => re[k].test(q.fn.join(" "))); if (p) bus[k] = p.name; }
    const bv = new Set(Object.values(bus)), idx = new Map(ps.map((p, i) => [p.name, i]));
    return HOSTS[id] = {
      s3: false, id, name: b.name, tag: b.tag || "MCU", v5: /^5/.test(b.logic || ""), bus, order: n => idx.has(n) ? idx.get(n) : 1e3,
      pins: new Set([...sig.map(p => p.name), "GND", "3V3", "5V"]),
      pref: [...sig.filter(p => !p.warn && !bv.has(p.name)).map(p => p.name), ...bv], risky: sig.filter(p => p.warn && !bv.has(p.name)).map(p => p.name),
      // nhãn chân nguồn theo tên in trên board (Uno "3.3V", Pico "VBUS" là 5 V từ USB)
      alias: (pw => ({ "3V3": (pw.find(n => /^3.?3V?$|^3V3/.test(n)) || "3V3"), "5V": (pw.find(n => n === "5V") || pw.find(n => /VBUS|VIN/.test(n)) || "5V") }))(ps.filter(p => p.cat === "power").map(p => p.name))
    };
  }
  const isSig = n => !!n && !PWR.has(n) && hostInfo().pins.has(n);
  const fresh = (mcu = S3ID) => ({
    v: 2, board: { w: 120, h: 78 }, mcu,
    comps: [mcu === S3ID ? { id: "U1", fp: "S3", x: 3 * G, y: 4 * G, rot: 0 } : FULL.has(mcu) && SITE ? { id: "U1", fp: "BRD:" + mcu, x: 3 * G, y: 4 * G, rot: 0 } : { id: "J1", fp: "HDR:GND", x: 3 * G, y: 4 * G, rot: 0 }],
    traces: [], jumpers: [], alpha: .7, uid: 1, scheme: 1, posture: 0, rats: true, width: null
  });
  let S;
  try { S = JSON.parse(localStorage.getItem("pcb-proto:v2") || "null"); } catch (e) { S = null; }
  if (!S || S.v !== 2) S = fresh();
  S.mcu = S.mcu || S3ID;   // bản lưu cũ: chỉ có ESP32-S3
  const save = () => { try { localStorage.setItem("pcb-proto:v2", JSON.stringify(S)); } catch (e) { } };
  const undo = [], redo = [];
  const checkpoint = () => { undo.push(JSON.stringify(S)); if (undo.length > 100) undo.shift(); redo.length = 0; };
  const pushRaw = s => { undo.push(s); redo.length = 0; };

  /* ---------- hình học ---------- */
  const rot = (x, y, r) => r === 90 ? [-y, x] : r === 180 ? [-x, -y] : r === 270 ? [y, -x] : [x, y];
  // mạng của chân: module lưu theo tên chân (c.nets); chân ESP32-S3 mang tên chính nó khi có module nối tới (IO5 …)
  const usedNets = () => { const s = new Set(); for (const c of S.comps) for (const k in c.nets || {}) if (c.nets[k]) s.add(c.nets[k]); return s; };
  const netOf = (c, name, used) => isHost(c) ? (PWR.has(name) || used.has(name) ? name : null) : (c.nets && c.nets[name]) || null;
  function autoNets(fp) {   // nối sẵn khi thêm: nguồn, bus I2C / SPI, tín hiệu vào GPIO trống
    const s3 = S.comps.some(isHost), H = hostInfo(), used = usedNets(), out = {};
    for (const p of FP[fp].pads) {
      if (p.name in out) continue;
      let n = { g: "GND", 3: "3V3", 5: "5V" }[p.role] || null;
      if (!n && s3 && H.bus[p.role]) n = H.bus[p.role];
      if (!n && s3 && p.role === "s") { n = H.pref.find(x => !used.has(x)) || null; if (n) used.add(n); }
      out[p.name] = n;
    }
    return out;
  }
  function pads() {
    const out = [], used = usedNets();
    for (const c of S.comps) FP[c.fp].pads.forEach((p, i) => { const [x, y] = rot(p.x, p.y, c.rot); out.push({ c, i, name: p.name, net: netOf(c, p.name, used), x: r3(c.x + x), y: r3(c.y + y), sq: i === 0 }); });
    // 2 lỗ của dây nhảy cũng là chân (nhỏ hơn)
    for (const j of S.jumpers) [j.a, j.b].forEach((e, i) => out.push({ c: { id: "W" + j.id }, jw: j, i, name: i ? "B" : "A", net: j.net, x: e[0], y: e[1], sq: false, r: JP_R }));
    for (const h of S.holes || []) out.push({ c: { id: "H" + h.id }, hole: h, i: 0, name: "H", net: h.net, x: h.x, y: h.y, sq: false, r: JP_R });   // lỗ đơn của dây tự do
    return out;
  }
  // mạng trống "~n": dây vẽ tự do chưa chạm chân nào; nối vào mạng thật thì nhận tên mạng đó
  const isFree = n => typeof n === "string" && n[0] === "~";
  function adopt(from, to) { for (const x of [...S.traces, ...S.jumpers, ...(S.holes || [])]) if (x.net === from) x.net = to; }
  // thêm lỗ đơn; trùng chân / lỗ đã có thì dùng luôn chỗ đó (gộp)
  function addHole(q, net) {
    const old = pads().find(p => Math.hypot(p.x - q[0], p.y - q[1]) < PAD_R);
    if (old) return [old.x, old.y];
    (S.holes = S.holes || []).push({ id: S.uid++, x: q[0], y: q[1], net }); return q;
  }
  // bỏ lỗ đơn không còn đường / dây nhảy nào chạm
  function gcHoles() {
    if (!S.holes) return;
    const on = h => S.traces.some(t => t.net === h.net && t.pts.some((p, k) => Math.hypot(p[0] - h.x, p[1] - h.y) < PAD_R || (k && segDist(h.x, h.y, t.pts[k - 1][0], t.pts[k - 1][1], p[0], p[1]) < .05)))
      || S.jumpers.some(j => [j.a, j.b].some(e => Math.hypot(e[0] - h.x, e[1] - h.y) < PAD_R));
    S.holes = S.holes.filter(on);
  }
  const SN = G / 2;   // lưới khi vẽ đường / dây nhảy (1,27 mm): bớt nhạy hơn lưới 0,635
  const traceW = t => t.w || (PWR.has(t.net) ? W_PWR : W_SIG);
  const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  function segSeg(a, b, c, d) {     // khoảng cách ngắn nhất giữa 2 đoạn thẳng
    const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    return Math.min(segDist(a[0], a[1], c[0], c[1], d[0], d[1]), segDist(b[0], b[1], c[0], c[1], d[0], d[1]), segDist(c[0], c[1], a[0], a[1], b[0], b[1]), segDist(d[0], d[1], a[0], a[1], b[0], b[1]));
  }
  function compBox(c) {   // khung thân linh kiện sau xoay (để nắm kéo)
    const b = FP[c.fp].body, pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => rot(x, y, c.rot));
    const xs = pts.map(p => p[0] + c.x), ys = pts.map(p => p[1] + c.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }

  /* ---------- kết nối: union-find qua pad + đường đồng → dây bay (MST) ---------- */
  let A = null;
  function analyze() {
    const P = pads(), par = new Map(), find = k => { while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; };
    const add = k => { if (!par.has(k)) par.set(k, k); }, uni = (a, b) => { add(a); add(b); const x = find(a), y = find(b); if (x !== y) par.set(x, y); };
    P.forEach((p, i) => add("p" + i));
    // các chân cùng tên mạng trên board (GND, 3V3) đã nối sẵn bên trong board
    P.forEach((p, i) => { if (p.jw && p.i === 1) uni("p" + i, "p" + (i - 1)); });
    P.forEach((p, i) => { if (p.jw || p.hole) P.forEach((q, k) => { if (k !== i && q.net === p.net && Math.hypot(q.x - p.x, q.y - p.y) < .1) uni("p" + i, "p" + k); }); });   // dây hàn thẳng vào chân / lỗ trùng chỗ   // dây nhảy nối 2 lỗ của nó
    P.forEach((p, i) => { if (FP[p.c.fp] && FP[p.c.fp].inner && p.net) P.forEach((q, j) => { if (j > i && q.c === p.c && q.net === p.net) uni("p" + i, "p" + j); }); });
    for (const t of S.traces) {
      add("t" + t.id);
      for (const e of [t.pts[0], t.pts[t.pts.length - 1]]) {
        P.forEach((p, i) => { if (p.net === t.net && Math.hypot(p.x - e[0], p.y - e[1]) < PAD_R) uni("t" + t.id, "p" + i); });
        for (const u of S.traces) if (u !== t && u.net === t.net) for (let k = 0; k < u.pts.length - 1; k++) if (segDist(e[0], e[1], u.pts[k][0], u.pts[k][1], u.pts[k + 1][0], u.pts[k + 1][1]) < .05) { add("t" + u.id); uni("t" + t.id, "t" + u.id); }
      }
    }
    P.forEach((p, i) => { if (p.jw || p.hole) for (const t of S.traces) if (t.net === p.net) for (let k = 0; k < t.pts.length - 1; k++) if (segDist(p.x, p.y, t.pts[k][0], t.pts[k][1], t.pts[k + 1][0], t.pts[k + 1][1]) < .05) { add("t" + t.id); uni("t" + t.id, "p" + i); } });
    if (S.pour) for (const g of pour().groups) for (let k = 1; k < g.length; k++) uni(g[0], g[k]);   // mass GND nối các vật GND nó chạm
    // dây bay: nối các cụm cùng mạng bằng cặp pad gần nhất (Kruskal)
    const rats = [], byNet = {};
    P.forEach((p, i) => { if (p.net) (byNet[p.net] = byNet[p.net] || []).push(i); });
    let total = 0;
    for (const net in byNet) {
      const ids = byNet[net], edges = [];
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { const p = P[ids[a]], q = P[ids[b]]; edges.push([Math.hypot(p.x - q.x, p.y - q.y), ids[a], ids[b]]); }
      edges.sort((x, y) => x[0] - y[0]);
      const cl = new Map(ids.map(i => [i, find("p" + i)])), rep = new Map(); const r = k => { while (rep.has(k)) k = rep.get(k); return k; };
      const groups = new Set(ids.map(i => cl.get(i))); total += groups.size - 1;
      for (const [, a, b] of edges) { const ga = r(cl.get(a)), gb = r(cl.get(b)); if (ga !== gb) { rep.set(ga, gb); rats.push({ a: P[a], b: P[b], net }); } }
    }
    A = { P, rats, find, conns: total };
    A.drc = drc(P);
    // dây nhảy khác mạng bắc chéo nhau ở mặt trên: không lỗi nếu dùng dây có vỏ bọc
    A.cross = 0; S.jumpers.forEach((j, i) => S.jumpers.slice(i + 1).forEach(o => { if (o.net !== j.net && !j.ext && !o.ext && segSeg(j.a, j.b, o.a, o.b) === 0) A.cross++; }));
    return A;
  }

  /* ---------- phủ mass GND ---------- */
  // Đổ đồng GND vào chỗ trống: cách đồng khác mạng 0,6 mm, cách mép bo 1,5 mm, chân GND nối bằng 4 nan nhiệt 0,8 mm (dễ hàn),
  // bỏ các đảo đồng không nối vào GND. Mỗi nút lưới 0,3175 mm giữ "khoảng dư" F (mm, > 0 là được đổ); viền vẽ bằng marching squares
  // nội suy trên F nên bám đúng cung tròn / đường xiên, không răng cưa.
  const PC = Q / 2, POUR_CLR = .6, POUR_EDGE = 1.5, SPOKE = .8, GND = "GND";
  let pourCache = { key: null };
  function pour() {
    const key = JSON.stringify([S.comps, S.traces, S.jumpers, S.board]);
    if (pourCache.key === key) return pourCache;
    const B = S.board, nx = Math.round(B.w / PC) + 1, ny = Math.round(B.h / PC) + 1, F = new Float32Array(nx * ny), P = pads(), CAP = 2 * PC;
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) { const x = gx * PC, y = gy * PC; F[gy * nx + gx] = Math.min(CAP, x - POUR_EDGE, y - POUR_EDGE, B.w - POUR_EDGE - x, B.h - POUR_EDGE - y); }
    // vật cản: F = min(F, fn) trong khung bao (ngoài khung fn > CAP nên không đổi)
    const win = (x0, y0, x1, y1, fn) => { for (let gy = Math.max(0, Math.floor(y0 / PC)); gy <= Math.min(ny - 1, Math.ceil(y1 / PC)); gy++) for (let gx = Math.max(0, Math.floor(x0 / PC)); gx <= Math.min(nx - 1, Math.ceil(x1 / PC)); gx++) { const i = gy * nx + gx, v = fn(gx * PC, gy * PC); if (v < F[i]) F[i] = v; } };
    for (const [x0, y0] of [[3.5, 3.5], [B.w - 3.5, 3.5], [3.5, B.h - 3.5], [B.w - 3.5, B.h - 3.5]]) { const r = 1.6 + POUR_CLR, R = r + CAP; win(x0 - R, y0 - R, x0 + R, y0 + R, (x, y) => Math.hypot(x - x0, y - y0) - r); }
    for (const p of P) {
      const r = (p.r || PAD_R) + POUR_CLR, R = r + CAP;
      // chân GND: vòng cách ly có 4 nan (dải ngang / dọc rộng SPOKE) nối pad ra mass
      win(p.x - R, p.y - R, p.x + R, p.y + R, p.net === GND ? (x, y) => Math.max(Math.hypot(x - p.x, y - p.y) - r, SPOKE / 2 - Math.min(Math.abs(x - p.x), Math.abs(y - p.y))) : (x, y) => Math.hypot(x - p.x, y - p.y) - r);
    }
    for (const t of S.traces) if (t.net !== GND) { const r = traceW(t) / 2 + POUR_CLR, R = r + CAP; for (let k = 0; k < t.pts.length - 1; k++) { const [a, b] = [t.pts[k], t.pts[k + 1]]; win(Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) - r); } }
    // vùng liền nhau (đánh nhãn nút F > 0), rồi giữ những vùng chạm vật GND (chồng lên pad GND / đường GND)
    const lab = new Int32Array(nx * ny).fill(-1); let nl = 0;
    for (let s = 0; s < lab.length; s++) if (F[s] > 0 && lab[s] < 0) { const st = [s]; lab[s] = nl; while (st.length) { const c = st.pop(), x = c % nx, y = (c - x) / nx; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x2 = x + dx, y2 = y + dy, c2 = y2 * nx + x2; if (x2 >= 0 && y2 >= 0 && x2 < nx && y2 < ny && F[c2] > 0 && lab[c2] < 0) { lab[c2] = nl; st.push(c2); } } } nl++; }
    const touch = (x0, y0, x1, y1, fn) => { const out = new Set(); for (let gy = Math.max(0, Math.floor(y0 / PC)); gy <= Math.min(ny - 1, Math.ceil(y1 / PC)); gy++) for (let gx = Math.max(0, Math.floor(x0 / PC)); gx <= Math.min(nx - 1, Math.ceil(x1 / PC)); gx++) { const c = gy * nx + gx; if (lab[c] >= 0 && fn(gx * PC, gy * PC)) out.add(lab[c]); } return out; };
    const items = [];
    P.forEach((p, i) => { if (p.net === GND) { const r = (p.r || PAD_R) - .05; items.push(["p" + i, touch(p.x - r, p.y - r, p.x + r, p.y + r, (x, y) => Math.hypot(x - p.x, y - p.y) < r)]); } });
    for (const t of S.traces) if (t.net === GND) { const r = traceW(t) / 2 - .05; const s = new Set(); for (let k = 0; k < t.pts.length - 1; k++) { const [a, b] = [t.pts[k], t.pts[k + 1]]; for (const l of touch(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) < r)) s.add(l); } items.push(["t" + t.id, s]); }
    const keep = new Set(), groups = [];
    for (let l = 0; l < nl; l++) { const g = items.filter(it => it[1].has(l)).map(it => it[0]); if (g.length) { keep.add(l); groups.push(g); } }
    // marching squares: ô đủ 4 góc gộp thành dải chữ nhật, ô biên cắt theo điểm nội suy F = 0. Mọi hình cùng chiều kim đồng hồ, 1 path
    // (chỉ dựng khi vẽ / xuất file; đi dây chỉ cần groups)
    let d = null;
    const path = () => {
      if (d !== null) return d;
      const V = new Float32Array(nx * ny); for (let i = 0; i < V.length; i++) V[i] = F[i] > 0 ? (keep.has(lab[i]) ? F[i] : -1e-3) : Math.min(F[i], -1e-6);
      const out = [];
      for (let gy = 0; gy < ny - 1; gy++) {
        let run = -1;
        const flush = gx => { if (run >= 0) out.push(`M${r3(run * PC)} ${r3(gy * PC)}h${r3((gx - run) * PC)}v${r3(PC)}h${r3(-(gx - run) * PC)}z`); run = -1; };
        for (let gx = 0; gx < nx - 1; gx++) {
          const i = gy * nx + gx, vs = [V[i], V[i + 1], V[i + nx + 1], V[i + nx]], n = (vs[0] > 0) + (vs[1] > 0) + (vs[2] > 0) + (vs[3] > 0);
          if (n === 4) { if (run < 0) run = gx; continue; }
          flush(gx); if (!n) continue;
          const C = [[gx, gy], [gx + 1, gy], [gx + 1, gy + 1], [gx, gy + 1]], pts = [];
          for (let k = 0; k < 4; k++) {
            const a = C[k], b = C[(k + 1) % 4], va = vs[k], vb = vs[(k + 1) % 4];
            if (va > 0) pts.push(r3(a[0] * PC) + " " + r3(a[1] * PC));
            if ((va > 0) !== (vb > 0)) { const t = va / (va - vb); pts.push(r3((a[0] + t * (b[0] - a[0])) * PC) + " " + r3((a[1] + t * (b[1] - a[1])) * PC)); }
          }
          out.push("M" + pts.join("L") + "z");
        }
        flush(nx - 1);
      }
      return d = out.join("");
    };
    return pourCache = { key, groups, get d() { return path(); } };
  }

  /* ---------- kiểm tra khoảng cách (DRC) ---------- */
  function drc(P) {
    P = P.filter(p => !(p.jw && p.jw.pin));   // đầu dây hàn thẳng vào chân: trùng chân, không tính khoảng cách
    const bad = [], segs = [];
    for (const t of S.traces) for (let k = 0; k < t.pts.length - 1; k++) segs.push({ t, k, a: t.pts[k], b: t.pts[k + 1], w: traceW(t) });
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      for (let j = i + 1; j < segs.length; j++) { const u = segs[j]; if (u.t.net === s.t.net) continue; const d = segSeg(s.a, s.b, u.a, u.b); if (d < (s.w + u.w) / 2 + CLR - 1e-6) bad.push({ s, u, x: (s.a[0] + s.b[0] + u.a[0] + u.b[0]) / 4, y: (s.a[1] + s.b[1] + u.a[1] + u.b[1]) / 4, msg: d < (s.w + u.w) / 2 ? L("chập", "short") : L("quá sát", "too close") }); }
      for (const p of P) { if (p.net === s.t.net) continue; const d = segDist(p.x, p.y, s.a[0], s.a[1], s.b[0], s.b[1]); const pr = p.r || PAD_R; if (d < pr + s.w / 2 + CLR - 1e-6) bad.push({ s, pad: p, x: p.x, y: p.y, msg: d < pr + s.w / 2 ? L("chạm chân", "touches pin") : L("sát chân", "too close to pin") }); }
      for (const [x, y] of [s.a, s.b]) if (x < EDGE || y < EDGE || x > S.board.w - EDGE || y > S.board.h - EDGE) bad.push({ s, x, y, msg: L("sát mép bo", "too close to board edge") });
    }
    // chân / lỗ quá sát nhau. Lỗ dây nhảy phải cách mọi chân (kể cả cùng mạng) để khoan tay không rách đồng
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const p = P[i], q = P[j], hole = p.jw || q.jw;
      if (p.jw && p.jw === q.jw) continue;
      if (!hole && (p.c === q.c || (p.net && p.net === q.net))) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) < (p.r || PAD_R) + (q.r || PAD_R) + CLR - 1e-6) bad.push({ pad: hole ? (p.jw ? q : p) : q, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, msg: hole ? L("lỗ dây nhảy sát chân", "jumper hole too close to pin") : L("chân sát chân", "pins too close") });
    }
    for (const j of S.jumpers) {
      if (Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) < JP_MIN - 1e-6) bad.push({ x: (j.a[0] + j.b[0]) / 2, y: (j.a[1] + j.b[1]) / 2, msg: L("dây nhảy ngắn quá (< 5,08 mm)", "jumper too short (< 5.08 mm)") });
      if (!j.ext) for (const p of P) if (p.jw !== j && p.net !== j.net && segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < (p.r || PAD_R) + JP_OVER) bad.push({ pad: p, x: p.x, y: p.y, msg: L("dây nhảy đè lên chân", "jumper passes over a pin") });
    }
    // khung bo thu nhỏ: chân nằm ngoài / sát mép
    for (const p of P) { const r = p.r || PAD_R; if (p.x - r < EDGE || p.y - r < EDGE || p.x + r > S.board.w - EDGE || p.y + r > S.board.h - EDGE) bad.push({ pad: p, x: p.x, y: p.y, msg: L("chân ra ngoài mép bo", "pin outside the board edge") }); }
    return bad;
  }
  // chỗ đặt lỗ dây nhảy: trong mép bo, cách mọi chân / lỗ ≥ CLR (mép–mép), cách đồng khác mạng ≥ CLR
  // lỗ dây nhảy cách mối hàn chân linh kiện thêm HOLE_GAP mm để mỏ hàn dễ vào, không dính thiếc sang chân
  let HOLE_GAP = 1;
  function holeOK(x, y, net, P) {   // tự đi dây dùng khoảng cách gốc như bản đã chạy tốt; HOLE_GAP chỉ cho lỗ dây ngoài (extWires)
    if (x < EDGE + JP_R || y < EDGE + JP_R || x > S.board.w - EDGE - JP_R || y > S.board.h - EDGE - JP_R) return false;
    for (const p of P) if (Math.hypot(p.x - x, p.y - y) < (p.r || PAD_R) + CLR + JP_R) return false;
    // không nằm dưới thân dây nhảy khác mạng (dây trần mặt trên sẽ chạm mối hàn của lỗ này)
    for (const j of S.jumpers) if (j.net !== net && !j.ext && segDist(x, y, j.a[0], j.a[1], j.b[0], j.b[1]) < JP_R + JP_OVER) return false;
    for (const t of S.traces) if (t.net !== net) for (let k = 0; k < t.pts.length - 1; k++) if (segDist(x, y, t.pts[k][0], t.pts[k][1], t.pts[k + 1][0], t.pts[k + 1][1]) < traceW(t) / 2 + CLR + JP_R) return false;
    return true;
  }
  // thân dây nhảy (dây trần, mặt trên) không đi ngang chân khác mạng: chân linh kiện nhô lên ở đó
  const lineOK = (a, b, net, P) => P.every(p => p.net === net || segDist(p.x, p.y, a[0], a[1], b[0], b[1]) >= (p.r || PAD_R) + JP_OVER);

  /* ---------- tự đi dây: A* trên lưới 0,635 mm, chỉ né chân & đường khác mạng, được luồn dưới thân linh kiện ---------- */
  const SCHEMES = [
    { get name() { return L("Vuông góc, ít khúc", "Right angles, few bends"); }, get short() { return L("Vuông góc", "90°"); }, dirs: 4, t45: 0, t90: 4, diag: 1 },
    { get name() { return L("45° kiểu KiCad", "45° KiCad style"); }, get short() { return L("Kiểu 45°", "45° style"); }, dirs: 8, t45: 1.2, t90: 4, diag: 1.05 },
    { get name() { return L("Ngắn nhất", "Shortest"); }, get short() { return L("Ngắn nhất", "Shortest"); }, dirs: 8, t45: .2, t90: .8, diag: 1 }
  ];
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  // lượt 1: đi dây thường. Lượt 2 (đường bị chắn): cho phép vượt qua đường khác mạng, chỗ vượt thay bằng dây nhảy tự động
  // prio: các đường lần trước bị hỏng (khoá ratKey) được đi trước. Đường hỏng lần này ghi vào autoroute.failed
  const ratKey = r => [r.a.c.id + "." + r.a.i, r.b.c.id + "." + r.b.i].sort().join("-");
  function autoroute(si, prio, gndAsNet) {   // gndAsNet: có mass vẫn đi GND như mạng thường (dự phòng khi chân GND bị vây)
    const sc = SCHEMES[si]; autoroute.failed = [];
    S.traces = S.traces.filter(t => t.lock); S.jumpers = S.jumpers.filter(j => !j.auto);
    const pw = S.pour; if (gndAsNet) S.pour = false; analyze(); S.pour = pw;   // dây bay GND tính như chưa có mass
    const nx = Math.floor(S.board.w / Q) + 1, ny = Math.floor(S.board.h / Q) + 1, P = A.P;
    // tín hiệu trước (ngắn trước), nguồn sau: nguồn đi vòng xa vẫn được, còn đi trước thì dễ thành bức tường chắn tín hiệu
    const len = r => Math.hypot(r.a.x - r.b.x, r.a.y - r.b.y), pr = r => prio && prio.has(ratKey(r)) ? 0 : 1;
    const edges = A.rats.slice().sort((a, b) => (pr(a) - pr(b)) || (PWR.has(a.net) - PWR.has(b.net)) || (len(a) - len(b)));
    const holes = () => S.jumpers.flatMap(j => [{ x: j.a[0], y: j.a[1], r: JP_R, net: j.net }, { x: j.b[0], y: j.b[1], r: JP_R, net: j.net }]);
    const grids = (e, w) => {
      const block = new Uint8Array(nx * ny), soft = new Uint8Array(nx * ny);
      const mark = (g, x0, y0, x1, y1, fn) => { for (let gy = Math.max(0, Math.floor(y0 / Q)); gy <= Math.min(ny - 1, Math.ceil(y1 / Q)); gy++) for (let gx = Math.max(0, Math.floor(x0 / Q)); gx <= Math.min(nx - 1, Math.ceil(x1 / Q)); gx++) if (fn(gx * Q, gy * Q)) g[gy * nx + gx] = 1; };
      for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) { const x = gx * Q, y = gy * Q, m = EDGE + w / 2; if (x < m || y < m || x > S.board.w - m || y > S.board.h - m) block[gy * nx + gx] = 1; }
      for (const p of [...P, ...holes()]) if (p.net !== e.net) { const r = (p.r || PAD_R) + CLR + w / 2; mark(block, p.x - r, p.y - r, p.x + r, p.y + r, (x, y) => Math.hypot(x - p.x, y - p.y) < r); }
      for (const t of S.traces) if (t.net !== e.net) { const r = traceW(t) / 2 + CLR + w / 2; for (let k = 0; k < t.pts.length - 1; k++) { const [a, b] = [t.pts[k], t.pts[k + 1]]; mark(soft, Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) < r); } }
      return { block, soft };
    };
    const toMMs = cells => cells.map(([gx, gy]) => [r3(gx * Q), r3(gy * Q)]);
    // có phủ mass: đi các mạng khác trước, đổ mass, rồi chỉ đi nốt chân GND mà mass chưa với tới
    if (!S.pour || gndAsNet) return run(edges);
    const f = run(edges.filter(e => e.net !== GND)); analyze();
    return f + run(A.rats.filter(e => e.net === GND).sort((a, b) => (pr(a) - pr(b)) || (len(a) - len(b))));
    function run(list) {
    const failed = [];
    for (const e of list) {
      const w = PWR.has(e.net) ? W_PWR : W_SIG, { block, soft } = grids(e, w);
      for (let i = 0; i < block.length; i++) if (soft[i]) block[i] = 1;
      const path = astar(nx, ny, block, Math.round(e.a.x / Q), Math.round(e.a.y / Q), Math.round(e.b.x / Q), Math.round(e.b.y / Q), sc);
      if (!path) { failed.push(e); continue; }
      const pts = simplify(toMMs(straighten(path, nx, block, sc)));
      pts[0] = [e.a.x, e.a.y]; pts[pts.length - 1] = [e.b.x, e.b.y];
      S.traces.push({ id: S.uid++, net: e.net, pts, lock: false });
    }
    let fail = 0;
    for (const e of failed) {
      const w = PWR.has(e.net) ? W_PWR : W_SIG, { block, soft } = grids(e, w), base = block.slice();
      // không vượt ngay sát chân đầu / cuối: chừa chỗ đặt lỗ dây nhảy cách chân (không dùng chung lỗ, không sát chân)
      const RZ = PAD_R + CLR + JP_R + 1.5 * Q;
      for (const p of [e.a, e.b]) for (let gy = Math.max(0, Math.floor((p.y - RZ) / Q)); gy <= Math.min(ny - 1, Math.ceil((p.y + RZ) / Q)); gy++) for (let gx = Math.max(0, Math.floor((p.x - RZ) / Q)); gx <= Math.min(nx - 1, Math.ceil((p.x + RZ) / Q)); gx++) { const c = gy * nx + gx; if (soft[c] && Math.hypot(gx * Q - p.x, gy * Q - p.y) < RZ) block[c] = 1; }
      const sxy = [Math.round(e.a.x / Q), Math.round(e.a.y / Q), Math.round(e.b.x / Q), Math.round(e.b.y / Q)];
      // chân bị vây sát: thử lại không chừa vùng, splitJumps sẽ đặt lỗ lệch khỏi đường đi (đoạn đồng ngắn từ chân ra lỗ)
      const path = astar(nx, ny, block, ...sxy, sc, soft) || astar(nx, ny, base, ...sxy, sc, soft);
      const cut = path && splitJumps(path, nx, soft, e.net, w, [e.a.x, e.a.y], [e.b.x, e.b.y]);      if (!cut) { fail++; autoroute.failed.push(ratKey(e)); continue; }
      for (let i = 0; i < block.length; i++) if (soft[i]) block[i] = 1;   // phần đồng không được nắn tắt qua đường khác
      cut.segs.forEach((sg, i) => {
        const pts = simplify(toMMs(straighten(sg, nx, block, sc)));
        if (i === 0) pts[0] = [e.a.x, e.a.y];
        if (i === cut.segs.length - 1) pts[pts.length - 1] = [e.b.x, e.b.y];
        S.traces.push({ id: S.uid++, net: e.net, pts, lock: false });
      });
      for (const [a, b] of cut.jumps) S.jumpers.push({ id: S.uid++, net: e.net, a: [r3(a[0] * Q), r3(a[1] * Q)], b: [r3(b[0] * Q), r3(b[1] * Q)], auto: true });
    }
    return fail;
    }
  }
  // cắt đường đi tại các đoạn vượt qua đường khác mạng. Thử các cặp chỗ đặt 2 lỗ quanh chỗ vượt (tối đa K ô mỗi phía),
  // giữ cặp ngắn nhất mà an toàn: lỗ không dùng chung / sát chân, dài ≥ 5,08, thân dây không đè chân, ưu tiên lỗ đúng lưới 2,54
  // và không bắc chéo dây nhảy khác.
  // Chỗ vượt sát chân đầu / cuối (không còn chỗ trên đường đi): lỗ đặt lệch ra ngoài theo 8 hướng, nối chân bằng đoạn đồng thẳng.
  function splitJumps(path, nx, soft, net, w, padA, padB) {
    const P = pads(), isSoft = c => soft[c[1] * nx + c[0]], mm = c => [c[0] * Q, c[1] * Q], onG = c => c[0] % 4 === 0 && c[1] % 4 === 0, K = 40, n = path.length;
    const stubOK = (a, b) => {
      for (const t of S.traces) if (t.net !== net) for (let k = 0; k < t.pts.length - 1; k++) if (segSeg(a, b, t.pts[k], t.pts[k + 1]) < traceW(t) / 2 + CLR + w / 2) return false;
      return P.every(p => p.net === net || segDist(p.x, p.y, a[0], a[1], b[0], b[1]) >= (p.r || PAD_R) + CLR + w / 2);
    };
    const stubs = (pad, c0) => {
      const out = [];
      for (const [dx, dy] of DIRS) for (let k = 3; k <= 10; k++) { const h = [c0[0] + dx * k, c0[1] + dy * k], hm = mm(h); if (!stubOK(pad, hm)) break; if (holeOK(hm[0], hm[1], net, P)) out.push(h); }
      return out;
    };
    const recs = []; let start = 0, i = 0, tail = null;
    while (i < n) {
      if (!isSoft(path[i])) { i++; continue; }
      let j = i; while (j < n && isSoft(path[j])) j++;
      let nxt = j; while (nxt < n && !isSoft(path[nxt])) nxt++;
      let okA = [];
      const okB = [];
      for (let a = i - 1; a > start && a >= i - K; a--) { const p = mm(path[a]); if (holeOK(p[0], p[1], net, P)) okA.push({ cell: path[a], seg: path.slice(start, a + 1) }); }
      // 2 chỗ vượt liền nhau, giữa không đủ chỗ đặt lỗ: gộp với dây nhảy trước thành 1 dây dài hơn
      if (!okA.length && recs.length) { const pr = recs.pop(); P.length -= 2; okA = [{ cell: pr.ha, seg: pr.seg }]; }
      else if (!okA.length) okA = stubs(padA, path[0]).map(h => ({ cell: h, seg: [path[0], h] }));
      for (let b = j; b < n - 1 && b < nxt && b <= j + K; b++) { const p = mm(path[b]); if (holeOK(p[0], p[1], net, P)) okB.push({ cell: path[b], b }); }
      if (!okB.length && nxt >= n) okB.push(...stubs(padB, path[n - 1]).map(h => ({ cell: h, b: -1 })));
      let best = null;
      for (const A of okA) for (const B of okB) {
        const pa = mm(A.cell), pb = mm(B.cell), len = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
        if (len < JP_MIN - 1e-6 || (best && len > best.sc) || !lineOK(pa, pb, net, P)) continue;
        const cross = S.jumpers.some(o => o.net !== net && segSeg(pa, pb, o.a, o.b) === 0);
        const sc = len + (onG(A.cell) ? 0 : .8) + (onG(B.cell) ? 0 : .8) + (cross ? 20 : 0);
        if (!best || sc < best.sc) best = { sc, A, B, pa, pb };
      }
      if (!best) return null;
      for (const p of [best.pa, best.pb]) P.push({ x: p[0], y: p[1], r: JP_R, net });   // lỗ vừa đặt: lỗ sau phải cách nó
      recs.push({ seg: best.A.seg, ha: best.A.cell, hb: best.B.cell });
      if (best.B.b < 0) { tail = [best.B.cell, path[n - 1]]; break; }
      start = best.B.b; i = start + 1;
    }
    const segs = recs.map(r => r.seg); segs.push(tail || path.slice(start));
    return { segs, jumps: recs.map(r => [r.ha, r.hb]) };
  }
  function astar(nx, ny, block, sx, sy, tx, ty, sc, soft) {   // soft: ô đi được nhưng tốn phí (sẽ thành dây nhảy)
    const N = nx * ny, g = new Float32Array(N * 9).fill(Infinity), from = new Int32Array(N * 9).fill(-1), done = new Uint8Array(N * 9);
    // hàng đợi ưu tiên trên 2 mảng số (khoá f, trạng thái s): không tạo mảng con cho mỗi phần tử
    let hf = new Float64Array(4096), hs = new Int32Array(4096), hn = 0;
    const push = (f, s) => {
      if (hn === hf.length) { const f2 = new Float64Array(hn * 2), s2 = new Int32Array(hn * 2); f2.set(hf); s2.set(hs); hf = f2; hs = s2; }
      let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hf[i] = hf[p]; hs[i] = hs[p]; i = p; } hf[i] = f; hs[i] = s;
    };
    const pop = () => {
      const top = hs[0], f = hf[--hn], s = hs[hn]; let i = 0;
      for (; ;) { const l = 2 * i + 1; if (l >= hn) break; const m = l + 1 < hn && hf[l + 1] < hf[l] ? l + 1 : l; if (hf[m] >= f) break; hf[i] = hf[m]; hs[i] = hs[m]; i = m; }
      hf[i] = f; hs[i] = s; return top;
    };
    const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return sc.dirs === 4 ? dx + dy : Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    const st = (sy * nx + sx) * 9 + 8; g[st] = 0; push(h(sx, sy), st);
    const step = sc.dirs === 4 ? 2 : 1; let it = 0;
    while (hn && it++ < 400000) {
      const s = pop(); if (done[s]) continue; done[s] = 1;
      const cell = Math.floor(s / 9), d = s % 9, x = cell % nx, y = Math.floor(cell / nx);
      if (x === tx && y === ty) { const out = []; let k = s; while (k >= 0) { const c = Math.floor(k / 9); out.push([c % nx, Math.floor(c / nx)]); k = from[k]; } return out.reverse(); }
      for (let nd = 0; nd < 8; nd += step) {
        if (d !== 8) { const turn = Math.min((nd - d + 8) % 8, (d - nd + 8) % 8); if (turn > 2) continue; }   // cấm gập > 90° (góc nhọn giữ axit)
        const x2 = x + DIRS[nd][0], y2 = y + DIRS[nd][1]; if (x2 < 0 || y2 < 0 || x2 >= nx || y2 >= ny) continue;
        const c2 = y2 * nx + x2; if (block[c2] && !(x2 === tx && y2 === ty)) continue;
        if (nd % 2 && (block[y * nx + x2] || block[y2 * nx + x])) continue;   // đi chéo không lách qua khe
        const turn = d === 8 ? 0 : Math.min((nd - d + 8) % 8, (d - nd + 8) % 8);
        let cost = g[s] + (nd % 2 ? Math.SQRT2 * sc.diag : 1) + (turn === 1 ? sc.t45 : turn === 2 ? sc.t90 : 0);
        if (soft && soft[c2]) cost += soft[cell] ? 15 : 30;   // đắt khi chạy dọc trong vùng vượt → cắt ngang ngắn, dây nhảy ngắn
        const s2 = c2 * 9 + nd; if (cost < g[s2]) { g[s2] = cost; from[s2] = s; push(cost + h(x2, y2), s2); }
      }
    }
    return null;
  }
  // nắn đường A* (răng cưa) thành ít đoạn: từ mỗi điểm nhảy tới điểm xa nhất nối được bằng 1 đoạn thẳng hoặc 1 lần gập, không gập quá 90°
  function straighten(path, nx, block, sc) {
    const [tx, ty] = path[path.length - 1], dir = (a, b) => [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
    const okTurn = (d1, d2) => !d1 || d1[0] * d2[0] + d1[1] * d2[1] >= 0;
    const straight = (a, b) => { const ax = Math.abs(b[0] - a[0]), ay = Math.abs(b[1] - a[1]); return !ax || !ay || (sc.dirs === 8 && ax === ay); };
    const clear = (a, b) => {
      const [dx, dy] = dir(a, b); let x = a[0], y = a[1];
      while (x !== b[0] || y !== b[1]) { const x2 = x + dx, y2 = y + dy; if (block[y2 * nx + x2] && !(x2 === tx && y2 === ty)) return false; if (dx && dy && (block[y * nx + x2] || block[y2 * nx + x])) return false; x = x2; y = y2; }
      return true;
    };
    const bends = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy), d = Math.min(ax, ay);
      const m = sc.dirs === 4 ? [[b[0], a[1]], [a[0], b[1]]] : ax > ay ? [[a[0] + sx * (ax - d), a[1]], [a[0] + sx * d, a[1] + sy * d]] : [[a[0], a[1] + sy * (ay - d)], [a[0] + sx * d, a[1] + sy * d]];
      return m.filter(p => (p[0] !== a[0] || p[1] !== a[1]) && (p[0] !== b[0] || p[1] !== b[1]));
    };
    const out = [path[0]]; let i = 0, pd = null;
    while (i < path.length - 1) {
      let best = null;
      for (let j = path.length - 1; j > i && !best; j--) {
        const a = path[i], b = path[j];
        if (straight(a, b) && okTurn(pd, dir(a, b)) && clear(a, b)) { best = { j, pts: [b] }; break; }
        for (const m of bends(a, b)) if (okTurn(pd, dir(a, m)) && okTurn(dir(a, m), dir(m, b)) && clear(a, m) && clear(m, b)) { best = { j, pts: [m, b] }; break; }
      }
      if (!best) best = { j: i + 1, pts: [path[i + 1]] };
      for (const p of best.pts) { pd = dir(out[out.length - 1], p); out.push(p); }
      i = best.j;
    }
    return out;
  }
  function simplify(pts) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) { const a = out[out.length - 1], b = pts[i], c = pts[i + 1]; if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b); }
    out.push(pts[pts.length - 1]); return out;
  }

  // phương án cuối cho đường vẫn không đi được (kể cả dây nhảy): đặt 2 lỗ pad ở chỗ trống gần 2 chân (3–15 mm, đúng lưới 2,54),
  // đi đoạn đồng ngắn từ chân ra lỗ, 2 lỗ nối bằng dây điện có vỏ bọc (j.ext) vắt ở mặt linh kiện. Không hàn vào chân module.
  const extNo = j => S.jumpers.indexOf(j) + 1;   // mọi dây nhảy đánh số chung J1, J2…
  function extWires(budget = 5000) {
    const t0 = performance.now(), tried = new Set();
    const segHit = (p, q, t, gap) => { for (let k = 0; k < t.pts.length - 1; k++) if (segSeg(p, q, t.pts[k], t.pts[k + 1]) < traceW(t) / 2 + gap) return true; return false; };
    // chỗ đặt lỗ + đoạn đồng thẳng chân → lỗ, chỉ xét chân / lỗ khác mạng (đường đồng xử lý riêng: tránh hoặc gỡ)
    const spots = (p, net, w, P) => {
      const out = [];
      for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) {
        const x = r3(snap(p.x, G) + dx * G), y = r3(snap(p.y, G) + dy * G), d = Math.hypot(x - p.x, y - p.y);
        if (d < 2 * G - .01 || d > 5 * G + .01 || x < EDGE + JP_R || y < EDGE + JP_R || x > S.board.w - EDGE - JP_R || y > S.board.h - EDGE - JP_R) continue;
        if (P.some(q => q !== p && Math.hypot(q.x - x, q.y - y) < (q.r || PAD_R) + CLR + JP_R + (q.jw || q.hole ? 0 : HOLE_GAP))) continue;
        if (P.some(q => q !== p && q.net !== net && segDist(q.x, q.y, p.x, p.y, x, y) < (q.r || PAD_R) + w / 2 + CLR)) continue;
        // đường khác mạng bị chắn: đã khoá thì bỏ chỗ này, tự động thì ghi lại để gỡ
        const hit = S.traces.filter(t => t.net !== net && (segHit([p.x, p.y], [x, y], t, w / 2 + CLR) || segHit([x, y], [x, y], t, JP_R + CLR)));
        if (hit.some(t => t.lock)) continue;
        // lỗ nằm dưới thân module / board thì khó luồn dây và hàn: chỉ dùng khi không còn chỗ nào khác
        const under = S.comps.some(c => { const b = compBox(c); return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1; });
        out.push({ d: d + hit.length * 20 + (under ? 10 : 0), x, y, hit });
      }
      return out.sort((u, v) => u.d - v.d).slice(0, 3);
    };
    while (performance.now() - t0 < budget) {
      const A0 = analyze(), rt = A0.rats.find(r => !r.a.jw && !r.b.jw && !r.a.hole && !r.b.hole && !tried.has(r.a.c.id + r.a.i + "-" + r.b.c.id + r.b.i)); if (!rt) break;
      tried.add(rt.a.c.id + rt.a.i + "-" + rt.b.c.id + rt.b.i);
      const P = pads(), net = rt.net, w = PWR.has(net) ? W_PWR : W_SIG, sa = spots(rt.a, net, w, P), sb = spots(rt.b, net, w, P);
      const pairs = []; for (const x of sa) for (const y of sb) if (Math.hypot(x.x - y.x, x.y - y.y) >= JP_MIN) pairs.push([x.d + y.d, x, y]);
      let done = false;
      for (const [, x, y] of pairs.sort((u, v) => u[0] - v[0]).slice(0, 4)) {
        if (performance.now() - t0 > budget) break;
        const keep = JSON.stringify([S.traces, S.jumpers, S.uid]), gone = new Set([...x.hit, ...y.hit]), nets = new Set([...gone].map(t => t.net));
        S.traces = S.traces.filter(t => !gone.has(t)); if (nets.size) dropDangling(nets);   // gỡ đường chắn + phần treo của nó
        S.traces.push({ id: S.uid++, net, pts: [[rt.a.x, rt.a.y], [x.x, x.y]], lock: true }, { id: S.uid++, net, pts: [[rt.b.x, rt.b.y], [y.x, y.y]], lock: true });
        const j = { id: S.uid++, net, a: [x.x, x.y], b: [y.x, y.y], ext: true };
        S.jumpers.push(j);
        if (nets.size) {   // đi lại các mạng vừa gỡ, giữ nguyên phần còn lại
          const ft = S.traces.filter(t => !t.lock), fj = S.jumpers.filter(o => o.auto);
          ft.forEach(t => t.lock = true); fj.forEach(o => o.auto = false); autoroute(S.scheme); ft.forEach(t => t.lock = false); fj.forEach(o => o.auto = true);
        }
        // 2 đoạn chân → lỗ khoá tạm trong lúc đi lại, xong trả về tự động (Tự đi dây lần sau được đi lại)
        S.traces.forEach(t => { if (t.lock && t.pts.length === 2 && (near2(t.pts[0], rt.a) || near2(t.pts[0], rt.b)) && (near2(t.pts[1], [x.x, x.y]) || near2(t.pts[1], [y.x, y.y]))) t.lock = false; });
        j.auto = true;
        const A2 = analyze();
        if (A2.rats.length < A0.rats.length && A2.drc.length <= A0.drc.length) { done = true; break; }
        [S.traces, S.jumpers, S.uid] = JSON.parse(keep);
      }
      // không còn chỗ khoan lỗ riêng: dây có vỏ hàn thẳng vào 2 chân (mặt đồng, cạnh mối hàn chân) để không sót đường nào
      if (!done) S.jumpers.push({ id: S.uid++, net, a: [rt.a.x, rt.a.y], b: [rt.b.x, rt.b.y], ext: true, auto: true, pin: true });
    }
    return analyze().rats.length;
  }
  const near2 = (q, p) => Math.hypot(q[0] - (p.x ?? p[0]), q[1] - (p.y ?? p[1])) < .05;

  /* ---------- vẽ ---------- */
  const svg = $("#plSvg"); let cam = null;
  const LY = {};
  function build() {
    svg.innerHTML = "";
    const defs = el("defs", {}, svg), pat = el("pattern", { id: "grid", width: G, height: G, patternUnits: "userSpaceOnUse" }, defs);
    el("circle", { cx: 0, cy: 0, r: .12, fill: "rgba(255,255,255,.28)" }, pat);
    const R = LY.root = el("g", {}, svg);
    LY.board = el("g", {}, R); LY.silk = el("g", {}, R); LY.pour = el("g", { "pointer-events": "none" }, R); LY.cu = el("g", {}, R); LY.pads = el("g", {}, R); LY.jw = el("g", { "pointer-events": "none" }, R); LY.rats = el("g", { "pointer-events": "none" }, R);
    LY.drc = el("g", { "pointer-events": "none" }, R); LY.sel = el("g", {}, R); LY.tmp = el("g", { "pointer-events": "none" }, R);
    LY.face = el("g", { "pointer-events": "none" }, svg);   // chữ FRONT / BACK: ngoài lớp lật gương để luôn đọc xuôi
  }
  // J1 của board khác: GND, nguồn đang dùng rồi các chân tín hiệu (bus trước, theo thứ tự chân trên board). Đổi chân là J1 đổi theo
  function syncHost() {
    const H = hostInfo(), c = S.comps.find(isHost); if (H.s3 || !c || !c.fp.startsWith("HDR:")) return;
    const used = usedNets(), bv = Object.values(H.bus);
    const sig = [...used].filter(isSig).sort((a, b) => (bv.includes(b) - bv.includes(a)) || (H.order(a) - H.order(b)));
    const key = "HDR:" + ["GND", ...["5V", "3V3"].filter(n => used.has(n)), ...sig].join(",");
    if (c.fp !== key) c.fp = key;
  }
  const pinLabel = n => hostInfo().alias && hostInfo().alias[n] || n;
  function render() {
    syncHost(); analyze();
    const hl = ui.hlNet;
    for (const k of ["board", "silk", "cu", "pads", "jw", "rats", "drc", "sel", "face"]) LY[k].innerHTML = "";
    const B = S.board;
    LY.root.setAttribute("transform", S.flip ? `translate(${B.w} 0) scale(-1 1)` : ""); svg.classList.toggle("back", !!S.flip);
    el("text", { x: B.w - 2.5, y: B.h - 2.5, class: "face", "font-size": Math.max(4, Math.min(12, B.h * .13)) }, LY.face, S.flip ? "BACK" : "FRONT");
    el("rect", { x: 0, y: 0, width: B.w, height: B.h, rx: 1.5, class: "fr4" }, LY.board);
    el("rect", { x: 0, y: 0, width: B.w, height: B.h, fill: "url(#grid)" }, LY.board);
    el("rect", { x: 0, y: 0, width: B.w, height: B.h, rx: 1.5, class: "edge" }, LY.board);
    for (const [x, y] of [[3.5, 3.5], [B.w - 3.5, 3.5], [3.5, B.h - 3.5], [B.w - 3.5, B.h - 3.5]]) el("circle", { cx: x, cy: y, r: 1.6, class: "mhole" }, LY.board);
    // linh kiện (in lụa)
    for (const c of S.comps) {
      const f = FP[c.fp], g = el("g", { class: "comp" + (ui.sel && ui.sel.t === "c" && ui.sel.id === c.id ? " sel" : ""), "data-c": c.id, transform: `translate(${c.x} ${c.y}) rotate(${c.rot})` }, LY.silk), b = f.body;
      if (S.alpha > 0) art(c.fp, b, el("g", { class: "art", opacity: S.alpha }, g));
      if (f.round) el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.h / 2, class: "body" }, g); else el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: .6, class: "body" }, g);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (f.label) el("text", { x: cx, y: cy, class: "silkt", transform: c.rot % 180 ? `rotate(-90 ${cx} ${cy})` : "" }, g, f.label);
      if (f.hdr) f.pads.forEach(p => el("text", { x: p.x, y: p.y - 2, class: "hdrl", transform: `rotate(-90 ${p.x} ${p.y - 2})` }, g, pinLabel(p.name)));
      // J1: tên ngắn của board ghi bên phải hàng rào (không đè linh kiện bên dưới)
      el("text", f.hdr ? { x: b.x + b.w + 1, y: b.y + b.h / 2 + .5, class: "ref" } : { x: b.x + .6, y: b.y - .8, class: "ref" }, g, c.id + (f.hdr ? " → " + hostInfo().name.split(" (")[0] : "") + (c.val ? " " + c.val : ""));
    }
    // mass GND
    // path mass lớn (vài trăm KB): chỉ dựng lại khi hình đổi, còn lại chỉ đổi lớp mờ
    const pd = S.pour ? pour().d : "", pe = LY.pour.firstChild;
    if (!pd) LY.pour.innerHTML = ""; else if (!pe || pe.__d !== pd) { LY.pour.innerHTML = ""; el("path", { d: pd }, LY.pour).__d = pd; }
    if (pd) LY.pour.firstChild.setAttribute("class", "pour" + (hl && hl !== GND ? " dim" : ""));
    // đường đồng
    for (const t of S.traces) {
      const w = traceW(t), d = "M" + t.pts.map(p => p.join(" ")).join(" L"), on = ui.sel && ui.sel.t === "t" && ui.sel.id === t.id;
      const g = el("g", { class: "trace" + (on ? " sel" : "") + (t.lock ? " lock" : "") + (isFree(t.net) ? " free" : "") + (hl && hl === t.net ? " hl" : "") + (hl && hl !== t.net ? " dim" : ""), "data-t": t.id }, LY.cu);
      el("path", { d, "stroke-width": w, class: "cu" }, g);
      el("path", { d, "stroke-width": Math.max(w, 2.2), class: "hit" }, g);
    }
    // chân
    for (const p of A.P) {
      const g = el("g", { class: "pad" + (p.net ? "" : " nc") + (hl && p.net === hl ? " hl" : "") + (hl && p.net && p.net !== hl ? " dim" : ""), "data-p": p.c.id + ":" + p.i }, LY.pads);
      if (p.sq) el("rect", { x: p.x - PAD_R, y: p.y - PAD_R, width: 2 * PAD_R, height: 2 * PAD_R, rx: .15, class: "padcu" }, g); else el("circle", { cx: p.x, cy: p.y, r: p.r || PAD_R, class: "padcu" }, g);
      el("circle", { cx: p.x, cy: p.y, r: p.r ? JP_DRILL : DRILL_R, class: "drill" }, g);
    }
    // dây nhảy: nét trắng mảnh (quy ước chung cho ký hiệu linh kiện) nằm ở mặt linh kiện
    for (const j of S.jumpers) {
      const g = el("g", { class: "jw" + (j.ext ? " ext" : "") + (ui.sel && ui.sel.t === "j" && ui.sel.id === j.id ? " sel" : "") + (hl && hl !== j.net ? " dim" : "") }, LY.jw);
      el("line", { x1: j.a[0], y1: j.a[1], x2: j.b[0], y2: j.b[1], class: "jwl" }, g);
      { const n = extNo(j); [[j.a, "a"], [j.b, "b"]].forEach(([e, s]) => el("text", { x: e[0] + 1.2, y: e[1] - 1, class: "extl" }, g, "J" + n + s)); }
    }
    // dây bay
    if (S.rats) for (const r of A.rats) el("line", { x1: r.a.x, y1: r.a.y, x2: r.b.x, y2: r.b.y, class: "rat" + (hl && r.net === hl ? " hl" : "") }, LY.rats);
    // lỗi khoảng cách
    for (const v of A.drc) { el("circle", { cx: v.x, cy: v.y, r: 1.4, class: "drcmark" }, LY.drc); if (v.s) el("path", { d: `M${v.s.a.join(" ")} L${v.s.b.join(" ")}`, "stroke-width": v.s.w + .4, class: "drcseg" }, LY.drc); }
    // điểm gập của đường đang chọn
    if (ui.sel && ui.sel.t === "t") { const t = S.traces.find(x => x.id === ui.sel.id); if (t) t.pts.forEach((p, i) => { if (i > 0 && i < t.pts.length - 1) el("rect", { x: p[0] - .55, y: p[1] - .55, width: 1.1, height: 1.1, class: "vtx", "data-v": i }, LY.sel); }); }
    panel(); save();
  }

  // hình board thật (đơn giản) vẽ dưới nét in lụa, độ mờ chỉnh bằng thanh kéo
  function art(fp, b, g) {
    const R = (x, y, w, h, fill, rx = .6) => el("rect", { x, y, width: w, height: h, rx, fill }, g), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (fp === "S3") { R(b.x, b.y, b.w, b.h, "#1c2230", 1); R(cx - 9, b.y + .8, 18, 6, "#2a3142", .4); R(cx - 9, b.y + 6.8, 18, 18, "#c4c8ce", .5); R(cx - 4, b.y + b.h - 5.5, 8, 5.5, "#b8bcc2", .4); R(cx - 6.5, b.y + b.h - 13, 3, 2, "#e9e9e9", .3); R(cx + 3.5, b.y + b.h - 13, 3, 2, "#e9e9e9", .3); }
    else if (fp === "st7789") { R(b.x, b.y, b.w, b.h, "#1f4e96", 1); R(b.x + 1.5, b.y + 5.5, b.w - 3, b.h - 7.5, "#0b0e13", .8); R(b.x + 3, b.y + 7.5, b.w - 6, b.h - 11.5, "#1a2433", .4); }
    else if (fp === "hcsr04") { R(b.x, b.y, b.w, b.h, "#1d5fae", 1); for (const x of [cx - 13.25, cx + 13.25]) { el("circle", { cx: x, cy, r: 8, fill: "#c9cdd2" }, g); el("circle", { cx: x, cy, r: 6.3, fill: "#2b2f35" }, g); } R(cx - 2.5, b.y + 2, 5, 3, "#c9cdd2", .4); }
    else if (fp === "ws2812") { R(b.x, b.y, b.w, b.h, "#15171b", 1); R(cx - 3, cy - 3, 6, 6, "#f3f3f3", .5); el("circle", { cx, cy, r: 2, fill: "#ffd84a" }, g); }
    else if (fp === "ssd1306") { R(b.x, b.y, b.w, b.h, "#1b3d8f", 1); R(b.x + .8, b.y + 5, b.w - 1.6, b.h - 8, "#0b0e13", .5); R(b.x + 2, b.y + 6.5, b.w - 4, b.h - 13, "#16334f", .3); }
    else if (fp === "sevseg") { R(b.x, b.y, b.w, b.h, "#2a2c31", .5); for (const [x, y, w, h] of [[3, 2, 6, 1], [3, 9, 6, 1], [3, 16, 6, 1], [2, 3, 1, 6], [9, 3, 1, 6], [2, 10, 1, 6], [9, 10, 1, 6]]) R(b.x + x, b.y + y, w, h, "#7a2a2a", .3); }
    else if (fp === "vl53l0x") { R(b.x, b.y, b.w, b.h, "#5b3a9e", 1); R(cx - 2.2, b.y + b.h - 5, 4.4, 2.4, "#111", .3); }
    else if (fp === "mpu6050") { R(b.x, b.y, b.w, b.h, "#1d5fae", 1); R(cx - 2, cy, 4, 4, "#111", .3); }
    else if (fp === "dht22") { R(b.x, b.y, b.w, b.h, "#eceff1", 1); for (let k = 0; k < 6; k++) R(b.x + 2, b.y + 2 + k * 2.6, b.w - 4, 1.2, "#b9c0c5", .3); }
    else if (fp === "ldr") { R(b.x, b.y, b.w, b.h, "#1d5fae", 1); el("circle", { cx: b.x + b.w - 4, cy, r: 2.5, fill: "#e0a35a" }, g); R(b.x + 12, cy - 3, 6, 6, "#2d6fd8", .4); }
    else if (fp === "max98357a") { R(b.x, b.y, b.w, b.h, "#2a2d34", 1); R(cx - 2, cy - 2, 4, 4, "#111", .3); R(b.x + 3, b.y + .8, b.w - 6, 4, "#2e9d52", .3); }
    else if (fp === "inmp441") { el("circle", { cx, cy, r: b.w / 2, fill: "#1d5fae" }, g); el("rect", { x: cx - 2, y: cy - 1.5, width: 4, height: 3, rx: .4, fill: "#c9cdd2" }, g); }
    else if (fp === "button") { R(b.x, b.y, b.w, b.h, "#2a2c31", .4); el("circle", { cx, cy, r: 1.8, fill: "#555b66" }, g); }
    else if (fp === "led") el("circle", { cx, cy, r: 2.5, fill: "#e33" }, g);
    else if (fp === "buzzer") { el("circle", { cx, cy, r: 6, fill: "#15171b" }, g); el("circle", { cx, cy, r: 1, fill: "#444" }, g); }
    else if (fp === "R") { R(b.x, b.y, b.w, b.h, "#d8c194", b.h / 2); [["#7b4a1e", .25], ["#111", .45], ["#c42a2a", .62]].forEach(([c, u]) => R(b.x + b.w * u, b.y, .7, b.h, c, 0)); }
    else if (fp === "C") R(b.x, b.y, b.w, b.h, "#d9a83a", b.h / 2);
    else if (fp.startsWith("BRD:")) R(b.x, b.y, b.w, b.h, "#1c2230", 1);
    else if (fp.startsWith("HDR:")) R(b.x, b.y, b.w, b.h, "#15171b", .3);   // hàng rào header nhựa đen
  }

  /* ---------- xuất file in 1:1 (đơn vị mm) ---------- */
  // cu: mặt đồng đen trên nền trắng, chấm trắng giữa pad = tâm khoan. silk: hướng dẫn cắm linh kiện + dây nhảy.
  // In ủi nhiệt mặt đồng: in KHÔNG lật (úp giấy xuống đồng là tự lật đúng). Bản "lật gương" cho phim / cách làm khác.
  // nhãn tên chân của hàng rào J1 (in lên mặt linh kiện để cắm dây Dupont đúng chân board)
  const hdrText = (f, fs) => f.hdr ? f.pads.map(p => `<text x="${p.x}" y="${p.y - 2}" font-size="${fs}" font-weight="700" font-family="sans-serif" dominant-baseline="central" transform="rotate(-90 ${p.x} ${p.y - 2})">${pinLabel(p.name)}</text>`).join("") : "";
  // tên 2 đầu dây nhảy (J1a / J1b) cạnh lỗ, để biết hàn dây nào vào đâu
  const extText = (j, fs) => [[j.a, "a"], [j.b, "b"]].map(([e, s]) => `<text x="${e[0] + 1.2}" y="${e[1] - 1}" font-size="${fs}" font-weight="700" font-family="sans-serif">J${extNo(j)}${s}</text>`).join("");
  function exportSVG(kind, mirror) {
    const B = S.board, P = pads(), o = [];
    o.push(`<svg xmlns="${NS}" width="${B.w}mm" height="${B.h}mm" viewBox="0 0 ${B.w} ${B.h}"><rect width="${B.w}" height="${B.h}" fill="#fff"/>`);
    o.push(`<g${mirror ? ` transform="translate(${B.w} 0) scale(-1 1)"` : ""}><rect x=".1" y=".1" width="${B.w - .2}" height="${B.h - .2}" rx="1.5" fill="none" stroke="#000" stroke-width=".2"/>`);
    for (const [x, y] of [[3.5, 3.5], [B.w - 3.5, 3.5], [3.5, B.h - 3.5], [B.w - 3.5, B.h - 3.5]]) o.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="none" stroke="#000" stroke-width=".3"/>`);
    if (kind === "cu") {
      if (S.pour) o.push(`<path d="${pour().d}" fill="#000"/>`);
      for (const t of S.traces) o.push(`<path d="M${t.pts.map(p => p.join(" ")).join(" L")}" fill="none" stroke="#000" stroke-width="${traceW(t)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      for (const p of P) { const r = p.r || PAD_R; o.push(p.sq ? `<rect x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}" fill="#000"/>` : `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#000"/>`, `<circle cx="${p.x}" cy="${p.y}" r=".3" fill="#fff"/>`); }
    } else if (kind === "mark") {
      // ký hiệu in lụa (sơn trắng) mặt linh kiện: nét mảnh 0,15 mm, đánh dấu chân 1, tên + giá trị, dây nhảy.
      // Chừa trống quanh mọi chân (vòng trắng che lên) để sơn không phủ vào lỗ / chỗ hàn
      for (const c of S.comps) {
        const f = FP[c.fp], b = f.body, cx = b.x + b.w / 2, cy = b.y + b.h / 2, p1 = f.pads.find(p => p.sq) || f.pads[0];
        o.push(`<g transform="translate(${c.x} ${c.y}) rotate(${c.rot})"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${f.round ? b.h / 2 : .6}" fill="none" stroke="#000" stroke-width=".15"/>`
          + (p1 ? `<circle cx="${p1.x - PAD_R - .9}" cy="${p1.y}" r=".35" fill="#000"/>` : "") + hdrText(f, 1.2)
          + (f.label ? `<text x="${cx}" y="${cy}" font-size="1.6" font-family="sans-serif" text-anchor="middle" dominant-baseline="central"${c.rot % 180 ? ` transform="rotate(-90 ${cx} ${cy})"` : ""}>${f.label}</text>` : "")
          + `<text x="${b.x + .4}" y="${b.y - .6}" font-size="1.3" font-weight="700" font-family="sans-serif">${c.id}${c.val ? " " + c.val : ""}</text></g>`);
      }
      for (const j of S.jumpers) o.push(`<line x1="${j.a[0]}" y1="${j.a[1]}" x2="${j.b[0]}" y2="${j.b[1]}" stroke="#000" stroke-width=".15" stroke-dasharray=".8 .5"/>` + extText(j, 1.2));
      for (const p of P) o.push(`<circle cx="${p.x}" cy="${p.y}" r="${(p.r || PAD_R) + .25}" fill="#fff"/>`);
    } else {
      for (const c of S.comps) {
        const f = FP[c.fp], b = f.body, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        o.push(`<g transform="translate(${c.x} ${c.y}) rotate(${c.rot})"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${f.round ? b.h / 2 : .6}" fill="none" stroke="#000" stroke-width=".2"/>`
          + hdrText(f, 1.3) + (f.label ? `<text x="${cx}" y="${cy}" font-size="2" font-family="sans-serif" text-anchor="middle" dominant-baseline="central"${c.rot % 180 ? ` transform="rotate(-90 ${cx} ${cy})"` : ""}>${f.label}</text>` : "")
          + `<text x="${b.x + .6}" y="${b.y - .8}" font-size="1.5" font-weight="700" font-family="sans-serif">${c.id}${c.val ? " " + c.val : ""}</text></g>`);
      }
      for (const p of P) o.push(`<circle cx="${p.x}" cy="${p.y}" r="${(p.r || PAD_R) * .8}" fill="none" stroke="#000" stroke-width=".15"/>`);
      for (const j of S.jumpers) o.push(`<line x1="${j.a[0]}" y1="${j.a[1]}" x2="${j.b[0]}" y2="${j.b[1]}" stroke="#000" stroke-width="${j.ext ? .2 : .35}"${j.ext ? ' stroke-dasharray="1.2 .6"' : ""} stroke-linecap="round"/>` + extText(j, 1.4));
    }
    return o.join("") + "</g></svg>";
  }
  const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  // PNG có ghi DPI (chunk pHYs) để phần mềm in đúng kích thước thật
  function pngDPI(buf, dpi) {
    const crcT = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
    const ppm = Math.round(dpi / .0254), ch = new Uint8Array(21), dv = new DataView(ch.buffer);
    dv.setUint32(0, 9); ch.set([112, 72, 89, 115], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); ch[16] = 1; dv.setUint32(17, crc(ch.subarray(4, 17)));
    const src = new Uint8Array(buf), out = new Uint8Array(src.length + 21);
    out.set(src.subarray(0, 33)); out.set(ch, 33); out.set(src.subarray(33), 54); return out;
  }
  // tạo 1 file: SVG / PNG 600 DPI (có ghi DPI để in đúng 1:1)
  function layerBlob(kind, mirror, fmt) {
    const svgTxt = exportSVG(kind, mirror);
    if (fmt === "svg") return Promise.resolve(new Blob([svgTxt], { type: "image/svg+xml" }));
    return new Promise(ok => {
      const dpi = 600, img = new Image(), B = S.board;
      img.onload = () => {
        const cv = document.createElement("canvas"); cv.width = Math.round(B.w / 25.4 * dpi); cv.height = Math.round(B.h / 25.4 * dpi);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(b => b.arrayBuffer().then(buf => ok(new Blob([pngDPI(buf, dpi)], { type: "image/png" }))), "image/png");
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTxt);
    });
  }
  /* ---------- Gerber RS-274X + khoan Excellon (gửi xưởng / phay CNC). Đồng ở mặt dưới, linh kiện mặt trên, toạ độ nhìn từ mặt trên ---------- */
  const DRILL = { pad: 1.0, jw: .8, mount: 3.2 };
  function gerber() {
    const B = S.board, P = pads(), n = v => Math.round(v * 1e6), X = (x, y) => `X${n(x)}Y${n(B.h - y)}`;
    const head = (fn, pol) => [`G04 Pindexio PCB Maker*`, `%TF.FileFunction,${fn}*%`, `%TF.FilePolarity,${pol || "Positive"}*%`, "%FSLAX46Y46*%", "%MOMM*%", "%LPD*%"];
    const layer = (fn, draw) => {
      const ap = new Map(), body = [], use = k => { if (!ap.has(k)) ap.set(k, 10 + ap.size); body.push(`D${ap.get(k)}*`); };
      const api = {
        line: (pts, w) => { use(`C,${w.toFixed(3)}`); pts.forEach((p, i) => body.push(X(p[0], p[1]) + (i ? "D01*" : "D02*"))); },
        flash: (x, y, d, sq) => { use(sq ? `R,${d.toFixed(3)}X${d.toFixed(3)}` : `C,${d.toFixed(3)}`); body.push(X(x, y) + "D03*"); }
      };
      draw(api);
      return [...head(fn), ...[...ap].map(([k, d]) => `%ADD${d}${k}*%`), "G01*", ...body, "M02*"].join("\n") + "\n";
    };
    const padD = p => 2 * (p.r || PAD_R);
    const cu = layer("Copper,L2,Bot", g => { for (const t of S.traces) g.line(t.pts, traceW(t)); for (const p of P) g.flash(p.x, p.y, padD(p), p.sq); });
    const mask = layer("Soldermask,Bot", g => { for (const p of P) g.flash(p.x, p.y, padD(p) + .2, p.sq); });
    const silk = layer("Legend,Top", g => {
      for (const c of S.comps) {
        const b = FP[c.fp].body, q = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x, b.y]].map(([x, y]) => { const [u, v] = rot(x, y, c.rot); return [c.x + u, c.y + v]; });
        g.line(q, .15);
      }
      for (const j of S.jumpers) g.line([j.a, j.b], .15);
    });
    const edge = layer("Profile,NP", g => g.line([[0, 0], [B.w, 0], [B.w, B.h], [0, B.h], [0, 0]], .1));
    // khoan: lỗ chân linh kiện, lỗ dây nhảy / lỗ đơn, 4 lỗ bắt vít góc
    const holes = new Map(), add = (d, x, y) => { const k = d.toFixed(2); if (!holes.has(k)) holes.set(k, []); holes.get(k).push([x, y]); };
    for (const p of P) add(p.r ? DRILL.jw : DRILL.pad, p.x, p.y);
    for (const [x, y] of [[3.5, 3.5], [B.w - 3.5, 3.5], [3.5, B.h - 3.5], [B.w - 3.5, B.h - 3.5]]) add(DRILL.mount, x, y);
    const tl = [...holes.keys()], f3 = v => v.toFixed(3);
    const drl = ["M48", "; Pindexio PCB Maker", "METRIC,TZ", ...tl.map((d, i) => `T${i + 1}C${d}`), "%", "G90", "G05",
      ...tl.flatMap((d, i) => [`T${i + 1}`, ...holes.get(d).map(([x, y]) => `X${f3(x)}Y${f3(B.h - y)}`)]), "M30"].join("\n") + "\n";
    return [["copper_bottom.gbl", cu], ["soldermask_bottom.gbs", mask], ["silkscreen_top.gto", silk], ["board_outline.gko", edge], ["drill.drl", drl]];
  }
  // file .zip kiểu "store" (không nén): đủ nhẹ, mọi trình giải nén / xưởng đều đọc được
  async function zip(files) {
    const T = [...Array(256)].map((_, k) => { let c = k; for (let i = 0; i < 8; i++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = b => { let c = ~0; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    for (const [name, data] of files) {
      const d = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : enc.encode(data), nm = enc.encode(name), c = crc(d);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
      const e = new DataView(new ArrayBuffer(46)); e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint32(16, c, true); e.setUint32(20, d.length, true); e.setUint32(24, d.length, true); e.setUint16(28, nm.length, true); e.setUint32(42, off, true);
      parts.push(h, nm, d); cen.push(e, nm); off += 30 + nm.length + d.length;
    }
    const size = cen.reduce((s, x) => s + x.byteLength, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cen, end], { type: "application/zip" });
  }
  /* ---------- hộp thoại Export: đặt tên, chọn định dạng, chọn lớp, xem trước ---------- */
  const LAYERS = () => [
    ["cu", L("Mặt đồng", "Copper"), L("in ủi nhiệt lên tấm đồng", "toner transfer onto the copper"), "mat-dong"],
    ["mark", L("Ký hiệu sơn trắng", "Silkscreen marks"), L("in lên mặt linh kiện", "print on the component side"), "ky-hieu"],
    ["silk", L("Mặt linh kiện", "Component side"), L("hướng dẫn cắm linh kiện", "assembly guide"), "mat-linh-kien"]];
  function exportDialog() {
    let o; try { o = JSON.parse(localStorage.getItem("pcbmaker-exp") || "null"); } catch (e) { }
    o = Object.assign({ name: "pindexio-pcb", fmt: "svg", on: { cu: 1 }, mir: { mark: 1 } }, o || {});
    const d = document.createElement("div"); d.className = "pl-beta pl-exp"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    const draw = () => {
      const gbr = o.fmt === "gbr", first = LAYERS().find(l => o.on[l[0]]);
      d.innerHTML = `<div class="pl-exp-box"><h3>${L("Xuất file", "Export")}</h3>
        <label class="pl-exp-row"><span>${L("Tên file", "File name")}</span><input id="plExpName" value="${o.name.replace(/"/g, "")}" spellcheck="false"></label>
        <div class="pl-exp-row"><span>${L("Định dạng", "Format")}</span><div class="pl-seg">${[["svg", "SVG"], ["png", "PNG"], ["gbr", "Gerber"]].map(([k, t]) => `<button type="button" data-fmt="${k}"${o.fmt === k ? ' class="on"' : ""}>${t}</button>`).join("")}</div></div>
        <p class="pl-exp-sub">${{ svg: L("Vector, in tỉ lệ 100%", "Vector, print at 100%"), png: L("Ảnh 600 DPI, in tỉ lệ 100%", "600 DPI image, print at 100%"), gbr: L("Gửi xưởng làm bo / phay CNC · 1 file .zip", "For PCB fabs / CNC milling · one .zip") }[o.fmt]}</p>
        ${gbr ? `<ul class="pl-exp-files">${gerber().map(([n]) => `<li>${n}</li>`).join("")}</ul>${S.pour ? `<p class="pl-exp-warn">${L("Phủ mass GND chưa có trong Gerber.", "GND pour is not included in Gerber.")}</p>` : ""}`
          : `<div class="pl-exp-layers">${LAYERS().map(([k, t, sub]) => `<label class="pl-exp-l${o.on[k] ? " on" : ""}"><input type="checkbox" data-on="${k}"${o.on[k] ? " checked" : ""}><span><b>${t}</b><small>${sub}</small></span>${k === "silk" ? "" : `<button type="button" class="pl-mir${o.mir[k] ? " on" : ""}" data-mir="${k}" title="${L("Lật gương", "Mirror")}">⇋</button>`}</label>`).join("")}</div>
             <div class="pl-exp-prev">${first ? exportSVG(first[0], !!o.mir[first[0]]) : `<span>${L("Chọn ít nhất 1 lớp", "Pick at least one layer")}</span>`}</div>`}
        ${A.rats.length || A.drc.length ? `<p class="pl-exp-warn">${L(`Bo còn ${A.rats.length} chỗ chưa nối, ${A.drc.length} lỗi – file chỉ nên dùng để xem thử.`, `${A.rats.length} open connections, ${A.drc.length} errors – use the file as a preview only.`)}</p>` : ""}
        <div class="pl-exp-foot"><button type="button" class="pl-exp-cancel">${L("Huỷ", "Cancel")}</button><button type="button" class="pl-try" id="plExpGo"${!gbr && !first ? " disabled" : ""}>⬇ ${L("Tải xuống", "Download")}</button></div></div>`;
      d.querySelector("#plExpName").oninput = e => o.name = e.target.value;
      d.querySelectorAll("[data-fmt]").forEach(b => b.onclick = () => { o.fmt = b.dataset.fmt; draw(); });
      d.querySelectorAll("[data-on]").forEach(b => b.onchange = () => { o.on[b.dataset.on] = b.checked ? 1 : 0; draw(); });
      d.querySelectorAll("[data-mir]").forEach(b => b.onclick = e => { e.preventDefault(); o.mir[b.dataset.mir] = o.mir[b.dataset.mir] ? 0 : 1; draw(); });
      d.querySelector(".pl-exp-cancel").onclick = () => d.remove();
      d.querySelector("#plExpGo").onclick = go;
    };
    async function go() {
      const base = (o.name || "pindexio-pcb").trim().replace(/[\\/:*?"<>|]+/g, "-");
      try { localStorage.setItem("pcbmaker-exp", JSON.stringify(o)); } catch (e) { }
      d.remove();
      if (o.fmt === "gbr") { download(await zip(gerber()), base + "-gerber.zip"); return toast(L(`Đã tải ${base}-gerber.zip (đồng mặt dưới, phủ hàn, in lụa, viền bo, khoan).`, `Downloaded ${base}-gerber.zip (bottom copper, mask, silkscreen, outline, drill).`)); }
      const files = [];
      for (const [k, , , slug] of LAYERS()) if (o.on[k]) files.push([`${base}-${slug}${o.mir[k] ? "-lat-guong" : ""}.${o.fmt}`, await layerBlob(k, !!o.mir[k], o.fmt)]);
      if (files.length === 1) download(files[0][1], files[0][0]); else download(await zip(files), `${base}-${o.fmt}.zip`);
      toast(L(`Đã tải ${files.length > 1 ? base + "-" + o.fmt + ".zip" : files[0][0]} – in tỉ lệ 100% (không co giãn).`, `Downloaded ${files.length > 1 ? base + "-" + o.fmt + ".zip" : files[0][0]} – print at 100% scale (no fit-to-page).`));
    }
    d.onclick = e => { if (e.target === d) d.remove(); };
    draw(); ROOT.appendChild(d); d.querySelector("#plExpName").focus();
  }

  /* ---------- camera ---------- */
  function fit() { const B = S.board; cam = { x: -6, y: -6, w: B.w + 12, h: B.h + 12 }; applyCam(); }
  function applyCam() {
    const r = svg.getBoundingClientRect(); if (!r.width || !r.height) return;
    const ar = r.width / r.height, c = cam;
    let w = c.w, h = c.h; if (w / h < ar) w = h * ar; else h = w / ar;
    svg.setAttribute("viewBox", `${c.x - (w - c.w) / 2} ${c.y - (h - c.h) / 2} ${w} ${h}`); ui.k = w / r.width;
  }
  // toV: toạ độ khung nhìn (camera); toMM: toạ độ trên bo (đã tính lật mặt)
  const toPt = (e, node) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(node.getScreenCTM().inverse()); };
  const toV = e => toPt(e, svg), toMM = e => toPt(e, LY.root);

  /* ---------- thao tác ---------- */
  const ui = { sel: null, mode: "idle", hlNet: null, k: .1 };
  const padAt = p => { let best = null, bd = PAD_R + .35; for (const q of A.P) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } } return best; };
  function segAt(p) {
    let best = null, bd = 1e9;
    for (const t of S.traces) for (let k = 0; k < t.pts.length - 1; k++) { const d = segDist(p.x, p.y, t.pts[k][0], t.pts[k][1], t.pts[k + 1][0], t.pts[k + 1][1]); if (d < Math.max(traceW(t) / 2 + .35, 1.1) && d < bd) { bd = d; best = { t, k }; } }
    return best;
  }
  const compAt = p => { for (const c of [...S.comps].reverse()) { const b = compBox(c); if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) return c; } return null; };
  const toast = m => { const t = $("#plToast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2600); };

  // vẽ đường bằng tay: 2 đoạn theo tư thế 45°: thẳng-rồi-chéo hoặc chéo-rồi-thẳng (phím /)
  function posture(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy), d = Math.min(ax, ay), sx = Math.sign(dx), sy = Math.sign(dy);
    if (!ax || !ay || ax === ay) return [b];
    if (SCHEMES[S.scheme].dirs === 4) return S.posture ? [[a[0], b[1]], b] : [[b[0], a[1]], b];
    const m = S.posture ? [a[0] + sx * d, a[1] + sy * d] : (ax > ay ? [a[0] + sx * (ax - d), a[1]] : [a[0], a[1] + sy * (ay - d)]);
    return [[r3(m[0]), r3(m[1])], b];
  }
  function startRoute(net, start) {
    ui.mode = "route"; ui.route = { net, pts: [start], cur: start }; ui.hlNet = net; svg.classList.add("routing");
    $("#plHint").textContent = L("Bấm nền để đặt góc · bấm chân cùng mạng để xong · / đổi tư thế 45° · Backspace bớt góc · Esc huỷ", "Click to place a corner · click a pin of the same net to finish · / flips the 45° posture · Backspace removes a corner · Esc cancels");
    render(); drawRoute();
  }
  function drawRoute() {
    const r = ui.route; LY.tmp.innerHTML = ""; if (!r) return;
    const last = r.pts[r.pts.length - 1], pts = [...r.pts, ...posture(last, r.cur)], w = PWR.has(r.net) ? W_PWR : W_SIG;
    const tmpT = { net: r.net, pts }, bad = drc(A.P).length !== quickBad(tmpT, w);
    el("path", { d: "M" + pts.map(p => p.join(" ")).join(" L"), "stroke-width": w, class: "cu tmp" + (bad ? " bad" : "") }, LY.tmp);
  }
  function quickBad(tmp, w) { const keep = S.traces; S.traces = [...keep, { ...tmp, id: -1, w }]; const n = drc(A.P).length; S.traces = keep; return n; }
  // đang vẽ chạm vật khác mạng: được nối nếu một trong hai là mạng trống (dây tự do)
  function joinNet(n) {
    const r = ui.route; if (!n || !(isFree(n) || isFree(r.net))) return false;
    r.pendJoin = isFree(r.net) ? [r.net, n] : [n, r.net]; return true;
  }
  function finishRoute(end, hit) {   // hit: đầu cuối chạm chân / lỗ / đường (không cần lỗ mới)
    const r = ui.route, last = r.pts[r.pts.length - 1], pts = [...r.pts, ...posture(last, end)];
    const clean = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (r.free >= 1 && !hit && !holeOK(end[0], end[1], r.net, pads())) { delete r.pendJoin; return toast(L("Đầu dây quá sát chân hoặc đường khác – không đặt lỗ được ở đây.", "Wire end too close to a pin or another trace – can't put a hole here.")); }
    if (clean.length >= 2) {
      checkpoint(); let net = r.net;
      if (r.pendJoin) { adopt(...r.pendJoin); if (net === r.pendJoin[0]) net = r.pendJoin[1]; }
      if (r.free === 2 && !r.startHit) addHole(clean[0], net);
      if (r.free >= 1 && !hit) addHole(end, net);
      const nt = { id: S.uid++, net, pts: simplify(clean), lock: true }; S.traces.push(nt); ui.sel = { t: "t", id: nt.id };
      const onT = e => nt.pts.some((q, k) => k && segDist(e[0], e[1], nt.pts[k - 1][0], nt.pts[k - 1][1], q[0], q[1]) < .3);
      const n0 = S.jumpers.length; S.jumpers = S.jumpers.filter(j => !(j.net === net && onT(j.a) && onT(j.b)));
      if (S.jumpers.length < n0) { gcHoles(); toast(L("Đã thay nét nhảy bằng đường đồng.", "Jumper replaced with copper.")); }
    }
    cancel(); render();
  }

  // dây nhảy: chọn đường → J / chuột phải → bấm 2 điểm trên đường → cắt bỏ đoạn giữa, thêm 2 lỗ nhỏ, bắc nét trắng
  function proj(t, p) {
    let best = null, acc = 0;
    for (let k = 0; k < t.pts.length - 1; k++) {
      const a = t.pts[k], b = t.pts[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-9, u = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (l * l)));
      const q = [r3(a[0] + u * dx), r3(a[1] + u * dy)], d = Math.hypot(p.x - q[0], p.y - q[1]);
      if (!best || d < best.d) best = { d, k, q, s: acc + u * l }; acc += l;
    }
    return best;
  }
  function startJump(t) {
    cancel(); ui.mode = "jump"; ui.jump = { tid: t.id, picks: [] }; ui.sel = { t: "t", id: t.id }; ui.hlNet = t.net; svg.classList.add("routing");
    $("#plHint").textContent = L("Dây nhảy: bấm 2 điểm trên đường đang chọn để cắt · Esc huỷ", "Jumper: click 2 points on the selected trace to cut · Esc cancels"); render();
  }
  function drawJump(p) {
    LY.tmp.innerHTML = ""; const J = ui.jump, t = S.traces.find(x => x.id === J.tid); if (!t) return;
    const m = J.picks.map(x => x.q); if (p) { const pr = proj(t, p); if (pr.d < 2) m.push(pr.q); }
    m.forEach(q => el("circle", { cx: q[0], cy: q[1], r: JP_R, class: "jmark" }, LY.tmp));
    if (m.length === 2) el("line", { x1: m[0][0], y1: m[0][1], x2: m[1][0], y2: m[1][1], class: "jcut" }, LY.tmp);
  }
  function pickJump(p) {
    const J = ui.jump, t = S.traces.find(x => x.id === J.tid), pr = proj(t, p);
    if (pr.d > 2) return toast(L("Bấm lên chính đường đang chọn.", "Click on the selected trace itself."));
    J.picks.push(pr); if (J.picks.length < 2) return drawJump();
    let [a, b] = J.picks; if (a.s > b.s) [a, b] = [b, a];
    const P = pads(), why = Math.hypot(a.q[0] - b.q[0], a.q[1] - b.q[1]) < JP_MIN ? L("Hai điểm cắt phải cách nhau ít nhất 5,08 mm (2 ô).", "The two cut points must be at least 5.08 mm (2 grid steps) apart.")
      : !holeOK(a.q[0], a.q[1], t.net, P) || !holeOK(b.q[0], b.q[1], t.net, P) ? L("Chỗ cắt quá sát chân linh kiện hoặc đường khác – chọn chỗ thoáng hơn.", "Cut point too close to a pin or another trace – pick a clearer spot.")
        : !lineOK(a.q, b.q, t.net, P) ? L("Dây nhảy sẽ đè lên chân linh kiện khác mạng – chọn chỗ khác.", "The jumper would pass over a pin of another net – pick another spot.") : "";
    if (why) { J.picks.pop(); drawJump(); return toast(why); }
    checkpoint();
    const clean = pts => pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
    S.traces = S.traces.filter(x => x !== t);
    for (const pts of [clean([...t.pts.slice(0, a.k + 1), a.q]), clean([b.q, ...t.pts.slice(b.k + 1)])]) if (pts.length >= 2) S.traces.push({ id: S.uid++, net: t.net, pts, lock: true, w: t.w });
    S.jumpers.push({ id: S.uid++, net: t.net, a: a.q, b: b.q });
    cancel(); ui.sel = null; render(); toast(L("Đã cắt đường và bắc dây nhảy (nét trắng). Chỗ trống giờ cho đường khác đi qua.", "Trace cut and bridged with a jumper (white line). The gap is now free for other traces."));
  }
  // lỗ tự do: đang vẽ → J đặt lỗ ở đầu bút; chọn đường → J rồi bấm 1 điểm trên đường. Sau đó kéo dây nhảy tới chỗ khác.
  function placeHole() {
    if (ui.mode === "route") {
      const q = ui.route.cur, net = ui.route.net, P = pads();
      const on = P.find(p => Math.hypot(p.x - q[0], p.y - q[1]) < PAD_R);   // đầu bút trên lỗ / chân có sẵn: bắc dây nhảy từ đó
      if (on) { if (on.net !== net && !joinNet(on.net)) return toast(L(`Chân ${on.name} thuộc mạng khác.`, `Pin ${on.name} is on another net.`)); const n2 = ui.route.pendJoin ? ui.route.pendJoin[1] : net; if (ui.route.pts.length > 1 || ui.route.pendJoin) finishRoute([on.x, on.y], true); else cancel(); return startJfree(n2, [on.x, on.y]); }
      if (!holeOK(q[0], q[1], net, P)) return toast(L("Chỗ này quá sát chân hoặc đường khác – chọn chỗ thoáng hơn.", "Too close to a pin or another trace – pick a clearer spot."));
      finishRoute(q); startJfree(net, q); ui.jf.cont = true; return;
    }
    cancel(); ui.mode = "hole"; ui.hole = {}; svg.classList.add("routing");
    $("#plHint").textContent = L("Dây nhảy: bấm điểm đầu (chân, lỗ, đường đồng hoặc chỗ trống) · Esc huỷ", "Jumper: click the start (pin, hole, trace or free spot) · Esc cancels"); render();
  }
  function pickHole(p) {
    const pd = padAt(p);
    if (pd) { if (!pd.net) return toast(L(`Chân ${pd.name} không dùng trong mạch.`, `Pin ${pd.name} is not used in the circuit.`)); return startJfree(pd.net, [pd.x, pd.y]); }
    const sg = segAt(p), pr = sg && proj(sg.t, p), q = pr && pr.d < traceW(sg.t) / 2 + .3 ? pr.q.map(r3) : [snap(p.x, SN), snap(p.y, SN)], net = pr && pr.d < traceW(sg.t) / 2 + .3 ? sg.t.net : "~" + S.uid++;
    if (!holeOK(q[0], q[1], net, pads())) return toast(L("Chỗ này quá sát chân hoặc đường khác – chọn chỗ thoáng hơn.", "Too close to a pin or another trace – pick a clearer spot."));
    startJfree(net, q);
  }
  function startJfree(net, a) {
    cancel(); ui.mode = "jfree"; ui.jf = { net, a, cur: a }; ui.hlNet = net; svg.classList.add("routing");
    $("#plHint").textContent = L("Dây nhảy: bấm chỗ đặt lỗ thứ 2 (hoặc chân / đường cùng mạng) · Esc huỷ", "Jumper: click where the 2nd hole goes (or a pin / trace of the same net) · Esc cancels"); render(); drawJfree();
  }
  function drawJfree() {
    const J = ui.jf; LY.tmp.innerHTML = ""; if (!J) return;
    el("circle", { cx: J.a[0], cy: J.a[1], r: JP_R, class: "jmark" }, LY.tmp); el("circle", { cx: J.cur[0], cy: J.cur[1], r: JP_R, class: "jmark" }, LY.tmp);
    el("line", { x1: J.a[0], y1: J.a[1], x2: J.cur[0], y2: J.cur[1], class: "jcut" }, LY.tmp);
  }
  function pickJfree(p, g) {
    const J = ui.jf, P = pads(), pd = padAt(p);
    let b = g, end = false;
    // khác mạng chỉ nối được khi một bên là mạng trống (dây tự do): bên trống nhận mạng bên kia
    const ok = n => n === J.net || (n && (isFree(n) || isFree(J.net)));
    if (pd) { if (!ok(pd.net)) return toast(L(`Chân ${pd.name} thuộc mạng ${pd.net || "trống"}, không nối được.`, `Pin ${pd.name} is on net ${pd.net || "none"}, can't connect.`)); b = [pd.x, pd.y]; end = pd.net; }
    else { const sg = segAt(p); if (sg && ok(sg.t.net)) { b = proj(sg.t, p).q.map(r3); end = sg.t.net; } }
    if (Math.hypot(b[0] - J.a[0], b[1] - J.a[1]) < G - .01) return toast(L("Hai đầu dây nhảy phải cách nhau ít nhất 2,54 mm.", "Jumper ends must be at least 2.54 mm apart."));
    if (!pd && !holeOK(b[0], b[1], J.net, P)) return toast(L("Chỗ này quá sát chân hoặc đường khác – chọn chỗ thoáng hơn.", "Too close to a pin or another trace – pick a clearer spot."));
    checkpoint();
    if (end && end !== J.net) { const [from, to] = isFree(J.net) ? [J.net, end] : [end, J.net]; adopt(from, to); J.net = to; }
    const j = { id: S.uid++, net: J.net, a: J.a, b };
    if (!lineOK(J.a, b, J.net, P)) j.ext = true;   // đi ngang chân khác mạng: dùng dây có vỏ bọc
    S.jumpers.push(j);
    const len = Math.hypot(b[0] - J.a[0], b[1] - J.a[1]), cp = P.filter(q => !q.jw && !q.hole), near = Math.min(...[J.a, b].filter(e => !cp.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .1)).map(e => Math.min(...cp.map(q => Math.hypot(q.x - e[0], q.y - e[1])))));   // chỉ xét lỗ mới, không xét đầu nằm trên chân
    const warn = (len < 10 ? L(` · ⚠ dây chỉ dài ${len.toFixed(1)} mm (nên ≥ 10 mm)`, ` · ⚠ only ${len.toFixed(1)} mm long (≥ 10 mm advised)`) : "") + (near < 5 ? L(` · ⚠ lỗ cách chân ${near.toFixed(1)} mm (nên ≥ 5 mm)`, ` · ⚠ hole ${near.toFixed(1)} mm from a pin (≥ 5 mm advised)`) : "");
    if (end) { cancel(); ui.sel = { t: "j", id: j.id }; render(); return toast(L("Đã nối xong. Chuột phải lên nét nhảy → Đổi thành đồng, hoặc dùng Bút đồng tô lên.", "Connected. Right-click a jumper → Convert to copper, or trace over it with the Copper pen.") + warn); }
    if (!J.cont) { startJfree(J.net, b); $("#plHint").textContent = L("Bấm tiếp điểm kế (tạo lỗ) hoặc chân / lỗ đích · chuột phải hoặc Esc để dừng", "Click the next point (adds a hole) or the target pin / hole · right-click or Esc to stop"); return warn && toast(warn.slice(3)); }
    startRoute(J.net, b); toast(L("Đã đặt dây nhảy – vẽ tiếp đường đồng từ lỗ thứ 2.", "Jumper placed – keep drawing copper from the 2nd hole.") + warn);
  }
  /* ---------- 4 công cụ kiểu bút chì: Chọn · Bút đồng · Bút dây nhảy · Gôm ---------- */
  const TOOLS = () => ({ sel: [L("Chọn", "Select"), L("Kéo linh kiện, chọn đường, kéo nền để di chuyển (Esc)", "Drag parts, select traces, drag the background to pan (Esc)")],
    cu: [L("Bút đồng", "Copper pen"), L("Bấm chân / lỗ / đường → bấm các góc → bấm chân cùng mạng để xong (B)", "Click a pin / hole / trace → click corners → click a pin of the same net to finish (B)")],
    jw: [L("Bút dây nhảy", "Jumper pen"), L("Bấm X → các điểm A, B… (tự tạo lỗ) → chân đích Y; chuột phải để dừng. Sau đó đổi nét thành đồng hoặc tô bằng Bút đồng (J)", "Click X → points A, B… (holes added) → target pin Y; right-click stops. Then convert to copper or trace over with the Copper pen (J)")],
    er: [L("Gôm", "Eraser"), L("Bôi qua đường đồng / dây nhảy để xoá đúng đoạn đó (E)", "Rub over copper / jumpers to erase just that part (E)")] });
  function setTool(t) {
    if (LY.tmp) cancel(); ui.tool = t; svg.dataset.tool = t;
    $$(".pl-tools [data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === t));
    $("#plHint").textContent = t === "sel" ? "" : TOOLS()[t][0] + ": " + TOOLS()[t][1];
  }
  // gôm: cắt bỏ phần đường đồng nằm trong vòng tròn bán kính ER quanh con trỏ, xoá hẳn dây nhảy bị bôi
  const ER = 1;
  function eraseAt(p) {
    let ch = false;
    const nj = S.jumpers.filter(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) >= ER);
    if (nj.length !== S.jumpers.length) { S.jumpers = nj; ch = true; }
    const out = [];
    for (const t of S.traces) {
      const rr = ER + traceW(t) / 2, pieces = []; let cur = [t.pts[0]], hit = false;
      for (let k = 1; k < t.pts.length; k++) {
        const a = t.pts[k - 1], b = t.pts[k], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, d = segDist(p.x, p.y, a[0], a[1], b[0], b[1]);
        if (!L2 || d >= rr) { cur.push(b); continue; }
        hit = true;
        const u = ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L2, h = Math.sqrt(rr * rr - d * d) / Math.sqrt(L2), at = v => [r3(a[0] + dx * v), r3(a[1] + dy * v)];
        if (u - h > 0) cur.push(at(u - h));
        pieces.push(cur); cur = u + h < 1 ? [at(u + h), b] : [b];
      }
      pieces.push(cur);
      if (!hit) { out.push(t); continue; }
      ch = true;
      for (const pc of pieces) { let len = 0; for (let k = 1; k < pc.length; k++) len += Math.hypot(pc[k][0] - pc[k - 1][0], pc[k][1] - pc[k - 1][1]); if (pc.length >= 2 && len > .3) out.push({ ...t, id: S.uid++, pts: pc, lock: true }); }
    }
    if (ch) { S.traces = out; ui.sel = null; render(); }
  }
  function toCopper(js) {
    checkpoint();
    for (const j of js) { S.jumpers = S.jumpers.filter(x => x !== j); S.traces.push({ id: S.uid++, net: j.net, pts: [j.a, j.b], lock: true }); }
    gcHoles(); ui.sel = null; render();
    toast(L(`Đã đổi ${js.length} dây nhảy thành đường đồng. Chỗ báo đỏ là đường đang chạm vật khác: kéo nắn lại hoặc gôm rồi vẽ lại.`, `Converted ${js.length} jumper(s) to copper. Red marks touch something else: drag to reshape, or erase and redraw.`));
  }
  const hideCtx = () => $("#plCtx").classList.remove("on");
  function cancel() { ui.mode = "idle"; ui.route = null; ui.jump = null; ui.hole = null; ui.jf = null; ui.drag = null; LY.tmp.innerHTML = ""; svg.classList.remove("routing"); $("#plHint").textContent = ""; }

  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    const p = toMM(e), g = [snap(p.x, SN), snap(p.y, SN)];
    if (e.button === 1) return startPan(e);
    if (ui.mode === "route") {
      const pd = padAt(p);
      if (pd) { if (pd.net !== ui.route.net && !joinNet(pd.net)) return toast(L(`Chân ${pd.name} thuộc mạng ${pd.net || "trống"}, không nối được.`, `Pin ${pd.name} is on net ${pd.net || "none"}, can't connect.`)); return finishRoute([pd.x, pd.y], true); }
      const sg = segAt(p), pj = sg && proj(sg.t, p); if (pj && pj.d < traceW(sg.t) / 2 + .3 && (sg.t.net === ui.route.net || joinNet(sg.t.net))) return finishRoute(pj.q.map(r3), true);
      const last = ui.route.pts[ui.route.pts.length - 1]; ui.route.pts.push(...posture(last, g).filter(q => q[0] !== last[0] || q[1] !== last[1])); drawRoute(); return;
    }
    if (ui.mode === "jump") return pickJump(p);
    if (ui.mode === "hole") return pickHole(p);
    if (ui.mode === "jfree") return pickJfree(p, g);
    if (ui.tool === "er") { checkpoint(); eraseAt(p); ui.drag = { move: q => eraseAt(q), up: () => { gcHoles(); render(); } }; return; }
    if (ui.tool === "jw") return pickHole(p);
    if (ui.tool === "cu") {
      const pd = padAt(p);
      if (pd) { if (!pd.net) return toast(L(`Chân ${pd.name} không dùng trong mạch.`, `Pin ${pd.name} is not used in the circuit.`)); return startRoute(pd.net, [pd.x, pd.y]); }
      const sg = segAt(p), pj = sg && proj(sg.t, p);
      if (pj && pj.d < traceW(sg.t) / 2 + .3) return startRoute(sg.t.net, pj.q.map(r3));
      return toast(L("Bút đồng: bấm vào chân, lỗ hoặc đường đồng để bắt đầu.", "Copper pen: click a pin, hole or trace to start."));
    }
    const vt = e.target.closest("[data-v]");
    if (vt && ui.sel && ui.sel.t === "t") return startVertex(e, +vt.dataset.v);
    const pd = padAt(p);
    if (pd && S.comps.includes(pd.c)) { ui.sel = { t: "c", id: pd.c.id }; ui.hlNet = pd.net; render(); return startComp(e, pd.c); }
    const jw = S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6);
    if (jw) { ui.sel = { t: "j", id: jw.id }; ui.hlNet = jw.net; return render(); }
    const sg = segAt(p);
    if (sg) { ui.sel = { t: "t", id: sg.t.id, k: sg.k }; ui.hlNet = sg.t.net; render(); return startSeg(e, sg); }
    const c = compAt(p);
    if (c) { ui.sel = { t: "c", id: c.id }; ui.hlNet = null; render(); return startComp(e, c); }
    ui.sel = null; ui.hlNet = null; render(); startPan(e);
  });
  svg.addEventListener("pointermove", e => {
    const p = toMM(e);
    if (ui.mode === "route") { const pd = padAt(p); ui.route.cur = pd && pd.net === ui.route.net ? [pd.x, pd.y] : [snap(p.x, SN), snap(p.y, SN)]; drawRoute(); return; }
    if (ui.mode === "jump") return drawJump(p);
    if (ui.mode === "jfree") { ui.jf.cur = [snap(p.x, SN), snap(p.y, SN)]; return drawJfree(); }
    if (ui.tool === "er") { LY.tmp.innerHTML = ""; el("circle", { cx: p.x, cy: p.y, r: ER, class: "erc" }, LY.tmp); }
    if (ui.drag) return ui.drag.move(p, e);
    const pd = padAt(p), tip = $("#plTip");
    if (pd) { tip.innerHTML = `<b>${pd.c.id} · ${pd.name}</b><br>${pd.net ? L("Mạng ", "Net ") + pd.net : L("<i>không dùng</i>", "<i>unused</i>")}`; tip.classList.add("on"); const r = $("#plStage").getBoundingClientRect(); tip.style.left = e.clientX - r.left + 14 + "px"; tip.style.top = e.clientY - r.top + 14 + "px"; }
    else tip.classList.remove("on");
    svg.style.cursor = ui.tool !== "sel" ? "" : pd ? "crosshair" : segAt(p) ? "move" : compAt(p) ? "grab" : "";
    const net = pd ? pd.net : null; if (net !== ui.hoverNet && !ui.sel) { ui.hoverNet = net; ui.hlNet = net; render(); }
  });
  addEventListener("pointerup", e => { if (ui.drag) { const d = ui.drag; ui.drag = null; d.up && d.up(); } });
  svg.addEventListener("pointerleave", () => $("#plTip").classList.remove("on"));
  svg.addEventListener("wheel", e => { e.preventDefault(); const f = e.deltaY < 0 ? 1 / 1.15 : 1.15, p = toV(e); cam.x = p.x - (p.x - cam.x) * f; cam.y = p.y - (p.y - cam.y) * f; cam.w *= f; cam.h *= f; applyCam(); }, { passive: false });
  svg.addEventListener("contextmenu", e => {
    e.preventDefault(); if (ui.mode !== "idle") { cancel(); return render(); }
    const p = toMM(e), vt = e.target.closest("[data-v]");
    if (vt && ui.sel && ui.sel.t === "t") return ctxMenu(e, [[L("Xoá điểm neo", "Delete vertex"), L("Đúp", "Dbl"), () => cmd.delVtx(+vt.dataset.v)]]);
    const jw = S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6);
    if (jw) { ui.sel = { t: "j", id: jw.id }; ui.hlNet = jw.net; render(); return ctxMenu(e, [[L("Đổi thành đường đồng", "Convert to copper"), "", () => toCopper([jw])], [L("Đổi mọi dây nhảy của mạng này", "Convert all jumpers of this net"), "", () => toCopper(S.jumpers.filter(j => j.net === jw.net))], [L("Xoá dây nhảy", "Delete jumper"), "Del", cmd.del]]); }
    const sg = segAt(p); if (!sg) return hideCtx();
    ui.sel = { t: "t", id: sg.t.id, k: sg.k }; ui.hlNet = sg.t.net; render();
    ctxMenu(e, [[L("Thêm điểm neo ở đây", "Add vertex here"), L("Đúp", "Dbl"), () => cmd.addVtx(p)], [L("Nắn ngang", "Make horizontal"), "H", () => cmd.straight("h")], [L("Nắn dọc", "Make vertical"), "V", () => cmd.straight("v")], [L("Nắn 45°", "Make 45°"), "A", () => cmd.straight("a")],
      [L("Dây nhảy", "Jumper"), "J", () => placeHole()], [L("Cắt bằng dây nhảy", "Cut with jumper"), "", cmd.jump], [sg.t.lock ? L("Bỏ khoá", "Unlock") : L("Khoá", "Lock"), "L", cmd.lock], [L("Xoá đường", "Delete trace"), "Del", cmd.del]]);
  });
  function ctxMenu(e, items) {
    const m = $("#plCtx"), r = $("#plStage").getBoundingClientRect();
    m.innerHTML = items.map((it, i) => `<button type="button" data-i="${i}">${it[0]} <kbd>${it[1]}</kbd></button>`).join("");
    m.style.left = e.clientX - r.left + "px"; m.style.top = e.clientY - r.top + "px"; m.classList.add("on");
    m.querySelectorAll("button").forEach(b => b.onclick = () => { hideCtx(); items[+b.dataset.i][2](); });
  }
  // đúp chuột: lên đoạn dây → thêm điểm neo; lên điểm neo → xoá
  svg.addEventListener("dblclick", e => {
    if (ui.mode !== "idle") return;
    const p = toMM(e), vt = e.target.closest("[data-v]");
    if (vt && ui.sel && ui.sel.t === "t") return cmd.delVtx(+vt.dataset.v);
    const sg = segAt(p); if (sg && !padAt(p)) { ui.sel = { t: "t", id: sg.t.id, k: sg.k }; cmd.addVtx(p); }
  });
  addEventListener("pointerdown", e => { if (!e.target.closest("#plCtx")) hideCtx(); }, true);

  function startPan(e) { const c0 = { ...cam }, x0 = e.clientX, y0 = e.clientY; ui.drag = { move: (p, ev) => { cam.x = c0.x - (ev.clientX - x0) * ui.k; cam.y = c0.y - (ev.clientY - y0) * ui.k; applyCam(); } }; }
  // kéo linh kiện: bám lưới 2,54; đầu đường đồng gắn vào chân đi theo
  function startComp(e, c) {
    const p0 = toMM(e), x0 = c.x, y0 = c.y, snapS = JSON.stringify(S), P0 = pads().filter(q => q.c === c), ends = [];
    for (const t of S.traces) for (const k of [0, t.pts.length - 1]) { const q = P0.find(q => Math.hypot(q.x - t.pts[k][0], q.y - t.pts[k][1]) < .05); if (q) ends.push({ t, k, i: q.i }); }
    let moved = false;
    ui.drag = {
      move: p => {
        const nx = snap(x0 + p.x - p0.x, G), ny = snap(y0 + p.y - p0.y, G); if (nx === c.x && ny === c.y) return; moved = true; c.x = nx; c.y = ny;
        // đầu đường đi theo chân; đường tự động vẫn để chưa khoá để Tự đi dây xoá và đi lại được
        for (const en of ends) { const pd = FP[c.fp].pads[en.i], [rx, ry] = rot(pd.x, pd.y, c.rot); en.t.pts[en.k] = [r3(c.x + rx), r3(c.y + ry)]; }
        render();
      },
      up: () => { if (moved) { pushRaw(snapS); afterParts([c.id]); } render(); }
    };
  }
  // kéo một đoạn: dịch song song theo pháp tuyến, giữ nối với chân bằng cách chèn điểm gập
  function startSeg(e, sg) {
    const t = sg.t, snapS = JSON.stringify(S); let k = sg.k;
    if (k === 0) { t.pts.unshift([...t.pts[0]]); k = 1; }
    if (k === t.pts.length - 2) t.pts.push([...t.pts[t.pts.length - 1]]);
    const a0 = [...t.pts[k]], b0 = [...t.pts[k + 1]], dx = b0[0] - a0[0], dy = b0[1] - a0[1], l = Math.hypot(dx, dy) || 1, n = [-dy / l, dx / l], p0 = toMM(e);
    let moved = false;
    ui.drag = {
      move: p => {
        const tt = (p.x - p0.x) * n[0] + (p.y - p0.y) * n[1], vx = snap(tt * n[0], Q), vy = snap(tt * n[1], Q);
        if (!vx && !vy && !moved) return; moved = true;
        t.pts[k] = [r3(a0[0] + vx), r3(a0[1] + vy)]; t.pts[k + 1] = [r3(b0[0] + vx), r3(b0[1] + vy)]; t.lock = true; render();
      },
      up: () => { t.pts = simplify(t.pts.filter((q, i) => i === 0 || q[0] !== t.pts[i - 1][0] || q[1] !== t.pts[i - 1][1])); if (moved) pushRaw(snapS); render(); }
    };
  }
  function startVertex(e, i) {
    const t = S.traces.find(x => x.id === ui.sel.id), snapS = JSON.stringify(S); let moved = false;
    ui.drag = { move: p => { const q = [snap(p.x, Q), snap(p.y, Q)]; if (q[0] === t.pts[i][0] && q[1] === t.pts[i][1]) return; moved = true; t.pts[i] = q; t.lock = true; render(); }, up: () => { if (moved) { t.pts = simplify(t.pts); pushRaw(snapS); } render(); } };
  }

  /* ---------- lệnh ---------- */
  const cmd = {
    undo() { if (!undo.length) return; redo.push(JSON.stringify(S)); S = JSON.parse(undo.pop()); ui.sel = null; render(); list(); },
    redo() { if (!redo.length) return; undo.push(JSON.stringify(S)); S = JSON.parse(redo.pop()); ui.sel = null; render(); list(); },
    del() {
      const s = ui.sel; if (!s) return;
      if (s.t === "j") { checkpoint(); S.jumpers = S.jumpers.filter(j => j.id !== s.id); gcHoles(); ui.sel = null; ui.hlNet = null; render(); }
      else if (s.t === "t") { checkpoint(); S.traces = S.traces.filter(t => t.id !== s.id); gcHoles(); ui.sel = null; ui.hlNet = null; render(); }
      else {
        checkpoint(); const nets = unwire(s.id); S.comps = S.comps.filter(c => c.id !== s.id);
        prune(); ui.sel = null; render(); toast(L(`Đã xoá ${s.id}.`, `Deleted ${s.id}.`)); afterParts([], nets);
      }
    },
    // xoá mọi đường đồng / dây nhảy đến linh kiện đang chọn (kể cả đường đã khoá), giữ linh kiện
    unwire() {
      const s = ui.sel; if (!s || s.t !== "c") return toast(L("Chọn một linh kiện để xoá các dây nối vào nó.", "Select a part to remove the wires going to it."));
      const n0 = S.traces.length + S.jumpers.length; checkpoint(); unwire(s.id); render();
      const n = n0 - S.traces.length - S.jumpers.length;
      if (!n) { undo.pop(); return toast(L(`${s.id} chưa có dây nối.`, `${s.id} has no wires yet.`)); }
      toast(L(`Đã xoá ${n} đường / dây nhảy nối vào ${s.id}. Bấm Tự đi dây (A) để đi lại.`, `Removed ${n} traces / jumpers going to ${s.id}. Press Autoroute (A) to re-route.`));
    },
    autoRe() { S.autoRe = !S.autoRe; render(); toast(S.autoRe ? L("Bật: dời / thêm / xoá linh kiện là tự đi dây lại phần liên quan.", "On: moving / adding / removing parts re-routes the affected nets.") : L("Tắt tự đi lại: bấm Tự đi dây (A) khi cần.", "Auto re-route off: press Autoroute (A) when needed.")); },
    autoBoard() { S.autoB = !S.autoB; if (S.autoB) { checkpoint(); fitBoardTo(); fit(); } render(); toast(S.autoB ? L("Bật: khung bo tự co giãn theo linh kiện khi thêm / bớt / dời.", "On: the board resizes to the parts when adding / removing / moving.") : L("Tắt: khung bo giữ cố định.", "Off: the board size stays fixed.")); },
    // đổi mạng của 1 chân module: bỏ đường gắn vào chân đó; mạng cũ không còn ≥ 2 chân thì bỏ hết đường / dây nhảy của nó
    setNet(id, pin, v) {
      const c = S.comps.find(x => x.id === id); if (!c) return;
      if (v === "+") { const u = usedNets(); let k = 1; while (u.has("N" + k)) k++; v = "N" + k; }
      checkpoint(); c.nets = c.nets || {};
      const P0 = pads().filter(q => q.c === c && q.name === pin), on = e => P0.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .05), old = c.nets[pin];
      c.nets[pin] = v || null;
      S.traces = S.traces.filter(t => !on(t.pts[0]) && !on(t.pts[t.pts.length - 1])); prune(); dropDangling(new Set([old].filter(Boolean))); render();
      afterParts([], [old, v].filter(Boolean));
      if (v && !PWR.has(v) && !isSig(v)) toast(L(`Chân ${pin} vào mạng riêng ${v}: chọn ${v} cho chân bên kia (điện trở, tụ…).`, `Pin ${pin} is on private net ${v}: pick ${v} for the other side (resistor, capacitor…).`));
    },
    add(fp) {
      if (fp === "S3" && (!hostInfo().s3 || S.comps.some(c => c.fp === "S3"))) return toast(L("Bo chỉ dùng 1 board ESP32-S3.", "The PCB uses a single ESP32-S3 board."));
      const pre = PRE[fp] || "M"; let n = 1; while (S.comps.some(c => c.id === pre + n)) n++;
      const id = pre + n, f = FP[fp], b = f.body, B = S.board, vx = cam.x + cam.w / 2, cx = S.flip ? B.w - vx : vx, cy = cam.y + cam.h / 2;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      checkpoint();
      const c = { id, fp, x: snap(clamp(cx - b.x - b.w / 2, 2 - b.x, B.w - 2 - b.x - b.w), G), y: snap(clamp(cy - b.y - b.h / 2, 2 - b.y, B.h - 2 - b.y - b.h), G), rot: 0 };
      if (fp !== "S3") c.nets = autoNets(fp); if (f.val) c.val = f.val;
      const e = S.autoB && extent();   // bo tự co giãn: đặt linh kiện mới vào chỗ trống bên phải, khung bo nới theo
      if (e) { c.x = snap(e.x1 + 4 - b.x, G); c.y = snap(Math.max(e.y0, BMARGIN) - b.y, G); }
      S.comps.push(c); ui.sel = { t: "c", id }; render(); afterParts([id]);
      const sig = Object.entries(c.nets || {}).filter(([, v]) => isSig(v)).map(([k, v]) => `${k}→${v}`).join(", ");
      toast(L(`Đã thêm ${id}`, `Added ${id}`) + (sig ? ": " + sig : "") + ". " + (TIP[fp] || L("Đổi chân nối ở bảng bên phải.", "Change pin connections in the right panel.")));
    },
    rotate() {
      const s = ui.sel; if (!s || s.t !== "c") return toast(L("Chọn một linh kiện để xoay.", "Select a part to rotate."));
      const c = S.comps.find(x => x.id === s.id); checkpoint(); c.rot = (c.rot + 90) % 360;   // đường cũ giữ nguyên, chỗ hở hiện thành dây bay / lỗi để sửa
      render(); afterParts([c.id]);
    },
    lock() { const s = ui.sel; if (!s || s.t !== "t") return toast(L("Chọn một đường đồng để khoá / bỏ khoá.", "Select a trace to lock / unlock.")); checkpoint(); const t = S.traces.find(x => x.id === s.id); t.lock = !t.lock; render(); toast(t.lock ? L("Đã khoá: Tự đi dây sẽ giữ nguyên đường này.", "Locked: Autoroute keeps this trace.") : L("Đã bỏ khoá.", "Unlocked.")); },
    width(w) { const s = ui.sel; if (!s || s.t !== "t") return toast(L("Chọn một đường đồng để đổi độ rộng.", "Select a trace to change its width.")); checkpoint(); const t = S.traces.find(x => x.id === s.id); t.w = w; t.lock = true; render(); },
    // thử cả 3 phương án, giữ bản ít đường hỏng nhất, rồi ít / ngắn dây nhảy nhất, rồi đồng ngắn nhất
    auto(re) {   // re === true: đi lại sau khi sửa linh kiện, đã có điểm hoàn tác của thao tác đó
      if (re !== true) checkpoint(); S.routed = true; const t0 = performance.now(), base = JSON.stringify([S.traces, S.jumpers]), sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
      let best = null;
      // số dây bay còn lại thật sự (đã tính mass nối GND)
      const go = (si, prio, ga) => { [S.traces, S.jumpers] = JSON.parse(base); autoroute(si, prio, ga); return analyze().rats.length; };
      const score = fl => fl * 1000 + sum(S.jumpers, j => 5 + 3 * Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1])) + .05 * sum(S.traces, t => t.pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - t.pts[i - 1][0], p[1] - t.pts[i - 1][1]) : 0, 0));
      const tryRun = (si, prio, ga) => { const fl = go(si, prio, ga), sc = score(fl), r = { score: sc, si, ga, fl, failed: autoroute.failed.slice(), st: JSON.stringify([S.traces, S.jumpers]) }; if (!best || sc < best.score) best = r; return r; };
      // lượt 1: mỗi phương án một lần (có mass: "mass trước, GND sau" và "GND như thường, mass phủ thêm")
      const first = [];
      for (let si = 0; si < SCHEMES.length; si++) for (const ga of S.pour ? [false, true] : [false]) first.push(tryRun(si, null, ga));
      // còn đường hỏng (thường do bị các đường đi trước vây kín chân): đi lại phương án tốt nhất, cho các đường từng hỏng đi trước.
      // Giới hạn ~10 s để không treo trang với bo lớn
      first.sort((a, b) => a.score - b.score);
      for (const r0 of first.slice(0, 2)) {
        if (!best.fl || performance.now() - t0 > 10000) break;
        const prio = new Set(r0.failed); let r = r0;
        for (let k = 0; k < 3 && r.fl && performance.now() - t0 < 10000; k++) { r.failed.forEach(x => prio.add(x)); r = tryRun(r0.si, prio, r0.ga); }
      }
      [S.traces, S.jumpers] = JSON.parse(best.st); S.scheme = best.si; cmd.autoMsg(best.fl ? extWires() : 0, t0);   // còn sót: dây ngoài có vỏ bọc
    },
    autoMsg(f, t0) { render(); const nj = S.jumpers.filter(j => j.auto && !j.ext).length, ne = S.jumpers.filter(j => j.ext).length; toast(L(`Tự đi dây (${SCHEMES[S.scheme].name}): ${f ? "còn " + f + " đường chưa đi được" : "xong hết"}${nj + ne ? " · " + (nj + ne) + " dây nhảy" : ""}`, `Autoroute (${SCHEMES[S.scheme].name}): ${f ? f + " connections left unrouted" : "all done"}${nj + ne ? " · " + (nj + ne) + " jumpers" : ""}`) + ` · ${Math.round(performance.now() - t0)} ms`); },
    scheme() { S.scheme = (S.scheme + 1) % SCHEMES.length; checkpoint(); S.routed = true; const t0 = performance.now(); cmd.autoMsg(autoroute(S.scheme) ? extWires() : 0, t0); },
    clear() { checkpoint(); S.routed = false; S.traces = S.traces.filter(t => t.lock); S.jumpers = S.jumpers.filter(j => !j.auto); render(); toast(L("Đã xoá các đường tự động (giữ đường đã khoá).", "Removed autorouted traces (locked traces kept).")); },
    reset() { if (!confirm(L(`Xoá hết linh kiện và đường đồng, chỉ để lại ${hostInfo().name}?`, `Remove all parts and traces, keeping only ${hostInfo().name}?`))) return; checkpoint(); S = fresh(S.mcu); ui.sel = null; render(); fit(); },
    rats() { S.rats = !S.rats; render(); },
    // nắn đoạn đang chọn: h ngang, v dọc, a 45°. Dời đầu tự do của đoạn; đoạn nối 2 chân thì chèn 1 điểm gập
    straight(m) {
      const s = ui.sel, t = s && s.t === "t" && S.traces.find(x => x.id === s.id); if (!t) return;
      checkpoint(); const P = t.pts, last = P.length - 1, k = Math.max(0, Math.min(s.k || 0, last - 1)), a = P[k], b = P[k + 1];
      const diag = (o, f) => { const dx = f[0] - o[0], dy = f[1] - o[1], d = snap((Math.abs(dx) + Math.abs(dy)) / 2, Q); return [r3(o[0] + (Math.sign(dx) || 1) * d), r3(o[1] + (Math.sign(dy) || 1) * d)]; };
      if (k + 1 < last || k > 0) {
        const [fi, oi] = k + 1 < last ? [k + 1, k] : [k, k + 1], o = P[oi], f = P[fi];
        P[fi] = m === "h" ? [f[0], o[1]] : m === "v" ? [o[0], f[1]] : diag(o, f);
      } else {
        const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.abs(dx), Math.abs(dy));
        P.splice(1, 0, m === "h" ? [b[0], a[1]] : m === "v" ? [a[0], b[1]] : [r3(a[0] + Math.sign(dx) * d), r3(a[1] + Math.sign(dy) * d)]);
      }
      t.pts = simplify(P.filter((q, i) => i === 0 || q[0] !== P[i - 1][0] || q[1] !== P[i - 1][1])); t.lock = true;
      s.k = Math.min(k, t.pts.length - 2); render();
    },
    addVtx(p) {
      const s = ui.sel, t = s && s.t === "t" && S.traces.find(x => x.id === s.id); if (!t) return;
      const pr = proj(t, p); checkpoint(); t.pts.splice(pr.k + 1, 0, pr.q); t.lock = true; render(); toast(L("Đã thêm điểm neo – kéo ô vuông để dời.", "Vertex added – drag the square to move it."));
    },
    delVtx(i) {
      const s = ui.sel, t = s && s.t === "t" && S.traces.find(x => x.id === s.id); if (!t || i <= 0 || i >= t.pts.length - 1) return;
      checkpoint(); t.pts.splice(i, 1); t.lock = true; render();
    },
    pour() { checkpoint(); S.pour = !S.pour; render(); toast(S.pour ? L("Đã phủ mass GND vào chỗ trống. Bấm Tự đi dây lại để bỏ bớt đường GND thừa.", "GND pour added to free areas. Autoroute again to drop extra GND traces.") : L("Đã bỏ phủ mass.", "GND pour removed.")); },
    jump() { const s = ui.sel; if (!s || s.t !== "t") return toast(L("Chọn một đường đồng rồi bấm J (hoặc chuột phải lên đường).", "Select a trace, then press J (or right-click the trace).")); startJump(S.traces.find(t => t.id === s.id)); },
    flip() { S.flip = !S.flip; render(); toast(S.flip ? L("Mặt sau: mặt đồng nhìn từ dưới (lật gương).", "Back: copper side seen from below (mirrored).") : L("Mặt trước: mặt cắm linh kiện.", "Front: component side.")); }
  };
  // bỏ đường / dây nhảy của mạng không còn đủ 2 chân (sau khi xoá linh kiện hoặc đổi chân)
  function prune() {
    const cnt = {}; for (const p of pads()) if (p.net && !p.jw) cnt[p.net] = (cnt[p.net] || 0) + 1;
    S.traces = S.traces.filter(t => cnt[t.net] >= 2); S.jumpers = S.jumpers.filter(j => cnt[j.net] >= 2);
  }
  // bỏ đường / dây nhảy của các mạng `nets` có đầu treo (không chạm chân, đầu dây nhảy hay thân đường cùng mạng), lặp tới khi hết
  function dropDangling(nets) {
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < .05;
    for (let again = true; again;) {
      again = false; const P = pads().filter(p => !p.jw && nets.has(p.net));
      const held = (q, net, self) => P.some(p => p.net === net && near([p.x, p.y], q))
        || S.jumpers.some(j => j !== self && j.net === net && (near(j.a, q) || near(j.b, q)))
        || S.traces.some(t => t !== self && t.net === net && t.pts.some((b, k) => k && segDist(q[0], q[1], t.pts[k - 1][0], t.pts[k - 1][1], b[0], b[1]) < .05));
      const n = S.traces.length + S.jumpers.length;
      S.traces = S.traces.filter(t => !nets.has(t.net) || (held(t.pts[0], t.net, t) && held(t.pts[t.pts.length - 1], t.net, t)));
      S.jumpers = S.jumpers.filter(j => !nets.has(j.net) || (held(j.a, j.net, j) && held(j.b, j.net, j)));
      again = S.traces.length + S.jumpers.length < n;
    }
  }
  // xoá đường nối vào chân của linh kiện id, rồi dọn phần treo; trả về các mạng bị ảnh hưởng
  function unwire(id) {
    const P0 = pads().filter(q => q.c.id === id), on = e => P0.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .05), nets = new Set(P0.map(q => q.net).filter(Boolean));
    S.traces = S.traces.filter(t => !on(t.pts[0]) && !on(t.pts[t.pts.length - 1])); dropDangling(nets); return nets;
  }
  // sau khi dời / thêm / xoá / xoay linh kiện: bo tự co giãn (nếu bật), rồi tự đi lại các mạng liên quan (nếu đã từng tự đi dây)
  let reT = 0;
  function afterParts(ids, extra = []) {
    if (S.autoB) {
      const w0 = S.board.w, h0 = S.board.h, [dx, dy] = fitBoardTo();
      if (S.flip || w0 !== S.board.w || h0 !== S.board.h) fit(); else if (dx || dy) { cam.x += dx; cam.y += dy; applyCam(); }
      render();
    }
    if (!S.autoRe || !(S.routed || S.traces.some(t => !t.lock))) return;
    const nets = new Set(extra); for (const p of pads()) if (ids.includes(p.c.id) && p.net) nets.add(p.net);
    clearTimeout(reT); reT = setTimeout(() => reroute(nets), 60);
  }
  function reroute(nets) {
    if (ui.drag || ui.mode !== "idle") return;
    const t0 = performance.now(); toast(L("Đang đi dây lại…", "Re-routing…"));
    setTimeout(() => {   // nhường 1 khung hình cho toast hiện
      // giữ tạm các đường tự động của mạng khác (coi như đã khoá), chỉ đi lại mạng bị ảnh hưởng
      const ft = S.traces.filter(t => !t.lock && !nets.has(t.net)), fj = S.jumpers.filter(j => j.auto && !nets.has(j.net));
      ft.forEach(t => t.lock = true); fj.forEach(j => j.auto = false);
      autoroute(S.scheme);
      ft.forEach(t => t.lock = false); fj.forEach(j => j.auto = true);
      const a = analyze(), bad = a.drc.some(v => (v.s && !v.s.t.lock) || (v.u && !v.u.t.lock));
      if (a.rats.length || bad) cmd.auto(true);   // cách nhanh chưa đủ (linh kiện đè lên đường cũ…): đi lại toàn bộ
      else cmd.autoMsg(0, t0);
    }, 30);
  }
  // chỉ nhận phím khi PCB Lab đang hiện (trong Pindexio, các tab khác vẫn dùng phím bình thường)
  function visible() { return ROOT.isConnected && !ROOT.closest("[hidden]") && ROOT.offsetParent !== null; }
  addEventListener("keydown", e => {
    if (!visible() || (e.target.closest && e.target.closest("input,select,textarea"))) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); return e.shiftKey ? cmd.redo() : cmd.undo(); }
    if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); return cmd.redo(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "escape") { const busy = ui.mode !== "idle"; cancel(); if (!busy) setTool("sel"); ui.sel = null; ui.hlNet = null; return render(); }
    if (ui.mode === "route") {
      if (k === "/") { S.posture = S.posture ? 0 : 1; drawRoute(); }
      if (k === "backspace") { e.preventDefault(); if (ui.route.pts.length > 1) ui.route.pts.pop(); drawRoute(); }
      if (k === "enter") { const c = ui.route.cur, pd = padAt({ x: c[0], y: c[1] }); finishRoute(pd && pd.net === ui.route.net ? [pd.x, pd.y] : c, !!(pd && pd.net === ui.route.net)); }
      if (k === "j") placeHole();
      return;
    }
    if (ui.sel && ui.sel.t === "t" && (k === "h" || k === "v" || k === "a")) return cmd.straight(k);
    if (k === "delete" || k === "backspace") { e.preventDefault(); cmd.del(); }
    else if (k === "r") cmd.rotate(); else if (k === "l") cmd.lock(); else if (k === "a") cmd.auto(); else if (k === "f") fit(); else if (k === "v") cmd.flip(); else if (k === "j") setTool("jw"); else if (k === "b") setTool("cu"); else if (k === "e") setTool("er");
  });

  /* ---------- khung bo ---------- */
  // khung bao mọi thứ trên bo (thân linh kiện, chân, đường, dây nhảy)
  function extent() {
    const xs = [], ys = [];
    for (const c of S.comps) { const b = compBox(c); xs.push(b.x0, b.x1); ys.push(b.y0, b.y1); }
    for (const p of pads()) { const r = p.r || PAD_R; xs.push(p.x - r, p.x + r); ys.push(p.y - r, p.y + r); }
    for (const t of S.traces) for (const p of t.pts) { xs.push(p[0]); ys.push(p[1]); }
    return xs.length ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } : null;
  }
  function shiftAll(dx, dy) {
    for (const c of S.comps) { c.x = r3(c.x + dx); c.y = r3(c.y + dy); }
    for (const t of S.traces) t.pts = t.pts.map(p => [r3(p[0] + dx), r3(p[1] + dy)]);
    for (const j of S.jumpers) { j.a = [r3(j.a[0] + dx), r3(j.a[1] + dy)]; j.b = [r3(j.b[0] + dx), r3(j.b[1] + dy)]; }
  }
  const BMIN = 30, BMAX = 300, BMARGIN = 6;   // mm; lề 6 mm chừa 4 lỗ bắt vít Ø3,2 ở góc
  function fitBoardTo() {   // bo vừa khít: dời mọi thứ (bước 2,54 để giữ lưới) cho lề trái / trên ≥ 6 mm, cạnh làm tròn lên 1 mm
    const e = extent(); if (!e) return;
    const dx = Math.ceil((BMARGIN - e.x0) / G) * G, dy = Math.ceil((BMARGIN - e.y0) / G) * G;
    shiftAll(dx, dy);
    S.board = { w: Math.min(BMAX, Math.max(BMIN, Math.ceil(e.x1 + dx + BMARGIN))), h: Math.min(BMAX, Math.max(BMIN, Math.ceil(e.y1 + dy + BMARGIN))) };
    return [dx, dy];
  }

  /* ---------- lấy mạch từ tab Wiring của Pindexio ---------- */
  // Wiring lưu ở localStorage "build:<board>": mods[{type, pins{chân: tên chân board}, host}], buses[0]{vai trò bus: chân}.
  // Board logic 3,3 V: chân ra 5 V (ECHO) được chia áp 1k/2k. Board 5 V (Arduino Uno): nối thẳng, nhưng module chỉ chịu 3,3 V thì cảnh báo.
  // Chân A của LED / các đoạn LED 7 đoạn được thêm R 220 Ω.
  const PWR_ROLE = { "pwr.3v3": "3V3", "pwr.5v": "5V", gnd: "GND" };
  const SHARED = ["spi.sck", "spi.mosi", "spi.miso", "i2c.sda", "i2c.scl"];
  function wiring() {
    if (!SITE) return null;
    try { const o = JSON.parse(localStorage.getItem("build:" + S.mcu) || "null"); return o && Array.isArray(o.mods) && o.mods.length ? o : null; } catch (e) { return null; }
  }
  // dấu vân tay mạch Wiring: chuyển qua lại giữa các chế độ mà Wiring không đổi thì giữ nguyên bo đang vẽ
  const wsig = o => JSON.stringify([o.mods.map(m => [m.type, m.pins, m.host || 0]), (Array.isArray(o.buses) && o.buses[0]) || o.bus || {}]);
  // kiểu sắp xếp: bề rộng kệ linh kiện bên phải ESP32-S3 (gọn / rộng / dọc)
  const ARR_W = [110, 140, 75], ARR_N = () => [L("gọn", "compact"), L("rộng", "wide"), L("dọc", "tall")];
  function layoutParts(gapMM) {   // gapMM: khe giữa linh kiện (mặc định 8 mm), "thử sắp xếp lại" nới ra 12 / 16 mm   // U1 bên trái, linh kiện xếp kệ bên phải (module cao trước, R / C sau), rồi bo vừa khít
    syncHost(); const u = S.comps.find(isHost); if (u) { u.x = 3 * G; u.y = 4 * G; u.rot = 0; }
    // ESP32-S3 đứng bên trái, linh kiện xếp bên phải; hàng rào J1 nằm ngang trên cùng, linh kiện xếp bên dưới
    const hd = u && u.fp.startsWith("HDR:"), x0 = u && !hd ? compBox(u).x1 + 8 : 6, W = ARR_W[S.arr || 0] || 110, gap = gapMM || 8;   // khe 8 mm: đủ lối cho vài đường đồng giữa các linh kiện
    let cx = x0, cy = hd ? compBox(u).y1 + 8 : 6, rowH = 0;
    const rest = S.comps.filter(c => c !== u).sort((a, b) => ((a.fp === "R" || a.fp === "C") - (b.fp === "R" || b.fp === "C")) || (FP[b.fp].body.h - FP[a.fp].body.h));
    for (const c of rest) {
      c.rot = 0; c.x = 0; c.y = 0; const b = compBox(c), w = b.x1 - b.x0, h = b.y1 - b.y0;
      if (cx > x0 && cx + w > x0 + W) { cx = x0; cy += rowH + gap; rowH = 0; }
      c.x = Math.ceil((cx - b.x0) / G) * G; c.y = Math.ceil((cy - b.y0) / G) * G;
      const nb = compBox(c); cx = nb.x1 + gap; rowH = Math.max(rowH, nb.y1 - cy);
    }
    fitBoardTo();
    // hàng chân trái của ESP32-S3 chỉ ra được phía mép bo: chừa thêm hành lang 2 ô (5,08 mm) bên trái và bên dưới
    // khe rộng (thử sắp xếp lại) thì hành lang cũng rộng theo: 2 ô → 3 ô → 4 ô
    const cw = (gap >= 16 ? 4 : gap >= 12 ? 3 : 2) * G;
    shiftAll(cw, 0); S.board = { w: Math.min(BMAX, Math.ceil(S.board.w + cw)), h: Math.min(BMAX, Math.ceil(S.board.h + cw)) };
  }
  function importWiring(quiet, noCp) {   // noCp: đã có điểm hoàn tác (đổi board)
    const o = wiring();
    if (!o) return quiet || toast(L(`Tab Wiring chưa có mạch cho ${hostInfo().name}. Mở ⚡ Wiring với board này, thêm module rồi quay lại.`, `The Wiring tab has no circuit for ${hostInfo().name} yet. Open ⚡ Wiring with this board, add modules, then come back.`));
    // không hỏi bằng hộp thoại trình duyệt: thay luôn, Ctrl+Z / Hoàn tác để quay lại bo cũ
    const had = S.comps.length > 1;
    if (!noCp) checkpoint(); S.wsig = wsig(o);
    S.comps = [fresh(S.mcu).comps[0]]; S.traces = []; S.jumpers = []; S.routed = false; ui.sel = null;
    const bus = (Array.isArray(o.buses) && o.buses[0]) || o.bus || {}, H = hostInfo(), s3pins = H.pins, hot = [];
    let nN = 1, nR = 0; const skip = [];
    const newNet = () => "N" + nN++;
    const addC = (fp, nets, val) => { const pre = PRE[fp] || "M"; let n = 1; while (S.comps.some(c => c.id === pre + n)) n++; const c = { id: pre + n, fp, x: 0, y: 0, rot: 0, nets }; if (val || FP[fp].val) c.val = val || FP[fp].val; S.comps.push(c); return c; };
    for (const m of o.mods) {
      const d = MODULES[m.type], f = FP[m.type];
      if ((m.host || 0) !== 0 || !d || !f) { skip.push(d ? d.short : m.type); continue; }   // module của board phụ (breadboard) hoặc chưa có footprint
      const names = new Set(f.pads.map(p => p.name)), nets = {};
      for (const [label, role, v5] of d.pins) {
        if (!names.has(label)) continue;
        let n = PWR_ROLE[role] || (SHARED.includes(role) ? bus[role] : (m.pins || {})[label]) || null;
        if (n && !PWR.has(n) && !s3pins.has(n)) n = null;   // tên chân lạ: bỏ, để người dùng chọn lại
        if (n && !PWR.has(n) && v5 && !H.v5) { const mid = newNet(); addC("R", { 1: mid, 2: n }, "1k"); addC("R", { 1: n, 2: "GND" }, "2k"); nR += 2; n = mid; }   // 5 V → 3,3 V
        else if (n && !PWR.has(n) && (m.type === "led" || m.type === "sevseg") && label !== "GND") { const mid = newNet(); addC("R", { 1: mid, 2: n }, "220"); nR++; n = mid; }   // giới hạn dòng LED
        nets[label] = n;
      }
      if (H.v5 && d.vcc === "3V3" && Object.values(nets).some(isSig)) hot.push(d.short);   // module 3,3 V nối GPIO 5 V
      for (const p of f.pads) if (!(p.name in nets) && { g: 1, 3: 1, 5: 1 }[p.role]) nets[p.name] = { g: "GND", 3: "3V3", 5: "5V" }[p.role];   // chân nguồn chỉ có ở footprint (vd L/R của INMP441)
      addC(m.type, nets);
    }
    S.hot = hot; layoutParts(); render(); fit(); list();
    const n = S.comps.length - 1 - nR;
    toast((had ? L("Đã thay bo cũ (Ctrl+Z để quay lại) · ", "Previous board replaced (Ctrl+Z to undo) · ") : "") + L(`Đã lấy ${n} linh kiện từ Wiring`, `Imported ${n} parts from Wiring`) + (nR ? L(` + ${nR} điện trở an toàn`, ` + ${nR} safety resistors`) : "") + (skip.length ? L(` · bỏ qua: ${skip.join(", ")}`, ` · skipped: ${skip.join(", ")}`) : "") + L(". Bấm Tự đi dây (A).", ". Press Autoroute (A).") + (hot.length ? L(` ⚠ ${hot.join(", ")} chỉ chịu 3,3 V: tín hiệu từ board 5 V cần mạch chuyển mức.`, ` ⚠ ${hot.join(", ")} are 3.3 V only: signals from a 5 V board need a level shifter.`) : ""));
  }
  Object.assign(cmd, {
    boardSize(w, h) {
      w = Math.round(+w); h = Math.round(+h);
      if (!(w >= BMIN && w <= BMAX && h >= BMIN && h <= BMAX)) { render(); return toast(L(`Khung bo từ ${BMIN} đến ${BMAX} mm.`, `Board size must be ${BMIN}–${BMAX} mm.`)); }
      if (w === S.board.w && h === S.board.h) return;
      checkpoint(); S.board = { w, h }; render(); fit();
    },
    fitBoard() { checkpoint(); fitBoardTo(); render(); fit(); toast(L(`Khung bo ${S.board.w} × ${S.board.h} mm, vừa linh kiện (lề 6 mm).`, `Board ${S.board.w} × ${S.board.h} mm, fitted to the parts (6 mm margin).`)); },
    // còn dây bay sau Tự đi dây: thử các bố cục (khe 8 / 12 / 16 mm × kiểu gọn / rộng / dọc), mỗi bố cục đi nhanh 3 phương án,
    // giữ bố cục đủ dây nhất (rồi ít dây nhảy, bo nhỏ), đi kỹ lại bản đó. Không tốt hơn bản cũ thì trả lại nguyên trạng. Giới hạn ~10 s thử + ~5 s đi kỹ
    tryLayouts() {
      const n0 = analyze().rats.length; if (!n0) return toast(L("Đã nối đủ dây.", "Everything is already routed."));
      toast(L("Đang thử các bố cục…", "Trying layouts…"));
      setTimeout(() => {
        const t0 = performance.now(), start = JSON.stringify(S); let best = null;
        out: for (const gap of [8, 12, 16]) for (let ai = 0; ai < ARR_W.length; ai++) {
          if (performance.now() - t0 > 10000) break out;   // thử ~10 s + đi kỹ bản tốt nhất ~5 s
          S = JSON.parse(start); S.arr = ai; S.traces = []; S.jumpers = []; layoutParts(gap); const lay = JSON.stringify(S);
          for (let si = 0; si < SCHEMES.length; si++) {
            S = JSON.parse(lay); autoroute(si); const fl = analyze().rats.length;
            const sc = fl * 1e6 + S.jumpers.length * 1e3 + S.board.w * S.board.h / 100;
            if (!best || sc < best.sc) best = { sc, fl, st: JSON.stringify(S), si };
          }
          if (best.fl === 0 && gap === 8) break out;   // khe 8 mm đã đủ dây: không nới thêm cho bo nhỏ
        }
        S = JSON.parse(best.st); S.scheme = best.si; cmd.auto(true); const fl = analyze().rats.length;
        if (fl >= n0) { S = JSON.parse(start); ui.sel = null; render(); list(); return toast(L(`Không tìm được bố cục tốt hơn (vẫn còn ${n0} dây) · giữ bố cục cũ. Thử kéo module ra xa hoặc thêm dây nhảy tay.`, `No better layout found (${n0} still unrouted) · kept the old layout. Try moving parts apart or adding manual jumpers.`)); }
        undo.push(start); redo.length = 0; ui.sel = null; S.routed = true; render(); list(); fit();
        toast(L(`Bố cục mới: ${fl ? "còn " + fl + " dây chưa nối" : "nối đủ dây"} · bo ${S.board.w} × ${S.board.h} mm · ${Math.round((performance.now() - t0) / 100) / 10} s · Ctrl+Z để quay lại`, `New layout: ${fl ? fl + " still unrouted" : "fully routed"} · board ${S.board.w} × ${S.board.h} mm · ${Math.round((performance.now() - t0) / 100) / 10} s · Ctrl+Z to undo`));
      }, 30);
    },
    // Sắp xếp (giống Wiring): mỗi lần bấm đổi kiểu bố trí rồi xếp lại
    arrange() { if (S.comps.length < 2) return cmd.pack(); S.arr = ((S.arr || 0) + 1) % ARR_W.length; cmd.pack(); toast(L("Sắp xếp kiểu ", "Layout: ") + ARR_N()[S.arr] + ` · ${S.board.w} × ${S.board.h} mm`); },
    // xếp gọn: ESP32-S3 bên trái, module xếp hàng bên phải, khung bo vừa đủ cho số linh kiện đang có; đường cũ bỏ để đi lại
    pack() {
      if (S.comps.length < 2) return toast(L("Thêm linh kiện trước rồi xếp gọn.", "Add parts first, then pack."));
      checkpoint(); const re = S.routed || S.traces.some(t => !t.lock);
      S.traces = []; S.jumpers = []; layoutParts(); render(); fit();
      toast(L(`Đã xếp ${S.comps.length} linh kiện · khung bo ${S.board.w} × ${S.board.h} mm.`, `Packed ${S.comps.length} parts · board ${S.board.w} × ${S.board.h} mm.`));
      if (re && S.autoRe) setTimeout(() => cmd.auto(true), 30);
    },
    fromWiring: () => importWiring(false),
    // đổi board: bo mới cho board đó (hoàn tác được), Wiring có mạch cho board này thì lấy luôn
    setBoard(id, quiet) {
      if (!id || id === S.mcu) return;
      checkpoint(); const keep = { alpha: S.alpha, autoRe: S.autoRe, pour: S.pour, rats: S.rats };
      S = Object.assign(fresh(id), keep); ui.sel = null; cancel();
      if (wiring()) importWiring(true, true); else { render(); fit(); }
      list(); render();
      if (!quiet) toast(L(`Đổi sang ${hostInfo().name}`, `Switched to ${hostInfo().name}`) + (hostInfo().s3 ? "" : L(" · nối board với bo qua hàng rào J1 (dây Dupont)", " · wire the board to the PCB through header J1 (Dupont wires)")) + L(" · Ctrl+Z để quay lại", " · Ctrl+Z to undo"));
    }
  });

  /* ---------- danh sách linh kiện bên trái (giống cột board của tab Sơ đồ chân) ---------- */
  const ICON_R = '<svg viewBox="0 0 40 28"><path d="M2 14h9M29 14h9" stroke="#9aa3a0" stroke-width="2"/><rect x="11" y="9" width="18" height="10" rx="5" fill="#d8c194"/><path d="M15 9v10M19 9v10M23 9v10" stroke-width="2" stroke="#7b4a1e"/></svg>';
  const ICON_C = '<svg viewBox="0 0 40 28"><path d="M14 22v4M26 22v4" stroke="#9aa3a0" stroke-width="2"/><rect x="9" y="4" width="22" height="18" rx="9" fill="#d9a83a"/></svg>';
  const iconSrc = k => SITE && MODULES[k] ? MODULES[k].svg : ({ button: "pushbutton", hcsr04: "hc-sr04" }[k] ? "src/assets/" + { button: "pushbutton", hcsr04: "hc-sr04" }[k] + ".svg" : "src/assets/" + k + ".svg");
  function s3Icon() {   // icon board vẽ từ chính footprint, như icon board của Pindexio
    const f = FP.S3, b = f.body;
    return `<svg viewBox="${b.x - 1} ${b.y - 1} ${b.w + 2} ${b.h + 2}" aria-hidden="true"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1.5" fill="#1c2230"/><rect x="${b.x + 5}" y="${b.y + 7}" width="${b.w - 10}" height="18" rx=".6" fill="#c4c8ce"/>${f.pads.map(p => `<circle cx="${p.x}" cy="${p.y}" r="1" fill="#e2c063"/>`).join("")}</svg>`;
  }
  function list() {
    const cnt = {}; for (const c of S.comps) cnt[c.fp] = (cnt[c.fp] || 0) + 1;
    const w = wiring(), n = k => cnt[k] ? `×${cnt[k]}` : "";
    const rows = ks => ks.map(k => `<button type="button" class="mod-row" data-add="${k}" aria-pressed="${!!cnt[k]}" title="${L("Thêm", "Add")} ${NAME[k]}">${k === "R" ? ICON_R : k === "C" ? ICON_C : `<img src="${iconSrc(k)}" alt="" loading="lazy">`}<span class="mr-name">${SHORT(k)}</span><span class="mr-if">${n(k)}</span></button>`).join("");
    const cats = CATS(), H = hostInfo();
    // chọn board (trong Pindexio): ESP32-S3 cắm thẳng lên bo, board khác nối dây Dupont qua hàng rào J1
    const pick = SITE && window.BOARDS ? `<select id="plMcu" class="pl-mcu" aria-label="Board">${BOARDS.filter(b => !b.mod && b.headers).map(b => `<option value="${b.id}"${b.id === S.mcu ? " selected" : ""}>${b.name}</option>`).join("")}</select>` : "";
    const card = H.s3 ? `<button type="button" class="board-card" data-add="S3" aria-pressed="${!!cnt.S3}" title="${NAME.S3}"><span class="bc-icon esp">${s3Icon()}<b>S3</b></span><span class="bc-txt"><span class="bc-name">ESP32-S3-DevKitC-1</span><span class="bc-chip">${L("cắm thẳng lên bo · 3.3 V", "plugs into the PCB · 3.3 V")}</span></span></button>`
      : `<div class="board-card" aria-pressed="true" title="${L("Board nối với bo qua hàng rào header J1 (dây Dupont)", "Board wired to the PCB through header J1 (Dupont wires)")}"><span class="bc-icon esp"><b>${H.tag}</b></span><span class="bc-txt"><span class="bc-name">${H.name}</span><span class="bc-chip">${FULL.has(S.mcu) ? L("cắm thẳng lên bo", "plugs into the PCB") : L("nối dây qua J1", "wired via J1")} · ${H.v5 ? "5 V" : "3.3 V"}</span></span></div>`;
    $("#plList").innerHTML = `${w ? `<button type="button" class="pl-wire" id="plWire" title="${L("Lấy module và chân đã nối ở tab ⚡ Wiring", "Take the modules and pins wired in the ⚡ Wiring tab")} (${H.name})">⚡ ${L("Lấy mạch từ Wiring", "Import from Wiring")} <span class="mods-n">${w.mods.length}</span></button>` : ""}
      ${pick}${card}
      <div class="mods open"><div class="mods-h"><span>🧩 ${L("Linh kiện", "Components")}</span><span class="mods-n">${cats.slice(1).reduce((s, c) => s + c[2].length, 0)}</span></div>
      <div class="mods-list">${cats.slice(1).map(([g, ic, ks]) => `<div class="mods-cat"><div class="mods-ch" title="${g}"><span aria-hidden="true">${ic}</span> <span class="mc-t">${g}</span></div>${rows(ks)}</div>`).join("")}</div></div>
      <p class="pl-note">${L(`Bấm để thêm vào giữa khung. Nguồn, I2C, SPI tự nối vào ${H.name}.`, `Click to add at the centre. Power, I2C and SPI are wired to ${H.name} automatically.`)}</p>`;
    $$("[data-add]").forEach(b => b.onclick = () => cmd.add(b.dataset.add));
    if ($("#plMcu")) $("#plMcu").onchange = e => cmd.setBoard(e.target.value);
    if ($("#plWire")) $("#plWire").onclick = cmd.fromWiring;
  }

  /* ---------- bảng bên phải + bộ công cụ ---------- */
  function panel() {
    const nets = {}; for (const p of A.P) if (p.net && !isFree(p.net)) nets[p.net] = 1;
    const open = new Set(A.rats.map(r => r.net)), bad = A.drc.length;
    const sel = ui.sel && ui.sel.t === "t" ? S.traces.find(t => t.id === ui.sel.id) : null, selC = ui.sel && ui.sel.t === "c" ? S.comps.find(c => c.id === ui.sel.id) : null;
    const allOk = !open.size && S.comps.length > 1, done = allOk && !bad, nj = S.jumpers.length;
    const help = L(`<li>Chọn bút như bút chì: <b>✏️ Bút đồng</b> (B) vẽ đường, <b>Bút dây nhảy</b> (J) bấm 2 điểm, <b>Gôm</b> (E) bôi chỗ không thích rồi vẽ lại, <b>Chọn</b> (Esc) để kéo linh kiện.</li><li>Kéo <b>thân đường</b> để dời song song, kéo <b>ô vuông</b> để dời góc.</li><li>Chọn đoạn dây: <b>H</b> nắn ngang · <b>V</b> nắn dọc · <b>A</b> nắn 45°. <b>Đúp</b> lên dây thêm điểm neo, đúp lên ô vuông để xoá.</li><li>Kéo <b>linh kiện</b> để dời, <b>R</b> xoay.</li><li><b>Dây nhảy</b> (J): bấm điểm đầu rồi điểm cuối (chân, lỗ, đường hoặc chỗ trống). Đang vẽ đường nhấn <b>J</b> để đặt lỗ ở đầu bút rồi bắc dây nhảy. Nét <b>trắng</b> = dây nhảy / ký hiệu linh kiện.</li><li>Đường vẽ / sửa tay tự <b>khoá</b> 🔒: Tự đi dây giữ nguyên.</li><li><b>/</b> đổi tư thế 45° · <b>Esc</b> huỷ · <b>Ctrl+Z</b> hoàn tác.</li>`,
      `<li>Pick a pen like a pencil: <b>✏️ Copper pen</b> (B) draws traces, <b>Jumper pen</b> (J) clicks 2 points, <b>Eraser</b> (E) rubs out what you don\'t like so you can redraw, <b>Select</b> (Esc) moves parts.</li><li>Drag a <b>trace body</b> to move it in parallel, drag a <b>square</b> to move a corner.</li><li>Select a segment: <b>H</b> horizontal · <b>V</b> vertical · <b>A</b> 45°. <b>Double-click</b> a trace to add a vertex, a square to delete it.</li><li>Drag a <b>part</b> to move it, <b>R</b> rotates.</li><li><b>Jumper</b> (J): click the start, then the end (pin, hole, trace or free spot). While drawing press <b>J</b> to drop a hole at the pen and bridge with a jumper. <b>White</b> lines = jumpers / part outlines.</li><li>Hand-drawn / edited traces are <b>locked</b> 🔒: Autoroute keeps them.</li><li><b>/</b> flips the 45° posture · <b>Esc</b> cancels · <b>Ctrl+Z</b> undo.</li>`);
    $("#plPanel").innerHTML = `<ol class="steps"><li class="${S.comps.length > 1 ? "ok" : "now"}">${L("Thêm & đặt linh kiện", "Add & place parts")}<small>${L("bấm linh kiện bên trái · kéo · R xoay", "click a part on the left · drag · R rotates")}</small></li><li class="${allOk ? "ok" : "now"}">${L("Nối hết dây", "Route everything")}<small>${allOk ? L("xong", "done") : L("bấm Tự đi dây (A)", "press Autoroute (A)")}${nj ? L(` · ${nj} dây nhảy`, ` · ${nj} jumpers`) : ""}</small></li><li class="${done ? "ok" : bad ? "now" : ""}">${L("Không lỗi → Tải file in", "No errors → Download")}<small>${bad ? L(`${bad} lỗi cần sửa`, `${bad} errors to fix`) : done ? L("sẵn sàng in", "ready to print") : "…"}</small></li></ol>
      <div class="stat"><div><b>${Object.keys(nets).length - open.size}</b>/${Object.keys(nets).length}<span>${L("mạng đã nối", "nets routed")}</span></div><div class="${bad ? "red" : ""}"><b>${bad}</b><span>${L("lỗi khoảng cách", "clearance errors")}</span></div><div><b>${S.traces.length}</b><span>${L("đường đồng", "traces")}</span></div></div>
      ${sel ? `<div class="box"><h4>${L("Đường đang chọn", "Selected trace")}</h4><p>${L("Mạng", "Net")} <b>${sel.net}</b> · ${traceW(sel)} mm · ${sel.lock ? L("🔒 đã khoá", "🔒 locked") : L("tự động", "auto")}</p></div>` : selC ? compBoxHTML(selC) : ""}
      ${A.rats.length && S.comps.length > 1 ? `<div class="box warn"><p>${L(`Còn <b>${A.rats.length}</b> chỗ chưa nối (nét gạch). Vẽ dây nhảy để hoàn thiện mạch: bấm chân → rê ra chỗ trống → <b>J</b> → bấm chỗ đặt lỗ thứ 2 → vẽ tiếp tới chân cần nối.`, `<b>${A.rats.length}</b> connections are still open (dashed lines). Add jumpers to finish the board: click a pin → move to a free spot → <b>J</b> → click the 2nd hole → keep drawing to the target pin.`)}</p>${S.routed && S.comps.length > 2 ? `<p class="mut">${L("Hoặc thử sắp xếp lại linh kiện (dời linh kiện và đi dây lại, Ctrl+Z để quay lại).", "Or try re-arranging the parts (moves parts and re-routes, Ctrl+Z to undo).")}</p><button type="button" class="pl-try" id="plTryLay">🔁 ${L("Thử sắp xếp lại", "Try re-arranging")}</button>` : ""}</div>` : ""}
      ${S.jumpers.length ? `<div class="box"><h4>${L("Dây nhảy", "Jumpers")} (${S.jumpers.length})</h4><p class="mut">${L("Hàn dây điện có vỏ bọc giữa 2 lỗ Ja ↔ Jb ở mặt linh kiện. Tổng dây cần chuẩn bị", "Solder insulated wire between holes Ja ↔ Jb on the component side. Total wire needed")} ~${Math.round(S.jumpers.reduce((s, j) => s + Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) + 10, 0) / 10)} cm.</p><div class="pinlist">${S.jumpers.map(j => { const len = Math.round(Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) + 10); return `<div><b>J${extNo(j)}</b> ${j.net} · ~${len} mm${j.pin ? L(" · hàn thẳng vào chân", " · soldered onto the pins") : ""}${len > 100 ? L(" ⚠ dài, tín hiệu nhanh có thể nhiễu", " ⚠ long, fast signals may pick up noise") : ""}</div>`; }).join("")}</div></div>` : ""}
      ${S.hot && S.hot.length ? `<div class="box warn"><p>${L(`⚠ ${S.hot.join(", ")} chỉ chịu 3,3 V: tín hiệu từ ${hostInfo().name} (5 V) cần mạch chuyển mức hoặc chia áp.`, `⚠ ${S.hot.join(", ")} are 3.3 V only: signals from ${hostInfo().name} (5 V) need a level shifter or divider.`)}</p></div>` : ""}
      ${A.cross ? `<div class="box warn"><p>${L(`⚠ ${A.cross} chỗ dây nhảy bắc chéo nhau: dùng dây có vỏ bọc.`, `⚠ ${A.cross} jumper crossings: use insulated wire.`)}</p></div>` : ""}
      <h4>${L("Khung bo", "Board size")}</h4><div class="bsz"><label>${L("Rộng", "W")} <input id="plBW" type="number" min="${BMIN}" max="${BMAX}" step="1" value="${S.board.w}"></label><span>×</span><label>${L("Cao", "H")} <input id="plBH" type="number" min="${BMIN}" max="${BMAX}" step="1" value="${S.board.h}"></label><span>mm</span></div>
      <div class="bszb">${[[50, 70], [70, 100], [100, 100], [100, 150]].map(([w, h]) => `<button type="button" data-bs="${w}x${h}"${S.board.w === w && S.board.h === h ? ' class="on"' : ""}>${w}×${h}</button>`).join("")}<button type="button" id="plFitB">${L("Vừa linh kiện", "Fit parts")}</button><button type="button" id="plPack" title="${L("Xếp lại ESP32-S3 + module cho gọn, khung bo vừa đủ số linh kiện", "Re-arrange the ESP32-S3 and modules compactly; board sized to the part count")}">${L("Xếp gọn", "Pack")}</button></div>
      <label class="bchk"><input type="checkbox" id="plAutoB"${S.autoB ? " checked" : ""}> ${L(`Tự co giãn theo linh kiện (${S.comps.length - 1} module đang gắn)`, `Auto-resize to the parts (${S.comps.length - 1} modules attached)`)}</label>
      <h4>${L("Mạng", "Nets")}</h4><div class="nets">${Object.keys(nets).sort().map(n => `<button type="button" data-net="${n}" class="${open.has(n) ? "open" : "ok"}${ui.hlNet === n ? " on" : ""}">${open.has(n) ? "○" : "✓"} ${n}</button>`).join("")}</div>
      ${bad ? `<h4>${L("Lỗi", "Errors")}</h4><div class="errs">${A.drc.slice(0, 8).map(v => `<div>⛔ ${v.s ? v.s.t.net : ""} ${v.msg}${v.u ? L(" với ", " vs ") + v.u.t.net : v.pad ? " " + v.pad.c.id + "·" + v.pad.name : ""}</div>`).join("")}${bad > 8 ? `<div>${L(`… và ${bad - 8} lỗi nữa`, `… and ${bad - 8} more`)}</div>` : ""}</div>` : ""}
      <h4>${L("Cách dùng", "How to")}</h4><ul class="help">${help}</ul>`;
    $$("[data-net]").forEach(b => b.onclick = () => { ui.hlNet = ui.hlNet === b.dataset.net ? null : b.dataset.net; ui.sel = null; render(); });
    $$("[data-pin]").forEach(s => s.onchange = () => cmd.setNet(selC.id, s.dataset.pin, s.value));
    $$("[data-bs]").forEach(b => b.onclick = () => { const [w, h] = b.dataset.bs.split("x"); S.autoB = false; cmd.boardSize(w, h); render(); });
    $("#plPack").onclick = cmd.pack; if ($("#plTryLay")) $("#plTryLay").onclick = cmd.tryLayouts; $("#plAutoB").onchange = cmd.autoBoard;
    $("#plBW").onchange = $("#plBH").onchange = () => { S.autoB = false; cmd.boardSize($("#plBW").value, $("#plBH").value); render(); };
    $("#plFitB").onclick = cmd.fitBoard;
    if ($("#plVal")) $("#plVal").onchange = e => { checkpoint(); selC.val = e.target.value.trim(); render(); };
    $("#plScheme").querySelector("span").textContent = SCHEMES[S.scheme].short;
    $("#plScheme").title = L("Phương án: ", "Scheme: ") + SCHEMES[S.scheme].name + L(" – bấm để đổi và đi lại", " – click to switch and re-route");
    $("#plRats").classList.toggle("on", S.rats); $("#plFlip").classList.toggle("on", !!S.flip); $("#plPour").classList.toggle("on", !!S.pour);
    $("#plUndo").disabled = !undo.length; $("#plRedo").disabled = !redo.length;
    $$("[data-add]").forEach(b => { const c = S.comps.filter(x => x.fp === b.dataset.add).length, t = b.querySelector(".mr-if"); b.setAttribute("aria-pressed", !!c); if (t) t.textContent = c ? "×" + c : ""; });
  }
  // ô linh kiện đang chọn: chọn mạng cho từng chân (nguồn, GPIO của ESP32-S3, hoặc mạng riêng nối qua R / C)
  function compBoxHTML(c) {
    const f = FP[c.fp], head = `<h4>${c.id} · ${NAME[c.fp]}</h4>`, foot = `<p class="mut">${L(`Xoay ${c.rot}° · R xoay · kéo để dời (lưới 2,54 mm)`, `Rotation ${c.rot}° · R rotates · drag to move (2.54 mm grid)`)}</p>`;
    if (isHost(c)) {
      const who = {}; for (const m of S.comps) for (const k in m.nets || {}) { const v = m.nets[k]; if (isSig(v)) (who[v] = who[v] || []).push(m.id + "." + k); }
      const rows = Object.keys(who).sort((a, b) => a.slice(2) - b.slice(2)).map(io => `<div><b>${io}</b> → ${who[io].join(", ")}</div>`).join("");
      return `<div class="box">${head}<div class="pinlist">${rows || `<div>${L("Chưa có module nào nối vào chân IO.", "No module is wired to an IO pin yet.")}</div>`}</div>${foot}</div>`;
    }
    const s3 = S.comps.some(isHost), H = hostInfo(), who = {};
    for (const m of S.comps) for (const k in m.nets || {}) if (m.nets[k] && m !== c) (who[m.nets[k]] = who[m.nets[k]] || []).push(m.id + "." + k);
    const custom = [...usedNets()].filter(n => !PWR.has(n) && !isSig(n)).sort();
    const opt = (v, cur, txt) => `<option value="${v}"${v === cur ? " selected" : ""}>${txt || v}</option>`;
    const io = (n, cur) => opt(n, cur, n + (H.risky.includes(n) ? " ⚠" : "") + (who[n] ? " · " + who[n].join(", ") : ""));
    const sel = (pin, cur) => `<select data-pin="${pin}">${opt("", cur || "", L("— không nối —", "— not connected —"))}<optgroup label="${L("Nguồn", "Power")}">${["GND", "3V3", "5V"].map(n => opt(n, cur)).join("")}</optgroup>`
      + (s3 ? `<optgroup label="${L("Chân ", "Pins of ") + H.name}">${[...H.pref, ...H.risky].map(n => io(n, cur)).join("")}</optgroup>` : "")
      + `<optgroup label="${L("Mạng riêng (qua R, C…)", "Private nets (via R, C…)")}">${custom.map(n => opt(n, cur, n + (who[n] ? " · " + who[n].join(", ") : ""))).join("")}${opt("+", "", L("＋ Mạng mới", "＋ New net"))}</optgroup></select>`;
    const names = [...new Set(f.pads.map(p => p.name))];
    return `<div class="box">${head}${f.val ? `<label class="pv">${L("Giá trị", "Value")} <input id="plVal" value="${c.val || ""}"></label>` : ""}
      <div class="pins">${names.map(n => `<label><span>${n}</span>${sel(n, (c.nets || {})[n])}</label>`).join("")}</div>${TIP[c.fp] ? `<p class="mut">💡 ${TIP[c.fp]}</p>` : ""}${foot}</div>`;
  }
  // menu thả của nút Tự đi dây: "Tự đi lại khi sửa linh kiện" mặc định tắt (nhẹ máy, người dùng tự bấm)
  function autoMenu() {
    const r = $("#plAutoMore").getBoundingClientRect(), st = $("#plStage").getBoundingClientRect();
    ctxMenu({ clientX: Math.max(st.left + 4, r.left - 300), clientY: r.top }, [
      [L("Tự đi dây ngay", "Autoroute now"), "A", cmd.auto],
      [(S.autoRe ? "☑ " : "☐ ") + L("Tự đi lại khi dời / thêm / xoá linh kiện", "Re-route when moving / adding / removing parts"), "", cmd.autoRe]]);
  }
  function tools() {
    const ic = { tsel: '<path d="M6 3l12 9-5.5 1.2L15 20l-2.5 1-2.6-6.6L6 18z"/>', tcu: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>', ter: '<path d="M9 20h11"/><path d="M4 15l9-9 6 6-8 8H8z"/><path d="M9 10l6 6"/>', wire: '<path d="M4 19c4-1 3-8 8-8s4-7 8-8"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="3" r="1.6"/>', hole: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>', pour: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12l8-8M4 20L20 4M12 20l8-8"/>', dl: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>', jump: '<path d="M3 17h4M17 17h4"/><path d="M7 17c0-9 10-9 10 0"/>', flip: '<path d="M12 3v18"/><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>', undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>', redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>', rot: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>', del: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', auto: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/>', scheme: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', clear: '<path d="M4 4l16 16M20 4L4 20"/>', fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', rats: '<path d="M4 18L20 6" stroke-dasharray="3 3"/>', zin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M11 8v6M8 11h6"/>', zout: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M8 11h6"/>', reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>', unwire: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>', re: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>', arr: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>' };
    const b = (id, i, t, tip) => `<button type="button" class="tb" id="${id}" title="${!t || !tip || tip.startsWith(t) ? tip || t : t + " – " + tip}"><svg viewBox="0 0 24 24">${ic[i]}</svg><span>${t}</span></button>`;
    const sep = '<span class="sep"></span>';
    // trong Pindexio: cùng nhóm chế độ với tab Wiring (Nối dây | Breadboard | Mạch in PCB) để chuyển qua lại 1 chạm
    const modes = SITE && window.APP && APP.toWiring ? `<span class="pl-modes" role="group" aria-label="${L("Chế độ", "Mode")}"><button type="button" class="tb" data-mode="wire">🔌 <span>${L("Nối dây", "Wiring")}</span></button><button type="button" class="tb" data-mode="bb">▦ <span>Breadboard</span></button><button type="button" class="tb on" aria-pressed="true">🖨 <span>PCB Maker <sup class="beta">beta</sup></span></button></span>` + sep : "";
    $("#plBar").innerHTML = modes + b("plDel", "del", L("Xoá", "Delete"), L("Xoá linh kiện, đường hoặc dây nhảy đang chọn (Delete)", "Delete the selected part, trace or jumper (Delete)")) + b("plRot", "rot", L("Xoay", "Rotate"), L("Xoay linh kiện đang chọn (R)", "Rotate the selected part (R)")) + sep
      + b("plUndo", "undo", L("Hoàn tác", "Undo"), "Ctrl+Z") + b("plRedo", "redo", L("Làm lại", "Redo"), "Ctrl+Shift+Z") + sep
      + b("plFlip", "flip", L("Lật mặt", "Flip"), L("Xem mặt trước / mặt sau (V)", "Front / back view (V)")) + b("plRats", "rats", L("Dây bay", "Ratsnest"), L("Bật / tắt dây bay", "Show / hide ratsnest"))
      + `<label class="alpha" title="${L("Board thật: độ rõ hình board thật", "Real boards: picture opacity")}">◐ <input type="range" id="plAlpha" min="0" max="100" step="5" value="${Math.round(S.alpha * 100)}"></label>` + sep
      + b("plZin", "zin", L("Phóng to", "Zoom in"), "") + b("plZout", "zout", L("Thu nhỏ", "Zoom out"), "") + b("plFit", "fit", L("Vừa khung", "Fit view"), "F") + sep
      + b("plArr", "arr", L("Sắp xếp", "Arrange"), L("Sắp xếp: tự bố trí linh kiện (bấm lần nữa đổi kiểu: gọn / rộng / dọc)", "Arrange: auto-place parts (click again for another layout: compact / wide / tall)"))
      + b("plReset", "reset", L("Làm mới", "Reset"), L("Làm mới: xoá hết, chỉ để lại board", "Reset: clear everything except the board"))
      + `<span style="flex:1"></span>` + b("plExport", "dl", "Export", L("Xuất mặt đồng, ký hiệu, mặt linh kiện (SVG / PNG 1:1) hoặc Gerber cho xưởng", "Export copper, silkscreen, component side (1:1 SVG / PNG) or Gerber for fabs"));
    $("#plVbar").innerHTML = `<div class="pl-tools">${Object.entries(TOOLS()).map(([k, [t, tip]]) => b("plT" + k, k === "jw" ? "jump" : "t" + k, t, tip).replace("<button ", `<button data-tool="${k}" `)).join("")}</div>` + b("plAuto", "auto", L("Tự đi dây", "Autoroute"), L("Xoá đường tự động cũ rồi đi lại toàn bộ, giữ đường đã khoá (A)", "Remove old auto traces and route everything again, keep locked traces (A)"))
      + `<button type="button" class="tb tb-more" id="plAutoMore" title="${L("Tuỳ chọn tự đi dây", "Autoroute options")}">▾</button>` + b("plScheme", "scheme", "", "")
      + b("plUnwire", "unwire", L("Xoá dây LK", "Unwire part"), L("Xoá mọi đường / dây nhảy nối vào linh kiện đang chọn", "Remove every trace / jumper going to the selected part"))
      + b("plClear", "clear", L("Xoá tự động", "Clear auto"), L("Xoá các đường chưa khoá", "Remove unlocked traces")) + b("plPour", "pour", L("Phủ mass", "GND pour"), L("Đổ đồng GND vào chỗ trống (cách 0,6 mm, nan nhiệt)", "Fill free areas with GND copper (0.6 mm clearance, thermal spokes)"))
      + `<div class="vw"><small>${L("Độ rộng mm", "Width mm")}</small><button type="button" data-w="0.8">${L("0,8", "0.8")}</button><button type="button" data-w="1">${L("1,0", "1.0")}</button><button type="button" data-w="1.5">${L("1,5", "1.5")}</button></div>`;
    $("#plAlpha").oninput = e => { S.alpha = e.target.value / 100; render(); };
    const on = (id, f) => $(id).onclick = f;
    on("#plUndo", cmd.undo); on("#plRedo", cmd.redo); on("#plRot", cmd.rotate); on("#plDel", cmd.del); on("#plAuto", cmd.auto); on("#plScheme", cmd.scheme); on("#plClear", cmd.clear); on("#plFit", fit); on("#plRats", cmd.rats); on("#plReset", cmd.reset); on("#plFlip", cmd.flip); $$(".pl-tools [data-tool]").forEach(x => x.onclick = () => setTool(x.dataset.tool)); setTool(ui.tool || "jw"); on("#plPour", cmd.pour); on("#plAutoMore", autoMenu); on("#plUnwire", cmd.unwire); on("#plArr", cmd.arrange);
    $$("[data-mode]").forEach(x => x.onclick = () => APP.toWiring(x.dataset.mode));
    $("#plExport").classList.add("primary");
    on("#plExport", exportDialog);
    on("#plZin", () => { cam.x += cam.w * .12; cam.y += cam.h * .12; cam.w *= .76; cam.h *= .76; applyCam(); });
    on("#plZout", () => { cam.x -= cam.w * .16; cam.y -= cam.h * .16; cam.w *= 1.32; cam.h *= 1.32; applyCam(); });
    $$("[data-w]").forEach(x => x.onclick = () => cmd.width(+x.dataset.w));
  }
  const relang = () => { tools(); list(); render(); };
  tools(); list(); build(); fit(); render();
  new ResizeObserver(() => { if (!cam || !cam.w) fit(); applyCam(); }).observe($("#plStage"));
  // Pindexio đổi ngôn ngữ bằng window.onLangChange: nối thêm, không thay hàm của site
  const prevLang = window.onLangChange;
  window.onLangChange = function () { if (prevLang) prevLang.apply(this, arguments); relang(); };
  window.PCB = { setHoleGap: v => HOLE_GAP = v, S: () => S, analyze, autoroute, cmd, ui, pads, exportSVG, pngDPI, gerber, zip };
  // hộp thông báo "đang thử nghiệm" khi mở PCB Maker (hộp của app, không dùng hộp thoại trình duyệt); chọn "Không hiện lại" thì nhớ trên máy
  function betaNote() {
    try { if (localStorage.getItem("pcbmaker-beta-ok") === "1") return; } catch (e) { }
    if (ROOT.querySelector(".pl-beta")) return;
    const d = document.createElement("div"); d.className = "pl-beta"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = `<div class="pl-beta-box"><h3>🖨 PCB Maker <sup class="beta">beta</sup> · ${L("Tính năng thử nghiệm", "Experimental feature")}</h3>
      <p>${L("Một số thông số chưa được kiểm chứng bằng bo thật:", "Some parameters have not been verified on a real board yet:")}</p>
      <ul><li>${L("Kích thước / vị trí chân của vài module (WS2812, VL53L0X, INMP441…) là số ước lượng.", "Footprints of some modules (WS2812, VL53L0X, INMP441…) are estimates.")}</li>
      <li>${L("Tự đi dây, dây nhảy cần được xem lại bằng mắt.", "Autorouted traces and jumpers should be reviewed by eye.")}</li></ul>
      <p><b>${L("Trước khi làm bo: in file 1:1 ra giấy, đặt module / board thật lên so lỗ chân, kiểm tra từng đường nối.", "Before making the PCB: print the file 1:1 on paper, place the real modules / board on it to check the holes, and check every connection.")}</b></p>
      <label><input type="checkbox" id="plBetaHide"> ${L("Không hiện lại", "Don't show again")}</label>
      <button type="button" class="pl-try" id="plBetaOk">${L("Tôi đã hiểu", "I understand")}</button></div>`;
    ROOT.appendChild(d);
    d.querySelector("#plBetaOk").onclick = () => { if (d.querySelector("#plBetaHide").checked) try { localStorage.setItem("pcbmaker-beta-ok", "1"); } catch (e) { } d.remove(); };
  }
  window.PCBLAB = {
    // o.fromWiring: mở từ tab Wiring → lấy mạch. Bo trống (chỉ có ESP32-S3) và Wiring có mạch → tự lấy.
    open(o) {
      if (o && o.board && o.board !== S.mcu) cmd.setBoard(o.board, true);   // đi theo board đang chọn ở Pindexio / Wiring
      const w = o && o.fromWiring && wiring();
      if (o && o.fromWiring && !(w && S.wsig === wsig(w) && S.comps.length > 1)) importWiring(false);
      else if (S.comps.length === 1 && !S.traces.length && wiring()) importWiring(true);
      list(); render(); requestAnimationFrame(fit); betaNote();
    },
    relang
  };
})();
