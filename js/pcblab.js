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
  const BUILD = "2026-11-03 13:52"; $("#plStage").insertAdjacentHTML("beforeend", `<div id="plBuild">build ${BUILD}</div>`);
  // chạy thử trên máy (tools/serve.py): build xong thì trang tự tải lại. Trên web thật không có /__ver nên không làm gì
  if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
    let ver = null;
    const poll = () => fetch("/__ver", { cache: "no-store" }).then(r => r.ok ? r.text() : null).catch(() => null).then(v => {
      if (v == null) return;   // server thường (không có /__ver): thôi
      if (ver && v !== ver) return location.reload();
      ver = v; setTimeout(poll, 1000);
    });
    poll();
  }
  // song ngữ: theo <html lang> (Pindexio đổi bằng nút cờ); L("tiếng Việt", "English")
  const EN = () => document.documentElement.lang === "en", L = (vi, en) => EN() ? en : vi;
  const SITE = !!window.MODULES;   // đang nhúng trong Pindexio: tên + icon linh kiện lấy từ thư viện module của site
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a = {}, p, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e; };
  const G = 2.54, Q = G / 4, CLR = 0.5, PAD_R = 1.0, DRILL_R = 0.5, EDGE = 1.0;   // pad Ø2, khoan Ø1,0 (chân header 0,64 vuông)
  // lỗ dây nhảy; dài tối thiểu 5,08 mm (2 ô): bắc qua 1 đường cần ≥ 3,6 mm, dây 0,5 mm uốn kìm thực tế ≥ 5 mm
  const JP_R = 0.8, JP_DRILL = 0.4, JP_MIN = 2 * G, JP_MAX = 4 * G, JP_OVER = .3;
  const PIN_GAP = 0.5;
  // tuỳ chọn đi dây (chỉ để thử / đo so sánh qua PCB.opt): esc lối thoát quanh chân chờ, ord thứ tự đi (mps / pwr), rip gỡ đường vây,
  // nearCost phí chạy sát vật khác mạng, roomPct lề bo khi thiết kế, timeCap giới hạn Tự đi dây (ms)
  const OPT = { esc: .8, ord: "mps", rip: true, nearCost: .7, roomPct: .15, timeCap: 10000 };
  const W_SIG = 1.0, W_PWR = 1.5, PWR = new Set(["GND", "3V3", "5V"]);
  const SPREAD0 = W_SIG + CLR;   // mặc định chừa đủ 1 làn: sau này chỗ kẹt vẫn nhét thêm được 1 đường   // chân chưa đi dây: đường khác mạng chừa thêm khoảng này, để chân còn lối thoát (đặt lỗ, kéo đồng ra)   // tự đi dây: đường khác mạng chừa thêm khoảng này quanh chân, để chỗ sát chân còn đặt lỗ và hàn được   // JP_OVER: dây trần ở mặt trên cách chân khác mạng (ngoài mép pad)
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
    traces: [], jumpers: [], alpha: 1, uid: 1, scheme: 1, posture: 0, rats: true, width: null
  });
  let S;
  try { S = JSON.parse(localStorage.getItem("pcb-proto:v2") || "null"); } catch (e) { S = null; }
  if (!S || S.v !== 2) S = fresh();
  S.mcu = S.mcu || S3ID;   // bản lưu cũ: chỉ có ESP32-S3
  S.jumpers = (S.jumpers || []).filter(j => !j.ext);   // bản lưu cũ: bỏ dây có vỏ bọc, chỉ còn dây nhảy trần
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
    A = { P, rats, find, uni, conns: total };
    A.drc = drc(P);
    // dây nhảy trần khác mạng bắc chéo nhau ở mặt trên: cảnh báo
    A.cross = 0; S.jumpers.forEach((j, i) => S.jumpers.slice(i + 1).forEach(o => { if (o.net !== j.net && segSeg(j.a, j.b, o.a, o.b) === 0) A.cross++; }));
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
      if ( Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) < JP_MIN - 1e-6) bad.push({ x: (j.a[0] + j.b[0]) / 2, y: (j.a[1] + j.b[1]) / 2, msg: L("dây nhảy ngắn quá (< 5,08 mm)", "jumper too short (< 5.08 mm)") });
      for (const p of P) if (p.jw !== j && p.net !== j.net && segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < (p.r || PAD_R) + JP_OVER) bad.push({ pad: p, x: p.x, y: p.y, msg: L("dây nhảy đè lên chân", "jumper passes over a pin") });
    }
    for (let i = 0; i < S.jumpers.length; i++) for (let k = i + 1; k < S.jumpers.length; k++) {
      const j = S.jumpers[i], o = S.jumpers[k];
      if (j.net !== o.net && segSeg(j.a, j.b, o.a, o.b) < CLR - 1e-6) bad.push({ x: (j.a[0] + j.b[0] + o.a[0] + o.b[0]) / 4, y: (j.a[1] + j.b[1] + o.a[1] + o.b[1]) / 4, msg: L("dây nhảy cắt / chạm nhau", "jumpers cross or touch") });
    }
    // khung bo thu nhỏ: chân nằm ngoài / sát mép
    for (const p of P) { const r = p.r || PAD_R; if (p.x - r < EDGE || p.y - r < EDGE || p.x + r > S.board.w - EDGE || p.y + r > S.board.h - EDGE) bad.push({ pad: p, x: p.x, y: p.y, msg: L("chân ra ngoài mép bo", "pin outside the board edge") }); }
    return bad;
  }
  // chỗ đặt lỗ dây nhảy: trong mép bo, cách mọi chân / lỗ ≥ CLR (mép–mép), cách đồng khác mạng ≥ CLR
  // lỗ dây nhảy cách mối hàn chân linh kiện thêm HOLE_GAP mm để mỏ hàn dễ vào, không dính thiếc sang chân
  const HOLE_GAP = .5;
  function holeOK(x, y, net, P) {
    if (x < EDGE + JP_R || y < EDGE + JP_R || x > S.board.w - EDGE - JP_R || y > S.board.h - EDGE - JP_R) return false;
    for (const p of P) if (Math.hypot(p.x - x, p.y - y) < (p.r || PAD_R) + CLR + JP_R + (p.jw || p.hole ? 0 : HOLE_GAP)) return false;
    // không nằm dưới thân dây nhảy khác mạng (dây trần mặt trên sẽ chạm mối hàn của lỗ này)
    for (const j of S.jumpers) if (j.net !== net && segDist(x, y, j.a[0], j.a[1], j.b[0], j.b[1]) < JP_R + JP_OVER) return false;
    for (const t of S.traces) if (t.net !== net) for (let k = 0; k < t.pts.length - 1; k++) if (segDist(x, y, t.pts[k][0], t.pts[k][1], t.pts[k + 1][0], t.pts[k + 1][1]) < traceW(t) / 2 + CLR + JP_R) return false;
    return true;
  }
  // thân dây nhảy (dây trần, mặt trên) không đi ngang chân khác mạng và KHÔNG cắt chéo / chạm dây nhảy khác
  const lineOK = (a, b, net, P, selfJ) => P.every(p => p.net === net || segDist(p.x, p.y, a[0], a[1], b[0], b[1]) >= (p.r || PAD_R) + JP_OVER)
    && S.jumpers.every(o => o === selfJ || (o.net === net ? segSeg(a, b, o.a, o.b) > .1 : segSeg(a, b, o.a, o.b) >= CLR));

  /* ---------- tự đi dây: A* trên lưới 0,635 mm, tích hợp sẵn cầu nhảy (Jump-Aware A*) tránh cắt chéo dây nhảy ---------- */
  const SCHEMES = [
    { get name() { return L("Vuông góc, ít khúc", "Right angles, few bends"); }, get short() { return L("Vuông góc", "90°"); }, dirs: 4, t45: 0, t90: 4, diag: 1 },
    { get name() { return L("45° kiểu KiCad", "45° KiCad style"); }, get short() { return L("Kiểu 45°", "45° style"); }, dirs: 8, t45: 1.2, t90: 4, diag: 1.05 },
    { get name() { return L("Ngắn nhất", "Shortest"); }, get short() { return L("Ngắn nhất", "Shortest"); }, dirs: 8, t45: .2, t90: .8, diag: 1 }
  ];
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const ratKey = r => [r.a.c.id + "." + r.a.i, r.b.c.id + "." + r.b.i].sort().join("-");
  // kiểm tra nhanh 2 đầu có thông nhau trên mặt đồng không trước khi chạy A*
  function canReach(nx, ny, block, sx, sy, tx, ty, dirs) {
    if (sx === tx && sy === ty) return true;
    const N = nx * ny, vis = new Uint8Array(N), q = new Int32Array(N), step = dirs === 4 ? 2 : 1;
    let hd = 0, tl = 0; const st = sy * nx + sx, tg = ty * nx + tx;
    vis[st] = 1; q[tl++] = st;
    while (hd < tl) {
      const c = q[hd++], x = c % nx, y = (c - x) / nx;
      for (let d = 0; d < 8; d += step) {
        const x2 = x + DIRS[d][0], y2 = y + DIRS[d][1];
        if (x2 < 0 || y2 < 0 || x2 >= nx || y2 >= ny) continue;
        const c2 = y2 * nx + x2;
        if (c2 === tg) { if (d % 2 && (block[y * nx + x2] || block[y2 * nx + x])) continue; return true; }
        if (vis[c2] || block[c2]) continue;
        if (d % 2 && (block[y * nx + x2] || block[y2 * nx + x])) continue;
        vis[c2] = 1; q[tl++] = c2;
      }
    }
    return false;
  }
  function autoroute(si, prio, gndAsNet, ord = OPT.ord) {
    const sc = SCHEMES[si]; autoroute.failed = []; autoroute.why = {};
    S.traces = S.traces.filter(t => t.lock); S.jumpers = S.jumpers.filter(j => !j.auto);
    const pw = S.pour; if (gndAsNet) S.pour = false; analyze(); S.pour = pw;
    const nx = Math.floor(S.board.w / Q) + 1, ny = Math.floor(S.board.h / Q) + 1, P = A.P;
    const len = r => Math.hypot(r.a.x - r.b.x, r.a.y - r.b.y), pr = r => prio && prio.has(ratKey(r)) ? 0 : 1;
    const cx = new Map(A.rats.map(r => [r, A.rats.reduce((n, o) => n + (o.net !== r.net && segSeg([r.a.x, r.a.y], [r.b.x, r.b.y], [o.a.x, o.a.y], [o.b.x, o.b.y]) === 0 ? 1 : 0), 0)]));
    const edges = A.rats.slice().sort((a, b) => (pr(a) - pr(b)) || (ord === "mps" ? cx.get(a) - cx.get(b) : PWR.has(a.net) - PWR.has(b.net)) || (len(a) - len(b)));
    const holes = () => S.jumpers.flatMap(j => [{ x: j.a[0], y: j.a[1], r: JP_R, net: j.net, jw: j }, { x: j.b[0], y: j.b[1], r: JP_R, net: j.net, jw: j }]);
    let pend = new Map();
    const RZ = PAD_R + CLR + JP_R + 1.5 * Q;
    const SP = S.spread ?? SPREAD0;
    const grids = (e, w, gap = PIN_GAP, withHoles = false) => {
      const block = new Uint8Array(nx * ny), soft = new Uint8Array(nx * ny), near = new Uint8Array(nx * ny);
      const mark = (g, x0, y0, x1, y1, fn) => { for (let gy = Math.max(0, Math.floor(y0 / Q)); gy <= Math.min(ny - 1, Math.ceil(y1 / Q)); gy++) for (let gx = Math.max(0, Math.floor(x0 / Q)); gx <= Math.min(nx - 1, Math.ceil(x1 / Q)); gx++) if (fn(gx * Q, gy * Q)) g[gy * nx + gx] = 1; };
      for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) { const x = gx * Q, y = gy * Q, m = EDGE + w / 2; if (x < m || y < m || x > S.board.w - m || y > S.board.h - m) block[gy * nx + gx] = 1; }
      const allP = [...P, ...holes()];
      for (const p of allP) if (p.net !== e.net) {
        const r0 = (p.r || PAD_R) + CLR + w / 2 + (p.r ? 0 : gap), r = r0 + (gap && pend.get(p) ? OPT.esc : 0);
        mark(block, p.x - r, p.y - r, p.x + r, p.y + r, (x, y) => { const d = Math.hypot(x - p.x, y - p.y); return d < r0 || (d < r && Math.hypot(x - e.a.x, y - e.a.y) > RZ && Math.hypot(x - e.b.x, y - e.b.y) > RZ); });
      }
      for (const t of S.traces) if (t.net !== e.net) { const r = traceW(t) / 2 + CLR + w / 2; for (let k = 0; k < t.pts.length - 1; k++) { const [a, b] = [t.pts[k], t.pts[k + 1]]; mark(soft, Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) < r); if (SP) { const R = r + SP; mark(near, Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) < R); } } }
      if (SP) for (const p of P) if (p.net !== e.net) { const R = (p.r || PAD_R) + CLR + w / 2 + SP; mark(near, p.x - R, p.y - R, p.x + R, p.y + R, (x, y) => Math.hypot(x - p.x, y - p.y) < R); }
      if (!withHoles) return { block, soft, near };
      const holeGrid = new Uint8Array(nx * ny), jStop = new Uint8Array(nx * ny);
      const hm = EDGE + JP_R;
      for (let gy = Math.ceil(hm / Q); gy <= Math.floor((S.board.h - hm) / Q); gy++)
        for (let gx = Math.ceil(hm / Q); gx <= Math.floor((S.board.w - hm) / Q); gx++)
          holeGrid[gy * nx + gx] = 1;
      const clearH = (x0, y0, x1, y1, fn) => { for (let gy = Math.max(0, Math.floor(y0 / Q)); gy <= Math.min(ny - 1, Math.ceil(y1 / Q)); gy++) for (let gx = Math.max(0, Math.floor(x0 / Q)); gx <= Math.min(nx - 1, Math.ceil(x1 / Q)); gx++) if (holeGrid[gy * nx + gx] && fn(gx * Q, gy * Q)) holeGrid[gy * nx + gx] = 0; };
      for (const p of allP) {
        const rh = (p.r || PAD_R) + CLR + JP_R + (p.r ? 0 : HOLE_GAP);
        clearH(p.x - rh, p.y - rh, p.x + rh, p.y + rh, (x, y) => Math.hypot(x - p.x, y - p.y) < rh);
        if (p.net !== e.net) { const rp = (p.r || PAD_R) + JP_OVER - .25; mark(jStop, p.x - rp, p.y - rp, p.x + rp, p.y + rp, (x, y) => Math.hypot(x - p.x, y - p.y) < rp); }
      }
      for (const j of S.jumpers) if (j.net !== e.net) {
        const rj = JP_R + JP_OVER;
        clearH(Math.min(j.a[0], j.b[0]) - rj, Math.min(j.a[1], j.b[1]) - rj, Math.max(j.a[0], j.b[0]) + rj, Math.max(j.a[1], j.b[1]) + rj, (x, y) => segDist(x, y, j.a[0], j.a[1], j.b[0], j.b[1]) < rj);
      }
      for (const t of S.traces) if (t.net !== e.net) {
        const rt = traceW(t) / 2 + CLR + JP_R;
        for (let k = 0; k < t.pts.length - 1; k++) { const [a, b] = [t.pts[k], t.pts[k + 1]]; clearH(Math.min(a[0], b[0]) - rt, Math.min(a[1], b[1]) - rt, Math.max(a[0], b[0]) + rt, Math.max(a[1], b[1]) + rt, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) < rt); }
      }
      return { block, soft, near, holeGrid, jStop, allP };
    };
    const toMMs = cells => cells.map(([gx, gy]) => [r3(gx * Q), r3(gy * Q)]);
    if (!S.pour || gndAsNet) return run(edges);
    const f = run(edges.filter(e => e.net !== GND)); analyze();
    return f + run(A.rats.filter(e => e.net === GND).sort((a, b) => (pr(a) - pr(b)) || (len(a) - len(b))));
    function grp(k) { return A.find(k); }
    function padKey(p) { return "p" + A.P.indexOf(p); }
    function link(t, e) { const ia = A.P.indexOf(e.a), ib = A.P.indexOf(e.b); if (ia < 0 || ib < 0) return; if (t) A.uni("t" + t.id, "p" + ia); A.uni("p" + ia, "p" + ib); }
    function trimSame(path, e, onlySide) {
      if (A.P.indexOf(e.a) < 0 || A.P.indexOf(e.b) < 0) return { path };
      const ga = grp(padKey(e.a)), gb = grp(padKey(e.b)); if (ga === gb) return { path };
      const mine = S.traces.filter(t => t.net === e.net && t.pts.length > 1).map(t => ({ t, g: grp("t" + t.id) })).filter(o => o.g === ga || o.g === gb);
      if (!mine.length) return { path };
      const on = (c, g) => { const x = c[0] * Q, y = c[1] * Q; return mine.some(o => o.g === g && o.t.pts.some((q, k) => k && segDist(x, y, o.t.pts[k - 1][0], o.t.pts[k - 1][1], q[0], q[1]) < .05)); };
      let i0 = 0; if (onlySide !== "b") for (let i = path.length - 2; i > 0; i--) if (on(path[i], ga)) { i0 = i; break; }
      let j0 = path.length - 1; if (onlySide !== "a") for (let j = i0 + 1; j < path.length - 1; j++) if (on(path[j], gb)) { j0 = j; break; }
      if (j0 - i0 < 1) return { path };
      return { path: path.slice(i0, j0 + 1), a: i0 > 0, b: j0 < path.length - 1 };
    }
    function run(list, depth = 0) {
      const failed = [];
      pend = new Map(); for (const e of list) for (const p of [e.a, e.b]) pend.set(p, (pend.get(p) || 0) + 1);
      const done = e => { for (const p of [e.a, e.b]) pend.set(p, pend.get(p) - 1); };
      for (const e of list) {
        done(e);
        const w = PWR.has(e.net) ? W_PWR : W_SIG, { block, soft, near } = grids(e, w);
        for (let i = 0; i < block.length; i++) if (soft[i]) block[i] = 1;
        const sx = Math.round(e.a.x / Q), sy = Math.round(e.a.y / Q), tx = Math.round(e.b.x / Q), ty = Math.round(e.b.y / Q);
        let path = canReach(nx, ny, block, sx, sy, tx, ty, sc.dirs) && astar(nx, ny, block, sx, sy, tx, ty, sc, null, near);
        if (!path) {
          const g0 = grids(e, w, 0); for (let i = 0; i < g0.block.length; i++) if (g0.soft[i]) g0.block[i] = 1;
          path = canReach(nx, ny, g0.block, sx, sy, tx, ty, sc.dirs) && astar(nx, ny, g0.block, sx, sy, tx, ty, sc);
          if (path) block.set(g0.block);
        }
        if (!path) { failed.push(e); continue; }
        const tr = trimSame(path, e); path = tr.path;
        const bl = block.slice(); for (let i = 0; i < bl.length; i++) if (near[i]) bl[i] = 1;
        for (let k = 0; k < path.length; k++) {
          const [x, y] = path[k]; bl[y * nx + x] = 0;
          if (k) { const [px, py] = path[k - 1]; if (!block[py * nx + x]) bl[py * nx + x] = 0; if (!block[y * nx + px]) bl[y * nx + px] = 0; }
        }
        let pts = toMMs(straighten(path, nx, bl, sc));
        if (!tr.a) pts[0] = [e.a.x, e.a.y];
        if (!tr.b) pts[pts.length - 1] = [e.b.x, e.b.y];
        pts = simplify(pts);
        const nt = { id: S.uid++, net: e.net, pts, lock: false }; S.traces.push(nt); link(nt, e);
      }
      let fail = 0;
      for (const e of failed) {
        const w = PWR.has(e.net) ? W_PWR : W_SIG;
        const sx = Math.round(e.a.x / Q), sy = Math.round(e.a.y / Q), tx = Math.round(e.b.x / Q), ty = Math.round(e.b.y / Q);
        let cut = null, usedBlock = null;
        for (const tight of [false, true]) {
          const { block, soft, near, holeGrid, jStop, allP } = grids(e, w, tight ? 0 : PIN_GAP, true);
          const bl = block.slice(); for (let i = 0; i < bl.length; i++) if (soft[i]) bl[i] = 1;
          for (const useNear of [null, near]) {
            const path = astar(nx, ny, block, sx, sy, tx, ty, sc, soft, useNear);
            cut = path && splitJumps(path, nx, soft, e.net, w, [e.a.x, e.a.y], [e.b.x, e.b.y], sc.dirs, block);
            if (cut) { usedBlock = bl; break; }
          }
          if (cut) break;
          cut = findJumpBridge(nx, ny, bl, holeGrid, jStop, sx, sy, tx, ty, sc, near, e.net, allP);
          if (cut) { usedBlock = bl; break; }
        }
        autoroute.why[ratKey(e)] = cut ? "ok" : "không đặt được lỗ dây nhảy";
        if (!cut && depth === 0 && OPT.rip) {
          const near = t => t.pts.some((q, k) => k && [e.a, e.b].some(p => segDist(p.x, p.y, t.pts[k - 1][0], t.pts[k - 1][1], q[0], q[1]) < RZ + traceW(t) / 2 + CLR + 1));
          const rip = new Set(S.traces.filter(t => !t.lock && t.net !== e.net && near(t)).map(t => t.net));
          if (rip.size) {
            const keep = JSON.stringify([S.traces, S.jumpers]), kf = autoroute.failed.slice(), pd0 = pend;
            S.traces = S.traces.filter(t => t.lock || !rip.has(t.net)); S.jumpers = S.jumpers.filter(j => !j.auto || !rip.has(j.net));
            analyze(); const f1 = run(A.rats.filter(r => r.net === e.net), 1);
            analyze(); const f2 = run(A.rats.filter(r => rip.has(r.net)), 1);
            pend = pd0;
            if (!f1 && !f2) { autoroute.why[ratKey(e)] = "ok sau khi gỡ " + [...rip].join(","); continue; }
            [S.traces, S.jumpers] = JSON.parse(keep); autoroute.failed = kf; analyze();
          }
        }
        if (!cut) { fail++; autoroute.failed.push(ratKey(e)); continue; }
        let trA = false, trB = false;
        if (cut.segs.length) {
          const t0 = trimSame(cut.segs[0], e, "a"); cut.segs[0] = t0.path; trA = t0.a;
          const last = cut.segs.length - 1, t1 = trimSame(cut.segs[last], e, "b"); cut.segs[last] = t1.path; trB = t1.b;
        }
        cut.segs.forEach((sg, i) => {
          if (sg.length < 2) return;
          let pts = toMMs(straighten(sg, nx, usedBlock, sc));
          if (i === 0 && !trA) pts[0] = [e.a.x, e.a.y];
          if (i === cut.segs.length - 1 && !trB) pts[pts.length - 1] = [e.b.x, e.b.y];
          pts = simplify(pts);
          if (pts.length >= 2 && (pts.length > 2 || Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) > .05)) {
            const nt = { id: S.uid++, net: e.net, pts, lock: false }; S.traces.push(nt); link(nt, e);
          }
        });
        for (const [a, b] of cut.jumps) S.jumpers.push({ id: S.uid++, net: e.net, a: [r3(a[0] * Q), r3(a[1] * Q)], b: [r3(b[0] * Q), r3(b[1] * Q)], auto: true });
        link(null, e);
      }
      return fail;
    }
  }
  function splitJumps(path, nx, soft, net, w, padA, padB, dirs = 8, block) {
    const styleOK = (a, b) => { const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]); return dx < 1e-6 || dy < 1e-6 || (dirs === 8 && Math.abs(dx - dy) < 1e-6); };
    const P = pads(), isSoft = c => soft[c[1] * nx + c[0]], mm = c => [c[0] * Q, c[1] * Q], onG = c => c[0] % 4 === 0 && c[1] % 4 === 0, K = 48, n = path.length, maxJ = 6 * G;
    const ny = soft.length / nx;
    const stubOK = (a, b) => {
      for (const t of S.traces) if (t.net !== net) for (let k = 0; k < t.pts.length - 1; k++) if (segSeg(a, b, t.pts[k], t.pts[k + 1]) < traceW(t) / 2 + CLR + w / 2) return false;
      return P.every(p => p.net === net || segDist(p.x, p.y, a[0], a[1], b[0], b[1]) >= (p.r || PAD_R) + CLR + w / 2);
    };
    const stubs = (pad, c0) => {
      const out = [];
      for (const [dx, dy] of DIRS) for (let k = 3; k <= 14; k++) { const h = [c0[0] + dx * k, c0[1] + dy * k], hm = mm(h); if (!stubOK(pad, hm)) break; if (holeOK(hm[0], hm[1], net, P)) out.push(h); }
      return out;
    };
    const offHoles = (c0) => {
      const out = [], cm = mm(c0);
      for (const [dx, dy] of DIRS) for (let k = 1; k <= 5; k++) {
        const h = [c0[0] + dx * k, c0[1] + dy * k];
        if (h[0] < 0 || h[1] < 0 || h[0] >= nx || h[1] >= ny || isSoft(h) || (block && block[h[1] * nx + h[0]])) break;
        const hm = mm(h); if (!stubOK(cm, hm)) break;
        if (holeOK(hm[0], hm[1], net, P)) out.push(h);
      }
      return out;
    };
    const recs = []; let start = 0, i = 0, tail = null, lead = null;
    const from = (a, b) => lead ? [lead, ...path.slice(a, b)] : path.slice(a, b);
    while (i < n) {
      if (!isSoft(path[i])) { i++; continue; }
      let j = i; while (j < n && isSoft(path[j])) j++;
      let nxt = j; while (nxt < n && !isSoft(path[nxt])) nxt++;
      let okA = [];
      const okB = [];
      for (let a = i - 1; a > start && a >= i - K; a--) { const p = mm(path[a]); if (holeOK(p[0], p[1], net, P)) okA.push({ cell: path[a], seg: from(start, a + 1) }); }
      if (okA.length < 4) for (let a = i - 1; a > start && a >= i - 16; a--) for (const h of offHoles(path[a])) okA.push({ cell: h, seg: [...from(start, a + 1), h], off: 1 });
      if (!okA.length && recs.length) { const pr = recs.pop(); P.length -= 2; okA = [{ cell: pr.ha, seg: pr.seg }]; }
      else if (!okA.length) okA = stubs(padA, path[0]).map(h => ({ cell: h, seg: [path[0], h] }));
      for (let b = j; b < n - 1 && b < nxt && b <= j + K; b++) { const p = mm(path[b]); if (holeOK(p[0], p[1], net, P)) okB.push({ cell: path[b], b }); }
      if (okB.length < 4) for (let b = j; b < n - 1 && b < nxt && b <= j + 16; b++) for (const h of offHoles(path[b])) okB.push({ cell: h, b, lead: true, off: 1 });
      if (!okB.length && nxt >= n) okB.push(...stubs(padB, path[n - 1]).map(h => ({ cell: h, b: -1 })));
      let best = null;
      for (const A of okA) for (const B of okB) {
        const pa = mm(A.cell), pb = mm(B.cell), len = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
        if (len < JP_MIN - 1e-6 || !styleOK(pa, pb) || (best && len > best.sc) || !lineOK(pa, pb, net, P)) continue;
        const sc = len + (onG(A.cell) ? 0 : .8) + (onG(B.cell) ? 0 : .8) + (A.off ? 1.2 : 0) + (B.off ? 1.2 : 0) + (len > maxJ ? 80 : 0);
        if (!best || sc < best.sc) best = { sc, A, B, pa, pb };
      }
      if (!best) for (const A of okA.slice(0, 14)) {
        const pa = mm(A.cell);
        for (const [dx, dy] of DIRS) {
          const step = dx && dy ? Math.SQRT2 * Q : Q; if (dx && dy && dirs === 4) continue;
          for (let k = Math.ceil((JP_MIN - 1e-6) / step); k * step <= maxJ + 1e-6; k++) {
            const h = [A.cell[0] + dx * k, A.cell[1] + dy * k], hm = mm(h), len = k * step;
            if (h[0] < 0 || h[1] < 0 || h[0] >= nx || h[1] >= ny || isSoft(h) || (best && len > best.sc)) continue;
            if (!holeOK(hm[0], hm[1], net, P) || !lineOK(pa, hm, net, P)) continue;
            for (let b = j; b < n - 1 && b < nxt && b <= j + 24; b++) {
              const c = path[b], cm = mm(c), sl = Math.hypot(cm[0] - hm[0], cm[1] - hm[1]);
              if (!sl || sl > 4 * G + 1e-6 || !styleOK(hm, cm) || !stubOK(hm, cm)) continue;
              const sc = len + .6 * sl + 1 + (onG(A.cell) ? 0 : .8) + (onG(h) ? 0 : .8);
              if (!best || sc < best.sc) best = { sc, A, B: { cell: h, b, lead: true }, pa, pb: hm };
            }
          }
        }
      }
      if (!best) return null;
      for (const p of [best.pa, best.pb]) P.push({ x: p[0], y: p[1], r: JP_R, net });
      recs.push({ seg: best.A.seg, ha: best.A.cell, hb: best.B.cell }); lead = best.B.lead ? best.B.cell : null;
      if (best.B.b < 0) { tail = [best.B.cell, path[n - 1]]; break; }
      start = best.B.b; i = start + 1;
    }
    const segs = recs.map(r => r.seg); segs.push(tail || from(start));
    return { segs, jumps: recs.map(r => [r.ha, r.hb]) };
  }
  function findJumpBridge(nx, ny, bl, holeGrid, jStop, sx, sy, tx, ty, sc, near, net, P) {
    const N = nx * ny, step = sc.dirs === 4 ? 2 : 1, q = new Int32Array(N);
    const flood = (ox, oy) => {
      const dist = new Float32Array(N).fill(Infinity), holes = [];
      let hd = 0, tl = 0; const st = oy * nx + ox; dist[st] = 0; q[tl++] = st;
      while (hd < tl) {
        const c = q[hd++], x = c % nx, y = (c - x) / nx, dc = dist[c];
        if (holeGrid[c]) holes.push(c);
        for (let d = 0; d < 8; d += step) {
          const x2 = x + DIRS[d][0], y2 = y + DIRS[d][1];
          if (x2 < 0 || y2 < 0 || x2 >= nx || y2 >= ny) continue;
          const c2 = y2 * nx + x2; if (dist[c2] < Infinity || bl[c2]) continue;
          if (d % 2 && (bl[y * nx + x2] || bl[y2 * nx + x])) continue;
          dist[c2] = dc + (d % 2 ? 1.414 : 1); q[tl++] = c2;
        }
      }
      return { dist, holes };
    };
    const fA = flood(sx, sy); if (!fA.holes.length) return null;
    const fB = flood(tx, ty); if (!fB.holes.length) return null;
    const { dist: dA, holes: hA } = fA, { dist: dB } = fB;
    hA.sort((a, b) => (dA[a] + Math.hypot(a % nx - tx, ((a / nx) | 0) - ty)) - (dA[b] + Math.hypot(b % nx - tx, ((b / nx) | 0) - ty)));
    let best = null, bestSc = Infinity;
    const lim = Math.min(hA.length, 300);
    for (let i = 0; i < lim; i++) {
      const cA = hA[i], da = dA[cA]; if (da >= bestSc) continue;
      const xA = cA % nx, yA = (cA - xA) / nx, onGa = xA % 4 === 0 && yA % 4 === 0 ? 0 : 1.2;
      for (let jd = 0; jd < 8; jd += step) {
        const [dx, dy] = DIRS[jd], isDiag = dx && dy, minK = isDiag ? 6 : 8, maxK = isDiag ? 28 : 40, stepC = isDiag ? 1.414 : 1;
        for (let k = 1; k <= maxK; k++) {
          const x2 = xA + dx * k, y2 = yA + dy * k;
          if (x2 < 0 || y2 < 0 || x2 >= nx || y2 >= ny) break;
          const c2 = y2 * nx + x2; if (jStop[c2]) break;
          if (k < minK || dB[c2] === Infinity || !holeGrid[c2]) continue;
          const scVal = da + dB[c2] + k * stepC * 2.5 + onGa + (x2 % 4 === 0 && y2 % 4 === 0 ? 0 : 1.2);
          if (scVal < bestSc && lineOK([xA * Q, yA * Q], [x2 * Q, y2 * Q], net, P)) {
            bestSc = scVal; best = { xA, yA, xB: x2, yB: y2 };
          }
        }
      }
    }
    if (!best) return null;
    const seg1 = astar(nx, ny, bl, sx, sy, best.xA, best.yA, sc, null, near);
    const seg2 = seg1 && astar(nx, ny, bl, best.xB, best.yB, tx, ty, sc, null, near);
    return seg1 && seg2 ? { segs: [seg1, seg2], jumps: [[[best.xA, best.yA], [best.xB, best.yB]]] } : null;
  }
  function astar(nx, ny, block, sx, sy, tx, ty, sc, soft, near) {
    const N = nx * ny, g = new Float32Array(N * 9).fill(Infinity), from = new Int32Array(N * 9).fill(-1), done = new Uint8Array(N * 9), cellCnt = new Uint8Array(N);
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
    while (hn) {
      const s = pop(); if (done[s]) continue; done[s] = 1;
      const cell = Math.floor(s / 9);
      if (cellCnt[cell] >= 2) continue; cellCnt[cell]++;
      if (++it > 80000) break;
      const d = s % 9, x = cell % nx, y = Math.floor(cell / nx);
      if (x === tx && y === ty) { const out = []; let k = s; while (k >= 0) { const c = Math.floor(k / 9); out.push([c % nx, Math.floor(c / nx)]); k = from[k]; } return out.reverse(); }
      for (let nd = 0; nd < 8; nd += step) {
        if (d !== 8) { const turn = Math.min((nd - d + 8) % 8, (d - nd + 8) % 8); if (turn > 2) continue; }
        const x2 = x + DIRS[nd][0], y2 = y + DIRS[nd][1]; if (x2 < 0 || y2 < 0 || x2 >= nx || y2 >= ny) continue;
        const c2 = y2 * nx + x2; if (block[c2] && !(x2 === tx && y2 === ty)) continue;
        if (nd % 2 && (block[y * nx + x2] || block[y2 * nx + x])) continue;
        const turn = d === 8 ? 0 : Math.min((nd - d + 8) % 8, (d - nd + 8) % 8);
        let cost = g[s] + (nd % 2 ? Math.SQRT2 * sc.diag : 1) + (turn === 1 ? sc.t45 : turn === 2 ? sc.t90 : 0);
        if (soft && soft[c2]) cost += soft[cell] ? 15 : 30;
        if (near && near[c2]) cost += OPT.nearCost;
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
  // gộp mọi điểm thẳng hàng (ngang / dọc / 45° hoặc bất kỳ góc thẳng nào): trên 1 đoạn thẳng chỉ giữ đúng 2 đầu mút
  function simplify(pts) {
    if (!pts || pts.length <= 2) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      const dx1 = b[0] - a[0], dy1 = b[1] - a[1], dx2 = c[0] - b[0], dy2 = c[1] - b[1];
      const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2);
      if (l1 < 1e-4 || l2 < 1e-4) continue;
      const cross = Math.abs(dx1 * dy2 - dy1 * dx2) / (l1 * l2), dot = (dx1 * dx2 + dy1 * dy2) / (l1 * l2);
      if (cross > .015 || dot < 0) out.push(b);
    }
    out.push(pts[pts.length - 1]); return out;
  }
  if (S.traces) S.traces.forEach(t => { if (t.pts && t.pts.length > 2) t.pts = simplify(t.pts); });

  // phương án cuối cho đường vẫn không đi được (kể cả dây nhảy): đặt 2 lỗ pad ở chỗ trống gần 2 chân (3–15 mm, đúng lưới 2,54),
  const jNo = j => S.jumpers.indexOf(j) + 1;   // mọi dây nhảy đánh số chung J1, J2…

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
      const w = traceW(t), d = "M" + t.pts.map(p => p.join(" ")).join(" L"), on = ui.sel && ui.sel.t === "t" && ui.sel.id === t.id, sk = on && ui.sel.k != null && t.pts[ui.sel.k + 1] ? ui.sel.k : null;
      const g = el("g", { class: "trace" + (on && sk == null ? " sel" : "") + (t.lock ? " lock" : "") + (isFree(t.net) ? " free" : "") + (hl && hl === t.net ? " hl" : "") + (hl && hl !== t.net ? " dim" : ""), "data-t": t.id }, LY.cu);
      el("path", { d, "stroke-width": w, class: "cu" }, g);
      el("path", { d, "stroke-width": Math.max(w, 2.2), class: "hit" }, g);
      if (sk != null) el("path", { d: `M${t.pts[sk].join(" ")} L${t.pts[sk + 1].join(" ")}`, "stroke-width": w, class: "cu segsel" }, g);   // đoạn đang chọn (từ góc tới góc)
    }
    // chân
    for (const p of A.P) {
      const g = el("g", { class: "pad" + (p.net ? "" : " nc") + (hl && p.net === hl ? " hl" : "") + (hl && p.net && p.net !== hl ? " dim" : ""), "data-p": p.c.id + ":" + p.i }, LY.pads);
      if (p.sq) el("rect", { x: p.x - PAD_R, y: p.y - PAD_R, width: 2 * PAD_R, height: 2 * PAD_R, rx: .15, class: "padcu" }, g); else el("circle", { cx: p.x, cy: p.y, r: p.r || PAD_R, class: "padcu" }, g);
      el("circle", { cx: p.x, cy: p.y, r: p.r ? JP_DRILL : DRILL_R, class: "drill" }, g);
    }
    // dây nhảy: nét trắng mảnh (quy ước chung cho ký hiệu linh kiện) nằm ở mặt linh kiện
    for (const j of S.jumpers) {
      const onJ = ui.sel && ui.sel.t === "j" && ui.sel.id === j.id;
      const g = el("g", { class: "jw" + (onJ ? " sel" : "") + (hl && hl !== j.net ? " dim" : "") }, LY.jw);
      el("line", { x1: j.a[0], y1: j.a[1], x2: j.b[0], y2: j.b[1], class: "jwl" }, g);
      { const n = jNo(j); [[j.a, j.b, "a"], [j.b, j.a, "b"]].forEach(([e, o, s]) => el("text", { x: e[0] + 1.1, y: o[0] > e[0] && o[1] < e[1] ? e[1] + 2 : e[1] - 1, class: "extl" }, g, "J" + n + s)); }
      if (onJ) [j.a, j.b].forEach((e, i) => el("circle", { cx: e[0], cy: e[1], r: JP_R + .35, class: "jhdl", "data-jh": j.id + ":" + i }, LY.sel));
    }
    // dây bay
    if (S.rats) for (const r of A.rats) el("line", { x1: r.a.x, y1: r.a.y, x2: r.b.x, y2: r.b.y, class: "rat" + (hl && r.net === hl ? " hl" : "") }, LY.rats);
    // lỗi khoảng cách
    for (const v of A.drc) { el("circle", { cx: v.x, cy: v.y, r: 1.4, class: "drcmark" }, LY.drc); if (v.s) el("path", { d: `M${v.s.a.join(" ")} L${v.s.b.join(" ")}`, "stroke-width": v.s.w + .4, class: "drcseg" }, LY.drc); }
    // điểm gập của đường đang chọn
    if (ui.sel && ui.sel.t === "t") { const t = S.traces.find(x => x.id === ui.sel.id); if (t) t.pts.forEach((p, i) => { if (i > 0 && i < t.pts.length - 1) el("rect", { x: p[0] - .55, y: p[1] - .55, width: 1.1, height: 1.1, class: "vtx", "data-v": i }, LY.sel); else el("circle", { cx: p[0], cy: p[1], r: .65, class: "vtx vend", "data-v": i }, LY.sel); }); }   // 2 đầu dây: nút tròn, kéo được
    if (ui.tool === "ms" && ui.meas) drawMeas();   // giữ số đo sau khi vẽ lại
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
  // tên 2 đầu dây nhảy (J1a / J1b) cạnh lỗ, né phần thân dây đi chéo lên phải
  const jText = (j, fs) => [[j.a, j.b, "a"], [j.b, j.a, "b"]].map(([e, o, s]) => `<text x="${e[0] + 1.1}" y="${o[0] > e[0] && o[1] < e[1] ? e[1] + 2 : e[1] - 1}" font-size="${fs}" font-weight="700" font-family="sans-serif">J${jNo(j)}${s}</text>`).join("");
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
      for (const j of S.jumpers) o.push(`<line x1="${j.a[0]}" y1="${j.a[1]}" x2="${j.b[0]}" y2="${j.b[1]}" stroke="#000" stroke-width=".15" stroke-dasharray=".8 .5"/>` + jText(j, 1.2));
      for (const p of P) o.push(`<circle cx="${p.x}" cy="${p.y}" r="${(p.r || PAD_R) + .25}" fill="#fff"/>`);
    } else {
      for (const c of S.comps) {
        const f = FP[c.fp], b = f.body, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        o.push(`<g transform="translate(${c.x} ${c.y}) rotate(${c.rot})"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${f.round ? b.h / 2 : .6}" fill="none" stroke="#000" stroke-width=".2"/>`
          + hdrText(f, 1.3) + (f.label ? `<text x="${cx}" y="${cy}" font-size="2" font-family="sans-serif" text-anchor="middle" dominant-baseline="central"${c.rot % 180 ? ` transform="rotate(-90 ${cx} ${cy})"` : ""}>${f.label}</text>` : "")
          + `<text x="${b.x + .6}" y="${b.y - .8}" font-size="1.5" font-weight="700" font-family="sans-serif">${c.id}${c.val ? " " + c.val : ""}</text></g>`);
      }
      for (const p of P) o.push(`<circle cx="${p.x}" cy="${p.y}" r="${(p.r || PAD_R) * .8}" fill="none" stroke="#000" stroke-width=".15"/>`);
      for (const j of S.jumpers) o.push(`<line x1="${j.a[0]}" y1="${j.a[1]}" x2="${j.b[0]}" y2="${j.b[1]}" stroke="#000" stroke-width=".35" stroke-linecap="round"/>` + jText(j, 1.4));
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
    if (ui.free) return [b];
    const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy), d = Math.min(ax, ay), sx = Math.sign(dx), sy = Math.sign(dy);
    if (!ax || !ay || ax === ay) return [b];
    if (SCHEMES[S.scheme].dirs === 4) return S.posture ? [[a[0], b[1]], b] : [[b[0], a[1]], b];
    const m = S.posture ? [a[0] + sx * d, a[1] + sy * d] : (ax > ay ? [a[0] + sx * (ax - d), a[1]] : [a[0], a[1] + sy * (ay - d)]);
    return [[r3(m[0]), r3(m[1])], b];
  }
  function aim(a, b) {
    if (ui.free) return b;
    const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy), r = ui.route;
    let d = SCHEMES[S.scheme].dirs === 8 && Math.min(ax, ay) > .414 * Math.max(ax, ay) ? [Math.sign(dx), Math.sign(dy)] : ax >= ay ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
    // chống rung tay: đang đi theo 1 hướng thì chỉ quẹo khi chuột lệch khỏi hướng đó ≥ 2 bước chân (5,08 mm);
    // kéo chuột lùi về theo cùng hướng thì đoạn ngắn lại (không quẹo)
    if (r && r.dir) { const c = r.dir, l = Math.hypot(c[0], c[1]), along = (dx * c[0] + dy * c[1]) / l, off = Math.abs(dx * c[1] - dy * c[0]) / l; if (off < 2 * G && along > -G) d = c; }
    if (r && Math.hypot(dx, dy) >= G / 2) r.dir = d;   // chỉ khoá hướng khi chuột đã rời điểm neo nửa bước chân
    if (d[0] && d[1]) { const t = Math.max(0, snap((dx * d[0] + dy * d[1]) / 2, Q)); return [r3(a[0] + d[0] * t), r3(a[1] + d[1] * t)]; }
    return d[0] ? [r3(a[0] + d[0] * Math.max(0, dx * d[0])), a[1]] : [a[0], r3(a[1] + d[1] * Math.max(0, dy * d[1]))];
  }
  function startRoute(net, start) {
    ui.mode = "route"; ui.route = { net, pts: [start], cur: start }; ui.hlNet = net; svg.classList.add("routing");
    $("#plHint").textContent = L("Bấm để đặt từng điểm neo (ngang / dọc / 45°) · bấm chân / đường để nối · chuột phải / Enter dừng tại chỗ · Shift = góc tự do · Backspace bớt điểm · Esc huỷ", "Click to place a corner · click a pin / trace to connect · right-click / Enter stops here · Shift = any angle · / flips 45° · Backspace removes a corner · Esc cancels");
    render(); drawRoute();
  }
  function drawRoute() {
    const r = ui.route; LY.tmp.innerHTML = ""; if (!r) return;
    const last = r.pts[r.pts.length - 1], pd = padAt({ x: r.cur[0], y: r.cur[1] }), end = pd && Math.hypot(pd.x - r.cur[0], pd.y - r.cur[1]) < .01, pts = [...r.pts, ...(end ? posture(last, r.cur) : [aim(last, r.cur)])], w = PWR.has(r.net) ? W_PWR : W_SIG;
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
      dedupe();
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
      if (on && !on.jw && !on.hole) return toast(L("Dây nhảy không hàn thẳng vào chân: vẽ đường đồng từ chân ra chỗ thoáng rồi đặt lỗ.", "Jumpers never solder straight onto a pin: draw copper from the pin to a clear spot, then place the hole."));
      if (on) { if (on.net !== net && !joinNet(on.net)) return toast(L(`Chân ${on.name} thuộc mạng khác.`, `Pin ${on.name} is on another net.`)); const n2 = ui.route.pendJoin ? ui.route.pendJoin[1] : net; if (ui.route.pts.length > 1 || ui.route.pendJoin) finishRoute([on.x, on.y], true); else cancel(); return startJfree(n2, [on.x, on.y]); }
      if (!holeOK(q[0], q[1], net, P)) return toast(L("Chỗ này quá sát chân hoặc đường khác – chọn chỗ thoáng hơn.", "Too close to a pin or another trace – pick a clearer spot."));
      finishRoute(q); startJfree(net, q); ui.jf.cont = true; return;
    }
    cancel(); ui.mode = "hole"; ui.hole = {}; svg.classList.add("routing");
    $("#plHint").textContent = L("Dây nhảy: bấm điểm đầu (chân, lỗ, đường đồng hoặc chỗ trống) · Esc huỷ", "Jumper: click the start (pin, hole, trace or free spot) · Esc cancels"); render();
  }
  function pickHole(p) {
    const pd = padAt(p);
    if (pd && !pd.jw && !pd.hole) return toast(L("Dây nhảy không hàn thẳng vào chân: vẽ đường đồng từ chân ra chỗ thoáng rồi đặt lỗ.", "Jumpers never solder straight onto a pin: draw copper from the pin to a clear spot, then place the hole."));
    if (pd) return startJfree(pd.net, [pd.x, pd.y]);
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
    if (pd && !pd.jw && !pd.hole) return toast(L("Dây nhảy không hàn thẳng vào chân: vẽ đường đồng từ chân ra chỗ thoáng rồi đặt lỗ.", "Jumpers never solder straight onto a pin: draw copper from the pin to a clear spot, then place the hole."));
    if (pd) { if (!ok(pd.net)) return toast(L(`Chân ${pd.name} thuộc mạng ${pd.net || "trống"}, không nối được.`, `Pin ${pd.name} is on net ${pd.net || "none"}, can't connect.`)); b = [pd.x, pd.y]; end = pd.net; }
    else { const sg = segAt(p); if (sg && ok(sg.t.net)) { b = proj(sg.t, p).q.map(r3); end = sg.t.net; } }
    if (Math.hypot(b[0] - J.a[0], b[1] - J.a[1]) < G - .01) return toast(L("Hai đầu dây nhảy phải cách nhau ít nhất 2,54 mm.", "Jumper ends must be at least 2.54 mm apart."));
    if (!pd && !holeOK(b[0], b[1], J.net, P)) return toast(L("Chỗ này quá sát chân hoặc đường khác – chọn chỗ thoáng hơn.", "Too close to a pin or another trace – pick a clearer spot."));
    if (!lineOK(J.a, b, J.net, P)) return toast(L("Dây trần đi ngang chân khác mạng – chọn chỗ khác.", "Bare jumper would cross another net's pin – pick another spot."));
    checkpoint();
    if (end && end !== J.net) { const [from, to] = isFree(J.net) ? [J.net, end] : [end, J.net]; adopt(from, to); J.net = to; }
    const j = { id: S.uid++, net: J.net, a: J.a, b };
        S.jumpers.push(j);
    const len = Math.hypot(b[0] - J.a[0], b[1] - J.a[1]), cp = P.filter(q => !q.jw && !q.hole), near = Math.min(...[J.a, b].filter(e => !cp.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .1)).map(e => Math.min(...cp.map(q => Math.hypot(q.x - e[0], q.y - e[1])))));   // chỉ xét lỗ mới, không xét đầu nằm trên chân
    const warn = (len < 10 ? L(` · ⚠ dây chỉ dài ${len.toFixed(1)} mm (nên ≥ 10 mm)`, ` · ⚠ only ${len.toFixed(1)} mm long (≥ 10 mm advised)`) : "") + (near < 5 ? L(` · ⚠ lỗ cách chân ${near.toFixed(1)} mm (nên ≥ 5 mm)`, ` · ⚠ hole ${near.toFixed(1)} mm from a pin (≥ 5 mm advised)`) : "");
    if (end) { cancel(); ui.sel = { t: "j", id: j.id }; render(); return toast(L("Đã nối xong. Chuột phải lên nét nhảy → Đổi thành đồng, hoặc dùng Pen tô lên.", "Connected. Right-click a jumper → Convert to copper, or trace over it with the Pen.") + warn); }
    if (!J.cont) { startJfree(J.net, b); $("#plHint").textContent = L("Bấm tiếp điểm kế (tạo lỗ) hoặc chân / lỗ đích · chuột phải hoặc Esc để dừng", "Click the next point (adds a hole) or the target pin / hole · right-click or Esc to stop"); return warn && toast(warn.slice(3)); }
    startRoute(J.net, b); toast(L("Đã đặt dây nhảy – vẽ tiếp đường đồng từ lỗ thứ 2.", "Jumper placed – keep drawing copper from the 2nd hole.") + warn);
  }
  /* ---------- công cụ kiểu bút chì: Chọn · Pen · Bút dây nhảy · Trim · Fill (F) · Chamfer (C) ---------- */
  const TOOLS = () => ({ sel: [L("Chọn", "Select"), L("Kéo linh kiện, chọn đường, kéo nền để di chuyển (Esc)", "Drag parts, select traces, drag the background to pan (Esc)")],
    cu: ["Pen", L("Bấm bất kỳ đâu → bấm các góc → bấm chân / đường để nối, hoặc chuột phải / Enter để dừng tại chỗ · giữ Shift: góc tự do (B)", "Click anywhere → click corners → click a pin / trace to connect, or right-click / Enter to stop there · hold Shift: any angle (B)")],
    jw: [L("Bút dây nhảy", "Jumper pen"), L("Bấm X → các điểm A, B… (tự tạo lỗ) → chân đích Y; chuột phải để dừng. Sau đó đổi nét thành đồng hoặc tô bằng Pen (J)", "Click X → points A, B… (holes added) → target pin Y; right-click stops. Then convert to copper or trace over with the Pen (J)")],
    ms: [L("Thước", "Ruler"), L("Bấm điểm 1 → điểm 2 để đo; bám tâm lỗ / chân và tâm đường đồng (M)", "Click point 1 → point 2 to measure; snaps to hole / pin centres and trace centrelines (M)")],
    tr: ["Trim", L("Bấm 2 điểm trên 1 đường đồng → bỏ đoạn giữa; bấm dây nhảy để xoá (T)", "Click 2 points on a trace → the part between is removed; click a jumper to delete it (T)")],
    tf: ["Fill (F)", L("Hàn 2 dây không vát góc (tự cắt đoạn nhú dư hoặc kéo dài 2 đầu chưa join tới góc giao nhau) · Bấm chỗ giao nhau hoặc bấm dây 1 → dây 2 · Chuột phải thoát (F)", "Weld 2 traces without bevel (trims overshoot or extends unjoined ends to a sharp corner) · Click intersection or wire 1 → wire 2 · Right-click exits (F)")],
    tc: ["Chamfer (C)", L("Hàn 2 dây có vát góc 45° (tự cắt đoạn nhú dư hoặc kéo dài 2 đầu chưa join rồi vát góc) · Bấm chỗ giao nhau hoặc bấm dây 1 → dây 2 · Chuột phải thoát (C)", "Weld 2 traces with a 45° bevel (trims overshoot or extends unjoined ends and chamfers the corner) · Click intersection or wire 1 → wire 2 · Right-click exits (C)")] });
  function setTool(t) {
    if (LY.tmp) cancel(); ui.tool = t; ui.weld1 = null; svg.dataset.tool = t;
    $$(".pl-tools [data-tool], #plFly [data-tool], #plBar [data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === t));
    $("#plHint").textContent = t === "sel" ? "" : TOOLS()[t][0] + ": " + TOOLS()[t][1];
  }
  // tìm tất cả đoạn dây gần điểm p (trong bán kính maxD mm), sắp xếp từ gần tới xa
  function segsNear(p, maxD = 2.4) {
    const out = [];
    for (const t of S.traces) for (let k = 0; k < t.pts.length - 1; k++) {
      const a = t.pts[k], b = t.pts[k + 1], d = segDist(p.x, p.y, a[0], a[1], b[0], b[1]);
      if (d <= maxD) out.push({ t, k, d, p: { x: p.x, y: p.y } });
    }
    return out.sort((a, b) => a.d - b.d);
  }
  const polyLen = pts => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  const heldEnd = (pt, selfT) => A.P.some(q => Math.hypot(q.x - pt[0], q.y - pt[1]) < .15)
    || S.jumpers.some(j => Math.hypot(j.a[0] - pt[0], j.a[1] - pt[1]) < .15 || Math.hypot(j.b[0] - pt[0], j.b[1] - pt[1]) < .15)
    || S.traces.some(t => t !== selfT && t.net === selfT.net && t.pts.some((b, k) => k && segDist(pt[0], pt[1], t.pts[k - 1][0], t.pts[k - 1][1], b[0], b[1]) < .12));
  // tính đường hàn giữa 2 đoạn s1=(t1,k1) và s2=(t2,k2) theo kiểu mode="fill" (không vát) hoặc "chamfer" (có vát góc 45°)
  function computeWeld(s1, s2, mode) {
    if (!s1 || !s2) return null;
    let { t: t1, k: k1, p: p1 } = s1, { t: t2, k: k2, p: p2 } = s2;
    if (t1.net !== t2.net && !isFree(t1.net) && !isFree(t2.net)) return { err: L(`Hai dây khác mạng (${t1.net} ≠ ${t2.net}), không hàn nối được.`, `Different nets (${t1.net} ≠ ${t2.net}), cannot weld.`) };
    if (t1 === t2) {
      if (k1 === k2) return null;
      if (k1 > k2) { [k1, k2] = [k2, k1]; [p1, p2] = [p2, p1]; }
    }
    const a1 = t1.pts[k1], b1 = t1.pts[k1 + 1], a2 = t2.pts[k2], b2 = t2.pts[k2 + 1];
    if (!a1 || !b1 || !a2 || !b2) return null;
    const d1 = [b1[0] - a1[0], b1[1] - a1[1]], L1 = Math.hypot(d1[0], d1[1]);
    const d2 = [b2[0] - a2[0], b2[1] - a2[1]], L2 = Math.hypot(d2[0], d2[1]);
    if (L1 < 1e-4 || L2 < 1e-4) return null;
    const den = d1[0] * d2[1] - d1[1] * d2[0], sinA = Math.abs(den) / (L1 * L2);
    const net = isFree(t1.net) ? t2.net : t1.net;
    const makeMid = (P, A1, A2) => {
      if (mode === "fill") return [P];
      const v1 = [A1[0] - P[0], A1[1] - P[1]], l1 = Math.hypot(v1[0], v1[1]);
      const v2 = [A2[0] - P[0], A2[1] - P[1]], l2 = Math.hypot(v2[0], v2[1]);
      // độ lớn vát = khoảng cách từ góc P tới chỗ bấm chuột (bấm xa góc → vát lớn); bấm sát góc thì dùng mặc định
      const cp = p2 || p1, dcl = cp ? Math.hypot(cp.x - P[0], cp.y - P[1]) : 0;
      const dc = dcl > Q ? Math.min(snap(dcl, Q), Math.min(l1, l2) * .9) : Math.min(G, Math.max(Q, snap(Math.min(l1, l2) * .45, Q)), Math.min(l1, l2) * .85);
      return dc > .15 && l1 > .25 && l2 > .25
        ? [[r3(P[0] + v1[0] / l1 * dc), r3(P[1] + v1[1] / l1 * dc)], [r3(P[0] + v2[0] / l2 * dc), r3(P[1] + v2[1] / l2 * dc)]]
        : [P];
    };
    if (t1 === t2) {
      if (sinA <= .03) return null;
      const u1 = ((a2[0] - a1[0]) * d2[1] - (a2[1] - a1[1]) * d2[0]) / den;
      const P = [r3(a1[0] + u1 * d1[0]), r3(a1[1] + u1 * d1[1])];
      const pre = t1.pts.slice(0, k1 + 1), suf = t1.pts.slice(k2 + 1);
      const mid = makeMid(P, pre[pre.length - 1], suf[0]);
      return { pts: simplify([...pre, ...mid, ...suf]), t1, t2, net, P };
    }
    const pickArm = (t, k, u, P, cp) => {
      const a = t.pts[k], b = t.pts[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      let c0 = t.pts.slice(0, k + 1), c1 = t.pts.slice(k + 1).reverse();
      if (c0.length > 1 && Math.hypot(c0[c0.length - 1][0] - P[0], c0[c0.length - 1][1] - P[1]) < .08) c0.pop();
      if (c1.length > 1 && Math.hypot(c1[c1.length - 1][0] - P[0], c1[c1.length - 1][1] - P[1]) < .08) c1.pop();
      if (u > 1.02) return c0;
      if (u < -.02) return c1;
      const len0 = polyLen([...c0, P]), len1 = polyLen([...c1, P]);
      if (len0 < .15) return c1;
      if (len1 < .15) return c0;
      const h0 = heldEnd(t.pts[0], t), h1 = heldEnd(t.pts[t.pts.length - 1], t);
      if (h0 && !h1) return c0;
      if (h1 && !h0) return c1;
      if (cp) {
        const uc = ((cp.x - a[0]) * dx + (cp.y - a[1]) * dy) / l2;
        if (Math.abs(uc - u) > .12 && Math.hypot(cp.x - P[0], cp.y - P[1]) > .8) return uc < u ? c0 : c1;
      }
      return len0 >= len1 ? c0 : c1;
    };
    if (sinA > .03) {
      const u1 = ((a2[0] - a1[0]) * d2[1] - (a2[1] - a1[1]) * d2[0]) / den;
      const u2 = ((a2[0] - a1[0]) * d1[1] - (a2[1] - a1[1]) * d1[0]) / den;
      const P = [r3(a1[0] + u1 * d1[0]), r3(a1[1] + u1 * d1[1])];
      if (P[0] >= -15 && P[1] >= -15 && P[0] <= S.board.w + 15 && P[1] <= S.board.h + 15) {
        const cA = pickArm(t1, k1, u1, P, p1), cB = pickArm(t2, k2, u2, P, p2);
        const mid = makeMid(P, cA[cA.length - 1], cB[cB.length - 1]);
        return { pts: simplify([...cA, ...mid, ...cB.slice().reverse()]), t1, t2, net, P };
      }
    }
    // 2 đoạn song song / thẳng hàng chưa join nhau: chọn cặp đầu mút gần nhau nhất
    let bestE = null;
    for (const i1 of [0, 1]) for (const i2 of [0, 1]) {
      const e1 = i1 ? b1 : a1, e2 = i2 ? b2 : a2;
      const h1 = heldEnd(i1 ? t1.pts[t1.pts.length - 1] : t1.pts[0], t1), h2 = heldEnd(i2 ? t2.pts[t2.pts.length - 1] : t2.pts[0], t2);
      const sc = Math.hypot(e1[0] - e2[0], e1[1] - e2[1]) + (h1 ? 25 : 0) + (h2 ? 25 : 0);
      if (!bestE || sc < bestE.sc) bestE = { sc, i1, i2, e1, e2 };
    }
    const cA = bestE.i1 ? t1.pts.slice(0, k1 + 2) : t1.pts.slice(k1).reverse();
    const cB = bestE.i2 ? t2.pts.slice(0, k2 + 2) : t2.pts.slice(k2).reverse();
    const E1 = cA[cA.length - 1], E2 = cB[cB.length - 1];
    const dPerp = Math.abs((E2[0] - a1[0]) * d1[1] - (E2[1] - a1[1]) * d1[0]) / L1;
    let mid = [];
    if (dPerp >= .15) {
      const up = ((E2[0] - a1[0]) * d1[0] + (E2[1] - a1[1]) * d1[1]) / (L1 * L1);
      const M = [r3(a1[0] + up * d1[0]), r3(a1[1] + up * d1[1])];
      if (mode === "fill") mid = [M];
      else {
        const vx = E1[0] - M[0], vy = E1[1] - M[1], vl = Math.hypot(vx, vy) || 1, step = Math.min(dPerp, vl * .8);
        mid = [[r3(M[0] + vx / vl * step), r3(M[1] + vy / vl * step)]];
      }
    }
    return { pts: simplify([...cA, ...mid, ...cB.slice().reverse()]), t1, t2, net, P: E1 };
  }
  // tìm cặp đoạn dây ngay tại điểm con trỏ p (khi bấm 1 chạm vào chỗ giao nhau / khe hở giữa 2 dây / góc)
  function findWeldPairAt(p, mode) {
    const near = segsNear(p, 4.2);
    if (!near.length) return null;
    const s0 = near[0];
    for (let i = 1; i < near.length; i++) {
      const s1 = near[i];
      if (s1.t !== s0.t && (s1.t.net === s0.t.net || isFree(s1.t.net) || isFree(s0.t.net))) return [s0, s1];
    }
    if (s0.d > 2.2) return null;
    // cùng 1 dây: bấm vào góc vuông để Chamfer, hoặc bấm vào đoạn vát 45° để Fill vuông lại
    if (mode === "fill" && s0.k > 0 && s0.k < s0.t.pts.length - 2) {
      const a = s0.t.pts[s0.k], b = s0.t.pts[s0.k + 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4 * G) return [{ t: s0.t, k: s0.k - 1, p }, { t: s0.t, k: s0.k + 1, p }];
    }
    for (let i = 1; i < near.length; i++) {
      if (near[i].d <= 2.2 && near[i].t === s0.t && Math.abs(near[i].k - s0.k) === 1) return [s0, near[i]];
    }
    return null;
  }
  function applyWeld(w, mode) {
    if (!w) return false;
    if (w.err) { toast(w.err); return false; }
    if (!w.pts || w.pts.length < 2) return false;
    checkpoint();
    if (w.t1 !== w.t2) {
      if (isFree(w.t1.net) && !isFree(w.t2.net)) adopt(w.t1.net, w.t2.net);
      else if (isFree(w.t2.net) && !isFree(w.t1.net)) adopt(w.t2.net, w.t1.net);
      S.traces = S.traces.filter(t => t !== w.t1 && t !== w.t2);
      const nt = { id: S.uid++, net: w.net, pts: w.pts, lock: true, w: w.t1.w || w.t2.w };
      S.traces.push(nt); ui.sel = { t: "t", id: nt.id }; ui.hlNet = nt.net;
    } else {
      w.t1.pts = w.pts; w.t1.lock = true; ui.sel = { t: "t", id: w.t1.id }; ui.hlNet = w.t1.net;
    }
    dedupe(); gcHoles(); ui.weld1 = null; LY.tmp.innerHTML = ""; render();
    toast(mode === "fill"
      ? L("Đã hàn nối 2 dây không vát góc (Fill) và cắt gọn phần nhú dư.", "Welded traces with sharp corner (Fill) and trimmed excess.")
      : L("Đã hàn nối 2 dây có vát góc 45° (Chamfer) và cắt gọn phần nhú dư.", "Welded traces with 45° bevel (Chamfer) and trimmed excess."));
    return true;
  }
  function drawWeldPreview(p, mode) {
    LY.tmp.innerHTML = "";
    let w = null;
    if (ui.weld1) {
      const a = ui.weld1.t.pts[ui.weld1.k], b = ui.weld1.t.pts[ui.weld1.k + 1];
      if (a && b) el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "stroke-width": traceW(ui.weld1.t), class: "cu segsel" }, LY.tmp);
      const sg = segAt(p);
      if (sg && (sg.t !== ui.weld1.t || sg.k !== ui.weld1.k)) w = computeWeld(ui.weld1, { t: sg.t, k: sg.k, p }, mode);
    } else {
      const pair = findWeldPairAt(p, mode);
      if (pair) w = computeWeld(pair[0], pair[1], mode);
    }
    if (w && w.pts && w.pts.length >= 2) {
      const sw = traceW(w.t1 || { net: w.net });
      el("path", { d: "M" + w.pts.map(q => q.join(" ")).join(" L"), "stroke-width": sw, class: "cu tmp" }, LY.tmp);
      if (w.P) el("circle", { cx: w.P[0], cy: w.P[1], r: .55, class: "pen-nib" }, LY.tmp);
    }
  }
  function pickWeld(p, mode) {
    if (ui.weld1) {
      const sg = segAt(p);
      if (!sg) return toast(L("Bấm lên đoạn dây thứ 2 cần hàn nối (hoặc chuột phải để thoát).", "Click the 2nd trace segment to weld (or right-click to exit)."));
      if (sg.t === ui.weld1.t && sg.k === ui.weld1.k) return toast(L("Hãy bấm vào đoạn dây thứ 2 khác với đoạn đầu.", "Click a different 2nd trace segment."));
      const w = computeWeld(ui.weld1, { t: sg.t, k: sg.k, p }, mode);
      if (!w) return toast(L("Không tìm được giao điểm hợp lệ giữa 2 đoạn dây này.", "Could not find a valid intersection between these two segments."));
      applyWeld(w, mode);
      return;
    }
    const pair = findWeldPairAt(p, mode);
    if (pair) {
      const w = computeWeld(pair[0], pair[1], mode);
      if (w && applyWeld(w, mode)) return;
    }
    const sg = segAt(p);
    if (!sg) return toast(L("Bấm vào chỗ 2 dây giao nhau hoặc bấm chọn dây thứ 1 trước.", "Click where 2 traces meet, or click the 1st trace first."));
    ui.weld1 = { t: sg.t, k: sg.k, p: { x: p.x, y: p.y } };
    ui.sel = { t: "t", id: sg.t.id, k: sg.k }; ui.hlNet = sg.t.net; render(); drawWeldPreview(p, mode);
    $("#plHint").textContent = (mode === "fill" ? "Fill (F): " : "Chamfer (C): ") + L("Đã chọn dây 1 – bấm tiếp dây thứ 2 để hàn nối (Chuột phải / Esc để thoát)", "Wire 1 selected – click Wire 2 to weld (Right-click / Esc to exit)");
  }
  function triggerWeldCmd(mode) {
    const toolKey = mode === "fill" ? "tf" : "tc";
    if (ui.sel && ui.sel.t === "t") {
      const t1 = S.traces.find(x => x.id === ui.sel.id);
      if (t1) {
        const k1 = Math.max(0, Math.min(ui.sel.k ?? 0, t1.pts.length - 2)), a1 = t1.pts[k1], b1 = t1.pts[k1 + 1];
        // kiểm tra xem đoạn đang chọn có đang cắt / chạm một dây cùng mạng (hoặc mạng tự do) khác không -> hàn ngay 1 chạm
        let hit = null;
        for (const t2 of S.traces) if (t2 !== t1 && (t2.net === t1.net || isFree(t2.net) || isFree(t1.net))) {
          for (let k2 = 0; k2 < t2.pts.length - 1; k2++) {
            const d = segSeg(a1, b1, t2.pts[k2], t2.pts[k2 + 1]);
            const sameNet = t2.net === t1.net && (!heldEnd(t1.pts[0], t1) || !heldEnd(t1.pts[t1.pts.length - 1], t1) || !heldEnd(t2.pts[0], t2) || !heldEnd(t2.pts[t2.pts.length - 1], t2));
            if ((d < traceW(t1) / 2 + traceW(t2) / 2 + .4 || (sameNet && d < 10)) && (!hit || d < hit.d)) hit = { t: t2, k: k2, d };
          }
        }
        if (hit) {
          const w = computeWeld({ t: t1, k: k1 }, { t: hit.t, k: hit.k }, mode);
          if (w && applyWeld(w, mode)) return;
        }
        setTool(toolKey);
        ui.weld1 = { t: t1, k: k1, p: { x: (a1[0] + b1[0]) / 2, y: (a1[1] + b1[1]) / 2 } };
        $("#plHint").textContent = (mode === "fill" ? "Fill (F): " : "Chamfer (C): ") + L("Đã chọn dây 1 – bấm tiếp dây thứ 2 để hàn nối (Chuột phải / Esc để thoát)", "Wire 1 selected – click Wire 2 to weld (Right-click / Esc to exit)");
        return;
      }
    }
    setTool(toolKey);
  }
  // Trim: bấm 2 điểm bất kỳ trên cùng 1 đường đồng → bỏ đoạn đồng nằm giữa 2 điểm, giữ 2 phần ngoài. Bấm lên dây nhảy → xoá dây nhảy đó
  const cutPart = (t, s0, s1) => {   // phần của đường t từ độ dài s0 tới s1 (mm, tính từ đầu đường)
    const out = []; let acc = 0;
    for (let k = 0; k < t.pts.length - 1; k++) {
      const a = t.pts[k], b = t.pts[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), at = s => { const u = l ? (s - acc) / l : 0; return [r3(a[0] + (b[0] - a[0]) * u), r3(a[1] + (b[1] - a[1]) * u)]; };
      if (acc + l >= s0 && acc <= s1) { if (!out.length) out.push(at(Math.max(s0, acc))); out.push(at(Math.min(s1, acc + l))); }
      acc += l;
    }
    return out.filter((q, i) => !i || q[0] !== out[i - 1][0] || q[1] !== out[i - 1][1]);
  };
  // Thước: bấm điểm 1 → rê → bấm điểm 2 để giữ số đo (bấm tiếp là đo lại). Điểm bám tâm chân / lỗ, tâm đường đồng, nếu không thì lưới 0,635
  function measSnap(p) {
    const pd = padAt(p); if (pd) return [pd.x, pd.y];
    const sg = segAt(p); if (sg) return proj(sg.t, p).q;
    return [snap(p.x, Q), snap(p.y, Q)];
  }
  function measPick(p) {
    const q = measSnap(p);
    if (!ui.meas || ui.meas.fixed) ui.meas = { a: q, b: q };
    else { ui.meas.b = q; ui.meas.fixed = true; }
    drawMeas();
  }
  function drawMeas(hover) {
    LY.tmp.innerHTML = "";
    const k = cam ? cam.w / 120 : 1;   // cỡ chữ / nét theo mức phóng
    if (hover) el("circle", { cx: hover[0], cy: hover[1], r: .55 * k, class: "measpt" }, LY.tmp);
    const m = ui.meas; if (!m) return;
    const [a, b] = [m.a, m.b], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "stroke-width": .25 * k, class: "measln" }, LY.tmp);
    for (const e of [a, b]) el("circle", { cx: e[0], cy: e[1], r: .45 * k, class: "measpt" }, LY.tmp);
    if (d > .01) {
      const tx = (a[0] + b[0]) / 2 + 1.2 * k, t = el("text", { x: tx, y: (a[1] + b[1]) / 2 - 1.2 * k, "font-size": 2.2 * k, class: "meastx", transform: S.flip ? `translate(${2 * tx} 0) scale(-1 1)` : "" }, LY.tmp, `${d.toFixed(2)} mm`);
      el("tspan", { x: tx, dy: 2.4 * k, "font-size": 1.6 * k }, t, `Δx ${Math.abs(dx).toFixed(2)} · Δy ${Math.abs(dy).toFixed(2)}`);
    }
  }
  function trimPick(p) {
    const sg = segAt(p);
    if (!sg) {
      const jw = S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6);
      if (jw) { checkpoint(); S.jumpers = S.jumpers.filter(j => j !== jw); gcHoles(); ui.trim = null; render(); return toast(L("Đã xoá dây nhảy.", "Jumper removed.")); }
      return toast(L("Bấm lên đường đồng (hoặc dây nhảy để xoá).", "Click a copper trace (or a jumper to remove it)."));
    }
    const pr = proj(sg.t, p);
    if (!ui.trim || ui.trim.id !== sg.t.id) {
      if (ui.trim) toast(L("Điểm 2 nằm trên đường khác – chọn lại điểm 1 trên đường này.", "Point 2 is on another trace – point 1 reset on this trace."));
      ui.trim = { id: sg.t.id, s: pr.s, q: pr.q }; ui.sel = { t: "t", id: sg.t.id }; ui.hlNet = null; render(); drawTrim(p);
      $("#plHint").textContent = L("Trim: bấm điểm 2 trên cùng đường – đoạn giữa 2 điểm sẽ bị bỏ (Esc huỷ)", "Trim: click point 2 on the same trace – the part between is removed (Esc cancels)");
      return;
    }
    const t = sg.t, s0 = Math.min(ui.trim.s, pr.s), s1 = Math.max(ui.trim.s, pr.s); ui.trim = null;
    if (s1 - s0 < .2) { render(); return toast(L("2 điểm trùng nhau – bấm điểm 2 xa hơn.", "The two points coincide – pick point 2 further away.")); }
    checkpoint();
    const total = proj(t, { x: t.pts[t.pts.length - 1][0], y: t.pts[t.pts.length - 1][1] }).s;
    S.traces = S.traces.filter(x => x !== t);
    for (const pc of [cutPart(t, 0, s0), cutPart(t, s1, total)]) if (pc.length >= 2 && cutPart.len(pc) > .3) S.traces.push({ ...t, id: S.uid++, pts: simplify(pc), lock: true });
    gcHoles(); ui.sel = null; LY.tmp.innerHTML = ""; render(); setTool("tr");
  }
  cutPart.len = pc => pc.reduce((s, q, i) => i ? s + Math.hypot(q[0] - pc[i - 1][0], q[1] - pc[i - 1][1]) : 0, 0);
  // xem trước: điểm 1, điểm dưới chuột, và đoạn sẽ bị bỏ (đỏ)
  function drawTrim(p) {
    LY.tmp.innerHTML = "";
    const sg = segAt(p), pr = sg && proj(sg.t, p);
    if (pr) el("circle", { cx: pr.q[0], cy: pr.q[1], r: .5, class: "pen-nib" }, LY.tmp);
    if (!ui.trim) return;
    el("circle", { cx: ui.trim.q[0], cy: ui.trim.q[1], r: .5, class: "pen-nib" }, LY.tmp);
    const t = S.traces.find(x => x.id === ui.trim.id);
    if (t && sg && sg.t === t) { const pc = cutPart(t, Math.min(ui.trim.s, pr.s), Math.max(ui.trim.s, pr.s)); if (pc.length >= 2) el("path", { d: "M" + pc.map(q => q.join(" ")).join(" L"), "stroke-width": traceW(t) + .3, class: "trimcut" }, LY.tmp); }
  }
  // gộp đồng trùng cùng mạng: 2 đoạn cùng mạng song song chạm mép nhau (trùng tâm hoặc lệch < nửa tổng bề rộng) thì bỏ phần trùng
  // của đường mới hơn / không khoá; đầu vừa cắt được kéo về đúng tâm đường còn giữ để vẫn tính là nối (analyze)
  function dedupe() {
    let changed = false;
    for (let pass = 0; pass < 300; pass++) {
      let did = false;
      outer: for (const A of S.traces) for (const B of S.traces) {
        if (A === B || A.net !== B.net) continue;
        if (!(B.lock === A.lock ? B.id > A.id : A.lock)) continue;   // chỉ cắt B khi B "yếu hơn": A khoá mà B không, hoặc cùng loại nhưng B mới hơn
        const cuts = [], lim = (traceW(A) + traceW(B)) / 2 + .05;
        let sB = 0;
        for (let k = 0; k < B.pts.length - 1; k++) {
          const p = B.pts[k], q = B.pts[k + 1], lb = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (lb > 1e-6) for (let m = 0; m < A.pts.length - 1; m++) {
            const a = A.pts[m], b = A.pts[m + 1], la = Math.hypot(b[0] - a[0], b[1] - a[1]); if (la < 1e-6) continue;
            const ux = (b[0] - a[0]) / la, uy = (b[1] - a[1]) / la;
            if (Math.abs(((q[0] - p[0]) * uy - (q[1] - p[1]) * ux) / lb) > .02) continue;   // không song song
            if (Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux) > lim) continue;          // cách xa, không chạm
            const tp = (p[0] - a[0]) * ux + (p[1] - a[1]) * uy, tq = (q[0] - a[0]) * ux + (q[1] - a[1]) * uy;
            if (Math.abs(tq - tp) < 1e-6) continue;
            const v0 = Math.max(0, Math.min(1, (0 - tp) / (tq - tp))), v1 = Math.max(0, Math.min(1, (la - tp) / (tq - tp)));
            const lo = Math.min(v0, v1), hi = Math.max(v0, v1);
            if ((hi - lo) * lb > .5) cuts.push([sB + lo * lb, sB + hi * lb, A, m]);
          }
          sB += lb;
        }
        if (!cuts.length) continue;
        cuts.sort((x, y) => x[0] - y[0]);
        const keep = []; let s = 0;
        for (const [c0, c1, , ] of cuts) { if (c0 > s + .3) keep.push([s, c0]); s = Math.max(s, c1); }
        if (sB > s + .3) keep.push([s, sB]);
        const onA = q => { let best = null; for (let m = 0; m < A.pts.length - 1; m++) { const a = A.pts[m], b = A.pts[m + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)), r = [r3(a[0] + u * dx), r3(a[1] + u * dy)], d = Math.hypot(r[0] - q[0], r[1] - q[1]); if (!best || d < best.d) best = { d, r }; } return best; };
        S.traces = S.traces.filter(t => t !== B);
        for (const [k0, k1] of keep) {
          const pc = cutPart(B, k0, k1); if (pc.length < 2) continue;
          // đầu vừa cắt (không phải đầu gốc) nằm sát A: thêm 1 đoạn ngắn về tâm A
          if (k0 > 0) { const o = onA(pc[0]); if (o && o.d > .05 && o.d <= lim + .05) pc.unshift(o.r); }
          if (k1 < sB) { const o = onA(pc[pc.length - 1]); if (o && o.d > .05 && o.d <= lim + .05) pc.push(o.r); }
          S.traces.push({ ...B, id: S.uid++, pts: simplify(pc) });
        }
        did = changed = true; break outer;
      }
      if (!did) break;
    }
    return changed;
  }
  function toCopper(js) {
    checkpoint();
    for (const j of js) { S.jumpers = S.jumpers.filter(x => x !== j); S.traces.push({ id: S.uid++, net: j.net, pts: [j.a, j.b], lock: true }); }
    gcHoles(); ui.sel = null; render();
    toast(L(`Đã đổi ${js.length} dây nhảy thành đường đồng. Chỗ báo đỏ là đường đang chạm vật khác: kéo nắn lại hoặc gôm rồi vẽ lại.`, `Converted ${js.length} jumper(s) to copper. Red marks touch something else: drag to reshape, or erase and redraw.`));
  }
  const hideCtx = () => $("#plCtx").classList.remove("on");
  function cancel() { ui.trim = null; ui.meas = null; ui.mode = "idle"; ui.route = null; ui.jump = null; ui.hole = null; ui.jf = null; ui.weld1 = null; ui.drag = null; LY.tmp.innerHTML = ""; svg.classList.remove("routing"); $("#plHint").textContent = ""; }

  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    const p = toMM(e); let g = [snap(p.x, SN), snap(p.y, SN)];
    if (e.button === 1) return startPan(e);
    if (ui.mode === "route") {
      const pd = padAt(p);
      if (pd) { if (pd.net !== ui.route.net && !joinNet(pd.net)) return toast(L(`Chân ${pd.name} thuộc mạng ${pd.net || "trống"}, không nối được.`, `Pin ${pd.name} is on net ${pd.net || "none"}, can't connect.`)); return finishRoute([pd.x, pd.y], true); }
      const sg = segAt(p), pj = sg && proj(sg.t, p); if (pj && pj.d < traceW(sg.t) / 2 + .3 && (sg.t.net === ui.route.net || joinNet(sg.t.net))) return finishRoute(pj.q.map(r3), true);
      ui.free = e.shiftKey; const last = ui.route.pts[ui.route.pts.length - 1]; if (e.shiftKey) g = [snap(p.x, Q), snap(p.y, Q)]; const q = aim(last, g); if (q[0] !== last[0] || q[1] !== last[1]) { ui.route.pts.push(q); ui.route.dir = null; } drawRoute(); return;
    }
    if (ui.mode === "jump") return pickJump(p);
    if (ui.mode === "hole") return pickHole(p);
    if (ui.mode === "jfree") return pickJfree(p, g);
    if (ui.tool === "tf" || ui.tool === "tc") return pickWeld(p, ui.tool === "tf" ? "fill" : "chamfer");
    if (ui.tool === "tr") return trimPick(p);
    if (ui.tool === "ms") return measPick(p);
    if (ui.tool === "jw") return pickHole(p);
    if (ui.tool === "cu") {
      const pd = padAt(p);
      if (pd) { if (!pd.net) return toast(L(`Chân ${pd.name} không dùng trong mạch.`, `Pin ${pd.name} is not used in the circuit.`)); return startRoute(pd.net, [pd.x, pd.y]); }
      const sg = segAt(p), pj = sg && proj(sg.t, p);
      if (pj && pj.d < traceW(sg.t) / 2 + .3) return startRoute(sg.t.net, pj.q.map(r3));
      return startRoute("~" + S.uid++, g);
    }
    const vt = e.target.closest("[data-v]");
    if (vt && ui.sel && ui.sel.t === "t") return startVertex(e, +vt.dataset.v);
    const pd = padAt(p);
    if (pd && (pd.jw || pd.hole)) {
      ui.sel = pd.jw ? { t: "j", id: pd.jw.id, end: pd.i } : null;
      ui.hlNet = pd.net; render(); return startJHole(e, pd);
    }
    if (pd && S.comps.includes(pd.c)) { ui.sel = { t: "c", id: pd.c.id }; ui.hlNet = pd.net; render(); return startComp(e, pd.c); }
    const jw = S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6);
    if (jw) { ui.sel = { t: "j", id: jw.id }; ui.hlNet = jw.net; render(); return startJBody(e, jw); }
    const sg = segAt(p);
    if (sg) { ui.sel = { t: "t", id: sg.t.id, k: sg.k }; ui.hlNet = null; render(); return startSeg(e, sg); }
    const c = compAt(p);
    if (c) { ui.sel = { t: "c", id: c.id }; ui.hlNet = null; render(); return startComp(e, c); }
    ui.sel = null; ui.hlNet = null; render(); startPan(e);
  });
  svg.addEventListener("pointermove", e => {
    const p = toMM(e);
    if (ui.mode === "route") { ui.free = e.shiftKey; const pd = padAt(p), sn = e.shiftKey ? Q : SN; ui.route.cur = pd && pd.net === ui.route.net ? [pd.x, pd.y] : [snap(p.x, sn), snap(p.y, sn)]; drawRoute(); return; }
    if (ui.mode === "jump") return drawJump(p);
    if (ui.mode === "jfree") { ui.jf.cur = [snap(p.x, SN), snap(p.y, SN)]; return drawJfree(); }
    if (ui.tool === "tf" || ui.tool === "tc") { drawWeldPreview(p, ui.tool === "tf" ? "fill" : "chamfer"); return; }
    if (ui.tool === "tr") drawTrim(p);
    if (ui.tool === "ms") { if (ui.meas && !ui.meas.fixed) ui.meas.b = measSnap(p); drawMeas(measSnap(p)); }
    else if (ui.tool === "cu" && ui.mode === "idle") {
      LY.tmp.innerHTML = ""; const pd = padAt(p), q = pd && pd.net ? [pd.x, pd.y] : [snap(p.x, SN), snap(p.y, SN)];
      el("circle", { cx: q[0], cy: q[1], r: .45, class: "pen-nib" }, LY.tmp);
    }
    if (ui.drag) return ui.drag.move(p, e);
    const pd = padAt(p), tip = $("#plTip");
    if (pd) { tip.innerHTML = `<b>${pd.jw ? "J" + jNo(pd.jw) + (pd.i ? "b" : "a") : pd.c.id + " · " + pd.name}</b><br>${pd.net ? L("Mạng ", "Net ") + pd.net : L("<i>không dùng</i>", "<i>unused</i>")}${pd.jw || pd.hole ? L("<br><i>Kéo để dời lỗ khoan</i>", "<br><i>Drag to move hole</i>") : ""}`; tip.classList.add("on"); const r = $("#plStage").getBoundingClientRect(); tip.style.left = e.clientX - r.left + 14 + "px"; tip.style.top = e.clientY - r.top + 14 + "px"; }
    else tip.classList.remove("on");
    svg.style.cursor = ui.tool !== "sel" ? "" : pd && (pd.jw || pd.hole) ? "move" : pd ? "crosshair" : segAt(p) ? "move" : compAt(p) ? "grab" : "";
    const net = pd ? pd.net : null; if (net !== ui.hoverNet && !ui.sel) { ui.hoverNet = net; ui.hlNet = net; render(); }
  });
  addEventListener("pointerup", e => { if (ui.drag) { const d = ui.drag; ui.drag = null; d.up && d.up(); } });
  svg.addEventListener("pointerleave", () => $("#plTip").classList.remove("on"));
  svg.addEventListener("wheel", e => { e.preventDefault(); const f = e.deltaY < 0 ? 1 / 1.15 : 1.15, p = toV(e); cam.x = p.x - (p.x - cam.x) * f; cam.y = p.y - (p.y - cam.y) * f; cam.w *= f; cam.h *= f; applyCam(); }, { passive: false });
  svg.addEventListener("contextmenu", e => {
    e.preventDefault();
    // đang trong lệnh vẽ hoặc đang chọn công cụ bút / dây nhảy / gôm / fill / chamfer: nhấn chuột phải để thoát lệnh về Chọn
    if (ui.mode === "route") {
      const r = ui.route;
      if (r.pts.length >= 2) finishRoute(r.pts[r.pts.length - 1], true); else cancel();
      setTool("sel"); render(); return;
    }
    if (ui.mode !== "idle" || (ui.tool && ui.tool !== "sel")) { cancel(); setTool("sel"); render(); return; }
    const p = toMM(e), vt = e.target.closest("[data-v]");
    if (vt && ui.sel && ui.sel.t === "t") return ctxMenu(e, [[L("Xoá điểm neo", "Delete vertex"), L("Đúp", "Dbl"), () => cmd.delVtx(+vt.dataset.v)]]);
    const jw = S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6);
    if (jw) { ui.sel = { t: "j", id: jw.id }; ui.hlNet = jw.net; render(); return ctxMenu(e, [[L("Đổi thành đường đồng", "Convert to copper"), "", () => toCopper([jw])], [L("Đổi mọi dây nhảy của mạng này", "Convert all jumpers of this net"), "", () => toCopper(S.jumpers.filter(j => j.net === jw.net))], [L("Xoá dây nhảy", "Delete jumper"), "Del", cmd.del]]); }
    const sg = segAt(p); if (!sg) return hideCtx();
    ui.sel = { t: "t", id: sg.t.id, k: sg.k }; ui.hlNet = sg.t.net; render();
    ctxMenu(e, [[L("Hàn nối không vát góc (Fill)", "Weld sharp corner (Fill)"), "F", () => triggerWeldCmd("fill")], [L("Hàn nối vát góc 45° (Chamfer)", "Weld 45° bevel (Chamfer)"), "C", () => triggerWeldCmd("chamfer")],
      [L("Thêm điểm neo ở đây", "Add vertex here"), "", () => cmd.addVtx(p)], [L("Nắn ngang", "Make horizontal"), "H", () => cmd.straight("h")], [L("Nắn dọc", "Make vertical"), "V", () => cmd.straight("v")], [L("Nắn 45°", "Make 45°"), "A", () => cmd.straight("a")],
      [L("Dây nhảy", "Jumper"), "J", () => placeHole()], [L("Cắt bằng dây nhảy", "Cut with jumper"), "", cmd.jump], [sg.t.lock ? L("Bỏ khoá", "Unlock") : L("Khoá", "Lock"), "L", cmd.lock], [L("Xoá đoạn này", "Delete this segment"), "Del", cmd.del], [L("Chọn cả đường", "Select whole trace"), L("Đúp", "Dbl"), () => { ui.sel = { t: "t", id: sg.t.id }; ui.hlNet = sg.t.net; render(); }]]);
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
    const sg = segAt(p); if (sg && !padAt(p)) { ui.sel = { t: "t", id: sg.t.id }; ui.hlNet = sg.t.net; render(); }
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
  // nắm kéo lỗ khoan dây nhảy (Ja / Jb hoặc lỗ đơn): đầu đường đồng gắn vào lỗ tự đi theo
  function startJHole(e, pd) {
    const x0 = pd.x, y0 = pd.y, snapS = JSON.stringify(S), ends = [], jEnds = [], hEnds = [];
    for (const t of S.traces) t.pts.forEach((pt, k) => { if (Math.hypot(pt[0] - x0, pt[1] - y0) < .08) ends.push({ t, k }); });
    for (const j of S.jumpers) {
      if (Math.hypot(j.a[0] - x0, j.a[1] - y0) < .08) jEnds.push({ j, k: "a" });
      if (Math.hypot(j.b[0] - x0, j.b[1] - y0) < .08) jEnds.push({ j, k: "b" });
    }
    for (const h of S.holes || []) if (Math.hypot(h.x - x0, h.y - y0) < .08) hEnds.push(h);
    let moved = false;
    ui.drag = {
      move: (p, ev) => {
        const sn = ev && ev.shiftKey ? Q : SN;
        let nx = r3(snap(p.x, sn)), ny = r3(snap(p.y, sn));
        if (pd.jw && !(ev && ev.shiftKey)) {
          const o = pd.i === 0 ? pd.jw.b : pd.jw.a, dx = nx - o[0], dy = ny - o[1], ax = Math.abs(dx), ay = Math.abs(dy);
          if (ax < .7) nx = o[0]; else if (ay < .7) ny = o[1];
          else if (Math.abs(ax - ay) < .8) { const d = r3(snap((ax + ay) / 2, Q)); nx = r3(o[0] + Math.sign(dx) * d); ny = r3(o[1] + Math.sign(dy) * d); }
        }
        for (const je of jEnds) { je.j[je.k] = [nx, ny]; delete je.j.auto; }
        for (const h of hEnds) { h.x = nx; h.y = ny; }
        for (const en of ends) { en.t.pts[en.k] = [nx, ny]; en.t.lock = true; }
        moved = true; render();
      },
      up: () => {
        if (moved) {
          for (const en of ends) en.t.pts = simplify(en.t.pts.filter((q, i) => i === 0 || q[0] !== en.t.pts[i - 1][0] || q[1] !== en.t.pts[i - 1][1]));
          gcHoles(); pushRaw(snapS); render();
        }
      }
    };
  }
  // nắm kéo thân dây nhảy: dịch song song cả 2 lỗ Ja và Jb
  function startJBody(e, jw) {
    const p0 = toMM(e), a0 = [...jw.a], b0 = [...jw.b], snapS = JSON.stringify(S), endsA = [], endsB = [];
    for (const t of S.traces) t.pts.forEach((pt, k) => {
      if (Math.hypot(pt[0] - a0[0], pt[1] - a0[1]) < .08) endsA.push({ t, k });
      if (Math.hypot(pt[0] - b0[0], pt[1] - b0[1]) < .08) endsB.push({ t, k });
    });
    let moved = false;
    ui.drag = {
      move: (p, ev) => {
        const sn = ev && ev.shiftKey ? Q : SN, dx = r3(snap(p.x - p0.x, sn)), dy = r3(snap(p.y - p0.y, sn));
        if (!dx && !dy && !moved) return; moved = true;
        jw.a = [r3(a0[0] + dx), r3(a0[1] + dy)]; jw.b = [r3(b0[0] + dx), r3(b0[1] + dy)]; delete jw.auto;
        for (const en of endsA) { en.t.pts[en.k] = [...jw.a]; en.t.lock = true; }
        for (const en of endsB) { en.t.pts[en.k] = [...jw.b]; en.t.lock = true; }
        render();
      },
      up: () => { if (moved) { gcHoles(); pushRaw(snapS); render(); } }
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
  // điểm neo nằm giữa a và b: chọn chỗ gần chuột nhất mà 2 đoạn kề đều ngang / dọc / 45°
  function snap45(a, b, m) {
    const D = [[1, 0], [0, 1], [1, 1], [1, -1]], cand = [];
    const proj = (o, d) => { const l = d[0] * d[0] + d[1] * d[1], u = ((m[0] - o[0]) * d[0] + (m[1] - o[1]) * d[1]) / l; return [o[0] + u * d[0], o[1] + u * d[1]]; };
    if (a && b) for (const d1 of D) for (const d2 of D) {
      const den = d1[0] * d2[1] - d1[1] * d2[0]; if (!den) continue;
      const u = ((b[0] - a[0]) * d2[1] - (b[1] - a[1]) * d2[0]) / den; cand.push([a[0] + u * d1[0], a[1] + u * d1[1]]);
    }
    else for (const o of [a, b]) if (o) for (const d of D) cand.push(proj(o, d));
    if (!cand.length) return [snap(m[0], Q), snap(m[1], Q)];
    const c = cand.reduce((x, y) => Math.hypot(x[0] - m[0], x[1] - m[1]) <= Math.hypot(y[0] - m[0], y[1] - m[1]) ? x : y);
    return [r3(c[0]), r3(c[1])];
  }
  function startVertex(e, i) {
    const t = S.traces.find(x => x.id === ui.sel.id), snapS = JSON.stringify(S); let moved = false;
    // đầu dây: thả gần chân / lỗ cùng mạng (hoặc chân của mạng trống) thì bám đúng tâm chân đó
    const end = i === 0 || i === t.pts.length - 1, padSnap = p => { const pd = end && padAt(p); return pd && (pd.net === t.net || isFree(t.net)) ? [pd.x, pd.y] : null; };
    ui.drag = { move: (p, ev) => { const q = padSnap(p) || (ev && ev.shiftKey ? [snap(p.x, Q), snap(p.y, Q)] : snap45(t.pts[i - 1], t.pts[i + 1], [p.x, p.y])); if (q[0] === t.pts[i][0] && q[1] === t.pts[i][1]) return; moved = true; t.pts[i] = q; t.lock = true; render(); }, up: () => { if (moved) { t.pts = simplify(t.pts); pushRaw(snapS); } render(); } };
  }

  /* ---------- lệnh ---------- */
  const cmd = {
    undo() { if (!undo.length) return; redo.push(JSON.stringify(S)); S = JSON.parse(undo.pop()); ui.sel = null; render(); list(); },
    redo() { if (!redo.length) return; undo.push(JSON.stringify(S)); S = JSON.parse(redo.pop()); ui.sel = null; render(); list(); },
    del() {
      const s = ui.sel; if (!s) return;
      if (s.t === "j") { checkpoint(); S.jumpers = S.jumpers.filter(j => j.id !== s.id); gcHoles(); ui.sel = null; ui.hlNet = null; render(); }
      else if (s.t === "t") {   // chỉ xoá đoạn đang chọn (giữa 2 góc), phần còn lại giữ
        checkpoint(); const t = S.traces.find(x => x.id === s.id); S.traces = S.traces.filter(x => x !== t);
        if (t && s.k != null && t.pts[s.k + 1]) for (const pc of [t.pts.slice(0, s.k + 1), t.pts.slice(s.k + 1)]) if (pc.length >= 2) S.traces.push({ ...t, id: S.uid++, pts: pc });
        gcHoles(); ui.sel = null; ui.hlNet = null; render(); }
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
    autoBoard() { S.autoB = !S.autoB; if (S.autoB) { checkpoint(); fitBoardTo(roomy()); fit(); } render(); toast(S.autoB ? L("Bật: khung bo tự co giãn theo linh kiện khi thêm / bớt / dời.", "On: the board resizes to the parts when adding / removing / moving.") : L("Tắt: khung bo giữ cố định.", "Off: the board size stays fixed.")); },
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
    auto(re, only) {   // re === true: đi lại sau khi sửa linh kiện, đã có điểm hoàn tác của thao tác đó. only: chỉ thử 1 kiểu đi dây (giữ kiểu người dùng chọn)
      if (re !== true) checkpoint(); S.routed = true; const t0 = performance.now(), base = JSON.stringify([S.traces, S.jumpers]), sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
      let best = null;
      // số dây bay còn lại thật sự (đã tính mass nối GND)
      const go = (si, prio, ga) => { [S.traces, S.jumpers] = JSON.parse(base); autoroute(si, prio, ga); return analyze().rats.length; };
      const score = fl => fl * 1000 + sum(S.jumpers, j => 5 + 3 * Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1])) + .05 * sum(S.traces, t => t.pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - t.pts[i - 1][0], p[1] - t.pts[i - 1][1]) : 0, 0));
      const tryRun = (si, prio, ga) => { const fl = go(si, prio, ga), sc = score(fl), r = { score: sc, si, ga, fl, failed: autoroute.failed.slice(), st: JSON.stringify([S.traces, S.jumpers]) }; if (!best || sc < best.score) best = r; return r; };
      // lượt 1: mỗi phương án một lần (có mass: "mass trước, GND sau" và "GND như thường, mass phủ thêm")
      const first = [];
      for (let si = 0; si < SCHEMES.length; si++) if (only == null || si === only) for (const ga of S.pour ? [false, true] : [false]) first.push(tryRun(si, null, ga));
      // còn đường hỏng (thường do bị các đường đi trước vây kín chân): đi lại phương án tốt nhất, cho các đường từng hỏng đi trước.
      // Giới hạn ~10 s để không treo trang với bo lớn
      first.sort((a, b) => a.score - b.score);
      for (const r0 of first.slice(0, 2)) {
        if (!best.fl || performance.now() - t0 > OPT.timeCap) break;
        const prio = new Set(r0.failed); let r = r0;
        for (let k = 0; k < 3 && r.fl && performance.now() - t0 < OPT.timeCap; k++) { r.failed.forEach(x => prio.add(x)); r = tryRun(r0.si, prio, r0.ga); }
      }
      [S.traces, S.jumpers] = JSON.parse(best.st); S.scheme = best.si; cmd.autoMsg(best.fl, t0);
    },
    autoMsg(f, t0) { dedupe(); render(); const nj = S.jumpers.filter(j => j.auto).length, ne = 0; toast(L(`Tự đi dây (${SCHEMES[S.scheme].name}): ${f ? "còn " + f + " đường chưa đi được" : "xong hết"}${nj + ne ? " · " + (nj + ne) + " dây nhảy" : ""}`, `Autoroute (${SCHEMES[S.scheme].name}): ${f ? f + " connections left unrouted" : "all done"}${nj + ne ? " · " + (nj + ne) + " jumpers" : ""}`) + ` · ${Math.round(performance.now() - t0)} ms`); },
    scheme() { S.scheme = (S.scheme + 1) % SCHEMES.length; cmd.auto(false, S.scheme); },
    clear() { checkpoint(); S.routed = false; S.traces = []; S.jumpers = []; S.holes = []; ui.sel = null; render(); toast(L("Đã xoá mọi đường đồng và dây nhảy (Ctrl+Z để lấy lại).", "Removed all traces and jumpers (Ctrl+Z to undo).")); },
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
    fill() { triggerWeldCmd("fill"); },
    chamfer() { triggerWeldCmd("chamfer"); },
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
      const w0 = S.board.w, h0 = S.board.h, [dx, dy] = fitBoardTo(roomy());
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
      if (a.rats.length || bad) cmd.auto(true, S.scheme);   // cách nhanh chưa đủ (linh kiện đè lên đường cũ…): đi lại toàn bộ
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
      if (k === "backspace") { e.preventDefault(); if (ui.route.pts.length > 1) ui.route.pts.pop(); ui.route.dir = null; drawRoute(); }
      if (k === "enter") { const c = ui.route.cur, pd = padAt({ x: c[0], y: c[1] }); finishRoute(pd && pd.net === ui.route.net ? [pd.x, pd.y] : c, !!(pd && pd.net === ui.route.net)); }
      if (k === "j") placeHole();
      return;
    }
    if (ui.sel && ui.sel.t === "t" && (k === "h" || k === "v" || k === "a")) return cmd.straight(k);
    if (k === "delete" || k === "backspace") { e.preventDefault(); cmd.del(); }
    else if (k === "r") cmd.rotate(); else if (k === "l") cmd.lock(); else if (k === "a") cmd.auto(); else if (k === "f") cmd.fill(); else if (k === "c") cmd.chamfer(); else if (k === "0" || k === "home") fit(); else if (k === "v") cmd.flip(); else if (k === "j") setTool("jw"); else if (k === "b") setTool("cu"); else if (k === "t" || k === "e") setTool("tr"); else if (k === "m") setTool("ms");
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
    for (const h of S.holes || []) { h.x = r3(h.x + dx); h.y = r3(h.y + dy); }
  }
  const BMIN = 30, BMAX = 300, BMARGIN = 6;   // mm; lề 6 mm chừa 4 lỗ bắt vít Ø3,2 ở góc
  // lề rộng khi đang thiết kế: ~15% cạnh lớn của cụm linh kiện mỗi phía, để đường đồng có chỗ đi vòng quanh cụm.
  // Đi dây xong, nút "Vừa khít mạch" thu bo lại sát linh kiện + đường đồng (lề BMARGIN)
  const roomy = () => { const e = extent(); return e ? Math.max(BMARGIN, Math.round(OPT.roomPct * Math.max(e.x1 - e.x0, e.y1 - e.y0))) : BMARGIN; };
  function fitBoardTo(m = BMARGIN) {   // dời mọi thứ (bước 2,54 để giữ lưới) cho lề trái / trên ≥ m, cạnh làm tròn lên 1 mm
    const e = extent(); if (!e) return;
    const dx = Math.ceil((m - e.x0) / G) * G, dy = Math.ceil((m - e.y0) / G) * G;
    shiftAll(dx, dy);
    S.board = { w: Math.min(BMAX, Math.max(BMIN, Math.ceil(e.x1 + dx + m))), h: Math.min(BMAX, Math.max(BMIN, Math.ceil(e.y1 + dy + m))) };
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
    fitBoardTo(roomy());   // lề rộng 4 phía: hàng chân ESP32 sát mép trái vẫn có lối ra
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
  // Check: so mạch PCB với tab Wiring, chỉ báo và chỉ vào chỗ khác (người dùng tự sửa bên PCB hoặc bên Wiring).
  // So theo chân host (IO / nguồn) mà mỗi chân module nối tới; mạng riêng qua điện trở an toàn được lần qua điện trở
  function wiringDiff() {
    const o = wiring(); if (!o) return null;
    const bus = (Array.isArray(o.buses) && o.buses[0]) || o.bus || {}, H = hostInfo(), out = [];
    const viaR = n => {   // mạng riêng N… → chân host bên kia điện trở
      if (!n || PWR.has(n) || H.pins.has(n)) return n;
      for (const c of S.comps) if (c.fp === "R" && c.nets) { const v = Object.values(c.nets); if (v.includes(n)) { const k = v.find(x => x !== n && x !== "GND"); if (k && (PWR.has(k) || H.pins.has(k))) return k; } }
      return n;
    };
    const used = new Set();
    for (const m of o.mods) {
      const d = MODULES[m.type], f = FP[m.type];
      if ((m.host || 0) !== 0 || !d || !f) continue;
      const c = S.comps.find(x => x.fp === m.type && !used.has(x));
      if (!c) { out.push({ msg: L(`Wiring có ${d.short} nhưng PCB chưa có`, `Wiring has ${d.short} but the PCB does not`) }); continue; }
      used.add(c);
      const names = new Set(f.pads.map(p => p.name));
      for (const [label, role] of d.pins) {
        if (!names.has(label)) continue;
        let want = PWR_ROLE[role] || (SHARED.includes(role) ? bus[role] : (m.pins || {})[label]) || null;
        if (want && !PWR.has(want) && !H.pins.has(want)) want = null;
        const have = viaR((c.nets || {})[label] || null);
        if ((want || null) !== (have || null)) {
          const p = pads().find(q => q.c === c && q.name === label);
          out.push({ c: c.id, pin: label, have, want, x: p && p.x, y: p && p.y, msg: `${c.id} · ${label}: PCB = ${have || L("trống", "none")}, Wiring = ${want || L("trống", "none")}` });
        }
      }
    }
    for (const c of S.comps) if (!isHost(c) && c.fp !== "R" && c.fp !== "C" && !used.has(c) && MODULES[c.fp]) {
      const b = compBox(c); out.push({ c: c.id, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, msg: L(`${c.id} (${MODULES[c.fp].short}) có trên PCB nhưng không có trong Wiring`, `${c.id} (${MODULES[c.fp].short}) is on the PCB but not in Wiring`) });
    }
    return out;
  }
  // bấm 1 dòng: phóng tới chỗ đó và nhấp nháy
  function showSpot(x, y) {
    if (x == null) return;
    const w = Math.min(cam.w, 40), h = w * cam.h / cam.w; cam = { x: x - w / 2, y: y - h / 2, w, h }; applyCam();
    LY.tmp.innerHTML = ""; el("circle", { cx: x, cy: y, r: 2.2, class: "chkflash" }, LY.tmp);
    clearTimeout(showSpot.t); showSpot.t = setTimeout(() => { const f = LY.tmp.querySelector(".chkflash"); if (f) f.remove(); }, 3000);
  }
  cmd.check = () => {
    if (!SITE) return toast(L("Check chỉ dùng được trong Pindexio (cần tab Wiring).", "Check only works inside Pindexio (needs the Wiring tab)."));
    const d = wiringDiff();
    if (!d) { ui.check = null; render(); return toast(L(`Tab Wiring chưa có mạch cho ${hostInfo().name}.`, `The Wiring tab has no circuit for ${hostInfo().name}.`)); }
    ui.check = true; render();
    toast(d.length ? L(`Check: ${d.length} chỗ PCB khác Wiring – xem danh sách bên phải, bấm từng dòng để tới chỗ đó.`, `Check: ${d.length} differences between PCB and Wiring – see the list on the right, click a line to go there.`) : L("✓ PCB khớp tab Wiring.", "✓ PCB matches the Wiring tab."));
    if (d[0]) showSpot(d[0].x, d[0].y);
  };
  Object.assign(cmd, {
    boardSize(w, h) {
      w = Math.round(+w); h = Math.round(+h);
      if (!(w >= BMIN && w <= BMAX && h >= BMIN && h <= BMAX)) { render(); return toast(L(`Khung bo từ ${BMIN} đến ${BMAX} mm.`, `Board size must be ${BMIN}–${BMAX} mm.`)); }
      if (w === S.board.w && h === S.board.h) return;
      checkpoint(); S.board = { w, h }; render(); fit();
    },
    spread(v) {
      v = Math.max(0, Math.min(3, +v)); if (v === (S.spread ?? SPREAD0)) return;
      if (!S.routed && !S.traces.some(t => !t.lock)) { S.spread = v; return render(); }
      const keep = JSON.stringify(S), a0 = analyze(), r0 = a0.rats.length, d0 = a0.drc.length, old = S.spread ?? SPREAD0;
      checkpoint(); S.spread = v; cmd.auto(true, S.scheme);
      const a1 = analyze();
      if (a1.rats.length > r0 || a1.drc.length > d0) { S = JSON.parse(keep); undo.pop(); ui.sel = null; render(); return toast(L(`Độ thoáng ${v} mm làm sót thêm đường – giữ ${old} mm.`, `Spacing ${v} mm leaves more unrouted – kept ${old} mm.`)); }
      toast(L(`Độ thoáng ${v} mm · còn ${a1.rats.length} đường chưa đi · Ctrl+Z để quay lại`, `Spacing ${v} mm · ${a1.rats.length} unrouted · Ctrl+Z to undo`));
    },
    fitBoard() { checkpoint(); fitBoardTo(); render(); fit(); toast(L(`Khung bo ${S.board.w} × ${S.board.h} mm, vừa khít linh kiện + đường đồng (lề 6 mm).`, `Board ${S.board.w} × ${S.board.h} mm, fitted to parts + traces (6 mm margin).`)); },
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
  function checkBox() {
    const d = wiringDiff(); if (!d) return "";
    if (!d.length) return `<div class="box"><p>✓ ${L("PCB khớp tab Wiring.", "PCB matches the Wiring tab.")}</p></div>`;
    return `<div class="box warn"><h4>${L(`Check: ${d.length} chỗ khác Wiring`, `Check: ${d.length} differences from Wiring`)}</h4><p class="mut">${L("Bấm 1 dòng để tới chỗ đó. Sửa bên PCB (đổi chân, đường) hoặc bên tab Wiring rồi bấm Check lại.", "Click a line to go there. Fix it on the PCB (pins, traces) or in the Wiring tab, then Check again.")}</p><div class="chk">${d.map(v => `<button type="button" data-chkx="${v.x ?? ""}" data-chky="${v.y ?? ""}">⚠ ${v.msg}</button>`).join("")}</div></div>`;
  }
  function panel() {
    const nets = {}; for (const p of A.P) if (p.net && !isFree(p.net)) nets[p.net] = 1;
    const open = new Set(A.rats.map(r => r.net)), bad = A.drc.length;
    const sel = ui.sel && ui.sel.t === "t" ? S.traces.find(t => t.id === ui.sel.id) : null, selC = ui.sel && ui.sel.t === "c" ? S.comps.find(c => c.id === ui.sel.id) : null;
    const allOk = !open.size && S.comps.length > 1, done = allOk && !bad, nj = S.jumpers.length;
    const help = L(`<li>Chọn bút như bút chì: <b>✏️ Pen</b> (B) vẽ đường, <b>Bút dây nhảy</b> (J) bấm 2 điểm, <b>Trim</b> (T) bấm 2 điểm trên đường để bỏ đoạn giữa rồi vẽ lại, <b>Chọn</b> (Esc) để kéo linh kiện.</li><li>Kéo <b>thân đường</b> để dời song song, kéo <b>ô vuông</b> để dời góc.</li><li>Chọn đoạn dây: <b>H</b> nắn ngang · <b>V</b> nắn dọc · <b>A</b> nắn 45°. <b>Đúp</b> lên dây thêm điểm neo, đúp lên ô vuông để xoá.</li><li>Kéo <b>linh kiện</b> để dời, <b>R</b> xoay.</li><li><b>Dây nhảy</b> (J): bấm điểm đầu rồi điểm cuối (chân, lỗ, đường hoặc chỗ trống). Đang vẽ đường nhấn <b>J</b> để đặt lỗ ở đầu bút rồi bắc dây nhảy. Nét <b>trắng</b> = dây nhảy / ký hiệu linh kiện.</li><li>Đường vẽ / sửa tay tự <b>khoá</b> 🔒: Tự đi dây giữ nguyên.</li><li><b>/</b> đổi tư thế 45° · <b>Esc</b> huỷ · <b>Ctrl+Z</b> hoàn tác.</li>`,
      `<li>Pick a pen like a pencil: <b>✏️ Pen</b> (B) draws traces, <b>Jumper pen</b> (J) clicks 2 points, <b>Trim</b> (T) clicks 2 points on a trace to cut out the part between so you can redraw, <b>Select</b> (Esc) moves parts.</li><li>Drag a <b>trace body</b> to move it in parallel, drag a <b>square</b> to move a corner.</li><li>Select a segment: <b>H</b> horizontal · <b>V</b> vertical · <b>A</b> 45°. <b>Double-click</b> a trace to add a vertex, a square to delete it.</li><li>Drag a <b>part</b> to move it, <b>R</b> rotates.</li><li><b>Jumper</b> (J): click the start, then the end (pin, hole, trace or free spot). While drawing press <b>J</b> to drop a hole at the pen and bridge with a jumper. <b>White</b> lines = jumpers / part outlines.</li><li>Hand-drawn / edited traces are <b>locked</b> 🔒: Autoroute keeps them.</li><li><b>/</b> flips the 45° posture · <b>Esc</b> cancels · <b>Ctrl+Z</b> undo.</li>`);
    $("#plPanel").innerHTML = `<ol class="steps"><li class="${S.comps.length > 1 ? "ok" : "now"}">${L("Thêm & đặt linh kiện", "Add & place parts")}<small>${L("bấm linh kiện bên trái · kéo · R xoay", "click a part on the left · drag · R rotates")}</small></li><li class="${allOk ? "ok" : "now"}">${L("Nối hết dây", "Route everything")}<small>${allOk ? L("xong", "done") : L("bấm Tự đi dây (A)", "press Autoroute (A)")}${nj ? L(` · ${nj} dây nhảy`, ` · ${nj} jumpers`) : ""}</small></li><li class="${done ? "ok" : bad ? "now" : ""}">${L("Không lỗi → Tải file in", "No errors → Download")}<small>${bad ? L(`${bad} lỗi cần sửa`, `${bad} errors to fix`) : done ? L("sẵn sàng in", "ready to print") : "…"}</small></li></ol>
      <div class="stat"><div><b>${Object.keys(nets).length - open.size}</b>/${Object.keys(nets).length}<span>${L("mạng đã nối", "nets routed")}</span></div><div class="${bad ? "red" : ""}"><b>${bad}</b><span>${L("lỗi khoảng cách", "clearance errors")}</span></div><div><b>${S.traces.length}</b><span>${L("đường đồng", "traces")}</span></div></div>
      ${sel ? `<div class="box"><h4>${L("Đường đang chọn", "Selected trace")}</h4><p>${L("Mạng", "Net")} <b>${sel.net}</b> · ${traceW(sel)} mm · ${sel.lock ? L("🔒 đã khoá", "🔒 locked") : L("tự động", "auto")}</p></div>` : selC ? compBoxHTML(selC) : ""}
      ${A.rats.length && S.comps.length > 1 ? `<div class="box warn"><p>${L(`Còn <b>${A.rats.length}</b> chỗ chưa nối (nét gạch). Vẽ dây nhảy để hoàn thiện mạch: bấm chân → rê ra chỗ trống → <b>J</b> → bấm chỗ đặt lỗ thứ 2 → vẽ tiếp tới chân cần nối.`, `<b>${A.rats.length}</b> connections are still open (dashed lines). Add jumpers to finish the board: click a pin → move to a free spot → <b>J</b> → click the 2nd hole → keep drawing to the target pin.`)}</p>${S.routed && S.comps.length > 2 ? `<p class="mut">${L("Hoặc thử sắp xếp lại linh kiện (dời linh kiện và đi dây lại, Ctrl+Z để quay lại).", "Or try re-arranging the parts (moves parts and re-routes, Ctrl+Z to undo).")}</p><button type="button" class="pl-try" id="plTryLay">🔁 ${L("Thử sắp xếp lại", "Try re-arranging")}</button>` : ""}</div>` : ""}
      ${S.jumpers.length ? `<div class="box"><h4>${L("Dây nhảy", "Jumpers")} (${S.jumpers.length})</h4><p class="mut">${L("Hàn dây trần (chân điện trở thừa, dây đồng 0,5 mm) giữa 2 lỗ Ja ↔ Jb ở mặt linh kiện, nằm sát bo. Tổng dây cần chuẩn bị", "Solder bare wire (spare resistor legs, 0.5 mm copper) between holes Ja ↔ Jb on the component side, flat to the board. Total wire needed")} ~${Math.round(S.jumpers.reduce((s, j) => s + Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) + 10, 0) / 10)} cm.</p><div class="pinlist">${S.jumpers.map(j => { const len = Math.round(Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) + 10); return `<div><b>J${jNo(j)}</b> ${j.net} · ~${len} mm${j.pin ? L(" · hàn thẳng vào chân", " · soldered onto the pins") : ""}${len > 100 ? L(" ⚠ dài, tín hiệu nhanh có thể nhiễu", " ⚠ long, fast signals may pick up noise") : ""}</div>`; }).join("")}</div></div>` : ""}
      ${ui.check ? checkBox() : ""}
      ${S.hot && S.hot.length ? `<div class="box warn"><p>${L(`⚠ ${S.hot.join(", ")} chỉ chịu 3,3 V: tín hiệu từ ${hostInfo().name} (5 V) cần mạch chuyển mức hoặc chia áp.`, `⚠ ${S.hot.join(", ")} are 3.3 V only: signals from ${hostInfo().name} (5 V) need a level shifter or divider.`)}</p></div>` : ""}
      ${A.cross ? `<div class="box warn"><p>${L(`⚠ ${A.cross} chỗ dây nhảy trần bắc chéo nhau dễ chạm: uốn 1 dây cao lên hoặc kéo dời linh kiện cho thoáng.`, `⚠ ${A.cross} bare jumper crossings may touch: raise one wire or move parts apart.`)}</p></div>` : ""}
      <h4>${L("Độ thoáng đường đồng", "Trace spacing")}</h4><div class="spr"><input id="plSpread" type="range" min="0" max="3" step=".5" value="${S.spread ?? SPREAD0}"><b>${S.spread ?? SPREAD0} mm</b></div><p class="mut">${L("Kéo sang phải: đường cách xa nhau hơn, chừa chỗ sửa sau. Chỉ áp dụng khi không làm sót thêm đường.", "Slide right: traces keep more room for later fixes. Only applied if nothing more is left unrouted.")}</p>
      <h4>${L("Khung bo", "Board size")}</h4><div class="bsz"><label>${L("Rộng", "W")} <input id="plBW" type="number" min="${BMIN}" max="${BMAX}" step="1" value="${S.board.w}"></label><span>×</span><label>${L("Cao", "H")} <input id="plBH" type="number" min="${BMIN}" max="${BMAX}" step="1" value="${S.board.h}"></label><span>mm</span></div>
      <div class="bszb">${[[50, 70], [70, 100], [100, 100], [100, 150]].map(([w, h]) => `<button type="button" data-bs="${w}x${h}"${S.board.w === w && S.board.h === h ? ' class="on"' : ""}>${w}×${h}</button>`).join("")}<button type="button" id="plFitB" title="${L("Đi dây xong: thu bo vừa khít linh kiện + đường đồng", "After routing: shrink the board to parts + traces")}">${L("Vừa khít mạch", "Fit to circuit")}</button><button type="button" id="plPack" title="${L("Xếp lại ESP32-S3 + module cho gọn, khung bo vừa đủ số linh kiện", "Re-arrange the ESP32-S3 and modules compactly; board sized to the part count")}">${L("Xếp gọn", "Pack")}</button></div>
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
    $$("[data-chkx]").forEach(b => b.onclick = () => b.dataset.chkx !== "" && showSpot(+b.dataset.chkx, +b.dataset.chky));
    $("#plSpread").oninput = e => e.target.nextElementSibling.textContent = e.target.value + " mm"; $("#plSpread").onchange = e => cmd.spread(e.target.value);
    if ($("#plVal")) $("#plVal").onchange = e => { checkpoint(); selC.val = e.target.value.trim(); render(); };
    $("#plScheme").querySelector("span").textContent = SCHEMES[S.scheme].short;
    $("#plScheme").title = L("Phương án: ", "Scheme: ") + SCHEMES[S.scheme].name + L(" – bấm để đổi và đi lại", " – click to switch and re-route");
    $("#plRats").classList.toggle("on", S.rats); $("#plAutoNow").classList.toggle("on", !!S.autoRe); $("#plFlip").classList.toggle("on", !!S.flip); $("#plPour").classList.toggle("on", !!S.pour);
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
  function tools() {
    const ic = { tms: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>', check: '<path d="M4 12l5 5L20 6"/>', tsel: '<path d="M6 3l12 9-5.5 1.2L15 20l-2.5 1-2.6-6.6L6 18z"/>', tcu: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>', ttr: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9"/><path d="M14.5 14.5L20 20"/><path d="M8.1 8.1L12 12"/>', ter: '<path d="M9 20h11"/><path d="M4 15l9-9 6 6-8 8H8z"/><path d="M9 10l6 6"/>', ttf: '<path d="M4 17h11V6"/><path d="M15 17h5M15 6V2" stroke-dasharray="2 2" opacity=".55"/><circle cx="15" cy="17" r="2"/>', ttc: '<path d="M4 18h7l7-7V4"/><path d="M11 18h7v-7" stroke-dasharray="2 2" opacity=".55"/><circle cx="11" cy="18" r="1.7"/><circle cx="18" cy="11" r="1.7"/>', wire: '<path d="M4 19c4-1 3-8 8-8s4-7 8-8"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="3" r="1.6"/>', hole: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>', pour: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12l8-8M4 20L20 4M12 20l8-8"/>', dl: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>', jump: '<path d="M3 17h4M17 17h4"/><path d="M7 17c0-9 10-9 10 0"/>', flip: '<path d="M12 3v18"/><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>', undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>', redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>', rot: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>', del: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', auto: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/>', scheme: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', clear: '<path d="M4 4l16 16M20 4L4 20"/>', fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', rats: '<path d="M4 18L20 6" stroke-dasharray="3 3"/>', zin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M11 8v6M8 11h6"/>', zout: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M8 11h6"/>', reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>', unwire: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>', re: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>', arr: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>' };
    const b = (id, i, t, tip) => `<button type="button" class="tb" id="${id}" title="${!t || !tip || tip.startsWith(t) ? tip || t : t + " – " + tip}"><svg viewBox="0 0 24 24">${ic[i]}</svg><span>${t}</span></button>`;
    const sep = '<span class="sep"></span>';
    // trong Pindexio: cùng nhóm chế độ với tab Wiring (Nối dây | Breadboard | Mạch in PCB) để chuyển qua lại 1 chạm
    const modes = SITE && window.APP && APP.toWiring ? `<span class="pl-modes" role="group" aria-label="${L("Chế độ", "Mode")}"><button type="button" class="tb" data-mode="wire">🔌 <span>${L("Nối dây", "Wiring")}</span></button><button type="button" class="tb" data-mode="bb">▦ <span>Breadboard</span></button><button type="button" class="tb on" aria-pressed="true">🖨 <span>PCB Maker <sup class="beta">beta</sup></span></button></span>` + sep : "";
    $("#plBar").innerHTML = modes + b("plDel", "del", L("Xoá", "Delete"), L("Xoá linh kiện, đường hoặc dây nhảy đang chọn (Delete)", "Delete the selected part, trace or jumper (Delete)")) + b("plRot", "rot", L("Xoay", "Rotate"), L("Xoay linh kiện đang chọn (R)", "Rotate the selected part (R)")) + sep
      + b("plUndo", "undo", L("Hoàn tác", "Undo"), "Ctrl+Z") + b("plRedo", "redo", L("Làm lại", "Redo"), "Ctrl+Shift+Z") + sep
      + b("plFlip", "flip", L("Lật mặt", "Flip"), L("Xem mặt trước / mặt sau (V)", "Front / back view (V)")) + b("plRats", "rats", L("Dây bay", "Ratsnest"), L("Bật / tắt dây bay", "Show / hide ratsnest"))
      + `<label class="alpha" title="${L("Board thật: độ rõ hình board thật", "Real boards: picture opacity")}">◐ <input type="range" id="plAlpha" min="0" max="100" step="5" value="${Math.round(S.alpha * 100)}"></label>` + sep
      + b("plZin", "zin", L("Phóng to", "Zoom in"), "") + b("plZout", "zout", L("Thu nhỏ", "Zoom out"), "") + b("plFit", "fit", L("Vừa khung", "Fit view"), "0 / Home") + sep
      + b("plArr", "arr", L("Sắp xếp", "Arrange"), L("Sắp xếp: tự bố trí linh kiện (bấm lần nữa đổi kiểu: gọn / rộng / dọc)", "Arrange: auto-place parts (click again for another layout: compact / wide / tall)"))
      + b("plReset", "reset", L("Làm mới", "Reset"), L("Làm mới: xoá hết, chỉ để lại board", "Reset: clear everything except the board"))
      + b("plTms", "tms", L("Thước", "Ruler"), TOOLS().ms[1]).replace("<button ", '<button data-tool="ms" ') + b("plCheck", "check", "Check", L("So mạch PCB với tab Wiring, chỉ ra chỗ khác", "Compare the PCB with the Wiring tab and point to differences"))
      + `<span style="flex:1"></span>` + b("plExport", "dl", "Export", L("Xuất mặt đồng, ký hiệu, mặt linh kiện (SVG / PNG 1:1) hoặc Gerber cho xưởng", "Export copper, silkscreen, component side (1:1 SVG / PNG) or Gerber for fabs"));
    // Fill / Chamfer không nằm trên thanh dọc: nút ◂ cạnh Pen mở menu xổ bên trái (thu / mở, nhớ trạng thái)
    const WELD = ["tf", "tc"];
    $("#plVbar").innerHTML = `<div class="pl-tools">${Object.entries(TOOLS()).filter(([k]) => !WELD.includes(k) && k !== "ms").map(([k, [t, tip]]) => b("plT" + k, k === "jw" ? "jump" : "t" + k, t, tip).replace("<button ", `<button data-tool="${k}" `)
      + (k === "cu" ? `<button type="button" class="tb tb-more" id="plPenMore" title="${L("Hàn nối dây: Fill (F) · Chamfer (C)", "Weld traces: Fill (F) · Chamfer (C)")}">◂</button>` : "")).join("")}</div>` + b("plAuto", "auto", L("Tự đi dây", "Autoroute"), L("Xoá đường tự động cũ rồi đi lại toàn bộ, giữ đường đã khoá (A)", "Remove old auto traces and route everything again, keep locked traces (A)"))
      + `<button type="button" class="tb tb-more tb-auto" id="plAutoNow" title="${L("Auto now (bật / tắt): dời, thêm hoặc xoá linh kiện là tự đi dây lại ngay phần liên quan", "Auto now (on / off): moving, adding or removing parts re-routes the affected nets right away")}">Auto now</button>` + b("plScheme", "scheme", "", "")
      + b("plUnwire", "unwire", L("Xoá dây LK", "Unwire part"), L("Xoá mọi đường / dây nhảy nối vào linh kiện đang chọn", "Remove every trace / jumper going to the selected part"))
      + b("plClear", "clear", L("Xoá hết dây", "Clear all"), L("Xoá mọi đường đồng và dây nhảy, cả tự động lẫn tự vẽ (Ctrl+Z để lấy lại)", "Remove every trace and jumper, auto and hand-drawn (Ctrl+Z to undo)")) + b("plPour", "pour", L("Phủ mass", "GND pour"), L("Đổ đồng GND vào chỗ trống (cách 0,6 mm, nan nhiệt)", "Fill free areas with GND copper (0.6 mm clearance, thermal spokes)"))
      + `<div class="vw"><small>${L("Độ rộng mm", "Width mm")}</small><button type="button" data-w="0.8">${L("0,8", "0.8")}</button><button type="button" data-w="1">${L("1,0", "1.0")}</button><button type="button" data-w="1.5">${L("1,5", "1.5")}</button></div>`;
    $("#plAlpha").oninput = e => { S.alpha = e.target.value / 100; render(); };
    const on = (id, f) => $(id).onclick = f;
    on("#plTms", () => setTool(ui.tool === "ms" ? "sel" : "ms")); on("#plCheck", cmd.check); on("#plUndo", cmd.undo); on("#plRedo", cmd.redo); on("#plRot", cmd.rotate); on("#plDel", cmd.del); on("#plAuto", cmd.auto); on("#plScheme", cmd.scheme); on("#plClear", cmd.clear); on("#plFit", fit); on("#plRats", cmd.rats); on("#plReset", cmd.reset); on("#plFlip", cmd.flip);
    $$(".pl-tools [data-tool]").forEach(x => x.onclick = () => { const tk = x.dataset.tool; if (tk === "tf") triggerWeldCmd("fill"); else if (tk === "tc") triggerWeldCmd("chamfer"); else setTool(tk); });
    let fly = $("#plFly"); if (!fly) { fly = document.createElement("div"); fly.id = "plFly"; fly.className = "pl-fly"; $("#plStage").appendChild(fly); }
    fly.innerHTML = WELD.map(k => { const [t, tip] = TOOLS()[k], [name, key] = t.match(/^(.*) \((.)\)$/).slice(1); return `<button type="button" data-tool="${k}" title="${tip}"><span>${name}</span><kbd>${key}</kbd></button>`; }).join("");
    fly.querySelectorAll("[data-tool]").forEach(x => x.onclick = () => ui.tool === x.dataset.tool ? setTool("sel") : triggerWeldCmd(x.dataset.tool === "tf" ? "fill" : "chamfer"));
    const placeFly = () => { const pb = $("#plTcu"), st = $("#plStage"); if (pb && st) fly.style.top = Math.max(6, pb.getBoundingClientRect().top - st.getBoundingClientRect().top) + "px"; const open = S.penFly !== false; fly.classList.toggle("on", open); $("#plPenMore").textContent = open ? "▸ " + L("Hàn", "Weld") : "◂ " + L("Hàn", "Weld"); };   // mặc định mở
    $("#plPenMore").onclick = () => { S.penFly = S.penFly === false; save(); placeFly(); };
    placeFly(); setTimeout(placeFly, 0);
    setTool(ui.tool || "sel"); on("#plPour", cmd.pour); on("#plAutoNow", cmd.autoRe); on("#plUnwire", cmd.unwire); on("#plArr", cmd.arrange);
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
  window.PCB = { opt: OPT, dedupe, S: () => S, analyze, autoroute, cmd, ui, pads, exportSVG, pngDPI, gerber, zip };
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
