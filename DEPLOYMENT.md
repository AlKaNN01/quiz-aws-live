# Production Deployment Guide

Production ortamına dağıtma için best practices ve checklist.

## Pre-Deployment Checklist

### Security

- [ ] `JWT_SECRET` minimum 32 karakter + cryptographically strong (openssl rand -hex 32)
- [ ] `ENGINE_TOKEN` cryptographically strong token
- [ ] `ADMIN_PASSWORD` ve `HOST_PASSWORD` güçlü ve benzersiz set edildi
- [ ] `.env` dosyası git'e committed değil (`.gitignore` kontrol et)
- [ ] Tüm database credentials rotated ve secure
- [ ] SSL/TLS sertifikası obtain edildi (HTTPS enforce et)

### Infrastructure

- [ ] PostgreSQL backup stratejisi tanımlanmış
- [ ] Redis AOF (Append-Only File) persistence aktif
- [ ] Firewall kuralları network isolation sağlıyor
- [ ] Load balancer (nginx, haproxy) konfigüre edilmiş
- [ ] Monitoring ve alerting sistemi kurulmuş (Prometheus, DataDog vb.)

### Database

- [ ] Production database manual migration setup (Liquibase/Flyway)
- [ ] Backup restore prosedürü test edilmiş
- [ ] Connection pool sizing optimized (hikari vb.)
- [ ] Query logging debug seviyesinden disable edilmiş (`LOG_LEVEL=WARN`)

## Environment Variables (Production)

```env
# Essentials
SPRING_PROFILES_ACTIVE=prod
JPA_DDL_AUTO=validate

# Database (managed services recommended)
DB_URL=jdbc:postgresql://prod-postgres-instance:5432/gameadmin
DB_USER=gameadmin_svc
DB_PASSWORD=<secure-random-password>
DB_CONNECTION_POOL_SIZE=20

# Redis (managed services recommended)
REDIS_HOST=prod-redis-instance
REDIS_PORT=6379
REDIS_PASSWORD=<secure-redis-password>

# Security
JWT_SECRET=<secure-random-32chars+>
ENGINE_TOKEN=<secure-random-token>
ADMIN_PASSWORD=<initial-admin-pass>
HOST_PASSWORD=<initial-host-pass>

# Networks
ALLOWED_ORIGINS=https://quiz.yourdomain.com,https://admin.yourdomain.com
GAME_ADMIN_URL=https://api.yourdomain.com
REACT_APP_API_URL=https://api.yourdomain.com

# Logging
LOG_LEVEL=WARN
SPRING_JPA_SHOW_SQL=false
SPRING_JPA_PROPERTIES_HIBERNATE_FORMAT_SQL=false

# Performance
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=20
SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=5
SPRING_REDIS_TIMEOUT=2000
```

## Docker Deployment

### Environment-Specific Compose Files

**prod-docker-compose.yml** örneği:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env_file: .env.prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 30s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes  # AOF persistence
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5

  gameadmin:
    image: gameadmin:latest
    restart: on-failure:5
    env_file: .env.prod
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 5

  gameengine:
    image: gameengine:latest
    restart: on-failure:5
    env_file: .env.prod
    depends_on:
      redis:
        condition: service_healthy
      gameadmin:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 5

  frontend:
    image: quiz-frontend:latest
    restart: on-failure:3
    env_file: .env.prod

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - gameadmin
      - gameengine
      - frontend

volumes:
  postgres_data:
  redis_data:
```

### Build & Push to Registry

```bash
# Build images
docker build -t registry.yourdomain.com/gameadmin:1.0.0 GameAdmin/
docker build -t registry.yourdomain.com/gameengine:1.0.0 GameEngine_src/
docker build -t registry.yourdomain.com/quiz-frontend:1.0.0 quiz-frontend/

# Push to registry
docker push registry.yourdomain.com/gameadmin:1.0.0
docker push registry.yourdomain.com/gameengine:1.0.0
docker push registry.yourdomain.com/quiz-frontend:1.0.0
```

## Kubernetes Deployment

**k8s/gameadmin-deployment.yaml** örneği:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gameadmin
  labels:
    app: gameadmin
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gameadmin
  template:
    metadata:
      labels:
        app: gameadmin
    spec:
      containers:
      - name: gameadmin
        image: registry.yourdomain.com/gameadmin:1.0.0
        ports:
        - containerPort: 8081
        env:
        - name: DB_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secrets
              key: jwt-secret
        - name: ENGINE_TOKEN
          valueFrom:
            secretKeyRef:
              name: jwt-secrets
              key: engine-token
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8081
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8081
          initialDelaySeconds: 20
          periodSeconds: 5
```

