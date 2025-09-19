#!/bin/bash

# PixelBoard Infrastructure Setup Script
# This script deploys the complete AWS infrastructure using CloudFormation

set -e

echo "🏗️  Setting up PixelBoard Cloud Infrastructure..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
STACK_NAME="pixelboard-infrastructure"
ENVIRONMENT="production"
REGION="us-east-1"
KEY_PAIR_NAME=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --key-pair)
            KEY_PAIR_NAME="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --stack-name NAME    CloudFormation stack name (default: pixelboard-infrastructure)"
            echo "  --environment ENV    Environment name (default: production)"
            echo "  --region REGION      AWS region (default: us-east-1)"
            echo "  --key-pair NAME      EC2 key pair name (required)"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$KEY_PAIR_NAME" ]; then
    print_error "Key pair name is required. Use --key-pair option."
    exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
print_status "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_status "Using AWS Account: $ACCOUNT_ID"

# Set AWS region
export AWS_DEFAULT_REGION=$REGION
print_status "Using AWS Region: $REGION"

# Check if key pair exists
print_status "Checking EC2 key pair..."
if ! aws ec2 describe-key-pairs --key-names "$KEY_PAIR_NAME" &> /dev/null; then
    print_error "Key pair '$KEY_PAIR_NAME' not found in region $REGION"
    print_status "Available key pairs:"
    aws ec2 describe-key-pairs --query 'KeyPairs[].KeyName' --output table
    exit 1
fi

print_header "Step 1: Validating CloudFormation template"
if aws cloudformation validate-template --template-body file://infrastructure/cloudformation.yml &> /dev/null; then
    print_status "CloudFormation template is valid"
else
    print_error "CloudFormation template validation failed"
    exit 1
fi

print_header "Step 2: Checking if stack exists"
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" &> /dev/null; then
    print_warning "Stack '$STACK_NAME' already exists"
    read -p "Do you want to update it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ACTION="update"
    else
        print_status "Skipping stack deployment"
        exit 0
    fi
else
    ACTION="create"
fi

print_header "Step 3: ${ACTION^}ing CloudFormation stack"
PARAMETERS="ParameterKey=Environment,ParameterValue=$ENVIRONMENT ParameterKey=KeyPairName,ParameterValue=$KEY_PAIR_NAME"

if [ "$ACTION" = "create" ]; then
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://infrastructure/cloudformation.yml \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM \
        --tags Key=Environment,Value=$ENVIRONMENT Key=Application,Value=PixelBoard
    
    print_status "Stack creation initiated. Waiting for completion..."
    aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME"
else
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://infrastructure/cloudformation.yml \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM
    
    print_status "Stack update initiated. Waiting for completion..."
    aws cloudformation wait stack-update-complete --stack-name "$STACK_NAME"
fi

print_header "Step 4: Retrieving stack outputs"
OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs')

# Extract important values
S3_BUCKET=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="S3BucketName") | .OutputValue')
SESSIONS_TABLE=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="SessionsTableName") | .OutputValue')
ACTIVITY_TABLE=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="UserActivityTableName") | .OutputValue')
LAMBDA_FUNCTION=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="LambdaFunctionName") | .OutputValue')
EC2_INSTANCE=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="EC2InstanceId") | .OutputValue')
EC2_PUBLIC_IP=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="EC2PublicIP") | .OutputValue')
APP_URL=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ApplicationURL") | .OutputValue')

print_header "Step 5: Updating environment configuration"
# Create/update .env.production with actual values
cat > .env.production << EOF
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pixelboard
JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production-min-32-chars
SESSION_SECRET=your-super-secure-session-secret-change-this-in-production
NODE_ENV=production

# AWS Configuration
AWS_REGION=$REGION
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key

# S3 Configuration
S3_BUCKET_NAME=$S3_BUCKET

# DynamoDB Configuration
DYNAMODB_SESSION_TABLE=$SESSIONS_TABLE
DYNAMODB_USER_ACTIVITY_TABLE=$ACTIVITY_TABLE

# Lambda Configuration
LAMBDA_IMAGE_PROCESSOR=$LAMBDA_FUNCTION

# Optional: Frontend URL for CORS
FRONTEND_URL=https://yourdomain.com
EOF

print_status "Environment configuration updated"

print_header "Step 6: Deploying Lambda function"
cd lambda
if [ ! -f "package.json" ]; then
    print_error "Lambda package.json not found"
    exit 1
fi

npm install --production
zip -r ../image-processor.zip .
cd ..

aws lambda update-function-code \
    --function-name "$LAMBDA_FUNCTION" \
    --zip-file fileb://image-processor.zip

print_status "Lambda function deployed"

print_header "Infrastructure Setup Complete! 🎉"
echo ""
print_status "Stack Name: $STACK_NAME"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
echo ""
print_status "Resources Created:"
print_status "  📦 S3 Bucket: $S3_BUCKET"
print_status "  🗄️  Sessions Table: $SESSIONS_TABLE"
print_status "  📊 Activity Table: $ACTIVITY_TABLE"
print_status "  ⚡ Lambda Function: $LAMBDA_FUNCTION"
print_status "  🖥️  EC2 Instance: $EC2_INSTANCE"
print_status "  🌐 Public IP: $EC2_PUBLIC_IP"
print_status "  🔗 Application URL: $APP_URL"
echo ""
print_warning "Next Steps:"
print_warning "1. Update .env.production with your MongoDB URI and AWS credentials"
print_warning "2. SSH to EC2 instance: ssh -i $KEY_PAIR_NAME.pem ubuntu@$EC2_PUBLIC_IP"
print_warning "3. Deploy application: ./deploy.sh"
print_warning "4. Configure domain and SSL certificate"
echo ""
print_status "Useful Commands:"
print_status "  View stack: aws cloudformation describe-stacks --stack-name $STACK_NAME"
print_status "  Delete stack: aws cloudformation delete-stack --stack-name $STACK_NAME"
print_status "  SSH to EC2: ssh -i $KEY_PAIR_NAME.pem ubuntu@$EC2_PUBLIC_IP"
