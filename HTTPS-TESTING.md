# HTTPS & WSS Testing Guide - Komplet Testler

## 🚀 Local Testing (Before AWS Deployment)

### Setup: Self-Signed HTTPS Sertifikası

```bash
# Generate certificate ve private key
bash generate-cert.sh localhost

# Output:
# ✅ Certificate generated!
#    Key: certs/server.key
#    Cert: certs/server.crt
#    Chain: certs/chain.crt
```

### Local Docker Compose Start

```bash
# .env (local dev)
cat > .env <<EOF
DOMAIN=localhost
DB_URL=jdbc:postgresql://postgres:5432/gameadmin
DB_USER=postgres
DB_PASSWORD=localdevpassword
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -base64 32)
ENGINE_TOKEN=$(openssl rand -base64 32)
ADMIN_PASSWORD=admin123
HOST_PASSWORD=host123
JPA_DDL_AUTO=update
LOG_LEVEL=DEBUG
EOF

# Start services
docker-compose up -d

# Wait for startup (30-60 seconds)
sleep 30

# Verify all healthy
docker-compose ps
# Status: All "healthy" veya "running"
```

---

## ✅ TEST 1: HTTPS Connectivity (Port 443)

### 1.1 SSL Certificate Validation

```bash
# Check certificate expiry & details
openssl s_client -connect localhost:443 \
  -servername localhost \
  -showcerts

# Expected output:
# ✅ Verify return code: 0 (ok)
# ✅ issuer = C=TR, ST=Istanbul, L=Istanbul, O=AwsOkan, CN=localhost
# ✅ subject = C=TR, ST=Istanbul, L=Istanbul, O=AwsOkan, CN=localhost
```

### 1.2 HTTP → HTTPS Redirect

```bash
# Test redirect from port 80 to 443
curl -v -L http://localhost/healthz

# Expected output:
# ✅ HTTP/1.1 301 Moved Permanently
# ✅ Location: https://localhost/healthz
# ✅ HTTP/2 200 OK (after redirect)
# ✅ Body: "OK"
```

### 1.3 HSTS Header Check

```bash
# Strict-Transport-Security header
curl -v https://localhost/healthz

# Expected headers:
# ✅ Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# ✅ X-Content-Type-Options: nosniff
# ✅ X-Frame-Options: SAMEORIGIN
# ✅ X-XSS-Protection: 1; mode=block
```

### 1.4 TLS Version Check

```bash
# Must use TLS 1.2+
openssl s_client -tls1_2 -connect localhost:443

# Try old SSL (should fail)
openssl s_client -ssl3 -connect localhost:443
# Expected: ❌ "SSLV3 alert handshake failure"
```

---

## 📡 TEST 2: WebSocket Secure (WSS)

### 2.1 WebSocket Handshake

```javascript
// Browser console or Node.js
const ws = new WebSocket('wss://localhost/ws');

ws.onopen = (e) => {
  console.log('✅ WebSocket connected');
  console.log('Protocol:', ws.protocol);
  console.log('URL:', ws.url);
  console.log('readyState:', ws.readyState);
};

ws.onerror = (e) => {
  console.error('❌ WebSocket error:', e);
};

ws.onclose = (e) => {
  console.log('WebSocket closed');
};
```

**Expected output:**
```
✅ WebSocket connected
Protocol: 
URL: wss://localhost/ws
readyState: 1 (OPEN)
```

### 2.2 WebSocket Message Test

```javascript
// Send message
ws.send(JSON.stringify({
  type: 'GAME_JOIN',
  gameId: '123',
  userId: 'user1'
}));

// Receive message
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('✅ Received:', data);
};
```

### 2.3 WebSocket Timeout & Reconnect

```javascript
// Test connection drop
setTimeout(() => {
  ws.close();
  console.log('Closed connection');
  
  // Reconnect after 3 seconds
  setTimeout(() => {
    const ws2 = new WebSocket('wss://localhost/ws');
    ws2.onopen = () => console.log('✅ Reconnected');
  }, 3000);
}, 5000);
```

---

## 🔗 TEST 3: REST API with HTTPS

### 3.1 CORS Preflight Request

```bash
# Send OPTIONS request (preflight for cross-origin)
curl -X OPTIONS https://localhost/api/games/ \
  -H "Origin: https://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Expected headers:
# ✅ Access-Control-Allow-Origin: https://localhost:3000
# ✅ Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# ✅ Access-Control-Allow-Headers: ...
```

### 3.2 Authentication Test

```bash
# 1. Login (get JWT token)
curl -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  --cacert certs/server.crt \
  -d '{"username":"admin","password":"admin123"}'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expiresIn": 3600
# }

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Use token on protected endpoint
curl -X GET https://localhost/api/games/ \
  -H "Authorization: Bearer $TOKEN" \
  --cacert certs/server.crt

# Expected:
# ✅ HTTP 200 OK with game list
```

### 3.3 Missing Token Test

```bash
# Call protected endpoint without token
curl -X GET https://localhost/api/games/ \
  --cacert certs/server.crt

# Expected:
# ❌ HTTP 401 Unauthorized
```

---

