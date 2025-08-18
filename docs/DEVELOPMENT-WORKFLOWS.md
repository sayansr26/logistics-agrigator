# Development Workflows

## 🚀 **Quick Start Commands**

### **Full-Stack Developer**
```bash
# Complete setup (one command!)
pnpm run setup:dev             

# What this does:
# ✅ Sets up environment variables
# ✅ Installs all workspace dependencies  
# ✅ Starts all services (frontend + backend + databases)
```

### **Frontend Developer**
```bash
# Frontend-focused setup (one command!)
pnpm run setup:frontend        

# What this does:
# ✅ Sets up environment variables
# ✅ Installs all dependencies
# ✅ Starts frontend application only
# 🔗 Assumes backend is running elsewhere or mocked
```

### **Backend Developer**
```bash
# Backend-focused setup (one command!)  
pnpm run setup:backend         

# What this does:
# ✅ Sets up environment variables
# ✅ Installs all dependencies
# ✅ Starts databases + API services
# 🚫 No frontend (faster startup)
```

---

## 🔧 **Development Commands Reference**

### **Project Management**
| Command | Description | Use Case |
|---------|-------------|----------|
| `pnpm install` | Install all workspace dependencies | Initial setup, after pulling changes |
| `pnpm run dev` | Start complete environment | Full-stack development |
| `pnpm run stop` | Stop all services | End development session |
| `pnpm run clean` | Clean & rebuild environment | Fix Docker issues |

### **Focused Development**
| Command | Description | Use Case |
|---------|-------------|----------|
| `pnpm run dev:frontend` | Frontend-only development | UI/UX work, component development |
| `pnpm run dev:backend` | Backend-only (core services) | API development, database work |
| `pnpm run dev:backend:full` | All backend services | Full backend development |

### **Service Management**  
| Command | Description | Use Case |
|---------|-------------|----------|
| `pnpm run stop:frontend` | Stop frontend services | Switch to backend focus |
| `pnpm run stop:backend` | Stop backend services | Switch to frontend focus |
| `pnpm run stop:all` | Stop everything (all modes) | Complete cleanup |

### **Monitoring & Debugging**
| Command | Description | Use Case |
|---------|-------------|----------|
| `pnpm run logs` | View all service logs | Monitor full system |
| `pnpm run logs:frontend` | Frontend logs only | Debug UI issues |
| `pnpm run logs:backend` | Backend logs only | Debug API issues |
| `pnpm run logs:auth` | Auth service logs | Debug authentication |
| `pnpm run logs:user` | User service logs | Debug user management |

### **Health Checks**
| Command | Description | Use Case |
|---------|-------------|----------|
| `pnpm run health` | Backend API health | Quick backend status |
| `pnpm run health:frontend` | Frontend health | Quick frontend status |

### **Database Operations**
| Command | Description | Use Case |
|---------|-------------|----------|
| `pnpm run prisma:studio` | Visual database browser | Browse/edit data |
| `pnpm run prisma:generate` | Generate all Prisma clients | After schema changes |

---

## 🎯 **Workflow Scenarios**

### **Scenario 1: New Developer Onboarding**
```bash
# Day 1: Complete setup
git clone <repository>
cd logistics
pnpm run setup:dev

# Access points:
# Frontend: http://localhost:3000
# API: http://localhost:8000  
# Database: pnpm run prisma:studio
```

### **Scenario 2: Frontend-Only Work**
```bash
# Morning: Start frontend development
pnpm run setup:frontend

# Development:
# - Work in /frontend directory
# - Hot reload at http://localhost:3000
# - Mock API calls or connect to staging backend

# Evening: Stop services
pnpm run stop:frontend
```

### **Scenario 3: Backend-Only Work**  
```bash
# Morning: Start backend development
pnpm run setup:backend

# Development:
# - Work in /backend/[service] directories
# - Test APIs at http://localhost:8000
# - Use Prisma Studio for database work

# Evening: Stop services  
pnpm run stop:backend
```

### **Scenario 4: Full-Stack Feature Development**
```bash
# Morning: Start complete environment
pnpm run setup:dev

# Development:
# - Frontend work: http://localhost:3000
# - Backend APIs: http://localhost:8000
# - Database: pnpm run prisma:studio
# - Monitor: pnpm run logs

# Evening: Stop everything
pnpm run stop
```

### **Scenario 5: Debugging Issues**
```bash
# Problem: Service not working
pnpm run logs:auth              # Check specific service
pnpm run health                 # Check API status  
pnpm run health:frontend        # Check frontend status

# Problem: Environment corruption
pnpm run clean                  # Clean rebuild
pnpm run setup:dev             # Fresh setup
```

