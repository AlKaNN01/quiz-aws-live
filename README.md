# Online Quiz Game Platform

Gerçek zamanı oyun motoru ve admin paneli ile çok oyunculu çevrimiçi sınav platformu.

## Mimari

Proje üç temel bileşenden oluşur:

- **GameAdmin** (Spring Boot, Port 8081): Oyun yönetimi, soru editörü, sonuç izlemesi
- **GameEngine** (Spring Boot, Port 8080): WebSocket ile gerçek zamanlı oyun oturumu, Redis cache
- **Frontend** (React, Port 80): Admin ve oyuncu arayüzleri

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│GameEngine   │────▶│ GameAdmin   │
│  (React)    │     │(WebSocket)  │     │   (REST)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                      ┌─────────────┐
                      │   Redis     │
                      │   (Cache)   │
                      └─────────────┘

                      ┌─────────────┐
                      │ PostgreSQL  │
                      │  (Results)  │
                      └─────────────┘
```

## Gereklilikler

- Docker & Docker Compose
- (İsteğe bağlı) Java 21, Maven (lokal geliştirme için)
- (İsteğe bağlı) Node.js (frontend lokal geliştirme için)

## Hızlı Başlangıç

### 1. Konfigürasyon

Repoyu klonla ve `.env` dosyası oluştur:

```bash
cp .env.example .env
```

`.env` içinde tüm **ortam değişkenlerini** düzenle:

```env
# PostgreSQL
DB_URL=jdbc:postgresql://postgres:5432/gameadmin
DB_USER=postgres
DB_PASSWORD=your_secure_password   # ‼️ Güvenli parola set et
ADMIN_PASSWORD=your_secure_password  # ‼️ Güvenli parola set et
HOST_PASSWORD=your_secure_password   # ‼️ Güvenli parola set et

# JWT & Servisler arası Auth
JWT_SECRET=your_very_long_secret_minimum_32_chars  # ‼️ Min. 32 karakter
ENGINE_TOKEN=your_engine_to_admin_token             # ‼️ Güvenli token

