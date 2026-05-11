# Tập lệnh triển khai — Tường ảnh (`image_wall`)

Thư mục mặc định trên server: **`/opt/image_wall`**. Domain mẫu trong repo: **`trienlam.gamegiaoduc.co`**.  
Đổi domain: export `DOMAIN=...` trước khi chạy các lệnh certbot / kiểm tra.

---

## Phần A — Biến (tùy chỉnh rồi dùng xuyên suốt)

```bash
export REPO_DIR=/opt/image_wall
export DOMAIN=trienlam.gamegiaoduc.co
export EMAIL="you@example.com"
```

**URL sau khi chạy app:** `/` chuyển hướng tới **`/wall`** (chỉ tường ảnh). Upload thử: **`/upload/<UPLOAD_PAGE_TOKEN>`** — token = biến môi trường **`UPLOAD_PAGE_TOKEN`** trong container (xem Phần E2). Ví dụ public: `https://${DOMAIN}/wall`.

---

## Phần B — Cài Docker (Ubuntu / Debian)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
# (đăng xuất / đăng nhập lại để nhóm docker có hiệu lực)
```

---

## Phần C — Firewall (`ufw`, tùy chọn)

**Chỉ Docker (truy cập qua cổng 5000):**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 5000/tcp
sudo ufw enable
sudo ufw status
```

**Nginx host (80/443) + Docker chỉ nội bộ:**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Không mở 5000 ra ngoài nếu đã bind 127.0.0.1:5000 trong docker-compose
sudo ufw enable
```

---

## Phần D — DNS

```bash
dig +short "$DOMAIN"
```

Bản ghi **A** (hoặc CNAME đúng) phải trỏ tới **IP public** máy chủ. Nếu thấy IP dạng **104.21.x / 172.67.x** → đang qua **Cloudflare proxy**; khi xin Let’s Encrypt kiểu **webroot** thường cần **DNS only (xám)** hoặc ngoại lệ `/.well-known`.

---

## Phần E — Lấy code và chạy Docker

```bash
sudo mkdir -p "$REPO_DIR"
sudo chown "$USER:$USER" "$REPO_DIR"
cd "$REPO_DIR"
# git clone <URL-repo> .   hoặc rsync/scp toàn bộ project vào đây

cd "$REPO_DIR"
docker compose up -d --build
```

### E2 — Token upload bí mật (khuyến nghị production)

Trong **`$REPO_DIR/.env`** (cùng cấp `docker-compose.yml`, không commit):

```bash
# Chuỗi dài khó đoán, ví dụ:
UPLOAD_PAGE_TOKEN="$(openssl rand -hex 24)"
```

Sau đó `docker compose up -d --build` (hoặc `docker compose up -d` nếu chỉ đổi env). Trang upload chỉ mở tại:

`https://${DOMAIN}/upload/<giá-trị-UPLOAD_PAGE_TOKEN>`

Gọi **`POST /api/upload`** từ ngoài (curl/script) khi đã bật token: thêm header **`x-upload-token: <cùng giá trị>`**. Nếu không đặt `UPLOAD_PAGE_TOKEN`: mọi đường dẫn `/upload/...` trả **404**, API upload không kiểm tra header.

**Kiểm tra container và HTTP backend:**

```bash
cd "$REPO_DIR"
docker compose ps
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:5000/
```

**Log khi lỗi:**

```bash
cd "$REPO_DIR"
docker compose logs -f --tail=100 web
docker compose logs -f --tail=100 nginx
```

**Dừng / khởi động lại:**

```bash
cd "$REPO_DIR"
docker compose down
docker compose up -d
```

---

## Phần F — Nginx trên host (chung 80/443 với site khác)

**1) Chỉ cho Docker nghe localhost (khuyến nghị):** trong `docker-compose.yml`, service `nginx` → `ports`:

```yaml
    ports:
      - "127.0.0.1:5000:80"
```

**2) Áp dụng:**

```bash
cd "$REPO_DIR"
docker compose up -d
```

**3) Gỡ site cũ nhầm tên (nếu có):**

```bash
sudo rm -f /etc/nginx/sites-enabled/*tlcand*
sudo rm -f /etc/nginx/sites-available/*tlcand*
```

