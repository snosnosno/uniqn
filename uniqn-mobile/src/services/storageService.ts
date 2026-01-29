/**
 * UNIQN Mobile - Firebase Storage 서비스
 *
 * @description 프로필 이미지 업로드 및 관리
 * @version 1.0.0
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { getFirebaseStorage } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { ValidationError, AppError, ERROR_CODES, toError } from '@/errors';
import type { AnnouncementImage } from '@/types';

// ============================================================================
// Constants
// ============================================================================

/** 최대 이미지 크기 (5MB) */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 프로필 이미지 리사이즈 크기 (px) */
const PROFILE_IMAGE_SIZE = 500;

/** 공지사항 이미지 리사이즈 최대 너비 (px) */
const ANNOUNCEMENT_IMAGE_MAX_WIDTH = 1200;

/** 이미지 압축 품질 (0-1) */
const IMAGE_QUALITY = 0.8;

// ============================================================================
// Types
// ============================================================================

export interface UploadResult {
  downloadURL: string;
  path: string;
}

// ============================================================================
// Storage Service
// ============================================================================

/**
 * 프로필 이미지 업로드
 *
 * @param userId 사용자 ID
 * @param uri 로컬 이미지 URI
 * @returns 업로드된 이미지의 다운로드 URL
 */
export async function uploadProfileImage(
  userId: string,
  uri: string
): Promise<UploadResult> {
  try {
    logger.info('프로필 이미지 업로드 시작', { userId });

    // 1. 이미지 리사이징 및 압축
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: PROFILE_IMAGE_SIZE, height: PROFILE_IMAGE_SIZE } }],
      {
        compress: IMAGE_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // 2. 이미지 파일 가져오기
    const response = await fetch(manipulatedImage.uri);
    const blob = await response.blob();

    // 3. 파일 크기 검증
    if (blob.size > MAX_IMAGE_SIZE) {
      throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage: '이미지 크기가 5MB를 초과합니다',
      });
    }

    // 4. Firebase Storage에 업로드
    const storage = getFirebaseStorage();
    const timestamp = Date.now();
    const path = `profile-images/${userId}/${timestamp}.jpg`;
    const imageRef = ref(storage, path);

    await uploadBytes(imageRef, blob, {
      contentType: 'image/jpeg',
    });

    // 5. 다운로드 URL 반환
    const downloadURL = await getDownloadURL(imageRef);

    logger.info('프로필 이미지 업로드 성공', { userId, path });

    return { downloadURL, path };
  } catch (error) {
    logger.error('프로필 이미지 업로드 실패', toError(error), { userId });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      userMessage: '이미지 업로드에 실패했습니다',
      originalError: toError(error),
    });
  }
}

/**
 * 프로필 이미지 삭제
 *
 * @param imageUrl 삭제할 이미지 URL 또는 Storage 경로
 */
export async function deleteProfileImage(imageUrl: string): Promise<void> {
  try {
    logger.info('프로필 이미지 삭제 시작', { imageUrl: imageUrl.substring(0, 50) });

    const storage = getFirebaseStorage();

    // URL에서 경로 추출 또는 직접 경로 사용
    let imagePath = imageUrl;

    // Firebase Storage URL인 경우 경로 추출
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
      // URL 디코딩하여 경로 추출
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        imagePath = decodeURIComponent(pathMatch[1]);
      }
    }

    // profile-images로 시작하는 경로만 삭제 허용 (보안)
    if (!imagePath.startsWith('profile-images/')) {
      logger.warn('프로필 이미지 경로가 아님', { imagePath });
      return;
    }

    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);

    logger.info('프로필 이미지 삭제 성공', { imagePath });
  } catch (error) {
    // 이미 삭제된 경우 무시 (object-not-found)
    const errorCode = (error as { code?: string }).code;
    if (errorCode === 'storage/object-not-found') {
      logger.warn('이미지가 이미 삭제됨', { imageUrl: imageUrl.substring(0, 50) });
      return;
    }

    logger.error('프로필 이미지 삭제 실패', toError(error));
    // 삭제 실패는 무시 (업로드 성공이 더 중요)
  }
}

/**
 * 이전 프로필 이미지 삭제 후 새 이미지 업로드
 *
 * @param userId 사용자 ID
 * @param newImageUri 새 이미지 URI
 * @param oldImageUrl 이전 이미지 URL (선택)
 * @returns 새 이미지의 다운로드 URL
 */
export async function replaceProfileImage(
  userId: string,
  newImageUri: string,
  oldImageUrl?: string | null
): Promise<string> {
  // 1. 이전 이미지 삭제 (있는 경우)
  if (oldImageUrl) {
    await deleteProfileImage(oldImageUrl);
  }

  // 2. 새 이미지 업로드
  const result = await uploadProfileImage(userId, newImageUri);

  return result.downloadURL;
}

// ============================================================================
// Announcement Image Service
// ============================================================================

/**
 * 공지사항 이미지 업로드
 *
 * @param userId 작성자 ID
 * @param uri 로컬 이미지 URI
 * @param onProgress 업로드 진행률 콜백 (0-100)
 * @returns 업로드된 이미지의 다운로드 URL 및 경로
 */
