#!/bin/bash

# PixelBoard Update Script
# Use this script to update your application on EC2

set -e

echo "🔄 Updating PixelBoard application..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Navigate to project directory
cd ~/pixelboard

# Pull latest changes (if using Git)
if [ -d ".git" ]; then
    print_status "Pulling latest changes from Git..."
    git pull
else
    print_warning "Not a Git repository. Please upload your updated files manually."
fi

# Install/update dependencies
print_status "Installing dependencies..."
npm install --production

# Restart application
print_status "Restarting application..."
pm2 restart pixelboard

# Show status
print_status "Application updated successfully!"
pm2 status

print_status "View logs with: pm2 logs pixelboard"
