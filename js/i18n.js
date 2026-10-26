/* Song ngữ Việt – Anh cho phần giao diện. Cách làm: khi chọn EN, dịch mọi text node / placeholder / aria-label
   khớp nguyên văn trong từ điển (kể cả phần vẽ lại sau này, nhờ MutationObserver). Nội dung kỹ thuật dài của
   từng chân/board vẫn giữ tiếng Việt. Thêm câu mới: thêm cặp "tiếng Việt": "English" vào EN. */
(function () {
  const EN = {
    "Thông tin chân & datasheet board": "Pin info & board datasheets", "⤴ Chia sẻ board này": "⤴ Share this board", "Ghép module": "Build with modules", "Tín hiệu ra": "Output", "Tín hiệu vào": "Input", "I2S data": "I2S data", "Module": "Modules", "Copy #define": "Copy #define",
    "⬇ Ảnh PNG": "⬇ PNG image", "⬇ File .json": "⬇ .json file", "🔗 Link": "🔗 Link", "⬆ Mở .json": "⬆ Open .json",
    "Chọn module: app tự gán chân an toàn (✓). Đổi chân bằng danh sách, hoặc bấm ☝ rồi chạm chân trên board (vòng xanh = an toàn, cam = có lưu ý).": "Pick modules: the app assigns safe pins (✓). Change a pin from the list, or press ☝ then tap a board pin (green ring = safe, orange = caution).",
    "Board chạy logic 3.3 V: không nối thẳng tín hiệu 5 V vào GPIO.": "This board uses 3.3 V logic: never wire 5 V signals straight into a GPIO.",
    "Bus I2C dùng chung: cần pull-up 4.7 kΩ trên SDA/SCL (nhiều module đã có sẵn).": "Shared I2C bus: needs 4.7 kΩ pull-ups on SDA/SCL (many modules include them).", "Chia sẻ": "Share", "Hổ phách": "Amber", "Qua GPIO matrix": "Via GPIO matrix", "IO MUX (FSPI) hoặc GPIO matrix": "IO MUX (FSPI) or GPIO matrix",
    "SoC + Flash + PSRAM (Octal) + anten PCB": "SoC + Flash + PSRAM (Octal) + PCB antenna", "R tính =": "Calculated R =", "→ chọn E24": "→ E24 pick", "→ chọn": "→ pick",
    "R1 tính =": "Calculated R1 =", "Vout tại Vin max =": "Vout at Vin max =", "Gợi ý:": "Suggested:", "Tần số cắt lọc thông thấp f = 1/(2πRC) =": "Low-pass cutoff f = 1/(2πRC) =", "Sơ đồ chân": "Pinout", "Tính toán": "Calculators", "Tài liệu": "Docs",
    "Kiến trúc": "Architecture", "Schematic hãng": "Official schematic", "Tìm chân: 8, ADC, SDA, TX…": "Find pin: 8, ADC, SDA, TX…",
    "Thu nhỏ": "Zoom out", "Phóng to": "Zoom in", "Đóng": "Close", "Giao diện sáng": "Light mode", "Giao diện tối": "Dark mode",
    "Thông số chip": "Chip specs", "Linh kiện đi kèm khi tự làm mạch": "Companion parts for custom boards",
    "Điện trở LED": "LED resistor", "V nguồn (V)": "Supply (V)", "Dòng (mA)": "Current (mA)", "Phân áp cho ADC": "ADC voltage divider",
    "Pull-up I2C": "I2C pull-up", "Tốc độ": "Speed", "C bus (pF)": "Bus C (pF)", "Mạch RC (reset trễ / lọc)": "RC circuit (reset delay / filter)",
    "Vf tham khảo: đỏ 1.8–2.2 V · xanh lá 2.0–3.2 V · xanh dương/trắng 2.8–3.3 V.": "Typical Vf: red 1.8–2.2 V · green 2.0–3.2 V · blue/white 2.8–3.3 V.",
    "ESP32 (atten 11–12 dB) đo tốt tới ~2.5–3.1 V · Pico 3.3 V · Uno 5 V.": "ESP32 (11–12 dB atten) reads well up to ~2.5–3.1 V · Pico 3.3 V · Uno 5 V.",
    "Mỗi thiết bị ~10 pF, dây ~50–100 pF/m.": "Each device ~10 pF, wiring ~50–100 pF/m.",
    "Espressif gợi ý R 10 kΩ + C 1 µF cho chân EN.": "Espressif recommends R 10 kΩ + C 1 µF on the EN pin.",
    "Link trỏ thẳng tới tài liệu gốc của hãng. Dữ liệu trong app tóm tắt từ các tài liệu này; khi thiết kế mạch thật, kiểm tra lại bản mới nhất.": "Links go straight to the manufacturers' original documents. App data is summarised from them; check the latest revision before designing real hardware.",
    "Kéo để di chuyển · chụm 2 ngón / cuộn chuột để zoom · chạm đúp để phóng to": "Drag to pan · pinch / scroll to zoom · double-tap to zoom in",
    // panel chi tiết
    "Board": "Board", "Tài liệu hãng": "Manufacturer docs", "Linh kiện đi kèm": "Companion parts", "Ghi chú": "Notes",
    "Chạm vào một chân trên hình để xem chức năng, cảnh báo và linh kiện gợi ý.": "Tap a pin to see its functions, warnings and suggested parts.",
    "✅ Dùng tự do": "✅ Free to use", "⚠ Dùng được nhưng cần chú ý": "⚠ Usable with care", "⛔ Không dùng làm GPIO": "⛔ Do not use as GPIO", "ℹ Chân nguồn / điều khiển": "ℹ Power / control pin",
    "Mức logic": "Logic level", "Dòng ra": "Drive current", "Pull nội": "Internal pull", "Ngoại vi số": "Digital peripherals",
    "Logic": "Logic", "Dòng mỗi chân": "Current per pin", "Nguồn vào": "Power input", "Nạp": "Flashing", "Kích thước": "Size", "Nguồn": "Power",
    "Màn hình": "Display", "Lưu ý": "Note", "Nút": "Button", "Header": "Header", "Đánh số": "Numbering", "Dùng nội bộ": "Used internally", "Nội bộ": "Internal",
    "Nguyên lý": "How it works", "Ứng dụng": "Applications", "▲ Ưu điểm": "▲ Pros", "▼ Nhược điểm": "▼ Cons", "Ví dụ nối dây": "Wiring example",
    "Datasheet": "Datasheet", "Manual": "Manual", "Hướng dẫn": "Guide", "Thông lệ": "Common practice",
    // nhãn loại chân / bộ lọc
    "Nguồn": "Power", "GPIO": "GPIO", "Analog": "Analog", "UART/I2C": "UART/I2C", "Strapping ⚠": "Strapping ⚠", "Dành riêng": "Reserved", "Điều khiển": "Control",
    "Mặt trước": "Front", "Sơ đồ khối board: khối ngoại vi và bus/chân nối vào chip": "Board block diagram: peripherals and the buses/pins to the chip",
    // tab thông số
    "Boot / Strapping": "Boot / Strapping", "Nguồn & giới hạn": "Power & limits", "Dòng tiêu thụ": "Current draw", "Ngoại vi": "Peripherals",
    "CPU & bộ nhớ": "CPU & memory", "Biến thể chip": "Chip variants", "Wi-Fi & BLE": "Wi-Fi & BLE"
  };
  const RX = [
    [/^(\d+)\/(\d+) chân khớp$/, "$1/$2 pins match"], [/^(\d+) chân$/, "$1 pins"], [/^Chân trên (.+) \((\d+)\)$/, "Pins on $1 ($2)"],
    [/^Kiến thức · (.+)$/, "Learn · $1"], [/^Xem tất cả (\d+) linh kiện$/, "Show all $1 components"], [/^Đã xoá dây (.+)$/, "Removed wire $1"], [/^Đã xoá (.+)$/, "Removed $1"], [/^Linh kiện · (.+) · nguồn (.+)$/, "Component · $1 · power $2"], [/^📄 Nguồn: /, "📄 Source: "], [/^Nguồn: /, "Source: "], [/^Ảnh board: /, "Board photo: "]
  ];
  let lang = "vi";
  try { lang = localStorage.getItem("lang") || "vi"; } catch (e) { }
  if (window.PAGE_LANG) lang = window.PAGE_LANG; // trang /en/… luôn mở tiếng Anh, trang thường luôn tiếng Việt
  const orig = new WeakMap();
  const D = k => EN[k] != null ? EN[k] : (window.EN_DATA || {})[k];
  const tr = s => {
    const k = s.trim(); if (!k) return null;
    const d = D(k); if (d != null) return s.replace(k, d);
    const m = k.match(/^📄 Nguồn: (.+?)( ·)?$/); if (m) return s.replace(k, "📄 Source: " + (D(m[1]) ?? m[1]) + (m[2] || ""));
    for (const [r, v] of RX) if (r.test(k)) return s.replace(k, k.replace(r, v));
    // chuỗi ghép "a · b · c": dịch từng đoạn nếu có
    if (k.includes(" · ")) { const parts = k.split(" · "), out = parts.map(x => D(x) ?? x); if (out.some((x, i) => x !== parts[i])) return s.replace(k, out.join(" · ")); }
    return null;
  };
  function fixNode(n) {
    if (n.nodeType === 3) {
      if (!orig.has(n)) orig.set(n, n.nodeValue);
      const o = orig.get(n), en = lang === "en" ? tr(o) : null;
      const want = en || o; if (n.nodeValue !== want) n.nodeValue = want;
    } else if (n.nodeType === 1) {
      for (const at of ["placeholder", "aria-label", "title"]) if (n.hasAttribute && n.hasAttribute(at)) {
        const key = "data-o-" + at; if (!n.hasAttribute(key)) n.setAttribute(key, n.getAttribute(at));
        const o = n.getAttribute(key), en = lang === "en" ? tr(o) : null; n.setAttribute(at, en || o);
      }
      if (n.nodeName === "SCRIPT" || n.nodeName === "STYLE") return;
      n.childNodes.forEach(fixNode);
    }
  }
  const run = () => fixNode(document.body);
  new MutationObserver(ms => { if (lang === "en") ms.forEach(m => m.addedNodes.forEach(fixNode)); }).observe(document.documentElement, { childList: true, subtree: true });
  window.setLang = l => {
    lang = l; document.documentElement.lang = l;
    try { localStorage.setItem("lang", l); } catch (e) { }
    document.querySelectorAll("#langSw button").forEach(b => b.setAttribute("aria-pressed", b.dataset.l === l));
    run();
    if (window.onLangChange) window.onLangChange();
  };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("#langSw button").forEach(b => b.onclick = () => setLang(b.dataset.l));
    setLang(lang);
  });
})();
