import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';

import { db } from '../firebase';

// Global listener management
class FirebaseConnectionManager {
  private listeners: Map<string, Unsubscribe> = new Map();
  private isInitialized = false;
  private retryCount = 0;
  private maxRetries = 3;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;
    
    // Set up global error handling
    window.addEventListener('beforeunload', () => {
      this.cleanupAllListeners();
    });

    this.isInitialized = true;
  }

  // Safe onSnapshot wrapper with error handling
  public safeOnSnapshot<T>(
    collectionPath: string,
    callback: (data: T[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    const listenerId = `${collectionPath}_${Date.now()}`;
    
    try {
      const unsubscribe = onSnapshot(
        collection(db, collectionPath),
        (snapshot) => {
          try {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as T[];
            callback(data);
          } catch (error) {
            console.error('Error processing snapshot data:', error);
            if (errorCallback) errorCallback(error as Error);
          }
        },
        (error) => {
          console.error(`Firebase listener error for ${collectionPath}:`, error);
          
          // Handle internal assertion errors
          if (error.message && error.message.includes('INTERNAL ASSERTION FAILED')) {
            console.log('🔄 Detected internal assertion error, attempting recovery...');
            this.handleInternalAssertionError(collectionPath, callback, errorCallback);
          } else {
            if (errorCallback) errorCallback(error);
          }
        }
      );

      // Store the listener
      this.listeners.set(listenerId, unsubscribe);
      
      return () => {
        this.removeListener(listenerId);
      };
    } catch (error) {
      console.error('Error setting up Firebase listener:', error);
      if (errorCallback) errorCallback(error as Error);
      
      // Return a no-op function
      return () => {};
    }
  }

  private handleInternalAssertionError<T>(
    collectionPath: string,
    callback: (data: T[]) => void,
    errorCallback?: (error: Error) => void
  ) {
    if (this.retryCount >= this.maxRetries) {
      console.error('Max retry attempts reached for Firebase connection');
      if (errorCallback) {
        errorCallback(new Error('Firebase connection failed after multiple retry attempts'));
      }
      return;
    }

    this.retryCount++;
    console.log(`🔄 Retrying Firebase connection (attempt ${this.retryCount}/${this.maxRetries})`);

    // Clean up existing listeners
    this.cleanupAllListeners();

    // Wait before retrying
    setTimeout(() => {
      try {
        this.safeOnSnapshot(collectionPath, callback, errorCallback);
      } catch (error) {
        console.error('Retry failed:', error);
        if (errorCallback) errorCallback(error as Error);
      }
    }, 1000 * this.retryCount); // Exponential backoff
  }

  private removeListener(listenerId: string) {
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error removing listener:', error);
      }
      this.listeners.delete(listenerId);
    }
  }

  public cleanupAllListeners() {
    console.log('🧹 Cleaning up all Firebase listeners...');
    this.listeners.forEach((unsubscribe, listenerId) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`Error cleaning up listener ${listenerId}:`, error);
      }
    });
    this.listeners.clear();
  }

  public resetRetryCount() {
    this.retryCount = 0;
  }

  public getListenerCount(): number {
    return this.listeners.size;
  }
}

// Singleton instance
export const firebaseConnectionManager = new FirebaseConnectionManager();

// Utility functions
export const safeOnSnapshot = <T>(
  collectionPath: string,
  callback: (data: T[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  return firebaseConnectionManager.safeOnSnapshot(collectionPath, callback, errorCallback);
};

export const cleanupFirebaseListeners = (): void => {
  firebaseConnectionManager.cleanupAllListeners();
};

export const resetFirebaseRetryCount = (): void => {
  firebaseConnectionManager.resetRetryCount();
}; 