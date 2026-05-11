# Hướng dẫn triển khai từng bước

Domain mẫu: **`trienlam.gamegiaoduc.co`** (tường ảnh triển lãm). Thư mục trên server: **`/opt/image_wall`**.

Nếu trước đó bật **`tlcand.*`** trên Nginx: `sudo rm -f /etc/nginx/sites-enabled/*tlcand*` và trỏ DNS **`trienlam.gamegiaoduc.co`** → IP server, rồi cài file `trienlam.gamegiaoduc.co.conf` như mục 5.

---

## 1. Chuẩn bị server

- **Hệ điều hành:** Linux (Ubuntu/Debian khuyến nghị).
- Cài **Docker** và **Docker Compose** (plugin `docker compose`).
- Mở firewall (nếu dùng `ufw`):
  - Chỉ Docker + truy cập trực tiếp: `sudo ufw allow 5000/tcp` (và 5001–5003 nếu bật thêm trong `docker-compose.yml`).
  - Nếu dùng **Nginx trên host** (cổng 80/443): `sudo ufw allow 80/tcp` và `sudo ufw allow 443/tcp`; có thể **không** mở 5000 ra ngoài nếu chỉ reverse-proxy nội bộ (xem bước 5).

---

## 2. DNS

- Tạo bản ghi **A** (hoặc CNAME hợp lệ): **`trienlam.gamegiaoduc.co` → IP public** của máy chủ.
- Chờ DNS ổn định (vài phút đến vài giờ). Kiểm tra: `dig +short trienlam.gamegiaoduc.co`.

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

3. Cài file site cho Nginx **trên host** — **bắt buộc** tên đúng **`trienlam.gamegiaoduc.co`** (chữ **uc**, không phải **ich**):

   ```bash
   sudo cp /opt/image_wall/deploy/nginx-host/trienlam.gamegiaoduc.co.conf /etc/nginx/sites-available/
   sudo ln -sf /etc/nginx/sites-available/trienlam.gamegiaoduc.co.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

   Không dùng file/symlink `*gamegiaodich*` — đó là domain sai, Host header thật sẽ không khớp.

4. Thử: `http://trienlam.gamegiaoduc.co` (phải trỏ DNS đúng IP).

Lúc này host Nginx proxy tới `http://127.0.0.1:5000` (container Nginx trong Docker).

---

## 6. HTTPS (Let’s Encrypt) — chọn một cách

Tất cả script nằm trong `/opt/image_wall/deploy/ssl/`. Cần **chạy bằng `sudo`**. Biến thường dùng: `EMAIL=`, tùy chọn `DOMAIN=trienlam.gamegiaoduc.co`, `BACKEND=127.0.0.1:5000`.

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

Sau khi có cert, file site thường đã gồm **redirect HTTP → HTTPS** và **server 443** (do template `trienlam.gamegiaoduc.co.ssl-sync.template.conf` được render bởi `issue-sync.sh`).

**Gia hạn cert:** cấu hình `renew_hook` / `deploy_hook` reload Nginx (xem comment cuối `issue-sync.sh` hoặc `deploy/ssl/renew-reload-nginx.sh`).

---

## 7. Kiểm tra sau khi bật HTTPS

```bash
curl -I https://trienlam.gamegiaoduc.co
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
| `cp: cannot stat ... trienlam.gamegiaoduc.co.conf`: No such file | Repo trên server thiếu thư mục/code mới: `cd /opt/image_wall && git pull`, hoặc copy nguyên file `deploy/nginx-host/trienlam.gamegiaoduc.co.conf` từ máy dev lên server đúng đường dẫn rồi chạy lại `cp` vào `sites-available`. |
| `nginx: [emerg] open() "... sites-enabled/trienlam..." failed` | Symlink trỏ tới file không tồn tại (do `cp` lỗi). **Sửa gấp:** `sudo rm -f /etc/nginx/sites-enabled/trienlam.gamegiaoduc.co.conf` → `sudo nginx -t && sudo systemctl reload nginx`. Sau khi có file đúng trong `/opt/image_wall/...`, tạo lại symlink như bước 5. |
| `duplicate upstream "image_wall_backend"` | Hai file trong `sites-enabled` (hoặc một file lặp khối `upstream`) cùng định nghĩa một tên upstream. Repo đã đổi tên thành **`trienlam_gamegiaoduc_upstream`**. Trên server: `git pull`, copy lại file site từ `deploy/nginx-host/`, xóa bản cũ trùng upstream trong `sites-enabled`, chỉ giữ **một** file site cho domain này. |
| `curl http://.../.well-known/...` → **301** (nginx Ubuntu) | Khối `:80` đang **redirect toàn bộ** sang HTTPS trước khi serve challenge, hoặc request rơi vào **`default_server`** khác. Sửa: dùng `location ^~ /.well-known/acme-challenge/` + `root /var/www/certbot` (đã cập nhật trong repo), copy lại file site; chạy `sudo nginx -T \| grep -n server_name` và đảm bảo chỉ **một** `server` cho domain này trên `:80` và acme **trước** mọi `return 301 https`. |
| 502 Bad Gateway | Kiểm tra `docker compose ps`; `curl http://127.0.0.1:5000` trên server. |
| Sai domain / Host header | Đồng bộ `server_name` với DNS; trong repo đã dùng `trienlam.gamegiaoduc.co`. |
| SSL lỗi | `sudo certbot certificates`; DNS phải trỏ đúng IP trước khi xin cert. |
| Upload lớn bị chặn | Tăng `client_max_body_size` trong file site Nginx host. |
| HTTP `trienlam` đúng nhưng **HTTPS vẫn ra ARVR / app khác** | Trên **:443** chưa có (hoặc sai) `server_name trienlam.gamegiaoduc.co` proxy về `127.0.0.1:5000`. File `trienlam.gamegiaoduc.co.conf` trong repo **chỉ có cổng 80** — bắt buộc chạy **`issue-sync.sh`** (sau khi certbot thành công) để ghi file site có **cả 443**. Kiểm tra: `sudo nginx -T 2>/dev/null | grep -n trienlam` và tìm khối `listen 443 ssl`. |
| Nhầm **`gamegiaodich`** vs **`gamegiaoduc`** | Chỉ dùng **`trienlam.gamegiaoduc.co`** (chữ **uc** = giáo dục). Xóa mọi symlink/file **`trienlam.gamegiaodich.co`**. Lệnh: `ls -la /etc/nginx/sites-enabled/ | grep trienlam`. |

