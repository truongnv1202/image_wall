# Hướng dẫn triển khai từng bước

Domain mẫu: **`tlcand.gamegiaoduc.co`**. Thư mục trên server: **`/opt/image_wall`**.

---

## 1. Chuẩn bị server

- **Hệ điều hành:** Linux (Ubuntu/Debian khuyến nghị).
- Cài **Docker** và **Docker Compose** (plugin `docker compose`).
- Mở firewall (nếu dùng `ufw`):
  - Chỉ Docker + truy cập trực tiếp: `sudo ufw allow 5000/tcp` (và 5001–5003 nếu bật thêm trong `docker-compose.yml`).
  - Nếu dùng **Nginx trên host** (cổng 80/443): `sudo ufw allow 80/tcp` và `sudo ufw allow 443/tcp`; có thể **không** mở 5000 ra ngoài nếu chỉ reverse-proxy nội bộ (xem bước 5).

---

## 2. DNS

- Tạo bản ghi **A** (hoặc CNAME hợp lệ): **`tlcand.gamegiaoduc.co` → IP public** của máy chủ.
- Chờ DNS ổn định (vài phút đến vài giờ). Kiểm tra: `dig +short tlcand.gamegiaoduc.co`.

---

## 3. Đưa mã nguồn lên `/opt/image_wall`

Ví dụ bằng `git clone` (hoặc `scp`/`rsync` toàn bộ thư mục project):

```bash
sudo mkdir -p /opt/image_wall
sudo chown "$USER:$USER" /opt/image_wall
cd /opt/image_wall
# git clone <url-repo> .   hoặc copy file vào đây
```

Đảm bảo có: `Dockerfile`, `docker-compose.yml`, thư mục `deploy/`, file `data/pools.json` (nếu có trong repo), v.v.

---

## 4. Chạy ứng dụng bằng Docker

```bash
cd /opt/image_wall
docker compose up -d --build
```

- **web:** Next.js (nội bộ cổng 3000 trong mạng Docker).
- **nginx (trong compose):** map host **`5000` → 80** container, reverse-proxy tới `web`.

Kiểm tra:

```bash
docker compose ps
curl -I http://127.0.0.1:5000
```

Mở trình duyệt: `http://<IP-server>:5000` (nếu firewall cho phép).

---

## 5. (Khuyến nghị) Nginx trên host + chung cổng 80/443

Khi trên cùng máy đã có Nginx phục vụ nhiều site, không nên public cổng 5000.

1. Sửa `docker-compose.yml`, thay phần `ports` của service `nginx` từ:

   ```yaml
   - "5000:80"
   ```

   thành (chỉ lắng nghe trên máy chủ):

   ```yaml
   - "127.0.0.1:5000:80"
   ```

2. Khởi động lại:

   ```bash
   cd /opt/image_wall
   docker compose up -d
   ```

3. Cài file site cho Nginx **trên host** (tên file khớp domain):

   ```bash
   sudo cp /opt/image_wall/deploy/nginx-host/tlcand.gamegiaoduc.co.conf /etc/nginx/sites-available/
   sudo ln -sf /etc/nginx/sites-available/tlcand.gamegiaoduc.co.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. Thử: `http://tlcand.gamegiaoduc.co` (phải trỏ DNS đúng IP).

Lúc này host Nginx proxy tới `http://127.0.0.1:5000` (container Nginx trong Docker).

---

## 6. HTTPS (Let’s Encrypt) — chọn một cách

Tất cả script nằm trong `/opt/image_wall/deploy/ssl/`. Cần **chạy bằng `sudo`**. Biến thường dùng: `EMAIL=`, tùy chọn `DOMAIN=tlcand.gamegiaoduc.co`, `BACKEND=127.0.0.1:5000`.

