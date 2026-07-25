/**
 * UNIQN Mobile - Storage Service Tests
 *
 * @description Supabase Storage 서비스 테스트
 * @version 2.0.0
 *
 * 업로드 계약: manipulateAsync(base64: true) → base64 → ArrayBuffer 업로드.
 * RN에서 fetch(file://)→Blob 경로는 0바이트 파일을 만들었다(2026-07-24 실측 회귀).
 */

import {
  uploadProfileImage,
  deleteProfileImage,
  replaceProfileImage,
  uploadAnnouncementImage,
  uploadBoardImage,
  deleteAnnouncementImage,
  deleteBoardImage,
  replaceAnnouncementImage,
  uploadMultipleAnnouncementImages,
  uploadMultipleBoardImages,
  deleteMultipleAnnouncementImages,
  deleteMultipleBoardImages,
} from '../storageService';

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockUploadBytes = jest.fn();
const mockGetDownloadURL = jest.fn();
const mockDeleteObject = jest.fn();

const mockManipulateAsync = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: (...args: unknown[]) => mockUploadBytes(...args),
        getPublicUrl: (...args: unknown[]) => mockGetDownloadURL(...args),
        remove: (...args: unknown[]) => mockDeleteObject(...args),
        createSignedUrl: jest
          .fn()
          .mockResolvedValue({ data: { signedUrl: 'https://test.com/signed' }, error: null }),
      })),
    },
  },
}));

/**
 * Helper: Supabase getPublicUrl returns { data: { publicUrl } } synchronously
 */
function mockPublicUrl(url: string) {
  return { data: { publicUrl: url } };
}

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

/** size 바이트짜리 유효 base64 페이로드 (내용은 JPEG가 아니므로 blurhash는 null fallback) */
function base64Of(size: number): string {
  return Buffer.alloc(size, 7).toString('base64');
}

/** manipulateAsync 성공 결과 (base64 동봉 — 업로드 계약) */
function mockManipulated(size: number) {
  return { uri: 'file:///resized.jpg', base64: base64Of(size) };
}

/** 마지막 upload 호출의 body가 정확히 size 바이트인 ArrayBuffer인지 검증 */
function expectUploadedBytes(size: number) {
  const [, body, options] = mockUploadBytes.mock.calls[mockUploadBytes.mock.calls.length - 1];
  expect(body).toBeInstanceOf(ArrayBuffer);
  expect((body as ArrayBuffer).byteLength).toBe(size);
  expect(options).toEqual({ contentType: 'image/jpeg', upsert: false });
}

