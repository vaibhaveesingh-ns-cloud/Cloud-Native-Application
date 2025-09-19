# AWS EC2 Deployment Guide for PixelBoard

This guide will walk you through deploying your PixelBoard fullstack application on AWS EC2.

## Prerequisites

- AWS Account with EC2 access
- Domain name (optional but recommended)
- MongoDB Atlas account (for production database)
- SSH key pair for EC2 access

## Step 1: Set up MongoDB Atlas (Production Database)

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Sign up for a free account
   - Create a new cluster (M0 Sandbox is free)

2. **Configure Database Access**
   - Go to Database Access → Add New Database User
   - Create a user with read/write permissions
   - Note down username and password

3. **Configure Network Access**
   - Go to Network Access → Add IP Address
   - Add `0.0.0.0/0` (allow access from anywhere) for now
   - Later, restrict to your EC2 instance IP for security

4. **Get Connection String**
   - Go to Clusters → Connect → Connect your application
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/pixelboard`)

## Step 2: Launch EC2 Instance

1. **Launch Instance**
   - Go to AWS EC2 Console
   - Click "Launch Instance"
   - Choose **Ubuntu Server 22.04 LTS** (free tier eligible)
   - Instance type: **t2.micro** (free tier) or **t3.small** for better performance
   - Create or select existing key pair for SSH access

2. **Configure Security Group**
   - Allow SSH (port 22) from your IP
   - Allow HTTP (port 80) from anywhere (0.0.0.0/0)
   - Allow HTTPS (port 443) from anywhere (0.0.0.0/0)
   - Allow Custom TCP (port 3000) from anywhere for initial testing

3. **Launch and Note Public IP**
   - Launch the instance
   - Note down the public IP address

## Step 3: Connect to EC2 Instance

```bash
# Replace with your key file and public IP
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

## Step 4: Set up Server Environment

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource repository for latest LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional tools
sudo apt install -y git nginx certbot python3-certbot-nginx

# Verify installations
node --version
npm --version
```

## Step 5: Deploy Your Application

1. **Clone or Upload Your Code**
   
   Option A - Using Git (recommended):
   ```bash
   # If your code is in a Git repository
   git clone https://github.com/yourusername/pixelboard.git
   cd pixelboard
   ```
   
   Option B - Upload files using SCP:
   ```bash
   # From your local machine
   scp -i your-key.pem -r /path/to/your/project ubuntu@your-ec2-ip:~/pixelboard
   ```

2. **Install Dependencies**
   ```bash
   cd ~/pixelboard
   npm install --production
   ```

3. **Set up Production Environment**
   ```bash
   # Create production .env file
   cp .env .env.production
   nano .env.production
   ```

## Step 6: Configure Production Environment

Update your `.env.production` file with production values:

```env
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pixelboard
JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production
NODE_ENV=production
```

## Step 7: Set up Process Manager (PM2)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your application with PM2
pm2 start server.js --name "pixelboard" --env production

# Set PM2 to start on system boot
pm2 startup
pm2 save
```

## Step 8: Configure Nginx Reverse Proxy

1. **Create Nginx Configuration**
   ```bash
   sudo nano /etc/nginx/sites-available/pixelboard
   ```

2. **Add Configuration** (see nginx.conf file)

3. **Enable Site**
   ```bash
   sudo ln -s /etc/nginx/sites-available/pixelboard /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Step 9: Set up SSL Certificate (Optional but Recommended)

If you have a domain name:

```bash
# Replace yourdomain.com with your actual domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Step 10: Configure Firewall

```bash
# Enable UFW firewall
sudo ufw enable

# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

## Step 11: Final Testing

1. **Test Application**
   - Visit `http://your-ec2-public-ip` or your domain
   - Test user registration and login
   - Test photo upload functionality

2. **Monitor Logs**
   ```bash
   # View PM2 logs
   pm2 logs pixelboard
   
   # View Nginx logs
   sudo tail -f /var/log/nginx/access.log
   sudo tail -f /var/log/nginx/error.log
   ```

## Maintenance Commands

```bash
# Restart application
pm2 restart pixelboard

# View application status
pm2 status

# Update application (if using Git)
cd ~/pixelboard
git pull
npm install --production
pm2 restart pixelboard

# View system resources
pm2 monit
```

## Security Best Practices

1. **Restrict MongoDB Access**
   - In MongoDB Atlas, replace `0.0.0.0/0` with your EC2 instance's IP

2. **Update Security Group**
   - Remove port 3000 access once Nginx is working
   - Restrict SSH access to your IP only

3. **Regular Updates**
   ```bash
   sudo apt update && sudo apt upgrade -y
   pm2 update
   ```

4. **Backup Strategy**
   - Set up MongoDB Atlas automated backups
   - Consider backing up uploaded files to S3

## Troubleshooting

- **Application won't start**: Check PM2 logs with `pm2 logs pixelboard`
- **502 Bad Gateway**: Check if application is running on port 3000
- **File upload issues**: Ensure uploads directory has proper permissions
- **Database connection**: Verify MongoDB Atlas connection string and network access

## Cost Optimization

- Use **t2.micro** instance (free tier for 12 months)
- MongoDB Atlas M0 cluster is free
- Consider using CloudFront CDN for static assets
- Set up CloudWatch alarms for monitoring

Your PixelBoard application should now be live and accessible via your EC2 instance's public IP or domain name!
