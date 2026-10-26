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
    id: "esp32-s3-devkitc-1", name: "ESP32-S3-DevKitC-1", vendor: "Espressif", chip: "ESP32-S3 (WROOM-1)", family: "ESP32",
    summary: "Xtensa LX7 2 nhân 240 MHz, Wi-Fi 4 + BLE 5, USB OTG native.",
    w: 25.9, h: 63, pcb: "green", logic: "3.3 V",
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
      { t: "module", x: 3.95, y: 0, w: 18, h: 25.5, label: "ESP32-S3", sub: "WROOM-1", ant: 6.5 },
      { t: "chip", x: 9.2, y: 33, w: 7.5, h: 4.5, label: "LDO" },
      { t: "chip", x: 8.7, y: 41, w: 8.5, h: 5, label: "USB-UART" },
      { t: "btn", x: 4.5, y: 51.5, w: 4, h: 3.2, label: "BOOT" },
      { t: "btn", x: 17.4, y: 51.5, w: 4, h: 3.2, label: "RST" },
      { t: "led", x: 12.2, y: 49, w: 1.6, h: 1.6, color: "#ff3fd0", label: "RGB" },
      { t: "usb", x: 4.4, y: 57.5, w: 7.6, h: 6.5, label: "UART" },
      { t: "usb", x: 13.9, y: 57.5, w: 7.6, h: 6.5, label: "USB" }
    ],
    headers: [
      { id: "J1", side: "L", at: -1.6, pins: vcol(1.27, 6.2, S3L.map(s3mk)) },
      { id: "J3", side: "R", at: 27.5, pins: vcol(24.63, 6.2, S3R.map(s3mk)) }
    ]
  };

  /* ---------------- ESP32-C3 Super Mini ---------------- */
  function c3(n) {
    const p = pin("GPIO" + n, { gpio: n });
    if (n <= 4) { p.fn.push("ADC1_CH" + n); p.flags.push("adc"); }
    if (n === 5) { p.fn.push("ADC2_CH0"); p.flags.push("adc"); p.warn = "ADC2 trên ESP32-C3 không ổn định (xem errata). Cần đo analog thì dùng GPIO0–GPIO4."; }
    if (n === 0) p.fn.push("XTAL_32K_P");
    if (n === 1) p.fn.push("XTAL_32K_N");
    const MUX = { 2: "FSPIQ", 4: "FSPIHD · MTMS", 5: "FSPIWP · MTDI", 6: "FSPICLK · MTCK", 7: "FSPID · MTDO", 10: "FSPICS0", 20: "U0RXD", 21: "U0TXD" };
    if (MUX[n]) p.fn.push(MUX[n]);
    if (n >= 4 && n <= 7) p.flags.push("jtag");
    const ARD = { 4: "Arduino SCK", 5: "Arduino MISO", 6: "Arduino MOSI", 7: "Arduino SS", 8: "Arduino SDA", 9: "Arduino SCL" };
    if (ARD[n]) { p.fn.push(ARD[n]); p.flags.push(n >= 8 ? "i2c" : "spi"); }
    if (n === 20 || n === 21) { p.flags.push("uart"); p.name = n === 20 ? "RX" : "TX"; p.fn.push("GPIO" + n); }
    if ([2, 8, 9].includes(n)) p.flags.push("strap");
    if (n === 8) { p.fn.push("LED xanh onboard (LOW = sáng)"); p.flags.push("led"); }
    if (n === 9) p.fn.push("Nút BOOT");
    const w = {
      2: "Strapping: nên giữ HIGH lúc khởi động (kéo lên 10 kΩ). Tránh nối tải kéo xuống GND.",
      8: "Strapping: phải HIGH khi vào chế độ nạp. LED onboard nối lên 3V3 nên mặc định đã HIGH; đừng kéo xuống lúc boot.",
      9: "Strapping: LOW lúc boot = chế độ nạp (nút BOOT). Dùng làm input thì để nút nhấn kéo xuống, không gắn tải kéo LOW.",
      20: "UART0 RX: nạp/log qua UART. Super Mini nạp qua USB native nên dùng được, nhưng log ROM có thể xuất hiện lúc boot.",
      21: "UART0 TX: chip in log ROM ra chân này lúc khởi động."
    };
    if (w[n]) p.warn = w[n];
    p.notes.push("Dòng drive mặc định 20 mA (mức 2), tối đa 40 mA (mức 3).");
    if (n === 0 || n === 1) p.notes.push("Có thể gắn thạch anh 32.768 kHz cho RTC chính xác.");
    p.cat = p.flags.includes("strap") ? "strap" : p.flags.includes("uart") ? "comm" : p.flags.includes("adc") ? "adc" : "gpio";
    if (p.flags.includes("adc")) p.parts.push(["Lọc ADC", "Tụ 0.1 µF từ chân xuống GND; nguồn tín hiệu trở kháng thấp", "hdg"]);
    if (n === 2) p.parts.push(["Pull-up", "10 kΩ lên 3V3 nếu mạch ngoài có thể kéo chân xuống", "hdg"]);
    if (n === 9) p.parts.push(["Nút nhấn", "Dùng pull-up nội/ngoài, nút nối xuống GND (giống nút BOOT)", "std"]);
    if (p.cat === "gpio" || p.cat === "adc") p.parts.push(i2cPull);
    return p;
  }
  const C3L = [
    pw("5V", "VBUS từ USB-C / ngõ vào 5V", "Nối thẳng VBUS của cổng USB-C. Cấp 5V ngoài vào đây thì đừng cắm USB cùng lúc."),
    gnd("GND"),
    pw("3V3", "Ngõ ra LDO 3.3 V", "LDO onboard (thường ME6211/tương đương ~500 mA). Chip đã dùng một phần, nên giữ tải ngoài dưới ~250 mA.", { parts: [["Tụ", "10 µF + 0.1 µF gần tải ngoài", "hdg"]] }),
    c3(4), c3(3), c3(2), c3(1), c3(0)
  ];
  const C3R = [c3(5), c3(6), c3(7), c3(8), c3(9), c3(10), c3(20), c3(21)];
  const ESP32_C3_SM = {
    id: "esp32-c3-supermini", name: "ESP32-C3 Super Mini", vendor: "Nologo / bản phổ biến", chip: "ESP32-C3FH4", family: "ESP32",
    summary: "RISC-V 160 MHz, 4 MB flash tích hợp, Wi-Fi 4 + BLE 5, USB-C native (USB Serial/JTAG).",
    w: 18, h: 22.52, pcb: "black", logic: "3.3 V",
    facts: [["Logic", "3.3 V, không chịu 5 V"], ["Kích thước", "22.52 × 18 mm, 2 hàng × 8 chân, bước 2.54 mm"], ["ADC", "SAR 12-bit: GPIO0–GPIO4 (ADC1)"], ["USB", "USB Serial/JTAG trên GPIO18/19 (đã dùng cho cổng USB-C)"], ["LED / nút", "LED xanh GPIO8 (LOW sáng), BOOT = GPIO9, RST = CHIP_EN"], ["Wi-Fi yếu?", "Một số lô anten kém; cộng đồng hay giảm TX power (WiFi.setTxPower(WIFI_POWER_8_5dBm))"]],
    docs: [
      ["datasheet", "ESP32-C3 Datasheet (Espressif)", "https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf"],
      ["manual", "ESP32-C3 Technical Reference Manual", "https://www.espressif.com/sites/default/files/documentation/esp32-c3_technical_reference_manual_en.pdf"],
      ["guide", "ESP32-C3 Hardware Design Guidelines", "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32c3/index.html"],
      ["errata", "ESP32-C3 Errata", "https://www.espressif.com/sites/default/files/documentation/esp32-c3_errata_en.pdf"],
      ["code", "Arduino-ESP32 pins_arduino.h (esp32c3)", "https://github.com/espressif/arduino-esp32/blob/master/variants/esp32c3/pins_arduino.h"]
    ],
    note: "Board Super Mini do bên thứ ba sản xuất, không có datasheet chính thức của Espressif. Chức năng chân lấy theo datasheet chip ESP32-C3; vị trí linh kiện vẽ gần đúng.",
    src: "ESP32-C3 Datasheet chương 2 (Pin Definitions), IO MUX",
    parts: [
      { t: "usb", x: 5.4, y: -1.2, w: 9.2, h: 7.4, label: "USB-C" },
      { t: "btn", x: 2.9, y: 7.4, w: 3.2, h: 2.6, label: "BOOT" },
      { t: "btn", x: 11.9, y: 7.4, w: 3.2, h: 2.6, label: "RST" },
      { t: "chip", x: 6.5, y: 10.6, w: 5, h: 5, label: "C3", sub: "FH4" },
      { t: "chip", x: 3.4, y: 11.2, w: 2.2, h: 2.8, label: "LDO", small: true },
      { t: "led", x: 12.8, y: 12, w: 1.4, h: 0.9, color: "#3d8bff", label: "8" },
      { t: "ant", x: 4.5, y: 18.2, w: 9, h: 3.4, label: "ANT" }
    ],
    headers: [
      { id: "L", side: "L", at: -1.6, pins: vcol(1.38, 3.4, C3L) },
      { id: "R", side: "R", at: 19.6, pins: vcol(16.62, 3.4, C3R) }
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
    id: "pico-2-w", name: "Raspberry Pi Pico 2 W", vendor: "Raspberry Pi", chip: "RP2350 + CYW43439", family: "RP2",
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
      { id: "SWD", side: "B", at: 52.6, pins: PD.map((p, i) => ({ ...p, x: 7.96 + i * 2.54, y: 49.6 })) }
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
    id: "arduino-uno-r3", name: "Arduino Uno R3", vendor: "Arduino", chip: "ATmega328P", family: "AVR",
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
    id: "raspberry-pi-40pin", name: "Raspberry Pi 4 / 5 (GPIO 40 chân)", vendor: "Raspberry Pi", chip: "BCM2711 / BCM2712 + RP1", family: "Raspberry Pi",
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

  window.BOARDS = [ESP32_C3_SM, ESP32_S3, PICO2W, UNO, RPI];
  window.CATS = {
    power: { label: "Nguồn", c: "--c-power" }, gnd: { label: "GND", c: "--c-gnd" }, gpio: { label: "GPIO", c: "--c-gpio" },
    adc: { label: "Analog", c: "--c-adc" }, comm: { label: "UART/I2C", c: "--c-comm" }, usb: { label: "USB", c: "--c-usb" },
    strap: { label: "Strapping ⚠", c: "--c-strap" }, ban: { label: "Dành riêng", c: "--c-ban" }, ctl: { label: "Điều khiển", c: "--c-ctl" }, nc: { label: "NC", c: "--c-ban" }
  };
  window.FLAGS = { adc: "ADC", pwm: "PWM", i2c: "I2C", spi: "SPI", uart: "UART", touch: "Touch", usb: "USB", strap: "Strapping", jtag: "JTAG", led: "LED" };
})();
