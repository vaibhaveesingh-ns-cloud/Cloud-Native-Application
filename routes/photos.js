const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const Photo = require('../models/Photo');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Generate thumbnail
const generateThumbnail = async (inputPath, outputPath) => {
  try {
    await sharp(inputPath)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return false;
  }
};

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
    
    // Generate thumbnail
    const thumbnailFilename = 'thumb_' + req.file.filename;
    const thumbnailPath = path.join('uploads', 'thumbnails', thumbnailFilename);
    const fullThumbnailPath = path.join(__dirname, '..', thumbnailPath);
    
    const thumbnailGenerated = await generateThumbnail(req.file.path, fullThumbnailPath);
    
    if (!thumbnailGenerated) {
      // Clean up uploaded file if thumbnail generation fails
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ message: 'Failed to generate thumbnail' });
    }

    // Create photo record
    const photo = new Photo({
      title,
      description: description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      thumbnailPath: `/uploads/thumbnails/${thumbnailFilename}`,
      uploadedBy: req.user._id
    });

    await photo.save();

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo: {
        id: photo._id,
        title: photo.title,
        description: photo.description,
        thumbnailPath: photo.thumbnailPath,
        originalPath: `/uploads/${photo.filename}`,
        createdAt: photo.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
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
      thumbnailPath: photo.thumbnailPath,
      originalPath: `/uploads/${photo.filename}`,
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
    const photos = await Photo.find()
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'username')
      .limit(50);

    const photosWithPaths = photos.map(photo => ({
      id: photo._id,
      title: photo.title,
      description: photo.description,
      thumbnailPath: photo.thumbnailPath,
      originalPath: `/uploads/${photo.filename}`,
      uploadedBy: photo.uploadedBy.username,
      createdAt: photo.createdAt
    }));

    res.json({ photos: photosWithPaths });
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
        thumbnailPath: photo.thumbnailPath,
        originalPath: `/uploads/${photo.filename}`,
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

    // Delete files
    const photoPath = path.join(__dirname, '..', 'uploads', photo.filename);
    const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', 'thumb_' + photo.filename);

    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    await Photo.findByIdAndDelete(req.params.id);

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
