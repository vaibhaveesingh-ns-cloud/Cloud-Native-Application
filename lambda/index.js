const AWS = require('aws-sdk');
const sharp = require('sharp');

const s3 = new AWS.S3();

exports.handler = async (event) => {
    console.log('Image processing Lambda triggered:', JSON.stringify(event, null, 2));
    
    try {
        const { imageKey, bucket, options = {} } = event;
        
        if (!imageKey || !bucket) {
            throw new Error('Missing required parameters: imageKey and bucket');
        }

        // Get the original image from S3
        const getObjectParams = {
            Bucket: bucket,
            Key: imageKey
        };

        const originalImage = await s3.getObject(getObjectParams).promise();
        const imageBuffer = originalImage.Body;

        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();
        console.log('Original image metadata:', metadata);

        const results = {
            originalKey: imageKey,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: metadata.size
            }
        };

        // Generate thumbnail if requested
        if (options.generateThumbnail !== false) {
            const thumbnailSize = options.thumbnailSize || { width: 300, height: 300 };
            const quality = options.quality || 80;
            const format = options.format || 'jpeg';

            // Process thumbnail
            let thumbnailBuffer;
            if (format === 'jpeg') {
                thumbnailBuffer = await sharp(imageBuffer)
                    .resize(thumbnailSize.width, thumbnailSize.height, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .jpeg({ quality })
                    .toBuffer();
            } else if (format === 'png') {
                thumbnailBuffer = await sharp(imageBuffer)
                    .resize(thumbnailSize.width, thumbnailSize.height, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .png({ quality })
                    .toBuffer();
            } else {
                thumbnailBuffer = await sharp(imageBuffer)
                    .resize(thumbnailSize.width, thumbnailSize.height, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .toBuffer();
            }

            // Generate thumbnail key
            const pathParts = imageKey.split('/');
            const filename = pathParts.pop();
            const directory = pathParts.join('/');
            const thumbnailKey = `${directory}/thumbnails/thumb_${filename}`;

            // Upload thumbnail to S3
            const uploadParams = {
                Bucket: bucket,
                Key: thumbnailKey,
                Body: thumbnailBuffer,
                ContentType: `image/${format}`,
                Metadata: {
                    'original-key': imageKey,
                    'processed-by': 'pixelboard-lambda',
                    'processed-at': new Date().toISOString()
                }
            };

            await s3.upload(uploadParams).promise();
            console.log('Thumbnail uploaded successfully:', thumbnailKey);

            results.thumbnailKey = thumbnailKey;
            results.thumbnailMetadata = {
                width: thumbnailSize.width,
                height: thumbnailSize.height,
                format: format,
                quality: quality
            };
        }

        // Additional processing options
        if (options.watermark) {
            // Add watermark processing logic here
            console.log('Watermark processing requested but not implemented');
        }

        if (options.filters) {
            // Add filter processing logic here
            console.log('Filter processing requested but not implemented');
        }

        console.log('Image processing completed successfully:', results);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                ...results
            })
        };

    } catch (error) {
        console.error('Image processing error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
                errorType: error.name
            })
        };
    }
};
