/**
 * Mock Factories for Firebase Structures
 *
 * Helper functions to create properly typed Firebase mock objects
 * including QuerySnapshot, DocumentSnapshot, and DocumentReference.
 */

import { DocumentData, QuerySnapshot, DocumentSnapshot, DocumentReference } from 'firebase/firestore';

// ========================================
// 1. Query Snapshot Factory
// ========================================

/**
 * Create mock Firestore QuerySnapshot
 * @param data - Array of documents
 * @returns Mock QuerySnapshot with proper structure
 */
export const createMockSnapshot = <T extends DocumentData>(data: T[]): QuerySnapshot<T> => {
  const docs = data.map((item, index) => {
    const docId = (item as any).id || `doc-${index}`;

    return {
      id: docId,
      exists: () => true,
      data: () => item,
      get: (fieldPath: string) => (item as any)[fieldPath],
      ref: {
        id: docId,
        path: `collection/${docId}`,
        collection: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          data: () => item,
        }),
      } as unknown as DocumentReference<T>,
    } as unknown as DocumentSnapshot<T>;
  });

  return {
    docs: docs,
    size: data.length,
    empty: data.length === 0,
    forEach: (callback: (doc: DocumentSnapshot<T>) => void) => {
      docs.forEach(callback);
    },
    query: {} as any,
    metadata: {
      fromCache: false,
      hasPendingWrites: false,
      isEqual: () => false,
    },
  } as unknown as QuerySnapshot<T>;
};

/**
 * Create empty QuerySnapshot
 */
export const createEmptySnapshot = <T extends DocumentData>(): QuerySnapshot<T> => {
  return createMockSnapshot<T>([]);
};

// ========================================
// 2. Document Snapshot Factory
// ========================================

/**
 * Create single DocumentSnapshot
 * @param data - Document data
 * @returns Mock DocumentSnapshot
 */
export const createSingleDocSnapshot = <T extends DocumentData>(data: T): DocumentSnapshot<T> => {
  const docId = (data as any).id || 'doc-1';

  return {
    id: docId,
    exists: () => true,
    data: () => data,
    get: (fieldPath: string) => (data as any)[fieldPath],
    ref: {
      id: docId,
      path: `collection/${docId}`,
      collection: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as DocumentReference<T>,
    metadata: {
      fromCache: false,
      hasPendingWrites: false,
      isEqual: () => false,
    },
  } as unknown as DocumentSnapshot<T>;
};

/**
 * Create DocumentSnapshot for non-existent document
 */
export const createNonExistentDocSnapshot = <T extends DocumentData>(): DocumentSnapshot<T> => {
  return {
    id: 'non-existent',
    exists: () => false,
    data: () => undefined,
    get: () => undefined,
    ref: {
      id: 'non-existent',
      path: 'collection/non-existent',
    } as unknown as DocumentReference<T>,
  } as unknown as DocumentSnapshot<T>;
};

// ========================================
// 3. Firebase Function Mocks (Advanced)
// ========================================

/**
 * Create controlled onSnapshot mock
 * @returns Object with mock function and control utilities
 */
export const createMockOnSnapshot = () => {
  let callback: Function | null = null;
  const unsubscribe = jest.fn();

  const mockOnSnapshot = jest.fn((query: any, cb: Function) => {
    callback = cb;
    return unsubscribe;
  });

  return {
    mockOnSnapshot,
    unsubscribe,
    /**
     * Trigger real-time update
     * @param data - New data to emit
     */
    triggerUpdate: <T extends DocumentData>(data: T[]) => {
      if (callback) {
        const snapshot = createMockSnapshot(data);
        callback(snapshot);
      }
    },
    /**
     * Emit initial data immediately
     * @param data - Initial data
     */
    emitInitialData: <T extends DocumentData>(data: T[]) => {
      if (callback) {
        const snapshot = createMockSnapshot(data);
        callback(snapshot);
      }
    },
    /**
     * Trigger error
     * @param error - Error to emit
     */
    triggerError: (error: Error) => {
      if (callback) {
        callback(null, error);
      }
    },
  };
};

/**
 * Create controlled updateDoc mock
 * @returns Object with mock function and control utilities
 */
export const createMockUpdateDoc = () => {
  const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

  return {
    mockUpdateDoc,
    /**
     * Set to success mode
     */
    mockSuccess: () => {
      mockUpdateDoc.mockResolvedValue(undefined);
    },
    /**
     * Set to failure mode
     * @param error - Error message
     */
    mockFailure: (error: string) => {
      mockUpdateDoc.mockRejectedValue(new Error(error));
    },
    /**
     * Fail once, then succeed
     * @param error - Error message
     */
    mockFailureOnce: (error: string) => {
      mockUpdateDoc.mockRejectedValueOnce(new Error(error));
    },
  };
};

/**
 * Create controlled deleteDoc mock
 * @returns Object with mock function and control utilities
 */
export const createMockDeleteDoc = () => {
  const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);

  return {
    mockDeleteDoc,
    /**
     * Set to success mode
     */
    mockSuccess: () => {
      mockDeleteDoc.mockResolvedValue(undefined);
    },
    /**
     * Set to failure mode
     * @param error - Error message
     */
    mockFailure: (error: string) => {
      mockDeleteDoc.mockRejectedValue(new Error(error));
    },
  };
};
