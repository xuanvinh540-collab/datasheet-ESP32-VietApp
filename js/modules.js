/* Thư viện module cho chế độ Build.
   pins[]: [label, role, v5, svgX, svgY, pinDir]
   role: loại chân cần (spi.sck, spi.mosi, spi.miso, spi.cs, i2c.sda, i2c.scl, i2s.bclk, i2s.ws, i2s.dout, i2s.din, adc, out, in, pwm)
   v5: chân này ra mức 5 V (cần chia áp nếu board 3.3 V). family: các dòng chip hỗ trợ. */
window.MODULES = {
  button: {
    name: "Nút bấm (Pushbutton)", short: "Nút bấm", color: "#ff3b30", iface: "GPIO", vcc: "GND",
    svg: "svg/pushbutton.svg", w: 18, h: 13.8, vb: [-3, 0, 18, 13.8], pinDir: "L",
    pins: [
      ["SIG", "in", 0, -2.5, 3.4, "L"],
      ["GND", "gnd", 0, -2.5, 8.4, "L"]
    ],
    lib: "(dùng INPUT_PULLUP nội)",
    note: "Bật pinMode(pin, INPUT_PULLUP): bình thường đọc HIGH, khi nhấn nút nối xuống GND đọc LOW (không cần điện trở ngoài)."
  },
  led: {
    name: "Đèn LED đơn 5mm", short: "Đèn LED", color: "#ff5252", iface: "GPIO/PWM", vcc: "GPIO",
    svg: "svg/led.svg", w: 14, h: 20, vb: [-5, -3, 26, 37], pinDir: "B",
    pins: [
      ["GND", "gnd", 0, 3.58, 30.2, "B"],
      ["A", "out", 0, 12.1, 30.2, "B"]
    ],
    lib: "(digitalWrite / analogWrite)",
    note: "Chân dài Anode (+) nối qua điện trở 220–330 Ω vào GPIO; chân ngắn Cathode (−) nối GND."
  },
  buzzer: {
    name: "Còi Buzzer (Piezo)", short: "Buzzer", color: "#ff9800", iface: "PWM/Tone", vcc: "GPIO",
    svg: "svg/buzzer.svg", w: 16, h: 20.2, vb: [0, 0, 17, 21.5], pinDir: "B",
    pins: [
      ["GND", "gnd", 0, 7.23, 20.0, "B"],
      ["SIG", "pwm", 0, 9.77, 20.0, "B"]
    ],
    lib: "(hàm tone() chuẩn Arduino)",
    note: "Dùng hàm tone(pin, freq) để phát nhạc (như Simon Says trên Wokwi)."
  },
  sevseg: {
    name: "Màn hình LED 7 đoạn", short: "LED 7 đoạn", color: "#ff4081", iface: "GPIO", vcc: "GND",
    svg: "svg/sevseg.svg", w: 18, h: 33.4, vb: [0, -1.5, 14, 26], pinDir: "T",
    pins: [
      ["G", "out", 0, 2.0, -0.5, "T"],
      ["F", "out", 0, 4.6, -0.5, "T"],
      ["GND", "gnd", 0, 7.2, -0.5, "T"],
      ["A", "out", 0, 9.8, -0.5, "T"],
      ["B", "out", 0, 12.4, -0.5, "T"],
      ["E", "out", 0, 2.0, 23.2, "B"],
      ["D", "out", 0, 4.6, 23.2, "B"],
      ["C", "out", 0, 9.8, 23.2, "B"],
      ["DP", "out", 0, 12.4, 23.2, "B"]
    ],
    lib: "SevSeg (hoặc điều khiển qua 74HC595)",
    note: "LED 7 đoạn Cathode chung (COM nối GND). Nối điện trở 220–330 Ω cho các chân A–G, DP."
  },
  ssd1306: {
    name: "Màn hình OLED SSD1306", short: "OLED 0.96\"", color: "#00bcd4", iface: "I2C 0x3C", vcc: "3V3",
    svg: "svg/ssd1306.svg", w: 28, h: 21.6, vb: [0, 0, 150, 116], pinDir: "T",
    pins: [
      ["SDA", "i2c.sda", 0, 36.5, 12.5, "T"],
      ["SCL", "i2c.scl", 0, 54.5, 12.5, "T"],
      ["VCC", "pwr.3v3", 0, 83.5, 12.5, "T"],
      ["GND", "gnd", 0, 103.5, 12.5, "T"]
    ],
    lib: "Adafruit SSD1306 + Adafruit GFX",
    note: "Màn OLED 128×64 I2C địa chỉ 0x3C (hoặc 0x3D). Tự phát sáng, không cần đèn nền."
  },
  ldr: {
    name: "Cảm biến ánh sáng LDR", short: "Ánh sáng LDR", color: "#3f8cff", iface: "ADC + GPIO", vcc: "3V3",
    svg: "svg/ldr.svg", w: 36, h: 12.7, vb: [0, 0, 174, 61.5], pinDir: "L",
    pins: [
      ["VCC", "pwr.3v3", 0, 2, 16, "L"],
      ["GND", "gnd", 0, 2, 26, "L"],
      ["DO", "in", 0, 2, 35.8, "L"],
      ["AO", "adc", 0, 2, 45.5, "L"]
    ],
    lib: "(analogRead / digitalRead)",
    note: "Chân AO xuất điện áp liên tục vào chân ADC; chân DO xuất mức số 0/1 theo biến trở tinh chỉnh trên module."
  },
  dht22: {
    name: "Nhiệt ẩm DHT22", short: "DHT22", color: "#4caf50", iface: "1 dây", vcc: "3V3",
    svg: "svg/dht22.svg", w: 15, h: 30.7, vb: [0, 0, 15.1, 30.885], pinDir: "B",
    pins: [
      ["VCC", "pwr.3v3", 0, 3.95, 30.2, "B"],
      ["SDA", "in", 0, 6.48, 30.2, "B"],
      ["GND", "gnd", 0, 11.56, 30.2, "B"]
    ],
    lib: "DHT sensor library (Adafruit)",
    note: "Đo nhiệt độ −40..80 °C và độ ẩm 0..100%. Nên có điện trở kéo lên 4.7–10 kΩ từ chân SDA lên VCC."
  },
  st7789: {
    name: "Màn TFT ST7789", short: "ST7789", color: "#e8672a", iface: "SPI", vcc: "3V3",
    svg: "svg/st7789.svg", w: 28, h: 36.75, vb: [160, 210], pinDir: "T",
    pins: [
      ["GND", "gnd", 0, 34, 21],
      ["VCC", "pwr.3v3", 0, 50, 21],
      ["SCL", "spi.sck", 0, 66, 21],
      ["SDA", "spi.mosi", 0, 82, 21],
      ["RES", "out", 0, 98, 21],
      ["DC", "out", 0, 114, 21],
      ["BLK", "pwm", 0, 130, 21]
    ],
    lib: "Adafruit ST7735 and ST7789 Library + Adafruit GFX",
    note: "Màn 1.3\" IPS 240×240 (7 chân, không có CS). Chân SCL = SCK (SPI), SDA = MOSI (SPI), không phải I2C."
  },
  ws2812: {
    name: "LED RGB WS2812", short: "WS2812", color: "#ff4fa3", iface: "1 dây", vcc: "5V",
    svg: "svg/ws2812.svg", w: 30, h: 25, vb: [180, 150], pinDir: "T",
    pins: [
      ["GND", "gnd", 0, 58, 21],
      ["VCC", "pwr.5v", 0, 90, 21],
      ["DIN", "out", 0, 122, 21]
    ],
    lib: "Adafruit NeoPixel",
    note: "Nguồn 5 V riêng nếu nhiều LED (~60 mA/LED). Thêm điện trở 330 Ω nối tiếp DIN và tụ 1000 µF ở nguồn."
  },
  hcsr04: {
    name: "Siêu âm HC-SR04", short: "HC-SR04", color: "#29adff", iface: "GPIO", vcc: "5V",
    svg: "svg/hc-sr04.svg", w: 38, h: 17.7, vb: [485.87112, 226.17669], pinDir: "B",
    pins: [
      ["VCC", "pwr.5v", 0, 205.05, 213],
      ["TRIG", "out", 0, 227.57, 213],
      ["ECHO", "in", 1, 250.10, 213],
      ["GND", "gnd", 0, 272.63, 213]
    ],
    lib: "(không cần thư viện)",
    note: "ECHO ra mức 5 V: với board 3.3 V phải chia áp (vd. 1 kΩ + 2 kΩ) trước khi vào chân GPIO."
  },
  vl53l0x: {
    name: "Cảm biến ToF VL53L0X", short: "VL53L0X", color: "#00b543", iface: "I2C 0x29", vcc: "3V3",
    svg: "svg/vl53l0x.svg", w: 25, h: 25, vb: [150, 150], pinDir: "T",
    pins: [
      ["VCC", "pwr.3v3", 0, 34, 21],
      ["GND", "gnd", 0, 54, 21],
      ["SCL", "i2c.scl", 0, 75, 21],
      ["SDA", "i2c.sda", 0, 96, 21],
      ["XSHUT", "out", 0, 118, 21]
    ],
    lib: "Adafruit_VL53L0X",
    note: "Địa chỉ cố định 0x29. Gắn nhiều cảm biến thì dùng XSHUT bật lần lượt để đổi địa chỉ."
  },
  mpu6050: {
    name: "IMU 6 trục MPU6050", short: "MPU6050", color: "#8655d4", iface: "I2C 0x68", vcc: "3V3",
    svg: "svg/mpu6050.svg", w: 25, h: 27.5, vb: [150, 165], pinDir: "T",
    pins: [
      ["VCC", "pwr.3v3", 0, 34, 21],
      ["GND", "gnd", 0, 54, 21],
      ["SCL", "i2c.scl", 0, 75, 21],
      ["SDA", "i2c.sda", 0, 96, 21],
      ["INT", "in", 0, 116, 21]
    ],
    lib: "Adafruit MPU6050 + Adafruit Unified Sensor",
    note: "Địa chỉ 0x68 (AD0 = GND) hoặc 0x69 (AD0 = VCC). Module GY-521 có sẵn pull-up I2C."
  },
  max98357a: {
    name: "Ampli loa I2S MAX98357A", short: "MAX98357A", color: "#f5d63d", iface: "I2S", vcc: "5V",
    svg: "svg/max98357a.svg", w: 25, h: 29.2, vb: [150, 175], pinDir: "T",
    pins: [
      ["VCC", "pwr.5v", 0, 34, 21],
      ["GND", "gnd", 0, 54, 21],
      ["BCLK", "i2s.bclk", 0, 75, 21],
      ["LRC", "i2s.ws", 0, 96, 21],
      ["DIN", "i2s.dout", 0, 116, 21]
    ],
    lib: "ESP32: ESP_I2S (core 3.x) · Pico: I2S (arduino-pico)", family: ["ESP32", "RP2"],
    note: "Cấp 5 V để loa to hơn (tới 3 W). Chân GAIN để trống = 9 dB."
  },
  inmp441: {
    name: "Micro I2S INMP441", short: "INMP441", color: "#2fd6c3", iface: "I2S", vcc: "3V3",
    svg: "svg/inmp441.svg", w: 25, h: 26.7, vb: [150, 160], pinDir: "T",
    pins: [
      ["VCC", "pwr.3v3", 0, 34, 21],
      ["GND", "gnd", 0, 54, 21],
      ["SCK", "i2s.bclk", 0, 75, 21],
      ["WS", "i2s.ws", 0, 96, 21],
      ["SD", "i2s.din", 0, 116, 21]
    ],
    lib: "ESP32: ESP_I2S (core 3.x) · Pico: I2S (arduino-pico)", family: ["ESP32", "RP2"],
    note: "Chân L/R nối GND = kênh trái. Chỉ chạy 3.3 V."
  }
};
/* Nhóm linh kiện dùng chung cho danh sách ở tab Sơ đồ chân và tab Connect: [tên, biểu tượng, các mã module] */
window.MOD_CATS = [
  ["Màn hình & Hiển thị", "🖥️", ["ssd1306", "st7789", "sevseg", "ws2812"]],
  ["Cảm biến", "📡", ["hcsr04", "vl53l0x", "mpu6050", "dht22", "ldr"]],
  ["Âm thanh & Còi", "🔊", ["buzzer", "max98357a", "inmp441"]],
  ["Điều khiển & Cơ bản", "🎛️", ["button", "led"]]
];
/* Giải thích từng chân linh kiện: [chân này làm gì, cách nối]. Khoá "mã.CHÂN" ưu tiên hơn khoá chung "CHÂN". */
window.PIN_DOC = {
  VCC: ["Chân cấp nguồn dương cho module.", "Nối 3V3 hoặc 5V của board theo điện áp ghi trên module. Cấp sai điện áp có thể hỏng module."],
  VDD: ["Chân cấp nguồn dương (VDD là tên khác của VCC).", "Nối 3V3 của board."],
  VIN: ["Chân cấp nguồn dương cho mạch khuếch đại.", "Nối 3V3 hoặc 5V của board; 5V cho loa to hơn."],
  GND: ["Mass (0 V), điểm chung của mọi tín hiệu.", "Nối GND của board. Module và board phải chung GND thì tín hiệu mới đọc đúng."],
  SDA: ["Dây dữ liệu của bus I2C (Serial Data). Dữ liệu đi cả hai chiều trên cùng một dây.", "Nối chân SDA của board. Nhiều thiết bị I2C nối chung một dây SDA, phân biệt nhau bằng địa chỉ. Bus cần điện trở kéo lên (thường 4.7 kΩ), nhiều module có sẵn."],
  SCL: ["Dây xung nhịp của bus I2C (Serial Clock). Board (master) phát xung để đồng bộ dữ liệu trên SDA.", "Nối chân SCL của board, dùng chung cho mọi thiết bị I2C. Cần điện trở kéo lên như SDA."],
  INT: ["Chân ngắt (Interrupt): module kéo mức để báo có dữ liệu mới hoặc có sự kiện.", "Nối một GPIO bất kỳ và dùng attachInterrupt(). Không bắt buộc, có thể để trống nếu chỉ đọc định kỳ."],
  XSHUT: ["Chân tắt cảm biến (Shutdown): mức LOW tắt cảm biến, HIGH bật lại.", "Nối GPIO nếu cần bật/tắt hoặc đổi địa chỉ khi gắn nhiều VL53L0X; dùng một cảm biến thì có thể để trống."],
  "st7789.SCL": ["Xung nhịp SPI (SCK). Trên màn này chữ SCL in trên module nhưng thực chất là SPI, không phải I2C.", "Nối chân SPI SCK của board (ESP32-S3 mặc định IO12)."],
  "st7789.SDA": ["Dữ liệu SPI từ board vào màn (MOSI). Tên in SDA nhưng là SPI, không phải I2C.", "Nối chân SPI MOSI của board (ESP32-S3 mặc định IO11)."],
  "st7789.RES": ["Chân reset màn hình: kéo LOW một lúc để khởi động lại bộ điều khiển ST7789.", "Nối một GPIO; thư viện tự điều khiển khi gọi tft.init()."],
  "st7789.DC": ["Data/Command: LOW = byte gửi đi là lệnh, HIGH = byte gửi đi là dữ liệu điểm ảnh.", "Nối một GPIO bất kỳ, khai báo trong thư viện (tham số DC)."],
  "st7789.BLK": ["Đèn nền (Backlight). HIGH = sáng, LOW = tắt; cấp PWM để chỉnh độ sáng.", "Nối GPIO có PWM để chỉnh sáng, hoặc nối thẳng 3V3 nếu luôn bật."],
  "ws2812.DIN": ["Ngõ vào dữ liệu (Data In) của chuỗi LED. Mỗi LED nhận màu của mình rồi chuyển phần còn lại sang LED kế tiếp.", "Nối một GPIO qua điện trở 330 Ω. Dây dữ liệu nên ngắn; dải dài với board 3.3 V nên thêm IC chuyển mức (74AHCT125)."],
  "ws2812.VCC": ["Nguồn 5 V cho các LED. Mỗi LED trắng sáng tối đa có thể ăn khoảng 60 mA.", "Nối 5V; nhiều LED thì dùng nguồn riêng và tụ 1000 µF, nối chung GND với board."],
  "hcsr04.TRIG": ["Trigger: board phát một xung HIGH khoảng 10 µs để cảm biến bắn sóng siêu âm.", "Nối một GPIO đặt OUTPUT. Mức 3.3 V vẫn kích được."],
  "hcsr04.ECHO": ["Echo: cảm biến giữ chân này HIGH đúng bằng thời gian sóng đi và dội về. Khoảng cách (cm) ≈ thời gian (µs) / 58.", "Nối GPIO đặt INPUT, đọc bằng pulseIn(). Chân ra 5 V: với board 3.3 V phải chia áp 1 kΩ + 2 kΩ trước khi vào GPIO."],
  "hcsr04.VCC": ["Nguồn 5 V cho cảm biến siêu âm.", "Nối 5V của board (HC-SR04 bản thường không chạy ổn ở 3.3 V)."],
  "max98357a.BCLK": ["Bit Clock của I2S: mỗi xung là một bit âm thanh.", "Nối chân I2S BCLK của board (GPIO bất kỳ trên ESP32)."],
  "max98357a.LRC": ["Left/Right Clock (WS): đổi mức để báo đang gửi kênh trái hay phải; tần số bằng tần số lấy mẫu.", "Nối chân I2S WS/LRCLK. Trên Pico phải là chân ngay sau BCLK (BCLK + 1)."],
  "max98357a.DIN": ["Dữ liệu âm thanh I2S đi vào ampli.", "Nối chân I2S data out (DOUT) của board."],
  "inmp441.SCK": ["Bit Clock của I2S do board phát cho micro.", "Nối chân I2S BCLK của board."],
  "inmp441.WS": ["Word Select (LRCLK): chọn kênh trái/phải, tần số bằng tần số lấy mẫu.", "Nối chân I2S WS của board. Chân L/R của micro nối GND để micro ra kênh trái."],
  "inmp441.SD": ["Serial Data: dữ liệu âm thanh số từ micro gửi về board.", "Nối chân I2S data in (DIN) của board."],
  "button.SIG": ["Chân tín hiệu của nút: khi nhấn, chân này được nối xuống GND.", "Nối GPIO và bật pinMode(pin, INPUT_PULLUP): bình thường đọc HIGH, nhấn đọc LOW."],
  "led.A": ["Anode (+), chân dài của LED. Dòng đi từ Anode sang Cathode thì LED sáng.", "Nối GPIO qua điện trở 220–330 Ω để giới hạn dòng."],
  "led.GND": ["Cathode (−), chân ngắn, phía có mặt vát trên vỏ LED.", "Nối GND."],
  "buzzer.SIG": ["Chân tín hiệu của còi piezo: tần số xung quyết định cao độ âm.", "Nối GPIO và dùng tone(pin, tần số)."],
  "sevseg.GND": ["Chân chung (COM) của loại Cathode chung.", "Nối GND. Nếu module là loại Anode chung thì COM nối VCC và logic đảo ngược."],
  "sevseg.DP": ["Dấu chấm thập phân (Decimal Point).", "Nối GPIO qua điện trở 220–330 Ω."],
  "ldr.AO": ["Analog Out: điện áp thay đổi liên tục theo độ sáng.", "Nối chân ADC và đọc bằng analogRead()."],
  "ldr.DO": ["Digital Out: ra 0 hoặc 1 khi độ sáng vượt ngưỡng chỉnh bằng biến trở trên module.", "Nối GPIO đặt INPUT và đọc bằng digitalRead()."],
  "dht22.SDA": ["Dây dữ liệu 1 dây riêng của DHT (không phải I2C dù in chữ SDA). Gửi nhiệt độ và độ ẩm theo xung thời gian.", "Nối một GPIO, có điện trở kéo lên 4.7–10 kΩ lên VCC; dùng thư viện DHT."]
};
for (const s of "ABCDEFG") PIN_DOC["sevseg." + s] = [`Đoạn ${s} của LED 7 đoạn (đặt tên theo chiều kim đồng hồ từ A ở trên cùng, G ở giữa).`, "Nối GPIO qua điện trở 220–330 Ω; HIGH = đoạn sáng (loại Cathode chung)."];
