# Quick Start Guide - Get Running in 10 Minutes

This guide will get you up and running with the Logistics Aggregator Portal development environment in 10 minutes or less.

## 📋 **Prerequisites**

**Required Software:**
- **Docker Desktop**: Version 4.0+ with Docker Compose
- **Git**: For version control
- **VS Code**: Recommended IDE (or your preferred editor)

**System Requirements:**
- **RAM**: 8GB minimum, 16GB recommended
- **Disk Space**: 5GB free space for containers and dependencies
- **Ports**: 3000, 5432, 6379, 8000-8007 available

## ⚡ **10-Minute Setup**

### **Step 1: Clone Repository (1 minute)**
```bash
# Clone the project
git clone <repository-url>
cd logistics

# Verify project structure
ls -la
# You should see: backend/, frontend/, docs/, memory-bank/, etc.
```

### **Step 2: Environment Setup (1 minute)**
```bash
# Copy environment template
cp .env.example .env

# The default values work for development - no changes needed!
# Environment is pre-configured for Docker development
```

### **Step 3: Start All Services (5 minutes)**
```bash
# Start the entire development environment
docker-compose up

# Wait for all services to start (first run takes 3-5 minutes)
# You'll see logs from all services starting up
```

**What's happening:**
- 🗄️ PostgreSQL database starting with 5 service databases
- 📦 Redis starting for session management
- 🚪 API Gateway starting on port 8000
- 🔐 Auth Service starting on port 8001 (with Prisma migrations)
- 👥 User Service starting on port 8002
- 🌐 Frontend starting on port 3000

### **Step 4: Verify Everything Works (2 minutes)**
```bash
# In a new terminal, test the services
# Check API Gateway health
curl http://localhost:8000/health

# Check Auth Service
curl http://localhost:8001/health

# Check User Service  
curl http://localhost:8002/health

# All should return {"status": "healthy", ...}
```

### **Step 5: Access Applications (1 minute)**
Open your browser and visit:

- **Frontend Application**: http://localhost:3000
- **API Gateway**: http://localhost:8000/health
- **Prisma Studio** (Database Browser): 
  ```bash
  docker-compose exec auth-service npx prisma studio
  # Then visit: http://localhost:5555
  ```

## ✅ **Success Verification**

You should see:

**Frontend (http://localhost:3000):**
- Professional landing page with "Logistics Aggregator Portal" title
- Navigation with login/register options
- Responsive design with Tailwind CSS styling

**API Health Check (http://localhost:8000/health):**
```json
{
  "status": "healthy",
  "services": {
    "auth-service": "healthy",
    "user-service": "healthy"
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Prisma Studio (http://localhost:5555):**
- Visual database interface
- Tables: users, sessions, audit_logs
- Ability to browse and edit data

## 🎯 **Next Steps Based on Your Role**

### **Frontend Developer**
```bash
# Your development workflow:
cd frontend/

# Start working on authentication integration
npm run dev  # (Already running via Docker)

# Key files to start with:
# - src/app/(auth)/login/page.tsx
# - src/store/auth.ts
# - src/lib/api.ts
```

**Read Next:** [Frontend Development Guide](../docs/FRONTEND-DEVELOPMENT-GUIDE.md)

### **Backend Developer**
```bash
# Your development workflow:
cd backend/user-service/

# Access service container
docker-compose exec user-service sh

# Inside container:
npx prisma studio  # Visual database
npx prisma migrate dev  # Create migrations
npm run dev  # Development server
```

**Read Next:** [Backend Development Guide](../docs/BACKEND-DEVELOPMENT-GUIDE.md)

### **Full-Stack Developer**
1. **Understand the Architecture**: [Architecture Overview](./Architecture-Overview.md)
2. **Review API Contracts**: [API Reference](../docs/API-Specifications.md)
3. **Choose Your Starting Service**: User Service is currently in development

## 🔧 **Common Development Commands**

### **Docker Management**
```bash
# View running services
docker-compose ps

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f auth-service

# Restart a service
docker-compose restart user-service

# Stop all services
docker-compose down

# Rebuild and start (after code changes)
docker-compose up --build
```

### **Database Operations**
```bash
# Access Prisma Studio (visual database browser)
docker-compose exec auth-service npx prisma studio

# Create a new migration (after schema changes)
docker-compose exec auth-service npx prisma migrate dev --name "description"

# Generate Prisma client (after schema changes)
docker-compose exec auth-service npx prisma generate

# Reset database (development only)
docker-compose exec auth-service npx prisma migrate reset
```

### **Testing APIs**
```bash
# Test user registration
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "role": "client"
  }'

# Test user login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "SecurePass123!"
  }'
