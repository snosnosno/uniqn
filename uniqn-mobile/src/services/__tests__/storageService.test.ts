/**
 * UNIQN Mobile - Storage Service Tests
 *
 * @description Firebase Storage 서비스 테스트
 * @version 1.0.0
 */

import {
  uploadProfileImage,
  deleteProfileImage,
  replaceProfileImage,
  uploadAnnouncementImage,
  deleteAnnouncementImage,
  replaceAnnouncementImage,
  uploadMultipleAnnouncementImages,
  deleteMultipleAnnouncementImages,
} from '../storageService';
import type { UploadResult } from '../storageService';

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockUploadBytes = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockDeleteObject = jest.fn();
const mockRef = jest.fn();

jest.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

const mockManipulateAsync = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

const mockGetFirebaseStorage = jest.fn();

jest.mock('@/lib/firebase', () => ({
  getFirebaseStorage: () => mockGetFirebaseStorage(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

global.fetch = jest.fn();

// ============================================================================
// Test Helpers
// ============================================================================

function createMockBlob(size: number): Blob {
  return {
    size,
    type: 'image/jpeg',
  } as Blob;
}

// ============================================================================
// Tests
// ============================================================================

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirebaseStorage.mockReturnValue({});
    mockRef.mockReturnValue({ toString: () => 'mock-ref' });
  });

  // ==========================================================================
  // Profile Image
  // ==========================================================================

  describe('uploadProfileImage', () => {
    const userId = 'user-123';
    const imageUri = 'file:///path/to/image.jpg';

    it('프로필 이미지를 성공적으로 업로드해야 함', async () => {
      const manipulatedUri = 'file:///path/to/resized.jpg';
      const downloadURL = 'https://storage.example.com/profile.jpg';

      mockManipulateAsync.mockResolvedValue({ uri: manipulatedUri });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024 * 1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockResolvedValue(downloadURL);

      const result = await uploadProfileImage(userId, imageUri);

      expect(result.downloadURL).toBe(downloadURL);
      expect(result.path).toContain('profile-images/');
      expect(result.path).toContain(userId);
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        imageUri,
        [{ resize: { width: 500, height: 500 } }],
        { compress: 0.8, format: 'jpeg' }
      );
      expect(mockUploadBytes).toHaveBeenCalled();
    });

    it('5MB를 초과하는 이미지는 거부해야 함', async () => {
      const manipulatedUri = 'file:///path/to/resized.jpg';

      mockManipulateAsync.mockResolvedValue({ uri: manipulatedUri });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(6 * 1024 * 1024)),
      });

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
    });

    it('이미지 리사이징 실패 시 에러를 던져야 함', async () => {
      mockManipulateAsync.mockRejectedValue(new Error('Resize failed'));

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
    });

    it('네트워크 에러 시 AppError를 던져야 함', async () => {
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
    });

    it('업로드 실패 시 에러를 던져야 함', async () => {
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockRejectedValue(new Error('Upload failed'));

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
    });

    it('다운로드 URL 가져오기 실패 시 에러를 던져야 함', async () => {
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockRejectedValue(new Error('GetURL failed'));

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
    });
  });

  describe('deleteProfileImage', () => {
    it('프로필 이미지를 성공적으로 삭제해야 함', async () => {
      const imageUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/profile-images%2Fuser-123%2F123.jpg?token=abc';

      mockDeleteObject.mockResolvedValue(undefined);

      await deleteProfileImage(imageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('직접 경로를 사용하여 삭제해야 함', async () => {
      const imagePath = 'profile-images/user-123/123.jpg';

      mockDeleteObject.mockResolvedValue(undefined);

      await deleteProfileImage(imagePath);

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('profile-images로 시작하지 않는 경로는 삭제하지 않아야 함', async () => {
      const invalidPath = 'invalid/path/image.jpg';

      await deleteProfileImage(invalidPath);

      expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it('이미 삭제된 이미지는 무시해야 함', async () => {
      const imageUrl = 'profile-images/user-123/123.jpg';
      const error = new Error('Not found') as Error & { code?: string };
      error.code = 'storage/object-not-found';

      mockDeleteObject.mockRejectedValue(error);

      await expect(deleteProfileImage(imageUrl)).resolves.not.toThrow();
    });

    it('삭제 실패 시 무시하고 계속 진행해야 함', async () => {
      const imageUrl = 'profile-images/user-123/123.jpg';

      mockDeleteObject.mockRejectedValue(new Error('Delete failed'));

      await expect(deleteProfileImage(imageUrl)).resolves.not.toThrow();
    });
  });

  describe('replaceProfileImage', () => {
    const userId = 'user-123';
    const newImageUri = 'file:///new.jpg';
    const oldImageUrl = 'profile-images/user-123/old.jpg';

    it('이전 이미지를 삭제하고 새 이미지를 업로드해야 함', async () => {
      mockDeleteObject.mockResolvedValue(undefined);
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockResolvedValue('https://new-url.jpg');

      const result = await replaceProfileImage(userId, newImageUri, oldImageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
      expect(mockUploadBytes).toHaveBeenCalled();
      expect(result).toBe('https://new-url.jpg');
    });

    it('이전 이미지가 없으면 바로 업로드해야 함', async () => {
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockResolvedValue('https://new-url.jpg');

      const result = await replaceProfileImage(userId, newImageUri, null);

      expect(mockDeleteObject).not.toHaveBeenCalled();
      expect(mockUploadBytes).toHaveBeenCalled();
      expect(result).toBe('https://new-url.jpg');
    });
  });

  // ==========================================================================
  // Announcement Image
  // ==========================================================================

  describe('uploadAnnouncementImage', () => {
    const userId = 'admin-123';
    const imageUri = 'file:///announcement.jpg';

    it('공지사항 이미지를 성공적으로 업로드해야 함', async () => {
      const downloadURL = 'https://storage.example.com/announcement.jpg';

      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(2 * 1024 * 1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockResolvedValue(downloadURL);

      const result = await uploadAnnouncementImage(userId, imageUri);

      expect(result.downloadURL).toBe(downloadURL);
      expect(result.path).toContain('announcements/');
      expect(result.path).toContain(userId);
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: 'jpeg' }
      );
    });

    it('진행률 콜백을 호출해야 함', async () => {
      const onProgress = jest.fn();

      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockResolvedValue('https://url.jpg');

      await uploadAnnouncementImage(userId, imageUri, onProgress);

      expect(onProgress).toHaveBeenCalledWith(0);
      expect(onProgress).toHaveBeenCalledWith(20);
      expect(onProgress).toHaveBeenCalledWith(40);
      expect(onProgress).toHaveBeenCalledWith(50);
      expect(onProgress).toHaveBeenCalledWith(80);
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it('5MB 초과 시 에러를 던져야 함', async () => {
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(6 * 1024 * 1024)),
      });

      await expect(uploadAnnouncementImage(userId, imageUri)).rejects.toThrow();
    });
  });

  describe('deleteAnnouncementImage', () => {
    it('공지사항 이미지를 성공적으로 삭제해야 함', async () => {
      const imageUrl = 'announcements/admin-123/image.jpg';

      mockDeleteObject.mockResolvedValue(undefined);

      await deleteAnnouncementImage(imageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('announcements로 시작하지 않는 경로는 삭제하지 않아야 함', async () => {
      const invalidPath = 'profile-images/user/image.jpg';

      await deleteAnnouncementImage(invalidPath);

      expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it('Firebase Storage URL에서 경로를 추출해야 함', async () => {
      const imageUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/announcements%2Fadmin%2Fimage.jpg?token=xyz';

      mockDeleteObject.mockResolvedValue(undefined);

      await deleteAnnouncementImage(imageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('이미 삭제된 이미지는 무시해야 함', async () => {
      const imageUrl = 'announcements/admin-123/image.jpg';
      const error = new Error('Not found') as Error & { code?: string };
      error.code = 'storage/object-not-found';

      mockDeleteObject.mockRejectedValue(error);

      await expect(deleteAnnouncementImage(imageUrl)).resolves.not.toThrow();
    });
  });

  describe('replaceAnnouncementImage', () => {
    const userId = 'admin-123';
    const newImageUri = 'file:///new.jpg';
    const oldImageUrl = 'announcements/admin-123/old.jpg';

    it('이전 이미지를 삭제하고 새 이미지를 업로드해야 함', async () => {
      const newUrl = 'https://new-url.jpg';

      mockDeleteObject.mockResolvedValue(undefined);
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockResolvedValue(newUrl);

      const result = await replaceAnnouncementImage(userId, newImageUri, oldImageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
      expect(result.downloadURL).toBe(newUrl);
    });

    it('진행률 콜백을 전달해야 함', async () => {
      const onProgress = jest.fn();

      mockDeleteObject.mockResolvedValue(undefined);
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockResolvedValue('https://url.jpg');

      await replaceAnnouncementImage(userId, newImageUri, oldImageUrl, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Multiple Images
  // ==========================================================================

  describe('uploadMultipleAnnouncementImages', () => {
    const userId = 'admin-123';
    const uris = ['file:///img1.jpg', 'file:///img2.jpg', 'file:///img3.jpg'];

    it('여러 이미지를 순차적으로 업로드해야 함', async () => {
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL
        .mockResolvedValueOnce('https://url1.jpg')
        .mockResolvedValueOnce('https://url2.jpg')
        .mockResolvedValueOnce('https://url3.jpg');

      const results = await uploadMultipleAnnouncementImages(userId, uris);

      expect(results).toHaveLength(3);
      expect(results[0].url).toBe('https://url1.jpg');
      expect(results[1].url).toBe('https://url2.jpg');
      expect(results[2].url).toBe('https://url3.jpg');
      expect(results[0].order).toBe(0);
      expect(results[1].order).toBe(1);
      expect(results[2].order).toBe(2);
    });

    it('진행률 콜백을 각 이미지마다 호출해야 함', async () => {
      const onProgress = jest.fn();

      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL.mockResolvedValue('https://url.jpg');

      await uploadMultipleAnnouncementImages(userId, uris, onProgress);

      expect(onProgress).toHaveBeenCalledWith(0, expect.any(Number));
      expect(onProgress).toHaveBeenCalledWith(1, expect.any(Number));
      expect(onProgress).toHaveBeenCalledWith(2, expect.any(Number));
    });

    it('일부 이미지 업로드 실패 시 계속 진행해야 함', async () => {
      mockManipulateAsync
        .mockResolvedValueOnce({ uri: 'file:///resized1.jpg' })
        .mockRejectedValueOnce(new Error('Resize failed'))
        .mockResolvedValueOnce({ uri: 'file:///resized3.jpg' });

      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(createMockBlob(1024)),
      });
      mockUploadBytes.mockResolvedValue({});
      mockGetDownloadURL
        .mockResolvedValueOnce('https://url1.jpg')
        .mockResolvedValueOnce('https://url3.jpg');

      const results = await uploadMultipleAnnouncementImages(userId, uris);

      expect(results).toHaveLength(2);
      expect(results[0].order).toBe(0);
      expect(results[1].order).toBe(2);
    });

    it('빈 배열을 처리해야 함', async () => {
      const results = await uploadMultipleAnnouncementImages(userId, []);

      expect(results).toHaveLength(0);
    });
  });

  describe('deleteMultipleAnnouncementImages', () => {
    it('여러 이미지를 병렬로 삭제해야 함', async () => {
      const images = [
        { id: '1', url: 'announcements/admin/1.jpg', storagePath: 'announcements/admin/1.jpg', order: 0 },
        { id: '2', url: 'announcements/admin/2.jpg', storagePath: 'announcements/admin/2.jpg', order: 1 },
        { id: '3', url: 'announcements/admin/3.jpg', storagePath: 'announcements/admin/3.jpg', order: 2 },
      ];

      mockDeleteObject.mockResolvedValue(undefined);

      await deleteMultipleAnnouncementImages(images);

      expect(mockDeleteObject).toHaveBeenCalledTimes(3);
    });

    it('일부 삭제 실패 시 계속 진행해야 함', async () => {
      const images = [
        { id: '1', url: 'announcements/admin/1.jpg', storagePath: 'announcements/admin/1.jpg', order: 0 },
        { id: '2', url: 'announcements/admin/2.jpg', storagePath: 'announcements/admin/2.jpg', order: 1 },
      ];

      mockDeleteObject
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'));

      await expect(deleteMultipleAnnouncementImages(images)).resolves.not.toThrow();
    });

    it('빈 배열을 처리해야 함', async () => {
      await expect(deleteMultipleAnnouncementImages([])).resolves.not.toThrow();
    });
  });
});
