# Pindexio – Thông tin chân & datasheet board

Tra cứu sơ đồ chân vi điều khiển bằng **tiếng Việt và tiếng Anh**, dựa trên datasheet của hãng.
Web tĩnh thuần (không framework, không máy chủ), tối ưu cho điện thoại và iPad, cài được lên màn hình chính như app.

**Đang chạy tại:** https://pindexio.com

## Có gì

- **8 board:** ESP32-C3-DevKitM-1, ESP32-C3 Super Mini, ESP32-S3-DevKitC-1, LilyGO T-Display-S3,
  Raspberry Pi Pico 2 W, Pico 2, Raspberry Pi 4/5 (header 40 chân), Arduino Uno R3.
- **14 linh kiện** cũng có sơ đồ chân riêng (OLED, ST7789, HC-SR04, MPU6050, INMP441…), kèm giải thích từng chân.
- **3 kiểu xem board:** PCB theo toạ độ mm thật, sơ đồ khối kiến trúc, schematic gốc của hãng.
- **⚡ Tab Connect:** kéo thả linh kiện lên board, nối dây, cảnh báo chân sai, sinh sẵn `#define`.
- **Tab Tính toán:** điện trở LED, phân áp ADC, pull-up I2C, mạch RC.
- **Tab Tài liệu:** link datasheet và schematic gốc.
- Song ngữ Việt/Anh, 4 giao diện, chế độ sáng/tối.

## Cấu trúc

| Đường dẫn | Việc |
|---|---|
| `js/boards.js` | Dữ liệu board (nguồn sự thật): chân, toạ độ mm, linh kiện, tài liệu |
| `js/modules.js` | 14 linh kiện cho tab Connect + giải thích từng chân |
| `js/app.js` | Vẽ SVG, panel chi tiết, bộ lọc, router |
| `js/seo-body.js` | Khối chữ cuối trang, dùng chung cho app và trang tĩnh |
| `js/affiliates.js` | Link tiếp thị liên kết theo vùng (Việt Nam / Quốc tế) |
| `js/admin.js` | Trang admin sửa link, xem bên dưới |
| `css/app.css` | Giao diện nền; `pinout.css` / `retro.css` / `amber.css` là các bộ giao diện |

Chi tiết dành cho người (hoặc AI) sửa code nằm trong [AGENTS.md](AGENTS.md).

## Trang admin

Không cần máy chủ. Mở trang **trên máy có thư mục dự án** (Chrome hoặc Edge), mở admin bằng một trong ba cách: **Ctrl + Shift + E**, thêm `?edit` vào URL, hoặc **bấm logo 5 lần liền** (cách này dùng được cả trên điện thoại).

- Mật khẩu mặc định **`pindex`**. Đổi bằng nút **Đổi mật khẩu** (ít nhất 4 ký tự) rồi **Lưu vào file**; mật khẩu được băm SHA-256 vào `js/admin-auth.js`.
- **Link mua hàng:** sửa link tiếp thị cho từng board, từng vùng (Việt Nam / Quốc tế).
- **Bài viết:** thêm, sửa, xoá bài Tin tức / Hướng dẫn cho trang chủ (bấm logo để xem). Soạn bằng markdown đơn giản, có xem trước và nút chèn ảnh.
- **Cài đặt:** bật/tắt khung thẻ "Mua board" (mặc định tắt, chỉ còn nút Mua board màu cyan cho board đang xem).
- **Giao diện:** màu ban ngày và ban đêm (9 màu mỗi chế độ), font chữ chính, font chữ số, cỡ chữ cơ bản. Xem trước ngay.
- **✎ Sửa trực tiếp trên trang:** nhấp phải vào bất kỳ chữ, khung hay ảnh nào để đổi màu chữ, màu nền, font, cỡ chữ, độ đậm, kích thước.
  Màu áp riêng cho chế độ đang xem (ngày hoặc đêm); font và kích thước áp cho cả hai. Ảnh thumbnail "Mua board" có thêm nút **Thay ảnh**
  (ảnh được thu nhỏ còn 1000px, lưu WebP vào `img/uploads/`).
- Bấm **Lưu vào file** → chọn thư mục dự án → admin ghi `js/affiliates.js`, `css/custom.css`, `js/images.js`, `js/admin-auth.js`, `js/posts.js`, `js/settings.js`. Sau đó **commit và push** thì trang thật mới đổi.
- **Từ xa (máy bất kỳ, cả điện thoại):** mở `pindexio.com/?edit`, sửa, bấm **☁ Lưu lên GitHub**. Lần đầu dán một GitHub token *fine-grained* chỉ cho repo này, quyền *Contents: Read and write*. Token chỉ nằm trong trình duyệt đó (xoá ở tab Cài đặt), không bao giờ vào repo. Mọi thay đổi gộp thành 1 commit trên `main`, Cloudflare tự deploy sau khoảng 1 phút.

Khách truy cập không tải mã admin (chỉ có một đoạn nạp nhỏ), và không ai ghi được gì vào trang thật trừ người có quyền push lên GitHub.

## Chạy thử trên máy

```bash
python -m http.server 8765
```
Mở http://127.0.0.1:8765/ (cần chạy qua server vì có `fetch` và service worker).

## Sau khi sửa dữ liệu

```bash
node tools/check-i18n.js    # báo câu tiếng Việt chưa có bản dịch EN (thoát 1 nếu còn)
python tools/og.py          # ảnh xem trước khi chia sẻ: og/*.png
node tools/build-seo.js     # trang tĩnh từng board (VI + /en/), sitemap, robots, và tự tăng phiên bản cache
```

`index.html` là khuôn: đừng sửa tay phần giữa `<!--SEO-->…<!--/SEO-->` và `<!--SEOBODY-->…<!--/SEOBODY-->`.

## Triển khai

Push nhánh `main` → Cloudflare Pages tự build (khoảng 1 phút).
`.assetsignore` loại `.git`, README… khỏi bản upload.

## Nguồn dữ liệu

Tổng hợp từ datasheet của Espressif, Raspberry Pi và Arduino. Có thể có sai sót —
kiểm tra lại tài liệu gốc trước khi làm mạch thật. Các tên ESP32, Raspberry Pi, Arduino
thuộc về chủ sở hữu tương ứng; dự án này không liên kết với họ.
