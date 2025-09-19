const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const DynamoDBStore = require('connect-dynamodb')(session);
require('dotenv').config();

// Import AWS services
const { DynamoSessionService } = require('./services/dynamoService');

const authRoutes = require('./routes/auth');
const photoRoutes = require('./routes/photos');
const albumRoutes = require('./routes/albums');

const app = express();

// Trust proxy for production deployment
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || false
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration with DynamoDB
const sessionConfig = {
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Use DynamoDB for session storage in production
if (process.env.NODE_ENV === 'production' && process.env.AWS_REGION) {
  sessionConfig.store = new DynamoDBStore({
    table: process.env.DYNAMODB_SESSION_TABLE || 'pixelboard-sessions',
    AWSConfigJSON: {
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    },
    reapInterval: 86400000 // 24 hours cleanup
  });
}

app.use(session(sessionConfig));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'PixelBoard API',
    version: require('./package.json').version,
    description: 'Cloud-native image sharing platform',
    endpoints: {
      auth: '/api/auth',
      photos: '/api/photos',
      albums: '/api/albums'
    }
  });
});

// Serve static files (legacy support for local uploads)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/albums', albumRoutes);

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MongoDB with better error handling
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pixelboard', {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(() => {
  console.log('Connected to MongoDB successfully');
})
.catch(err => {
  console.error('MongoDB connection error:', err.message);
  console.log('Please check your MongoDB connection string in .env file');
  console.log('For development, you can use MongoDB Atlas (free tier) or install MongoDB locally');
  process.exit(1);
});

// Handle MongoDB connection events
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Create uploads directory if it doesn't exist (for development)
if (process.env.NODE_ENV !== 'production') {
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, 'uploads');
  const thumbnailsDir = path.join(__dirname, 'uploads', 'thumbnails');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large' });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ message: 'Unexpected file field' });
  }
  
  res.status(500).json({ 
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 PixelBoard server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'MongoDB Atlas' : 'Local MongoDB'}`);
  console.log(`☁️  Storage: ${process.env.S3_BUCKET_NAME ? 'AWS S3' : 'Local filesystem'}`);
  console.log(`🔧 Session Store: ${process.env.DYNAMODB_SESSION_TABLE ? 'DynamoDB' : 'Memory'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

module.exports = app;
