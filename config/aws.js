const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient } = require('@aws-sdk/client-lambda');

// AWS Configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
};

// S3 Client for file uploads
const s3Client = new S3Client(awsConfig);

// DynamoDB Client for session storage
const dynamoClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Lambda Client for image processing
const lambdaClient = new LambdaClient(awsConfig);

// S3 Configuration
const S3_CONFIG = {
  bucket: process.env.S3_BUCKET_NAME || 'pixelboard-uploads',
  region: process.env.AWS_REGION || 'us-east-1',
  signedUrlExpires: 60 * 60, // 1 hour
};

// DynamoDB Configuration
const DYNAMODB_CONFIG = {
  sessionTable: process.env.DYNAMODB_SESSION_TABLE || 'pixelboard-sessions',
  region: process.env.AWS_REGION || 'us-east-1',
  ttl: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

// Lambda Configuration
const LAMBDA_CONFIG = {
  imageProcessorFunction: process.env.LAMBDA_IMAGE_PROCESSOR || 'pixelboard-image-processor',
  region: process.env.AWS_REGION || 'us-east-1',
};

module.exports = {
  s3Client,
  docClient,
  lambdaClient,
  S3_CONFIG,
  DYNAMODB_CONFIG,
  LAMBDA_CONFIG,
  awsConfig
};
