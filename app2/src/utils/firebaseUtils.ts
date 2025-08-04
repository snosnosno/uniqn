import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';

import { db } from '../firebase';

import { logger } from './logger';

// Firebase connection reset utility
export const resetFirebaseConnection = async (): Promise<void> => {
  logger.info('🔄 Resetting Firebase connection...', { operation: 'resetFirebaseConnection' });
  
  try {
    // Clear any existing listeners by creating a temporary listener on a test collection
    const testCollection = collection(db, '_test');
    const unsubscribe = onSnapshot(testCollection, () => {});
    unsubscribe();
    
    // Force a longer delay to allow cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    logger.info('✅ Firebase connection reset completed', { operation: 'resetFirebaseConnection' });
  } catch (error) {
    logger.error('❌ Error resetting Firebase connection', error instanceof Error ? error : new Error(String(error)), { operation: 'resetFirebaseConnection' });
  }
};

// Force Firebase reconnection
export const forceFirebaseReconnection = async (): Promise<void> => {
  logger.info('🔄 Force reconnecting to Firebase...', { operation: 'forceFirebaseReconnection' });
  
  try {
    // Clear all existing connections
    await resetFirebaseConnection();
    
    // Force a page reload to completely reset Firebase state
    window.location.reload();
  } catch (error) {
    logger.error('❌ Error forcing Firebase reconnection', error instanceof Error ? error : new Error(String(error)), { operation: 'forceFirebaseReconnection' });
    // Fallback to page reload
    window.location.reload();
  }
};

// Enhanced error handling for Firebase operations (deprecated - use logger.withErrorHandling instead)
export const withFirebaseErrorHandling = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  return logger.withErrorHandling(operation, operationName, { component: 'firebase' });
};

// Firebase connection health check
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    // Try to access Firestore to check connection
    const testDoc = db.app.options;
    logger.info('✅ Firebase connection is healthy', { operation: 'checkFirebaseConnection' });
    return true;
  } catch (error) {
    logger.error('❌ Firebase connection check failed', error instanceof Error ? error : new Error(String(error)), { operation: 'checkFirebaseConnection' });
    return false;
  }
};

// Cleanup function for Firebase listeners
export const cleanupFirebaseListeners = (listeners: Unsubscribe[]): void => {
  listeners.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      logger.warn('⚠️ Error cleaning up Firebase listener', { component: 'firebaseUtils', data: {  
        operation: 'cleanupFirebaseListeners',
        error: error instanceof Error ? error.message : String(error)
       } });
    }
  });
}; 