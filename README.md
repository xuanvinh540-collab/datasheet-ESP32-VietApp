# Pin Explorer VN

Tra cứu sơ đồ chân vi điều khiển bằng tiếng Việt, dựa trên datasheet hãng. Web tĩnh, tối ưu cho điện thoại và iPad (cài được lên màn hình chính).

Board hiện có: ESP32-C3 Super Mini, ESP32-S3-DevKitC-1, Raspberry Pi Pico 2 W, Arduino Uno R3, Raspberry Pi 4/5 (header 40 chân).

- Hai kiểu xem: PCB (vị trí chân theo mm thật) và Schematic (ký hiệu connector).
- Tab Tính toán: điện trở LED, phân áp ADC, pull-up I2C, mạch RC.
- Tab Tài liệu: link datasheet/schematic gốc của hãng.

## Cấu trúc
- `js/boards.js` – dữ liệu board. Thêm board mới: tạo object theo mẫu (toạ độ mm, gốc góc trên-trái PCB) và thêm vào `BOARDS`.
- `js/app.js` – vẽ SVG, panel chi tiết, bộ tính toán.
- `css/app.css` – giao diện (sáng/tối).

## Deploy Cloudflare
```
npx wrangler deploy --assets=. --name pin-explorer-vn --compatibility-date 2026-10-19
```
(chỉ nên chép `index.html icon.svg manifest.webmanifest sw.js css js` vào một thư mục riêng rồi trỏ `--assets` tới đó).