export async function uploadAnnouncementImage(
  userId: string,
  uri: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    logger.info('공지사항 이미지 업로드 시작', { userId });
    onProgress?.(0);

    // 1. 이미지 리사이징 및 압축 (가로 기준, 비율 유지)
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: ANNOUNCEMENT_IMAGE_MAX_WIDTH } }],
      {
        compress: IMAGE_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    onProgress?.(20);

    // 2. 이미지 파일 가져오기
    const response = await fetch(manipulatedImage.uri);
    const blob = await response.blob();
    onProgress?.(40);

    // 3. 파일 크기 검증
    if (blob.size > MAX_IMAGE_SIZE) {
      throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage: '이미지 크기가 5MB를 초과합니다',
      });
    }

    // 4. Firebase Storage에 업로드
    const storage = getFirebaseStorage();
    const timestamp = Date.now();
    const path = `announcements/${userId}/${timestamp}.jpg`;
    const imageRef = ref(storage, path);
    onProgress?.(50);

    await uploadBytes(imageRef, blob, {
      contentType: 'image/jpeg',
    });
    onProgress?.(80);

    // 5. 다운로드 URL 반환
    const downloadURL = await getDownloadURL(imageRef);
    onProgress?.(100);

    logger.info('공지사항 이미지 업로드 성공', { userId, path });

    return { downloadURL, path };
  } catch (error) {
    logger.error('공지사항 이미지 업로드 실패', toError(error), { userId });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      userMessage: '이미지 업로드에 실패했습니다',
      originalError: toError(error),
    });
  }
}

/**
 * 공지사항 이미지 삭제
 *
 * @param imageUrl 삭제할 이미지 URL 또는 Storage 경로
 */
export async function deleteAnnouncementImage(imageUrl: string): Promise<void> {
  try {
    logger.info('공지사항 이미지 삭제 시작', { imageUrl: imageUrl.substring(0, 50) });

    const storage = getFirebaseStorage();

    // URL에서 경로 추출 또는 직접 경로 사용
    let imagePath = imageUrl;

    // Firebase Storage URL인 경우 경로 추출
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        imagePath = decodeURIComponent(pathMatch[1]);
      }
    }

    // announcements로 시작하는 경로만 삭제 허용 (보안)
    if (!imagePath.startsWith('announcements/')) {
      logger.warn('공지사항 이미지 경로가 아님', { imagePath });
      return;
    }

    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);

    logger.info('공지사항 이미지 삭제 성공', { imagePath });
  } catch (error) {
    // 이미 삭제된 경우 무시 (object-not-found)
    const errorCode = (error as { code?: string }).code;
    if (errorCode === 'storage/object-not-found') {
      logger.warn('이미지가 이미 삭제됨', { imageUrl: imageUrl.substring(0, 50) });
      return;
    }

    logger.error('공지사항 이미지 삭제 실패', toError(error));
    // 삭제 실패는 무시 (업로드 성공이 더 중요)
  }
}

/**
 * 공지사항 이미지 교체 (이전 이미지 삭제 후 새 이미지 업로드)
 *
 * @param userId 작성자 ID
 * @param newImageUri 새 이미지 URI
 * @param oldImageUrl 이전 이미지 URL (선택)
 * @param onProgress 업로드 진행률 콜백 (0-100)
 * @returns 새 이미지의 다운로드 URL 및 경로
 */
export async function replaceAnnouncementImage(
  userId: string,
  newImageUri: string,
  oldImageUrl?: string | null,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  // 1. 이전 이미지 삭제 (있는 경우)
  if (oldImageUrl) {
    await deleteAnnouncementImage(oldImageUrl);
  }

  // 2. 새 이미지 업로드
  const result = await uploadAnnouncementImage(userId, newImageUri, onProgress);

  return result;
}

// ============================================================================
// Multiple Announcement Images
// ============================================================================

/**
 * 공지사항 이미지 여러 개 업로드
 *
 * @param userId 작성자 ID
 * @param uris 로컬 이미지 URI 배열
 * @param onProgress 업로드 진행률 콜백 (index, progress)
 * @returns 업로드된 이미지 배열
 */
export async function uploadMultipleAnnouncementImages(
  userId: string,
  uris: string[],
  onProgress?: (index: number, progress: number) => void
): Promise<AnnouncementImage[]> {
  const results: AnnouncementImage[] = [];

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    try {
      const result = await uploadAnnouncementImage(userId, uri, (progress) => {
        onProgress?.(i, progress);
      });

      results.push({
        id: `${Date.now()}-${i}`,
        url: result.downloadURL,
        storagePath: result.path,
        order: i,
      });
    } catch (error) {
      logger.error('다중 이미지 업로드 중 실패', toError(error), { userId, index: i });
      // 개별 업로드 실패는 건너뛰고 계속 진행
    }
  }

  return results;
}

/**
 * 공지사항 이미지 여러 개 삭제
 *
 * @param images 삭제할 이미지 배열
 */
export async function deleteMultipleAnnouncementImages(
  images: AnnouncementImage[]
): Promise<void> {
  const deletePromises = images.map((image) =>
    deleteAnnouncementImage(image.url).catch((error) => {
      logger.warn('다중 이미지 삭제 중 실패', { url: image.url.substring(0, 50), error });
    })
  );

  await Promise.all(deletePromises);
  logger.info('다중 공지사항 이미지 삭제 완료', { count: images.length });
}