| Cách | Script | Ghi chú ngắn |
|------|--------|----------------|
| **Webroot** (có sẵn thư mục challenge) | `bootstrap-http-only.sh` rồi `issue-sync.sh` | Phổ biến khi Nginx host đã serve `/.well-known` từ `/var/www/certbot` |
| **Standalone** | `issue-certbot-standalone.sh` | Cần **giải phóng cổng 80** tạm thời (dừng Nginx host, v.v.) |
| **Plugin Nginx** | `issue-certbot-nginx-plugin.sh` | Cài `python3-certbot-nginx`, Nginx đã có `server_name` đúng domain |
| **Certbot bằng Docker** | `issue-certbot-docker-standalone.sh` | Port 80 trống; cert lưu vào `/etc/letsencrypt` trên host |

Ví dụ chuỗi **webroot** (sau bước 5 — site HTTP-only đã enabled):

```bash
cd /opt/image_wall
sudo chmod +x deploy/ssl/*.sh
sudo ./deploy/ssl/bootstrap-http-only.sh
sudo EMAIL=admin@example.com ./deploy/ssl/issue-sync.sh
```

Sau khi có cert, file site thường đã gồm **redirect HTTP → HTTPS** và **server 443** (do template `tlcand.gamegiaoduc.co.ssl-sync.template.conf` được render bởi `issue-sync.sh`).

**Gia hạn cert:** cấu hình `renew_hook` / `deploy_hook` reload Nginx (xem comment cuối `issue-sync.sh` hoặc `deploy/ssl/renew-reload-nginx.sh`).

---

## 7. Kiểm tra sau khi bật HTTPS

```bash
curl -I https://tlcand.gamegiaoduc.co
```

Trên trình duyệt: tải trang, thử **upload ảnh** (body tối đa Nginx thường 25m trong file mẫu).

---

## 8. Cập nhật phiên bản sau này

```bash
cd /opt/image_wall
git pull   # nếu dùng git
docker compose up -d --build
```

Dữ liệu **pools ảnh** và **upload** nằm trong Docker volumes (`pools-data`, `uploads-data`), không mất khi build lại image.

---

## 9. Xử lý sự cố nhanh

| Hiện tượng | Hướng xử lý |
|------------|-------------|
| `cp: cannot stat ... tlcand.gamegiaoduc.co.conf`: No such file | Repo trên server thiếu thư mục/code mới: `cd /opt/image_wall && git pull`, hoặc copy nguyên file `deploy/nginx-host/tlcand.gamegiaoduc.co.conf` từ máy dev lên server đúng đường dẫn rồi chạy lại `cp` vào `sites-available`. |
| `nginx: [emerg] open() "... sites-enabled/tlcand..." failed` | Symlink trỏ tới file không tồn tại (do `cp` lỗi). **Sửa gấp:** `sudo rm -f /etc/nginx/sites-enabled/tlcand.gamegiaoduc.co.conf` → `sudo nginx -t && sudo systemctl reload nginx`. Sau khi có file đúng trong `/opt/image_wall/...`, tạo lại symlink như bước 5. |
| 502 Bad Gateway | Kiểm tra `docker compose ps`; `curl http://127.0.0.1:5000` trên server. |
| Sai domain / Host header | Đồng bộ `server_name` với DNS; trong repo đã dùng `tlcand.gamegiaoduc.co`. |
| SSL lỗi | `sudo certbot certificates`; DNS phải trỏ đúng IP trước khi xin cert. |
| Upload lớn bị chặn | Tăng `client_max_body_size` trong file site Nginx host. |

---

## Tóm tắt luồng khuyến nghị

1. DNS → **A** record.  
2. Clone vào **`/opt/image_wall`** → `docker compose up -d --build`.  
3. Đổi compose **`127.0.0.1:5000:80`** nếu dùng Nginx host.  
4. Copy **`deploy/nginx-host/tlcand.gamegiaoduc.co.conf`** → `sites-enabled`.  
5. Chạy một script trong **`deploy/ssl/`** để có HTTPS.  
6. Kiểm tra `https://tlcand.gamegiaoduc.co`.