---

## 📁 **Docker Compose Files**

### **Main Configuration**
- **`docker-compose.yml`**: Complete development environment (default)
- **`docker-compose.frontend.yml`**: Frontend-only development
- **`docker-compose.backend.yml`**: Backend-only development

### **Service Organization**

#### **Frontend Services**
- Next.js development server
- Hot reload capabilities
- Environment optimized for UI work

#### **Backend Services**  
- **Core Services**: API Gateway, Auth, User (always included)
- **Future Services**: Shipment, Support, Platform (profile-based)
- **Databases**: PostgreSQL, Redis
- **Development Tools**: Prisma Studio access

#### **Profiles for Future Services**
```bash
# Include future services in backend development
pnpm run dev:backend:full
# Equivalent to: docker-compose -f docker-compose.backend.yml --profile future-services up
```

---

## 🔄 **Development Lifecycle**

### **Daily Workflow**
1. **Start**: `pnpm run setup:[mode]` based on focus area
2. **Develop**: Work in respective directories with hot reload
3. **Test**: `pnpm run test` or service-specific testing
4. **Debug**: Use `pnpm run logs:[service]` as needed
5. **Stop**: `pnpm run stop:[mode]` when done

### **Weekly Workflow** 
1. **Pull Changes**: `git pull origin main`
2. **Update Dependencies**: `pnpm install`
3. **Clean Environment**: `pnpm run clean` (if issues)
4. **Fresh Start**: `pnpm run setup:dev`

### **Issue Resolution**
1. **Check Logs**: `pnpm run logs`
2. **Health Check**: `pnpm run health`
3. **Clean Rebuild**: `pnpm run clean && pnpm run setup:dev`
4. **Individual Service**: Focus on specific service logs

---

## 🎨 **Development Focus Areas**

### **Frontend Developer Path**
```bash
# Your primary commands:
pnpm run setup:frontend         # Daily startup
pnpm run logs:frontend         # Monitor your work
pnpm run health:frontend       # Quick status
pnpm run stop:frontend         # Daily shutdown

# Your development environment:
# 🌐 Frontend: http://localhost:3000 (hot reload)
# 📱 Responsive: Test mobile/tablet views  
# 🎨 Styles: Tailwind CSS classes
# 📊 State: Zustand store management
# 🔌 APIs: Connect to backend services
```

### **Backend Developer Path**
```bash
# Your primary commands:
pnpm run setup:backend         # Daily startup (core services)
pnpm run setup:backend:full    # Full backend (including future services)
pnpm run logs:backend         # Monitor your work
pnpm run prisma:studio        # Database browser
pnpm run stop:backend         # Daily shutdown

# Your development environment:
# 🔧 APIs: http://localhost:8000 (gateway)
# 🗄️ Database: PostgreSQL with Prisma
# 📊 Visual DB: Prisma Studio (browser-based)
# 🔍 Logs: Service-specific monitoring
# 🧪 Testing: API endpoint testing
```

### **Full-Stack Developer Path**  
```bash
# Your primary commands:
pnpm run setup:dev            # Daily startup (everything)
pnpm run logs                 # Monitor everything
pnpm run health               # Backend status
pnpm run health:frontend     # Frontend status
pnpm run stop                # Daily shutdown

# Your development environment:
# 🌐 Frontend: http://localhost:3000
# 🔧 Backend: http://localhost:8000
# 🗄️ Database: Prisma Studio
# 📊 Monitoring: Comprehensive logs
# 🔄 Integration: End-to-end testing
```

---

## ✅ **Best Practices**

### **Command Usage**
- ✅ Use `pnpm run setup:[mode]` for initial startup
- ✅ Use specific log commands (`logs:auth`) for debugging
- ✅ Use health checks before reporting issues
- ✅ Use clean commands when environment acts unexpectedly

### **Development Efficiency**
- ✅ Choose the right mode for your work focus
- ✅ Use hot reload to your advantage
- ✅ Monitor logs proactively during development
- ✅ Keep Prisma Studio open for database work

### **Troubleshooting**
- ✅ Always check logs first: `pnpm run logs`
- ✅ Use health checks to isolate issues
- ✅ Clean rebuild for persistent Docker issues
- ✅ Use service-specific commands for targeted debugging

---

**Status**: ✅ **Development workflows optimized for PNPM monorepo**  
**Focus**: Frontend-only, Backend-only, and Full-stack development modes  
**Efficiency**: One-command setup for each development scenario