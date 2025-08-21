#!/bin/bash

# =============================================================================
# Auto Memory Bank & Changelog Update Script
# =============================================================================
# This script automatically updates the memory bank and changelog before push
# It analyzes git changes and updates project documentation accordingly
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MEMORY_BANK_DIR="memory-bank"
CHANGELOG_FILE="CHANGELOG.md"
TEMP_DIR="/tmp/logistics-update-$$"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create temp directory
mkdir -p "$TEMP_DIR"

# Function to get current timestamp
get_timestamp() {
    date '+%B %d, %Y'
}

# Function to get git changes since last push
get_git_changes() {
    log_info "Analyzing git changes..."
    
    # Get the remote branch
    REMOTE_BRANCH=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "origin/master")
    
    # Get changes since last push (or all changes if no remote)
    if git rev-parse "$REMOTE_BRANCH" >/dev/null 2>&1; then
        CHANGES=$(git log --oneline "$REMOTE_BRANCH"..HEAD 2>/dev/null || git log --oneline -10)
    else
        CHANGES=$(git log --oneline -10)
    fi
    
    # Get modified files
    MODIFIED_FILES=$(git diff --name-only "$REMOTE_BRANCH"..HEAD 2>/dev/null || git diff --name-only --cached)
    
    echo "$CHANGES" > "$TEMP_DIR/git_changes.txt"
    echo "$MODIFIED_FILES" > "$TEMP_DIR/modified_files.txt"
    
    log_success "Git changes analyzed"
}

# Function to categorize changes
categorize_changes() {
    log_info "Categorizing changes..."
    
    # Initialize categories
    BACKEND_CHANGES=""
    FRONTEND_CHANGES=""
    DOCS_CHANGES=""
    CONFIG_CHANGES=""
    SCRIPT_CHANGES=""
    
    while IFS= read -r file; do
        if [[ "$file" =~ ^backend/ ]]; then
            BACKEND_CHANGES="$BACKEND_CHANGES\n- $file"
        elif [[ "$file" =~ ^frontend/ ]]; then
            FRONTEND_CHANGES="$FRONTEND_CHANGES\n- $file"
        elif [[ "$file" =~ ^docs/|^memory-bank/|\.md$ ]]; then
            DOCS_CHANGES="$DOCS_CHANGES\n- $file"
        elif [[ "$file" =~ ^scripts/|docker-compose|\.json$|\.yml$|\.yaml$ ]]; then
            CONFIG_CHANGES="$CONFIG_CHANGES\n- $file"
        fi
    done < "$TEMP_DIR/modified_files.txt"
    
    log_success "Changes categorized"
}

# Function to update activeContext.md
update_active_context() {
    log_info "Updating activeContext.md..."
    
    local ACTIVE_CONTEXT_FILE="$MEMORY_BANK_DIR/activeContext.md"
    local TIMESTAMP=$(get_timestamp)
    
    # Create backup
    cp "$ACTIVE_CONTEXT_FILE" "$TEMP_DIR/activeContext_backup.md"
    
    # Read current content
    local CURRENT_CONTENT=$(cat "$ACTIVE_CONTEXT_FILE")
    
    # Generate update section
    cat > "$TEMP_DIR/context_update.md" << EOF

## Recent Changes - $TIMESTAMP

### Git Commit Summary
$(cat "$TEMP_DIR/git_changes.txt")

### Modified Areas
EOF

    if [[ -n "$BACKEND_CHANGES" ]]; then
        echo -e "\n**Backend Services:**$BACKEND_CHANGES" >> "$TEMP_DIR/context_update.md"
    fi
    
    if [[ -n "$FRONTEND_CHANGES" ]]; then
        echo -e "\n**Frontend:**$FRONTEND_CHANGES" >> "$TEMP_DIR/context_update.md"
    fi
    
    if [[ -n "$DOCS_CHANGES" ]]; then
        echo -e "\n**Documentation:**$DOCS_CHANGES" >> "$TEMP_DIR/context_update.md"
    fi
    
    if [[ -n "$CONFIG_CHANGES" ]]; then
        echo -e "\n**Configuration:**$CONFIG_CHANGES" >> "$TEMP_DIR/context_update.md"
    fi
    
    # Insert update at the top of the file (after the header)
    awk '
        /^# / && !header_found { 
            print $0; 
            getline; 
            print $0; 
            while ((getline line < "'"$TEMP_DIR"'/context_update.md") > 0) print line; 
            close("'"$TEMP_DIR"'/context_update.md"); 
            header_found=1; 
            next 
        } 
        { print }
    ' "$ACTIVE_CONTEXT_FILE" > "$TEMP_DIR/activeContext_new.md"
    
    # Replace original file
    cp "$TEMP_DIR/activeContext_new.md" "$ACTIVE_CONTEXT_FILE"
    
    log_success "activeContext.md updated"
}

