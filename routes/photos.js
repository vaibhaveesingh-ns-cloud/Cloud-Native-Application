const express = require('express');
const { body, validationResult } = require('express-validator');
const Photo = require('../models/Photo');
const auth = require('../middleware/auth');
const { upload } = require('../services/s3Service');
const { LambdaImageProcessingService } = require('../services/lambdaService');
const { DynamoUserActivityService } = require('../services/dynamoService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Initialize services
const imageProcessor = new LambdaImageProcessingService();
const activityService = new DynamoUserActivityService();

// Upload photo
router.post('/upload', auth, upload.single('photo'), [
  body('title').isLength({ min: 1 }).trim().withMessage('Title is required'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, description } = req.body;
    
    // File is already uploaded to S3 via multer-s3
    const s3Key = req.file.key;
    const s3Location = req.file.location;
    
    // Process image with Lambda (generate thumbnail)
    let thumbnailKey = null;
    try {
      const processingResult = await imageProcessor.processImage(s3Key, {
        generateThumbnail: true,
        thumbnailSize: { width: 300, height: 300 },
        quality: 80
      });
      thumbnailKey = processingResult.thumbnailKey;
    } catch (lambdaError) {
      console.error('Lambda processing error:', lambdaError);
      // Continue without thumbnail - we can process it later
    }

    // Create photo record
    const photo = new Photo({
      title,
      description: description || '',
      filename: req.file.key, // S3 key
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      s3Key: s3Key,
      s3Location: s3Location,
      thumbnailS3Key: thumbnailKey,
      uploadedBy: req.user._id
    });

    await photo.save();

    // Log user activity
    await activityService.logActivity(req.user._id, 'photo_upload', {
      photoId: photo._id,
      title: photo.title,
      fileSize: photo.size
    });

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo: {
        id: photo._id,
        title: photo.title,
        description: photo.description,
        s3Location: photo.s3Location,
        thumbnailS3Key: photo.thumbnailS3Key,
        createdAt: photo.createdAt
      }
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all photos for current user
router.get('/my-photos', auth, async (req, res) => {
  try {
    const photos = await Photo.find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'username');

    const photosWithPaths = photos.map(photo => ({
      id: photo._id,
      title: photo.title,
      description: photo.description,
      s3Location: photo.s3Location,
      thumbnailS3Key: photo.thumbnailS3Key,
      uploadedBy: photo.uploadedBy.username,
      createdAt: photo.createdAt
    }));

    res.json({ photos: photosWithPaths });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all photos (public feed)
router.get('/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const photos = await Photo.find()
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'username')
      .skip(skip)
      .limit(limit);

    const total = await Photo.countDocuments();

    const photosWithPaths = photos.map(photo => ({
      id: photo._id,
      title: photo.title,
      description: photo.description,
      s3Location: photo.s3Location,
      thumbnailS3Key: photo.thumbnailS3Key,
      uploadedBy: photo.uploadedBy.username,
      createdAt: photo.createdAt
    }));

    res.json({ 
      photos: photosWithPaths,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single photo
router.get('/:id', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id)
      .populate('uploadedBy', 'username');

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    res.json({
      photo: {
        id: photo._id,
        title: photo.title,
        description: photo.description,
        s3Location: photo.s3Location,
        thumbnailS3Key: photo.thumbnailS3Key,
        uploadedBy: photo.uploadedBy.username,
        createdAt: photo.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete photo
router.delete('/:id', auth, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user owns the photo
    if (photo.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this photo' });
    }

    // Delete files from S3
    const { deleteFromS3 } = require('../services/s3Service');
    
    try {
      // Delete original image
      if (photo.s3Key) {
        await deleteFromS3(photo.s3Key);
      }
      
      // Delete thumbnail
      if (photo.thumbnailS3Key) {
        await deleteFromS3(photo.thumbnailS3Key);
      }
    } catch (s3Error) {
      console.error('S3 deletion error:', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    await Photo.findByIdAndDelete(req.params.id);

    // Log user activity
    await activityService.logActivity(req.user._id, 'photo_delete', {
      photoId: req.params.id,
      title: photo.title
    });

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reprocess photo (regenerate thumbnail)
router.post('/:id/reprocess', auth, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);

    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check if user owns the photo
    if (photo.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to reprocess this photo' });
    }

    // Reprocess with Lambda
    const processingResult = await imageProcessor.processImage(photo.s3Key, {
      generateThumbnail: true,
      thumbnailSize: { width: 300, height: 300 },
      quality: 80
    });

    // Update photo record with new thumbnail
    photo.thumbnailS3Key = processingResult.thumbnailKey;
    await photo.save();

    res.json({
      message: 'Photo reprocessed successfully',
      thumbnailS3Key: photo.thumbnailS3Key
    });
  } catch (error) {
    console.error('Photo reprocessing error:', error);
    res.status(500).json({ message: 'Failed to reprocess photo' });
  }
});

module.exports = router;