```

## 🚨 **Troubleshooting**

### **Port Conflicts**
```bash
# If ports are in use:
# Check what's using the ports
lsof -i :3000
lsof -i :8000

# Stop the processes or change ports in docker-compose.yml
```

### **Docker Issues**
```bash
# Clear Docker cache and rebuild
docker-compose down
docker system prune -f
docker-compose up --build

# If database issues:
docker-compose down -v  # Removes volumes (data will be lost)
docker-compose up
```

### **Service Won't Start**
```bash
# Check service logs for errors
docker-compose logs service-name

# Common issues:
# - Port already in use
# - Database connection failed
# - Missing environment variables
```

### **Prisma Issues**
```bash
# If migration fails:
docker-compose exec auth-service npx prisma migrate reset

# If client generation fails:
docker-compose exec auth-service npx prisma generate

# If database connection fails:
# Check DATABASE_URL in .env file
```

## 📚 **Development Resources**

### **Project Documentation**
- **Memory Bank**: Complete project context in `/memory-bank/`
- **API Specs**: Detailed API documentation in `/docs/API-Specifications.md`
- **Architecture**: System design in `/memory-bank/systemPatterns.md`

### **External Documentation**
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Express.js Docs**: https://expressjs.com
- **Docker Compose**: https://docs.docker.com/compose

### **Development Tools**
- **Prisma Studio**: http://localhost:5555 (visual database)
- **Frontend**: http://localhost:3000 (Next.js app)
- **API Gateway**: http://localhost:8000 (service routing)
- **VS Code Extensions**: Prisma, TypeScript, React, Docker

## 🎯 **Current Development Focus**

### **Week 2 Priorities**
- **User Service**: Backend development with Prisma ORM
- **Frontend Auth**: Authentication integration and state management
- **Service Integration**: Connect frontend to backend APIs

### **What's Ready to Work On**
- ✅ **Auth Service**: Complete reference implementation
- 🔄 **User Service**: Backend development (Prisma schema design)
- 🔄 **Frontend**: Authentication forms and state management
- 📋 **Shipment Service**: Waiting for User Service completion

### **What to Avoid (Not Ready Yet)**
- ❌ **Shipment Management**: Backend service not ready
- ❌ **Platform Integration**: Shopify service not ready
- ❌ **Support System**: Support service not ready
- ❌ **Advanced Features**: Requires core services completion

## ✅ **You're Ready to Start Developing!**

**If everything above worked:**
- ✅ All services are running and healthy
- ✅ Frontend is accessible and responsive
- ✅ Database is connected with Prisma Studio access
- ✅ APIs are responding to health checks

**Choose your development path:**
- **Frontend Developer**: [Frontend Development Guide](../docs/FRONTEND-DEVELOPMENT-GUIDE.md)
- **Backend Developer**: [Backend Development Guide](../docs/BACKEND-DEVELOPMENT-GUIDE.md)
- **Full-Stack**: Start with the User Service (currently in development)

**Questions?** Check the [Wiki](./README.md) or review the [Memory Bank](../memory-bank/) for complete project context.

---

**Quick Start Status**: ✅ **Complete Development Environment Ready**  
**Time to Complete**: ~10 minutes  
**Next Step**: Choose your development guide and start coding!