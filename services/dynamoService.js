const { PutCommand, GetCommand, DeleteCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, DYNAMODB_CONFIG } = require('../config/aws');

// Session management for DynamoDB
class DynamoSessionService {
  constructor() {
    this.tableName = DYNAMODB_CONFIG.sessionTable;
    this.ttl = DYNAMODB_CONFIG.ttl;
  }

  // Create or update session
  async createSession(sessionId, sessionData) {
    try {
      const ttlTimestamp = Math.floor((Date.now() + this.ttl) / 1000);
      
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          sessionId,
          data: sessionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ttl: ttlTimestamp
        }
      });

      await docClient.send(command);
      return { success: true, sessionId };
    } catch (error) {
      console.error('DynamoDB create session error:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  // Get session
  async getSession(sessionId) {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { sessionId }
      });

      const result = await docClient.send(command);
      return result.Item || null;
    } catch (error) {
      console.error('DynamoDB get session error:', error);
      throw new Error(`Failed to get session: ${error.message}`);
    }
  }

  // Update session
  async updateSession(sessionId, sessionData) {
    try {
      const ttlTimestamp = Math.floor((Date.now() + this.ttl) / 1000);
      
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { sessionId },
        UpdateExpression: 'SET #data = :data, updatedAt = :updatedAt, ttl = :ttl',
        ExpressionAttributeNames: {
          '#data': 'data'
        },
        ExpressionAttributeValues: {
          ':data': sessionData,
          ':updatedAt': new Date().toISOString(),
          ':ttl': ttlTimestamp
        }
      });

      await docClient.send(command);
      return { success: true };
    } catch (error) {
      console.error('DynamoDB update session error:', error);
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  // Delete session
  async deleteSession(sessionId) {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { sessionId }
      });

      await docClient.send(command);
      return { success: true };
    } catch (error) {
      console.error('DynamoDB delete session error:', error);
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  // Clean expired sessions (optional maintenance function)
  async cleanExpiredSessions() {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      const scanCommand = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'ttl < :currentTime',
        ExpressionAttributeValues: {
          ':currentTime': currentTimestamp
        }
      });

      const result = await docClient.send(scanCommand);
      
      if (result.Items && result.Items.length > 0) {
        const deletePromises = result.Items.map(item => 
          this.deleteSession(item.sessionId)
        );
        
        await Promise.all(deletePromises);
        console.log(`Cleaned ${result.Items.length} expired sessions`);
      }

      return { success: true, cleaned: result.Items?.length || 0 };
    } catch (error) {
      console.error('DynamoDB clean sessions error:', error);
      throw new Error(`Failed to clean expired sessions: ${error.message}`);
    }
  }
}

// User activity tracking
class DynamoUserActivityService {
  constructor() {
    this.tableName = 'pixelboard-user-activity';
  }

  // Log user activity
  async logActivity(userId, activity, metadata = {}) {
    try {
      const activityId = `${userId}_${Date.now()}`;
      
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          activityId,
          userId,
          activity,
          metadata,
          timestamp: new Date().toISOString(),
          ttl: Math.floor((Date.now() + (30 * 24 * 60 * 60 * 1000)) / 1000) // 30 days
        }
      });

      await docClient.send(command);
      return { success: true, activityId };
    } catch (error) {
      console.error('DynamoDB log activity error:', error);
      // Don't throw error for activity logging to avoid breaking main functionality
      return { success: false, error: error.message };
    }
  }

  // Get user activities
  async getUserActivities(userId, limit = 50) {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Limit: limit
      });

      const result = await docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('DynamoDB get activities error:', error);
      return [];
    }
  }
}

module.exports = {
  DynamoSessionService,
  DynamoUserActivityService
};
