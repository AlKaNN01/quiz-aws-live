# AWS Free Tier - Optimal Production Setup

## 🎁 Free Tier Neler Sunar?

```
┌────────────────────────────────────────┐
│ EC2 t2.micro                           │
├────────────────────────────────────────┤
│ • 750 saatlik kullanım/ay (24/7 yeterli) │
│ • 30GB EBS storage                     │
│ • $0/mo ✅                             │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ RDS PostgreSQL t2.micro                │
├────────────────────────────────────────┤
│ • 750 saatlik kullanım/ay              │
│ • 20GB storage                         │
│ • Auto backup (7 days retention)       │
│ • Automated minor version upgrades     │
│ • $0/mo ✅                             │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Data Transfer                          │
├────────────────────────────────────────┤
│ • First 15GB/mo outbound: $0           │
│ • Typical app: 2-5GB/mo                │
│ • $0/mo ✅                             │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ACM SSL Certificate                    │
├────────────────────────────────────────┤
│ • Free Let's Encrypt integration       │
│ • Auto renewal (60 days before expiry) │
│ • $0/mo ✅                             │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Route53                                │
├────────────────────────────────────────┤
│ • Managed DNS hosting                  │
│ • First 1M queries: free               │
│ • Typical app: 10K-50K queries/mo     │
│ • $0/mo ✅                             │
└────────────────────────────────────────┘

════════════════════════════════════════
TOTAL: $0/mo (12 months)
        Then: ~$15/mo (domain renewal)
════════════════════════════════════════
```

---

## 🏗️ Optimal Architecture (Free Tier)

```
                    USER (Browser)
                          ↓
                    HTTPS (Port 443)
                          ↓
    ┌─────────────────────────────────┐
    │ EC2 t2.micro (Docker)           │
    ├─────────────────────────────────┤
    │  • Nginx (reverse proxy)        │
    │  • GameAdmin container          │
    │  • GameEngine container         │
    │  • Frontend (React)             │
    │  • Redis container (local)      │
    │                                 │
    │  $0/mo ✅                       │
    └─────────────────────────────────┘
              ↓        ↓
        HTTPS(8081) WSS(8080)
              ↓        ↓
    ┌─────────────────────────────────┐
    │ RDS PostgreSQL t2.micro         │
    ├─────────────────────────────────┤
    │  • gameadmin database           │
    │  • Auto 7-day backup            │
    │  • Auto minor version update    │
    │  • Multi-AZ possible (opsiyonel)│
    │                                 │
    │  $0/mo ✅                       │
    └─────────────────────────────────┘

ACM SSL: $0/mo ✅
Route53: $0/mo ✅
─────────────────────
TOTAL: $0/mo
```

---

## ⚡ Alternativ: Daha Ucuz (İlk 12 ay free, sonra $9/mo)

Eğer RDS'ye gerek yoksa:
```
EC2 t2.micro (Docker)
├─ Nginx
├─ GameAdmin
├─ GameEngine
├─ Frontend
├─ PostgreSQL container
└─ Redis container

$0/mo (free tier)
```

**Dezavantajı:** Manuel backup, scaling yok

**Tavsiyem:** RDS + EC2 kombinasyonu (en iyi balance)

---

## 📋 Setup Checklist (Free Tier Optimized)

```
☐ AWS Account (free tier eligible)
☐ EC2 t2.micro kurulumu
☐ RDS PostgreSQL t2.micro
☐ Domain (Route53 veya external)
☐ ACM SSL certificate
☐ docker-compose EC2'ye deploy
☐ HTTPS test
☐ Database backup verification
```

---

## 🚀 ADIM ADIM: Free Tier Setup

### STEP 1: AWS Free Tier Verify

```bash
# AWS Help → Billing → Free Tier → Check Usage
# Veya CLI:
aws ce get-cost-and-usage \
    --time-period Start=2026-04-01,End=2026-04-30 \
    --granularity MONTHLY \
    --metrics UnblendedCost \
    --filter file://filter.json \
    --region eu-west-1
```

**Kontrolü:** `https://console.aws.amazon.com/billing/home#/freetierUsage`

