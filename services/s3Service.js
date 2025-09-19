const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, S3_CONFIG } = require('../config/aws');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Multer S3 configuration for direct uploads
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: S3_CONFIG.bucket,
    metadata: function (req, file, cb) {
      cb(null, {
        fieldName: file.fieldname,
        userId: req.user ? req.user.id : 'anonymous',
        uploadTime: new Date().toISOString()
      });
    },
    key: function (req, file, cb) {
      const uniqueId = uuidv4();
      const extension = path.extname(file.originalname);
      const filename = `photos/${Date.now()}-${uniqueId}${extension}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Upload file to S3
const uploadToS3 = async (fileBuffer, fileName, contentType, metadata = {}) => {
  try {
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: metadata
    });

    const result = await s3Client.send(command);
    return {
      success: true,
      key: fileName,
      location: `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${fileName}`,
      etag: result.ETag
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

// Get signed URL for secure file access
const getSignedUrlForFile = async (key, expiresIn = S3_CONFIG.signedUrlExpires) => {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

// Delete file from S3
const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

// Get public URL for file (if bucket is public)
const getPublicUrl = (key) => {
  return `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
};

// Generate thumbnail key from original key
const getThumbnailKey = (originalKey) => {
  const pathParts = originalKey.split('/');
  const filename = pathParts.pop();
  const directory = pathParts.join('/');
  return `${directory}/thumbnails/thumb_${filename}`;
};

module.exports = {
  upload,
  uploadToS3,
  getSignedUrlForFile,
  deleteFromS3,
  getPublicUrl,
  getThumbnailKey
};
