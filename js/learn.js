/* Giải thích cho từng bộ lọc (ADC, I2C…): hiện ở panel phải khi bấm chip lọc.
   Mỗi mục: def (định nghĩa), how (nguyên lý), use (ứng dụng), pro/con (ưu/nhược), ex (ví dụ nối dây), code (Arduino). */
window.LEARN = {
  adc: {
    title: "ADC – Chuyển đổi tương tự sang số",
    def: "ADC (Analog-to-Digital Converter) đọc một điện áp liên tục (ví dụ 0–3.3 V) và đổi thành con số. ADC 12-bit cho giá trị 0–4095, ADC 10-bit cho 0–1023.",
    how: "Chip lấy mẫu điện áp vào tụ bên trong, rồi so sánh dần từng bit với điện áp tham chiếu (kiểu SAR). Giá trị = Vin / Vref × (2ⁿ − 1).",
    use: ["Đọc biến trở, cảm biến ánh sáng (LDR), cảm biến độ ẩm đất", "Đo điện áp pin qua cầu phân áp", "Đọc joystick analog"],
    pro: ["Đọc trực tiếp cảm biến analog, không cần IC thêm", "Nhiều kênh, dễ dùng: analogRead()"],
    con: ["ESP32 bị phi tuyến ở hai đầu dải, cần hiệu chỉnh", "Nhiễu nếu dây dài; nên thêm tụ 0.1 µF", "Không đo được điện áp vượt Vref – phải chia áp"],
    ex: "Biến trở 10 kΩ: một đầu 3V3, một đầu GND, chân giữa nối vào chân ADC.",
    code: "int v = analogRead(PIN);            // 0..4095 (ESP32)\nfloat volt = v * 3.3 / 4095.0;\nSerial.println(volt);"
  },
  pwm: {
    title: "PWM – Điều chế độ rộng xung",
    def: "PWM bật/tắt chân thật nhanh. Tỷ lệ thời gian bật (duty cycle) quyết định công suất trung bình: 50% duty ≈ một nửa công suất.",
    how: "Bộ đếm phần cứng chạy liên tục; khi đếm vượt ngưỡng duty thì chân về LOW, hết chu kỳ thì lên HIGH lại. Tần số = số chu kỳ mỗi giây.",
    use: ["Chỉnh độ sáng LED", "Điều tốc động cơ DC (qua driver/MOSFET)", "Điều khiển servo (xung 1–2 ms, 50 Hz)", "Tạo âm thanh buzzer"],
    pro: ["Hiệu suất cao, gần như không tỏa nhiệt ở chân", "Phần cứng tự chạy, không tốn CPU"],
    con: ["Không phải điện áp analog thật – cần lọc RC nếu muốn DC", "Tần số thấp gây nhấp nháy/tiếng rít động cơ"],
    ex: "LED + điện trở 220 Ω từ chân PWM xuống GND.",
    code: "analogWrite(PIN, 128);   // ~50% duty (0..255)\n// ESP32 core 3.x: ledcAttach(PIN, 5000, 8); ledcWrite(PIN, 128);"
  },
  i2c: {
    title: "I2C – Bus 2 dây nhiều thiết bị",
    def: "I2C dùng 2 dây SDA (dữ liệu) và SCL (xung nhịp) để nối nhiều thiết bị trên cùng một bus; mỗi thiết bị có một địa chỉ 7-bit riêng (vd. OLED 0x3C).",
    how: "Hai dây kiểu open-drain: thiết bị chỉ kéo xuống LOW, điện trở pull-up kéo lên HIGH. Master phát START, gửi địa chỉ, slave trả ACK rồi truyền dữ liệu từng byte.",
    use: ["Màn OLED SSD1306, LCD 1602 qua PCF8574", "Cảm biến BME280, MPU6050, BH1750", "RTC DS3231, EEPROM 24Cxx"],
    pro: ["Chỉ 2 dây cho hàng chục thiết bị", "Có ACK nên biết thiết bị có trả lời không"],
    con: ["Chậm (100–400 kHz, tối đa 1 MHz)", "Dây dài/nhiều thiết bị làm tăng điện dung → lỗi", "Trùng địa chỉ thì không dùng chung được"],
    ex: "SDA ↔ SDA, SCL ↔ SCL, GND chung, VCC 3V3. Pull-up 4.7 kΩ nếu module chưa có sẵn.",
    code: "#include <Wire.h>\nWire.begin(SDA_PIN, SCL_PIN);   // ESP32; Uno: Wire.begin()\nWire.beginTransmission(0x3C);\nbool ok = Wire.endTransmission() == 0;"
  },
  spi: {
    title: "SPI – Bus tốc độ cao 4 dây",
    def: "SPI truyền dữ liệu đồng bộ, song công qua 4 dây: SCK (xung), MOSI (master → slave), MISO (slave → master), CS (chọn thiết bị).",
    how: "Master tạo xung SCK; mỗi xung dịch 1 bit ra MOSI và đồng thời nhận 1 bit từ MISO. Kéo CS của thiết bị nào xuống LOW thì thiết bị đó nói chuyện.",
    use: ["Màn TFT ST7789/ILI9341", "Thẻ nhớ microSD", "Module LoRa SX127x, RFID RC522, ADC MCP3008"],
    pro: ["Nhanh (vài chục MHz)", "Đơn giản, không cần địa chỉ"],
    con: ["Tốn dây: mỗi thiết bị thêm 1 chân CS", "Dây dài ở tốc độ cao dễ nhiễu"],
    ex: "SCK↔SCK, MOSI↔SDI/DIN, MISO↔SDO, CS↔CS, GND chung.",
    code: "#include <SPI.h>\nSPI.begin();              // dùng chân SPI mặc định\ndigitalWrite(CS_PIN, LOW);\nuint8_t r = SPI.transfer(0x9F);\ndigitalWrite(CS_PIN, HIGH);"
  },
  uart: {
    title: "UART – Cổng nối tiếp",
    def: "UART truyền dữ liệu không đồng bộ qua 2 dây TX (phát) và RX (nhận), hai bên phải cùng tốc độ baud (vd. 115200).",
    how: "Mỗi byte gồm 1 bit start (LOW), 8 bit dữ liệu, 1 bit stop (HIGH). Không có dây xung nhịp – hai bên tự đếm thời gian theo baud.",
    use: ["Serial Monitor để debug", "Module GPS, SIM800/A7680, HC-05 Bluetooth", "Giao tiếp giữa 2 vi điều khiển"],
    pro: ["Đơn giản, phổ biến nhất", "Chỉ cần 2 dây + GND"],
    con: ["Chỉ 1-1, không phải bus", "Sai baud là ra ký tự rác", "Mức 5 V và 3.3 V phải chuyển mức"],
    ex: "TX của board → RX của module, RX của board ← TX của module (nối chéo), GND chung.",
    code: "Serial1.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);  // ESP32\nwhile (Serial1.available()) Serial.write(Serial1.read());"
  },
  touch: {
    title: "Touch – Cảm ứng điện dung",
    def: "Chân touch đo điện dung. Khi ngón tay chạm vào miếng kim loại nối với chân, điện dung tăng và giá trị đọc được thay đổi.",
    how: "Chip nạp/xả điện cho chân liên tục và đếm thời gian. Điện dung lớn hơn (có tay) → nạp chậm hơn → giá trị khác đi.",
    use: ["Nút bấm cảm ứng không cơ khí", "Thanh trượt cảm ứng", "Đánh thức chip từ deep-sleep bằng chạm"],
    pro: ["Không hao mòn, chống nước được (sau lớp nhựa/kính)", "Không cần linh kiện ngoài"],
    con: ["Bị ảnh hưởng bởi độ ẩm, dây dài", "Cần hiệu chỉnh ngưỡng"],
    ex: "Miếng đồng/PCB pad nối qua điện trở 510 Ω vào chân TOUCH.",
    code: "uint32_t t = touchRead(PIN);\nif (t > nguong) Serial.println(\"Cham!\");   // ESP32-S3: giá trị TĂNG khi chạm"
  },
  usb: {
    title: "USB native",
    def: "Chip có bộ điều khiển USB riêng, nối thẳng D+/D− ra cổng USB mà không cần chip chuyển USB-UART.",
    how: "Chip tự xử lý giao thức USB: có thể giả lập cổng COM (CDC), bàn phím/chuột (HID), ổ đĩa (MSC) hoặc làm host.",
    use: ["Nạp code và Serial Monitor qua cùng một cổng", "Làm bàn phím macro, tay cầm game", "Debug JTAG qua USB"],
    pro: ["Bớt linh kiện, rẻ hơn", "Làm được thiết bị USB tùy biến"],
    con: ["Dùng 2 chân D+/D− làm GPIO thì mất USB", "Code treo có thể làm mất cổng COM – phải giữ BOOT để nạp lại"],
    ex: "Cắm cáp USB data (không phải cáp chỉ sạc).",
    code: "// Arduino IDE: Tools → USB CDC On Boot: Enabled\nSerial.begin(115200);"
  },
  strap: {
    title: "Strapping – Chân cấu hình lúc khởi động",
    def: "Chân strapping được chip đọc mức điện đúng lúc reset để quyết định chế độ khởi động (chạy chương trình hay vào chế độ nạp, điện áp flash…).",
    how: "Trong vài ms sau reset, chip chốt (latch) mức HIGH/LOW của các chân này. Sau đó chân trở thành GPIO bình thường.",
    use: ["Nút BOOT: giữ LOW khi reset để vào chế độ nạp firmware"],
    pro: ["Vẫn dùng làm GPIO được sau khi khởi động"],
    con: ["Mạch ngoài kéo sai mức → board không boot hoặc kẹt ở chế độ nạp", "Tránh nối LED/relay/cảm biến kéo xuống trên các chân này"],
    ex: "Nếu bắt buộc dùng: chỉ làm output hoặc input có pull-up, kiểm tra board boot bình thường sau khi lắp mạch.",
    code: "// Không cần code – chú ý phần cứng.\n// Board không chạy sau khi lắp mạch? Thử tháo dây khỏi chân strapping."
  },
  jtag: {
    title: "JTAG – Cổng debug phần cứng",
    def: "JTAG cho phép debugger dừng chương trình, chạy từng dòng, xem biến và thanh ghi ngay trên chip thật.",
    how: "4 tín hiệu TCK (xung), TMS (chọn trạng thái), TDI (vào), TDO (ra) điều khiển khối debug bên trong chip.",
    use: ["Debug bằng OpenOCD + GDB, VS Code / ESP-IDF", "Tìm lỗi crash, treo"],
    pro: ["Debug sâu hơn nhiều so với Serial.print"],
    con: ["Tốn 4 chân", "Cần adapter (ESP-Prog) hoặc dùng USB-JTAG có sẵn trên chip mới"],
    ex: "ESP32-S3/C3 có USB-JTAG nội – thường không cần dùng các chân này, có thể dùng làm GPIO.",
    code: "// ESP-IDF: idf.py openocd gdb"
  },
  led: {
    title: "LED trên board",
    def: "Chân nối với LED có sẵn trên board, dùng để thử nhanh (blink) mà không cần lắp mạch.",
    how: "Tùy board LED sáng khi chân HIGH hoặc LOW (active-low). LED RGB WS2812 cần giao thức riêng.",
    use: ["Blink kiểm tra board", "Báo trạng thái Wi-Fi/lỗi"],
    pro: ["Có sẵn, không cần linh kiện"],
    con: ["Dùng chân đó cho việc khác thì LED cũng sáng/tắt theo"],
    ex: "Không cần nối dây.",
    code: "pinMode(LED_PIN, OUTPUT);\ndigitalWrite(LED_PIN, HIGH); delay(500);\ndigitalWrite(LED_PIN, LOW);  delay(500);\n// WS2812: rgbLedWrite(PIN, 255, 0, 0);"
  }
};