# CORS & URLs
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:80
GAME_ADMIN_URL=http://gameadmin:8081
```

### 2. Docker ile Çalıştırma

```bash
docker-compose up --build
```

Servisler başladıktan sonra:
- **Frontend**: http://localhost
- **GameAdmin REST API**: http://localhost:8081
- **GameEngine WebSocket**: ws://localhost:8080

### 3. Giriş

**Admin Paneli**:
- URL: http://localhost
- Kullanıcı: `admin`
- Parola: `.env` dosyasında `ADMIN_PASSWORD` olarak set ettiğin değer

**Host Paneli**:
- Kullanıcı: `host`
- Parola: `.env` dosyasında `HOST_PASSWORD` olarak set ettiğin değer

## Geliştirme Kurulumu

### GameAdmin (Spring Boot)

```bash
cd GameAdmin
mvn spring-boot:run
```

Port: 8081

### GameEngine (Spring Boot)

```bash
cd GameEngine_src
mvn spring-boot:run
```

Port: 8080 (Redis ve GameAdmin lokalde çalışmalı)

### Frontend (React)

```bash
cd quiz-frontend
npm install
REACT_APP_API_URL=http://localhost:8081 npm start
```

Port: 3000

## Ortam Değişkenleri

| Değişken | Gerekli | Açıklama |
|----------|---------|----------|
| `DB_URL` | ✅ | PostgreSQL JDBC URL |
| `DB_USER` | ✅ | Database kullanıcısı |
| `DB_PASSWORD` | ✅ | Database parolası |
| `JWT_SECRET` | ✅ | JWT imzalama anahtarı (min. 32 chars) |
| `ENGINE_TOKEN` | ✅ | GameEngine → GameAdmin auth token |
| `ADMIN_PASSWORD` | ✅ | Admin kullanıcı ilk parolası |
| `HOST_PASSWORD` | ✅ | Host kullanıcı ilk parolası |
| `ALLOWED_ORIGINS` | ❌ | CORS izinli originler (default: localhost:3000) |
| `REDIS_HOST` | ❌ | Redis hostname (default: redis) |
| `REDIS_PORT` | ❌ | Redis port (default: 6379) |
| `GAME_ADMIN_URL` | ❌ | GameAdmin base URL (default: http://gameadmin:8081) |
| `REACT_APP_API_URL` | ❌ | Frontend API base URL (production için) |
| `JPA_DDL_AUTO` | ❌ | Hibernate DDL (update=dev, validate=prod) |
| `LOG_LEVEL` | ❌ | Loglama seviyesi (default: INFO) |

## Güvenlik Notları

### Secrets Yönetimi (Production)

- **Hiçbir zaman** plain-text credentials'ı code'a commit etme
- **Hiçbir zaman** `docker-compose.yml`'e passwords yazma
- Tüm sensitif değerleri ortam değişkenleri/secrets yönetim sisteminden oku:
  - Docker Secrets
  - Kubernetes Secrets
  - AWS Secrets Manager
  - HashiCorp Vault

### Database Migrations

- **Development**: `JPA_DDL_AUTO=update` (otomatik schema)
- **Production**: `JPA_DDL_AUTO=validate` (manuel migration, Liquibase/Flyway önerilir)

Production ortamında `update` kullanma — veri kaybı veya tutarsızlığa neden olabilir.

### Service-to-Service Auth

- GameEngine → GameAdmin çağrıları `ENGINE_TOKEN` ile doğrulanır
- Token geçersizse 403 Forbidden döndürülür

## API Endpoints

### GameAdmin (REST)

```
POST   /api/auth/login              # Giriş
GET    /api/games                   # Oyunları listele
POST   /api/games                   # Oyun oluştur
POST   /api/games/{id}/publish      # Oyunu yayına al
GET    /api/games/{id}/questions    # Oyun sorularını getir
POST   /api/games/{id}/questions    # Soru ekle
GET    /api/games/{id}/results      # Oyun sonuçlarını getir
```

### GameEngine (WebSocket)

```
@MessageMapping("player.join")      # Oyuncu katılı
@MessageMapping("player.answer")    # Cevap gönder
@MessageMapping("admin.start")      # Oyunu başlat
@MessageMapping("admin.end.question") # Soruyu bitir
```

## Health Checks

```bash
# GameAdmin health
curl http://localhost:8081/actuator/health

# GameEngine health  
curl http://localhost:8080/actuator/health
```

## Sorun Giderme

### PostgreSQL bağlantı hatası

- `.env`'de `DB_PASSWORD` ve `DB_USER` doğru mu?
- `docker-compose.yml` healthy seçeneği var mı?
- `docker-compose logs postgres` ile hataları kontrol et

### Redis connection timeout

- `REDIS_HOST` değeri `redis` mi (docker network)?
- `docker-compose logs redis` ile hataları kontrol et

### GameEngine sorular çekemiyor

- `ENGINE_TOKEN` ortam değişkeninde set mi?
- GameAdmin'de `/api/games/engine/questions` endpoint'ine `ENGINE_TOKEN` header'ı gönderiliyor mu?
- GameAdmin log'unda "Engine token doğrulandı" görülüyor mu?

## Logging

Tüm servislerin logları:

```bash
docker-compose logs -f gameadmin
docker-compose logs -f gameengine
docker-compose logs -f frontend
```

## Proje Yapısı

```
online-test-app/
├── GameAdmin/                 # Spring Boot 3.5, REST API, PostgreSQL
│   ├── src/main/java/
│   ├── pom.xml
│   └── Dockerfile
├── GameEngine_src/            # Spring Boot 3.5, WebSocket, Redis
│   ├── src/main/java/
│   ├── pom.xml
│   └── Dockerfile
├── quiz-frontend/             # React 19, Vite/CRA
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml         # Orchestration
├── .env.example               # Environment şablonu
└── README.md                  # Bu dosya
```

## Lisans

© Online Quiz Game Platform. Built for educational purposes.

## Destek

Sorun ve önerileri GitHub Issues'de raporla.
