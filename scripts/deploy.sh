#!/bin/bash
# EC2 Deployment Start Script
# Kullanım: bash ./scripts/deploy.sh

set -e

echo "🚀 Online Test App - EC2 Deployment Started"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Docker Check
echo -e "\n${YELLOW}1. Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker not found! Install Docker first${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is installed${NC}"

# 2. Docker Compose Check
echo -e "\n${YELLOW}2. Checking Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose not found! Install it first${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is installed${NC}"

# 3. .env File Check
echo -e "\n${YELLOW}3. Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found, creating from .env.ec2...${NC}"
    if [ -f .env.ec2 ]; then
        cp .env.ec2 .env
        echo -e "${YELLOW}📝 Please edit .env and set your configuration!${NC}"
        echo -e "${YELLOW}   Important: DB_PASSWORD, JWT_SECRET, API URLs${NC}"
        exit 1
    else
        echo -e "${RED}❌ Neither .env nor .env.ec2 found!${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ .env file exists${NC}"

# 4. Create directories
echo -e "\n${YELLOW}4. Creating necessary directories...${NC}"
mkdir -p scripts logs
echo -e "${GREEN}✓ Directories created${NC}"

# 5. Build & Start Containers
echo -e "\n${YELLOW}5. Building Docker images...${NC}"
docker-compose build
echo -e "${GREEN}✓ Images built${NC}"

echo -e "\n${YELLOW}6. Starting containers...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Containers started${NC}"

# 6. Wait for services
echo -e "\n${YELLOW}7. Waiting for services to be healthy...${NC}"
sleep 10

# 7. Check service health
echo -e "\n${YELLOW}8. Checking service health...${NC}"

check_service() {
    local name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $name is healthy${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "\n${RED}❌ $name failed to start${NC}"
    return 1
}

check_service "PostgreSQL" "localhost:5432" || true
check_service "Redis" "localhost:6379" || true
check_service "GameAdmin" "http://localhost:8080/api/health" || true
check_service "GameEngine" "http://localhost:8081/actuator/health" || true
check_service "Frontend" "http://localhost:3000" || true

# 8. Show logs
echo -e "\n${YELLOW}9. Container status:${NC}"
docker-compose ps

# 9. Summary
echo -e "\n${GREEN}✅ Deployment Complete!${NC}"
echo -e "\n${YELLOW}📍 Access your services:${NC}"
echo "   Admin API:    http://YOUR-EC2-IP:8080"
echo "   Engine WS:    ws://YOUR-EC2-IP:8081/ws"
echo "   Frontend:     http://YOUR-EC2-IP:3000"
echo ""
echo -e "${YELLOW}📊 View logs:${NC}"
echo "   docker-compose logs -f"
echo "   docker-compose logs game-admin"
echo "   docker-compose logs game-engine"
echo "   docker-compose logs frontend"
echo ""
echo -e "${YELLOW}🛑 Stop services:${NC}"
echo "   docker-compose down"
