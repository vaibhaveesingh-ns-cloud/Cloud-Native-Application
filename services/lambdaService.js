const { InvokeCommand } = require('@aws-sdk/client-lambda');
const { lambdaClient, LAMBDA_CONFIG } = require('../config/aws');

class LambdaImageProcessingService {
  constructor() {
    this.functionName = LAMBDA_CONFIG.imageProcessorFunction;
  }

  // Invoke Lambda function for image processing
  async processImage(imageKey, options = {}) {
    try {
      const payload = {
        imageKey,
        bucket: process.env.S3_BUCKET_NAME,
        options: {
          generateThumbnail: options.generateThumbnail !== false,
          thumbnailSize: options.thumbnailSize || { width: 300, height: 300 },
          quality: options.quality || 80,
          format: options.format || 'jpeg',
          ...options
        }
      };

      const command = new InvokeCommand({
        FunctionName: this.functionName,
        Payload: JSON.stringify(payload),
        InvocationType: options.async ? 'Event' : 'RequestResponse'
      });

      const response = await lambdaClient.send(command);
      
      if (options.async) {
        return { success: true, async: true, statusCode: response.StatusCode };
      }

      const result = JSON.parse(new TextDecoder().decode(response.Payload));
      
      if (result.errorMessage) {
        throw new Error(result.errorMessage);
      }

      return {
        success: true,
        originalKey: imageKey,
        thumbnailKey: result.thumbnailKey,
        metadata: result.metadata,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Lambda image processing error:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  // Process multiple images in batch
  async processImageBatch(imageKeys, options = {}) {
    try {
      const batchSize = options.batchSize || 5;
      const results = [];

      for (let i = 0; i < imageKeys.length; i += batchSize) {
        const batch = imageKeys.slice(i, i + batchSize);
        const batchPromises = batch.map(key => 
          this.processImage(key, { ...options, async: false })
            .catch(error => ({ success: false, key, error: error.message }))
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return {
        success: true,
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error('Lambda batch processing error:', error);
      throw new Error(`Failed to process image batch: ${error.message}`);
    }
  }

  // Get processing status (for async operations)
  async getProcessingStatus(requestId) {
    try {
      // This would typically query a status table in DynamoDB
      // For now, we'll return a placeholder
      return {
        requestId,
        status: 'completed',
        message: 'Processing status tracking not implemented yet'
      };
    } catch (error) {
      console.error('Error getting processing status:', error);
      throw new Error(`Failed to get processing status: ${error.message}`);
    }
  }
}

module.exports = {
  LambdaImageProcessingService
};