# Function to update progress.md
update_progress() {
    log_info "Updating progress.md..."
    
    local PROGRESS_FILE="$MEMORY_BANK_DIR/progress.md"
    local TIMESTAMP=$(get_timestamp)
    
    # Create backup
    cp "$PROGRESS_FILE" "$TEMP_DIR/progress_backup.md"
    
    # Generate progress entry to temp file
    cat > "$TEMP_DIR/progress_entry.md" << EOF

## Progress Update - $TIMESTAMP

### Recent Commits
$(head -5 "$TEMP_DIR/git_changes.txt")

### Development Activity
- Files modified: $(wc -l < "$TEMP_DIR/modified_files.txt")
- Backend changes: $(echo -e "$BACKEND_CHANGES" | grep -c "^-" || echo "0")
- Frontend changes: $(echo -e "$FRONTEND_CHANGES" | grep -c "^-" || echo "0")
- Documentation updates: $(echo -e "$DOCS_CHANGES" | grep -c "^-" || echo "0")

---
EOF
    
    # Insert progress entry after the main header
    awk '
        /^# / && !header_found { 
            print $0; 
            while ((getline line < "'"$TEMP_DIR"'/progress_entry.md") > 0) print line; 
            close("'"$TEMP_DIR"'/progress_entry.md"); 
            header_found=1; 
            next 
        } 
        { print }
    ' "$PROGRESS_FILE" > "$TEMP_DIR/progress_new.md"
    
    # Replace original file
    cp "$TEMP_DIR/progress_new.md" "$PROGRESS_FILE"
    
    log_success "progress.md updated"
}

# Function to update CHANGELOG.md
update_changelog() {
    log_info "Updating CHANGELOG.md..."
    
    local TIMESTAMP=$(get_timestamp)
    
    # Create backup
    cp "$CHANGELOG_FILE" "$TEMP_DIR/changelog_backup.md"
    
    # Generate changelog entry
    cat > "$TEMP_DIR/changelog_entry.md" << EOF

### $TIMESTAMP

#### Changes
$(cat "$TEMP_DIR/git_changes.txt" | sed 's/^/- /')

#### Files Modified
EOF

    if [[ -n "$BACKEND_CHANGES" ]]; then
        echo -e "\n**Backend:**$BACKEND_CHANGES" >> "$TEMP_DIR/changelog_entry.md"
    fi
    
    if [[ -n "$FRONTEND_CHANGES" ]]; then
        echo -e "\n**Frontend:**$FRONTEND_CHANGES" >> "$TEMP_DIR/changelog_entry.md"
    fi
    
    if [[ -n "$DOCS_CHANGES" ]]; then
        echo -e "\n**Documentation:**$DOCS_CHANGES" >> "$TEMP_DIR/changelog_entry.md"
    fi
    
    if [[ -n "$CONFIG_CHANGES" ]]; then
        echo -e "\n**Configuration:**$CONFIG_CHANGES" >> "$TEMP_DIR/changelog_entry.md"
    fi
    
    # Insert changelog entry under [Unreleased]
    awk '
        /^\[Unreleased\]/ { 
            print $0; 
            while ((getline line < "'"$TEMP_DIR"'/changelog_entry.md") > 0) print line; 
            close("'"$TEMP_DIR"'/changelog_entry.md"); 
            next 
        } 
        { print }
    ' "$CHANGELOG_FILE" > "$TEMP_DIR/changelog_new.md"
    
    # Replace original file
    cp "$TEMP_DIR/changelog_new.md" "$CHANGELOG_FILE"
    
    log_success "CHANGELOG.md updated"
}

# Function to commit memory bank updates
commit_updates() {
    log_info "Committing memory bank and changelog updates..."
    
    # Add updated files to git
    git add "$MEMORY_BANK_DIR/activeContext.md"
    git add "$MEMORY_BANK_DIR/progress.md"
    git add "$CHANGELOG_FILE"
    
    # Check if there are changes to commit
    if git diff --cached --quiet; then
        log_warning "No changes to commit in memory bank or changelog"
        return 0
    fi
    
    # Commit the updates
    git commit -m "docs: auto-update memory bank and changelog

- Updated activeContext.md with recent changes
- Updated progress.md with development activity
- Updated CHANGELOG.md with commit history

[skip ci]" || {
        log_warning "Failed to commit updates (may be no changes)"
        return 0
    }
    
    log_success "Memory bank and changelog updates committed"
}

# Main execution
main() {
    log_info "🚀 Starting automatic memory bank and changelog update..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    # Check if memory bank directory exists
    if [[ ! -d "$MEMORY_BANK_DIR" ]]; then
        log_error "Memory bank directory not found: $MEMORY_BANK_DIR"
        exit 1
    fi
    
    # Check if changelog exists
    if [[ ! -f "$CHANGELOG_FILE" ]]; then
        log_error "Changelog file not found: $CHANGELOG_FILE"
        exit 1
    fi
    
    # Execute update process
    get_git_changes
    categorize_changes
    update_active_context
    update_progress
    update_changelog
    commit_updates
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    log_success "🎉 Memory bank and changelog update completed!"
    echo ""
    log_info "📝 Updated files:"
    log_info "   - $MEMORY_BANK_DIR/activeContext.md"
    log_info "   - $MEMORY_BANK_DIR/progress.md"
    log_info "   - $CHANGELOG_FILE"
    echo ""
}

# Run main function
main "$@"
