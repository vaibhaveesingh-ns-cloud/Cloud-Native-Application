const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  // Legacy field for backward compatibility
  thumbnailPath: {
    type: String
  },
  // S3 fields for cloud-native storage
  s3Key: {
    type: String,
    required: true
  },
  s3Location: {
    type: String,
    required: true
  },
  thumbnailS3Key: {
    type: String
  },
  // Processing metadata
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: {
    type: String
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    exif: mongoose.Schema.Types.Mixed
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  albums: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Album'
  }],
  // Analytics fields
  views: {
    type: Number,
    default: 0
  },
  lastViewed: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Photo', photoSchema);
