# 🚀 Quick Start - AWS Free Tier (5 dakikada başla)

## ✅ Ön koşul: AWS Account (Free Tier Eligible)

Kontrol et: `https://console.aws.amazon.com/billing/home#/freetierUsage`

---

## 5 ADIM - 2 Gün

### DAY 1 (2 saat): Infrastructure Setup

#### STEP 1: RDS PostgreSQL (10 dakika)

```bash
# Copy & Paste:
aws rds create-db-instance \
    --db-instance-identifier quiz-game-db \
    --db-instance-class db.t2.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password 'SecurePass!@#2026' \
    --allocated-storage 20 \
    --backup-retention-period 7 \
    --region eu-west-1

# ✅ Endpoint Not: quiz-game-db.XXXX.eu-west-1.rds.amazonaws.com
# Wait: 10 dakika (status: Available)
```

#### STEP 2: EC2 Instance (10 dakika)

```bash
# 1. Key pair
aws ec2 create-key-pair \
    --key-name quiz-game-key \
    --region eu-west-1 \
    --query 'KeyMaterial' > quiz-game-key.pem
chmod 400 quiz-game-key.pem

# 2. Security Group
aws ec2 create-security-group \
    --group-name quiz-game-sg \
    --description "Quiz game" \
    --region eu-west-1

SG_ID="sg-XXXXXXXXX"  # Çıktıdan kopyala

# 3. Firewall rules
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp --port 22 --cidr YOUR_IP/32 \
    --region eu-west-1

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp --port 80 --cidr 0.0.0.0/0 \
    --region eu-west-1

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp --port 443 --cidr 0.0.0.0/0 \
    --region eu-west-1

# 4. Launch EC2
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1f0 \
    --instance-type t2.micro \
    --key-name quiz-game-key \
    --security-group-ids $SG_ID \
    --region eu-west-1

INSTANCE_ID="i-XXXXXXXXX"  # Çıktıdan kopyala

# 5. Get public IP
aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --region eu-west-1

# ✅ IP Not: 54.XXX.XXX.XXX
# Wait: 2 dakika (status: running)
```

#### STEP 3: Subdomain & Elastic IP (10 dakika)

**Domain'in var:** example.com → subdomain yapacaksın: quiz.example.com

```bash
# 1. Elastic IP (static IP) - ec2-user'da
aws ec2 allocate-address --domain vpc --region eu-west-1

# Copy: AllocationId (eipalloc-XXXXXX)
# Copy: PublicIp (54.123.45.67)

# 2. Associate to EC2
aws ec2 associate-address \
    --instance-id i-XXXXXXXXX \
    --allocation-id eipalloc-XXXXXX \
    --region eu-west-1

# ✅ Now: 54.123.45.67 is permanent

# 3. Domain provider'ında DNS A record ekle:
#    Host: quiz
#    Value: 54.123.45.67
#    TTL: 3600 (default)
#    -> Save
#
# After 10-30 dakika: DNS propagates
```

---

### DAY 1 Akşam: EC2'de Deploy (1 saat)

#### STEP 4: SSH & Setup (30 dakika)

```bash
# 1. Connect
ssh -i quiz-game-key.pem ec2-user@54.XXX.XXX.XXX

# 2. Inside EC2:
sudo yum update -y
sudo amazon-linux-extras install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Clone repo
cd /home/ec2-user
git clone https://github.com/yourusername/online-test-app.git
cd online-test-app

# 4. Create .env (REPLACE VALUES!)
cat > .env <<EOF
DOMAIN=quiz.example.com

# RDS
RDS_ENDPOINT=quiz-game-db.XXXXXX.eu-west-1.rds.amazonaws.com
RDS_USER=postgres
RDS_PASSWORD=SecurePass!@#2026

DB_URL=jdbc:postgresql://quiz-game-db.XXXXXX.eu-west-1.rds.amazonaws.com:5432/gameadmin
DB_USER=postgres
DB_PASSWORD=SecurePass!@#2026

# Redis (local)
REDIS_HOST=redis
REDIS_PORT=6379

# Security
JWT_SECRET=$(openssl rand -base64 32)
ENGINE_TOKEN=$(openssl rand -base64 32)
ADMIN_PASSWORD=admin123
HOST_PASSWORD=host123

JPA_DDL_AUTO=update
LOG_LEVEL=INFO
EOF

# 5. Start docker-compose
docker-compose up -d

# ✅ Wait 30 seconds
sleep 30

# 6. Check logs
docker-compose logs -f
# Expected: "Started GameAdminApplication" ✅
```

#### STEP 5: SSL & DNS (30 dakika)

```bash
# Inside EC2:

# 1. Certbot SSL (Let's Encrypt - free)
sudo yum install certbot python3-certbot-nginx -y

sudo certbot certonly --standalone \
    -d quiz.example.com \
    --email your-email@gmail.com \
    --agree-tos --non-interactive

# Certs at:
# /etc/letsencrypt/live/quiz.example.com/fullchain.pem
# /etc/letsencrypt/live/quiz.example.com/privkey.pem

# 2. Update nginx.conf (edit on local, scp to EC2, or vi inside)
# Change:
#   server_name _;  →  server_name quiz.example.com;
#   ssl_certificate /etc/nginx/certs/  →  /etc/letsencrypt/live/quiz.example.com/
#   ssl_certificate_key  →  /etc/letsencrypt/live/quiz.example.com/privkey.pem

# Then restart nginx:
docker-compose restart nginx

# 3. Verify DNS resolved
nslookup quiz.example.com
# Expected: 54.123.45.67

# ✅ If not resolved yet, wait 10-30 minutes and try again
```

---

### DAY 2 (1 saat): Testing & Verify

#### STEP 6: Final Tests

```bash
# 1. HTTPS works
curl -v https://quiz.example.com/healthz
# Expected: ✅ HTTP/2 200 OK

# 2. Login
curl -X POST https://quiz.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Expected: ✅ token received

# 3. Browser
# Open: https://quiz.example.com
# Expected: ✅ Game UI loaded, no console errors

# 4. WebSocket (Browser console)
const ws = new WebSocket('wss://quiz.example.com/ws');
ws.onopen = () => console.log('✅ Connected');
```

---

## 💰 Final Cost

| Item | Cost |
|------|------|
| EC2 t2.micro (12mo) | $0 |
| RDS (12mo) | $0 |
| Elastic IP (allocated) | $0 |
| Let's Encrypt SSL | $0 |
| **YEAR 1 TOTAL** | **$0** ✅ |
| **YEAR 2+** | ~$15/year (domain renewal only) |

---

## 🎯 Success Checklist

- [ ] ✅ RDS created (quiz-game-db endpoint)
- [ ] ✅ EC2 running (public IP assigned)
- [ ] ✅ Elastic IP allocated & associated (54.123.45.67)
- [ ] ✅ Docker running: `docker ps`
- [ ] ✅ Domain provider'da DNS A record added:
  - Host: quiz
  - Value: 54.123.45.67
  - TTL: 3600
- [ ] ✅ DNS propagation verified: `nslookup quiz.example.com`
- [ ] ✅ Let's Encrypt SSL certificate issued
- [ ] ✅ HTTPS working: `curl https://quiz.example.com/healthz`
- [ ] ✅ API login working
- [ ] ✅ Browser loads: `https://quiz.example.com` 🎉
- [ ] ✅ WebSocket connects: `wss://quiz.example.com/ws` 🎉

---

## 📚 Detaylı Rehber

Daha fazla bilgi: `AWS-FREETIER-GUIDE.md`

Troubleshooting: `HTTPS-TESTING.md`

---

**Ready?** Başla! 🚀
