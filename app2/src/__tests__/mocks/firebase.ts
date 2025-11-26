/**
 * Firebase Mock Setup
 *
 * Jest Mock for Firebase Firestore functions used in tests.
 * Provides controlled mock implementations for onSnapshot, updateDoc, deleteDoc, etc.
 */

import { DocumentData, QuerySnapshot } from 'firebase/firestore';

// ========================================
// Mock State Management
// ========================================

/** Callback function for onSnapshot */
export let onSnapshotCallback: Function | null = null;

/** Unsubscribe function mock */
export const mockUnsubscribe = jest.fn();

// ========================================
// Firebase Function Mocks
// ========================================

/**
 * Mock onSnapshot - Firestore real-time subscription
 * Usage: Stores callback and triggers it with mock data
 * ALWAYS returns a valid unsubscribe function
 */
export const mockOnSnapshot = jest.fn(
  (query: any, callback: (snapshot: QuerySnapshot<DocumentData>) => void) => {
    onSnapshotCallback = callback;
    // Always return a function, even if mockUnsubscribe is not defined
    return typeof mockUnsubscribe === 'function' ? mockUnsubscribe : jest.fn();
  }
);

/**
 * Mock updateDoc - Firestore document update
 * Default: Success (resolves with undefined)
 */
export const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

/**
 * Mock deleteDoc - Firestore document deletion
 * Default: Success (resolves with undefined)
 */
export const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);

/**
 * Mock addDoc - Firestore document creation
 * Default: Success (resolves with mock DocumentReference)
 */
export const mockAddDoc = jest.fn().mockResolvedValue({
  id: 'mock-doc-id',
  path: 'collection/mock-doc-id',
});

/**
 * Mock collection - Firestore collection reference
 */
export const mockCollection = jest.fn((db: any, path: string) => ({
  _path: path,
  type: 'collection',
}));

/**
 * Mock query - Firestore query builder
 * Returns the first argument (collection ref) to allow chaining
 */
export const mockQuery = jest.fn((collectionRef: any, ...constraints: any[]) => ({
  ...collectionRef,
  _constraints: constraints,
  type: 'query',
}));

/**
 * Mock where - Firestore query filter
 */
export const mockWhere = jest.fn((field: string, operator: string, value: any) => ({
  type: 'where',
  field,
  operator,
  value,
}));

/**
 * Mock orderBy - Firestore query ordering
 */
export const mockOrderBy = jest.fn((field: string, direction?: 'asc' | 'desc') => ({
  type: 'orderBy',
  field,
  direction: direction || 'asc',
}));

/**
 * Mock limit - Firestore query limit
 */
export const mockLimit = jest.fn((count: number) => ({
  type: 'limit',
  count,
}));

/**
 * Mock doc - Firestore document reference
 */
export const mockDoc = jest.fn((db: any, collection: string, id: string) => ({
  id,
  path: `${collection}/${id}`,
  type: 'document',
}));

/**
 * Mock writeBatch - Firestore batch write
 */
export const mockWriteBatch = jest.fn((_db: any) => ({
  update: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
}));

// ========================================
// Mock Module Setup
// ========================================

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  onSnapshot: mockOnSnapshot,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  addDoc: mockAddDoc,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  doc: mockDoc,
  writeBatch: mockWriteBatch,
}));

// ========================================
// Helper Functions
// ========================================

/**
 * Trigger real-time update for onSnapshot
 * @param snapshot - Mock QuerySnapshot to pass to callback
 */
export const triggerSnapshot = <T extends DocumentData>(snapshot: QuerySnapshot<T>) => {
  if (onSnapshotCallback) {
    onSnapshotCallback(snapshot);
  }
};

/**
 * Reset all Firebase mocks
 * Call this in beforeEach() or afterEach()
 */
export const resetFirebaseMocks = () => {
  mockOnSnapshot.mockClear();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockAddDoc.mockClear();
  mockCollection.mockClear();
  mockQuery.mockClear();
  mockWhere.mockClear();
  mockOrderBy.mockClear();
  mockLimit.mockClear();
  mockDoc.mockClear();
  mockWriteBatch.mockClear();
  mockUnsubscribe.mockClear();
  onSnapshotCallback = null;
};
