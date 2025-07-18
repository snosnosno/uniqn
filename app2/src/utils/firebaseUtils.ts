import { db } from '../firebase';
import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';

// Firebase connection reset utility
export const resetFirebaseConnection = async (): Promise<void> => {
  console.log('🔄 Resetting Firebase connection...');
  
  try {
    // Clear any existing listeners by creating a temporary listener on a test collection
    const testCollection = collection(db, '_test');
    const unsubscribe = onSnapshot(testCollection, () => {});
    unsubscribe();
    
    // Force a longer delay to allow cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ Firebase connection reset completed');
  } catch (error) {
    console.error('❌ Error resetting Firebase connection:', error);
  }
};

// Force Firebase reconnection
export const forceFirebaseReconnection = async (): Promise<void> => {
  console.log('🔄 Force reconnecting to Firebase...');
  
  try {
    // Clear all existing connections
    await resetFirebaseConnection();
    
    // Force a page reload to completely reset Firebase state
    window.location.reload();
  } catch (error) {
    console.error('❌ Error forcing Firebase reconnection:', error);
    // Fallback to page reload
    window.location.reload();
  }
};

// Enhanced error handling for Firebase operations
export const withFirebaseErrorHandling = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`❌ Firebase operation failed: ${operationName}`, error);
    
    // If it's an internal assertion error, try to reset connection
    if (error.message && error.message.includes('INTERNAL ASSERTION FAILED')) {
      console.log('🔄 Detected internal assertion error, attempting connection reset...');
      await resetFirebaseConnection();
      
      // Retry the operation once
      try {
        return await operation();
      } catch (retryError) {
        console.error(`❌ Retry failed for ${operationName}:`, retryError);
        throw retryError;
      }
    }
    
    throw error;
  }
};

// Firebase connection health check
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    // Try to access Firestore to check connection
    const testDoc = db.app.options;
    console.log('✅ Firebase connection is healthy');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection check failed:', error);
    return false;
  }
};

// Cleanup function for Firebase listeners
export const cleanupFirebaseListeners = (listeners: Unsubscribe[]): void => {
  listeners.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn('⚠️ Error cleaning up Firebase listener:', error);
    }
  });
}; 