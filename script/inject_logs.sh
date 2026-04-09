#!/bin/bash

# Base URL
BASE_URL="http://localhost:3000"

# Generates a Unix nanosecond timestamp N seconds ago from now
ts() {
  echo $(( ($(date +%s) - $1) * 1000000000 ))
}

echo "======================================"
echo "Injecting Logs - 3 Domain Architecture"
echo "======================================"
echo ""

# ========================================
# DOMAIN 1: IDENTITY (Authentication & Access Control)
# ========================================

echo "🔐 DOMAIN 1: Identity / Authentication"
echo "========================================"

# --- Brute Force Attack (IP: 203.0.113.50) ---
echo "1. Brute Force Attack Pattern..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"auth-service\", \"app\": \"auth\", \"level\": \"warn\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 840)\", \"POST /auth/login 401 12ms ip=203.0.113.50 user=admin reason=invalid_password\"],
        [\"$(ts 780)\", \"POST /auth/login 401 15ms ip=203.0.113.50 user=administrator reason=invalid_password\"],
        [\"$(ts 720)\", \"POST /auth/login 401 11ms ip=203.0.113.50 user=root reason=invalid_password\"],
        [\"$(ts 660)\", \"POST /auth/login 401 14ms ip=203.0.113.50 user=admin reason=invalid_password\"],
        [\"$(ts 600)\", \"POST /auth/login 401 13ms ip=203.0.113.50 user=user reason=invalid_password\"],
        [\"$(ts 540)\", \"POST /auth/login 401 16ms ip=203.0.113.50 user=test reason=invalid_password\"],
        [\"$(ts 480)\", \"POST /auth/login 401 12ms ip=203.0.113.50 user=admin reason=invalid_password\"],
        [\"$(ts 420)\", \"POST /auth/login 401 14ms ip=203.0.113.50 user=postgres reason=invalid_password\"],
        [\"$(ts 360)\", \"POST /auth/login 401 11ms ip=203.0.113.50 user=mysql reason=invalid_password\"],
        [\"$(ts 300)\", \"POST /auth/login 401 13ms ip=203.0.113.50 user=dbadmin reason=invalid_password\"]
      ]
    }]
  }"
echo "✓ Brute force injected — IP: 203.0.113.50 (10 failed attempts)"

# --- Credential Stuffing (IP: 198.51.100.42) ---
echo "2. Credential Stuffing Pattern..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"auth-service\", \"app\": \"auth\", \"level\": \"warn\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 540)\", \"POST /auth/login 401 18ms ip=198.51.100.42 user=alice@company.com reason=invalid_password\"],
        [\"$(ts 480)\", \"POST /auth/login 401 16ms ip=198.51.100.42 user=bob@company.com reason=invalid_password\"],
        [\"$(ts 420)\", \"POST /auth/login 401 19ms ip=198.51.100.42 user=charlie@company.com reason=invalid_password\"],
        [\"$(ts 360)\", \"POST /auth/login 401 17ms ip=198.51.100.42 user=david@company.com reason=invalid_password\"],
        [\"$(ts 300)\", \"POST /auth/login 401 15ms ip=198.51.100.42 user=emma@company.com reason=invalid_password\"],
        [\"$(ts 240)\", \"POST /auth/login 200 52ms ip=198.51.100.42 user=frank@company.com session=sess_abc123\"],
        [\"$(ts 180)\", \"POST /auth/login 401 18ms ip=198.51.100.42 user=grace@company.com reason=invalid_password\"]
      ]
    }]
  }"
echo "✓ Credential stuffing injected — IP: 198.51.100.42 (7 users targeted, 1 success)"

# --- Geo-Impossible / Suspicious Login ---
echo "3. Geo-Impossible Login Behaviour..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"auth-service\", \"app\": \"auth\", \"level\": \"info\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 360)\", \"POST /auth/login 200 48ms ip=10.50.1.20 user=admin@company.com location=US session=sess_xyz789\"],
        [\"$(ts 300)\", \"POST /auth/login 200 145ms ip=185.220.101.45 user=admin@company.com location=RU session=sess_def456 anomaly=geo_impossible\"],
        [\"$(ts 240)\", \"POST /auth/login 200 52ms ip=10.50.1.20 user=jsmith@company.com location=US session=sess_ghi123\"],
        [\"$(ts 180)\", \"POST /auth/login 200 167ms ip=91.198.174.192 user=jsmith@company.com location=CN session=sess_jkl789 anomaly=geo_unusual\"]
      ]
    }]
  }"
echo "✓ Geo-impossible logins injected (US→RU, US→CN)"

# --- Token Replay/Reuse (IP: 172.16.50.88) ---
echo "4. Token Abuse Pattern..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"auth-service\", \"app\": \"token-validator\", \"level\": \"warn\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 240)\", \"POST /auth/validate 401 5ms ip=172.16.50.88 token=tok_expired_abc123 reason=token_expired\"],
        [\"$(ts 210)\", \"POST /auth/validate 401 6ms ip=172.16.50.88 token=tok_expired_abc123 reason=token_expired\"],
        [\"$(ts 180)\", \"POST /auth/validate 401 5ms ip=172.16.50.88 token=tok_expired_abc123 reason=token_expired\"],
        [\"$(ts 150)\", \"POST /auth/validate 401 7ms ip=172.16.50.88 token=tok_invalid_xyz789 reason=invalid_signature\"],
        [\"$(ts 120)\", \"POST /auth/validate 401 6ms ip=172.16.50.88 token=tok_invalid_xyz789 reason=invalid_signature\"],
        [\"$(ts 90)\",  \"POST /auth/validate 401 5ms ip=172.16.50.88 token=tok_revoked_def456 reason=token_revoked\"]
      ]
    }]
  }"
echo "✓ Token abuse injected — IP: 172.16.50.88 (expired/invalid/revoked tokens)"

# --- Normal Auth Baseline ---
echo "5. Normal Auth Baseline..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"auth-service\", \"app\": \"auth\", \"level\": \"info\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 120)\", \"POST /auth/login 200 52ms ip=10.0.1.45 user=jsmith@company.com\"],
        [\"$(ts 100)\", \"POST /auth/login 200 48ms ip=192.168.2.100 user=agarcia@company.com\"],
        [\"$(ts 80)\",  \"POST /auth/login 200 55ms ip=10.0.1.67 user=mjohnson@company.com\"],
        [\"$(ts 60)\",  \"POST /auth/login 200 49ms ip=172.16.0.22 user=lchen@company.com\"],
        [\"$(ts 40)\",  \"POST /auth/logout 200 8ms ip=10.0.1.45 user=jsmith@company.com\"],
        [\"$(ts 20)\",  \"POST /auth/refresh 200 24ms ip=192.168.2.100 user=agarcia@company.com\"]
      ]
    }]
  }"
echo -e "✓ Normal auth baseline injected\n"

# ========================================
# DOMAIN 2: HTTP / Application Traffic
# ========================================

echo "🌐 DOMAIN 2: HTTP / Application Traffic"
echo "========================================"

# --- Rate Abuse / Endpoint Abuse (IP: 45.142.120.10) ---
echo "6. Rate Abuse Pattern..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"api-gateway\", \"app\": \"gateway\", \"level\": \"warn\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 840)\", \"POST /api/search 429 12ms ip=45.142.120.10 user_agent=python-requests/2.28\"],
        [\"$(ts 780)\", \"POST /api/search 429 15ms ip=45.142.120.10 user_agent=python-requests/2.28\"],
        [\"$(ts 720)\", \"POST /api/search 429 11ms ip=45.142.120.10 user_agent=python-requests/2.28\"],
        [\"$(ts 660)\", \"POST /api/search 429 14ms ip=45.142.120.10 user_agent=python-requests/2.28\"],
        [\"$(ts 600)\", \"POST /api/search 429 13ms ip=45.142.120.10 user_agent=python-requests/2.28\"],
        [\"$(ts 540)\", \"POST /api/search 429 16ms ip=45.142.120.10 user_agent=python-requests/2.28\"],
        [\"$(ts 480)\", \"POST /api/search 429 12ms ip=45.142.120.10 user_agent=python-requests/2.28\"]
      ]
    }]
  }"
echo "✓ Rate abuse injected — IP: 45.142.120.10 (7 rate-limit hits)"

# --- Endpoint/Bot Scanning (IP: 203.0.113.45) ---
echo "7. Bot Endpoint Scanning..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"api-gateway\", \"app\": \"gateway\", \"level\": \"warn\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 600)\", \"GET /admin 404 5ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"],
        [\"$(ts 570)\", \"GET /wp-admin 404 4ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"],
        [\"$(ts 540)\", \"GET /.env 404 6ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"],
        [\"$(ts 510)\", \"GET /config.php 404 5ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"],
        [\"$(ts 480)\", \"GET /phpmyadmin 404 7ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"],
        [\"$(ts 450)\", \"GET /admin.php 404 4ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"],
        [\"$(ts 420)\", \"GET /backup.sql 404 6ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"],
        [\"$(ts 390)\", \"GET /database.sql 404 5ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"],
        [\"$(ts 360)\", \"GET /.git/config 404 8ms ip=203.0.113.45 user_agent=Mozilla/5.0-Bot\"]
      ]
    }]
  }"
echo "✓ Bot scanning injected — IP: 203.0.113.45 (9 distinct probes)"

# --- Unauthorized API Access (IP: 198.51.100.20) ---
echo "8. Unauthorized Admin Access..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"api-gateway\", \"app\": \"gateway\", \"level\": \"warn\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 360)\", \"GET /api/admin/users 403 5ms ip=198.51.100.20 user=guest\"],
        [\"$(ts 330)\", \"GET /api/admin/config 403 4ms ip=198.51.100.20 user=guest\"],
        [\"$(ts 300)\", \"GET /api/admin/logs 403 6ms ip=198.51.100.20 user=guest\"],
        [\"$(ts 270)\", \"GET /api/admin/database 403 5ms ip=198.51.100.20 user=guest\"],
        [\"$(ts 240)\", \"GET /api/admin/backup 403 7ms ip=198.51.100.20 user=guest\"],
        [\"$(ts 210)\", \"GET /api/admin/keys 403 5ms ip=198.51.100.20 user=guest\"],
        [\"$(ts 180)\", \"POST /api/admin/users 403 8ms ip=198.51.100.20 user=guest\"]
      ]
    }]
  }"
echo "✓ Unauthorized access injected — IP: 198.51.100.20 (7 forbidden admin paths)"

# --- SQL Injection (IP: 89.248.165.72) ---
echo "9. SQL Injection Attempts..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"api-gateway\", \"app\": \"gateway\", \"level\": \"error\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 240)\", \"GET /api/users?id=1' OR '1'='1 400 8ms ip=89.248.165.72 blocked=true reason=sqli_detected\"],
        [\"$(ts 180)\", \"GET /api/products?search='; DROP TABLE users-- 400 9ms ip=89.248.165.72 blocked=true reason=sqli_detected\"],
        [\"$(ts 120)\", \"POST /api/login body_contains=admin'-- 400 7ms ip=89.248.165.72 blocked=true reason=sqli_detected\"]
      ]
    }]
  }"
echo "✓ SQL injection injected — IP: 89.248.165.72 (3 blocked attempts)"

# --- Resource Exhaustion / DDoS (IP: 104.21.45.78) ---
echo "10. DDoS / Resource Exhaustion..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"api-gateway\", \"app\": \"gateway\", \"level\": \"warn\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 180)\", \"GET /api/status 200 2ms ip=104.21.45.78 requests_per_min=450\"],
        [\"$(ts 150)\", \"GET /api/status 200 3ms ip=104.21.45.78 requests_per_min=520\"],
        [\"$(ts 120)\", \"GET /api/status 200 2ms ip=104.21.45.78 requests_per_min=680\"],
        [\"$(ts 90)\",  \"GET /api/status 200 4ms ip=104.21.45.78 requests_per_min=890\"],
        [\"$(ts 60)\",  \"GET /api/status 429 1ms ip=104.21.45.78 requests_per_min=1240 action=rate_limited\"]
      ]
    }]
  }"
echo "✓ DDoS flood injected — IP: 104.21.45.78 (rate spike → rate_limited)"

# --- Normal API Baseline ---
echo "11. Normal API Traffic Baseline..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"api-gateway\", \"app\": \"gateway\", \"level\": \"info\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 80)\",  \"GET /api/users 200 45ms ip=10.0.1.45\"],
        [\"$(ts 70)\",  \"POST /api/orders 201 123ms ip=192.168.2.100\"],
        [\"$(ts 60)\",  \"GET /api/products 200 38ms ip=10.0.1.67\"],
        [\"$(ts 50)\",  \"PUT /api/users/123 200 87ms ip=10.0.1.45\"],
        [\"$(ts 40)\",  \"GET /api/products 200 41ms ip=172.16.0.22\"],
        [\"$(ts 30)\",  \"DELETE /api/orders/456 204 34ms ip=192.168.2.100\"],
        [\"$(ts 20)\",  \"GET /api/health 200 12ms ip=10.0.1.45\"]
      ]
    }]
  }"
echo -e "✓ Normal API baseline injected\n"

# ========================================
# DOMAIN 3: Infrastructure / Service Health
# ========================================

echo "⚙️  DOMAIN 3: Infrastructure / Service Health"
echo "=============================================="

# --- Service Crash Loop (payment-service) ---
echo "12. Service Crash Loop..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"payment-service\", \"app\": \"payment\", \"level\": \"error\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 840)\", \"service_start attempt=1 pid=12345\"],
        [\"$(ts 810)\", \"FATAL: database connection failed error=ECONNREFUSED host=db.internal:5432\"],
        [\"$(ts 780)\", \"service_exit code=1 reason=startup_failure\"],
        [\"$(ts 750)\", \"service_start attempt=2 pid=12389\"],
        [\"$(ts 720)\", \"FATAL: database connection failed error=ECONNREFUSED host=db.internal:5432\"],
        [\"$(ts 690)\", \"service_exit code=1 reason=startup_failure\"],
        [\"$(ts 660)\", \"service_start attempt=3 pid=12421\"],
        [\"$(ts 630)\", \"FATAL: database connection failed error=ECONNREFUSED host=db.internal:5432\"],
        [\"$(ts 600)\", \"service_exit code=1 reason=startup_failure\"],
        [\"$(ts 570)\", \"service_start attempt=4 pid=12467\"]
      ]
    }]
  }"
echo "✓ Crash loop injected — payment-service (4 restart attempts)"

# --- OOM / Resource Exhaustion (data-processor) ---
echo "13. OOM Resource Exhaustion..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"data-processor\", \"app\": \"processor\", \"level\": \"error\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 540)\", \"memory_usage=1.2GB limit=2GB utilization=60%\"],
        [\"$(ts 480)\", \"memory_usage=1.5GB limit=2GB utilization=75%\"],
        [\"$(ts 420)\", \"memory_usage=1.8GB limit=2GB utilization=90%\"],
        [\"$(ts 360)\", \"memory_usage=1.95GB limit=2GB utilization=97%\"],
        [\"$(ts 300)\", \"ERROR: OutOfMemoryError: Java heap space\"],
        [\"$(ts 240)\", \"service_killed signal=SIGKILL reason=OOM\"],
        [\"$(ts 180)\", \"service_restart reason=oom_killed container=data-processor-7f8b9c\"]
      ]
    }]
  }"
echo "✓ OOM exhaustion injected — data-processor (60%→97%→killed)"

# --- Dependency Failure (order-service → inventory-service) ---
echo "14. Dependency / Circuit Breaker Failure..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"order-service\", \"app\": \"orders\", \"level\": \"error\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 420)\", \"HTTP GET https://inventory-service/api/check timeout=5000ms error=ETIMEDOUT\"],
        [\"$(ts 360)\", \"HTTP GET https://inventory-service/api/check timeout=5000ms error=ETIMEDOUT\"],
        [\"$(ts 300)\", \"HTTP GET https://inventory-service/api/check timeout=5000ms error=ETIMEDOUT\"],
        [\"$(ts 240)\", \"dependency_failure service=inventory-service status=unhealthy consecutive_failures=3\"],
        [\"$(ts 180)\", \"circuit_breaker service=inventory-service state=OPEN reason=too_many_failures\"],
        [\"$(ts 120)\", \"order_processing_failed order_id=12345 reason=inventory_unavailable\"]
      ]
    }]
  }"
echo "✓ Dependency failure injected — order-service → inventory-service (circuit open)"

# --- CPU/Performance Degradation (search-service) ---
echo "15. CPU / Performance Degradation..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"search-service\", \"app\": \"search\", \"level\": \"warn\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 420)\", \"cpu_usage=45% response_time_p95=120ms\"],
        [\"$(ts 360)\", \"cpu_usage=62% response_time_p95=280ms\"],
        [\"$(ts 300)\", \"cpu_usage=78% response_time_p95=450ms\"],
        [\"$(ts 240)\", \"cpu_usage=85% response_time_p95=890ms\"],
        [\"$(ts 180)\", \"cpu_usage=91% response_time_p95=1340ms\"],
        [\"$(ts 120)\", \"cpu_usage=94% response_time_p95=2100ms\"],
        [\"$(ts 60)\",  \"WARN: service degraded cpu_threshold_exceeded duration=6m\"]
      ]
    }]
  }"
echo "✓ CPU degradation injected — search-service (45%→94% over 6m)"

# --- Configuration Error (notification-service) ---
echo "16. Configuration Error..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [{
      \"stream\": { \"service\": \"notification-service\", \"app\": \"notifications\", \"level\": \"error\", \"env\": \"production\" },
      \"values\": [
        [\"$(ts 420)\", \"service_start loading_config=/etc/app/config.yaml\"],
        [\"$(ts 390)\", \"ERROR: invalid config key 'smtp.port' expected=number got=string value='25x'\"],
        [\"$(ts 360)\", \"config_validation_failed errors=1\"],
        [\"$(ts 330)\", \"service_exit code=1 reason=invalid_configuration\"],
        [\"$(ts 300)\", \"restart_attempt=1 backoff=10s\"],
        [\"$(ts 240)\", \"service_start loading_config=/etc/app/config.yaml\"],
        [\"$(ts 210)\", \"ERROR: invalid config key 'smtp.port' expected=number got=string value='25x'\"]
      ]
    }]
  }"
echo "✓ Config error injected — notification-service (invalid smtp.port, loop)"

# --- Normal Service Health Baseline ---
echo "17. Normal Service Health Baseline..."
curl -s -o /dev/null -X POST "${BASE_URL}/push_logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"streams\": [
      {
        \"stream\": { \"service\": \"user-service\", \"app\": \"users\", \"level\": \"info\", \"env\": \"production\" },
        \"values\": [
          [\"$(ts 180)\", \"health_check status=healthy response_time=12ms\"],
          [\"$(ts 120)\", \"health_check status=healthy response_time=15ms\"],
          [\"$(ts 60)\",  \"health_check status=healthy response_time=11ms\"],
          [\"$(ts 20)\",  \"cpu_usage=35% memory=52% connections=45\"]
        ]
      },
      {
        \"stream\": { \"service\": \"inventory-service\", \"app\": \"inventory\", \"level\": \"info\", \"env\": \"production\" },
        \"values\": [
          [\"$(ts 180)\", \"health_check status=healthy response_time=18ms\"],
          [\"$(ts 120)\", \"health_check status=healthy response_time=14ms\"],
          [\"$(ts 20)\",  \"cpu_usage=28% memory=48% connections=32\"]
        ]
      }
    ]
  }"
echo -e "✓ Healthy service baseline injected\n"

echo "======================================"
echo "✅ Log Injection Complete!"
echo "======================================"
echo ""
echo "📊 PATTERNS INJECTED BY DOMAIN:"
echo ""
echo "🔐 DOMAIN 1: IDENTITY"
echo "   • Brute Force         → IP 203.0.113.50  (10 failed attempts)"
echo "   • Credential Stuffing → IP 198.51.100.42 (7 users, 1 success)"
echo "   • Geo-Impossible      → admin@company.com (US→RU), jsmith (US→CN)"
echo "   • Token Replay        → IP 172.16.50.88  (expired/invalid/revoked)"
echo ""
echo "🌐 DOMAIN 2: HTTP"
echo "   • Rate Abuse          → IP 45.142.120.10  (7 × 429)"
echo "   • Endpoint Scanning   → IP 203.0.113.45   (9 bot probes)"
echo "   • Unauthorized Access → IP 198.51.100.20  (7 admin 403s)"
echo "   • SQL Injection       → IP 89.248.165.72  (3 blocked)"
echo "   • DDoS Flood          → IP 104.21.45.78   (spike → rate_limited)"
echo ""
echo "⚙️  DOMAIN 3: INFRASTRUCTURE"
echo "   • Service Crash Loop  → payment-service       (4 restart attempts)"
echo "   • OOM Kill            → data-processor        (60%→97%→SIGKILL)"
echo "   • Dependency Failure  → order→inventory-svc   (circuit breaker OPEN)"
echo "   • CPU Degradation     → search-service        (45%→94%, 6 min)"
echo "   • Config Error        → notification-service  (invalid smtp.port loop)"