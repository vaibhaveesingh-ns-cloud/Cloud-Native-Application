# PixelBoard Cloud-Native Application - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [AWS Services Integration](#aws-services-integration)
4. [Deployment Guide](#deployment-guide)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [API Documentation](#api-documentation)
7. [Monitoring & Logging](#monitoring--logging)
8. [Security](#security)
9. [Troubleshooting](#troubleshooting)
10. [Cost Optimization](#cost-optimization)

## Overview

PixelBoard is a cloud-native image-sharing platform built with modern web technologies and AWS services. It provides secure user authentication, photo uploads with automatic thumbnail generation, album management, and real-time analytics.

### Key Features
- **User Authentication**: JWT-based secure authentication
- **Cloud Storage**: AWS S3 for scalable file storage
- **Image Processing**: AWS Lambda for serverless thumbnail generation
- **Session Management**: DynamoDB for distributed session storage
- **Real-time Analytics**: User activity tracking
- **Auto-scaling**: Cloud-native architecture for high availability
- **CI/CD Pipeline**: Automated deployment with GitHub Actions

### Technology Stack
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas (primary), DynamoDB (sessions)
- **Storage**: AWS S3
- **Processing**: AWS Lambda
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Infrastructure**: AWS EC2, CloudFormation
- **CI/CD**: GitHub Actions
- **Process Management**: PM2
- **Web Server**: Nginx (reverse proxy)

## Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Users/Web     │    │   Load Balancer │    │   EC2 Instance  │
│   Browsers      │◄──►│   (Nginx)       │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────┐            │
                       │   MongoDB       │◄───────────┤
                       │   Atlas         │            │
                       └─────────────────┘            │
                                                       │
┌─────────────────┐    ┌─────────────────┐            │
│   AWS S3        │◄──►│   AWS Lambda    │◄───────────┤
│   (File Storage)│    │   (Processing)  │            │
└─────────────────┘    └─────────────────┘            │
                                                       │
                       ┌─────────────────┐            │
                       │   DynamoDB      │◄───────────┘
                       │   (Sessions)    │
                       └─────────────────┘
```

### Component Breakdown

#### 1. Frontend Layer
- **Technology**: Vanilla JavaScript, HTML5, CSS3
- **Hosting**: Served statically from EC2 via Nginx
- **Features**: Responsive design, file upload, image gallery

#### 2. Application Layer
- **Technology**: Node.js with Express.js framework
- **Hosting**: AWS EC2 with PM2 process management
- **Features**: RESTful API, authentication, file handling

#### 3. Storage Layer
- **Primary Database**: MongoDB Atlas (user data, photos metadata)
- **Session Storage**: DynamoDB (distributed sessions)
- **File Storage**: AWS S3 (images and thumbnails)

#### 4. Processing Layer
- **Image Processing**: AWS Lambda with Sharp library
- **Thumbnail Generation**: Automatic via S3 triggers
- **Background Jobs**: Serverless processing

## AWS Services Integration

### 1. Amazon S3 (Simple Storage Service)
**Purpose**: Store uploaded images and generated thumbnails

**Configuration**:
- Bucket: `pixelboard-uploads-{environment}-{account-id}`
- CORS enabled for web uploads
- Lifecycle policies for cost optimization
- Event notifications to trigger Lambda

**Key Features**:
- Direct uploads from frontend
- Automatic thumbnail storage
- Secure signed URLs for access
- Versioning and backup capabilities

### 2. AWS Lambda
**Purpose**: Serverless image processing and thumbnail generation

**Function Details**:
- Runtime: Node.js 18.x
- Memory: 1024 MB
- Timeout: 300 seconds
- Trigger: S3 object creation events

**Processing Capabilities**:
- Thumbnail generation (300x300px)
- Image format conversion
- Quality optimization
- Metadata extraction

### 3. Amazon DynamoDB
**Purpose**: Session storage and user activity tracking

**Tables**:
1. **Sessions Table**
   - Primary Key: `sessionId`
   - TTL enabled for automatic cleanup
   - Pay-per-request billing

2. **User Activity Table**
   - Primary Key: `activityId`
   - GSI: `userId` for user-specific queries
   - TTL: 30 days retention

### 4. Amazon EC2
**Purpose**: Host the Node.js application

**Instance Configuration**:
- Type: t3.small (production) / t2.micro (development)
- OS: Ubuntu 22.04 LTS
- Security Groups: HTTP, HTTPS, SSH access
- IAM Role: Access to S3, DynamoDB, Lambda

### 5. AWS CloudFormation
**Purpose**: Infrastructure as Code (IaC)

**Resources Managed**:
- VPC and networking components
- EC2 instances and security groups
- S3 buckets and policies
- DynamoDB tables
- Lambda functions and permissions
- IAM roles and policies

## Deployment Guide

### Prerequisites
1. AWS Account with appropriate permissions
2. Domain name (optional but recommended)
3. MongoDB Atlas account
4. GitHub repository access
5. SSH key pair for EC2 access

### Step 1: Infrastructure Deployment
```bash
# Deploy CloudFormation stack
aws cloudformation create-stack \
  --stack-name pixelboard-production \
  --template-body file://infrastructure/cloudformation.yml \
  --parameters ParameterKey=Environment,ParameterValue=production \
               ParameterKey=KeyPairName,ParameterValue=your-key-pair \
  --capabilities CAPABILITY_NAMED_IAM
```

### Step 2: Application Deployment
```bash
# SSH to EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Clone repository
git clone https://github.com/yourusername/pixelboard.git
cd pixelboard

# Configure environment
cp .env.production .env
# Edit .env with your actual values

# Run deployment script
./deploy.sh
```

### Step 3: Lambda Function Deployment
```bash
# Deploy Lambda function
cd lambda
zip -r ../image-processor.zip .
aws lambda update-function-code \
  --function-name pixelboard-image-processor-production \
  --zip-file fileb://../image-processor.zip
```

### Step 4: DNS and SSL Configuration
```bash
# Update DNS to point to EC2 IP
# Configure SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

## CI/CD Pipeline

### GitHub Actions Workflow
The CI/CD pipeline automatically:
1. **Tests**: Runs unit tests and linting
2. **Security**: Performs security scans
3. **Build**: Creates deployment artifacts
4. **Deploy**: Deploys to staging/production environments

### Pipeline Stages

#### 1. Test Stage
- Unit tests with Jest
- Code linting with ESLint
- Security audit with npm audit
- Coverage reporting

#### 2. Build Stage
- Install production dependencies
- Create Lambda deployment package
- Generate build artifacts

#### 3. Deploy Stage
- Deploy Lambda functions
- Update EC2 application
- Run health checks
- Send notifications

### Environment Configuration
**Required Secrets**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `STAGING_HOST`, `STAGING_USERNAME`, `STAGING_SSH_KEY`
- `PRODUCTION_HOST`, `PRODUCTION_USERNAME`, `PRODUCTION_SSH_KEY`
- `SLACK_WEBHOOK_URL` (optional)

## API Documentation

### Authentication Endpoints
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Photo Management Endpoints
```
POST   /api/photos/upload
GET    /api/photos/all
GET    /api/photos/my-photos
GET    /api/photos/:id
DELETE /api/photos/:id
POST   /api/photos/:id/reprocess
```

### Album Management Endpoints
```
POST   /api/albums/create
GET    /api/albums/all
GET    /api/albums/my-albums
GET    /api/albums/:id
POST   /api/albums/:id/add-photos
POST   /api/albums/:id/remove-photos
DELETE /api/albums/:id
```

### System Endpoints
```
GET /health
GET /api
```

### Request/Response Examples

#### Upload Photo
```bash
curl -X POST http://your-domain/api/photos/upload \
  -H "Authorization: Bearer your-jwt-token" \
  -F "photo=@image.jpg" \
  -F "title=My Photo" \
  -F "description=A beautiful sunset"
```

Response:
```json
{
  "message": "Photo uploaded successfully",
  "photo": {
    "id": "64f8a1b2c3d4e5f6g7h8i9j0",
    "title": "My Photo",
    "description": "A beautiful sunset",
    "s3Location": "https://bucket.s3.region.amazonaws.com/photos/123456-uuid.jpg",
    "thumbnailS3Key": "photos/thumbnails/thumb_123456-uuid.jpg",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Monitoring & Logging

### Application Monitoring
- **PM2 Monitoring**: Process health and resource usage
- **Nginx Logs**: Access and error logs
- **Application Logs**: Custom logging with Winston (recommended)

### AWS CloudWatch Integration
```javascript
// Add to your application for CloudWatch metrics
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

// Custom metrics
const putMetric = async (metricName, value, unit = 'Count') => {
  const params = {
    Namespace: 'PixelBoard/Application',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date()
    }]
  };
  
  await cloudwatch.putMetricData(params).promise();
};
```

### Key Metrics to Monitor
- **Application**: Response time, error rate, throughput
- **Infrastructure**: CPU, memory, disk usage
- **AWS Services**: S3 requests, Lambda invocations, DynamoDB consumption
- **Business**: User registrations, photo uploads, active users

### Log Aggregation
```bash
# Centralized logging with CloudWatch Logs Agent
sudo wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm

# Configure log collection
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

## Security

### Authentication & Authorization
- **JWT Tokens**: Secure user authentication
- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: Secure session storage in DynamoDB
- **CORS Configuration**: Restricted origins in production

### AWS Security Best Practices
- **IAM Roles**: Least privilege access
- **Security Groups**: Restricted network access
- **S3 Bucket Policies**: Secure file access
- **VPC**: Network isolation
- **SSL/TLS**: HTTPS encryption

### Data Protection
- **Encryption at Rest**: S3 and DynamoDB encryption
- **Encryption in Transit**: HTTPS/TLS
- **Input Validation**: Express-validator middleware
- **File Type Validation**: Multer file filtering
- **Rate Limiting**: Express-rate-limit (recommended)

### Security Headers
```javascript
// Add security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

## Troubleshooting

### Common Issues

#### 1. File Upload Failures
**Symptoms**: 500 errors on photo upload
**Causes**: 
- S3 permissions issues
- Lambda function errors
- Network connectivity

**Solutions**:
```bash
# Check S3 access
aws s3 ls s3://your-bucket-name

# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/pixelboard

# Test Lambda function
aws lambda invoke --function-name pixelboard-image-processor test-output.json
```

#### 2. Session Storage Issues
**Symptoms**: Users getting logged out frequently
**Causes**:
- DynamoDB connectivity issues
- Session configuration problems

**Solutions**:
```bash
# Check DynamoDB table
aws dynamodb describe-table --table-name pixelboard-sessions-production

# Test DynamoDB access
aws dynamodb scan --table-name pixelboard-sessions-production --limit 1
```

#### 3. Application Performance Issues
**Symptoms**: Slow response times, high CPU usage
**Solutions**:
```bash
# Monitor PM2 processes
pm2 monit

# Check system resources
htop
df -h

# Analyze Nginx logs
sudo tail -f /var/log/nginx/access.log | grep -E "HTTP/[0-9.]+ [45][0-9][0-9]"
```

### Debugging Commands
```bash
# Application logs
pm2 logs pixelboard --lines 100

# System logs
sudo journalctl -u nginx -f
sudo tail -f /var/log/syslog

# AWS CLI debugging
aws s3 ls --debug
aws lambda invoke --function-name test --payload '{}' output.json --debug
```

## Cost Optimization

### AWS Cost Management

#### 1. S3 Storage Optimization
- **Lifecycle Policies**: Move old files to cheaper storage classes
- **Intelligent Tiering**: Automatic cost optimization
- **Compression**: Optimize image sizes

```json
{
  "Rules": [{
    "ID": "PixelBoardLifecycle",
    "Status": "Enabled",
    "Transitions": [{
      "Days": 30,
      "StorageClass": "STANDARD_IA"
    }, {
      "Days": 90,
      "StorageClass": "GLACIER"
    }]
  }]
}
```

#### 2. DynamoDB Optimization
- **On-Demand Billing**: Pay per request
- **TTL**: Automatic data expiration
- **Query Optimization**: Use GSI efficiently

#### 3. Lambda Optimization
- **Memory Allocation**: Right-size memory for performance/cost
- **Execution Time**: Optimize code for faster execution
- **Concurrent Executions**: Monitor and adjust limits

#### 4. EC2 Optimization
- **Instance Types**: Use appropriate instance sizes
- **Reserved Instances**: Long-term cost savings
- **Auto Scaling**: Scale based on demand
- **Spot Instances**: For non-critical workloads

### Monitoring Costs
```bash
# AWS Cost Explorer CLI
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

### Cost Alerts
Set up AWS Budgets to monitor spending:
- Monthly budget alerts
- Service-specific budgets
- Anomaly detection

## Maintenance & Updates

### Regular Maintenance Tasks
1. **Security Updates**: Keep dependencies updated
2. **Log Rotation**: Manage log file sizes
3. **Database Maintenance**: Monitor MongoDB performance
4. **SSL Certificate Renewal**: Automated with certbot
5. **Backup Verification**: Test restore procedures

### Update Procedures
```bash
# Application updates
git pull origin main
npm install --production
pm2 restart pixelboard

# System updates
sudo apt update && sudo apt upgrade -y
sudo reboot  # if kernel updates
```

### Backup Strategy
- **Database**: MongoDB Atlas automated backups
- **Files**: S3 versioning and cross-region replication
- **Configuration**: Version control for all configs
- **Infrastructure**: CloudFormation templates in Git

---

## Support & Contact

For technical support or questions:
- **Documentation**: This guide and inline code comments
- **Issues**: GitHub Issues for bug reports
- **Monitoring**: CloudWatch dashboards and alerts
- **Logs**: Centralized logging for troubleshooting

---

*Last Updated: 2024-01-15*
*Version: 1.0.0*