## SSL/TLS Setup (nginx)

**nginx.conf** snippet:

```nginx
upstream gameadmin {
    server gameadmin:8081;
}

upstream gameengine {
    server gameengine:8080;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;  # Redirect HTTP→HTTPS
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/certs/yourdomain.crt;
    ssl_certificate_key /etc/nginx/certs/yourdomain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
    }

    # GameAdmin API
    location /api/ {
        proxy_pass http://gameadmin;
        proxy_set_header Authorization $http_authorization;
        proxy_pass_header Authorization;
    }

    # GameEngine WebSocket
    location /ws/ {
        proxy_pass http://gameengine;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Monitoring & Logging

### Prometheus Metrics

**prometheus.yml**:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'gameadmin'
    static_configs:
      - targets: ['gameadmin:8081']
    metrics_path: '/actuator/prometheus'

  - job_name: 'gameengine'
    static_configs:
      - targets: ['gameengine:8080']
    metrics_path: '/actuator/prometheus'
```

### ELK Stack (Elasticsearch, Logstash, Kibana)

Spring Boot uygulamalarında logback encoder:

```xml
<!-- application-prod.yml -->
logging:
  level:
    com.awsokanclub: WARN
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
    file: "%d{ISO8601} [%thread] %-5level %logger{36} - %msg%n"
  file:
    name: /var/log/gameadmin/application.log
    max-size: 10MB
    max-history: 30
```

## Backup & Recovery

### Database Backup

```bash
# Daily backup (cron job)
0 2 * * * pg_dump -U gameadmin_svc gameadmin | gzip > /backups/gameadmin_$(date +\%Y\%m\%d).sql.gz

# Restore
gunzip < /backups/gameadmin_20260407.sql.gz | psql -U gameadmin_svc gameadmin
```

### Redis Backup

Redis AOF persistence ile otomatik, manual backup:

```bash
# RedisBackup
docker exec redis redis-cli BGSAVE
docker cp redis:/data/dump.rdb ./backups/redis_$(date +%Y%m%d).rdb
```

## Scaling

### Horizontal Scaling

Stateless servisler (GameAdmin, GameEngine) scale edilebilir:

```bash
docker-compose up --scale gameadmin=3 --scale gameengine=2
```

### Redis Scaling

Redis Enterprise veya Redis Cluster production'da kullanılmalı (standalone single-point-of-failure).

### Database Scaling

- Read replicas (PostgreSQL replication)
- Connection pooling (pgBouncer)
- Sharding (application level gerekirse)

## Rollout Strategy

### Blue-Green Deployment

```bash
# Deploy green environment
docker-compose -f prod-docker-compose.green.yml up -d

# Test green
curl https://green.yourdomain.com/actuator/health

# Switch traffic to green
# (update nginx upstream)

# Keep blue as rollback
```

### Canary Deployment

```
10% traffic → new version
Monitor for 1 hour
100% traffic if healthy
Rollback if errors > threshold
```

## Rollback Procedure

```bash
# Version'ı kontrol et
docker images gameadmin

# Önceki image ile restart
docker pull registry.yourdomain.com/gameadmin:0.9.9
docker-compose up -d gameadmin

# Health check
curl http://localhost:8081/actuator/health
```

## Performance Tuning

### Database Connection Pool

```env
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=30
SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=10
SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT=600000
SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT=20000
```

### Redis Connection Pooling

```env
SPRING_REDIS_LETTUCE_POOL_MAX_ACTIVE=20
SPRING_REDIS_LETTUCE_POOL_MAX_IDLE=10
SPRING_REDIS_TIMEOUT=2000
```

### JVM Tuning

```bash
# gameadmin container
ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
```

## Incident Response

### Service Down

1. Check container health: `docker-compose ps`
2. Check logs: `docker-compose logs gameadmin`
3. Restart: `docker-compose restart gameadmin`
4. If persist, check dependencies (database, redis)

### Database Connection Issues

1. Check connection pool: `docker exec gameadmin curl localhost:8081/actuator/prometheus | grep sql_pool`
2. Scale down non-critical services
3. Increase pool size
4. Restart DB connections

### Memory Leak

1. Check heap: `docker exec gameadmin jcmd <PID> VM.heap_info`
2. Restart container with health check
3. Enable JFR (Java Flight Recorder) profiling

---

**Last Updated**: 2026-04-07
