# Windows Scripts for Logistics Aggregator Portal

This directory contains Windows batch file equivalents of the Unix shell scripts for Windows users.

## Available Windows Scripts

### 🧹 `cleanup.bat`

**Purpose**: Comprehensive cleanup of node_modules, build artifacts, and Docker containers

**Usage**:

```cmd
# Basic cleanup (Windows)
pnpm run cleanup:win

# Deep Docker cleanup (Windows)
pnpm run cleanup:deep:win

# Cross-platform (will use Unix script on Mac/Linux)
pnpm run cleanup
pnpm run cleanup:deep
```

**What it does**:

- Removes all `node_modules` directories
- Removes all lock files (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`)
- Removes build directories (`.next`, `dist`, `build`, `.turbo`)
- Cleans Docker containers and volumes
- Removes temporary files and IDE cache files
- Cleans pnpm cache

### 🚀 `setup.bat`

**Purpose**: Sets up environment files and installs dependencies

**Usage**:

```cmd
# Full setup (Windows)
pnpm run setup:dev:win

# Frontend-only setup (Windows)
pnpm run setup:frontend:win

# Backend-only setup (Windows)
pnpm run setup:backend:win

# Force overwrite existing .env files (Windows)
pnpm run setup:env:win

# Cross-platform (will use Unix script on Mac/Linux)
pnpm run setup:dev
pnpm run setup:frontend
pnpm run setup:backend
pnpm run setup:env
```

**What it does**:

- Creates/updates `.env` files from `.env.example` templates
- Sets up service-specific environment configurations
- Installs dependencies using pnpm
- Configures database connection strings
- Sets up JWT secrets and service URLs

### 📚 `update-memory-and-changelog.bat`

**Purpose**: Updates memory bank files and changelog automatically

**Usage**:

```cmd
# Windows
pnpm run update:memory:win

# Cross-platform (will use Unix script on Mac/Linux)
pnpm run update:memory
```

**What it does**:

- Updates `memory-bank/activeContext.md` timestamp
- Updates `memory-bank/progress.md` timestamp
- Updates `CHANGELOG.md` with new entries
- Commits changes automatically
- Creates backups of modified files

### 🔍 `check-npm-to-pnpm.bat`

**Purpose**: Checks for remaining npm commands that should be pnpm

**Usage**:

```cmd
scripts\check-npm-to-pnpm.bat
```

**What it does**:

- Scans for npm commands in documentation
- Identifies files that need pnpm conversion
- Reports conversion status
- Lists remaining npm references (by design)

## Windows-Specific Features

### ✅ **Cross-Platform Compatibility**

- Uses Windows batch file syntax (`@echo off`, `setlocal enabledelayedexpansion`)
- Handles Windows path separators (`\` instead of `/`)
- Uses Windows commands (`rmdir /s /q`, `del /f /q`)
- Supports Windows environment variables (`%TEMP%`, `%RANDOM%`)

### 🐳 **Docker Integration**

- Checks if Docker is running before proceeding
- Uses `docker-compose` commands compatible with Windows
- Handles Docker container management
- Supports Docker deep cleanup operations

### 📁 **File Management**

- Safe file and directory removal with error handling
- Backup creation before modifications
- PowerShell integration for complex text operations
- Temporary directory management

### 🔧 **Error Handling**

- Comprehensive error checking
- Graceful fallbacks for missing tools
- User-friendly error messages
- Exit codes for automation

## Prerequisites

### Required Tools

1. **pnpm**: Package manager (install via `npm install -g pnpm`)
2. **Docker Desktop**: For container management
3. **Git**: For version control operations
4. **PowerShell**: For advanced text processing (built into Windows 10+)

### Installation

```cmd
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version

# Start Docker Desktop
# (Launch Docker Desktop application)
```

## Troubleshooting

### Common Issues

#### ❌ **"pnpm is not recognized"**

```cmd
# Solution: Install pnpm globally
npm install -g pnpm

# Or add to PATH manually
set PATH=%PATH%;%APPDATA%\npm
```

#### ❌ **"Docker is not running"**

```cmd
# Solution: Start Docker Desktop
# Launch Docker Desktop application
# Wait for "Docker Desktop is running" status
```

#### ❌ **"PowerShell execution policy"**

```cmd
# Solution: Allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### ❌ **"Permission denied"**

```cmd
# Solution: Run as Administrator
# Right-click Command Prompt → "Run as administrator"
```

### Performance Tips

1. **Use SSD**: Scripts perform better on solid-state drives
2. **Close IDEs**: Close VS Code/IntelliJ before running cleanup scripts
3. **Docker Resources**: Ensure Docker has sufficient memory (4GB+ recommended)
4. **Antivirus**: Add project directory to antivirus exclusions

## Migration from Unix Scripts

### Before (Unix)

```bash
./scripts/cleanup.sh
./scripts/setup.sh
./scripts/update-memory-and-changelog.sh
```

### After (Windows)

```cmd
pnpm run cleanup:win
pnpm run setup:dev:win
pnpm run update:memory:win
```

### Manual Execution

```cmd
# Direct script execution
scripts\cleanup.bat
scripts\setup.bat
scripts\update-memory-and-changelog.bat
```

## Development Workflow

### Daily Development

```cmd
# Start development environment
pnpm run dev

# View logs
pnpm run logs

# Stop services
pnpm run stop
```

### Clean Development

```cmd
# Fresh start (Windows)
pnpm run fresh:install:win

# Frontend only (Windows)
pnpm run fresh:frontend:win

# Backend only (Windows)
pnpm run fresh:backend:win

# Cross-platform
pnpm run fresh:install
pnpm run fresh:frontend
pnpm run fresh:backend
```

### Maintenance

```cmd
# Update memory bank (Windows)
pnpm run update:memory:win

# Check for npm references
scripts\check-npm-to-pnpm.bat

# Deep cleanup (Windows)
pnpm run cleanup:deep:win

# Cross-platform
pnpm run update:memory
pnpm run cleanup:deep
```

## Contributing

When modifying Windows scripts:

1. **Test on Windows**: Always test on actual Windows machines
2. **Cross-reference**: Ensure functionality matches Unix equivalents
3. **Error handling**: Add comprehensive error checking
4. **Documentation**: Update this README for any new features
5. **Backwards compatibility**: Maintain existing command-line interfaces

## Support

For issues with Windows scripts:

1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Run scripts with administrator privileges if needed
4. Check Windows Event Viewer for system errors
5. Ensure Docker Desktop is running and healthy

---

**Note**: These Windows scripts provide the same functionality as the Unix shell scripts, ensuring consistent development experience across platforms.
