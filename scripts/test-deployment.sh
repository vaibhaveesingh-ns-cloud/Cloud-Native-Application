#!/bin/bash

# PixelBoard Deployment Testing Script
# This script tests all components of the cloud-native deployment

set -e

echo "🧪 Testing PixelBoard Cloud-Native Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Configuration
BASE_URL="http://localhost:3000"
if [ ! -z "$1" ]; then
    BASE_URL="$1"
fi

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    print_test "$test_name"
    
    if eval "$test_command" &> /dev/null; then
        print_status "$test_name - PASSED"
        ((TESTS_PASSED++))
        return 0
    else
        print_error "$test_name - FAILED"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "Testing deployment at: $BASE_URL"
echo "=================================="

# Test 1: Health Check
run_test "Health Check Endpoint" "curl -f $BASE_URL/health"

# Test 2: API Info
run_test "API Info Endpoint" "curl -f $BASE_URL/api"

# Test 3: Frontend Loading
run_test "Frontend Loading" "curl -f $BASE_URL/"

# Test 4: Static Assets
run_test "CSS Loading" "curl -f $BASE_URL/styles.css"
run_test "JavaScript Loading" "curl -f $BASE_URL/app.js"

# Test 5: API Endpoints (without auth)
run_test "Get All Photos Endpoint" "curl -f $BASE_URL/api/photos/all"
run_test "Get All Albums Endpoint" "curl -f $BASE_URL/api/albums/all"

# Test 6: AWS Services (if configured)
if [ ! -z "$S3_BUCKET_NAME" ]; then
    run_test "S3 Bucket Access" "aws s3 ls s3://$S3_BUCKET_NAME"
fi

if [ ! -z "$DYNAMODB_SESSION_TABLE" ]; then
    run_test "DynamoDB Sessions Table" "aws dynamodb describe-table --table-name $DYNAMODB_SESSION_TABLE"
fi

if [ ! -z "$LAMBDA_IMAGE_PROCESSOR" ]; then
    run_test "Lambda Function Status" "aws lambda get-function --function-name $LAMBDA_IMAGE_PROCESSOR"
fi

# Test 7: System Resources
print_test "System Resource Check"
if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 jlist | jq -r '.[0].pm2_env.status' 2>/dev/null || echo "unknown")
    if [ "$PM2_STATUS" = "online" ]; then
        print_status "PM2 Process Status - PASSED"
        ((TESTS_PASSED++))
    else
        print_error "PM2 Process Status - FAILED (Status: $PM2_STATUS)"
        ((TESTS_FAILED++))
    fi
else
    print_warning "PM2 not found - skipping process check"
fi

# Test 8: Database Connectivity
print_test "Database Connectivity"
if curl -f "$BASE_URL/health" 2>/dev/null | grep -q "healthy"; then
    print_status "Database Connection - PASSED"
    ((TESTS_PASSED++))
else
    print_error "Database Connection - FAILED"
    ((TESTS_FAILED++))
fi

# Test 9: SSL Certificate (if HTTPS)
if [[ $BASE_URL == https* ]]; then
    run_test "SSL Certificate" "curl -f --ssl-reqd $BASE_URL/health"
fi

# Test 10: Performance Test
print_test "Basic Performance Test"
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$BASE_URL/health" 2>/dev/null || echo "999")
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    print_status "Response Time - PASSED (${RESPONSE_TIME}s)"
    ((TESTS_PASSED++))
else
    print_error "Response Time - FAILED (${RESPONSE_TIME}s > 2.0s)"
    ((TESTS_FAILED++))
fi

echo ""
echo "=================================="
echo "Test Results Summary:"
echo "  ✓ Passed: $TESTS_PASSED"
echo "  ✗ Failed: $TESTS_FAILED"
echo "  Total:  $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    print_status "All tests passed! 🎉"
    echo ""
    echo "Your PixelBoard deployment is working correctly!"
    echo "You can now:"
    echo "  • Register new users"
    echo "  • Upload photos"
    echo "  • Create albums"
    echo "  • Test image processing"
    exit 0
else
    print_error "Some tests failed. Please check the deployment."
    echo ""
    echo "Common issues:"
    echo "  • Check if all services are running"
    echo "  • Verify environment variables"
    echo "  • Check AWS service permissions"
    echo "  • Review application logs: pm2 logs pixelboard"
    exit 1
fi
