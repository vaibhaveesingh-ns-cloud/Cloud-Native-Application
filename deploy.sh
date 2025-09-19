#!/bin/bash

# PixelBoard Cloud-Native Deployment Script for AWS EC2
# Run this script on your EC2 instance after uploading your code
# This script sets up the complete cloud-native infrastructure

set -e  # Exit on any error

echo "🚀 Starting PixelBoard Cloud-Native deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    print_status "Node.js already installed: $(node --version)"
fi

# Install additional tools
print_status "Installing additional tools..."
sudo apt install -y git nginx certbot python3-certbot-nginx

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    sudo npm install -g pm2
else
    print_status "PM2 already installed: $(pm2 --version)"
fi

# Navigate to project directory
cd ~/pixelboard || { print_error "Project directory not found. Please ensure code is in ~/pixelboard"; exit 1; }

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install --production

# Create logs directory for PM2
mkdir -p logs

# Create uploads directories if they don't exist
mkdir -p uploads/thumbnails

# Set proper permissions for uploads
chmod 755 uploads
chmod 755 uploads/thumbnails

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_warning ".env.production not found. Creating from template..."
    cp .env .env.production
    print_warning "Please edit .env.production with your production values before continuing!"
    print_warning "Required AWS and production settings:"
    print_warning "  - MONGODB_URI: Your MongoDB Atlas connection string"
    print_warning "  - JWT_SECRET: A secure secret key (min 32 characters)"
    print_warning "  - NODE_ENV: production"
    print_warning "  - AWS_REGION: Your AWS region (e.g., us-east-1)"
    print_warning "  - AWS_ACCESS_KEY_ID: Your AWS access key"
    print_warning "  - AWS_SECRET_ACCESS_KEY: Your AWS secret key"
    print_warning "  - S3_BUCKET_NAME: Your S3 bucket name"
    print_warning "  - DYNAMODB_SESSION_TABLE: Your DynamoDB sessions table"
    print_warning "  - LAMBDA_IMAGE_PROCESSOR: Your Lambda function name"
    read -p "Press Enter after updating .env.production..."
fi

# Start application with PM2
print_status "Starting application with PM2..."
pm2 delete pixelboard 2>/dev/null || true  # Delete if exists
pm2 start ecosystem.config.js --env production

# Set PM2 to start on boot
print_status "Configuring PM2 to start on boot..."
pm2 startup | tail -1 | sudo bash
pm2 save

# Configure Nginx
print_status "Configuring Nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/pixelboard

# Remove default nginx site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Enable our site
sudo ln -sf /etc/nginx/sites-available/pixelboard /etc/nginx/sites-enabled/

# Test nginx configuration
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
    sudo systemctl restart nginx
    sudo systemctl enable nginx
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Configure firewall
print_status "Configuring firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Display status
# Test AWS connectivity
print_status "Testing AWS services connectivity..."
if command -v aws &> /dev/null; then
    aws sts get-caller-identity || print_warning "AWS CLI not configured properly"
    aws s3 ls s3://$S3_BUCKET_NAME 2>/dev/null || print_warning "S3 bucket access issue"
    aws dynamodb describe-table --table-name $DYNAMODB_SESSION_TABLE 2>/dev/null || print_warning "DynamoDB table access issue"
    aws lambda get-function --function-name $LAMBDA_IMAGE_PROCESSOR 2>/dev/null || print_warning "Lambda function access issue"
else
    print_warning "AWS CLI not installed. Installing..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi

print_status "Cloud-Native Deployment completed! 🎉"
echo ""
echo "Application Status:"
pm2 status
echo ""
echo "Nginx Status:"
sudo systemctl status nginx --no-pager -l
echo ""
print_status "Your cloud-native application should now be accessible at:"
print_status "http://$(curl -s http://checkip.amazonaws.com/)"
echo ""
print_status "Cloud Services Status:"
print_status "  ☁️  S3 Bucket: ${S3_BUCKET_NAME:-'Not configured'}"
print_status "  🗄️  DynamoDB Sessions: ${DYNAMODB_SESSION_TABLE:-'Not configured'}"
print_status "  ⚡ Lambda Processor: ${LAMBDA_IMAGE_PROCESSOR:-'Not configured'}"
print_status "  🌐 MongoDB: ${MONGODB_URI:-'Not configured'}"
echo ""
print_warning "Next steps:"
print_warning "1. Update your domain's DNS to point to this server's IP"
print_warning "2. Update nginx.conf with your domain name"
print_warning "3. Set up SSL certificate with: sudo certbot --nginx -d yourdomain.com"
print_warning "4. Restrict MongoDB Atlas access to this server's IP"
print_warning "5. Test file upload functionality with S3"
print_warning "6. Verify Lambda image processing is working"
echo ""
print_status "Useful commands:"
print_status "  View logs: pm2 logs pixelboard"
print_status "  Restart app: pm2 restart pixelboard"
print_status "  Monitor app: pm2 monit"
print_status "  Nginx logs: sudo tail -f /var/log/nginx/error.log"
print_status "  Test health: curl http://localhost:3000/health"
print_status "  AWS CLI: aws s3 ls s3://$S3_BUCKET_NAME"
