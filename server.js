const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const photoRoutes = require('./routes/photos');
const albumRoutes = require('./routes/albums');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
const thumbnailsDir = path.join(__dirname, 'uploads', 'thumbnails');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PixelBoard server running on port ${PORT}`);
});
