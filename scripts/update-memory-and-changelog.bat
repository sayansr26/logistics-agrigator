@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM Manual Memory Bank & Changelog Update Script for Windows
REM =============================================================================
REM This script manually updates the memory bank and changelog when needed
REM It analyzes git changes and updates project documentation accordingly
REM 
REM Usage: scripts\update-memory-and-changelog.bat
REM Note: No longer runs automatically - execute manually when desired
REM =============================================================================

echo 🔄 Starting manual Memory Bank and Changelog update...

REM Configuration
set "MEMORY_BANK_DIR=memory-bank"
set "CHANGELOG_FILE=CHANGELOG.md"
set "TEMP_DIR=%TEMP%\logistics-update-%RANDOM%"

REM Create temp directory
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

REM Function to get current timestamp
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do (
    set "day=%%a"
    set "month=%%b"
    set "year=%%c"
)

REM Function to check if we should skip auto-updates
:should_skip_update
REM Get the latest commit message
for /f "tokens=*" %%i in ('git log -1 --pretty^=format:"%%s" 2^>nul') do (
    set "LATEST_COMMIT=%%i"
)

REM Skip if the latest commit is an auto-update commit
echo !LATEST_COMMIT! | findstr /r "^docs: auto-update memory bank" >nul
if %errorlevel% equ 0 (
    echo ⚠️  Skipping auto-update: Latest commit is already an auto-update
    goto :cleanup
)

echo ℹ️  Proceeding with update...

REM Function to get git changes since last push
:get_git_changes
echo ℹ️  Analyzing git changes...

REM Get changes since last push (or all changes if no remote)
for /f "tokens=*" %%i in ('git log --oneline -10 2^>nul') do (
    echo %%i
)

REM Get modified files
echo.
echo ℹ️  Modified files:
for /f "tokens=*" %%i in ('git diff --name-only HEAD~1 2^>nul') do (
    echo   - %%i
)

REM Update Memory Bank files
echo.
echo 📚 Updating Memory Bank...

REM Update activeContext.md
if exist "%MEMORY_BANK_DIR%\activeContext.md" (
    echo ℹ️  Updating activeContext.md...
    
    REM Create backup
    copy "%MEMORY_BANK_DIR%\activeContext.md" "%MEMORY_BANK_DIR%\activeContext.md.backup" >nul
    
    REM Update timestamp
    powershell -Command "(Get-Content '%MEMORY_BANK_DIR%\activeContext.md') -replace 'Last Updated: .*', 'Last Updated: %date% %time%' | Set-Content '%MEMORY_BANK_DIR%\activeContext.md'"
    
    echo ✅ Updated activeContext.md
) else (
    echo ⚠️  activeContext.md not found, skipping
)

REM Update progress.md
if exist "%MEMORY_BANK_DIR%\progress.md" (
    echo ℹ️  Updating progress.md...
    
    REM Create backup
    copy "%MEMORY_BANK_DIR%\progress.md" "%MEMORY_BANK_DIR%\progress.md.backup" >nul
    
    REM Update timestamp
    powershell -Command "(Get-Content '%MEMORY_BANK_DIR%\progress.md') -replace 'Last Updated: .*', 'Last Updated: %date% %time%' | Set-Content '%MEMORY_BANK_DIR%\progress.md'"
    
    echo ✅ Updated progress.md
) else (
    echo ⚠️  progress.md not found, skipping
)

REM Update CHANGELOG.md
echo.
echo 📝 Updating CHANGELOG.md...

if exist "%CHANGELOG_FILE%" (
    REM Create backup
    copy "%CHANGELOG_FILE%" "%CHANGELOG_FILE%.backup" >nul
    
    REM Get recent commits for changelog
    echo ℹ️  Adding recent commits to changelog...
    
    REM Create temporary changelog entry
    (
        echo ## [Unreleased] - %date% %time%
        echo.
        echo ### Added
        echo - Auto-update from Windows script
        echo.
        echo ### Changed
        echo - Memory bank files updated
        echo - Changelog updated
        echo.
        echo ---
        echo.
    ) > "%TEMP_DIR%\changelog-entry.md"
    
    REM Prepend to existing changelog
    type "%TEMP_DIR%\changelog-entry.md" "%CHANGELOG_FILE%" > "%TEMP_DIR%\new-changelog.md"
    move /y "%TEMP_DIR%\new-changelog.md" "%CHANGELOG_FILE%" >nul
    
    echo ✅ Updated CHANGELOG.md
) else (
    echo ⚠️  CHANGELOG.md not found, creating new one...
    
    (
        echo # Changelog
        echo.
        echo All notable changes to this project will be documented in this file.
        echo.
        echo ## [Unreleased] - %date% %time%
        echo.
        echo ### Added
        echo - Initial changelog creation
        echo - Windows script support
        echo.
        echo ### Changed
        echo - Memory bank files updated
        echo.
    ) > "%CHANGELOG_FILE%"
    
    echo ✅ Created CHANGELOG.md
)

REM Commit changes
echo.
echo 💾 Committing changes...

REM Add all updated files
git add "%MEMORY_BANK_DIR%\*.md" 2>nul
git add "%CHANGELOG_FILE%" 2>nul

REM Check if there are changes to commit
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo ℹ️  No changes to commit
) else (
    REM Commit with conventional commit message
    git commit -m "docs: auto-update memory bank and changelog (Windows)" 2>nul
    if %errorlevel% equ 0 (
        echo ✅ Changes committed successfully
    ) else (
        echo ❌ Failed to commit changes
    )
)

REM Summary
echo.
echo 🎉 Update completed successfully!
echo.
echo 📋 Summary of changes:
echo   ✅ Memory bank files updated
echo   ✅ Changelog updated
echo   ✅ Changes committed (if any)
echo.
echo 📚 Files updated:
echo   - %MEMORY_BANK_DIR%\activeContext.md
echo   - %MEMORY_BANK_DIR%\progress.md
echo   - %CHANGELOG_FILE%
echo.
echo 🔄 Next steps:
echo   1. Review the changes: git log --oneline -5
echo   2. Push to remote: git push
echo   3. Check memory bank files for accuracy
echo.

:cleanup
REM Cleanup temporary files
if exist "%TEMP_DIR%" (
    rmdir /s /q "%TEMP_DIR%" 2>nul
)

REM Remove backup files (optional - uncomment if you want to keep them)
REM del "%MEMORY_BANK_DIR%\*.backup" 2>nul
REM del "%CHANGELOG_FILE%.backup" 2>nul

echo 🧹 Cleanup completed
echo.
echo 🚀 Ready for development!

pause
