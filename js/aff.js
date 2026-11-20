/* Tra link mua (tiếp thị liên kết) cho mọi món trong danh sách mua: board, module, linh kiện, vật tư.
   Dữ liệu link nằm trong js/affiliates.js (admin ghi đè file đó): theo vùng { links: {mã board}, parts: {mã linh kiện cơ bản}, groups: {mã nhóm} }.
   Thứ tự: link riêng của board / mã → linh kiện cơ bản khớp tên → nhóm khớp tên → link tìm kiếm trên sàn.
   Linh kiện mới chưa có link riêng tự dùng link của nhóm cùng loại (vd board ESP32 lạ → link nhóm "Board ESP32"). */
(function (G) {
  "use strict";
  // linh kiện cơ bản (admin dán link riêng cho từng món); m = mẫu khớp tên / mã (chữ thường)
  const PARTS = [
    { id: "r", vi: "Điện trở (bộ nhiều giá trị)", en: "Resistor kit", m: /(^|[^a-z])(r|res|resistor)([^a-z]|$)|điện trở|^\d+(\.\d+)?\s*[rkm]\d*$|\d\s*(ohm|Ω)/ },
    { id: "c", vi: "Tụ gốm (bộ nhiều giá trị)", en: "Ceramic capacitor kit", m: /tụ gốm|ceramic|^c$|\d+(\.\d+)?\s*[pnu]f$/ },
    { id: "ecap", vi: "Tụ hoá", en: "Electrolytic capacitor", m: /tụ hoá|tụ hóa|electrolytic|ecap/ },
    { id: "led", vi: "LED (bộ nhiều màu)", en: "LED kit", m: /(^|[^a-z])led([^a-z]|$)/ },
    { id: "diode", vi: "Diode 1N4007 / 1N5819", en: "Diode 1N4007 / 1N5819", m: /diode|điốt|1n400\d|1n58\d\d|ss\d\d|zener/ },
    { id: "dw01a", vi: "DW01A (IC bảo vệ pin)", en: "DW01A battery protection IC", m: /dw01/ },
    { id: "fs8205a", vi: "FS8205A (MOSFET kép)", en: "FS8205A dual MOSFET", m: /8205/ },
    { id: "tp4056", vi: "TP4056 (sạc pin)", en: "TP4056 charger", m: /tp4056/ },
    { id: "ams1117", vi: "AMS1117 (ổn áp 3.3V)", en: "AMS1117 regulator", m: /ams1117|lm1117/ },
    { id: "header", vi: "Header 2.54 (đực / cái)", en: "2.54 mm pin headers", m: /header|pinhdr|hàng rào|^j\d*$|^out |^bat / },
    { id: "jst", vi: "Đầu JST / XH", en: "JST / XH connectors", m: /jst|xh2|ph2\.0/ },
    { id: "terminal", vi: "Cầu đấu (terminal block)", en: "Screw terminal block", m: /terminal|cầu đấu|kf301|kf128/ },
  ];
  // nhóm (admin dán 1 link cho cả nhóm); thứ tự = độ ưu tiên khi khớp
  const GROUPS = [
    { id: "esp32", vi: "Board ESP32 / ESP8266", en: "ESP32 / ESP8266 boards", m: /esp32|esp8266|esp-?\d|lilygo|wemos|nodemcu/ },
    { id: "arduino", vi: "Board Arduino", en: "Arduino boards", m: /arduino|uno r\d|nano|mega ?2560|pro mini|leonardo/ },
    { id: "stm32", vi: "Board STM32", en: "STM32 boards", m: /stm32|blue ?pill|black ?pill/ },
    { id: "rpi", vi: "Raspberry Pi / Pico", en: "Raspberry Pi / Pico", m: /raspberry|pico|rp2040|rp2350/ },
    { id: "fr4", vi: "Phíp đồng (FR4)", en: "Copper clad board", m: /phíp|phip|copper clad|fr4/ },
    { id: "solder", vi: "Chì hàn, nhựa thông", en: "Solder & flux", m: /chì hàn|chi han|solder/ },
    { id: "etchant", vi: "Muối ăn mòn mạch", en: "PCB etchant", m: /ăn mòn|an mon|etchant|fecl3/ },
    { id: "breadboard", vi: "Breadboard", en: "Breadboard", m: /breadboard/ },
    { id: "wire", vi: "Dây cắm test", en: "Jumper wires", m: /jumper wire|dây cắm|day cam|dupont/ },
    { id: "battery", vi: "Pin, đế pin", en: "Batteries & holders", m: /battery|18650|lipo|đế pin|pin li/ },
    { id: "mosfet", vi: "MOSFET", en: "MOSFETs", m: /mosfet|irf|irl|2n7002|ao34|si23|8205/ },
    { id: "transistor", vi: "Transistor", en: "Transistors", m: /transistor|2n2222|2n3904|bc547|s8050|to-?92/ },
    { id: "sensor", vi: "Cảm biến", en: "Sensors", m: /sensor|cảm biến|dht|bme|bmp|mpu|hc-sr|ds18b20|ina219/ },
    { id: "display", vi: "Màn hình", en: "Displays", m: /oled|lcd|tft|display|ssd1306|st7789/ },
    { id: "module", vi: "Module (relay, driver, nguồn…)", en: "Modules (relay, driver, power…)", m: /module|mô-đun|relay|l298|tb6612|drv8|buck|boost|lm2596/ },
    { id: "ic", vi: "IC (SOIC, SOT, DIP…)", en: "ICs (SOIC, SOT, DIP…)", m: /(^|[^a-z])ic([^a-z]|$)|soic|sot-?\d|dip-?\d|tssop|qfn|ne555|lm\d{3}|74hc|ch340|opamp|atmega|attiny/ },
    { id: "passive", vi: "Linh kiện thụ động (R, C, L, LED)", en: "Passives (R, C, L, LED)", m: /điện trở|resistor|tụ|capacitor|cuộn cảm|inductor|led/ },
    { id: "connector", vi: "Đầu nối, header", en: "Connectors & headers", m: /header|connector|đầu nối|jst|terminal|pinhdr|usb|socket/ },
  ];
  const norm = s => String(s || "").toLowerCase().trim();
  function region() {
    const A = G.AFFILIATE || {};
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; if (/Ho_Chi_Minh|Saigon|Bangkok|Phnom_Penh/i.test(tz) && A.vn) return "vn"; } catch (e) { }
    return /^vi/i.test(navigator.language || "") && A.vn ? "vn" : "intl";
  }
  const match = (list, txt) => list.find(x => x.m.test(txt));
  /* affUrl({ id, name, query, boardId }, reg?) → { url, aff (true = link tiếp thị), via ("link" | "part" | "group" | "search"), group } */
  function affUrl(it, reg) {
    reg = reg || region();
    const A = (G.AFFILIATE || {})[reg] || {}, links = A.links || {}, parts = A.parts || {}, groups = A.groups || {};
    for (const k of [it.boardId, it.id]) if (k && links[k]) return { url: links[k], aff: true, via: "link" };
    const txt = norm([it.name, it.query, it.id].filter(Boolean).join(" "));
    const p = match(PARTS, norm(it.name)) || match(PARTS, norm(it.id)) || match(PARTS, txt);
    if (p && parts[p.id]) return { url: parts[p.id], aff: true, via: "part", part: p.id };
    const g = match(GROUPS, txt);
    if (g && groups[g.id]) return { url: groups[g.id], aff: true, via: "group", group: g.id };
    const q = encodeURIComponent(String(it.query || it.name || "").replace(/\s*\([^)]*\)/g, "").trim() || it.name || "");
    return { url: reg === "vn" ? "https://shopee.vn/search?keyword=" + q : "https://www.aliexpress.com/wholesale?SearchText=" + q, aff: false, via: "search", group: g && g.id, part: p && p.id };
  }
  G.AFF_PARTS = PARTS; G.AFF_GROUPS = GROUPS; G.affUrl = affUrl; G.affRegion = region;
})(typeof window !== "undefined" ? window : globalThis);
