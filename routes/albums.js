const express = require('express');
const { body, validationResult } = require('express-validator');
const Album = require('../models/Album');
const Photo = require('../models/Photo');
const auth = require('../middleware/auth');

const router = express.Router();

// Create album
router.post('/create', auth, [
  body('title').isLength({ min: 1 }).trim().withMessage('Title is required'),
  body('description').optional().trim(),
  body('photoIds').optional().isArray().withMessage('Photo IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, photoIds } = req.body;

    // Verify photos belong to user
    if (photoIds && photoIds.length > 0) {
      const photos = await Photo.find({
        _id: { $in: photoIds },
        uploadedBy: req.user._id
      });

      if (photos.length !== photoIds.length) {
        return res.status(400).json({ message: 'Some photos not found or not owned by user' });
      }
    }

    const album = new Album({
      title,
      description: description || '',
      createdBy: req.user._id,
      photos: photoIds || [],
      coverPhoto: photoIds && photoIds.length > 0 ? photoIds[0] : null
    });

    await album.save();

    // Update photos to reference this album
    if (photoIds && photoIds.length > 0) {
      await Photo.updateMany(
        { _id: { $in: photoIds } },
        { $push: { albums: album._id } }
      );
    }

    const populatedAlbum = await Album.findById(album._id)
      .populate('photos', 'title thumbnailPath')
      .populate('coverPhoto', 'thumbnailPath')
      .populate('createdBy', 'username');

    res.status(201).json({
      message: 'Album created successfully',
      album: {
        id: populatedAlbum._id,
        title: populatedAlbum.title,
        description: populatedAlbum.description,
        photoCount: populatedAlbum.photos.length,
        coverPhoto: populatedAlbum.coverPhoto?.thumbnailPath || null,
        createdBy: populatedAlbum.createdBy.username,
        createdAt: populatedAlbum.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's albums
router.get('/my-albums', auth, async (req, res) => {
  try {
    const albums = await Album.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('photos', 'title thumbnailPath')
      .populate('coverPhoto', 'thumbnailPath')
      .populate('createdBy', 'username');

    const albumsData = albums.map(album => ({
      id: album._id,
      title: album.title,
      description: album.description,
      photoCount: album.photos.length,
      coverPhoto: album.coverPhoto?.thumbnailPath || null,
      createdBy: album.createdBy.username,
      createdAt: album.createdAt
    }));

    res.json({ albums: albumsData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all albums (public)
router.get('/all', async (req, res) => {
  try {
    const albums = await Album.find()
      .sort({ createdAt: -1 })
      .populate('photos', 'title thumbnailPath')
      .populate('coverPhoto', 'thumbnailPath')
      .populate('createdBy', 'username')
      .limit(20);

    const albumsData = albums.map(album => ({
      id: album._id,
      title: album.title,
      description: album.description,
      photoCount: album.photos.length,
      coverPhoto: album.coverPhoto?.thumbnailPath || null,
      createdBy: album.createdBy.username,
      createdAt: album.createdAt
    }));

    res.json({ albums: albumsData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single album with photos
router.get('/:id', async (req, res) => {
  try {
    const album = await Album.findById(req.params.id)
      .populate('photos', 'title description thumbnailPath filename createdAt')
      .populate('createdBy', 'username');

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    const photosData = album.photos.map(photo => ({
      id: photo._id,
      title: photo.title,
      description: photo.description,
      thumbnailPath: photo.thumbnailPath,
      originalPath: `/uploads/${photo.filename}`,
      createdAt: photo.createdAt
    }));

    res.json({
      album: {
        id: album._id,
        title: album.title,
        description: album.description,
        createdBy: album.createdBy.username,
        createdAt: album.createdAt,
        photos: photosData
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add photos to album
router.post('/:id/add-photos', auth, [
  body('photoIds').isArray().withMessage('Photo IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { photoIds } = req.body;
    const album = await Album.findById(req.params.id);

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    // Check if user owns the album
    if (album.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to modify this album' });
    }

    // Verify photos belong to user
    const photos = await Photo.find({
      _id: { $in: photoIds },
      uploadedBy: req.user._id
    });

    if (photos.length !== photoIds.length) {
      return res.status(400).json({ message: 'Some photos not found or not owned by user' });
    }

    // Add photos to album (avoid duplicates)
    const newPhotoIds = photoIds.filter(id => !album.photos.includes(id));
    album.photos.push(...newPhotoIds);

    // Set cover photo if album doesn't have one
    if (!album.coverPhoto && newPhotoIds.length > 0) {
      album.coverPhoto = newPhotoIds[0];
    }

    await album.save();

    // Update photos to reference this album
    await Photo.updateMany(
      { _id: { $in: newPhotoIds } },
      { $push: { albums: album._id } }
    );

    res.json({ message: 'Photos added to album successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove photos from album
router.post('/:id/remove-photos', auth, [
  body('photoIds').isArray().withMessage('Photo IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { photoIds } = req.body;
    const album = await Album.findById(req.params.id);

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    // Check if user owns the album
    if (album.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to modify this album' });
    }

    // Remove photos from album
    album.photos = album.photos.filter(photoId => !photoIds.includes(photoId.toString()));

    // Update cover photo if it was removed
    if (album.coverPhoto && photoIds.includes(album.coverPhoto.toString())) {
      album.coverPhoto = album.photos.length > 0 ? album.photos[0] : null;
    }

    await album.save();

    // Update photos to remove album reference
    await Photo.updateMany(
      { _id: { $in: photoIds } },
      { $pull: { albums: album._id } }
    );

    res.json({ message: 'Photos removed from album successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete album
router.delete('/:id', auth, async (req, res) => {
  try {
    const album = await Album.findById(req.params.id);

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    // Check if user owns the album
    if (album.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this album' });
    }

    // Remove album reference from photos
    await Photo.updateMany(
      { _id: { $in: album.photos } },
      { $pull: { albums: album._id } }
    );

    await Album.findByIdAndDelete(req.params.id);

    res.json({ message: 'Album deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
