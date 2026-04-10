# Subdomain Setup - Kendi Domain'ini Kullan

## 📋 Scenario

```
Existing Domain:  example.com (GoDaddy, Namecheap, vb.)
Subdomain:        quiz.example.com  ← Quiz game burada çalışacak
EC2 Instance:     54.123.45.67
```

---

## 🚀 STEP 1: EC2'ye Elastic IP (Static IP)

AWS'de public IP her restart'ta değişir. Subdomain'i işaret edebilmek için static IP gerekli:

```bash
# 1. Elastic IP allocate et
aws ec2 allocate-address \
    --domain vpc \
    --region eu-west-1

# Output:
# "AllocationId": "eipalloc-0123456789abcdef"
# "PublicIp": "54.123.45.67"

ALLOCATION_ID="eipalloc-0123456789abcdef"
INSTANCE_ID="i-0123456789abcdef"

# 2. EC2 instance'a associate et
aws ec2 associate-address \
    --instance-id $INSTANCE_ID \
    --allocation-id $ALLOCATION_ID \
    --region eu-west-1

# ✅ Sonuç: 54.123.45.67 kalıcı oldu
```

---

## 🌐 STEP 2: Domain Provider'da DNS Record Ekle

**Domain Provider:** GoDaddy, Namecheap, Bluehost, vb.

### Konsolunda:

```
1. Domain Management → DNS Records
2. "Add Record" veya "New Record"
3. Type: A
   Host/Name: quiz (veya quiz.example.com)
   Value: 54.123.45.67
   TTL: 3600 (or leave default)
4. Save
```

**Örnek - GoDaddy:**
```
┌─────────────────────────────────────┐
│ DNS Records                         │
├─────────────────────────────────────┤
│ Type  | Host | Points To | TTL     │
├─────────────────────────────────────┤
│ A     | @    | 93.xx.xx  | 1h      │ (root domain)
│ A     | quiz | 54.123... | 1h      │ ← BU EKLE
│ MX    | @    | mail...   | Default │
└─────────────────────────────────────┘
```

---

## ✅ STEP 3: DNS Propagation Kontrol

```bash
# Wait 10-30 dakika, sonra test et:

nslookup quiz.example.com
# Expected output:
# Server: 8.8.8.8
# Address: 54.123.45.67

# Veya:
dig quiz.example.com

# Veya browser'da:
curl https://quiz.example.com/healthz
# Expected: ❌ SSL error (still untrusted cert)
```

---

## 🔐 STEP 4: SSL Certificate (Let's Encrypt)

EC2 instance'ında:

```bash
# SSH bağlan
ssh -i quiz-game-key.pem ec2-user@54.123.45.67

# 1. Certbot kurulum
sudo yum install certbot python3-certbot-nginx -y

# 2. SSL certificate iste (Let's Encrypt)
sudo certbot certonly --standalone \
    -d quiz.example.com \
    --email your-email@gmail.com \
    --agree-tos \
    --non-interactive

# ✅ Certificate paths:
# /etc/letsencrypt/live/quiz.example.com/fullchain.pem
# /etc/letsencrypt/live/quiz.example.com/privkey.pem

# 3. Auto-renewal setup (60 gün before expiry)
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer
```

---

## 🔗 STEP 5: nginx Config Güncelle

EC2'de `nginx-prod.conf`'i güncelle:

```bash
# Düzenle:
nano nginx-prod.conf
```

Değişiklikler:

```nginx
# OLD (localhost):
server_name _;

# NEW (your subdomain):
server_name quiz.example.com;

# OLD (generic cert paths):
ssl_certificate /etc/nginx/certs/server.crt;
ssl_certificate_key /etc/nginx/certs/server.key;

# NEW (Let's Encrypt paths):
ssl_certificate /etc/letsencrypt/live/quiz.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/quiz.example.com/privkey.pem;
```

Restart:
```bash
docker-compose restart nginx
```

---

## 📝 .env Update

EC2'de `.env` güncelleştir:

```bash
cat > .env <<EOF
DOMAIN=quiz.example.com

# RDS
RDS_ENDPOINT=quiz-game-db.XXXXXX.eu-west-1.rds.amazonaws.com
RDS_USER=postgres
RDS_PASSWORD=SecurePass!@#2026

DB_URL=jdbc:postgresql://quiz-game-db.XXXXXX.eu-west-1.rds.amazonaws.com:5432/gameadmin
DB_USER=postgres
DB_PASSWORD=SecurePass!@#2026

REDIS_HOST=redis
REDIS_PORT=6379

JWT_SECRET=$(openssl rand -base64 32)
ENGINE_TOKEN=$(openssl rand -base64 32)
ADMIN_PASSWORD=admin123
HOST_PASSWORD=host123

JPA_DDL_AUTO=update
LOG_LEVEL=INFO
EOF

docker-compose down
docker-compose up -d
```

