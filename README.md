# image_wall — Tường ảnh tương tác

Next.js (App Router), lưới 100×60, mask canvas chữ **HÒA BÌNH / ĐẸP LẮM**, polling `GET /api/images`, upload `POST /api/upload`.

**Production:** `https://trienlam.gamegiaoduc.co`  
**Dev local:** `http://localhost:5000`

## Chạy dev

```bash
npm install
npm run dev
```

Mở [http://localhost:5000](http://localhost:5000). Cổng mặc định **5000** (xem `package.json`).

## Build & start (local hoặc thử production)

```bash
npm run build
npm start
```

(`start` cũng dùng cổng **5000**; Docker image vẫn chạy Next qua `PORT=3000` trong `Dockerfile` — không đổi.)

## Triển khai server

Xem **`deploy/DEPLOY.md`** (tập lệnh copy-paste: Docker, Nginx, SSL).
