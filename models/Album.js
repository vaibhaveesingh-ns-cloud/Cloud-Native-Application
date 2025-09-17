const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  photos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo'
  }],
  coverPhoto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Album', albumSchema);