---

## 10. Rà soát nhanh (copy trên server)

Chạy lần lượt; mỗi bước phải “đúng” trước khi sang bước sau.

**A — Tên miền & file site (lỗi hay gặp nhất)**

```bash
# Chỉ được thấy ...gamegiaoduc... — KHÔNG có ...gamegiaodich...
ls -la /etc/nginx/sites-enabled/ | grep -i trienlam
sudo nginx -T 2>/dev/null | grep -n "server_name.*trienlam"
```

Nếu còn `trienlam.gamegiaodich.co`: `sudo rm -f /etc/nginx/sites-enabled/*trienlam*giaodich*` rồi cài lại file đúng như mục 5.

**B — Docker backend (image_wall)**

```bash
cd /opt/image_wall && docker compose ps
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5000/
```

Mã **200** (hoặc 3xx nhẹ của Next) là ổn. Nếu connection refused → kiểm tra `docker-compose.yml` có bind **`127.0.0.1:5000:80`** khi dùng Nginx host.

**C — HTTP + Host (Nginx host)**

```bash
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
echo ok | sudo tee /var/www/certbot/.well-known/acme-challenge/ping.txt
curl -4sS -H "Host: trienlam.gamegiaoduc.co" "http://127.0.0.1/.well-known/acme-challenge/ping.txt"
```

Phải in **`ok`**. Nếu **301**: xem mục 9 (acme / default_server / file sai tên).

**D — HTTPS có đúng vhost `trienlam` chưa**

```bash
sudo nginx -T 2>/dev/null | grep -n "listen 443" | head -5
sudo nginx -T 2>/dev/null | awk '/listen 443/,/^}/' | grep -n "server_name\|trienlam\|trienlam_gamegiaoduc_upstream" | head -30
```

Phải có khối **`listen 443`** với **`server_name trienlam.gamegiaoduc.co`** và **`proxy_pass`** tới upstream Docker. Nếu **không có** → trình duyệt HTTPS vẫn vào **site mặc định 443** (vd. ARVR). Chạy `sudo EMAIL=... ./deploy/ssl/issue-sync.sh` sau khi cert Let’s Encrypt đã xin được (webroot/standalone/DNS tùy môi trường).

**E — DNS trỏ đúng máy này**

```bash
dig +short trienlam.gamegiaoduc.co
curl -4sS "http://trienlam.gamegiaoduc.co/.well-known/acme-challenge/ping.txt"
```

IP `dig` phải trùng server đang chạy Nginx + Docker. Nếu `curl` qua tên miền khác với `curl` qua `127.0.0.1` + `Host` → kiểm tra **Cloudflare** (DNS only khi xin cert webroot) hoặc DNS trỏ nhầm.

---

## Tóm tắt luồng khuyến nghị

1. DNS → **A** record.  
2. Clone vào **`/opt/image_wall`** → `docker compose up -d --build`.  
3. Đổi compose **`127.0.0.1:5000:80`** nếu dùng Nginx host.  
4. Copy **`deploy/nginx-host/trienlam.gamegiaoduc.co.conf`** → `sites-enabled`.  
5. Chạy một script trong **`deploy/ssl/`** để có HTTPS.  
6. Kiểm tra `https://trienlam.gamegiaoduc.co`.