## 📱 TEST 4: Mobile Response & WebSocket Protocol Auto-Detection

### 4.1 Desktop Browser (HTTP)

```javascript
// http://localhost:3000 (port 3000 = HTTP)

// frontend code auto-detects:
const isSecure = window.location.protocol === "https:";
// isSecure = false (HTTP)

const protocol = isSecure ? "wss" : "ws";
// protocol = "ws"

const ws = new WebSocket(`${protocol}://localhost:3000/ws`);
// Result: ws://localhost:3000/ws ✅
```

### 4.2 Desktop Browser (HTTPS)

```javascript
// https://localhost (nginx reverse proxy)

// frontend code auto-detects:
const isSecure = window.location.protocol === "https:";
// isSecure = true (HTTPS)

const protocol = isSecure ? "wss" : "ws";
// protocol = "wss"

const ws = new WebSocket(`${protocol}://localhost/ws`);
// Result: wss://localhost/ws ✅ (WebSocket Secure)
```

### 4.3 Mobile Chrome/Safari (HTTPS mandated)

```javascript
// https://yourdomain.com (production on AWS)

// Even if old WS used:
// Browser automatically rejects ws:// on HTTPS page
// Error: "Mixed Content: The page was loaded over HTTPS, but requested an insecure WebSocket..."

// Frontend must use wss://
// ✅ Automatic detection handles this
```

### 4.4 Mobile Responsiveness Test

```javascript
// Test viewport auto-adjustment

// Check CSS media queries apply
const style = getComputedStyle(document.querySelector('.game-board'));
console.log('Current layout:');
console.log('Width:', window.innerWidth);
console.log('Height:', window.innerHeight);
console.log('Computed display:', style.display);

// Expected for 375px width (iPhone):
// ✅ grid-template-columns: 1fr (single column)

// Expected for 1024px width (iPad):
// ✅ grid-template-columns: repeat(3, 1fr) (3 columns)

// Expected for 1440px+ (Desktop):
// ✅ grid-template-columns: repeat(4, 1fr) (4 columns)
```

---

## 🔽 TEST 5: Network Resilience (Slow Network Simulation)

### 5.1 Chrome DevTools Network Throttle

```
1. Open DevTools (F12)
2. Network tab
3. Throttle dropdown → "Slow 3G"
4. Perform login → /api/auth/login
5. Check response time
6. Verify retry happens on timeout

Expected:
✅ Request takes 5-10 seconds
✅ Displays loading spinner
✅ No error (auto-retry works)
```

### 5.2 Offline Mode Test

```javascript
// Simulate offline
navigator.onLine = false; // Not real offline, but for testing

// Try API call
fetch('https://localhost/api/games/')
  .catch(err => {
    console.log('Error:', err.message);
    // Expected: "Failed to fetch" (network error)
  });

// Frontend should:
// ✅ Show "You are offline" message
// ✅ Retry automatically when online
```

### 5.3 High Latency Test

```bash
# Linux/Mac: Simulate 2000ms latency using tc (traffic control)
sudo tc qdisc add dev eth0 root netem delay 2000ms

# Then run API test
curl -v https://localhost/api/games/ \
  --cacert certs/server.crt

# Expected:
# ✅ Takes ~2 seconds longer
# ✅ Frontend still works (timeout set to 10s)

# Remove latency
sudo tc qdisc delete dev eth0 root
```

---

## 📊 TEST 6: Performance & Load Testing

### 6.1 API Response Time

```bash
# Measure single request time
time curl -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  --cacert certs/server.crt \
  -d '{"username":"admin","password":"admin123"}' \
  -w "\nTime: %{time_total}s\n"

# Expected:
# ✅ Time: 0.05-0.2s (50-200ms)
```

### 6.2 Concurrent Users Test (Apache Bench)

```bash
# Simulate 100 concurrent users, 1000 total requests
ab -n 1000 -c 100 -k \
  -H "Authorization: Bearer $TOKEN" \
  https://localhost/api/games/

# Output analysis:
# Requests per second (RPS): >= 50 RPS ✅
# Failed requests: 0 ✅
# Avg response time: < 200ms ✅
# 95th percentile: < 500ms ✅
```

### 6.3 WebSocket Load Test (100 concurrent connections)

```bash
# Using Artillery (npm install -g artillery)
cat > websocket-load.yml <<EOF
config:
  target: wss://localhost/ws
  phases:
    - duration: 30
      arrivalRate: 10
      name: "Ramp up"
    - duration: 60
      arrivalRate: 10
      name: "Sustain load"
    - duration: 10
      arrivalRate: 0
      name: "Ramp down"

scenarios:
  - name: "WebSocket load"
    flow:
      - ws.send: '{"type":"GAME_JOIN","gameId":"1"}'
      - think: 5
      - ws.send: '{"type":"ANSWER","questionId":"1","answer":"A"}'
EOF

artillery run websocket-load.yml

# Expected results:
# ✅ 95th percentile latency: < 200ms
# ✅ Error rate: < 0.1%
# ✅ Throughput: 100+ connections/sec
```

---

## 🌍 TEST 7: Production Environment (AWS)

### 7.1 AWS Domain Accessibility

```bash
# Verify DNS resolution
nslookup yourdomain.com
# → Should show ALB's IP address

