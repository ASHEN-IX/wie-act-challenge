import mongoose from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logger = require('./logger');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ednova';

let isConnected = false;

/**
 * Connect to MongoDB
 * @param {string} [uri] - Optional MongoDB URI (defaults to MONGODB_URI env)
 * @returns {Promise<void>}
 */
export async function connectDatabase(uri?: string): Promise<void> {
  const connectionUri = uri || MONGODB_URI;

  if (isConnected) {
    logger.info('Using existing MongoDB connection');
    return;
  }

  try {
    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
      connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 30000)
    });

    isConnected = true;
    logger.info('Connected to MongoDB successfully');

    mongoose.connection.on('error', (err: unknown) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

/**
 * Get database connection status
 * @returns {boolean}
 */
export function isConnectedToDatabase(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  isConnectedToDatabase,
  mongoose
};