---

### STEP 2: RDS PostgreSQL (Free Tier)

```bash
# 1. RDS Instance Oluştur
aws rds create-db-instance \
    --db-instance-identifier quiz-game-db \
    --db-instance-class db.t2.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password 'SecurePass!@#2026' \
    --allocated-storage 20 \
    --storage-type gp2 \
    --backup-retention-period 7 \
    --port 5432 \
    --vpc-security-group-ids sg-12345678 \
    --publicly-accessible false \
    --region eu-west-1 \
    --tags Key=Project,Value=QuizGame Key=Environment,Value=Production

# Output:
# DBInstanceIdentifier: quiz-game-db
# Endpoint: quiz-game-db.c123abc.eu-west-1.rds.amazonaws.com

# 2. Wait 10 dakika → Status: Available
aws rds describe-db-instances \
    --db-instance-identifier quiz-game-db \
    --region eu-west-1 \
    --query 'DBInstances[0].DBInstanceStatus'

# 3. Security Group (inbound port 5432)
aws ec2 authorize-security-group-ingress \
    --group-id sg-db-12345 \
    --protocol tcp \
    --port 5432 \
    --source-security-group-id sg-app-12345 \
    --region eu-west-1

Kaydet:
- RDS_ENDPOINT=quiz-game-db.c123abc.eu-west-1.rds.amazonaws.com
- RDS_USER=postgres
- RDS_PASSWORD=SecurePass!@#2026
```

---

### STEP 3: EC2 t2.micro (Docker)

```bash
# 1. Key pair oluştur
aws ec2 create-key-pair \
    --key-name quiz-game-key \
    --region eu-west-1 \
    --query 'KeyMaterial' > quiz-game-key.pem

chmod 400 quiz-game-key.pem

# 2. Security Group oluştur
aws ec2 create-security-group \
    --group-name quiz-game-sg \
    --description "Quiz game security group" \
    --vpc-id vpc-12345678 \
    --region eu-west-1

SG_ID="sg-0123456789abcdef"

# 3. Inbound rules
# SSH (22) - sadece senin IP'den
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 22 \
    --cidr YOUR_IP/32 \
    --region eu-west-1

# HTTP (80) - herkesten
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region eu-west-1

# HTTPS (443) - herkesten
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp --port 443 \
    --cidr 0.0.0.0/0 \
    --region eu-west-1

# 4. EC2 Instance Launch
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1f0 \
    --instance-type t2.micro \
    --key-name quiz-game-key \
    --security-group-ids $SG_ID \
    --region eu-west-1 \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=quiz-game-app}]' \
    --user-data file://user-data.sh

# user-data.sh içeriği:
cat > user-data.sh <<'USERDATA'
#!/bin/bash
set -e

# Update system
sudo yum update -y

# Install Docker
sudo amazon-linux-extras install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install git
sudo yum install git -y

# Clone repo
cd /home/ec2-user
git clone https://github.com/yourusername/online-test-app.git
cd online-test-app
chown -R ec2-user:ec2-user .

# Create .env (will be updated via SSH)
touch .env
USERDATA

# 5. Wait instance running
INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=quiz-game-app" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --region eu-west-1)

aws ec2 wait instance-running \
    --instance-ids $INSTANCE_ID \
    --region eu-west-1

# 6. Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --region eu-west-1)

echo "✅ EC2 Ready!"
echo "   IP: $PUBLIC_IP"
echo "   SSH: ssh -i quiz-game-key.pem ec2-user@$PUBLIC_IP"
```

---

### STEP 4: Domain & SSL (Free)

```bash
# OPTION A: Route53'te domain satın al (~$12/year)
aws route53 list-domains \
    --region eu-west-1

# veya existing domain'i Route53'e taşı

# OPTION B: Mevcut domain (Namecheap, GoDaddy)
# Nameserver'ları AWS'ye işaret ettir (işlem: 24-48 saat)


# ACM SSL Certificate (FREE)
aws acm request-certificate \
    --domain-name yourdomain.com \
    --subject-alternative-names www.yourdomain.com \
    --validation-method DNS \
    --region eu-west-1

ACM_ARN="arn:aws:acm:eu-west-1:123456789:certificate/abc123"

# Route53'te CNAME validation record ekle (ACM paneline bakın)
# Wait: 5-10 dakika → Status: Issued ✅
```

