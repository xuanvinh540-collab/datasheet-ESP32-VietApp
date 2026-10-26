/* Thư viện module cho chế độ Build.
   pins[].role: loại chân cần (spi.sck, spi.mosi, spi.miso, spi.cs, i2c.sda, i2c.scl, i2s.bclk, i2s.ws, i2s.dout, i2s.din, adc, out, in, pwm)
   pins[].v5: chân này ra mức 5 V (cần chia áp nếu board 3.3 V). family: các dòng chip hỗ trợ. */
window.MODULES = {
  st7789: {
    name: "Màn TFT ST7789", short: "ST7789", color: "#e8672a", iface: "SPI", vcc: "3V3",
    pins: [["SCK", "spi.sck"], ["SDA/MOSI", "spi.mosi"], ["CS", "spi.cs"], ["DC", "out"], ["RST", "out"], ["BL", "pwm"]],
    lib: "Adafruit ST7735 and ST7789 Library + Adafruit GFX",
    note: "Màn 1.3–2\" 240×240/240×320. Chân SDA của màn là MOSI (SPI), không phải I2C."
  },
  ws2812: {
    name: "LED RGB WS2812", short: "WS2812", color: "#ff4fa3", iface: "1 dây", vcc: "5V",
    pins: [["DIN", "out"]],
    lib: "Adafruit NeoPixel",
    note: "Nguồn 5 V riêng nếu nhiều LED (~60 mA/LED). Thêm điện trở 330 Ω nối tiếp DIN và tụ 1000 µF ở nguồn."
  },
  hcsr04: {
    name: "Siêu âm HC-SR04", short: "HC-SR04", color: "#29adff", iface: "GPIO", vcc: "5V",
    pins: [["TRIG", "out"], ["ECHO", "in", 1]],
    lib: "(không cần thư viện)",
    note: "ECHO ra mức 5 V: với board 3.3 V phải chia áp (vd. 1 kΩ + 2 kΩ) trước khi vào chân GPIO."
  },
  vl53l0x: {
    name: "Cảm biến ToF VL53L0X", short: "VL53L0X", color: "#00b543", iface: "I2C 0x29", vcc: "3V3",
    pins: [["SDA", "i2c.sda"], ["SCL", "i2c.scl"], ["XSHUT", "out"]],
    lib: "Adafruit_VL53L0X",
    note: "Địa chỉ cố định 0x29. Gắn nhiều cảm biến thì dùng XSHUT bật lần lượt để đổi địa chỉ."
  },
  mpu6050: {
    name: "IMU 6 trục MPU6050", short: "MPU6050", color: "#8655d4", iface: "I2C 0x68", vcc: "3V3",
    pins: [["SDA", "i2c.sda"], ["SCL", "i2c.scl"], ["INT", "in"]],
    lib: "Adafruit MPU6050 + Adafruit Unified Sensor",
    note: "Địa chỉ 0x68 (AD0 = GND) hoặc 0x69 (AD0 = VCC). Module GY-521 có sẵn pull-up I2C."
  },
  max98357a: {
    name: "Ampli loa I2S MAX98357A", short: "MAX98357A", color: "#f5d63d", iface: "I2S", vcc: "5V",
    pins: [["BCLK", "i2s.bclk"], ["LRC", "i2s.ws"], ["DIN", "i2s.dout"]],
    lib: "ESP32: ESP_I2S (core 3.x) · Pico: I2S (arduino-pico)", family: ["ESP32", "RP2"],
    note: "Cấp 5 V để loa to hơn (tới 3 W). Chân GAIN để trống = 9 dB."
  },
  inmp441: {
    name: "Micro I2S INMP441", short: "INMP441", color: "#2fd6c3", iface: "I2S", vcc: "3V3",
    pins: [["SCK", "i2s.bclk"], ["WS", "i2s.ws"], ["SD", "i2s.din"]],
    lib: "ESP32: ESP_I2S (core 3.x) · Pico: I2S (arduino-pico)", family: ["ESP32", "RP2"],
    note: "Chân L/R nối GND = kênh trái. Chỉ chạy 3.3 V."
  }
};