# Test HTTPS
curl -v https://yourdomain.com/healthz

# Expected:
# ✅ HTTP/2 200 OK
# ✅ Server cert issued by Let's Encrypt
```

### 7.2 ALB Health Check

```bash
# Check ALB status
aws elbv2 describe-target-health \
    --target-group-arn arn:aws:elasticloadbalancing:eu-west-1:...:targetgroup/quiz-game-tg/...

# Expected output:
# {
#   "TargetHealthDescriptions": [{
#     "Target": { "Id": "i-0123456789abcdef", "Port": 80 },
#     "TargetHealth": {
#       "State": "healthy",  # ✅
#       "Reason": "N/A",
#       "Description": "Target registration is complete"
#     }
#   }]
# }
```

### 7.3 Cross-Browser HTTPS Test

```
Chrome:  curl https://yourdomain.com  ✅
Firefox: curl https://yourdomain.com  ✅
Safari:  curl https://yourdomain.com  ✅
Edge:    curl https://yourdomain.com  ✅
```

### 7.4 Mobile iOS/Android Devices

```
1. iPhone/iPad:
   - Open Safari
   - Navigate to https://yourdomain.com
   - Add to Home Screen (PWA)
   - ✅ Should work identically to desktop

2. Android:
   - Open Chrome
   - Navigate to https://yourdomain.com
   - "Install app" prompt
   - ✅ Should install as PWA

3. Both:
   - Test login
   - Play game (WebSocket connection)
   - Answer questions
   - ✅ All functionality should work
```

---

## 📋 Automated Testing Script

```bash
#!/bin/bash
# test-all.sh - Comprehensive test suite

set -e

DOMAIN="${1:-localhost}"
PROTOCOL="https"
API_URL="$PROTOCOL://$DOMAIN/api"
WS_URL="wss://$DOMAIN/ws"
CERT_OPT="--cacert certs/server.crt"

echo "🧪 Testing $DOMAIN..."

# 1. HTTPS Health Check
echo "✓ Testing HTTPS health check..."
curl -s $CERT_OPT "$PROTOCOL://$DOMAIN/healthz" | grep -q "OK" && echo "  ✅ OK"

# 2. REST API Login
echo "✓ Testing API login..."
TOKEN=$(curl -s $CERT_OPT -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')
[[ -n "$TOKEN" ]] && echo "  ✅ Token: ${TOKEN:0:20}..."

# 3. Game List
echo "✓ Testing game list..."
curl -s $CERT_OPT -H "Authorization: Bearer $TOKEN" \
  "$API_URL/games/" | jq '.length' && echo "  ✅ Games listed"

# 4. WebSocket test (Node.js required)
echo "✓ Testing WebSocket..."
node -e "
const WebSocketClient = require('ws');
const ws = new WebSocketClient('$WS_URL');
ws.on('open', () => console.log('  ✅ WebSocket connected'));
ws.on('error', (e) => console.error('  ❌', e.message));
setTimeout(() => process.exit(0), 2000);
"

echo ""
echo "✅ All tests passed!"
```

---

## 🔍 Troubleshooting Common Issues

### Issue: "Certificate verification failed"
```bash
# Self-signed cert not recognized
# Solution: Use --cacert or skip verification (dev only)
curl --insecure https://localhost/healthz

# Or trust certificate
# macOS: open certs/server.crt → Keychain → Always trust
```

### Issue: "Mixed Content" error on HTTPS
```javascript
// Problem: HTTPS page tried to load WS (insecure WebSocket)
// Solution: Use WSS automatically
// ✅ Already implemented in websocket-config.js
```

### Issue: ALB shows "unhealthy" targets
```bash
# Check nginx config
docker-compose exec nginx nginx -t

# Check health check endpoint
curl -v http://localhost/healthz

# Fix: Ensure /healthz returns 200 OK
```

### Issue: "Connection refused" on port 443
```bash
# Ensure nginx is running
docker-compose ps nginx
# Status: should be "running"

# Check port availability
netstat -an | grep 443

# If needed, rebuild nginx
docker-compose up -d --build nginx
```

---

## ✅ Final Checklist

- [ ] ✅ HTTPS certificate installed & valid
- [ ] ✅ HTTP redirects to HTTPS
- [ ] ✅ HSTS headers present
- [ ] ✅ TLS 1.2+ only (no SSL 3.0)
- [ ] ✅ WebSocket upgrades to WSS
- [ ] ✅ REST API working over HTTPS
- [ ] ✅ JWT tokens validated
- [ ] ✅ CORS headers present
- [ ] ✅ Mobile responsive (320px-1440px)
- [ ] ✅ Mobile WebSocket (WSS) works
- [ ] ✅ Offline resilience (retry logic)
- [ ] ✅ Load tested (100+ concurrent users)
- [ ] ✅ AWS ALB health checks passing
- [ ] ✅ Domain resolves correctly
- [ ] ✅ Let's Encrypt cert auto-renewing

---

**Next:** Performance Tuning & Optimization
