/* Dữ liệu board. Thêm board mới: viết một object theo mẫu rồi push vào BOARDS.
   Toạ độ tính bằng mm, nhìn từ mặt trên, gốc (0,0) ở góc trên-trái của PCB.
   header.side: phía đặt nhãn (L/R/T/B); header.at: mép trong của nhãn (mm).
   src cho linh kiện gợi ý: "ds" = datasheet hãng, "hdg" = hardware design guideline, "std" = thực hành phổ biến. */
(function () {
  const PITCH = 2.54;
  const pin = (name, o = {}) => ({ name, gpio: null, cat: "gpio", fn: [], flags: [], warn: null, notes: [], parts: [], ...o });
  const pw = (name, fn, warn, o) => pin(name, { cat: "power", fn: [fn], warn, ...o });
  const gnd = (name = "GND") => pin(name, { cat: "gnd", fn: ["Ground"], notes: ["Mass chung."] });
  const ctl = (name, fn, warn, o) => pin(name, { cat: "ctl", fn: [fn], warn, ...o });
  const vcol = (x, y0, list, step = PITCH) => list.map((p, i) => ({ ...p, x, y: y0 + i * step }));
  const at = (list, coords) => list.map((p, i) => ({ ...p, x: coords[i][0], y: coords[i][1] }));
  const i2cPull = ["Nếu làm I2C", "Pull-up ngoài 4.7 kΩ (100 kHz) hoặc 2.2 kΩ (400 kHz) lên 3V3", "std"];

  /* ---------------- ESP32-S3-DevKitC-1 ---------------- */
  function s3(n) {
    const p = pin("IO" + n, { gpio: n });
    if (n >= 1 && n <= 10) { p.fn.push("ADC1_CH" + (n - 1)); p.flags.push("adc"); }
    if (n >= 11 && n <= 20) { p.fn.push("ADC2_CH" + (n - 11)); p.flags.push("adc"); p.adc2 = true; }
    if (n >= 1 && n <= 14) { p.fn.push("TOUCH" + n); p.flags.push("touch"); }
    if (n === 19) { p.fn.push("USB_D-"); p.flags.push("usb"); }
    if (n === 20) { p.fn.push("USB_D+"); p.flags.push("usb"); }
    if (n === 43) { p.name = "TX"; p.fn.push("U0TXD", "GPIO43"); p.flags.push("uart"); }
    if (n === 44) { p.name = "RX"; p.fn.push("U0RXD", "GPIO44"); p.flags.push("uart"); }
    if ([0, 3, 45, 46].includes(n)) p.flags.push("strap");
    if ([35, 36, 37].includes(n)) { p.flags.push("ban"); p.fn.push("SPIIO" + (n - 29) + " (Octal PSRAM)"); }
    if (n >= 39 && n <= 42) { p.fn.push(["MTCK", "MTDO", "MTDI", "MTMS"][n - 39]); p.flags.push("jtag"); }
    const MUX = { 9: "FSPIHD", 10: "FSPICS0", 11: "FSPID", 12: "FSPICLK", 13: "FSPIQ", 14: "FSPIWP", 15: "U0RTS · XTAL_32K_P", 16: "U0CTS · XTAL_32K_N", 17: "U1TXD", 18: "U1RXD", 47: "SPICLK_P_DIFF", 48: "SPICLK_N_DIFF" };
    if (MUX[n]) p.fn.push(MUX[n]);
    if (n >= 9 && n <= 14) p.flags.push("spi");
    const ARD = { 8: "Arduino SDA", 9: "Arduino SCL", 10: "Arduino SS", 11: "Arduino MOSI", 12: "Arduino SCK", 13: "Arduino MISO" };
    if (ARD[n]) { p.fn.push(ARD[n]); p.flags.push(n < 10 ? "i2c" : "spi"); }
    if (n === 48) { p.fn.push("RGB LED (v1.0)"); p.flags.push("led"); }
    if (n === 38) { p.fn.push("RGB LED (v1.1)"); p.flags.push("led"); }
    if ((n >= 1 && n <= 14) || n === 17) p.notes.push("Có xung LOW ~60 µs lúc cấp nguồn. Tránh điều khiển thứ cần im lặng khi khởi động (relay, MOSFET công suất).");
    if (n === 15 || n === 16) p.notes.push("Có xung LOW ~60 µs lúc cấp nguồn. Dùng làm chân thạch anh 32 kHz nếu cần RTC chính xác.");
    p.notes.push("Dòng drive mặc định: " + (n === 17 || n === 18 ? "10 mA" : n === 19 || n === 20 ? "40 mA" : "20 mA") + ".");
    if (n >= 9 && n <= 14) p.notes.push("Chân IO MUX của SPI2 (FSPI): chạy được 80 MHz. Qua GPIO matrix tối đa 60 MHz.");
    if (n === 47 || n === 48) p.notes.push("Với chip VDD_SPI 1.8 V (R8V, R16V) chân này chạy ở 1.8 V.");
    const w = {
      0: "Strapping: LOW lúc boot = chế độ nạp firmware. Nút BOOT nối vào chân này.",
      3: "Strapping: chọn nguồn tín hiệu JTAG. Tránh kéo cứng lúc boot.",
      45: "Strapping: chọn điện áp VDD_SPI. Sai mức có thể làm Flash/PSRAM không chạy.",
      46: "Strapping: cùng GPIO0 chọn chế độ boot và điều khiển log ROM. Giữ LOW lúc khởi động.",
      19: "USB D- của cổng USB native. Dùng làm GPIO sẽ mất USB/JTAG qua cổng này.",
      20: "USB D+ của cổng USB native. Dùng làm GPIO sẽ mất USB/JTAG qua cổng này.",
      43: "UART0 TX: log và nạp qua cổng UART. Nên để nguyên.", 44: "UART0 RX: nạp qua cổng UART. Nên để nguyên."
    };
    if (w[n]) p.warn = w[n];
    if ([35, 36, 37].includes(n)) p.warn = "Bản có Octal PSRAM (N8R8, N16R8…) dùng chân này cho PSRAM. Không dùng làm GPIO.";
    if (p.adc2 && !p.warn) p.warn = "ADC2 không đọc được khi Wi-Fi đang bật. Cần ADC thì ưu tiên ADC1 (IO1–IO10).";
    p.cat = p.flags.includes("ban") ? "ban" : p.flags.includes("strap") ? "strap" : p.flags.includes("usb") ? "usb" : p.flags.includes("uart") ? "comm" : p.flags.includes("adc") ? "adc" : "gpio";
    if (n === 0) p.parts.push(["Pull-up", "Board đã có điện trở kéo lên cùng nút BOOT", "hdg"], ["Tránh", "Không gắn tụ lớn lên GPIO0, dễ làm chip vào chế độ nạp", "hdg"]);
    if (n === 46) p.parts.push(["Mức boot", "Pull-down nội mặc định. Nạp: GPIO0=0 và GPIO46=0; boot Flash chỉ cần GPIO0=1", "ds"]);
    if (n === 45) p.parts.push(["Mức boot", "Pull-down nội: 0 → VDD_SPI 3.3 V, 1 → 1.8 V. Giữ đúng mức theo Flash/PSRAM của module", "ds"]);
    if (n === 3) p.parts.push(["Mức boot", "Không có pull nội. Nếu dùng làm nguồn JTAG, mạch ngoài phải giữ mức rõ ràng", "ds"]);
    if (p.flags.includes("adc")) p.parts.push(["Lọc ADC", "Tụ 0.1 µF từ chân xuống GND", "hdg"]);
    if (p.flags.includes("touch")) p.parts.push(["Touch", "Điện trở nối tiếp phía chip 470 Ω – 2 kΩ, nên dùng 510 Ω", "hdg"]);
    if (n === 19 || n === 20) p.parts.push(["USB", "Điện trở nối tiếp 22–33 Ω đặt sát chip", "hdg"]);
    if (n === 43) p.parts.push(["UART TX", "Điện trở nối tiếp 499 Ω", "hdg"]);
    if (p.cat === "gpio" || p.cat === "adc") p.parts.push(i2cPull);
    return p;
  }
  const s3pw = {
    "3V3": () => pw("3V3", "Ngõ ra LDO 3.3V", "Ngõ ra LDO 3.3V. Giữ tổng dòng ngoại vi dưới ~500 mA.", { parts: [["Tụ", "≥10 µF tại đầu vào nguồn + 0.1 µF sát chân", "hdg"]] }),
    "5V": () => pw("5V", "5V từ USB", "Nối 5V từ USB. Không đưa 5V vào bất kỳ GPIO nào."),
    RST: () => ctl("RST", "CHIP_PU / EN", "Kéo LOW để reset chip. Nối với nút RST.", { parts: [["RC trễ", "R = 10 kΩ lên 3V3, C = 1 µF xuống GND", "hdg"]] }),
    G: () => gnd()
  };
  const s3mk = x => typeof x === "number" ? s3(x) : s3pw[x]();
  const S3L = ["3V3", "3V3", "RST", 4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14, "5V", "G"];
  const S3R = ["G", 43, 44, 1, 2, 42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19, "G", "G"];

  const ESP32_S3 = {
    id: "esp32-s3-devkitc-1",
    arch: { core: "ESP32-S3-WROOM-1", coreSub: "SoC + Flash + PSRAM (Octal) + anten PCB", blocks: [
      { side: "L", n: "Cổng Micro-USB UART", s: "5V + D+/D−", k: "usb", bus: "USB" },
      { side: "L", n: "USB-UART Bridge", s: "CP2102N / CH343", k: "comm", bus: "UART0 IO43/IO44" },
      { side: "L", n: "Cổng Micro-USB native", s: "USB OTG / Serial-JTAG", k: "usb", bus: "IO19 D− · IO20 D+" },
      { side: "L", n: "LDO 3.3 V", s: "5V → 3V3, ~1 A", k: "power", bus: "3V3" },
      { side: "R", n: "RGB LED", s: "WS2812", k: "io", bus: "IO48 (v1.0) / IO38 (v1.1)" },
      { side: "R", n: "Nút BOOT", s: "kéo xuống GND", k: "ctl", bus: "IO0" },
      { side: "R", n: "Nút RST", s: "RC 10 kΩ + 1 µF", k: "ctl", bus: "EN / CHIP_PU" },
      { side: "R", n: "Header J1 + J3", s: "2 × 22 chân", k: "io", bus: "GPIO" }] },
    elec: [["Mức logic", "3.3 V (không chịu 5 V)"], ["VIH / VIL", "≥0.75·VDD / ≤0.25·VDD"], ["Dòng ra", "cấp 40 mA · hút 28 mA"], ["Pull nội", "45 kΩ"], ["Ngoại vi số", p => p.flags.includes("spi") && p.gpio <= 14 ? "IO MUX (FSPI) hoặc GPIO matrix" : "Qua GPIO matrix"]], tag: "S3",
    oem: { by: "Espressif Systems", file: "SCH_ESP32-S3-DevKitC-1_V1.1_20221130.pdf", url: "https://dl.espressif.com/dl/schematics/SCH_ESP32-S3-DevKitC-1_V1.1_20221130.pdf", pages: [["sch/esp32-s3-devkitc-1-1.png", "Sơ đồ khối"], ["sch/esp32-s3-devkitc-1-2.png", "Mạch chi tiết"]] }, name: "ESP32-S3-DevKitC-1", vendor: "Espressif", chip: "ESP32-S3 (WROOM-1)", family: "ESP32",
    summary: "Xtensa LX7 2 nhân 240 MHz, Wi-Fi 4 + BLE 5, USB OTG native.",
    w: 25.3, h: 62.7, pcb: "black", logic: "3.3 V",
    facts: [["Logic", "3.3 V, không chịu 5 V"], ["Dòng mỗi chân", "20 mA mặc định, tối đa 40 mA"], ["ADC", "2 × SAR 12-bit, 20 kênh (ADC1: IO1–IO10)"], ["Nguồn vào", "5V qua USB hoặc chân 5V"], ["Nạp", "USB-UART (CP2102/CH343) hoặc USB native"]],
    docs: [
      ["datasheet", "ESP32-S3 Datasheet", "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf"],
      ["datasheet", "ESP32-S3-WROOM-1 Datasheet", "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"],
      ["guide", "DevKitC-1 User Guide (có schematic)", "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide.html"],
      ["guide", "Hardware Design Guidelines – Schematic Checklist", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/schematic-checklist.html"],
      ["manual", "Technical Reference Manual", "https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf"]
    ],
    src: "ESP32-S3 Datasheet chương 2, DevKitC-1 schematic",
    parts: [
      // vị trí đo từ ảnh pin layout v1.1 của Espressif (≈9.3 px/mm)
      { t: "module", x: 3.1, y: -6.5, w: 18.4, h: 25.8, label: "ESP32-S3", sub: "WROOM-1", ant: 6.2 },
      { t: "chip", x: 8.4, y: 22.6, w: 6.2, h: 7, label: "LDO" },
      { t: "led", x: 5.4, y: 30.9, w: 3.8, h: 4.8, color: "#f4f2e6", label: "RGB" },
      { t: "chip", x: 11.1, y: 39.6, w: 4.8, h: 4.8, label: "CP2102", small: true },
      { t: "btn", x: 5, y: 47, w: 4.9, h: 3.2, label: "BOOT" },
      { t: "btn", x: 15.4, y: 47, w: 4.9, h: 3.2, label: "RST" },
      { t: "usb", x: 2, y: 56.2, w: 7.5, h: 7, label: "UART" },
      { t: "usb", x: 15.4, y: 56.2, w: 7.5, h: 7, label: "USB" }
    ],
    headers: [
      { id: "J1", side: "L", at: -1.6, pins: vcol(1.18, 1.18, S3L.map(s3mk)) },
      { id: "J3", side: "R", at: 26.9, pins: vcol(24.04, 1.18, S3R.map(s3mk)) }
    ]
  };

  /* ---------------- ESP32-C3-DevKitM-1 (Espressif) ----------------
     Chân & ghi chú theo ESP32-C3 Series Datasheet v2.4; vị trí linh kiện đo từ ảnh pin layout chính thức. */
  function c3(n) {
    const p = pin("IO" + n, { gpio: n });
    if (n <= 4) { p.fn.push("ADC1_CH" + n); p.flags.push("adc"); }
    if (n === 5) { p.fn.push("ADC2_CH0"); p.flags.push("adc"); p.warn = "ADC2 trên ESP32-C3 không ổn định (xem errata). Cần đo analog thì dùng IO0–IO4 (ADC1)."; }
    if (n === 0) p.fn.push("XTAL_32K_P");
    if (n === 1) p.fn.push("XTAL_32K_N");
    const MUX = { 2: "FSPIQ", 4: "FSPIHD · MTMS", 5: "FSPIWP · MTDI", 6: "FSPICLK · MTCK", 7: "FSPID · MTDO", 10: "FSPICS0", 18: "USB_D-", 19: "USB_D+", 20: "U0RXD", 21: "U0TXD" };
    if (MUX[n]) p.fn.push(MUX[n]);
    if (n >= 4 && n <= 7) p.flags.push("jtag");
    if (n === 18 || n === 19) p.flags.push("usb");
    const ARD = { 4: "Arduino SCK", 5: "Arduino MISO", 6: "Arduino MOSI", 7: "Arduino SS", 8: "Arduino SDA", 9: "Arduino SCL" };
    if (ARD[n]) { p.fn.push(ARD[n]); p.flags.push(n >= 8 ? "i2c" : "spi"); }
    if (n === 20 || n === 21) { p.flags.push("uart"); p.name = n === 20 ? "RX" : "TX"; p.fn.push("IO" + n); }
    if ([2, 8, 9].includes(n)) p.flags.push("strap");
    if (n === 8) { p.fn.push("RGB LED (WS2812)"); p.flags.push("led"); }
    if (n === 9) p.fn.push("Nút BOOT");
    const w = {
      2: "Strapping: thả nổi lúc reset. Datasheet khuyên kéo lên HIGH (chống nhiễu) để vào đúng chế độ boot.",
      8: "Strapping: thả nổi lúc reset; phải HIGH khi vào chế độ nạp, đồng thời điều khiển việc in log ROM. Có RGB LED trên chân này.",
      9: "Strapping: pull-up yếu mặc định. LOW lúc reset = chế độ nạp (nút BOOT). Không gắn tải kéo LOW.",
      18: "USB D− của USB Serial/JTAG. Dùng làm GPIO phải tắt chức năng USB; có xung HIGH ~50 µs lúc cấp nguồn.",
      19: "USB D+ của USB Serial/JTAG. Dùng làm GPIO phải tắt chức năng USB.",
      20: "UART0 RX nối chip USB-UART CP2102 trên board: dùng để nạp và log. Nên để nguyên.",
      21: "UART0 TX nối chip USB-UART CP2102 trên board: chip in log ROM ra đây lúc khởi động. Nên để nguyên."
    };
    if (w[n]) p.warn = w[n];
    const drv = [2, 3, 4, 5].includes(n) ? 10 : n === 18 || n === 19 ? 40 : 20;
    p.notes.push(`Dòng drive mặc định: ${drv} mA.`);
    if ([6, 7, 10, 20].includes(n)) p.notes.push("Có xung LOW ~5 ns lúc cấp nguồn (Bảng 2-2).");
    if (n === 0 || n === 1) p.notes.push("Có thể gắn thạch anh 32.768 kHz cho RTC chính xác.");
    p.cat = p.flags.includes("strap") ? "strap" : p.flags.includes("usb") ? "usb" : p.flags.includes("uart") ? "comm" : p.flags.includes("adc") ? "adc" : "gpio";
    if (p.flags.includes("adc")) p.parts.push(["Lọc ADC", "Tụ 0.1 µF từ chân xuống GND", "hdg"]);
    if (n === 2 || n === 8) p.parts.push(["Pull-up", "10 kΩ lên 3V3 để giữ HIGH lúc boot", "ds"]);
    if (n === 9) p.parts.push(["Nút nhấn", "Nút nối xuống GND, dùng pull-up nội/ngoài (giống nút BOOT)", "std"]);
    if (n === 21) p.parts.push(["UART TX", "Điện trở nối tiếp 499 Ω", "hdg"]);
    if (p.cat === "gpio" || p.cat === "adc") p.parts.push(i2cPull);
    return p;
  }
  const c3pw = {
    "3V3": () => pw("3V3", "Ngõ ra LDO 3.3 V", "Ngõ ra LDO 3.3 V của board. Chip cần nguồn ≥ 0.5 A.", { parts: [["Tụ", "≥10 µF tại đầu vào nguồn + 0.1 µF sát chân", "hdg"]] }),
    "5V": () => pw("5V", "5V từ USB", "Nối 5V từ cổng Micro-USB. Không đưa 5V vào bất kỳ GPIO nào."),
    RST: () => ctl("RST", "CHIP_EN", "Kéo LOW để reset chip. Nối với nút RST.", { parts: [["RC trễ", "R = 10 kΩ lên 3V3, C = 1 µF xuống GND", "hdg"]] }),
    G: () => gnd()
  };
  const c3mk = x => typeof x === "number" ? c3(x) : c3pw[x]();
  const C3J1 = ["G", "3V3", "3V3", 2, 3, "G", "RST", "G", 0, 1, 10, "G", "5V", "5V", "G"];
  const C3J3 = ["G", 21, 20, "G", 9, 8, "G", 7, 6, 5, 4, "G", 18, 19, "G"];
  const ESP32_C3 = {
    id: "esp32-c3-devkitm-1", tag: "C3", name: "ESP32-C3-DevKitM-1", vendor: "Espressif", chip: "ESP32-C3 (MINI-1)", family: "ESP32",
    oem: { by: "Espressif Systems", file: "SCH_ESP32-C3-DEVKITM-1_V1_20200915A.pdf", url: "https://dl.espressif.com/dl/schematics/SCH_ESP32-C3-DEVKITM-1_V1_20200915A.pdf", pages: [["sch/esp32-c3-devkitm-1-1.png", "Schematic trang 1"], ["sch/esp32-c3-devkitm-1-2.png", "Schematic trang 2"]] },
    elec: [["Mức logic", "3.3 V (không chịu 5 V)"], ["VIH / VIL", "≥0.75·VDD / ≤0.25·VDD"], ["Dòng ra", "cấp 40 mA · hút 28 mA"], ["Pull nội", "45 kΩ"], ["Ngoại vi số", "IO MUX hoặc GPIO matrix"]],
    arch: { core: "ESP32-C3-MINI-1", coreSub: "SoC + 4 MB flash + anten PCB", blocks: [
      { side: "L", n: "Cổng Micro-USB", s: "5V + D+/D−", k: "usb", bus: "USB" },
      { side: "L", n: "USB-UART Bridge", s: "CP2102N, tới 3 Mbps", k: "comm", bus: "UART0 IO20/IO21" },
      { side: "L", n: "LDO 3.3 V", s: "5V → 3V3", k: "power", bus: "3V3" },
      { side: "L", n: "LED nguồn 5V", s: "sáng khi cắm USB", k: "power", bus: "5V" },
      { side: "R", n: "RGB LED", s: "WS2812", k: "io", bus: "IO8" },
      { side: "R", n: "Nút BOOT", s: "kéo xuống GND", k: "ctl", bus: "IO9" },
      { side: "R", n: "Nút RST", s: "RC 10 kΩ + 1 µF", k: "ctl", bus: "CHIP_EN" },
      { side: "R", n: "Header J1 + J3", s: "2 × 15 chân", k: "io", bus: "GPIO" }] },
    summary: "RISC-V 1 nhân 160 MHz, 400 KB SRAM, 4 MB flash, Wi-Fi 4 + BLE 5, USB Serial/JTAG.",
    w: 25, h: 39, pcb: "black", logic: "3.3 V",
    facts: [["Logic", "3.3 V, không chịu 5 V"], ["Dòng mỗi chân", "20 mA mặc định (IO2–IO5: 10 mA), tối đa 40 mA"], ["ADC", "2 × SAR 12-bit, 6 kênh (ADC1: IO0–IO4)"], ["Nguồn vào", "5V qua Micro-USB hoặc chân 5V"], ["Nạp", "USB-UART (CP2102N) hoặc USB Serial/JTAG (IO18/IO19)"]],
    docs: [
      ["datasheet", "ESP32-C3 Series Datasheet v2.4", "https://documentation.espressif.com/esp32-c3_datasheet_en.pdf"],
      ["datasheet", "ESP32-C3-MINI-1 Datasheet", "https://www.espressif.com/sites/default/files/documentation/esp32-c3-mini-1_datasheet_en.pdf"],
      ["guide", "DevKitM-1 User Guide", "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html"],
      ["schematic", "DevKitM-1 Schematic", "https://dl.espressif.com/dl/schematics/SCH_ESP32-C3-DEVKITM-1_V1_20200915A.pdf"],
      ["guide", "ESP32-C3 Hardware Design Guidelines", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32c3/index.html"],
      ["manual", "ESP32-C3 Technical Reference Manual", "https://www.espressif.com/sites/default/files/documentation/esp32-c3_technical_reference_manual_en.pdf"],
      ["errata", "ESP32-C3 Errata", "https://www.espressif.com/sites/default/files/documentation/esp32-c3_errata_en.pdf"]
    ],
    src: "ESP32-C3 Series Datasheet v2.4 chương 2–3, DevKitM-1 User Guide",
    parts: [
      { t: "module", x: 6.2, y: -3.6, w: 12.6, h: 16.4, label: "ESP32-C3", sub: "MINI-1", ant: 4.4 },
      { t: "chip", x: 8.3, y: 16.8, w: 4.4, h: 5, label: "LDO", small: true },
      { t: "led", x: 17.4, y: 15.6, w: 3, h: 3, color: "#f4f2e6", label: "RGB" },
      { t: "chip", x: 8.3, y: 23.6, w: 4.4, h: 4.4, label: "CP2102", small: true },
      { t: "led", x: 3.6, y: 26.6, w: 1, h: 1.6, color: "#ff4d4d", label: "5V" },
      { t: "btn", x: 3.4, y: 31.5, w: 4, h: 5.6, label: "BOOT" },
      { t: "btn", x: 17.8, y: 31.5, w: 4, h: 5.6, label: "RST" },
      { t: "usb", x: 9.4, y: 32.6, w: 6.4, h: 7, label: "µUSB" }
    ],
    headers: [
      { id: "J1", side: "L", at: -1.6, pins: vcol(1, 1.6, C3J1.map(c3mk)) },
      { id: "J3", side: "R", at: 26.6, pins: vcol(23.9, 1.6, C3J3.map(c3mk)) }
    ]
  };

  /* ---------------- Raspberry Pi Pico 2 W ---------------- */
  function rp(n) {
    const p = pin("GP" + n, { gpio: n });
    const uart = ((n >> 2) & 1) ^ ((n >> 3) & 1);
    p.fn.push("UART" + uart + " " + ["TX", "RX", "CTS", "RTS"][n % 4]);
    if (n % 4 < 2) p.flags.push("uart");
    p.fn.push("I2C" + ((n >> 1) & 1) + " " + (n % 2 ? "SCL" : "SDA")); p.flags.push("i2c");
    p.fn.push("SPI" + ((n >> 3) & 1) + " " + ["RX", "CSn", "SCK", "TX"][n % 4]); p.flags.push("spi");
    p.fn.push("PWM" + ((n >> 1) & 7) + " " + (n % 2 ? "B" : "A")); p.flags.push("pwm");
    p.fn.push("PIO0/1/2");
    if (n >= 26) { p.fn.unshift("ADC" + (n - 26)); p.flags.push("adc"); p.notes.push("Chân ADC không chịu 5 V. Dải đo 0 – ADC_VREF (mặc định 3.3 V)."); }
    p.cat = n >= 26 ? "adc" : "gpio";
    if (n === 0 || n === 1) { p.notes.push("UART0 mặc định của SDK/MicroPython."); p.cat = "comm"; }
    if (n === 4 || n === 5) p.notes.push("I2C0 mặc định của Pico SDK (SDA GP4, SCL GP5).");
    p.notes.push("Theo datasheet RP2350, GPIO thường (trừ chân ADC) chịu được 5 V khi IOVDD đang được cấp; nên vẫn giao tiếp ở 3.3 V.");
    p.notes.push("Errata RP2350-E9: bật pull-down nội cho input có thể bị kẹt ~2 V. Cần pull-down thì dùng điện trở ngoài ≤ 8.2 kΩ.");
    if (n >= 26) p.parts.push(["Lọc ADC", "RC: 1 kΩ nối tiếp + 0.1 µF xuống AGND", "std"]);
    else p.parts.push(["Pull-down", "Điện trở ngoài ≤ 8.2 kΩ (do errata E9)", "ds"]);
    p.parts.push(i2cPull);
    return p;
  }
  const PL = [rp(0), rp(1), gnd(), rp(2), rp(3), rp(4), rp(5), gnd(), rp(6), rp(7), rp(8), rp(9), gnd(), rp(10), rp(11), rp(12), rp(13), gnd(), rp(14), rp(15)];
  const PR = [
    pw("VBUS", "5V từ micro-USB", "Điện áp USB (≈5 V) khi có cắm cáp. Không có cáp thì chân này không có điện."),
    pw("VSYS", "Nguồn hệ thống 1.8–5.5 V", "Ngõ vào nguồn chính cho bộ buck-boost. Cấp pin/nguồn ngoài vào đây qua diode Schottky nếu vẫn cắm USB.", { parts: [["Diode", "Schottky (vd. MBR120) từ nguồn ngoài vào VSYS khi dùng chung USB", "ds"]] }),
    gnd(),
    ctl("3V3_EN", "Bật/tắt bộ buck 3.3 V", "Có pull-up sẵn. Kéo xuống GND để tắt 3.3 V (tắt cả RP2350)."),
    pw("3V3", "Ngõ ra 3.3 V (OUT)", "Ngõ ra buck-boost. Datasheet khuyên giữ tải ngoài dưới 300 mA."),
    pw("ADC_VREF", "Điện áp tham chiếu ADC", "Mặc định nối 3.3 V qua lọc. Có thể cấp tham chiếu ngoài chính xác hơn.", { cat: "adc" }),
    rp(28),
    pin("AGND", { cat: "gnd", fn: ["Mass analog"], notes: ["Mass riêng cho ADC, nối GND chung trên board."] }),
    rp(27), rp(26),
    ctl("RUN", "Reset RP2350", "Kéo LOW để reset. Có pull-up sẵn; gắn nút nhấn xuống GND làm nút reset.", { parts: [["Nút reset", "Nút nhấn RUN → GND", "ds"]] }),
    rp(22), gnd(), rp(21), rp(20), rp(19), rp(18), gnd(), rp(17), rp(16)
  ];
  PR.forEach((p, i) => p.pn = 40 - i); PL.forEach((p, i) => p.pn = i + 1);
  const PD = [
    ctl("SWCLK", "Debug SWD clock", "Cổng debug SWD."),
    gnd(),
    ctl("SWDIO", "Debug SWD data", "Cổng debug SWD.")
  ];
  const PICO2W = {
    id: "pico-2-w", photo: { src: "sch/pico-2-w-board.jpg", credit: "Ảnh board: Raspberry Pi Ltd – Pico 2 W Pinout" },
    arch: { core: "RP2350A", coreSub: "2 × Cortex-M33 / Hazard3, 520 KB SRAM", blocks: [
      { side: "L", n: "Cổng Micro-USB", s: "USB 1.1 device/host", k: "usb", bus: "USB_DP/DM" },
      { side: "L", n: "Buck-boost RT6154", s: "VSYS 1.8–5.5 V → 3V3", k: "power", bus: "3V3" },
      { side: "L", n: "QSPI Flash 4 MB", s: "W25Q32", k: "mem", bus: "QSPI" },
      { side: "L", n: "Thạch anh 12 MHz", s: "XOSC", k: "ctl", bus: "XIN/XOUT" },
      { side: "R", n: "CYW43439", s: "Wi-Fi 4 + BLE 5.2, LED", k: "rf", bus: "SPI: GP23/24/25/29" },
      { side: "R", n: "Nút BOOTSEL", s: "vào chế độ nạp UF2", k: "ctl", bus: "QSPI_SS" },
      { side: "R", n: "Debug SWD", s: "SWCLK / SWDIO", k: "ctl", bus: "SWD" },
      { side: "R", n: "Header 2 × 20", s: "26 GPIO, 3 ADC", k: "io", bus: "GP0–22, 26–28" }] },
    elec: [["Mức logic", "3.3 V (IOVDD)"], ["VIH / VIL", "≥2.0 V / ≤0.8 V"], ["Dòng ra", "chọn 2 / 4 / 8 / 12 mA (mặc định 4 mA)"], ["Pull nội", "~50 kΩ"], ["Ngoại vi số", "Theo bảng function select + PIO bất kỳ"]], tag: "P2W",
    oem: { by: "Raspberry Pi Ltd", file: "pico-2-w-schematic.pdf", url: "https://datasheets.raspberrypi.com/picow/pico-2-w-schematic.pdf", pages: [["sch/pico-2-w-1.png", "Schematic trang 1"], ["sch/pico-2-w-2.png", "Schematic trang 2"], ["sch/pico-2-w-layout-21.png", "Vị trí linh kiện (Datasheet, Phụ lục B)"]] }, name: "Raspberry Pi Pico 2 W", vendor: "Raspberry Pi", chip: "RP2350 + CYW43439", family: "RP2",
    summary: "2 × Cortex-M33 / Hazard3 RISC-V 150 MHz, 520 KB SRAM, 4 MB flash, Wi-Fi 4 + BLE 5.2.",
    w: 21, h: 51, pcb: "green2", logic: "3.3 V",
    facts: [["Logic", "3.3 V (GPIO thường chịu 5 V khi có IOVDD)"], ["Kích thước", "51 × 21 mm, 40 chân bước 2.54 mm"], ["ADC", "12-bit, 3 kênh ra ngoài (GP26–28)"], ["Nguồn", "VSYS 1.8–5.5 V, 3V3 OUT ≤ 300 mA"], ["Dùng nội bộ", "GP23/24/25/29 cho chip Wi-Fi; LED nối WL_GPIO0"], ["PIO", "3 khối PIO × 4 state machine"]],
    docs: [
      ["datasheet", "Pico 2 W Datasheet", "https://datasheets.raspberrypi.com/picow/pico-2-w-datasheet.pdf"],
      ["datasheet", "RP2350 Datasheet", "https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf"],
      ["pinout", "Pico 2 W Pinout (PDF)", "https://datasheets.raspberrypi.com/picow/pico-2-w-pinout.pdf"],
      ["guide", "Hardware design with RP2350", "https://datasheets.raspberrypi.com/rp2350/hardware-design-with-rp2350.pdf"],
      ["guide", "Pico SDK / MicroPython docs", "https://www.raspberrypi.com/documentation/microcontrollers/"]
    ],
    src: "Pico 2 W Datasheet chương 2, RP2350 Datasheet bảng GPIO function",
    parts: [
      { t: "usb", x: 6.5, y: -1.3, w: 8, h: 5.5, label: "µUSB" },
      { t: "btn", x: 7.6, y: 9.5, w: 4.4, h: 3.6, label: "BOOTSEL" },
      { t: "chip", x: 6.8, y: 16.5, w: 7, h: 7, label: "RP2350" },
      { t: "chip", x: 7.4, y: 26, w: 3.6, h: 3.4, label: "FLASH", small: true },
      { t: "shield", x: 4.3, y: 33, w: 12.4, h: 11, label: "CYW43439" },
      { t: "ant", x: 4.3, y: 45, w: 12.4, h: 5, label: "ANT" }
    ],
    headers: [
      { id: "J1", side: "L", at: -1.6, pins: vcol(1.61, 1.37, PL) },
      { id: "J2", side: "R", at: 22.6, pins: vcol(19.39, 1.37, PR) },
      { id: "SWD", side: "B", at: 52.6, pins: PD.map((p, i) => ({ ...p, x: 10.7 + i * 2.65, y: 31.3 })) }
    ]
  };

  /* ---------------- Arduino Uno R3 (xoay dọc, USB ở trên) ---------------- */
  const D = (n, extra = {}) => {
    const p = pin("D" + n, { gpio: n, ...extra });
    const port = n < 8 ? "PD" + n : "PB" + (n - 8);
    p.fn.unshift(port);
    if ([3, 5, 6, 9, 10, 11].includes(n)) { p.fn.push("PWM"); p.flags.push("pwm"); }
    p.notes.push("Logic 5 V. Khuyến nghị ≤ 20 mA mỗi chân, tối đa tuyệt đối 40 mA; tổng VCC/GND ≤ 200 mA.");
    p.parts.push(["LED", "Điện trở 220–330 Ω nối tiếp", "std"]);
    return p;
  };
  const UD = [
    pin("SCL", { cat: "comm", fn: ["I2C SCL (nối chung A5)", "PC5"], flags: ["i2c"], parts: [["Pull-up", "4.7 kΩ lên 5V (hoặc theo mức thiết bị)", "std"]] }),
    pin("SDA", { cat: "comm", fn: ["I2C SDA (nối chung A4)", "PC4"], flags: ["i2c"], parts: [["Pull-up", "4.7 kΩ lên 5V (hoặc theo mức thiết bị)", "std"]] }),
    pw("AREF", "Tham chiếu ADC ngoài", "Chỉ cấp 0–5 V và gọi analogReference(EXTERNAL) trước khi đo. Cấp sai có thể hỏng chip.", { cat: "adc" }),
    gnd(),
    D(13, { fn: ["SPI SCK", "LED L onboard"], flags: ["spi", "led"] }),
    D(12, { fn: ["SPI MISO"], flags: ["spi"] }),
    D(11, { fn: ["SPI MOSI"], flags: ["spi"] }),
    D(10, { fn: ["SPI SS"], flags: ["spi"] }),
    D(9), D(8), D(7), D(6), D(5), D(4),
    D(3, { fn: ["INT1"] }),
    D(2, { fn: ["INT0"] }),
    D(1, { name: "D1/TX", cat: "comm", fn: ["Serial TX"], flags: ["uart"], warn: "Dùng chung với USB-Serial (nạp code & Serial Monitor). Tránh dùng khi đang nạp." }),
    D(0, { name: "D0/RX", cat: "comm", fn: ["Serial RX"], flags: ["uart"], warn: "Dùng chung với USB-Serial. Mạch ngoài trên RX có thể làm nạp code thất bại." })
  ];
  const UDy = [18.796, 21.336, 23.876, 26.416, 28.956, 31.496, 34.036, 36.576, 39.116, 41.656, 45.72, 48.26, 50.8, 53.34, 55.88, 58.42, 60.96, 63.5];
  const A = n => pin("A" + n, { gpio: 14 + n, cat: "adc", fn: ["ADC" + n, "PC" + n, "D" + (14 + n)].concat(n === 4 ? ["I2C SDA"] : n === 5 ? ["I2C SCL"] : []), flags: ["adc"].concat(n >= 4 ? ["i2c"] : []), notes: ["ADC 10-bit, 0–5 V (theo AREF)."], parts: [["Lọc ADC", "Tụ 0.1 µF xuống GND; trở kháng nguồn ≤ 10 kΩ", "ds"]] });
  const UP = [
    pin("NC", { cat: "nc", fn: ["Không kết nối"] }),
    pw("IOREF", "Báo mức logic (5 V)", "Shield đọc chân này để biết board chạy logic 5 V."),
    ctl("RESET", "Reset ATmega328P", "Kéo LOW để reset."),
    pw("3.3V", "Ngõ ra 3.3 V", "Từ LDO nhỏ, tối đa ~50 mA."),
    pw("5V", "Ngõ ra/vào 5 V", "5V ổn áp từ USB hoặc từ jack DC qua LDO. Đừng cấp nguồn ngoài vào đây khi đang cắm USB/jack."),
    gnd(), gnd(),
    pw("VIN", "Ngõ vào 7–12 V", "Cùng nguồn với jack DC (sau diode). Khuyến nghị 7–12 V."),
    A(0), A(1), A(2), A(3), A(4), A(5)
  ];
  const UPy = [27.94, 30.48, 33.02, 35.56, 38.1, 40.64, 43.18, 45.72, 50.8, 53.34, 55.88, 58.42, 60.96, 63.5];
  const UNO = {
    id: "arduino-uno-r3", photo: { src: "sch/arduino-uno-r3-board.jpg", box: [-0.38, -7.0, 54.1, 75.74], credit: "Ảnh board: Arduino – Uno R3 Full Pinout (CC BY-SA 4.0)" },
    arch: { core: "ATmega328P", coreSub: "AVR 8-bit 16 MHz, DIP-28", blocks: [
      { side: "L", n: "Cổng USB-B", s: "5V + D+/D−", k: "usb", bus: "USB" },
      { side: "L", n: "ATmega16U2", s: "USB ↔ Serial", k: "comm", bus: "D0 RX · D1 TX" },
      { side: "L", n: "Jack DC + LDO 5 V", s: "7–12 V → 5 V", k: "power", bus: "5V" },
      { side: "L", n: "LDO 3.3 V", s: "~50 mA", k: "power", bus: "3.3V (header)" },
      { side: "R", n: "Thạch anh 16 MHz", s: "XTAL1/XTAL2", k: "ctl", bus: "PB6/PB7" },
      { side: "R", n: "LED L", s: "qua op-amp đệm", k: "io", bus: "D13" },
      { side: "R", n: "Nút RESET + ICSP", s: "nạp bootloader", k: "ctl", bus: "RESET · SPI" },
      { side: "R", n: "Header Digital/Analog", s: "14 D + 6 A", k: "io", bus: "PD/PB/PC" }] },
    elec: [["Mức logic", "5 V"], ["VIH / VIL", "≥0.6·VCC / ≤0.3·VCC"], ["Dòng ra", "≤20 mA khuyến nghị · 40 mA tối đa"], ["Pull nội", "20–50 kΩ (chỉ pull-up)"], ["Ngoại vi số", "Cố định theo chân"]], tag: "UNO",
    oem: { by: "Arduino", file: "A000066-schematics.pdf", url: "https://docs.arduino.cc/resources/schematics/A000066-schematics.pdf", license: "CC BY-SA 4.0", pages: [["sch/arduino-uno-r3-1.png", "Schematic Uno R3"]] }, name: "Arduino Uno R3", vendor: "Arduino", chip: "ATmega328P", family: "AVR",
    summary: "AVR 8-bit 16 MHz, 32 KB flash, 2 KB SRAM, logic 5 V.",
    w: 53.34, h: 68.58, pcb: "blue", logic: "5 V",
    facts: [["Logic", "5 V"], ["Dòng mỗi chân", "≤ 20 mA khuyến nghị, 40 mA tối đa"], ["ADC", "10-bit, 6 kênh A0–A5"], ["PWM", "D3, D5, D6, D9, D10, D11"], ["Nguồn", "USB 5 V hoặc jack/VIN 7–12 V"]],
    docs: [
      ["datasheet", "Arduino Uno R3 Datasheet", "https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf"],
      ["schematic", "Uno R3 Schematic", "https://docs.arduino.cc/resources/schematics/A000066-schematics.pdf"],
      ["datasheet", "ATmega328P Datasheet (Microchip)", "https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf"],
      ["pinout", "Uno R3 Pinout (PDF)", "https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf"]
    ],
    src: "Arduino Uno R3 Datasheet, ATmega328P Datasheet",
    note: "Board được xoay dọc (cổng USB ở trên) để dễ xem trên điện thoại.",
    parts: [
      { t: "usb", x: 30.5, y: -6.2, w: 12, h: 16, label: "USB-B" },
      { t: "jack", x: 2.8, y: -1.8, w: 9, h: 14, label: "DC" },
      { t: "btn", x: 46.5, y: 3, w: 5, h: 5, label: "RESET" },
      { t: "chip", x: 33.5, y: 14, w: 5, h: 5, label: "16U2", small: true },
      { t: "dip", x: 18, y: 31, w: 8, h: 35, label: "ATmega328P" },
      { t: "led", x: 43.5, y: 26.5, w: 1.6, h: 1, color: "#ffb020", label: "L" },
      { t: "chip", x: 26.5, y: 22, w: 4, h: 2, label: "16M", small: true },
      { t: "hole", x: 2.5, y: 14, r: 1.6 }, { t: "hole", x: 50.7, y: 15.3, r: 1.6 },
      { t: "hole", x: 7.6, y: 66.1, r: 1.6 }, { t: "hole", x: 35.5, y: 66.1, r: 1.6 }
    ],
    headers: [
      { id: "POWER/ANALOG", side: "L", at: -1.6, pins: at(UP, UPy.map(y => [2.54, y])) },
      { id: "DIGITAL", side: "R", at: 54.9, pins: at(UD, UDy.map(y => [50.8, y])) }
    ]
  };

  /* ---------------- Raspberry Pi 4 / 5 – header 40 chân (xoay dọc) ---------------- */
  const g = (n, fns = [], flags = [], o = {}) => pin("GPIO" + n, { gpio: n, fn: fns, flags, notes: ["Logic 3.3 V, KHÔNG chịu 5 V.", "Nên giữ ≤ 16 mA mỗi chân và tổng dòng GPIO nhỏ (≈50 mA)."], parts: [], ...o });
  const PI = {
    1: pw("3V3", "Ngõ ra 3.3 V", "Dùng cho cảm biến nhẹ; tổng tải giữ dưới vài trăm mA."),
    2: pw("5V", "5 V từ nguồn board", "Nối trực tiếp nguồn 5V. Không nối vào GPIO."),
    3: g(2, ["I2C1 SDA"], ["i2c"], { cat: "comm", warn: "Có pull-up cố định 1.8 kΩ lên 3.3 V trên board." }),
    4: pw("5V", "5 V từ nguồn board", "Nối trực tiếp nguồn 5V."),
    5: g(3, ["I2C1 SCL"], ["i2c"], { cat: "comm", warn: "Có pull-up cố định 1.8 kΩ lên 3.3 V trên board." }),
    6: gnd(),
    7: g(4, ["GPCLK0", "1-Wire (mặc định overlay)"]),
    8: g(14, ["UART0 TXD"], ["uart"], { cat: "comm" }),
    9: gnd(),
    10: g(15, ["UART0 RXD"], ["uart"], { cat: "comm" }),
    11: g(17), 12: g(18, ["PCM_CLK", "PWM0"], ["pwm"]), 13: g(27), 14: gnd(),
    15: g(22), 16: g(23), 17: pw("3V3", "Ngõ ra 3.3 V", "Ngõ ra 3.3 V."), 18: g(24),
    19: g(10, ["SPI0 MOSI"], ["spi"]), 20: gnd(), 21: g(9, ["SPI0 MISO"], ["spi"]), 22: g(25),
    23: g(11, ["SPI0 SCLK"], ["spi"]), 24: g(8, ["SPI0 CE0"], ["spi"]), 25: gnd(), 26: g(7, ["SPI0 CE1"], ["spi"]),
    27: g(0, ["ID_SD (EEPROM HAT)"], [], { cat: "ban", warn: "Dành cho EEPROM nhận dạng HAT. Không dùng làm GPIO." }),
    28: g(1, ["ID_SC (EEPROM HAT)"], [], { cat: "ban", warn: "Dành cho EEPROM nhận dạng HAT. Không dùng làm GPIO." }),
    29: g(5), 30: gnd(), 31: g(6), 32: g(12, ["PWM0"], ["pwm"]),
    33: g(13, ["PWM1"], ["pwm"]), 34: gnd(), 35: g(19, ["PCM_FS", "SPI1 MISO", "PWM1"], ["pwm", "spi"]), 36: g(16, ["SPI1 CE2"], ["spi"]),
    37: g(26), 38: g(20, ["PCM_DIN", "SPI1 MOSI"], ["spi"]), 39: gnd(), 40: g(21, ["PCM_DOUT", "SPI1 SCLK"], ["spi"])
  };
  for (const k in PI) { PI[k].pn = +k; if (PI[k].gpio !== null && !PI[k].parts.length) PI[k].parts.push(["Bảo vệ", "Điện trở nối tiếp 330 Ω – 1 kΩ khi nối ra ngoài", "std"]); }
  const odd = [], even = [];
  for (let c = 0; c < 20; c++) { odd.push({ ...PI[2 * c + 1], x: 51.23, y: 8.37 + c * PITCH }); even.push({ ...PI[2 * c + 2], x: 53.77, y: 8.37 + c * PITCH }); }
  const RPI = {
    id: "raspberry-pi-40pin",
    arch: { core: "BCM2712 / BCM2711", coreSub: "SoC 4 × Cortex-A76 / A72", blocks: [
      { side: "L", n: "LPDDR4X RAM", s: "1–16 GB", k: "mem", bus: "DRAM" },
      { side: "L", n: "PMIC + USB-C PD", s: "5 V nguồn", k: "power", bus: "5V / 3V3" },
      { side: "L", n: "2 × micro-HDMI", s: "4Kp60", k: "comm", bus: "HDMI" },
      { side: "L", n: "microSD / PCIe", s: "boot, NVMe", k: "mem", bus: "SDIO · PCIe 2.0" },
      { side: "R", n: "RP1 I/O controller", s: "Pi 5 (Pi 4: GPIO trong SoC)", k: "comm", bus: "PCIe ×4" },
      { side: "R", n: "Header GPIO 40 chân", s: "28 GPIO 3.3 V", k: "io", bus: "qua RP1" },
      { side: "R", n: "USB 3/2 + Ethernet", s: "Gigabit", k: "usb", bus: "qua RP1" },
      { side: "R", n: "EEPROM HAT", s: "ID_SD / ID_SC", k: "ctl", bus: "GPIO0 / GPIO1" }] },
    elec: [["Mức logic", "3.3 V (không chịu 5 V)"], ["Dòng ra", "chọn 2–16 mA (mặc định 8 mA)"], ["Pull nội", "~50 kΩ"], ["Ngoại vi số", "Theo ALT function"]], tag: "Pi",
    oem: { by: "Raspberry Pi Ltd", file: "raspberry-pi-4-reduced-schematics.pdf", url: "https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-reduced-schematics.pdf", note: "Pi 5 chưa có schematic công khai; đây là bản rút gọn của Pi 4.", pages: [["sch/raspberry-pi-40pin-1.png", "Pi 4 Reduced Schematics"]] }, name: "Raspberry Pi 4 / 5 (GPIO 40 chân)", vendor: "Raspberry Pi", chip: "BCM2711 / BCM2712 + RP1", family: "Raspberry Pi",
    summary: "Máy tính nhúng Linux; header 40 chân chuẩn dùng chung Pi 2/3/4/5/Zero.",
    w: 56, h: 85, pcb: "green2", logic: "3.3 V",
    facts: [["Logic", "3.3 V, không chịu 5 V"], ["Header", "2 × 20, bước 2.54 mm, chân 1 có pad vuông"], ["ADC", "Không có ADC – cần chip ngoài (ADS1115, MCP3008)"], ["PWM phần cứng", "GPIO12, 13, 18, 19"], ["Đánh số", "Code dùng số BCM (GPIOxx), không phải số chân vật lý"]],
    docs: [
      ["guide", "Raspberry Pi GPIO documentation", "https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio"],
      ["datasheet", "RP1 Peripherals (Pi 5)", "https://datasheets.raspberrypi.com/rp1/rp1-peripherals.pdf"],
      ["datasheet", "BCM2711 Peripherals (Pi 4)", "https://datasheets.raspberrypi.com/bcm2711/bcm2711-peripherals.pdf"],
      ["schematic", "Pi 4 Reduced Schematics", "https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-reduced-schematics.pdf"],
      ["pinout", "pinout.xyz (cộng đồng)", "https://pinout.xyz/"]
    ],
    src: "Raspberry Pi GPIO documentation",
    note: "Board xoay dọc, header nằm cạnh phải. Hàng chân lẻ (1, 3, 5…) là hàng trong; số vật lý hiện ở nhãn phụ.",
    parts: [
      { t: "chip", x: 21, y: 25, w: 15, h: 15, label: "SoC" },
      { t: "chip", x: 22, y: 43, w: 13, h: 9, label: "RAM" },
      { t: "usb", x: 2, y: 66, w: 16, h: 21, label: "ETH" },
      { t: "usb", x: 20, y: 68, w: 14, h: 18, label: "USB" },
      { t: "usb", x: 37, y: 68, w: 14, h: 18, label: "USB" },
      { t: "usb", x: -1.2, y: 6, w: 7, h: 9, label: "USB-C" },
      { t: "usb", x: -1.2, y: 20, w: 6, h: 7, label: "HDMI" },
      { t: "usb", x: -1.2, y: 33, w: 6, h: 7, label: "HDMI" },
      { t: "hole", x: 52.5, y: 3.5, r: 1.4 }, { t: "hole", x: 52.5, y: 61.5, r: 1.4 },
      { t: "hole", x: 3.5, y: 3.5, r: 1.4 }, { t: "hole", x: 3.5, y: 61.5, r: 1.4 }
    ],
    headers: [
      { id: "Lẻ", side: "L", at: 49.6, inner: true, pins: odd, sch: "J8" },
      { id: "Chẵn", side: "R", at: 57.6, pins: even, sch: "J8" }
    ]
  };


  /* ---------------- LilyGO T-Display-S3 (nhìn mặt sau, như pinout của LilyGO) ---------------- */
  // s3() có ghi chú riêng của DevKitC-1 (RGB LED, chân Arduino) → bỏ đi cho board khác
  const s3b = (n, extra = [], o = {}) => {
    const p = s3(n);
    p.fn = p.fn.filter(f => !/RGB LED|^Arduino/.test(f)).concat(extra);
    p.flags = p.flags.filter(f => f !== "led");
    return Object.assign(p, o);
  };
  const nc = () => pin("NC", { cat: "nc", fn: ["Không kết nối"] });
  const TDL = [pw("3V3", "Ngõ ra 3.3 V", "Ngõ ra LDO 3.3 V của board."), s3b(1), s3b(2), s3b(3), s3b(10), s3b(11), s3b(12), s3b(13), nc(), nc(), gnd(),
    pw("5V", "5 V từ USB-C / ngõ vào 5 V", "Cấp 5 V vào đây thì phải kéo GPIO15 (LCD_Power_On) lên HIGH để board chạy.")];
  const TDR = [gnd(), gnd(), s3b(43), s3b(44), s3b(18, ["I2C SDA (bản Touch)"], { flags: ["adc", "i2c"] }), s3b(17, ["I2C SCL (bản Touch)"], { flags: ["adc", "i2c"] }),
    s3b(21, ["Touch RES (bản Touch)"]), s3b(16, ["Touch INT (bản Touch)"]), nc(), gnd(), gnd(), pw("3V3", "Ngõ ra 3.3 V", "Ngõ ra LDO 3.3 V của board.")];
  const TDISPLAY = {
    id: "lilygo-t-display-s3", photo: { src: "sch/lilygo-t-display-s3-board.jpg", box: [-0.02, 2.02, 26.04, 62.2], credit: "Ảnh board: LilyGO – T-Display-S3 pinout (GitHub)" }, tag: "TDS", name: "LilyGO T-Display-S3", vendor: "LilyGO", chip: "ESP32-S3R8 + LCD 1.9\"", family: "ESP32",
    elec: [["Mức logic", "3.3 V (không chịu 5 V)"], ["VIH / VIL", "≥0.75·VDD / ≤0.25·VDD"], ["Dòng ra", "cấp 40 mA · hút 28 mA"], ["Pull nội", "45 kΩ"], ["Ngoại vi số", "Qua GPIO matrix"]],
    arch: { core: "ESP32-S3R8", coreSub: "8 MB PSRAM + 16 MB flash", blocks: [
      { side: "L", n: "Cổng USB-C", s: "USB native", k: "usb", bus: "GPIO19 D− · GPIO20 D+" },
      { side: "L", n: "Sạc pin Li-Po", s: "đo áp pin", k: "power", bus: "GPIO4 (ADC)" },
      { side: "L", n: "LDO 3.3 V", s: "bật bằng GPIO15", k: "power", bus: "GPIO15 Power On" },
      { side: "L", n: "Nút BOOT / KEY", s: "2 nút cạnh USB", k: "ctl", bus: "GPIO0 · GPIO14" },
      { side: "R", n: "LCD 1.9\" ST7789", s: "170×320, song song 8-bit", k: "comm", bus: "D0–D7: GPIO39–42, 45–48" },
      { side: "R", n: "Điều khiển LCD", s: "WR · RD · DC · CS · RES", k: "comm", bus: "GPIO8 · 9 · 7 · 6 · 5" },
      { side: "R", n: "Đèn nền LCD", s: "PWM", k: "io", bus: "GPIO38" },
      { side: "R", n: "Header 2 × 12", s: "14 GPIO ra ngoài", k: "io", bus: "GPIO" }] },
    summary: "ESP32-S3 + màn hình LCD 1.9 inch ST7789 (170×320), có mạch sạc pin, 2 nút bấm.",
    w: 26, h: 62, pcb: "black", logic: "3.3 V",
    facts: [["Logic", "3.3 V, không chịu 5 V"], ["Màn hình", "1.9\" ST7789, giao tiếp song song 8-bit"], ["Nguồn", "USB-C 5 V hoặc pin Li-Po 3.7 V"], ["Lưu ý", "Chạy bằng pin/5V header phải set GPIO15 = HIGH"], ["Pin", "Đo áp pin ở GPIO4 (chỉ khi rút USB)"]],
    docs: [
      ["code", "GitHub LilyGO T-Display-S3 (pinout, ví dụ)", "https://github.com/Xinyuan-LilyGO/T-Display-S3"],
      ["schematic", "Schematic T-Display-S3", "https://github.com/Xinyuan-LilyGO/T-Display-S3/blob/main/schematic/T_Display_S3.pdf"],
      ["datasheet", "ESP32-S3 Datasheet", "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf"],
      ["datasheet", "Thư mục datasheet linh kiện (LilyGO)", "https://github.com/Xinyuan-LilyGO/T-Display-S3/tree/main/datasheet"]
    ],
    src: "LilyGO T-Display-S3 pinout & README (GitHub), ESP32-S3 Datasheet",
    note: "Hình nhìn từ MẶT SAU (mặt không có màn hình), giống ảnh pinout của LilyGO. Vị trí linh kiện vẽ gần đúng.",
    parts: [
      { t: "hole", x: 3, y: 3, r: 1.1 }, { t: "hole", x: 23, y: 3, r: 1.1 },
      { t: "ant", x: 4, y: 1, w: 18, h: 6, label: "ANT" },
      { t: "chip", x: 9, y: 15, w: 8, h: 8, label: "S3R8" },
      { t: "chip", x: 10, y: 33, w: 6, h: 5, label: "FLASH", small: true },
      { t: "btn", x: 20.5, y: 50, w: 3, h: 4, label: "RST" },
      { t: "usb", x: 8.5, y: 56, w: 9, h: 7, label: "USB-C" },
      { t: "jack", x: 18.5, y: 56, w: 6, h: 5, label: "BAT" }
    ],
    headers: [
      { id: "P2", side: "L", at: -1.6, pins: vcol(1.57, 11, TDL) },
      { id: "P1", side: "R", at: 27.6, pins: vcol(24.43, 11, TDR) }
    ]
  };

  /* ---------------- M5Stack AtomS3 ---------------- */
  const ATL = [pw("3V3", "Ngõ ra 3.3 V", "Ngõ ra 3.3 V (DC-DC SY8089)."), s3b(5), s3b(6), s3b(7), s3b(8)];
  const ATR = [s3b(39, ["IMU SCL (MPU6886)"], { flags: ["i2c", "jtag"], warn: "Dùng chung bus I2C với IMU MPU6886 (0x68) trên board." }),
    s3b(38, ["IMU SDA (MPU6886)"], { flags: ["i2c"], warn: "Dùng chung bus I2C với IMU MPU6886 (0x68) trên board." }),
    pw("5V", "5 V vào/ra", "Nối 5 V USB-C. Không đưa 5 V vào GPIO."), gnd()];
  const ATG = [gnd(), pw("5V", "5 V Grove", "Nguồn 5 V cho module Grove."), s3b(2, ["Grove (vàng)"]), s3b(1, ["Grove (trắng)"])];
  const ATOMS3 = {
    id: "m5stack-atoms3", tag: "AS3", name: "M5Stack AtomS3", vendor: "M5Stack", chip: "ESP32-S3FN8 + LCD 0.85\"", family: "ESP32",
    elec: [["Mức logic", "3.3 V (không chịu 5 V)"], ["VIH / VIL", "≥0.75·VDD / ≤0.25·VDD"], ["Dòng ra", "cấp 40 mA · hút 28 mA"], ["Pull nội", "45 kΩ"], ["Ngoại vi số", "Qua GPIO matrix"]],
    arch: { core: "ESP32-S3FN8", coreSub: "8 MB flash trong chip", blocks: [
      { side: "L", n: "Cổng USB-C", s: "USB native", k: "usb", bus: "GPIO19 · GPIO20" },
      { side: "L", n: "DC-DC SY8089", s: "5 V → 3.3 V", k: "power", bus: "3V3" },
      { side: "L", n: "Cổng Grove HY2.0", s: "GND · 5V · G2 · G1", k: "io", bus: "GPIO2 · GPIO1" },
      { side: "L", n: "Phát hồng ngoại", s: "IR LED", k: "io", bus: "GPIO4" },
      { side: "R", n: "LCD 0.85\" GC9107", s: "128×128, SPI", k: "comm", bus: "G21 MOSI · G17 SCK · G15 CS" },
      { side: "R", n: "Điều khiển LCD", s: "RS · RST · đèn nền", k: "comm", bus: "G33 · G34 · G16" },
      { side: "R", n: "IMU MPU6886", s: "6 trục, I2C 0x68", k: "comm", bus: "G38 SDA · G39 SCL" },
      { side: "R", n: "Nút bấm (mặt màn)", s: "nhấn cả màn hình", k: "ctl", bus: "GPIO41" }] },
    summary: "Module 24×24 mm: ESP32-S3, màn hình 0.85 inch, IMU 6 trục, IR, cổng Grove.",
    w: 24, h: 24, pcb: "black", logic: "3.3 V",
    facts: [["Logic", "3.3 V, không chịu 5 V"], ["Kích thước", "24 × 24 × 13 mm"], ["Màn hình", "0.85\" GC9107 128×128 (SPI)"], ["Nút", "Nhấn mặt màn hình = GPIO41"], ["Grove", "G1/G2 (vàng = G2, trắng = G1)"]],
    docs: [
      ["guide", "M5Stack AtomS3 Docs", "https://docs.m5stack.com/en/core/AtomS3"],
      ["schematic", "AtomS3 Schematic", "https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/472/Sch_M5_AtomS3_v1.0.pdf"],
      ["datasheet", "ESP32-S3 Datasheet", "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf"],
      ["datasheet", "MPU6886 Datasheet", "https://m5stack.oss-cn-shenzhen.aliyuncs.com/resource/docs/datasheet/core/MPU-6886-000193%2Bv1.1_GHIC_en.pdf"]
    ],
    src: "M5Stack AtomS3 Docs (PinMap), ESP32-S3 Datasheet",
    note: "Header 2 bên là hàng chân cạnh hông; cổng Grove ở cạnh dưới. Hình nhìn mặt trước, vị trí linh kiện gần đúng.",
    parts: [
      { t: "chip", x: 5, y: 2.5, w: 14, h: 14, label: "LCD", sub: "0.85\"" },
      { t: "jack", x: 6.5, y: 19, w: 11, h: 4.2, label: "GROVE" }
    ],
    headers: [
      { id: "L", side: "L", at: -1.6, pins: vcol(0.9, 6, ATL) },
      { id: "R", side: "R", at: 25.6, pins: vcol(23.1, 8.54, ATR) },
      { id: "GROVE", side: "B", at: 25.4, pins: ATG.map((p, i) => ({ ...p, x: 8 + i * 2.7, y: 22.6 })) }
    ]
  };

  /* ---------------- Raspberry Pi Pico 2 (RP2350, không Wi-Fi) ---------------- */
  const PICO2 = {
    ...PICO2W, id: "pico-2", tag: "P2", photo: { src: "sch/pico-2-board.jpg", box: [0.06, -2.21, 20.89, 53.33], credit: "Ảnh board: Raspberry Pi Ltd – Pico 2 Pinout" }, name: "Raspberry Pi Pico 2", chip: "RP2350A", oem: null,
    summary: "2 × Cortex-M33 / Hazard3 RISC-V 150 MHz, 520 KB SRAM, 4 MB flash. Cùng chân với Pico 2 W nhưng không có Wi-Fi.",
    facts: [["Logic", "3.3 V (GPIO thường chịu 5 V khi có IOVDD)"], ["Kích thước", "51 × 21 mm, 40 chân bước 2.54 mm"], ["ADC", "12-bit, 3 kênh ra ngoài (GP26–28)"], ["Nội bộ", "GP23 chế độ nguồn SMPS, GP24 dò VBUS, GP25 LED, GP29 đo VSYS/3"], ["PIO", "3 khối PIO × 4 state machine"]],
    docs: [
      ["datasheet", "Pico 2 Datasheet", "https://datasheets.raspberrypi.com/pico/pico-2-datasheet.pdf"],
      ["datasheet", "RP2350 Datasheet", "https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf"],
      ["pinout", "Pico 2 Pinout (PDF)", "https://datasheets.raspberrypi.com/pico/pico-2-pinout.pdf"],
      ["guide", "Hardware design with RP2350", "https://datasheets.raspberrypi.com/rp2350/hardware-design-with-rp2350.pdf"]
    ],
    src: "Pico 2 Datasheet, RP2350 Datasheet bảng GPIO function",
    arch: { core: "RP2350A", coreSub: "2 × Cortex-M33 / Hazard3, 520 KB SRAM", blocks: [
      { side: "L", n: "Cổng Micro-USB", s: "USB 1.1 device/host", k: "usb", bus: "USB_DP/DM" },
      { side: "L", n: "Buck-boost RT6154", s: "VSYS 1.8–5.5 V → 3V3", k: "power", bus: "GP23 chế độ PS" },
      { side: "L", n: "QSPI Flash 4 MB", s: "W25Q32", k: "mem", bus: "QSPI" },
      { side: "L", n: "Đo VBUS / VSYS", s: "phát hiện USB, đo áp", k: "power", bus: "GP24 · GP29 (ADC3)" },
      { side: "R", n: "LED onboard", s: "xanh lá", k: "io", bus: "GP25" },
      { side: "R", n: "Nút BOOTSEL", s: "vào chế độ nạp UF2", k: "ctl", bus: "QSPI_SS" },
      { side: "R", n: "Debug SWD", s: "SWCLK / SWDIO", k: "ctl", bus: "SWD" },
      { side: "R", n: "Header 2 × 20", s: "26 GPIO, 3 ADC", k: "io", bus: "GP0–22, 26–28" }] },
    parts: PICO2W.parts.filter(p => p.t !== "shield" && p.t !== "ant").concat([{ t: "led", x: 4, y: 3.5, w: 1.6, h: 1, color: "#3ddc6a", label: "25" }]),
    headers: [
      { id: "J1", side: "L", at: -1.6, pins: PICO2W.headers[0].pins.map(p => ({ ...p })) },
      { id: "J2", side: "R", at: 22.6, pins: PICO2W.headers[1].pins.map(p => ({ ...p })) },
      { id: "SWD", side: "B", at: 52.6, pins: PICO2W.headers[2].pins.map((p, i) => ({ ...p, x: 7.96 + i * 2.54, y: 49.6 })) }
    ]
  };

  window.BOARDS = [ESP32_C3, ESP32_S3, TDISPLAY, ATOMS3, PICO2W, PICO2, RPI, UNO];
  window.CATS = {
    power: { label: "Nguồn", c: "--c-power" }, gnd: { label: "GND", c: "--c-gnd" }, gpio: { label: "GPIO", c: "--c-gpio" },
    adc: { label: "Analog", c: "--c-adc" }, comm: { label: "UART/I2C", c: "--c-comm" }, usb: { label: "USB", c: "--c-usb" },
    strap: { label: "Strapping ⚠", c: "--c-strap" }, ban: { label: "Dành riêng", c: "--c-ban" }, ctl: { label: "Điều khiển", c: "--c-ctl" }, nc: { label: "NC", c: "--c-ban" }
  };
  window.FLAGS = { adc: "ADC", pwm: "PWM", i2c: "I2C", spi: "SPI", uart: "UART", touch: "Touch", usb: "USB", strap: "Strapping", jtag: "JTAG", led: "LED" };
})();