// ============================================================================
// Tests
// ============================================================================

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Profile Image
  // ==========================================================================

  describe('uploadProfileImage', () => {
    const userId = 'user-123';
    const imageUri = 'file:///path/to/image.jpg';

    it('프로필 이미지를 성공적으로 업로드해야 함', async () => {
      const downloadURL = 'https://storage.example.com/profile.jpg';

      mockManipulateAsync.mockResolvedValue(mockManipulated(1024 * 1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl(downloadURL));

      const result = await uploadProfileImage(userId, imageUri);

      expect(result.downloadURL).toBe(downloadURL);
      expect(result.path).toContain(userId);
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        imageUri,
        [{ resize: { width: 500, height: 500 } }],
        { compress: 0.8, format: 'jpeg', base64: true }
      );
      expect(mockUploadBytes).toHaveBeenCalled();
    });

    it('업로드 body는 base64를 디코딩한 실제 바이트여야 함 (0바이트 업로드 회귀 방지)', async () => {
      mockManipulateAsync.mockResolvedValue(mockManipulated(2048));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl('https://url.jpg'));

      await uploadProfileImage(userId, imageUri);

      expectUploadedBytes(2048);
    });

    it('manipulator가 base64를 반환하지 않으면 업로드 없이 에러를 던져야 함', async () => {
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
      expect(mockUploadBytes).not.toHaveBeenCalled();
    });

    it('디코딩 결과가 0바이트면 업로드 없이 에러를 던져야 함', async () => {
      mockManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg', base64: '' });

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
      expect(mockUploadBytes).not.toHaveBeenCalled();
    });

    it('5MB를 초과하는 이미지는 거부해야 함', async () => {
      mockManipulateAsync.mockResolvedValue(mockManipulated(6 * 1024 * 1024));

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
      expect(mockUploadBytes).not.toHaveBeenCalled();
    });

    it('이미지 리사이징 실패 시 에러를 던져야 함', async () => {
      mockManipulateAsync.mockRejectedValue(new Error('Resize failed'));

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
    });

    it('업로드 실패 시 에러를 던져야 함', async () => {
      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: { message: 'Upload failed' } });

      await expect(uploadProfileImage(userId, imageUri)).rejects.toThrow();
    });
  });

  describe('deleteProfileImage', () => {
    it('프로필 이미지를 성공적으로 삭제해야 함', async () => {
      const imageUrl =
        'https://firebasestorage.googleapis.com/v0/b/bucket/o/profile-images%2Fuser-123%2F123.jpg?token=abc';

      mockDeleteObject.mockResolvedValue({ error: null });

      await deleteProfileImage(imageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('직접 경로를 사용하여 삭제해야 함', async () => {
      const imagePath = 'profile-images/user-123/123.jpg';

      mockDeleteObject.mockResolvedValue({ error: null });

      await deleteProfileImage(imagePath);

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('http URL이지만 스토리지 경로를 추출할 수 없는 경우 삭제하지 않아야 함', async () => {
      const invalidPath = 'https://unknown-domain.com/image.jpg';

      await deleteProfileImage(invalidPath);

      expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it('이미 삭제된 이미지는 무시해야 함', async () => {
      const imageUrl = 'profile-images/user-123/123.jpg';

      mockDeleteObject.mockResolvedValue({ error: { message: 'Not found' } });

      await expect(deleteProfileImage(imageUrl)).resolves.not.toThrow();
    });

    it('삭제 실패 시 무시하고 계속 진행해야 함', async () => {
      const imageUrl = 'profile-images/user-123/123.jpg';

      mockDeleteObject.mockResolvedValue({ error: { message: 'Delete failed' } });

      await expect(deleteProfileImage(imageUrl)).resolves.not.toThrow();
    });
  });

  describe('replaceProfileImage', () => {
    const userId = 'user-123';
    const newImageUri = 'file:///new.jpg';
    const oldImageUrl = 'profile-images/user-123/old.jpg';

    it('이전 이미지를 삭제하고 새 이미지를 업로드해야 함', async () => {
      mockDeleteObject.mockResolvedValue({ error: null });
      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl('https://new-url.jpg'));

      const result = await replaceProfileImage(userId, newImageUri, oldImageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
      expect(mockUploadBytes).toHaveBeenCalled();
      expect(result.downloadURL).toBe('https://new-url.jpg');
      expect(result.blurhash).toBeNull();
    });

    it('이전 이미지가 없으면 바로 업로드해야 함', async () => {
      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl('https://new-url.jpg'));

      const result = await replaceProfileImage(userId, newImageUri, null);

      expect(mockDeleteObject).not.toHaveBeenCalled();
      expect(mockUploadBytes).toHaveBeenCalled();
      expect(result.downloadURL).toBe('https://new-url.jpg');
      expect(result.blurhash).toBeNull();
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

      mockManipulateAsync.mockResolvedValue(mockManipulated(2 * 1024 * 1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl(downloadURL));

      const result = await uploadAnnouncementImage(userId, imageUri);

      expect(result.downloadURL).toBe(downloadURL);
      expect(result.path).toContain(userId);
      expect(mockManipulateAsync).toHaveBeenCalledWith(imageUri, [{ resize: { width: 1200 } }], {
        compress: 0.8,
        format: 'jpeg',
        base64: true,
      });
    });

    it('진행률 콜백을 호출해야 함', async () => {
      const onProgress = jest.fn();

      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl('https://url.jpg'));

      await uploadAnnouncementImage(userId, imageUri, onProgress);

      expect(onProgress).toHaveBeenCalledWith(0);
      expect(onProgress).toHaveBeenCalledWith(40);
      expect(onProgress).toHaveBeenCalledWith(50);
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it('5MB 초과 시 에러를 던져야 함', async () => {
      mockManipulateAsync.mockResolvedValue(mockManipulated(6 * 1024 * 1024));

      await expect(uploadAnnouncementImage(userId, imageUri)).rejects.toThrow();
    });
  });

  describe('deleteAnnouncementImage', () => {
    it('공지사항 이미지를 성공적으로 삭제해야 함', async () => {
      const imageUrl = 'announcements/admin-123/image.jpg';

      mockDeleteObject.mockResolvedValue({ error: null });

      await deleteAnnouncementImage(imageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('http URL이지만 스토리지 경로를 추출할 수 없는 경우 삭제하지 않아야 함', async () => {
      const invalidPath = 'https://unknown-domain.com/image.jpg';

      await deleteAnnouncementImage(invalidPath);

      expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it('Firebase Storage URL에서 경로를 추출해야 함', async () => {
      const imageUrl =
        'https://firebasestorage.googleapis.com/v0/b/bucket/o/announcements%2Fadmin%2Fimage.jpg?token=xyz';

      mockDeleteObject.mockResolvedValue({ error: null });

      await deleteAnnouncementImage(imageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('이미 삭제된 이미지는 무시해야 함', async () => {
      const imageUrl = 'announcements/admin-123/image.jpg';

      mockDeleteObject.mockResolvedValue({ error: { message: 'Not found' } });

      await expect(deleteAnnouncementImage(imageUrl)).resolves.not.toThrow();
    });
  });

  describe('replaceAnnouncementImage', () => {
    const userId = 'admin-123';
    const newImageUri = 'file:///new.jpg';
    const oldImageUrl = 'announcements/admin-123/old.jpg';

    it('이전 이미지를 삭제하고 새 이미지를 업로드해야 함', async () => {
      const newUrl = 'https://new-url.jpg';

      mockDeleteObject.mockResolvedValue({ error: null });
      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl(newUrl));

      const result = await replaceAnnouncementImage(userId, newImageUri, oldImageUrl);

      expect(mockDeleteObject).toHaveBeenCalled();
      expect(result.downloadURL).toBe(newUrl);
    });

    it('진행률 콜백을 전달해야 함', async () => {
      const onProgress = jest.fn();

      mockDeleteObject.mockResolvedValue({ error: null });
      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl('https://url.jpg'));

      await replaceAnnouncementImage(userId, newImageUri, oldImageUrl, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('uploadBoardImage', () => {
    const userId = 'staff-123';
    const imageUri = 'file:///board.jpg';

    it('stores board images under the boards path', async () => {
      mockManipulateAsync.mockResolvedValue(mockManipulated(2 * 1024 * 1024));
      mockUploadBytes.mockResolvedValue({ error: null });

      const result = await uploadBoardImage(userId, imageUri);

      // boards bucket uses createSignedUrl (private), URL comes from the mock
      expect(result.downloadURL).toBe('https://test.com/signed');
      expect(result.path).toContain(userId);
    });
  });

  describe('deleteBoardImage', () => {
    it('deletes only board storage paths', async () => {
      mockDeleteObject.mockResolvedValue({ error: null });

      await deleteBoardImage('boards/staff-123/image.jpg');

      expect(mockDeleteObject).toHaveBeenCalled();
    });

    it('ignores non-board http URLs', async () => {
      await deleteBoardImage('https://unknown-domain.com/image.jpg');

      expect(mockDeleteObject).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Multiple Images
  // ==========================================================================

  describe('uploadMultipleAnnouncementImages', () => {
    const userId = 'admin-123';
    const uris = ['file:///img1.jpg', 'file:///img2.jpg', 'file:///img3.jpg'];

    it('여러 이미지를 순차적으로 업로드해야 함', async () => {
      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL
        .mockReturnValueOnce(mockPublicUrl('https://url1.jpg'))
        .mockReturnValueOnce(mockPublicUrl('https://url2.jpg'))
        .mockReturnValueOnce(mockPublicUrl('https://url3.jpg'));

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

      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL.mockReturnValue(mockPublicUrl('https://url.jpg'));

      await uploadMultipleAnnouncementImages(userId, uris, onProgress);

      expect(onProgress).toHaveBeenCalledWith(0, expect.any(Number));
      expect(onProgress).toHaveBeenCalledWith(1, expect.any(Number));
      expect(onProgress).toHaveBeenCalledWith(2, expect.any(Number));
    });

    it('일부 이미지 업로드 실패 시 계속 진행해야 함', async () => {
      // impeccable v2 §18 — 각 이미지는 prepareImage(upload) + computeBlurhash 로
      // manipulateAsync 를 2번 호출한다. 2번째 이미지의 prepareImage 단계에서 거부하면
      // 해당 이미지 업로드 전체 실패로 처리되어 결과 배열에서 제외된다.
      mockManipulateAsync
        // 이미지 1: prepareImage + computeBlurhash
        .mockResolvedValueOnce(mockManipulated(1024))
        .mockResolvedValueOnce({ uri: 'file:///thumb1.jpg', base64: base64Of(64) })
        // 이미지 2: prepareImage 실패 → 업로드 중단
        .mockRejectedValueOnce(new Error('Resize failed'))
        // 이미지 3: prepareImage + computeBlurhash
        .mockResolvedValueOnce(mockManipulated(1024))
        .mockResolvedValueOnce({ uri: 'file:///thumb3.jpg', base64: base64Of(64) });

      mockUploadBytes.mockResolvedValue({ error: null });
      mockGetDownloadURL
        .mockReturnValueOnce(mockPublicUrl('https://url1.jpg'))
        .mockReturnValueOnce(mockPublicUrl('https://url3.jpg'));

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

  describe('uploadMultipleBoardImages', () => {
    const userId = 'staff-123';
    const uris = ['file:///img1.jpg', 'file:///img2.jpg'];

    it('preserves board image ordering', async () => {
      mockManipulateAsync.mockResolvedValue(mockManipulated(1024));
      mockUploadBytes.mockResolvedValue({ error: null });
      // boards use createSignedUrl (private), already mocked globally

      const results = await uploadMultipleBoardImages(userId, uris);

      expect(results).toHaveLength(2);
      expect(results[0].storagePath).toContain(userId);
      expect(results[0].order).toBe(0);
      expect(results[1].order).toBe(1);
    });
  });

  describe('deleteMultipleAnnouncementImages', () => {
    it('여러 이미지를 병렬로 삭제해야 함', async () => {
      const images = [
        {
          id: '1',
          url: 'announcements/admin/1.jpg',
          storagePath: 'announcements/admin/1.jpg',
          order: 0,
        },
        {
          id: '2',
          url: 'announcements/admin/2.jpg',
          storagePath: 'announcements/admin/2.jpg',
          order: 1,
        },
        {
          id: '3',
          url: 'announcements/admin/3.jpg',
          storagePath: 'announcements/admin/3.jpg',
          order: 2,
        },
      ];

      mockDeleteObject.mockResolvedValue({ error: null });

      await deleteMultipleAnnouncementImages(images);

      expect(mockDeleteObject).toHaveBeenCalledTimes(3);
    });

    it('일부 삭제 실패 시 계속 진행해야 함', async () => {
      const images = [
        {
          id: '1',
          url: 'announcements/admin/1.jpg',
          storagePath: 'announcements/admin/1.jpg',
          order: 0,
        },
        {
          id: '2',
          url: 'announcements/admin/2.jpg',
          storagePath: 'announcements/admin/2.jpg',
          order: 1,
        },
      ];

      mockDeleteObject
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'Delete failed' } });

      await expect(deleteMultipleAnnouncementImages(images)).resolves.not.toThrow();
    });

    it('빈 배열을 처리해야 함', async () => {
      await expect(deleteMultipleAnnouncementImages([])).resolves.not.toThrow();
    });
  });
  describe('deleteMultipleBoardImages', () => {
    it('uses the saved board storage path when deleting images', async () => {
      const images = [
        {
          id: '1',
          url: 'https://example.com/not-a-storage-url.jpg',
          storagePath: 'boards/staff-1/1.jpg',
          order: 0,
        },
      ];

      mockDeleteObject.mockResolvedValue({ error: null });

      await deleteMultipleBoardImages(images);

      expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    });

    it('handles empty board image lists', async () => {
      await expect(deleteMultipleBoardImages([])).resolves.not.toThrow();
    });
  });
});