**4) Bật site `trienlam` (đúng chữ *giaoduc*, không phải *giaodich*):**

```bash
sudo cp "$REPO_DIR/deploy/nginx-host/trienlam.gamegiaoduc.co.conf" /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/trienlam.gamegiaoduc.co.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**5) Thử qua Host header (bỏ qua DNS):**

```bash
curl -4sS -H "Host: ${DOMAIN}" http://127.0.0.1/ -o /dev/null -w "%{http_code}\n"
```

---

## Phần G — HTTPS (Let’s Encrypt)

Cài certbot (một lần):

```bash
sudo apt-get install -y certbot
```

Thư mục webroot (một lần):

```bash
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
```

Quyền thực thi script:

```bash
cd "$REPO_DIR"
chmod +x deploy/ssl/*.sh
```

### G1 — Webroot + đồng bộ Nginx (HTTP→HTTPS + 443) — **mặc định khuyến nghị**

```bash
cd "$REPO_DIR"
sudo ./deploy/ssl/bootstrap-http-only.sh
sudo EMAIL="$EMAIL" ./deploy/ssl/issue-sync.sh
```

(`bootstrap` dùng `DOMAIN` mặc định trong script = `trienlam.gamegiaoduc.co`; đổi: `sudo DOMAIN=khác.tld EMAIL=... ./deploy/ssl/issue-sync.sh`.)

### G2 — Standalone (cần giải phóng cổng 80 tạm thời)

```bash
cd "$REPO_DIR"
sudo EMAIL="$EMAIL" ./deploy/ssl/issue-certbot-standalone.sh
```

(Tùy: `STOP_CMD` / `START_CMD` — xem đầu file script.)

### G3 — Plugin Nginx

```bash
sudo apt-get install -y python3-certbot-nginx
cd "$REPO_DIR"
sudo EMAIL="$EMAIL" ./deploy/ssl/issue-certbot-nginx-plugin.sh
```

### G4 — Certbot chạy trong container

```bash
cd "$REPO_DIR"
sudo EMAIL="$EMAIL" ./deploy/ssl/issue-certbot-docker-standalone.sh
```

### G5 — Gia hạn cert + reload Nginx

Thêm vào `/etc/letsencrypt/renewal/${DOMAIN}.conf` (sửa đúng tên file):

```ini
renew_hook = systemctl reload nginx
```

Hoặc dùng `deploy/ssl/renew-reload-nginx.sh` làm `deploy_hook` / `renew_hook` (chỉnh đường dẫn trong file renewal).

---

## Phần H — Kiểm tra sau triển khai

```bash
curl -sSIL "https://${DOMAIN}/" | head -20
curl -sSIL "https://${DOMAIN}/wall" | head -15
curl -sS "https://${DOMAIN}/api/images" | head -c 200
echo
```

**Challenge webroot (sau khi tạo `ping.txt`):**

```bash
echo ok | sudo tee /var/www/certbot/.well-known/acme-challenge/ping.txt
curl -4sS -H "Host: ${DOMAIN}" "http://127.0.0.1/.well-known/acme-challenge/ping.txt"
curl -4sS "http://${DOMAIN}/.well-known/acme-challenge/ping.txt"
```

Cả hai lệnh `curl` cuối nên in **`ok`** (không phải HTML 301 sai).

**HTTPS nội bộ (SNI):** dùng **hostname trong URL** (curl gửi SNI theo host của URL, không theo `-H Host`). `https://127.0.0.1/` → SNI là `127.0.0.1` → Nginx chọn sai `server` 443.

```bash
curl -4skI "https://${DOMAIN}/" --resolve "${DOMAIN}:443:127.0.0.1" | head -20
```

Kỳ vọng: `X-Powered-By: Next.js` (hoặc body lớn), không phải `content-length: 437` + `last-modified` kiểu file tĩnh.

---

## Phần I — Cập nhật code (Git)

```bash
cd "$REPO_DIR"
git fetch origin
git status
```

**Bỏ thay đổi local rồi kéo bản remote (cẩn thận — mất chỉnh sửa chưa commit):**

```bash
cd "$REPO_DIR"
git reset --hard origin/main
```

(Nhánh khác thì thay `main`.)

**Build lại image:**

```bash
cd "$REPO_DIR"
docker compose up -d --build
```

Dữ liệu **`data/images.json`** và **`public/uploads`** nằm trong volume Docker (`pools-data`, `uploads-data` trong `docker-compose.yml` — tên volume `pools-data` là tên cũ, vẫn mount thư mục `/app/data`).

---

## Phần J — Rà soát nhanh (một block)

```bash
export REPO_DIR=/opt/image_wall
export DOMAIN=trienlam.gamegiaoduc.co
cd "$REPO_DIR" && docker compose ps
curl -sS -o /dev/null -w "docker gateway :5000 → %{http_code}\n" http://127.0.0.1:5000/
ls -la /etc/nginx/sites-enabled/ | grep -i trienlam || true
sudo nginx -T 2>/dev/null | grep -n "server_name.*${DOMAIN}" || true
dig +short "$DOMAIN"
```

---

## Phần K — Bảng sự cố ngắn

| Hiện tượng | Lệnh / hướng xử lý |
|------------|-------------------|
| `git pull` báo overwrite | `git stash -u` rồi `git pull`, hoặc `git restore deploy/ssl/` rồi `git pull`, hoặc `git reset --hard origin/main` |
| `502 Bad Gateway` | `docker compose ps`; `curl -I http://127.0.0.1:5000/` |
| `cp: cannot stat ... trienlam...conf` | `cd "$REPO_DIR" && git pull`; kiểm tra file `deploy/nginx-host/trienlam.gamegiaoduc.co.conf` |
| Symlink Nginx gãy | `sudo rm -f /etc/nginx/sites-enabled/trienlam.gamegiaoduc.co.conf`; copy lại từ `deploy/nginx-host/`; `sudo nginx -t && sudo systemctl reload nginx` |
| Certbot **unauthorized** + Cloudflare | Tạm **DNS only**; hoặc DNS-01; hoặc ngoại lệ `/.well-known` |
| `curl` challenge **301** | Đảm bảo `server_name` đúng `DOMAIN`; có `location ^~ /.well-known/acme-challenge/` trước mọi `return 301 https`; không trùng file sai `*giaodich*` |
| HTTPS vẫn ra app khác | `sudo nginx -T | grep -n listen` — phải có `listen 443` + `server_name` đúng + `proxy_pass` sau `issue-sync.sh` |
| `issue-sync.sh` chạy xong mà 443 không đổi | Bản cũ ghi nhầm `/etc/nginx/sites-available/$DOMAIN` (không `.conf`). `git pull` rồi chạy lại; có thể `sudo rm -f /etc/nginx/sites-available/trienlam.gamegiaoduc.co` (file không đuôi `.conf` nếu còn sót) |
| Upload lớn | Tăng `client_max_body_size` trong file site Nginx |
| `duplicate upstream` | Hai file cùng định nghĩa một `upstream` — chỉ giữ một file site cho domain; upstream trong repo: `trienlam_gamegiaoduc_upstream` |
| Upload **401 Unauthorized** | Container thiếu hoặc sai `UPLOAD_PAGE_TOKEN` so với URL `/upload/...`; hoặc curl thiếu header `x-upload-token`. |
| Upload **500** / “Không ghi được” | Bản image cũ: volume `data`/`uploads` quyền root. `git pull` + `docker compose build --no-cache web` + `up -d` (entrypoint `chown` trong image mới). |

---

## Phần L — Dev local (máy dev, không Docker)

```bash
cd /path/to/image_wall
npm install
npm run dev
```

Mở `http://localhost:5000/wall` (dev cổng 5000); upload dev: `http://localhost:5000/upload/dev-upload`. Production: `https://trienlam.gamegiaoduc.co/wall`.

---

## Tóm tắt một dòng

**Server:** `cd /opt/image_wall` → tạo `.env` (`UPLOAD_PAGE_TOKEN=...` nếu cần upload bí mật) → `docker compose up -d --build` → (tuỳ chọn) `127.0.0.1:5000:80` → site Nginx `trienlam...conf` → `chmod +x deploy/ssl/*.sh` → `bootstrap-http-only.sh` → `EMAIL=... issue-sync.sh` → kiểm tra `https://$DOMAIN/wall`.
