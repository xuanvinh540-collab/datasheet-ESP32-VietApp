/* Bài viết cho trang chủ (tab Tin tức / Hướng dẫn). Sửa bằng trang admin, tab "Bài viết" – admin ghi đè nguyên file này.
   type: "news" (tin tức) hoặc "guide" (hướng dẫn). body viết kiểu markdown đơn giản: # tiêu đề, **đậm**, _nghiêng_, `mã`,
   - danh sách, 1. danh sách số, [chữ](link), ![mô tả](ảnh), và khối mã giữa hai dòng ```. */
window.POSTS = [
  {
    "id": "ra-mat-pindexio",
    "type": "news",
    "date": "2026-10-27",
    "title": "Pindexio ra mắt: tra sơ đồ chân vi điều khiển bằng tiếng Việt",
    "summary": "8 board, 14 linh kiện, công cụ Wiring ghép linh kiện và nối dây, dữ liệu lấy từ datasheet của hãng.",
    "body": "Pindexio là trang tra cứu sơ đồ chân dành cho người làm mạch và IoT ở Việt Nam. Mỗi chân đều có chức năng, cảnh báo, thông số điện và linh kiện đi kèm, kèm nguồn trích dẫn từ tài liệu gốc của hãng.\n\n## Có gì trong bản đầu tiên\n\n- **8 board:** ESP32-C3-DevKitM-1, ESP32-C3 Super Mini, ESP32-S3-DevKitC-1, LilyGO T-Display-S3, Raspberry Pi Pico 2 W, Pico 2, Raspberry Pi 4/5 (header 40 chân), Arduino Uno R3.\n- **14 linh kiện** có sơ đồ chân riêng và giải thích từng chân: OLED SSD1306, màn ST7789, HC-SR04, MPU6050, VL53L0X, INMP441, MAX98357A…\n- **⚡ Wiring:** kéo thả linh kiện lên board, tự gợi ý chân an toàn, cảnh báo chân sai, sinh sẵn các dòng `#define`.\n- **Tính toán:** điện trở LED, phân áp cho ADC, pull-up I2C, mạch RC.\n- **Song ngữ** Việt và Anh, chế độ sáng và tối, cài lên màn hình điện thoại như một ứng dụng.\n\n## Dữ liệu lấy từ đâu\n\nThông số chân và giới hạn điện tổng hợp từ datasheet của Espressif, Raspberry Pi và Arduino. Mục **Tài liệu** liệt kê link gốc để bạn đối chiếu. Dữ liệu vẫn có thể sai sót, nên hãy kiểm tra lại tài liệu gốc trước khi làm mạch thật."
  },
  {
    "id": "tra-mot-chan",
    "type": "guide",
    "date": "2026-10-27",
    "title": "Tra nhanh một chân trên board",
    "summary": "Chọn board, bấm vào chân, đọc trạng thái và cảnh báo, lọc theo chức năng ADC, I2C, SPI…",
    "body": "## Các bước\n\n1. Chọn board ở cột bên trái (trên điện thoại là lưới board ở đầu trang).\n2. Bấm vào một chân trên hình. Panel chi tiết mở ra với chức năng, cảnh báo và thông số điện của chân đó.\n3. Đọc dòng trạng thái ở đầu panel:\n   - ✅ **Dùng tự do:** chân GPIO bình thường.\n   - ⚠ **Dùng được nhưng cần chú ý:** chân strapping, chân USB, ADC2 khi bật Wi-Fi…\n   - ⛔ **Không dùng làm GPIO:** chân nối với Flash hoặc PSRAM.\n\n## Tìm chân theo chức năng\n\n- Bấm các nút lọc **ADC, I2C, SPI, UART, Touch, USB, Strapping**: các chân phù hợp sáng lên, chân khác mờ đi. Panel bên phải giải thích luôn giao tiếp đó hoạt động thế nào.\n- Hoặc gõ vào ô tìm kiếm: số GPIO (`8`), tên chân (`IO8`) hay chức năng (`SDA`, `TX`).\n\n## Mẹo\n\n- Mục **Thông số chip** ngay dưới hình có dòng tiêu thụ, giới hạn điện áp, ADC, boot/strapping.\n- Nút **Kiến trúc** vẽ sơ đồ khối của board; **Schematic hãng** mở bản vẽ gốc nếu hãng có công bố."
  },
  {
    "id": "ghep-linh-kien-wiring",
    "type": "guide",
    "date": "2026-10-27",
    "title": "Ghép linh kiện và nối dây với Wiring",
    "summary": "Thêm màn hình, cảm biến lên board, để app tự chọn chân an toàn rồi lấy các dòng #define.",
    "body": "## Bắt đầu\n\n1. Mở board bạn dùng, bấm nút **⚡ Wiring** cạnh nút PCB.\n2. Ở cột bên phải, mở danh sách **Linh kiện** và bấm để thêm (ví dụ OLED 0.96\" và HC-SR04). Linh kiện mới được xếp quanh board, ngay trong khung nhìn.\n3. Bấm **✨ Tự nối chân**: app chọn chân phù hợp, tránh chân strapping, USB, UART0 và JTAG.\n\n## Chỉnh dây bằng tay\n\n- Kéo từ chấm tròn trên chân linh kiện tới một pad trên board. Pad xanh là an toàn, cam là có lưu ý.\n- Nắm đầu dây phía board để chuyển sang pad khác; nắm đầu phía linh kiện để chuyển dây sang chân khác.\n- **Nhấp phải** vào linh kiện hoặc dây để xoá, tự nối lại, hay **xoay 90°**. Nhấp phải vào nền trống để xoay cả board.\n\n## Lấy mã\n\nMở tab **Code** trong cột bên phải và bấm **Copy #define**. App chỉ sinh các dòng khai báo chân và khởi tạo bus, ví dụ:\n\n```\n#define I2C_SDA   8\n#define I2C_SCL   9\n// setup(): Wire.begin(I2C_SDA, I2C_SCL);\n```\n\nĐọc kỹ phần cảnh báo trước khi nối thật, nhất là các linh kiện ra mức 5 V như HC-SR04: board 3.3 V cần cầu chia áp."
  }
];
