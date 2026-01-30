/**
 * documentUtils 테스트
 *
 * @description Phase 1.1 - Firestore 문서 유틸리티 테스트
 */

import {
  getDocumentRequired,
  getDocumentOptional,
  queryDocuments,
  verifyOwnership,
  batchGetDocuments,
  getDocRef,
  type DocumentParser,
} from '../documentUtils';
import { BusinessError, PermissionError } from '@/errors';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

import { doc, getDoc, getDocs, collection, query } from 'firebase/firestore';

// Test types
interface TestDocument {
  id: string;
  name: string;
  ownerId?: string;
  [key: string]: unknown;
}

// Test parser
const testParser: DocumentParser<TestDocument> = (data) => {
  if (data.id && data.name) {
    return data as unknown as TestDocument;
  }
  return null;
};

describe('documentUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // getDocumentRequired
  // ==========================================================================
  describe('getDocumentRequired', () => {
    it('should return document when it exists and parses correctly', async () => {
      const mockData = { id: 'doc1', name: 'Test Document' };
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: 'doc1',
        data: () => ({ name: 'Test Document' }),
      });

      const result = await getDocumentRequired({
        collectionName: 'testCollection',
        documentId: 'doc1',
        parser: testParser,
      });

      expect(result.data).toEqual(mockData);
      expect(result.ref).toBeDefined();
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'testCollection', 'doc1');
    });

    it('should throw BusinessError when document does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      await expect(
        getDocumentRequired({
          collectionName: 'testCollection',
          documentId: 'nonexistent',
          parser: testParser,
          notFoundMessage: '문서를 찾을 수 없습니다',
        })
      ).rejects.toThrow(BusinessError);
    });

    it('should throw BusinessError when parsing fails', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: 'doc1',
        data: () => ({ invalid: 'data' }), // Missing required fields
      });

      await expect(
        getDocumentRequired({
          collectionName: 'testCollection',
          documentId: 'doc1',
          parser: testParser,
          parseErrorMessage: '파싱 실패',
        })
      ).rejects.toThrow(BusinessError);
    });
  });

  // ==========================================================================
  // getDocumentOptional
  // ==========================================================================
  describe('getDocumentOptional', () => {
    it('should return document when it exists', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: 'doc1',
        data: () => ({ name: 'Test Document' }),
      });

      const result = await getDocumentOptional({
        collectionName: 'testCollection',
        documentId: 'doc1',
        parser: testParser,
      });

      expect(result).toEqual({ id: 'doc1', name: 'Test Document' });
    });

    it('should return null when document does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const result = await getDocumentOptional({
        collectionName: 'testCollection',
        documentId: 'nonexistent',
        parser: testParser,
      });

      expect(result).toBeNull();
    });

    it('should return null when parsing fails', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: 'doc1',
        data: () => ({ invalid: 'data' }),
      });

      const result = await getDocumentOptional({
        collectionName: 'testCollection',
        documentId: 'doc1',
        parser: testParser,
      });

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // queryDocuments
  // ==========================================================================
  describe('queryDocuments', () => {
    it('should return parsed documents', async () => {
      const mockDocs = [
        { id: 'doc1', data: () => ({ name: 'Doc 1' }) },
        { id: 'doc2', data: () => ({ name: 'Doc 2' }) },
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});

      const result = await queryDocuments({
        collectionName: 'testCollection',
        constraints: [],
        parser: testParser,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'doc1', name: 'Doc 1' });
      expect(result[1]).toEqual({ id: 'doc2', name: 'Doc 2' });
    });

    it('should filter out documents that fail parsing', async () => {
      const mockDocs = [
        { id: 'doc1', data: () => ({ name: 'Doc 1' }) },
        { id: 'doc2', data: () => ({ invalid: 'data' }) }, // Will fail parsing
        { id: 'doc3', data: () => ({ name: 'Doc 3' }) },
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});

      const result = await queryDocuments({
        collectionName: 'testCollection',
        constraints: [],
        parser: testParser,
      });

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toEqual(['doc1', 'doc3']);
    });

    it('should return empty array when no documents match', async () => {
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
      (collection as jest.Mock).mockReturnValue({});
      (query as jest.Mock).mockReturnValue({});

      const result = await queryDocuments({
        collectionName: 'testCollection',
        constraints: [],
        parser: testParser,
      });

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // verifyOwnership
  // ==========================================================================
  describe('verifyOwnership', () => {
    const ownerParser: DocumentParser<TestDocument> = (data) => {
      if (data.id && data.name && data.ownerId) {
        return data as unknown as TestDocument;
      }
      return null;
    };

    it('should return document when user is owner', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: 'doc1',
        data: () => ({ name: 'Test', ownerId: 'user1' }),
      });

      const result = await verifyOwnership({
        collectionName: 'testCollection',
        documentId: 'doc1',
        parser: ownerParser,
        ownerField: 'ownerId',
        userId: 'user1',
      });

      expect(result.data.ownerId).toBe('user1');
    });

    it('should throw PermissionError when user is not owner', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: 'doc1',
        data: () => ({ name: 'Test', ownerId: 'user1' }),
      });

      await expect(
        verifyOwnership({
          collectionName: 'testCollection',
          documentId: 'doc1',
          parser: ownerParser,
          ownerField: 'ownerId',
          userId: 'user2', // Different user
          permissionErrorMessage: '권한이 없습니다',
        })
      ).rejects.toThrow(PermissionError);
    });
  });

  // ==========================================================================
  // batchGetDocuments
  // ==========================================================================
  describe('batchGetDocuments', () => {
    it('should return Map with successfully fetched documents', async () => {
      (getDoc as jest.Mock)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'doc1',
          data: () => ({ name: 'Doc 1' }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'doc2',
          data: () => ({ name: 'Doc 2' }),
        });

      const result = await batchGetDocuments({
        collectionName: 'testCollection',
        documentIds: ['doc1', 'doc2'],
        parser: testParser,
      });

      expect(result.size).toBe(2);
      expect(result.get('doc1')).toEqual({ id: 'doc1', name: 'Doc 1' });
      expect(result.get('doc2')).toEqual({ id: 'doc2', name: 'Doc 2' });
    });

    it('should handle missing documents gracefully', async () => {
      (getDoc as jest.Mock)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'doc1',
          data: () => ({ name: 'Doc 1' }),
        })
        .mockResolvedValueOnce({
          exists: () => false, // Document doesn't exist
        });

      const result = await batchGetDocuments({
        collectionName: 'testCollection',
        documentIds: ['doc1', 'doc2'],
        parser: testParser,
      });

      expect(result.size).toBe(1);
      expect(result.has('doc1')).toBe(true);
      expect(result.has('doc2')).toBe(false);
    });

    it('should deduplicate document IDs', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: 'doc1',
        data: () => ({ name: 'Doc 1' }),
      });

      await batchGetDocuments({
        collectionName: 'testCollection',
        documentIds: ['doc1', 'doc1', 'doc1'],
        parser: testParser,
      });

      // Should only call getDoc once due to deduplication
      expect(getDoc).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // getDocRef
  // ==========================================================================
  describe('getDocRef', () => {
    it('should create document reference', () => {
      const ref = getDocRef('testCollection', 'doc1');
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'testCollection', 'doc1');
      expect(ref).toEqual({ path: 'testCollection/doc1' });
    });
  });
});