---

### STEP 5: EC2'ye Deploy (SSH)

```bash
# 1. SSH bağlantı
ssh -i quiz-game-key.pem ec2-user@YOUR_PUBLIC_IP

# 2. Repo'yu update et
cd online-test-app
git pull

# 3. .env dosyası (RDS + EC2 container values)
cat > .env <<EOF
DOMAIN=yourdomain.com

# RDS PostgreSQL (EXTERNAL database - managed by AWS)
RDS_ENDPOINT=quiz-game-db.c123abc.eu-west-1.rds.amazonaws.com
RDS_USER=postgres
RDS_PASSWORD=SecurePass!@#2026

# Legacy DB_URL format (still needed for some services)
DB_URL=jdbc:postgresql://quiz-game-db.c123abc.eu-west-1.rds.amazonaws.com:5432/gameadmin
DB_USER=postgres
DB_PASSWORD=SecurePass!@#2026

# Redis (local container)
REDIS_HOST=redis
REDIS_PORT=6379

# Security
JWT_SECRET=$(openssl rand -base64 32)
ENGINE_TOKEN=$(openssl rand -base64 32)
ADMIN_PASSWORD=admin123
HOST_PASSWORD=host123

# Config
JPA_DDL_AUTO=validate
LOG_LEVEL=INFO
EOF

# 4. docker-compose başlat (postgres container silinmiştir, yol açıldı)
# Remove postgres service and use RDS instead
sudo docker-compose -f docker-compose.yml \
  -f docker-compose-aws-freetier.yml up -d

# 5. Wait 30 seconds for startup
sleep 30

# 6. Logs kontrol
docker-compose logs -f

# Expected:
# gameadmin: "Started GameAdminApplication"
# gameengine: "Started GameEngineApplication"
# nginx: "Listening on port 80, 443"
# frontend: "Compiled successfully"
```

---

### STEP 6: SSL Certificate for Nginx (Let's Encrypt)

```bash
# SSH'da (EC2):

# 1. Certbot kurulum
sudo yum install certbot python3-certbot-nginx -y

# 2. Certificate request
sudo certbot certonly --standalone \
    -d yourdomain.com \
    -d www.yourdomain.com \
    --email your-email@gmail.com \
    --agree-tos \
    --non-interactive

# Certificates:
# /etc/letsencrypt/live/yourdomain.com/cert.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# 3. nginx'e mount et
# docker-compose.yml'de:
# volumes:
#   - /etc/letsencrypt:/etc/nginx/certs:ro

# 4. nginx restart
docker-compose restart nginx

# 5. Auto renewal setup
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer

# Check:
sudo systemctl status certbot-renew.timer
```

---

### STEP 7: DNS Pointing (Route53)

```bash
# 1. Route53 Hosted Zone'unu al
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --dns-name yourdomain.com \
    --query 'HostedZones[0].Id' \
    --region eu-west-1 \
    | cut -d '/' -f3)

# 2. A record pointing to EC2
aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch '{
      "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "yourdomain.com",
          "Type": "A",
          "TTL": 300,
          "ResourceRecords": [{"Value": "YOUR_EC2_PUBLIC_IP"}]
        }
      }]
    }'

# 3. www subdomain
aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch '{
      "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "www.yourdomain.com",
          "Type": "CNAME",
          "TTL": 300,
          "ResourceRecords": [{"Value": "yourdomain.com"}]
        }
      }]
    }'

# 4. Verify (wait 5 minutes for DNS propagation)
nslookup yourdomain.com
# → YOUR_EC2_PUBLIC_IP görünmeli
```

---

## ✅ TESTING & VERIFICATION

### Test 1: HTTPS Connectivity

```bash
# curl test
curl -v https://yourdomain.com/healthz

# Expected:
# ✅ HTTP/2 200 OK
# ✅ Server: nginx
# ✅ SSL certificate: Let's Encrypt
```

