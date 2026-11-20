/* Pindexio PCB Lab: bo 1 lớp làm tại nhà. Nhúng trong Pindexio, mở bằng #pcblab.
   Đơn vị mm, lưới 2,54 mm (linh kiện) và 0,635 mm (đường đồng). Mọi thứ dựng trong phần tử #pcblab, id có tiền tố pl… */
(function () {
  "use strict";
  const ROOT = document.getElementById("pcblab"); if (!ROOT || window.PCBLAB) return;   // chỉ chạy 1 lần
  ROOT.classList.add("pcblab");
  ROOT.innerHTML = `<aside class="pl-list" id="plList"></aside><nav class="pl-bar" id="plBar"></nav>
    <section class="pl-stage" id="plStage"><svg id="plSvg" xmlns="http://www.w3.org/2000/svg"></svg><canvas id="plRulerT" aria-hidden="true"></canvas><canvas id="plRulerL" aria-hidden="true"></canvas><div id="plTip"></div><div id="plHint"></div><div id="plCtxBar" role="toolbar" aria-label="Touch/Pen Actions"></div><div id="plToast"></div><div id="plCtx"></div><a id="buyBtnP" class="buy-btn" hidden target="_blank" rel="noopener sponsored nofollow"></a></section>
    <nav class="pl-vbar" id="plVbar"></nav><aside class="pl-side"><div id="plPanel"></div></aside><div class="pl-tips" id="plTips"></div>
    <nav class="pl-tab-switch" id="plTabSwitch"></nav>`;
  const $ = s => ROOT.querySelector(s), $$ = s => ROOT.querySelectorAll(s);
  const BUILD = "2026-11-13 15:53"; $("#plStage").insertAdjacentHTML("beforeend", `<div id="plBuild">build ${BUILD}</div>`);
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
  // lỗ dây nhảy; dài tối thiểu 2,54 mm (1 ô); JP_OVER: khoảng cách thân dây nhảy tới mép chân khác mạng
  const JP_R = 0.8, JP_DRILL = 0.4, JP_MIN = G, JP_MAX = 4 * G, JP_OVER = .3;
  const JO = () => ({ wire: 1, shape: "round", r: JP_R, w: 1.6, h: 1.0, hole: 1, drill: JP_DRILL, fix: 0, ...(S.jOpt || {}) });   // tuỳ chọn Jumper pad (Studio): dây / chỉ pad, hình pad, cỡ, lỗ, bước chuẩn
  const jMinOf = j => (j && j.o && j.o.min) || JP_MIN;
  const jFix = (a, q) => { const f = JO().fix, dx = q[0] - a[0], dy = q[1] - a[1], d = Math.hypot(dx, dy); if (!f || d < 1e-6) return q; const n = Math.max(1, Math.round(d / f)); return [r3(a[0] + dx / d * n * f), r3(a[1] + dy / d * n * f)]; };
  const noWire = j => false;   // Jumper pad luôn có dây; cụm pad không dây dùng nút Component
  let jpSel = () => {};   // đồng bộ bảng Jumper pad với jumper đang chọn (gán trong tools())
  const PIN_GAP = 0.5;
  // tuỳ chọn đi dây (chỉ để thử / đo so sánh qua PCB.opt): esc lối thoát quanh chân chờ, ord thứ tự đi (mps / pwr), rip gỡ đường vây,
  // nearCost phí chạy sát vật khác mạng, roomPct lề bo khi thiết kế, timeCap giới hạn Tự đi dây (ms)
  const RT = { only: null, maxJ: null };   // tuỳ chọn tạm của autoroute khi agent gọi: chỉ các mạng này / giới hạn số dây nhảy tự đặt
  const OPT = { esc: .8, ord: "mps", rip: true, nearCost: .7, roomPct: .15, timeCap: 10000 };
  const PREVIEW_W = .4;   // nét hiển thị khi đang vẽ dây (mm): mảnh để thấy chính xác; độ rộng thật áp khi chốt dây
  let W_SIG = .8, W_PWR = 1; const PWR = new Set(["GND", "3V3", "5V"]);
  const syncW = () => { W_SIG = Math.max(.2, Math.min(3, +S.wSig || .8)); W_PWR = Math.max(.2, Math.min(3, +S.wPwr || 1)); };   // mặc định lưu theo từng bo
  const SPREAD0 = 3;   // mặc định chừa đủ 1 làn: sau này chỗ kẹt vẫn nhét thêm được 1 đường   // chân chưa đi dây: đường khác mạng chừa thêm khoảng này, để chân còn lối thoát (đặt lỗ, kéo đồng ra)   // tự đi dây: đường khác mạng chừa thêm khoảng này quanh chân, để chỗ sát chân còn đặt lỗ và hàn được   // JP_OVER: dây trần ở mặt trên cách chân khác mạng (ngoài mép pad)
  const snap = (v, s) => Math.round(v / s) * s;
  const r3 = v => Math.round(v * 1000) / 1000;
  const TRK = (n, d) => { try { if (window.PX_TRACK) window.PX_TRACK(n, d); } catch (e) { } };   // phân tích hành vi ẩn danh (feedback.js)
  // hiển thị độ dài theo hệ thước đang chọn (S.unit); dữ liệu luôn lưu mm
  const pmLbl = root => root.querySelectorAll("[data-pm],[data-cpm]").forEach(b => { const v = +(b.dataset.pm || b.dataset.cpm); b.textContent = UIN() ? String(+(v / 25.4).toFixed(3)).replace(".", L(",", ".")) + " in" : String(v).replace(".", L(",", ".")) + " mm"; });
  const UIN = () => !!(S && S.unit === "in"), nU = v => UIN() ? (v / 25.4).toFixed(3) : v.toFixed(2), fU = v => nU(v) + (UIN() ? " in" : " mm");

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
  const dipFP = (names, label) => ({ pads: names.split(" ").map((n, i) => ({ name: n, x: i < 4 ? 0 : 3 * G, y: (i < 4 ? i : 7 - i) * G, ...(i ? {} : { sq: true }) })), body: { x: .81, y: -1.27, w: 6, h: 10.16 }, label, dip: true });
  const to220FP = (names, val) => ({ pads: at(names, [[0, 0], [G, 0], [2 * G, 0]]), body: { x: G - 5.1, y: -2.4, w: 10.2, h: 4.8 }, label: "", val, to220: true });
  const FP0 = {
    // DevKitC-1 62,74 dài, 2 hàng chân cách 25,4 (1"), ăng-ten vượt quá chân 1
    S3: { pads: [...S3L.map((n, i) => ({ name: n, x: 0, y: i * G })), ...S3R.map((n, i) => ({ name: n, x: 10 * G, y: i * G }))], body: { x: -1.3, y: -7.4, w: 28, h: 62.74 }, label: "ESP32-S3-DevKitC-1", inner: true },
    ssd1306: hdr("SDA/d SCL/c VCC/3 GND/g", 27.3, 27.8, "T", "OLED 0.96\""),                       // 27,3 × 27,8, thứ tự chân theo Pindexio
    st7789: { pads: pinsOf("GND/g VCC/3 SCL/k SDA/m RES/s DC/s CS/s BLK/s").map((p, i) => ({ ...p, x: i * G, y: 0 })), body: { x: -4.26, y: -3.44, w: 26.22, h: 34.41 }, label: "ST7789 240×240" },
    sevseg: { pads: at("E D GND/g C DP G F GND/g A B", [0, 1, 2, 3, 4, 0, 1, 2, 3, 4].map((k, i) => [k * G, i < 5 ? 0 : -6 * G])), body: { x: -1.17, y: -17.12, w: 12.5, h: 19 }, label: "8", inner: true },   // 0,56": 2 hàng cách 15,24, 2 chân COM nối trong
    ws2812: hdr("GND/g VCC/5 DIN/s", 30, 25, "T", "WS2812 RGB"),                                     // ~ module LED rất đa dạng
    tb6612fng: { pads: at("VM/5 VCC/3 GND/g A01 A02 B02 B01 GND2/g PWMA/s AIN2/s AIN1/s STBY/s BIN1/s BIN2/s PWMB/s GND3/g", [...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [0, i * G]), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [7 * G, i * G])]), body: { x: -2.54, y: -1.14, w: 20.32, h: 20.32 }, label: "TB6612", inner: true },   // SparkFun 0,8" × 0,8", 2 hàng 8 chân cách 0,7"
    servo: hdr("SIG/s VCC/5 GND/g", 3 * G, G, "L", "Servo"),
    smd_0402: { pads: [{ name: "1", x: -0.5, y: 0, w: 0.55, h: 0.6, smd: true }, { name: "2", x: 0.5, y: 0, w: 0.55, h: 0.6, smd: true }], body: { x: -0.9, y: -0.45, w: 1.8, h: 0.9 }, label: "0402" },
    smd_0603: { pads: [{ name: "1", x: -0.8, y: 0, w: 0.95, h: 1.0, smd: true }, { name: "2", x: 0.8, y: 0, w: 0.95, h: 1.0, smd: true }], body: { x: -1.45, y: -0.65, w: 2.9, h: 1.3 }, label: "0603" },
    smd_0805: { pads: [{ name: "1", x: -1.0, y: 0, w: 1.2, h: 1.4, smd: true }, { name: "2", x: 1.0, y: 0, w: 1.2, h: 1.4, smd: true }], body: { x: -1.8, y: -0.9, w: 3.6, h: 1.8 }, label: "0805" },
    smd_1206: { pads: [{ name: "1", x: -1.5, y: 0, w: 1.6, h: 1.8, smd: true }, { name: "2", x: 1.5, y: 0, w: 1.6, h: 1.8, smd: true }], body: { x: -2.5, y: -1.1, w: 5.0, h: 2.2 }, label: "1206" },
    smd_sot23: { pads: [{ name: "1", x: -0.95, y: 1.1, w: 0.7, h: 1.0, smd: true }, { name: "2", x: 0.95, y: 1.1, w: 0.7, h: 1.0, smd: true }, { name: "3", x: 0, y: -1.1, w: 0.7, h: 1.0, smd: true }], body: { x: -1.5, y: -0.75, w: 3.0, h: 1.5 }, label: "SOT-23" },
    smd_soic8: { pads: [0,1,2,3].map(i => ({ name: String(i+1), x: (i-1.5)*1.27, y: 2.7, w: 0.6, h: 1.55, smd: true })).concat([0,1,2,3].map(i => ({ name: String(8-i), x: (i-1.5)*1.27, y: -2.7, w: 0.6, h: 1.55, smd: true }))), body: { x: -2.5, y: -2.0, w: 5.0, h: 4.0 }, label: "SOIC-8" },   // chỉ hàng header 3 chân cắm giắc servo (thân servo ở ngoài bo)
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
    C: { pads: at("1/3 2/g", [[0, 0], [2 * G, 0]]), body: { x: -.96, y: -1.5, w: 7, h: 3 }, label: "", round: true, val: "100n" },   // tụ gốm chân cách 5,08 (mặc định lọc nguồn 3V3)
    // tụ hoá 35 V chân thẳng (radial), 3 cỡ chuẩn: Ø5, Ø6,3 (chân 2,0 / 2,5 uốn ra 2,54 để pad Ø2 còn khe 0,5) · Ø8 chân 3,5. Chân 1 (vuông) là cực +, cực − về GND
    ecap5: { pads: at("+ -", [[0, 0], [G, 0]]), body: { x: G / 2 - 2.5, y: -2.5, w: 5, h: 5 }, label: "", round: true, val: "47µ 35V", ecap: true },
    ecap6: { pads: at("+ -", [[0, 0], [G, 0]]), body: { x: G / 2 - 3.15, y: -3.15, w: 6.3, h: 6.3 }, label: "", round: true, val: "100µ 35V", ecap: true },
    ecap8: { pads: at("+ -", [[0, 0], [3.5, 0]]), body: { x: 1.75 - 4, y: -4, w: 8, h: 8 }, label: "", round: true, val: "470µ 35V", ecap: true },
    // motor DC: 2 chân (domino / header) cách 5,08, nối ra A01/A02 hoặc B01/B02 của driver TB6612
    motor: { pads: at("M+ M-", [[0, 0], [2 * G, 0]]), body: { x: -2.5, y: -3.5, w: 10.08, h: 7 }, label: "M", motor: true },
    // transistor TO-92 (BJT): 3 chân 2,54, chân giữa luôn là B. E / C tuỳ loại (2N2222, 2N3904: E-B-C; BC547: C-B-E) – đổi ở bảng bên phải
    to92: { pads: at("E B C", [[0, 0], [G, 0], [2 * G, 0]]), body: { x: G - 2.5, y: -2.0, w: 5.0, h: 4.5 }, label: "", val: "2N3904", to92: true },
    // MOSFET kênh N vỏ TO-220 đứng: G D S cách 2,54, thân 10,2 × 4,6 (tấm tản nhiệt phía sau = D). S về GND, G nhận tín hiệu
    irfz44n: { pads: at("G D S", [[0, 0], [G, 0], [2 * G, 0]]), body: { x: G - 5.1, y: -2.4, w: 10.2, h: 4.8 }, label: "", val: "IRFZ44N", to220: true },
    // DIP-8 (op-amp, NE555…): 2 hàng cách 7,62; chân 1–4 cột trái từ trên xuống, 5–8 cột phải từ dưới lên
    dip8: dipFP("1 2 3 4 5 6 7 8", "DIP-8"),
    lm358: dipFP("OUT1 IN1- IN1+ GND IN2+ IN2- OUT2 VCC", "LM358"),   // op-amp kép
    lm393: dipFP("OUT1 IN1- IN1+ GND IN2+ IN2- OUT2 VCC", "LM393"),   // so sánh kép (ra cực thu hở: cần R kéo lên)
    ir2104: dipFP("VCC IN SD COM LO VS HO VB", "IR2104"),             // driver nửa cầu MOSFET
    // ổn áp / MOSFET vỏ TO-220 (cùng hình học: chân cách 2,54, thân 10,2 × 4,8)
    lm7805: to220FP("IN GND OUT", "LM7805"), lm317: to220FP("ADJ OUT IN", "LM317"), irf3205: to220FP("G D S", "IRF3205"), irlz44n: to220FP("G D S", "IRLZ44N"),
    lm35: { pads: at("+VS VOUT GND", [[0, 0], [G, 0], [2 * G, 0]]), body: { x: G - 2.5, y: -2.0, w: 5.0, h: 4.5 }, label: "", val: "LM35", to92: true },   // cảm biến nhiệt TO-92 (nhìn mặt phẳng)
    // nút nhấn 12 × 12 (THT, 4 chân cách 12,5 × 5,0; cặp cùng tên nối trong)
    button12: { pads: at("SIG/s SIG/s GND/g GND/g", [[0, 0], [12.5, 0], [0, 5], [12.5, 5]]), body: { x: .25, y: -3.5, w: 12, h: 12 }, label: "", inner: true },
    // TO-220 chung (LM7805, MOSFET, triac…): chân 1 2 3 cách 2,54, tấm tản nhiệt phía sau
    to220: to220FP("1 2 3", ""),
    // cầu đấu vít (domino KF301) bước 5,08: pad Ø2,6 khoan Ø1,3
    term2_508: { term: true, pads: [0, 1].map(i => ({ name: String(i + 1), x: i * 2 * G, y: 0, r: 1.3, drill: 1.3 })), body: { x: -2.54, y: -4, w: 10.16, h: 8 }, label: "" },
    term3_508: { term: true, pads: [0, 1, 2].map(i => ({ name: String(i + 1), x: i * 2 * G, y: 0, r: 1.3, drill: 1.3 })), body: { x: -2.54, y: -4, w: 15.24, h: 8 }, label: "" },
    // điện trở shunt SMD 2512 (6,3 × 3,2): đo dòng
    smd_2512: { pads: [{ name: "1", x: -3.0, y: 0, w: 1.8, h: 3.4, smd: true }, { name: "2", x: 3.0, y: 0, w: 1.8, h: 3.4, smd: true }], body: { x: -3.15, y: -1.6, w: 6.3, h: 3.2 }, label: "2512" },
    irf540n: { pads: at("G D S", [[0, 0], [G, 0], [2 * G, 0]]), body: { x: G - 5.1, y: -2.4, w: 10.2, h: 4.8 }, label: "", val: "IRF540N", to220: true },
    irf520: { pads: at("G D S", [[0, 0], [G, 0], [2 * G, 0]]), body: { x: G - 5.1, y: -2.4, w: 10.2, h: 4.8 }, label: "", val: "IRF520", to220: true }
  };
  // Footprint hàng rào cắm chân Header (Pin Header 1 hàng, bước 2.54mm): HDR:P1,P2,P3 hoặc pinHdr_N
  function pinHdrKey(n, pitch, padD, sq, noHole, rows = 1, gapIn = .7, pw = 0, ph = 0, drill = 0) {
    const isDef = Math.abs(pitch - G) < 1e-4 && Math.abs(padD - 2 * PAD_R) < 1e-4 && sq === null && !noHole && rows < 2 && !(pw > 0 && ph > 0) && !(drill > 0);
    return isDef ? "pinHdr_" + n : `pinHdr_${n}_${pitch}_${padD}_${sq ? 1 : 0}_${noHole ? 1 : 0}` + (rows > 1 ? `_r${rows}_${gapIn}` : "") + (pw > 0 && ph > 0 ? `_x${pw}x${ph}` : "") + (drill > 0 && !noHole ? `_h${drill}` : "");
  }
  function pinHdrFP(n, pitch = G, padD = 2 * PAD_R, sq = null, noHole = false, rows = 1, gapIn = .7, pw = 0, ph = 0, drill = 0) { drill = drill > 0 ? Math.max(0.3, Math.min(4, Number(drill))) : 0; n = Math.max(1, Math.min(40, parseInt(n) || 3)); pitch = Math.max(0.4, Math.min(25.4, Number(pitch) || G)); padD = Math.max(0.4, Math.min(8.0, Number(padD) || 2 * PAD_R)); rows = Math.max(1, Math.min(10, parseInt(rows) || 1)); gapIn = Math.max(.05, Math.min(6, Math.round((Number(gapIn) || .7) * 100) / 100)); pw = pw > 0 ? Math.max(0.3, Math.min(10, Number(pw))) : 0; ph = ph > 0 ? Math.max(0.3, Math.min(10, Number(ph))) : 0; const k = pinHdrKey(n, pitch, padD, sq, noHole, rows, gapIn, pw, ph, drill); if (FP0[k]) return FP0[k]; const pads = [], r = r3((pw && ph ? Math.max(pw, ph) : padD) / 2), gap = r3(gapIn * 25.4), pp = { ...(pw && ph ? { w: r3(pw), h: r3(ph) } : { r }), ...(sq === null ? {} : { sq: !!sq }), ...(noHole ? { smd: true } : {}), ...(!noHole && drill > 0 ? { drill } : !noHole && pitch < 2 ? { drill: .6 } : {}) }; for (let i = 0; i < n; i++) pads.push({ name: String(i + 1), x: r3(i * pitch), y: 0, ...pp }); if (rows === 2) for (let i = n - 1; i >= 0; i--) pads.push({ name: String(2 * n - i), x: r3(i * pitch), y: gap, ...pp }); else for (let k = 1; k < rows; k++) for (let i = 0; i < n; i++) pads.push({ name: String(k * n + i + 1), x: r3(i * pitch), y: r3(k * gap), ...pp }); const span = (n - 1) * pitch, padPad = r + 0.3; return FP0[k] = { pads, body: { x: -padPad, y: -padPad, w: span + 2 * padPad, h: (rows - 1) * gap + 2 * padPad }, label: "", pinHdr: true, nPins: n, pitch, padD, padSq: sq, noHole, rows, rowGapIn: gapIn, pw, ph }; }
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
  const FP = new Proxy(FP0, { get: (t, k) => {
    // Footprint hàng rào cắm chân Header (Pin Header 1 hàng, bước 2.54mm): HDR:P1,P2,P3 hoặc pinHdr_N
    const pinHdr_m = typeof k === "string" && k.match(/^pinHdr(?:_(\d+)(?:_([\d.]+)_([\d.]+)_([01])(?:_([01]))?(?:_r(\d+)_([\d.]+))?(?:_x([\d.]+)x([\d.]+))?(?:_h([\d.]+))?)?)?$/);
    if (pinHdr_m) return pinHdrFP(pinHdr_m[1] ? parseInt(pinHdr_m[1], 10) : 3, pinHdr_m[2] ? parseFloat(pinHdr_m[2]) : G, pinHdr_m[3] ? parseFloat(pinHdr_m[3]) : 2 * PAD_R, pinHdr_m[4] != null ? pinHdr_m[4] === "1" : null, pinHdr_m[5] === "1", pinHdr_m[6] ? +pinHdr_m[6] : 1, pinHdr_m[7] ? +pinHdr_m[7] : .7, pinHdr_m[8] ? +pinHdr_m[8] : 0, pinHdr_m[9] ? +pinHdr_m[9] : 0, pinHdr_m[10] ? +pinHdr_m[10] : 0);
    return FP0[k] || (typeof k === "string" ? (k.startsWith("HDR:") ? hdrFP(k) : k.startsWith("BRD:") ? brdFP(k) : undefined) : undefined);
  } });
  // [tiếng Việt, English, tên ngắn]. Trong Pindexio, module lấy tên từ MODULES (dịch qua từ điển của site)
  const NAMES = { smd_0402: ["SMD 0402 (R/C/LED)", "SMD 0402 (R/C/LED)", "0402"], smd_0603: ["SMD 0603 (R/C/LED)", "SMD 0603 (R/C/LED)", "0603"], smd_0805: ["SMD 0805 (R/C/LED)", "SMD 0805 (R/C/LED)", "0805"], smd_1206: ["SMD 1206 (R/C/LED)", "SMD 1206 (R/C/LED)", "1206"], smd_sot23: ["SOT-23 (transistor)", "SOT-23 (transistor)", "SOT-23"], smd_soic8: ["SOIC-8 (IC, 1,27 mm)", "SOIC-8 (IC, 1.27 mm)", "SOIC-8"], to92: ["Transistor TO-92", "TO-92 transistor", "TO-92"], motor: ["Motor DC", "DC motor", "Motor DC"], ecap5: ["Tụ hoá Ø5 (35V)", "Electrolytic Ø5 (35V)", "Tụ hoá Ø5"], ecap6: ["Tụ hoá Ø6,3 (35V)", "Electrolytic Ø6.3 (35V)", "Tụ hoá Ø6,3"], ecap8: ["Tụ hoá Ø8 (35V)", "Electrolytic Ø8 (35V)", "Tụ hoá Ø8"],
    irfz44n: ["MOSFET IRFZ44N", "MOSFET IRFZ44N", "IRFZ44N"], irf540n: ["MOSFET IRF540N / IRF540", "MOSFET IRF540N / IRF540", "IRF540N"], irf520: ["MOSFET IRF520", "MOSFET IRF520", "IRF520"],
    irf3205: ["MOSFET IRF3205", "MOSFET IRF3205", "IRF3205"], irlz44n: ["MOSFET IRLZ44N (logic 5V)", "MOSFET IRLZ44N (logic-level)", "IRLZ44N"], to220: ["Vỏ TO-220 (chung)", "TO-220 (generic)", "TO-220"],
    lm7805: ["Ổn áp LM7805 (5V)", "LM7805 regulator (5V)", "LM7805"], lm317: ["Ổn áp chỉnh LM317", "LM317 adjustable regulator", "LM317"], lm35: ["Cảm biến nhiệt LM35", "LM35 temperature sensor", "LM35"],
    lm358: ["Op-amp LM358 (DIP-8)", "LM358 op-amp (DIP-8)", "LM358"], lm393: ["So sánh LM393 (DIP-8)", "LM393 comparator (DIP-8)", "LM393"], ir2104: ["Driver nửa cầu IR2104 (DIP-8)", "IR2104 half-bridge driver (DIP-8)", "IR2104"], dip8: ["IC DIP-8 (chung)", "DIP-8 IC (generic)", "DIP-8"],
    button12: ["Nút nhấn 12×12", "Push button 12×12", "Nút 12×12"], term2_508: ["Cầu đấu vít 2 chân (5,08)", "Screw terminal 2P (5.08)", "Domino 2P"], term3_508: ["Cầu đấu vít 3 chân (5,08)", "Screw terminal 3P (5.08)", "Domino 3P"], smd_2512: ["Điện trở shunt 2512", "2512 shunt resistor", "2512"], pinHdr: ["Hàng rào cắm chân", "Pin header", "Pin Header"], S3: ["ESP32-S3 DevKitC-1", "ESP32-S3 DevKitC-1", "ESP32-S3"], ssd1306: ["OLED SSD1306 0.96\"", "OLED SSD1306 0.96\"", "OLED 0.96\""], st7789: ["Màn TFT ST7789", "ST7789 TFT display", "ST7789"], sevseg: ["LED 7 đoạn", "7-segment LED", "LED 7 đoạn"], ws2812: ["LED RGB WS2812", "WS2812 RGB LED", "WS2812"], hcsr04: ["Siêu âm HC-SR04", "HC-SR04 ultrasonic", "HC-SR04"], tb6612fng: ["Driver động cơ TB6612FNG", "TB6612FNG motor driver", "TB6612FNG"], servo: ["Động cơ Servo SG90", "SG90 servo", "Servo"], vl53l0x: ["ToF VL53L0X", "VL53L0X ToF", "VL53L0X"], mpu6050: ["IMU MPU6050", "MPU6050 IMU", "MPU6050"], dht22: ["Nhiệt ẩm DHT22", "DHT22 temp/humidity", "DHT22"], ldr: ["Ánh sáng LDR", "LDR light sensor", "LDR"], buzzer: ["Còi buzzer", "Buzzer", "Buzzer"], max98357a: ["Ampli I2S MAX98357A", "MAX98357A I2S amp", "MAX98357A"], inmp441: ["Micro I2S INMP441", "INMP441 I2S mic", "INMP441"], button: ["Nút bấm", "Push button", "Nút bấm"], led: ["Đèn LED 5 mm", "5 mm LED", "Đèn LED"], R: ["Điện trở", "Resistor", "Điện trở"], C: ["Tụ điện", "Capacitor", "Tụ điện"] };
  const tr = s => (EN() && window.trEN ? window.trEN(s) : s);
  const VNCH = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;   // còn chữ Việt = chưa dịch
  const NAME = new Proxy({}, { get: (_, k) => {
    if (SITE && MODULES[k]) { const t = tr(MODULES[k].name); if (!(EN() && NAMES[k] && VNCH.test(t))) return t; }
    if (typeof k === "string" && k.startsWith("pinHdr_")) return (EN() ? "Pin header " : "Hàng rào ") + (/_r2_/.test(k) ? "2×" : "") + k.split("_")[1] + "P";
    return NAMES[k] ? L(NAMES[k][0], NAMES[k][1]) : k;
  } });
  const SHORT = k => {
    if (SITE && MODULES[k]) { const t = tr(MODULES[k].short); if (!(EN() && NAMES[k] && VNCH.test(t))) return t; }
    if (typeof k === "string" && k.startsWith("pinHdr_")) return "Header " + (/_r2_/.test(k) ? "2×" : "") + k.split("_")[1] + "P";
    return NAMES[k] ? (EN() ? NAMES[k][1] : NAMES[k][2]) : k;
  };
  const CATS_BASE = () => [[L("Board", "Board"), "🧠", ["S3"]], [L("Màn hình & hiển thị", "Displays"), "🖥️", ["ssd1306", "st7789", "sevseg", "ws2812"]], [L("Cảm biến", "Sensors"), "📡", ["hcsr04", "vl53l0x", "mpu6050", "dht22", "ldr"]], [L("Âm thanh & còi", "Audio & buzzers"), "🔊", ["buzzer", "max98357a", "inmp441"]], [L("Động cơ", "Motors"), "⚙️", ["servo", "tb6612fng", "motor"]], [L("Cơ bản", "Basics"), "🎛️", ["pinHdr", "button", "button12", "led", "R", "C", "ecap5", "ecap6", "ecap8", "term2_508", "term3_508"]], [L("Công suất", "Power"), "⚡", ["to92", "irfz44n", "irf540n", "irf520", "irf3205", "irlz44n", "lm7805", "lm317", "to220"]], [L("IC", "ICs"), "🔳", ["lm358", "lm393", "ir2104", "dip8", "lm35"]]];
  const CATS = () => { const a = CATS_BASE(); a.push([L("SMD chuẩn", "Standard SMD"), "🔲", ["smd_0402", "smd_0603", "smd_0805", "smd_1206", "smd_sot23", "smd_soic8", "smd_2512"]]); if (MYIDS.length) a.push([L("Linh kiện của tôi", "My parts"), "⭐", MYIDS]); return a; };
  // lưu ý khi thêm (theo ghi chú linh kiện của Pindexio)
  const TIPS = { hcsr04: ["ECHO ra 5 V: để trống, nối qua chia áp R 1k + 2k rồi mới vào GPIO.", "ECHO outputs 5 V: left open, wire it through a 1k + 2k divider before a GPIO."], dht22: ["Thêm R 10k kéo SDA lên 3V3.", "Add a 10k pull-up from SDA to 3V3."], led: ["Chân A để trống: nối qua R 220–330 Ω rồi mới vào GPIO.", "Pin A is left open: wire it through 220–330 Ω before a GPIO."], sevseg: ["Các đoạn A–G, DP để trống: mỗi đoạn qua R 220–330 Ω.", "Segments A–G, DP are left open: each needs a 220–330 Ω resistor."], ws2812: ["Nên thêm R 330 Ω nối tiếp DIN.", "Add a 330 Ω series resistor on DIN."], inmp441: ["L/R nối GND = kênh trái. Chỉ chạy 3,3 V.", "L/R to GND = left channel. 3.3 V only."], max98357a: ["GAIN, SD để trống = 9 dB, bật.", "GAIN, SD left open = 9 dB, enabled."] };
  Object.assign(TIPS, {
    ecap5: ["Tụ có cực: chân vuông là +, vạch trắng trên thân là −. Đặt tên / giá trị ở bảng bên phải.", "Polarised: square pad is +, the stripe on the can is −. Set name / value in the right panel."],
    irfz44n: ["IRFZ44N cần ~10 V ở cổng G mới mở hết: GPIO 3,3 V chỉ mở một phần, nên dùng mạch kích hoặc MOSFET logic-level.", "IRFZ44N needs ~10 V on G to fully turn on: a 3.3 V GPIO only half-opens it, use a driver or a logic-level MOSFET."],
    irf540n: ["IRF540N cần ~10 V ở cổng G: GPIO 3,3 V không đủ, cần mạch kích.", "IRF540N needs ~10 V on G: a 3.3 V GPIO is not enough, use a driver."],
    irf520: ["IRF520 cần ~10 V ở cổng G: GPIO 3,3 V không đủ, cần mạch kích (module IRF520 có sẵn mạch).", "IRF520 needs ~10 V on G: a 3.3 V GPIO is not enough, use a driver (IRF520 modules include one)."] });
  TIPS.ecap6 = TIPS.ecap8 = TIPS.ecap5;
  TIPS.to92 = ["Chân giữa là B (Base, nối GPIO qua R 1k). E và C tuỳ loại: 2N2222 / 2N3904 là E-B-C, BC547 là C-B-E (nhìn mặt phẳng, từ trái sang). Đổi chân ở bảng bên phải.", "The middle pin is B (Base, to a GPIO through 1k). E and C depend on the part: 2N2222 / 2N3904 are E-B-C, BC547 is C-B-E (flat face toward you, left to right). Change pins in the right panel."];
  TIPS.motor = ["Motor DC nối ra kênh A (A01/A02) hoặc B (B01/B02) của TB6612. Chưa có TB6612 thì thêm driver trước.", "The DC motor connects to channel A (A01/A02) or B (B01/B02) of the TB6612. Add the driver first."];
  TIPS.servo = ["Nguồn servo đi chung nguồn motor (chân VM của TB6612) nếu có driver. Servo kéo dòng lớn: dùng nguồn 5 V riêng, chung GND, thêm tụ hoá 470µ gần servo. Chân SIG vẫn nối GPIO.", "Servo power shares the motor supply (TB6612 VM) when a driver is present. Servos draw large currents: use a separate 5 V supply, common GND, and a 470µ cap near the servo. SIG still goes to a GPIO."];
  // linh kiện rời (tuỳ mạch): app KHÔNG tự nối chân, người dùng tự chọn mạng ở bảng bên phải
  for (const k of ["ecap5", "to92", "irfz44n", "irf540n", "irf520"]) TIPS[k] = [TIPS[k][0] + " Chân chưa tự nối: nối theo mạch của bạn.", TIPS[k][1] + " Pins are not auto-wired: connect them to suit your circuit."];
  TIPS.pinHdr = ["Hàng rào cắm chân header 2.54 mm. Đổi số chân ở bảng bên phải hoặc popup.", "2.54 mm pin header. Change pin count in the right panel or popup."];
  const TIP = new Proxy({}, { get: (_, k) => TIPS[k] && L(TIPS[k][0], TIPS[k][1]) });
  const SYM_PRE = { R: "R", C: "C", LED: "D", D: "D", L: "L" };
  function symD(sym, f) {   // nét in lụa kiểu ký hiệu điện: trả về chuỗi path (toạ độ cục bộ của linh kiện) hoặc null
    if (!sym || !f || !f.pads || f.pads.length !== 2) return null;
    const a = f.pads[0], b = f.pads[1], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < .8) return null;
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy, ny = ux, ext = Math.abs(ux) > .7 ? (a.w || 2 * (a.r || 1)) / 2 : (a.h || 2 * (a.r || 1)) / 2;
    let mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const avail = L / 2 - ext - .15, inline = avail >= 1.0;
    if (!inline) { const off = (Math.abs(ux) > .7 ? (a.h || 2 * (a.r || 1)) / 2 : (a.w || 2 * (a.r || 1)) / 2) + 1.1; mx += nx * off; my += ny * off; }
    const h = inline ? Math.min(1.7, avail) : 1.0, P = (u, t) => [r3(mx + ux * u + nx * t), r3(my + uy * u + ny * t)], M = (...p) => "M" + p.map(q => q.join(" ")).join(" L");
    let d = ""; const lead = hh => { if (inline) { d += M(P(-L / 2 + ext, 0), P(-hh, 0)) + " " + M(P(hh, 0), P(L / 2 - ext, 0)) + " "; } };
    if (sym === "R") { lead(h); d += M(P(-h, -.55), P(h, -.55), P(h, .55), P(-h, .55)) + " Z"; }
    else if (sym === "C") { const t = Math.min(.3, h / 3); lead(t); d += M(P(-t, -.95), P(-t, .95)) + " " + M(P(t, -.95), P(t, .95)); }
    else if (sym === "D" || sym === "LED") {
      const t = Math.min(.8, h * .6), w = .8; lead(t); d += M(P(-t, -w), P(-t, w), P(t, 0)) + " Z " + M(P(t, -w), P(t, w));
      if (sym === "LED") d += " " + M(P(-.3, -w - .25), P(.5, -w - 1.05)) + " " + M(P(.4, -w - .1), P(1.2, -w - .9));
    }
    else if (sym === "L") { lead(h); const r = h / 3; d += "M" + P(-h, 0).join(" "); for (let k = 0; k < 3; k++) { const e = P(-h + (k + 1) * 2 * r, 0); d += " A" + r + " " + r + " 0 0 1 " + e.join(" "); } }
    else return null;
    return d;
  }
  const PRE = { dip8: "U", lm358: "U", lm393: "U", ir2104: "U", lm7805: "U", lm317: "U", lm35: "U", irf3205: "Q", irlz44n: "Q", button12: "SW", to220: "Q", term2: "J", term3: "J", smd_2512: "R", pinHdr: "J", to92: "Q", motor: "MOT", S3: "U", R: "R", C: "C", ecap5: "C", ecap6: "C", ecap8: "C", irfz44n: "Q", irf540n: "Q", irf520: "Q", led: "D", button: "SW", buzzer: "BZ" };
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
    const ps = b.headers.flatMap(h => h.pins), usable = p => p.gpio != null && !["power", "gnd", "ctl", "nc", "ban"].includes(p.cat), isRisk = p => !!(p.warn || p.cat === "usb");
    const seen = new Set(), sig = ps.filter(p => usable(p) && !seen.has(p.name) && seen.add(p.name)), re = BUS_RE[b.family] || BUS_RE.ESP32, bus = {};
    for (const k in re) { const p = sig.find(q => re[k].test(q.fn.join(" "))); if (p) bus[k] = p.name; }
    const bv = new Set(Object.values(bus)), idx = new Map(ps.map((p, i) => [p.name, i]));
    return HOSTS[id] = {
      s3: false, id, name: b.name, tag: b.tag || "MCU", v5: /^5/.test(b.logic || ""), bus, order: n => idx.has(n) ? idx.get(n) : 1e3,
      pins: new Set([...sig.map(p => p.name), "GND", "3V3", "5V"]),
      pref: [...sig.filter(p => !isRisk(p) && !bv.has(p.name)).map(p => p.name), ...bv], risky: sig.filter(p => isRisk(p) && !bv.has(p.name)).map(p => p.name),
      // nhãn chân nguồn theo tên in trên board (Uno "3.3V", Pico "VBUS" là 5 V từ USB)
      alias: (pw => ({ "3V3": (pw.find(n => /^3.?3V?$|^3V3/.test(n)) || "3V3"), "5V": (pw.find(n => n === "5V") || pw.find(n => /VBUS|VIN/.test(n)) || "5V") }))(ps.filter(p => p.cat === "power").map(p => p.name))
    };
  }
  const isSig = n => !!n && !PWR.has(n) && hostInfo().pins.has(n);
  let STUDIO = !!window.PCB_STUDIO;
  const storeKey = () => STUDIO ? "pcb-studio:v1" : "pcb-proto:v2";
  const fresh = (mcu = S3ID) => STUDIO ? ({
    v: 2, noBoard: true, board: { w: 60, h: 45 }, mcu: "",
    comps: [],
    traces: [], jumpers: [], alpha: 1, uid: 1, scheme: 1, posture: 0, rats: true, width: null
  }) : ({
    v: 2, board: { w: 120, h: 78 }, mcu,
    comps: [mcu === S3ID ? { id: "U1", fp: "S3", x: 3 * G, y: 4 * G, rot: 0 } : FULL.has(mcu) && SITE ? { id: "U1", fp: "BRD:" + mcu, x: 3 * G, y: 4 * G, rot: 0 } : { id: "J1", fp: "HDR:GND", x: 3 * G, y: 4 * G, rot: 0 }],
    traces: [], jumpers: [], alpha: 1, uid: 1, scheme: 1, posture: 0, rats: true, width: null
  });
  let S;
  try { S = JSON.parse(localStorage.getItem(storeKey()) || "null"); } catch (e) { S = null; }
  if (!S || S.v !== 2) S = fresh();
  S.mcu = S.mcu || S3ID;   // bản lưu cũ: chỉ có ESP32-S3
  S.jumpers = (S.jumpers || []).filter(j => !j.ext);   // bản lưu cũ: bỏ dây có vỏ bọc, chỉ còn dây nhảy trần
  S.autoRe = false;   // Auto now (tự đi lại khi dời / thêm / xoá linh kiện): mỗi lần mở đều tắt, người dùng tự bật khi cần
  /* ---------- "Linh kiện của tôi": linh kiện Fritzing người dùng đã thêm ở tab Pinworld (lưu trong trình duyệt) ---------- */
  // Mỗi linh kiện: chân (tên, vị trí mm, vai trò đoán + độ tin cậy), thân, hình ký hiệu, nguồn + giấy phép CC BY-SA 3.0. Footprint đăng ký dưới khoá "MY:<id>".
  const MYKEY = "pindexio-myparts", MYDEF = {}; let MYIDS = [];
  const attr = s => String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  function validMine(p) {
    const num = v => typeof v === "number" && isFinite(v) && Math.abs(v) < 1000;
    return !!(p && typeof p.id === "string" && /^[a-z0-9-]{3,40}$/.test(p.id) && typeof p.title === "string" && p.title.length < 120 && Array.isArray(p.pads) && p.pads.length >= 2 && p.pads.length <= 300
      && p.pads.every(q => q && typeof q.name === "string" && q.name.length <= 16 && num(q.x) && num(q.y) && ["g", "d", "c", "k", "m", "s", "n"].includes(q.role) && num(q.conf))
      && p.body && num(p.body.x) && num(p.body.y) && num(p.body.w) && num(p.body.h) && p.body.w > 0 && p.body.h > 0
      && typeof p.icon === "string" && (p.icon.startsWith("data:image/svg+xml") || p.icon.startsWith("https://cdn.jsdelivr.net/gh/fritzing/"))
      && (p.art === "" || (typeof p.art === "string" && p.art.startsWith("data:image/svg+xml")))
      && (p.bbm == null || (Array.isArray(p.bbm.vb) && p.bbm.vb.length === 4 && p.bbm.vb.every(num) && num(p.bbm.w) && num(p.bbm.h) && Array.isArray(p.bbm.pins) && p.bbm.pins.length <= 300 && p.bbm.pins.every(q => Array.isArray(q) && typeof q[0] === "string" && num(q[1]) && num(q[2]))))
      && (p.bb == null || (num(p.bb.x) && num(p.bb.y) && num(p.bb.w) && num(p.bb.h) && num(p.bb.s) && [0, 90, 180, 270].includes(p.bb.rot))));
  }
  function registerDef(p) {
    if (!validMine(p)) return false;
    MYDEF[p.id] = p;
    FP0["MY:" + p.id] = { pads: p.pads.map(q => ({ name: q.name, x: q.x, y: q.y, role: q.role, conf: q.conf, ...(q.r >= .1 && q.r <= 10 ? { r: q.r } : {}), ...(q.drill >= .1 && q.drill <= 10 ? { drill: q.drill } : {}), ...(q.w > 0 && q.w < 30 && q.h > 0 && q.h < 30 ? { w: q.w, h: q.h } : {}), ...(q.smd ? { smd: true } : {}), ...(q.sq ? { sq: true } : {}) })), body: p.body, label: "", mine: true, art: p.art || "", icon: p.icon, bb: p.bb || null, verified: !!p.verified, lic: p.license || "CC BY-SA 3.0", url: p.url || "", title: p.title };
    NAMES["MY:" + p.id] = [p.title, p.title, p.title.length > 18 ? p.title.slice(0, 17) + "…" : p.title];
    return true;
  }
  const myLib = () => { try { const o = JSON.parse(localStorage.getItem(MYKEY) || "null"); return o && o.parts ? o : { version: 1, parts: {} }; } catch (e) { return { version: 1, parts: {} }; } };
  const myPut = o => { try { localStorage.setItem(MYKEY, JSON.stringify(o)); if (window.APP && APP.libChanged) APP.libChanged(); } catch (e) { } };
  function loadMine() {   // đọc lại danh sách (Pinworld có thể vừa thêm)
    MYIDS = [];
    for (const id in myLib().parts) if (registerDef(myLib().parts[id])) MYIDS.push("MY:" + id);
  }
  const usedDefs = () => [...new Set(S.comps.filter(c => c.fp.startsWith("MY:")).map(c => c.fp.slice(3)))].map(id => MYDEF[id]).filter(Boolean);


  // Lưu linh kiện đang chọn vào "Linh kiện của tôi". asNew = false: ghi đè bản của tôi (nếu là linh kiện dựng sẵn thì tạo bản mới); asNew = true: luôn tạo bản mới, hỏi tên.
  function savePart(asNew) {
    const c = ui.sel && ui.sel.t === "c" ? S.comps.find(x => x.id === ui.sel.id) : null;
    if (!c || !FP[c.fp]) return toast(L("Chọn một linh kiện trên bo trước.", "Select a part on the board first."));
    const f = FP[c.fp], o = myLib(), src = f.mine ? o.parts[c.fp.slice(3)] : null;
    if (src && !asNew) { o.parts[src.id] = src; myPut(o); registerDef(src); list(); return toast(L("Đã lưu: ", "Saved: ") + src.title); }
    const base = src ? src.title : (NAME[c.fp] || c.fp), nm = (window.prompt(L("Tên linh kiện mới:", "New part name:"), src ? base + L(" (bản sửa)", " (edited)") : base) || "").trim().slice(0, 100);
    if (!nm) return;
    if (Object.keys(o.parts).length >= 60) return toast(L("Tối đa 60 linh kiện của tôi.", "Up to 60 My parts."));
    let id = (nm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "part") + "-" + Math.random().toString(36).slice(2, 8);
    const part = src ? { ...JSON.parse(JSON.stringify(src)), id, title: nm, verified: false }
      : { id, title: nm, src: "Pindexio", license: "", url: "", verified: false, icon: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><rect width='10' height='10' fill='#1e5a3c'/></svg>"), art: "",
        pads: f.pads.map(p => ({ name: String(p.name).slice(0, 16), x: r3(p.x), y: r3(p.y), role: "n", conf: 0, ...(p.r ? { r: p.r } : {}), ...(p.drill ? { drill: p.drill } : {}), ...(p.w && p.h ? { w: p.w, h: p.h } : {}), ...(p.smd ? { smd: true } : {}), ...(p.sq ? { sq: true } : {}) })),
        body: { x: f.body.x, y: f.body.y, w: f.body.w, h: f.body.h } };
    if (!validMine(part) || !registerDef(part)) return toast(L("Không lưu được linh kiện này.", "Cannot save this part."));
    o.parts[id] = part; myPut(o); loadMine(); list(); toast(L("Đã lưu thành: ", "Saved as: ") + nm);
  }
  // Sửa linh kiện Pinworld đã nhập: tên chân, vị trí (mm so với góc linh kiện), cỡ pad, lỗ khoan, khung thân. Lưu đè thẳng; sai thì xoá và tải lại từ Pinworld.
  const ORIG = {};   // bản gốc của linh kiện đã sửa trong phiên này (để hoàn tác)
  function syncEdits() {   // sau Undo / Redo: đưa linh kiện về đúng phiên bản của bước đó
    const o = myLib(); let ch = false;
    for (const id in ORIG) { const want = (S.pe && S.pe[id]) || ORIG[id]; if (JSON.stringify(o.parts[id]) !== JSON.stringify(want)) { o.parts[id] = want; registerDef(want); ch = true; } }
    if (ch) myPut(o);
  }
  function editMine(fp) {
    const id = fp.slice(3), o = myLib(), part = o.parts[id]; if (!part) return;
    const old = ROOT.querySelector("#plEditMineBox"); if (old) old.remove();
    const m = document.createElement("div"); m.id = "plEditMineBox"; m.className = "pl-pop";
    const bx = Math.min(part.body.x, ...part.pads.map(q => q.x - (q.r || 1))), by = Math.min(part.body.y, ...part.pads.map(q => q.y - (q.r || 1))), mx = r3(bx), my = r3(by);   // góc trên-trái = (0,0)
    const IN = S.unit === "in", U = IN ? 25.4 : 1, cv = v => v === "" ? "" : Math.round(v / U * 10000) / 10000, un = IN ? "in" : "mm";
    const num = (v, w = 58) => `<input type="number" step="${IN ? 0.005 : 0.01}" value="${cv(v)}" style="width:${w}px;text-align:right">`;
    const row = (q, i) => `<tr data-i="${i}"><td><input value="${attr(q.name)}" maxlength="16" style="width:62px"></td><td>${num(r3(q.x - mx))}</td><td>${num(r3(q.y - my))}</td><td>${num(q.r ? r3(q.r * 2) : "", 52)}</td><td>${num(q.drill || "", 52)}</td><td><button type="button" data-del title="${L("Xoá chân", "Delete pin")}">✕</button></td></tr>`;
    m.innerHTML = `<div id="emHd" title="${L("Kéo để dời hộp", "Drag to move")}" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move;user-select:none"><b>⠿ ✎ ${attr(part.title)}</b><button type="button" id="emX">✕</button></div>
      <div style="max-height:46vh;overflow:auto"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th>${L("Chân", "Pin")}</th><th>X (${un})</th><th>Y (${un})</th><th>Ø pad (${un})</th><th>Ø lỗ (${un})</th><th></th></tr></thead><tbody>${part.pads.map(row).join("")}</tbody></table></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px;font-size:12px"><span style="grid-column:1/-1">${L("Khung thân", "Body")} (${un})</span>${["x", "y", "w", "h"].map(k => `<label>${k}<input data-b="${k}" type="number" step="${IN ? 0.01 : 0.1}" value="${cv(r3(part.body[k] - (k === "x" ? mx : k === "y" ? my : 0)))}" style="width:100%"></label>`).join("")}</div>
      <div style="display:flex;gap:6px;margin-top:8px"><button type="button" id="emOk" class="tb primary" style="flex:1">${L("Lưu", "Save")}</button></div>`;
    m.style.cssText = "position:fixed;right:310px;top:96px;width:min(470px,94vw);z-index:60;padding:10px;box-shadow:0 8px 28px rgba(0,0,0,.4)";
    ROOT.appendChild(m);
    const f = x => parseFloat(x);
    const collect = () => {
      const rows = [...m.querySelectorAll("tbody tr")], pads = [];
      for (const tr of rows) {
        const [n, x, y, d, h] = [...tr.querySelectorAll("input")].map(i => i.value), q0 = part.pads[+tr.dataset.i], q = { ...q0, name: String(n).trim().slice(0, 16) || q0.name, x: r3((f(x) || 0) * U + mx), y: r3((f(y) || 0) * U + my) };
        const dd = f(d) * U, hh = f(h) * U; if (dd >= 0.2 && dd <= 20) q.r = r3(dd / 2); else delete q.r; if (hh >= 0.2 && hh <= 20) q.drill = r3(hh); else delete q.drill;
        pads.push(q);
      }
      const body = {}; for (const k of ["x", "y", "w", "h"]) body[k] = f(m.querySelector('[data-b="' + k + '"]').value) * U + (k === "x" ? mx : k === "y" ? my : 0);
      return { pads, body };
    };
    const prev = () => { const c = collect(), np = { ...part, pads: c.pads, body: c.body }; if (c.pads.length >= 2 && validMine(np)) { registerDef(np); render(); } };   // xem trước ngay trên bo (chưa lưu)
    const shut = () => { m.remove(); registerDef(part); render(); };
    m.addEventListener("input", prev);
    m.querySelector("#emX").onclick = shut;
    m.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { b.closest("tr").remove(); prev(); });
    const hd = m.querySelector("#emHd");
    hd.onpointerdown = e => {
      if (e.target.closest("button")) return; e.preventDefault();
      const r = m.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      m.style.right = "auto"; m.style.left = r.left + "px"; m.style.top = r.top + "px"; try { hd.setPointerCapture(e.pointerId); } catch (_) { }
      hd.onpointermove = ev => { m.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + "px"; m.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + "px"; };
      hd.onpointerup = () => { hd.onpointermove = hd.onpointerup = null; };
    };
    m.querySelector("#emOk").onclick = () => {
      const { pads, body } = collect();
      if (pads.length < 2 || !(body.w > 0 && body.h > 0) || [body.x, body.y].some(v => !isFinite(v))) return toast(L("Cần ≥ 2 chân và khung thân hợp lệ.", "Needs ≥ 2 pins and a valid body."));
      const nx = Math.min(body.x, ...pads.map(q => q.x - (q.r || 1))), ny = Math.min(body.y, ...pads.map(q => q.y - (q.r || 1)));
      pads.forEach(q => { q.x = r3(q.x - nx); q.y = r3(q.y - ny); }); body.x = r3(body.x - nx); body.y = r3(body.y - ny);
      checkpoint(); for (const c of S.comps) if (c.fp === fp) { const [ox, oy] = rot(nx, ny, c.rot || 0); c.x = r3(c.x + ox); c.y = r3(c.y + oy); }
      const np = { ...part, pads, body }; if (np.bb) np.bb = { ...np.bb, x: r3(np.bb.x - nx), y: r3(np.bb.y - ny) };   // ảnh màu dời cùng gốc toạ độ, không bị lệch khỏi chân
      if (!validMine(np)) return toast(L("Dữ liệu không hợp lệ.", "Invalid data."));
      if (!ORIG[id]) ORIG[id] = JSON.parse(JSON.stringify(part)); S.pe = { ...(S.pe || {}), [id]: JSON.parse(JSON.stringify(np)) };
      o.parts[id] = np; myPut(o); registerDef(np); m.remove(); list(); render(); toast(L("Đã lưu linh kiện.", "Part saved."));
    };
  }
  function toggleVerified(fp) {
    const id = fp.slice(3), o = myLib(), v = !FP0[fp].verified;
    if (o.parts[id]) { o.parts[id].verified = v; myPut(o); } FP0[fp].verified = v; if (MYDEF[id]) MYDEF[id].verified = v; render();
  }
  const mineBox = f => !f.mine ? "" : `<div class="pw-c ${f.verified ? "ok" : ""}">${f.verified ? "✓ " + L("Đã kiểm.", "Checked.") : "⚠ " + L("Fritzing, chưa kiểm: đối chiếu datasheet.", "Fritzing, unchecked: compare with the datasheet.")}
    <br><small>${attr(f.lic)} · <a href="${attr(f.url)}" target="_blank" rel="noopener">${L("nguồn Fritzing", "Fritzing source")}</a></small><br><button type="button" id="plEditMine">✎ ${L("Sửa chân / kích thước", "Edit pins / size")}</button> <button type="button" id="plVerMine">${f.verified ? L("Bỏ đánh dấu đã kiểm", "Unmark as checked") : L("Đánh dấu đã kiểm", "Mark as checked")}</button></div>`;
  // chân tự nối (vai trò đoán, tin cậy ≥ 50%) chờ người dùng xác nhận: tô cam trên bo, liệt kê ở bảng bên phải
  function pendingAuto() { const out = []; for (const c of S.comps) if (c.auto) for (const k in c.auto) out.push({ c, pin: k, net: c.auto[k].net, conf: c.auto[k].conf }); return out; }
  function pendBox() {
    const ps = pendingAuto(); if (!ps.length) return "";
    return `<div class="box warn"><h4>${L(`Cần kiểm tra: ${ps.length} chân tự nối`, `Please review: ${ps.length} auto-wired pins`)}</h4>
      <div class="pend">${ps.map(v => { const key = attr(v.c.id + "|" + v.pin); return `<div><button type="button" class="pgo" data-pgo="${key}">⚠ ${attr(v.c.id)} · ${attr(v.pin)} → ${attr(v.net)} (${Math.round(v.conf * 100)}%)</button><button type="button" data-pok="${key}" title="${L("Xác nhận", "Confirm")}">✓</button><button type="button" data-pno="${key}" title="${L("Bỏ nối", "Unwire")}">✕</button></div>`; }).join("")}</div>
      <div class="pdi-b"><button type="button" id="plPendAll">${L("Xác nhận tất cả", "Confirm all")}</button></div></div>`;
  }
  try { for (const p of JSON.parse(localStorage.getItem("pcb-proto:defs") || "[]")) registerDef(p); } catch (e) { }   // linh kiện Fritzing đã dùng trong bo tự lưu: có sẵn dù kho đã bị xoá
  loadMine();
  const save = () => { try { localStorage.setItem(storeKey(), JSON.stringify(S)); localStorage.setItem("pcb-proto:defs", JSON.stringify(usedDefs())); } catch (e) { } };
  const undo = [], redo = [];
  const checkpoint = () => { undo.push(JSON.stringify(S)); if (undo.length > 100) undo.shift(); redo.length = 0; };
  const pushRaw = s => { undo.push(s); redo.length = 0; };

  /* ---------- hình học ---------- */
  const rot = (x, y, r) => r === 90 ? [-y, x] : r === 180 ? [-x, -y] : r === 270 ? [y, -x] : [x, y];
  // mạng của chân: module lưu theo tên chân (c.nets); chân ESP32-S3 mang tên chính nó khi có module nối tới (IO5 …)
  const usedNets = () => { const s = new Set(); for (const c of S.comps) for (const k in c.nets || {}) if (c.nets[k]) s.add(c.nets[k]); return s; };
  const netOf = (c, name, used) => isHost(c) ? (PWR.has(name) || used.has(name) ? name : null) : (c.nets && c.nets[name]) || null;
  const NOAUTO = new Set(["button12", "term2_508", "term3_508", "dip8", "to220", "smd_2512", "lm358", "lm393", "ir2104", "lm7805", "lm317", "irf3205", "irlz44n", "lm35", "pinHdr", "tb6612fng", "motor", "R", "C", "ecap5", "ecap6", "ecap8", "to92", "irfz44n", "irf540n", "irf520"]);   // người dùng tự nối
  function autoNets(fp) {   // nối sẵn khi thêm: nguồn, bus I2C / SPI, tín hiệu vào GPIO trống
    if (NOAUTO.has(fp) || (FP[fp] && FP[fp].mine)) { const z = {}; for (const p of FP[fp].pads) z[p.name] = null; return z; }
    const s3 = S.comps.some(isHost), H = hostInfo(), used = usedNets(), out = {};
    for (const p of FP[fp].pads) {
      if (p.name in out) continue;
      const role = FP[fp].mine && !(p.conf >= .5) ? "n" : p.role;   // linh kiện Fritzing: chỉ tự nối khi tin cậy ≥ 50%
      let n = { g: "GND", 3: "3V3", 5: "5V" }[role] || null;
      if (!n && s3 && H.bus[role]) n = H.bus[p.role];
      if (!n && s3 && role === "s") { n = H.pref.find(x => !used.has(x)) || null; if (n) used.add(n); }
      out[p.name] = n;
    }
    const drv = S.comps.find(c => c.fp === "tb6612fng");
    if (fp === "servo" && drv && drv.nets && drv.nets.VM) out.VCC = drv.nets.VM;   // servo lấy nguồn chung nguồn motor của driver
    if (fp === "motor" && drv) {   // nối vào kênh A, hết thì kênh B (mạng riêng MA1 / MA2…)
      drv.nets = drv.nets || {};
      const ch = [["A01", "A02"], ["B01", "B02"]].find(([a, b]) => !drv.nets[a] && !drv.nets[b]);
      if (ch) { const k = ch[0][0]; drv.nets[ch[0]] = "M" + k + "1"; drv.nets[ch[1]] = "M" + k + "2"; out["M+"] = drv.nets[ch[0]]; out["M-"] = drv.nets[ch[1]]; }
    }
    return out;
  }
  function pads() {
    const out = [], used = usedNets();
    for (const c of S.comps) FP[c.fp].pads.forEach((p, i) => { const [x, y] = rot(p.x, p.y, c.rot); const nm = (c.pinNames && c.pinNames[i]) || p.name; const r90 = Math.abs(((c.rot || 0) % 180) + 180) % 180 === 90; const pw = p.w ? (r90 ? p.h : p.w) : 0, ph = p.h ? (r90 ? p.w : p.h) : 0; out.push({ c, i, name: nm, net: netOf(c, nm, used), x: r3(c.x + x), y: r3(c.y + y), sq: p.sq !== undefined ? !!p.sq : i === 0, ...(pw && ph ? { pw, ph, r: Math.max(pw, ph) / 2 } : p.r ? { r: p.r } : {}), ...(p.smd ? { smd: true } : {}), ...(p.drill ? { drill: p.drill } : {}) }); });
    // 2 lỗ của dây nhảy cũng là chân (nhỏ hơn)
    for (const j of S.jumpers) { const o = j.o || {}, rc = o.shape === "rect"; [j.a, j.b].forEach((e, i) => out.push({ c: { id: "W" + j.id }, jw: j, i, name: i ? "B" : "A", net: j.net, x: e[0], y: e[1], sq: o.shape === "square", r: rc ? Math.max(o.w, o.h) / 2 : (o.r || JP_R), ...(rc ? { pw: o.w, ph: o.h } : {}), ...(o.hole === 0 ? { smd: true } : o.drill ? { drill: o.drill } : {}) })); }
    for (const h of S.holes || []) out.push({ c: { id: "H" + h.id }, hole: h, i: 0, name: "H", net: h.net, x: h.x, y: h.y, sq: h.shape === "square", r: h.pad ? (h.r || PAD_R) : JP_R });   // lỗ đơn của dây tự do
    return out;
  }
  // mạng trống "~n": dây vẽ tự do chưa chạm chân nào; nối vào mạng thật thì nhận tên mạng đó
  const isFree = n => typeof n === "string" && n[0] === "~";
  function adopt(from, to) {
    for (const c of S.comps) if (c.nets) for (const k in c.nets) if (c.nets[k] === from) c.nets[k] = to;
    for (const x of [...S.traces, ...S.jumpers, ...(S.holes || [])]) if (x.net === from) x.net = to;
  }
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
    S.holes = S.holes.filter(h => h.pad || on(h));
  }
  const SN = G / 2; const gridStep = () => S.gridStep || (STUDIO ? SN : G); const snapStep = () => gridStep();   // lưới khi vẽ đường / dây nhảy (1,27 mm): bớt nhạy hơn lưới 0,635
  const netW = n => (S.netW && +S.netW[n]) || (PWR.has(n) ? W_PWR : W_SIG); const traceW = t => t.w || netW(t.net);
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
  const POUR_CLRS = [.5, .8, 1, 1.5, 2];   // khe mass chuẩn (mm), chọn ở bảng bên phải; mặc định 1 mm cho bo làm tại nhà
  /* ---------- Hình dạng bo: chữ nhật (mặc định) hoặc đa giác có lỗ (sau khi dùng Cưa) ---------- */
  // S.board = { w, h } là khung bao; thêm poly (vòng ngoài) + holes (các lỗ khoét) khi bo không còn chữ nhật.
  const outlineOf = () => { const B = S.board; return B.poly ? { outer: B.poly, holes: B.holes || [] } : { outer: [[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]], holes: [] }; };
  const outlineD = () => { const o = outlineOf(); return [o.outer, ...o.holes].map(r => "M" + r.map(p => p.join(" ")).join(" L") + "Z").join(" "); };
  let _bdKey = null, _bdEdges = null;
  function bdEdges() {
    const B = S.board, k = B.poly ? JSON.stringify([B.poly, B.holes]) : null;
    if (k !== _bdKey || !_bdEdges) { _bdKey = k; const o = outlineOf(), e = []; for (const ring of [o.outer, ...o.holes]) for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; e.push([a[0], a[1], b[0], b[1]]); } _bdEdges = { e, o }; }
    return _bdEdges;
  }
  const inRing = (ring, x, y) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  function bd(x, y) {   // khoảng cách có dấu tới mép bo: dương = trong bo, âm = ngoài bo
    const B = S.board; if (!B.poly) return Math.min(x, y, B.w - x, B.h - y);
    const { e, o } = bdEdges(); let d = 1e9;
    for (const [ax, ay, bx, by] of e) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0, q = Math.hypot(x - ax - t * dx, y - ay - t * dy); if (q < d) d = q; }
    return inRing(o.outer, x, y) && !o.holes.some(h => inRing(h, x, y)) ? d : -d;
  }
  const mountHoles = () => { if (STUDIO) return []; const B = S.board; return [[3.5, 3.5], [B.w - 3.5, 3.5], [3.5, B.h - 3.5], [B.w - 3.5, B.h - 3.5]].filter(([x, y]) => bd(x, y) >= 2.5); };   // lỗ bắt vít chỉ giữ chỗ còn nằm trong bo
  const PC = Q / 2, POUR_CLR = 1, POUR_EDGE = 1.5, SPOKE = .8, GND = "GND";
  let pourCache = { key: null };
  function pour() {
    const clearArt = S.pourArt !== false;
    const key = JSON.stringify([S.comps, S.traces, S.jumpers, S.board, S.pourClr, S.pourIsl, clearArt, clearArt ? S.art : null]), CLRP = S.pourClr ?? POUR_CLR;
    if (pourCache.key === key) return pourCache;
    const B = S.board, nx = Math.round(B.w / PC) + 1, ny = Math.round(B.h / PC) + 1, F = new Float32Array(nx * ny), P = pads(), CAP = 2 * PC;
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) { const x = gx * PC, y = gy * PC; F[gy * nx + gx] = Math.min(CAP, bd(x, y) - POUR_EDGE); }
    // vật cản: F = min(F, fn) trong khung bao (ngoài khung fn > CAP nên không đổi)
    const win = (x0, y0, x1, y1, fn) => { for (let gy = Math.max(0, Math.floor(y0 / PC)); gy <= Math.min(ny - 1, Math.ceil(y1 / PC)); gy++) for (let gx = Math.max(0, Math.floor(x0 / PC)); gx <= Math.min(nx - 1, Math.ceil(x1 / PC)); gx++) { const i = gy * nx + gx, v = fn(gx * PC, gy * PC); if (v < F[i]) F[i] = v; } };
    for (const [x0, y0] of mountHoles()) { const r = 1.6 + CLRP, R = r + CAP; win(x0 - R, y0 - R, x0 + R, y0 + R, (x, y) => Math.hypot(x - x0, y - y0) - r); }
    for (const p of P) {
      const r = (p.r || PAD_R) + CLRP, R = r + CAP;
      // chân GND: vòng cách ly có 4 nan (dải ngang / dọc rộng SPOKE) nối pad ra mass
      win(p.x - R, p.y - R, p.x + R, p.y + R, p.net === GND ? (x, y) => Math.max(Math.hypot(x - p.x, y - p.y) - r, SPOKE / 2 - Math.min(Math.abs(x - p.x), Math.abs(y - p.y))) : (x, y) => Math.hypot(x - p.x, y - p.y) - r);
    }
    for (const t of S.traces) if (t.net !== GND) { const r = traceW(t) / 2 + CLRP, R = r + CAP; for (let k = 0; k < t.pts.length - 1; k++) { const [a, b] = [t.pts[k], t.pts[k + 1]]; win(Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) - r); } }
    // né chữ & hình vẽ Pen trên lớp đồng (copper)
    if (clearArt && Array.isArray(S.art)) {
      for (const it of S.art) {
        const ly = LYR(it.layer);
        if (!ly || ly.kind !== "cu") continue;
        const w = (it.w || .3) / 2 + CLRP, R = w + CAP;
        for (const pa of it.paths) {
          if (!pa.pts || !pa.pts.length) continue;
          if (it.fill && pa.closed && pa.pts.length > 2) {
            let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
            for (const [x, y] of pa.pts) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
            win(bx0 - R, by0 - R, bx1 + R, by1 + R, (x, y) => {
              let ins = false;
              for (let i = 0, j = pa.pts.length - 1; i < pa.pts.length; j = i++) {
                const [xi, yi] = pa.pts[i], [xj, yj] = pa.pts[j];
                if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
              }
              if (ins) return -CLRP;
              let minD = 1e9;
              for (let i = 0; i < pa.pts.length; i++) {
                const a = pa.pts[i], b = pa.pts[(i + 1) % pa.pts.length];
                minD = Math.min(minD, segDist(x, y, a[0], a[1], b[0], b[1]));
              }
              return minD - w;
            });
          } else {
            for (let k = 0; k < (pa.closed ? pa.pts.length : pa.pts.length - 1); k++) {
              const a = pa.pts[k], b = pa.pts[(k + 1) % pa.pts.length];
              win(Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) - w);
            }
          }
        }
      }
    }
    // vùng liền nhau (đánh nhãn nút F > 0), rồi giữ những vùng chạm vật GND (chồng lên pad GND / đường GND)
    const lab = new Int32Array(nx * ny).fill(-1); let nl = 0;
    for (let s = 0; s < lab.length; s++) if (F[s] > 0 && lab[s] < 0) { const st = [s]; lab[s] = nl; while (st.length) { const c = st.pop(), x = c % nx, y = (c - x) / nx; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x2 = x + dx, y2 = y + dy, c2 = y2 * nx + x2; if (x2 >= 0 && y2 >= 0 && x2 < nx && y2 < ny && F[c2] > 0 && lab[c2] < 0) { lab[c2] = nl; st.push(c2); } } } nl++; }
    const touch = (x0, y0, x1, y1, fn) => { const out = new Set(); for (let gy = Math.max(0, Math.floor(y0 / PC)); gy <= Math.min(ny - 1, Math.ceil(y1 / PC)); gy++) for (let gx = Math.max(0, Math.floor(x0 / PC)); gx <= Math.min(nx - 1, Math.ceil(x1 / PC)); gx++) { const c = gy * nx + gx; if (lab[c] >= 0 && fn(gx * PC, gy * PC)) out.add(lab[c]); } return out; };
    const items = [];
    P.forEach((p, i) => { if (p.net === GND) { const r = (p.r || PAD_R) - .05; items.push(["p" + i, touch(p.x - r, p.y - r, p.x + r, p.y + r, (x, y) => Math.hypot(x - p.x, y - p.y) < r)]); } });
    for (const t of S.traces) if (t.net === GND) { const r = traceW(t) / 2 - .05; const s = new Set(); for (let k = 0; k < t.pts.length - 1; k++) { const [a, b] = [t.pts[k], t.pts[k + 1]]; for (const l of touch(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) < r)) s.add(l); } items.push(["t" + t.id, s]); }
    const keep = new Set(), groups = [];
    for (let l = 0; l < nl; l++) { const g = items.filter(it => it[1].has(l)).map(it => it[0]); if (g.length) { keep.add(l); groups.push(g); } }
    if (S.pourIsl) for (let l = 0; l < nl; l++) keep.add(l);   // phủ cả vùng không nối GND (đồng trống, không thuộc mạng nào)
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
    const clr = STUDIO ? 0.15 : CLR;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      for (let j = i + 1; j < segs.length; j++) { const u = segs[j]; if (u.t.net === s.t.net) continue; const d = segSeg(s.a, s.b, u.a, u.b); if (d < (s.w + u.w) / 2 + clr - 1e-6) bad.push({ s, u, x: (s.a[0] + s.b[0] + u.a[0] + u.b[0]) / 4, y: (s.a[1] + s.b[1] + u.a[1] + u.b[1]) / 4, msg: d < (s.w + u.w) / 2 ? L("chập", "short") : L("quá sát", "too close") }); }
      for (const p of P) { if (p.net === s.t.net) continue; const d = segDist(p.x, p.y, s.a[0], s.a[1], s.b[0], s.b[1]); const pr = p.r || PAD_R; if (d < pr + s.w / 2 + clr - 1e-6) bad.push({ s, pad: p, x: p.x, y: p.y, msg: d < pr + s.w / 2 ? L("chạm chân", "touches pin") : L("sát chân", "too close to pin") }); }
      for (const [x, y] of [s.a, s.b]) if (bd(x, y) < EDGE) bad.push({ s, x, y, msg: L("sát mép bo", "too close to board edge") });
    }
    // chân / lỗ quá sát nhau. Lỗ dây nhảy phải cách mọi chân (kể cả cùng mạng) để khoan tay không rách đồng
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const p = P[i], q = P[j], hole = p.jw || q.jw;
      if (p.jw && p.jw === q.jw) continue;
      if (p.c === q.c || (p.net && p.net === q.net)) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) < (p.r || PAD_R) + (q.r || PAD_R) + (hole ? .2 : clr) - 1e-6) bad.push({ pad: hole ? (p.jw ? q : p) : q, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, msg: hole ? L("lỗ dây nhảy sát chân", "jumper hole too close to pin") : L("chân sát chân", "pins too close") });
    }
    for (const j of S.jumpers) {
      if (Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) < jMinOf(j) - 1e-6) bad.push({ x: (j.a[0] + j.b[0]) / 2, y: (j.a[1] + j.b[1]) / 2, msg: L("dây nhảy ngắn quá (< 2,54 mm)", "jumper too short (< 2.54 mm)") });
      for (const p of P) if (p.jw !== j && p.net !== j.net && segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < (p.r || PAD_R) + JP_OVER) bad.push({ pad: p, x: p.x, y: p.y, msg: L("dây nhảy đè lên chân", "jumper passes over a pin") });
    }
    for (let i = 0; i < S.jumpers.length; i++) for (let k = i + 1; k < S.jumpers.length; k++) {
      const j = S.jumpers[i], o = S.jumpers[k];
      if (j.net !== o.net && segSeg(j.a, j.b, o.a, o.b) < CLR - 1e-6) bad.push({ x: (j.a[0] + j.b[0] + o.a[0] + o.b[0]) / 4, y: (j.a[1] + j.b[1] + o.a[1] + o.b[1]) / 4, msg: L("dây nhảy cắt / chạm nhau", "jumpers cross or touch") });
    }
    // khung bo thu nhỏ: chân nằm ngoài / sát mép
    for (const p of P) { const r = p.r || PAD_R; if (bd(p.x, p.y) - r < EDGE) bad.push({ pad: p, x: p.x, y: p.y, msg: L("chân ra ngoài mép bo", "pin outside the board edge") }); }
    return bad;
  }
  // chỗ đặt lỗ dây nhảy: trong mép bo, cách mọi chân / lỗ ≥ CLR (mép–mép), cách đồng khác mạng ≥ CLR
  // lỗ dây nhảy cách mối hàn chân linh kiện thêm HOLE_GAP mm để mỏ hàn dễ vào, không dính thiếc sang chân
  const HOLE_GAP = .2;   // khoảng thêm quanh chân khi đặt lỗ dây nhảy (trước 0,5 mm: hơi rộng)
  function holeOK(x, y, net, P, manual) {
    if (bd(x, y) < EDGE + JP_R) return false;
    for (const p of P) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (manual && p.net && p.net === net) { if (d > .08 && d < (p.r || PAD_R) + .1) return false; }
      else if (d < (p.r || PAD_R) + (manual ? .2 : CLR) + JP_R + (manual || p.jw || p.hole ? 0 : HOLE_GAP)) return false;
    }
    // không nằm dưới thân dây nhảy khác mạng (dây trần mặt trên sẽ chạm mối hàn của lỗ này)
    for (const j of S.jumpers) if (j.net !== net && segDist(x, y, j.a[0], j.a[1], j.b[0], j.b[1]) < JP_R + JP_OVER) return false;
    for (const t of S.traces) if (t.net !== net) for (let k = 0; k < t.pts.length - 1; k++) if (segDist(x, y, t.pts[k][0], t.pts[k][1], t.pts[k + 1][0], t.pts[k + 1][1]) < traceW(t) / 2 + CLR + JP_R - (manual ? .15 : 0)) return false;
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
    S.traces = S.traces.filter(t => t.lock || (RT.only && !RT.only.has(t.net))); S.jumpers = S.jumpers.filter(j => !j.auto || (RT.only && !RT.only.has(j.net)));
    const pw = S.pour; if (gndAsNet) S.pour = false; analyze(); S.pour = pw;
    const nx = Math.floor(S.board.w / Q) + 1, ny = Math.floor(S.board.h / Q) + 1, P = A.P;
    const len = r => Math.hypot(r.a.x - r.b.x, r.a.y - r.b.y), pr = r => prio && prio.has(ratKey(r)) ? 0 : 1;
    const cx = new Map(A.rats.map(r => [r, A.rats.reduce((n, o) => n + (o.net !== r.net && segSeg([r.a.x, r.a.y], [r.b.x, r.b.y], [o.a.x, o.a.y], [o.b.x, o.b.y]) === 0 ? 1 : 0), 0)]));
    const edges = A.rats.filter(r => !RT.only || RT.only.has(r.net)).sort((a, b) => (pr(a) - pr(b)) || (ord === "mps" ? cx.get(a) - cx.get(b) : PWR.has(a.net) - PWR.has(b.net)) || (len(a) - len(b)));
    const holes = () => S.jumpers.flatMap(j => [{ x: j.a[0], y: j.a[1], r: JP_R, net: j.net, jw: j }, { x: j.b[0], y: j.b[1], r: JP_R, net: j.net, jw: j }]);
    let pend = new Map();
    const RZ = PAD_R + CLR + JP_R + 1.5 * Q;
    const SP = S.spread ?? SPREAD0;
    const grids = (e, w, gap = PIN_GAP, withHoles = false) => {
      const block = new Uint8Array(nx * ny), soft = new Uint8Array(nx * ny), near = new Float32Array(nx * ny);
      const mark = (g, x0, y0, x1, y1, fn) => { for (let gy = Math.max(0, Math.floor(y0 / Q)); gy <= Math.min(ny - 1, Math.ceil(y1 / Q)); gy++) for (let gx = Math.max(0, Math.floor(x0 / Q)); gx <= Math.min(nx - 1, Math.ceil(x1 / Q)); gx++) if (fn(gx * Q, gy * Q)) g[gy * nx + gx] = 1; };
      const addNear = (x0, y0, x1, y1, r, R, distFn, wgt) => { for (let gy = Math.max(0, Math.floor(y0 / Q)); gy <= Math.min(ny - 1, Math.ceil(y1 / Q)); gy++) for (let gx = Math.max(0, Math.floor(x0 / Q)); gx <= Math.min(nx - 1, Math.ceil(x1 / Q)); gx++) { const d = distFn(gx * Q, gy * Q); if (d < R) { const u = (R - Math.max(r, d)) / SP; near[gy * nx + gx] += wgt * u * (1 + u); } } };
      for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) { const x = gx * Q, y = gy * Q, m = EDGE + w / 2; if (bd(x, y) < m) block[gy * nx + gx] = 1; }
      const allP = [...P, ...holes()];
      for (const p of allP) if (p.net !== e.net) {
        const r0 = (p.r || PAD_R) + CLR + w / 2 + (p.r ? 0 : gap), r = r0 + (gap && pend.get(p) ? OPT.esc : 0);
        mark(block, p.x - r, p.y - r, p.x + r, p.y + r, (x, y) => { const d = Math.hypot(x - p.x, y - p.y); return d < r0 || (d < r && Math.hypot(x - e.a.x, y - e.a.y) > RZ && Math.hypot(x - e.b.x, y - e.b.y) > RZ); });
      }
      for (const t of S.traces) if (t.net !== e.net) { const r = traceW(t) / 2 + CLR + w / 2; for (let k = 0; k < t.pts.length - 1; k++) { const [a, b] = [t.pts[k], t.pts[k + 1]]; mark(soft, Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]) < r); if (SP) { const R = r + SP; addNear(Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, r, R, (x, y) => segDist(x, y, a[0], a[1], b[0], b[1]), 1 + .35 * SP); } } }
      if (SP) for (const p of P) if (p.net !== e.net) { const r = (p.r || PAD_R) + CLR + w / 2, R = r + SP; addNear(p.x - R, p.y - R, p.x + R, p.y + R, r, R, (x, y) => Math.hypot(x - p.x, y - p.y), .6 + .15 * SP); }
      if (!withHoles) return { block, soft, near };
      const holeGrid = new Uint8Array(nx * ny), jStop = new Uint8Array(nx * ny);
      const hm = EDGE + JP_R;
      for (let gy = Math.ceil(hm / Q); gy <= Math.floor((S.board.h - hm) / Q); gy++)
        for (let gx = Math.ceil(hm / Q); gx <= Math.floor((S.board.w - hm) / Q); gx++)
          if (bd(gx * Q, gy * Q) >= hm) holeGrid[gy * nx + gx] = 1;
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
    return f + run(A.rats.filter(e => e.net === GND && (!RT.only || RT.only.has(GND))).sort((a, b) => (pr(a) - pr(b)) || (len(a) - len(b))));
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
        const w = netW(e.net), { block, soft, near } = grids(e, w);
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
        const w = netW(e.net);
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
        const capJ = !!cut && RT.maxJ != null && S.jumpers.filter(j => j.auto).length + cut.jumps.length > RT.maxJ; if (capJ) cut = null;
        autoroute.why[ratKey(e)] = cut ? "ok" : capJ ? "vượt giới hạn dây nhảy" : "không đặt được lỗ dây nhảy";
        if (!cut && depth === 0 && OPT.rip) {
          const near = t => t.pts.some((q, k) => k && [e.a, e.b].some(p => segDist(p.x, p.y, t.pts[k - 1][0], t.pts[k - 1][1], q[0], q[1]) < RZ + traceW(t) / 2 + CLR + 1));
          const rip = new Set(S.traces.filter(t => !t.lock && t.net !== e.net && (!RT.only || RT.only.has(t.net)) && near(t)).map(t => t.net));
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
        if (near && near[c2]) cost += OPT.nearCost * near[c2];
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
    const defs = el("defs", {}, svg), pat = el("pattern", { id: "grid", width: gridStep(), height: gridStep(), patternUnits: "userSpaceOnUse" }, defs);
    el("circle", { cx: 0, cy: 0, r: .12, fill: "rgba(255,255,255,.28)" }, pat);
    const R = LY.root = el("g", {}, svg);
    LY.board = el("g", {}, R); LY.jwl = el("g", { "pointer-events": "none" }, R); LY.silk = el("g", {}, R); LY.pour = el("g", { "pointer-events": "none" }, R); LY.art = el("g", { "pointer-events": "none" }, R); LY.cu = el("g", {}, R); LY.pads = el("g", {}, R); LY.pinl = el("g", { "pointer-events": "none" }, R); LY.jw = el("g", { "pointer-events": "none" }, R); LY.rats = el("g", { "pointer-events": "none" }, R);
    LY.drc = el("g", { "pointer-events": "none" }, R); LY.sel = el("g", {}, R); LY.cs = el("g", {}, R); LY.tmp = el("g", { "pointer-events": "none" }, R);
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
  // tên chân ghi cạnh chân (toạ độ cục bộ của linh kiện). Hàng chân ngang: chữ dựng đứng phía trên (hàng dưới: phía dưới);
  // 2 cột chân (board, driver): chữ nằm ngang, trong thân nếu chân nằm trong thân (ESP32), ngoài thân nếu chân ở rìa
  const LBL_DX = 2.2, LBL_DY = 2.5;   // chữ cách tâm chân: pad Ø2 + lỗ khoan Ø1 → chừa ≥ 1 mm, không đè lên lỗ
  const NOLBL = new Set(["R", "C", "button", "to92", "irfz44n", "irf540n", "irf520"]);
  function padLabels(key, c) {
    const f = FP[key], out = []; if (!f || NOLBL.has(key)) return out;
    const L1 = (p, i, o) => {
      const nm = (c && c.pinNames && c.pinNames[i]) || p.name;
      out.push({ t: pinLabel(nm), ...o });
    };
    if (f.hdr) { f.pads.forEach((p, i) => L1(p, i, { x: p.x, y: p.y - LBL_DY, rot: -90, a: "start" })); return out; }
    const xs = [...new Set(f.pads.map(p => p.x))].sort((a, b) => a - b), ys = [...new Set(f.pads.map(p => p.y))].sort((a, b) => a - b), b = f.body;
    if (xs.length >= 2 && ys.length >= 4) {   // 2 cột chân
      const mid = (xs[0] + xs[xs.length - 1]) / 2;
      f.pads.forEach((p, i) => {
        const left = p.x <= mid, inside = (key === "S3" || key.startsWith("BRD:")) && p.x > b.x + .5 && p.x < b.x + b.w - .5;   // chỉ board ghi tên trong thân; linh kiện khác (thân vẽ lệch so với chân) ghi ra ngoài
        L1(p, i, { x: left ? (inside ? p.x + LBL_DX : p.x - LBL_DX) : (inside ? p.x - LBL_DX : p.x + LBL_DX), y: p.y, rot: 0, a: left === inside ? "start" : "end" });
      });
    } else f.pads.forEach((p, i) => {   // hàng chân: chữ dựng đứng, hàng trên ở phía trên, hàng dưới ở phía dưới
      const low = ys.length > 1 && p.y === ys[ys.length - 1];
      L1(p, i, { x: p.x, y: low ? p.y + LBL_DY : p.y - LBL_DY, rot: -90, a: low ? "end" : "start" });
    });
    return out;
  }
  function render() {
    syncW(); syncHost(); analyze(); ensureLayers(); applyLayers();
    const hl = ui.hlNet;
    for (const k of ["board", "jwl", "silk", "cu", "pads", "pinl", "jw", "rats", "drc", "sel", "face"]) LY[k].innerHTML = "";
    const B = S.board;
    LY.root.setAttribute("transform", S.flip ? `translate(${B.w} 0) scale(-1 1)` : ""); svg.classList.toggle("back", !!S.flip);
    faceWidget();
    if (!S.noBoard) {
      const rx = B.rx != null ? B.rx : 1.5;
      if (B.poly) { const d = outlineD(); el("path", { d, "fill-rule": "evenodd", class: "fr4" }, LY.board); el("path", { d, "fill-rule": "evenodd", fill: "url(#grid)" }, LY.board); el("path", { d, "fill-rule": "evenodd", class: "edge" }, LY.board); }
      else { el("rect", { x: 0, y: 0, width: B.w, height: B.h, rx, class: "fr4" }, LY.board);
      el("rect", { x: 0, y: 0, width: B.w, height: B.h, fill: "url(#grid)" }, LY.board);
      el("rect", { x: 0, y: 0, width: B.w, height: B.h, rx, class: "edge" }, LY.board); }
    }
    for (const [x, y] of mountHoles()) el("circle", { cx: x, cy: y, r: 1.6, class: "mhole" }, LY.board);
    // linh kiện (in lụa)
    for (const c of S.comps) {
      const f = FP[c.fp], g = el("g", { class: "comp" + ((ui.sel && ui.sel.t === "c" && ui.sel.id === c.id) || inMs("c", c.id) ? " sel" : ""), "data-c": c.id, transform: `translate(${c.x} ${c.y}) rotate(${c.rot})` }, LY.silk), b = f.body;
      if (S.alpha > 0 && !(c.sym && symD(c.sym, f))) art(c.fp, b, el("g", { class: "art", opacity: S.alpha }, g));   // linh kiện có ký hiệu: không dán ảnh (viền đen)
      if (!document.getElementById("plSymCss")) { const st = document.createElement("style"); st.id = "plSymCss"; st.textContent = ".pcblab .comp .body.sym{stroke:#fff;opacity:.95}.pcblab .comp.sel .body.sym{stroke:#00aeef}"; document.head.appendChild(st); }
      const sd = c.sym ? symD(c.sym, f) : null;
      if (sd) el("path", { d: sd, class: "body sym", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
      else if (f.to92) {
        // Viền in lụa chuẩn bán nguyệt TO-92
        el("path", { d: `M${b.x} ${b.y + b.h} L${b.x + b.w} ${b.y + b.h} A${b.w / 2} ${b.h * 0.9} 0 0 0 ${b.x} ${b.y + b.h} Z`, class: "body" }, g);
      } else if (f.to220) {
        // Viền in lụa TO-220: chữ nhật bao quanh + vạch phân cách lá tản nhiệt
        el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 0.5, class: "body" }, g);
        el("line", { x1: b.x, y1: b.y + 1.3, x2: b.x + b.w, y2: b.y + 1.3, class: "body" }, g);
      } else if (f.ecap) {
        // Ký hiệu in lụa chuẩn tụ hoá (IPC/KiCad): vòng tròn ngoài + dải gạch sọc nửa cực âm (−) + dấu (+) cực dương
        const cx0 = b.x + b.w / 2, cy0 = b.y + b.h / 2, r0 = b.w / 2;
        el("circle", { cx: cx0, cy: cy0, r: r0, class: "body" }, g);
        // Nửa bên phải (cực −): tô mờ + 3 vạch sọc chuẩn nhận diện cực âm
        el("path", { d: `M${cx0} ${cy0 - r0} A${r0} ${r0} 0 0 1 ${cx0} ${cy0 + r0} Z`, class: "body", fill: "currentColor", "fill-opacity": "0.18" }, g);
        for (const fOff of [-0.55, 0, 0.55]) {
          const yOff = fOff * r0, xEnd = cx0 + Math.sqrt(Math.max(0, r0 * r0 - yOff * yOff));
          el("line", { x1: cx0 + r0 * 0.25, y1: cy0 + yOff, x2: xEnd, y2: cy0 + yOff, class: "body" }, g);
        }
        // Dấu (+) sắc nét ở phía cực dương (bên trái)
        const px0 = b.x - 0.85, py0 = cy0 - r0 * 0.55, ps = 0.55;
        el("path", { d: `M${px0 - ps} ${py0} H${px0 + ps} M${px0} ${py0 - ps} V${py0 + ps}`, class: "body", fill: "none" }, g);
      } else if (f.round) el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.h / 2, class: "body" }, g); else el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: .6, class: "body" }, g);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (f.label && !sd) {
        if (c.bl) { const P = lblPos(c, "b"), a = c.bl.r || 0; el("text", { x: P[0], y: P[1], class: "silkt" + lblCls(c, "b"), ...lblHit(c, "b"), transform: S.flip ? `translate(${2 * P[0]} 0) scale(-1 1)${a ? ` rotate(${-a} ${P[0]} ${P[1]})` : ""}` : a ? `rotate(${a} ${P[0]} ${P[1]})` : "" }, LY.silk, f.label); }
        else el("text", { x: cx, y: cy, class: "silkt" + lblCls(c, "b"), ...lblHit(c, "b"), transform: c.rot % 180 ? `rotate(-90 ${cx} ${cy})` : "" }, g, f.label);
      }
      // tên chân đặt theo toạ độ bo (không nằm trong nhóm linh kiện): không bị mờ theo linh kiện, luôn đọc xuôi kể cả khi xoay linh kiện / lật xem mặt Back
      padLabels(c.fp, c).forEach(l => {
        const [rx, ry] = rot(l.x, l.y, c.rot); let th = (((l.rot || 0) + c.rot) % 360 + 360) % 360, an = l.a;
        if (th >= 90 && th < 270) { th -= 180; an = an === "start" ? "end" : "start"; }
        if (th > 180) th -= 360;
        if (S.flip && Math.abs(th) < 45) an = an === "start" ? "end" : "start";   // chữ ngang bị lật gương: đổi phía để vẫn nằm đúng ngoài / trong thân
        el("text", { x: 0, y: 0, class: "hdrl", "text-anchor": an, transform: `translate(${c.x + rx} ${c.y + ry}) ${S.flip ? "scale(-1 1) " : ""}rotate(${th})` }, LY.pinl, l.t);
      });
      // J1: tên ngắn của board ghi bên phải hàng rào (không đè linh kiện bên dưới)
      { const tx = (c.lbl || c.id) + (f.hdr ? " → " + hostInfo().name.split(" (")[0] : "") + (c.val ? " " + c.val : ""), hit = lblHit(c, "r");
        if (c.rl) { const P = lblPos(c, "r"), a = c.rl.r || 0; el("text", { x: P[0], y: P[1], class: "ref" + lblCls(c, "r"), ...hit, transform: S.flip ? `translate(${2 * P[0]} 0) scale(-1 1)${a ? ` rotate(${-a} ${P[0]} ${P[1]})` : ""}` : a ? `rotate(${a} ${P[0]} ${P[1]})` : "" }, LY.silk, tx); }
        else el("text", f.hdr ? { x: b.x + b.w + 1, y: b.y + b.h / 2 + .5, class: "ref" + lblCls(c, "r"), ...hit } : { x: b.x + .6, y: b.y - .8, class: "ref" + lblCls(c, "r"), ...hit }, g, tx); }
    }
    // mass GND
    // path mass lớn (vài trăm KB): chỉ dựng lại khi hình đổi, còn lại chỉ đổi lớp mờ
    const pd = S.pour ? pour().d : "", pe = LY.pour.firstChild;
    if (!pd) LY.pour.innerHTML = ""; else if (!pe || pe.__d !== pd) { LY.pour.innerHTML = ""; el("path", { d: pd }, LY.pour).__d = pd; }
    if (pd) LY.pour.firstChild.setAttribute("class", "pour" + (hl && hl !== GND ? " dim" : ""));
    drawArt(); drawArtSel();
    // đường đồng
    for (const t of S.traces) {
      const w = traceW(t), d = "M" + t.pts.map(p => p.join(" ")).join(" L"), on = (ui.sel && ui.sel.t === "t" && (ui.sel.id === t.id || (ui.sel.ids || []).includes(t.id))) || inMs("t", t.id), sk = on && ui.sel.k != null && t.pts[ui.sel.k + 1] ? ui.sel.k : null;
      const g = el("g", { class: "trace" + (on && sk == null ? " sel" : "") + (t.lock ? " lock" : "") + (isFree(t.net) ? " free" : "") + (hl && hl === t.net ? " hl" : "") + (hl && hl !== t.net ? " dim" : ""), "data-t": t.id }, LY.cu);
      el("path", { d, "stroke-width": w, class: "cu" }, g);
      el("path", { d, "stroke-width": Math.max(w, 2.2), class: "hit" }, g);
      if (sk != null) el("path", { d: `M${t.pts[sk].join(" ")} L${t.pts[sk + 1].join(" ")}`, "stroke-width": w, class: "cu segsel" }, g);   // đoạn đang chọn (từ góc tới góc)
    }
    // chân
    for (const p of A.P) {
      const g = el("g", { class: "pad" + (p.c.auto && p.c.auto[p.name] ? " unc" : "") + (p.net ? "" : " nc") + (hl && p.net === hl ? " hl" : "") + (hl && p.net && p.net !== hl ? " dim" : ""), "data-p": p.c.id + ":" + p.i }, LY.pads);
      { const R0 = p.r || PAD_R; if (p.pw && p.ph) el("rect", { x: p.x - p.pw / 2, y: p.y - p.ph / 2, width: p.pw, height: p.ph, rx: .15, class: "padcu" }, g); else if (p.sq) el("rect", { x: p.x - R0, y: p.y - R0, width: 2 * R0, height: 2 * R0, rx: .15, class: "padcu" }, g); else el("circle", { cx: p.x, cy: p.y, r: R0, class: "padcu" }, g); }
      if (!p.smd) el("circle", { cx: p.x, cy: p.y, r: p.drill ? p.drill / 2 : p.hole && p.hole.pad ? DRILL_R : p.r ? JP_DRILL : DRILL_R, class: "drill" }, g);
    }
    // dây nhảy: nét trắng mảnh (quy ước chung cho ký hiệu linh kiện) nằm ở mặt linh kiện
    for (const j of S.jumpers) {
      const onJ = (ui.sel && ui.sel.t === "j" && ui.sel.id === j.id) || inMs("j", j.id);
      const jc = "jw" + (onJ ? " sel" : "") + (hl && hl !== j.net ? " dim" : ""), g = el("g", { class: jc }, LY.jw);
      if (!noWire(j)) el("line", { x1: j.a[0], y1: j.a[1], x2: j.b[0], y2: j.b[1], class: "jwl" }, el("g", { class: jc }, LY.jwl));   // nét dây nhảy dưới lớp linh kiện (linh kiện mờ thì thấy rõ); nhãn J và lỗ vẫn nằm trên
      { const n = jNo(j); [[j.a, j.b, "a"], [j.b, j.a, "b"]].forEach(([e, o, s]) => el("text", { x: e[0] + 1.1, y: o[0] > e[0] && o[1] < e[1] ? e[1] + 2 : e[1] - 1, class: "extl" }, g, "J" + n + s)); }
      if (onJ) [j.a, j.b].forEach((e, i) => el("circle", { cx: e[0], cy: e[1], r: JP_R + .35, class: "jhdl", "data-jh": j.id + ":" + i }, LY.sel));
    }
    // dây bay
    if (S.rats) for (const r of A.rats) el("line", { x1: r.a.x, y1: r.a.y, x2: r.b.x, y2: r.b.y, class: "rat" + (hl && r.net === hl ? " hl" : "") }, LY.rats);
    // lỗi khoảng cách
    for (const v of A.drc) { el("circle", { cx: v.x, cy: v.y, r: 1.4, class: "drcmark" }, LY.drc); if (v.s) el("path", { d: `M${v.s.a.join(" ")} L${v.s.b.join(" ")}`, "stroke-width": v.s.w + .4, class: "drcseg" }, LY.drc); }
    // điểm gập của đường đang chọn
    if (ui.sel && ui.sel.t === "t") { const t = S.traces.find(x => x.id === ui.sel.id); if (t) t.pts.forEach((p, i) => { if (i > 0 && i < t.pts.length - 1) el("rect", { x: p[0] - .55, y: p[1] - .55, width: 1.1, height: 1.1, class: "vtx" + (ui.sel.v === i ? " vsel" : ""), "data-v": i }, LY.sel); else el("circle", { cx: p[0], cy: p[1], r: .65, class: "vtx vend", "data-v": i }, LY.sel); }); }   // 2 đầu dây: nút tròn, kéo được
    if (ui.tool === "ms" && ((ui.measList && ui.measList.length) || ui.meas)) drawMeas();
    if (window.SketchWBPlugin && window.SketchWBPlugin.onPcbRendered) window.SketchWBPlugin.onPcbRendered();   // giữ số đo sau khi vẽ lại
    drawDims();
    renderJumperPop(); jpSel();
    renderPinHdrPop();
    renderCsPop();
    panel();
    if (window.SketchWBPlugin && window.SketchWBPlugin.onListRendered) window.SketchWBPlugin.onListRendered(); save();
  }
  function renderCsPop() {
    const pop = $("#plCsPop");
    if (pop) pop.remove();
  }

  function faceWidget() {   // chọn mặt Front / Back: bảng nhỏ ở góc dưới trái khung nhìn, nút − / + để thu nhỏ hoặc mở ra
    const st = $("#plStage"); if (!st) return;
    if (!document.getElementById("plFaceCss")) { const c = document.createElement("style"); c.id = "plFaceCss"; c.textContent = "#plFaceW{position:absolute;left:24px;bottom:8px;z-index:7;display:flex;align-items:stretch;background:#26282d;border:1px solid #3f4248;border-radius:3px;box-shadow:0 2px 8px rgba(0,0,0,.35);font:600 10.5px var(--sans);overflow:hidden}#plFaceW button{border:0;border-right:1px solid #3f4248;background:transparent;color:#c3c7cc;padding:3px 8px;font:inherit;cursor:pointer}#plFaceW button:last-child{border-right:0;padding:3px 7px}#plFaceW button:hover{background:rgba(255,255,255,.08)}#plFaceW button.on{background:var(--accent,#4c8bf5);color:#111}#plFaceW.min [data-side]{display:none}"; document.head.appendChild(c); }
    let w = $("#plFaceW");
    if (!w) {
      w = document.createElement("div"); w.id = "plFaceW";
      w.innerHTML = '<button type="button" data-side="0">Front</button><button type="button" data-side="1">Back</button><button type="button" data-fmin="1"></button>';
      w.addEventListener("click", e => {
        const m = e.target.closest("[data-fmin]"); if (m) { S.faceMin = !S.faceMin; save(); faceWidget(); return; }
        const b = e.target.closest("[data-side]"); if (b && (+b.dataset.side === 1) !== !!S.flip) cmd.flip();
      });
      st.appendChild(w);
    }
    w.classList.toggle("min", !!S.faceMin);
    w.querySelectorAll("[data-side]").forEach(b => b.classList.toggle("on", (+b.dataset.side === 1) === !!S.flip));
    const mb = w.querySelector("[data-fmin]"); mb.textContent = S.faceMin ? "+" : "−"; mb.title = S.faceMin ? L("Mở bảng chọn mặt Front / Back (đang xem: " + (S.flip ? "Back" : "Front") + ")", "Show Front / Back switch (viewing: " + (S.flip ? "Back" : "Front") + ")") : L("Thu nhỏ", "Minimize");
    const h = $("#plHint"); if (h) h.style.left = (24 + w.offsetWidth + 8) + "px";   // dòng gợi ý không đè lên bảng
  }
  let facePopT = 0;
  function facePopHide() { clearTimeout(facePopT); facePopT = setTimeout(() => { const p = $("#plFacePop"); if (p) p.classList.remove("on"); }, 350); }
  function facePopSync(p) {
    p.querySelectorAll("[data-side]").forEach(b => b.classList.toggle("on", (+b.dataset.side === 1) === !!S.flip));
    const fm = p.querySelector("[data-fm]"); if (fm) { const auto = S.faceMode === "auto"; fm.classList.toggle("on", !auto); fm.title = auto ? L("Đang tự ẩn chữ Front/Back (rê chuột để hiện) – bấm để luôn hiện", "Front/Back label auto-hides (hover to show) – click to always show") : L("Đang luôn hiện chữ Front/Back – bấm để tự ẩn", "Front/Back label always shown – click to auto-hide"); }
  }
  function facePop(ft) {   // rê chuột vào chữ FRONT / BACK: hiện nút chọn mặt xem bo
    clearTimeout(facePopT); const st = $("#plStage"); if (!st) return;
    let p = $("#plFacePop");
    if (!p) {
      p = document.createElement("div"); p.id = "plFacePop"; p.className = "pl-fly";
      p.style.cssText += ";display:flex;gap:4px;padding:5px;right:auto;min-width:0";
      p.innerHTML = '<button type="button" data-side="0" style="padding:5px 12px;cursor:pointer">Front</button><button type="button" data-side="1" style="padding:5px 12px;cursor:pointer">Back</button><button type="button" data-fm="1" style="padding:4px 6px;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>';
      p.addEventListener("pointerenter", () => clearTimeout(facePopT)); p.addEventListener("pointerleave", facePopHide);
      p.addEventListener("click", e => { const fm = e.target.closest("[data-fm]"); if (fm) { S.faceMode = S.faceMode === "auto" ? "on" : "auto"; save(); render(); facePopSync(p); return; } const b = e.target.closest("[data-side]"); if (!b) return; if ((+b.dataset.side === 1) !== !!S.flip) cmd.flip(); p.classList.remove("on"); });
      st.appendChild(p);
    }
    facePopSync(p);
    const r = ft.getBoundingClientRect(), sr = st.getBoundingClientRect();
    p.classList.add("on"); p.style.left = Math.max(6, Math.min(sr.width - p.offsetWidth - 6, r.right - sr.left - p.offsetWidth)) + "px"; p.style.top = Math.max(6, r.top - sr.top - p.offsetHeight + 4) + "px";   // sát chữ, không hở khe
    if (!facePop.bound) { facePop.bound = 1;   // chỉ giữ popup khi chuột còn ở chữ hoặc trong popup; bấm / kéo ở nơi khác là tắt ngay
      document.addEventListener("pointermove", e => { const q = $("#plFacePop"); if (!q || !q.classList.contains("on")) return; const t = e.target; if (t && t.closest && (t.closest("#plFacePop") || (t.classList && (t.classList.contains("face") || t.classList.contains("faceh"))))) clearTimeout(facePopT); else facePopHide(); });
      document.addEventListener("pointerdown", e => { const q = $("#plFacePop"); if (q && q.classList.contains("on") && !(e.target.closest && e.target.closest("#plFacePop"))) q.classList.remove("on"); }, true); }
  }
  let cbMenu = null;
  function addCombo(i, valsFn, width) {
    if (!i || i.dataset.cb) return; i.dataset.cb = "1";
    if (!document.getElementById("plCbCss")) { const st = document.createElement("style"); st.id = "plCbCss"; st.textContent = ".cb-i::-webkit-inner-spin-button,.cb-i::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.cb-i{-moz-appearance:textfield}"; document.head.appendChild(st); }
    const w = document.createElement("span"); w.className = i.className; i.className = ""; w.style.cssText = "position:relative;display:inline-block;width:" + width + "px;justify-self:end"; i.replaceWith(w);
    i.classList.add("cb-i"); i.style.cssText = "width:100%;box-sizing:border-box;padding-right:16px;text-align:right"; w.append(i);
    const b = document.createElement("button"); b.type = "button"; b.tabIndex = -1; b.textContent = "▾"; b.title = L("Giá trị chuẩn", "Standard values");
    b.style.cssText = "position:absolute;right:0;top:1px;bottom:1px;width:15px;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;font-size:10px"; w.append(b);
    b.onclick = e => {
      e.stopPropagation(); const had = cbMenu && cbMenu._b === b; if (cbMenu) { cbMenu.remove(); cbMenu = null; } if (had) return;
      const m = document.createElement("div"); m._b = b; cbMenu = m; const r = w.getBoundingClientRect();
      m.style.cssText = "position:fixed;z-index:80;left:" + Math.max(4, r.right - Math.max(r.width, 74)) + "px;top:" + (r.bottom + 2) + "px;min-width:" + Math.max(r.width, 74) + "px;box-sizing:border-box;background:#1e2430;border:1px solid rgba(255,255,255,.2);border-radius:5px;box-shadow:0 6px 18px rgba(0,0,0,.45);padding:2px";
      m.innerHTML = valsFn().map(x => '<div data-v="' + x + '" style="padding:4px 8px;cursor:pointer;text-align:right;font-size:12px;border-radius:3px">' + String(x).replace(".", L(",", ".")) + '</div>').join("");
      m.querySelectorAll("[data-v]").forEach(d => { d.onmouseenter = () => d.style.background = "rgba(255,255,255,.12)"; d.onmouseleave = () => d.style.background = ""; d.onclick = () => { i.value = d.dataset.v; m.remove(); cbMenu = null; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); }; });
      document.body.appendChild(m);
    };
    if (!addCombo.bound) { addCombo.bound = 1; document.addEventListener("pointerdown", e => { if (cbMenu && !cbMenu.contains(e.target) && e.target !== cbMenu._b) { cbMenu.remove(); cbMenu = null; } }); }
  }
  function renderJumperPop() {
    const pop = $("#plJumperPop");
    if (!ui.sel || ui.sel.t !== "j" || ui.mode !== "idle") {
      if (pop) pop.remove();
      return;
    }
    const jw = S.jumpers.find(x => x.id === ui.sel.id);
    if (!jw) {
      if (pop) pop.remove();
      return;
    }
    const midX = (jw.a[0] + jw.b[0]) / 2, midY = (jw.a[1] + jw.b[1]) / 2;
    const pos = mmToStage(midX, midY);
    if (!pos) {
      if (pop) pop.remove();
      return;
    }
    let elPop = pop;
    if (!elPop) {
      elPop = document.createElement("div");
      elPop.id = "plJumperPop";
      $("#plStage").appendChild(elPop);
    }
    const curLen = Math.hypot(jw.b[0] - jw.a[0], jw.b[1] - jw.a[1]);
    const lenVal = (Math.round(curLen * 10) / 10).toFixed(1);
    elPop.innerHTML = `<span class="jp-lbl">J${jNo(jw)}:</span>
      <div class="jp-box">
        <button type="button" class="jp-btn" id="jpDecBtn" title="-0.5 mm">▼</button>
        <input type="number" id="jpLenInp" min="1" max="150" step="0.5" value="${lenVal}">
        <button type="button" class="jp-btn" id="jpIncBtn" title="+0.5 mm">▲</button>
      </div>
      <span class="jp-unit">mm</span>`;
    elPop.style.left = pos.x + "px";
    elPop.style.top = pos.y + "px";

    const inp = elPop.querySelector("#jpLenInp");
    const inc = elPop.querySelector("#jpIncBtn");
    const dec = elPop.querySelector("#jpDecBtn");

    elPop.onpointerdown = e => e.stopPropagation();
    inp.onchange = () => cmd.setJumperLength(jw, +inp.value);
    inc.onclick = () => cmd.setJumperLength(jw, Math.round((curLen + 0.5) * 10) / 10);
    dec.onclick = () => cmd.setJumperLength(jw, Math.max(1, Math.round((curLen - 0.5) * 10) / 10));
  }
  function renderPinHdrPop() {
    const pop = $("#plPinHdrPop");
    if (!ui.sel || ui.sel.t !== "c" || ui.mode !== "idle" || !ui.newPinHdrId || ui.sel.id !== ui.newPinHdrId) {
      if (pop) pop.remove();
      return;
    }
    const c = S.comps.find(x => x.id === ui.sel.id);
    if (!c || !c.fp || !c.fp.startsWith("pinHdr")) {
      if (pop) pop.remove();
      return;
    }
    const f = FP[c.fp], curPins = (f && f.nPins) || 3;
    const b = f.body, [cx0, cy0] = rot(b.x + b.w / 2, b.y + b.h / 2, c.rot);
    const pos = mmToStage(c.x + cx0, c.y + cy0);
    if (!pos) {
      if (pop) pop.remove();
      return;
    }
    let elPop = pop;
    if (!elPop) {
      elPop = document.createElement("div");
      elPop.id = "plPinHdrPop";
      $("#plStage").appendChild(elPop);
    }
    elPop.innerHTML = `<span class="jp-lbl">${c.id}:</span>
      <div class="jp-box">
        <button type="button" class="jp-btn" id="phDecBtn" title="-1 pin">▼</button>
        <input type="number" id="phCountInp" min="1" max="40" step="1" value="${curPins}">
        <button type="button" class="jp-btn" id="phIncBtn" title="+1 pin">▲</button>
      </div>
      <span class="jp-unit">${L("chân", "pins")}</span>`;
    elPop.style.left = pos.x + "px";
    elPop.style.top = pos.y + "px";

    const inp = elPop.querySelector("#phCountInp");
    const inc = elPop.querySelector("#phIncBtn");
    const dec = elPop.querySelector("#phDecBtn");

    elPop.onpointerdown = e => e.stopPropagation();
    inp.onchange = () => cmd.setPinCount(c, +inp.value);
    inc.onclick = () => cmd.setPinCount(c, curPins + 1);
    dec.onclick = () => cmd.setPinCount(c, Math.max(1, curPins - 1));
  }

  // hình board thật (đơn giản) vẽ dưới nét in lụa, độ mờ chỉnh bằng thanh kéo
  const NOART = new Set(["tb6612fng", "to92", "irfz44n", "irf540n", "irf520"]);   // hình màu không khớp chân với footprint: dùng hình vẽ đơn giản
  function art(fp, b, g) {
    if (SITE && MODULES[fp] && MODULES[fp].svg && !FP[fp].mine && !NOART.has(fp)) { el("image", { href: MODULES[fp].svg, x: b.x, y: b.y, width: b.w, height: b.h, preserveAspectRatio: "xMidYMid meet" }, g); return; }
    if (FP[fp] && FP[fp].mine) { const q = FP[fp].bb; if (q && FP[fp].icon) { el("image", { href: FP[fp].icon, x: 0, y: 0, width: q.w, height: q.h, preserveAspectRatio: "none", transform: `translate(${q.x} ${q.y}) scale(${q.s}) rotate(${q.rot})` }, g); return; }
      if (FP[fp].art) el("image", { href: FP[fp].art, x: b.x, y: b.y, width: b.w, height: b.h, preserveAspectRatio: "xMidYMid meet" }, g); return; }
    const R = (x, y, w, h, fill, rx = .6) => el("rect", { x, y, width: w, height: h, rx, fill }, g), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (FP[fp] && FP[fp].ecap) { el("circle", { cx, cy, r: b.w / 2, fill: "#2b4f9e" }, g); el("path", { d: `M${cx + b.w * .22} ${cy - b.w * .45}A${b.w / 2} ${b.w / 2} 0 0 1 ${cx + b.w * .22} ${cy + b.w * .45}Z`, fill: "#c9d2e0" }, g); return; }   // vạch trắng phía cực −
    if (fp === "to92") {
      // Bán nguyệt TO-92 D-shape: mặt phẳng ở dưới (phía chân), lưng cong tròn lên trên
      el("path", { d: `M${b.x} ${b.y + b.h} L${b.x + b.w} ${b.y + b.h} A${b.w / 2} ${b.h * 0.9} 0 0 0 ${b.x} ${b.y + b.h} Z`, fill: "#1f2329" }, g);
      el("rect", { x: b.x + 0.3, y: b.y + b.h - 1.2, width: b.w - 0.6, height: 1, rx: 0.2, fill: "#111418" }, g);
      el("text", { x: cx, y: cy - 0.2, "font-size": "1.3", "font-weight": "700", "text-anchor": "middle", "dominant-baseline": "central", fill: "#9ca3af", "font-family": "sans-serif" }, g, "TO-92");
      return;
    }
    if (FP[fp] && FP[fp].motor) { R(b.x, b.y, b.w, b.h, "#3a3f47", 1.2); el("circle", { cx, cy, r: 2.2, fill: "#b8bcc2" }, g); return; }
    if (FP[fp] && FP[fp].to220) {
      // Chuẩn TO-220 đứng: phiến tản nhiệt kim loại phía trên (b.y), thân nhựa đúc đen phía dưới (phía chân)
      const tabH = 1.3, bodyH = b.h - tabH;
      // Lá tản nhiệt kim loại
      R(b.x, b.y, b.w, tabH, "#94a3b8", 0.3);
      // Thân nhựa đúc màu đen
      R(b.x, b.y + tabH, b.w, bodyH, "#1e242d", 0.4);
      // Lỗ khuyết/gờ đánh dấu trên mặt lưng tản nhiệt
      el("circle", { cx, cy: b.y + tabH / 2, r: 0.45, fill: "#475569" }, g);
      // In mã linh kiện (IRFZ44N / IRF540N / IRF520) lên thân nhựa
      const txt = (FP[fp] && FP[fp].val) || "TO-220";
      el("text", { x: cx, y: b.y + tabH + bodyH / 2, "font-size": "1.3", "font-weight": "700", "text-anchor": "middle", "dominant-baseline": "central", fill: "#cbd5e1", "font-family": "sans-serif" }, g, txt);
      return;
    }   // thân đen, mép tấm tản nhiệt kim loại
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
    else if (fp.startsWith("pinHdr")) R(b.x, b.y, b.w, b.h, "#181a1f", .4);   // thân header nhựa đen
    else if (fp.startsWith("BRD:")) R(b.x, b.y, b.w, b.h, "#1c2230", 1);
    else if (fp.startsWith("HDR:")) R(b.x, b.y, b.w, b.h, "#15171b", .3);   // hàng rào header nhựa đen
  }

  /* ---------- xuất file in 1:1 (đơn vị mm) ---------- */
  // cu: mặt đồng đen trên nền trắng, chấm trắng giữa pad = tâm khoan. silk: hướng dẫn cắm linh kiện + dây nhảy.
  // In ủi nhiệt mặt đồng: in KHÔNG lật (úp giấy xuống đồng là tự lật đúng). Bản "lật gương" cho phim / cách làm khác.
  // nhãn tên chân của hàng rào J1 (in lên mặt linh kiện để cắm dây Dupont đúng chân board)
  const hdrText = (f, fs, key, c) => padLabels(key, c).map(l => `<text x="${l.x}" y="${l.y}" font-size="${fs}" font-weight="700" font-family="sans-serif" text-anchor="${l.a}" dominant-baseline="central"${l.rot ? ` transform="rotate(${l.rot} ${l.x} ${l.y})"` : ""}>${l.t}</text>`).join("");
  // tên 2 đầu dây nhảy (J1a / J1b) cạnh lỗ, né phần thân dây đi chéo lên phải
  const jText = (j, fs) => [[j.a, j.b, "a"], [j.b, j.a, "b"]].map(([e, o, s]) => `<text x="${e[0] + 1.1}" y="${o[0] > e[0] && o[1] < e[1] ? e[1] + 2 : e[1] - 1}" font-size="${fs}" font-weight="700" font-family="sans-serif">J${jNo(j)}${s}</text>`).join("");
  /* ---------- Draw: vẽ tay, chữ, hình, icon trên đồng (mặt dưới) hoặc sơn trắng (mặt trên / dưới) ---------- */
  // Mọi thứ lưu thành nét + đa giác trong toạ độ bo (mm), nên xuất SVG / PNG / Gerber như đường đồng thường.
  /* ---------- Layer kiểu AutoCAD: mọi đối tượng nằm trong 1 layer; mỗi layer có tên, màu, bật / tắt, khoá, và layer hiện hành ---------- */
  // basePCB = viền bo + linh kiện · copper = đường đồng, chân, mass, hình đồng khắc tay · jumper = dây nhảy · paint_N = sơn / in lụa (hình, chữ vẽ tay)
  const PALETTE = () => [["Copper", "#d2893d"], ["White paint", "#ffffff"], ["Front", "#ffd400"], ["PCB back", "#1e8a5a"], ["Jumper wire", "#c9d1d9"],
    [L("Đỏ", "Red"), "#ff5a5a"], [L("Xanh dương", "Blue"), "#4aa3ff"], [L("Xanh lá", "Lime"), "#8be04a"], [L("Hồng", "Magenta"), "#ff7ae0"], [L("Lục lam", "Cyan"), "#4ae0e0"]];
  const randColor = () => { const h = Math.random() * 360, c = (n) => { const k = (n + h / 30) % 12, a = .45 * Math.min(.55, 1 - .55); return Math.round(255 * (.55 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); }; return "#" + c(0) + c(8) + c(4); };
  let palFor = null, hlPin = null;
  const hlSet = id => { ui.hlLayer = id; applyLayers(); drawArt(); };
  const DEF_LAYERS = () => [{ id: "base", name: "basePCB", kind: "base", color: "#ffd400", vis: true, lock: false }, { id: "cu", name: "copper", kind: "cu", color: "#d2893d", vis: true, lock: false },
    { id: "jw", name: "jumper", kind: "jw", color: "#c9d1d9", vis: true, lock: false }, { id: "p1", name: "paint_1", kind: "paint", side: "top", color: "#ffffff", vis: true, lock: false }, { id: "p2", name: "paint_2", kind: "paint", side: "top", color: "#ffd84a", vis: true, lock: false }];
  const LYR = id => (S.layers || []).find(l => l.id === id);
  const blk = id => { const l = LYR(id); return !!l && (l.lock || l.vis === false); };   // layer khoá hoặc ẩn: không sửa được đối tượng trong đó
  const drawableLayers = () => S.layers.filter(l => l.kind === "paint" || l.kind === "cu");
  function ensureLayers() {
    if (!Array.isArray(S.layers) || !S.layers.length) S.layers = DEF_LAYERS();
    for (const d of DEF_LAYERS()) if (d.kind !== "paint" && !S.layers.some(l => l.kind === d.kind)) S.layers.push(d);
    if (!S.layers.some(l => l.kind === "paint")) S.layers.push(DEF_LAYERS()[3]);
    S.art = S.art || [];
    for (const it of S.art) {   // hình vẽ từ bản cũ: pf → paint_1 (mặt trên), pb → paint_bottom
      if (it.layer === "pf") it.layer = (S.layers.find(l => l.kind === "paint" && l.side !== "bottom") || S.layers.find(l => l.kind === "paint")).id;
      else if (it.layer === "pb") { let b = S.layers.find(l => l.id === "pb"); if (!b) S.layers.push(b = { id: "pb", name: "paint_bottom", kind: "paint", side: "bottom", color: "#ffffff", vis: true, lock: false }); it.layer = b.id; }
      else if (!LYR(it.layer)) it.layer = S.layers.find(l => l.kind === "paint").id;
    }
    if (!drawableLayers().some(l => l.id === S.cur)) S.cur = S.layers.find(l => l.kind === "paint").id;
  }
  function applyLayers() {   // màu + hiện / ẩn
    const v = k => { const l = S.layers.find(x => x.kind === k); return l ? l.vis !== false : true; }, c = k => (S.layers.find(x => x.kind === k) || {}).color;
    if (LY.board) {
      LY.board.style.display = LY.silk.style.display = LY.pinl.style.display = v("base") ? "" : "none";
      LY.pour.style.display = LY.cu.style.display = LY.pads.style.display = v("cu") ? "" : "none";
      LY.jw.style.display = LY.jwl.style.display = v("jw") ? "" : "none";
      const hl = LYR(ui.hlLayer), mem = { base: [LY.board, LY.silk, LY.pinl], cu: [LY.pour, LY.cu, LY.pads], jw: [LY.jw, LY.jwl] };
      for (const k in mem) for (const g of mem[k]) { const on = hl && hl.kind === k; g.style.opacity = hl && !on ? ".28" : ""; g.style.filter = on ? `drop-shadow(0 0 1.2px ${hl.color}) brightness(1.3)` : ""; }
      LY.art.style.opacity = "";
    }
    ROOT.style.setProperty("--pl-front", c("base") || "#ffd400"); ROOT.style.setProperty("--pl-cu", c("cu") || "#d2893d"); ROOT.style.setProperty("--pl-jw", c("jw") || "#fff");
    const cur = LYR(S.cur), bt = $("#plLayers");
    if (bt && cur) bt.innerHTML = `<i class="ly-dot" style="background:${cur.color}"></i><span>${attr(cur.name)}</span> <i aria-hidden="true">▾</i>`;
  }
  function layerCount(l) {
    if (l.kind === "base") return S.comps.length; if (l.kind === "cu") return S.traces.length + (S.art || []).filter(i => i.layer === l.id).length;
    if (l.kind === "jw") return S.jumpers.length; return (S.art || []).filter(i => i.layer === l.id).length;
  }
  const zoneOf = l => l.kind === "cu" ? "back" : l.kind === "paint" ? (l.side === "bottom" ? "back" : "front") : "front";   // basePCB + jumper + sơn mặt trên = Front; copper + sơn mặt dưới = Back
  function fillLayerPop(m) {
    const kindName = { base: L("viền bo + linh kiện", "board + parts"), cu: L("đồng + chân + mass", "copper + pads + pour"), jw: L("dây nhảy", "jumpers"), paint: L("sơn / in lụa", "paint / silkscreen") };
    m.innerHTML = `<div class="fm-h">${L("Layer", "Layers")} · ${L("đang vẽ vào", "current")}: <b>${attr((LYR(S.cur) || {}).name || "")}</b></div>
      ${[["front", L("Front · mặt linh kiện", "Front · component side")], ["back", L("Back · mặt đồng", "Back · copper side")]].map(([z, zt]) => `<div class="lz lz-${z}"><div class="lz-h">${zt}</div>${S.layers.filter(l => zoneOf(l) === z).map(l => { const can = l.kind === "paint" || l.kind === "cu"; return `<div class="ly${l.id === S.cur ? " cur" : ""}" data-ly="${l.id}">
        <button type="button" class="ly-v${l.vis === false ? " off" : ""}" data-a="vis" title="${L("Hiện / ẩn", "Show / hide")}">${l.vis === false ? "⊘" : "◉"}</button><button type="button" class="ly-l${l.lock ? " on" : ""}" data-a="lock" title="${L("Khoá / mở khoá", "Lock / unlock")}">${l.lock ? "🔒" : "🔓"}</button>
        <button type="button" class="ly-c" data-a="pal" style="background:${l.color}" title="${L("Đổi màu", "Change colour")}"></button><input class="ly-n" data-a="name" value="${attr(l.name)}" maxlength="24" spellcheck="false" title="${kindName[l.kind]}">
        <small class="ly-k">${l.kind === "paint" ? `<button type="button" data-a="side" title="${L("Chuyển layer sơn sang mặt kia", "Move this paint layer to the other side")}">${l.side === "bottom" ? "→ Front" : "→ Back"}</button>` : ""} ${layerCount(l)}</small>
        ${can ? `<button type="button" class="ly-s${l.id === S.cur ? " on" : ""}" data-a="cur" title="${L("Đặt làm layer hiện hành (Draw vẽ vào đây)", "Set current (Draw goes here)")}">${l.id === S.cur ? "●" : "○"}</button>` : `<span class="ly-s">–</span>`}
        ${l.kind === "paint" ? `<button type="button" class="ly-x" data-a="del" title="${L("Xoá layer và hình trong đó", "Delete layer and its drawings")}">✕</button>` : `<span class="ly-x"></span>`}</div>${palFor === l.id ? `<div class="ly-pal">${PALETTE().map(([n, c]) => `<button type="button" data-pk="${c}" title="${attr(n)}" style="background:${c}" class="${c.toLowerCase() === l.color.toLowerCase() ? "on" : ""}"></button>`).join("")}<input type="color" data-pc value="${l.color}" title="${L("Màu tuỳ chỉnh", "Custom colour")}"><button type="button" data-prand title="${L("Màu ngẫu nhiên", "Random colour")}">🎲</button></div>` : ""}`; }).join("")}<button type="button" class="ly-add" data-a="add" data-side="${z === "back" ? "bottom" : "top"}">+ ${L("Layer sơn", "Paint layer")}</button></div>`).join("")}
      <div class="ly-note">${L("Layer ẩn / khoá thì không sửa được đối tượng trong đó. Xuất file vẫn lấy mọi layer.", "Hidden / locked layers cannot be edited. Export still includes every layer.")}</div>`;
    m.querySelectorAll(".ly").forEach(row => {
      const l = LYR(row.dataset.ly), done = () => { ui.sel = ui.sel && ui.sel.t === "a" && !LYR((S.art.find(x => x.id === ui.sel.id) || {}).layer) ? null : ui.sel; save(); render(); fillLayerPop(m); };
      row.querySelectorAll("[data-a]").forEach(b => {
        const a = b.dataset.a;
        if (a === "pal") b.onclick = () => { palFor = palFor === l.id ? null : l.id; fillLayerPop(m); }; else if (a === "name") b.onchange = () => { const v = b.value.trim(); if (v) { checkpoint(); l.name = v.slice(0, 24); } done(); };
        else b.onclick = () => {
          if (a === "vis") l.vis = l.vis === false; else if (a === "lock") l.lock = !l.lock; else if (a === "cur") S.cur = l.id; else if (a === "side") l.side = l.side === "bottom" ? "top" : "bottom";
          else if (a === "del") {
            const go = () => { checkpoint(); S.art = S.art.filter(i => i.layer !== l.id); S.layers = S.layers.filter(x => x !== l); done(); };
            if (layerCount(l)) confirmBox(L(`Xoá layer "${l.name}" và ${layerCount(l)} hình trong đó?`, `Delete layer "${l.name}" and its ${layerCount(l)} drawings?`), { danger: true, title: L("Xoá layer?", "Delete layer?"), ok: L("Xoá layer", "Delete layer") }).then(ok => ok && go()); else go();
            return;
          }
          done();
        };
      });
    });
    const setCol = (l, c) => { l.color = c; applyLayers(); drawArt(); fillLayerPop(m); };
    m.querySelectorAll("[data-pk]").forEach(b => b.onclick = () => setCol(LYR(palFor), b.dataset.pk));
    m.querySelectorAll("[data-pc]").forEach(b => b.oninput = () => { const l = LYR(palFor); l.color = b.value; applyLayers(); drawArt(); const sw = m.querySelector(`.ly[data-ly="${l.id}"] .ly-c`); if (sw) sw.style.background = b.value; });
    m.querySelectorAll("[data-prand]").forEach(b => b.onclick = () => setCol(LYR(palFor), randColor()));
    m.querySelectorAll(".ly").forEach(row => {   // rê chuột lên dòng: layer nổi lên; bấm vào dòng (không phải nút) để ghim
      const id = row.dataset.ly; row.onmouseenter = () => hlSet(id); row.onclick = e => { if (e.target.closest("button, input")) return; hlPin = hlPin === id ? null : id; hlSet(hlPin || id); }; row.querySelector(".ly-n").onfocus = () => hlSet(id);
    });
    m.onmouseleave = () => hlSet(hlPin);
    m.querySelectorAll('[data-a="add"]').forEach(addB => addB.onclick = () => {
      checkpoint(); let n = 1; while (S.layers.some(l => l.name === "paint_" + n)) n++; let id = "p" + n; while (LYR(id)) id += "x";
      S.layers.push({ id, name: "paint_" + n, kind: "paint", side: addB.dataset.side || "top", color: (PALETTE().find(([, c]) => !S.layers.some(x => x.color.toLowerCase() === c)) || [0, randColor()])[1], vis: true, lock: false }); S.cur = id; save(); render(); fillLayerPop(m);
    });
  }
  function layerMenu() {
    const m = pop("plLayerPop", "", $("#plLayers"), 400); if (!m) return hlPin = palFor = null, hlSet(null);
    fillLayerPop(m);
    const ob = new MutationObserver(() => { if (!m.isConnected) { ob.disconnect(); hlPin = palFor = null; hlSet(null); } }); ob.observe(ROOT, { childList: true });
  }
  const GLYPH = {   // font 1 nét, ô 4 × 6 (y xuống)
    A: [[[0, 6], [2, 0], [4, 6]], [[.8, 4], [3.2, 4]]], B: [[[0, 0], [0, 6]], [[0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [0, 6]]],
    C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]], D: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]],
    E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]], F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
    G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3], [2, 3]]], H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
    I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]], J: [[[4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]], K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.5]], [[1.5, 2.5], [4, 6]]],
    L: [[[0, 0], [0, 6], [4, 6]]], M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]], N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
    O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]], P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
    Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.5, 4.5], [4, 6]]], R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]],
    S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]], T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
    U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]], V: [[[0, 0], [2, 6], [4, 0]]], W: [[[0, 0], [1, 6], [2, 3], [3, 6], [4, 0]]], X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
    Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]], Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
    0: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[1, 4.5], [3, 1.5]]], 1: [[[1, 1], [2, 0], [2, 6]], [[1, 6], [3, 6]]],
    2: [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [0, 6], [4, 6]]], 3: [[[0, 0], [4, 0], [2, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]], 4: [[[3, 6], [3, 0], [0, 4], [4, 4]]],
    5: [[[4, 0], [0, 0], [0, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]], 6: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]]], 7: [[[0, 0], [4, 0], [1.5, 6]]],
    8: [[[1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0]], [[1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3]]], 9: [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [4, 3]]],
    "-": [[[1, 3], [3, 3]]], ".": [[[2, 5.6], [2, 6]]], ":": [[[2, 1.8], [2, 2.2]], [[2, 4.8], [2, 5.2]]], "!": [[[2, 0], [2, 4]], [[2, 5.6], [2, 6]]],
    "?": [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [2, 3.5], [2, 4.2]], [[2, 5.6], [2, 6]]], "+": [[[2, 1.5], [2, 4.5]], [[.5, 3], [3.5, 3]]], "/": [[[0, 6], [4, 0]]], "_": [[[0, 6], [4, 6]]]
  };
  function textPaths(str, x, y, h, mir, o) {   // mir: tạo khi đang xem mặt dưới → chữ viết ngược hướng toạ độ bo để nhìn đúng ở chế độ xem đó. o: { sp: khoảng cách thêm, w: độ rộng chữ, it: độ nghiêng }
    o = o || {}; const s = h / 6, dir = mir ? -1 : 1, out = [], sp = o.sp || 0, w = o.w || 1, it = o.it || 0, t = String(str).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase().slice(0, 40); let cx = 0;
    for (const ch of t) { const gl = GLYPH[ch]; if (gl) for (const st of gl) out.push({ pts: st.map(([gx, gy]) => [r3(x + dir * (cx + (gx + (6 - gy) * .28 * it) * w * s)), r3(y + gy * s)]), closed: false }); cx += ((ch === " " ? 1.8 : ch === "I" ? 2.4 : 4) * w + 1.2 + sp) * s; }
    return out;
  }
  const arcPts = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const TEMPL = {   // hình mẫu trong ô 0..1 (y xuống); fill = có thể tô đặc
    rect: () => [{ pts: [[0, 0], [1, 0], [1, 1], [0, 1]], closed: true }],
    circle: () => [{ pts: arcPts(.5, .5, .5, 0, 345, 23), closed: true }],
    tri: () => [{ pts: [[.5, 0], [1, 1], [0, 1]], closed: true }],
    line: () => [{ pts: [[0, 0], [1, 1]], closed: false }],
    star: () => [{ pts: Array.from({ length: 10 }, (_, i) => { const a = (-90 + i * 36) * Math.PI / 180, r = i % 2 ? .2 : .5; return [.5 + r * Math.cos(a) * 1.05, .53 + r * Math.sin(a) * 1.05]; }), closed: true }],
    heart: () => [{ pts: Array.from({ length: 40 }, (_, i) => { const t = i / 40 * 2 * Math.PI; return [(16 * Math.pow(Math.sin(t), 3) + 16) / 32, (-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) + 5) / 22]; }), closed: true }],
    bolt: () => [{ pts: [[.6, 0], [.15, .55], [.45, .55], [.35, 1], [.85, .4], [.55, .4]], closed: true }],
    arrow: () => [{ pts: [[0, .35], [.6, .35], [.6, .1], [1, .5], [.6, .9], [.6, .65], [0, .65]], closed: true }],
    check: () => [{ pts: [[.1, .55], [.4, .85], [.9, .15]], closed: false }],
    smile: () => [{ pts: arcPts(.5, .5, .5, 0, 345, 23), closed: true }, { pts: arcPts(.35, .38, .05, 0, 330, 8), closed: true }, { pts: arcPts(.65, .38, .05, 0, 330, 8), closed: true }, { pts: arcPts(.5, .5, .3, 25, 155, 10), closed: false }],
    sun: () => [{ pts: arcPts(.5, .5, .2, 0, 345, 16), closed: true }, ...Array.from({ length: 8 }, (_, i) => { const a = i * 45 * Math.PI / 180; return { pts: [[.5 + .32 * Math.cos(a), .5 + .32 * Math.sin(a)], [.5 + .5 * Math.cos(a), .5 + .5 * Math.sin(a)]], closed: false }; })],
    moon: () => [{ pts: [...arcPts(.5, .5, .5, 40, 320, 18), ...arcPts(.68, .5, .4, 320, 40, 12)], closed: true }]
  };
  TEMPL.padr = () => [{ pts: arcPts(.5, .5, .5, 0, 345, 23), closed: true }, { pts: arcPts(.5, .5, .25, 0, 345, 16), closed: true, hole: true }];
  TEMPL.pads = () => [{ pts: [[0, 0], [1, 0], [1, 1], [0, 1]], closed: true }, { pts: arcPts(.5, .5, .25, 0, 345, 16), closed: true, hole: true }];
  const ISPAD = k => k === "padr" || k === "pads";
  const NOFILL = new Set(["smile", "sun", "line", "check"]);
  const DRM = () => [["sel", "⬚", L("Chọn hình đã vẽ", "Select a drawing")], ["move", "✥", L("Dời hình (kéo)", "Move (drag)")], ["rot", "⟳", L("Xoay hình (kéo quanh tâm, mỗi 15°; Shift = tự do)", "Rotate (drag around centre, 15° steps; Shift = free)")], ["edit", "✎", L("Sửa hình đang chọn: chữ, cỡ, nét, tô, layer", "Edit the selection: text, size, stroke, fill, layer")]];
  const DRK = () => [["padr", "◉", L("Pad tròn có lỗ giữa (hình vector, mặc định Ø2 mm như chân linh kiện; kéo / thanh trượt để đổi cỡ)", "Round pad with a centre hole (vector shape, Ø2 mm by default like a component pin; drag / slider to resize)")], ["pads", "▣", L("Pad vuông có lỗ giữa (hình vector, mặc định 2 mm như chân linh kiện; kéo / thanh trượt để đổi cỡ)", "Square pad with a centre hole (vector shape, 2 mm by default like a component pin; drag / slider to resize)")], ["free", "〰", L("Vẽ tự do", "Freehand")], ["text", "A", L("Chữ (gõ chữ rồi bấm lên bo)", "Text (type, then click the board)")],
    ["line", "╱", L("Đường thẳng (kéo)", "Line (drag)")], ["rect", "▭", L("Chữ nhật (kéo, Shift = vuông)", "Rectangle (drag, Shift = square)")], ["circle", "◯", L("Tròn (kéo)", "Circle (drag)")], ["tri", "△", L("Tam giác (kéo)", "Triangle (drag)")],
    ["star", "★", L("Ngôi sao", "Star")], ["heart", "♥", L("Trái tim", "Heart")], ["bolt", "⚡", L("Tia chớp", "Lightning")], ["smile", "☺", L("Mặt cười", "Smiley")], ["arrow", "➜", L("Mũi tên", "Arrow")], ["check", "✓", L("Dấu tick", "Check")], ["sun", "☀", L("Mặt trời", "Sun")], ["moon", "☾", L("Trăng", "Moon")]];
  const MODES = ["sel", "move", "rot", "edit"];
  const drCfg = () => { const d0 = { layer: "pf", kind: "free", text: "PINDEXIO", size: 8, tsize: 12, w: .6, fill: false }; if (!S.dr) S.dr = {}; for (const k in d0) if (S.dr[k] === undefined) S.dr[k] = d0[k]; return S.dr; };
  function drawArt() {
    LY.art.innerHTML = ""; S.art = S.art || [];
    for (const it of S.art) {
      const l = LYR(it.layer); if (!l || l.vis === false) continue;
      const on = (ui.sel && ui.sel.t === "a" && ui.sel.id === it.id) || inMs("a", it.id), g = el("g", { class: "art art-" + l.kind + (l.kind === "paint" ? " art-" + (l.side === "bottom" ? "bot" : "top") : "") + (on ? " sel" : ""), style: "color:" + l.color + (ui.hlLayer ? (ui.hlLayer === l.id ? ";filter:drop-shadow(0 0 1.2px " + l.color + ") brightness(1.3);opacity:1" : ";opacity:.28") : (l.kind === "cu" ? "" : "")) }, LY.art);
      if (it.fill && it.paths.some(pa => pa.hole)) el("path", { d: it.paths.map(pa => "M" + pa.pts.map(q => q.join(" ")).join(" L") + "Z").join(" "), "stroke-width": it.w, class: "f", "fill-rule": "evenodd" }, g);   // pad: vòng ngoài + lỗ giữa
      else for (const pa of it.paths) el("path", { d: "M" + pa.pts.map(q => q.join(" ")).join(" L") + (pa.closed ? "Z" : ""), "stroke-width": it.w, class: it.fill && pa.closed ? "f" : "" }, g);
    }
  }
  const artSVG = (layer, col = "#000") => (S.art || []).filter(it => it.layer === layer).map(it => (it.fill && it.paths.some(pa => pa.hole) ? [{ pts: [], all: it.paths }] : it.paths).map(pa => pa.all ? `<path d="${pa.all.map(q => "M" + q.pts.map(z => z.join(" ")).join(" L") + "Z").join(" ")}" fill="${col}" fill-rule="evenodd" stroke="${col}" stroke-width="${it.w}"/>` : `<path d="M${pa.pts.map(q => q.join(" ")).join(" L")}${pa.closed ? "Z" : ""}" fill="${it.fill && pa.closed ? col : "none"}" stroke="${col}" stroke-width="${it.w}" stroke-linecap="round" stroke-linejoin="round"/>`).join("")).join("");
  function artAt(p) {
    for (const it of [...(S.art || [])].reverse()) for (const pa of blk(it.layer) ? [] : it.paths) {
      const lim = Math.max(it.w / 2 + .5, 1);
      for (let k = 1; k < pa.pts.length; k++) if (segDist(p.x, p.y, pa.pts[k - 1][0], pa.pts[k - 1][1], pa.pts[k][0], pa.pts[k][1]) < lim) return it;
      if (pa.pts.length === 1 && Math.hypot(pa.pts[0][0] - p.x, pa.pts[0][1] - p.y) < lim) return it;
      if (it.fill && pa.closed) { let ins = false; for (let i = 0, j = pa.pts.length - 1; i < pa.pts.length; j = i++) { const [xi, yi] = pa.pts[i], [xj, yj] = pa.pts[j]; if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) ins = !ins; } if (ins) return it; }
    }
    return null;
  }
  function artClash(it) {   // đồng vẽ tay chạm chân / đường khác: chỉ cảnh báo, người vẽ tự chịu trách nhiệm
    if ((LYR(it.layer) || {}).kind !== "cu") return;
    const P = pads();
    for (const pa of it.paths) for (let k = 0; k < pa.pts.length; k++) {
      const a = pa.pts[k], b = pa.pts[(k + 1) % pa.pts.length], q = pa.closed || k < pa.pts.length - 1 ? b : a, n = Math.max(1, Math.ceil(Math.hypot(q[0] - a[0], q[1] - a[1]) / .5));
      for (let i = 0; i <= n; i++) {
        const x = a[0] + (q[0] - a[0]) * i / n, y = a[1] + (q[1] - a[1]) * i / n;
        for (const p of P) if (Math.hypot(p.x - x, p.y - y) < (p.r || PAD_R) + it.w / 2 + .1) return toast(L("⚠ Đồng vẽ tay đang chạm chân linh kiện: chừa khoảng trống, không là chập mạch.", "⚠ Hand-drawn copper touches a pin: leave a gap or it shorts."));
        for (const t of S.traces) for (let m = 1; m < t.pts.length; m++) if (segDist(x, y, t.pts[m - 1][0], t.pts[m - 1][1], t.pts[m][0], t.pts[m][1]) < traceW(t) / 2 + it.w / 2 + .1) return toast(L("⚠ Đồng vẽ tay đang chạm đường đồng khác: chừa khoảng trống, không là chập mạch.", "⚠ Hand-drawn copper touches a trace: leave a gap or it shorts."));
      }
    }
  }
  // ----- hình đã vẽ: hộp bao, xoay, co giãn, dời. Chữ lưu khung gốc (it.txt) để sửa chữ / đổi cỡ vẫn giữ góc xoay -----
  const artBox = it => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const pa of it.paths) for (const [x, y] of pa.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, d: Math.max(x1 - x0, y1 - y0) }; };
  const mapPaths = (paths, f) => paths.map(pa => ({ ...pa, pts: pa.pts.map(([x, y]) => { const q = f(x, y); return [r3(q[0]), r3(q[1])]; }) }));
  const rotXY = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a); return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; };
  function artRegen(it) {   // chữ: dựng lại từ khung gốc (x, y, h) rồi đặt vào vị trí hiện tại (pv) với góc xoay it.ang
    const t = it.txt; if (!t) return; it.paths = mapPaths(textPaths(t.s, t.x, t.y, t.h, t.mir, t), (x, y) => { const q = rotXY(x, y, t.p0x, t.p0y, it.ang || 0); return [q[0] - t.p0x + t.pvx, q[1] - t.p0y + t.pvy]; });
  }
  function artFlip(it) {
    const b = artBox(it);
    it.paths = mapPaths(it.paths, (x, y) => [2 * b.cx - x, y]);
    if (it.txt) {
      const t = it.txt;
      t.mir = !t.mir;
      t.x = 2 * b.cx - t.x;
      t.p0x = 2 * b.cx - t.p0x;
      t.pvx = 2 * b.cx - t.pvx;
    }
  }
  function artRotate(it, a) {
    const b = artBox(it); it.paths = mapPaths(it.paths, (x, y) => rotXY(x, y, b.cx, b.cy, a));
    if (it.txt) { const t = it.txt, q = rotXY(t.pvx, t.pvy, b.cx, b.cy, a); t.pvx = q[0]; t.pvy = q[1]; } it.ang = (it.ang || 0) + a;
  }
  function artMove(it, dx, dy) { it.paths = mapPaths(it.paths, (x, y) => [x + dx, y + dy]); if (it.txt) { it.txt.pvx += dx; it.txt.pvy += dy; } }
  function artScale(it, f) {
    const b = artBox(it); it.paths = mapPaths(it.paths, (x, y) => [b.cx + (x - b.cx) * f, b.cy + (y - b.cy) * f]);
    if (it.txt) { const t = it.txt; t.x = t.p0x + (t.x - t.p0x) * f; t.y = t.p0y + (t.y - t.p0y) * f; t.h *= f; t.pvx = b.cx + (t.pvx - b.cx) * f; t.pvy = b.cy + (t.pvy - b.cy) * f; }
  }
  function newArt(paths, txt) {
    const D = drCfg(); if (!paths.length) return; ensureLayers(); const ly = LYR(S.cur);
    if (!ly || ly.lock || ly.vis === false) return toast(L(`Layer "${ly ? ly.name : ""}" đang ${ly && ly.lock ? "khoá" : "ẩn"}: mở layer hoặc chọn layer khác trong menu Layer.`, `Layer "${ly ? ly.name : ""}" is ${ly && ly.lock ? "locked" : "hidden"}: unlock it or pick another layer in the Layer menu.`));
    checkpoint();
    const pad = ISPAD(D.kind), it = { id: S.uid++, layer: S.cur, w: pad ? .2 : D.w, fill: pad || (!!D.fill && !NOFILL.has(D.kind)), paths }; if (txt) { const b = artBox(it); it.txt = { ...txt, p0x: b.cx, p0y: b.cy, pvx: b.cx, pvy: b.cy }; }
    S.art.push(it); ui.sel = { t: "a", id: it.id }; if (txt) D.kind = "sel";   // chữ: đặt một lần rồi chỉnh (font, cỡ, khoảng cách…), không đặt liên tục; hình khác vẽ liên tục
    save(); render(); artClash(it);   // Esc để thoát
    if (ui.tool === "dr") { drawFly(); $("#plFlyD").classList.add("on"); }
  }
  const selArt = () => ui.sel && ui.sel.t === "a" ? (S.art || []).find(x => x.id === ui.sel.id) : null;
  const rdp = (pts, eps) => {
    if (pts.length < 3) return pts; const a = pts[0], b = pts[pts.length - 1]; let mi = 0, md = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]); if (d > md) { md = d; mi = i; } }
    return md > eps ? [...rdp(pts.slice(0, mi + 1), eps).slice(0, -1), ...rdp(pts.slice(mi), eps)] : [a, b];
  };
  const artSnap = it => JSON.stringify({ paths: it.paths, txt: it.txt || null, ang: it.ang || 0 });
  const artRestore = (it, sn) => { const o = JSON.parse(sn); it.paths = o.paths; if (o.txt) it.txt = o.txt; else delete it.txt; it.ang = o.ang; };
  function artRegenKeep(it) { const b0 = artBox(it); artRegen(it); const b1 = artBox(it); artMove(it, b0.cx - b1.cx, b0.cy - b1.cy); }   // dựng lại chữ nhưng giữ nguyên tâm
  function drawArtSel() {   // khung nét báo quanh hình đang chọn: 4 góc = co giãn, nút tròn phía trên = xoay, cạnh khung = dời
    const old = LY.sel.querySelector(".artsel"); if (old) old.remove();
    const it = selArt(); if (!it) return; const l = LYR(it.layer); if (!l || l.vis === false || l.lock) return;
    const b = artBox(it), pad = Math.max(it.w / 2, .3) + .7, x0 = b.x0 - pad, y0 = b.y0 - pad, x1 = b.x1 + pad, y1 = b.y1 + pad, k = Math.max(ui.k || .2, .05), hs = 4.5 * k, g = el("g", { class: "artsel" }, LY.sel);
    el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: "asbox", "data-ah": "mv" }, g);
    el("line", { x1: (x0 + x1) / 2, y1: y0, x2: (x0 + x1) / 2, y2: y0 - 9 * k, class: "asrot-l" }, g);
    el("circle", { cx: (x0 + x1) / 2, cy: y0 - 9 * k, r: hs * .85, class: "ashd asrot", "data-ah": "rot" }, g);
    for (const [cx, cy, c] of [[x0, y0, "nw"], [x1, y0, "ne"], [x0, y1, "sw"], [x1, y1, "se"]]) el("rect", { x: cx - hs / 2, y: cy - hs / 2, width: hs, height: hs, class: "ashd", "data-ah": c }, g);
  }
  function startArtHandle(e, kind, it0) {   // kind: mv (dời) · rot (xoay quanh tâm, 15°; Shift = tự do) · nw/ne/sw/se (co giãn quanh tâm)
    const it = it0 || selArt(); if (!it) return; e.preventDefault && e.preventDefault();
    const p0 = toMM(e), sn = artSnap(it), b = artBox(it), a0 = Math.atan2(p0.y - b.cy, p0.x - b.cx), d0 = Math.hypot(p0.x - b.cx, p0.y - b.cy) || 1; let moved = false, prevArtDx = 0, prevArtDy = 0;
    const first = () => { if (moved) return; moved = true; const keep = artSnap(it); artRestore(it, sn); checkpoint(); artRestore(it, keep); };
    ui.drag = {
      move: (q, ev) => {
        first(); artRestore(it, sn);
        if (kind === "mv") { const adx = q.x - p0.x, ady = q.y - p0.y; artMove(it, adx, ady); syncCsArtMove(it.id, adx - prevArtDx, ady - prevArtDy); prevArtDx = adx; prevArtDy = ady; }
        else if (kind === "rot") { let d = Math.atan2(q.y - b.cy, q.x - b.cx) - a0; if (!(ev && ev.shiftKey)) d = Math.round(d / (Math.PI / 12)) * (Math.PI / 12); artRotate(it, d); }
        else artScale(it, Math.max(.05, Math.hypot(q.x - b.cx, q.y - b.cy) / d0));
        drawArt(); drawArtSel();
      },
      up: () => { render(); if (moved) artClash(it); if ($("#plFlyD") && ui.tool === "dr") { drawFly(); $("#plFlyD").classList.add("on"); } }
    };
  }
  function drawDown(e, p) {
    const D = drCfg(), a = [p.x, p.y];
    if (MODES.includes(D.kind)) {   // Chọn · Dời · Xoay · Sửa: bấm vào hình để chọn, kéo hình để dời (Chọn và Dời là một)
      let it = artAt(p); if (D.kind === "rot" && !it) it = selArt();
      if (!it) { ui.sel = null; render(); drawFly(); $("#plFlyD").classList.add("on"); return; }
      ui.sel = { t: "a", id: it.id }; render(); drawFly(); $("#plFlyD").classList.add("on");
      if (D.kind === "edit") return;
      return startArtHandle(e, D.kind === "rot" ? "rot" : "mv", it);
    }
    if (D.kind === "text") return newArt(textPaths(D.text || "A", p.x, p.y - D.tsize / 2, D.tsize, !!S.flip), { s: D.text || "A", x: p.x, y: p.y - D.tsize / 2, h: D.tsize, mir: !!S.flip, sp: 0, w: 1, it: 0 });
    if (D.kind === "free") {
      const pts = [a]; ui.drag = {
        move: q => { const l = pts[pts.length - 1]; if (Math.hypot(q.x - l[0], q.y - l[1]) < .25) return; pts.push([r3(q.x), r3(q.y)]); LY.tmp.innerHTML = ""; el("path", { d: "M" + pts.map(z => z.join(" ")).join(" L"), "stroke-width": D.w, class: "art-tmp" }, LY.tmp); },
        up: () => { LY.tmp.innerHTML = ""; newArt([{ pts: pts.length > 2 ? rdp(pts, .12) : pts.length === 2 ? pts : [a, [r3(a[0] + .01), a[1]]], closed: false }]); }
      }; return;
    }
    const mk = (b, shift) => { let [x1, y1] = b; if (shift && D.kind !== "line") { const s = Math.max(Math.abs(x1 - a[0]), Math.abs(y1 - a[1])); x1 = a[0] + Math.sign(x1 - a[0] || 1) * s; y1 = a[1] + Math.sign(y1 - a[1] || 1) * s; }
      if (Math.abs(x1 - a[0]) < 1 && Math.abs(y1 - a[1]) < 1) { const h = (ISPAD(D.kind) ? 2 : D.size) / 2; return [a[0] - h, a[1] - h, a[0] + h, a[1] + h]; } return [a[0], a[1], x1, y1]; };
    const build = bb => TEMPL[D.kind]().map(pa => ({ closed: pa.closed, ...(pa.hole ? { hole: true } : {}), pts: pa.pts.map(([u, v]) => [r3(bb[0] + (bb[2] - bb[0]) * u), r3(bb[1] + (bb[3] - bb[1]) * v)]) }));
    let last = a, shift = false;
    ui.drag = {
      move: (q, ev) => { last = [q.x, q.y]; shift = !!(ev && ev.shiftKey); LY.tmp.innerHTML = ""; for (const pa of build(mk(last, shift))) el("path", { d: "M" + pa.pts.map(z => z.join(" ")).join(" L") + (pa.closed ? "Z" : ""), "stroke-width": D.w, class: "art-tmp" }, LY.tmp); },
      up: () => { LY.tmp.innerHTML = ""; newArt(build(mk(last, shift))); }
    };
  }
  function drawFly() {   // Pen: hàng 1 = chọn · dời · xoay · sửa · xoá; hình đang chọn có thanh thuộc tính (chữ, font, chiều cao, khoảng cách, độ rộng, nét)
    let f = $("#plFlyD"); if (!f) { f = document.createElement("div"); f.id = "plFlyD"; f.className = "pl-fly"; $("#plStage").appendChild(f); }
    const D = drCfg(), it = selArt(), isTxt = !!it && !!it.txt, editing = !!it && (MODES.includes(D.kind) || isTxt), dim = it ? Math.round(artBox(it).d) : 0, tx = isTxt ? it.txt : null;
    const num = (id, lab, min, max, step, val, unit) => `<div class="flw fl-num"><small>${lab}${unit ? ` <span class="num-u">${unit.trim()}</span>` : ""}</small><div class="num-box"><button type="button" class="num-btn num-dn" data-step="-1" data-for="${id}" title="${L("Giảm", "Decrease")}">▾</button><input id="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${val}"><button type="button" class="num-btn num-up" data-step="1" data-for="${id}" title="${L("Tăng", "Increase")}">▴</button></div></div>`;
    f.innerHTML = `<div class="flw"><small>${L("Layer hiện hành", "Current layer")}</small><select id="drLayer">${drawableLayers().map(l => `<option value="${l.id}"${(it ? it.layer : S.cur) === l.id ? " selected" : ""}>${attr(l.name)}${l.kind === "cu" ? " · " + L("đồng khắc", "etched") : l.side === "bottom" ? " · " + L("mặt dưới", "bottom") : ""}</option>`).join("")}</select></div>
      <div class="dr-text-row"><button type="button" data-dk="text" class="dr-text-btn${D.kind === "text" || isTxt ? " on" : ""}" title="${L("Chữ (gõ chữ rồi bấm lên bo)", "Text (type, then click the board)")}"><span class="dr-a-ico">A</span><span>${L("Chữ (Text)", "Text")}</span></button></div>
      <div class="drk">${DRK().filter(([k]) => k !== "text").map(([k, g, t]) => `<button type="button" data-dk="${k}" title="${t}" class="${D.kind === k ? "on" : ""}">${g}</button>`).join("")}</div>
      ${isTxt || D.kind === "text" ? `<div class="flw"><small>${L("Nội dung chữ", "Text")}</small><input id="drText" value="${attr(isTxt ? tx.s : D.text)}" maxlength="40" spellcheck="false" placeholder="A–Z, 0–9"></div>` : ""}
      ${isTxt ? `<div class="flw"><small>${L("Font", "Font")}</small><select id="drFont"><option value="0"${!tx.it ? " selected" : ""}>${L("Nét đơn · thẳng", "Single-stroke · upright")}</option><option value="1"${tx.it ? " selected" : ""}>${L("Nét đơn · nghiêng", "Single-stroke · italic")}</option></select></div>
        ${num("drTh", L("Cao chữ", "Height"), 2, 60, 1, Math.round(tx.h), "mm")}${num("drSp", L("Cách chữ", "Spacing"), -1, 4, .1, +(tx.sp || 0).toFixed(1), "")}${num("drWd", L("Rộng chữ", "Width"), .5, 2, .05, +(tx.w || 1).toFixed(2), "×")}`
        : it ? num("drSize", L("Cỡ hình", "Size"), 2, 120, 1, dim, "mm") : num("drSize", L("Cỡ", "Size"), 2, 40, 1, D.size, "mm")}
      ${num("drW", L("Nét", "Stroke"), .2, 3, .1, +(it ? it.w : D.w).toFixed(1), "mm")}
      <label class="bchk"><input type="checkbox" id="drFill"${(it ? it.fill : D.fill) ? " checked" : ""}> ${L("Tô đặc", "Filled")}</label>
      <small class="flh">${L("Vẽ liên tục, Esc để thoát. Hình vừa vẽ có khung nét báo: kéo cạnh = dời · góc = co giãn · nút tròn = xoay (15°, Shift = tự do). R xoay 90°, Delete xoá.", "Draws continuously, Esc to leave. The new drawing has a frame: drag the edge = move · corners scale · the round handle rotates (15°, Shift = free). R rotates 90°, Delete removes.")}</small>`;
    { const body = document.createElement("div"); body.className = "fb"; while (f.firstChild) body.appendChild(f.firstChild);   // thu gọn được: chỉ còn thanh tiêu đề
      const head = document.createElement("div"); head.className = "fh"; head.innerHTML = `<b>Pen</b><button type="button" data-fc title="${L("Thu gọn / mở rộng", "Collapse / expand")}">${S.penCol ? "▸" : "▾"}</button>`; f.appendChild(head); f.appendChild(body); f.classList.toggle("col", !!S.penCol);
      head.querySelector("[data-fc]").onclick = () => { S.penCol = !S.penCol; save(); f.classList.toggle("col", !!S.penCol); head.querySelector("[data-fc]").textContent = S.penCol ? "▸" : "▾"; }; }
    f.querySelectorAll("[data-dk]").forEach(b => b.onclick = () => { D.kind = b.dataset.dk; if (!MODES.includes(D.kind)) ui.sel = null; save(); render(); drawFly(); f.classList.add("on"); });
    f.querySelectorAll(".num-btn").forEach(btn => btn.onclick = () => {
      const inp = f.querySelector("#" + btn.dataset.for); if (!inp) return;
      const step = +inp.step || 1, dir = +btn.dataset.step;
      const min = inp.min !== "" ? +inp.min : -Infinity, max = inp.max !== "" ? +inp.max : Infinity;
      const decimals = (String(inp.step).split(".")[1] || "").length;
      let next = +((+inp.value || 0) + dir * step).toFixed(decimals);
      next = Math.max(min, Math.min(max, next));
      inp.value = next;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const upd = fn => { fn(D); if (it) fn(it); save(); render(); };
    f.querySelector("#drLayer").onchange = e => { S.cur = e.target.value; if (it) it.layer = e.target.value; save(); render(); drawFly(); f.classList.add("on"); };
    let ck = false; const once = () => { if (!ck) { ck = true; checkpoint(); } }, live = () => { drawArt(); drawArtSel(); save(); };
    const T = f.querySelector("#drText"); if (T) T.oninput = e => { if (isTxt) { once(); tx.s = e.target.value || " "; artRegenKeep(it); live(); } else { D.text = e.target.value; save(); } };
    const F = f.querySelector("#drFont"); if (F) F.onchange = e => { once(); tx.it = +e.target.value; artRegenKeep(it); live(); render(); };
    const h = f.querySelector("#drTh"); if (h) { h.oninput = e => { const v = Math.max(+h.min || 1, +e.target.value || 1); D.tsize = v; if (it && tx && tx.h && v !== tx.h) { once(); artScale(it, v / tx.h); live(); } }; h.onchange = () => { if (it) { render(); artClash(it); } }; }
    const sp = f.querySelector("#drSp"); if (sp) sp.oninput = e => { if (it && tx) { once(); tx.sp = +e.target.value || 0; artRegenKeep(it); live(); } };
    const wd = f.querySelector("#drWd"); if (wd) wd.oninput = e => { if (it && tx) { const v = Math.max(0.1, +e.target.value || 1); once(); tx.w = v; artRegenKeep(it); live(); } };
    const sz = f.querySelector("#drSize"); if (sz) { sz.oninput = e => { const v = Math.max(+sz.min || 1, +e.target.value || 1); D.size = v; if (it) { const b = artBox(it).d; if (b > 0 && Math.abs(v - b) > 0.05) { once(); artScale(it, v / b); live(); } } save(); }; sz.onchange = () => { if (it) { render(); artClash(it); } }; }
    const wInp = f.querySelector("#drW"); if (wInp) { const applyW = e => { const v = Math.max(0.1, +e.target.value || 0.1); upd(o => { o.w = v; }); }; wInp.oninput = applyW; wInp.onchange = applyW; }
    f.querySelector("#drFill").onchange = e => upd(o => { o.fill = e.target.checked; });
    { const st = $("#plStage"), db = $("#plTdr"); f.classList.add("on"); if (st && db) { const top = db.getBoundingClientRect().top - st.getBoundingClientRect().top; f.style.top = Math.max(6, Math.min(top, st.clientHeight - f.offsetHeight - 6)) + "px"; } }   // luôn nằm gọn trong khung vẽ
  }
  /* ---------- Cưa lọng: cắt / mở rộng / khoét bo bằng đường thẳng (snap 15°). Chỉ dùng được khi đã đi dây xong ---------- */
  let pcLoad = null;
  const loadPolyclip = () => window.polygonClipping ? Promise.resolve() : (pcLoad = pcLoad || new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = (SITE ? "js/polyclip.js" : "proto/polyclip.js") + "?v=1"; sc.onload = ok; sc.onerror = () => { pcLoad = null; no(new Error("polyclip")); }; document.head.appendChild(sc); }));
  const sawTotal = () => { const c = {}; for (const p of A.P) if (!p.jw && !p.hole && p.net && !isFree(p.net)) c[p.net] = (c[p.net] || 0) + 1; return Object.values(c).reduce((t, n) => t + Math.max(0, n - 1), 0); };   // tổng số kết nối cần có
  const sawOK = () => { if (S.comps.length < 2 || !A) return false; const tot = sawTotal(); return tot > 0 && (tot - A.rats.length) / tot >= .6; };   // đi dây được ≥ 60% là cưa được
  function sawReady(report) {
    analyze(); const ok = sawOK();
    if (!ok && report) toast(L("Cưa dùng được khi đã đi dây từ 60% số kết nối trở lên.", "The saw is available once at least 60% of the connections are routed."));
    return !!ok;
  }
  const ringArea = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
  function nearestOnRing(ring, x, y) {
    let best = null; for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0, px = a[0] + t * dx, py = a[1] + t * dy, d = Math.hypot(x - px, y - py);
      if (!best || d < best.d) best = { x: px, y: py, d, i, t };
    }
    return best;
  }
  const walkRing = (ring, a, b) => {   // các đỉnh gặp khi đi xuôi chiều vòng từ điểm a tới điểm b
    const out = []; if (b.i === a.i && b.t >= a.t) return out; const n = ring.length; let i = (a.i + 1) % n;
    for (let g = 0; g <= n; g++) { out.push(ring[i]); if (i === b.i) break; i = (i + 1) % n; } return out;
  };
  const cleanRing = (r, eps = .02) => {   // làm tròn, bỏ điểm trùng và điểm thẳng hàng
    let o = r.map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]).filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > eps);
    if (o.length > 1 && Math.hypot(o[0][0] - o.at(-1)[0], o[0][1] - o.at(-1)[1]) <= eps) o.pop();
    for (let k = 0; k < 2; k++) o = o.filter((p, i, a) => { const q = a[(i + a.length - 1) % a.length], n = a[(i + 1) % a.length]; return Math.abs((p[0] - q[0]) * (n[1] - p[1]) - (p[1] - q[1]) * (n[0] - p[0])) > 1e-3; });
    return o;
  };
  function sawSnap(p, last, shift) {
    let x = p.x, y = p.y;
    const o = outlineOf(), lim = Math.max(1.2, ui.k * 7);
    if (last && !shift) {
      const dx = x - last[0], dy = y - last[1], L = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * Math.PI / 12, ca = Math.cos(a), sa = Math.sin(a);
      x = last[0] + L * ca; y = last[1] + L * sa;
      const R = o.outer; let best = null;
      for (let i = 0; i < R.length; i++) {
        const A = R[i], B = R[(i + 1) % R.length], ex = B[0] - A[0], ey = B[1] - A[1], den = ca * ey - sa * ex;
        if (Math.abs(den) < 1e-6) continue;
        const u = ((A[0] - last[0]) * ey - (A[1] - last[1]) * ex) / den, t = ((A[0] - last[0]) * sa - (A[1] - last[1]) * ca) / den;
        if (u > .2 && t >= -1e-4 && t <= 1 + 1e-4) {
          const tc = Math.max(0, Math.min(1, t)), ix = A[0] + tc * ex, iy = A[1] + tc * ey, d = Math.hypot(ix - x, iy - y);
          if (!best || d < best.d) best = { x: ix, y: iy, d };
        }
      }
      if (best && best.d < lim * 1.5) return [r3(best.x), r3(best.y), true];
      const n0 = nearestOnRing(o.outer, x, y); if (n0.d < .05) return [r3(n0.x), r3(n0.y), true];
      return [Math.round(x * 100) / 100, Math.round(y * 100) / 100, false];
    }
    const n = nearestOnRing(o.outer, x, y); if (n.d < lim) return [n.x, n.y, true];   // gần mép bo thì bám vào mép
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100, false];
  }
  function drawSaw(p, ev) {
    LY.tmp.innerHTML = ""; const e = extent(); const pts = ui.saw ? ui.saw.pts : [];
    if (e) el("rect", { x: e.x0 - EDGE - .5, y: e.y0 - EDGE - .5, width: e.x1 - e.x0 + 2 * (EDGE + .5), height: e.y1 - e.y0 + 2 * (EDGE + .5), class: "sawsafe" }, LY.tmp);   // vùng khuyến nghị không nên cắt vào (vẫn cắt được)
    let cur = null; if (p) { cur = sawSnap(p, pts.at(-1), isShift(ev)); ui.saw = ui.saw || { pts: [] }; ui.saw.cur = cur; }
    const all = [...pts, ...(cur ? [cur] : [])]; if (all.length) el("path", { d: "M" + all.map(q => q[0] + " " + q[1]).join(" L"), class: "sawline" }, LY.tmp);
    for (const q of pts) el("circle", { cx: q[0], cy: q[1], r: .5, class: "sawpt" }, LY.tmp);
    if (cur) { el("circle", { cx: cur[0], cy: cur[1], r: cur[2] ? 1 : .6, class: "sawpt" + (cur[2] ? " edge" : "") }, LY.tmp); if (pts.length) { const l = pts.at(-1); $("#plHint").textContent = L(`Cưa: ${Math.hypot(cur[0] - l[0], cur[1] - l[1]).toFixed(1)} mm · ${((Math.atan2(l[1] - cur[1], cur[0] - l[0]) * 180 / Math.PI + 360) % 360).toFixed(0)}° — bấm điểm tiếp, bấm đúp / Enter / chuột phải để cắt, Esc huỷ`, `Saw: ${Math.hypot(cur[0] - l[0], cur[1] - l[1]).toFixed(1)} mm — click next point, double-click / Enter / right-click to cut, Esc cancels`); } }
  }
  function sawDown(e, p) {
    const c = sawSnap(p, ui.saw && ui.saw.pts.at(-1), isShift(e)); ui.saw = ui.saw || { pts: [] }; const last = ui.saw.pts.at(-1);
    if (last && Math.hypot(c[0] - last[0], c[1] - last[1]) < .3) return sawFinish();   // bấm lại đúng điểm cuối = xong
    ui.saw.pts.push(c); drawSaw(null); syncCtxBar();
  }
  async function sawFinish() {
    const pts = ui.saw ? ui.saw.pts.map(q => [q[0], q[1]]) : []; ui.saw = null; LY.tmp.innerHTML = "";
    $("#plHint").textContent = TOOLS().saw[0] + ": " + TOOLS().saw[1];
    if (pts.length < 2) return toast(L("Cần ít nhất 2 điểm để cưa.", "Need at least 2 points to cut."));
    try { await loadPolyclip(); } catch (e) { return toast(L("Không tải được bộ tính hình học (polyclip). Kiểm tra mạng rồi thử lại.", "Could not load the geometry library (polyclip). Check the network and retry.")); }
    const pc = window.polygonClipping, O = outlineOf(), board = [[O.outer.map(q => [...q]), ...O.holes.map(h => h.map(q => [...q]))]];
    const first = pts[0], last = pts.at(-1), closed = pts.length >= 4 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1.2;
    let result, msg;
    const samples = []; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .5)); for (let k = 1; k < n; k++) samples.push(bd(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)); }
    const ins = samples.filter(v => v > .05).length, out = samples.filter(v => v < -.05).length;
    const a0 = nearestOnRing(O.outer, first[0], first[1]), b0 = nearestOnRing(O.outer, last[0], last[1]);
    if (closed && out === 0 && a0.d > 1.2) {   // vòng kín nằm trong bo = khoét lỗ
      result = pc.difference(board, [[pts.slice(0, -1)]]); msg = L("Đã khoét lỗ trong bo.", "Cut a hole in the board.");
    } else {
      if (a0.d > 1.5 || b0.d > 1.5) return toast(L("Đường cưa phải bắt đầu và kết thúc ở mép bo (hoặc là vòng kín trong bo).", "The cut must start and end on the board edge (or be a closed loop inside the board)."));
      if (ins && out) return toast(L("Đường cưa đang đi cả trong lẫn ngoài bo: vẽ riêng từng đường.", "The cut runs both inside and outside the board: draw them separately."));
      if (a0.i === b0.i && Math.abs(a0.t - b0.t) < 1e-6 && Math.hypot(a0.x - b0.x, a0.y - b0.y) < .3) return toast(L("Hai đầu đường cưa trùng nhau.", "Both ends of the cut are at the same point."));
      const C = [[a0.x, a0.y], ...pts.slice(1, -1), [b0.x, b0.y]], p1 = [...C, ...walkRing(O.outer, a0, b0).reverse()], p2 = [...C, ...walkRing(O.outer, b0, a0)];
      if (out > 0) {   // đi ra ngoài: thêm phần vòng kín nằm ngoài bo
        const ov = p => { try { return pc.intersection(board, [[p]]).reduce((s, poly) => s + ringArea(poly[0]), 0); } catch (e) { return 1e9; } }, add = ov(p1) <= ov(p2) ? p1 : p2;
        result = pc.union(board, [[add]]); msg = L("Đã mở rộng bo theo đường cưa.", "Board extended along the cut.");
      } else {   // đi trong bo: bỏ phần nhỏ hơn (cắt xuyên hết bo hoặc khoét lẹm)
        const rem = ringArea(p1) <= ringArea(p2) ? p1 : p2;
        result = pc.difference(board, [[rem]]); msg = L("Đã cắt bỏ phần nhỏ của bo.", "Cut off the smaller part of the board.");
      }
    }
    if (!result || !result.length) return toast(L("Đường cưa không tạo được hình bo hợp lệ.", "The cut does not give a valid board shape."));
    result = result.slice().sort((x, y) => ringArea(y[0]) - ringArea(x[0])); const extra = result.length > 1;
    const outer = cleanRing(result[0][0]), holes = result[0].slice(1).map(h => cleanRing(h)).filter(h => h.length >= 3);
    if (outer.length < 3) return toast(L("Đường cưa không tạo được hình bo hợp lệ.", "The cut does not give a valid board shape."));
    const xs = outer.map(q => q[0]), ys = outer.map(q => q[1]), minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
    const ox = Math.floor(minX / G) * G, oy = Math.floor(minY / G) * G, w = Math.ceil((maxX - ox) * 100) / 100, h = Math.ceil((maxY - oy) * 100) / 100;
    if (w > BMAX || h > BMAX) return toast(L(`Bo vượt ${BMAX} mm: thu nhỏ đường cưa lại.`, `The board would exceed ${BMAX} mm: make the cut smaller.`));
    checkpoint(); shiftAll(-ox, -oy);
    const rel = r => r.map(q => [Math.round((q[0] - ox) * 100) / 100, Math.round((q[1] - oy) * 100) / 100]);
    const rect = !holes.length && outer.length === 4 && outer.every((q, i, a) => { const n = a[(i + 1) % 4]; return Math.abs(q[0] - n[0]) < .02 || Math.abs(q[1] - n[1]) < .02; });
    S.board = rect ? { w: Math.max(w, 1), h: Math.max(h, 1) } : { w, h, poly: rel(outer), holes: holes.length ? holes.map(rel) : undefined };
    if (!S.board.holes) delete S.board.holes;
    ui.sel = null; render(); fit();
    analyze(); const bad = A.drc.filter(v => /mép|ngoài|edge|outside/i.test(v.msg || "")).length;
    toast(msg + (extra ? L(" (phần rời nhỏ hơn bị bỏ)", " (the smaller separate piece was dropped)") : "") + (bad ? L(` ${bad} chỗ đang sát hoặc ra ngoài mép bo (báo đỏ): dời linh kiện / dây vào trong. Mass tự cập nhật; bấm Mass lại nếu cần.`, ` ${bad} spots are at / outside the edge (red): move parts / traces inside. The pour updates by itself; press Pour again if needed.`) : L(" Mass tự cập nhật.", " The pour updates by itself.")));
  }
  function exportSVG(kind, mirror) {
    const B = S.board, P = pads(), o = [];
    o.push(`<svg xmlns="${NS}" width="${B.w}mm" height="${B.h}mm" viewBox="0 0 ${B.w} ${B.h}"><rect width="${B.w}" height="${B.h}" fill="#fff"/>`);
    o.push(`<g${mirror ? ` transform="translate(${B.w} 0) scale(-1 1)"` : ""}>${B.poly ? `<path d="${outlineD()}" fill="none" fill-rule="evenodd" stroke="#000" stroke-width=".2"/>` : `<rect x=".1" y=".1" width="${B.w - .2}" height="${B.h - .2}" rx="1.5" fill="none" stroke="#000" stroke-width=".2"/>`}`);
    for (const [x, y] of mountHoles()) o.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="none" stroke="#000" stroke-width=".3"/>`);
    if (kind === "cu") {
      if (S.pour) o.push(`<path d="${pour().d}" fill="#000"/>`);
      o.push(artSVG("cu"));
      for (const t of S.traces) o.push(`<path d="M${t.pts.map(p => p.join(" ")).join(" L")}" fill="none" stroke="#000" stroke-width="${traceW(t)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      for (const p of P) { const r = p.r || PAD_R; o.push(p.pw && p.ph ? `<rect x="${p.x - p.pw / 2}" y="${p.y - p.ph / 2}" width="${p.pw}" height="${p.ph}" fill="#000"/>` : p.sq ? `<rect x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}" fill="#000"/>` : `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#000"/>`); if (!p.smd) o.push(`<circle cx="${p.x}" cy="${p.y}" r=".3" fill="#fff"/>`); }
    } else if (kind === "mark") {
      // ký hiệu in lụa (sơn trắng) mặt linh kiện: nét mảnh 0,15 mm, đánh dấu chân 1, tên + giá trị, dây nhảy.
      // Chừa trống quanh mọi chân (vòng trắng che lên) để sơn không phủ vào lỗ / chỗ hàn
      for (const c of S.comps) {
        const f = FP[c.fp], b = f.body, cx = b.x + b.w / 2, cy = b.y + b.h / 2, p1 = f.pads.find(p => p.sq) || f.pads[0];
        o.push(`<g transform="translate(${c.x} ${c.y}) rotate(${c.rot})"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${f.round ? b.h / 2 : .6}" fill="none" stroke="#000" stroke-width=".15"/>`
          + (p1 ? `<circle cx="${p1.x - PAD_R - .9}" cy="${p1.y}" r=".35" fill="#000"/>` : "") + hdrText(f, 1.0, c.fp, c)
          + (f.label && !c.bl ? `<text x="${cx}" y="${cy}" font-size="1.6" font-family="sans-serif" text-anchor="middle" dominant-baseline="central"${c.rot % 180 ? ` transform="rotate(-90 ${cx} ${cy})"` : ""}>${f.label}</text>` : "")
          + (c.rl ? "" : `<text x="${b.x + .4}" y="${b.y - .6}" font-size="1.3" font-weight="700" font-family="sans-serif">${c.lbl || c.id}${c.val ? " " + c.val : ""}</text>`) + "</g>" + (c.rl ? refSvg(c, 1.3) : "") + (c.bl && f.label ? bodySvg(c, f.label, 1.6) : ""));
      }
      for (const j of S.jumpers.filter(j => !noWire(j))) o.push(`<line x1="${j.a[0]}" y1="${j.a[1]}" x2="${j.b[0]}" y2="${j.b[1]}" stroke="#000" stroke-width=".15" stroke-dasharray=".8 .5"/>` + jText(j, 1.2));
      for (const p of P) o.push(`<circle cx="${p.x}" cy="${p.y}" r="${(p.r || PAD_R) + .25}" fill="#fff"/>`);
    } else if ((LYR(kind) || {}).kind === "paint") {
      o.push(artSVG(kind));
    } else {
      for (const c of S.comps) {
        const f = FP[c.fp], b = f.body, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        o.push(`<g transform="translate(${c.x} ${c.y}) rotate(${c.rot})"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${f.round ? b.h / 2 : .6}" fill="none" stroke="#000" stroke-width=".2"/>`
          + hdrText(f, 1.1, c.fp, c) + (f.label && !c.bl ? `<text x="${cx}" y="${cy}" font-size="2" font-family="sans-serif" text-anchor="middle" dominant-baseline="central"${c.rot % 180 ? ` transform="rotate(-90 ${cx} ${cy})"` : ""}>${f.label}</text>` : "")
          + (c.rl ? "" : `<text x="${b.x + .6}" y="${b.y - .8}" font-size="1.5" font-weight="700" font-family="sans-serif">${c.lbl || c.id}${c.val ? " " + c.val : ""}</text>`) + "</g>" + (c.rl ? refSvg(c, 1.5) : "") + (c.bl && f.label ? bodySvg(c, f.label, 2) : ""));
      }
      for (const p of P) o.push(`<circle cx="${p.x}" cy="${p.y}" r="${(p.r || PAD_R) * .8}" fill="none" stroke="#000" stroke-width=".15"/>`);
      for (const j of S.jumpers.filter(j => !noWire(j))) o.push(`<line x1="${j.a[0]}" y1="${j.a[1]}" x2="${j.b[0]}" y2="${j.b[1]}" stroke="#000" stroke-width=".35" stroke-linecap="round"/>` + jText(j, 1.4));
    }
    return o.join("") + "</g></svg>";
  }
  const SAVE_DIR_KEY = "pindexio:savedir";
  let curDirHandle = null;
  const getSaveDir = () => { if (window.APP && APP.getSaveDir) return APP.getSaveDir(); try { return localStorage.getItem(SAVE_DIR_KEY) || ""; } catch (e) { return ""; } };
  const setSaveDir = v => { if (window.APP && APP.setSaveDir) return APP.setSaveDir(v); try { const s = (v || "").trim(); if (s) localStorage.setItem(SAVE_DIR_KEY, s); else localStorage.removeItem(SAVE_DIR_KEY); } catch (e) { } };
  const clearSaveDir = () => { curDirHandle = null; if (window.APP && APP.clearSaveDir) return APP.clearSaveDir(); try { localStorage.removeItem(SAVE_DIR_KEY); } catch (e) { } };
  const pickSaveDir = async () => {
    if (window.APP && APP.pickSaveDir) return APP.pickSaveDir();
    if (window.showDirectoryPicker) {
      try {
        const h = await window.showDirectoryPicker({ mode: "readwrite" });
        curDirHandle = h;
        setSaveDir(h.name);
        return h.name;
      } catch (e) {
        if (e && e.name === "AbortError") return null;
      }
    } else {
      toast(L("Trình duyệt không hỗ trợ mở cửa sổ chọn thư mục (cần Chrome/Edge). Bạn có thể gõ hoặc dán đường dẫn thư mục vào ô.", "Browser does not support folder picker (requires Chrome/Edge). You can type or paste folder path into the input."));
    }
    return null;
  };
  const showPcbBom = () => {
    if (!window.showBomPopup) return;
    const items = (S.comps || []).filter(c => !isHost(c)).map(c => {
      const f = FP[c.fp] || {};
      const n = f.name || c.val || c.fp;
      return { id: c.fp, name: n, query: String(n).replace(/\(.*?\)/g, "").trim() };
    });
    window.showBomPopup({ mode: "pcblab", boardId: (hostInfo() && hostInfo().id) || "esp32-s3-devkitc-1", items });
  };
  const download = async (blob, name, forceBrowser) => {
    if (window.APP && APP.saveFile) { const r = await APP.saveFile(name, blob, forceBrowser); if (!r || !r.aborted) showPcbBom(); return r; }
    if (!forceBrowser && curDirHandle) {
      try {
        const lastDot = name.lastIndexOf(".");
        const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;
        const extName = lastDot > 0 ? name.slice(lastDot) : "";
        let targetName = name, counter = 1;
        while (true) {
          try {
            await curDirHandle.getFileHandle(targetName);
            targetName = `${baseName} (${counter})${extName}`;
            counter++;
          } catch (e) { break; }
        }
        const fh = await curDirHandle.getFileHandle(targetName, { create: true });
        const wr = await fh.createWritable();
        await wr.write(blob);
        await wr.close();
        showPcbBom();
        return { ok: true, dir: curDirHandle.name, name: targetName };
      } catch (e) {
        console.warn("curDirHandle error:", e);
        curDirHandle = null;
      }
    }
    const dir = forceBrowser ? "" : (getSaveDir() || "").trim();
    if (!forceBrowser && dir && (!curDirHandle || dir !== curDirHandle.name)) {
      try {
        const r = await fetch("/__save_local", {
          method: "POST",
          headers: { "X-Save-Dir": encodeURIComponent(dir), "X-Save-Name": encodeURIComponent(name) },
          body: blob
        });
        if (r.ok && (r.headers.get("content-type") || "").includes("application/json")) {
          const j = await r.json();
          if (j && j.ok) { showPcbBom(); return { ok: true, dir: j.dir || dir, path: j.path, name: j.name || name }; }
        }
      } catch (e) { }
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showPcbBom();
    return { ok: true, dir: "" };
  };
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
  async function buildPdfBlob(layers, baseName) {
    const PT = 72 / 25.4, dpi = 600, B = S.board;
    const enc = new TextEncoder(), chunks = [];
    let offset = 0;
    const pushBytes = u8 => { chunks.push(u8); offset += u8.length; };
    const pushStr = s => pushBytes(enc.encode(s));
    const renderJpeg = (kind, mirror) => new Promise(ok => {
      const svgTxt = exportSVG(kind, mirror), img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(B.w / 25.4 * dpi));
        cv.height = Math.max(1, Math.round(B.h / 25.4 * dpi));
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(b => b.arrayBuffer().then(buf => ok({ bytes: new Uint8Array(buf), w: cv.width, h: cv.height })), "image/jpeg", 0.98);
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTxt);
    });
    const pagesData = [];
    for (const item of layers) {
      const jpg = await renderJpeg(item.k, item.mir);
      pagesData.push({ ...item, ...jpg });
    }
    pushBytes(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,0x25,0xe2,0xe3,0xcf,0xd3,0x0a]));
    const offsets = [0];
    const beginObj = id => { offsets[id] = offset; pushStr(id + " 0 obj\n"); };
    const endObj = () => pushStr("\nendobj\n");
    const totalObjs = 3 + pagesData.length * 3;
    const pageIds = pagesData.map((_, i) => 4 + i * 3);
    beginObj(1); pushStr("<< /Type /Catalog /Pages 2 0 R >>"); endObj();
    beginObj(2); pushStr(`<< /Type /Pages /Kids [${pageIds.map(id => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>`); endObj();
    beginObj(3); pushStr("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); endObj();
    const escPdf = s => String(s).replace(/[\\()]/g, ch => "\\" + ch).replace(/[^\x20-\x7e]/g, " ");
    pagesData.forEach((pg, idx) => {
      const pId = 4 + idx * 3, cId = pId + 1, iId = pId + 2;
      const land = B.w > 195 && B.h <= 195;
      const pw = land ? 841.89 : 595.28, ph = land ? 595.28 : 841.89;
      const wPt = +(B.w * PT).toFixed(3), hPt = +(B.h * PT).toFixed(3);
      const xPt = +((pw - wPt) / 2).toFixed(3), yPt = +((ph - hPt) / 2).toFixed(3);
      const label = escPdf(`${baseName} | ${pg.slug}${pg.mir ? " (mirror)" : ""} | ${B.w}x${B.h} mm | 1:1`);
      const streamTxt = `q ${wPt} 0 0 ${hPt} ${xPt} ${yPt} cm /Im0 Do Q\nBT /F1 8.5 Tf 36 ${(ph - 26).toFixed(2)} Td (${label}) Tj ET\n`;
      beginObj(pId);
      pushStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${iId} 0 R >> /Font << /F1 3 0 R >> >> /Contents ${cId} 0 R >>`);
      endObj();
      beginObj(cId);
      pushStr(`<< /Length ${streamTxt.length} >>\nstream\n${streamTxt}endstream`);
      endObj();
      beginObj(iId);
      pushStr(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`);
      pushBytes(pg.bytes);
      pushStr("\nendstream");
      endObj();
    });
    const xrefOff = offset;
    pushStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
    for (let id = 1; id <= totalObjs; id++) pushStr(String(offsets[id]).padStart(10, "0") + " 00000 n \n");
    pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF`);
    return new Blob(chunks, { type: "application/pdf" });
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
        clearRegion: pts => { body.push("%LPC*%", "G36*"); [...pts, pts[0]].forEach((p, i) => body.push(X(p[0], p[1]) + (i ? "D01*" : "D02*"))); body.push("G37*", "%LPD*%"); },
        region: pts => { body.push("G36*"); [...pts, pts[0]].forEach((p, i) => body.push(X(p[0], p[1]) + (i ? "D01*" : "D02*"))); body.push("G37*"); },
        flash: (x, y, d, sq, pw, ph) => { use(pw && ph ? `R,${pw.toFixed(3)}X${ph.toFixed(3)}` : sq ? `R,${d.toFixed(3)}X${d.toFixed(3)}` : `C,${d.toFixed(3)}`); body.push(X(x, y) + "D03*"); }
      };
      draw(api);
      return [...head(fn), ...[...ap].map(([k, d]) => `%ADD${d}${k}*%`), "G01*", ...body, "M02*"].join("\n") + "\n";
    };
    const padD = p => 2 * (p.r || PAD_R);
    const artG = (g, ly) => { for (const it of S.art || []) if ((LYR(it.layer) || {}).kind === ly || ((ly === "top" || ly === "bot") && (LYR(it.layer) || {}).kind === "paint" && ((LYR(it.layer).side === "bottom") === (ly === "bot")))) for (const pa of it.paths) { if (pa.hole && it.fill) { g.clearRegion(pa.pts); continue; } if (it.fill && pa.closed && pa.pts.length > 2) g.region(pa.pts); g.line(pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts.length > 1 ? pa.pts : [pa.pts[0], pa.pts[0]], it.w); } };
    const cu = layer("Copper,L2,Bot", g => { for (const t of S.traces) g.line(t.pts, traceW(t)); for (const p of P) g.flash(p.x, p.y, padD(p), p.sq, p.pw, p.ph); artG(g, "cu"); });
    const mask = layer("Soldermask,Bot", g => { for (const p of P) g.flash(p.x, p.y, padD(p) + .2, p.sq, p.pw ? p.pw + .2 : 0, p.ph ? p.ph + .2 : 0); });
    const silk = layer("Legend,Top", g => {
      for (const c of S.comps) {
        const b = FP[c.fp].body, q = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x, b.y]].map(([x, y]) => { const [u, v] = rot(x, y, c.rot); return [c.x + u, c.y + v]; });
        g.line(q, .15);
      }
      for (const j of S.jumpers.filter(j => !noWire(j))) g.line([j.a, j.b], .15);
      artG(g, "top");
    });
    const silkB = layer("Legend,Bot", g => artG(g, "bot"));
    const edge = layer("Profile,NP", g => { const o = outlineOf(); for (const ring of [o.outer, ...o.holes]) g.line([...ring, ring[0]], .1); });
    // khoan: lỗ chân linh kiện, lỗ dây nhảy / lỗ đơn, 4 lỗ bắt vít góc
    const holes = new Map(), add = (d, x, y) => { const k = d.toFixed(2); if (!holes.has(k)) holes.set(k, []); holes.get(k).push([x, y]); };
    for (const p of P) if (!p.smd) add((p.jw || (p.hole && !p.hole.pad)) ? (p.drill || DRILL.jw) : (p.drill || DRILL.pad), p.x, p.y);
    for (const [x, y] of mountHoles()) add(DRILL.mount, x, y);
    const tl = [...holes.keys()], f3 = v => v.toFixed(3);
    const drl = ["M48", "; Pindexio PCB Maker", "METRIC,TZ", ...tl.map((d, i) => `T${i + 1}C${d}`), "%", "G90", "G05",
      ...tl.flatMap((d, i) => [`T${i + 1}`, ...holes.get(d).map(([x, y]) => `X${f3(x)}Y${f3(B.h - y)}`)]), "M30"].join("\n") + "\n";
    return [["copper_bottom.gbl", cu], ["soldermask_bottom.gbs", mask], ["silkscreen_top.gto", silk], ...((S.art || []).some(i => (LYR(i.layer) || {}).kind === "paint" && LYR(i.layer).side === "bottom") ? [["silkscreen_bottom.gbo", silkB]] : []), ["board_outline.gko", edge], ["drill.drl", drl]];
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
    ...S.layers.filter(l => l.kind === "paint" && (S.art || []).some(i => i.layer === l.id)).map(l => [l.id, l.name, l.side === "bottom" ? L("sơn mặt dưới (in lên mặt đồng)", "paint, bottom side") : L("sơn mặt trên (mặt linh kiện)", "paint, component side"), "layer-" + l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")]),
    ["silk", L("Mặt linh kiện", "Component side"), L("hướng dẫn cắm linh kiện", "assembly guide"), "mat-linh-kien"]];
  /* ---------- thẻ "Mua linh kiện cho mạch này" (tiếp thị liên kết): hiện sau khi tải ảnh / PDF / Gerber ---------- */
  function buyItems() {   // board + module + linh kiện đang dùng trong dự án, gộp theo tên
    const items = [], reg = (() => { const A0 = window.AFFILIATE || {}; try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; if (/Ho_Chi_Minh|Saigon|Bangkok/.test(tz) && A0.vn) return "vn"; } catch (e) { } return /^vi/i.test(navigator.language || "") && A0.vn ? "vn" : "intl"; })();   // cùng cách đoán vùng với thẻ Mua board
    const A = ((window.AFFILIATE || {})[reg]) || {}, links = A.links || {}, vn = reg === "vn";
    const url = (key, name0) => { if (window.affUrl) return window.affUrl({ id: key, name: name0, boardId: key }, reg).url; const name = name0.replace(/\s*\([^)]*\)/g, "").trim() || name0; return links[key] || (vn ? "https://shopee.vn/search?keyword=" + encodeURIComponent(name) : "https://www.aliexpress.com/w/wholesale-" + encodeURIComponent(name.replace(/\s+/g, "-")) + ".html"); };
    const brd = SITE && window.BOARDS && BOARDS.find(x => x.id === S.mcu);
    const bn = brd ? brd.name : NAME.S3; if (bn) items.push({ name: bn, n: 1, href: url(S.mcu || "esp32-s3-devkitc-1", bn), aff: window.affUrl ? window.affUrl({ id: S.mcu, name: bn, boardId: S.mcu }, reg).aff : !!links[S.mcu], board: true });
    const cnt = {};
    for (const c of S.comps) { const f = FP[c.fp]; if (!f || f.hdr || f.brd || c.fp === "S3" || String(c.fp).startsWith("BRD:") || String(c.fp).startsWith("HDR:")) continue; const key = c.fp.startsWith("pinHdr") ? "pinHdr" : c.fp, nm = String(NAME[key] || key); (cnt[key] = cnt[key] || { key, name: nm, n: 0 }).n++; }
    for (const k in cnt) { const c = cnt[k]; items.push({ name: c.name, n: c.n, href: url(c.key, c.name), aff: window.affUrl ? window.affUrl({ id: c.key, name: c.name }, reg).aff : !!links[c.key] }); }
    return { items, shop: A.shop || (vn ? "Shopee" : "AliExpress") };
  }
  function buyPopup() {
    const st = $("#plStage"); if (!st) return; const old = $("#plBuyCard"); if (old) old.remove();
    const { items, shop } = buyItems(); if (!items.length) return;
    const card = document.createElement("div"); card.id = "plBuyCard";
    card.style.cssText = "position:absolute;right:10px;bottom:10px;z-index:9;width:250px;max-height:60%;display:flex;flex-direction:column;background:#26282d;border:1px solid #3f4248;border-radius:3px;box-shadow:0 6px 20px rgba(0,0,0,.45);font:11.5px var(--sans);color:#dcdedf;overflow:hidden";
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 7px;background:#35373b;font:600 10.5px var(--sans);color:#e5e7eb"><span title="' + attr(L("Liên kết tiếp thị – Pindexio có thể nhận hoa hồng, giá không đổi", "Affiliate links – Pindexio may earn a commission, price unchanged")) + '">' + L("Mua linh kiện cho mạch này", "Buy parts for this circuit") + '</span><button type="button" data-x style="border:0;background:transparent;color:#9aa0a6;cursor:pointer;font-size:13px;line-height:1;padding:0 2px">✕</button></div>'
      + '<div style="overflow:auto;padding:3px">' + items.slice(0, 12).map(it => '<div style="display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:2px"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + attr(it.name) + '">' + attr(it.name) + (it.n > 1 ? ' <small style="color:#9aa0a6">×' + it.n + '</small>' : '') + '</span><a href="' + attr(it.href) + '" target="_blank" rel="sponsored noopener" style="flex:none;padding:2px 8px;border-radius:3px;background:#1e1f22;border:1px solid #3f4248;color:' + (it.aff ? 'var(--accent,#dc8e43)' : '#dcdedf') + ';text-decoration:none;font-size:10.5px;font-weight:600">' + attr(shop) + ' ↗</a></div>').join("") + '</div>';
    card.querySelector("[data-x]").onclick = () => card.remove();
    st.appendChild(card);
  }
  /* ---------- Tạo PCB: vẽ hình bo bằng chuột (chữ nhật / tròn kéo thả, đa giác bấm từng điểm), xong hiện bảng tham số ---------- */
  let nbShow = () => {};   // mở lại bảng tham số (gán trong tools())
  const nbSn = v => S.snapG === false ? r3(v) : snap(v, snapStep());
  function nbDrawShape(sh, g) {   // vẽ hình xem trước trên lớp tmp
    LY.tmp.innerHTML = "";
    const st = { fill: "rgba(76,139,245,.14)", stroke: "#4c8bf5", "stroke-width": .45, "stroke-dasharray": "1.2 .7", "pointer-events": "none" };
    if (sh === "rect") el("rect", { x: g.x0, y: g.y0, width: g.w, height: g.h, rx: g.rx || 0, ...st }, LY.tmp);
    else if (sh === "circle") el("circle", { cx: g.cx, cy: g.cy, r: g.d / 2, ...st }, LY.tmp);
    else if (g.pts && g.pts.length) {
      const d = "M" + g.pts.map(q => q.join(" ")).join(" L") + (g.closed ? " Z" : "");
      el("path", { d, ...st, fill: g.closed ? st.fill : "none" }, LY.tmp);
      if (!g.closed) el("circle", { cx: g.pts[0][0], cy: g.pts[0][1], r: 1.1, fill: "#4c8bf5", "pointer-events": "none" }, LY.tmp);
    }
    const lab = sh === "rect" ? r3(g.w) + " × " + r3(g.h) + " mm" : sh === "circle" ? "Ø " + r3(g.d) + " mm" : "";
    if (lab) el("text", { x: sh === "rect" ? g.x0 + g.w / 2 : g.cx, y: sh === "rect" ? g.y0 + g.h / 2 : g.cy, "font-size": 2.4, fill: "#fff", "text-anchor": "middle", "dominant-baseline": "central", "pointer-events": "none" }, LY.tmp, lab);
  }
  function startNewBoard(sh) {
    cancel(); setTool("sel"); ui.mode = "newb"; ui.nb = { sh, pts: [], a: null, cur: null, drag: false }; svg.classList.add("routing");
    LY.tmp.innerHTML = "";
    $("#plHint").textContent = sh === "rect" ? L("Kéo chuột để vẽ hình chữ nhật · Esc huỷ", "Drag to draw a rectangle · Esc cancels") : sh === "circle" ? L("Bấm tâm rồi kéo ra để vẽ hình tròn · Esc huỷ", "Click the centre and drag out to draw a circle · Esc cancels") : L("Bấm từng điểm; bấm lại điểm đầu, Enter hoặc chuột phải để khép kín · Esc huỷ", "Click each corner; click the first point, Enter or right-click to close · Esc cancels");
  }
  function nbGeom() {
    const N = ui.nb; if (!N) return null;
    if (N.sh === "rect" && N.a && N.cur) { const x0 = Math.min(N.a[0], N.cur[0]), y0 = Math.min(N.a[1], N.cur[1]); return { x0, y0, w: Math.abs(N.cur[0] - N.a[0]), h: Math.abs(N.cur[1] - N.a[1]) }; }
    if (N.sh === "circle" && N.a && N.cur) return { cx: N.a[0], cy: N.a[1], d: 2 * Math.hypot(N.cur[0] - N.a[0], N.cur[1] - N.a[1]) };
    if (N.sh === "poly") return { pts: N.cur && !N.done ? [...N.pts, N.cur] : N.pts, closed: !!N.done };
    return null;
  }
  function nbDown(p) {
    const N = ui.nb, q = [nbSn(p.x), nbSn(p.y)];
    if (N.sh === "poly") {
      if (N.pts.length >= 3 && (Math.hypot(q[0] - N.pts[0][0], q[1] - N.pts[0][1]) < 2 || Math.hypot(q[0] - N.pts.at(-1)[0], q[1] - N.pts.at(-1)[1]) < .3)) return nbFinish();
      if (!N.pts.length || Math.hypot(q[0] - N.pts.at(-1)[0], q[1] - N.pts.at(-1)[1]) > .3) N.pts.push(q);
      N.cur = q; return nbDrawShape("poly", nbGeom());
    }
    N.a = q; N.cur = q; N.drag = true; nbDrawShape(N.sh, nbGeom());
  }
  function nbMove(p) {
    const N = ui.nb; if (!N) return; N.cur = [nbSn(p.x), nbSn(p.y)];
    if (N.sh === "poly") { if (N.pts.length) nbDrawShape("poly", nbGeom()); } else if (N.drag) nbDrawShape(N.sh, nbGeom());
  }
  function nbUp() {
    const N = ui.nb; if (!N || !N.drag) return; N.drag = false; const g = nbGeom();
    if (!g || (N.sh === "rect" ? g.w < 5 || g.h < 5 : g.d < 5)) { LY.tmp.innerHTML = ""; return; }   // kéo quá nhỏ: bỏ, vẽ lại
    nbFinish();
  }
  function nbFinish() {
    const N = ui.nb; if (!N) return; let P = null;
    if (N.sh === "poly") { if (N.pts.length < 3) return; const xs = N.pts.map(q => q[0]), ys = N.pts.map(q => q[1]), x0 = Math.min(...xs), y0 = Math.min(...ys); P = { shape: "poly", pts: N.pts.map(q => [...q]), x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }; if (P.w < 5 || P.h < 5) return; }
    else { const g = nbGeom(); if (!g) return; P = N.sh === "rect" ? { shape: "rect", x0: g.x0, y0: g.y0, w: g.w, h: g.h } : { shape: "circle", cx: g.cx, cy: g.cy, d: g.d, w: g.d, h: g.d }; }
    ui.nbPending = P; ui.nb = null; ui.mode = "idle"; svg.classList.remove("routing"); $("#plHint").textContent = "";
    nbShow(P);
  }
  function exportDialog() {
    { const n = pendingAuto().length; if (n) toast(L(`Còn ${n} chân tự nối chưa được bạn xác nhận. Hãy kiểm tra trước khi đi in.`, `${n} auto-wired pins are still unconfirmed. Check them before printing.`)); }
    let o; try { o = JSON.parse(localStorage.getItem("pcbmaker-exp") || "null"); } catch (e) { }
    o = Object.assign({ name: "pindexio-pcb", fmt: "svg", on: { cu: 1 }, mir: { mark: 1 } }, o || {});
    for (const l of S.layers) if (l.kind === "paint" && o.on[l.id] === undefined) o.on[l.id] = 1;
    const d = document.createElement("div"); d.className = "pl-beta pl-exp"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    const draw = () => {
      const gbr = o.fmt === "gbr", first = LAYERS().find(l => o.on[l[0]]), curDir = getSaveDir().replace(/"/g, "&quot;");
      d.innerHTML = `<div class="pl-exp-box"><h3>${L("Xuất file", "Export")}</h3>
        <label class="pl-exp-row"><span>${L("Tên file", "File name")}</span><input id="plExpName" value="${o.name.replace(/"/g, "")}" spellcheck="false"></label>
        <div class="pl-exp-row"><span>${L("Nơi lưu", "Save to")}</span><div class="pl-exp-dir"><input id="plExpDir" value="${curDir}" placeholder="${L("Mặc định: thư mục Downloads (nhập đường dẫn hoặc bấm Chọn…)", "Default: Downloads folder (type path or click Browse…)")}" spellcheck="false"><button type="button" id="plExpDirPick" title="${L("Chọn thư mục lưu file", "Choose save folder")}">📁 ${L("Chọn…", "Browse…")}</button><button type="button" id="plExpDirClr" title="${L("Đặt lại về thư mục Downloads mặc định", "Reset to default Downloads folder")}"${curDir ? "" : " hidden"}>✕</button></div></div>
        <div class="pl-exp-row"><span>${L("Định dạng", "Format")}</span><div class="pl-seg">${[["svg", "SVG"], ["png", "PNG"], ["pdf", "PDF"], ["gbr", "Gerber"]].map(([k, t]) => `<button type="button" data-fmt="${k}"${o.fmt === k ? ' class="on"' : ""}>${t}</button>`).join("")}</div></div>
        <p class="pl-exp-sub">${{ svg: L("Vector, in tỉ lệ 100%", "Vector, print at 100%"), png: L("Ảnh 600 DPI, in tỉ lệ 100%", "600 DPI image, print at 100%"), pdf: L("Khổ A4 tỉ lệ 1:1, gộp các lớp chọn vào 1 file .pdf", "A4 1:1 scale, combines selected layers into one .pdf"), gbr: L("Gửi xưởng làm bo / phay CNC · 1 file .zip", "For PCB fabs / CNC milling · one .zip") }[o.fmt]}</p>
        ${gbr ? `<ul class="pl-exp-files">${gerber().map(([n]) => `<li>${n}</li>`).join("")}</ul>${S.pour ? `<p class="pl-exp-warn">${L("Phủ mass GND chưa có trong Gerber.", "GND pour is not included in Gerber.")}</p>` : ""}`
          : `<div class="pl-exp-layers">${LAYERS().map(([k, t, sub]) => `<label class="pl-exp-l${o.on[k] ? " on" : ""}"><input type="checkbox" data-on="${k}"${o.on[k] ? " checked" : ""}><span><b>${t}</b><small>${sub}</small></span>${k === "silk" ? "" : `<button type="button" class="pl-mir${o.mir[k] ? " on" : ""}" data-mir="${k}" title="${L("Lật gương", "Mirror")}">⇋</button>`}</label>`).join("")}</div>
             <div class="pl-exp-prev">${first ? exportSVG(first[0], !!o.mir[first[0]]) : `<span>${L("Chọn ít nhất 1 lớp", "Pick at least one layer")}</span>`}</div>`}
        ${A.rats.length || A.drc.length ? `<p class="pl-exp-warn">${L(`Bo còn ${A.rats.length} chỗ chưa nối, ${A.drc.length} lỗi – file chỉ nên dùng để xem thử.`, `${A.rats.length} open connections, ${A.drc.length} errors – use the file as a preview only.`)}</p>` : ""}
        <div class="pl-exp-foot"><button type="button" class="pl-exp-cancel">${L("Huỷ", "Cancel")}</button><button type="button" class="pl-try" id="plExpGo"${!gbr && !first ? " disabled" : ""}>${curDir ? `💾 ${L("Lưu file", "Save file")}` : `⬇ ${L("Tải xuống", "Download")}`}</button></div></div>`;
      d.querySelector("#plExpName").oninput = e => o.name = e.target.value;
      const dirInp = d.querySelector("#plExpDir"), dirClr = d.querySelector("#plExpDirClr");
      const updateBtn = () => {
        const hasDir = !!dirInp.value.trim();
        const goBtn = d.querySelector("#plExpGo");
        if (goBtn) {
          goBtn.textContent = hasDir ? `💾 ${L("Lưu file", "Save file")}` : `⬇ ${L("Tải xuống", "Download")}`;
          goBtn.title = hasDir ? (L("Lưu vào: ", "Save to: ") + dirInp.value.trim()) : (L("Tải về thư mục Downloads của trình duyệt", "Download to browser Downloads folder"));
        }
      };
      dirInp.oninput = () => { setSaveDir(dirInp.value); dirClr.hidden = !dirInp.value.trim(); updateBtn(); };
      d.querySelector("#plExpDirPick").onclick = async () => { const p = await pickSaveDir(); if (p != null) { dirInp.value = p; dirClr.hidden = !p; updateBtn(); } };
      dirClr.onclick = () => { clearSaveDir(); dirInp.value = ""; dirClr.hidden = true; updateBtn(); };
      d.querySelectorAll("[data-fmt]").forEach(b => b.onclick = () => { o.fmt = b.dataset.fmt; draw(); });
      d.querySelectorAll("[data-on]").forEach(b => b.onchange = () => { o.on[b.dataset.on] = b.checked ? 1 : 0; draw(); });
      d.querySelectorAll("[data-mir]").forEach(b => b.onclick = e => { e.preventDefault(); o.mir[b.dataset.mir] = o.mir[b.dataset.mir] ? 0 : 1; draw(); });
      d.querySelector(".pl-exp-cancel").onclick = () => d.remove();
      d.querySelector("#plExpGo").onclick = () => go(false);
      const box = d.querySelector(".pl-exp-box"); if (box) box.onclick = e => e.stopPropagation();
    };
    async function go(forceBrowser) {
      const dirEl = d.querySelector("#plExpDir"); if (dirEl) setSaveDir(dirEl.value);
      const base = (o.name || "pindexio-pcb").trim().replace(/[\\/:*?"<>|]+/g, "-");
      try { localStorage.setItem("pcbmaker-exp", JSON.stringify(o)); } catch (e) { } TRK("export", o.fmt);
      d.remove();
      if (o.fmt === "gbr") { const r = await download(await zip(gerber()), base + "-gerber.zip", forceBrowser); if (r && r.aborted) return; const finalName = (r && r.name) || (base + "-gerber.zip"); return buyPopup(), toast(r && r.dir ? L(`Đã lưu ${finalName} vào thư mục: ${r.dir}.`, `Saved ${finalName} to ${r.dir}.`) : L(`Đã tải ${finalName} về trình duyệt.`, `Downloaded ${finalName} (bottom copper, mask, silkscreen, outline, drill).`)); }
      if (o.fmt === "pdf") {
        const selLayers = LAYERS().filter(([k]) => o.on[k]).map(([k, , , slug]) => ({ k, slug, mir: !!o.mir[k] }));
        const pdfBlob = await buildPdfBlob(selLayers, base);
        const r = await download(pdfBlob, base + ".pdf", forceBrowser);
        if (r && r.aborted) return;
        const finalName = (r && r.name) || (base + ".pdf");
        return buyPopup(), toast(r && r.dir ? L(`Đã lưu ${finalName} vào thư mục: ${r.dir} – in A4 tỉ lệ 100%.`, `Saved ${finalName} to ${r.dir} – print A4 at 100% scale.`) : L(`Đã tải ${finalName} về trình duyệt – in A4 tỉ lệ 100%.`, `Downloaded ${finalName} – print A4 at 100% scale (no fit-to-page).`));
      }
      const files = [];
      for (const [k, , , slug] of LAYERS()) if (o.on[k]) files.push([`${base}-${slug}${o.mir[k] ? "-lat-guong" : ""}.${o.fmt}`, await layerBlob(k, !!o.mir[k], o.fmt)]);
      const outName = files.length > 1 ? `${base}-${o.fmt}.zip` : files[0][0];
      const r = files.length === 1 ? await download(files[0][1], files[0][0], forceBrowser) : await download(await zip(files), outName, forceBrowser);
      if (r && r.aborted) return;
      const finalName = (r && r.name) || outName;
      buyPopup(), toast(r && r.dir ? L(`Đã lưu ${finalName} vào thư mục: ${r.dir} – in tỉ lệ 100%.`, `Saved ${finalName} to ${r.dir} – print at 100% scale.`) : L(`Đã tải ${finalName} về trình duyệt – in tỉ lệ 100%.`, `Downloaded ${finalName} – print at 100% scale (no fit-to-page).`));
    }
    let downTarget = null; d.onpointerdown = e => { downTarget = e.target; }; d.onclick = e => { if (downTarget === d && e.target === d) d.remove(); downTarget = null; };
    draw(); ROOT.appendChild(d); const nameInp = d.querySelector("#plExpName"); if (nameInp) nameInp.focus();
  }

  /* ---------- camera ---------- */
  function fit() { const B = S.board; cam = { x: -6, y: -6, w: B.w + 12, h: B.h + 12 }; applyCam(); }
  function applyCam() {
    const r = svg.getBoundingClientRect(); if (!r.width || !r.height) return;
    const ar = r.width / r.height, c = cam;
    let w = c.w, h = c.h; if (w / h < ar) w = h * ar; else h = w / ar;
    svg.setAttribute("viewBox", `${c.x - (w - c.w) / 2} ${c.y - (h - c.h) / 2} ${w} ${h}`); ui.k = w / r.width; drawRulers();
    if (typeof renderJumperPop === "function") renderJumperPop();
    if (typeof renderPinHdrPop === "function") renderPinHdrPop();
    if (window.SketchWBPlugin && window.SketchWBPlugin.onPcbViewChange) window.SketchWBPlugin.onPcbViewChange();
  }
  /* hai thước mm: cạnh trên (X) và cạnh trái (Y), gốc 0 ở góc trên-trái của bo; đi theo zoom / kéo; vạch xanh = vị trí chuột */
  function drawRulers() {
    const T = $("#plRulerT"), Lc = $("#plRulerL"), st = $("#plStage"); if (!T || !Lc || !st) return;
    const W = st.clientWidth, H = st.clientHeight, dpr = devicePixelRatio || 1, TH = 18, LW = 26, m = svg.getScreenCTM(); if (!m || !W || !H) return;
    T.width = W * dpr; T.height = TH * dpr; T.style.width = W + "px"; T.style.height = TH + "px"; Lc.width = LW * dpr; Lc.height = H * dpr; Lc.style.width = LW + "px"; Lc.style.height = H + "px";
    const sr = st.getBoundingClientRect(), kx = m.a, ox = m.e - sr.left, ky = m.d, oy = m.f - sr.top, B = S.board;
    const isIn = S.unit === "in", uK = isIn ? 25.4 : 1;
    const nice = isIn ? [.05, .1, .2, .5, 1, 2, 5, 10] : [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    const major = nice.find(v => v * uK * Math.abs(kx) >= 48) || nice[nice.length - 1], minor = major / (/^2/.test(String(major)) ? 4 : 5);
    const paint = (c, len, along, k, o, bw, mouse) => {
      c.scale(dpr, dpr); c.fillStyle = "rgba(14,19,25,.86)"; c.fillRect(0, 0, along ? len : LW, along ? TH : len);
      c.fillStyle = "rgba(255,255,255,.09)"; if (along) c.fillRect(o, 0, bw * k, TH); else c.fillRect(0, o, LW, bw * k);
      c.strokeStyle = "#8d98a6"; c.fillStyle = "#c7cfd9"; c.font = "10px sans-serif"; c.lineWidth = 1; c.beginPath();
      const v0 = Math.floor(-o / (k * uK) / minor) * minor, v1 = (len - o) / (k * uK);
      for (let v = v0; v <= v1 + 1e-6; v += minor) {
        const p = Math.round(o + v * uK * k) + .5, isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6, size = isMajor ? 9 : 4; if (minor * uK * Math.abs(k) < 3.5 && !isMajor) continue;
        if (along) { c.moveTo(p, TH); c.lineTo(p, TH - size); } else { c.moveTo(LW, p); c.lineTo(LW - size, p); }
        if (isMajor) { const t = String(Math.round(v * 1000) / 1000) + (isIn ? '"' : ''); if (along) c.fillText(t, p + 2, 9); else { c.save(); c.translate(9, p - 3); c.rotate(-Math.PI / 2); c.textAlign = "right"; c.fillText(t, 0, 0); c.restore(); } }
      }
      c.stroke(); if (mouse != null) { c.strokeStyle = "#2ee6a0"; c.beginPath(); if (along) { c.moveTo(mouse + .5, 0); c.lineTo(mouse + .5, TH); } else { c.moveTo(0, mouse + .5); c.lineTo(LW, mouse + .5); } c.stroke(); }
    };
    paint(T.getContext("2d"), W, true, kx, ox, B.w, ui.mx); paint(Lc.getContext("2d"), H, false, ky, oy, B.h, ui.my);
  }
  // toV: toạ độ khung nhìn (camera); toMM: toạ độ trên bo (đã tính lật mặt)
  const toPt = (e, node) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(node.getScreenCTM().inverse()); };
  const toV = e => toPt(e, svg), toMM = e => toPt(e, LY.root);
  const mmToStage = (x, y) => {
    if (!svg || !svg.createSVGPoint || !LY.root) return null;
    const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    const ctm = LY.root.getScreenCTM(); if (!ctm) return null;
    const sc = pt.matrixTransform(ctm), sr = $("#plStage").getBoundingClientRect();
    return { x: sc.x - sr.left, y: sc.y - sr.top };
  };

  /* ---------- thao tác ---------- */
  const ui = { sel: null, mode: "idle", hlNet: null, k: .1, inputType: null, hasPen: false, penOnly: false, shiftLock: false };
  const isShift = e => !!(e && e.shiftKey) || !!ui.shiftLock;
  const padAt = p => { let best = null, bd = PAD_R + .35; for (const q of A.P) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } } return best; };
  function segAt(p) {
    let best = null, bd = 1e9;
    for (const t of S.traces) for (let k = 0; k < t.pts.length - 1; k++) { const d = segDist(p.x, p.y, t.pts[k][0], t.pts[k][1], t.pts[k + 1][0], t.pts[k + 1][1]); if (d < Math.max(traceW(t) / 2 + .35, 1.1) && d < bd) { bd = d; best = { t, k }; } }
    return best;
  }
  const compAt = p => { for (const c of [...S.comps].reverse()) { const b = compBox(c); if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) return c; } return null; };
  const toast = m => { const t = $("#plToast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2600); };

  // vẽ đường bằng tay: 2 đoạn theo tư thế 45°: thẳng-rồi-chéo hoặc chéo-rồi-thẳng (phím /)
  const FREEM = () => (S.ang || "free") === "free";   // mặc định kéo tự do; Shift = ép 45° / 90° (các nấc 45° / 15° thì Shift = tự do)
  function posture(a, b) {
    if (ui.free || S.ang === "15") return [b];
    const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy), d = Math.min(ax, ay), sx = Math.sign(dx), sy = Math.sign(dy);
    if (!ax || !ay || ax === ay) return [b];
    if (SCHEMES[S.scheme].dirs === 4) return S.posture ? [[a[0], b[1]], b] : [[b[0], a[1]], b];
    const m = S.posture ? [a[0] + sx * d, a[1] + sy * d] : (ax > ay ? [a[0] + sx * (ax - d), a[1]] : [a[0], a[1] + sy * (ay - d)]);
    return [[r3(m[0]), r3(m[1])], b];
  }
  function aim(a, b) {
    if (ui.free) return b;
    if (S.ang === "15") { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (!L) return b; const t = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * Math.PI / 12, l = (dx * Math.cos(t) + dy * Math.sin(t)); return [r3(a[0] + Math.cos(t) * l), r3(a[1] + Math.sin(t) * l)]; }
    const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy), r = ui.route;
    let d = SCHEMES[S.scheme].dirs === 8 && Math.min(ax, ay) > .414 * Math.max(ax, ay) ? [Math.sign(dx), Math.sign(dy)] : ax >= ay ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
    // chống rung tay: đang đi theo 1 hướng thì chỉ quẹo khi chuột lệch khỏi hướng đó ≥ 2 bước chân (5,08 mm);
    // kéo chuột lùi về theo cùng hướng thì đoạn ngắn lại (không quẹo)
    if (r && r.dir) { const c = r.dir, l = Math.hypot(c[0], c[1]), along = (dx * c[0] + dy * c[1]) / l, off = Math.abs(dx * c[1] - dy * c[0]) / l; if (off < 2 * G && along > -G) d = c; }
    if (r && Math.hypot(dx, dy) >= G / 2) r.dir = d;   // chỉ khoá hướng khi chuột đã rời điểm neo nửa bước chân
    if (d[0] && d[1]) { const t = Math.max(0, (dx * d[0] + dy * d[1]) / 2); return [r3(a[0] + d[0] * t), r3(a[1] + d[1] * t)]; }
    return d[0] ? [r3(a[0] + d[0] * Math.max(0, dx * d[0])), a[1]] : [a[0], r3(a[1] + d[1] * Math.max(0, dy * d[1]))];
  }
  /* gợi ý chân phù hợp (vòng sáng): theo vai trò chân (nguồn / GND / I2C / SPI / GPIO) của linh kiện Fritzing và các mạng của board */
  function suggestFor(sp) {
    const H = hostInfo(), P = pads(), roleOf = q => { const f = q.c.fp && FP[q.c.fp]; const p = f && f.pads[q.i]; return p && p.role && p.role !== "n" && (!f.mine || p.conf >= .5) ? p.role : null; };
    const netOfRole = ro => ({ g: "GND", 3: "3V3", 5: "5V" }[ro] || (H.bus && H.bus[ro]) || null), sr = roleOf(sp), sn = sr && netOfRole(sr), out = [];
    for (const q of P) {
      if (q.jw || q.hole || q.c === sp.c || q === sp) continue;
      const qr = roleOf(q), qn = qr && netOfRole(qr);
      if ((sn && q.net === sn) || (qn && sp.net === qn) || (sr === "s" && isHost(q.c) && !q.net) || (qr === "s" && isHost(sp.c) && !sp.net && !q.net)) out.push(q);
    }
    return out;
  }
  function renameNet(a, b) {
    for (const c of S.comps) if (c.nets) for (const k in c.nets) if (c.nets[k] === a) c.nets[k] = b;
    for (const t of S.traces) if (t.net === a) t.net = b; for (const j of S.jumpers) if (j.net === a) j.net = b; for (const h of S.holes || []) if (h.net === a) h.net = b;
  }
  // chân trống: chân linh kiện nhận mạng; chân board (mạng = tên chân) thì mạng tạm "~n" đổi thành tên chân board
  function claimPad(pd, net) {
    if (pd.net || pd.jw || pd.hole || !S.comps.includes(pd.c)) return pd.net;
    if (isHost(pd.c)) { const H = hostInfo(), ok = net && (isFree(net) || (isSig(net) && (H.pref.includes(pd.name) || H.risky.includes(pd.name)))); if (net && !ok) return null; if (net) renameNet(net, pd.name); return pd.net = pd.name; }
    pd.c.nets = pd.c.nets || {}; return pd.net = pd.c.nets[pd.name] = net || "~" + S.uid++;
  }
  function startRoute(net, start, sug) {
    ui.free = FREEM(); ui.mode = "route"; ui.route = { net, pts: [start], cur: start, sug: sug || [] }; ui.hlNet = net; svg.classList.add("routing");
    $("#plHint").textContent = L("Bấm để đặt từng điểm neo (ngang / dọc / 45°) · bấm chân / đường để nối · chuột phải / Enter dừng tại chỗ · Shift = góc tự do · Backspace bớt điểm · Esc huỷ", "Click to place a corner · click a pin / trace to connect · right-click / Enter stops here · Shift = any angle · / flips 45° · Backspace removes a corner · Esc cancels");
    render(); drawRoute(); syncCtxBar();
  }
  function drawRoute() {
    const r = ui.route; LY.tmp.innerHTML = ""; if (!r) return;
    for (const q of r.sug || []) el("circle", { cx: q.x, cy: q.y, r: 1.5, class: "sugring" }, LY.tmp);
    const last = r.pts[r.pts.length - 1], pd = padAt({ x: r.cur[0], y: r.cur[1] }), end = pd && Math.hypot(pd.x - r.cur[0], pd.y - r.cur[1]) < .01, pts = [...r.pts, ...(end ? posture(last, r.cur) : [aim(last, r.cur)])], w = PWR.has(r.net) ? W_PWR : W_SIG;
    const tmpT = { net: r.net, pts }, bad = drc(A.P).length !== quickBad(tmpT, w);
    el("path", { d: "M" + pts.map(p => p.join(" ")).join(" L"), "stroke-width": Math.min(w, PREVIEW_W), "stroke-linecap": "round", "stroke-linejoin": "round", class: "cu tmp" + (bad ? " bad" : "") }, LY.tmp);
    drawGuides();
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
      const nt = { id: S.uid++, net, pts: simplify(clean), lock: true }; if (S.penW) nt.w = S.penW; S.traces.push(nt); ui.sel = { t: "t", id: nt.id };
      let jMod = false; const nextJ = [];
      for (const j of S.jumpers) {
        if (j.net !== net) { nextJ.push(j); continue; }
        const L0 = Math.hypot(j.b[0] - j.a[0], j.b[1] - j.a[1]);
        if (L0 < 1e-3) continue;
        const ux = (j.b[0] - j.a[0]) / L0, uy = (j.b[1] - j.a[1]) / L0;
        let uMin = Infinity, uMax = -Infinity;
        for (let k = 0; k < nt.pts.length - 1; k++) {
          const p = nt.pts[k], q = nt.pts[k + 1], lk = Math.hypot(q[0] - p[0], q[1] - p[1]); if (lk < 1e-4) continue;
          const dp = Math.abs((p[0] - j.a[0]) * uy - (p[1] - j.a[1]) * ux), dq = Math.abs((q[0] - j.a[0]) * uy - (q[1] - j.a[1]) * ux);
          const cross = Math.abs(((q[0] - p[0]) * uy - (q[1] - p[1]) * ux) / lk);
          if (dp < .55 && dq < .55 && cross < .15) {
            const up = (p[0] - j.a[0]) * ux + (p[1] - j.a[1]) * uy, uq = (q[0] - j.a[0]) * ux + (q[1] - j.a[1]) * uy;
            const lo = Math.max(0, Math.min(up, uq)), hi = Math.min(L0, Math.max(up, uq));
            if (hi - lo > .2) { uMin = Math.min(uMin, lo); uMax = Math.max(uMax, hi); }
          }
        }
        const onT = e => nt.pts.some((q, k) => k && segDist(e[0], e[1], nt.pts[k - 1][0], nt.pts[k - 1][1], q[0], q[1]) < .35);
        if (onT(j.a) && onT(j.b)) { jMod = true; continue; }
        if (uMax - uMin > .35) {
          jMod = true;
          const p0 = [r3(j.a[0] + ux * uMin), r3(j.a[1] + uy * uMin)], p1 = [r3(j.a[0] + ux * uMax), r3(j.a[1] + uy * uMax)];
          if (uMin > .8) {
            nextJ.push({ id: S.uid++, net, a: j.a, b: p0 });
            for (let k = 0; k < nt.pts.length; k++) if (Math.hypot(nt.pts[k][0] - p0[0], nt.pts[k][1] - p0[1]) < .55) nt.pts[k] = p0;
          } else {
            for (let k = 0; k < nt.pts.length; k++) if (Math.hypot(nt.pts[k][0] - j.a[0], nt.pts[k][1] - j.a[1]) < .85) nt.pts[k] = [...j.a];
          }
          if (L0 - uMax > .8) {
            nextJ.push({ id: S.uid++, net, a: p1, b: j.b });
            for (let k = 0; k < nt.pts.length; k++) if (Math.hypot(nt.pts[k][0] - p1[0], nt.pts[k][1] - p1[1]) < .55) nt.pts[k] = p1;
          } else {
            for (let k = 0; k < nt.pts.length; k++) if (Math.hypot(nt.pts[k][0] - j.b[0], nt.pts[k][1] - j.b[1]) < .85) nt.pts[k] = [...j.b];
          }
        } else nextJ.push(j);
      }
      if (jMod) { S.jumpers = nextJ; nt.pts = simplify(nt.pts); gcHoles(); toast(L("Đã tự cắt / thay dây nhảy bằng đường đồng.", "Jumper split / replaced with copper.")); }
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
  // Point (phím X): bấm lên điểm gập → xoá điểm; bấm lên thân dây → thêm điểm gập đúng chỗ bấm (hình dây chưa đổi, kéo ô vuông để bẻ). Nhấp đúp vẫn là chọn cả chuỗi dây.
  function pointToggle(p) {
    let bv = null;
    for (const t of S.traces) for (let i = 1; i < t.pts.length - 1; i++) { const d = Math.hypot(p.x - t.pts[i][0], p.y - t.pts[i][1]); if (d < Math.max(1.1, traceW(t) / 2 + .3) && (!bv || d < bv.d)) bv = { t, i, d }; }
    if (bv) { checkpoint(); bv.t.pts.splice(bv.i, 1); bv.t.lock = true; ui.sel = { t: "t", id: bv.t.id }; ui.hlNet = bv.t.net; render(); toast(L("Đã xoá điểm gập – dây nối thẳng hai điểm kề. Ctrl+Z để hoàn tác.", "Bend point removed – the trace now runs straight between its neighbours. Ctrl+Z to undo.")); return true; }
    const sg = segAt(p); if (!sg) return false;
    const t = sg.t, pr = proj(t, p);
    if (t.pts.some(q => Math.hypot(q[0] - pr.q[0], q[1] - pr.q[1]) < .5)) { toast(L("Sát điểm gập có sẵn – bấm đúng vào điểm đó để xoá.", "Too close to an existing bend point – click the point itself to remove it.")); return true; }
    checkpoint(); t.pts.splice(pr.k + 1, 0, pr.q); t.lock = true; ui.sel = { t: "t", id: t.id }; ui.hlNet = t.net; render();
    toast(L("Đã thêm điểm gập – kéo ô vuông để bẻ dây.", "Bend point added – drag the square to bend the trace.")); return true;
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
  function drawGuides() {
    if (S.snapG !== false && ui.hint && !(ui.guides && ui.guides.length)) {
      for (const [rx, ry, cx, cy] of ui.hint) {
        const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy);
        if (Math.min(dx, dy) < 3) { if (dy <= dx) el("line", { x1: rx, y1: ry, x2: cx, y2: ry, class: "sguide-hint" }, LY.tmp); else el("line", { x1: rx, y1: ry, x2: rx, y2: cy, class: "sguide-hint" }, LY.tmp); }
        el("circle", { cx: rx, cy: ry, r: .5, class: "sguide-hintpt" }, LY.tmp);
      }
    }
    if (!ui.guides || !ui.guides.length || S.snapG === false) return;
    for (const [rx, ry, sx, sy] of ui.guides) {
      el("line", { x1: rx, y1: ry, x2: sx, y2: sy, class: "sguide" }, LY.tmp);
      el("circle", { cx: rx, cy: ry, r: .55, class: "sguide-pt" }, LY.tmp);
      el("circle", { cx: sx, cy: sy, r: .42, class: "sguide-cur" }, LY.tmp);
    }
  }
  const PASSIVE_FPS = new Set(["pinHdr", "R", "C", "ecap5", "ecap6", "ecap8", "to92", "irfz44n", "irf540n", "irf520"]);
  function findCompSplice(fp, cx, cy, rotAng) {
    const f = FP[fp];
    if (!f || !f.pads || f.pads.length !== 2) return null;
    const [r0x, r0y] = rot(f.pads[0].x, f.pads[0].y, rotAng);
    const [r1x, r1y] = rot(f.pads[1].x, f.pads[1].y, rotAng);
    const p0 = { x: r3(cx + r0x), y: r3(cy + r0y) };
    const p1 = { x: r3(cx + r1x), y: r3(cy + r1y) };
    const pmid = { x: r3((p0.x + p1.x) / 2), y: r3((p0.y + p1.y) / 2) };
    for (const t of S.traces) {
      const pa = proj(t, p0), pb = proj(t, p1), pm = proj(t, pmid);
      const w2 = traceW(t) / 2 + 0.45;
      if (pa && pb && pm && pa.d < w2 && pb.d < w2 && pm.d < w2 + 0.35 && Math.abs(pb.s - pa.s) > 0.5) {
        return { t, pa, pb, p0, p1, f };
      }
    }
    return null;
  }
  function startPlaceComp(fp, rot0 = 0) {
    cancel();
    setTool("sel");
    ui.mode = "place";
    const vx = cam.x + cam.w / 2, cx0 = S.flip ? S.board.w - vx : vx, cy0 = cam.y + cam.h / 2;
    ui.place = { fp, rot: rot0, cur: [S.snapG === false ? r3(cx0) : snap(cx0, snapStep()), S.snapG === false ? r3(cy0) : snap(cy0, snapStep())] };
    svg.classList.add("routing");
    $("#plHint").textContent = L("Bấm để đặt linh kiện (R xoay 90°, đặt lên đường đồng để cắt & nối tiếp, Esc huỷ)", "Click to place component (R rotates 90°, place over a trace to splice in-line, Esc cancels)");
    drawPlaceGhost();
  }
  function drawPlaceGhost() {
    LY.tmp.innerHTML = "";
    if (ui.mode !== "place" || !ui.place) return;
    const { fp, rot: rotAng, cur } = ui.place;
    const f = FP[fp]; if (!f) return;
    const [cx, cy] = cur;
    const sp = findCompSplice(fp, cx, cy, rotAng);
    if (sp) {
      const s0 = Math.min(sp.pa.s, sp.pb.s), s1 = Math.max(sp.pa.s, sp.pb.s);
      const cutSpan = cutPart(sp.t, s0, s1);
      if (cutSpan.length >= 2) {
        el("path", { d: "M" + cutSpan.map(q => q.join(" ")).join(" L"), "stroke-width": traceW(sp.t) + 0.6, class: "trimcut" }, LY.tmp);
      }
      el("circle", { cx: sp.pa.q[0], cy: sp.pa.q[1], r: 1.1, class: "jmark" }, LY.tmp);
      el("circle", { cx: sp.pb.q[0], cy: sp.pb.q[1], r: 1.1, class: "jmark" }, LY.tmp);
    }
    const g = el("g", { transform: `translate(${cx} ${cy}) rotate(${rotAng})`, opacity: "0.85" }, LY.tmp);
    const b = f.body, cxLocal = b.x + b.w / 2, sdg = ui.place.sym ? symD(ui.place.sym, f) : null;
    if (sdg) el("path", { d: sdg, fill: "none", stroke: sp ? "#38bdf8" : "#fff", "stroke-width": ".25", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    else if (f.to92) {
      el("path", { d: `M${b.x} ${b.y + b.h} L${b.x + b.w} ${b.y + b.h} A${b.w / 2} ${b.h * 0.9} 0 0 0 ${b.x} ${b.y + b.h} Z`, class: "body", stroke: sp ? "#38bdf8" : "#fff", "stroke-width": "0.3", fill: "rgba(30,41,59,0.7)" }, g);
    } else if (f.to220) {
      el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 0.5, class: "body", stroke: sp ? "#38bdf8" : "#fff", "stroke-width": "0.3", fill: "rgba(30,41,59,0.7)" }, g);
      el("line", { x1: b.x, y1: b.y + 1.3, x2: b.x + b.w, y2: b.y + 1.3, stroke: sp ? "#38bdf8" : "#cbd5e1", "stroke-width": "0.3" }, g);
    } else if (f.round) el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.h / 2, class: "body", stroke: sp ? "#38bdf8" : "#fff", "stroke-width": "0.3", fill: "rgba(30,41,59,0.7)" }, g);
    else el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 0.6, class: "body", stroke: sp ? "#38bdf8" : "#fff", "stroke-width": "0.3", fill: "rgba(30,41,59,0.7)" }, g);
    if (f.val) el("text", { x: b.x + b.w / 2, y: b.y + b.h / 2, "font-size": "1.3", "font-weight": "700", "text-anchor": "middle", "dominant-baseline": "central", fill: "#fff" }, g, f.val);
    for (const p of f.pads) {
      const r0 = p.r || PAD_R, fs = "fill:" + (sp ? "#38bdf8" : "var(--pl-pad,#d2893d)"); if (p.w && p.h) el("rect", { x: p.x - p.w / 2, y: p.y - p.h / 2, width: p.w, height: p.h, rx: .15, style: fs, opacity: "0.8" }, g); else if (p.sq) el("rect", { x: p.x - r0, y: p.y - r0, width: 2 * r0, height: 2 * r0, rx: .15, style: fs, opacity: "0.8" }, g); else el("circle", { cx: p.x, cy: p.y, r: r0, style: fs, opacity: "0.8" }, g);
      if (!p.smd) el("circle", { cx: p.x, cy: p.y, r: Math.min(DRILL_R, r0 * 0.65), fill: "#111" }, g);
    }
    if (ui.place.cloneFrom) {
      const cf = ui.place.cloneFrom, f0 = FP[cf.fp];
      const p0 = (f0 && f0.pads && f0.pads[0]) ? rot(f0.pads[0].x, f0.pads[0].y, cf.rot) : [0, 0];
      const p1 = (f.pads && f.pads[0]) ? rot(f.pads[0].x, f.pads[0].y, rotAng) : [0, 0];
      const ox = r3(cf.x + p0[0]), oy = r3(cf.y + p0[1]);
      const gx = r3(cx + p1[0]), gy = r3(cy + p1[1]);
      const d = Math.hypot(gx - ox, gy - oy);
      if (d > 0.05) {
        el("line", { x1: ox, y1: oy, x2: gx, y2: gy, stroke: "#38bdf8", "stroke-width": 0.35, "stroke-dasharray": "1.4 0.9", class: "csln" }, LY.tmp);
        el("circle", { cx: ox, cy: oy, r: 0.75, fill: "none", stroke: "#38bdf8", "stroke-width": 0.35 }, LY.tmp);
        el("circle", { cx: gx, cy: gy, r: 0.75, fill: "none", stroke: "#38bdf8", "stroke-width": 0.35 }, LY.tmp);
        const mx = (ox + gx) / 2, my = (oy + gy) / 2;
        const tg = el("g", { transform: `translate(${mx} ${my - 1.4})${S.flip ? " scale(-1 1)" : ""}` }, LY.tmp);
        el("rect", { x: -6.5, y: -1.7, width: 13, height: 3.2, rx: 0.6, fill: "rgba(15,23,42,0.88)", stroke: "#38bdf8", "stroke-width": 0.2 }, tg);
        el("text", { x: 0, y: 0, "font-size": "1.9", "font-weight": "700", "text-anchor": "middle", "dominant-baseline": "central", fill: "#38bdf8", class: "cstx" }, tg, fU(d));
      }
    }
  }
  function placeCompOnTrace(sp, c) {
    const { t, pa, pb, f } = sp;
    const s0 = Math.min(pa.s, pb.s), s1 = Math.max(pa.s, pb.s);
    const total = proj(t, { x: t.pts[t.pts.length - 1][0], y: t.pts[t.pts.length - 1][1] }).s;
    S.traces = S.traces.filter(x => x !== t);
    const pLeft = cutPart(t, 0, s0);
    const pRight = cutPart(t, s1, total);
    const firstPad = pa.s <= pb.s ? f.pads[0] : f.pads[1];
    const secondPad = pa.s <= pb.s ? f.pads[1] : f.pads[0];
    const snapEnd = (pc, idx, pt) => { if (pc.length >= 2 && Math.hypot(pc[idx][0] - pt[0], pc[idx][1] - pt[1]) < 0.6) pc[idx] = [...pt]; };
    if (pLeft.length >= 2 && cutPart.len(pLeft) > 0.3) {
      snapEnd(pLeft, pLeft.length - 1, pa.s <= pb.s ? [sp.p0.x, sp.p0.y] : [sp.p1.x, sp.p1.y]);
      S.traces.push({ ...t, id: S.uid++, pts: simplify(pLeft), lock: true });
    }
    if (pRight.length >= 2 && cutPart.len(pRight) > 0.3) {
      snapEnd(pRight, 0, pa.s <= pb.s ? [sp.p1.x, sp.p1.y] : [sp.p0.x, sp.p0.y]);
      S.traces.push({ ...t, id: S.uid++, pts: simplify(pRight), lock: true });
    }
    c.nets = c.nets || {};
    c.nets[firstPad.name] = t.net;
    c.nets[secondPad.name] = t.net;
    gcHoles();
  }
  function placeCur(p, shiftKey) {
    const { fp, rot: rotAng, cloneFrom } = ui.place;
    const f = FP[fp], B = S.board;
    // khung thân SAU KHI XOAY (trước đây dùng khung chưa xoay: header nhiều hàng xoay 90° bị kẹt, không kéo dọc được)
    const b = f ? (() => { const k = compBox({ fp, rot: rotAng || 0, x: 0, y: 0 }); return { x: k.x0, y: k.y0, w: k.x1 - k.x0, h: k.y1 - k.y0 }; })() : { x: 0, y: 0, w: 0, h: 0 };
    const clamp = (v, lo, hi) => hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
    let cx = S.snapG === false ? r3(clamp(p.x, 2 - b.x, B.w - 2 - b.x - b.w)) : snap(clamp(p.x, 2 - b.x, B.w - 2 - b.x - b.w), snapStep());
    let cy = S.snapG === false ? r3(clamp(p.y, 2 - b.y, B.h - 2 - b.y - b.h)) : snap(clamp(p.y, 2 - b.y, B.h - 2 - b.y - b.h), snapStep());
    if (shiftKey && cloneFrom) {
      const f0 = FP[cloneFrom.fp];
      const p0 = (f0 && f0.pads && f0.pads[0]) ? rot(f0.pads[0].x, f0.pads[0].y, cloneFrom.rot) : [0, 0];
      const p1 = (f && f.pads && f.pads[0]) ? rot(f.pads[0].x, f.pads[0].y, rotAng) : [0, 0];
      const ox = r3(cloneFrom.x + p0[0]), oy = r3(cloneFrom.y + p0[1]);
      const gx = r3(cx + p1[0]), gy = r3(cy + p1[1]);
      if (Math.abs(gx - ox) >= Math.abs(gy - oy)) cy = r3(oy - p1[1]); else cx = r3(ox - p1[0]);
    }
    return [cx, cy];
  }
  function autoProtectComp(c) {
    if (!c || !S.comps.some(isHost)) return 0;
    const H = hostInfo(), used = usedNets(), B = S.board;
    const nextNet = () => { let k = 1; while (used.has("N" + k)) k++; const n = "N" + k; used.add(n); return n; };
    const addR = (nets, val, dx, dy) => {
      let n = 1; while (S.comps.some(x => x.id === "R" + n)) n++;
      const x = snap(Math.max(4, Math.min(B.w - 14, c.x + dx)), G);
      const y = snap(Math.max(4, Math.min(B.h - 4, c.y + dy)), G);
      S.comps.push({ id: "R" + n, fp: "R", x, y, rot: 0, val, nets });
    };
    if (c.fp === "hcsr04" && !H.v5 && c.nets && !c.nets.ECHO) {
      const gpio = H.pref.find(x => !used.has(x)) || null;
      if (!gpio) return 0;
      used.add(gpio); const mid = nextNet();
      c.nets.ECHO = mid;
      addR({ 1: mid, 2: gpio }, "1k", -4 * G, -3 * G);
      addR({ 1: gpio, 2: "GND" }, "2k", -4 * G, -G);
      return 2;
    }
    if (c.fp === "led" && c.nets && !c.nets.A) {
      const gpio = H.pref.find(x => !used.has(x)) || null;
      if (!gpio) return 0;
      used.add(gpio); const mid = nextNet();
      c.nets.A = mid;
      addR({ 1: mid, 2: gpio }, "220", 3 * G, 0);
      return 1;
    }
    return 0;
  }
  function pickPlace(p, e) {
    if (ui.mode !== "place" || !ui.place) return;
    const { fp, rot: rotAng, cloneFrom, pinNames } = ui.place, fromCm = !!ui.place.pre;   // đặt từ nút Component: không hiện hộp chỉnh số chân
    const f = FP[fp], b = f.body, B = S.board;
    const [cx, cy] = placeCur(p, e && e.shiftKey); const cmOpen = !!($("#plFlyCM") && $("#plFlyCM").classList.contains("on"));
    const pre = ui.place.pre || (f.mine ? "X" : (fp.startsWith("pinHdr") ? "J" : (PRE[fp] || "M")));
    let n = 1; while (S.comps.some(c => c.id === pre + n)) n++;
    const id = pre + n;
    checkpoint();
    const actFp = fp === "pinHdr" ? "pinHdr_3" : fp;
    const c = { id, fp: actFp, x: cx, y: cy, rot: rotAng };
    if (ui.place.sym) c.sym = ui.place.sym;
    if (ui.place.val != null) c.val = ui.place.val; else if (f.val) c.val = f.val;
    if (ui.place.lbl != null) c.lbl = ui.place.lbl;
    if (pinNames) c.pinNames = [...pinNames];
    c.nets = autoNets(actFp);
    const sp = findCompSplice(fp, cx, cy, rotAng);
    if (sp) {
      placeCompOnTrace(sp, c);
    }
    S.comps.push(c);
    const addedR = autoProtectComp(c);
    cancel();
    if (fp.startsWith("pinHdr") && !fromCm) ui.newPinHdrId = id; else ui.newPinHdrId = null; if ($("#plFlyPH")) $("#plFlyPH").classList.remove("on");
    ui.sel = { t: "c", id };
    if (cmOpen) $("#plFlyCM").classList.add("on");   // bảng Component giữ mở: sửa tiếp thông số linh kiện vừa đặt
    render();
    afterParts([id]);
    toast(L(`Đã đặt ${id}` + (sp ? " (nối tiếp vào đường đồng)" : ""), `Placed ${id}` + (sp ? " (spliced into trace)" : "")));
    if (f.ecap || f.to220) { const elN = $("#plName"); if (elN) { elN.focus(); elN.select(); } }
  }
  // snap ưu tiên điểm neo / đầu mút của line & jumper, tâm pad, đường gióng ảo (< 0,48 mm), rồi thân line / jumper
  function jSnap(p, a0, shift, selfJ, selfT, exclIdx) {
    ui.guides = null; ui.hint = null;
    const mode0 = S.jAng || "free", mode = shift ? (mode0 === "free" ? "45" : "free") : mode0;
    let x = p.x, y = p.y;
    if (a0 && mode !== "free") {
      const dx = x - a0[0], dy = y - a0[1], L = Math.hypot(dx, dy), step = mode === "15" ? Math.PI / 12 : Math.PI / 4;
      if (L > 1e-3) { const a = Math.round(Math.atan2(dy, dx) / step) * step; x = a0[0] + L * Math.cos(a); y = a0[1] + L * Math.sin(a); }
    }
    if (false && S.snapG === false) {
      const pd = A.P.find(q => !(selfJ && q.jw === selfJ) && Math.hypot(q.x - x, q.y - y) < (q.r || PAD_R));
      return pd ? { q: [pd.x, pd.y], net: pd.net, pd, hit: "pad" } : { q: [r3(x), r3(y)], net: null, hit: null };
    }
    let best = null, bd = .85;
    for (const q of A.P) {
      if (selfJ && q.jw === selfJ) continue;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < bd) { bd = d; best = { q: [q.x, q.y], net: q.net, pd: q, hit: "pad" }; }
    }
    let vd = .8;
    for (const t of S.traces) {
      if (selfT && t === selfT && exclIdx == null) continue;
      for (let k = 0; k < t.pts.length; k++) {
        if (selfT && t === selfT && (k === exclIdx || Math.hypot(t.pts[k][0] - selfT.pts[exclIdx][0], t.pts[k][1] - selfT.pts[exclIdx][1]) < .08)) continue;
        const pt = t.pts[k];
        if (selfJ && (Math.hypot(pt[0] - selfJ.a[0], pt[1] - selfJ.a[1]) < .08 || Math.hypot(pt[0] - selfJ.b[0], pt[1] - selfJ.b[1]) < .08)) continue;
        const d = Math.hypot(pt[0] - x, pt[1] - y);
        if (d < vd) { vd = d; best = { q: [pt[0], pt[1]], net: t.net, t, k, hit: "vtx" }; }
      }
    }
    if (!best && exclIdx == null) {
      const sg = segAt({ x, y }), pr = sg && (!selfT || sg.t !== selfT) && proj(sg.t, { x, y });
      if (pr && pr.d < traceW(sg.t) / 2 + .3) best = { q: pr.q.map(r3), net: sg.t.net, sg, hit: "seg" };
    }
    if (!best && exclIdx == null) {
      let jd = .45;
      for (const j of S.jumpers) {
        if (selfJ && j === selfJ) continue;
        const dx = j.b[0] - j.a[0], dy = j.b[1] - j.a[1], l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - j.a[0]) * dx + (y - j.a[1]) * dy) / l2));
        const q = [r3(j.a[0] + u * dx), r3(j.a[1] + u * dy)], d = Math.hypot(x - q[0], y - q[1]);
        if (d < jd) { jd = d; best = { q, net: j.net, jw: j, hit: "jseg" }; }
      }
    }
    if (ui.mode === "route" && ui.route && ui.route.pts.length >= 3) {
      const p0 = ui.route.pts[0];
      if (Math.hypot(x - p0[0], y - p0[1]) < 1.35) return { q: [p0[0], p0[1]], net: ui.route.net, hit: "close" };
    }
    if (S.snapG !== false && (ui.mode === "route" || ui.mode === "jfree")) {
      const fp0 = (ui.mode === "route" && ui.route && ui.route.pts[ui.route.pts.length - 1]) || (ui.mode === "jfree" && ui.jf && ui.jf.a) || null, cand = [];
      const add = (rx, ry) => { if (fp0 && Math.hypot(rx - fp0[0], ry - fp0[1]) < .15) return; const d = Math.hypot(rx - x, ry - y); if (d > .05 && d < 12) cand.push([d, rx, ry]); };
      for (const t of S.traces) { if (selfT && t === selfT) continue; for (const pt of t.pts) add(pt[0], pt[1]); }
      for (const j of S.jumpers) if (j !== selfJ) { add(j.a[0], j.a[1]); add(j.b[0], j.b[1]); }
      cand.sort((u, v) => u[0] - v[0]); ui.hint = cand.slice(0, 2).map(c => [c[1], c[2], x, y]);
    }
    if (!best && S.snapG !== false && (!a0 || mode === "free")) {
      const curNet = (ui.route && ui.route.net) || (ui.jf && ui.jf.net) || (selfT && selfT.net) || (selfJ && selfJ.net) || ui.hlNet;
      const fromPt = (ui.mode === "route" && ui.route && ui.route.pts[ui.route.pts.length - 1]) || (ui.mode === "jfree" && ui.jf && ui.jf.a) || null;
      let gx = null, gy = null, sxScore = .42, syScore = .42;
      const testRef = (rx, ry, sameNet) => {
        if (fromPt && Math.hypot(rx - fromPt[0], ry - fromPt[1]) < .15) return;
        const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dist = Math.hypot(rx - x, ry - y);
        if (dist < .2 || dist > (sameNet ? 55 : 28)) return;
        const w = dist * .003 - (sameNet ? .04 : 0);
        if (dx < .42 && dx + w < sxScore) { sxScore = dx + w; gx = [rx, ry]; }
        if (dy < .42 && dy + w < syScore) { syScore = dy + w; gy = [rx, ry]; }
      };
      for (const t of S.traces) for (let k = 0; k < t.pts.length; k++) {
        if (selfT && t === selfT && (k === exclIdx || (exclIdx == null))) continue;
        testRef(t.pts[k][0], t.pts[k][1], t.net === curNet);
      }
      for (const j of S.jumpers) if (j !== selfJ) { testRef(j.a[0], j.a[1], j.net === curNet); testRef(j.b[0], j.b[1], j.net === curNet); }
      for (const q of A.P) if (!(selfJ && q.jw === selfJ) && (q.net === curNet || Math.hypot(q.x - x, q.y - y) < 22)) testRef(q.x, q.y, q.net === curNet);
      if (gx || gy) {
        const sx = gx ? gx[0] : r3(x), sy = gy ? gy[1] : r3(y);
        ui.guides = [];
        if (gx) ui.guides.push([gx[0], gx[1], sx, sy]);
        if (gy) ui.guides.push([gy[0], gy[1], sx, sy]);
        return { q: [r3(sx), r3(sy)], net: null, hit: "guide" };
      }
    }
    if (best) {
      if (a0 && mode !== "free" && (best.hit === "seg" || best.hit === "jseg")) {
        const dx = x - a0[0], dy = y - a0[1], L = Math.hypot(dx, dy);
        if (L > 1e-3) {
          const ca = dx / L, sa = dy / L, A0 = best.hit === "seg" ? best.sg.t.pts[best.sg.k] : best.jw.a, B0 = best.hit === "seg" ? best.sg.t.pts[best.sg.k + 1] : best.jw.b;
          const ex = B0[0] - A0[0], ey = B0[1] - A0[1], den = ca * ey - sa * ex;
          if (Math.abs(den) > 1e-6) {
            const u = ((A0[0] - a0[0]) * ey - (A0[1] - a0[1]) * ex) / den, tc = Math.max(0, Math.min(1, ((A0[0] - a0[0]) * sa - (A0[1] - a0[1]) * ca) / den));
            if (u > .2) best.q = [r3(A0[0] + tc * ex), r3(A0[1] + tc * ey)];
          }
        }
      } else if (a0 && mode !== "free" && (best.hit === "pad" || best.hit === "vtx")) {
        if (Math.hypot(best.q[0] - x, best.q[1] - y) > .45) best = null;
      }
    }
    if (best) return best;
    if (S.snapG !== false && (!a0 || mode === "free")) return { q: [r3(snap(x, SN)), r3(snap(y, SN))], net: null, hit: null };   // Snap bật: đầu mút bám lưới 1,27 mm (khi không có điểm neo / đường gióng)
    return { q: [r3(x), r3(y)], net: null, hit: null };
  }
  function ptSnap(p, selfT, exclIdx) { return jSnap(p, null, false, null, selfT, exclIdx); }
  // lỗ tự do: đang vẽ → J đặt lỗ ở đầu bút; chọn đường → J rồi bấm 1 điểm trên đường. Sau đó kéo dây nhảy tới chỗ khác.
  function placeHole() {
    if (ui.mode === "route") {
      const q = ui.route.cur, net = ui.route.net, P = pads();
      const on = P.find(p => Math.hypot(p.x - q[0], p.y - q[1]) < PAD_R);   // đầu bút trên lỗ / chân có sẵn: bắc dây nhảy từ đó
      if (on) { if (on.net !== net && !joinNet(on.net)) return toast(L(`Chân ${on.name} thuộc mạng khác.`, `Pin ${on.name} is on another net.`)); const n2 = ui.route.pendJoin ? ui.route.pendJoin[1] : net; if (ui.route.pts.length > 1 || ui.route.pendJoin) finishRoute([on.x, on.y], true); else cancel(); return startJfree(n2, [on.x, on.y]); }
      if (!holeOK(q[0], q[1], net, P, true)) return toast(L("Chỗ này quá sát chân hoặc đường khác – chọn chỗ thoáng hơn.", "Too close to a pin or another trace – pick a clearer spot."));
      finishRoute(q); startJfree(net, q); ui.jf.cont = true; return;
    }
    cancel(); ui.mode = "hole"; ui.hole = {}; svg.classList.add("routing");
    $("#plHint").textContent = L("Dây nhảy: bấm điểm đầu (điểm neo / đầu mút line, chân, lỗ hoặc chỗ trống) · Esc huỷ", "Jumper: click the start (trace vertex / end, pin, hole or free spot) · Esc cancels"); render();
  }
  function pickHole(p, e) {
    const s = jSnap(p, null, e && e.shiftKey), pd = s.pd;
    if (pd) { if (!pd.net) { checkpoint(); claimPad(pd, null); } return startJfree(pd.net || ("~" + S.uid++), [pd.x, pd.y]); }
    const q = s.q, net = s.net || ("~" + S.uid++);
    if (!holeOK(q[0], q[1], net, pads(), true)) return toast(L("Chỗ này quá sát chân hoặc đường khác – chọn chỗ thoáng hơn.", "Too close to a pin or another trace – pick a clearer spot."));
    startJfree(net, q);
  }
  function startJfree(net, a) {
    cancel(); ui.mode = "jfree"; ui.jf = { net, a, cur: a }; ui.hlNet = net; svg.classList.add("routing");
    $("#plHint").textContent = L("Dây nhảy: bấm chỗ đặt lỗ thứ 2 (bám nhẹ vào điểm neo / đầu line / chân cùng mạng) · Esc huỷ", "Jumper: click where the 2nd hole goes (gently snaps to vertices / line ends / pins) · Esc cancels"); render(); drawJfree();
  }
  function jGhost(x, y) {   // pad xem trước đúng hình / cỡ / lỗ theo tuỳ chọn, mờ 50%
    const o = JO(), g = el("g", { opacity: ".5", "pointer-events": "none" }, LY.tmp);
    if (o.shape === "rect") el("rect", { x: x - o.w / 2, y: y - o.h / 2, width: o.w, height: o.h, rx: .15, class: "padcu" }, g);
    else if (o.shape === "square") el("rect", { x: x - o.r, y: y - o.r, width: 2 * o.r, height: 2 * o.r, rx: .15, class: "padcu" }, g);
    else el("circle", { cx: x, cy: y, r: o.r, class: "padcu" }, g);
    if (o.hole) el("circle", { cx: x, cy: y, r: o.drill / 2, class: "drill" }, g);
  }
  function drawJfree() {
    const J = ui.jf; LY.tmp.innerHTML = ""; if (!J) return;
    el("line", { x1: J.a[0], y1: J.a[1], x2: J.cur[0], y2: J.cur[1], class: "jcut", style: "stroke:#fff;opacity:.85;stroke-dasharray:.7 .5" }, LY.tmp); jGhost(J.a[0], J.a[1]); jGhost(J.cur[0], J.cur[1]);
    drawGuides();
  }
  function pickJfree(p, g, e) {
    const J = ui.jf, P = pads(), s = jSnap(p, J.a, e && e.shiftKey), pd = s.pd;
    let b = (!pd && !s.hit) ? jFix(J.a, s.q) : s.q, end = false;
    // khác mạng chỉ nối được khi một bên là mạng trống (dây tự do): bên trống nhận mạng bên kia
    const ok = n => n === J.net || (n && (isFree(n) || isFree(J.net)));
    if (pd) {
      if (!pd.net) { checkpoint(); claimPad(pd, J.net); }
      if (!ok(pd.net)) return toast(L(`Chân ${pd.name} thuộc mạng ${pd.net || "trống"}, không nối được.`, `Pin ${pd.name} is on net ${pd.net || "none"}, can't connect.`));
      b = [pd.x, pd.y]; end = pd.net;
    } else if (s.hit === "vtx" || s.hit === "seg" || s.hit === "jseg") {
      if (!ok(s.net)) return toast(L(`Đường này thuộc mạng ${s.net || "trống"}, không nối được.`, `This trace is on net ${s.net || "none"}, can't connect.`));
      b = s.q; end = s.net;
    }
    if (Math.hypot(b[0] - J.a[0], b[1] - J.a[1]) < (JO().fix || JP_MIN) - .01) return toast(L(`Hai pad phải cách nhau ít nhất ${String(JO().fix || JP_MIN).replace(".", ",")} mm.`, `The two pads must be at least ${JO().fix || JP_MIN} mm apart.`));
    if (!pd && !holeOK(b[0], b[1], J.net, P, true)) return toast(L("Chỗ này quá sát chân hoặc đường khác – chọn chỗ thoáng hơn.", "Too close to a pin or another trace – pick a clearer spot."));
    if (!lineOK(J.a, b, J.net, P)) return toast(L("Dây trần đi ngang chân khác mạng – chọn chỗ khác.", "Bare jumper would cross another net's pin – pick another spot."));
    checkpoint();
    if (end && end !== J.net) { const [from, to] = isFree(J.net) ? [J.net, end] : [end, J.net]; adopt(from, to); J.net = to; }
    // vẽ dây nhảy dọc theo đường đồng cùng mạng: tự cắt bỏ đoạn đồng nằm dưới để thay bằng dây nhảy
    let cutCu = false;
    for (const t of [...S.traces]) {
      if (t.net !== J.net) continue;
      const pa = proj(t, { x: J.a[0], y: J.a[1] }), pb = proj(t, { x: b[0], y: b[1] });
      const pm = proj(t, { x: (J.a[0] + b[0]) / 2, y: (J.a[1] + b[1]) / 2 }), w2 = traceW(t) / 2 + .4;
      if (pa && pb && pa.d < w2 + .15 && pb.d < w2 + .15 && Math.abs(pb.s - pa.s) > .5) {
        const s0 = Math.min(pa.s, pb.s), s1 = Math.max(pa.s, pb.s), total = proj(t, { x: t.pts[t.pts.length - 1][0], y: t.pts[t.pts.length - 1][1] }).s;
        S.traces = S.traces.filter(x => x !== t);
        const pLeft = cutPart(t, 0, s0), pRight = cutPart(t, s1, total);
        const snapEnd = (pc, idx, pt) => { if (pc.length >= 2 && Math.hypot(pc[idx][0] - pt[0], pc[idx][1] - pt[1]) < .6) pc[idx] = [...pt]; };
        const firstPt = pa.s <= pb.s ? J.a : b, secondPt = pa.s <= pb.s ? b : J.a;
        if (pLeft.length >= 2 && cutPart.len(pLeft) > .3) { snapEnd(pLeft, pLeft.length - 1, firstPt); S.traces.push({ ...t, id: S.uid++, pts: simplify(pLeft), lock: true }); }
        if (pRight.length >= 2 && cutPart.len(pRight) > .3) { snapEnd(pRight, 0, secondPt); S.traces.push({ ...t, id: S.uid++, pts: simplify(pRight), lock: true }); }
        cutCu = true;
      }
    }
    const j = { id: S.uid++, net: J.net, a: J.a, b, o: { ...JO(), min: JO().fix || JP_MIN } };
    S.jumpers.push(j);
    if (cutCu) gcHoles();
    if (end || cutCu) { cancel(); ui.sel = { t: "j", id: j.id }; render(); return toast(cutCu ? L("Đã tự cắt đoạn đường đồng và thay bằng dây nhảy.", "Trace segment automatically cut and replaced with jumper.") : L("Đã nối xong. Chuột phải lên nét nhảy → Nắn ngang/dọc/45° hoặc Đổi thành đồng.", "Connected. Right-click a jumper → Make H/V/45° or Convert to copper.")); }
    if (!J.cont) { startJfree(J.net, b); $("#plHint").textContent = L("Bấm tiếp điểm kế (tạo lỗ) hoặc điểm neo / chân đích · chuột phải hoặc Esc để dừng", "Click the next point (adds a hole) or target vertex / pin · right-click or Esc to stop"); return; }
    startRoute(J.net, b); toast(L("Đã đặt dây nhảy – vẽ tiếp đường đồng từ lỗ thứ 2.", "Jumper placed – keep drawing copper from the 2nd hole."));
  }
  /* ---------- công cụ kiểu bút chì: Chọn · Line · Bút dây nhảy · Trim · Fillet (F) · Chamfer (C) ---------- */
  const TOOLS = () => ({ rat: [L("Sửa dây bay", "Edit ratsnest"), L("Bấm chân 1 → chân 2 để thêm dây bay; bấm sợi dây bay để gỡ; Esc để thoát", "Click pin 1 → pin 2 to add ratsnest; click a ratsnest line to remove; Esc to exit")], sel: [L("Chọn", "Select"), L("Kéo linh kiện, chọn đường, kéo nền để di chuyển (Esc)", "Drag parts, select traces, drag the background to pan (Esc)")],
    cu: ["Route", L("Vẽ dây đồng trực tiếp: bấm bất kỳ đâu → bấm các góc → bấm chân / đường để nối, chuột phải / Enter để dừng (L)", "Direct copper route: click anywhere → click corners → click a pin / trace to connect, right-click / Enter to stop (L)")],
    sk: ["Sketch Route", L("Vẽ đường mạch tham số bằng Sketch (ràng buộc kích thước, góc, điểm)", "Parametric trace routing with Sketch constraints (dimensions, angles, snap)")],
    jw: [STUDIO ? "Jumper pad" : L("Bút dây nhảy", "Jumper pen"), L("Bấm X → các điểm A, B… (tự tạo lỗ) → chân đích Y; chuột phải để dừng. Sau đó đổi nét thành đồng hoặc tô bằng Pen (J)", "Click X → points A, B… (holes added) → target pin Y; right-click stops. Then convert to copper or trace over with the Pen (J)")],
    ms: [L("Thước", "Ruler"), L("Bấm điểm 1 → điểm 2 để đo; bám tâm lỗ / chân và tâm đường đồng (M)", "Click point 1 → point 2 to measure; snaps to hole / pin centres and trace centrelines (M)")],
    cs: [L("Dim", "Dim"), L("Đường gióng định vị: bấm 2 điểm, nhập cự ly để đẩy linh kiện và dây nối theo (D)", "Dim: dimension line: click 2 points, set distance to push part and connected traces (D)")],
    tr: ["Trim", L("Bấm 2 điểm trên 1 đường đồng → bỏ đoạn giữa; bấm dây nhảy để xoá (T)", "Click 2 points on a trace → the part between is removed; click a jumper to delete it (T)")],
    ex: ["Extend (E)", L("Bấm gần đầu mút một đường đồng → kéo dài thẳng tới đường / chân cùng mạng gần nhất (E)", "Click near a trace end → extends straight to the nearest trace / pin of the same net (E)")],
    dr: ["Pen", L("Vẽ tay, chữ, hình, icon trên đồng hoặc sơn trắng · chọn lớp và hình ở bảng bên trái (P)", "Freehand, text, shapes and icons on copper or white paint · pick layer and shape in the panel on the left (P)")],
    saw: [L("Cưa", "Saw"), L("Cắt / mở rộng / khoét bo bằng đường thẳng: bấm các điểm, đầu và cuối nằm ở mép bo (hoặc vẽ vòng kín trong bo để khoét lỗ). Snap 15°, giữ Shift = tự do. Bấm đúp / Enter / chuột phải để cắt. Dùng được khi đã đi dây từ 60% (W)", "Cut / extend / punch the board with straight lines: click points, with the first and last on the board edge (or a closed loop inside to punch a hole). 15° snap, hold Shift = free. Double-click / Enter / right-click to cut. Available once 60% of connections are routed (W)")],
    pt: ["Point", L("Bấm lên dây: thêm điểm gập · bấm lên điểm gập: xoá điểm (phím X) · Esc để thoát", "Click a trace: add a bend point · click a bend point: remove it (key X) · Esc to exit")],
    tf: ["Fillet (F)", L("Hàn 2 dây không vát góc (tự cắt đoạn nhú dư hoặc kéo dài 2 đầu chưa join tới góc giao nhau) · Bấm chỗ giao nhau hoặc bấm dây 1 → dây 2 · Chuột phải thoát (F)", "Weld 2 traces without bevel (trims overshoot or extends unjoined ends to a sharp corner) · Click intersection or wire 1 → wire 2 · Right-click exits (F)")],
    tc: ["Chamfer (C)", L("Hàn 2 dây có vát góc 45° (tự cắt đoạn nhú dư hoặc kéo dài 2 đầu chưa join rồi vát góc) · Bấm chỗ giao nhau hoặc bấm dây 1 → dây 2 · Hoặc bấm 1 điểm gập để vát ngay · Chuột phải thoát (C)", "Weld 2 traces with a 45° bevel (trims overshoot or extends unjoined ends and chamfers the corner) · Click intersection or wire 1 → wire 2 · Or click one bend point to bevel it · Right-click exits (C)")] });
  const EDITS = ["tr", "tf", "tc", "ex"], ROUTEFAM = ["cu", "pt", ...EDITS];
  function editSync(t) {   // Route + Sửa dây (Trim / Fillet / Chamfer / Extend) dùng chung popout #plFlyP: vẽ xong sửa luôn, khỏi đi tìm nút
    const on = EDITS.includes(t), fam = ROUTEFAM.includes(t), fp = $("#plFlyP"), rb = $("#plTcu"); if (on) S.editTool = t;
    if (typeof closeAllPopouts === "function") {
      if (fam) closeAllPopouts("plFlyP");
      else if (t === "dr") closeAllPopouts("plFlyD");
      else if (t !== "jw") closeAllPopouts();
    }
    if (fp) {
      fp.classList.toggle("on", fam); { const ci = $("#plChSize"); if (ci) ci.value = chamferSize(); }
      fp.querySelectorAll("[data-tool]").forEach(x => x.classList.toggle("on", x.dataset.tool === t));
      if (fam && rb) { const st = $("#plStage"); fp.style.top = Math.max(6, Math.min(rb.getBoundingClientRect().top - st.getBoundingClientRect().top, st.clientHeight - fp.offsetHeight - 6)) + "px"; }
    }
    if (rb) rb.classList.toggle("on", fam);
    const bt = $("#plTtr"); if (bt) bt.classList.toggle("on", on);
    if (t === "dr") { drawFly(); const fd = $("#plFlyD"), st = $("#plStage"), db = $("#plTdr"); fd.classList.add("on"); if (db) { const top = db.getBoundingClientRect().top - st.getBoundingClientRect().top; fd.style.top = Math.max(6, Math.min(top, st.clientHeight - fd.offsetHeight - 6)) + "px"; } } else if ($("#plFlyD")) $("#plFlyD").classList.remove("on");
  }
  function setTool(t, force) {
    if (t === "saw" && !force && !sawReady(true)) return;
    if (LY.tmp) cancel(); ui.tool = t; ui.weld1 = null; svg.dataset.tool = t;
    $$(".pl-tools [data-tool], #plFly [data-tool], #plBar [data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === t));
    $$("#plTips [data-tp]").forEach(b => b.classList.toggle("on", b.dataset.tp === t));
    editSync(t);
    $("#plHint").textContent = t === "sel" ? "" : TOOLS()[t][0] + ": " + TOOLS()[t][1];
    if (window.SketchWBPlugin && window.SketchWBPlugin.onPcbToolChange) window.SketchWBPlugin.onPcbToolChange(t);
    syncCtxBar();
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
      ? L("Đã hàn nối 2 dây không vát góc (Fillet) và cắt gọn phần nhú dư.", "Welded traces with sharp corner (Fillet) and trimmed excess.")
      : L("Đã hàn nối 2 dây có vát góc 45° (Chamfer) và cắt gọn phần nhú dư.", "Welded traces with 45° bevel (Chamfer) and trimmed excess."));
    return true;
  }
  // ---- Chamfer theo điểm: vát góc tại 1 điểm gập. Cỡ mặc định S.chamferSize (2,5 mm); tự co khi 2 đoạn kề ngắn hoặc khi vát xong bị lỗi khoảng cách ----
  function chamferSize() { const v = +S.chamferSize; return v >= .5 && v <= 10 ? v : 2.5; }
  function vertexAt(p) {   // điểm gập (không phải đầu dây) gần điểm p
    let best = null;
    for (const t of S.traces) for (let i = 1; i < t.pts.length - 1; i++) { const d = Math.hypot(t.pts[i][0] - p.x, t.pts[i][1] - p.y); if (d < Math.max(1.0, traceW(t) / 2 + .3) && (!best || d < best.d)) best = { t, i, d }; }
    return best;
  }
  // Vát song song: nếu bên cạnh có dây khác đã vát 45° cùng kiểu (hai chân kề song song với 2 chân của góc này), chọn cỡ vát để đường vát mới song song và cách đều đúng bằng khoảng cách giữa 2 dây
  function parallelBevel(t, i, size, dlim) {
    const P = t.pts[i], A = t.pts[i - 1], B = t.pts[i + 1], nrm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
    const u1 = nrm([A[0] - P[0], A[1] - P[1]]), u2 = nrm([B[0] - P[0], B[1] - P[1]]);
    if (Math.abs(u1[0] * u2[0] + u1[1] * u2[1]) > .08) return null;   // chỉ áp dụng cho góc ~90°
    const n = nrm([u1[0] + u2[0], u1[1] + u2[1]]), w = nrm([u1[0] - u2[0], u1[1] - u2[1]]);
    const par = (a, b, u) => { const x = b[0] - a[0], y = b[1] - a[1], l = Math.hypot(x, y); return l > .3 && Math.abs((x * u[1] - y * u[0]) / l) < .06; };
    let best = null;
    for (const o of S.traces) {
      if (o === t) continue;
      for (let k = 1; k < o.pts.length - 2; k++) {
        const D0 = o.pts[k], D1 = o.pts[k + 1], dl = Math.hypot(D1[0] - D0[0], D1[1] - D0[1]); if (dl < .8 || dl > 10) continue;
        if (Math.abs(((D1[0] - D0[0]) * w[1] - (D1[1] - D0[1]) * w[0]) / dl) > .06) continue;   // đoạn vát của dây kia phải song song với đường vát mới
        if (Math.hypot((D0[0] + D1[0]) / 2 - P[0], (D0[1] + D1[1]) / 2 - P[1]) > 3 * size + 8) continue;
        const gs = []; for (const [a, b] of [[o.pts[k - 1], D0], [D1, o.pts[k + 2]]]) for (const u of [u1, u2]) if (par(a, b, u)) gs.push(Math.abs((a[0] - P[0]) * u[1] - (a[1] - P[1]) * u[0]));
        if (gs.length !== 2 || Math.abs(gs[0] - gs[1]) > .35) continue;
        const g = (gs[0] + gs[1]) / 2; if (g < .8 || g > 8) continue;
        const hD = n[0] * (D0[0] - P[0]) + n[1] * (D0[1] - P[1]);
        for (const sg of [1, -1]) { const d = Math.SQRT2 * (hD + sg * g); if (d >= .5 && d <= dlim && (best == null || Math.abs(d - size) < Math.abs(best - size))) best = d; }
      }
    }
    return best == null ? null : r3(best);
  }
  function chamferVertex(t, i, size) {
    if (!t || i <= 0 || i >= t.pts.length - 1) return toast(L("Đầu dây không có góc để vát – chọn một điểm gập (ô vuông).", "A trace end has no corner to bevel – select a bend point (square)."));
    const orig = t.pts, P = orig[i], A = orig[i - 1], B = orig[i + 1], v1 = [A[0] - P[0], A[1] - P[1]], v2 = [B[0] - P[0], B[1] - P[1]], l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
    if (l1 < .3 || l2 < .3) return toast(L("Đoạn kề quá ngắn để vát.", "The adjacent segment is too short to bevel."));
    const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)))) * 180 / Math.PI;
    if (ang > 175) return toast(L("Điểm này thẳng hàng, không có góc để vát.", "This point is straight – there is no corner to bevel."));
    if (Math.abs(ang - 135) < 2) return toast(L("Góc này đã là 135° (đã vát 45°) – không cần vát nữa.", "This corner is already 135° (bevelled) – nothing to do."));
    const mk = d => [...orig.slice(0, i), [r3(P[0] + v1[0] / l1 * d), r3(P[1] + v1[1] / l1 * d)], [r3(P[0] + v2[0] / l2 * d), r3(P[1] + v2[1] / l2 * d)], ...orig.slice(i + 1)];
    const dmax = Math.min(size, l1 / 2, l2 / 2), P0 = pads(), bad0 = drc(P0).length; let d = dmax, ok = false, parOk = false;
    const dp = parallelBevel(t, i, size, Math.min(l1, l2) * .9);
    if (dp != null) { t.pts = mk(dp); if (drc(P0).length <= bad0) { d = dp; ok = true; parOk = true; } t.pts = orig; }
    if (!ok) for (; ; d = r3(d - .5)) { t.pts = mk(d); if (drc(P0).length <= bad0) { ok = true; break; } if (d - .5 < .5 - 1e-9) break; }
    t.pts = orig;
    if (!ok) return toast(L("Vát cỡ nhỏ nhất vẫn gây lỗi khoảng cách (sát dây / chân bên cạnh) – không vát.", "Even the smallest bevel breaks clearance (too close to a neighbour) – not applied."));
    checkpoint(); t.pts = mk(d); t.lock = true; ui.sel = { t: "t", id: t.id, v: i }; ui.hlNet = t.net; render();
    toast(L(`Đã vát góc ${d} mm`, `Bevelled ${d} mm`) + (parOk ? L(" (song song, cách đều dây bên cạnh)", " (parallel, evenly spaced with the neighbour)") : d < size - 1e-6 ? L(" (tự co cho vừa chỗ trống)", " (shrunk to fit)") : ""));
  }
  // ---- Fillet bằng 2 điểm: mỗi đầu dây tự do trượt thẳng theo hướng đoạn của nó cho tới khi gặp nhau; đầu còn lại của mỗi dây neo cố định ----
  function freeEndAt(p) {   // đầu dây tự do (không dính chân / lỗ / thân dây cùng mạng) gần điểm p
    let best = null;
    for (const t of S.traces) for (const i of [0, t.pts.length - 1]) {
      const e = t.pts[i], d = Math.hypot(e[0] - p.x, e[1] - p.y);
      if (d < Math.max(1.2, traceW(t) / 2 + .5) && !heldEnd(e, t) && (!best || d < best.d)) best = { t, i, d };
    }
    return best;
  }
  function endInfo(e) {   // điểm đầu, điểm kề, hướng đi ra ngoài của đoạn cuối
    const pts = e.t.pts, pe = pts[e.i], nb = pts[e.i === 0 ? 1 : pts.length - 2], dx = pe[0] - nb[0], dy = pe[1] - nb[1], l = Math.hypot(dx, dy);
    return { pe, nb, l, d: l ? [dx / l, dy / l] : [0, 0] };
  }
  function computeSlide(a, b) {
    if (a.t === b.t) return { err: L("Hai điểm thuộc cùng một dây – Fillet nối 2 dây khác nhau.", "Both points are on the same trace – Fillet joins two different traces.") };
    const A = endInfo(a), B = endInfo(b); if (!A.l || !B.l) return null;
    const cr = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(cr) < .03) return { err: L("Hai dây song song – không bao giờ gặp nhau, không nối được.", "The two traces are parallel – they never meet.") };
    const wx = B.pe[0] - A.pe[0], wy = B.pe[1] - A.pe[1], u = (wx * B.d[1] - wy * B.d[0]) / cr, v = (wx * A.d[1] - wy * A.d[0]) / cr;
    if (A.l + u < .3 || B.l + v < .3) return { err: L("Điểm gặp nằm sau đầu neo – dây phải quay đầu, không nối được.", "The meeting point is behind the anchored end – the trace would have to turn back.") };
    const P = [r3(A.pe[0] + u * A.d[0]), r3(A.pe[1] + u * A.d[1])];
    if (P[0] < -15 || P[1] < -15 || P[0] > S.board.w + 15 || P[1] > S.board.h + 15) return { err: L("Điểm gặp nằm quá xa ngoài bo.", "The meeting point is far outside the board.") };
    const arm1 = a.i === a.t.pts.length - 1 ? a.t.pts.slice(0, -1) : a.t.pts.slice(1).reverse(), arm2 = b.i === 0 ? b.t.pts.slice(1) : b.t.pts.slice(0, -1).reverse();
    const warns = [], ang = Math.acos(Math.max(-1, Math.min(1, A.d[0] * B.d[0] + A.d[1] * B.d[1]))) * 180 / Math.PI;
    if (a.t.net !== b.t.net && !isFree(a.t.net) && !isFree(b.t.net)) warns.push(L(`Khác mạng (${a.t.net} ≠ ${b.t.net}) – sẽ báo chập mạch, Ctrl+Z để hoàn tác`, `Different nets (${a.t.net} ≠ ${b.t.net}) – will show as a short, Ctrl+Z to undo`));
    if (ang < 89) warns.push(L(`góc nhọn ${Math.round(ang)}° dễ đọng axit khi ăn mòn`, `sharp ${Math.round(ang)}° corner can trap etchant`));
    return { pts: simplify([...arm1, P, ...arm2]), t1: a.t, t2: b.t, net: isFree(a.t.net) ? b.t.net : a.t.net, P, warn: warns.join("; ") };
  }
  function pickSlide2(p) {
    const a = ui.weld1.pt, e2 = freeEndAt(p);
    if (!e2) return toast(L("Bấm vào đầu dây tự do thứ 2 (đầu không dính chân) – hoặc chuột phải / Esc để thoát.", "Click the 2nd free trace end (not on a pin) – or right-click / Esc to exit."));
    if (e2.t === a.t && e2.i === a.i) return toast(L("Hãy bấm điểm thứ 2 khác điểm đầu.", "Click a 2nd point different from the first."));
    const w = computeSlide(a, e2);
    if (!w) return toast(L("Không nối được 2 điểm này.", "Cannot join these two points."));
    if (w.err) return toast("⛔ " + w.err);
    if (applyWeld(w, "fill")) toast(L("Đã nối 2 điểm (Fillet): mỗi đầu trượt thẳng theo hướng đoạn của nó.", "Joined 2 points (Fillet): each end slid straight along its own direction.") + (w.warn ? " ⚠ " + w.warn : ""));
  }
  function drawSlidePreview(p) {
    const a = ui.weld1.pt, ea = a.t.pts[a.i];
    el("circle", { cx: ea[0], cy: ea[1], r: 1.1, class: "pen-nib" }, LY.tmp);
    const e2 = freeEndAt(p); if (!e2 || (e2.t === a.t && e2.i === a.i)) return;
    const w = computeSlide(a, e2), q = e2.t.pts[e2.i];
    if (w && w.pts) { el("path", { d: "M" + w.pts.map(r => r.join(" ")).join(" L"), "stroke-width": traceW(a.t), class: "cu tmp" + (w.warn ? " bad" : "") }, LY.tmp); el("circle", { cx: w.P[0], cy: w.P[1], r: .55, class: "pen-nib" }, LY.tmp); }
    else el("circle", { cx: q[0], cy: q[1], r: 1.3, fill: "none", "stroke-width": .3, class: "cu tmp bad" }, LY.tmp);
  }
  function drawWeldPreview(p, mode) {
    LY.tmp.innerHTML = "";
    if (ui.weld1 && ui.weld1.pt) return drawSlidePreview(p);
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
    if (mode === "chamfer" && !ui.weld1) { const vv = vertexAt(p); if (vv) return chamferVertex(vv.t, vv.i, chamferSize()); }   // bấm sát 1 điểm gập → vát luôn
    if (mode === "fill") {   // Fillet bằng 2 điểm: bấm đầu dây tự do thứ 1 → bấm đầu dây tự do thứ 2
      if (ui.weld1 && ui.weld1.pt) return pickSlide2(p);
      const e1 = !ui.weld1 && freeEndAt(p);
      if (e1) {
        ui.weld1 = { pt: e1 }; ui.sel = { t: "t", id: e1.t.id }; ui.hlNet = e1.t.net; render(); drawWeldPreview(p, mode);
        $("#plHint").textContent = "Fillet (F): " + L("Đã chọn điểm 1 – bấm đầu dây tự do thứ 2: mỗi đầu trượt thẳng cho tới khi gặp nhau (Chuột phải / Esc để thoát)", "Point 1 selected – click a 2nd free end: each end slides straight until they meet (Right-click / Esc to exit)");
        return;
      }
    }
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
    $("#plHint").textContent = (mode === "fill" ? "Fillet (F): " : "Chamfer (C): ") + L("Đã chọn dây 1 – bấm tiếp dây thứ 2 để hàn nối (Chuột phải / Esc để thoát)", "Wire 1 selected – click Wire 2 to weld (Right-click / Esc to exit)");
  }
  // Extend: kéo dài đầu mút đường đồng theo hướng đoạn cuối tới đường / chân cùng mạng gần nhất
  function pickExtend(p) {
    let best = null;
    for (const t of S.traces) for (const k of [0, t.pts.length - 1]) { const q = t.pts[k], d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < 3 && (!best || d < best.d)) best = { t, k, d }; }
    if (!best) return toast(L("Bấm gần đầu mút của một đường đồng để kéo dài.", "Click near the end of a trace to extend it."));
    const { t, k } = best, e = t.pts[k], pr = t.pts[k === 0 ? 1 : t.pts.length - 2], dx = e[0] - pr[0], dy = e[1] - pr[1], L0 = Math.hypot(dx, dy);
    if (!L0) return;
    const ux = dx / L0, uy = dy / L0; let hit = null;
    const take = (d, x, y) => { if (d > .05 && (!hit || d < hit.d)) hit = { d, x, y }; };
    for (const u of S.traces) if (u !== t && (u.net === t.net || isFree(u.net) || isFree(t.net))) for (let m = 1; m < u.pts.length; m++) {
      const a = u.pts[m - 1], b = u.pts[m], vx = b[0] - a[0], vy = b[1] - a[1], den = ux * vy - uy * vx; if (Math.abs(den) < 1e-9) continue;
      const wx = a[0] - e[0], wy = a[1] - e[1], s1 = (wx * vy - wy * vx) / den, s2 = (wx * uy - wy * ux) / den;
      if (s1 > 0 && s2 >= 0 && s2 <= 1) take(s1, e[0] + ux * s1, e[1] + uy * s1);
    }
    for (const q of pads()) if (!q.jw && !q.hole && q.net === t.net) { const wx = q.x - e[0], wy = q.y - e[1], along = wx * ux + wy * uy, off = Math.abs(wx * uy - wy * ux); if (along > .3 && off < 0.6) take(along, q.x, q.y); }
    if (!hit) return toast(L("Phía trước đầu này không có đường / chân cùng mạng để nối tới.", "Nothing of the same net ahead of this end."));
    checkpoint(); t.pts[k] = [r3(hit.x), r3(hit.y)]; t.lock = true; ui.sel = { t: "t", id: t.id }; render();
    toast(L(`Đã kéo dài ${hit.d.toFixed(1)} mm.`, `Extended ${hit.d.toFixed(1)} mm.`));
  }
  function triggerWeldCmd(mode) {
    const toolKey = mode === "fill" ? "tf" : "tc";
    if (mode === "chamfer" && ui.sel && ui.sel.t === "t" && ui.sel.v != null) { const tv = S.traces.find(x => x.id === ui.sel.id); if (tv) return chamferVertex(tv, ui.sel.v, chamferSize()); }   // đã chọn 1 điểm gập (ô vuông) → vát luôn
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
        $("#plHint").textContent = (mode === "fill" ? "Fillet (F): " : "Chamfer (C): ") + L("Đã chọn dây 1 – bấm tiếp dây thứ 2 để hàn nối (Chuột phải / Esc để thoát)", "Wire 1 selected – click Wire 2 to weld (Right-click / Esc to exit)");
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
  // Construct Line: đường gióng định vị khoảng cách giữa 2 điểm (A làm mốc cố định, B đẩy linh kiện / đầu dây theo)
  // Tự động snap thẳng hàng khi góc lệch ≤ 2°, chuột phải chuyển đổi Thẳng / Ngang / Dọc
  function csAlign(a, b, shift, mode) {
    if (!a || !b) return b;
    if (mode === "x") return [b[0], a[1]];
    if (mode === "y") return [a[0], b[1]];
    const dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy);
    if (dist < 1e-4) return [b[0], b[1]];
    if (shift) {
      if (Math.abs(dx) >= Math.abs(dy)) return [b[0], a[1]];
      return [a[0], b[1]];
    }
    // Tự động snap thẳng hàng khi gần thẳng (< 2 độ), luôn luôn hiệu lực bất kể snapmode
    const degX = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
    if (degX < 2) return [b[0], a[1]]; // Thẳng ngang
    const degY = Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI;
    if (degY < 2) return [a[0], b[1]]; // Thẳng dọc
    return [b[0], b[1]];
  }
  function csSnap(p) {
    // Chỉ snap vào điểm và cạnh của: chân/thân linh kiện, lỗ khoan, dây (trace), hình vẽ (paint), và viền PCB (KHÔNG snap lưới PCB)
    // 1. Tâm Pad linh kiện / chân pin
    let bestPad = null, minD = 2.0;
    for (const q of (A ? A.P : pads())) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < minD) { minD = d; bestPad = q; }
    }
    if (bestPad) {
      const c = bestPad.c && S.comps.includes(bestPad.c) ? bestPad.c : S.comps.find(x => x.id === (bestPad.c && bestPad.c.id));
      return { pt: [bestPad.x, bestPad.y], target: { type: "pad", pad: bestPad, comp: c } };
    }

    // 2. Tâm lỗ khoan / lỗ jumper
    let bestHole = null, minHd = 1.8;
    for (const h of (S.holes || [])) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d < minHd) { minHd = d; bestHole = h; }
    }
    if (bestHole) return { pt: [bestHole.x, bestHole.y], target: { type: "hole", hole: bestHole } };

    // 3. Điểm góc (vertex) hoặc đầu mút của trace
    let bestVtx = null, minVd = 1.6;
    for (const t of S.traces) {
      for (let k = 0; k < t.pts.length; k++) {
        const d = Math.hypot(t.pts[k][0] - p.x, t.pts[k][1] - p.y);
        if (d < minVd) { minVd = d; bestVtx = { pt: [...t.pts[k]], trace: t, k }; }
      }
    }
    if (bestVtx) return { pt: bestVtx.pt, target: { type: "traceVtx", trace: bestVtx.trace, k: bestVtx.k } };

    // 4. Cạnh / thân đoạn trace (bán kính 1.4 mm để dễ bắt dây mảnh)
    const sg = segAt(p);
    if (sg) {
      const q = proj(sg.t, p).q;
      return { pt: q, target: { type: "trace", trace: sg.t, k: sg.k } };
    }
    let bestSg = null, minSd = 1.4;
    for (const t of S.traces) {
      for (let k = 0; k < t.pts.length - 1; k++) {
        const a = t.pts[k], b = t.pts[k + 1];
        const d = segDist(p.x, p.y, a[0], a[1], b[0], b[1]);
        if (d < minSd) {
          minSd = d;
          const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
          const u = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / l2));
          bestSg = { pt: [r3(a[0] + u * dx), r3(a[1] + u * dy)], trace: t, k };
        }
      }
    }
    if (bestSg) return { pt: bestSg.pt, target: { type: "trace", trace: bestSg.trace, k: bestSg.k } };

    // 5. Góc và cạnh thân linh kiện (compBox)
    let bestCE = null, minCE = 1.6;
    for (const c of [...S.comps].reverse()) {
      const b = compBox(c);
      const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
      for (const [cx, cy] of corners) {
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < minCE) { minCE = d; bestCE = { pt: [r3(cx), r3(cy)], comp: c }; }
      }
      const edges = [
        [[b.x0, b.y0], [b.x1, b.y0]],
        [[b.x1, b.y0], [b.x1, b.y1]],
        [[b.x1, b.y1], [b.x0, b.y1]],
        [[b.x0, b.y1], [b.x0, b.y0]]
      ];
      for (const [e0, e1] of edges) {
        const d = segDist(p.x, p.y, e0[0], e0[1], e1[0], e1[1]);
        if (d < minCE) {
          const dx = e1[0] - e0[0], dy = e1[1] - e0[1], l2 = dx * dx + dy * dy || 1;
          const u = Math.max(0, Math.min(1, ((p.x - e0[0]) * dx + (p.y - e0[1]) * dy) / l2));
          minCE = d;
          bestCE = { pt: [r3(e0[0] + u * dx), r3(e0[1] + u * dy)], comp: c };
        }
      }
    }
    if (bestCE) return { pt: bestCE.pt, target: { type: "compEdge", comp: bestCE.comp } };

    // 6. Hình vẽ / Paint (đỉnh hoặc cạnh)
    for (const it of (S.art || [])) {
      const b = artBox(it);
      if (p.x >= b.x0 - 1.2 && p.x <= b.x1 + 1.2 && p.y >= b.y0 - 1.2 && p.y <= b.y1 + 1.2) {
        let bestArtPt = null, minAd = 1.6;
        for (const pa of it.paths) {
          for (const pt of pa.pts) {
            const d = Math.hypot(pt[0] - p.x, pt[1] - p.y);
            if (d < minAd) { minAd = d; bestArtPt = pt; }
          }
        }
        if (bestArtPt) return { pt: [bestArtPt[0], bestArtPt[1]], target: { type: "art", art: it } };
        return { pt: [r3(b.cx), r3(b.cy)], target: { type: "art", art: it } };
      }
    }

    // 7. Viền PCB (góc & cạnh biên bo mạch, hỗ trợ cả bo đã cưa poly)
    const B = S.board;
    if (B && B.poly && B.poly.length) {
      let bestPoly = null, minPd = 1.6;
      for (const ring of B.poly) {
        for (const [vx, vy] of ring) {
          const d = Math.hypot(vx - p.x, vy - p.y);
          if (d < minPd) { minPd = d; bestPoly = { pt: [r3(vx), r3(vy)], edge: "corner" }; }
        }
        const nr = nearestOnRing(ring, p.x, p.y);
        if (nr && nr.d < minPd) { minPd = nr.d; bestPoly = { pt: [r3(nr.x), r3(nr.y)], edge: "poly" }; }
      }
      if (bestPoly) return { pt: bestPoly.pt, target: { type: "boardEdge", edge: bestPoly.edge } };
    } else if (B && B.w && B.h) {
      const corners = [[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]];
      for (const [cx, cy] of corners) {
        if (Math.hypot(cx - p.x, cy - p.y) < 1.8) {
          return { pt: [cx, cy], target: { type: "boardEdge", edge: "corner", x: cx, y: cy } };
        }
      }
      if (Math.abs(p.y) < 1.6 && p.x >= 0 && p.x <= B.w) return { pt: [r3(p.x), 0], target: { type: "boardEdge", edge: "top" } };
      if (Math.abs(p.y - B.h) < 1.6 && p.x >= 0 && p.x <= B.w) return { pt: [r3(p.x), B.h], target: { type: "boardEdge", edge: "bottom" } };
      if (Math.abs(p.x) < 1.6 && p.y >= 0 && p.y <= B.h) return { pt: [0, r3(p.y)], target: { type: "boardEdge", edge: "left" } };
      if (Math.abs(p.x - B.w) < 1.6 && p.y >= 0 && p.y <= B.h) return { pt: [B.w, r3(p.y)], target: { type: "boardEdge", edge: "right" } };
    }

    // Không snap lưới PCB — giữ toạ độ tự do chính xác
    return { pt: [r3(p.x), r3(p.y)], target: { type: "free" } };
  }

  /* ---------- Dim ràng buộc kiểu SolidCraft: nhiều Dim lưu trong S.dims, giải bằng PCBSolver (js/pcb-solver.js) ----------
     Trọng số dời: đỉnh đường đồng rẻ nhất → lỗ khoan → linh kiện (khối cứng); bo PCB khoá. Dim gây thừa ràng buộc → Dim tham chiếu (số trong ngoặc).
     Đặt: bấm điểm / cạnh thứ 1, thứ 2, rê để chọn kiểu (trên/dưới = ngang, trái/phải = dọc, vuông góc đoạn nối = thẳng), bấm để đặt rồi gõ số. */
  const DW = { tv: 0.01, hole: 0.3, comp: 1 };
  const dimOutline = () => { const B = S.board; if (!B || S.noBoard) return []; return B.poly || [[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]]; };
  const dimPx = () => { const r = svg.getBoundingClientRect(); return (cam ? cam.w : 100) / (r.width || 800); };
  const DTOL = .05;
  // đỉnh dây: { tr, k, n (số điểm của đường lúc nhớ), x, y }. Thêm / xoá điểm neo hay thay đường → tìm lại theo toạ độ đã nhớ
  function tvFix(r) {
    let t = S.traces.find(t => t.id === r.tr);
    if (t && t.pts[r.k] && (r.n == null || r.n === t.pts.length)) { const q = t.pts[r.k]; r.n = t.pts.length; r.x = q[0]; r.y = q[1]; return q; }
    if (r.x == null) return null;
    const near = u => u.pts.findIndex(q => Math.hypot(q[0] - r.x, q[1] - r.y) < DTOL);
    if (t) { const k = near(t); if (k >= 0) { r.k = k; r.n = t.pts.length; return t.pts[k]; } }
    for (const u of S.traces) { const k = near(u); if (k >= 0) { r.tr = u.id; r.k = k; r.n = u.pts.length; return u.pts[k]; } }
    return null;
  }
  // đoạn dây: { tr, k, n, x0, y0, x1, y1 } – tìm lại theo 2 đầu đã nhớ (chiều nào cũng được)
  function teFix(e) {
    let t = S.traces.find(t => t.id === e.tr);
    const ok = (u, k) => u.pts[k] && u.pts[k + 1];
    if (t && ok(t, e.k) && (e.n == null || e.n === t.pts.length)) { const a = t.pts[e.k], b = t.pts[e.k + 1]; Object.assign(e, { n: t.pts.length, x0: a[0], y0: a[1], x1: b[0], y1: b[1] }); return true; }
    if (e.x0 == null) return false;
    const m = (q, x, y) => Math.hypot(q[0] - x, q[1] - y) < DTOL;
    const find = u => { for (let k = 0; k < u.pts.length - 1; k++) { const a = u.pts[k], b = u.pts[k + 1]; if ((m(a, e.x0, e.y0) && m(b, e.x1, e.y1)) || (m(a, e.x1, e.y1) && m(b, e.x0, e.y0))) return k; } return -1; };
    for (const u of t ? [t, ...S.traces.filter(x => x !== t)] : S.traces) { const k = find(u); if (k >= 0) { e.tr = u.id; e.k = k; e.n = u.pts.length; return true; } }
    return false;
  }
  function dimRefPt(r) {
    if (!r) return null;
    if (r.t === "fix") return [r.x, r.y];
    if (r.t === "pad") { const q = pads().find(q => q.c && q.c.id === r.c && q.i === r.i); return q ? [q.x, q.y] : null; }
    if (r.t === "cb") { const c = S.comps.find(c => c.id === r.c); return c ? [c.x + r.ox, c.y + r.oy] : null; }
    if (r.t === "tv") { const q = tvFix(r); return q ? [q[0], q[1]] : null; }
    if (r.t === "hole") { const h = (S.holes || []).find(h => h.id === r.id); return h ? [h.x, h.y] : null; }
    return null;
  }
  function dimEdgeRefs(e) {
    if (!e) return null;
    if (e.t === "bedge") { const P = dimOutline(), a = P[e.i], b = P[(e.i + 1) % P.length]; return a && b ? [{ t: "fix", x: a[0], y: a[1] }, { t: "fix", x: b[0], y: b[1] }] : null; }
    if (e.t === "cedge") return [{ t: "cb", c: e.c, ox: e.o0[0], oy: e.o0[1] }, { t: "cb", c: e.c, ox: e.o1[0], oy: e.o1[1] }];
    if (e.t === "tedge") { if (!teFix(e)) return null; return [{ t: "tv", tr: e.tr, k: e.k, n: e.n, x: e.x0, y: e.y0 }, { t: "tv", tr: e.tr, k: e.k + 1, n: e.n, x: e.x1, y: e.y1 }]; }
    return null;
  }
  function dimOwner(r) {
    if (r.t === "pad" || r.t === "cb") return { key: "c" + r.c, w: DW.comp };
    if (r.t === "hole") return { key: "h" + r.id, w: DW.hole };
    if (r.t === "tv") {
      const t = S.traces.find(t => t.id === r.tr), q = t && t.pts[r.k];
      if (q) { const pd = pads().find(p => p.c && Math.hypot(p.x - q[0], p.y - q[1]) < .05); if (pd) return { key: "c" + pd.c.id, w: DW.comp }; }   // đầu dây dính chân: đi theo linh kiện
      return { key: "t" + r.tr + ":" + r.k, w: DW.tv };
    }
    return null;   // điểm cố định (bo)
  }
  function dimProblem(hold, extra, keepDir) {
    const keys = new Map(), weights = [], H = new Set(), dims = [];
    const ref = (r, noNewComp) => {
      const p = dimRefPt(r); if (!p) return null;
      const o = dimOwner(r); let v = -1;
      if (o && noNewComp && o.key[0] === "c" && !keys.has(o.key)) return { v: -1, x: p[0], y: p[1] };
      if (o) { if (!keys.has(o.key)) { keys.set(o.key, weights.length); weights.push(o.w); if (hold && hold.has(o.key)) H.add(keys.get(o.key)); } v = keys.get(o.key); }
      return { v, x: p[0], y: p[1] };
    };
    for (const d of [...(S.dims || []), ...(extra ? [extra] : [])]) {
      const a = ref(d.a); let b = null;
      if (d.kind === "pe") { const er = dimEdgeRefs(d.b); if (er) { const b0 = ref(er[0]), b1 = ref(er[1]); if (b0 && b1) b = [b0, b1]; } }
      else b = ref(d.b);
      if (!a || !b) continue;
      dims.push({ id: d.id, kind: d.kind, a, b, val: d.val, s: d.s, driven: d.driven, src: d });
    }
    // ràng buộc ngầm: giữ hướng mọi đoạn của đường đồng có đỉnh được dời hoặc dính chân linh kiện được dời (đoạn dời song song, góc 0/45/90° giữ nguyên)
    if (keepDir !== false) {
      const trs = new Set();
      for (const k of keys.keys()) if (k[0] === "t") trs.add(+k.slice(1).split(":")[0]);
      for (const k of [...keys.keys()].filter(k => k[0] === "c")) { const c = S.comps.find(c => "c" + c.id === k), P0 = c ? pads().filter(q => q.c === c) : []; for (const t of S.traces) if ([t.pts[0], t.pts[t.pts.length - 1]].some(e => P0.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .05))) trs.add(t.id); }
      for (const id of trs) {
        const t = S.traces.find(t => t.id === id); if (!t) continue;
        const R = t.pts.map((_, k) => ref({ t: "tv", tr: id, k }, true));
        for (let k = 0; k < R.length - 1; k++) {
          const p = R[k], q = R[k + 1]; if (!p || !q || p.v === q.v) continue;
          const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy); if (L < 1e-6) continue;
          dims.push({ id: "dir" + id + ":" + k, kind: "dir", a: p, b: q, ux: dx / L, uy: dy / L, implicit: true });
        }
      }
    }
    return { nVars: weights.length, weights, dims, hold: H, keys };
  }
  function dimApply(P, u) {
    for (const [key, v] of P.keys) {
      const dx = u[2 * v], dy = u[2 * v + 1]; if (Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7) continue;
      if (key[0] === "c") {
        const c = S.comps.find(c => "c" + c.id === key); if (!c) continue;
        const P0 = pads().filter(q => q.c === c);
        for (const t of S.traces) for (const k of [...new Set([0, t.pts.length - 1])]) if (P0.some(q => Math.hypot(q.x - t.pts[k][0], q.y - t.pts[k][1]) < .05)) t.pts[k] = [r3(t.pts[k][0] + dx), r3(t.pts[k][1] + dy)];
        c.x = r3(c.x + dx); c.y = r3(c.y + dy);
      } else if (key[0] === "h") { const h = (S.holes || []).find(h => "h" + h.id === key); if (h) { h.x = r3(h.x + dx); h.y = r3(h.y + dy); } }
      else { const [tr, k] = key.slice(1).split(":").map(Number), t = S.traces.find(t => t.id === tr); if (t && t.pts[k]) { const o = t.pts[k], nq = [r3(o[0] + dx), r3(o[1] + dy)]; for (const u of S.traces) if (u !== t) for (const j of [0, u.pts.length - 1]) if (Math.hypot(u.pts[j][0] - o[0], u.pts[j][1] - o[1]) < .05) u.pts[j] = [...nq]; t.pts[k] = nq; } }
    }
  }
  // giải lại mọi Dim; hold = Set khoá vật đang kéo ("c" + id linh kiện). Không thoả → không dời gì, Dim lỗi tô đỏ
  function dimSolve(hold) {
    if (!window.PCBSolver || !(S.dims && S.dims.length)) { ui.dimBad = null; return true; }
    let P = dimProblem(hold), r = PCBSolver.solve(P);
    if (!r.ok) { P = dimProblem(hold, null, false); r = PCBSolver.solve(P); }   // giữ hướng không được (vd dây thẳng nối 2 chân) → dây co giãn như cũ
    ui.dimBad = r.ok ? null : new Set(r.failing.filter(id => typeof id === "number"));
    if (r.ok) dimApply(P, r.u);
    return r.ok;
  }
  // bắt điểm / cạnh cho Dim: tâm chân, lỗ, đỉnh dây, góc thân linh kiện, góc bo → điểm; thân dây, cạnh thân linh kiện, mép bo → cạnh
  function dimSnap(p) {
    const px = dimPx(), tol = Math.max(.35, 9 * px);
    let best = null;
    const tryPt = (x, y, ref, r0) => { const d = Math.hypot(x - p.x, y - p.y); if (d < Math.max(tol, r0 || 0) && (!best || d < best.d)) best = { pt: [x, y], ref, d }; };
    for (const q of pads()) if (q.c) tryPt(q.x, q.y, { t: "pad", c: q.c.id, i: q.i }, Math.min(q.r || PAD_R, 1.2));
    if (best) return best;
    for (const h of (S.holes || [])) tryPt(h.x, h.y, { t: "hole", id: h.id });
    for (const t of S.traces) t.pts.forEach((q, k) => tryPt(q[0], q[1], { t: "tv", tr: t.id, k, n: t.pts.length, x: q[0], y: q[1] }));
    for (const c of S.comps) { const b = compBox(c); for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]) tryPt(x, y, { t: "cb", c: c.id, ox: r3(x - c.x), oy: r3(y - c.y) }); }
    dimOutline().forEach(q => tryPt(q[0], q[1], { t: "fix", x: q[0], y: q[1] }));
    if (best) return best;
    let be = null, ed = tol;
    const tryEd = (a, b, edge) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / l2)), q = [a[0] + u * dx, a[1] + u * dy], d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < ed) { ed = d; be = { pt: q, edge }; } };
    for (const t of S.traces) for (let k = 0; k < t.pts.length - 1; k++) tryEd(t.pts[k], t.pts[k + 1], { t: "tedge", tr: t.id, k, n: t.pts.length, x0: t.pts[k][0], y0: t.pts[k][1], x1: t.pts[k + 1][0], y1: t.pts[k + 1][1] });
    for (const c of S.comps) { const b = compBox(c), C = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]; C.forEach((q, i) => { const w = C[(i + 1) % 4]; tryEd(q, w, { t: "cedge", c: c.id, o0: [r3(q[0] - c.x), r3(q[1] - c.y)], o1: [r3(w[0] - c.x), r3(w[1] - c.y)] }); }); }
    const O = dimOutline(); O.forEach((q, i) => tryEd(q, O[(i + 1) % O.length], { t: "bedge", i }));
    return be;
  }
  // khung của một Dim đã phân giải: p0, p1 (điểm đo), dir (hướng đo), n (pháp tuyến), mid
  function dimFrameOf(dd) {
    const p0 = PCBSolver.pt(dd.a); let p1;
    if (dd.kind === "pe") { const e0 = PCBSolver.pt(dd.b[0]), e1 = PCBSolver.pt(dd.b[1]), ex = e1[0] - e0[0], ey = e1[1] - e0[1], l2 = ex * ex + ey * ey || 1, t = ((p0[0] - e0[0]) * ex + (p0[1] - e0[1]) * ey) / l2; p1 = [e0[0] + t * ex, e0[1] + t * ey]; }
    else p1 = PCBSolver.pt(dd.b);
    let dir = dd.kind === "h" ? [1, 0] : dd.kind === "v" ? [0, 1] : [p1[0] - p0[0], p1[1] - p0[1]];
    if (dd.kind === "a" || dd.kind === "pe") { const L = Math.hypot(dir[0], dir[1]); if (L < 1e-6) { if (dd.kind === "pe") { const e0 = PCBSolver.pt(dd.b[0]), e1 = PCBSolver.pt(dd.b[1]), l = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) || 1; dir = [-(e1[1] - e0[1]) / l, (e1[0] - e0[0]) / l]; } else dir = [1, 0]; } else dir = [dir[0] / L, dir[1] / L]; }
    return { p0, p1, dir, n: [-dir[1], dir[0]], mid: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] };
  }
  // vẽ một Dim kiểu SolidCraft (đơn vị theo điểm ảnh màn hình): mũi tên 9 px, hở 3 px, gióng vượt 4 px, chữ nằm ngang trong khoảng ngắt của đường kích thước
  function dimDrawOne(dd, text, layer, cls) {
    const px = dimPx(), AR = 9 * px, GAP = 3 * px, OV = 4 * px, FS = 12 * px, F = dimFrameOf(dd), { p0, p1, dir, n, mid } = F;
    const [al, ac] = text || [0, 22 * px];
    const base = [mid[0] + n[0] * ac, mid[1] + n[1] * ac], at = s => [base[0] + dir[0] * s, base[1] + dir[1] * s];
    const s0 = (p0[0] - mid[0]) * dir[0] + (p0[1] - mid[1]) * dir[1], s1 = (p1[0] - mid[0]) * dir[0] + (p1[1] - mid[1]) * dir[1];
    const ln = (a, b) => el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "pdim-ln " + cls }, layer);
    for (const [pi, si] of [[p0, s0], [p1, s1]]) { const qi = at(si), c = (qi[0] - pi[0]) * n[0] + (qi[1] - pi[1]) * n[1], sg = c < 0 ? -1 : 1; if (Math.abs(c) > GAP) ln([pi[0] + n[0] * sg * GAP, pi[1] + n[1] * sg * GAP], [qi[0] + n[0] * sg * OV, qi[1] + n[1] * sg * OV]); }
    const m = Math.abs(PCBSolver.measure(dd, [])), str = dd.driven ? "(" + nU(m) + ")" : nU(m);
    const hw = str.length * 3.7 * px + GAP, hh = 8 * px, lo = Math.min(s0, s1), hi = Math.max(s0, s1), span = hi - lo;
    const inside = span > 2 * AR + 2 * hw && Math.abs(al) + hw <= span / 2;
    const arrow = (s, sg) => { const T = at(s), B = [T[0] - dir[0] * sg * AR, T[1] - dir[1] * sg * AR], w = AR * .32; el("polygon", { points: [T, [B[0] + n[0] * w, B[1] + n[1] * w], [B[0] - n[0] * w, B[1] - n[1] * w]].map(q => q.join(",")).join(" "), class: "pdim-ar " + cls }, layer); };
    let a0 = lo, a1 = hi;
    if (inside) { arrow(lo, -1); arrow(hi, 1); } else { arrow(lo, 1); arrow(hi, -1); a0 = Math.min(lo - AR * 1.8, al - hw); a1 = Math.max(hi + AR * 1.8, al + hw); }
    if (al - hw > a0) ln(at(a0), at(Math.min(a1, al - hw)));
    if (al + hw < a1) ln(at(Math.max(a0, al + hw)), at(a1));
    const T = at(al);
    el("text", { x: T[0], y: T[1], "font-size": FS, "text-anchor": "middle", "dominant-baseline": "central", class: "pdim-tx " + cls, transform: S.flip ? `translate(${2 * T[0]} 0) scale(-1 1)` : "" }, layer, str);
    return { cx: T[0], cy: T[1], hw, hh, mid, dir, n };
  }
  function drawDims() {
    if (!LY.cs) return; LY.cs.innerHTML = ""; ui.dimHits = [];
    if (!window.PCBSolver || !S.dims || !S.dims.length) return;
    const P = dimProblem(null, null, false);
    if (P.dims.length !== S.dims.length) S.dims = S.dims.filter(d => P.dims.some(x => x.src === d));   // vật bị xoá → bỏ Dim theo
    for (const dd of P.dims) {
      const bad = (ui.dimBad && ui.dimBad.has(dd.id)) || (!dd.driven && Math.abs(PCBSolver.residual(dd, [])) > 2e-3);
      const cls = (dd.driven ? "drv" : bad ? "bad" : "") + (ui.sel && ui.sel.t === "dim" && ui.sel.id === dd.id ? " sel" : "");
      const h = dimDrawOne(dd, dd.src.text, LY.cs, cls); h.id = dd.id; ui.dimHits.push(h);
    }
  }
  function dimAt(p) { const px = dimPx(); return (ui.dimHits || []).find(h => Math.abs(p.x - h.cx) < h.hw + 2 * px && Math.abs(p.y - h.cy) < h.hh + 2 * px) || null; }
  // Dim chưa đặt từ 2 lần chọn + vị trí con trỏ (kiểu tự chọn theo con trỏ như SolidCraft)
  function dimBuild(D, p) {
    let kind, a, b;
    if (D.a.edge && D.b.edge) { a = dimEdgeRefs(D.a.edge)[0]; b = D.b.edge; kind = "pe"; }
    else if (D.a.edge || D.b.edge) { a = (D.a.ref || D.b.ref); b = (D.a.edge || D.b.edge); kind = "pe"; }
    else {
      a = D.a.ref; b = D.b.ref; const pa = dimRefPt(a), pb = dimRefPt(b); if (!pa || !pb) return null;
      const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, dx = pb[0] - pa[0], dy = pb[1] - pa[1], L = Math.hypot(dx, dy) || 1, vx = p.x - mx, vy = p.y - my;
      const along = (vx * dx + vy * dy) / L, across = (dx * vy - dy * vx) / L;
      kind = Math.abs(along) < Math.abs(across) ? "a" : Math.abs(vy) > Math.abs(vx) ? "h" : "v";
      if (kind === "h" && Math.abs(dx) < 1e-3) kind = "a"; if (kind === "v" && Math.abs(dy) < 1e-3) kind = "a";
    }
    const d = { id: S.uid, kind, a, b, val: 0, s: 1, driven: false, text: null };
    const P = dimProblem(null, d, false), dd = P.dims.find(x => x.src === d); if (!dd) return null;
    const m = PCBSolver.measure(dd, []); d.s = m < 0 ? -1 : 1; d.val = r3(Math.abs(m)); dd.s = d.s; dd.val = d.val;
    const F = dimFrameOf(dd), v = [p.x - F.mid[0], p.y - F.mid[1]]; d.text = [r3(v[0] * F.dir[0] + v[1] * F.dir[1]), r3(v[0] * F.n[0] + v[1] * F.n[1])];
    return { d, dd, P };
  }
  function dimPreview(p) {
    if (!LY.tmp) return; LY.tmp.innerHTML = ""; const px = dimPx(), D = ui.dim || {};
    const mark = (k, cls) => { if (!k) return; if (k.edge) { const er = dimEdgeRefs(k.edge), a = er && dimRefPt(er[0]), b = er && dimRefPt(er[1]); if (a && b) el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }, LY.tmp); } else el("circle", { cx: k.pt[0], cy: k.pt[1], r: 5 * px, class: cls }, LY.tmp); };
    mark(D.a, "pdim-pk"); mark(D.b, "pdim-pk");
    if (p && !(D.a && D.b)) mark(dimSnap(p), "pdim-hl");
    if (p && D.a && D.b) { const B = dimBuild(D, p); if (B) dimDrawOne(B.dd, B.d.text, LY.tmp, "pre"); }
  }
  function dimDown(p, e) {
    const D = ui.dim || (ui.dim = {}), k = dimSnap(p);
    if (!D.a) { if (k) D.a = k; return dimPreview(p); }
    if (!D.b) {
      if (k && JSON.stringify(k.ref || k.edge) !== JSON.stringify(D.a.ref || D.a.edge)) { D.b = k; return dimPreview(p); }
      if (!k && D.a.edge) { const er = dimEdgeRefs(D.a.edge); D.a = { pt: dimRefPt(er[0]), ref: er[0] }; D.b = { pt: dimRefPt(er[1]), ref: er[1] }; return dimPlace(p); }   // 1 cạnh rồi bấm chỗ trống: đo độ dài cạnh
      return;
    }
    return dimPlace(p);
  }
  function dimPlace(p) {
    const B = dimBuild(ui.dim, p); ui.dim = null; if (LY.tmp) LY.tmp.innerHTML = ""; if (!B) return;
    const { d } = B; d.id = S.uid++;
    if (PCBSolver.redundant({ nVars: B.P.nVars, dims: B.P.dims.filter(x => x !== B.dd) }, B.dd)) d.driven = true;   // thừa ràng buộc → Dim tham chiếu
    checkpoint(); (S.dims = S.dims || []).push(d); ui.sel = { t: "dim", id: d.id }; save(); render();
    if (!d.driven) dimEdit(d.id);
  }
  // sửa số ngay trên nhãn: Enter = áp dụng (giải lại), Esc = bỏ
  function dimEdit(id) {
    const d = (S.dims || []).find(x => x.id === id); if (!d || d.driven) return;
    const h = (ui.dimHits || []).find(x => x.id === id), st = $("#plStage"); if (!h || !st) return;
    const M = LY.cs.getScreenCTM(), R = st.getBoundingClientRect(); if (!M) return;
    const sx = M.a * h.cx + M.c * h.cy + M.e - R.left, sy = M.b * h.cx + M.d * h.cy + M.f - R.top;
    let inp = $("#plDimEd"); if (!inp) { inp = document.createElement("input"); inp.id = "plDimEd"; inp.type = "text"; inp.className = "pl-dimed"; inp.autocomplete = "off"; st.appendChild(inp); }
    inp.style.left = (sx - 40) + "px"; inp.style.top = (sy - 13) + "px"; inp.hidden = false; inp.value = String(UIN() ? Math.round(d.val / 25.4 * 1e4) / 1e4 : r3(d.val)); inp.focus(); inp.select();
    let fin = false;
    const done = ok => {
      if (fin) return; fin = true; inp.hidden = true; inp.onkeydown = inp.onblur = null;
      const v = parseFloat(String(inp.value).replace(",", ".")) * (UIN() ? 25.4 : 1);
      if (!ok || !(v >= 0) || Math.abs(v - d.val) < 1e-6) return render();
      const snapS = JSON.stringify(S), old = d.val; d.val = r3(v);
      if (dimSolve()) { pushRaw(snapS); save(); } else { d.val = old; }
      render();
    };
    inp.onkeydown = ev => { ev.stopPropagation(); if (ev.key === "Enter") done(true); else if (ev.key === "Escape") done(false); };
    inp.onblur = () => done(true);
  }
  // bấm vào nhãn Dim: chọn; kéo = dời nhãn; bấm đúp = sửa số
  function dimTextDown(e, h) {
    const now = performance.now(), dbl = ui.dimLast && ui.dimLast.id === h.id && now - ui.dimLast.t < 420; ui.dimLast = { id: h.id, t: now };
    ui.sel = { t: "dim", id: h.id }; ui.hlNet = null;
    if (dbl) { render(); return dimEdit(h.id); }
    const d = S.dims.find(x => x.id === h.id), snapS = JSON.stringify(S); let moved = false;
    ui.drag = { move: p => { const v = [p.x - h.mid[0], p.y - h.mid[1]]; d.text = [r3(v[0] * h.dir[0] + v[1] * h.dir[1]), r3(v[0] * h.n[0] + v[1] * h.n[1])]; moved = true; render(); }, up: () => { if (moved) { pushRaw(snapS); save(); } render(); } };
    render();
  }
  function csPick(p, ev) {
    const s = csSnap(p);
    if (!ui.cs || ui.cs.fixed) {
      ui.cs = { a: s.pt, b: s.pt, targetA: s.target, targetB: s.target, mode: "d", fixed: false };
      ui.sel = null;
    } else {
      const q = csAlign(ui.cs.a, s.pt, !!(ev && ev.shiftKey), ui.cs.mode);
      if (Math.hypot(q[0] - ui.cs.a[0], q[1] - ui.cs.a[1]) < 0.05) return;
      ui.cs.b = q;
      ui.cs.targetB = s.target;
      ui.cs.fixed = true;
      ui.sel = { t: "cs" };
    }
    drawCs();
    renderCsPop();
    panel();
  }
  function drawCs(hover) {
    if (ui.cs && ui.cs.fixed) {
      if (LY.tmp) LY.tmp.innerHTML = "";
    }
    const layer = (ui.cs && ui.cs.fixed) ? (LY.cs || LY.tmp) : LY.tmp;
    layer.innerHTML = "";
    const k = cam ? cam.w / 120 : 1;
    if (hover) el("circle", { cx: hover[0], cy: hover[1], r: .6 * k, class: "cspt-ring" }, layer);
    if (!ui.cs) return;

    const [a, b] = [ui.cs.a, ui.cs.b], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    // 1. Đường gióng nét liền màu đỏ siêu mảnh
    el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "stroke-width": .15 * k, class: "csln" }, layer);

    // 2. Hai đầu neo tròn chắc chắn bám tâm pad
    el("circle", { cx: a[0], cy: a[1], r: .45 * k, class: "cspt cspt-anchor" }, layer);
    el("circle", { cx: b[0], cy: b[1], r: .45 * k, class: "cspt cspt-target" }, layer);

    if (d > .01) {
      const tickLen = 1.2 * k;
      const nx = (-dy / d) * tickLen, ny = (dx / d) * tickLen;
      // Vạch chặn ở 2 đầu vuông góc
      el("line", { x1: a[0] - nx, y1: a[1] - ny, x2: a[0] + nx, y2: a[1] + ny, "stroke-width": .18 * k, class: "cstick" }, layer);
      el("line", { x1: b[0] - nx, y1: b[1] - ny, x2: b[0] + nx, y2: b[1] + ny, "stroke-width": .18 * k, class: "cstick" }, layer);

      // 3. Chỉ có duy nhất con số kích thước mm hiển thị tinh gọn giữa thân đường gióng
      const mode = ui.cs.mode || "d";
      const val = mode === "x" ? Math.abs(dx) : mode === "y" ? Math.abs(dy) : d;
      const offsetDist = 1.4 * k;
      const tx = (a[0] + b[0]) / 2 + (-dy / d) * offsetDist;
      const ty = (a[1] + b[1]) / 2 + (dx / d) * offsetDist;
      const modeTag = mode === "x" ? " (X)" : mode === "y" ? " (Y)" : "";
      el("text", { x: tx, y: ty, "font-size": 2.1 * k, class: "cstx", transform: S.flip ? `translate(${2 * tx} 0) scale(-1 1)` : "" }, layer, `${fU(val)}${modeTag}`);
    }
  }

  // Thước: bấm điểm 1 → rê → bấm điểm 2 để giữ số đo (có thể đo nhiều đường liên tục). Điểm bám tâm chân / lỗ, tâm đường đồng, nếu không thì lưới 0,635
  // Giữ Shift hoặc góc lệch trục ≤ 2°: tự động nắn thẳng hàng theo trục ngang / dọc
  function measAlign(a, b, shift) {
    if (!a || !b) return b;
    const dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy);
    if (dist < 1e-4) return [b[0], b[1]];
    if (shift) {
      if (Math.abs(dx) >= Math.abs(dy)) return [b[0], a[1]];
      return [a[0], b[1]];
    }
    const degX = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
    if (degX <= 2) return [b[0], a[1]];
    const degY = Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI;
    if (degY <= 2) return [a[0], b[1]];
    return [b[0], b[1]];
  }
  // giống Dim của Sketch Route: bám tâm chân, đỉnh đường đồng, góc bo, thân đường đồng, mép bo; điểm thứ 2 trúng cạnh → đo vuông góc tới cạnh đó
  const measEdges = () => { const b = S.board; if (!b || S.noBoard) return []; const P = b.poly || [[0, 0], [b.w, 0], [b.w, b.h], [0, b.h]]; return P.map((q, i) => [q, P[(i + 1) % P.length]]); };
  const footOn = (a, e) => { const dx = e[1][0] - e[0][0], dy = e[1][1] - e[0][1], l2 = dx * dx + dy * dy || 1, t = ((a[0] - e[0][0]) * dx + (a[1] - e[0][1]) * dy) / l2; return [r3(e[0][0] + t * dx), r3(e[0][1] + t * dy)]; };
  function measSnap(p) {
    const k = cam ? cam.w / 120 : 1, tol = Math.max(.8, .9 * k);
    const pd = padAt(p); if (pd) return [pd.x, pd.y];
    let bv = null, bd = tol;
    for (const t of S.traces) for (const q of t.pts) { const d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < bd) { bd = d; bv = q; } }
    for (const [q] of measEdges()) { const d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < bd) { bd = d; bv = q; } }
    if (bv) return [bv[0], bv[1]];
    const sg = segAt(p); if (sg) { const r = proj(sg.t, p).q; r.edge = [sg.t.pts[sg.k], sg.t.pts[sg.k + 1]]; return r; }
    let be = null, ed = tol;
    for (const e of measEdges()) { const dx = e[1][0] - e[0][0], dy = e[1][1] - e[0][1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - e[0][0]) * dx + (p.y - e[0][1]) * dy) / l2)); const q = [e[0][0] + t * dx, e[0][1] + t * dy], d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < ed) { ed = d; be = [r3(q[0]), r3(q[1])]; be.edge = e; } }
    if (be) return be;
    return [snap(p.x, Q), snap(p.y, Q)];
  }
  function measPick(p, ev) {
    const raw = measSnap(p);
    if (!ui.meas || ui.meas.fixed) {
      ui.meas = { a: raw, b: raw };
    } else {
      const q = raw.edge ? footOn(ui.meas.a, raw.edge) : ui.meas.a.edge ? (ui.meas.a = footOn(raw, ui.meas.a.edge), raw) : measAlign(ui.meas.a, raw, !!(ev && ev.shiftKey));
      ui.meas.b = q; ui.meas.fixed = true;
      if (!ui.measList) ui.measList = [];
      ui.measList.push({ a: ui.meas.a, b: q });
    }
    drawMeas();
  }
  function drawMeas(hover) {
    LY.tmp.innerHTML = "";
    const k = cam ? cam.w / 120 : 1;   // cỡ chữ / nét theo mức phóng
    if (hover) el("circle", { cx: hover[0], cy: hover[1], r: .55 * k, class: "measpt" }, LY.tmp);
    const list = [...(ui.measList || [])];
    if (ui.meas && !ui.meas.fixed) list.push(ui.meas);
    for (const m of list) {
      const [a, b] = [m.a, m.b], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
      el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "stroke-width": .25 * k, class: "measln" }, LY.tmp);
      for (const e of [a, b]) el("circle", { cx: e[0], cy: e[1], r: .45 * k, class: "measpt" }, LY.tmp);
      if (d > .01) {
        const tx = (a[0] + b[0]) / 2 + 1.2 * k, t = el("text", { x: tx, y: (a[1] + b[1]) / 2 - 1.2 * k, "font-size": 2.2 * k, class: "meastx", transform: S.flip ? `translate(${2 * tx} 0) scale(-1 1)` : "" }, LY.tmp, fU(d));
        el("tspan", { x: tx, dy: 2.4 * k, "font-size": 1.6 * k }, t, `Δx ${nU(Math.abs(dx))} · Δy ${nU(Math.abs(dy))}`);
      }
    }
  }
  // tìm đoạn giữa 2 điểm neo / khúc gẫy / điểm giao nhau / chân gần nhất trên đường t quanh vị trí pr (dùng cho Auto Trim 1 chạm)
  function autoTrimSpan(t, pr) {
    const stops = [0]; let acc = 0;
    const addStop = s => { if (s >= -1e-4 && s <= total + 1e-4) stops.push(Math.max(0, Math.min(total, s))); };
    for (let k = 0; k < t.pts.length - 1; k++) { acc += Math.hypot(t.pts[k + 1][0] - t.pts[k][0], t.pts[k + 1][1] - t.pts[k][1]); stops.push(acc); }
    const total = acc; if (total < .1) return null;
    acc = 0;
    for (let k = 0; k < t.pts.length - 1; k++) {
      const a = t.pts[k], b = t.pts[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if (l > 1e-6) {
        const ux = dx / l, uy = dy / l;
        for (const u of S.traces) for (let m = 0; m < u.pts.length - 1; m++) {
          if (u === t && Math.abs(m - k) <= 1) continue;
          const c = u.pts[m], d = u.pts[m + 1], vx = d[0] - c[0], vy = d[1] - c[1], den = dx * vy - dy * vx;
          if (Math.abs(den) > 1e-7) {
            const t1 = ((c[0] - a[0]) * vy - (c[1] - a[1]) * vx) / den, t2 = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den;
            if (t1 >= -.02 && t1 <= 1.02 && t2 >= -.02 && t2 <= 1.02) addStop(acc + Math.max(0, Math.min(1, t1)) * l);
          }
          for (const e of [c, d]) if (segDist(e[0], e[1], a[0], a[1], b[0], b[1]) < traceW(t) / 2 + .12) {
            const projS = (e[0] - a[0]) * ux + (e[1] - a[1]) * uy;
            if (projS >= -.05 && projS <= l + .05) addStop(acc + Math.max(0, Math.min(l, projS)));
          }
        }
        for (const pd of A.P) if (segDist(pd.x, pd.y, a[0], a[1], b[0], b[1]) < (pd.r || PAD_R) + .12) {
          const projS = (pd.x - a[0]) * ux + (pd.y - a[1]) * uy;
          if (projS >= -.05 && projS <= l + .05) addStop(acc + Math.max(0, Math.min(l, projS)));
        }
      }
      acc += l;
    }
    stops.sort((x, y) => x - y);
    const uniq = [stops[0]];
    for (let i = 1; i < stops.length; i++) if (stops[i] - uniq[uniq.length - 1] > .18) uniq.push(stops[i]);
    if (uniq[uniq.length - 1] < total - .05) uniq.push(total); else uniq[uniq.length - 1] = total;
    let s0 = 0, s1 = total;
    for (let i = 0; i < uniq.length - 1; i++) if (pr.s >= uniq[i] - 1e-4 && pr.s <= uniq[i + 1] + 1e-4) { s0 = uniq[i]; s1 = uniq[i + 1]; break; }
    return { s0, s1, total };
  }
  function trimPick(p) {
    const sg = segAt(p);
    if (!sg) {
      const jw = S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6);
      if (jw) { checkpoint(); S.jumpers = S.jumpers.filter(j => j !== jw); gcHoles(); ui.trim = null; render(); return toast(L("Đã xoá dây nhảy.", "Jumper removed.")); }
      return toast(L("Bấm lên đường đồng (hoặc dây nhảy để xoá).", "Click a copper trace (or a jumper to remove it)."));
    }
    const pr = proj(sg.t, p);
    if (S.autoTrim !== false) {
      const sp = autoTrimSpan(sg.t, pr); if (!sp) return;
      const t = sg.t, { s0, s1, total } = sp; ui.trim = null;
      checkpoint();
      S.traces = S.traces.filter(x => x !== t);
      for (const pc of [cutPart(t, 0, s0), cutPart(t, s1, total)]) if (pc.length >= 2 && cutPart.len(pc) > .25) S.traces.push({ ...t, id: S.uid++, pts: simplify(pc), lock: true });
      gcHoles(); ui.sel = null; LY.tmp.innerHTML = ""; render(); drawTrim(p);
      return;
    }
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
    if (S.autoTrim !== false && sg && pr) {
      const sp = autoTrimSpan(sg.t, pr);
      if (sp) { const pc = cutPart(sg.t, sp.s0, sp.s1); if (pc.length >= 2) el("path", { d: "M" + pc.map(q => q.join(" ")).join(" L"), "stroke-width": traceW(sg.t) + .3, class: "trimcut" }, LY.tmp); }
      return;
    }
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
  function inBoard(p) {
    const B = S.board;
    if (!B) return false;
    if (B.poly && B.poly.length) {
      let inside = false;
      for (const ring of B.poly) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
          if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
        }
      }
      return inside;
    }
    return p.x >= 0 && p.x <= B.w && p.y >= 0 && p.y <= B.h;
  }
  function openQuickAdd(e, p) {
    const old = $("#plQuickAdd"); if (old) old.remove();
    const st = $("#plStage"), sr = st.getBoundingClientRect();
    const cats = CATS();
    const items = [];
    for (const [, , ks] of cats.slice(1)) {
      for (const k of ks) {
        const ico = k === "motor" ? ICON_M : k === "R" ? ICON_R : k === "C" ? ICON_C : k.startsWith("pinHdr") ? ICON_H : FP[k] && FP[k].ecap ? ICON_E : FP[k] && FP[k].to220 ? ICON_Q : k === "to92" || (FP[k] && FP[k].to92) ? ICON_TO92 : FP[k] && FP[k].dip ? ICON_DIP : FP[k] && FP[k].term ? ICON_TERM : k === "smd_2512" ? smdIcon(k) : k === "button12" ? `<img src="${iconSrc("button")}" alt="" loading="lazy">` : `<img src="${iconSrc(k)}" alt="">`;
        items.push({ k, name: SHORT(k), q: (NAME[k] + " " + SHORT(k) + " " + k).toLowerCase().replace(/"/g, ""), ico });
      }
    }
    const d = document.createElement("div");
    d.id = "plQuickAdd";
    d.className = "pl-qa";
    const x = Math.max(8, Math.min(e.clientX - sr.left, sr.width - 256));
    const y = Math.max(8, Math.min(e.clientY - sr.top, sr.height - 290));
    d.style.left = x + "px";
    d.style.top = y + "px";
    d.innerHTML = `<input type="search" id="plQaInp" placeholder="${L("Tìm linh kiện để thêm…", "Search parts to add…")}" autocomplete="off">`
      + `<div class="qa-list">${items.map(it => `<button type="button" class="qa-item" data-qa="${it.k}" data-q="${attr(it.q)}"><span class="qa-ico">${it.ico}</span><span>${attr(it.name)}</span></button>`).join("")}</div>`;
    st.appendChild(d);
    const inp = d.querySelector("#plQaInp"), rows = [...d.querySelectorAll(".qa-item")];
    const pick = k => {
      d.remove();
      cmd.add(k, p);
    };
    rows.forEach(b => { b.onclick = () => pick(b.dataset.qa); });
    inp.oninput = () => {
      const v = inp.value.trim().toLowerCase();
      rows.forEach(b => { b.hidden = !(!v || b.dataset.q.includes(v)); });
    };
    inp.onkeydown = ev => {
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); d.remove(); }
      else if (ev.key === "Enter") {
        const first = rows.find(b => !b.hidden);
        if (first) { ev.preventDefault(); pick(first.dataset.qa); }
      }
    };
    const out = ev => { if (!d.contains(ev.target)) { d.remove(); removeEventListener("pointerdown", out, true); } };
    setTimeout(() => addEventListener("pointerdown", out, true), 0);
    inp.focus();
  }
  const hideCtx = () => $("#plCtx").classList.remove("on");
  function ratPinMeta(pinName) {
    const id = (S && S.mcu) || S3ID;
    const b = window.BOARDS && BOARDS.find(x => x.id === id);
    if (!b || !b.headers) return null;
    for (const h of b.headers) for (const p of (h.pins || [])) if (p.name === pinName) return p;
    return null;
  }
  function ratPinHint(src, dst) {
    const H = hostInfo(), f = FP[src.c.fp], sp = f && f.pads && f.pads[src.i];
    const rawRole = sp && sp.role && sp.role !== "n" && (!f.mine || sp.conf >= .5) ? sp.role : null;
    const isFreePart = !!(f && (f.pinHdr || src.c.fp === "R" || src.c.fp === "C" || /^ecap/.test(src.c.fp)));
    const role = rawRole || (isFreePart ? null : "s");
    const needsR = (src.c.fp === "hcsr04" && /^ECHO$/i.test(src.name) && !H.v5) || (src.c.fp === "led" && src.name === "A");
    const meta = isHost(dst.c) ? ratPinMeta(dst.name) : null;
    const nm = dst.name, cat = meta && meta.cat, fl = (meta && meta.flags) || [];
    const normPwr = n => (H.alias && Object.entries(H.alias).find(([, v]) => v === n)?.[0]) || n;
    const dp = normPwr(nm);
    const ok = msg => ({ lvl: "ok", color: "#22c55e", msg });
    const warn = msg => ({ lvl: "warn", color: "#f59e0b", msg });
    const red = msg => ({ lvl: "red", color: "#ef4444", msg });
    if (!isHost(dst.c) && dst.c.fp === "R") {
      if (needsR) return ok(L("Nối qua điện trở R (để chia áp / hạn dòng)", "Wire through resistor R (divider / current limit)"));
      if (role === "g" || role === "3" || role === "5") return ok(L("Chân điện trở R", "Resistor pin"));
    }
    if (cat === "nc" || cat === "ban" || cat === "ctl" || /^(NC|EN|RST|BOOT)$/i.test(nm)) {
      return red((meta && meta.warn) || L("Chân NC / điều khiển / cấm dùng", "NC / control / restricted pin"));
    }
    if (PWR.has(dp) || cat === "power" || cat === "gnd") {
      const exp = { g: "GND", 3: "3V3", 5: "5V" }[role];
      if (exp) return dp === exp ? ok(L("Chân nguồn khớp (" + exp + ")", "Matching power pin (" + exp + ")")) : red(L("Sai nguồn / ngược cực (cần " + exp + ")", "Power mismatch (need " + exp + ")"));
      if (role) return red(L("Chân nguồn — không nối thẳng tín hiệu", "Power pin — do not wire signal"));
      return ok(L("Chân nguồn (" + nm + ")", "Power pin (" + nm + ")"));
    }
    if (role === "g" || role === "3" || role === "5") {
      return red(L("Chân nguồn chỉ nối vào nguồn tương ứng", "Connect power pin to matching supply only"));
    }
    const sharedBus = (role === "d" || role === "c") && dst.net && H.bus && dst.net === H.bus[role];
    if (isHost(dst.c) && dst.net && dst.net !== src.net && !sharedBus) {
      return red(L("Đã bận cho mạng " + dst.net, "Already used by " + dst.net));
    }
    const isRiskyPin = cat === "strap" || fl.includes("strap") || cat === "usb" || fl.includes("usb") || fl.includes("uart") || /^(TX|RX)/.test(nm) || (meta && meta.warn) || H.risky.includes(nm);
    if (needsR) {
      if (isRiskyPin) return red((meta && meta.warn) || L("Chân cảnh báo datasheet — tránh dùng", "Datasheet warning pin — avoid"));
      return warn(src.c.fp === "led" ? L("GPIO sạch — nhưng LED nên qua R 220 Ω", "Clean GPIO — LED should go through 220 Ω R") : L("GPIO sạch — nhưng ECHO 5 V nên qua chia áp R 1k+2k", "Clean GPIO — ECHO 5 V needs 1k+2k R divider"));
    }
    if (cat === "strap" || fl.includes("strap")) return warn((meta && meta.warn) || L("Chân Strapping — kéo sai mức dễ lỗi boot", "Strapping pin — may affect boot"));
    if (cat === "usb" || fl.includes("usb")) return warn((meta && meta.warn) || L("Chân USB D-/D+ — dùng sẽ mất cổng USB", "USB D-/D+ pin — disables USB"));
    if (fl.includes("uart") || /^(TX|RX)/.test(nm)) return warn((meta && meta.warn) || L("UART0 — trùng cổng nạp / Serial", "UART0 — shared with flash/Serial"));
    if ((meta && meta.warn) || H.risky.includes(nm)) return warn((meta && meta.warn) || L("Chân có lưu ý theo datasheet", "Pin has datasheet warning"));
    if ((role === "d" || role === "c" || role === "k" || role === "m") && H.bus && H.bus[role]) {
      if (nm === H.bus[role]) return ok(L("Đúng chân bus mặc định (" + nm + ")", "Default bus pin (" + nm + ")"));
      return warn(L("Chân GPIO sạch (bus mặc định là " + H.bus[role] + ")", "Clean GPIO (default bus is " + H.bus[role] + ")"));
    }
    if (isHost(dst.c) && H.pref.includes(nm)) return ok(L("GPIO an toàn, chưa dùng", "Safe unused GPIO"));
    return ok(L("Khả dũ", "Available"));
  }
  function ratAt(p) {
    if (!S.rats || !A || !A.rats) return null;
    let best = null, bd0 = 1.6;
    for (const r of A.rats) {
      const d = segDist(p.x, p.y, r.a.x, r.a.y, r.b.x, r.b.y);
      if (d < bd0) { bd0 = d; best = r; }
    }
    return best;
  }
  function drawRatEdit(p) {
    LY.tmp.innerHTML = "";
    const pd0 = padAt(p), pd = (pd0 && !pd0.jw && !pd0.hole) ? pd0 : null;
    if (ui.rat && ui.rat.a) {
      const a = ui.rat.a, b = pd ? [pd.x, pd.y] : [p.x, p.y];
      const srcIsHost = isHost(a.c);
      for (const q of pads()) {
        if (q.jw || q.hole || q === a || q.c === a.c) continue;
        const needsR0 = (a.c.fp === "hcsr04" && /^ECHO$/i.test(a.name) && !hostInfo().v5) || (a.c.fp === "led" && a.name === "A");
        if (srcIsHost ? isHost(q.c) : (!isHost(q.c) && !(needsR0 && q.c.fp === "R"))) continue;
        const rh = srcIsHost ? ratPinHint(q, a) : ratPinHint(a, q);
        el("circle", { cx: q.x, cy: q.y, r: (q.r || PAD_R) + 0.42, fill: "none", stroke: rh.color, "stroke-width": 0.36, opacity: 0.9 }, LY.tmp);
      }
      el("circle", { cx: a.x, cy: a.y, r: (a.r || PAD_R) + 0.55, fill: "none", stroke: "#38bdf8", "stroke-width": 0.45 }, LY.tmp);
      el("line", { x1: a.x, y1: a.y, x2: b[0], y2: b[1], stroke: "#38bdf8", "stroke-width": 0.4, "stroke-dasharray": "1.6 1" }, LY.tmp);
      if (pd && pd !== a) {
        const rh = srcIsHost ? ratPinHint(pd, a) : ratPinHint(a, pd);
        el("circle", { cx: pd.x, cy: pd.y, r: (pd.r || PAD_R) + 0.65, fill: "none", stroke: rh.color, "stroke-width": 0.55 }, LY.tmp);
      }
      return;
    }
    if (pd) {
      el("circle", { cx: pd.x, cy: pd.y, r: (pd.r || PAD_R) + 0.55, fill: "none", stroke: "#38bdf8", "stroke-width": 0.45 }, LY.tmp);
    } else {
      const rt = ratAt(p);
      if (rt) el("line", { x1: rt.a.x, y1: rt.a.y, x2: rt.b.x, y2: rt.b.y, stroke: "#ef4444", "stroke-width": 0.55 }, LY.tmp);
    }
  }
  function ratDown(p) {
    const pd0 = padAt(p), pd = (pd0 && !pd0.jw && !pd0.hole) ? pd0 : null;
    const pinKey = x => { const f = FP[x.c.fp]; return (f && f.pads && f.pads[x.i] ? f.pads[x.i].name : x.name); };
    const setPinNet = (x, net) => {
      if (isHost(x.c)) return false;
      x.c.nets = x.c.nets || {};
      const k1 = x.name, k0 = pinKey(x);
      if (k0 !== k1 && x.c.nets[k0] !== undefined) delete x.c.nets[k0];
      if (net) x.c.nets[k1] = net; else delete x.c.nets[k1];
      return true;
    };
    if (ui.rat && ui.rat.a) {
      const a = ui.rat.a;
      if (!pd || (pd.c === a.c && pd.i === a.i)) { ui.rat = null; LY.tmp.innerHTML = ""; return; }
      if (a.net && pd.net && a.net === pd.net) { ui.rat = null; LY.tmp.innerHTML = ""; return toast(L("Hai chân này đã chung mạng " + a.net, "Both pins are already on net " + a.net)); }
      checkpoint();
      const hostNet = x => {
        if (!isHost(x.c)) return null;
        if (x.net) return x.net;
        const H = hostInfo();
        if (H.alias) for (const k in H.alias) if (H.alias[k] === x.name) return k;
        return x.name;
      };
      let net = hostNet(a) || (PWR.has(a.net) ? a.net : null) || hostNet(pd) || (PWR.has(pd.net) ? pd.net : null) || a.net || pd.net;
      if (!net) {
        const used = usedNets(); let k = 1; while (used.has("N" + k)) k++;
        net = "N" + k;
      }
      const okA = isHost(a.c) || setPinNet(a, net), okB = isHost(pd.c) || setPinNet(pd, net);
      if (a.net && a.net !== net && !isHost(a.c) && !PWR.has(a.net)) {
        for (const m of S.comps) if (m.nets) for (const k in m.nets) if (m.nets[k] === a.net) m.nets[k] = net;
      }
      if (pd.net && pd.net !== net && !isHost(pd.c) && !PWR.has(pd.net)) {
        for (const m of S.comps) if (m.nets) for (const k in m.nets) if (m.nets[k] === pd.net) m.nets[k] = net;
      }
      ui.rat = null; LY.tmp.innerHTML = ""; render(); panel();
      if (okA || okB) toast(L(`Đã nối dây bay: ${a.c.id}.${a.name} ↔ ${pd.c.id}.${pd.name} (${net})`, `Added ratsnest: ${a.c.id}.${a.name} ↔ ${pd.c.id}.${pd.name} (${net})`));
      return;
    }
    if (pd) { ui.rat = { a: pd }; drawRatEdit(p); return; }
    const rt = ratAt(p);
    if (rt) {
      const dA = Math.hypot(p.x - rt.a.x, p.y - rt.a.y), dB = Math.hypot(p.x - rt.b.x, p.y - rt.b.y);
      const victim = isHost(rt.a.c) ? (isHost(rt.b.c) ? null : rt.b) : isHost(rt.b.c) ? rt.a : (dB <= dA ? rt.b : rt.a);
      if (!victim) return toast(L("Không thể xoá dây nội bộ của board chủ.", "Cannot remove internal host board net."));
      checkpoint();
      setPinNet(victim, null);
      LY.tmp.innerHTML = ""; render(); panel();
      toast(L(`Đã gỡ dây bay khỏi ${victim.c.id}.${victim.name}`, `Removed ratsnest from ${victim.c.id}.${victim.name}`));
    }
  }
  function cancel() { ui.dim = null; if (ui.nb) { ui.nb = null; LY.tmp.innerHTML = ""; } ui.place = null; ui.saw = null; ui.trim = null; ui.meas = null; ui.measList = null; if (ui.tool === "cs" && (!ui.cs || !ui.cs.fixed)) { ui.cs = null; if (LY.cs) LY.cs.innerHTML = ""; } renderCsPop(); ui.mode = "idle"; ui.route = null; ui.jump = null; ui.hole = null; ui.jf = null; ui.weld1 = null; ui.rat = null; ui.drag = null; LY.tmp.innerHTML = ""; svg.classList.remove("routing"); $("#plHint").textContent = ""; if (typeof syncCtxBar === "function") syncCtxBar(); }

  let prevDown = { t: 0, x: 0, y: 0 };
  svg.addEventListener("pointerdown", e => {
    if (e.button === 2) return;
    if (ui.penOnly && e.pointerType === "touch") {
      if (activePointers.size <= 1) return startPan(e);
      return;
    }
    if (ui.newPinHdrId && (!e.target.closest("#plPinHdrPop"))) ui.newPinHdrId = null;
    if (ui.lblEdit) {   // chế độ sửa chữ (bấm đúp vào linh kiện): kéo chữ để dời, R xoay; bấm ra ngoài để thoát
      const rt = e.button === 0 && e.target && e.target.closest ? e.target.closest("[data-lbl]") : null, c = rt && rt.getAttribute("data-cid") === ui.lblEdit && S.comps.find(x => x.id === ui.lblEdit);
      if (c) { e.preventDefault(); return startLblDrag(e, c, rt.getAttribute("data-lbl")); }
      ui.lblEdit = null; ui.refSel = null; render();
    }
    if (e.button === 0 && ui.mode === "idle" && (!ui.tool || ui.tool === "sel" || (ui.tool === "cs" && !(ui.dim && ui.dim.a)))) { const dh = dimAt(toMM(e)); if (dh) { e.preventDefault(); return dimTextDown(e, dh); } }
    { const now = performance.now(), dbl = now - prevDown.t < 420 && Math.hypot(e.clientX - prevDown.x, e.clientY - prevDown.y) < 6; prevDown = { t: now, x: e.clientX, y: e.clientY };
      if (dbl && e.button === 0 && ui.mode === "idle" && (!ui.tool || ui.tool === "sel")) { prevDown.t = 0; e.preventDefault(); return onDbl(e); } }
    const p = toMM(e); let g = [r3(p.x), r3(p.y)];
    if (e.button === 1 || ui.space) return startPan(e);
    if (ui.mode === "newb") { e.preventDefault(); return nbDown(p); }
    { const ah = e.target && e.target.closest ? e.target.closest("[data-ah]") : null; if (ah) return startArtHandle(e, ah.dataset.ah); }
    closePanels(e);   // khung nét báo của hình đang chọn: dời / xoay / co giãn
    if (ui.hlLayer && !hlPin) hlSet(null);
    if (ui.mode === "idle") { const tl = { cu: "cu", pt: "cu", tr: "cu", tf: "cu", tc: "cu", ex: "cu", jw: "jw" }[ui.tool]; if (tl && blk(tl)) { const l = LYR(tl); return toast(L(`Layer "${l.name}" đang ${l.lock ? "khoá" : "ẩn"}: mở trong menu Layer để sửa.`, `Layer "${l.name}" is ${l.lock ? "locked" : "hidden"}: unlock it in the Layer menu to edit.`)); } }
    if (ui.mode === "route") {
      const s = ptSnap(p), pd = s.pd;
      if (pd && !pd.net) { const o = ui.route.net, n = claimPad(pd, o); if (n && n !== o) { ui.route.net = n; ui.hlNet = n; } }   // chân chưa gán mạng: nhận mạng của đường đang vẽ
      if (pd) { if (pd.net !== ui.route.net && !joinNet(pd.net)) return toast(L(`Chân ${pd.name} thuộc mạng ${pd.net || "trống"}, không nối được.`, `Pin ${pd.name} is on net ${pd.net || "none"}, can't connect.`)); return finishRoute([pd.x, pd.y], true); }
      if (s.hit === "close") return finishRoute(s.q, true);
      if ((s.hit === "vtx" || s.hit === "seg" || s.hit === "jseg") && (s.net === ui.route.net || joinNet(s.net))) return finishRoute(s.q, true);
      ui.free = FREEM() ? !isShift(e) : isShift(e); const last = ui.route.pts[ui.route.pts.length - 1], q = aim(last, s.q); if (q[0] !== last[0] || q[1] !== last[1]) { ui.route.pts.push(q); ui.route.dir = null; } drawRoute(); return;
    }
    if (ui.mode === "place") return pickPlace(p, e);
    if (ui.mode === "jump") return pickJump(p);
    if (ui.mode === "hole") return pickHole(p, e);
    if (ui.mode === "jfree") return pickJfree(p, g, e);
    if (ui.tool === "pt") return void pointToggle(p);
    if (ui.tool === "tf" || ui.tool === "tc") return pickWeld(p, ui.tool === "tf" ? "fill" : "chamfer");
    if (ui.tool === "tr") return trimPick(p);
    if (ui.tool === "ex") return pickExtend(p);
    if (ui.tool === "saw") return sawDown(e, p);
    if (ui.tool === "dr") return drawDown(e, p);
    if (ui.tool === "ms") return measPick(p, e);
    if (ui.tool === "cs") {
      if (e.button === 2) {
        e.preventDefault(); e.stopPropagation();
        if (ui.dim && ui.dim.a) { ui.dim = null; if (LY.tmp) LY.tmp.innerHTML = ""; render(); return; }   // đang chọn dở: chuột phải huỷ lần chọn
        setTool("sel");
        render();
        return;
      }
      if (e.button === 0) return dimDown(p, e);
    }
    if (ui.tool === "jw") return pickHole(p, e);
    if (ui.tool === "rat") return ratDown(p);
    if (ui.tool === "cu") {
      const s = ptSnap(p), pd = s.pd;
      const sugg = pd && !pd.jw && !pd.hole ? suggestFor(pd) : [];
      if (pd) { if (!pd.net) { checkpoint(); claimPad(pd, null); }   // người dùng tự vẽ thì tự chịu trách nhiệm: chân chưa gán mạng vẫn vẽ được
      if (!pd.net) return toast(L(`Chân ${pd.name} không dùng trong mạch.`, `Pin ${pd.name} is not used in the circuit.`)); return startRoute(pd.net, [pd.x, pd.y], sugg); }
      if ((s.hit === "vtx" || s.hit === "seg" || s.hit === "jseg") && s.net) return startRoute(s.net, s.q);
      return startRoute("~" + S.uid++, s.q);
    }
    const vt = e.target.closest("[data-v]");
    if (vt && ui.sel && ui.sel.t === "t" && !blk("cu")) return startVertex(e, +vt.dataset.v);
    if ((e.ctrlKey || e.metaKey || (e.shiftKey && !segAt(p))) && (!ui.tool || ui.tool === "sel")) { const h = pickObj(p); if (h) { msToggle(h); render(); return; } return startMarquee(e, true); }   // Shift / Ctrl + bấm: thêm / bớt đối tượng; kéo trên nền: thêm vùng chọn
    const pd = padAt(p);
    if (pd && (pd.jw || pd.hole) && !blk("jw")) {
      ui.sel = pd.jw ? { t: "j", id: pd.jw.id, end: pd.i } : null;
      ui.hlNet = pd.net; render(); return startJHole(e, pd);
    }
    if (ui.cs && ui.cs.fixed) {
      const distB = Math.hypot(p.x - ui.cs.b[0], p.y - ui.cs.b[1]);
      const distA = Math.hypot(p.x - ui.cs.a[0], p.y - ui.cs.a[1]);
      const distSeg = segDist(p.x, p.y, ui.cs.a[0], ui.cs.a[1], ui.cs.b[0], ui.cs.b[1]);
      if (distA < 2.0 && distA <= distB) {
        ui.sel = { t: "cs" }; ui.hlNet = null; render(); panel();
        return startCsDrag(e, "a");
      }
      if (distB < 2.0 || distSeg < 1.4) {
        ui.sel = { t: "cs" }; ui.hlNet = null; render(); panel();
        return startCsDrag(e, distB < 2.0 ? "b" : "body");
      }
    }
    if (ui.sel && ui.sel.t === "m" && ui.ms) { const h = pickObj(p); if (h && inMs(h.k, h.id)) return startMsMove(e); }   // đang chọn nhiều: kéo 1 đối tượng trong nhóm = dời cả nhóm
    if (pd && S.comps.includes(pd.c) && !blk("base")) { ui.sel = { t: "c", id: pd.c.id }; ui.hlNet = pd.net; render(); return startComp(e, pd.c); }
    const jw = blk("jw") ? null : S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6);
    if (jw) { ui.sel = { t: "j", id: jw.id }; ui.hlNet = jw.net; render(); return startJBody(e, jw); }
    const sg = blk("cu") ? null : segAt(p);
    if (sg) { if (!e.shiftKey) { ui.sel = { t: "t", id: sg.t.id, k: sg.k }; ui.hlNet = null; render(); } return startSeg(e, sg); }
    const ai = artAt(p);   // chữ / hình vẽ: bấm để chọn (hiện khung dời · xoay · co giãn và thanh thuộc tính), kéo để dời
    if (ai) { drCfg().kind = "sel"; setTool("dr"); ui.sel = { t: "a", id: ai.id }; render(); drawFly(); $("#plFlyD").classList.add("on"); return startArtHandle(e, "mv", ai); }
    const c = blk("base") ? null : compAt(p);
    if (c) { ui.sel = { t: "c", id: c.id }; ui.hlNet = null; render(); return startComp(e, c); }
    if (ui.space) { ui.sel = null; ui.hlNet = null; render(); return startPan(e); }
    closeWidthMenu(); return startMarquee(e, false);   // kéo trên nền = khung chọn; bấm không kéo = bỏ chọn
  });
  svg.addEventListener("pointermove", e => {
    if (ui.penOnly && e.pointerType === "touch") {
      if (ui.drag) return dragMove(toMM(e), e);
      return;
    }
    { const sr = $("#plStage").getBoundingClientRect(); ui.mx = e.clientX - sr.left; ui.my = e.clientY - sr.top; drawRulers(); }
    const p = toMM(e);
    if (ui.mode === "newb") { nbMove(p); return; }
    if (ui.mode === "place") {
      ui.place.raw = [p.x, p.y];
      ui.place.cur = placeCur(p, e.shiftKey);
      drawPlaceGhost();
      return;
    }
    if (ui.mode === "route") { ui.free = FREEM() ? !isShift(e) : isShift(e); const s = ptSnap(p); ui.route.cur = s.q; drawRoute(); return; }
    if (ui.mode === "jump") return drawJump(p);
    if (ui.mode === "jfree") { const sj = jSnap(p, ui.jf.a, isShift(e)); ui.jf.cur = (!sj.pd && !sj.hit) ? jFix(ui.jf.a, sj.q) : sj.q; return drawJfree(); }
    if (ui.tool === "tf" || ui.tool === "tc") { drawWeldPreview(p, ui.tool === "tf" ? "fill" : "chamfer"); return; }
    if (ui.tool === "saw") drawSaw(p, e);
    if (ui.tool === "tr") drawTrim(p);
    if (ui.tool === "ms") {
      const raw = measSnap(p);
      if (ui.meas && !ui.meas.fixed) {
        ui.meas.b = raw.edge ? footOn(ui.meas.a, raw.edge) : measAlign(ui.meas.a, raw, e.shiftKey);
      }
      drawMeas(raw);
    }
    if (ui.tool === "cs") dimPreview(p);
    else if ((ui.tool === "jw" || ui.mode === "hole") && ui.mode !== "jfree") {
      LY.tmp.innerHTML = ""; const s = jSnap(p, null, isShift(e));
      jGhost(s.q[0], s.q[1]); drawGuides();
    }
    else if (ui.tool === "rat" && ui.mode === "idle") drawRatEdit(p);
    else if (ui.tool === "cu" && ui.mode === "idle") {
      LY.tmp.innerHTML = ""; const s = ptSnap(p);
      el("circle", { cx: s.q[0], cy: s.q[1], r: .45, class: "pen-nib" }, LY.tmp); drawGuides();
    }
    if (ui.drag) return dragMove(p, e);
    const pd = padAt(p), tip = $("#plTip");
    if (pd) { tip.innerHTML = `<b>${pd.jw ? "J" + jNo(pd.jw) + (pd.i ? "b" : "a") : pd.c.id + " · " + pd.name}</b><br>${pd.net ? L("Mạng ", "Net ") + pd.net : L("<i>không dùng</i>", "<i>unused</i>")}${pd.jw || pd.hole ? L("<br><i>Kéo để dời lỗ khoan</i>", "<br><i>Drag to move hole</i>") : ""}${(ui.tool === "rat" && ui.rat && ui.rat.a && pd !== ui.rat.a && !pd.jw && !pd.hole) ? (() => { const rh = isHost(ui.rat.a.c) ? ratPinHint(pd, ui.rat.a) : ratPinHint(ui.rat.a, pd); return `<br><span style="color:${rh.color}">● ${attr(rh.msg)}</span>`; })() : ""}`; tip.classList.add("on"); const r = $("#plStage").getBoundingClientRect(); tip.style.left = e.clientX - r.left + 14 + "px"; tip.style.top = e.clientY - r.top + 14 + "px"; }
    else tip.classList.remove("on");
    svg.style.cursor = (ui.cs && ui.cs.fixed && (Math.hypot(p.x - ui.cs.b[0], p.y - ui.cs.b[1]) < 1.5 || segDist(p.x, p.y, ui.cs.a[0], ui.cs.a[1], ui.cs.b[0], ui.cs.b[1]) < 1.2)) ? "ew-resize" : ui.tool !== "sel" ? "" : pd && (pd.jw || pd.hole) ? "move" : pd ? "crosshair" : segAt(p) ? "move" : compAt(p) ? "grab" : "";
    const net = pd ? pd.net : null; if (net !== ui.hoverNet && !ui.sel) { ui.hoverNet = net; ui.hlNet = net; render(); }
  });
  addEventListener("keydown", e => { if (e.code === "Space" && !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName) && $("#pcblab") && $("#pcblab").offsetParent) { ui.space = true; e.preventDefault(); } });
  addEventListener("keydown", e => { if (e.key === "Shift" && ui.mode === "place" && ui.place && ui.place.raw) { ui.place.cur = placeCur({ x: ui.place.raw[0], y: ui.place.raw[1] }, true); drawPlaceGhost(); } });
  addEventListener("keydown", e => { if (ui.mode === "newb" && e.key === "Enter" && !/^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || "")) { e.preventDefault(); nbFinish(); } });
  addEventListener("keyup", e => { if (e.code === "Space") ui.space = false; if (e.key === "Shift" && ui.mode === "place" && ui.place && ui.place.raw) { ui.place.cur = placeCur({ x: ui.place.raw[0], y: ui.place.raw[1] }, false); drawPlaceGhost(); } });
  addEventListener("pointerdown", e => {   // bấm chỗ trống ngoài khung vẽ khi đang dùng Pen: lần 1 bỏ kiểu vẽ, lần 2 thoát Pen
    if (ui.tool !== "dr") return; const t = e.target; if (!t || !t.closest || !ROOT.contains(t) || t.closest("#plStage, button, input, select, textarea, label, a, .pl-fly, .pl-pop, .pl-beta")) return;
    const D = drCfg(); if (!MODES.includes(D.kind)) { D.kind = "sel"; save(); drawFly(); $("#plFlyD").classList.add("on"); } else setTool("sel");
  }, true);
  addEventListener("pointerup", e => { if (ui.nb && ui.nb.drag) nbUp(); if (ui.drag) { const d = ui.drag; ui.drag = null; d.up && d.up(); } });
  svg.addEventListener("pointerleave", () => $("#plTip").classList.remove("on"));
  
  // ===== PINCH-TO-ZOOM & MULTI-TOUCH PAN CHO MOBILE =====
  const activePointers = new Map();
  let pinchDist0 = 0, pinchCenter0 = { x: 0, y: 0 }, pinchCam0 = null;
  // Chống chạm nhầm: khi bút đang chạm (hoặc vừa nhấc < 0,5 s), mọi chạm ngón tay / lòng bàn tay trên bản vẽ bị bỏ qua hẳn.
  // Chạm nhanh 2 ngón = Hoàn tác, 3 ngón = Làm lại (kiểu app ghi chú). Chỉ tính chạm ngón tay, không nhích, nhấc hết trong 0,35 s.
  let penDown = false, penUpT = -1e9, tap = null;
  const palm = new Set();
  const isPalm = e => e.pointerType === "touch" && (penDown || performance.now() - penUpT < 500);
  ["pointermove", "pointerup", "pointercancel"].forEach(t => svg.addEventListener(t, e => {
    if (!palm.has(e.pointerId)) return;
    if (t !== "pointermove") palm.delete(e.pointerId);
    e.stopImmediatePropagation();
  }, { capture: true }));

  svg.addEventListener("pointerdown", e => {
    if (e.pointerType === "pen") { penDown = true; tap = null; }
    if (isPalm(e)) { palm.add(e.pointerId); e.stopImmediatePropagation(); return; }
    if (e.pointerType === "touch") {
      if (!activePointers.size) tap = { t: performance.now(), n: 0, moved: false, st: new Map(), S: JSON.stringify(S), u: undo.slice(), r: redo.slice(), cam: { ...cam } };
      if (tap) { tap.st.set(e.pointerId, [e.clientX, e.clientY]); tap.n = Math.max(tap.n, activePointers.size + 1); }
    } else tap = null;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2) {
      if (ui.drag) ui.drag = null;
      if (ui.mode === "route") cancel();
      const pts = [...activePointers.values()];
      pinchDist0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchCenter0 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      pinchCam0 = { ...cam };
    }
  }, { capture: true, passive: true });

  svg.addEventListener("pointermove", e => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tap && !tap.moved) { const a = tap.st.get(e.pointerId); if (a && Math.hypot(e.clientX - a[0], e.clientY - a[1]) > 12) tap.moved = true; }

    if (activePointers.size === 2 && pinchCam0 && pinchDist0 > 5) {
      const pts = [...activePointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

      const zoomRatio = pinchDist0 / Math.max(dist, 10);
      const f = Math.max(0.2, Math.min(zoomRatio, 5));

      const sr = $("#plStage").getBoundingClientRect();
      const p = {
        x: pinchCam0.x + ((center.x - sr.left) / sr.width) * pinchCam0.w,
        y: pinchCam0.y + ((center.y - sr.top) / sr.height) * pinchCam0.h
      };

      const dx = (center.x - pinchCenter0.x) * (pinchCam0.w / sr.width);
      const dy = (center.y - pinchCenter0.y) * (pinchCam0.h / sr.height);

      cam.w = pinchCam0.w * f;
      cam.h = pinchCam0.h * f;
      cam.x = p.x - ((center.x - sr.left) / sr.width) * cam.w - dx;
      cam.y = p.y - ((center.y - sr.top) / sr.height) * cam.h - dy;

      applyCam();
    }
  }, { capture: true, passive: true });

  const onPointerEnd = e => {
    if (e.pointerType === "pen") { penDown = false; penUpT = performance.now(); }
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      pinchCam0 = null;
      pinchDist0 = 0;
    }
    if (!activePointers.size && tap) {
      const g = tap; tap = null;
      if (e.type === "pointerup" && !g.moved && (g.n === 2 || g.n === 3) && performance.now() - g.t < 350) multiTap(g);
    }
  };
  function multiTap(g) {
    // ngón đầu có thể đã kịp bắt đầu thao tác (chọn, kéo, chấm điểm): trả mọi thứ về đúng như trước khi chạm, rồi mới hoàn tác / làm lại
    ui.drag = null; cancel(); if (LY.tmp) LY.tmp.innerHTML = "";
    if (JSON.stringify(S) !== g.S || undo.length !== g.u.length) { S = JSON.parse(g.S); undo.length = 0; undo.push(...g.u); redo.length = 0; redo.push(...g.r); }
    Object.assign(cam, g.cam); applyCam();
    if (g.n === 2) { if (!undo.length) { render(); return toast(L("Không còn gì để hoàn tác.", "Nothing to undo.")); } cmd.undo(); toast(L("Hoàn tác (chạm 2 ngón)", "Undo (2-finger tap)")); }
    else { if (!redo.length) { render(); return toast(L("Không còn gì để làm lại.", "Nothing to redo.")); } cmd.redo(); toast(L("Làm lại (chạm 3 ngón)", "Redo (3-finger tap)")); }
  }
  // nghe trên cả cửa sổ: ngón / bút nhả ra ngoài bản vẽ vẫn được xoá khỏi danh sách (tránh con trỏ "ma" làm hỏng chụm zoom / chạm 2 ngón)
  addEventListener("pointerup", onPointerEnd, { capture: true, passive: true });
  addEventListener("pointercancel", onPointerEnd, { capture: true, passive: true });

  svg.addEventListener("wheel", e => { e.preventDefault(); const f = e.deltaY < 0 ? 1 / 1.15 : 1.15, p = toV(e); cam.x = p.x - (p.x - cam.x) * f; cam.y = p.y - (p.y - cam.y) * f; cam.w *= f; cam.h *= f; applyCam(); }, { passive: false });
  svg.addEventListener("contextmenu", e => {
    if (ui.mode === "newb") { e.preventDefault(); if (ui.nb && ui.nb.sh === "poly") nbFinish(); return; }
    e.preventDefault();
    const p = toMM(e);
    // Nếu đang ở công cụ Gióng (cs): nhấp phải 1 lần để thoát chế độ tạo gióng về Chọn (sel), giữ lại gióng để tinh chỉnh
    if (ui.tool === "cs") {
      e.stopPropagation();
      if (ui.cs && !ui.cs.fixed) {
        ui.cs = null;
        if (LY.cs) LY.cs.innerHTML = "";
        if (LY.tmp) LY.tmp.innerHTML = "";
      } else if (ui.cs && ui.cs.fixed) {
        ui.sel = { t: "cs" };
      }
      setTool("sel"); render(); panel(); return;
    }
    // Nếu nhấp phải lên đường gióng Construct Line (hoặc đang chọn cs): mở context menu canh gióng
    if (ui.cs && ui.cs.fixed) {
      const nearCs = (e.target && e.target.closest && e.target.closest(".csln, .cspt, .cstx, .cstick")) ||
                     (Math.hypot(p.x - ui.cs.b[0], p.y - ui.cs.b[1]) < 2.2) ||
                     (Math.hypot(p.x - ui.cs.a[0], p.y - ui.cs.a[1]) < 2.2) ||
                     (segDist(p.x, p.y, ui.cs.a[0], ui.cs.a[1], ui.cs.b[0], ui.cs.b[1]) < 1.8);
      if (nearCs) {
        e.stopPropagation();
        ui.sel = { t: "cs" }; render(); panel();
        return ctxMenu(e, [
          [L("⬌ Canh thẳng ngang (X)", "⬌ Align Horizontal (X)"), "H", () => cmd.setConstructLineAxis("x")],
          [L("⬍ Canh thẳng dọc (Y)", "⬍ Align Vertical (Y)"), "V", () => cmd.setConstructLineAxis("y")],
          [L("⤢ Gióng theo đường thẳng", "⤢ Align Direct"), "D", () => cmd.setConstructLineAxis("d")],
          [L("✎ Nhập khoảng cách chính xác", "✎ Set Distance"), L("Đúp", "Dbl"), () => promptConstructDistance()],
          [L("⇄ Đổi mốc (A ↔ B)", "⇄ Swap Anchor"), "S", () => cmd.swapConstructLine()],
          [L("🗑 Xoá đường gióng", "🗑 Delete"), "Del", () => cmd.deleteConstructLine()]
        ]);
      }
    }
    // Nếu đang vẽ dở đường gióng (chưa cố định) mà nhấp phải: hủy đường dở và về sel
    if (ui.tool === "cs" && ui.cs && !ui.cs.fixed) {
      ui.cs = null;
      if (LY.cs) LY.cs.innerHTML = "";
      if (LY.tmp) LY.tmp.innerHTML = "";
      setTool("sel"); render(); return;
    }
    // đang trong lệnh vẽ hoặc đang chọn công cụ bút / dây nhảy / gôm / fill / chamfer: nhấn chuột phải để thoát lệnh về Chọn
    if (ui.mode === "route") {
      const r = ui.route;
      if (r.pts.length >= 2) finishRoute(r.pts[r.pts.length - 1], true); else cancel();
      setTool("sel"); render(); return;
    }
    if (ui.tool === "saw" && ui.saw && ui.saw.pts.length >= 2) return sawFinish();
    if (ui.mode !== "idle" || (ui.tool && ui.tool !== "sel")) { cancel(); setTool("sel"); render(); return; }
    const vt = e.target.closest("[data-v]");
    if (vt && ui.sel && ui.sel.t === "t") return ctxMenu(e, [[L("Xoá điểm neo", "Delete vertex"), L("Đúp", "Dbl"), () => cmd.delVtx(+vt.dataset.v)]]);
    const jw = S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6);
    if (jw) {
      const end = Math.hypot(p.x - jw.a[0], p.y - jw.a[1]) < Math.hypot(p.x - jw.b[0], p.y - jw.b[1]) ? 0 : 1;
      ui.sel = { t: "j", id: jw.id, end }; ui.hlNet = jw.net; render();
      return ctxMenu(e, [[L("Nắn ngang", "Make horizontal"), "H", () => cmd.straight("h")], [L("Nắn dọc", "Make vertical"), "V", () => cmd.straight("v")], [L("Nắn 45°", "Make 45°"), "A", () => cmd.straight("a")],
        [L("Đổi thành đường đồng", "Convert to copper"), "", () => toCopper([jw])], [L("Đổi mọi dây nhảy của mạng này", "Convert all jumpers of this net"), "", () => toCopper(S.jumpers.filter(j => j.net === jw.net))], [L("Xoá dây nhảy", "Delete jumper"), "Del", cmd.del]]);
    }
    const pdC = padAt(p), cc = (pdC && S.comps.includes(pdC.c)) ? pdC.c : (blk("base") ? null : compAt(p));
    if (cc && !isHost(cc)) {
      ui.sel = { t: "c", id: cc.id }; render();
      return ctxMenu(e, [
        [L("📋 Nhân bản (Clone)", "📋 Clone part"), "Ctrl+C", () => cmd.cloneComp(cc)],
        [L("⟳ Xoay 90°", "⟳ Rotate 90°"), "R", () => cmd.rotate()],
        ...(!isHost(cc) ? [[L("✏ Đặt tên chân", "✏ Rename pins"), "", () => openPinNamesPop(cc, e)]] : []),
        ...(FP[cc.fp] && FP[cc.fp].mine ? [[L("✎ Sửa chân / kích thước", "✎ Edit pins / size"), "", () => editMine(cc.fp)]] : []),
        [L("Xoá dây nối LK", "Unwire part"), "", () => cmd.unwire()],
        [L("Xoá linh kiện", "Delete part"), "Del", () => cmd.del()],
        [L("💾 Lưu linh kiện", "💾 Save selected"), "", () => savePart(false)],
        [L("💾 Lưu linh kiện thành bản mới…", "💾 Save selected as…"), "", () => savePart(true)]
      ]);
    }
    const ai = artAt(p) || selArt();
    if (ai) {
      ui.sel = { t: "a", id: ai.id };
      if (ui.tool === "dr") { drawFly(); $("#plFlyD").classList.add("on"); }
      render();
      return ctxMenu(e, [
        [L("⇋ Lật mặt (Flip)", "⇋ Flip (Mirror)"), "F", () => { checkpoint(); artFlip(ai); render(); toast(L("Đã lật mặt đối tượng vẽ (hỗ trợ in nhiệt).", "Flipped paint object (for heat transfer).")); }],
        [L("⟳ Xoay 90°", "⟳ Rotate 90°"), "R", () => { checkpoint(); artRotate(ai, Math.PI / 2); render(); }],
        [L("Xoá hình vẽ", "Delete paint object"), "Del", () => cmd.del()]
      ]);
    }
    const sg = segAt(p);
    if (!sg) {
      if (inBoard(p)) {
        return ctxMenu(e, [
          [L("🔍 Tìm & thêm linh kiện…", "🔍 Search & add part…"), "", () => openQuickAdd(e, p)],
          [L("📌 Pin header", "📌 Pin header"), "", () => cmd.add("pinHdr_3", p)],
          [L("〰 Line (vẽ đồng)", "〰 Line (copper trace)"), "L", () => setTool("cu")],
          [STUDIO ? "⤼ Jumper pad" : L("⤼ Jumb (dây nhảy)", "⤼ Jumper"), "J", () => setTool("jw")],
          [L("🪚 Cưa (cắt bo)", "🪚 Saw (cut board)"), "W", () => setTool("saw")],
          [L("📐 Dim (đường gióng)", "📐 Dim line"), "D", () => setTool("cs")],
          [S.pour ? L("⬛ Tắt Mass (GND)", "⬛ Disable GND Pour") : L("⬛ Phủ Mass (GND)", "⬛ GND Pour"), "", () => cmd.pour()]
        ]);
      }
      return hideCtx();
    }
    ui.sel = { t: "t", id: sg.t.id, k: sg.k }; ui.hlNet = sg.t.net; render();
    ctxMenu(e, [[L("Hàn nối không vát góc (Fillet)", "Weld sharp corner (Fillet)"), "F", () => triggerWeldCmd("fill")], [L("Hàn nối vát góc 45° (Chamfer)", "Weld 45° bevel (Chamfer)"), "C", () => triggerWeldCmd("chamfer")],
      [L("Chọn cả chuỗi dây nối liền", "Select the whole connected trace"), L("Đúp", "Dbl"), () => { const ids = chainOf(sg.t); ui.sel = { t: "t", id: sg.t.id, ids }; render(); }], [L("Thêm điểm neo ở đây", "Add vertex here"), "", () => cmd.addVtx(p)], [L("Nắn ngang", "Make horizontal"), "H", () => cmd.straight("h")], [L("Nắn dọc", "Make vertical"), "V", () => cmd.straight("v")], [L("Nắn 45°", "Make 45°"), "A", () => cmd.straight("a")],
      [L("Dây nhảy", "Jumper"), "J", () => placeHole()], [L("Cắt bằng dây nhảy", "Cut with jumper"), "", cmd.jump], [sg.t.lock ? L("Bỏ khoá", "Unlock") : L("Khoá", "Lock"), "L", cmd.lock], [L("Xoá đoạn này", "Delete this segment"), "Del", cmd.del], [L("Chọn cả đường", "Select whole trace"), L("Đúp", "Dbl"), () => { ui.sel = { t: "t", id: sg.t.id }; ui.hlNet = sg.t.net; render(); }]]);
  });
  function ctxMenu(e, items) {
    const m = $("#plCtx"), r = $("#plStage").getBoundingClientRect();
    m.innerHTML = items.map((it, i) => `<button type="button" data-i="${i}">${it[0]} <kbd>${it[1]}</kbd></button>`).join("");
    m.classList.add("on");
    const mw = m.offsetWidth || 210, mh = m.offsetHeight || 220;
    const x = Math.max(6, Math.min(e.clientX - r.left, r.width - mw - 6));
    const y = Math.max(6, Math.min(e.clientY - r.top, r.height - mh - 6));
    m.style.left = x + "px"; m.style.top = y + "px";
    m.querySelectorAll("button").forEach(b => b.onclick = () => { hideCtx(); items[+b.dataset.i][2](); });
  }
  // đúp chuột: lên đoạn dây → thêm điểm neo; lên điểm neo → xoá
  // các đường cùng mạng chạm nhau (đầu chạm đầu / đầu chạm giữa / qua lỗ dây nhảy), không đi xuyên qua chân linh kiện
  function chainOf(t0) {
    const P = pads().filter(p => S.comps.includes(p.c)), atPad = q => P.some(p => Math.hypot(p.x - q[0], p.y - q[1]) < .1);
    const touch = (a, b) => [a.pts[0], a.pts[a.pts.length - 1]].some(e => !atPad(e) && b.pts.some((q, k) => k && segDist(e[0], e[1], b.pts[k - 1][0], b.pts[k - 1][1], q[0], q[1]) < .05));
    const hole = (a, b) => S.jumpers.some(j => j.net === a.net && [j.a, j.b].some(e => [a.pts[0], a.pts[a.pts.length - 1]].some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < .1)) && [j.a, j.b].some(e => [b.pts[0], b.pts[b.pts.length - 1]].some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < .1)));
    const out = [t0], seen = new Set([t0]);
    for (let i = 0; i < out.length; i++) for (const u of S.traces) if (!seen.has(u) && u.net === out[i].net && (touch(out[i], u) || touch(u, out[i]) || hole(out[i], u))) { seen.add(u); out.push(u); }
    return out.map(t => t.id);
  }
  let lastDbl = 0;
  function onDbl(e) {
    if (ui.mode !== "idle") return; lastDbl = performance.now();
    const p = toMM(e);
    // Nhấp đúp lên con số kích thước hoặc thân đường gióng Construct Line: nhập cự ly chính xác
    if (ui.cs && ui.cs.fixed) {
      const isCsHit = (e.target && e.target.closest && e.target.closest(".cstx, .csln, .cspt")) ||
                      (Math.hypot(p.x - ui.cs.b[0], p.y - ui.cs.b[1]) < 2.0) ||
                      (segDist(p.x, p.y, ui.cs.a[0], ui.cs.a[1], ui.cs.b[0], ui.cs.b[1]) < 1.6);
      if (isCsHit) {
        ui.sel = { t: "cs" }; render(); panel();
        return promptConstructDistance();
      }
    }
    const vt = e.target.closest("[data-v]");
    if (vt && ui.sel && ui.sel.t === "t") return cmd.delVtx(+vt.dataset.v);
    const pdHit = padAt(p), cmpHit = (pdHit && S.comps.includes(pdHit.c)) ? pdHit.c : compAt(p);
    if (cmpHit) { ui.lblEdit = cmpHit.id; ui.refSel = null; ui.sel = { t: "c", id: cmpHit.id }; render(); if (isHost(cmpHit)) return; }
    if (cmpHit && !isHost(cmpHit)) return openPinNamesPop(cmpHit, e, pdHit ? pdHit.i : 0);
    const sg = segAt(p); if (sg && !pdHit) { const ids = chainOf(sg.t); ui.sel = { t: "t", id: sg.t.id, ids }; ui.hlNet = sg.t.net; render(); if (ids.length > 1) return toast(L(`Đã chọn cả chuỗi ${ids.length} đoạn dây nối liền`, `Selected the whole chain of ${ids.length} joined traces`)); return; }
    if (!pdHit && Math.abs(bd(p.x, p.y)) <= 2.2) return openBoardPop(e);
  }
  function openBoardPop(e) {
    const old = document.getElementById("plBoardPop"); if (old) old.remove();
    const pop = document.createElement("div");
    pop.id = "plBoardPop";
    pop.className = "pl-fly";
    pop.style.cssText = "position:fixed;z-index:9999;min-width:210px;padding:10px 12px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:block";
    const hasCut = !!(S.board.poly || (S.board.holes && S.board.holes.length));
    pop.innerHTML = `<div style="font-size:12px;font-weight:700;margin-bottom:8px;letter-spacing:.3px">${L("Form PCB", "PCB Outline")}</div>` +
      `<div style="display:flex;flex-direction:column;gap:6px">` +
        `<button type="button" id="plBpSaw" style="text-align:left;padding:6px 10px;font-size:12px;border-radius:5px;cursor:pointer">🪚 ${L("Vào mục Cưa (Sửa form PCB)", "Open Saw (Edit PCB shape)")}</button>` +
        `<button type="button" id="plBpReset" style="text-align:left;padding:6px 10px;font-size:12px;border-radius:5px;cursor:pointer">↺ ${L("Reset PCB (Bỏ các lỗ / vết cắt)", "Reset PCB (Clear cuts & holes)")}${hasCut ? "" : " ✓"}</button>` +
      `</div>`;
    document.body.appendChild(pop);
    const px = Math.min(window.innerWidth - 235, Math.max(8, (e && e.clientX ? e.clientX : 200) + 10));
    const py = Math.min(window.innerHeight - 130, Math.max(8, (e && e.clientY ? e.clientY : 160) - 20));
    pop.style.left = px + "px"; pop.style.top = py + "px";
    const close = () => { document.removeEventListener("mousedown", onOut, true); pop.remove(); };
    const onOut = ev => { if (!pop.contains(ev.target)) close(); };
    setTimeout(() => document.addEventListener("mousedown", onOut, true), 0);
    pop.querySelector("#plBpSaw").onclick = () => { close(); setTool("saw", true); };
    pop.querySelector("#plBpReset").onclick = () => {
      close();
      if (!S.board.poly && !(S.board.holes && S.board.holes.length)) {
        return toast(L("Form PCB đã ở dạng chữ nhật mặc định.", "PCB is already a default rectangle."));
      }
      checkpoint();
      delete S.board.poly;
      delete S.board.holes;
      render();
      panel();
      toast(L("Đã reset form PCB về chữ nhật ban đầu.", "PCB shape reset to default rectangle."));
    };
  }
  function openPinNamesPop(c, e, focusIdx = 0) {
    const f = FP[c.fp]; if (!f || !f.pads || !f.pads.length) return;
    const old = document.getElementById("plPinNamePop"); if (old) old.remove();
    const pop = document.createElement("div");
    pop.id = "plPinNamePop";
    pop.className = "pl-fly";
    pop.style.cssText = "position:fixed;z-index:9999;min-width:220px;max-width:280px;max-height:360px;overflow-y:auto;padding:10px 12px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:block";
    const rows = f.pads.map((p, i) => {
      const cur = (c.pinNames && c.pinNames[i]) || p.name;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">` +
        `<span style="width:28px;font-size:11px;opacity:.75;text-align:right;flex-shrink:0">${attr(p.name)}</span>` +
        `<input data-pni="${i}" value="${attr(cur)}" placeholder="${attr(p.name)}" style="flex:1;min-width:0;padding:3px 6px;font-size:12px;border-radius:4px;border:1px solid var(--bd, #444);background:var(--bg, #1c1f24);color:var(--fg, #eee)">` +
      `</div>`;
    }).join("");
    pop.innerHTML = `<div style="margin-bottom:6px"><b style="font-size:12.5px;letter-spacing:.2px">${attr(c.id)} — ${L("Đặt tên chân", "Rename pins")}</b></div><div style="display:flex;gap:6px;margin-bottom:8px">` +
      (FP[c.fp] && FP[c.fp].mine ? `<button type="button" id="plPnEdit" style="flex:1;white-space:nowrap;font-size:12px;padding:4px 8px;cursor:pointer" title="${L("Dời chân, đổi cỡ pad, lỗ, khung thân", "Move pins, pad size, drill, body")}">✎ ${L("Sửa chân", "Edit pins")}</button> ` : "") +
      `<button type="button" id="plPnReset" style="flex:1;white-space:nowrap;font-size:12px;padding:4px 8px;cursor:pointer">${L("Mặc định", "Reset")}</button>` +
    `</div>` + rows +
    `<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px">` +
      `<button type="button" id="plPnCancel" style="font-size:12px;padding:4px 10px;cursor:pointer">${L("Huỷ", "Cancel")}</button>` +
      `<button type="button" id="plPnOk" style="font-size:12px;padding:4px 12px;cursor:pointer;font-weight:600">${L("Lưu", "Save")}</button>` +
    `</div>`;
    document.body.appendChild(pop);
    const px = Math.min(window.innerWidth - 295, Math.max(8, (e && e.clientX ? e.clientX : 200) + 10));
    const py = Math.min(window.innerHeight - 375, Math.max(8, (e && e.clientY ? e.clientY : 160) - 20));
    pop.style.left = px + "px"; pop.style.top = py + "px";
    const close = () => { document.removeEventListener("mousedown", onOut, true); pop.remove(); };
    const onOut = ev => { if (!pop.contains(ev.target)) close(); };
    setTimeout(() => document.addEventListener("mousedown", onOut, true), 0);
    const save = () => {
      checkpoint();
      const next = []; let anyCustom = false;
      pop.querySelectorAll("input[data-pni]").forEach(inp => {
        const idx = +inp.dataset.pni, defNm = f.pads[idx].name;
        const oldNm = (c.pinNames && c.pinNames[idx]) || defNm;
        const val = inp.value.trim() || defNm;
        next[idx] = val;
        if (val !== defNm) anyCustom = true;
        if (val !== oldNm && c.nets && c.nets[oldNm] !== undefined && c.nets[val] === undefined) {
          c.nets[val] = c.nets[oldNm]; delete c.nets[oldNm];
        }
      });
      if (anyCustom) c.pinNames = next; else delete c.pinNames;
      close(); render(); panel();
    };
    pop.querySelector("#plPnOk").onclick = save;
    if (pop.querySelector("#plPnEdit")) pop.querySelector("#plPnEdit").onclick = () => { close(); editMine(c.fp); };
    pop.querySelector("#plPnCancel").onclick = close;
    pop.querySelector("#plPnReset").onclick = () => { pop.querySelectorAll("input[data-pni]").forEach(inp => { inp.value = f.pads[+inp.dataset.pni].name; }); };
    pop.addEventListener("keydown", ev => {
      if (ev.key === "Enter") { ev.preventDefault(); save(); }
      else if (ev.key === "Escape") { ev.preventDefault(); close(); }
    });
    const targetInp = pop.querySelector(`input[data-pni="${focusIdx}"]`) || pop.querySelector("input[data-pni]");
    if (targetInp) { targetInp.focus(); targetInp.select(); }
  }
  svg.addEventListener("dblclick", e => { if (performance.now() - lastDbl > 500) onDbl(e); });
  addEventListener("pointerdown", e => { if (!e.target.closest("#plCtx")) hideCtx(); }, true);

  // mọi thao tác kéo tay: nếu hình đổi và có Dim → giải lại ngay (vật bị Dim ràng buộc chỉ chạy theo bậc tự do còn lại, vật nối Dim đi theo)
  const geomSig = () => JSON.stringify([S.comps.map(c => [c.x, c.y]), S.traces.map(t => t.pts), (S.holes || []).map(h => [h.x, h.y])]);
  function dragMove(p, e) {
    const D = ui.drag, sig = S.dims && S.dims.length ? geomSig() : null;
    D.move(p, e);
    if (sig !== null && ui.drag === D && geomSig() !== sig) { dimSolve(D.hold); render(); }
  }
  function startPan(e) { const c0 = { ...cam }, x0 = e.clientX, y0 = e.clientY; ui.drag = { move: (p, ev) => { cam.x = c0.x - (ev.clientX - x0) * ui.k; cam.y = c0.y - (ev.clientY - y0) * ui.k; applyCam(); } }; }
  // kéo linh kiện: bám lưới 2,54 (hoặc tự do khi tắt Snap), Alt đảo snap, Shift khoá trục (ngang/dọc)
  // dời cả nhóm đang chọn: linh kiện, đường đồng, dây nhảy, hình vẽ; đầu đường ngoài nhóm dính chân linh kiện đi theo chân
  function startMsMove(e) {
    const p0 = toMM(e), snapS = JSON.stringify(S), M = ui.ms;
    const cs = S.comps.filter(c => M.c.includes(c.id)), ts = S.traces.filter(t => M.t.includes(t.id)), js = S.jumpers.filter(j => M.j.includes(j.id)), as = (S.art || []).filter(a => M.a.includes(a.id));
    const oc = cs.map(c => [c.x, c.y]), ot = ts.map(t => t.pts.map(q => q.slice())), oj = js.map(j => [j.a.slice(), j.b.slice()]), ends = [];
    const P = pads();
    for (const c of cs) { const P0 = P.filter(q => q.c === c); for (const t of S.traces) if (!ts.includes(t)) for (const k of [0, t.pts.length - 1]) if (P0.some(q => Math.hypot(q.x - t.pts[k][0], q.y - t.pts[k][1]) < .05)) ends.push({ t, k, q0: t.pts[k].slice() }); }
    let ad = [0, 0], moved = false;
    ui.drag = {
      hold: new Set(cs.map(c => "c" + c.id)),
      move: (p, ev) => {
        let dx = p.x - p0.x, dy = p.y - p0.y;
        if (ev && ev.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
        if ((S.snapG !== false) ^ !!(ev && ev.altKey)) { dx = snap(dx, snapStep()); dy = snap(dy, snapStep()); }
        dx = r3(dx); dy = r3(dy); if (dx === ad[0] && dy === ad[1]) return; moved = true;
        cs.forEach((c, i) => { const nx = r3(oc[i][0] + dx), ny = r3(oc[i][1] + dy); syncCsCompMove(c.id, nx - c.x, ny - c.y); c.x = nx; c.y = ny; });
        ts.forEach((t, i) => { t.pts = ot[i].map(q => [r3(q[0] + dx), r3(q[1] + dy)]); });
        js.forEach((j, i) => { j.a = [r3(oj[i][0][0] + dx), r3(oj[i][0][1] + dy)]; j.b = [r3(oj[i][1][0] + dx), r3(oj[i][1][1] + dy)]; });
        for (const a of as) artMove(a, dx - ad[0], dy - ad[1]);
        for (const en of ends) en.t.pts[en.k] = [r3(en.q0[0] + dx), r3(en.q0[1] + dy)];
        ad = [dx, dy]; render();
      },
      up: () => { if (moved) { pushRaw(snapS); if (cs.length) { dimSolve(new Set(cs.map(c => "c" + c.id))); afterParts(cs.map(c => c.id)); } save(); } render(); }
    };
  }
  // tên linh kiện dời được: c.rl = { x, y } theo hệ toạ độ linh kiện (xoay cùng linh kiện), r = góc chữ 0 / 90 (tuyệt đối, luôn đọc xuôi)
  // chữ của linh kiện dời / xoay được: c.rl = tên (R1 10k), c.bl = chữ trên thân (LM393, ESP32…). { x, y } theo hệ toạ độ linh kiện, r = góc chữ 0 / 90 (luôn đọc xuôi)
  const LK = k => k === "b" ? "bl" : "rl";
  function lblPos(c, k) { const o = c[LK(k)], [ox, oy] = rot(o.x, o.y, c.rot); return [r3(c.x + ox), r3(c.y + oy)]; }
  const lblHit = (c, k) => ({ "data-lbl": k, "data-cid": c.id, style: ui.lblEdit === c.id ? "pointer-events:all;cursor:move" : "pointer-events:none" });
  const lblCls = (c, k) => ui.lblEdit === c.id ? " lbled" + (ui.refSel && ui.refSel.id === c.id && ui.refSel.k === k ? " lblsel" : "") : "";
  function refSvg(c, fz) { const P = lblPos(c, "r"), a = c.rl.r || 0; return `<text x="${P[0]}" y="${P[1]}" font-size="${fz}" font-weight="700" font-family="sans-serif"${a ? ` transform="rotate(${a} ${P[0]} ${P[1]})"` : ""}>${c.lbl || c.id}${c.val ? " " + c.val : ""}</text>`; }
  function bodySvg(c, t, fz) { const P = lblPos(c, "b"), a = c.bl.r || 0; return `<text x="${P[0]}" y="${P[1]}" font-size="${fz}" font-family="sans-serif" text-anchor="middle" dominant-baseline="central"${a ? ` transform="rotate(${a} ${P[0]} ${P[1]})"` : ""}>${t}</text>`; }
  function lblInit(c, k) {
    const f = FP[c.fp], b = f.body;
    if (k === "b") { if (!c.bl) c.bl = { x: r3(b.x + b.w / 2), y: r3(b.y + b.h / 2), r: 0 }; return; }
    if (!c.rl) c.rl = { x: r3(f.hdr ? b.x + b.w + 1 : b.x + .6), y: r3(f.hdr ? b.y + b.h / 2 + .5 : b.y - .8), r: (c.rot || 0) % 180 ? 90 : 0 };
  }
  function startLblDrag(e, c, k) {
    const snapS = JSON.stringify(S), key = LK(k), had = !!c[key];
    ui.sel = { t: "c", id: c.id }; ui.hlNet = null; ui.refSel = { id: c.id, k }; lblInit(c, k); { const pp = document.getElementById("plPinNamePop"); if (pp) pp.remove(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }   // chữ đang chọn: phím R xoay chữ
    const p0 = toMM(e), l0 = { ...c[key] }; let moved = false;
    ui.drag = {
      move: (p, ev) => { let dx = p.x - p0.x, dy = p.y - p0.y; if (ev && ev.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; } const [lx, ly] = rot(dx, dy, (360 - (c.rot || 0)) % 360); c[key].x = r3(l0.x + lx); c[key].y = r3(l0.y + ly); moved = true; render(); },
      up: () => { if (moved) { pushRaw(snapS); save(); } else if (!had) delete c[key]; render(); }
    };
    render();
  }
  if (!document.getElementById("plLblCss")) { const st = document.createElement("style"); st.id = "plLblCss"; st.textContent = ".pcblab .lbled{fill:#38bdf8!important;opacity:1!important}.pcblab .lblsel{fill:#fde047!important}"; document.head.appendChild(st); }
  function lblRotate(c, k) { const snapS = JSON.stringify(S), key = LK(k); lblInit(c, k); c[key].r = c[key].r ? 0 : 90; pushRaw(snapS); save(); render(); }
  function startComp(e, c) {
    const p0 = toMM(e), x0 = c.x, y0 = c.y, snapS = JSON.stringify(S), P0 = pads().filter(q => q.c === c), ends = [];
    for (const t of S.traces) for (const k of [0, t.pts.length - 1]) { const q = P0.find(q => Math.hypot(q.x - t.pts[k][0], q.y - t.pts[k][1]) < .05); if (q) ends.push({ t, k, i: q.i }); }
    let moved = false;
    ui.drag = {
      hold: new Set(["c" + c.id]),
      move: (p, ev) => {
        let dx = p.x - p0.x, dy = p.y - p0.y;
        if (ev && ev.shiftKey) {
          if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
        }
        const snapActive = (S.snapG !== false) ^ !!(ev && ev.altKey);
        const nx = snapActive ? snap(x0 + dx, snapStep()) : r3(x0 + dx);
        const ny = snapActive ? snap(y0 + dy, snapStep()) : r3(y0 + dy);
        if (nx === c.x && ny === c.y) return; moved = true; syncCsCompMove(c.id, nx - c.x, ny - c.y); c.x = nx; c.y = ny;
        // đầu đường đi theo chân; đường tự động vẫn để chưa khoá để Tự đi dây xoá và đi lại được
        for (const en of ends) { const pd = FP[c.fp].pads[en.i], [rx, ry] = rot(pd.x, pd.y, c.rot); en.t.pts[en.k] = [r3(c.x + rx), r3(c.y + ry)]; }
        render();
      },
      up: () => { if (moved) { pushRaw(snapS); dimSolve(new Set(["c" + c.id])); afterParts([c.id]); } render(); }
    };
  }
  // nắm kéo lỗ khoan dây nhảy (Ja / Jb hoặc lỗ đơn): đầu đường đồng gắn vào lỗ tự đi theo, dùng jSnap (snap nhẹ vào điểm neo / đầu line / pad + 3 nấc góc)
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
        const o = pd.jw ? (pd.i === 0 ? pd.jw.b : pd.jw.a) : null;
        const [nx, ny] = jSnap(p, o, ev && ev.shiftKey, pd.jw).q;
        for (const je of jEnds) { je.j[je.k] = [nx, ny]; delete je.j.auto; }
        for (const h of hEnds) { h.x = nx; h.y = ny; syncCsHoleMove(h, nx, ny); }
        for (const en of ends) { const oldPts = en.t.pts.map(q => [...q]); en.t.pts[en.k] = [nx, ny]; en.t.lock = true; syncCsTracePts(en.t, oldPts); }
        moved = true; render(); LY.tmp.innerHTML = ""; drawGuides();
      },
      up: () => {
        ui.guides = null; LY.tmp.innerHTML = "";
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
        const free = !!(ev && ev.shiftKey), dx = r3(free ? p.x - p0.x : snap(p.x - p0.x, SN)), dy = r3(free ? p.y - p0.y : snap(p.y - p0.y, SN));
        if (!dx && !dy && !moved) return; moved = true;
        jw.a = [r3(a0[0] + dx), r3(a0[1] + dy)]; jw.b = [r3(b0[0] + dx), r3(b0[1] + dy)]; delete jw.auto;
        for (const en of endsA) { const oldPts = en.t.pts.map(q => [...q]); en.t.pts[en.k] = [...jw.a]; en.t.lock = true; syncCsTracePts(en.t, oldPts); }
        for (const en of endsB) { const oldPts = en.t.pts.map(q => [...q]); en.t.pts[en.k] = [...jw.b]; en.t.lock = true; syncCsTracePts(en.t, oldPts); }
        render();
      },
      up: () => { if (moved) { gcHoles(); pushRaw(snapS); render(); } }
    };
  }
  // kéo một đoạn: dịch song song theo pháp tuyến, trượt 2 đầu dọc theo cạnh kề để giữ nguyên góc 45° / vuông góc; giữ Shift = kéo mượt không snap
  function startSeg(e, sg) {
    const t = sg.t, snapS = JSON.stringify(S), shift0 = e.shiftKey; let k = sg.k;
    const pPrev = k > 0 ? [...t.pts[k - 1]] : null, pNext = k + 1 < t.pts.length - 1 ? [...t.pts[k + 2]] : null;
    if (!pPrev) { t.pts.unshift([...t.pts[0]]); k = 1; }
    if (!pNext) t.pts.push([...t.pts[t.pts.length - 1]]);
    const a0 = [...t.pts[k]], b0 = [...t.pts[k + 1]], dx = b0[0] - a0[0], dy = b0[1] - a0[1], l = Math.hypot(dx, dy) || 1;
    const tx = dx / l, ty = dy / l, nx = -dy / l, ny = dx / l, p0 = toMM(e);
    const isDiag = Math.abs(Math.abs(dx) - Math.abs(dy)) < .02 * l, step = isDiag ? Q * Math.SQRT1_2 : Q;
    const slide = (o, nb, sx, sy, tt) => {
      if (nb) {
        const ux = o[0] - nb[0], uy = o[1] - nb[1], ul = Math.hypot(ux, uy), un = ux * nx + uy * ny, ut = ux * tx + uy * ty;
        if (ul > 1e-3 && Math.abs(un) > .15 * ul) {
          const un1 = un + tt, ut1 = ut * (Math.abs(un1) / Math.abs(un));
          return [nb[0] + ut1 * tx + un1 * nx, nb[1] + ut1 * ty + un1 * ny];
        }
      }
      if (isDiag && Math.abs(nx) > .1 && Math.abs(ny) > .1) {
        const ux = tt / nx, uy = tt / ny;
        return ux * sx >= 0 ? [o[0] + ux, o[1]] : [o[0], o[1] + uy];
      }
      return [o[0] + tt * nx, o[1] + tt * ny];
    };
    let moved = false;
    ui.drag = {
      move: (p, ev) => {
        const raw = (p.x - p0.x) * nx + (p.y - p0.y) * ny, free = !!(ev && ev.shiftKey);
        let tt = free ? raw : snap(raw, step);
        if (Math.abs(tt) < 1e-4 && !moved) return;
        if (!moved) { moved = true; ui.sel = { t: "t", id: t.id, k }; ui.hlNet = null; }
        let na = slide(a0, pPrev, Math.sign(dx), Math.sign(dy), tt), nb = slide(b0, pNext, -Math.sign(dx), -Math.sign(dy), tt);
        const rem = (nb[0] - na[0]) * tx + (nb[1] - na[1]) * ty;
        if (rem < 0 && l > rem) { tt *= l / (l - rem); na = slide(a0, pPrev, Math.sign(dx), Math.sign(dy), tt); nb = slide(b0, pNext, -Math.sign(dx), -Math.sign(dy), tt); }
        const oldPts = t.pts.map(q => [...q]); t.pts[k] = [r3(na[0]), r3(na[1])]; t.pts[k + 1] = [r3(nb[0]), r3(nb[1])]; syncCsTracePts(t, oldPts); t.lock = true; render();
      },
      up: () => {
        if (moved) t.pts = simplify(t.pts.filter((q, i) => i === 0 || q[0] !== t.pts[i - 1][0] || q[1] !== t.pts[i - 1][1]));
        else { const o = JSON.parse(snapS).traces.find(x => x.id === t.id); if (o) t.pts = o.pts; }   // chỉ bấm chọn: trả đúng điểm gốc (không gộp mất điểm gập thẳng hàng vừa thêm bằng Point)
        if (moved) pushRaw(snapS); else if (shift0) msToggle({ t: "t", id: t.id });
        render();
      }
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
    // ưu tiên bám điểm neo / đầu mút của line & jumper, tâm chân, đường gióng ảo (< 0,48 mm), rồi mới xét giữ góc 45°/90° hoặc tự do
    /* chỉ ép góc 45° khi các đoạn kề điểm này đang là 0/45/90°; dây vẽ tay góc tuỳ ý thì kéo tự do (Alt = luôn tự do) */
    const on45 = (a, b) => !a || !b || (d => d < 1e-6 || Math.abs(((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) % 45 + 45) % 45) < .6 || Math.abs((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) % 45) > 44.4)(Math.hypot(b[0] - a[0], b[1] - a[1])), ang45 = on45(t.pts[i - 1], t.pts[i]) && on45(t.pts[i], t.pts[i + 1]);
    const vtxSnap = p => { const s = ptSnap(p, t, i); return s.hit && (!s.net || s.net === t.net || isFree(t.net) || isFree(s.net)) ? s.q : null; };
    const org = [...t.pts[i]];
    ui.drag = { move: (p, ev) => { /* Shift / Ctrl: bỏ bám điểm neo, vẫn giữ góc 45° của dây nối */ const lock = ev && ev.shiftKey, free = ev && (ev.ctrlKey || ev.metaKey), raw = ev && (ev.altKey || free); if (lock || raw || free) ui.guides = null; const q = lock ? (Math.abs(p.x - org[0]) >= Math.abs(p.y - org[1]) ? [r3(p.x), org[1]] : [org[0], r3(p.y)]) : raw ? [r3(p.x), r3(p.y)] : (!free && vtxSnap(p)) || (ang45 ? snap45(t.pts[i - 1], t.pts[i + 1], [p.x, p.y]) : [r3(p.x), r3(p.y)]); if (q[0] === t.pts[i][0] && q[1] === t.pts[i][1]) return; moved = true; const oldPts = t.pts.map(pt => [...pt]); t.pts[i] = q; syncCsTracePts(t, oldPts); t.lock = true; render(); LY.tmp.innerHTML = ""; drawGuides(); }, up: () => { ui.guides = null; LY.tmp.innerHTML = ""; if (moved) { t.pts = simplify(t.pts); pushRaw(snapS); } else ui.sel = Object.assign({}, ui.sel, { t: "t", id: t.id, v: i }); render(); } };
  }

  // Đồng bộ ngược 2 chiều: khi đối tượng di chuyển, đầu gióng gắn vào đối tượng tự chạy theo
  function syncCsCompMove(compId, dx, dy) {
    if (!ui.cs || !ui.cs.fixed || (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4)) return;
    for (const which of ["a", "b"]) {
      const tgt = which === "a" ? ui.cs.targetA : ui.cs.targetB;
      if (tgt && tgt.comp && tgt.comp.id === compId) {
        ui.cs[which] = [r3(ui.cs[which][0] + dx), r3(ui.cs[which][1] + dy)];
      }
    }
  }
  function syncCsHoleMove(hole, nx, ny) {
    if (!ui.cs || !ui.cs.fixed) return;
    for (const which of ["a", "b"]) {
      const tgt = which === "a" ? ui.cs.targetA : ui.cs.targetB;
      if (tgt && tgt.hole === hole) ui.cs[which] = [r3(nx), r3(ny)];
    }
  }
  function syncCsTracePts(t, oldPts) {
    if (!ui.cs || !ui.cs.fixed || !t || !oldPts) return;
    for (const which of ["a", "b"]) {
      const tgt = which === "a" ? ui.cs.targetA : ui.cs.targetB;
      if (!tgt || !tgt.trace || tgt.trace.id !== t.id) continue;
      const cur = ui.cs[which];
      if (tgt.type === "traceVtx") {
        let bestK = -1, minD = 0.25;
        for (let k = 0; k < oldPts.length; k++) {
          const d = Math.hypot(oldPts[k][0] - cur[0], oldPts[k][1] - cur[1]);
          if (d < minD) { minD = d; bestK = k; }
        }
        if (bestK >= 0 && t.pts[bestK]) {
          ui.cs[which] = [...t.pts[bestK]];
          tgt.k = bestK;
        }
      } else if (tgt.type === "trace") {
        let bestK = -1, bestU = 0, minD = 0.35;
        for (let k = 0; k < oldPts.length - 1; k++) {
          const a = oldPts[k], b = oldPts[k + 1];
          const d = segDist(cur[0], cur[1], a[0], a[1], b[0], b[1]);
          if (d < minD) {
            minD = d; bestK = k;
            const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
            bestU = Math.max(0, Math.min(1, ((cur[0] - a[0]) * dx + (cur[1] - a[1]) * dy) / l2));
          }
        }
        if (bestK >= 0 && t.pts[bestK + 1]) {
          const a = t.pts[bestK], b = t.pts[bestK + 1];
          ui.cs[which] = [r3(a[0] + bestU * (b[0] - a[0])), r3(a[1] + bestU * (b[1] - a[1]))];
          tgt.k = bestK;
        }
      }
    }
  }
  function syncCsTraceMove(traceId, dx, dy, kOnly) {
    if (!ui.cs || !ui.cs.fixed || (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4)) return;
    for (const which of ["a", "b"]) {
      const tgt = which === "a" ? ui.cs.targetA : ui.cs.targetB;
      if (tgt && tgt.trace && tgt.trace.id === traceId) {
        if (kOnly == null || tgt.type === "trace" || tgt.k === kOnly) {
          ui.cs[which] = [r3(ui.cs[which][0] + dx), r3(ui.cs[which][1] + dy)];
        }
      }
    }
  }
  function syncCsArtMove(artId, dx, dy) {
    if (!ui.cs || !ui.cs.fixed || (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4)) return;
    for (const which of ["a", "b"]) {
      const tgt = which === "a" ? ui.cs.targetA : ui.cs.targetB;
      if (tgt && tgt.art && tgt.art.id === artId) {
        ui.cs[which] = [r3(ui.cs[which][0] + dx), r3(ui.cs[which][1] + dy)];
      }
    }
  }

  // Động cơ dời đối tượng gắn vào đầu A hoặc B của đường gióng (linh kiện, line đồng, điểm neo vertex, hình vẽ paint, lỗ khoan)
  function moveCsEndpoint(cs, which, shiftX, shiftY) {
    if (Math.abs(shiftX) < 1e-4 && Math.abs(shiftY) < 1e-4) return false;
    const pt = which === "a" ? cs.a : cs.b;
    const tgt = which === "a" ? cs.targetA : cs.targetB;

    // 1. Nếu neo trúng linh kiện (pad hoặc cạnh thân)
    let compToMove = null;
    if (tgt && tgt.comp) {
      compToMove = S.comps.find(x => x.id === tgt.comp.id);
    }
    if (!compToMove && (!tgt || tgt.type === "free")) {
      const pd = padAt({ x: pt[0], y: pt[1] });
      if (pd && pd.c && S.comps.includes(pd.c)) compToMove = pd.c;
    }

    if (compToMove) {
      const oldX = compToMove.x, oldY = compToMove.y;
      compToMove.x = r3(compToMove.x + shiftX);
      compToMove.y = r3(compToMove.y + shiftY);

      const cPads = FP[compToMove.fp] ? FP[compToMove.fp].pads : [];
      for (const t of S.traces) {
        for (const k of [0, t.pts.length - 1]) {
          for (let i = 0; i < cPads.length; i++) {
            const pd = cPads[i];
            const [rx, ry] = rot(pd.x, pd.y, compToMove.rot || 0);
            const prevPadX = oldX + rx, prevPadY = oldY + ry;
            if (Math.hypot(t.pts[k][0] - prevPadX, t.pts[k][1] - prevPadY) < 0.15) {
              t.pts[k] = [r3(compToMove.x + rx), r3(compToMove.y + ry)];
              t.lock = true;
            }
          }
        }
      }
      for (const j of S.jumpers) {
        for (const k of ["a", "b"]) {
          for (let i = 0; i < cPads.length; i++) {
            const pd = cPads[i];
            const [rx, ry] = rot(pd.x, pd.y, compToMove.rot || 0);
            const prevPadX = oldX + rx, prevPadY = oldY + ry;
            if (Math.hypot(j[k][0] - prevPadX, j[k][1] - prevPadY) < 0.15) {
              j[k] = [r3(compToMove.x + rx), r3(compToMove.y + ry)];
            }
          }
        }
      }
      afterParts([compToMove.id]);
      return true;
    }

    // 2. Nếu neo trúng hình vẽ / Paint
    let artToMove = null;
    if (tgt && tgt.art) artToMove = (S.art || []).find(x => x.id === tgt.art.id);
    if (artToMove) {
      artMove(artToMove, shiftX, shiftY);
      return true;
    }

    // 3. Nếu neo trúng lỗ khoan (hole)
    const h = (tgt && tgt.hole) || (S.holes || []).find(hl => Math.hypot(hl.x - pt[0], hl.y - pt[1]) < 0.15);
    if (h) {
      const hx0 = h.x, hy0 = h.y;
      h.x = r3(h.x + shiftX); h.y = r3(h.y + shiftY);
      for (const t of S.traces) {
        for (const k of [0, t.pts.length - 1]) {
          if (Math.hypot(t.pts[k][0] - hx0, t.pts[k][1] - hy0) < 0.15) {
            t.pts[k] = [h.x, h.y]; t.lock = true;
          }
        }
      }
      return true;
    }

    // 4. Nếu neo trúng đỉnh trace (traceVtx) hoặc thân trace (trace)
    if (tgt && tgt.trace) {
      const tr = S.traces.find(t => t.id === tgt.trace.id);
      if (tr) {
        if (tgt.type === "traceVtx" && tgt.k != null && tr.pts[tgt.k]) {
          tr.pts[tgt.k] = [r3(tr.pts[tgt.k][0] + shiftX), r3(tr.pts[tgt.k][1] + shiftY)];
        } else {
          for (let k = 0; k < tr.pts.length; k++) {
            tr.pts[k] = [r3(tr.pts[k][0] + shiftX), r3(tr.pts[k][1] + shiftY)];
          }
        }
        tr.lock = true;
        return true;
      }
    }

    // 5. Fallback: đầu mút trace bất kỳ trùng điểm
    let anyTraceMoved = false;
    for (const t of S.traces) {
      for (const k of [0, t.pts.length - 1]) {
        if (Math.hypot(t.pts[k][0] - pt[0], t.pts[k][1] - pt[1]) < 0.2) {
          t.pts[k] = [r3(t.pts[k][0] + shiftX), r3(t.pts[k][1] + shiftY)];
          t.lock = true;
          anyTraceMoved = true;
        }
      }
    }
    return anyTraceMoved;
  }
  function moveCsTarget(cs, shiftX, shiftY) { return moveCsEndpoint(cs, "b", shiftX, shiftY); }

  // Kéo trực tiếp đầu A, đầu B hoặc thân đường gióng: đẩy/kéo đối tượng gắn kết theo thời gian thực
  function startCsDrag(e, handle) {
    const cs = ui.cs; if (!cs || !cs.fixed) return;
    const snapS = JSON.stringify(S), p0 = toMM(e);
    if (handle === "body") {
      const a0 = [...cs.a], b0 = [...cs.b];
      let moved = false;
      ui.drag = {
        move: (p, ev) => {
          let dx = p.x - p0.x, dy = p.y - p0.y;
          if (ev && ev.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
          const na = [r3(a0[0] + dx), r3(a0[1] + dy)], nb = [r3(b0[0] + dx), r3(b0[1] + dy)];
          const sx = r3(na[0] - cs.a[0]), sy = r3(na[1] - cs.a[1]);
          if (Math.abs(sx) < 1e-4 && Math.abs(sy) < 1e-4) return;
          moved = true;
          const sameComp = cs.targetA && cs.targetB && cs.targetA.comp && cs.targetB.comp && cs.targetA.comp.id === cs.targetB.comp.id;
          moveCsEndpoint(cs, "a", sx, sy);
          if (!sameComp) moveCsEndpoint(cs, "b", sx, sy);
          cs.a = na; cs.b = nb;
          drawCs(); renderCsPop(); render();
        },
        up: () => { if (moved) pushRaw(snapS); renderCsPop(); drawCs(); render(); panel(); }
      };
      return;
    }
    const which = handle === "a" ? "a" : "b";
    const other = which === "a" ? "b" : "a";
    const tgtKey = which === "a" ? "targetA" : "targetB";
    const pStart = [...cs[which]];
    let moved = false;
    ui.drag = {
      move: (p, ev) => {
        let dx = p.x - p0.x, dy = p.y - p0.y;
        if (ev && ev.shiftKey) {
          if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
        }
        let cur = [r3(pStart[0] + dx), r3(pStart[1] + dy)];
        const isFree = !cs[tgtKey] || cs[tgtKey].type === "free" || cs[tgtKey].type === "boardEdge";
        if (isFree && !(ev && ev.altKey)) {
          const sn = csSnap({ x: cur[0], y: cur[1] });
          cur = sn.pt;
          if (sn.target.type !== "free") cs[tgtKey] = sn.target;
        }
        if (cs.mode === "x") cur[1] = pStart[1];
        else if (cs.mode === "y") cur[0] = pStart[0];
        else cur = csAlign(cs[other], cur, !!(ev && ev.shiftKey), cs.mode);

        const shiftX = r3(cur[0] - cs[which][0]);
        const shiftY = r3(cur[1] - cs[which][1]);
        if (Math.abs(shiftX) < 1e-4 && Math.abs(shiftY) < 1e-4) return;
        moved = true;
        if (!isFree) moveCsEndpoint(cs, which, shiftX, shiftY);
        cs[which] = [cur[0], cur[1]];
        drawCs();
        renderCsPop();
        render();
      },
      up: () => {
        if (moved) pushRaw(snapS);
        renderCsPop();
        drawCs();
        render();
        panel();
      }
    };
  }

  async function promptConstructDistance() {
    if (!ui.cs || !ui.cs.fixed) return;
    const cs = ui.cs, a = cs.a, b = cs.b;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const mode = cs.mode || "d";
    const curVal = mode === "x" ? Math.abs(dx) : mode === "y" ? Math.abs(dy) : Math.hypot(dx, dy);
    const unitLabel = mode === "x" ? " (X)" : mode === "y" ? " (Y)" : "";
    const uu = UIN() ? "in" : "mm", val = await promptBox(L(`Nhập cự ly mới${unitLabel} (${uu}):`, `Enter new distance${unitLabel} (${uu}):`), nU(curVal), { title: L("Đặt cự ly", "Set distance") });
    if (val !== null && val.trim() !== "" && !isNaN(+val) && +val >= 0) {
      cmd.setConstructLineLength(cs, +val * (UIN() ? 25.4 : 1), mode);
    }
  }
  /* ---------- lệnh ---------- */
  const cmd = {
    setConstructLineAxis(mode) {
      if (!ui.cs || !ui.cs.fixed) return;
      checkpoint();
      ui.cs.mode = mode;
      const a = ui.cs.a, b = ui.cs.b;
      if (mode === "x") {
        const shiftY = a[1] - b[1];
        moveCsTarget(ui.cs, 0, shiftY);
        ui.cs.b = [b[0], a[1]];
      } else if (mode === "y") {
        const shiftX = a[0] - b[0];
        moveCsTarget(ui.cs, shiftX, 0);
        ui.cs.b = [a[0], b[1]];
      }
      drawCs(); render(); panel(); save();
      const modeName = mode === "x" ? L("Canh thẳng ngang (X)", "Align Horizontal (X)") : mode === "y" ? L("Canh thẳng dọc (Y)", "Align Vertical (Y)") : L("Gióng thẳng hướng", "Direct line");
      toast("📐 " + modeName);
    },
    swapConstructLine() {
      if (!ui.cs || !ui.cs.fixed) return;
      const tmpPt = ui.cs.a; ui.cs.a = ui.cs.b; ui.cs.b = tmpPt;
      const tmpT = ui.cs.targetA; ui.cs.targetA = ui.cs.targetB; ui.cs.targetB = tmpT;
      drawCs(); render(); panel();
      toast(L("⇄ Đã đổi mốc cố định sang đầu còn lại", "⇄ Swapped anchor to the other end"));
    },
    deleteConstructLine() {
      ui.cs = null;
      if (LY.cs) LY.cs.innerHTML = "";
      if (ui.sel && ui.sel.t === "cs") ui.sel = null;
      render(); panel();
      toast(L("🗑 Đã xoá đường gióng", "🗑 Deleted construct line"));
    },

    undo() { if (!undo.length) return; redo.push(JSON.stringify(S)); S = JSON.parse(undo.pop()); syncEdits(); ui.sel = null; render(); list(); },
    redo() { if (!redo.length) return; undo.push(JSON.stringify(S)); S = JSON.parse(redo.pop()); syncEdits(); ui.sel = null; render(); list(); },
    del() {
      const s = ui.sel; if (!s) return;
      if (s.t === "dim") { checkpoint(); S.dims = (S.dims || []).filter(d => d.id !== s.id); ui.sel = null; ui.dimBad = null; save(); render(); return; }
      if (s.t === "cs") return cmd.deleteConstructLine();
      if (s.t === "m" && ui.ms) { const m = ui.ms; checkpoint(); let nets = []; for (const id of m.c) nets = nets.concat(unwire(id)); S.comps = S.comps.filter(c => !m.c.includes(c.id)); S.traces = S.traces.filter(t => !m.t.includes(t.id)); S.jumpers = S.jumpers.filter(j => !m.j.includes(j.id)); S.art = (S.art || []).filter(a => !m.a.includes(a.id)); gcHoles(); prune(); const n = m.t.length + m.j.length + m.c.length + m.a.length; ui.sel = null; ui.ms = null; ui.hlNet = null; render(); toast(L(`Đã xoá ${n} đối tượng.`, `Deleted ${n} objects.`)); if (m.c.length) afterParts([], nets); return; }
      if (s.t === "a") { checkpoint(); S.art = (S.art || []).filter(x => x.id !== s.id); ui.sel = null; render(); return; }
      if (s.t === "j") { checkpoint(); S.jumpers = S.jumpers.filter(j => j.id !== s.id); gcHoles(); ui.sel = null; ui.hlNet = null; render(); }
      else if (s.t === "t") {   // chỉ xoá đoạn đang chọn (giữa 2 góc), phần còn lại giữ
        if (s.ids && s.ids.length > 1) { checkpoint(); S.traces = S.traces.filter(x => !s.ids.includes(x.id)); gcHoles(); ui.sel = null; ui.hlNet = null; render(); return toast(L(`Đã xoá chuỗi ${s.ids.length} đoạn dây.`, `Deleted a chain of ${s.ids.length} traces.`)); }
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
    applyWidths() { checkpoint(); syncW(); let n = 0; for (const t of S.traces) { delete t.w; n++; } render(); toast(L(`Đã áp ${W_SIG} mm (tín hiệu) và ${W_PWR} mm (nguồn) cho ${n} đường. Ctrl+Z để hoàn tác.`, `Applied ${W_SIG} mm (signal) and ${W_PWR} mm (power) to ${n} traces. Ctrl+Z to undo.`)); },
    autoRe() { S.autoRe = !S.autoRe; render(); toast(S.autoRe ? L("Bật: dời / thêm / xoá linh kiện là tự đi dây lại phần liên quan.", "On: moving / adding / removing parts re-routes the affected nets.") : L("Tắt tự đi lại: bấm Tự đi dây (A) khi cần.", "Auto re-route off: press Autoroute (A) when needed.")); },
    autoBoard() { S.autoB = !S.autoB; if (S.autoB) { checkpoint(); fitBoardTo(roomy()); fit(); } render(); toast(S.autoB ? L("Bật: khung bo tự co giãn theo linh kiện khi thêm / bớt / dời.", "On: the board resizes to the parts when adding / removing / moving.") : L("Tắt: khung bo giữ cố định.", "Off: the board size stays fixed.")); },
    // đổi mạng của 1 chân module: bỏ đường gắn vào chân đó; mạng cũ không còn ≥ 2 chân thì bỏ hết đường / dây nhảy của nó
    setNet(id, pin, v) {
      const c = S.comps.find(x => x.id === id); if (!c) return;
      if (v === "+") { const u = usedNets(); let k = 1; while (u.has("N" + k)) k++; v = "N" + k; }
      checkpoint(); c.nets = c.nets || {};
      const P0 = pads().filter(q => q.c === c && q.name === pin), on = e => P0.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .05), old = c.nets[pin];
      c.nets[pin] = v || null; if (c.auto && pin in c.auto) { delete c.auto[pin]; if (!Object.keys(c.auto).length) delete c.auto; }
      S.traces = S.traces.filter(t => !on(t.pts[0]) && !on(t.pts[t.pts.length - 1])); prune(); dropDangling(new Set([old].filter(Boolean))); render();
      afterParts([], [old, v].filter(Boolean));
      if (v && !PWR.has(v) && !isSig(v)) toast(L(`Chân ${pin} vào mạng riêng ${v}: chọn ${v} cho chân bên kia (điện trở, tụ…).`, `Pin ${pin} is on private net ${v}: pick ${v} for the other side (resistor, capacitor…).`));
    },
    add(fp, atPt) {
      TRK("part_add", fp);
      if (fp === "S3" && (!hostInfo().s3 || S.comps.some(c => c.fp === "S3"))) return toast(L("Bo chỉ dùng 1 board ESP32-S3.", "The PCB uses a single ESP32-S3 board."));
      if (PASSIVE_FPS.has(fp)) {
        startPlaceComp(fp);
        if (atPt && ui.mode === "place" && ui.place) { ui.place.cur = [S.snapG === false ? r3(atPt.x) : snap(atPt.x, G), S.snapG === false ? r3(atPt.y) : snap(atPt.y, G)]; drawPlaceGhost(); }
        return;
      }
      const pre = (FP[fp].mine ? "X" : PRE[fp] || "M"); let n = 1; while (S.comps.some(c => c.id === pre + n)) n++;
      const id = pre + n, f = FP[fp], b = f.body, B = S.board, vx = cam.x + cam.w / 2, cx = atPt ? atPt.x : (S.flip ? B.w - vx : vx), cy = atPt ? atPt.y : (cam.y + cam.h / 2);
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      checkpoint();
      const c = { id, fp, x: snap(clamp(cx - b.x - b.w / 2, 2 - b.x, B.w - 2 - b.x - b.w), G), y: snap(clamp(cy - b.y - b.h / 2, 2 - b.y, B.h - 2 - b.y - b.h), G), rot: 0 };
      if (fp !== "S3") c.nets = autoNets(fp); if (f.val) c.val = f.val;
      if (f.mine) { c.auto = {}; for (const pd of f.pads) if (c.nets[pd.name] && pd.conf >= .5) c.auto[pd.name] = { net: c.nets[pd.name], conf: pd.conf }; if (!Object.keys(c.auto).length) delete c.auto; }
      const e = S.autoB && extent();   // bo tự co giãn: đặt linh kiện mới vào chỗ trống bên phải, khung bo nới theo
      if (e) { c.x = snap(e.x1 + 4 - b.x, G); c.y = snap(Math.max(e.y0, BMARGIN) - b.y, G); }
      S.comps.push(c); const addedR = autoProtectComp(c); ui.sel = { t: "c", id }; render(); afterParts([id]);
      const sig = Object.entries(c.nets || {}).filter(([, v]) => isSig(v)).map(([k, v]) => `${k}→${v}`).join(", ");
      toast(L(`Đã thêm ${id}`, `Added ${id}`) + (sig ? ": " + sig : "") + ". " + (TIP[fp] || L("Đổi chân nối ở bảng bên phải.", "Change pin connections in the right panel.")));
      if (f.ecap || f.to220) { const n = $("#plName"); if (n) { n.focus(); n.select(); } }
    },
    cloneComp(c) {
      if (!c || isHost(c)) return toast(L("Không thể nhân bản board mạch chủ.", "Cannot clone host MCU board."));
      cancel();
      setTool("sel");
      ui.mode = "place";
      const vx = cam.x + cam.w / 2, cx0 = S.flip ? S.board.w - vx : vx, cy0 = cam.y + cam.h / 2;
      const cloneFrom = { id: c.id, x: c.x, y: c.y, rot: c.rot || 0, fp: c.fp };
      ui.place = { fp: c.fp, rot: c.rot || 0, cur: [snap(cx0, G), snap(cy0, G)], val: c.val, lbl: c.lbl, pinNames: c.pinNames ? [...c.pinNames] : undefined, cloneFrom };
      svg.classList.add("routing");
      $("#plHint").textContent = L("Bấm để đặt linh kiện nhân bản (giữ Shift khoá trục ngang/dọc, R xoay 90°, Esc huỷ)", "Click to place cloned part (hold Shift to lock horizontal/vertical, R rotates 90°, Esc cancels)");
      drawPlaceGhost();
    },
    rotate() {
      if (ui.sel && ui.sel.t === "a") { const it = selArt(); if (it) { checkpoint(); artRotate(it, Math.PI / 2); render(); } return; }
      const s = ui.sel; if (!s || s.t !== "c") return toast(L("Chọn một linh kiện để xoay.", "Select a part to rotate."));
      const c = S.comps.find(x => x.id === s.id); checkpoint(); c.rot = (c.rot + 90) % 360;   // đường cũ giữ nguyên, chỗ hở hiện thành dây bay / lỗi để sửa
      render(); afterParts([c.id]);
    },
    lock() { const s = ui.sel; if (s && s.t === "m" && ui.ms && ui.ms.t.length) { checkpoint(); const f = !S.traces.find(x => x.id === ui.ms.t[0]).lock; for (const x of S.traces) if (ui.ms.t.includes(x.id)) x.lock = f; render(); return toast(f ? L("Đã khoá các đường đã chọn.", "Locked the selected traces.") : L("Đã bỏ khoá.", "Unlocked.")); }
      if (!s || s.t !== "t") return toast(L("Chọn một đường đồng để khoá / bỏ khoá.", "Select a trace to lock / unlock.")); checkpoint(); const t = S.traces.find(x => x.id === s.id); t.lock = !t.lock; for (const x of S.traces) if ((s.ids || []).includes(x.id)) x.lock = t.lock; render(); toast(t.lock ? L("Đã khoá: Tự đi dây sẽ giữ nguyên đường này.", "Locked: Autoroute keeps this trace.") : L("Đã bỏ khoá.", "Unlocked.")); },
    width(w) { const s = ui.sel; if (!s || (s.t !== "t" && s.t !== "m")) return toast(L("Chọn một hoặc nhiều đường đồng (Shift / Ctrl + bấm, hoặc kéo khung) để đổi độ rộng.", "Select one or more traces (Shift / Ctrl + click, or drag a box) to change the width.")); const ids = s.t === "m" ? (ui.ms ? ui.ms.t : []) : [s.id, ...(s.ids || [])]; if (!ids.length) return toast(L("Trong vùng chọn chưa có đường đồng nào.", "No trace in the selection.")); checkpoint(); for (const t of S.traces) if (ids.includes(t.id)) { t.w = w; t.lock = true; } render(); },
    // thử cả 3 phương án, giữ bản ít đường hỏng nhất, rồi ít / ngắn dây nhảy nhất, rồi đồng ngắn nhất
    auto(re, only) {   // re === true: đi lại sau khi sửa linh kiện, đã có điểm hoàn tác của thao tác đó. only: chỉ thử 1 kiểu đi dây (giữ kiểu người dùng chọn)
      if (only == null) only = S.routeScheme != null && S.routeScheme >= 0 && S.routeScheme < SCHEMES.length ? S.routeScheme : 1;
      syncW(); if (re !== true) checkpoint(); S.routed = true; const t0 = performance.now(), base = JSON.stringify([S.traces, S.jumpers]), sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
      let best = null;
      // số dây bay còn lại thật sự (đã tính mass nối GND)
      const go = (si, prio, ga) => { [S.traces, S.jumpers] = JSON.parse(base); autoroute(si, prio, ga); return analyze().rats.length; };
      const score = fl => fl * 1000 + sum(S.jumpers, j => 5 + 3 * Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1])) + .05 * sum(S.traces, t => t.pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - t.pts[i - 1][0], p[1] - t.pts[i - 1][1]) : 0, 0));
      const tryRun = (si, prio, ga) => { const fl = go(si, prio, ga), sc = score(fl) + (si !== 1 ? 500 : 0),   /* ưu tiên kiểu 45°: chỉ đổi kiểu khác khi đi được nhiều đường hơn */ r = { score: sc, si, ga, fl, failed: autoroute.failed.slice(), st: JSON.stringify([S.traces, S.jumpers]) }; if (!best || sc < best.score) best = r; return r; };
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
      [S.traces, S.jumpers] = JSON.parse(best.st); S.scheme = best.si; if (re !== true && !S.flip) { S.flip = true; fit(); }   /* bấm Tự đi dây: chuyển sang mặt Back (mặt đồng) để xem kết quả */
      cmd.autoMsg(best.fl, t0); TRK("autoroute", (best.fl ? "con " + best.fl + " day" : "xong") + " · " + S.jumpers.length + " jumper · " + S.comps.length + " lk");
    },
    autoMsg(f, t0) { dedupe(); render(); const nj = S.jumpers.filter(j => j.auto).length, ne = 0; toast(L(`Tự đi dây (${SCHEMES[S.scheme].name}): ${f ? "còn " + f + " đường chưa đi được" : "xong hết"}${nj + ne ? " · " + (nj + ne) + " dây nhảy" : ""}`, `Autoroute (${SCHEMES[S.scheme].name}): ${f ? f + " connections left unrouted" : "all done"}${nj + ne ? " · " + (nj + ne) + " jumpers" : ""}`) + ` · ${Math.round(performance.now() - t0)} ms`); },
    scheme() { S.scheme = (S.scheme + 1) % SCHEMES.length; cmd.auto(false, S.scheme); },
    clear() { checkpoint(); S.routed = false; S.traces = []; S.jumpers = []; S.holes = []; ui.sel = null; render(); toast(L("Đã xoá mọi đường đồng và dây nhảy (Ctrl+Z để lấy lại).", "Removed all traces and jumpers (Ctrl+Z to undo).")); },
    reset(force) {   // force = true: bỏ qua hộp xác nhận (dùng trong mã / thử nghiệm)
      if (force !== true) { confirmBox(L(`Xoá hết linh kiện và đường đồng, chỉ để lại ${hostInfo().name}?`, `Remove all parts and traces, keeping only ${hostInfo().name}?`), { danger: true, title: L("Làm mới bo?", "Reset the board?"), ok: L("Xoá hết", "Delete all") }).then(ok => ok && cmd.reset(true)); return; }
      checkpoint(); S = fresh(S.mcu); ui.sel = null; render(); fit(); },
    rats() { S.rats = !S.rats; render(); },
    snapG() { S.snapG = S.snapG === false; ui.guides = null; LY.tmp.innerHTML = ""; render(); toast(S.snapG ? L("Đã bật Snap đỉnh & đường gióng ảo (F4).", "Vertex & smart guide snap ON (F4).") : L("Đã tắt Snap đỉnh & đường gióng ảo (F4).", "Vertex & smart guide snap OFF (F4).")); },
    // đổi số chân của hàng rào Pin Header
    setPinHdrProps(c, opts = {}) {
      if (!c || !c.fp || !c.fp.startsWith("pinHdr")) return;
      const f = FP[c.fp] || {}, oldCount = f.nPins || 3;
      const n = opts.nPins !== undefined ? Math.max(1, Math.min(40, parseInt(opts.nPins, 10) || 3)) : oldCount;
      const pitch = opts.pitch !== undefined ? Math.max(0.8, Math.min(25.4, Math.round((Number(opts.pitch) || G) * 100) / 100)) : (f.pitch || G);
      const padD = opts.padD !== undefined ? Math.max(0.8, Math.min(8.0, Math.round((Number(opts.padD) || 2 * PAD_R) * 100) / 100)) : (f.padD || 2 * PAD_R);
      const sq = opts.sq !== undefined ? opts.sq : (f.padSq !== undefined ? f.padSq : null);
      const noHole = opts.noHole !== undefined ? !!opts.noHole : !!f.noHole;
      const rot180 = opts.rot180 !== undefined ? !!opts.rot180 : (c.rot === 180);
      const rows = opts.rows !== undefined ? Math.max(1, Math.min(10, parseInt(opts.rows) || 1)) : (f.rows || 1);
      const gapIn = opts.rowGap !== undefined ? Math.max(.1, Math.min(6, Math.round((Number(opts.rowGap) || .7) * 10) / 10)) : (f.rowGapIn || .7);
      checkpoint();
      const oldPads = (f.pads || []).map((q, i) => (c.pinNames && c.pinNames[i]) || q.name), newTotal = n * rows;
      if (newTotal < oldPads.length) {
        const removedPins = new Set(oldPads.slice(newTotal));
        const P0 = pads().filter(q => q.c === c && removedPins.has(q.name));
        const on = e => P0.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .05);
        const dropNets = new Set(P0.map(q => q.net).filter(Boolean));
        S.traces = S.traces.filter(t => !on(t.pts[0]) && !on(t.pts[t.pts.length - 1]));
        if (c.nets) for (const pName of removedPins) delete c.nets[pName];
        if (c.pinNames && c.pinNames.length > newTotal) c.pinNames = c.pinNames.slice(0, newTotal);
        prune();
        dropDangling(dropNets);
      }
      c.fp = pinHdrKey(n, pitch, padD, sq, noHole, rows, gapIn);
      if (opts.rot180 !== undefined) c.rot = rot180 ? 180 : 90;
      render();
      panel();
      afterParts([c.id]);
    },
    setPinCount(c, newCount) { return cmd.setPinHdrProps(c, { nPins: newCount }); },
    // Điều chỉnh khoảng cách đường gióng: tịnh tiến linh kiện B / đầu dây B và các đường trace nối vào
    setConstructLineLength(cs, targetDist, mode) {
      if (!cs || !cs.fixed) return;
      const target = Math.max(0, Math.min(500, Math.round(targetDist * 100) / 100));
      const a = cs.a, b = cs.b;
      const dx0 = b[0] - a[0], dy0 = b[1] - a[1];
      const curD = Math.hypot(dx0, dy0);
      const curDist = mode === "x" ? Math.abs(dx0) : mode === "y" ? Math.abs(dy0) : curD;
      if (Math.abs(curDist - target) < 0.005) return;

      checkpoint();
      let newBx = b[0], newBy = b[1];
      if (mode === "x") {
        const sign = dx0 >= 0 ? 1 : -1;
        newBx = a[0] + sign * target;
      } else if (mode === "y") {
        const sign = dy0 >= 0 ? 1 : -1;
        newBy = a[1] + sign * target;
      } else {
        if (curD < 1e-4) {
          newBx = a[0] + target; newBy = a[1];
        } else {
          const ux = dx0 / curD, uy = dy0 / curD;
          newBx = a[0] + ux * target; newBy = a[1] + uy * target;
        }
      }
      const shiftX = r3(newBx - b[0]), shiftY = r3(newBy - b[1]);
      moveCsTarget(cs, shiftX, shiftY);
      cs.b = [r3(newBx), r3(newBy)];
      renderCsPop();
      drawCs();
      render();
      panel();
      save();
    },
    // điều chỉnh độ dài dây nhảy: giữ nguyên hướng / góc, ưu tiên đổi chiều dài cạnh line đồng nối vào thay vì đổi góc
    setJumperLength(jw, targetLen) {
      if (!jw) return;
      const target = Math.max(1, Math.min(150, Math.round(targetLen * 10) / 10));
      const dx0 = jw.b[0] - jw.a[0], dy0 = jw.b[1] - jw.a[1], curL = Math.hypot(dx0, dy0);
      if (curL < 1e-4) return;
      if (Math.abs(curL - target) < 0.05) return;

      const P0 = pads().filter(q => !q.jw && !q.hole);
      const onPad = e => P0.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < 0.1);
      const padA = onPad(jw.a), padB = onPad(jw.b);
      if (padA && padB) return toast(L("Dây nhảy nối cố định 2 chân linh kiện, không đổi độ dài được.", "Jumper connects two fixed component pads and cannot change length."));

      checkpoint();
      const mvA = padB && !padA ? true : padA && !padB ? false : (ui.sel && ui.sel.t === "j" && ui.sel.end === 0);
      const ux = dx0 / curL, uy = dy0 / curL;
      const oldPt = mvA ? [...jw.a] : [...jw.b];
      const fixedPt = mvA ? jw.b : jw.a;
      const newPt = mvA ? [r3(fixedPt[0] - target * ux), r3(fixedPt[1] - target * uy)] : [r3(fixedPt[0] + target * ux), r3(fixedPt[1] + target * uy)];

      const D_ANG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      const dirMatch = (dx, dy) => {
        const l = Math.hypot(dx, dy);
        if (l < 1e-4) return null;
        let best = null, bd = 0.05;
        for (const [cx, cy] of D_ANG) {
          const cl = Math.hypot(cx, cy);
          const d = Math.hypot(dx / l - cx / cl, dy / l - cy / cl);
          if (d < bd) { bd = d; best = [cx / cl, cy / cl]; }
        }
        return best;
      };

      const adjustTraceEnd = t => {
        const isStart = Math.hypot(t.pts[0][0] - oldPt[0], t.pts[0][1] - oldPt[1]) < 0.08;
        const isEnd = Math.hypot(t.pts.at(-1)[0] - oldPt[0], t.pts.at(-1)[1] - oldPt[1]) < 0.08;
        if (!isStart && !isEnd) return false;
        const idx = isStart ? 0 : t.pts.length - 1;
        const nIdx = isStart ? 1 : t.pts.length - 2;
        const E = t.pts[idx], N = t.pts[nIdx];
        const dx = E[0] - N[0], dy = E[1] - N[1], L0 = Math.hypot(dx, dy);
        if (L0 < 1e-4) { t.pts[idx] = [r3(newPt[0]), r3(newPt[1])]; t.lock = true; return true; }
        const dDir = dirMatch(dx, dy), ux = dx / L0, uy = dy / L0;
        const dispX = newPt[0] - E[0], dispY = newPt[1] - E[1];
        const cross = Math.abs(dispX * (-uy) + dispY * ux);
        if (cross < 0.05) {
          t.pts[idx] = [r3(newPt[0]), r3(newPt[1])];
          t.lock = true; return true;
        }
        const nnIdx = isStart ? 2 : t.pts.length - 3;
        if (nnIdx >= 0 && nnIdx < t.pts.length) {
          const NN = t.pts[nnIdx], dN = dirMatch(N[0] - NN[0], N[1] - NN[1]);
          if (dN) {
            const v1x = dN[0], v1y = dN[1], v2x = dDir ? dDir[0] : ux, v2y = dDir ? dDir[1] : uy;
            const den = v1x * (-v2y) - v1y * (-v2x);
            if (Math.abs(den) > 0.05) {
              const wx = newPt[0] - NN[0], wy = newPt[1] - NN[1];
              const t1 = (wx * (-v2y) - wy * (-v2x)) / den;
              t.pts[nIdx] = [r3(NN[0] + t1 * v1x), r3(NN[1] + t1 * v1y)];
              t.pts[idx] = [r3(newPt[0]), r3(newPt[1])];
              t.pts = simplify(t.pts.filter((q, i) => i === 0 || q[0] !== t.pts[i - 1][0] || q[1] !== t.pts[i - 1][1]));
              t.lock = true; return true;
            }
          }
        }
        if (dDir) {
          let corner = null;
          if (Math.abs(dDir[1]) < 1e-4) corner = [r3(N[0]), r3(newPt[1])];
          else if (Math.abs(dDir[0]) < 1e-4) corner = [r3(newPt[0]), r3(N[1])];
          else {
            const along = (N[0] - newPt[0]) * dDir[0] + (N[1] - newPt[1]) * dDir[1];
            corner = [r3(newPt[0] + along * dDir[0]), r3(newPt[1] + along * dDir[1])];
          }
          if (isStart) t.pts.splice(1, 0, corner); else t.pts.splice(idx, 0, corner);
          t.pts[isStart ? 0 : t.pts.length - 1] = [r3(newPt[0]), r3(newPt[1])];
          t.pts = simplify(t.pts.filter((q, i) => i === 0 || q[0] !== t.pts[i - 1][0] || q[1] !== t.pts[i - 1][1]));
          t.lock = true; return true;
        }
        t.pts[idx] = [r3(newPt[0]), r3(newPt[1])];
        t.lock = true; return true;
      };

      for (const t of S.traces) adjustTraceEnd(t);
      for (const h of S.holes || []) if (Math.hypot(h.x - oldPt[0], h.y - oldPt[1]) < 0.08) { h.x = newPt[0]; h.y = newPt[1]; }
      if (mvA) jw.a = newPt; else jw.b = newPt;
      delete jw.auto;
      gcHoles();
      render();
    },
    // nắn đoạn đang chọn hoặc dây nhảy: h ngang, v dọc, a 45°. Dời đầu tự do của đoạn; đoạn nối 2 chân thì chèn 1 điểm gập
    straight(m) {
      const s = ui.sel;
      if (s && s.t === "j") {
        const j = S.jumpers.find(x => x.id === s.id); if (!j) return;
        checkpoint();
        const P0 = pads().filter(q => !q.jw && !q.hole), onPad = e => P0.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .1);
        const mvA = onPad(j.b) && !onPad(j.a) ? true : onPad(j.a) && !onPad(j.b) ? false : s.end === 0;
        const o = mvA ? j.b : j.a, f0 = [...(mvA ? j.a : j.b)], dx = f0[0] - o[0], dy = f0[1] - o[1], L = Math.hypot(dx, dy) || G;
        const d45 = r3((Math.abs(dx) + Math.abs(dy)) / 2 || L * Math.SQRT1_2);
        const nf = m === "h" ? [Math.abs(dx) >= G ? f0[0] : r3(o[0] + (Math.sign(dx) || 1) * L), o[1]]
          : m === "v" ? [o[0], Math.abs(dy) >= G ? f0[1] : r3(o[1] + (Math.sign(dy) || 1) * L)]
          : [r3(o[0] + (Math.sign(dx) || 1) * d45), r3(o[1] + (Math.sign(dy) || 1) * d45)];
        for (const t of S.traces) t.pts.forEach((pt, k) => { if (Math.hypot(pt[0] - f0[0], pt[1] - f0[1]) < .08) { t.pts[k] = [...nf]; t.lock = true; } });
        for (const h of S.holes || []) if (Math.hypot(h.x - f0[0], h.y - f0[1]) < .08) { h.x = nf[0]; h.y = nf[1]; }
        if (mvA) j.a = nf; else j.b = nf;
        delete j.auto; render(); return;
      }
      const t = s && s.t === "t" && S.traces.find(x => x.id === s.id); if (!t) return;
      checkpoint(); const P = t.pts, last = P.length - 1, k = Math.max(0, Math.min(s.k || 0, last - 1)), a = P[k], b = P[k + 1];
      const P0 = pads(), onPad = e => P0.some(q => Math.hypot(q.x - e[0], q.y - e[1]) < .1);
      const onTJunc = e => S.traces.some(u => u !== t && u.net === t.net && u.pts.some((q, idx) => idx > 0 && segDist(e[0], e[1], u.pts[idx - 1][0], u.pts[idx - 1][1], q[0], q[1]) < .08 && Math.hypot(e[0] - u.pts[0][0], e[1] - u.pts[0][1]) >= .08 && Math.hypot(e[0] - u.pts.at(-1)[0], e[1] - u.pts.at(-1)[1]) >= .08));
      const dx = b[0] - a[0], dy = b[1] - a[1], sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
      const [nx, ny] = m === "h" ? [0, 1] : m === "v" ? [1, 0] : [sy, -sx], err = dx * nx + dy * ny;
      if (Math.abs(err) < 1e-4) return;
      // t?m tr?c c?a ?o?n d?y n?i ti?p ? ??u m?t e (ch? tr??t khi ch? c? ??ng 1 nh?nh n?i ti?p, kh?ng g?n pad/l?/ng? ba)
      const axisAt = (e, selfNb) => {
        if (onPad(e) || onTJunc(e)) return null;
        const links = [];
        for (const u of S.traces) if (u.net === t.net) {
          if (u === t) continue;
          if (Math.hypot(u.pts[0][0] - e[0], u.pts[0][1] - e[1]) < .08 && u.pts[1]) links.push({ u, i: 0, nb: u.pts[1] });
          if (Math.hypot(u.pts.at(-1)[0] - e[0], u.pts.at(-1)[1] - e[1]) < .08 && u.pts.at(-2)) links.push({ u, i: u.pts.length - 1, nb: u.pts.at(-2) });
        }
        // ng? ba (>= 3 nh?nh g?p nhau t?i e): gi? nguy?n ?i?m li?n k?t ?? kh?ng k?o l?ch g?c d?y kh?c
        if ((selfNb && links.length > 0) || links.length > 1) return null;
        const nb = selfNb || (links[0] && links[0].nb);
        if (!nb) return { free: true, links };
        const ux = e[0] - nb[0], uy = e[1] - nb[1], ul = Math.hypot(ux, uy), den = ux * nx + uy * ny;
        if (ul < 1e-3 || Math.abs(den) < .15 * ul) return null;
        return { ux, uy, den, links };
      };
      const axA = axisAt(a, k > 0 ? P[k - 1] : null), axB = axisAt(b, k + 1 < last ? P[k + 2] : null);
      const moveEnd = (pt, ax, delta) => {
        pt[0] = r3(pt[0] + delta[0]); pt[1] = r3(pt[1] + delta[1]);
        for (const lk of (ax && ax.links) || []) { lk.u.pts[lk.i] = [...pt]; lk.u.lock = true; }
      };
      const freeMove = (o, f) => {
        if (m === "h") return [0, o[1] - f[1]];
        if (m === "v") return [o[0] - f[0], 0];
        const d = (Math.abs(f[0] - o[0]) + Math.abs(f[1] - o[1])) / 2;
        return [o[0] + (Math.sign(f[0] - o[0]) || 1) * d - f[0], o[1] + (Math.sign(f[1] - o[1]) || 1) * d - f[1]];
      };
      const insertBend = () => {
        const d = Math.min(Math.abs(dx), Math.abs(dy));
        if (m === "a" && d < 1e-4) return;
        P.splice(k + 1, 0, m === "h" ? [b[0], a[1]] : m === "v" ? [a[0], b[1]] : [r3(a[0] + sx * d), r3(a[1] + sy * d)]);
      };
      if (axA && !axA.free && axB && !axB.free) {
        const tA1 = err / axA.den, tB1 = -err / axB.den;
        const tAh = .5 * tA1, tBh = .5 * tB1;
        if (1 + tAh > .05 && 1 + tBh > .05) {
          moveEnd(a, axA, [tAh * axA.ux, tAh * axA.uy]);
          moveEnd(b, axB, [tBh * axB.ux, tBh * axB.uy]);
        } else if (1 + tB1 > .05) {
          moveEnd(b, axB, [tB1 * axB.ux, tB1 * axB.uy]);
        } else if (1 + tA1 > .05) {
          moveEnd(a, axA, [tA1 * axA.ux, tA1 * axA.uy]);
        } else insertBend();
      } else if (axB && !axB.free && (1 - err / axB.den) > .05) {
        const tB = -err / axB.den; moveEnd(b, axB, [tB * axB.ux, tB * axB.uy]);
      } else if (axA && !axA.free && (1 + err / axA.den) > .05) {
        const tA = err / axA.den; moveEnd(a, axA, [tA * axA.ux, tA * axA.uy]);
      } else if (axB && axB.free) {
        moveEnd(b, axB, freeMove(a, b));
      } else if (axA && axA.free) {
        moveEnd(a, axA, freeMove(b, a));
      } else {
        insertBend();
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
    pour() { checkpoint(); S.pour = !S.pour; TRK("pour", S.pour ? "on" : "off"); render(); toast(S.pour ? L("Đã phủ mass GND vào chỗ trống. Bấm Tự đi dây lại để bỏ bớt đường GND thừa.", "GND pour added to free areas. Autoroute again to drop extra GND traces.") : L("Đã bỏ phủ mass.", "GND pour removed.")); },
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
    if (k === "escape" && ui.lblEdit) { ui.lblEdit = null; ui.refSel = null; render(); }
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); return e.shiftKey ? cmd.redo() : cmd.undo(); }
    if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); return cmd.redo(); }
    if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); return cmd.saveProject(e.shiftKey); }
    if ((e.ctrlKey || e.metaKey) && k === "o") { e.preventDefault(); return cmd.openProject(); }
    if ((e.ctrlKey || e.metaKey) && k === "c") {
      if (ui.sel && ui.sel.t === "c") {
        const c = S.comps.find(x => x.id === ui.sel.id);
        if (c && !isHost(c)) { e.preventDefault(); return cmd.cloneComp(c); }
      }
    }
    if (e.key === "F4") { e.preventDefault(); return cmd.snapG(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "escape") { if (ui.tool === "cs" && ui.cs && ui.cs.fixed) { setTool("sel"); ui.sel = { t: "cs" }; render(); return panel(); } const busy = ui.mode !== "idle"; cancel(); if (!busy) setTool("sel"); ui.sel = null; ui.hlNet = null; return render(); }
    if (ui.tool === "saw" && ui.saw) { if (k === "enter") return sawFinish(); if (k === "backspace") { e.preventDefault(); ui.saw.pts.pop(); return drawSaw(null); } }
    if (ui.mode === "place") {
      if (k === "r") {
        ui.place.rot = (ui.place.rot + 90) % 360;
        drawPlaceGhost();
        return;
      }
      if (k === "escape") {
        cancel();
        render();
        return;
      }
    }
    if (ui.mode === "route") {
      if (k === "/") { S.posture = S.posture ? 0 : 1; drawRoute(); }
      if (k === "backspace") { e.preventDefault(); if (ui.route.pts.length > 1) ui.route.pts.pop(); ui.route.dir = null; drawRoute(); }
      if (k === "enter") { const c = ui.route.cur, pd = padAt({ x: c[0], y: c[1] }); finishRoute(pd && pd.net === ui.route.net ? [pd.x, pd.y] : c, !!(pd && pd.net === ui.route.net)); }
      if (k === "j") placeHole();
      return;
    }
    if (ui.sel && (ui.sel.t === "t" || ui.sel.t === "j") && (k === "h" || k === "v" || k === "a")) return cmd.straight(k);
    if (k === "delete" || k === "backspace") {
      if (ui.sel && ui.sel.t === "cs") {
        e.preventDefault();
        ui.cs = null; if (LY.cs) LY.cs.innerHTML = "";
        renderCsPop(); ui.sel = null; return panel();
      }
      e.preventDefault(); cmd.del();
    }
    else if (k === "r") { const rc = ui.lblEdit && ui.refSel && ui.refSel.id === ui.lblEdit && S.comps.find(x => x.id === ui.refSel.id); if (rc) lblRotate(rc, ui.refSel.k); else cmd.rotate(); } else if (k === "l") { if (e.shiftKey) cmd.lock(); else setTool("cu"); } else if (k === "a") { if (!STUDIO) cmd.auto(); } else if (k === "f") cmd.fill(); else if (k === "c") cmd.chamfer(); else if (k === "0" || k === "home") fit(); else if (k === "v") cmd.flip(); else if (k === "j") setTool("jw"); else if (k === "b") setTool("cu"); else if (k === "t") setTool("tr"); else if (k === "e") setTool("ex"); else if (k === "x") setTool(ui.tool === "pt" ? "sel" : "pt"); else if (k === "w") setTool(ui.tool === "saw" ? "sel" : "saw"); else if (k === "p") setTool(ui.tool === "dr" ? "sel" : "dr"); else if (k === "d") setTool(ui.tool === "cs" ? "sel" : "cs"); else if (k === "m") setTool("ms"); else if (k === "s" && !e.ctrlKey && !e.metaKey) cmd.snapG();
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
    const sh = p => [r3(p[0] + dx), r3(p[1] + dy)];
    if (S.board.poly) { S.board.poly = S.board.poly.map(sh); if (S.board.holes) S.board.holes = S.board.holes.map(h => h.map(sh)); }
    for (const a of S.art || []) { a.paths = a.paths.map(pa => ({ ...pa, pts: pa.pts.map(sh) })); if (a.txt) { a.txt.x = r3(a.txt.x + dx); a.txt.y = r3(a.txt.y + dy); a.txt.p0x = r3(a.txt.p0x + dx); a.txt.p0y = r3(a.txt.p0y + dy); a.txt.pvx = r3(a.txt.pvx + dx); a.txt.pvy = r3(a.txt.pvy + dy); } }
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
  /* tối ưu sau khi xếp kệ: mỗi seed một kiểu. mode 0 = chỉ xếp lại (đổi chỗ), 1 = chỉ xoay 90/180/270, 2 = vừa xoay vừa xếp.
     Điểm = tổng chiều dài nối (cây khung nhỏ nhất mỗi mạng; mạng nhiều chân như GND tính nhẹ hơn) + phạt mỗi chỗ đường nối cắt nhau (bo 1 lớp).
     Board chính, linh kiện khoá và linh kiện đang bị Dim ràng buộc không động tới. Ủ nhiệt (annealing) với số ngẫu nhiên theo seed → cùng seed ra cùng kết quả. */
  function arrangeOpt(seed, mode) {
    const host = S.comps.find(isHost), dimC = new Set();
    for (const d of S.dims || []) for (const r of [d.a, d.b]) if (r && r.c != null) dimC.add(r.c);
    const mov = S.comps.filter(c => c !== host && !c.lock && !dimC.has(c.id));
    if (!mov.length || (mode === 0 && mov.length < 2)) return;
    let st = (seed * 2654435761) >>> 0;
    const rnd = () => { st = (st + 0x6D2B79F5) | 0; let t = Math.imul(st ^ (st >>> 15), 1 | st); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const P0 = pads(), padsOf = new Map(S.comps.map(c => [c, FP[c.fp].pads.map((p, i) => { const q = P0.find(q => q.c === c && q.i === i); return { x: p.x, y: p.y, net: q && q.net }; })]));
    const cross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d); return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9)); };
    const score = () => {
      const by = {};
      for (const c of S.comps) for (const p of padsOf.get(c)) if (p.net) { const [rx, ry] = rot(p.x, p.y, c.rot); (by[p.net] = by[p.net] || []).push([c.x + rx, c.y + ry]); }
      let len = 0; const E = [];
      for (const n in by) {
        const pts = by[n]; if (pts.length < 2) continue; const w = pts.length > 6 ? .4 : 1;
        const rest = pts.map((_, i) => i).slice(1), dist = pts.map(p => Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1])), from = pts.map(() => 0);
        while (rest.length) {
          let bi = 0; for (let k = 1; k < rest.length; k++) if (dist[rest[k]] < dist[rest[bi]]) bi = k;
          const v = rest.splice(bi, 1)[0]; len += w * dist[v]; E.push([pts[from[v]], pts[v], n]);
          for (const u of rest) { const d = Math.hypot(pts[u][0] - pts[v][0], pts[u][1] - pts[v][1]); if (d < dist[u]) { dist[u] = d; from[u] = v; } }
        }
      }
      let cr = 0; for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) if (E[i][2] !== E[j][2] && cross(E[i][0], E[i][1], E[j][0], E[j][1])) cr++;
      return len + 6 * cr;
    };
    const ctrOf = c => { const b = compBox(c); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; };
    const placeAt = (c, ctr) => { const b = compBox(c), ox = (b.x0 + b.x1) / 2 - c.x, oy = (b.y0 + b.y1) / 2 - c.y; c.x = Math.round((ctr[0] - ox) / G) * G; c.y = Math.round((ctr[1] - oy) / G) * G; };
    const clash = c => { const b = compBox(c), m = 1.5; return S.comps.some(o => { if (o === c) return false; const q = compBox(o); return b.x0 < q.x1 + m && b.x1 + m > q.x0 && b.y0 < q.y1 + m && b.y1 + m > q.y0; }); };
    const snapAll = () => S.comps.map(c => [c.x, c.y, c.rot || 0]), back = P => S.comps.forEach((c, i) => { c.x = P[i][0]; c.y = P[i][1]; c.rot = P[i][2]; });
    let cur = score(), best = cur, bestP = snapAll();
    const N = 60 * mov.length + 200;
    for (let it = 0; it < N; it++) {
      const T = 8 * (1 - it / N) + .05, keep = snapAll();
      const doRot = mode === 1 || (mode === 2 && rnd() < .5); let moved;
      if (doRot) { const c = mov[Math.floor(rnd() * mov.length)], ctr = ctrOf(c); c.rot = ((c.rot || 0) + 90 * (1 + Math.floor(rnd() * 3))) % 360; placeAt(c, ctr); moved = [c]; }
      else { if (mov.length < 2) continue; const a = mov[Math.floor(rnd() * mov.length)], b = mov[Math.floor(rnd() * mov.length)]; if (a === b) continue; const ca = ctrOf(a), cb = ctrOf(b); placeAt(a, cb); placeAt(b, ca); moved = [a, b]; }
      if (moved.some(clash)) { back(keep); continue; }
      const sc = score(), dl = sc - cur;
      if (dl <= 0 || rnd() < Math.exp(-dl / T)) { cur = sc; if (sc < best) { best = sc; bestP = snapAll(); } } else back(keep);
    }
    back(bestP);
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
        let n = (MODULES[m.type] && MODULES[m.type].noauto ? (SHARED.includes(role) ? bus[role] : (m.pins || {})[label]) : PWR_ROLE[role] || (SHARED.includes(role) ? bus[role] : (m.pins || {})[label])) || null;
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
      if ((m.host || 0) !== 0 || !d || !f || d.passive) continue;
      const c = S.comps.find(x => x.fp === m.type && !used.has(x));
      if (!c) { out.push({ t: m.type, missing: true, msg: L(`Wiring có ${d.short} nhưng PCB chưa có`, `Wiring has ${d.short} but the PCB does not`) }); continue; }
      used.add(c);
      const names = new Set(f.pads.map(p => p.name));
      for (const [label, role] of d.pins) {
        if (!names.has(label)) continue;
        let want = (d.noauto ? (SHARED.includes(role) ? bus[role] : (m.pins || {})[label]) : PWR_ROLE[role] || (SHARED.includes(role) ? bus[role] : (m.pins || {})[label])) || null;
        if (want && !PWR.has(want) && !H.pins.has(want)) want = null;
        const have = viaR((c.nets || {})[label] || null);
        if ((want || null) !== (have || null)) {
          const p = pads().find(q => q.c === c && q.name === label);
          out.push({ c: c.id, t: c.fp, nth: S.comps.filter(x => x.fp === c.fp).indexOf(c), pin: label, have, want, x: p && p.x, y: p && p.y, msg: `${c.id} · ${label}: PCB = ${have || L("trống", "none")}, Wiring = ${want || L("trống", "none")}` });
        }
      }
    }
    for (const c of S.comps) if (!isHost(c) && c.fp !== "R" && c.fp !== "C" && !used.has(c) && MODULES[c.fp] && !MODULES[c.fp].passive) {
      const b = compBox(c); out.push({ c: c.id, t: c.fp, nth: S.comps.filter(x => x.fp === c.fp).indexOf(c), pcbOnly: true, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, msg: L(`${c.id} (${MODULES[c.fp].short}) có trên PCB nhưng không có trong Wiring`, `${c.id} (${MODULES[c.fp].short}) is on the PCB but not in Wiring`) });
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
  /* ---------- dự án .pdi: lưu bo ra file để cất giữ / làm tiếp trên máy khác ---------- */
  // .pdi = chữ JSON có dòng nhận dạng + số phiên bản (để sau này đổi cấu trúc vẫn mở được file cũ). Chỉ chứa bo PCB.
  const PDI_VER = 1;
  function pdiCheck(doc) {
    if (!doc || doc.format !== "pindexio-pdi") return L("Đây không phải file dự án Pindexio (.pdi).", "This is not a Pindexio project file (.pdi).");
    if (!(doc.version >= 1)) return L("File .pdi thiếu số phiên bản.", "The .pdi file has no version number.");
    if (doc.version > PDI_VER) return L("File lưu bằng phiên bản Pindexio mới hơn. Hãy tải lại trang để cập nhật rồi mở lại.", "This file was saved by a newer Pindexio. Reload the page to update, then open it again.");
    const d = doc.data, num = v => typeof v === "number" && isFinite(v), pt = p => Array.isArray(p) && p.length >= 2 && num(p[0]) && num(p[1]);
    if (!d || d.v !== 2 || !d.board || !Array.isArray(d.comps) || !Array.isArray(d.traces) || !Array.isArray(d.jumpers)) return L("File hỏng hoặc thiếu dữ liệu bo.", "The file is damaged or has no board data.");
    { const bmin = (STUDIO || doc.tpl) ? 10 : BMIN; if (!(d.board.w >= bmin && d.board.w <= BMAX && d.board.h >= bmin && d.board.h <= BMAX)) return L(`Khung bo trong file phải từ ${bmin} đến ${BMAX} mm.`, `The board size in the file must be ${bmin}–${BMAX} mm.`); }
    if (d.board.poly !== undefined) { const okR = rr => Array.isArray(rr) && rr.length >= 3 && rr.length <= 600 && rr.every(pt); if (!okR(d.board.poly) || (d.board.holes !== undefined && (!Array.isArray(d.board.holes) || d.board.holes.length > 50 || !d.board.holes.every(okR)))) return L("Hình dạng bo trong file không hợp lệ.", "The board outline in the file is invalid."); }
    for (const c of d.comps) if (!c || typeof c.id !== "string" || !num(c.x) || !num(c.y) || ![0, 90, 180, 270].includes(c.rot) || !FP[c.fp]) return L(`Linh kiện "${c && c.id}" không hợp lệ hoặc chưa có trong Pindexio.`, `Part "${c && c.id}" is invalid or not available in Pindexio.`);
    for (const t of d.traces) if (!t || typeof t.net !== "string" || !Array.isArray(t.pts) || t.pts.length < 2 || !t.pts.every(pt)) return L("Có đường đồng không hợp lệ trong file.", "The file contains an invalid trace.");
    if (d.layers !== undefined && (!Array.isArray(d.layers) || d.layers.length > 30 || !d.layers.every(l => l && typeof l.id === "string" && /^[a-z0-9_]{1,24}$/.test(l.id) && typeof l.name === "string" && l.name.length <= 40 && /^#[0-9a-fA-F]{6}$/.test(l.color) && ["base", "cu", "jw", "paint"].includes(l.kind)))) return L("Danh sách layer trong file không hợp lệ.", "The layer list in the file is invalid.");
    const okArt = a => a && typeof a.layer === "string" && a.layer.length <= 24 && num(a.w) && a.w > 0 && a.w < 10 && Array.isArray(a.paths) && a.paths.length <= 200 && a.paths.every(pa => pa && Array.isArray(pa.pts) && pa.pts.length >= 1 && pa.pts.length <= 4000 && pa.pts.every(pt))
      && (!a.txt || (typeof a.txt.s === "string" && a.txt.s.length <= 40 && ["x", "y", "h", "p0x", "p0y", "pvx", "pvy"].every(k => num(a.txt[k])))) && (a.ang === undefined || num(a.ang));
    if (d.art !== undefined && (!Array.isArray(d.art) || d.art.length > 400 || !d.art.every(okArt))) return L("Hình vẽ trong file không hợp lệ.", "The file contains an invalid drawing.");
    for (const j of d.jumpers) if (!j || !pt(j.a) || !pt(j.b)) return L("Có dây nhảy không hợp lệ trong file.", "The file contains an invalid jumper.");
    if (SITE && window.BOARDS && d.mcu && !BOARDS.some(b => b.id === d.mcu)) return L(`Board "${d.mcu}" của dự án không có trong Pindexio.`, `The project's board "${d.mcu}" is not available in Pindexio.`);
    return null;
  }
  function projectDoc() {
    const name = (S.proj || "").trim() || "pindexio-pcb"; S.proj = name;
    return { format: "pindexio-pdi", version: PDI_VER, app: "pcb-maker", name, saved: new Date().toISOString(), build: BUILD, parts: usedDefs(), credits: usedDefs().map(p => ({ title: p.title, url: p.url, license: p.license || "CC BY-SA 3.0" })), data: JSON.parse(JSON.stringify(S)) };
  }
  // nạp từ chữ; trả về thông báo lỗi hoặc null. Bo hiện tại vào lịch sử hoàn tác (Ctrl+Z quay lại)
  function loadProjectText(text) {
    let doc; try { doc = JSON.parse(text); } catch (e) { return L("File không đọc được (không phải .pdi hợp lệ).", "The file cannot be read (not a valid .pdi)."); }
    if (doc && doc.format === "pindexio-pdi" && doc.parts !== undefined) {   // linh kiện tuỳ chỉnh đi kèm file: chỉ nhận loại hợp lệ, thêm vào kho của người dùng
      if (!Array.isArray(doc.parts) || !doc.parts.every(validMine)) return L("Linh kiện đi kèm trong file không hợp lệ.", "The parts bundled in the file are invalid.");
      const o = myLib(); for (const p of doc.parts) { registerDef(p); if (!o.parts[p.id]) o.parts[p.id] = p; } myPut(o); loadMine();
    }
    const err = pdiCheck(doc); if (err) return err;
    remember(doc); checkpoint(); S = doc.data; S.proj = doc.name || ""; S.mcu = S.mcu || S3ID; S.autoRe = false; S.jumpers = S.jumpers.filter(j => !j.ext);
    ui.sel = null; ui.hlNet = null; ui.check = null; syncHost(); render(); fit(); list();
    return null;
  }
  /* ---------- thanh gợi ý dưới cùng, nút "?" (cách dùng đầy đủ), menu File (Lưu / Lưu thành / Mở / Mở gần đây) ---------- */
  let HELP_HTML = "";
  const TIPBAR = () => [["cu", "Line", "L", L("vẽ đường đồng", "draw a trace")], ["jw", STUDIO ? "Jumper pad" : L("Dây nhảy", "Jumper"), "J", L("nối 2 điểm", "link 2 points")], ["tr", L("Sửa dây", "Edit"), "T F C E", L("Trim · Fillet · Chamfer · Extend", "Trim · Fillet · Chamfer · Extend")],
    ["sel", L("Chọn", "Select"), "Esc", L("kéo linh kiện", "move parts")], [null, L("Nắn dây", "Straighten"), "H V A", L("ngang · dọc · 45°", "horiz · vert · 45°")],     ["ms", L("Thước", "Ruler"), "M", L("đo khoảng cách", "measure")], [null, L("Xoay", "Rotate"), "R", ""], ["dr", "Pen", "D", L("vẽ tay · chữ · hình · icon", "freehand · text · shapes · icons")]];
  const tipsHTML = () => TIPBAR().map(([t, n, k, d]) => `<span class="tp" ${t ? `data-tp="${t}"` : ""}><b>${n}</b> <em>(${k})</em>${d ? " " + d : ""}</span>`).join("");
  const onOutside = (el, fn) => { const h = e => { if (!e.target.closest("#" + el.id) && !e.target.closest("[data-popbtn]")) { fn(); removeEventListener("pointerdown", h, true); } }; addEventListener("pointerdown", h, true); };
  /* ----- chọn nhiều đối tượng ----- */
  const inMs = (k, id) => !!(ui.sel && ui.sel.t === "m" && ui.ms && ui.ms[k].includes(id));
  function pickObj(p) {
    if (!blk("jw")) { const pd = padAt(p); if (pd && pd.jw) return { k: "j", id: pd.jw.id }; const jw = S.jumpers.find(j => segDist(p.x, p.y, j.a[0], j.a[1], j.b[0], j.b[1]) < .6); if (jw) return { k: "j", id: jw.id }; }
    const pd2 = padAt(p); if (pd2 && S.comps.includes(pd2.c) && !blk("base")) return { k: "c", id: pd2.c.id };
    if (!blk("cu")) { const sg = segAt(p); if (sg) return { k: "t", id: sg.t.id }; }
    const ai = artAt(p); if (ai) return { k: "a", id: ai.id };
    if (!blk("base")) { const c = compAt(p); if (c) return { k: "c", id: c.id }; }
    return null;
  }
  function msCur() { const m = { t: [], j: [], c: [], a: [] }, s = ui.sel; if (!s) return m; if (s.t === "m" && ui.ms) return ui.ms; if (s.t === "t") m.t = (s.ids && s.ids.length > 1 ? s.ids : [s.id]).slice(); else if (m[s.t]) m[s.t] = [s.id]; return m; }
  function msSet(m) { const n = m.t.length + m.j.length + m.c.length + m.a.length; if (!n) { ui.sel = null; ui.ms = null; } else if (n === 1) { const k = ["t", "j", "c", "a"].find(x => m[x].length); ui.sel = { t: k, id: m[k][0] }; ui.ms = null; } else { ui.sel = { t: "m" }; ui.ms = m; } ui.hlNet = null; }
  function msToggle(h) { const m = msCur(), a = m[h.k], i = a.indexOf(h.id); if (i >= 0) a.splice(i, 1); else a.push(h.id); msSet(m); }
  const segHitsRect = (a, b, R) => { if ((a[0] >= R.x0 && a[0] <= R.x1 && a[1] >= R.y0 && a[1] <= R.y1) || (b[0] >= R.x0 && b[0] <= R.x1 && b[1] >= R.y0 && b[1] <= R.y1)) return true; const c = [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]]; for (let i = 0; i < 4; i++) if (segSeg(a, b, c[i], c[(i + 1) % 4]) === 0) return true; return false; };
  function startMarquee(e, additive) {
    const p0 = toMM(e), base = additive ? msCur() : null; let moved = false, R = null;
    ui.drag = {
      move: q => {
        if (!moved && Math.hypot(q.x - p0.x, q.y - p0.y) < 1.2 * (ui.k || .2) * 3) return; moved = true; R = { x0: Math.min(p0.x, q.x), y0: Math.min(p0.y, q.y), x1: Math.max(p0.x, q.x), y1: Math.max(p0.y, q.y) };
        LY.tmp.innerHTML = ""; el("rect", { x: R.x0, y: R.y0, width: R.x1 - R.x0, height: R.y1 - R.y0, class: "marq" }, LY.tmp);
      },
      up: () => {
        LY.tmp.innerHTML = "";
        if (!moved) { if (!additive) { ui.sel = null; ui.ms = null; ui.hlNet = null; render(); } return; }
        const m = base || { t: [], j: [], c: [], a: [] }, add = (k, id) => { if (!m[k].includes(id)) m[k].push(id); };
        if (!blk("base")) for (const c of S.comps) { const b = compBox(c); if (b.x1 >= R.x0 && b.x0 <= R.x1 && b.y1 >= R.y0 && b.y0 <= R.y1) add("c", c.id); }
        if (!blk("cu")) for (const t of S.traces) if (t.pts.some((pt, i) => i && segHitsRect(t.pts[i - 1], pt, R))) add("t", t.id);
        if (!blk("jw")) for (const j of S.jumpers) if (segHitsRect(j.a, j.b, R)) add("j", j.id);
        for (const it of S.art || []) if (!blk(it.layer)) { const b = artBox(it); if (b.x1 >= R.x0 && b.x0 <= R.x1 && b.y1 >= R.y0 && b.y0 <= R.y1) add("a", it.id); }
        msSet(m); render();
      }
    };
  }
  // id các đường đồng đang chọn (chọn 1 đường, Shift/Ctrl nhiều đường, hoặc khung chọn)
  function selTraceIds() { const s0 = ui.sel; return s0 && (s0.t === "t" || s0.t === "m") ? (s0.t === "m" ? (ui.ms ? ui.ms.t : []) : [s0.id, ...(s0.ids || [])]) : []; }
  // thanh trượt "Độ rộng" của bảng Route: hiện độ rộng đường đang chọn (không chọn: độ rộng mặc định đường vẽ sau)
  function syncPenW() {
    const inp = document.querySelector("#plFlyP #plPenW"); if (!inp || document.activeElement === inp) return;
    const ids = selTraceIds(), t = ids.length ? S.traces.find(x => x.id === ids[0]) : null, v = t ? Math.round(traceW(t) * 10) / 10 : (S.penW || 0);
    if (+inp.value !== v) inp.value = v;
    const b = document.querySelector("#plFlyP #plPenWv"); if (b) { const txt = v ? String(v).replace(".", L(",", ".")) + " mm" : L("tự động", "auto"); if (b.textContent !== txt) b.textContent = txt; }
  }
  let syncWidthSlider = () => {};
  function closeAllPopouts(exceptId) {
    ROOT.querySelectorAll(".pl-pop").forEach(m => {
      if (!exceptId || m.id !== exceptId) m.remove();
    });
    ROOT.querySelectorAll("#plAuto, #plWidth").forEach(b => {
      if (!exceptId || b.id !== exceptId) b.classList.remove("on");
    });
    const flyIds = ["plFly", "plFlyP", "plFlyJ", "plFlyD", "plFlyW", "plFlyPH", "plFlyNB", "plFlyCM"];
    flyIds.forEach(id => {
      if (id !== exceptId) {
        const f = $("#" + id);
        if (f) f.classList.remove("on");
      }
    });
    if (exceptId !== "plFlyW") {
      ui.wpaint = null;
      const b = $("#plWidth");
      if (b) b.classList.remove("on");
    }
  }
  function closeWidthMenu() { const fw = $("#plFlyW"); if (fw && fw.classList.contains("on")) { fw.classList.remove("on"); ui.wpaint = null; const b = $("#plWidth"); if (b) b.classList.remove("on"); fw.querySelectorAll("[data-w]").forEach(x => x.classList.remove("on")); } }
  function closePanels(e) {   // bấm vùng trống trong khung vẽ: đóng các bảng xổ xuống (giá trị đã chỉnh vẫn giữ)
    closeAllPopouts(ROUTEFAM.includes(ui.tool) ? "plFlyP" : undefined);
    if (e && !pickObj(toMM(e))) closeWidthMenu();   // menu độ rộng chỉ đóng khi bấm vùng trống; bấm lên dây / linh kiện thì giữ để chọn tiếp
  }
  function routePanel(btn) {   // AutoRoute: đi dây ngay · kiểu đi dây · Auto now · độ rộng dây + Áp dụng tất cả
    const sch = S.routeScheme != null && S.routeScheme >= 0 && S.routeScheme < SCHEMES.length ? S.routeScheme : 1, m = pop("plRoutePop", `<div class="fm-h">${L("Kiểu đi dây", "Routing style")}</div><div class="rp-seg">${SCHEMES.map((x, i) => [i, x.short]).map(([i, t]) => `<button type="button" data-rs="${i}" class="${sch === i ? "on" : ""}">${t}</button>`).join("")}</div>
      <label class="bchk"><input type="checkbox" id="rpNow"${S.autoRe ? " checked" : ""}> ${L("Auto now: dời / thêm / xoá linh kiện là tự đi lại phần liên quan", "Auto now: moving / adding / removing parts re-routes the affected nets")}</label>
      <div class="fm-h">${L("Độ thoáng đường đồng", "Trace spacing")} <b id="rpSpv">${S.spread ?? SPREAD0} mm</b></div>
      <input type="range" id="rpSp" min="0" max="6" step=".5" value="${S.spread ?? SPREAD0}" title="${L("Khoảng cách giữa các đường khi tự đi dây. Kéo sang phải: đường cách xa nhau hơn.", "Gap between traces when auto-routing. Slide right: traces further apart.")}">
      <div class="fm-h">${L("Độ rộng dây", "Trace width")}</div>
      <div class="rp-w"><label>${L("Tín hiệu", "Signal")} <input type="number" id="rpWs" min=".2" max="3" step=".1" value="${W_SIG}"> mm</label><label>${L("Nguồn", "Power")} <input type="number" id="rpWp" min=".2" max="3" step=".1" value="${W_PWR}"> mm</label></div>
      <button type="button" class="rp-apply" id="rpApply">${L("Áp dụng tất cả", "Apply to all")}</button>
      <small class="mut">${L("Nguồn = GND, 3V3, 5V. Giá trị dùng cho mọi lần đi dây và vẽ Line mới; “Áp dụng tất cả” đặt lại độ rộng mọi đường đang có.", "Power = GND, 3V3, 5V. Used by every routing run and new Line; “Apply to all” resets every existing trace.")}</small>`, btn, 300, true);
    if (!m) { btn.classList.remove("on"); return; } btn.classList.add("on");
    if (btn.closest("#plVbar")) { const r = btn.getBoundingClientRect(); m.style.left = (ROOT.classList.contains("vbar-left") ? r.right + 6 : Math.max(8, r.left - 306)) + "px"; m.style.top = Math.max(8, Math.min(r.top, innerHeight - m.offsetHeight - 8)) + "px"; }   // thanh dọc nằm bên phải: bảng xổ sang trái
    cmd.auto(false, sch);
    m.querySelectorAll("[data-rs]").forEach(b => b.onclick = () => { const i = +b.dataset.rs; S.routeScheme = i; save(); m.querySelectorAll("[data-rs]").forEach(x => x.classList.toggle("on", x === b)); cmd.auto(false, i); });
    m.querySelector("#rpNow").onchange = e => { if (!!S.autoRe !== e.target.checked) cmd.autoRe(); };
    const wv = (id, k) => { m.querySelector("#" + id).onchange = e => { S[k] = Math.max(.2, Math.min(3, +e.target.value || (k === "wSig" ? .8 : 1))); e.target.value = S[k]; syncW(); save(); }; };
    wv("rpWs", "wSig"); wv("rpWp", "wPwr");
    m.querySelector("#rpApply").onclick = () => { syncW(); cmd.applyWidths(); };
    { const sp = m.querySelector("#rpSp"); sp.oninput = () => { m.querySelector("#rpSpv").textContent = sp.value + " mm"; }; sp.onchange = () => cmd.spread(sp.value); }
  }
  // hộp xác nhận tự vẽ (không dùng confirm() của trình duyệt)
  function confirmBox(msg, o = {}) {
    return new Promise(res => {
      const d = document.createElement("div"); d.className = "pl-beta pl-cfm"; d.setAttribute("role", "alertdialog"); d.setAttribute("aria-modal", "true");
      d.innerHTML = `<div class="pl-beta-box pl-cfm-box"><div class="pl-cfm-ic${o.danger ? " bad" : ""}" aria-hidden="true">${o.danger ? "!" : "?"}</div><h3>${attr(o.title || L("Xác nhận", "Please confirm"))}</h3><p>${attr(msg)}</p><div class="pdi-b"><button type="button" class="pl-exp-cancel" id="cfNo">${L("Huỷ", "Cancel")}</button><button type="button" class="pl-try${o.danger ? " danger" : ""}" id="cfOk">${attr(o.ok || L("Đồng ý", "OK"))}</button></div></div>`;
      const done = v => { document.removeEventListener("keydown", key, true); d.remove(); res(v); };
      const key = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(!o.danger || document.activeElement === d.querySelector("#cfOk")); } };
      d.querySelector("#cfNo").onclick = () => done(false); d.querySelector("#cfOk").onclick = () => done(true); d.onclick = e => { if (e.target === d) done(false); };
      ROOT.appendChild(d); document.addEventListener("keydown", key, true); (o.danger ? d.querySelector("#cfNo") : d.querySelector("#cfOk")).focus();
    });
  }
  function promptBox(msg, defVal = "", o = {}) {
    return new Promise(res => {
      const d = document.createElement("div"); d.className = "pl-beta pl-cfm"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
      d.innerHTML = `<div class="pl-beta-box pl-cfm-box" style="min-width:260px"><h3>${attr(o.title || L("Nhập giá trị", "Enter value"))}</h3><p style="margin-bottom:8px">${attr(msg)}</p><input id="prInp" type="number" step="any" min="0" value="${attr(defVal)}" style="width:100%;box-sizing:border-box;padding:6px 8px;margin-bottom:12px;border-radius:6px;border:1px solid var(--line,#444);background:var(--bg,#15191f);color:var(--fg,#eee);font-size:13px"><div class="pdi-b"><button type="button" class="pl-exp-cancel" id="prNo">${L("Huỷ", "Cancel")}</button><button type="button" class="pl-try" id="prOk">${attr(o.ok || "OK")}</button></div></div>`;
      const inp = d.querySelector("#prInp");
      const done = v => { document.removeEventListener("keydown", key, true); d.remove(); res(v); };
      const key = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); } else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(inp.value); } };
      d.querySelector("#prNo").onclick = () => done(null); d.querySelector("#prOk").onclick = () => done(inp.value); d.onclick = e => { if (e.target === d) done(null); };
      ROOT.appendChild(d); document.addEventListener("keydown", key, true); inp.focus(); inp.select();
    });
  }
  function pop(id, html, anchor, w, keep) {
    let m = ROOT.querySelector("#" + id); if (m) { m.remove(); return null; }   // bấm lần nữa thì đóng
    closeAllPopouts(id);
    m = document.createElement("div"); m.id = id; m.className = "pl-pop"; m.innerHTML = html; ROOT.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.top = r.bottom + 6 + "px"; m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + "px"; m.style.width = w + "px";
    if (!keep) onOutside(m, () => m.remove()); return m;
  }
  function spreadFly(btn, keep) {   // thanh trượt độ thoáng đường đồng (khoảng cách giữa các đường khi tự đi dây), xổ bên trái nút
    const v = S.spread ?? SPREAD0, m = pop("plSpreadPop", `<h4>${L("Độ thoáng đường đồng", "Trace spacing")}</h4><div class="spr"><input id="plSpread" type="range" min="0" max="6" step=".5" value="${v}"><b>${v} mm</b></div><p class="mut">${L("Khoảng cách giữa các đường khi tự đi dây (không phải mass). Kéo sang phải: đường cách xa nhau hơn. Chỉ áp dụng khi không làm sót thêm đường.", "Gap between traces when auto-routing (not the pour). Slide right: traces further apart. Only applied if nothing more is left unrouted.")}</p>`, btn, 250, keep);
    if (!m) { btn.classList.remove("on"); return; } btn.classList.add("on"); if (!btn.closest("#plBar")) { const r = btn.getBoundingClientRect(); m.style.left = (ROOT.classList.contains("vbar-left") ? r.right + 6 : Math.max(8, r.left - 256)) + "px"; m.style.top = r.top + "px"; }
    const inp = m.querySelector("#plSpread"); inp.oninput = () => inp.nextElementSibling.textContent = inp.value + " mm"; inp.onchange = () => cmd.spread(inp.value);
  }
  function pourFly(btn, keep) {   // tuỳ chọn mass GND, xổ bên trái nút Mass
    const m = pop("plPourPop", `<h4>${L("Mass GND", "GND pour")}</h4><div class="pourset"><label>${L("Khe cách", "Clearance")} <select id="plPourClr">${POUR_CLRS.map(v => `<option value="${v}"${v === (S.pourClr ?? POUR_CLR) ? " selected" : ""}>${String(v).replace(".", L(",", "."))} mm</option>`).join("")}</select></label><label class="bchk"><input type="checkbox" id="plPourArt"${S.pourArt !== false ? " checked" : ""}> ${L("Né chữ & ký hiệu đồng", "Clear copper text & drawings")}</label><label class="bchk"><input type="checkbox" id="plPourIsl"${S.pourIsl ? " checked" : ""}> ${L("Phủ cả vùng không nối GND", "Also fill areas not connected to GND")}</label></div>`, btn, 250, keep);
    if (!m) { btn.classList.remove("on"); return; } btn.classList.add("on"); const r = btn.getBoundingClientRect(); m.style.left = (ROOT.classList.contains("vbar-left") ? r.right + 6 : Math.max(8, r.left - 256)) + "px"; m.style.top = r.top + "px";
    $("#plPourClr").onchange = e => { checkpoint(); S.pourClr = +e.target.value; render(); toast(L(`Khe mass ${S.pourClr} mm`, `Pour clearance ${S.pourClr} mm`) + (S.pour ? "" : L(" · bật Phủ mass để thấy", " · turn on GND pour to see it"))); };
    $("#plPourArt").onchange = e => { checkpoint(); S.pourArt = e.target.checked; render(); toast(S.pourArt ? L("Mass sẽ né chữ & hình vẽ đồng.", "Pour clears copper drawings.") : L("Mass phủ kín (không né chữ & hình vẽ đồng).", "Pour does not clear copper drawings.") + (S.pour ? "" : L(" · bật Phủ mass để thấy", " · turn on GND pour to see it"))); };
    $("#plPourIsl").onchange = e => { checkpoint(); S.pourIsl = e.target.checked; render(); if (S.pourIsl) toast(L("Vùng không nối GND cũng được phủ: đó là đồng trống, không thuộc mạng nào.", "Areas not connected to GND are filled too: floating copper, no net.") + (S.pour ? "" : L(" · bật Phủ mass để thấy", " · turn on GND pour to see it"))); };
  }
  function toggleHelp() {   // Cách dùng chia theo mục, bấm tiêu đề để sổ ra (mở từ menu File)
    const li = HELP_HTML.split("<li>").slice(1).map(x => "<li>" + x);
    const G = [[L("Vẽ dây", "Drawing traces"), [1, 5, 8, 10]], [L("Sửa dây", "Editing traces"), [2, 3, 6, 7, 9]], [L("Linh kiện & chọn", "Parts & selection"), [4, 11, 14]], [L("Layer & Pen", "Layers & Pen"), [12, 13]], [L("Bo mạch (Cưa)", "Board (Saw)"), [15]], [L("File & phím chung", "File & common keys"), [16, 17]]];
    const used = new Set(G.flatMap(g => g[1])), rest = li.map((_, i) => i + 1).filter(i => !used.has(i));
    if (rest.length) G.push([L("Khác", "Other"), rest]);
    const b = $("#plFile"), m = pop("plHelpPop", `<h4>${L("Cách dùng", "How to use")}</h4>${G.map(g => `<details class="hsec"><summary>${g[0]}</summary><ul class="help">${g[1].map(i => li[i - 1] || "").join("")}</ul></details>`).join("")}`, b, 400);
    if (m) { const ds = m.querySelectorAll("details"); if (ds[0]) ds[0].open = true; ds.forEach(x => x.ontoggle = () => { if (x.open) ds.forEach(y => { if (y !== x) y.open = false; }); }); }
  }
  /* dự án: Lưu (ghi đè file đã chọn nếu trình duyệt cho phép), Lưu thành, Mở, Mở gần đây (5 dự án mới nhất, giữ bản chép trong trình duyệt) */
  const RKEY = "pindexio-recent"; let FH = null;   // FH: file đang làm việc (Chrome / Edge cho ghi đè trực tiếp)
  const recents = () => { try { const a = JSON.parse(localStorage.getItem(RKEY) || "[]"); return Array.isArray(a) ? a.filter(r => r && typeof r.name === "string" && typeof r.text === "string").slice(0, 5) : []; } catch (e) { return []; } };
  function remember(doc) {
    TRK("open_pdi");
    const text = JSON.stringify(doc); if (text.length > 800000) return;
    let a = recents().filter(r => r.name !== doc.name); a.unshift({ name: doc.name, saved: doc.saved || new Date().toISOString(), text }); a = a.slice(0, 5);
    for (; ;) { try { localStorage.setItem(RKEY, JSON.stringify(a)); return; } catch (e) { if (a.length <= 1) return; a.pop(); } }
  }
  const safeName = s => String(s || "pindexio-pcb").replace(/[\\/:*?"<>|]+/g, "-").trim() || "pindexio-pcb";
  function askName(def) {   // hộp nhỏ nhập tên khi trình duyệt không có cửa sổ "Lưu thành" riêng
    return new Promise(res => {
      const d = document.createElement("div"); d.className = "pl-beta"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
      d.innerHTML = `<div class="pl-beta-box"><h3>${L("Lưu thành…", "Save as…")}</h3><label class="pv">${L("Tên dự án", "Project name")} <input id="plAskN" value="${attr(def)}"></label><p class="mut">${L("File sẽ được tải về thư mục Tải xuống với đuôi .pdi.", "The file is downloaded to your Downloads folder with the .pdi extension.")}</p>
        <div class="pdi-b"><button type="button" id="plAskOk" class="pl-try">${L("Lưu", "Save")}</button><button type="button" id="plAskNo" class="pl-exp-cancel">${L("Huỷ", "Cancel")}</button></div></div>`;
      ROOT.appendChild(d); const inp = d.querySelector("#plAskN"); inp.focus(); inp.select();
      const done = v => { d.remove(); res(v); };
      d.querySelector("#plAskOk").onclick = () => done(inp.value.trim() || null); d.querySelector("#plAskNo").onclick = () => done(null);
      inp.onkeydown = e => { if (e.key === "Enter") done(inp.value.trim() || null); else if (e.key === "Escape") done(null); };
    });
  }
  async function saveProjectImpl(asNew) {
    S.proj = (S.proj || "").trim();
    if (window.showSaveFilePicker) {
      try {
        if (asNew || !FH) FH = await window.showSaveFilePicker({ ...(window.APP && APP.getDirHandle && APP.getDirHandle() ? { startIn: APP.getDirHandle() } : {}), suggestedName: safeName(S.proj) + ".pdi", types: [{ description: "Pindexio project", accept: { "application/octet-stream": [".pdi"] } }] });
        S.proj = FH.name.replace(/\.pdi$/i, ""); const doc = projectDoc(), w = await FH.createWritable(); await w.write(JSON.stringify(doc)); await w.close();
        remember(doc); save(); return toast(L(`Đã lưu ${FH.name}.`, `Saved ${FH.name}.`));
      } catch (e) { if (e && e.name === "AbortError") return; FH = null; }   // lỗi khác (không cho ghi…): quay về tải file xuống
    }
    let nm = S.proj; if (asNew || !nm) { nm = await askName(nm || "pindexio-pcb"); if (!nm) return; }
    S.proj = safeName(nm); const doc = projectDoc();
    download(new Blob([JSON.stringify(doc)], { type: "application/octet-stream" }), S.proj + ".pdi"); remember(doc); save();
    toast(L(`Đã lưu ${S.proj}.pdi (trong thư mục Tải xuống). Mở lại bằng File ▸ Mở.`, `Saved ${S.proj}.pdi (in your Downloads folder). Reopen it with File ▸ Open.`));
  }
  function openText(text, name, handle) {
    const err = loadProjectText(text); toast(err ? "⛔ " + err : L(`Đã mở ${S.proj || name} (Ctrl+Z để quay lại bo trước).`, `Opened ${S.proj || name} (Ctrl+Z returns to the previous board).`));
    if (!err) FH = handle || null;
  }
  function openFile(file) {
    if (!file) return;
    if (file.size > 5e6) return toast(L("File quá lớn (trên 5 MB), không phải .pdi của Pindexio.", "File too large (over 5 MB), not a Pindexio .pdi."));
    const rd = new FileReader(); rd.onload = () => openText(String(rd.result), file.name, null); rd.onerror = () => toast(L("Không đọc được file.", "Could not read the file.")); rd.readAsText(file);
  }
  async function openProjectImpl() {
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({ ...(window.APP && APP.getDirHandle && APP.getDirHandle() ? { startIn: APP.getDirHandle() } : {}), types: [{ description: "Pindexio project", accept: { "application/octet-stream": [".pdi"] } }], multiple: false });
        const f = await h.getFile(); if (f.size > 5e6) return toast(L("File quá lớn (trên 5 MB), không phải .pdi của Pindexio.", "File too large (over 5 MB), not a Pindexio .pdi."));
        return openText(await f.text(), f.name, h);
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    let inp = ROOT.querySelector("#plPdiFile");
    if (!inp) { inp = document.createElement("input"); inp.type = "file"; inp.id = "plPdiFile"; inp.accept = ".pdi"; inp.hidden = true; inp.onchange = () => { openFile(inp.files[0]); inp.value = ""; }; ROOT.appendChild(inp); }
    inp.click();
  }

  /* ---------- Template: mẫu mạch dựng sẵn (file .pdi trong thư mục templates/, danh sách ở templates/index.json) ---------- */
  let TPL = null;
  async function templatesDialog() {
    const old = ROOT.querySelector("#plTplBox"); if (old) old.remove();
    const d = document.createElement("div"); d.id = "plTplBox"; d.className = "pl-beta"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = `<div class="pl-beta-box" style="width:min(560px,94vw);max-height:84vh;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">${L("Template (mẫu mạch)", "Templates")}</h3><button type="button" id="tpX">✕</button></div>
      <input id="tpQ" type="search" placeholder="${L("Tìm template…", "Search templates…")}" style="width:100%;margin-bottom:8px">
      <div id="tpL" style="overflow:auto;display:grid;gap:8px;min-height:80px"><p class="mut">${L("Đang tải…", "Loading…")}</p></div></div>`;
    ROOT.appendChild(d);
    const shut = () => d.remove(); d.querySelector("#tpX").onclick = shut; d.addEventListener("pointerdown", e => { if (e.target === d) shut(); });
    const box = d.querySelector("#tpL"), q = d.querySelector("#tpQ");
    try { if (!TPL) { const r = await fetch("templates/index.json"); if (!r.ok) throw 0; TPL = (await r.json()).templates || []; } }
    catch (e) { box.innerHTML = `<p class="mut">${L("Không tải được danh sách template.", "Could not load the template list.")}</p>`; return; }
    const draw = () => {
      const v = q.value.trim().toLowerCase(), a = TPL.filter(t => !v || (t.title + " " + t.title_en + " " + (t.tags || []).join(" ") + " " + t.desc).toLowerCase().includes(v));
      box.innerHTML = a.map(t => `<div style="border:1px solid var(--line,#2a323c);border-radius:8px;padding:10px;display:grid;gap:4px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${attr(L(t.title, t.title_en || t.title))}</b><button type="button" data-use="${attr(t.id)}" class="tb primary" style="padding:4px 14px">${L("Dùng", "Use")}</button></div>
        <div style="font-size:12px;opacity:.85">${attr(L(t.desc, t.desc_en || t.desc))}</div>
        <div style="font-size:11px;opacity:.65">${(t.tags || []).map(attr).join(" · ")} · ${attr(t.size || "")}</div></div>`).join("") || `<p class="mut">—</p>`;
      box.querySelectorAll("[data-use]").forEach(b => b.onclick = async () => {
        const t = TPL.find(x => x.id === b.dataset.use); if (!t) return; b.disabled = true;
        try { const r = await fetch("templates/" + t.file); if (!r.ok) throw 0; const txt = await r.text(); shut(); openText(txt, t.title, null); }
        catch (e) { b.disabled = false; toast(L("Không tải được template.", "Could not load the template.")); }
      });
    };
    q.oninput = draw; draw();
  }
  async function saveTemplate() {   // xuất bo hiện tại thành file template (.pdi); thêm vào thư mục templates/ + templates/index.json để chia sẻ
    const nm = await askName(S.proj || "template"); if (!nm) return;
    const doc = projectDoc(); doc.name = safeName(nm); doc.tpl = { title: nm };
    download(new Blob([JSON.stringify(doc)], { type: "application/octet-stream" }), safeName(nm) + ".pdi");
    toast(L("Đã tải template. Thêm file vào thư mục templates/ và một mục trong templates/index.json.", "Template downloaded. Add the file to templates/ and an entry in templates/index.json."));
  }
  function openRecent(i) { const r = recents()[i]; if (!r) return; openText(r.text, r.name, null); }
  // danh sách "Mở gần đây" xổ sang bên phải dòng menu
  function recentPop(btn, menu) {
    let sp = ROOT.querySelector("#plRecentPop"); if (sp) { sp.remove(); return; }
    const rc = recents(), fmt = s => { const d = new Date(s); return isNaN(d) ? "" : d.toLocaleString(EN() ? "en-GB" : "vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
    sp = document.createElement("div"); sp.id = "plRecentPop"; sp.className = "pl-pop";
    sp.innerHTML = (rc.length ? rc.map((r, i) => `<button type="button" data-fm="r${i}">${attr(r.name)} <kbd>${fmt(r.saved)}</kbd></button>`).join("") + `<button type="button" data-fm="clr" class="fm-x">${L("Xoá danh sách gần đây", "Clear recent list")}</button>` : `<div class="fm-e">${L("(chưa có)", "(none yet)")}</div>`);
    ROOT.appendChild(sp);
    const r = btn.getBoundingClientRect(), M = menu ? menu.getBoundingClientRect() : r, w = 250; sp.style.width = w + "px"; sp.style.top = r.top + "px"; sp.style.left = (M.right + 4 + w > innerWidth ? Math.max(8, M.left - w - 4) : M.right + 4) + "px";
    sp.querySelectorAll("[data-fm]").forEach(b => b.onclick = () => {
      const k = b.dataset.fm; sp.remove(); if (menu) menu.remove();
      if (k === "clr") { try { localStorage.removeItem(RKEY); } catch (e) { } toast(L("Đã xoá danh sách gần đây.", "Recent list cleared.")); } else openRecent(+k.slice(1));
    });
    onOutside(sp, ev => { if (!(menu && menu.contains(ev && ev.target))) sp.remove(); });
  }
  // Kết nối AI (Remote MCP): bật thì tab nối tới mcp.pindexio.com; AI (Claude, Antigravity, Cursor…) dán URL có mã phòng của tab này
  function aiDialog() {
    const A = window.PINDEXIO_AI; if (!A) return;
    const old = ROOT.querySelector("#plAiBox"); if (old) old.remove();
    const d = document.createElement("div"); d.id = "plAiBox"; d.className = "pl-beta"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = `<div class="pl-beta-box" style="width:min(480px,94vw)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0">${L("Kết nối AI (MCP)", "Connect AI (MCP)")}</h3><button type="button" id="aiX">✕</button></div>
      <div class="st-row"><div class="st-t">${L("Trạng thái", "Status")}</div><div class="st-v" id="aiSt"></div><div class="st-b"><button type="button" id="aiTg"></button><button type="button" id="aiNew">${L("Đổi mã", "New code")}</button></div></div>
      <div class="st-row"><div class="st-t">${L("URL MCP – dán vào Claude / Antigravity / Cursor", "MCP URL – paste into Claude / Antigravity / Cursor")}</div><div class="ai-cp"><input id="aiUrl" readonly><button type="button" data-cp="aiUrl">${L("Chép", "Copy")}</button></div></div>
      <div class="st-row"><div class="st-t">Claude Code</div><div class="ai-cp"><input id="aiCmd" readonly><button type="button" data-cp="aiCmd">${L("Chép", "Copy")}</button></div></div></div>`;
    ROOT.appendChild(d);
    const paint = () => {
      const st = A.state(); d.querySelector("#aiSt").textContent = st === "on" ? L("Đã nối – AI dùng được tab này", "Connected – AI can use this tab") : st === "wait" ? L("Đang nối…", "Connecting…") : L("Chưa bật", "Off");
      d.querySelector("#aiTg").textContent = st === "off" ? L("Bật", "Turn on") : L("Tắt", "Turn off");
      d.querySelector("#aiUrl").value = A.url(); d.querySelector("#aiCmd").value = "claude mcp add --transport http pindexio " + A.url();
    };
    const tm = setInterval(() => { if (!d.isConnected) return clearInterval(tm); paint(); }, 500);
    const shut = () => { clearInterval(tm); d.remove(); }; d.querySelector("#aiX").onclick = shut; d.addEventListener("pointerdown", e => { if (e.target === d) shut(); });
    d.querySelector("#aiTg").onclick = () => { A.state() === "off" ? A.on() : A.off(); paint(); };
    d.querySelector("#aiNew").onclick = () => { A.renew(); paint(); };
    d.querySelectorAll("[data-cp]").forEach(b => b.onclick = () => { const i = d.querySelector("#" + b.dataset.cp); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand("copy"); } b.textContent = L("Đã chép", "Copied"); setTimeout(() => b.textContent = L("Chép", "Copy"), 1200); });
    paint();
  }
  // Cài đặt: thư mục lưu file (Export, Lưu dự án) và thư mục thư viện Pinworld mặc định
  function settingsDialog() {
    const old = ROOT.querySelector("#plSetBox"); if (old) old.remove();
    const A = window.APP || {}, fsOK = !!window.showDirectoryPicker;
    const d = document.createElement("div"); d.id = "plSetBox"; d.className = "pl-beta"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    const row = (id, title, name) => `<div class="st-row"><div class="st-t">${title}</div><div class="st-v" id="${id}V">${name ? attr(name) : L("(chưa chọn – tải về thư mục Downloads)", "(not set – downloads folder)")}</div>
      <div class="st-b"><button type="button" id="${id}P"${fsOK ? "" : " disabled"}>${L("Chọn thư mục…", "Choose folder…")}</button><button type="button" id="${id}C">${L("Bỏ", "Clear")}</button></div></div>`;
    d.innerHTML = `<div class="pl-beta-box" style="width:min(460px,94vw)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0">${L("Cài đặt", "Settings")}</h3><button type="button" id="stX">✕</button></div>
      ${row("stSave", L("Thư mục lưu file (Export, Lưu dự án)", "Save folder (Export, Save project)"), A.getSaveDir ? A.getSaveDir() : "")}
      ${row("stLib", L("Thư viện Pinworld mặc định (pindexio-library.json)", "Default Pinworld library (pindexio-library.json)"), A.getLibDir ? A.getLibDir() : "")}
      <div class="st-b" style="margin-top:6px"><button type="button" id="stLibW">${L("Lưu thư viện ra thư mục", "Write library to folder")}</button><button type="button" id="stLibR">${L("Nạp thư viện từ thư mục", "Load library from folder")}</button></div></div>`;
    ROOT.appendChild(d);
    const shut = () => d.remove(); d.querySelector("#stX").onclick = shut; d.addEventListener("pointerdown", e => { if (e.target === d) shut(); });
    const upd = () => { d.querySelector("#stSaveV").textContent = (A.getSaveDir && A.getSaveDir()) || L("(chưa chọn – tải về thư mục Downloads)", "(not set – downloads folder)"); d.querySelector("#stLibV").textContent = (A.getLibDir && A.getLibDir()) || L("(chưa chọn)", "(not set)"); const has = !!(A.getLibDir && A.getLibDir()); d.querySelector("#stLibW").disabled = d.querySelector("#stLibR").disabled = !has; };
    d.querySelector("#stSaveP").onclick = async () => { if (A.pickSaveDir) await A.pickSaveDir(); else await pickSaveDir(); upd(); };
    d.querySelector("#stSaveC").onclick = () => { clearSaveDir(); upd(); };
    d.querySelector("#stLibP").onclick = async () => { if (A.pickLibDir && await A.pickLibDir()) await A.writeLib(true); upd(); };
    d.querySelector("#stLibC").onclick = () => { if (A.clearLibDir) A.clearLibDir(); upd(); };
    d.querySelector("#stLibW").onclick = async () => { const ok = A.writeLib && await A.writeLib(true); toast(ok ? L("Đã lưu thư viện vào thư mục.", "Library written to the folder.") : L("Không ghi được vào thư mục.", "Could not write to the folder.")); };
    d.querySelector("#stLibR").onclick = async () => { const n = A.readLib && await A.readLib(); toast(n == null ? L("Không đọc được pindexio-library.json trong thư mục.", "Could not read pindexio-library.json.") : L(`Đã nạp ${n} linh kiện.`, `Loaded ${n} parts.`)); };
    upd();
  }
  function toggleFileMenu() {
    const rc = recents(), fmt = s => { const d = new Date(s); return isNaN(d) ? "" : d.toLocaleString(EN() ? "en-GB" : "vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
    const m = pop("plFileMenu", `<div class="fm-h">${L("Dự án", "Project")}: <b>${attr(S.proj || L("(chưa đặt tên)", "(untitled)"))}</b></div>
      <button type="button" data-fm="save">${L("Lưu", "Save")} <kbd>Ctrl+S</kbd></button><button type="button" data-fm="saveas">${L("Lưu thành…", "Save as…")} <kbd>Ctrl+Shift+S</kbd></button><button type="button" data-fm="open">${L("Mở…", "Open…")} <kbd>Ctrl+O</kbd></button>
      <button type="button" data-fm="rc" class="fm-sub">${L("Mở gần đây", "Open recent")} <kbd>${rc.length} ▸</kbd></button>
      <div class="fm-h">Template</div><button type="button" data-fm="tpl">${L("Chọn template…", "Browse templates…")}</button><button type="button" data-fm="tplsave">${L("Lưu bo thành template…", "Save as template…")}</button>
      <div class="fm-h">${L("Linh kiện đang chọn", "Selected part")}</div><button type="button" data-fm="pset">${L("Lưu linh kiện", "Save selected")}</button><button type="button" data-fm="passet">${L("Lưu linh kiện thành bản mới…", "Save selected as…")}</button>
      <div class="fm-h">${L("Xuất & trợ giúp", "Export & help")}</div><button type="button" data-fm="exp">Export… <kbd>SVG · PDF · Gerber</kbd></button><button type="button" data-fm="help">${L("Cách dùng…", "How to use…")}</button>
      <button type="button" data-fm="ai">${L("Kết nối AI…", "Connect AI…")}</button><button type="button" data-fm="set">${L("Cài đặt…", "Settings…")}</button>`, $("#plFile"), 270);
    if (!m) return;
    m.querySelectorAll("[data-fm]").forEach(b => b.onclick = () => {
      const k = b.dataset.fm; if (k === "rc") return recentPop(b, m); m.remove(); { const sp = ROOT.querySelector("#plRecentPop"); if (sp) sp.remove(); }
      if (k === "set") return settingsDialog();
      if (k === "ai") return aiDialog();
      if (k === "save") saveProjectImpl(false); else if (k === "saveas") saveProjectImpl(true); else if (k === "open") openProjectImpl();
      else if (k === "tpl") templatesDialog(); else if (k === "tplsave") saveTemplate(); else if (k === "pset") savePart(false); else if (k === "passet") savePart(true); else if (k === "exp") exportDialog(); else if (k === "help") toggleHelp(); else if (k === "clr") { try { localStorage.removeItem(RKEY); } catch (e) { } toast(L("Đã xoá danh sách gần đây.", "Recent list cleared.")); } else openRecent(+k.slice(1));
    });
  }
  Object.assign(cmd, {
    confirmAuto(id, pin) { const c = S.comps.find(x => x.id === id); if (!c || !c.auto) return; checkpoint(); delete c.auto[pin]; if (!Object.keys(c.auto).length) delete c.auto; render(); },
    dropAuto(id, pin) { const c = S.comps.find(x => x.id === id); if (!c) return; cmd.setNet(id, pin, ""); const c2 = S.comps.find(x => x.id === id); if (c2 && c2.auto) { delete c2.auto[pin]; if (!Object.keys(c2.auto).length) delete c2.auto; render(); } },
    confirmAll() { if (!pendingAuto().length) return; checkpoint(); for (const c of S.comps) delete c.auto; render(); toast(L("Đã xác nhận tất cả chân tự nối. Hãy chắc là bạn đã đối chiếu datasheet.", "All auto-wired pins confirmed. Make sure you compared them with the datasheet.")); },
    saveProject(asNew) { TRK("save", asNew ? "as" : ""); return saveProjectImpl(!!asNew); },
    openProject(file) { return file ? openFile(file) : openProjectImpl(); },
    boardSize(w, h) {
      w = Math.round(+w); h = Math.round(+h);
      if (!(w >= BMIN && w <= BMAX && h >= BMIN && h <= BMAX)) { render(); return toast(L(`Khung bo từ ${BMIN} đến ${BMAX} mm.`, `Board size must be ${BMIN}–${BMAX} mm.`)); }
      if (w === S.board.w && h === S.board.h) return;
      // co / giãn đều 2 cạnh đối: cụm linh kiện + đường đồng nằm giữa, lề trái = phải, trên = dưới (bước 2,54 để giữ lưới)
      checkpoint(); const e = extent();
      if (e) {
        shiftAll(Math.round(((w - (e.x1 - e.x0)) / 2 - e.x0) / G) * G, Math.round(((h - (e.y1 - e.y0)) / 2 - e.y0) / G) * G);
        if (e.x1 - e.x0 + 2 * EDGE > w || e.y1 - e.y0 + 2 * EDGE > h) toast(L(`Bo ${w} × ${h} mm nhỏ hơn cụm linh kiện / đường đồng – phần tràn ra ngoài sẽ báo lỗi.`, `Board ${w} × ${h} mm is smaller than the parts / traces – the overflow will show as errors.`));
      }
      S.board = { w, h }; render(); fit();
    },
    spread(v) {
      v = Math.max(0, Math.min(6, +v)); if (v === (S.spread ?? SPREAD0)) return;
      if (!S.routed && !S.traces.some(t => !t.lock)) { S.spread = v; return render(); }
      const keep = JSON.stringify(S), a0 = analyze(), r0 = a0.rats.length, d0 = a0.drc.length, old = S.spread ?? SPREAD0;
      checkpoint(); S.spread = v; cmd.auto(true, S.routeScheme == null ? S.scheme : S.routeScheme);
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
    arrange() {
      if (S.comps.length < 2) return cmd.pack();
      checkpoint(); const re = S.routed || S.traces.some(t => !t.lock);
      const seed = S.arrSeed = (S.arrSeed || 0) + 1, mode = (seed - 1) % 3; S.arr = Math.floor((seed - 1) / 3) % ARR_W.length;
      S.traces = []; S.jumpers = []; layoutParts(); arrangeOpt(seed, mode); fitBoardTo(roomy()); dimSolve(); render(); fit();
      const MN = [L("chỉ xếp lại", "rearrange only"), L("chỉ xoay", "rotate only"), L("vừa xoay vừa xếp", "rotate + rearrange")][mode];
      toast(L("Sắp xếp", "Layout") + ` #${seed} · ${MN} · ${ARR_N()[S.arr]} · ${S.board.w} × ${S.board.h} mm`);
      if (re && S.autoRe) setTimeout(() => cmd.auto(true), 30);
    },
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
      TRK("board", id);
      checkpoint(); const keep = { alpha: S.alpha, autoRe: S.autoRe, pour: S.pour, rats: S.rats };
      S = Object.assign(fresh(id), keep); ui.sel = null; ui.cs = null; if (LY.cs) LY.cs.innerHTML = ""; cancel();
      render(); fit();
      list(); render();
      if (!quiet) toast(L(`Đổi sang ${hostInfo().name}`, `Switched to ${hostInfo().name}`) + (hostInfo().s3 ? "" : L(" · nối board với bo qua hàng rào J1 (dây Dupont)", " · wire the board to the PCB through header J1 (Dupont wires)")) + L(" · Ctrl+Z để quay lại", " · Ctrl+Z to undo"));
    }
  });

  /* ---------- danh sách linh kiện bên trái (giống cột board của tab Sơ đồ chân) ---------- */
  const ICON_R = '<svg viewBox="0 0 40 28"><path d="M2 14h9M29 14h9" stroke="#9aa3a0" stroke-width="2"/><rect x="11" y="9" width="18" height="10" rx="5" fill="#d8c194"/><path d="M15 9v10M19 9v10M23 9v10" stroke-width="2" stroke="#7b4a1e"/></svg>';
  const ICON_E = '<svg viewBox="0 0 40 28"><path d="M16 22v4M24 22v4" stroke="#9aa3a0" stroke-width="2"/><rect x="12" y="2" width="16" height="20" rx="3" fill="#2b4f9e"/><rect x="23" y="2" width="4" height="20" fill="#c9d2e0"/></svg>';
  const ICON_Q = '<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="2" width="20" height="6" rx="1" fill="#94a3b8"/><circle cx="20" cy="5" r="1.8" fill="#475569"/><rect x="10" y="8" width="20" height="12" rx="1" fill="#1e242d"/><path d="M14 20v6M20 20v6M26 20v6" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round"/></svg>';
  // icon SMD nền trong suốt, cùng khung 40 × 28 với icon linh kiện khác
  const smdIcon = k => {
    const pin = "#cbd5e1", body = "#1e242d", svg = b => `<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg">${b}</svg>`;
    if (k === "smd_sot23") return svg(`<rect x="13" y="9" width="14" height="10" rx="1" fill="${body}"/><path d="M16 19v5M24 19v5M20 9V4" stroke="${pin}" stroke-width="2.4" stroke-linecap="square"/>`);
    if (k === "smd_soic8") return svg(`<rect x="11" y="7" width="18" height="14" rx="1" fill="${body}"/><circle cx="14" cy="10" r="1.2" fill="#64748b"/><path d="M13.5 7V3M18 7V3M22 7V3M26.5 7V3M13.5 21v4M18 21v4M22 21v4M26.5 21v4" stroke="${pin}" stroke-width="1.8"/>`);
    const w = { smd_0402: 10, smd_0603: 14, smd_0805: 18, smd_1206: 24, smd_2512: 32 }[k] || 18, h = Math.max(6, Math.round(w * .5)), x = 20 - w / 2, y = 14 - h / 2, e = Math.max(2, w * .2);
    return svg(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".8" fill="${body}"/><rect x="${x}" y="${y}" width="${e}" height="${h}" fill="${pin}"/><rect x="${x + w - e}" y="${y}" width="${e}" height="${h}" fill="${pin}"/>`);
  };
  const ICON_DIP = '<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="5" width="22" height="18" rx="1.5" fill="#1e242d"/><path d="M18 5a2 2 0 0 0 4 0" fill="#475569"/><path d="M12 5V1M17 5V1M23 5V1M28 5V1M12 23v4M17 23v4M23 23v4M28 23v4" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_TERM = '<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="28" height="18" rx="1.5" fill="#1f8a4c"/><circle cx="14" cy="14" r="4.5" fill="#cbd5e1"/><circle cx="26" cy="14" r="4.5" fill="#cbd5e1"/><path d="M11.5 14h5M23.5 14h5" stroke="#475569" stroke-width="1.6"/></svg>';
  const ICON_TO92 = '<svg viewBox="0 0 40 28" xmlns="http://www.w3.org/2000/svg"><path d="M11 20 L29 20 A9 9 0 0 0 11 20 Z" fill="#1e242d"/><rect x="12" y="18" width="16" height="2" fill="#111"/><path d="M15 20v6M20 20v6M25 20v6" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><text x="20" y="14" font-size="5" font-weight="700" text-anchor="middle" fill="#9ca3af" font-family="sans-serif">TO-92</text></svg>';
  const ICON_M = '<svg viewBox="0 0 40 28"><rect x="8" y="5" width="22" height="18" rx="5" fill="#3a3f47"/><rect x="30" y="12" width="6" height="4" fill="#b8bcc2"/><text x="19" y="18" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">M</text></svg>';
  const ICON_H = '<svg viewBox="0 0 40 28"><rect x="4" y="6" width="32" height="16" rx="2" fill="#181a1f" stroke="#333" stroke-width="1"/><rect x="8" y="10" width="6" height="8" rx="1" fill="#2d3139"/><circle cx="11" cy="14" r="2.2" fill="#ffd700"/><circle cx="11" cy="14" r="1.1" fill="#111"/><rect x="17" y="10" width="6" height="8" rx="1" fill="#2d3139"/><circle cx="20" cy="14" r="2.2" fill="#ffd700"/><circle cx="20" cy="14" r="1.1" fill="#111"/><rect x="26" y="10" width="6" height="8" rx="1" fill="#2d3139"/><circle cx="29" cy="14" r="2.2" fill="#ffd700"/><circle cx="29" cy="14" r="1.1" fill="#111"/></svg>';
  const ICON_C = '<svg viewBox="0 0 40 28"><path d="M14 22v4M26 22v4" stroke="#9aa3a0" stroke-width="2"/><rect x="9" y="4" width="22" height="18" rx="9" fill="#d9a83a"/></svg>';
  const iconSrc = k => k.startsWith("MY:") ? FP[k].icon : k === "to92" ? TO92_ICON : SITE && MODULES[k] ? MODULES[k].svg : ({ button: "pushbutton", hcsr04: "hc-sr04" }[k] ? "src/assets/" + { button: "pushbutton", hcsr04: "hc-sr04" }[k] + ".svg" : "src/assets/" + k + ".svg");
  function s3Icon() {   // icon board vẽ từ chính footprint, như icon board của Pindexio
    const f = FP.S3, b = f.body;
    return `<svg viewBox="${b.x - 1} ${b.y - 1} ${b.w + 2} ${b.h + 2}" aria-hidden="true"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1.5" fill="#1c2230"/><rect x="${b.x + 5}" y="${b.y + 7}" width="${b.w - 10}" height="18" rx=".6" fill="#c4c8ce"/>${f.pads.map(p => `<circle cx="${p.x}" cy="${p.y}" r="1" fill="#e2c063"/>`).join("")}</svg>`;
  }
  function boardIconFor(id) {
    const b = SITE && window.BOARDS && BOARDS.find(x => x.id === id);
    if (!b) return s3Icon();
    const PCB_C = { green: ["#1b5e3a", "#3aa86b"], blue: ["#134b8a", "#3d8ce0"], black: ["#1b1e23", "#4c535f"], purple: ["#4a2273", "#8b52c9"], red: ["#8b1d1d", "#d94b4b"], white: ["#d6dce2", "#9aa3ad"] };
    const [fill, edge] = PCB_C[b.pcb] || PCB_C.black;
    const m = 2, vb = `${-m} ${-m} ${b.w + 2 * m} ${b.h + 2 * m}`, r = Math.max(b.w, b.h) / 40;
    const parts = (b.parts || []).filter(p => p.w && p.t !== "hole" && p.t !== "ant" && p.t !== "led").map(p =>
      `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${r}" fill="${["usb", "btn", "shield"].includes(p.t) ? "#c9cfd2" : p.t === "jack" ? "#111" : "#16191a"}"/>`).join("");
    const padsHtml = (b.headers || []).flatMap(hd => hd.pins || []).map(p => `<circle cx="${p.x}" cy="${p.y}" r="${Math.max(.7, r * 1.1)}" fill="#e2c063"/>`).join("");
    return `<svg viewBox="${vb}" aria-hidden="true"><rect width="${b.w}" height="${b.h}" rx="${r * 2}" fill="${fill}" stroke="${edge}" stroke-width="${r}"/>${parts}${padsHtml}</svg>`;
  }
  function list() {
    const cnt = {}; for (const c of S.comps) cnt[c.fp] = (cnt[c.fp] || 0) + 1;
    const w = wiring(), n = k => cnt[k] ? `×${cnt[k]}` : "";
    const rows = ks => ks.map(k => `<button type="button" class="mod-row" data-q="${(NAME[k] + " " + SHORT(k) + " " + k).toLowerCase().replace(/"/g, "")}" data-add="${k}" aria-pressed="${!!cnt[k]}" title="${L("Thêm", "Add")} ${NAME[k]}">${k === "motor" ? ICON_M : k === "R" ? ICON_R : k === "C" ? ICON_C : k.startsWith("pinHdr") ? ICON_H : FP[k] && FP[k].ecap ? ICON_E : FP[k] && FP[k].to220 ? ICON_Q : k === "to92" || (FP[k] && FP[k].to92) ? ICON_TO92 : FP[k] && FP[k].dip ? ICON_DIP : FP[k] && FP[k].term ? ICON_TERM : k === "smd_2512" ? smdIcon(k) : k === "button12" ? `<img src="${iconSrc("button")}" alt="" loading="lazy">` : k.startsWith("smd_") ? smdIcon(k) : `<img src="${iconSrc(k)}" alt="" loading="lazy">`}<span class="mr-name">${SHORT(k)}</span><span class="mr-if">${n(k)}</span></button>`).join("");
    const cats = CATS(), H = hostInfo();
    // chọn board (trong Pindexio): ESP32-S3 cắm thẳng lên bo, board khác nối dây Dupont qua hàng rào J1
    const pick = SITE && window.BOARDS ? `<select id="plMcu" class="pl-mcu" aria-label="Board">${BOARDS.filter(b => !b.mod && b.headers).map(b => `<option value="${b.id}"${b.id === S.mcu ? " selected" : ""}>${b.name}</option>`).join("")}</select>` : "";
    const fam = (SITE && window.BOARDS && (BOARDS.find(x => x.id === S.mcu) || {}).family) || "ESP32";
    const famCls = { ESP32: "esp", RP2: "rp", "Raspberry Pi": "rp", AVR: "avr" }[fam] || "esp";
    const card = H.s3 ? `<button type="button" class="board-card" data-add="S3" aria-pressed="${!!cnt.S3}" title="${NAME.S3}"><span class="bc-icon esp">${boardIconFor(S.mcu)}<b>S3</b></span><span class="bc-txt"><span class="bc-name">ESP32-S3-DevKitC-1</span><span class="bc-chip">${L("cắm thẳng lên bo · 3.3 V", "plugs into the PCB · 3.3 V")}</span></span></button>`
      : `<div class="board-card" aria-pressed="true" title="${L("Board nối với bo qua hàng rào header J1 (dây Dupont)", "Board wired to the PCB through header J1 (Dupont wires)")}"><span class="bc-icon ${famCls}">${boardIconFor(S.mcu)}<b>${H.tag}</b></span><span class="bc-txt"><span class="bc-name">${H.name}</span><span class="bc-chip">${FULL.has(S.mcu) ? L("cắm thẳng lên bo", "plugs into the PCB") : L("nối dây qua J1", "wired via J1")} · ${H.v5 ? "5 V" : "3.3 V"}</span></span></div>`;
    $("#plList").innerHTML = `${w ? `<button type="button" class="pl-wire" id="plWire" title="${L("Lấy module và chân đã nối ở tab ⚡ Wiring", "Take the modules and pins wired in the ⚡ Wiring tab")} (${H.name})">⚡ ${L("Lấy mạch từ Wiring", "Import from Wiring")} <span class="mods-n">${w.mods.length}</span></button>` : ""}
      ${pick}${card}
      <input id="plSearch" class="pl-search" type="search" placeholder="${L("Tìm linh kiện…", "Search parts…")}" aria-label="${L("Tìm linh kiện", "Search parts")}">
      ${PW_BLOCK}
      <div class="mods open"><div class="mods-h"><span>${STUDIO ? "" : "🧩 "}${L("Linh kiện", "Components")}</span><span class="mods-n">${cats.slice(1).reduce((s, c) => s + c[2].length, 0)}</span></div>
      <div class="mods-list">${cats.slice(1).map(([g, ic, ks]) => `<div class="mods-cat${(S.catClosed || []).includes(g) ? " closed" : ""}" data-g="${g}"><div class="mods-ch" title="${g}" role="button" tabindex="0"><span aria-hidden="true">${ic}</span> <span class="mc-t">${g}</span><i class="mc-c" aria-hidden="true">▾</i></div>${rows(ks)}</div>`).join("")}</div></div>
      <p class="pl-note">${L(`Bấm để thêm vào giữa khung. Nguồn, I2C, SPI tự nối vào ${H.name}.`, `Click to add at the centre. Power, I2C and SPI are wired to ${H.name} automatically.`)}</p>`;
    studioBlocks();   // PCB Maker cũng chia khối như Module PCB: Pinworld · Cơ bản · SMD · Linh kiện
    $$("[data-add]").forEach(b => b.onclick = () => cmd.add(b.dataset.add));
    $$("[data-add]").forEach(b => b.oncontextmenu = e => {   // chuột phải: thêm vào bo / bỏ khỏi "Linh kiện của tôi"
      e.preventDefault(); const k = b.dataset.add, old = ROOT.querySelector("#plListMenu"); if (old) old.remove();
      const m = document.createElement("div"); m.id = "plListMenu"; m.className = "pl-pop";
      const mine = k.startsWith("MY:"), used = S.comps.some(c => c.fp === k);
      m.innerHTML = `<button type="button" data-fm="add">+ ${L("Thêm vào bo", "Add to board")}</button>` + (mine ? `<button type="button" data-fm="drop">✕ ${L("Xoá khỏi Linh kiện của tôi", "Remove from My parts")}</button>` : "");
      m.style.cssText = `left:${Math.min(e.clientX, innerWidth - 250)}px;top:${e.clientY}px;width:240px`; ROOT.appendChild(m);
      onOutside(m, () => m.remove());
      m.querySelector('[data-fm="add"]').onclick = () => { m.remove(); cmd.add(k); };
      if (mine) m.querySelector('[data-fm="drop"]').onclick = () => {
        m.remove(); if (used) return toast(L("Linh kiện này đang dùng trên bo: xoá nó khỏi bo trước.", "This part is used on the board: delete it from the board first."));
        const o = myLib(); delete o.parts[k.slice(3)]; myPut(o); delete FP0[k]; loadMine(); list(); toast(L("Đã xoá khỏi Linh kiện của tôi.", "Removed from My parts."));
      };
    });
    // thu gọn / mở rộng từng nhóm (nhớ trạng thái); đang tìm kiếm thì nhóm có kết quả tự mở
    $$(".mods-ch").forEach(h => { const tg = () => { h.parentElement.classList.toggle("closed"); S.catClosed = [...$$(".mods-cat.closed")].map(x => x.dataset.g); save(); }; h.onclick = tg; h.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tg(); } }; });
    const sq = $("#plSearch"), filt = () => { const v = sq.value.trim().toLowerCase(); ui.q = v; $$(".mods-cat").forEach(c => { let any = false; c.querySelectorAll(".mod-row").forEach(x => { const hit = !v || x.dataset.q.includes(v); x.hidden = !hit; if (hit) any = true; }); c.hidden = !any; c.classList.toggle("sfind", !!v); }); };
    sq.oninput = () => { filt(); _pwInput(); }; sq.value = ui.q || ""; filt();
    pwList();
    if ($("#plMcu")) $("#plMcu").onchange = e => cmd.setBoard(e.target.value);
    if ($("#plWire")) $("#plWire").onclick = cmd.fromWiring;
  }

  /* ---------- PCB Studio: linh kiện Pinworld theo nhóm, bấm để nhập + đặt lên bo ---------- */
  let PWC = null, pwOpen = null;
  const PW_BLOCK = '<div class="mods open" id="plPw"><div class="mods-h"><span>Pinworld</span><span class="mods-n" id="plPwN"></span></div><div class="mods-list" id="plPwList" style="height:300px;min-height:80px;max-height:80vh;overflow:auto;resize:vertical;flex:none"></div></div>';
  const PW_IC = {"board":"core/breadboard/arduino_Uno_Rev3_breadboard.svg","shield":"core/breadboard/canbus_shield-v12_breadboard.svg","disp":"core/breadboard/sparkfun-displays_lcd-16x2_noholes_breadboard.svg","led":"core/breadboard/LED-5mm-red-leg.svg","sens":"core/breadboard/hc-sr04_bf8299a_002.svg","motor":"contrib/breadboard/Adafruit_Feedback_Servo__small___e29a0e3__breadboard__ba57dddc506c67533722bfe9f9c159ea_E0.svg","power":"core/breadboard/batterypack_4xAAA.svg","input":"core/breadboard/basic_pbutton.svg","conn":"core/breadboard/sparkfun-connectors_stereojack2.5mm_stereojack2.5mm_breadboard.svg","ic":"core/breadboard/555timerbreadboard.svg","other":"core/breadboard/halfBreadboard.svg"};   // ảnh đại diện từng nhóm (Fritzing, jsDelivr)
  const SKCSS_PROP = "\n.pcblab[data-studio] .pl-side{background:#1e1f22!important;border:1px solid #3f4248!important;border-radius:3px!important;padding:6px!important;color:#dcdedf;font-size:11.5px}\n.pcblab[data-studio] .pl-side .steps{margin:0 0 4px!important}\n.pcblab[data-studio] .pl-side .steps li{padding:4px 7px 4px 30px!important;margin-bottom:3px!important;border-radius:3px!important;background:#26282d!important;border:1px solid #3f4248;font:600 11px var(--sans)!important}\n.pcblab[data-studio] .pl-side .steps li::before{left:7px!important;top:5px!important;width:15px!important;height:15px!important;font:700 9.5px/15px var(--sans)!important}\n.pcblab[data-studio] .pl-side .steps li.now{box-shadow:none!important;border-color:var(--accent,#4c8bf5)}\n.pcblab[data-studio] .pl-side .steps small{font-size:10px!important;color:#9aa0a6!important}\n.pcblab[data-studio] .pl-side .stat{gap:3px!important;margin-bottom:4px}\n.pcblab[data-studio] .pl-side .stat div{padding:5px 4px!important;border-radius:3px!important;background:#26282d!important;border:1px solid #3f4248;font-size:10px!important}\n.pcblab[data-studio] .pl-side .stat div.red{background:rgba(255,51,51,.12)!important;border-color:#7a2e2e}\n.pcblab[data-studio] .pl-side .stat b{font-size:15px!important}\n.pcblab[data-studio] .pl-side .box{margin:0 0 4px!important;padding:0!important;border-radius:3px!important;background:#26282d!important;border:1px solid #3f4248!important;overflow:hidden}\n.pcblab[data-studio] .pl-side .box.warn{border-color:#e2ad00!important}\n.pcblab[data-studio] .pl-side .box>h4{margin:0!important;padding:4px 7px!important;background:#35373b;color:#e5e7eb!important;font:600 10.5px var(--sans)!important;letter-spacing:0!important;text-transform:none!important}\n.pcblab[data-studio] .pl-side .box>*:not(h4){margin:0!important;padding:5px 7px!important}\n.pcblab[data-studio] .pl-side .box .mut{font-size:11px!important;color:#9aa0a6!important}\n.pcblab[data-studio] .pl-side>h4{margin:4px 0 0!important;padding:4px 7px!important;background:#35373b;border:1px solid #3f4248;border-radius:3px 3px 0 0;color:#e5e7eb!important;font:600 10.5px var(--sans)!important;letter-spacing:0!important;text-transform:none!important}\n.pcblab[data-studio] .pl-side>h4+.bsz,.pcblab[data-studio] .pl-side>.bsz{background:#26282d;border:1px solid #3f4248;border-top:0;padding:5px 7px;font-size:11px!important;color:#dcdedf}\n.pcblab[data-studio] .pl-side .bszb{background:#26282d;border:1px solid #3f4248;border-top:0;border-radius:0 0 3px 3px;margin:0!important;padding:5px 7px!important;gap:3px!important}\n.pcblab[data-studio] .pl-side .bszb button{padding:3px 6px!important;border-radius:3px!important;background:#1e1f22!important;border-color:#3f4248!important;color:#dcdedf!important;font-size:10.5px!important}\n.pcblab[data-studio] .pl-side .bszb button:hover,.pcblab[data-studio] .pl-side .bszb button.on{border-color:var(--accent,#4c8bf5)!important}\n.pcblab[data-studio] .pl-side .tinfo{font-size:11px!important}\n.pcblab[data-studio] .pl-side .tinfo td{border-bottom:1px solid #31343a!important;padding:2px 3px!important}\n.pcblab[data-studio] .pl-side .tinfo td:first-child{color:#9aa0a6}\n.pcblab[data-studio] .pl-side input,.pcblab[data-studio] .pl-side select{background:#1e1f22!important;color:#e5e7eb!important;border:1px solid #3f4248!important;border-radius:2px!important;font-size:11px!important;padding:2px 4px!important}\n";
  const SKCSS = "\n.pcblab .pl-search{background:#1e1f22!important;color:#e5e7eb!important;border:1px solid #3f4248!important;border-radius:3px!important;font-size:11px!important;padding:4px 7px!important;margin-bottom:4px!important}\n.pcblab .pl-list>.mods{align-self:stretch!important;width:auto!important;min-width:0!important;box-sizing:border-box!important;border:1px solid #3f4248!important;border-radius:3px!important;background:#26282d!important;overflow:hidden!important;margin:0 0 4px!important}\n.pcblab .pl-list>.mods>.mods-h{padding:4px 7px!important;margin:0!important;background:#35373b!important;color:#e5e7eb!important;border:0!important;font-size:10.5px!important;font-weight:600!important;letter-spacing:0!important;text-transform:none!important;display:flex!important;justify-content:space-between!important;align-items:center!important;gap:6px}\n.pcblab .pl-list>.mods>.mods-h>span:first-child{flex:1}\n.pcblab .pl-list .mods-n{background:#1e1f22!important;color:#9aa0a6!important;padding:1px 5px!important;border-radius:6px!important;font-size:10px!important;font-weight:500!important}\n.pcblab .pl-list .mods-cat>.mods-ch{padding:3px 7px!important;margin:0!important;background:#2b2d31!important;color:#c3c7cc!important;border:0!important;border-top:1px solid #3f4248!important;border-radius:0!important;font-size:10.5px!important;font-weight:600!important;letter-spacing:0!important;text-transform:none!important}\n.pcblab .pl-list .mods-cat>.mods-ch>span[aria-hidden]:not(.gi){display:none!important}\n.pcblab .pl-list .mods-cat>.mods-ch small{color:#9aa0a6!important;font-size:10px!important}\n.pcblab .pl-list .mod-row{padding:3px 7px!important;border-radius:2px!important;font-size:11px!important;font-weight:500!important;color:#dcdedf!important}\n.pcblab .pl-list .mod-row:hover{background:rgba(255,255,255,.08)!important}\n";
  const pwCssLite = () => {   // PCB Maker: chỉ kiểu ô lưới của danh sách Pinworld
    if (document.getElementById("plPwCss")) return;
    const keep = ROOT.getAttribute("data-studio"), had = !!document.getElementById("plSkCss");
    pwCss(); if (keep == null) ROOT.removeAttribute("data-studio");

    if (!document.getElementById("plPwLite")) { const st = document.createElement("style"); st.id = "plPwLite"; st.textContent = "#plPw{margin-top:8px}#plPw .mods-ch .gi img{width:18px;height:18px;object-fit:contain;vertical-align:middle}"; document.head.appendChild(st); }
  };
  const pwCss = () => {
    if (!document.getElementById("plSkCss")) { const st = document.createElement("style"); st.id = "plSkCss"; st.textContent = SKCSS + SKCSS_PROP; document.head.appendChild(st); }
    ROOT.setAttribute("data-studio", "1");   // kiểu gọn như bảng Sketch Props
    if (!document.getElementById("plPwCss2")) { const st = document.createElement("style"); st.id = "plPwCss2"; st.textContent = "\n#plPw,#plBasic,#plSmd{display:block!important;flex:none;align-self:start;height:auto;margin:0 0 8px;border:1px solid var(--line,#2a323c);border-radius:8px;background:var(--surface,rgba(255,255,255,.02));overflow:hidden;font-family:var(--sans,system-ui,Segoe UI,sans-serif)}\n#plPw>.mods-h,#plBasic>.mods-h,#plSmd>.mods-h{padding:8px 10px;margin:0;border-bottom:1px solid var(--line,#2a323c);font-family:var(--sans,system-ui,Segoe UI,sans-serif);font-size:13px;font-weight:600;line-height:1.2;letter-spacing:0;text-transform:none;gap:8px}\n#plPw>.mods-h .mods-n{margin-left:auto;padding:1px 8px;border-radius:99px;background:var(--surface2,rgba(255,255,255,.08));font-family:var(--sans,system-ui,Segoe UI,sans-serif);font-size:11px;font-weight:600;opacity:.85}\n#plPw .mods-list,#plBasic .mods-list,#plSmd .mods-list{padding:4px}\n#plPw .mods-cat>.mods-ch,#plBasic .mods-cat>.mods-ch{display:flex;align-items:center;gap:8px;margin:0;padding:6px 8px;border-radius:6px;font-family:var(--sans,system-ui,Segoe UI,sans-serif);font-size:12.5px;font-weight:500;line-height:1.2;letter-spacing:0;text-transform:none;color:var(--fg,#dde3ea)}\n#plPw .mods-cat>.mods-ch:hover,#plBasic .mods-cat>.mods-ch:hover{background:var(--surface2,rgba(255,255,255,.07))}\n#plPw .mods-ch .gi{display:grid;place-items:center;flex:0 0 30px;height:24px;border-radius:5px;background:#fff;overflow:hidden;padding:1px}#plPw .mods-ch .gi img{max-width:100%;max-height:100%;object-fit:contain}\n#plPw .mods-ch .mc-t{flex:1;min-width:0;white-space:normal}\n#plPw .mods-ch small{font-family:var(--sans,system-ui,Segoe UI,sans-serif);font-size:11px;font-weight:500;opacity:.6}\n#plBasic .mods-cat>.mods-ch{display:none}\n#plBasic .mods-cat.closed .mod-row{display:flex!important}\n#plPw .mods-list{flex:none}\n@media (min-width:1100px){\n.pcblab .pl-list>.mods:not(#plPw):not(#plBasic):not(#plSmd){border:1px solid var(--line,#2a323c);border-radius:8px;background:var(--surface,rgba(255,255,255,.02));overflow:hidden}\n.pcblab .pl-list>.mods:not(#plPw):not(#plBasic):not(#plSmd)>.mods-h{padding:8px 10px;margin:0;border-bottom:1px solid var(--line,#2a323c);font-family:var(--sans,system-ui,Segoe UI,sans-serif);font-size:13px;font-weight:600;letter-spacing:0;text-transform:none}\n.pcblab .pl-list>.mods:not(#plPw):not(#plBasic):not(#plSmd) .mods-cat>.mods-ch{margin:8px 6px 2px;padding:4px 4px 2px;font-family:var(--sans,system-ui,Segoe UI,sans-serif);font-size:11.5px;font-weight:600;letter-spacing:.02em;text-transform:none;color:var(--muted,#9aa5b1);border-bottom:1px solid var(--line,#2a323c)}\n.pcblab .pl-list .mod-row{font-family:var(--sans,system-ui,Segoe UI,sans-serif);font-size:12.5px;font-weight:500;padding:5px 8px;border-radius:6px}\n}\n@media (min-width:1100px){.pcblab .pl-list{display:flex!important;flex-direction:column;gap:8px}.pcblab .pl-list>*{flex:none}}\n.pcblab .pl-list .mods>.mods-h{cursor:pointer;user-select:none}\n.pcblab .pl-list .mods>.mods-h .bc{margin-left:6px;font-style:normal;opacity:.7;transition:transform .15s}\n.pcblab .pl-list .mods.bclosed>.mods-h .bc{transform:rotate(-90deg)}\n.pcblab .pl-list .mods.bclosed>.mods-list{display:none}\n"; document.head.appendChild(st); }
    if (!document.getElementById("plPwCss")) { const st = document.createElement("style"); st.id = "plPwCss"; st.textContent = ".pcblab .pw-g{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px 0}.pcblab .pw-c{display:grid;grid-template-rows:62px auto;gap:3px;padding:4px;border:1px solid var(--line,#444);border-radius:6px;background:transparent;color:inherit;font:11px/1.2 inherit;text-align:center;cursor:pointer;min-width:0}.pcblab .pw-c:hover{border-color:var(--accent,#dc8e43)}.pcblab .pw-i{display:grid;place-items:center;background:#fff;border-radius:4px;overflow:hidden}.pcblab .pw-i img{max-width:100%;max-height:62px;object-fit:contain}.pcblab .pw-n{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}"; document.head.appendChild(st); }
  };
  const FZ = "https://cdn.jsdelivr.net/gh/fritzing/fritzing-parts@develop/svg/core/";
  const SMD_IMG = { smd_0402: "breadboard/sparkfun-passives_0402-cap_breadboard.svg", smd_0603: "breadboard/sparkfun-passives_0603-cap_breadboard.svg", smd_0805: "breadboard/sparkfun-passives_0805_breadboard.svg", smd_1206: "breadboard/sparkfun-passives_1206_breadboard.svg", smd_sot23: "pcb/SMD_SOT-23.svg", smd_soic8: "breadboard/SO08_breadboard.svg" };
  function studioBlocks() {   // Studio: tách "Cơ bản" và "SMD" thành mục riêng, ngay dưới Pinworld
    STUDIO ? pwCss() : pwCssLite();
    const anchor = $("#plPw"); if (!anchor) return;
    const mk = (id, title) => { const d = document.createElement("div"); d.className = "mods open"; d.id = id; d.innerHTML = `<div class="mods-h"><span>${title}</span></div><div class="mods-list"></div>`; return d; };
    const basic = mk("plBasic", L("Cơ bản", "Basics")), smd = mk("plSmd", "SMD");
    $$(".mods-cat").forEach(c => { const g = c.dataset.g; if (g === L("Cơ bản", "Basics") || g === L("Công suất", "Power")) basic.querySelector(".mods-list").appendChild(c); else if (g === L("SMD chuẩn", "Standard SMD")) smd.querySelector(".mods-list").appendChild(c); });
    // SMD: dùng dòng của nhóm "SMD chuẩn" (icon SVG như linh kiện khác)
    anchor.after(basic); basic.after(smd);
    const lst = $("#plList"), bd = document.createElement("div"); bd.id = "plBoardBox"; bd.className = "pl-boardbox";
    ["#plMcu", ".board-card"].forEach(q => { const e = lst.querySelector(q); if (e) bd.appendChild(e); });
    if (bd.children.length) lst.appendChild(bd);
    if (!STUDIO) { const cm = [...lst.querySelectorAll(":scope > .mods:not([id])")].pop(); if (cm) { cm.after(basic); basic.after(smd); smd.after(anchor); } }
    const closed = new Set(S.blkClosed || []);
    lst.querySelectorAll(":scope > .mods").forEach(b => {
      const h = b.querySelector(":scope > .mods-h"); if (!h) return;
      const key = (h.querySelector("span") || h).textContent.trim();
      if (!h.querySelector(".bc")) h.insertAdjacentHTML("beforeend", '<i class="bc" aria-hidden="true">▾</i>');
      b.classList.toggle("bclosed", closed.has(key));
      h.onclick = () => { b.classList.toggle("bclosed"); S.blkClosed = [...lst.querySelectorAll(":scope > .mods.bclosed")].map(x => (x.querySelector(".mods-h span") || x).textContent.trim()); save(); };
    });
  }
  async function pwList() {
    const box = $("#plPwList"); if (!box) return;
    if (STUDIO) pwCss(); else pwCssLite();
    if (!PWC) {
      box.innerHTML = `<p class="pl-note">${L("Đang tải…", "Loading…")}</p>`;
      try {
        if (!window.PINWORLD) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "js/pinworld.js?v=1794562000"; sc.onload = ok; sc.onerror = no; document.body.appendChild(sc); });
        PWC = await PINWORLD.catalog();
      } catch (e) { box.innerHTML = `<p class="pl-note">${L("Không tải được Pinworld.", "Could not load Pinworld.")}</p>`; return; }
      if (!$("#plPwList")) return;
    }
    const q = (ui.q || "").trim().toLowerCase(), seen = new Set(), g = {};
    PWC.parts.forEach((p, i) => {
      if (p[6] === "smd") return;
      const t = (p[0] + " " + (p[7] || "")).toLowerCase(); if (q && !t.includes(q)) return;
      const k = PWC.gkey(p); if (seen.has(k)) return; seen.add(k);
      (g[PWC.catOf(p)] = g[PWC.catOf(p)] || []).push(i);
    });
    $("#plPwN").textContent = Object.values(g).reduce((s, a) => s + a.length, 0);
    box.innerHTML = PWC.cats.filter(c => g[c[0]]).map(([id, nm]) => {
      const open = pwOpen === id || (q && q.length > 1), a = g[id];
      return `<div class="mods-cat${open ? "" : " closed"}" data-pg="${id}"><div class="mods-ch" role="button" tabindex="0"><span class="gi" aria-hidden="true"><img alt="" src="https://cdn.jsdelivr.net/gh/fritzing/fritzing-parts@develop/svg/${PW_IC[id] || PW_IC.other}" onerror="this.style.visibility='hidden'"></span><span class="mc-t">${nm}</span> <small>${a.length}</small><i class="mc-c" aria-hidden="true">▾</i></div>${open ? `<div class="pw-g">` + a.slice(0, 120).map(i => `<button type="button" class="pw-c" data-pw="${i}" title="${attr(PWC.parts[i][0])}"><span class="pw-i"><img loading="lazy" decoding="async" alt="" src="${attr(PWC.imgUrl(PWC.parts[i], "bb"))}" onerror="this.style.visibility='hidden'"></span><span class="pw-n">${attr(PWC.parts[i][0])}</span></button>`).join("") + `</div>` + (a.length > 120 ? `<p class="pl-note">+${a.length - 120}: ${L("gõ tên để lọc", "type a name to filter")}</p>` : "") : ""}</div>`;
    }).join("") || `<p class="pl-note">—</p>`;
    box.querySelectorAll(".mods-ch").forEach(h => h.onclick = () => { pwOpen = pwOpen === h.parentElement.dataset.pg ? null : h.parentElement.dataset.pg; pwList(); });
    box.querySelectorAll("[data-pw]").forEach(b => b.onclick = async () => {
      const p = PWC.parts[+b.dataset.pw]; b.disabled = true;
      try {
        const r = await PINWORLD.build(p), o = myLib();
        if (Object.keys(o.parts).length >= 60 && !o.parts[r.part.id]) return toast(L("Tối đa 60 linh kiện của tôi.", "Up to 60 My parts."));
        o.parts[r.part.id] = { ...r.part, verified: (o.parts[r.part.id] || {}).verified || false }; myPut(o); loadMine();
        if (window.APP && APP.regMine) APP.regMine();
        list(); cmd.add("MY:" + r.part.id);
      } catch (e) { toast(String(e.message || e)); } finally { b.disabled = false; }
    });
  }
  const _pwInput = () => { if ($("#plPwList") && PWC) pwList(); };

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
    const selJ = ui.sel && ui.sel.t === "j" ? S.jumpers.find(j => j.id === ui.sel.id) : null;
    const selCs = (ui.sel && ui.sel.t === "cs" && ui.cs) || (ui.tool === "cs" && ui.cs && ui.cs.fixed ? ui.cs : null);
    const allOk = !open.size && S.comps.length > 1, done = allOk && !bad, nj = S.jumpers.length;
    const help = HELP_HTML = L(`<li>Chọn bút như bút chì: <b>Line</b> (L) vẽ đường đồng, <b>Bút dây nhảy</b> (J) bấm 2 điểm, <b>Trim</b> (T) bấm 2 điểm trên đường để bỏ đoạn giữa rồi vẽ lại, <b>Chọn</b> (Esc) để kéo linh kiện.</li><li>Kéo <b>thân đường</b> để dời song song, kéo <b>ô vuông</b> để dời góc.</li><li>Chọn đoạn dây: <b>H</b> nắn ngang · <b>V</b> nắn dọc · <b>A</b> nắn 45°. <b>Đúp</b> lên dây thêm điểm neo, đúp lên ô vuông để xoá.</li><li>Kéo <b>linh kiện</b> để dời, <b>R</b> xoay.</li><li><b>Dây nhảy</b> (J): bấm điểm đầu rồi điểm cuối (chân, lỗ, đường hoặc chỗ trống). Đang vẽ đường nhấn <b>J</b> để đặt lỗ ở đầu bút rồi bắc dây nhảy. Nét <b>trắng</b> = dây nhảy / ký hiệu linh kiện.</li><li>Đường vẽ / sửa tay tự <b>khoá</b> 🔒: Tự đi dây giữ nguyên.</li><li><b>F</b> Fillet / <b>C</b> Chamfer: nối 2 dây thành góc (có / không vát). <b>M</b> Thước đo khoảng cách. <b>Check</b> so mạch với tab Wiring.</li><li><b>Dây nhảy</b>: bấm chân → rê ra chỗ trống → <b>J</b> → bấm lỗ thứ 2 → vẽ tiếp tới chân cần nối. Hàn dây trần (chân điện trở thừa, 0,5 mm) giữa 2 lỗ ở mặt linh kiện, nằm sát bo.</li><li><b>Sửa dây</b> (T F C E): Trim bấm 2 điểm bỏ đoạn giữa · Fillet / Chamfer hàn 2 dây (không / có vát 45°) · Extend kéo dài đầu dây tới đường / chân cùng mạng. Bấm nút lần nữa để tắt.</li><li>Nhấn giữ <b>Line</b>: độ rộng và góc vẽ. Nhấn giữ <b>Tự đi dây</b>: độ thoáng đường đồng. Nhấn giữ <b>Mass</b>: khe cách mass. Nút <b>Độ rộng</b>: bật rồi bấm từng đường để đổi.</li><li>Chân <b>tự nối</b> (tô cam) là app đoán theo tên chân (từ 50%): đối chiếu datasheet rồi bấm ✓ xác nhận hoặc ✕ bỏ nối. Linh kiện Fritzing chưa kiểm cần đo lại bằng Thước.</li><li><b>Layer</b> (nút cạnh File, như AutoCAD): basePCB · copper · jumper · paint_1, paint_2… Mỗi layer có tên, màu, nút ẩn / hiện, khoá, và ● đặt làm layer hiện hành (Draw vẽ vào đó). Thêm layer sơn mới, đổi sơn mặt trên / dưới. Layer ẩn hoặc khoá thì không sửa được.</li><li><b>Pen</b> (P): hàng đầu là ⬚ chọn · ✥ dời · ⟳ xoay · ✎ sửa (chữ, cỡ, nét, tô, layer) · 🗑 xoá hình đã vẽ; R xoay 90°. Vẽ tay, chữ, hình, icon vào layer hiện hành (<b>sơn</b> in lụa hoặc <b>copper</b> khắc, tránh chạm chân / đường khác). Chữ A–Z, 0–9 (bỏ dấu). Kéo để vẽ hình; ✥ để chọn và dời; Delete xoá.</li><li><b>Chọn nhiều</b>: Shift hoặc Ctrl + bấm để thêm / bớt, kéo trên nền để chọn bằng khung; Delete xoá tất cả, nút Độ rộng đổi độ rộng các đường đã chọn, Shift+L khoá. Giữ <b>Space</b> + kéo (hoặc chuột giữa) để dời khung nhìn.</li><li><b>Cưa</b> (W): cắt / mở rộng / khoét bo bằng đường thẳng (snap 15°), dùng được khi đã đi dây từ 60%; mass tự cập nhật.</li><li>Menu <b>File</b>: Lưu (Ctrl+S) · Lưu thành (Ctrl+Shift+S) · Mở (Ctrl+O) · Mở gần đây (5 dự án).</li><li><b>/</b> đổi tư thế 45° · <b>Esc</b> huỷ · <b>Ctrl+Z</b> hoàn tác.</li>`,
      `<li>Pick a pen like a pencil: <b>Line</b> (L) draws traces, <b>Jumper pen</b> (J) clicks 2 points, <b>Trim</b> (T) clicks 2 points on a trace to cut out the part between so you can redraw, <b>Select</b> (Esc) moves parts.</li><li>Drag a <b>trace body</b> to move it in parallel, drag a <b>square</b> to move a corner.</li><li>Select a segment: <b>H</b> horizontal · <b>V</b> vertical · <b>A</b> 45°. <b>Double-click</b> a trace to add a vertex, a square to delete it.</li><li>Drag a <b>part</b> to move it, <b>R</b> rotates.</li><li><b>Jumper</b> (J): click the start, then the end (pin, hole, trace or free spot). While drawing press <b>J</b> to drop a hole at the pen and bridge with a jumper. <b>White</b> lines = jumpers / part outlines.</li><li>Hand-drawn / edited traces are <b>locked</b> 🔒: Autoroute keeps them.</li><li><b>F</b> Fillet / <b>C</b> Chamfer: join 2 traces into a corner (sharp / bevelled). <b>M</b> Ruler measures distances. <b>Check</b> compares the circuit with the Wiring tab.</li><li><b>Jumpers</b>: click a pin → move to a free spot → <b>J</b> → click the 2nd hole → keep drawing to the target pin. Solder bare wire (spare resistor legs, 0.5 mm) between the holes on the component side, flat to the board.</li><li><b>Edit</b> (T F C E): Trim clicks 2 points to cut between · Fillet / Chamfer weld 2 traces (sharp / 45° bevel) · Extend runs a trace end to the nearest same-net trace or pin. Click the button again to turn it off.</li><li>Hold <b>Line</b>: width and angle. Hold <b>Autoroute</b>: trace spacing. Hold <b>Pour</b>: pour clearance. <b>Width</b> button: turn on, then click traces to change them.</li><li><b>Auto-wired</b> pins (orange) are guesses from pin names (50%+): compare with the datasheet, then ✓ confirm or ✕ unwire. Unchecked Fritzing parts need re-measuring with the Ruler.</li><li><b>Layers</b> (button next to File, like AutoCAD): basePCB · copper · jumper · paint_1, paint_2… Each layer has a name, colour, show / hide, lock and ● set current (Draw goes there). Add paint layers, switch paint top / bottom. Hidden or locked layers cannot be edited.</li><li><b>Pen</b> (P): the first row is ⬚ select · ✥ move · ⟳ rotate · ✎ edit (text, size, stroke, fill, layer) · 🗑 delete drawings; R rotates 90°. Freehand, text, shapes, icons into the current layer (<b>paint</b> silkscreen or <b>copper</b> etched, keep clear of other pins / traces). Text A–Z, 0–9. Drag to draw a shape; ✥ selects and moves; Delete removes.</li><li><b>Multi-select</b>: Shift or Ctrl + click to add / remove, drag on the background for a selection box; Delete removes all, the Width button changes the selected traces, Shift+L locks. Hold <b>Space</b> + drag (or middle mouse) to pan.</li><li><b>Saw</b> (W): cut / extend / punch the board with straight lines (15° snap), available once 60% of the connections are routed; the pour updates by itself.</li><li><b>File</b> menu: Save (Ctrl+S) · Save as (Ctrl+Shift+S) · Open (Ctrl+O) · Open recent (5 projects).</li><li><b>/</b> flips the 45° posture · <b>Esc</b> cancels · <b>Ctrl+Z</b> undo.</li>`);
    $("#plPanel").innerHTML = `<ol class="steps"><li class="${S.comps.length > 1 ? "ok" : "now"}">${L("Thêm & đặt linh kiện", "Add & place parts")}</li><li class="${allOk ? "ok" : "now"}">${L("Nối hết dây", "Route everything")}<small>${allOk ? L("xong", "done") : L("bấm Tự đi dây (A)", "press Autoroute (A)")}${nj ? L(` · ${nj} dây nhảy`, ` · ${nj} jumpers`) : ""}</small></li><li class="${done ? "ok" : bad ? "now" : ""}">${L("Không lỗi → Xuất file in", "No errors → Export")}<small>${bad ? L(`${bad} lỗi cần sửa`, `${bad} errors to fix`) : done ? L("sẵn sàng in", "ready to print") : "…"}</small></li></ol>
      ${pendBox()}
      <div class="stat"><div><b>${Object.keys(nets).length - open.size}</b>/${Object.keys(nets).length}<span>${L("mạng đã nối", "nets routed")}</span></div><div class="${bad ? "red" : ""}"><b>${bad}</b><span>${L("lỗi khoảng cách", "clearance errors")}</span></div><div><b>${S.traces.length}</b><span>${L("đường đồng", "traces")}</span></div></div>
      ${ui.sel && ui.sel.t === "m" && ui.ms ? `<div class="box"><h4>${L("Đang chọn nhiều đối tượng", "Multiple objects selected")}</h4><p>${[[ui.ms.t.length, L("đường đồng", "traces")], [ui.ms.c.length, L("linh kiện", "parts")], [ui.ms.j.length, L("dây nhảy", "jumpers")], [ui.ms.a.length, L("hình vẽ", "drawings")]].filter(x => x[0]).map(x => `<b>${x[0]}</b> ${x[1]}`).join(" · ")}</p><p class="mut">${L("Delete: xoá tất cả · nút Độ rộng: đổi độ rộng các đường · Shift+L: khoá / mở khoá · Shift / Ctrl + bấm: thêm bớt · bấm vùng trống: bỏ chọn", "Delete: remove all · Width button: change trace widths · Shift+L: lock / unlock · Shift / Ctrl + click: add / remove · click empty: clear")}</p></div>` : sel ? traceBoxHTML(sel) : selC ? compBoxHTML(selC) : selJ ? jumperBoxHTML(selJ) : selCs ? constructBoxHTML(selCs) : ""}
      ${A.rats.length && S.comps.length > 1 ? `<div class="box warn"><p>${L(`Còn <b>${A.rats.length}</b> chỗ chưa nối (nét gạch). Cách nối bằng dây nhảy: xem nút ?`, `<b>${A.rats.length}</b> connections still open (dashed). How to add jumpers: see the ? button.`)}</p>${S.routed && S.comps.length > 2 ? `<button type="button" class="pl-try" id="plTryLay" title="${L("Dời linh kiện và đi dây lại (Ctrl+Z để quay lại)", "Moves parts and re-routes (Ctrl+Z to undo)")}">🔁 ${L("Thử sắp xếp lại", "Try re-arranging")}</button>` : ""}</div>` : ""}
      ${S.jumpers.length ? `<div class="box"><h4>${L("Dây nhảy", "Jumpers")} (${S.jumpers.length})</h4><p class="mut">${L("Cần khoảng", "Wire needed ≈")} ${Math.round(S.jumpers.reduce((s, j) => s + Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) + 10, 0) / 10)} cm</p><div class="pinlist">${S.jumpers.map(j => { const len = Math.round(Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1]) + 10); return `<div><b>J${jNo(j)}</b> ${j.net} · ~${len} mm${j.pin ? L(" · hàn thẳng vào chân", " · soldered onto the pins") : ""}${len > 100 ? L(" ⚠ dài, tín hiệu nhanh có thể nhiễu", " ⚠ long, fast signals may pick up noise") : ""}</div>`; }).join("")}</div></div>` : ""}
      ${ui.check ? checkBox() : ""}
      ${S.hot && S.hot.length ? `<div class="box warn"><p>${L(`⚠ ${S.hot.join(", ")} chỉ chịu 3,3 V: tín hiệu từ ${hostInfo().name} (5 V) cần mạch chuyển mức hoặc chia áp.`, `⚠ ${S.hot.join(", ")} are 3.3 V only: signals from ${hostInfo().name} (5 V) need a level shifter or divider.`)}</p></div>` : ""}
      ${A.cross ? `<div class="box warn"><p>${L(`⚠ ${A.cross} chỗ dây nhảy trần bắc chéo nhau dễ chạm: uốn 1 dây cao lên hoặc kéo dời linh kiện cho thoáng.`, `⚠ ${A.cross} bare jumper crossings may touch: raise one wire or move parts apart.`)}</p></div>` : ""}

      <h4>${L("Khung bo", "Board size")}</h4><div class="bsz"><label>${L("Rộng", "W")} <input id="plBW" type="number" min="${BMIN}" max="${BMAX}" step="1" value="${S.board.w}"></label><span>×</span><label>${L("Cao", "H")} <input id="plBH" type="number" min="${BMIN}" max="${BMAX}" step="1" value="${S.board.h}"></label><span>mm</span></div>
      <div class="bszb">${[[50, 70], [70, 100], [100, 100], [100, 150]].map(([w, h]) => `<button type="button" data-bs="${w}x${h}"${S.board.w === w && S.board.h === h ? ' class="on"' : ""}>${w}×${h}</button>`).join("")}<button type="button" id="plFitB" title="${L("Đi dây xong: thu bo vừa khít linh kiện + đường đồng", "After routing: shrink the board to parts + traces")}">${L("Vừa khít mạch", "Fit to circuit")}</button><button type="button" id="plPack" title="${L("Xếp lại ESP32-S3 + module cho gọn, khung bo vừa đủ số linh kiện", "Re-arrange the ESP32-S3 and modules compactly; board sized to the part count")}">${L("Xếp gọn", "Pack")}</button></div>
      <label class="bchk"><input type="checkbox" id="plAutoB"${S.autoB ? " checked" : ""}> ${L("Tự co giãn theo linh kiện", "Auto-resize to parts")}</label>
      <h4>${L("Mạng", "Nets")}</h4><div class="nets">${Object.keys(nets).sort().map(n => `<button type="button" data-net="${n}" class="${open.has(n) ? "open" : "ok"}${ui.hlNet === n ? " on" : ""}">${open.has(n) ? "○" : "✓"} ${n}</button>`).join("")}</div>
      ${bad ? `<h4>${L("Lỗi", "Errors")}</h4><div class="errs">${A.drc.slice(0, 8).map(v => `<div>⛔ ${v.s ? v.s.t.net : ""} ${v.msg}${v.u ? L(" với ", " vs ") + v.u.t.net : v.pad ? " " + v.pad.c.id + "·" + v.pad.name : ""}</div>`).join("")}${bad > 8 ? `<div>${L(`… và ${bad - 8} lỗi nữa`, `… and ${bad - 8} more`)}</div>` : ""}</div>` : ""}`;
    $$("[data-net]").forEach(b => b.onclick = () => { ui.hlNet = ui.hlNet === b.dataset.net ? null : b.dataset.net; ui.sel = null; render(); });
    $$("[data-pin]").forEach(s => s.onchange = () => cmd.setNet(selC.id, s.dataset.pin, s.value));
    $$(".pins input.pin-nm").forEach(inp => {   // đổi tên chân ngay trong Properties (cùng logic với nhấp đúp)
      inp.onkeydown = ev => { if (ev.key === "Enter") inp.blur(); else if (ev.key === "Escape") { inp.value = inp.defaultValue; inp.blur(); } ev.stopPropagation(); };
      inp.onchange = () => {
        const c = selC, f = FP[c.fp], idx = +inp.dataset.pni, defNm = f.pads[idx].name;
        const oldNm = (c.pinNames && c.pinNames[idx]) || defNm, val = inp.value.trim() || defNm;
        if (val === oldNm) return;
        if (f.pads.some((p, j) => j !== idx && ((c.pinNames && c.pinNames[j]) || p.name) === val)) { inp.value = oldNm; return toast(L(`Tên "${val}" đã có ở chân khác.`, `Name "${val}" is already used.`)); }
        checkpoint();
        const next = f.pads.map((p, j) => (c.pinNames && c.pinNames[j]) || p.name); next[idx] = val;
        if (c.nets && c.nets[oldNm] !== undefined && c.nets[val] === undefined) { c.nets[val] = c.nets[oldNm]; delete c.nets[oldNm]; }
        if (next.some((n, j) => n !== f.pads[j].name)) c.pinNames = next; else delete c.pinNames;
        render(); panel();
      };
    });
    $$("[data-bs]").forEach(b => b.onclick = () => { const [w, h] = b.dataset.bs.split("x"); S.autoB = false; cmd.boardSize(w, h); render(); });
    $("#plPack").onclick = cmd.pack; if ($("#plTryLay")) $("#plTryLay").onclick = cmd.tryLayouts; $("#plAutoB").onchange = cmd.autoBoard;
    $("#plBW").onchange = $("#plBH").onchange = () => { S.autoB = false; cmd.boardSize($("#plBW").value, $("#plBH").value); render(); };
    $("#plFitB").onclick = cmd.fitBoard;
    $$("[data-chkx]").forEach(b => b.onclick = () => b.dataset.chkx !== "" && showSpot(+b.dataset.chkx, +b.dataset.chky));

    $$("[data-pgo]").forEach(b => b.onclick = () => { const [id, pin] = b.dataset.pgo.split("|"), p = pads().find(q => q.c.id === id && q.name === pin); if (p) showSpot(p.x, p.y); });
    $$("[data-pok]").forEach(b => b.onclick = () => cmd.confirmAuto(...b.dataset.pok.split("|")));
    $$("[data-pno]").forEach(b => b.onclick = () => cmd.dropAuto(...b.dataset.pno.split("|")));
    if ($("#plPendAll")) $("#plPendAll").onclick = cmd.confirmAll;
    if ($("#plVerMine")) $("#plVerMine").onclick = () => toggleVerified(selC.fp);
    if ($("#plEditMine")) $("#plEditMine").onclick = () => editMine(selC.fp);
    if ($("#plVal")) $("#plVal").onchange = e => { checkpoint(); selC.val = e.target.value.trim(); render(); };
    if ($("#plName")) $("#plName").onchange = e => { checkpoint(); const v = e.target.value.trim(); if (v) selC.lbl = v; else delete selC.lbl; render(); };
    if ($("#plPinCount")) $("#plPinCount").onchange = e => cmd.setPinHdrProps(selC, { nPins: +e.target.value });
    if ($("#plPinPitch")) $("#plPinPitch").onchange = e => cmd.setPinHdrProps(selC, { pitch: +e.target.value });
    if ($("#plPinRows")) $("#plPinRows").onchange = e => cmd.setPinHdrProps(selC, { rows: +e.target.value });
    if ($("#plPinRowGap")) $("#plPinRowGap").onchange = e => cmd.setPinHdrProps(selC, { rowGap: +e.target.value });
    if ($("#plPinPadD")) $("#plPinPadD").onchange = e => cmd.setPinHdrProps(selC, { padD: +e.target.value });
    if ($("#plPinSq")) $("#plPinSq").onchange = e => cmd.setPinHdrProps(selC, { sq: e.target.checked });
    if ($("#plPinRot180")) $("#plPinRot180").onchange = e => cmd.setPinHdrProps(selC, { rot180: e.target.checked });
    if ($("#plPinNoHole")) $("#plPinNoHole").onchange = e => cmd.setPinHdrProps(selC, { noHole: e.target.checked });
        if (selCs) {
      const csInp = $("#plCsLen"), csInc = $("#plCsInc"), csDec = $("#plCsDec");
      const csD = $("#plCsModeD"), csX = $("#plCsModeX"), csY = $("#plCsModeY");
      const csSwap = $("#plCsSwap"), csDel = $("#plCsDel");
      if (csInp) csInp.onchange = () => cmd.setConstructLineLength(selCs, +csInp.value, selCs.mode || "d");
      if (csInc) csInc.onclick = () => {
        const curL = (selCs.mode === "x" ? Math.abs(selCs.b[0] - selCs.a[0]) : selCs.mode === "y" ? Math.abs(selCs.b[1] - selCs.a[1]) : Math.hypot(selCs.b[0] - selCs.a[0], selCs.b[1] - selCs.a[1]));
        cmd.setConstructLineLength(selCs, Math.round((curL + 0.5) * 100) / 100, selCs.mode || "d");
      };
      if (csDec) csDec.onclick = () => {
        const curL = (selCs.mode === "x" ? Math.abs(selCs.b[0] - selCs.a[0]) : selCs.mode === "y" ? Math.abs(selCs.b[1] - selCs.a[1]) : Math.hypot(selCs.b[0] - selCs.a[0], selCs.b[1] - selCs.a[1]));
        cmd.setConstructLineLength(selCs, Math.max(0, Math.round((curL - 0.5) * 100) / 100), selCs.mode || "d");
      };
      if (csD) csD.onclick = () => { selCs.mode = "d"; renderCsPop(); drawCs(); panel(); };
      if (csX) csX.onclick = () => { selCs.mode = "x"; renderCsPop(); drawCs(); panel(); };
      if (csY) csY.onclick = () => { selCs.mode = "y"; renderCsPop(); drawCs(); panel(); };
      if (csSwap) csSwap.onclick = () => {
        const tmpPt = selCs.a; selCs.a = selCs.b; selCs.b = tmpPt;
        const tmpT = selCs.targetA; selCs.targetA = selCs.targetB; selCs.targetB = tmpT;
        renderCsPop(); drawCs(); panel();
      };
      if (csDel) csDel.onclick = () => {
        ui.cs = null; if (LY.cs) LY.cs.innerHTML = "";
        renderCsPop(); if (ui.sel && ui.sel.t === "cs") ui.sel = null; panel();
      };
    }
    if (selJ) {
      const jInp = $("#plJLen"), jInc = $("#plJInc"), jDec = $("#plJDec");
      if (jInp) jInp.onchange = () => cmd.setJumperLength(selJ, +jInp.value);
      if (jInc) jInc.onclick = () => cmd.setJumperLength(selJ, Math.round((Math.hypot(selJ.b[0] - selJ.a[0], selJ.b[1] - selJ.a[1]) + 0.5) * 10) / 10);
      if (jDec) jDec.onclick = () => cmd.setJumperLength(selJ, Math.max(1, Math.round((Math.hypot(selJ.b[0] - selJ.a[0], selJ.b[1] - selJ.a[1]) - 0.5) * 10) / 10));
    }
    $("#plRats").classList.toggle("on", S.rats); $("#plFlip").classList.toggle("on", !!S.flip); $("#plPour").classList.toggle("on", !!S.pour);
    if ($("#plSnap")) $("#plSnap").classList.toggle("on", S.snapG !== false); if ($("#cmSnap")) $("#cmSnap").checked = S.snapG !== false;
    { const sb = $("#plTsaw"); if (sb) sb.classList.toggle("dis", !sawOK()); }
    syncWidthSlider(); syncPenW();
    $("#plUndo").disabled = !undo.length; $("#plRedo").disabled = !redo.length;
    $$("[data-add]").forEach(b => { const c = S.comps.filter(x => x.fp === b.dataset.add).length, t = b.querySelector(".mr-if"); b.setAttribute("aria-pressed", !!c); if (t) t.textContent = c ? "×" + c : ""; });
  }
  // ô linh kiện đang chọn: chọn mạng cho từng chân (nguồn, GPIO của ESP32-S3, hoặc mạng riêng nối qua R / C)
  // tên một chân / lỗ để hiện cho người dùng
  const padLab = p => p.jw ? `J${jNo(p.jw)}${p.i ? "b" : "a"} (${L("dây nhảy", "jumper")})` : p.hole ? L("lỗ dây nhảy", "jumper hole") : `${p.c.lbl || p.c.id} · ${p.name}`;
  const mm1 = v => (Math.round(v * 10) / 10).toString().replace(".", L(",", ".")) + " mm";
  function traceBoxHTML(sel) {   // đường đang chọn: mạng, nối chân nào, độ dài, độ rộng; nhấp đúp = cả chuỗi: tổng dài, số đoạn
    const ids = ui.sel && ui.sel.ids && ui.sel.ids.length > 1 ? ui.sel.ids : null, ts = ids ? S.traces.filter(t => ids.includes(t.id)) : [sel], P = pads();
    const len = t => t.pts.reduce((a, p, i) => i ? a + Math.hypot(p[0] - t.pts[i - 1][0], p[1] - t.pts[i - 1][1]) : 0, 0);
    const total = ts.reduce((a, t) => a + len(t), 0), segs = ts.reduce((a, t) => a + t.pts.length - 1, 0), ws = [...new Set(ts.map(traceW))].sort((a, b) => a - b);
    const ends = [], seen = new Set(); let open = 0;
    for (const t of ts) for (const e of [t.pts[0], t.pts[t.pts.length - 1]]) {
      const p = P.find(q => Math.hypot(q.x - e[0], q.y - e[1]) < .15);
      if (p) { const k = padLab(p); if (!seen.has(k)) { seen.add(k); ends.push(k); } continue; }
      const joined = S.traces.some(u => u !== t && u.net === t.net && u.pts.some((q, k) => k && segDist(e[0], e[1], u.pts[k - 1][0], u.pts[k - 1][1], q[0], q[1]) < .05));
      if (!joined) open++;
    }
    const k = !ids && ui.sel && ui.sel.k != null && sel.pts[ui.sel.k + 1] ? Math.hypot(sel.pts[ui.sel.k + 1][0] - sel.pts[ui.sel.k][0], sel.pts[ui.sel.k + 1][1] - sel.pts[ui.sel.k][1]) : null;
    const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
    return `<div class="box"><h4>${ids ? L(`Chuỗi ${ts.length} đường đang chọn`, `Selected chain of ${ts.length} traces`) : L("Đường đang chọn", "Selected trace")}</h4><table class="tinfo">
      ${row(L("Mạng", "Net"), `<b>${isFree(sel.net) ? L("(chưa gán mạng)", "(no net)") : attr(sel.net)}</b>`)}
      ${row(L("Nối", "Connects"), ends.length ? ends.map(attr).join(" ↔ ") : L("chưa chạm chân nào", "no pin yet"))}
      ${open ? row(L("Đầu hở", "Open ends"), `<span class="warnc">${open}</span>`) : ""}
      ${row(ids ? L("Tổng dài", "Total length") : L("Độ dài", "Length"), `<b>${mm1(total)}</b>${k != null ? ` · ${L("đoạn chọn", "segment")} ${mm1(k)}` : ""}`)}
      ${row(L("Số đoạn", "Segments"), segs + (ids ? ` · ${ts.length} ${L("đường", "traces")}` : ""))}
      ${row(L("Độ rộng", "Width"), ws.map(mm1).join(" – "))}
      ${row(L("Trạng thái", "State"), ts.every(t => t.lock) ? L("🔒 đã khoá (tự vẽ / đã sửa)", "🔒 locked (hand-drawn / edited)") : ts.some(t => t.lock) ? L("một phần đã khoá", "partly locked") : L("tự động", "auto"))}
      </table></div>`;
  }
  function constructBoxHTML(cs) {
    const a = cs.a, b = cs.b;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const mode = cs.mode || "d";
    const curL = mode === "x" ? Math.abs(dx) : mode === "y" ? Math.abs(dy) : Math.hypot(dx, dy);
    const lenVal = (Math.round(curL * 100) / 100).toFixed(2);
    const nameOf = (tgt, pt) => {
      if (!tgt) return `(${r3(pt[0])}, ${r3(pt[1])})`;
      if (tgt.comp) return `<b>${tgt.comp.lbl || tgt.comp.id}</b>${tgt.pad ? " · " + tgt.pad.name : ""}`;
      if (tgt.hole) return `<b>${L("Lỗ khoan", "Hole")}</b>`;
      if (tgt.trace) return `<b>${L("Đường line", "Trace")}</b>`;
      if (tgt.art) return `<b>${L("Hình vẽ/Paint", "Paint art")}</b>`;
      if (tgt.type === "boardEdge") return `<b>${L("Mép bo mạch", "Board edge")}</b>`;
      return `(${r3(pt[0])}, ${r3(pt[1])})`;
    };
    const row = (lbl, val) => `<tr><td>${lbl}</td><td>${val}</td></tr>`;
    return `<div class="box"><h4>📐 ${L("Đường gióng định vị", "Construct Line")}</h4><table class="tinfo">
      ${row(L("Mốc cố định (A)", "Anchor (A)"), nameOf(cs.targetA, a))}
      ${row(L("Mục tiêu đẩy (B)", "Target (B)"), nameOf(cs.targetB, b))}
      ${row(L("Cự ly", "Distance"), `<div style="display:inline-flex;align-items:center;gap:4px">
        <button type="button" class="num-btn" id="plCsDec" style="width:22px;height:22px;padding:0;background:var(--surface2,#232a35);border:1px solid var(--line,#384050);border-radius:4px;cursor:pointer;color:inherit;font-weight:700" title="-0.5 mm">▼</button>
        <input id="plCsLen" type="number" min="0" max="500" step="0.5" value="${lenVal}" style="width:65px;height:22px;text-align:center;font-weight:700;font-family:var(--mono);border:1px solid var(--line,#384050);border-radius:4px;background:var(--surface2,#232a35);color:inherit">
        <button type="button" class="num-btn" id="plCsInc" style="width:22px;height:22px;padding:0;background:var(--surface2,#232a35);border:1px solid var(--line,#384050);border-radius:4px;cursor:pointer;color:inherit;font-weight:700" title="+0.5 mm">▲</button>
        <span>mm</span>
      </div>`)}
      ${row(L("Phương gióng", "Direction"), `<div style="display:inline-flex;gap:4px">
        <button type="button" class="jp-mode-btn ${mode === 'd' ? 'on' : ''}" id="plCsModeD" style="padding:2px 7px;font-size:11px;cursor:pointer" title="${L('Thẳng', 'Direct')}">${L('Thẳng', 'Direct')}</button>
        <button type="button" class="jp-mode-btn ${mode === 'x' ? 'on' : ''}" id="plCsModeX" style="padding:2px 7px;font-size:11px;cursor:pointer" title="${L('Ngang', 'Horiz')}">⬌ X</button>
        <button type="button" class="jp-mode-btn ${mode === 'y' ? 'on' : ''}" id="plCsModeY" style="padding:2px 7px;font-size:11px;cursor:pointer" title="${L('Dọc', 'Vert')}">⬍ Y</button>
      </div>`)}
    </table>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button type="button" class="tb" id="plCsSwap" style="flex:1;justify-content:center;height:28px" title="${L('Đảo mốc A thành đối tượng đẩy, B thành mốc cố định', 'Swap fixed anchor and target')}">⇄ ${L("Đổi mốc (A ↔ B)", "Swap (A ↔ B)")}</button>
      <button type="button" class="tb" id="plCsDel" style="width:36px;justify-content:center;height:28px;color:#f87171" title="${L('Xoá đường gióng', 'Delete construct line')}">✕</button>
    </div>
    </div>`;
  }
  function jumperBoxHTML(j) {
    const P = pads(), l0 = Math.hypot(j.b[0] - j.a[0], j.b[1] - j.a[1]), lenVal = (Math.round(l0 * 10) / 10).toFixed(1);
    const endName = pt => {
      const p = P.find(q => !q.jw && Math.hypot(q.x - pt[0], q.y - pt[1]) < 0.15);
      if (p) return padLab(p);
      const t = S.traces.find(u => u.pts.some(q => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < 0.15));
      if (t) return `${L("Đường", "Trace")} ${t.net}`;
      return `${L("Lỗ tự do", "Free hole")} (${Math.round(pt[0])}, ${Math.round(pt[1])})`;
    };
    const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
    return `<div class="box"><h4>J${jNo(j)} · ${L("Dây nhảy", "Jumper")}</h4><table class="tinfo">
      ${row(L("Mạng", "Net"), `<b>${isFree(j.net) ? L("(chưa gán mạng)", "(no net)") : attr(j.net)}</b>`)}
      ${row(L("Nối", "Connects"), `<b>${endName(j.a)}</b> ↔ <b>${endName(j.b)}</b>`)}
      ${row(L("Độ dài", "Length"), `<div style="display:inline-flex;align-items:center;gap:4px">
        <button type="button" class="num-btn" id="plJDec" style="width:22px;height:22px;padding:0;background:var(--surface2,#232a35);border:1px solid var(--line,#384050);border-radius:4px;cursor:pointer;color:inherit;font-weight:700" title="-0.5 mm">▼</button>
        <input id="plJLen" type="number" min="1" max="150" step="0.5" value="${lenVal}" style="width:60px;height:22px;text-align:center;font-weight:700;font-family:var(--mono);border:1px solid var(--line,#384050);border-radius:4px;background:var(--surface2,#232a35);color:inherit">
        <button type="button" class="num-btn" id="plJInc" style="width:22px;height:22px;padding:0;background:var(--surface2,#232a35);border:1px solid var(--line,#384050);border-radius:4px;cursor:pointer;color:inherit;font-weight:700" title="+0.5 mm">▲</button>
        <span>mm</span>
      </div>`)}
      ${row(L("Góc", "Angle"), `${Math.round(Math.atan2(j.b[1] - j.a[1], j.b[0] - j.a[0]) * 180 / Math.PI)}°`)}
      ${row(L("Kiểu", "Type"), j.auto ? L("Tự động (AutoRoute)", "Auto (AutoRoute)") : L("Vẽ / sửa tay", "Manual / edited"))}
    </table></div>`;
  }
  // chân của linh kiện đang chọn: đã nối với chân nào · chưa nối · nối sai / nghi ngờ (theo Kiểm PCB)
  function pinStatusHTML(c) {
    const P = A.P, mine = P.map((p, i) => [p, i]).filter(([p]) => p.c === c), host = isHost(c);
    let rep = null; try { rep = xreport(); } catch (e) { }
    const issues = rep && rep.items ? rep.items.filter(i => i.c === c.id) : [];
    const rows = [], done = new Set();
    for (const [p, i] of mine) {
      if (done.has(p.name)) continue; done.add(p.name);
      if (!p.net) { if (!host) rows.push([p.name, "nc", L("chưa dùng", "unused")]); continue; }
      const g = A.find("p" + i), same = P.map((q, k) => [q, k]).filter(([q, k]) => k !== i && q.net === p.net && q.c !== c);
      const linked = same.filter(([, k]) => A.find("p" + k) === g).map(([q]) => padLab(q)), miss = same.filter(([, k]) => A.find("p" + k) !== g).map(([q]) => padLab(q));
      const bad = issues.find(x => x.pin === p.name && x.sev === "red"), warn = issues.find(x => x.pin === p.name && x.sev === "orange");
      const st = bad ? "bad" : miss.length ? "open" : warn ? "warn" : "ok";
      const txt = (linked.length ? "→ " + [...new Set(linked)].slice(0, 3).join(", ") + (linked.length > 3 ? "…" : "") : "")
        + (miss.length ? ` <span class="warnc">${L("chưa nối tới", "not yet to")} ${[...new Set(miss)].slice(0, 2).join(", ")}${miss.length > 2 ? "…" : ""}</span>` : "")
        + (bad ? ` <span class="badc">⛔ ${attr(bad.msg)}</span>` : warn ? ` <span class="warnc">⚠ ${attr(warn.msg)}</span>` : "");
      rows.push([p.name, st, `<b>${attr(p.net)}</b> ${txt || L("(chỉ chân này)", "(only this pin)")}`]);
    }
    if (!rows.length) return "";
    const n = k => rows.filter(x => x[1] === k).length, ico = { ok: "✓", open: "○", bad: "⛔", warn: "⚠", nc: "·" };
    return `<h4 class="pst-h">${L("Trạng thái chân", "Pin status")} <small>✓ ${n("ok")} · ○ ${n("open")} · ⛔ ${n("bad")}${n("warn") ? " · ⚠ " + n("warn") : ""}</small></h4><div class="pst">${rows.map(([nm, st, t]) => `<div class="ps-${st}"><span>${ico[st]} ${attr(nm)}</span><span>${t}</span></div>`).join("")}</div>`;
  }
  function compBoxHTML(c) {
    const f = FP[c.fp], head = `<h4>${c.id} · ${NAME[c.fp]}</h4>`, foot = `<p class="mut">${L("Xoay", "Rotation")} ${c.rot}° · R</p>`;
    if (isHost(c)) {
      const who = {}; for (const m of S.comps) for (const k in m.nets || {}) { const v = m.nets[k]; if (isSig(v)) (who[v] = who[v] || []).push(m.id + "." + k); }
      const rows = Object.keys(who).sort((a, b) => a.slice(2) - b.slice(2)).map(io => `<div><b>${io}</b> → ${who[io].join(", ")}</div>`).join("");
      return `<div class="box">${head}<div class="pinlist">${rows || `<div>${L("Chưa có module nào nối vào chân IO.", "No module is wired to an IO pin yet.")}</div>`}</div>${pinStatusHTML(c)}${foot}</div>`;
    }
    const s3 = S.comps.some(isHost), H = hostInfo(), who = {};
    for (const m of S.comps) for (const k in m.nets || {}) if (m.nets[k] && m !== c) (who[m.nets[k]] = who[m.nets[k]] || []).push(m.id + "." + k);
    const custom = [...usedNets()].filter(n => !PWR.has(n) && !isSig(n)).sort();
    const opt = (v, cur, txt) => `<option value="${v}"${v === cur ? " selected" : ""}>${txt || v}</option>`;
    const io = (n, cur) => opt(n, cur, n + (H.risky.includes(n) ? " ⚠" : "") + (who[n] ? " · " + who[n].join(", ") : ""));
    const sel = (pin, cur) => `<select data-pin="${pin}">${opt("", cur || "", L("— không nối —", "— not connected —"))}<optgroup label="${L("Nguồn", "Power")}">${["GND", "3V3", "5V"].map(n => opt(n, cur)).join("")}</optgroup>`
      + (s3 ? `<optgroup label="${L("Chân ", "Pins of ") + H.name}">${[...H.pref, ...H.risky].map(n => io(n, cur)).join("")}</optgroup>` : "")
      + `<optgroup label="${L("Mạng riêng (qua R, C…)", "Private nets (via R, C…)")}">${custom.map(n => opt(n, cur, n + (who[n] ? " · " + who[n].join(", ") : ""))).join("")}${opt("+", "", L("＋ Mạng mới", "＋ New net"))}</optgroup></select>`;
    const names = [...new Set(f.pads.map((p, i) => (c.pinNames && c.pinNames[i]) || p.name))];
    const isPH = c.fp.startsWith("pinHdr");
    return `<div class="box">${head}${mineBox(f)}<label class="pv">${L("Tên", "Name")} <input id="plName" value="${c.lbl || ""}" placeholder="${c.id}"></label>${f.val ? `<label class="pv">${L("Giá trị", "Value")} <input id="plVal" value="${c.val || ""}"></label>` : ""}${isPH ? `<div class="ph-props" style="display:flex;flex-direction:column;gap:4px;margin:4px 0 6px;padding:6px 8px;border:1px solid var(--line,#333);border-radius:6px">
      <label class="pv">${L("Số chân", "Pin count")} <input id="plPinCount" type="number" min="1" max="40" value="${f.nPins || 3}"></label>
      <label class="pv">${L("Bước (mm)", "Pitch (mm)")} <input id="plPinPitch" type="number" min="0.8" max="25.4" step="0.01" value="${f.pitch || G}"></label>
      <label class="pv">${L("Số hàng", "Rows")} <input id="plPinRows" type="number" min="1" max="10" step="1" list="plRowsList" value="${f.rows || 1}"><datalist id="plRowsList"><option value="1"></option><option value="2"></option></datalist></label>
      ${f.rows > 1 ? `<label class="pv">${L("Cách hàng (inch)", "Row gap (inch)")} <input id="plPinRowGap" type="number" min="0.1" max="6" step="0.1" value="${f.rowGapIn || .7}" title="${(f.rowGapIn || .7) * 25.4} mm"></label>` : ""}
      <label class="pv">${L("ĐK (mm)", "Pad dia (mm)")} <input id="plPinPadD" type="number" min="0.8" max="8" step="0.1" value="${f.padD || (2 * PAD_R)}"></label>
      <label class="pv" style="justify-content:space-between;cursor:pointer"><span>${L("Pad vuông", "Square pad")}</span><input id="plPinSq" type="checkbox"${f.padSq ? " checked" : ""} style="width:auto"></label>
      <label class="pv" style="justify-content:space-between;cursor:pointer"><span>${L("Xoay 180°", "Rotate 180°")}</span><input id="plPinRot180" type="checkbox"${c.rot === 180 ? " checked" : ""} style="width:auto"></label>
      <label class="pv" style="justify-content:space-between;cursor:pointer"><span>${L("SMD (không lỗ)", "SMD (no hole)")}</span><input id="plPinNoHole" type="checkbox"${f.noHole ? " checked" : ""} style="width:auto"></label>
    </div>` : ""}
      <div class="pins">${names.length === f.pads.length
        ? f.pads.map((p, i) => { const n = (c.pinNames && c.pinNames[i]) || p.name; return `<label><input class="pin-nm" data-pni="${i}" value="${attr(n)}" placeholder="${attr(p.name)}" title="${L("Đổi tên chân (Enter để lưu)", "Rename pin (Enter to save)")}">${sel(n, (c.nets || {})[n])}</label>`; }).join("")
        : names.map(n => `<label><span>${n}</span>${sel(n, (c.nets || {})[n])}</label>`).join("")}</div>${pinStatusHTML(c)}${TIP[c.fp] ? `<p class="mut">💡 ${TIP[c.fp]}</p>` : ""}${foot}</div>`;
  }
  // Sơ đồ khối & Bảng Netlist (kiểm tra sơ đồ nguyên lý + soi mạng trên PCB)
  function openSchematicModal() {
    const old = document.querySelector(".pl-sch-bg"); if (old) { old.remove(); return; }
    analyze();
    const hesc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const PAL = ["#0284c7", "#0d9488", "#16a34a", "#ca8a04", "#9333ea", "#db2777", "#2563eb", "#059669", "#d97706", "#7c3aed"];
    const netColMap = new Map(); let ci = 0;
    const isGndNet = n => /^GND$/i.test(n || "");
    const isPwrNet = n => /^(5V|3V3|3\.3V|VCC|VDD|VIN|VBUS|VBAT|VOUT)$/i.test(n || "");
    const netCol = n => {
      if (!n) return "#64748b";
      if (isGndNet(n)) return "#64748b";
      if (/^(5V|VBUS|VIN|VBAT|VCC_?5V)$/i.test(n)) return "#dc2626";
      if (/^(3V3|3\.3V|VCC|VDD|VOUT)$/i.test(n)) return "#ea580c";
      if (/SDA/i.test(n)) return "#0284c7";
      if (/SCL/i.test(n)) return "#eab308";
      if (!netColMap.has(n)) netColMap.set(n, PAL[ci++ % PAL.length]);
      return netColMap.get(n);
    };
    const ratsSet = new Set(A.rats.map(r => r.net));
    const netsMap = new Map();
    const comps = (S.comps || []).filter(c => FP[c.fp]);
    const compPins = new Map();
    const unconnComps = [];
    for (const c of comps) {
      const f = FP[c.fp], ps = [];
      let hasNet = false;
      (f.pads || []).forEach((p, i) => {
        const pn = (c.pinNames && c.pinNames[i]) || p.name;
        const padObj = A.P.find(q => q.c === c && q.i === i);
        const net = (padObj && padObj.net) || (c.nets && c.nets[pn]) || "";
        if (net) {
          hasNet = true;
          if (!netsMap.has(net)) netsMap.set(net, []);
          netsMap.get(net).push({ c, id: c.id, pin: pn, net });
        }
        ps.push({ i, name: pn, net });
      });
      compPins.set(c.id, ps);
      if (!hasNet) unconnComps.push(c.id);
    }
    const sortedNets = [...netsMap.entries()].sort((a, b) => {
      const pa = (isPwrNet(a[0]) || isGndNet(a[0])) ? 0 : 1, pb = (isPwrNet(b[0]) || isGndNet(b[0])) ? 0 : 1;
      return pa !== pb ? pa - pb : a[0].localeCompare(b[0]);
    });
    const singleNets = sortedNets.filter(([, arr]) => arr.length < 2).map(([n]) => n);
    let activeNet = ui.hlNet || null, viewMode = "both";

    // Vẽ sơ đồ nguyên lý kiểu KiCad (giống bản xuất của tab Wiring): giấy trắng, hộp kem, cờ nguồn/GND, nối ngang thẳng
    const buildSvg = () => {
      const INK = "#1e293b", MUTED = "#64748b", FILL = "#fdf9e7";
      if (!comps.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="160" viewBox="0 0 520 160" style="background:#fff;border-radius:10px"><text x="260" y="84" text-anchor="middle" fill="${MUTED}" font-family="sans-serif" font-size="14">${hesc(L("Chưa có linh kiện nào trên bo PCB", "No components on the PCB yet"))}</text></svg>`;
      // Tìm khối trung tâm (board host hoặc IC nhiều chân nhất)
      let hub = comps.find(c => isHost(c)) || null;
      if (!hub && comps.length >= 2) {
        const cand = [...comps].sort((a, b) => compPins.get(b.id).length - compPins.get(a.id).length)[0];
        if (compPins.get(cand.id).length >= 4) hub = cand;
      }
      const hubNets = new Map();
      if (hub) for (const p of compPins.get(hub.id)) if (p.net && !hubNets.has(p.net)) hubNets.set(p.net, p.name);

      const others = comps.filter(c => c !== hub);
      const RH = 23, HD = 28, GAP = 24, MW = 148, DW = 158, LINK = 128;
      const pinListOf = c => {
        const ps = compPins.get(c.id);
        return ps.length > 14 ? ps.filter(p => p.net) : ps;
      };
      const items = others.map(c => {
        const ps = pinListOf(c);
        return { c, f: FP[c.fp], ps, h: HD + Math.max(1, ps.length) * RH + 10 };
      });
      // Chia 2 bên trái / phải cho cân (nếu có hub ở giữa)
      const side = { L: [], R: [] }, hgt = { L: 0, R: 0 };
      for (const it of items) {
        const s = (items.length > 1 && hgt.L <= hgt.R) ? "L" : "R";
        side[s].push(it); hgt[s] += it.h + GAP;
      }
      const hasL = side.L.length > 0, hasR = side.R.length > 0;
      const padX = 28, padY = 26;
      const mx = hub ? padX + (hasL ? DW + LINK : 0) : padX;
      const W = hub
        ? mx + MW + (hasR ? LINK + DW : 0) + padX
        : padX * 2 + (hasL ? DW : 0) + (hasR ? LINK + DW : 0);
      const H = Math.max(180, padY * 2 + Math.max(hgt.L, hgt.R, 80));

      const drawPwrFlag = (din, py, dir, net) => {
        const col = netCol(net), dim = activeNet && activeNet !== net ? 0.2 : 1;
        const sx = din - dir * 26;
        let g = `<g opacity="${dim}" data-snet="${hesc(net)}" style="cursor:pointer">`;
        g += `<line x1="${din}" y1="${py}" x2="${sx}" y2="${py}" stroke="${col}" stroke-width="1.8"/>`;
        if (isGndNet(net)) {
          for (const [o, l] of [[0, 7], [4, 4.5], [8, 2]]) {
            g += `<line x1="${sx - dir * o}" y1="${py - l}" x2="${sx - dir * o}" y2="${py + l}" stroke="${INK}" stroke-width="1.6"/>`;
          }
          g += `<text x="${sx - dir * 13}" y="${py + 4}" text-anchor="${dir > 0 ? "end" : "start"}" fill="${INK}" font-family="sans-serif" font-size="11" font-weight="700">GND</text>`;
        } else {
          g += `<line x1="${sx}" y1="${py - 7}" x2="${sx}" y2="${py + 7}" stroke="${INK}" stroke-width="1.8"/>`;
          g += `<text x="${sx - dir * 5}" y="${py + 4}" text-anchor="${dir > 0 ? "end" : "start"}" fill="${INK}" font-family="sans-serif" font-size="11" font-weight="700">${hesc(net)}</text>`;
        }
        return g + `</g>`;
      };

      const drawNoConn = (din, py, dir) => {
        const c = din - dir * 11;
        return `<g stroke="${MUTED}" stroke-width="1.4"><line x1="${din}" y1="${py}" x2="${c}" y2="${py}"/><line x1="${c - 3.5}" y1="${py - 3.5}" x2="${c + 3.5}" y2="${py + 3.5}"/><line x1="${c + 3.5}" y1="${py - 3.5}" x2="${c - 3.5}" y2="${py + 3.5}"/></g>`;
      };

      let svg = "";
      // Vẽ khối trung tâm (Hub / MCU / IC chính)
      if (hub) {
        const mt = padY, mh = H - padY * 2;
        const hf = FP[hub.fp], hTitle = (hub.val || hf.name || hub.fp).slice(0, 22);
        svg += `<rect x="${mx}" y="${mt}" width="${MW}" height="${mh}" fill="${FILL}" stroke="${INK}" stroke-width="1.6"/>`;
        svg += `<text x="${mx + MW / 2}" y="${mt + 18}" text-anchor="middle" fill="${INK}" font-family="sans-serif" font-size="12.5" font-weight="700">${hesc(hTitle)}</text>`;
        svg += `<text x="${mx + MW / 2}" y="${mt + mh - 10}" text-anchor="middle" fill="${MUTED}" font-family="sans-serif" font-size="11">${hesc(hub.id)}</text>`;
      }

      // Lưu toạ độ các chân tín hiệu không nối trực tiếp vào Hub để vẽ dây liên kết giữa các khối con
      const peerPorts = new Map();
      for (const s of ["L", "R"]) {
        let y = padY + (hub ? 14 : 0);
        const dir = s === "R" ? 1 : -1;
        const edge = hub ? (s === "R" ? mx + MW : mx) : (s === "R" ? padX + DW + LINK : padX + DW);
        const xd = hub
          ? (s === "R" ? edge + LINK : edge - LINK - DW)
          : (s === "R" ? padX + DW + LINK : padX);
        const din = s === "R" ? xd : xd + DW;

        for (const { c, f, ps, h } of side[s]) {
          const title = (c.val ? `${f.name || c.fp} (${c.val})` : (f.name || c.fp)).slice(0, 20);
          svg += `<rect x="${xd}" y="${y}" width="${DW}" height="${h - 6}" fill="${FILL}" stroke="${INK}" stroke-width="1.6"/>`;
          svg += `<text x="${xd + DW / 2}" y="${y + 16}" text-anchor="middle" fill="${INK}" font-family="sans-serif" font-size="12" font-weight="700">${hesc(title)}</text>`;
          svg += `<text x="${s === "R" ? xd + DW - 6 : xd + 6}" y="${y + 15}" text-anchor="${s === "R" ? "end" : "start"}" fill="${MUTED}" font-family="sans-serif" font-size="10.5">${hesc(c.id)}</text>`;

          ps.forEach((p, k) => {
            const py = y + HD + k * RH + RH / 2, net = p.net;
            svg += `<text x="${din + dir * 8}" y="${py + 4}" text-anchor="${s === "R" ? "start" : "end"}" fill="${INK}" font-family="Consolas,ui-monospace,monospace" font-size="11.5">${hesc(p.name)}</text>`;
            if (!net) { svg += drawNoConn(din, py, dir); return; }
            if (isGndNet(net) || isPwrNet(net)) { svg += drawPwrFlag(din, py, dir, net); return; }

            const col = netCol(net), isAct = activeNet === net, dim = activeNet && !isAct ? 0.18 : 1;
            const dash = ratsSet.has(net) ? ' stroke-dasharray="5 3"' : "";
            const sw = isAct ? 3.2 : 2;
            if (hub && hubNets.has(net)) {
              // Nối ngang thẳng tắp vào khối trung tâm (giống hệt KiCad Wiring export)
              const hPin = hubNets.get(net);
              svg += `<g opacity="${dim}" data-snet="${hesc(net)}" style="cursor:pointer">`
                + `<line x1="${edge}" y1="${py}" x2="${din}" y2="${py}" stroke="${col}" stroke-width="${sw}"${dash}/>`
                + `<circle cx="${edge}" cy="${py}" r="2.8" fill="${INK}"/>`
                + `<text x="${edge - dir * 7}" y="${py + 4}" text-anchor="${s === "R" ? "end" : "start"}" fill="${INK}" font-family="Consolas,ui-monospace,monospace" font-size="11.5" font-weight="700">${hesc(hPin)}</text>`
                + `</g>`;
            } else {
              // Mạng nối giữa các linh kiện con (không đi qua Hub): vẽ cờ nhãn mạng gọn + lưu để nối dây
              const stub = din - dir * 24;
              svg += `<g opacity="${dim}" data-snet="${hesc(net)}" style="cursor:pointer">`
                + `<line x1="${din}" y1="${py}" x2="${stub}" y2="${py}" stroke="${col}" stroke-width="${sw}"${dash}/>`
                + `<circle cx="${stub}" cy="${py}" r="2.4" fill="${col}"/>`
                + `<text x="${stub - dir * 5}" y="${py + 3.5}" text-anchor="${s === "R" ? "end" : "start"}" fill="${col}" font-family="Consolas,ui-monospace,monospace" font-size="10.5" font-weight="700">${hesc(net)}</text>`
                + `</g>`;
              if (!peerPorts.has(net)) peerPorts.set(net, []);
              peerPorts.get(net).push({ x: stub, y: py, s, dir });
            }
          });
          y += h + GAP;
        }
      }

      // Nếu không có Hub (mạch Module PCB độc lập): nối trực tiếp các cặp peerPorts ở 2 cột L <-> R
      if (!hub) {
        let lane = 0;
        for (const [net, pts] of peerPorts.entries()) {
          if (pts.length < 2) continue;
          const col = netCol(net), isAct = activeNet === net, dim = activeNet && !isAct ? 0.15 : 0.85;
          const sw = isAct ? 3 : 1.7, dash = ratsSet.has(net) ? ' stroke-dasharray="5 3"' : "";
          const midX = padX + DW + 36 + (lane++ % 7) * 9;
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const d = `M${a.x},${a.y} L${midX},${a.y} L${midX},${b.y} L${b.x},${b.y}`;
            svg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" opacity="${dim}"${dash} data-snet="${hesc(net)}" style="cursor:pointer"/>`;
          }
        }
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#ffffff;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.08)">${svg}</svg>`;
    };

    const bg = document.createElement("div"); bg.className = "pl-sch-bg";
    bg.innerHTML = `<div class="pl-sch-box" role="dialog" aria-modal="true">
      <div class="pl-sch-hd">
        <h3>📐 ${L("Sơ đồ khối & Netlist", "Block Schematic & Netlist")}</h3>
        <div class="pl-sch-tabs">
          <button type="button" data-vm="both" class="on">${L("Cả hai", "Split")}</button>
          <button type="button" data-vm="sch">${L("Sơ đồ khối", "Schematic")}</button>
          <button type="button" data-vm="net">Netlist (${sortedNets.length})</button>
        </div>
        <div class="pl-sch-act">
          <button type="button" id="schPcbHi" style="display:none">👁 ${L("Soi trên PCB", "View on PCB")}</button>
          <button type="button" id="schDl">⬇ SVG</button>
          <button type="button" id="schClose">✕</button>
        </div>
      </div>
      <div class="pl-sch-body" id="schBody">
        <div class="pl-sch-canvas" id="schCanvas"></div>
        <div class="pl-sch-side" id="schSide"></div>
      </div>
    </div>`;
    document.body.appendChild(bg);

    const drawModal = () => {
      const body = bg.querySelector("#schBody"), cv = bg.querySelector("#schCanvas"), sd = bg.querySelector("#schSide");
      body.className = "pl-sch-body" + (viewMode === "net" ? " net-only" : viewMode === "sch" ? " sch-only" : "");
      cv.style.display = viewMode === "net" ? "none" : "";
      sd.style.display = viewMode === "sch" ? "none" : "";
      cv.innerHTML = buildSvg();
      const warns = [];
      if (A.rats.length) warns.push(`⚠ ${L("Còn", "Remaining")} <b>${A.rats.length}</b> ${L("dây chưa đi xong", "unrouted wires")} (${[...ratsSet].map(hesc).join(", ")})`);
      if (singleNets.length) warns.push(`⚠ ${L("Mạng chỉ có 1 chân (hở/sai tên?)", "Single-pin nets (open/typo?)")}: <b>${singleNets.map(hesc).join(", ")}</b>`);
      if (unconnComps.length) warns.push(`⚠ ${L("Linh kiện chưa nối mạng nào", "Unconnected parts")}: <b>${unconnComps.map(hesc).join(", ")}</b>`);
      let sideHtml = warns.length
        ? `<div class="pl-sch-erc">${warns.join("<br>")}</div>`
        : `<div class="pl-sch-erc ok">✓ ${L("Tất cả mạng đều kín, không có chân hở.", "All nets connected, no open pins.")}</div>`;
      if (!sortedNets.length) sideHtml += `<p style="color:var(--muted);font-size:12.5px">${L("Chưa có mạng nối dây nào.", "No nets defined yet.")}</p>`;
      for (const [net, pins] of sortedNets) {
        const isOpen = ratsSet.has(net), isOne = pins.length < 2;
        const badge = isOne ? `<span class="pl-sch-badge warn">${L("1 chân", "1 pin")}</span>` : isOpen ? `<span class="pl-sch-badge warn">${L("Còn hở", "Open")}</span>` : `<span class="pl-sch-badge ok">✓ OK</span>`;
        sideHtml += `<div class="pl-sch-net${activeNet === net ? " on" : ""}" data-snet="${hesc(net)}">
          <div class="pl-sch-net-top"><i class="pl-sch-dot" style="background:${netCol(net)}"></i><span>${hesc(net)}</span>${badge}</div>
          <div class="pl-sch-pins">${pins.map(p => `<span>${hesc(p.id)}.${hesc(p.pin)}</span>`).join("")}</div>
        </div>`;
      }
      sd.innerHTML = sideHtml;
      bg.querySelector("#schPcbHi").style.display = activeNet ? "" : "none";
      bg.querySelectorAll("[data-snet]").forEach(el => {
        const n = el.dataset.snet; if (!n) return;
        el.onclick = ev => {
          ev.stopPropagation();
          activeNet = activeNet === n ? null : n;
          ui.hlNet = activeNet; render();
          drawModal();
        };
      });
    };
    bg.querySelectorAll("[data-vm]").forEach(b => b.onclick = () => {
      viewMode = b.dataset.vm;
      bg.querySelectorAll("[data-vm]").forEach(x => x.classList.toggle("on", x === b));
      drawModal();
    });
    bg.querySelector("#schDl").onclick = () => {
      const svgText = buildSvg();
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pindexio-schematic.svg"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    };
    const close = () => { bg.remove(); document.removeEventListener("keydown", onEsc); };
    const onEsc = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onEsc);
    bg.querySelector("#schClose").onclick = close;
    bg.querySelector("#schPcbHi").onclick = () => { close(); toast(L("Đang soi mạng: ", "Highlighting net: ") + activeNet); };
    bg.onclick = e => { if (e.target === bg) close(); };
    drawModal();
  }
  // menu thả của nút Tự đi dây: "Tự đi lại khi sửa linh kiện" mặc định tắt (nhẹ máy, người dùng tự bấm)
  function tools() {
    const ic = { ph: '<rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/>', snap: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke-dasharray="2 1.5"/><circle cx="12" cy="12" r="3.2"/>', tsaw: '<rect x="14" y="2.5" width="8" height="5" rx="1" transform="rotate(45 18 5)"/><path d="M14.5 9.5L3.5 20.5M6.5 17.5l-2.5-.5M9.5 14.5l-2.5-.5M12.5 11.5l-2.5-.5"/>', space: '<path d="M4 5v14M20 5v14"/><path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2"/>', draw: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M13 8l3 3"/><path d="M3 22c3-1 5 1 8 0"/>', edit: '<path d="M3 21l1.6-4.6 3 3z"/><path d="M6.5 17.5L14 10"/><path d="M12 8l4-4 4 4-4 4z"/><path d="M19 14l2 2M21 11h1M15 18v2" stroke-width="1.6"/>', wid: '<path d="M4 6h16" stroke-width="1"/><path d="M4 12h16" stroke-width="2.5"/><path d="M4 19h16" stroke-width="4.5"/>', tms: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    comp: '<rect x="7" y="8.5" width="10" height="7" rx="1.5"/><path d="M2 12h5M17 12h5M10 8.5v7M14 8.5v7"/>', newb: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 9v6M9 12h6"/>', tcs: '<path d="M4 6v12M20 6v12M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"/>', check: '<path d="M4 12l5 5L20 6"/>', sch: '<rect x="2" y="3" width="8" height="6" rx="1.2"/><rect x="14" y="3" width="8" height="6" rx="1.2"/><rect x="8" y="15" width="8" height="6" rx="1.2"/><path d="M6 9v3h12V9M12 12v3"/>', tsel: '<path d="M6 3l12 9-5.5 1.2L15 20l-2.5 1-2.6-6.6L6 18z"/>', tcu: '<path d="M3 19l7-11 4 6 7-10" stroke-width="3.2"/>', tsk: '<path d="M4 18l5-10 6 4 5-8" stroke-width="1.8"/><circle cx="4" cy="18" r="1.8"/><circle cx="9" cy="8" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="20" cy="4" r="1.8"/>', ttr: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9"/><path d="M14.5 14.5L20 20"/><path d="M8.1 8.1L12 12"/>', ter: '<path d="M9 20h11"/><path d="M4 15l9-9 6 6-8 8H8z"/><path d="M9 10l6 6"/>', ttf: '<path d="M4 17h11V6"/><path d="M15 17h5M15 6V2" stroke-dasharray="2 2" opacity=".55"/><circle cx="15" cy="17" r="2"/>', ttc: '<path d="M4 18h7l7-7V4"/><path d="M11 18h7v-7" stroke-dasharray="2 2" opacity=".55"/><circle cx="11" cy="18" r="1.7"/><circle cx="18" cy="11" r="1.7"/>', wire: '<path d="M4 19c4-1 3-8 8-8s4-7 8-8"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="3" r="1.6"/>', hole: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>', pour: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12l8-8M4 20L20 4M12 20l8-8"/>', dl: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>', jump: '<circle cx="5" cy="18" r="2.6"/><circle cx="19" cy="6" r="2.6"/><path d="M7 16.2L17 7.8"/>', flip: '<path d="M12 3v18"/><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>', undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>', redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>', rot: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>', del: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', auto: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/>', scheme: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', clear: '<path d="M4 4l16 16M20 4L4 20"/>', fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', rats: '<path d="M4 18L20 6" stroke-dasharray="3 3"/>', ratEdit: '<path d="M4 18L15 7" stroke-dasharray="2.5 2"/><circle cx="4" cy="18" r="1.8"/><circle cx="15" cy="7" r="1.8"/><path d="M14 19l5-5 2 2-5 5-3 1z"/>', zin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M11 8v6M8 11h6"/>', zout: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M8 11h6"/>', reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>', unwire: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>', re: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>', arr: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>', fitB: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2"/><path d="M8 8h8v8H8z"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3"/>', full: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>' };
    // chữ dưới icon: 1–2 từ; tên đầy đủ + giải thích nằm ở title (rê chuột)
    const SHORT = { plSnap: "Snap", plWidth: L("Độ rộng", "Width"), plTjw: STUDIO ? "Jumper pad" : L("Dây nhảy", "Jumper"), plTcs: L("Dim", "Dim"), plAuto: "AutoRoute", plUnwire: L("Gỡ dây", "Unwire"), plClear: L("Xoá hết", "Clear"), plZin: L("Phóng", "Zoom +"), plZout: L("Thu", "Zoom −"),
      plRatEdit: "Edit", plFit: L("Vừa", "Fit"), plFlip: L("Lật", "Flip"), plUndo: L("Hoàn tác", "Undo"), plRedo: L("Làm lại", "Redo"), plArr: L("Sắp xếp", "Arrange"), plReset: L("Làm mới", "Reset"), plPour: L("Mass", "Pour") };
    const b = (id, i, t, tip, ico) => `<button type="button" class="tb${ico ? " ico" : ""}" id="${id}" title="${!t || !tip || tip.startsWith(t) ? tip || t : t + " – " + tip}"><svg viewBox="0 0 24 24">${ic[i]}</svg><span>${SHORT[id] || t}</span></button>`;
    const sep = '<span class="sep"></span>';
    // trong Pindexio: cùng nhóm chế độ với tab Wiring (Nối dây | Breadboard | Mạch in PCB) để chuyển qua lại 1 chạm
    const modes = SITE && window.APP && APP.toWiring ? `<span class="pl-modes" role="group" aria-label="${L("Chế độ", "Mode")}"><button type="button" class="tb" data-mode="wire">🔌 <span>${L("Nối dây", "Wiring")}</span></button><button type="button" class="tb" data-mode="bb">▦ <span>Breadboard</span></button><button type="button" class="tb on" aria-pressed="true">🖨 <span>PCB Maker <sup class="beta">beta</sup></span></button></span>` + sep : "";
    const fileBtn = `<button type="button" class="tb pl-file" id="plFile" data-popbtn aria-haspopup="menu" title="${L("Lưu / Mở dự án (.pdi)", "Save / Open project (.pdi)")}"><span>File</span> <i aria-hidden="true">▾</i></button>`;
    const layerBtn = `<button type="button" class="tb pl-file pl-layers" id="plLayers" data-popbtn aria-haspopup="menu" title="${L("Layer: ẩn / hiện, khoá, màu, layer hiện hành", "Layers: show / hide, lock, colour, current layer")}"></button>`;
    $("#plBar").innerHTML = modes + fileBtn + layerBtn + sep
      + b("plUndo", "undo", L("Hoàn tác", "Undo"), "Ctrl+Z", 1) + b("plRedo", "redo", L("Làm lại", "Redo"), "Ctrl+Shift+Z", 1) + sep
      + b("plFlip", "flip", L("Lật mặt", "Flip"), L("Xem mặt trước / mặt sau (V)", "Front / back view (V)")) + b("plRats", "rats", L("Dây bay", "Ratsnest"), L("Bật / tắt dây bay", "Show / hide ratsnest"), 1) + b("plRatEdit", "ratEdit", L("Sửa dây bay", "Edit ratsnest"), TOOLS().rat[1]).replace("<button ", '<button data-tool="rat" ') + b("plSnap", "snap", "Snap", L("Bật / tắt bắt dính điểm neo & đường gióng ảo (S / F4)", "Toggle vertex & smart alignment guides snap (S / F4)")) + `<button type="button" class="tb${S.unit === "in" ? " on" : ""}" id="plUnit" title="${L("Chuyển hệ thước mm / inch", "Toggle ruler unit mm / inch")}"><svg viewBox="0 0 24 24"><path d="M3 8h18v8H3zM7 8v4M11 8v3M15 8v4M19 8v3"/></svg><span class="sl">${S.unit === "in" ? "in" : "mm"}</span></button>`
      + `<button type="button" class="tb${gridStep() < 2 ? " on" : ""}" id="plGrid" title="${L("Chuyển bước lưới & snap 1,27 mm / 2,54 mm", "Toggle grid & snap 1.27 mm / 2.54 mm")}"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/></svg><span class="sl">${gridStep() < 2 ? "1.27" : "2.54"}</span></button>` + b("plWidth", "wid", L("Độ rộng dây", "Trace width"), L("Độ rộng dây: bấm để bật, chọn mức rồi bấm từng đường để đổi; bấm lại để tắt", "Trace width: click to turn on, pick a width, then click traces to change them; click again to turn off"), 1)
      + `<label class="alpha" title="${L("Board thật: độ rõ hình board thật", "Real boards: picture opacity")}">◐ <input type="range" id="plAlpha" min="0" max="100" step="5" value="${Math.round(S.alpha * 100)}"></label>` + sep
      + b("plZin", "zin", L("Phóng to", "Zoom in"), "", 1) + b("plZout", "zout", L("Thu nhỏ", "Zoom out"), "", 1) + b("plFit", "fit", L("Vừa khung", "Fit view"), "0 / Home") + sep
      + b("plArr", "arr", L("Sắp xếp", "Arrange"), L("Sắp xếp: tự bố trí linh kiện (bấm lần nữa đổi kiểu: gọn / rộng / dọc)", "Arrange: auto-place parts (click again for another layout: compact / wide / tall)"))
      + b("plFitBoard", "fitB", L("Auto resize to parts", "Auto resize to parts"), L("Auto resize to parts: co / giãn khung PCB vừa khít các linh kiện hiện có", "Auto resize to parts: resize PCB outline to fit current parts"), 1)
      + b("plReset", "reset", L("Làm mới", "Reset"), L("Làm mới: xoá hết, chỉ để lại board", "Reset: clear everything except the board"))
      + b("plTms", "tms", L("Thước", "Ruler"), TOOLS().ms[1]).replace("<button ", '<button data-tool="ms" ')
      + b("plCheck", "check", L("Kiểm", "Check"), L("Kiểm: so PCB với tab Wiring và datasheet, chỉ ra chỗ khác hoặc nghi ngờ (chỉ báo, không tự sửa)", "Check: compare the PCB with the Wiring tab and datasheets, point out differences and doubts (report only, no auto-fix)"), 1) + b("plSch", "sch", L("Sơ đồ", "Schematic"), L("Sơ đồ khối & Bảng Netlist: kiểm tra nối chân, chân hở và soi mạng trên PCB", "Block Schematic & Netlist: inspect pin connections, open nets, and highlight on PCB"))
      + `<span style="flex:1"></span><button type="button" class="tb pl-helpbtn" id="plHelpBtn" data-popbtn title="${L("Cách dùng", "How to use")}" aria-label="${L("Cách dùng", "How to use")}">?</button>` + (window.navigator.standalone ? "" : b("plFull", "full", L("Tràn viền", "Fullscreen"), L("Toàn màn hình / tràn viền", "Toggle fullscreen"), 1)) + b("plExport", "dl", "Export", L("Xuất mặt đồng, ký hiệu, mặt linh kiện (SVG / PNG 1:1) hoặc Gerber cho xưởng", "Export copper, silkscreen, component side (1:1 SVG / PNG) or Gerber for fabs"));
    // Fill / Chamfer không nằm trên thanh dọc: nút ◂ cạnh Pen mở menu xổ bên trái (thu / mở, nhớ trạng thái)
    const WELD = ["tr", "tf", "tc", "ex"];
    const DIMB = b("plTcs", "tcs", L("Dim", "Dim"), TOOLS().cs[1]).replace("<button ", '<button data-tool="cs" ');
    $("#plVbar").innerHTML = (STUDIO ? b("plNewBoard", "newb", L("Tạo PCB", "New PCB"), L("Tạo hình & kích thước bo PCB (Chữ nhật / Tròn / Đa giác)", "Create PCB shape & size (Rect / Circle / Polygon)")) : "") + (STUDIO ? "" : b("plAuto", "auto", "AutoRoute", L("AutoRoute: bấm để tự đi dây ngay và mở bảng chọn kiểu (Vuông góc / Kiểu 45° / Ngắn nhất), độ thoáng, độ rộng dây. Phím A = đi dây ngay.", "AutoRoute: click to route immediately and open options (90° / 45° / Shortest, spacing, width). A = route now."))) + `<div class="pl-tools">${Object.entries(TOOLS()).filter(([k]) => ![...WELD, "ms", "cs", "sk", "rat", "pt"].includes(k) || k === "tr").map(([k, [t, tip]]) => (k === "tr" ? (true ? b("plTcomp", "comp", "Component", L("Component: linh kiện 2 chân theo kích thước chuẩn (SMD / chân cắm) hoặc tuỳ chỉnh. Đặt lên đường đồng để tự cắt và nối; chọn linh kiện rồi đổi thông số ở đây", "Component: 2-pin part at standard sizes (SMD / through-hole) or custom. Drop on a trace to splice in; select a part and change its parameters here")) : "") + b("plTph", "ph", "Pin / Pad", L("Pin / Pad: chọn số chân, bước chân, đường kính, tròn/vuông, xoay, SMD rồi click đặt lên bo", "Pin / Pad: set pins, pitch, pad diameter, round/square, rotate, SMD and click to place")) + b("plTsk", "tsk", "Sketch Route", TOOLS().sk[1]).replace("<button ", '<button data-tool="sk" ') + b("plTtr", "edit", L("Sửa dây", "Edit"), L("Trim (T) · Fillet (F) · Chamfer (C) · Extend (E): bấm để mở, bấm lại để tắt", "Trim (T) · Fillet (F) · Chamfer (C) · Extend (E): click to open, click again to close")).replace("<button ", '<button data-tool="tr" ') : b("plT" + k, k === "jw" ? "jump" : k === "dr" ? "draw" : "t" + k, t, tip).replace("<button ", `<button data-tool="${k}" `) + (k === "cu" ? DIMB : ""))).join("")}</div>`
      + b("plUnwire", "unwire", L("Gỡ dây", "Unwire"), L("Gỡ dây: đang chọn linh kiện → gỡ dây nối vào linh kiện đó; không chọn linh kiện → xoá hết mọi đường đồng & dây nhảy (Ctrl+Z để lấy lại)", "Unwire: part selected → remove wires on that part; nothing selected → clear all traces & jumpers (Ctrl+Z to undo)")) + b("plPour", "pour", L("Phủ mass", "GND pour"), L("Đổ đồng GND vào chỗ trống (khe chỉnh ở bảng bên phải, nan nhiệt)", "Fill free areas with GND copper (clearance set in the right panel, thermal spokes)"));
    $("#plAlpha").oninput = e => { S.alpha = e.target.value / 100; render(); };
    $("#plTips").innerHTML = tipsHTML(); $("#plHelpBtn").onclick = toggleHelp; $("#plFile").onclick = toggleFileMenu; $("#plLayers").onclick = layerMenu; ensureLayers(); applyLayers();
    if ($("#plAuto")) $("#plAuto").onclick = e => routePanel(e.currentTarget);
    if ($("#plFull")) {
      const syncFull = () => { const b = $("#plFull"); if (b) b.classList.toggle("on", !!(document.fullscreenElement || document.webkitFullscreenElement)); };
      $("#plFull").onclick = () => {
        const elF = document.documentElement;
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (fsEl) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); return; }
        const req = elF.requestFullscreen || elF.webkitRequestFullscreen;
        if (req) {
          try { const p = req.call(elF); if (p && p.catch) p.catch(() => toast(L("Trên iPhone: bấm Chia sẻ (⎙) → Thêm vào MH chính để mở tràn viền 100%.", "On iPhone: tap Share → Add to Home Screen for 100% fullscreen."))); }
          catch (err) { toast(L("Trên iPhone: bấm Chia sẻ (⎙) → Thêm vào MH chính để mở tràn viền 100%.", "On iPhone: tap Share → Add to Home Screen for 100% fullscreen.")); }
        } else {
          toast(L("Trên iPhone: bấm Chia sẻ (⎙) → Thêm vào MH chính để mở tràn viền 100%, hoặc bấm aA → Ẩn thanh công cụ.", "On iPhone: tap Share → Add to Home Screen for 100% fullscreen.")); 
        }
      };
      document.addEventListener("fullscreenchange", syncFull);
      document.addEventListener("webkitfullscreenchange", syncFull);
      syncFull();
    }
    let lineOpts = () => {}, jwOpts = () => {};
    syncWidthSlider = () => {};
    const on = (id, f) => $(id).onclick = f;
    on("#plTms", () => {
      if (ui.tool === "ms") {
        ui.meas = null; ui.measList = null;
        if (LY.tmp) LY.tmp.innerHTML = "";
        setTool("sel");
      } else setTool("ms");
    });
    on("#plTcs", () => {
      if (ui.tool === "cs") {
        if (LY.tmp) LY.tmp.innerHTML = "";
        renderCsPop();
        setTool("sel");
      } else setTool("cs");
    }); on("#plCheck", cmd.check); on("#plSch", openSchematicModal); on("#plUndo", cmd.undo); on("#plRedo", cmd.redo); on("#plFit", fit); on("#plRats", cmd.rats); on("#plRatEdit", () => { if (ui.tool === "rat") setTool("sel"); else { if (!S.rats) S.rats = true; setTool("rat"); render(); } }); on("#plSnap", cmd.snapG); on("#plUnit", () => { S.unit = S.unit === "in" ? "mm" : "in"; TRK("unit", S.unit); const ub = $("#plUnit"); if (ub) { ub.classList.toggle("on", S.unit === "in"); ub.querySelector("span").textContent = S.unit; } save(); drawRulers(); render(); if (ui.cs) drawCs(); { for (const q of ["#plFlyCM", "#plFlyPH"]) { const x = $(q); if (x && x.uFix) x.uFix(); } } toast(L("Hệ thước: ", "Ruler unit: ") + (S.unit === "in" ? "inch (in)" : "mm")); }); on("#plGrid", () => { S.gridStep = gridStep() < 2 ? G : SN; const gb = $("#plGrid"), is127 = S.gridStep < 2; if (gb) { gb.classList.toggle("on", is127); gb.querySelector("span").textContent = is127 ? "1.27" : "2.54"; } const pat = $("#grid"); if (pat) { pat.setAttribute("width", S.gridStep); pat.setAttribute("height", S.gridStep); } save(); render(); toast(L("Lưới & Snap: ", "Grid & Snap: ") + (is127 ? "1,27 mm" : "2,54 mm")); }); on("#plReset", () => cmd.reset()); on("#plFlip", cmd.flip);
    /* Bố cục: nút xoay vòng 4 kiểu + nút đổi bên trái/phải của 2 bảng (nhớ lại cho lần sau) */
    (() => {
      const LAYS = [["", L("Cân bằng", "Balanced")], ["wide", L("Ưu tiên bản vẽ", "Canvas first")], ["focus", L("Chỉ bản vẽ", "Canvas only")], ["tools", L("Ưu tiên công cụ", "Tools first")]];
      let lay = "", flip = false; try { lay = localStorage.getItem("pl-lay") || ""; flip = localStorage.getItem("pl-flip") === "1"; } catch (e) { }
      if (!LAYS.some(x => x[0] === lay)) lay = "";
      const bar = $("#plBar"), help = $("#plHelpBtn"); if (!bar || $("#plLay")) return;
      const mk = (id, svg) => { const x = document.createElement("button"); x.type = "button"; x.className = "tb ico"; x.id = id; x.innerHTML = `<svg viewBox="0 0 24 24">${svg}</svg>`; bar.insertBefore(x, help || null); return x; };
      const bl = mk("plLay", '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M16 4v16"/>'), bf = mk("plLayFlip", '<path d="M7 7h12l-3-3M17 17H5l3 3"/>');
      const apply = () => {
        ["wide", "focus", "tools", "flip"].forEach(c => ROOT.classList.remove("lay-" + c));
        if (lay) ROOT.classList.add("lay-" + lay); if (flip) ROOT.classList.add("lay-flip");
        const nm = (LAYS.find(x => x[0] === lay) || LAYS[0])[1];
        bl.title = L("Bố cục: ", "Layout: ") + nm + L(" (bấm để đổi)", " (click to change)"); bf.title = L("Đổi bên danh sách linh kiện / bảng thuộc tính", "Swap sides of parts list / properties");
        bf.classList.toggle("on", flip); bl.classList.toggle("on", !!lay);
        try { localStorage.setItem("pl-lay", lay); localStorage.setItem("pl-flip", flip ? "1" : "0"); } catch (e) { }
        window.dispatchEvent(new Event("resize"));   // bản vẽ & thước tính lại khung
      };
      bl.onclick = () => { lay = LAYS[(LAYS.findIndex(x => x[0] === lay) + 1) % LAYS.length][0]; apply(); toast(L("Bố cục: ", "Layout: ") + LAYS.find(x => x[0] === lay)[1]); };
      bf.onclick = () => { flip = !flip; apply(); };
      apply();
    })();
    /* Dock: kéo tay nắm (thanh nhỏ ở mép trên mỗi khung) để thả nổi; kéo sát mép thì hít vào trái / phải / trên / dưới.
       Khung danh sách & thuộc tính kéo giãn được ở mép trong. Chỉ bật sau lần kéo đầu tiên; nút Bố cục về "Cân bằng" = đặt lại. */
    (() => {
      const NARROW = () => window.innerWidth < 1000 || window.innerHeight > window.innerWidth;
      const P = { list: $(".pl-list"), bar: $("#plBar"), vbar: $("#plVbar"), side: $(".pl-side") }, stage = $("#plStage");
      if (!P.list || !P.bar || !P.vbar || !P.side || !stage || $(".dk-mid")) return;
      const ALLOW = { list: ["left", "right"], side: ["left", "right"], vbar: ["left", "right"], bar: ["top", "bottom"] };
      const DEF = { list: "left", side: "right", vbar: "right", bar: "top" };
      const mkd = c => { const d = document.createElement("div"); d.className = c; return d; };
      const WR = { top: mkd("dk-top"), left: mkd("dk-left"), right: mkd("dk-right"), bottom: mkd("dk-bottom") }, mid = mkd("dk-mid");
      ROOT.insertBefore(WR.top, ROOT.firstChild); ROOT.insertBefore(mid, WR.top.nextSibling); ROOT.insertBefore(WR.bottom, mid.nextSibling);
      mid.append(WR.left, stage, WR.right);
      let st = { on: false, it: {}, w: {} }; try { st = Object.assign(st, JSON.parse(localStorage.getItem("pl-dock") || "{}")); } catch (e) { }
      const save = () => { try { localStorage.setItem("pl-dock", JSON.stringify(st)); } catch (e) { } };
      const dockInto = (k, e) => { const el = P[k]; el.style.left = el.style.top = el.style.height = ""; if (e === "left") WR.left.prepend(el); else WR[e].append(el); };
      const place = k => {
        const el = P[k], d = st.it[k] || { m: "dock", e: DEF[k] }; el.classList.toggle("pl-float", d.m === "float");
        el.style.width = (k === "list" || k === "side") && st.w[k] ? st.w[k] + "px" : "";
        if (d.m === "float") { if (el.parentNode !== ROOT) ROOT.appendChild(el); el.style.left = d.x + "px"; el.style.top = d.y + "px"; el.style.height = d.h ? Math.min(d.h, Math.max(160, ROOT.clientHeight - d.y - 6)) + "px" : ""; if (k === "bar") el.style.width = ""; }
        else dockInto(k, d.e);
      };
      const applyAll = () => {
        const on = st.on && !NARROW(); ROOT.classList.toggle("dk-on", on);
        if (on) ["list", "bar", "vbar", "side"].forEach(place);
        else Object.values(P).forEach(el => { el.classList.remove("pl-float"); el.style.left = el.style.top = el.style.height = el.style.width = ""; });
        repos();
      };
      const grips = {}, rs = {}, prev = mkd("dk-prev"); ROOT.appendChild(prev);
      Object.keys(P).forEach(k => {
        const g = mkd("dk-grip"); g.title = L("Kéo: thả nổi / hít vào mép (trái, phải, trên, dưới)", "Drag: float / dock to an edge"); ROOT.appendChild(g); grips[k] = g; g.onpointerdown = e => startDrag(k, e);
        if (k === "list" || k === "side") { const h = mkd("dk-rs"); h.title = L("Kéo để đổi độ rộng", "Drag to resize"); ROOT.appendChild(h); rs[k] = h; h.onpointerdown = e => startResize(k, e); }
      });
      function repos() {
        const R = ROOT.getBoundingClientRect(), show = R.width > 0 && !NARROW();
        { const v = P.vbar.getBoundingClientRect(), sg = stage.getBoundingClientRect(); ROOT.classList.toggle("vbar-left", ROOT.classList.contains("dk-on") && v.width > 0 && v.left + v.width / 2 < sg.left + sg.width / 2); }
        for (const k in P) {
          const r = P[k].getBoundingClientRect(), vis = show && r.width > 0 && r.height > 0, g = grips[k];
          g.style.display = vis ? "" : "none"; if (!vis) { if (rs[k]) rs[k].style.display = "none"; continue; }
          g.style.left = r.left - R.left + r.width / 2 - 18 + "px"; g.style.top = r.top - R.top - 5 + "px";
          if (rs[k]) { const d = st.it[k] || {}, onR = st.on && d.m === "dock" && d.e === "right"; rs[k].style.display = ""; rs[k].style.top = r.top - R.top + "px"; rs[k].style.height = r.height + "px"; rs[k].style.left = (onR ? r.left - R.left - 4 : r.right - R.left - 3) + "px"; }
        }
      }
      function startDrag(k, e) {
        e.preventDefault(); const g = grips[k]; try { g.setPointerCapture(e.pointerId); } catch (x) { }
        const el = P[k], first = !st.on; if (first) { st.on = true; applyAll(); }
        let R = ROOT.getBoundingClientRect(), r0 = el.getBoundingClientRect(), moved = false, zone = null; const off = { x: e.clientX - r0.left, y: e.clientY - r0.top };
        const T = 100, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        const move = ev => {
          if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 5) return;
          R = ROOT.getBoundingClientRect(); const x = ev.clientX - R.left, y = ev.clientY - R.top;
          if (!moved) { moved = true; if ((k === "list" || k === "side") && !st.w[k]) st.w[k] = Math.round(r0.width); st.it[k] = { m: "float", x: r0.left - R.left, y: r0.top - R.top, h: k === "vbar" || k === "bar" ? 0 : Math.round(r0.height) }; place(k); }
          const d = st.it[k]; d.x = clamp(x - off.x, 0, R.width - 60); d.y = clamp(y - off.y, 0, R.height - 30); el.style.left = d.x + "px"; el.style.top = d.y + "px"; if (d.h) el.style.height = Math.min(d.h, Math.max(160, R.height - d.y - 6)) + "px";
          const ew = el.offsetWidth, eh = el.offsetHeight;   // xét cả con trỏ lẫn mép khung: mép nào gần nhất thì hít
          const dist = { left: Math.min(x, d.x), right: Math.min(R.width - x, R.width - d.x - ew), top: Math.min(y, d.y), bottom: Math.min(R.height - y, R.height - d.y - eh) }; zone = null; let best = T;
          for (const z of ALLOW[k]) if (dist[z] < best) { best = dist[z]; zone = z; }
          hints.forEach(h => h.classList.toggle("hot", h.dataset.z === zone));
          if (zone) { const w = k === "vbar" ? 80 : Math.min(st.w[k] || 260, 360), v = zone === "left" || zone === "right"; prev.style.display = "block"; prev.style.left = (zone === "right" ? R.width - w : 0) + "px"; prev.style.top = (zone === "bottom" ? R.height - 52 : 0) + "px"; prev.style.width = (v ? w : R.width) + "px"; prev.style.height = (v ? R.height : 52) + "px"; } else prev.style.display = "none";
          repos();
        };
        let up = () => {
          g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up); prev.style.display = "none";
          if (moved && zone) st.it[k] = { m: "dock", e: zone };
          if (!moved && first) { st.on = false; }
          save(); applyAll();
        };
        const hints = ALLOW[k].map(z => { const h = mkd("dk-hint dk-hint-" + z); h.dataset.z = z; ROOT.appendChild(h); return h; });
        const up0 = up; up = () => { hints.forEach(h => h.remove()); up0(); };
        g.addEventListener("pointermove", move); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
      }
      function startResize(k, e) {
        e.preventDefault(); const h = rs[k]; try { h.setPointerCapture(e.pointerId); } catch (x) { }
        const d = st.it[k] || {}, onR = d.m === "dock" && d.e === "right", w0 = P[k].getBoundingClientRect().width, x0 = e.clientX;
        const move = ev => { const dx = ev.clientX - x0, w = Math.max(160, Math.min(560, Math.round(w0 + (onR ? -dx : dx)))); st.w[k] = w; P[k].style.width = w + "px"; repos(); window.dispatchEvent(new Event("resize")); };
        const up = () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); save(); };
        h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
      }
      // nút "Đổi bên": khi đang dock thì hoán đổi cạnh của danh sách và thuộc tính; về "Cân bằng" thì đặt lại toàn bộ dock
      $("#plLayFlip").addEventListener("click", () => { if (!st.on) return; const a = st.it.list || { m: "dock", e: DEF.list }, b = st.it.side || { m: "dock", e: DEF.side }; if (a.m === "dock" && b.m === "dock") { st.it.list = { m: "dock", e: b.e }; st.it.side = { m: "dock", e: a.e }; save(); applyAll(); } });
      $("#plLay").addEventListener("click", () => setTimeout(() => { if (!/lay-(wide|focus|tools)/.test(ROOT.className) && st.on) { st = { on: false, it: {}, w: {} }; save(); applyAll(); } }, 0));
      if (window.ResizeObserver) { const ro = new ResizeObserver(() => repos()); ro.observe(ROOT); Object.values(P).forEach(el => ro.observe(el)); }
      window.addEventListener("resize", () => { applyAll(); });
      ROOT.addEventListener("pointerenter", repos); setInterval(repos, 1000);   // phòng khi tab PCB Maker vừa hiện mà chưa có sự kiện đổi cỡ
      applyAll();
    })();
    $$(".pl-tools [data-tool]").forEach(x => x.onclick = () => { const tk = x.dataset.tool; if (tk === "tf") triggerWeldCmd("fill"); else if (tk === "tc") triggerWeldCmd("chamfer"); else if (tk === "cu") { if ($("#plFlyJ")) $("#plFlyJ").classList.remove("on"); if ($("#plFlyP")) $("#plFlyP").classList.remove("on"); setTool(ui.tool === "cu" ? "sel" : "cu"); } else if (tk === "sk") { if ($("#plFlyJ")) $("#plFlyJ").classList.remove("on"); if ($("#plFlyP")) $("#plFlyP").classList.remove("on"); setTool(ui.tool === "sk" ? "sel" : "sk"); } else if (tk === "jw") { if ($("#plFlyP")) $("#plFlyP").classList.remove("on"); if (ui.tool !== "jw") { setTool("jw"); jwOpts(true); } else jwOpts(); } else if (tk === "dr") setTool(ui.tool === "dr" ? "sel" : "dr"); else if (tk === "tr") { if (EDITS.includes(ui.tool)) setTool("sel"); else { const lt = S.editTool || "tr"; if (lt === "tf") triggerWeldCmd("fill"); else if (lt === "tc") triggerWeldCmd("chamfer"); else setTool(lt); } } else setTool(tk); });
    let fly = $("#plFly"); if (!fly) { fly = document.createElement("div"); fly.id = "plFly"; fly.className = "pl-fly"; $("#plStage").appendChild(fly); } fly.innerHTML = "";
    const editHTML = EDITS.map(k => { const [t, tip] = TOOLS()[k], [name, key] = t.match(/^(.*) \((.)\)$/) || [0, t, ""].slice(0), mm = t.match(/^(.*) \((.)\)$/); const nm = mm ? mm[1] : t.replace(/ \(.\)$/, ""), ky = mm ? mm[2] : "T"; const btn = `<button type="button" data-tool="${k}" title="${tip}"><span>${nm}</span><kbd>${ky}</kbd></button>`; return k === "tr" ? `<div class="tr-row">${btn}<label class="tr-auto" title="${L("Auto Trim: bấm 1 chạm tự động cắt đoạn line giữa 2 điểm neo / khúc gẫy / giao điểm có sẵn", "Auto Trim: 1-click cuts the trace segment between the 2 nearest vertices / bends / intersections")}"><input type="checkbox" id="plAutoTrim"${S.autoTrim !== false ? " checked" : ""}><span>Auto</span></label></div>` : btn; }).join("");
    // Pen: nhấn giữ 0,5 giây mở menu độ rộng + góc vẽ
    let fp = $("#plFlyP"); if (!fp) { fp = document.createElement("div"); fp.id = "plFlyP"; fp.className = "pl-fly"; $("#plStage").appendChild(fp); }
    const ANG = [["45", "45/90°"], ["15", "15°"], ["free", L("Tự do", "Free")]];
    const pw = S.penW || 0, pwTxt = v => v ? String(v).replace(".", L(",", ".")) + " mm" : L("tự động", "auto");
    fp.innerHTML = `<div class="flw"><small>${L("Độ rộng đường vẽ", "Line width")}</small><input id="plPenW" type="range" min="0" max="3" step=".1" value="${pw}"><b id="plPenWv">${pwTxt(pw)}</b></div><hr><div class="flw"><small>${L("Góc vẽ", "Angle")}</small></div><div class="ang-row">` + ANG.map(([k, t]) => `<button type="button" data-ang="${k}" class="${(S.ang || "free") === k ? "on" : ""}" title="${L("Góc vẽ của Line", "Line angle")}"><span>${t}</span></button>`).join("") + "</div>";
    fp.insertAdjacentHTML("beforeend", `<hr><div class="flw"><small>${L("Điểm gập", "Bend points")}</small></div><button type="button" data-tool="pt" title="${TOOLS().pt[1]}"><span>Point</span><kbd>X</kbd></button><hr><div class="flw"><small>${L("Sửa dây", "Edit")}</small></div>` + editHTML + '<div class="flw"><small>' + L("Cỡ vát (mm)", "Bevel size (mm)") + '</small><input id="plChSize" type="number" min="0.5" max="10" step="0.5" value="' + chamferSize() + '"></div>');
    { const ci = fp.querySelector("#plChSize"); if (ci) ci.onchange = () => { const v = +ci.value; S.chamferSize = v >= .5 && v <= 10 ? v : 2.5; ci.value = S.chamferSize; save(); toast(L("Cỡ vát Chamfer: ", "Chamfer size: ") + S.chamferSize + " mm"); }; }
    const atChk = fp.querySelector("#plAutoTrim");
    if (atChk) atChk.onchange = () => { S.autoTrim = atChk.checked; ui.trim = null; LY.tmp.innerHTML = ""; save(); if (ui.tool !== "tr") setTool("tr"); toast(S.autoTrim ? L("Đã bật Auto Trim: bấm 1 chạm để cắt đoạn dây giữa 2 điểm neo / khúc gẫy / điểm giao nhau.", "Auto Trim ON: 1-click cuts trace segment between 2 nearest vertices / intersections.") : L("Đã tắt Auto Trim: bấm 2 điểm trên dây để cắt đoạn ở giữa.", "Auto Trim OFF: click 2 points on a trace to cut between them.")); };
    fp.querySelectorAll("[data-tool]").forEach(x => x.onclick = () => { const k = x.dataset.tool; if (ui.tool === k) return setTool("cu"); if (k === "tf") triggerWeldCmd("fill"); else if (k === "tc") triggerWeldCmd("chamfer"); else setTool(k); });
    { const inp = fp.querySelector("#plPenW"); let ck = false;
      inp.oninput = () => {
        const v = +inp.value < .3 ? 0 : +inp.value; fp.querySelector("#plPenWv").textContent = pwTxt(v);
        const ids = selTraceIds(); if (!ids.length) return;
        if (!ck) { ck = true; checkpoint(); }   // 1 lần kéo = 1 bước hoàn tác
        for (const t of S.traces) if (ids.includes(t.id)) { if (v) t.w = v; else delete t.w; t.lock = true; }
        render();
      };
      inp.onchange = () => {
        const v = +inp.value < .3 ? 0 : +inp.value, ids = selTraceIds(); ck = false;
        if (ids.length) { save(); return toast(L(`Đã đổi độ rộng ${ids.length} đường: `, `Width of ${ids.length} trace(s): `) + (v ? pwTxt(v) : L(`tự động (${W_SIG} mm tín hiệu, ${W_PWR} mm nguồn)`, `auto (${W_SIG} mm signal, ${W_PWR} mm power)`))); }
        S.penW = v || null; save(); toast(L("Line vẽ đường rộng ", "Line draws traces ") + pwTxt(v) + (v ? "" : L(` (${W_SIG} mm tín hiệu, ${W_PWR} mm nguồn)`, ` (${W_SIG} mm signal, ${W_PWR} mm power)`)));
      };
      inp.title = L("Chọn đường rồi kéo: đổi độ rộng đường đang chọn. Không chọn gì: đặt độ rộng cho đường vẽ sau.", "Select traces then drag to change their width. Nothing selected: sets the width for new traces.");
    }
    fp.querySelectorAll("[data-ang]").forEach(x => x.onclick = () => { S.ang = x.dataset.ang; save(); fp.querySelectorAll("[data-ang]").forEach(y => y.classList.toggle("on", y === x)); setTool("cu"); toast("Line: " + x.textContent); });
    { const pb = $("#plTcu"); let tm; if (pb) {
      pb.addEventListener("pointerdown", () => { tm = setTimeout(() => { tm = "long"; const st = $("#plStage"); fp.style.top = Math.max(6, pb.getBoundingClientRect().top - st.getBoundingClientRect().top) + "px"; fp.classList.add("on"); }, 500); });
      pb.addEventListener("pointerup", () => clearTimeout(tm)); pb.addEventListener("pointerleave", () => clearTimeout(tm));
      pb.title += " · " + L("Nhấn giữ: độ rộng và góc vẽ", "Hold: width and angle");
    } }
    lineOpts = force => { const st = $("#plStage"), top = $("#plTcu").getBoundingClientRect().top - st.getBoundingClientRect().top; const willOpen = force === true ? true : !fp.classList.contains("on"); if (willOpen) closeAllPopouts("plFlyP"); fp.classList.toggle("on", willOpen); fp.style.top = Math.max(6, Math.min(top, st.clientHeight - fp.offsetHeight - 6)) + "px"; };
    // Jumper: popout 3 nấc ràng buộc góc (mặc định Tự do · Bước 15° · 45° / 90°)
    let fj = $("#plFlyJ"); if (!fj) { fj = document.createElement("div"); fj.id = "plFlyJ"; fj.className = "pl-fly"; $("#plStage").appendChild(fj); }
    const JANG = [["45", "45/90°"], ["15", "15°"], ["free", L("Tự do", "Free")]];
    fj.innerHTML = `<div class="flw"><small>${STUDIO ? L("Góc vẽ", "Angle") : L("Góc dây nhảy", "Jumper angle")}</small></div><div class="ang-row">` + JANG.map(([k, t]) => `<button type="button" data-jang="${k}" class="${(S.jAng || "free") === k ? "on" : ""}" title="${L("Góc ràng buộc của dây nhảy", "Jumper angle constraint")}"><span>${t}</span></button>`).join("") + "</div>";
    fj.querySelectorAll("[data-jang]").forEach(x => x.onclick = () => { S.jAng = x.dataset.jang; save(); fj.querySelectorAll("[data-jang]").forEach(y => y.classList.toggle("on", y === x)); setTool("jw"); toast(L("Dây nhảy: ", "Jumper: ") + x.textContent); });
    {   // Jumper pad: kiểu, hình pad, cỡ, lỗ, bước chuẩn — áp cho jumper mới; đang chọn 1 jumper thì áp luôn cho nó
      const o0 = JO(), sel = (id, opts, v) => '<select id="' + id + '" style="width:104px">' + opts.map(([k, t]) => '<option value="' + k + '"' + (String(v) === String(k) ? " selected" : "") + ">" + t + "</option>").join("") + "</select>", num = (id, v, mn, mx, st) => '<input id="' + id + '" type="number" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + v + '" style="width:62px;text-align:right">';
      fj.insertAdjacentHTML("beforeend", '<hr><div class="jp-g" style="display:grid;grid-template-columns:1fr auto;gap:5px 10px;align-items:center;font-size:12px;padding:0 4px 4px">'
        + "<span>" + L("Hình pad", "Pad shape") + "</span>" + sel("jpShape", [["round", L("Tròn", "Round")], ["square", L("Vuông", "Square")], ["rect", L("Chữ nhật", "Rectangle")]], o0.shape)
        + '<span class="jp-d">' + L("Cỡ pad Ø (mm)", "Pad size Ø (mm)") + '</span><span class="jp-d">' + num("jpR", r3(o0.r * 2), 0.6, 8, 0.1) + '</span>'
        + '<span class="jp-r">' + L("Dài W (mm)", "Length W (mm)") + '</span><span class="jp-r">' + num("jpW", o0.w, 0.4, 10, 0.05) + '</span>'
        + '<span class="jp-r">' + L("Rộng H (mm)", "Width H (mm)") + '</span><span class="jp-r">' + num("jpH", o0.h, 0.4, 10, 0.05) + '</span>'
        + "<span>" + L("Cách 2 pad", "Pad spacing") + "</span>" + sel("jpFix", [[0, L("Tự do", "Free")], [1.27, "1,27 mm"], [2.54, "2,54 mm"]], o0.fix)
        + '<span class="jp-s">' + L("Khoảng cách (mm)", "Distance (mm)") + '</span><span class="jp-s">' + num("jpD", "", 0.5, 200, 0.01) + "</span>"
        + "<span>" + L("Có lỗ khoan", "Drilled hole") + '</span><input id="jpHole" type="checkbox"' + (o0.hole ? " checked" : "") + ' style="margin:0;justify-self:end">'
        + '<span class="jp-h">' + L("Lỗ Ø (mm)", "Hole Ø (mm)") + '</span><span class="jp-h">' + num("jpDr", o0.drill, 0.3, 4, 0.05) + "</span></div>");
      const jpSync = () => { const sh = fj.querySelector("#jpShape").value, hl = fj.querySelector("#jpHole").checked; fj.querySelectorAll(".jp-d").forEach(x => x.style.display = sh === "rect" ? "none" : ""); fj.querySelectorAll(".jp-r").forEach(x => x.style.display = sh === "rect" ? "" : "none"); fj.querySelectorAll(".jp-h").forEach(x => x.style.display = hl ? "" : "none"); };
      const jpRead = () => { const g = id => fj.querySelector("#" + id), n = (id, d, lo, hi) => Math.max(lo, Math.min(hi, parseFloat(g(id).value) || d)); const hole = g("jpHole").checked ? 1 : 0, r = n("jpR", 1.6, 0.6, 8) / 2; return { wire: 1, shape: g("jpShape").value, r, w: n("jpW", 1.6, 0.4, 10), h: n("jpH", 1, 0.4, 10), hole, drill: Math.min(n("jpDr", JP_DRILL, 0.3, 4), Math.max(0.3, r * 2 - 0.4)), fix: +g("jpFix").value }; };
      fj.addEventListener("change", e => {
        if (!e.target.closest(".jp-g")) return; jpSync(); const o = jpRead();
        const sj = ui.sel && ui.sel.t === "j" ? S.jumpers.find(x => x.id === ui.sel.id) : null;
        if (sj) {
          checkpoint(); sj.o = { ...o, min: o.fix || JP_MIN };
          const dx = sj.b[0] - sj.a[0], dy = sj.b[1] - sj.a[1], d = Math.hypot(dx, dy) || 1; let nd = d;
          if (e.target.id === "jpD") nd = Math.max(0.5, parseFloat(e.target.value) || d); else if (e.target.id === "jpFix" && o.fix) nd = Math.max(1, Math.round(d / o.fix)) * o.fix;
          if (Math.abs(nd - d) > 1e-6) { sj.b = [r3(sj.a[0] + dx / d * nd), r3(sj.a[1] + dy / d * nd)]; }
          render();
        } else S.jOpt = o;
        save(); if (!sj && ui.tool !== "jw") setTool("jw");
      });
      jpSync();
      jpSel = () => {
        if (!STUDIO) return; const j = ui.sel && ui.sel.t === "j" ? S.jumpers.find(x => x.id === ui.sel.id) : null, id = j ? String(j.id) : "";
        fj.querySelectorAll(".jp-s").forEach(x => x.style.display = j ? "" : "none");
        if (!j) { if (fj.dataset.sel) { fj.dataset.sel = ""; if (ui.tool !== "jw") fj.classList.remove("on"); } return; }
        { const d = fj.querySelector("#jpD"); if (d && document.activeElement !== d) d.value = r3(Math.hypot(j.b[0] - j.a[0], j.b[1] - j.a[1])); }
        if (fj.dataset.sel === id) return; fj.dataset.sel = id;
        const o = { ...JO(), ...(j.o || {}) }, g = (k, v) => { const e = fj.querySelector("#" + k); if (e) e.value = v; };
        g("jpShape", o.shape); g("jpR", r3(o.r * 2)); g("jpW", o.w); g("jpH", o.h); g("jpFix", o.fix || 0); g("jpDr", o.drill); fj.querySelector("#jpHole").checked = !!o.hole;
        jpSync(); const st = $("#plStage"), tb = $("#plTjw"); fj.style.top = Math.max(6, Math.min(tb.getBoundingClientRect().top - st.getBoundingClientRect().top, st.clientHeight - fj.offsetHeight - 6)) + "px"; closeAllPopouts("plFlyJ"); fj.classList.add("on");
      };
      jpSel();
    }
    { const jb = $("#plTjw"); let tm; if (jb) {
      jb.addEventListener("pointerdown", () => { tm = setTimeout(() => { tm = "long"; const st = $("#plStage"); fj.style.top = Math.max(6, jb.getBoundingClientRect().top - st.getBoundingClientRect().top) + "px"; fj.classList.add("on"); }, 500); });
      jb.addEventListener("pointerup", () => clearTimeout(tm)); jb.addEventListener("pointerleave", () => clearTimeout(tm));
      jb.title += " · " + L("Bấm / nhấn giữ: chọn góc ràng buộc", "Click / hold: angle constraint");
    } }
    jwOpts = force => { const st = $("#plStage"), top = $("#plTjw").getBoundingClientRect().top - st.getBoundingClientRect().top; const willOpen = force === true ? true : !fj.classList.contains("on"); if (willOpen) closeAllPopouts("plFlyJ"); fj.classList.toggle("on", willOpen); fj.style.top = Math.max(6, Math.min(top, st.clientHeight - fj.offsetHeight - 6)) + "px"; };
    let fph = $("#plFlyPH"); if (!fph) { fph = document.createElement("div"); fph.id = "plFlyPH"; fph.className = "pl-fly"; $("#plStage").appendChild(fph); }
    fph.style.cssText += ";min-width:188px;padding:8px 10px";
    fph.innerHTML = `<div class="flw" style="margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.12)"><small style="font-weight:700;letter-spacing:.3px">PIN / PAD</small></div>
      <div class="ph-pm" style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:6px" role="group" aria-label="${L("Bước chân", "Pitch")}"><button type="button" data-pm="2.54" title="0,1 inch">2,54 mm</button><button type="button" data-pm="1.27" class="on" title="0,05 inch">1,27 mm</button></div>
      <div style="display:grid;grid-template-columns:1fr 62px;gap:5px 10px;align-items:center;font-size:12px">
        <span style="white-space:nowrap">${L("Số chân", "Pins")}</span><input id="plPhPins" type="number" min="1" max="40" step="1" value="3" style="width:62px;text-align:right">
        <span style="white-space:nowrap">${L("Bước (<span class=\"uu\">mm</span>)", "Pitch (<span class=\"uu\">mm</span>)")}</span><input id="plPhPitch" type="number" min="0.4" max="25.4" step="0.01" value="1.27" style="width:62px;text-align:right">
        <span class="ph-dia" style="white-space:nowrap">${L("ĐK (<span class=\"uu\">mm</span>)", "Pad Ø (<span class=\"uu\">mm</span>)")}</span><input class="ph-dia" id="plPhDia" type="number" min="0.4" max="8.0" step="0.1" value="1.1" style="width:62px;text-align:right">
        <span class="ph-dr" style="white-space:nowrap">${L("Lỗ Ø (<span class=\"uu\">mm</span>)", "Drill Ø (<span class=\"uu\">mm</span>)")}</span><input class="ph-dr" id="plPhDr" type="number" min="0.3" max="4" step="0.05" value="" placeholder="auto" style="width:62px;text-align:right">
        <span class="ph-wh" style="white-space:nowrap;display:none">${L("Dài W (<span class=\"uu\">mm</span>)", "Len W (<span class=\"uu\">mm</span>)")}</span><input class="ph-wh" id="plPhW" type="number" min="0.3" max="10" step="0.05" value="1.2" style="width:62px;text-align:right;display:none">
        <span class="ph-wh" style="white-space:nowrap;display:none">${L("Rộng H (<span class=\"uu\">mm</span>)", "Wid H (<span class=\"uu\">mm</span>)")}</span><input class="ph-wh" id="plPhH" type="number" min="0.3" max="10" step="0.05" value="0.8" style="width:62px;text-align:right;display:none">
      </div>
      <hr style="margin:7px 0;border:none;border-top:1px solid rgba(255,255,255,.12)">
      <style>#plFlyPH .ph-row{display:grid;grid-template-columns:repeat(4,1fr);gap:2px 4px}#plFlyPH .ph-chip{display:flex;flex-direction:column;align-items:center;gap:4px;color:#c3c7cc;font-size:11px;line-height:1;cursor:pointer;white-space:nowrap}#plFlyPH .ph-chip input{margin:0;width:13px;height:13px;accent-color:#4c8bf5;cursor:pointer}#plFlyPH .ph-pm button.on{background:var(--accent,#dc8e43);border-color:var(--accent,#dc8e43);color:#111}</style>
      <div class="ph-row">
        <label class="ph-chip" title="${L("Pad chữ nhật", "Rectangular pad")}"><input id="plPhRect" type="checkbox"><span>Rect</span></label>
        <label class="ph-chip" title="${L("Pad vuông", "Square pad")}"><input id="plPhSq" type="checkbox"><span>${L("Vuông", "Square")}</span></label>
        <label class="ph-chip" title="${L("Xoay 180°", "Rotate 180°")}"><input id="plPh180" type="checkbox"><span>180°</span></label>
        <label class="ph-chip" title="${L("SMD (không lỗ)", "SMD (no hole)")}"><input id="plPhSmd" type="checkbox" checked><span>SMD</span></label>
      </div>
      <hr style="margin:7px 0;border:none;border-top:1px solid rgba(255,255,255,.12)">
      <div style="display:grid;grid-template-columns:1fr 62px;gap:5px 10px;align-items:center;font-size:12px">
        <span style="white-space:nowrap">${L("Số hàng chân", "Pin rows")}</span><input id="plPhRows" type="number" min="1" max="10" step="1" value="1" list="plPhRowsList" title="${L("Thường dùng 1 hoặc 2; gõ số khác (tối đa 10) nếu cần", "Usually 1 or 2; type another number (up to 10) if needed")}" style="width:62px;text-align:right"><datalist id="plPhRowsList"><option value="1"></option><option value="2"></option></datalist>
        <span style="white-space:nowrap">${L("Cách hàng (inch)", "Row gap (inch)")}</span><input id="plPhGap" type="number" min="0.1" max="6" step="0.1" value="0.7" style="width:62px;text-align:right">
        <small id="plPhGapMm" style="grid-column:1 / -1;text-align:right;opacity:.75">= 17,78 mm</small>
      </div>`;
    {   // gợi ý chuẩn cho từng ô (vẫn gõ số riêng được)
      const smd = () => !!($("#plPhSmd") && $("#plPhSmd").checked);
      addCombo($("#plPhPins"), () => [2, 3, 4, 6, 8, 10, 16, 20, 40], 62);
      const cU = a => a.map(v => UIN() ? Math.round(v / 25.4 * 1e4) / 1e4 : v);
      addCombo($("#plPhPitch"), () => cU([0.65, 1.0, 1.27, 2.0, 2.54, 3.81, 5.08, 7.62]), 62);
      addCombo($("#plPhDia"), () => cU(smd() ? [0.6, 0.8, 1.0, 1.2, 1.5] : [1.1, 1.4, 1.6, 1.8, 2.0, 2.5]), 62);
      addCombo($("#plPhW"), () => cU(smd() ? [0.55, 0.95, 1.2, 1.6] : [1.6, 2, 2.5, 3]), 62);
      addCombo($("#plPhH"), () => cU(smd() ? [0.6, 1, 1.4, 1.8] : [1.6, 1.8, 2, 2.5]), 62);
      addCombo($("#plPhGap"), () => [0.3, 0.4, 0.5, 0.6, 0.7, 0.9], 62);
      addCombo($("#plPhDr"), () => cU([0.6, 0.8, 1.0, 1.2, 1.5]), 62);
    }
    // hệ thước inch: ô số hiện / nhập theo inch, bên trong vẫn tính mm (cách hàng vốn tính bằng inch: giữ nguyên)
    const PHU = ["plPhPitch", "plPhDia", "plPhDr", "plPhW", "plPhH"];
    const phFix = () => { const u = UIN() ? "in" : "mm", o = fph.dataset.u || "mm"; pmLbl(fph); fph.querySelectorAll(".uu").forEach(x => x.textContent = u); if (o === u) return; const k = o === "mm" ? 1 / 25.4 : 25.4; for (const id of PHU) { const i = $("#" + id), v = parseFloat(String(i.value).replace(",", ".")); if (isFinite(v)) i.value = u === "in" ? Math.round(v * k * 1e4) / 1e4 : Math.round(v * k * 100) / 100; i.step = "any"; } fph.dataset.u = u; };
    const phG = id => { phFix(); return parseFloat(String($("#" + id).value).replace(",", ".")) * (UIN() ? 25.4 : 1); };
    const phS = (id, mm) => { phFix(); $("#" + id).value = UIN() ? Math.round(+mm / 25.4 * 1e4) / 1e4 : mm; };
    fph.uFix = phFix; fph.dataset.u = "mm"; phFix();
    const getPhFp = () => {
      const n = Math.max(1, Math.min(40, parseInt($("#plPhPins").value) || 3));
      const p = Math.max(0.4, Math.min(25.4, phG("plPhPitch") || 1.27));
      const d = Math.max(0.4, Math.min(8.0, phG("plPhDia") || 1.1));
      const rectOn = !!($("#plPhRect") && $("#plPhRect").checked);
      fph.querySelectorAll(".ph-wh").forEach(x => x.style.display = rectOn ? "" : "none");
      fph.querySelectorAll(".ph-dia").forEach(x => x.style.display = rectOn ? "none" : "");
      const pw = rectOn ? Math.max(0.3, Math.min(10, phG("plPhW") || 1.2)) : 0;
      const ph = rectOn ? Math.max(0.3, Math.min(10, phG("plPhH") || 0.8)) : 0;
      const sq = $("#plPhSq").checked ? 1 : 0;
      const smd = $("#plPhSmd").checked ? 1 : 0, rows = Math.max(1, Math.min(10, parseInt($("#plPhRows").value) || 1));
      const gap = Math.max(.05, Math.min(6, Math.round((parseFloat($("#plPhGap").value) || .7) * 100) / 100));
      { const gi = $("#plPhGap"), gm = $("#plPhGapMm"), mmTxt = String(r3(gap * 25.4)).replace(".", L(",", ".")) + " mm"; gi.disabled = rows < 2; gi.title = gap + " inch = " + mmTxt; if (gm) { gm.textContent = "= " + mmTxt + (rows < 2 ? L(" (dùng khi 2 hàng)", " (used with 2 rows)") : ""); gm.style.opacity = rows < 2 ? ".45" : ".75"; } }
      fph.querySelectorAll("[data-pm]").forEach(b => b.classList.toggle("on", Math.abs(+b.dataset.pm - p) < .005));
      fph.querySelectorAll(".ph-dr").forEach(x => x.style.display = smd ? "none" : "");
      let dr = smd ? 0 : (phG("plPhDr") || 0); if (dr > 0) dr = r3(Math.max(0.3, Math.min(dr, (rectOn ? Math.min(pw, ph) : d) - 0.3)));   // lỗ luôn nhỏ hơn pad
      return `pinHdr_${n}_${p}_${d}_${sq}_${smd}` + (rows > 1 ? `_r${rows}_${gap}` : "") + (rectOn ? `_x${pw}x${ph}` : "") + (dr > 0 ? `_h${dr}` : "");
    };
    const syncPhGhost = () => {
      if (ui.mode === "place" && ui.place) {
        ui.place.fp = getPhFp();
        ui.place.rot = $("#plPh180").checked ? 180 : 90;
        drawPlaceGhost();
      }
    };
    if ($("#plPhPre")) $("#plPhPre").onchange = e => {
      const v = e.target.value; if (!v) return;
      if (FP[v]) {
        startPlaceComp(v, $("#plPh180").checked ? 180 : 0);
        return;
      }
      const [p, d] = v.split(",");
      $("#plPhPins").value = 2; phS("plPhPitch", p); phS("plPhDia", d); $("#plPhSq").checked = true; $("#plPhSmd").checked = true; $("#plPhRows").value = 1; syncPhGhost(); getPhFp();
    };
    fph.querySelectorAll("[data-pm]").forEach(b => b.onclick = () => {
      const p = +b.dataset.pm; phS("plPhPitch", p); phS("plPhDia", p < 2 ? 1.1 : 2.0); syncPhGhost(); getPhFp();
    });
    ["#plPhPins", "#plPhPitch", "#plPhDia", "#plPhRect", "#plPhW", "#plPhH", "#plPhSq", "#plPh180", "#plPhSmd", "#plPhRows", "#plPhGap", "#plPhDr"].forEach(sel => {
      const inp = $(sel);
      if (inp) inp.oninput = inp.onchange = syncPhGhost;
    });
    if (STUDIO && $("#plNewBoard")) {
      let fnb = $("#plFlyNB"); if (!fnb) { fnb = document.createElement("div"); fnb.id = "plFlyNB"; fnb.className = "pl-fly"; $("#plStage").appendChild(fnb); }
      fnb.style.cssText += ";min-width:206px;padding:9px 11px";
      fnb.innerHTML = `<div class="flw" style="margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.12)"><small style="font-weight:700;letter-spacing:.3px">${L("TẠO BO PCB", "NEW PCB SHAPE")}</small></div>
        <div style="display:grid;grid-template-columns:1fr 90px;gap:5px 8px;align-items:center;font-size:12px">
          <span>${L("Hình dạng", "Shape")}</span><select id="plNbShape" style="width:90px"><option value="rect">${L("Chữ nhật", "Rectangle")}</option><option value="circle">${L("Hình tròn", "Circle")}</option><option value="poly">${L("Đa giác", "Polygon")}</option></select>
          <span class="nb-r">${L("Rộng W (mm)", "Width W (mm)")}</span><input class="nb-r" id="plNbW" type="number" min="10" max="400" step="1" value="50" style="width:90px;text-align:right">
          <span class="nb-r">${L("Cao H (mm)", "Height H (mm)")}</span><input class="nb-r" id="plNbH" type="number" min="10" max="400" step="1" value="30" style="width:90px;text-align:right">
          <span class="nb-r">${L("Bo góc (mm)", "Corner R")}</span><input class="nb-r" id="plNbRx" type="number" min="0" max="20" step="0.5" value="1.5" style="width:90px;text-align:right">
          <span class="nb-c" style="display:none">${L("Đường kính Ø", "Diameter Ø")}</span><input class="nb-c" id="plNbD" type="number" min="10" max="400" step="1" value="40" style="width:90px;text-align:right;display:none">
          <span class="nb-p" style="display:none">${L("Số cạnh", "Sides")}</span><input class="nb-p" id="plNbN" type="number" min="3" max="24" step="1" value="6" style="width:90px;text-align:right;display:none">
        </div>
        <button type="button" id="plNbGo" hidden style="display:none;margin-top:6px;width:100%;padding:6px;border-radius:5px;border:0;background:var(--accent,#dc8e43);color:#111;font-weight:700;cursor:pointer">✓ ${L("Tạo bo", "Create PCB")}</button>`;
      const syncNb = () => {
        const sh = $("#plNbShape").value;
        fnb.querySelectorAll(".nb-r").forEach(x => x.style.display = sh === "rect" ? "" : "none");
        fnb.querySelectorAll(".nb-c").forEach(x => x.style.display = sh !== "rect" ? "" : "none");
        fnb.querySelectorAll(".nb-p").forEach(x => x.style.display = sh === "poly" ? "" : "none");
      };
      $("#plNbShape").onchange = () => { ui.nbPending = null; syncNb(); startNewBoard($("#plNbShape").value); fnb.classList.add("on"); };   // đổi hình: sẵn sàng vẽ hình mới ngay
      const nbVal = id => +$("#" + id).value;
      const nbClamp = (v, d) => Math.max(10, Math.min(400, v || d));
      // vẽ xong là có bo ngay; các ô số chỉnh tiếp thì bo đổi theo (cả lần vẽ + chỉnh là 1 bước Hoàn tác)
      const nbBuild = P => {
        if (P.shape === "rect") { const w = nbClamp(nbVal("plNbW"), P.w0), h = nbClamp(nbVal("plNbH"), P.h0), rx = Math.max(0, Math.min(Math.min(w, h) / 2, nbVal("plNbRx") || 0)); S.board = { w: r3(w), h: r3(h), rx: r3(rx) }; }
        else if (P.shape === "circle") { const d = nbClamp(nbVal("plNbD"), P.w0), rad = d / 2, poly = []; for (let i = 0; i < 48; i++) { const a = i * 2 * Math.PI / 48 - Math.PI / 2; poly.push([r3(rad + rad * Math.cos(a)), r3(rad + rad * Math.sin(a))]); } S.board = { w: r3(d), h: r3(d), poly }; }
        else { const w = nbClamp(nbVal("plNbW"), P.w0), h = nbClamp(nbVal("plNbH"), P.h0); S.board = { w: r3(w), h: r3(h), poly: P.pts.map(([x, y]) => [r3(x * w / P.w0), r3(y * h / P.h0)]) }; }
      };
      const nbLive = () => { const P = ui.nbPending; if (!P) return; nbBuild(P); save(); render(); };
      nbShow = P => {
        const set = (id, v) => { const e = $("#" + id); if (e) e.value = r3(v); };
        $("#plNbShape").value = P.shape;
        if (P.shape === "circle") set("plNbD", P.d); else { set("plNbW", P.w); set("plNbH", P.h); }
        fnb.querySelectorAll(".nb-r").forEach(x => x.style.display = P.shape === "circle" ? "none" : "");
        fnb.querySelectorAll(".nb-c").forEach(x => x.style.display = P.shape === "circle" ? "" : "none");
        fnb.querySelectorAll(".nb-p").forEach(x => x.style.display = "none");
        { const rx = $("#plNbRx"); if (rx) { const sh = P.shape === "poly" ? "none" : (P.shape === "rect" ? "" : "none"); rx.style.display = sh; if (rx.previousElementSibling) rx.previousElementSibling.style.display = sh; } }
        // tạo bo ngay: dời mọi thứ về gốc mới (góc trên trái của hình vừa vẽ)
        checkpoint(); S.noBoard = false; S.autoB = false;
        if (P.shape === "rect") { shiftAll(-P.x0, -P.y0); P.x0 = 0; P.y0 = 0; }
        else if (P.shape === "circle") { const ox = P.cx - P.d / 2, oy = P.cy - P.d / 2; shiftAll(-ox, -oy); P.cx = P.d / 2; P.cy = P.d / 2; }
        else { shiftAll(-P.x0, -P.y0); P.pts = P.pts.map(([x, y]) => [x - P.x0, y - P.y0]); P.x0 = 0; P.y0 = 0; }
        P.w0 = P.shape === "circle" ? P.d : P.w; P.h0 = P.shape === "circle" ? P.d : P.h;
        LY.tmp.innerHTML = ""; nbBuild(P); save(); render(); fit();
        const st = $("#plStage"), top = $("#plNewBoard").getBoundingClientRect().top - st.getBoundingClientRect().top;
        closeAllPopouts("plFlyNB"); fnb.classList.add("on"); fnb.style.top = Math.max(6, Math.min(top, st.clientHeight - fnb.offsetHeight - 6)) + "px";
      };
      fnb.querySelectorAll("input[type=number]").forEach(i => i.addEventListener("input", nbLive));
      const nbApplyPending = () => {
        const P = ui.nbPending; checkpoint(); S.noBoard = false; S.autoB = false;
        if (P.shape === "rect") { const w = nbClamp(nbVal("plNbW"), P.w), h = nbClamp(nbVal("plNbH"), P.h), rx = Math.max(0, Math.min(Math.min(w, h) / 2, nbVal("plNbRx") || 0)); shiftAll(-P.x0, -P.y0); S.board = { w: r3(w), h: r3(h), rx: r3(rx) }; }
        else if (P.shape === "circle") { const d = nbClamp(nbVal("plNbD"), P.d), rad = d / 2, poly = []; shiftAll(-(P.cx - rad), -(P.cy - rad)); for (let i = 0; i < 48; i++) { const a = i * 2 * Math.PI / 48 - Math.PI / 2; poly.push([r3(rad + rad * Math.cos(a)), r3(rad + rad * Math.sin(a))]); } S.board = { w: r3(d), h: r3(d), poly }; }
        else { const w = nbClamp(nbVal("plNbW"), P.w), h = nbClamp(nbVal("plNbH"), P.h), poly = P.pts.map(([x, y]) => [r3((x - P.x0) * w / P.w), r3((y - P.y0) * h / P.h)]); shiftAll(-P.x0, -P.y0); S.board = { w: r3(w), h: r3(h), poly }; }
        ui.nbPending = null; LY.tmp.innerHTML = ""; fnb.classList.remove("on"); save(); render(); fit(); toast(L("Đã tạo bo PCB mới.", "New PCB created."));
      };
      $("#plNbGo").onclick = () => {
        if (ui.nbPending) return nbApplyPending();
        if (ui.mode === "newb") cancel();
        const sh = $("#plNbShape").value;
        checkpoint(); S.noBoard = false; S.autoB = false;
        if (sh === "rect") {
          const w = Math.max(10, Math.min(400, +$("#plNbW").value || 50));
          const h = Math.max(10, Math.min(400, +$("#plNbH").value || 30));
          const rx = Math.max(0, Math.min(Math.min(w, h) / 2, +$("#plNbRx").value || 0));
          S.board = { w: r3(w), h: r3(h), rx: r3(rx) };
        } else {
          const d = Math.max(10, Math.min(400, +$("#plNbD").value || 40)), rad = d / 2;
          const n = sh === "circle" ? 48 : Math.max(3, Math.min(24, parseInt($("#plNbN").value) || 6));
          const poly = [];
          for (let i = 0; i < n; i++) {
            const a = (i * 2 * Math.PI / n) - Math.PI / 2;
            poly.push([r3(rad + rad * Math.cos(a)), r3(rad + rad * Math.sin(a))]);
          }
          S.board = { w: r3(d), h: r3(d), poly };
        }
        fnb.classList.remove("on"); save(); render(); fit();
        toast(L("Đã tạo bo PCB mới.", "New PCB created."));
      };
      $("#plNewBoard").onclick = () => {
        const st = $("#plStage"), top = $("#plNewBoard").getBoundingClientRect().top - st.getBoundingClientRect().top;
        const willOpen = !fnb.classList.contains("on");
        if (willOpen) { ui.nbPending = null; syncNb(); startNewBoard($("#plNbShape").value); closeAllPopouts("plFlyNB"); fnb.classList.add("on"); fnb.style.top = Math.max(6, Math.min(top, st.clientHeight - fnb.offsetHeight - 6)) + "px"; }   // mở bảng là vẽ được ngay theo hình đang chọn
        else { fnb.classList.remove("on"); ui.nbPending = null; if (ui.mode === "newb") cancel(); else LY.tmp.innerHTML = ""; }
      };
    }
    if ($("#plTcomp")) {   // Component: linh kiện 2 chân, ưu tiên kích thước chuẩn, cho phép tuỳ chỉnh
      let fc = $("#plFlyCM"); if (!fc) { fc = document.createElement("div"); fc.id = "plFlyCM"; fc.className = "pl-fly"; $("#plStage").appendChild(fc); }
      fc.style.cssText += ";min-width:188px;padding:8px 10px;box-sizing:border-box";
      const PRE = [["smd_0402", "SMD 0402", "R"], ["smd_0603", "SMD 0603", "R"], ["smd_0805", "SMD 0805", "R"], ["smd_1206", "SMD 1206", "R"], ["smd_sot23", "SOT-23", ""], ["smd_soic8", "SOIC-8", ""],
        ["t:1.27:1.1", L("Header 2 chân · 1,27", "2-pin header · 1.27"), ""], ["t:2.54:2", L("Header 2 chân · 2,54", "2-pin header · 2.54"), ""], ["t:10.16:1.8", L("Điện trở 1/4W · 10,16", "Resistor 1/4W · 10.16"), "R"], ["t:7.62:1.8", L("Diode DO-35 · 7,62", "Diode DO-35 · 7.62"), "D"], ["t:2.54:1.8", L("LED 3/5 mm · 2,54", "LED 3/5 mm · 2.54"), "LED"],
        ["t:2.54:1.6", L("Tụ gốm · 2,54", "Ceramic cap · 2.54"), "C"], ["t:5.08:1.8", L("Tụ · 5,08", "Capacitor · 5.08"), "C"]];
      const row = (lb, h, cls) => '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + lb + '</span>' + (cls ? '<span class="' + cls + '">' + h + '</span>' : h);
      const nm = (id, v, mn, mx, st) => '<input id="' + id + '" type="number" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + v + '" style="width:70px;text-align:right">';
      fc.innerHTML = '<style>#plFlyCM .ph-pm button.on{background:var(--accent,#dc8e43);border-color:var(--accent,#dc8e43);color:#111}</style><div class="flw" style="margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.12)"><small style="font-weight:700;letter-spacing:.3px">COMPONENT</small></div>'
        + '<div class="ph-pm" style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:6px" role="group"><button type="button" data-cpm="1.27" title="0,05 inch">1,27 mm</button><button type="button" data-cpm="2.54" title="0,1 inch">2,54 mm</button></div>'
        + '<div class="cm-g" style="display:grid;grid-template-columns:1fr 96px;gap:5px 10px;align-items:center;font-size:12px">'
        + row(L("Chuẩn", "Standard"), '<select id="cmPre" style="width:96px">' + PRE.map(([k, t]) => '<option value="' + k + '">' + t + '</option>').join("") + '<option value="">' + L("Tuỳ chỉnh", "Custom") + '</option></select>')
        + row(L("Loại", "Kind"), '<select id="cmKind" style="width:96px"><option value="R">R · ' + L("Điện trở", "Resistor") + '</option><option value="C">C · ' + L("Tụ", "Capacitor") + '</option><option value="LED">LED</option><option value="D">D · Diode</option><option value="L">L · ' + L("Cuộn cảm", "Inductor") + '</option><option value="">J · ' + L("Chân / header", "Pins / header") + '</option></select>')
        + row(L("Hình pad", "Pad shape"), '<select id="cmSh" style="width:96px"><option value="round">' + L("Tròn", "Round") + '</option><option value="square">' + L("Vuông", "Square") + '</option><option value="rect">' + L("Chữ nhật", "Rectangle") + '</option></select>')
        + row(L("ĐK (<span class=\"uu\">mm</span>)", "Pad Ø (<span class=\"uu\">mm</span>)"), nm("cmD", 1.8, 0.4, 8, 0.1), "cm-d")
        + row(L("Dài W (<span class=\"uu\">mm</span>)", "Len W (<span class=\"uu\">mm</span>)"), nm("cmW", 0.95, 0.3, 10, 0.05), "cm-r") + row(L("Rộng H (<span class=\"uu\">mm</span>)", "Wid H (<span class=\"uu\">mm</span>)"), nm("cmH", 1, 0.3, 10, 0.05), "cm-r")
        + row(L("Bước (<span class=\"uu\">mm</span>)", "Pitch (<span class=\"uu\">mm</span>)"), nm("cmP", 10.16, 0.4, 25.4, 0.01))
        + row(L("Lỗ Ø (<span class=\"uu\">mm</span>)", "Drill Ø (<span class=\"uu\">mm</span>)"), nm("cmDr", "", 0.3, 4, 0.05), "cm-h")
        + row("Snap", '<input id="cmSnap" type="checkbox"' + (S.snapG !== false ? " checked" : "") + ' title="' + L("Bắt lưới khi đặt / kéo (dùng chung nút Snap chính)", "Grid snap when placing / dragging (shared with the main Snap button)") + '" style="margin:0;justify-self:end">')
        + row(L("Có lỗ khoan", "Drilled hole"), '<input id="cmHole" type="checkbox" checked style="margin:0;justify-self:end">')
        + '</div><div style="font-size:10.5px;opacity:.65;margin-top:6px;line-height:1.3;width:0;min-width:100%">' + L("R xoay · đặt lên đường đồng để tự cắt & nối", "R rotates · drop on a trace to splice in") + '</div>';
      const q = id => fc.querySelector("#" + id);
      // hệ thước inch: ô số hiện / nhập theo inch, bên trong vẫn tính mm
      const UU = () => UIN() ? "in" : "mm", KU = () => UIN() ? 25.4 : 1;
      const uFix = () => { const u = UU(), o = fc.dataset.u || "mm"; pmLbl(fc); if (o === u) return; const k = o === "mm" ? 1 / 25.4 : 25.4; for (const id of ["cmD", "cmW", "cmH", "cmP", "cmDr"]) { const i = q(id), v = parseFloat(String(i.value).replace(",", ".")); if (isFinite(v)) i.value = u === "in" ? Math.round(v * k * 1e4) / 1e4 : Math.round(v * k * 100) / 100; i.step = "any"; } fc.querySelectorAll(".uu").forEach(x => x.textContent = u); fc.dataset.u = u; }; fc.uFix = uFix; fc.dataset.u = "mm"; uFix();
      const gv = id => { uFix(); return parseFloat(String(q(id).value).replace(",", ".")) * KU(); };
      const sv = (id, mm) => { uFix(); q(id).value = mm === "" || mm == null || !isFinite(+mm) ? "" : UIN() ? Math.round(+mm / 25.4 * 1e4) / 1e4 : r3(+mm); };
      const SMDS = ["smd_0402", "smd_0603", "smd_0805", "smd_1206"].map(k => FP[k].pads), uq = a => [...new Set(a.map(v => r3(v)))].sort((x, y) => x - y);
      const STD = id => {   // 3–5 giá trị chuẩn theo loại (SMD hoặc chân cắm)
        const th = q("cmHole").checked;
        if (id === "cmDr") return [0.6, 0.8, 1, 1.2, 1.5];
        if (id === "cmP") return th ? [1.27, 2.54, 5.08, 7.62, 10.16, 12.7] : uq([...SMDS.map(p => Math.abs(p[1].x - p[0].x)), 1.27]).slice(0, 5);
        if (id === "cmD") return [1.1, 1.4, 1.6, 1.8, 2, 2.5];
        if (id === "cmW") return th ? [1.6, 2, 2.5, 3] : uq(SMDS.map(p => p[0].w));
        return th ? [1.6, 1.8, 2, 2.5] : uq(SMDS.map(p => p[0].h));
      };
      const IDS = ["cmD", "cmW", "cmH", "cmP", "cmDr"], selSync = () => {};
      IDS.forEach(id => addCombo(q(id), () => STD(id).map(v => UIN() ? Math.round(v / 25.4 * 1e4) / 1e4 : v), 96));   // cùng kiểu ô số + ▾ với bảng Pin / Pad
      const vis = () => { const r = q("cmSh").value === "rect"; fc.querySelectorAll(".cm-d").forEach(x => x.style.display = r ? "none" : ""); fc.querySelectorAll(".cm-r").forEach(x => x.style.display = r ? "" : "none"); fc.querySelectorAll(".cm-h").forEach(x => x.style.display = q("cmHole").checked ? "" : "none");
        fc.querySelectorAll("[data-cpm]").forEach(b => { const on = Math.abs(+b.dataset.cpm - gv("cmP")) < .005; b.classList.toggle("on", on); }); selSync(); };
      const fill = k => {   // nạp thông số chuẩn vào các ô
        if (k.startsWith("smd_")) { const f = FP[k], a = f.pads[0], b = f.pads[1]; q("cmSh").value = "rect"; sv("cmW", a.w); sv("cmH", a.h); sv("cmP", r3(Math.abs(b.x - a.x))); q("cmHole").checked = false; }
        else if (k.startsWith("t:")) { const [, p, d] = k.split(":"); q("cmSh").value = "round"; sv("cmD", d); sv("cmP", p); q("cmHole").checked = true; }
        vis();
      };
      const keyNow = () => {   // chuẩn → dùng footprint chuẩn; khác chuẩn → footprint tuỳ chỉnh
        const k = q("cmPre").value; if (k.startsWith("smd_")) return k;
        const n = (id, d, lo, hi) => Math.max(lo, Math.min(hi, gv(id) || d)), sh = q("cmSh").value, rc = sh === "rect";
        const w = rc ? n("cmW", 1, 0.3, 10) : 0, h = rc ? n("cmH", 1, 0.3, 10) : 0, d = rc ? Math.max(w, h) : n("cmD", 1.8, 0.4, 8);
        let dr = q("cmHole").checked ? (gv("cmDr") || 0) : 0; if (dr > 0) dr = r3(Math.max(0.3, Math.min(dr, (rc ? Math.min(w, h) : d) - 0.3)));
        return pinHdrKey(2, r3(n("cmP", 2.54, 0.4, 25.4)), r3(d), sh === "square", !q("cmHole").checked, 1, .7, r3(w), r3(h), dr);
      };
      const selC = () => ui.sel && ui.sel.t === "c" ? S.comps.find(c => c.id === ui.sel.id && FP[c.fp] && FP[c.fp].pads.length === 2) : null;
      const preOf = sym => SYM_PRE[sym] || "J";
      const apply = () => {
        const k = keyNow(), c = selC(), sym = q("cmKind").value;
        if (c && ui.mode !== "place") {
          const np = preOf(sym), cur = (c.id.match(/^[A-Z]+/) || [""])[0], rn = (c.sym || "") !== sym && cur !== np;
          if (c.fp === k && (c.sym || "") === sym && !rn) return;
          checkpoint(); c.fp = k; if (sym) c.sym = sym; else delete c.sym;
          if (rn) { let n = 1; while (S.comps.some(x => x.id === np + n)) n++; const nid = np + n; if (ui.sel && ui.sel.id === c.id) ui.sel.id = nid; c.id = nid; }
          save(); render(); list(); return;
        }
        if (ui.mode === "place" && ui.place) { ui.place.fp = k; ui.place.sym = sym || undefined; ui.place.pre = preOf(sym); drawPlaceGhost(); }
      };
      q("cmSnap").onchange = () => { if ((S.snapG !== false) !== q("cmSnap").checked) cmd.snapG(); };
      q("cmPre").onchange = () => { const k = q("cmPre").value, hit = PRE.find(x => x[0] === k); if (hit) q("cmKind").value = hit[2]; fill(k); apply(); };
      q("cmKind").onchange = apply;
      fc.querySelectorAll("[data-cpm]").forEach(b => b.onclick = () => { const p = +b.dataset.cpm; q("cmSh").value = "round"; sv("cmP", p); sv("cmD", p < 2 ? 1.1 : 2); q("cmHole").checked = true; q("cmPre").value = ""; vis(); apply(); });
      fc.querySelectorAll("#cmSh,#cmD,#cmW,#cmH,#cmP,#cmHole,#cmDr").forEach(x => x.oninput = x.onchange = () => { vis(); q("cmPre").value = ""; apply(); });   // sửa tay → Tuỳ chỉnh
      fill(q("cmPre").value = "t:2.54:2"); q("cmKind").value = "R";   // mặc định hệ 2,54
      $("#plTcomp").onclick = () => {
        const st = $("#plStage"), top = $("#plTcomp").getBoundingClientRect().top - st.getBoundingClientRect().top;
        if (fc.classList.contains("on")) { fc.classList.remove("on"); if (ui.mode === "place") cancel(); return; }
        const c = selC();
        if (!c) { startPlaceComp(keyNow(), 0); ui.place.sym = q("cmKind").value || undefined; ui.place.pre = preOf(q("cmKind").value); }   // đặt trước: startPlaceComp đóng mọi popout
        uFix(); closeAllPopouts("plFlyCM"); fc.classList.add("on"); fc.style.top = Math.max(6, Math.min(top, st.clientHeight - fc.offsetHeight - 6)) + "px";
        if (c) { const f = FP[c.fp], a = f.pads[0], b = f.pads[1], hit = PRE.find(([k]) => k === c.fp); q("cmPre").value = hit ? c.fp : "";
          q("cmSh").value = a.w ? "rect" : a.sq ? "square" : "round"; sv("cmW", a.w || 1); sv("cmH", a.h || 1); sv("cmD", r3((a.r || PAD_R) * 2)); sv("cmP", r3(Math.hypot(b.x - a.x, b.y - a.y))); q("cmHole").checked = !a.smd; sv("cmDr", a.drill || ""); q("cmKind").value = c.sym || ""; vis(); }
      };
    }
    $("#plTph").onclick = () => {
      const st = $("#plStage"), top = $("#plTph").getBoundingClientRect().top - st.getBoundingClientRect().top;
      const willOpen = !fph.classList.contains("on");
      if (willOpen) {
        startPlaceComp(getPhFp(), $("#plPh180").checked ? 180 : 90);
        closeAllPopouts("plFlyPH");
        fph.classList.add("on");
        fph.style.top = Math.max(6, Math.min(top, st.clientHeight - fph.offsetHeight - 6)) + "px";
      } else {
        fph.classList.remove("on");
        if (ui.mode === "place") cancel();
      }
    };
    { const ab = $("#plPour"); let tm, long = false; if (ab) {
      ab.addEventListener("pointerdown", () => { long = false; tm = setTimeout(() => { long = true; pourFly(ab); }, 500); });
      ab.addEventListener("pointerup", () => clearTimeout(tm)); ab.addEventListener("pointerleave", () => clearTimeout(tm));
      ab.addEventListener("click", e => { if (long) { e.stopImmediatePropagation(); e.preventDefault(); long = false; } }, true);
      ab.title += " · " + L("Nhấn giữ: tuỳ chọn mass", "Hold: pour options"); } }
    editSync(ui.tool || "sel");
    setTool(ui.tool || "sel"); on("#plPour", e => { cmd.pour(); const old = ROOT.querySelector("#plPourPop"); if (old) old.remove(); if (S.pour) pourFly($("#plPour"), true); }); on("#plUnwire", () => {
      if (ui.sel && ui.sel.t === "c") {
        const cid = ui.sel.id;
        confirmBox(L(`Gỡ mọi đường đồng và dây nhảy nối vào ${cid}?`, `Remove all traces and jumpers connected to ${cid}?`), { danger: true, title: L("Gỡ dây linh kiện?", "Unwire part?"), ok: L("Gỡ dây", "Unwire") }).then(ok => ok && cmd.unwire());
      } else {
        if (!S.traces.length && !S.jumpers.length && !(S.holes && S.holes.length)) return toast(L("Chưa có đường đồng hay dây nhảy nào để xoá.", "No traces or jumpers to clear."));
        confirmBox(L("Xoá hết mọi đường đồng và dây nhảy trên bo mạch?", "Remove all traces and jumpers on the board?"), { danger: true, title: L("Xoá hết dây?", "Clear all wires?"), ok: L("Xoá hết", "Clear all") }).then(ok => ok && cmd.clear());
      }
    }); on("#plArr", cmd.arrange); on("#plFitBoard", () => { checkpoint(); fitBoardTo(roomy()); render(); fit(); toast(L(`Khung bo ${S.board.w} x ${S.board.h} mm, vừa khít linh kiện.`, `Board ${S.board.w} x ${S.board.h} mm, fitted to parts.`)); });
    $$("[data-mode]").forEach(x => x.onclick = () => APP.toWiring(x.dataset.mode));
    $("#plExport").classList.add("primary");
    on("#plExport", exportDialog);
    on("#plZin", () => { cam.x += cam.w * .12; cam.y += cam.h * .12; cam.w *= .76; cam.h *= .76; applyCam(); });
    on("#plZout", () => { cam.x -= cam.w * .16; cam.y -= cam.h * .16; cam.w *= 1.32; cam.h *= 1.32; applyCam(); });
    // menu độ rộng: nằm bên trái nút, bấm 1 mức là áp cho đường đang chọn rồi đóng
    let fw = $("#plFlyW"); if (!fw) { fw = document.createElement("div"); fw.id = "plFlyW"; fw.className = "pl-fly"; $("#plStage").appendChild(fw); }
    fw.innerHTML = `<div class="flw"><small>${L("Độ rộng dây", "Trace width")} <b id="fwv">1 mm</b></small><input id="fwr" type="range" min=".4" max="2.5" step=".1" value="1"><div class="fwk"><span>0,4</span><span>1</span><span>1,5</span><span>2</span><span>2,5 mm</span></div></div>`;
    const fmtW = v => String(Math.round(v * 10) / 10).replace(".", L(",", ".")) + " mm", fr = fw.querySelector("#fwr"); let fwCk = false;
    const wSync = () => { $("#plWidth").classList.toggle("on", !!ui.wpaint); fw.querySelector("#fwv").textContent = fmtW(fr.value); };
    fr.oninput = () => {
      const v = +fr.value, s0 = ui.sel; ui.wpaint = v; fw.querySelector("#fwv").textContent = fmtW(v);
      const ids = s0 && (s0.t === "t" || s0.t === "m") ? (s0.t === "m" ? (ui.ms ? ui.ms.t : []) : [s0.id, ...(s0.ids || [])]) : [];
      if (!ids.length) { $("#plHint").textContent = L("Chọn đường (Shift / Ctrl + bấm, kéo khung = nhiều đường) rồi kéo thanh trượt · bấm vùng trống để đóng", "Select traces (Shift / Ctrl + click, drag a box for many) then drag the slider · click empty to close"); return; }
      if (!fwCk) { fwCk = true; checkpoint(); } for (const t of S.traces) if (ids.includes(t.id)) { t.w = v; t.lock = true; } render();
    };
    fr.onchange = () => { fwCk = false; };
    syncWidthSlider = () => { if (!fw.classList.contains("on")) return; const s0 = ui.sel; const t = s0 && s0.t === "t" ? S.traces.find(x => x.id === s0.id) : s0 && s0.t === "m" && ui.ms && ui.ms.t.length ? S.traces.find(x => x.id === ui.ms.t[0]) : null; if (t) { fr.value = Math.max(.4, Math.min(2.5, traceW(t))); fw.querySelector("#fwv").textContent = fmtW(traceW(t)); } };
    $("#plWidth").onclick = e => { e.stopPropagation(); const pb = e.currentTarget, st = $("#plStage"); { const br = pb.getBoundingClientRect(), sr = st.getBoundingClientRect(); fw.style.right = "auto"; fw.style.top = Math.max(6, br.bottom - sr.top + 6) + "px"; fw.style.left = Math.max(6, Math.min(br.left - sr.left, sr.width - 220)) + "px"; }
      if (fw.classList.contains("on")) { fw.classList.remove("on"); ui.wpaint = null; } else { closeAllPopouts("plFlyW"); fw.classList.add("on"); ui.wpaint = +fr.value; syncWidthSlider(); } wSync(); };
    wSync(); if (ui.wpaint) fw.classList.add("on");

  }
  
  /* ===== GIAO DIỆN MOBILE THÔNG MINH (XOAY DỌC & XOAY NGANG) ===== */
  function mobTabsSetup() {
    const sw = $("#plTabSwitch");
    if (!sw) return;

    sw.innerHTML = `
      <button type="button" class="tab-btn" data-view="parts"><span class="tab-ico">🧩</span><span class="tab-txt">${L("Linh kiện", "Parts")}</span></button>
      <button type="button" class="tab-btn on" data-view="canvas"><span class="tab-ico">📐</span><span class="tab-txt">${L("Canvas mạch", "Canvas")}</span></button>
      <button type="button" class="tab-btn" data-view="side"><span class="tab-ico">📋</span><span class="tab-txt">${L("Lỗi & Chi tiết", "Details & DRC")}</span></button>
    `;

    let activeTab = ROOT.getAttribute("data-mobtab") || "canvas";
    ROOT.setAttribute("data-mobtab", activeTab);

    sw.querySelectorAll(".tab-btn").forEach(btn => {
      btn.onclick = () => {
        const v = btn.dataset.view;
        activeTab = v;
        ROOT.setAttribute("data-mobtab", v);
        sw.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("on", b === btn));
        if (v === "canvas") {
          requestAnimationFrame(() => {
            if (typeof fit === "function") fit();
            if (typeof applyCam === "function") applyCam();
          });
        }
      };
    });

    // Chạm linh kiện tự nhảy về Canvas (khi ở chế độ dọc) hoặc tự thu ngăn kéo trái (khi ở chế độ ngang)
    const listEl = $("#plList");
    if (listEl && !listEl.__mobBound) {
      listEl.__mobBound = true;
      listEl.addEventListener("click", e => {
        if (e.target.closest("[data-add]") || e.target.closest(".mod-row")) {
          setTimeout(() => {
            if (window.matchMedia("(max-width: 960px) and (orientation: landscape)").matches) {
              ROOT.classList.remove("open-left");
              updateHandles();
            } else {
              const canvasBtn = sw.querySelector('[data-view="canvas"]');
              if (canvasBtn) canvasBtn.click();
            }
          }, 120);
        }
      });
    }

    // Tạo 4 tai mũi tên nhấn / vuốt cho Mobile (Xoay Ngang & Xoay Dọc):
    // - Tai Trái (#plHdlLeft): Kéo / đẩy danh sách Linh kiện bên bìa trái (Landscape)
    // - Tai Phải (#plHdlRight): Kéo / đẩy bảng Property & Lỗi bên bìa phải (Landscape)
    // - Tai Trên (#plHdlTop): Kéo / đẩy thanh Toolbar phía trên (Cả Landscape & Portrait)
    // - Tai Dưới (#plHdlBottom): Kéo / đẩy thanh Công cụ vẽ phía dưới (Portrait)
    let hLeft = $("#plHdlLeft"), hRight = $("#plHdlRight"), hRightClose = $("#plHdlRightClose"), hTop = $("#plHdlTop"), hBottom = $("#plHdlBottom");
    if (!hLeft) {
      hLeft = document.createElement("button");
      hLeft.id = "plHdlLeft";
      hLeft.className = "mob-handle hdl-left";
      hLeft.type = "button";
      ROOT.appendChild(hLeft);

      hRight = document.createElement("button");
      hRight.id = "plHdlRight";
      hRight.className = "mob-handle hdl-right";
      hRight.type = "button";
      ROOT.appendChild(hRight);

      hRightClose = document.createElement("button");
      hRightClose.id = "plHdlRightClose";
      hRightClose.className = "mob-handle hdl-right-close";
      hRightClose.type = "button";
      ROOT.appendChild(hRightClose);

      hTop = document.createElement("button");
      hTop.id = "plHdlTop";
      hTop.className = "mob-handle hdl-top";
      hTop.type = "button";
      ROOT.appendChild(hTop);

      hBottom = document.createElement("button");
      hBottom.id = "plHdlBottom";
      hBottom.className = "mob-handle hdl-bottom";
      hBottom.type = "button";
      ROOT.appendChild(hBottom);

      // Hàm gắn sự kiện vừa Nhấn (Click) vừa Vuốt ngón tay (Swipe) cho các tai mũi tên
      const bindSwipeHandle = (el, cls, axis, dirOpen) => {
        let x0 = 0, y0 = 0, swiped = false;
        el.addEventListener("pointerdown", e => {
          x0 = e.clientX;
          y0 = e.clientY;
          swiped = false;
          el.setPointerCapture(e.pointerId);
        });
        el.addEventListener("pointermove", e => {
          if (!el.hasPointerCapture(e.pointerId)) return;
          const dx = e.clientX - x0, dy = e.clientY - y0;
          const delta = axis === "x" ? dx : dy;
          if (Math.abs(delta) > 16) {
            swiped = true;
            if (delta * dirOpen > 0) ROOT.classList.add(cls);
            else ROOT.classList.remove(cls);
            updateHandles();
          }
        });
        el.addEventListener("pointerup", e => {
          if (!swiped) {
            ROOT.classList.toggle(cls);
            updateHandles();
          }
        });
      };

      bindSwipeHandle(hLeft, "open-left", "x", 1);      // Vuốt sang phải (+x) mở bìa trái
      bindSwipeHandle(hRight, "open-right", "y", 1);
      bindSwipeHandle(hRightClose, "open-right", "y", 1);
      bindSwipeHandle(hTop, "open-top", "y", 1);        // Vuốt xuống (+y) mở thanh trên
      bindSwipeHandle(hBottom, "open-bottom", "y", -1); // Vuốt lên (-y) mở thanh dưới

      // Cho phép vuốt trực tiếp trên thân bảng để đẩy gọn vào trong
      const bindPanelSwipeClose = (panelEl, cls, axis, dirClose) => {
        if (!panelEl) return;
        let px0 = 0, py0 = 0;
        panelEl.addEventListener("pointerdown", e => { px0 = e.clientX; py0 = e.clientY; }, { passive: true });
        panelEl.addEventListener("pointermove", e => {
          const dx = e.clientX - px0, dy = e.clientY - py0;
          if (axis === "x" && dx * dirClose > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            ROOT.classList.remove(cls);
            updateHandles();
          } else if (axis === "y" && dy * dirClose > 35 && Math.abs(dy) > Math.abs(dx) * 1.5) {
            ROOT.classList.remove(cls);
            updateHandles();
          }
        }, { passive: true });
      };

      bindPanelSwipeClose($("#plList"), "open-left", "x", -1);
      bindPanelSwipeClose($("#plBar"), "open-top", "y", -1);
      bindPanelSwipeClose($("#plVbar"), "open-bottom", "y", 1);
      window.addEventListener("resize", () => requestAnimationFrame(updateHandles));
    }

    function updateHandles() {
      const oL = ROOT.classList.contains("open-left");
      const oR = ROOT.classList.contains("open-right");
      const oT = ROOT.classList.contains("open-top");
      const oB = ROOT.classList.contains("open-bottom");
      if (hLeft) hLeft.innerHTML = `<span class="h-arr">${oL ? "❮" : "❯"}</span><span class="h-lbl">${L("Linh kiện", "Parts")}</span>`;
      if (hRight) hRight.innerHTML = `<span class="h-arr">▼</span><span class="h-lbl">${L("Thuộc tính", "Props")}</span>`;
      if (hRightClose) hRightClose.innerHTML = `<span class="h-arr">▲</span><span class="h-lbl">Toolbar</span>`;
      if (hTop) {
        hTop.innerHTML = `<span class="h-arr">${oT ? "▲" : "▼"}</span><span class="h-lbl">${L("Menu trên", "Top bar")}</span>`;
        requestAnimationFrame(() => {
          const bar = $("#plBar");
          hTop.style.top = (oT && bar ? bar.offsetHeight : 0) + "px";
        });
      }
      if (hBottom) {
        hBottom.innerHTML = `<span class="h-arr">${oB ? "▼" : "▲"}</span><span class="h-lbl">${L("Công cụ vẽ", "Tools")}</span>`;
        requestAnimationFrame(() => {
          const vbar = $("#plVbar");
          const tabH = 54;
          hBottom.style.bottom = (oB && vbar ? tabH + vbar.offsetHeight : tabH) + "px";
        });
      }
    }

    // Mặc định mở sẵn thanh trên & thanh dưới để thấy ngay công cụ, người dùng bấm/vuốt để thu gọn khi cần rộng màn hình
    if (!ROOT.__initLand) {
      ROOT.__initLand = true;
      ROOT.classList.add("open-top");
      ROOT.classList.add("open-bottom");
    }
    updateHandles();
  }

  let swbBridge = null;
  function syncCtxBar() {
    const bar = $("#plCtxBar"), st = $("#plStage");
    if (!bar || !st) return;
    if (!ui.inputType || ui.inputType === "mouse") {
      bar.classList.remove("on");
      st.classList.remove("has-ctxbar");
      bar.innerHTML = "";
      return;
    }
    const swb = swbBridge && swbBridge._getSwbCtxState ? swbBridge._getSwbCtxState() : null;
    const inSwb = !!(swb && swb.active);
    const showAngle = (inSwb && (swb.tool === "line" || swb.tool === "polyline")) || (!inSwb && (ui.tool === "cu" || ui.tool === "saw" || ui.tool === "jw"));
    const isDrawing = (inSwb && swb.drawing) || ui.mode === "route" || ui.mode === "jfree" || (ui.tool === "saw" && ui.saw && ui.saw.pts && ui.saw.pts.length > 0);
    const btns = [];
    if (showAngle) {
      const lbl = (!inSwb && ui.tool === "cu" && !FREEM()) ? L("Góc tự do", "Free angle") : "45° / 90°";
      btns.push(`<button type="button" data-ctx="shift" class="${ui.shiftLock ? "on" : ""}">${lbl}</button>`);
    }
    if (isDrawing) {
      btns.push(`<button type="button" data-ctx="done" class="ok">✓ ${L("Xong", "Done")}</button>`);
      btns.push(`<button type="button" data-ctx="cancel" class="bad">✕ ${L("Huỷ", "Cancel")}</button>`);
    }
    if (ui.hasPen) {
      btns.push(`<button type="button" data-ctx="pen" class="${ui.penOnly ? "on" : ""}">✏ ${L("Chỉ bút", "Pen only")}</button>`);
    }
    if (!btns.length) {
      bar.classList.remove("on");
      st.classList.remove("has-ctxbar");
      bar.innerHTML = "";
      return;
    }
    bar.innerHTML = btns.join("");
    bar.classList.add("on");
    st.classList.add("has-ctxbar");
    bar.querySelectorAll("button").forEach(b => b.onclick = e => {
      e.stopPropagation();
      const k = b.dataset.ctx;
      if (k === "shift") {
        ui.shiftLock = !ui.shiftLock;
        if (inSwb) swbBridge._refreshSwbPreview?.();
        else if (ui.mode === "route") drawRoute();
        syncCtxBar();
      } else if (k === "done") {
        if (inSwb) swbBridge._finishSwbActive?.();
        else if (ui.mode === "route") { const last = ui.route.pts[ui.route.pts.length - 1]; finishRoute(ui.route.cur || last, false); }
        else if (ui.tool === "saw" && ui.saw && ui.saw.pts && ui.saw.pts.length >= 2) sawFinish();
        else if (ui.mode === "jfree") { cancel(); render(); }
        syncCtxBar();
      } else if (k === "cancel") {
        if (inSwb) swbBridge._cancelSwbActive?.();
        else { cancel(); render(); }
        syncCtxBar();
      } else if (k === "pen") {
        ui.penOnly = !ui.penOnly;
        toast(ui.penOnly ? L("Chỉ vẽ bằng bút (ngón tay dùng để kéo/zoom)", "Pen-only drawing ON (fingers pan/zoom)") : L("Đã bật vẽ cả bằng ngón tay", "Touch & pen drawing ON"));
        syncCtxBar();
      }
    });
  }
  {
    const trackPtr = e => {
      const pt = e.pointerType || "mouse";
      let ch = ui.inputType !== pt;
      ui.inputType = pt;
      if (pt === "pen" && !ui.hasPen) {
        ui.hasPen = true;
        ui.penOnly = true;
        ch = true;
        toast(L("Đã nhận diện bút — Bật chế độ Chỉ bút (ngón tay dùng để kéo/zoom)", "Stylus detected — Pen-only mode ON (fingers pan/zoom)"));
      }
      if (ch) syncCtxBar();
    };
    ROOT.addEventListener("pointerdown", trackPtr, true);
    ROOT.addEventListener("pointermove", trackPtr, true);
  }
  const relang = () => { tools(); list(); render(); mobTabsSetup(); };
  tools(); list(); build(); fit(); render(); mobTabsSetup();
  new ResizeObserver(() => { if (!cam || !cam.w) fit(); applyCam(); }).observe($("#plStage"));
  // Pindexio đổi ngôn ngữ bằng window.onLangChange: nối thêm, không thay hàm của site
  const prevLang = window.onLangChange;
  window.onLangChange = function () { if (prevLang) prevLang.apply(this, arguments); relang(); };
  window.PCB = { opt: OPT, loadMine, registerDef, MYDEF, pendingAuto, projectDoc, loadProjectText, dedupe, S: () => S, analyze, autoroute, cmd, ui, pads, exportSVG, pngDPI, gerber, zip };
  // hộp thông báo "đang thử nghiệm" khi mở PCB Maker (hộp của app, không dùng hộp thoại trình duyệt); chọn "Không hiện lại" thì nhớ trên máy
  function betaNote() { return;
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
  /* Báo cáo cho tab Wiring (kiểu ERC): sev "red" = chắc chắn sai, "orange" = nghi ngờ. Chỉ đọc, không sửa gì. */
  function xreport(board) {
    if (board && board !== S.mcu) return { board: S.mcu, other: true, items: [] };
    syncHost(); analyze(); const H = hostInfo(), items = [], add = (sev, code, msg, extra) => items.push({ sev, code, msg, ...extra });
    const diff = SITE ? (wiringDiff() || S.comps.filter(c => !isHost(c) && MODULES[c.fp]).map(c => ({ c: c.id, t: c.fp, nth: S.comps.filter(x => x.fp === c.fp).indexOf(c), pcbOnly: true, msg: L(`${c.id} (${MODULES[c.fp].short}) có trên PCB nhưng Wiring chưa có`, `${c.id} (${MODULES[c.fp].short}) is on the PCB but Wiring does not have it yet`) }))) : null; if (!diff) return { board: S.mcu, noWiring: true, items };
    const power = n => PWR.has(n);
    for (const d of diff) {
      if (d.pin == null) { add("orange", d.missing ? "missing" : "pcbonly", d.msg, { t: d.t, nth: d.nth, c: d.c }); continue; }
      const red = d.have && d.want && power(d.have) !== power(d.want) || d.have && d.want && power(d.have) && power(d.want) && d.have !== d.want || d.have && power(d.have) && !d.want;
      add(red ? "red" : "orange", red ? "wrongnet" : "diff", d.msg + (red ? L(" — nối nhầm nguồn / tín hiệu", " — power / signal mixed up") : ""), { t: d.t, nth: d.nth, c: d.c, pin: d.pin });
    }
    for (const id of S.hot || []) add("red", "hot", L(`${id} chỉ chịu 3,3 V: tín hiệu 5 V từ ${H.name} cần mạch chuyển mức hoặc chia áp.`, `${id} is 3.3 V only: 5 V signals from ${H.name} need a level shifter or divider.`), { c: id });
    if (A.drc.length) add("red", "drc", L(`PCB có ${A.drc.length} lỗi khoảng cách / chạm nhau giữa các mạng.`, `The PCB has ${A.drc.length} clearance / short errors between nets.`), {});
    for (const p of pads()) if (!p.jw && !p.hole && p.net && H.risky.includes(p.net) && !isHost(p.c)) add("orange", "risky", L(`${p.c.id} · ${p.name} nối ${p.net}: chân đặc biệt của board (khởi động / chỉ đọc), kiểm datasheet.`, `${p.c.id} · ${p.name} uses ${p.net}: a special board pin (boot / input-only), check the datasheet.`), { t: p.c.fp, nth: S.comps.filter(x => x.fp === p.c.fp).indexOf(p.c), c: p.c.id, pin: p.name });
    for (const v of pendingAuto()) add("orange", "auto", L(`${v.c.id} · ${v.pin} → ${v.net}: chân tự nối (đoán ${Math.round(v.conf * 100)}%), chưa được xác nhận.`, `${v.c.id} · ${v.pin} → ${v.net}: auto-wired guess (${Math.round(v.conf * 100)}%), not confirmed.`), { c: v.c.id, pin: v.pin });
    for (const p of usedDefs()) if (!p.verified) add("orange", "unverified", L(`${p.title}: linh kiện Fritzing chưa kiểm, đối chiếu chân với datasheet.`, `${p.title}: unchecked Fritzing part, compare the pins with the datasheet.`), { part: p.title });
    if (A.rats.length) add("orange", "open", L(`PCB còn ${A.rats.length} chỗ chưa nối.`, `The PCB has ${A.rats.length} open connections.`), {});
    const seen = new Set();
    return { board: S.mcu, items: items.filter(i => { const k = i.code + "|" + (i.c || "") + "|" + (i.pin || "") + "|" + i.msg; if (seen.has(k)) return false; seen.add(k); return true; }) };
  }
  /* Kế hoạch đồng bộ PCB → Wiring: chỉ phần Wiring biểu diễn được (module + chân nối vào chân board + bus chung). Chỉ đọc. */
  function wiringPlan(board) {
    if (board && board !== S.mcu) return { other: true, mods: [], buses: {}, skipped: [] };
    syncHost(); analyze(); const H = hostInfo(), mods = [], buses = {}, skipped = [], pend = new Set(pendingAuto().map(v => v.c.id + "|" + v.pin));
    const viaR = n => { if (!n || PWR.has(n) || H.pins.has(n)) return n; for (const c of S.comps) if (c.fp === "R" && c.nets) { const v = Object.values(c.nets); if (v.includes(n)) { const k = v.find(x => x !== n && x !== "GND"); if (k && (PWR.has(k) || H.pins.has(k))) return k; } } return n; };
    const other = [];
    for (const c of S.comps) {
      if (isHost(c)) continue;
      const d = MODULES[c.fp], f = FP[c.fp];
      if (!d || !f) { other.push(c.id); continue; }
      const pins = {}, names = new Set(f.pads.map(p => p.name));
      for (const [label, role] of d.pins) {
        if (!names.has(label) || PWR_ROLE[role]) continue;
        if (pend.has(c.id + "|" + label)) { skipped.push(L(`${c.id} · ${label}: chân tự nối chưa xác nhận, không chuyển`, `${c.id} · ${label}: unconfirmed auto-wire, not transferred`)); continue; }
        const have = viaR((c.nets || {})[label] || null); if (!have || PWR.has(have) || !H.pins.has(have)) continue;
        if (SHARED.includes(role)) { if (buses[role] && buses[role] !== have) skipped.push(L(`${c.id} · ${label}: bus ${role} đã nối ${buses[role]}, PCB ghi ${have}: giữ ${buses[role]}`, `${c.id} · ${label}: bus ${role} already on ${buses[role]}, PCB says ${have}: kept ${buses[role]}`)); else buses[role] = have; } else pins[label] = have;
      }
      if (d.passive && !Object.keys(pins).length) { other.push(c.id); continue; }
      mods.push({ type: c.fp, pins });
    }
    if (other.length) skipped.push(L(`${other.length} linh kiện rời không nối thẳng vào GPIO (${other.slice(0, 6).join(", ")}${other.length > 6 ? "…" : ""}): Wiring không biểu diễn được, không chuyển`, `${other.length} loose parts not wired straight to a GPIO (${other.slice(0, 6).join(", ")}${other.length > 6 ? "…" : ""}): Wiring cannot show them, not transferred`));
    if (S.jumpers.length) skipped.push(L(`${S.jumpers.length} dây nhảy: Wiring không có khái niệm này`, `${S.jumpers.length} jumpers: Wiring has no such thing`));
    if ((S.art || []).length) skipped.push(L(`${S.art.length} hình vẽ tay / chữ trên PCB: không chuyển`, `${S.art.length} hand drawings / texts on the PCB: not transferred`));
    return { board: S.mcu, mods, buses, skipped };
  }
  window.PCBLAB = {
    report: xreport, plan: wiringPlan,
    // o.fromWiring: mở từ tab Wiring → lấy mạch. Bo trống (chỉ có ESP32-S3) và Wiring có mạch → tự lấy.
    open(o) {
      TRK("pcb_open", o && o.studio ? "studio" : "maker");
      const nextStudio = !!(o && o.studio);
      if (nextStudio !== STUDIO) {
        save();
        STUDIO = nextStudio; if (!STUDIO) ROOT.removeAttribute("data-studio");
        try { S = JSON.parse(localStorage.getItem(storeKey()) || "null"); } catch (e) { S = null; }
        if (!S || S.v !== 2) S = fresh();
        S.autoRe = false;
        tools();
      }
      if (!STUDIO) {
        if (o && o.board && o.board !== S.mcu) cmd.setBoard(o.board, true);
        const w = o && o.fromWiring && wiring();
        if (o && o.fromWiring && !(w && S.wsig === wsig(w) && S.comps.length > 1)) importWiring(false);
        else if (S.comps.length === 1 && !S.traces.length && wiring()) importWiring(true);
      }
      list(); render(); requestAnimationFrame(fit); betaNote();
      if (window.APP && APP.redrawBuy) APP.redrawBuy();
      if (window.SketchWBPlugin && window.SketchWBPlugin.registerBridge) {
        window.SketchWBPlugin.registerBridge(swbBridge = {
          getSvg: () => svg, getRoot: () => (LY && LY.root) || svg, clearTmp: () => { if (LY && LY.tmp) LY.tmp.innerHTML = ""; }, getStage: () => $("#plStage"), getList: () => $("#plList"), toMM: e => toMM(e), getPxPerMm: () => 1 / (ui.k || 0.1),
          addTrace: (pts, w, net) => { checkpoint(); S.traces.push({ id: S.uid++, net: net || ("SWB_" + S.uid), pts, w, lock: true }); list(); render(); },
          addArt: (pts, w, closed, fill) => {   // Sketch Route → lớp paint (mặt trên); Solid = tô kín hình khép kín
            ensureLayers(); const ly = S.layers.find(l => l.kind === "paint" && l.side !== "bottom") || S.layers.find(l => l.kind === "paint"); if (!ly) return;
            checkpoint(); S.art.push({ id: S.uid++, layer: ly.id, w, fill: !!fill, paths: [{ pts: pts.map(q => [q[0], q[1]]), closed: !!closed }] }); save(); render();
          },
          isGridSnapOn: () => S.snapG !== false,
          getBoardEdges: () => { const b = S.board; if (!b || S.noBoard) return []; const P = b.poly || [[0, 0], [b.w, 0], [b.w, b.h], [0, b.h]]; return P.map((p, i) => [p, P[(i + 1) % P.length]]); },   // Dim của Sketch Route đo từ mép bo
          getTraceLines: () => { const out = []; for (const t of S.traces) for (let k = 0; k < t.pts.length - 1; k++) out.push({ type: "line", x1: t.pts[k][0], y1: t.pts[k][1], x2: t.pts[k + 1][0], y2: t.pts[k + 1][1] }); return out; },
          findTraceVertexNear: (x, y, maxD = 1.2) => { let b = null, bd = maxD; for (const t of S.traces) for (const pt of t.pts) { const d = Math.hypot(pt[0] - x, pt[1] - y); if (d < bd) { bd = d; b = { x: pt[0], y: pt[1], net: t.net }; } } return b; },
          findLineSnapNear: (x, y, maxD = 0.9) => { const sg = segsNear({ x, y }, maxD)[0]; if (!sg) return null; const a = sg.t.pts[sg.k], b = sg.t.pts[sg.k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)); return { x: Number((a[0] + t * dx).toFixed(3)), y: Number((a[1] + t * dy).toFixed(3)), net: sg.t.net }; },
          findPadNear: (x, y, maxD = 1.35) => { let b = null, bd = maxD; for (const q of pads()) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; b = q; } } return b ? { x: b.x, y: b.y, net: b.net } : null; },
          findNetAt: (x, y) => { const pd = padAt({ x, y }); if (pd && pd.net) return pd.net; let b = null, bd = 1.35; for (const q of pads()) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd && q.net) { bd = d; b = q; } } if (b) return b.net; const sg = segsNear({ x, y }, 0.8)[0]; return sg && sg.t ? sg.t.net : null; },
          getSuggestedPads: (startPt) => {
            const H = hostInfo(), P = pads(), roleOf = q => { const f = q.c.fp && FP[q.c.fp]; const p = f && f.pads[q.i]; return p && p.role && p.role !== "n" && (!f.mine || p.conf >= .5) ? p.role : null; };
            const isRouted = p => S.traces.some(t => [t.pts[0], t.pts[t.pts.length - 1]].some(e => Math.hypot(e[0] - p.x, e[1] - p.y) < PAD_R + .25)) || S.jumpers.some(j => [j.a, j.b].some(e => Math.hypot(e[0] - p.x, e[1] - p.y) < PAD_R + .25));
            const isSigPad = q => !isHost(q.c) && !q.jw && !q.hole && (roleOf(q) === "s" || isSig(q.net) || (!roleOf(q) && !PWR.has(q.net)));
            const out = [], seen = new Set(), push = (q, kind) => { const k = q.x + "," + q.y; if (!seen.has(k)) { seen.add(k); out.push({ x: q.x, y: q.y, name: q.name, kind }); } };
            let sp = null;
            if (startPt && startPt.x != null) {
              let bd = PAD_R + .45;
              for (const q of P) if (!q.jw && !q.hole) { const d = Math.hypot(q.x - startPt.x, q.y - startPt.y); if (d < bd) { bd = d; sp = q; } }
            }
            if (sp) {
              if (isSigPad(sp)) {
                for (const q of P) if (isHost(q.c) && (!q.net || q.net === sp.net || !isRouted(q))) {
                  if (H.pref.includes(q.name) || q.net === sp.net) push(q, "pref");
                  else if (H.risky.includes(q.name)) push(q, "risky");
                }
              } else if (isHost(sp.c) && (H.pref.includes(sp.name) || H.risky.includes(sp.name))) {
                for (const q of P) if (isSigPad(q) && (!isRouted(q) || q.net === sp.name)) push(q, "pref");
              } else if (sp.net) {
                for (const q of P) if (q !== sp && !q.jw && !q.hole && q.net === sp.net) push(q, "pref");
              }
              return out;
            }
            const unroutedMods = P.filter(q => !q.jw && !q.hole && !isHost(q.c) && !isRouted(q) && (q.net || roleOf(q)));
            if (!unroutedMods.length) return out;
            let needMcuSig = false;
            for (const m of unroutedMods) {
              push(m, "pref");
              if (isSigPad(m)) needMcuSig = true;
              else if (m.net) for (const q of P) if (isHost(q.c) && q.net === m.net) push(q, "pref");
            }
            if (needMcuSig) {
              for (const q of P) if (isHost(q.c) && (!q.net || !isRouted(q))) {
                if (H.pref.includes(q.name)) push(q, "pref");
                else if (H.risky.includes(q.name)) push(q, "risky");
              }
            }
            return out;
          },
          resolveSketchNet: (pts) => {
            const H = hostInfo(), P = pads(), roleOf = q => { const f = q.c.fp && FP[q.c.fp]; const p = f && f.pads[q.i]; return p && p.role && p.role !== "n" && (!f.mine || p.conf >= .5) ? p.role : null; };
            const isRouted = p => S.traces.some(t => [t.pts[0], t.pts[t.pts.length - 1]].some(e => Math.hypot(e[0] - p.x, e[1] - p.y) < PAD_R + .25)) || S.jumpers.some(j => [j.a, j.b].some(e => Math.hypot(e[0] - p.x, e[1] - p.y) < PAD_R + .25));
            const touched = [];
            for (const pt of pts) {
              let b = null, bd = PAD_R + .35;
              for (const q of P) if (!q.jw && !q.hole) { const d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < bd) { bd = d; b = q; } }
              if (b && !touched.includes(b)) touched.push(b);
            }
            const modPad = touched.find(q => !isHost(q.c) && !PWR.has(q.net) && !["g", "3", "5"].includes(roleOf(q)));
            const mcuPad = touched.find(q => isHost(q.c) && (H.pref.includes(q.name) || H.risky.includes(q.name)));
            if (modPad && mcuPad && (!mcuPad.net || mcuPad.net === modPad.net || !isRouted(mcuPad))) {
              const oldNet = modPad.c.nets && modPad.c.nets[modPad.name];
              modPad.c.nets = modPad.c.nets || {};
              modPad.c.nets[modPad.name] = mcuPad.name;
              if (modPad.c.auto && modPad.name in modPad.c.auto) delete modPad.c.auto[modPad.name];
              if (oldNet && oldNet !== mcuPad.name) toast(L(`Đã đổi ${modPad.c.id}·${modPad.name}: ${oldNet} → ${mcuPad.name}`, `Changed ${modPad.c.id}·${modPad.name}: ${oldNet} → ${mcuPad.name}`));
              return mcuPad.name;
            }
            for (const q of touched) if (q.net) return q.net;
            if (mcuPad && !mcuPad.net) return mcuPad.name;
            for (const pt of pts) { const sg = segsNear({ x: pt.x, y: pt.y }, 0.8)[0]; if (sg && sg.t && sg.t.net) return sg.t.net; }
            return null;
          }, setTool, isShiftLock: () => !!ui.shiftLock, isPenOnly: () => !!ui.penOnly, syncCtxBar: () => syncCtxBar()
        });
      }
    },
    relang
  };
  // Cầu nối MCP local (chỉ chạy ở 127.0.0.1 / localhost khi bật tools/serve.py)
  {
    const agentId = fp => { const k = String(fp || ""), pre = PRE[k] || PRE[k.split("_")[0]] || (/^smd_(0402|0603|0805|1206)/.test(k) ? "R" : /^smd_sot/.test(k) ? "Q" : "U"); let n = 1; while (S.comps.some(c => c.id === pre + n)) n++; return pre + n; };
    const AGENT_LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
    const checkNets = (comps) => {
      const warns = [];
      for (const c of comps) {
        if (!c || !c.nets || typeof c.nets !== "object") continue;
        const f = FP[c.fp];
        if (!f || !Array.isArray(f.pads)) continue;
        const valid = f.pads.map(p => p.name);
        const bad = Object.keys(c.nets).filter(k => !valid.includes(k));
        if (bad.length) warns.push(`${c.id} (${c.fp}): không tìm thấy chân ${bad.map(k => `"${k}"`).join(", ")}. Chân hợp lệ: ${valid.join(", ")}`);
      }
      return warns;
    };
    const READ_ONLY = new Set(["get_state", "get_bom", "list_parts", "pinworld_search", "get_drc", "get_geometry", "export_pdi", "get_rules", "get_image", "check_current"]);
    const fail = (msg, hint) => { const e = new Error(msg); if (hint) e.hint = hint; throw e; };
    const normRot = r => { const v = ((Math.round(+r || 0) % 360) + 360) % 360; if (v % 90) fail("Góc xoay phải là 0, 90, 180 hoặc 270 (nhận " + r + ")", "Chỉ hỗ trợ bội của 90°."); return v; };
    const findComp = id => S.comps.find(c => c.id === id) || fail("Không có linh kiện " + id, "Xem id trong get_state. Có: " + S.comps.map(c => c.id).join(", "));
    const refresh = () => { save(); list(); render(); };
    const pinOf = p => p.c.id + "." + p.name;
    const area = () => r3(S.board.w * S.board.h);
    const summary = () => { analyze(); return { board: { w: S.board.w, h: S.board.h }, comps: S.comps.length, traces: S.traces.length, jumpers: S.jumpers.length, drcCount: A.drc.length, unroutedCount: A.rats.length, unroutedNets: [...new Set(A.rats.map(r => r.net))], pour: !!S.pour }; };
    const score = s => s.unroutedCount * 1000 + s.drcCount * 100 + s.jumpers * 20 + .02 * s.board.w * s.board.h;
    const compNets = c => new Set(analyze().P.filter(p => p.c === c && p.net).map(p => p.net));
    const unrouteNets = nets => { S.traces = S.traces.filter(t => t.lock || !nets.has(t.net)); S.jumpers = S.jumpers.filter(j => !j.auto || !nets.has(j.net)); };
    const pinCheck = (fp, nets) => { const f = FP[fp]; if (!f) return; const valid = f.pads.map(p => p.name), bad = Object.keys(nets || {}).filter(k => !valid.includes(k)); if (bad.length) fail(`${fp}: không có chân ${bad.join(", ")}`, "Chân hợp lệ: " + valid.join(", ")); };
    const routeReport = only => {
      const s = summary(), inS = n => !only || only.has(n);
      const failed = A.rats.filter(r => inS(r.net)).map(r => ({ net: r.net, from: pinOf(r.a), to: pinOf(r.b), a: [r.a.x, r.a.y], b: [r.b.x, r.b.y], len: r3(Math.hypot(r.a.x - r.b.x, r.a.y - r.b.y)) }));
      const jumpers = S.jumpers.filter(j => inS(j.net)).map(j => ({ id: j.id, net: j.net, a: j.a, b: j.b, len: r3(Math.hypot(j.a[0] - j.b[0], j.a[1] - j.b[1])), auto: !!j.auto }));
      const hints = [];
      if (failed.length) hints.push("Còn kết nối hỏng: thử arrange {tries:3, autoroute:true}, nới bo (fit_board {roomy:true}/resize_board), cho dây nhảy (bỏ no_jumpers / tăng max_jumpers), giảm độ rộng mạng, hoặc add_jumper/add_trace tay ở vùng giữa a và b.");
      if (s.drcCount) hints.push("Có lỗi DRC: get_drc xem toạ độ; thường do linh kiện sát nhau/sát mép → move_part hoặc nới bo rồi autoroute lại.");
      return { ...s, score: Math.round(score(s)), failed, jumpersNeeded: jumpers, hints };
    };
    const doRoute = (a = {}) => {
      const only = Array.isArray(a.nets) && a.nets.length ? new Set(a.nets.map(String)) : null;
      if (a.net_widths) for (const [n, w] of Object.entries(a.net_widths)) (S.netW = S.netW || {})[n] = r3(Math.max(.2, Math.min(5, +w)));
      if (a.pour_gnd != null) S.pour = !!a.pour_gnd;
      const tc = OPT.timeCap; if (a.time_limit) OPT.timeCap = Math.max(1000, Math.min(60000, +a.time_limit * 1000));
      RT.only = only; RT.maxJ = a.no_jumpers ? 0 : a.max_jumpers != null ? Math.max(0, parseInt(a.max_jumpers) || 0) : null;
      try { cmd.auto(true); } finally { RT.only = null; RT.maxJ = null; OPT.timeCap = tc; }
      return routeReport(only);
    };
    const addComp = p => {
      if (!FP[p.fp]) { const q = String(p.fp || "").toLowerCase().split(/[_:]/)[0], sug = Object.keys(FP0).filter(k => k.toLowerCase().includes(q)).slice(0, 8); fail("Không có footprint " + p.fp, "Dùng list_parts {q} để tra mã." + (sug.length ? " Gần giống: " + sug.join(", ") : "")); }
      pinCheck(p.fp, p.nets);
      const ref = p.ref && !S.comps.some(c => c.id === p.ref) ? String(p.ref) : agentId(p.fp);
      const c = { id: ref, fp: p.fp, x: r3(+p.x || 0), y: r3(+p.y || 0), rot: normRot(p.rot), ...(p.val ? { val: String(p.val) } : {}), ...(p.nets ? { nets: { ...p.nets } } : {}), ...(p.lock ? { lock: true } : {}) };
      S.comps.push(c); return c;
    };
    const arrangeTry = (seed, a) => { S.arrSeed = Math.max(0, (parseInt(seed) || 1) - 1); const ar = S.autoRe; S.autoRe = false; cmd.arrange(); S.autoRe = ar; if (a.autoroute) return doRoute(a); return summary(); };
    const arrangeBest = a => {
      const seeds = Array.isArray(a.seeds) && a.seeds.length ? a.seeds.map(n => parseInt(n) || 1) : a.seed != null ? [parseInt(a.seed) || 1] : Array.from({ length: Math.max(1, Math.min(8, parseInt(a.tries) || 1)) }, (_, i) => (parseInt(a.start_seed) || 1) + i);
      const aa = { ...a, time_limit: a.time_limit || (seeds.length > 1 ? 4 : 0) };
      let best = null; const tried = [];
      for (const sd of seeds) { const r = arrangeTry(sd, aa), sc = score(r.board ? r : summary()); tried.push({ seed: sd, score: Math.round(sc), unrouted: r.unroutedCount, drc: r.drcCount, jumpers: r.jumpers, board: r.board }); if (!best || sc < best.sc) best = { sc, sd, st: JSON.stringify(S), r }; }
      if (seeds.length > 1) { S = JSON.parse(best.st); refresh(); fit(); }
      return { bestSeed: best.sd, tried, ...(a.autoroute ? routeReport(null) : summary()) };
    };
    const exec = async (action, args = {}) => {
      if (action === "get_state") {
        analyze();
        return { studio: STUDIO, noBoard: !!S.noBoard, board: S.board, wSig: W_SIG, wPwr: W_PWR, netWidths: S.netW || {}, pour: !!S.pour, comps: S.comps.map(c => ({ id: c.id, fp: c.fp, x: c.x, y: c.y, rot: c.rot || 0, val: c.val, nets: c.nets, ...(c.lock ? { lock: true } : {}) })), traces: S.traces.length, jumpers: S.jumpers.length, drcCount: A.drc.length, unroutedCount: A.rats.length, unroutedNets: [...new Set(A.rats.map(r => r.net))] };
      }
      if (action === "get_rules") return {
        units: "mm, gốc toạ độ ở góc trên-trái bo, x sang phải, y xuống dưới", grid: G, clearance: CLR, edgeClearance: EDGE, padDefault: { d: 2 * PAD_R, drill: 2 * DRILL_R },
        jumper: { pad: 2 * JP_R, drill: JP_DRILL, minLen: JP_MIN, maxLen: JP_MAX, note: "dây trần hàn ở mặt linh kiện; autoroute tự đặt khi bo 1 mặt bị kẹt" },
        widths: { signal: W_SIG, power: W_PWR, powerNets: [...PWR], perNet: S.netW || {} }, pour: { on: !!S.pour, clearance: S.pourClr ?? POUR_CLR, edge: POUR_EDGE, spoke: SPOKE },
        rotation: "rot 0/90/180/270; 90 = xoay theo chiều kim đồng hồ nhìn mặt trước; chân cục bộ (x,y) → (−y, x) rồi cộng (comp.x, comp.y). Toạ độ thật của chân: get_geometry.",
        headers: "pinHdr_N: 1 hàng chân 1..N bước 2,54. Header 2 hàng (_r2_): hàng 1 chân 1..N trái→phải, hàng 2 chân N+1..2N phải→trái (kiểu DIP). HDR:A,B,C: tên chân = tên mạng.",
        autorouteTimeCapMs: OPT.timeCap
      };
      if (action === "get_geometry") {
        analyze(); const nf = Array.isArray(args.nets) && args.nets.length ? new Set(args.nets) : null, pf = Array.isArray(args.parts) && args.parts.length ? new Set(args.parts) : null;
        const ok = n => !nf || nf.has(n);
        return {
          board: S.board,
          pins: A.P.filter(p => S.comps.includes(p.c) && ok(p.net) && (!pf || pf.has(p.c.id))).map(p => ({ ref: p.c.id, pin: p.name, net: p.net || null, x: p.x, y: p.y, ...(p.pw ? { w: p.pw, h: p.ph } : { r: p.r || PAD_R }), ...(p.smd ? { smd: true } : {}), ...(p.drill ? { drill: p.drill } : {}) })),
          bodies: S.comps.filter(c => !pf || pf.has(c.id)).map(c => ({ ref: c.id, ...Object.fromEntries(Object.entries(compBox(c)).map(([k, v]) => [k, r3(v)])) })),
          traces: S.traces.filter(t => ok(t.net)).map(t => ({ id: t.id, net: t.net, w: traceW(t), pts: t.pts, ...(t.lock ? { lock: true } : {}) })),
          jumpers: S.jumpers.filter(j => ok(j.net)).map(j => ({ id: j.id, net: j.net, a: j.a, b: j.b, ...(j.auto ? { auto: true } : {}) })),
          holes: (S.holes || []).filter(h => ok(h.net)).map(h => ({ id: h.id, net: h.net, x: h.x, y: h.y }))
        };
      }
      if (action === "export_pdi") return projectDoc();
      if (action === "load_pdi") {
        const txt = typeof args.doc === "string" ? args.doc : JSON.stringify(args.doc || {});
        const e = loadProjectText(txt); if (e) fail(e, "doc phải là object .pdi đầy đủ như export_pdi trả về: {format:'pindexio-pdi', version, data:{board, comps, traces, jumpers, ...}}.");
        const warnings = checkNets(S.comps); return { comps: S.comps.length, ...(warnings.length ? { warnings } : {}), ...summary() };
      }
      if (action === "create_board") {
        S.noBoard = false; S.autoB = false; const sh = args.shape || "rect";
        if (sh === "rect") S.board = { w: r3(Math.max(10, +args.w || 50)), h: r3(Math.max(10, +args.h || 30)), rx: r3(Math.max(0, args.rx != null ? +args.rx : 1.5)) };
        else { const d = Math.max(10, +args.d || 40), rad = d / 2, n = sh === "circle" ? 48 : Math.max(3, Math.min(24, parseInt(args.n) || 6)), poly = []; for (let i = 0; i < n; i++) { const a = (i * 2 * Math.PI / n) - Math.PI / 2; poly.push([r3(rad + rad * Math.cos(a)), r3(rad + rad * Math.sin(a))]); } S.board = { w: r3(d), h: r3(d), poly }; }
        save(); render(); fit(); return { board: S.board };
      }
      if (action === "resize_board") {
        S.noBoard = false; S.autoB = false; const b = S.board || { w: 50, h: 30, rx: 1.5 };
        const nw = args.w != null ? r3(Math.max(10, +args.w)) : b.w, nh = args.h != null ? r3(Math.max(10, +args.h)) : b.h, nrx = args.rx != null ? r3(Math.max(0, +args.rx)) : (b.rx != null ? b.rx : 1.5);
        if (b.poly && b.poly.length && b.w > 0 && b.h > 0) { const sx = nw / b.w, sy = nh / b.h; S.board = { w: nw, h: nh, poly: b.poly.map(p => [r3(p[0] * sx), r3(p[1] * sy)]) }; } else S.board = { w: nw, h: nh, rx: nrx };
        save(); render(); fit(); return { board: S.board };
      }
      if (action === "fit_board") {
        if (!S.comps.length) fail("Bo chưa có linh kiện", "add_part trước.");
        S.noBoard = false; S.autoB = false; const m = args.roomy ? roomy() : (args.margin != null ? Math.max(1, Math.min(30, +args.margin)) : BMARGIN);
        const sh = fitBoardTo(m) || [0, 0]; save(); render(); fit(); return { margin: m, shift: sh, ...summary() };
      }
      if (action === "auto_board") { const on = args.on != null ? !!args.on : !S.autoB; if (on !== !!S.autoB) cmd.autoBoard(); else render(); save(); return { autoBoard: !!S.autoB, board: S.board }; }
      if (action === "set_route_config") {
        if (args.w_sig != null) S.wSig = r3(Math.max(.2, Math.min(3, +args.w_sig)));
        if (args.w_pwr != null) S.wPwr = r3(Math.max(.2, Math.min(3, +args.w_pwr)));
        syncW(); if (args.apply_existing) for (const t of S.traces) delete t.w;
        save(); render(); return { wSig: W_SIG, wPwr: W_PWR, netWidths: S.netW || {} };
      }
      if (action === "set_net_width") {
        const m = args.widths && typeof args.widths === "object" ? args.widths : args.net ? { [args.net]: args.w } : fail("Thiếu net / w", "Ví dụ {net:'VM', w:1.5} hoặc {widths:{VM:1.5, GND:1.2}}");
        S.netW = S.netW || {}; let n = 0;
        for (const [net, w0] of Object.entries(m)) { if (w0 == null || w0 === 0) { delete S.netW[net]; continue; } const w = r3(Math.max(.2, Math.min(5, +w0))); if (!(w > 0)) fail("Độ rộng không hợp lệ: " + w0); S.netW[net] = w; for (const t of S.traces) if (t.net === net && t.w) { t.w = w; n++; } }
        refresh(); return { netWidths: S.netW, updatedTraces: n, note: "Đường tự đi dây dùng độ rộng mới ngay; chạy autoroute lại để né theo độ rộng mới." };
      }
      if (action === "get_bom") {
        const map = new Map();
        for (const c of S.comps) { const f = FP[c.fp], key = c.fp + "|" + (c.val || ""); if (!map.has(key)) map.set(key, { fp: c.fp, label: (f && f.label) || c.fp, val: c.val || "", count: 0, refs: [] }); const row = map.get(key); row.count++; row.refs.push(c.id); }
        return { total: S.comps.length, items: [...map.values()] };
      }
      if (action === "list_parts") {
        const q = String(args.q || "").trim().toLowerCase(), lim = Math.max(1, Math.min(200, parseInt(args.limit) || 40));
        const all = Object.entries(FP).map(([fp, f]) => ({ fp, label: f.label || fp, smd: !!f.smd, mine: !!f.mine, pins: (f.pads || []).map(p => p.name) })).filter(it => !q || it.fp.toLowerCase().includes(q) || it.label.toLowerCase().includes(q));
        return { total: all.length, shown: Math.min(all.length, lim), parts: all.slice(0, lim), note: "Header tuỳ biến: pinHdr_N (1 hàng 2,54) hoặc pinHdr_N_pitch_padD_sq_noHole_r2_gapInch (2 hàng)." };
      }
      if (action === "pinworld_search" || action === "pinworld_import") {
        if (!window.PINWORLD) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "js/pinworld.js"; sc.onload = ok; sc.onerror = no; document.body.appendChild(sc); });
        const cat = await window.PINWORLD.catalog();
        if (action === "pinworld_search") { const q = String(args.q || "").trim().toLowerCase(), lim = Math.max(1, Math.min(50, parseInt(args.limit) || 15)); const hits = cat.parts.filter(p => !q || String(p[0]).toLowerCase().includes(q) || String(p[2]).toLowerCase().includes(q)); return { total: hits.length, items: hits.slice(0, lim).map(p => ({ title: p[0], src: p[1], fzp: p[2], pins: p[5] || 0 })) }; }
        const p = cat.parts.find(x => x[2] === args.fzp); if (!p) fail("PinWorld part not found: " + args.fzp, "Dùng pinworld_search lấy fzp.");
        const built = await window.PINWORLD.build(p); if (built.blocked) fail("Part blocked: " + (built.warn || []).join("; "));
        const o = window.PINWORLD.mine.get(); o.parts[built.part.id] = { ...built.part, verified: false }; window.PINWORLD.mine.put(o); loadMine(); list();
        let placed = null; if (args.x != null && args.y != null && FP[built.part.id]) { placed = addComp({ fp: built.part.id, x: args.x, y: args.y, rot: args.rot }); refresh(); }
        return { fp: built.part.id, title: built.part.title, pins: (built.part.pads || []).map(q => q.name), warn: built.warn || [], placed };
      }
      if (action === "edit_mypart") {
        const raw = localStorage.getItem("pindexio-myparts"), store = raw ? JSON.parse(raw) : { parts: {} }, part = store.parts && store.parts[args.fp];
        if (!part) fail("MyPart not found: " + args.fp, "Chỉ sửa được linh kiện trong kho của người dùng (pinworld_import).");
        if (args.title != null) part.title = String(args.title); if (args.w != null) part.w = r3(Math.max(1, +args.w)); if (args.h != null) part.h = r3(Math.max(1, +args.h)); if (args.verified != null) part.verified = !!args.verified;
        if (Array.isArray(args.pads) && Array.isArray(part.pads)) for (const pe of args.pads) { const pad = pe.index != null && part.pads[pe.index] ? part.pads[pe.index] : pe.match_name != null ? part.pads.find(q => q.name === pe.match_name) : null; if (!pad) continue; if (pe.name != null) pad.name = String(pe.name); if (pe.role != null) { pad.role = String(pe.role); pad.conf = 1; } if (pe.x != null) pad.x = r3(+pe.x); if (pe.y != null) pad.y = r3(+pe.y); }
        localStorage.setItem("pindexio-myparts", JSON.stringify(store)); loadMine(); list(); render();
        return { fp: part.id, title: part.title, w: part.w, h: part.h, verified: !!part.verified, pads: (part.pads || []).map((q, i) => ({ index: i, name: q.name, role: q.role, x: q.x, y: q.y })) };
      }
      if (action === "add_part") { const c = addComp(args); refresh(); const warnings = checkNets([c]); return warnings.length ? { ...c, warnings } : c; }
      if (action === "add_parts_batch") {
        const out = []; for (const [i, p] of (args.parts || []).entries()) { try { out.push({ i, ok: true, id: addComp(p).id }); } catch (e) { out.push({ i, ok: false, error: e.message, hint: e.hint }); } }
        refresh(); return { added: out.filter(x => x.ok).length, results: out, ...(args.autoroute ? doRoute(args) : summary()) };
      }
      if (action === "move_part" || action === "rotate_part") {
        const c = findComp(args.id), nets = compNets(c);
        if (action === "move_part") { if (args.x != null) c.x = r3(+args.x); if (args.y != null) c.y = r3(+args.y); if (args.dx) c.x = r3(c.x + +args.dx); if (args.dy) c.y = r3(c.y + +args.dy); if (args.rot != null) c.rot = normRot(args.rot); }
        else c.rot = args.rot != null ? normRot(args.rot) : normRot((c.rot || 0) + (args.by != null ? +args.by : 90));
        if (!args.keep_traces) unrouteNets(nets); refresh();
        return { id: c.id, x: c.x, y: c.y, rot: c.rot, ...(args.autoroute ? doRoute(args) : summary()) };
      }
      if (action === "remove_part") {
        const ids = Array.isArray(args.ids) ? args.ids : [args.id]; const gone = [];
        for (const id of ids) { const c = findComp(id), nets = compNets(c); S.comps = S.comps.filter(x => x !== c); unrouteNets(nets); gone.push(id); }
        refresh(); return { removed: gone, ...summary() };
      }
      if (action === "set_nets") {
        const c = findComp(args.id); if (!args.nets || typeof args.nets !== "object") fail("Thiếu nets", "Ví dụ {id:'R1', nets:{'1':'LED_A','2':'GND'}}; giá trị null để bỏ nối.");
        pinCheck(c.fp, args.nets); const old = compNets(c);
        c.nets = args.replace ? {} : { ...(c.nets || {}) }; for (const [k, v] of Object.entries(args.nets)) c.nets[k] = v == null || v === "" ? null : String(v);
        unrouteNets(new Set([...old, ...compNets(c)])); refresh(); return { id: c.id, nets: c.nets, ...summary() };
      }
      if (action === "clear_board") {
        S.traces = []; S.jumpers = []; S.holes = []; S.routed = false; ui.sel = null;
        if (!args.keep_parts) S.comps = args.remove_host ? [] : S.comps.filter(isHost);
        if (args.reset_widths) delete S.netW; refresh(); return summary();
      }
      if (action === "add_trace") {
        const pts = Array.isArray(args.pts) ? args.pts.map(p => [r3(+p[0]), r3(+p[1])]) : [];
        if (pts.length < 2 || pts.some(p => !isFinite(p[0]) || !isFinite(p[1]))) fail("pts cần ≥ 2 điểm [x,y]", "Ví dụ {net:'SDA', pts:[[10,5],[20,5],[20,12]]}; đầu/cuối đặt đúng toạ độ chân (get_geometry).");
        if (!args.net) fail("Thiếu net", "Đặt đúng tên mạng của 2 chân cần nối.");
        const t = { id: S.uid++, net: String(args.net), pts, lock: true, ...(args.w ? { w: r3(Math.max(.2, Math.min(5, +args.w))) } : {}) };
        S.traces.push(t); refresh(); return { id: t.id, ...summary() };
      }
      if (action === "add_jumper") {
        const a = args.a, b = args.b; if (!Array.isArray(a) || !Array.isArray(b)) fail("Thiếu a/b [x,y]");
        const L0 = Math.hypot(a[0] - b[0], a[1] - b[1]); if (L0 < JP_MIN - 1e-6 || L0 > JP_MAX + 1e-6) fail(`Dây nhảy dài ${r3(L0)} mm, phải trong ${JP_MIN}–${JP_MAX} mm`, "Dời một đầu, hoặc nối 2 dây nhảy qua add_trace ở giữa.");
        if (!args.net) fail("Thiếu net");
        const j = { id: S.uid++, net: String(args.net), a: [r3(+a[0]), r3(+a[1])], b: [r3(+b[0]), r3(+b[1])] }; S.jumpers.push(j); refresh(); return { id: j.id, ...summary() };
      }
      if (action === "delete_trace") {
        const ids = new Set((args.ids || (args.id != null ? [args.id] : [])).map(Number)), jids = new Set((args.jumper_ids || []).map(Number)); const n0 = S.traces.length + S.jumpers.length;
        S.traces = S.traces.filter(t => !ids.has(t.id) && !(args.net && t.net === args.net) && !(args.all_unlocked && !t.lock));
        S.jumpers = S.jumpers.filter(j => !jids.has(j.id) && !ids.has(j.id) && !(args.net && j.net === args.net) && !(args.all_unlocked && j.auto));
        gcHoles(); refresh(); return { deleted: n0 - S.traces.length - S.jumpers.length, ...summary() };
      }
      if (action === "pour_gnd") {
        S.pour = args.on !== false; if (args.clearance != null) S.pourClr = r3(Math.max(.3, Math.min(3, +args.clearance)));
        if (args.reroute !== false && S.comps.length > 1) return doRoute(args);
        refresh(); return summary();
      }
      if (action === "autoroute") return doRoute(args);
      if (action === "arrange") { if (S.comps.length < 2) fail("Cần ≥ 2 linh kiện để sắp xếp"); return arrangeBest(args); }
      if (action === "get_image") {
        analyze(); const kind = { copper: "cu", silk: "mark", parts: "parts" }[args.layer || "copper"] || "cu";
        let svg = exportSVG(kind, !!args.mirror);
        if (args.rats !== false && A.rats.length) svg = svg.replace(/<\/g><\/svg>$/, A.rats.map(r => `<line x1="${r.a.x}" y1="${r.a.y}" x2="${r.b.x}" y2="${r.b.y}" stroke="#e00" stroke-width=".3" stroke-dasharray="1 .6"/>`).join("") + "</g></svg>");
        if (args.format === "svg") return { layer: args.layer || "copper", svg };
        const W = Math.max(200, Math.min(1600, parseInt(args.width) || 700)), H = Math.round(W * S.board.h / S.board.w);
        const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); await img.decode();
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
        return { layer: args.layer || "copper", px: [W, H], mmPerPx: r3(S.board.w / W), unrouted: A.rats.length, image: { mimeType: "image/png", data: cv.toDataURL("image/png").split(",")[1] } };
      }
      if (action === "check_current") {   // IPC-2221 lớp ngoài: I = 0,048 · ΔT^0,44 · A^0,725 (A: mil²)
        const cur = args.currents && typeof args.currents === "object" ? args.currents : fail("Thiếu currents", "Ví dụ {currents:{VM:5, GND:5}, dT:10, copper_um:35}");
        const dT = Math.max(1, +args.dT || 10), tUm = Math.max(5, +args.copper_um || 35), tMil = tUm / 25.4, rho = 1.72e-8;
        const needW = I => r3(Math.pow(I / (.048 * Math.pow(dT, .44)), 1 / .725) / tMil * .0254);
        const nets = Object.entries(cur).map(([net, I0]) => {
          const I = +I0, req = needW(I), ts = S.traces.filter(t => t.net === net); let len = 0, R = 0; const narrow = [];
          for (const t of ts) { const w = traceW(t), l = t.pts.reduce((a, p, k) => k ? a + Math.hypot(p[0] - t.pts[k - 1][0], p[1] - t.pts[k - 1][1]) : a, 0); len += l; R += rho * (l / 1000) / ((w / 1000) * (tUm / 1e6)); if (w < req - 1e-6) narrow.push({ id: t.id, w, len: r3(l) }); }
          return { net, I, needWidth: req, minWidth: ts.length ? Math.min(...ts.map(traceW)) : null, traces: ts.length, length: r3(len), resistanceMilliOhm: r3(R * 1000), dropMilliV: r3(R * I * 1000), ok: !narrow.length, narrow, ...(S.pour && net === GND ? { note: "GND có đổ đồng: dòng chủ yếu đi qua mass" } : {}) };
        });
        return { dT, copper_um: tUm, nets, hint: nets.some(n => !n.ok) ? "Tăng độ rộng: set_net_width {widths:{<net>: needWidth}} rồi autoroute lại (dời linh kiện nếu không đủ chỗ)." : "" };
      }
      if (action === "get_drc") { analyze(); return { count: A.drc.length, errors: A.drc.map(v => ({ x: v.x, y: v.y, msg: v.msg })) }; }
      if (action === "build_from_netlist") {
        if (!Array.isArray(args.parts) || !args.parts.length) fail("Thiếu parts", "parts:[{fp, ref?, val?, nets:{chân:mạng}, x?, y?, rot?}]");
        S.traces = []; S.jumpers = []; S.holes = []; S.comps = args.keep_host === false ? [] : S.comps.filter(isHost); S.noBoard = false; S.autoB = false;
        if (args.board) S.board = { w: r3(Math.max(10, +args.board.w || 60)), h: r3(Math.max(10, +args.board.h || 40)), rx: 1.5 };
        if (args.net_widths) S.netW = { ...(S.netW || {}), ...args.net_widths };
        S.pour = args.pour_gnd !== false;
        const errs = []; for (const [i, p] of args.parts.entries()) { try { addComp(p); } catch (e) { errs.push({ i, fp: p.fp, error: e.message, hint: e.hint }); } }
        const placed = args.parts.every(p => p.x != null && p.y != null);
        const rep = placed || S.comps.length < 2 ? doRoute(args) : arrangeBest({ ...args, autoroute: true, tries: args.tries || 3 });
        if (args.fit !== false && placed && !args.board) { fitBoardTo(roomy()); refresh(); fit(); }
        return { partErrors: errs, parts: S.comps.map(c => ({ id: c.id, fp: c.fp, x: c.x, y: c.y, rot: c.rot || 0 })), ...rep };
      }
      if (action === "batch") {
        const ops = Array.isArray(args.ops) ? args.ops : fail("Thiếu ops", "ops:[{action:'add_part', args:{...}}, ...]");
        const results = [];
        for (const [i, op] of ops.entries()) {
          if (!op || op.action === "batch") { results.push({ i, ok: false, error: "batch lồng nhau không được" }); continue; }
          try { results.push({ i, action: op.action, ok: true, data: await exec(op.action, op.args || {}) }); }
          catch (e) { results.push({ i, action: op.action, ok: false, error: String(e && e.message || e), ...(e && e.hint ? { hint: e.hint } : {}) }); if (args.stop_on_error) break; }
        }
        return { results, okCount: results.filter(r => r.ok).length, ...summary() };
      }
      fail("Unknown action: " + action, "Gọi tools/list để xem lệnh.");
    };
    const runAgentCmd = async ({ id, action, args = {} }, reply) => {
      let res = { id, ok: true };
      const ro = READ_ONLY.has(action), u0 = undo.length, snap = ro ? null : JSON.stringify(S);
      try { res.data = await exec(action, args || {}); }
      catch (e) {
        res = { id, ok: false, error: String(e && e.message || e), ...(e && e.hint ? { hint: e.hint } : {}) };
        if (snap && action !== "batch") { S = JSON.parse(snap); try { syncW(); render(); list(); } catch (x) { } }
      }
      if (snap) {   // mỗi lệnh agent = đúng 1 bước Hoàn tác
        undo.length = Math.min(undo.length, u0);
        if (JSON.stringify(S) !== snap) { undo.push(snap); if (undo.length > 100) undo.shift(); redo.length = 0; save(); }
      }
      if (reply) reply(res); else fetch("/__agent_done", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(res) }).catch(() => { });
    };
    if (AGENT_LOCAL) setInterval(() => {
      fetch("/__agent_poll", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.cmd) runAgentCmd(j.cmd); }).catch(() => { });
    }, 400);
    // Kết nối AI từ xa: tab nối WebSocket tới mcp.pindexio.com theo mã phòng; AI dán URL https://mcp.pindexio.com/mcp?room=MÃ
    const MCP_HOST = "mcp.pindexio.com", RK = "pindexio-ai-room";
    const MCP_LOC = (() => { const q = (location.search.match(/[?&]mcp=(\w+)/) || [])[1]; try { if (q === "local") localStorage.setItem("pindexio-mcp", "local"); else if (q) localStorage.removeItem("pindexio-mcp"); return localStorage.getItem("pindexio-mcp") === "local" && AGENT_LOCAL; } catch (e) { return q === "local"; } })(), MCP_WS = MCP_LOC ? "ws://127.0.0.1:8787" : "wss://" + MCP_HOST, MCP_HTTP = MCP_LOC ? "http://127.0.0.1:8787" : "https://" + MCP_HOST;   // ?mcp=local: thử với bưu điện chạy wrangler dev
    let aiWs = null, aiOn = false, aiTimer = null, aiRoom = null;
    const newRoom = () => { const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(6)); let t = ""; for (const b of r) t += A[b % A.length]; return "PCB-" + t; };
    const roomGet = () => { if (aiRoom) return aiRoom; try { aiRoom = sessionStorage.getItem(RK); } catch (e) { } if (!aiRoom) { aiRoom = newRoom(); try { sessionStorage.setItem(RK, aiRoom); } catch (e) { } } return aiRoom; };
    const aiConnect = () => {
      if (!aiOn || (aiWs && aiWs.readyState <= 1)) return;
      const ws = aiWs = new WebSocket(`${MCP_WS}/ws?room=${roomGet()}`);
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.type === "cmd" && m.cmd) runAgentCmd(m.cmd, res => { try { ws.send(JSON.stringify(res)); } catch (x) { } }); };
      ws.onopen = () => { clearInterval(aiTimer); aiTimer = setInterval(() => { try { ws.send('{"type":"ping"}'); } catch (x) { } }, 30000); };
      ws.onclose = ev => { clearInterval(aiTimer); if (aiWs === ws) aiWs = null; if (aiOn && ev.code !== 4000) setTimeout(aiConnect, 3000); else if (ev.code === 4000) aiOn = false; };   // 4000: tab khác cùng mã đã nối
    };
    let aiBadge = null;
    const badge = () => {
      const st = aiOn ? (aiWs && aiWs.readyState === 1 ? "on" : "wait") : "off";
      if (st === "off") { if (aiBadge) aiBadge.remove(); aiBadge = null; return; }
      if (!aiBadge) { aiBadge = document.createElement("button"); aiBadge.type = "button"; aiBadge.className = "pl-ai-badge"; aiBadge.style.cssText = "position:absolute;right:10px;bottom:10px;z-index:30;font:600 11px/1 sans-serif;padding:5px 8px;border-radius:10px;border:1px solid #2b7a4b;background:#e9f6ee;color:#1d5c37;cursor:pointer;opacity:.85"; aiBadge.onclick = () => aiDialog(); }
      if (ROOT && aiBadge.parentNode !== ROOT) { if (getComputedStyle(ROOT).position === "static") ROOT.style.position = "relative"; ROOT.appendChild(aiBadge); }
      aiBadge.textContent = "AI: " + roomGet() + (st === "wait" ? " …" : ""); aiBadge.style.opacity = st === "on" ? ".85" : ".55";
    };
    setInterval(badge, 1500);
    window.PINDEXIO_AI = {
      on() { aiOn = true; aiConnect(); TRK("ai_on"); }, off() { aiOn = false; clearInterval(aiTimer); if (aiWs) { try { aiWs.close(); } catch (e) { } aiWs = null; } },
      renew() { const was = aiOn; this.off(); aiRoom = newRoom(); try { sessionStorage.setItem(RK, aiRoom); } catch (e) { } if (was) this.on(); },
      room: roomGet, url: () => `${MCP_HTTP}/mcp?room=${roomGet()}`, state: () => aiOn ? (aiWs && aiWs.readyState === 1 ? "on" : "wait") : "off"
    };
  }
})();