---

## ✅ Final Testing

```bash
# 1. HTTPS works
curl -v https://quiz.example.com/healthz
# Expected: ✅ HTTP/2 200 OK

# 2. Browser
# https://quiz.example.com
# Expected: ✅ Green lock icon, UI loads

# 3. WebSocket (Browser console)
const ws = new WebSocket('wss://quiz.example.com/ws');
ws.onopen = () => console.log('✅ Connected');
```

---

## 📊 Architecture (Subdomain)

```
                  example.com (your domain)
                         ↓
                    DNS Record:
                    quiz.example.com → 54.123.45.67
                         ↓
           HTTPS (Port 443) - Let's Encrypt
                         ↓
        ┌─────────────────────────────┐
        │ EC2 t2.micro (54.123.45.67) │
        ├─────────────────────────────┤
        │ • Nginx (HTTPS redirect)    │
        │ • GameAdmin:8081            │
        │ • GameEngine:8080           │
        │ • Frontend:3000             │
        │ • Redis:6379                │
        └─────────────────────────────┘
                     ↓
        RDS PostgreSQL (AWS managed)
```

---

## 🎯 Subdomain vs Root Domain

| Approach | Domain | Cost | Setup |
|----------|--------|------|-------|
| **Subdomain (seçtin)** | quiz.example.com | Free | Easier (DNS record add) |
| **Root domain** | example.com | Free | Need Route53 (nameserver change) |
| **Subdomain with ALB** | quiz.example.com | +$20/mo | More complex, higher availability |

**Seçtığin subdomain approach:** En simple ve free ✅

---

## 💾 Checklist

- [ ] EC2 instance running
- [ ] Elastic IP allocated & associated (54.123.45.67)
- [ ] Domain provider'da DNS A record added:
  - Host: quiz
  - Value: 54.123.45.67
  - TTL: 3600
- [ ] DNS propagation verified: `nslookup quiz.example.com`
- [ ] Let's Encrypt cert issued
- [ ] nginx config updated (server_name, cert paths)
- [ ] .env updated (DOMAIN=quiz.example.com)
- [ ] docker-compose restarted
- [ ] HTTPS works: `curl https://quiz.example.com/healthz`
- [ ] Browser loads: `https://quiz.example.com` 🎉

---

## 🆘 Troubleshooting

### "DNS not resolving" (nslookup returns old IP)

```bash
# Clear DNS cache
# Windows:
ipconfig /flushdns

# macOS:
sudo dscacheutil -flushcache

# Linux:
sudo systemctl restart systemd-resolved

# Try again:
nslookup quiz.example.com
```

### "SSL error: certificate doesn't match"

```bash
# Check nginx conf has correct server_name:
grep "server_name" nginx-prod.conf
# Should show: server_name quiz.example.com;

# Restart nginx
docker-compose restart nginx
```

### "Connection refused on port 443"

```bash
# Check nginx running
docker-compose ps nginx
# Status should be: "running"

# Check ports
netstat -an | grep 443
# Should show: LISTEN 0.0.0.0:443

# Restart
docker-compose down
docker-compose up -d
```

---

## 🔄 Future: Move to Route53 (Optional)

Eğer sonradan AWS'de tam manage etmek istersen:

```bash
# 1. Route53'de hosted zone create (yourdomain.com)
# 2. Nameserver'ları domain provider'a gir
# 3. DNS propagate olsun (24-48 saat)
# 4. Subdomain record ekle:
#    Name: quiz.example.com → Elastic IP

# Benefit: Centralized DNS management, AWS console'da her şey
```

---

## 📚 Özet

**Seçtiğin setup:**
1. ✅ Kendi domain'in (example.com)
2. ✅ Subdomain (quiz.example.com)
3. ✅ Elastic IP (static: 54.123.45.67)
4. ✅ Let's Encrypt SSL (free, auto-renewal)
5. ✅ EC2 docker-compose (free tier)
6. ✅ RDS PostgreSQL (free tier)

**Sonuç: https://quiz.example.com çalışan production app** ✅

---

**Hazır mısın? Başlayalım!** 🚀