### Test 2: REST API

```bash
# Login
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get games
curl -X GET https://yourdomain.com/api/games/ \
  -H "Authorization: Bearer $TOKEN"
```

### Test 3: WebSocket (Browser)

```javascript
// Browser console: https://yourdomain.com
const ws = new WebSocket('wss://yourdomain.com/ws');
ws.onopen = () => console.log('✅ Connected');
ws.onerror = (e) => console.error('❌', e);
```

### Test 4: RDS Backup

```bash
# AWS Console → RDS → Databases → quiz-game-db
# → Automated backups
# Should show: Daily 7-day retention ✅

# Or via CLI:
aws rds describe-db-instances \
    --db-instance-identifier quiz-game-db \
    --query 'DBInstances[0].BackupRetentionPeriod'
# Output: 7 ✅
```

---

## 📊 Free Tier Cost Breakdown (12 months)

| Service | Free Tier | Cost |
|---------|-----------|------|
| EC2 t2.micro | 750 hrs/mo | $0 |
| RDS t2.micro | 750 hrs/mo | $0 |
| Data transfer | 15 GB/mo | $0 |
| Route53 | 1M queries | $0 |
| ACM SSL | Unlimited | $0 |
| **SUBTOTAL** | | **$0** |
| Domain (Route53) | 1 year | $12 |
| **TOTAL (Year 1)** | | **$12** |
| **Year 2+** | | **$27/mo (~$324/year)** |

Year 2'den sonra:
- EC2: $9/mo
- RDS: $15/mo
- Domain: $12/year
- Total: ~$27/mo

---

## 🔒 Security Checklist

- ✅ Security Group restricted (SSH: your IP only)
- ✅ RDS: Not publicly accessible
- ✅ RDS: Backup enabled (7 days)
- ✅ RDS: Minor version auto-upgrade enabled
- ✅ SSL: Let's Encrypt auto-renewal (certbot)
- ✅ nginx: HSTS headers
- ✅ .env: Never commit to git

---

## 📈 Future Scaling (if needed)

Eğer free tier sınırları aşarsa:

```
EC2 t2.micro     ($9)    → EC2 t3.small ($20)
RDS t2.micro     ($0)    → RDS t3.small ($30)
Data transfer    ($0)    → ~$0.05/GB overage
─────────────────────────
Free tier: $0/mo
Scaled: $50-70/mo
```

---

## 🎯 FINAL ARCHITECTURE (FREE TIER)

```
┌────────────────────────────────────────────────┐
│ Browser (HTTPS) → yourdomain.com               │
├────────────────────────────────────────────────┤
│                                                │
│  EC2 t2.micro ($0)                            │
│  ├─ nginx (HTTPS termination)                │
│  ├─ GameAdmin (port 8081)                    │
│  ├─ GameEngine (port 8080)                   │
│  ├─ Frontend (React build)                   │
│  └─ Redis (container)                        │
│                                                │
│  RDS PostgreSQL t2.micro ($0)                │
│  ├─ gameadmin database                        │
│  ├─ 7-day auto backup                        │
│  └─ Multi-AZ failover (optional upgrade)     │
│                                                │
├────────────────────────────────────────────────┤
│ Domain: Route53 (~$12/year)                   │
│ SSL: Let's Encrypt (free, auto-renew)         │
├────────────────────────────────────────────────┤
│ TOTAL: $0/mo (12 months), then $27/mo        │
└────────────────────────────────────────────────┘
```

---

## 🚀 NEXT STEPS

1. **TODAY**: AWS Account free tier check
2. **TODAY**: RDS PostgreSQL create (Step 2)
3. **TODAY**: EC2 t2.micro launch (Step 3)
4. **TOMORROW**: Domain + DNS setup (Step 4)
5. **TOMORROW**: Let's Encrypt SSL (Step 5)
6. **TOMORROW**: docker-compose deploy (Step 5)
7. **TOMORROW**: Testing (Step 7)

**Timeline:** ~2 days, **Cost:** $0 (free tier)

---

Başlamak istersin? Hangi adımdan başlamalıyız? 👇
