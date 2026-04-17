/**
 * UNIQN Mobile - Supabase Storage 서비스
 *
 * @description 이미지 업로드 및 관리 (프로필, 공지사항, 게시판)
 * @version 2.0.0
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { ValidationError, AppError, ERROR_CODES, toError, isAppError } from '@/errors';
import { computeBlurhash } from '@/utils/blurhash';
import type { AnnouncementImage } from '@/types';

// ============================================================================
// Constants
// ============================================================================

/** 최대 이미지 크기 (5MB) */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 프로필 이미지 리사이즈 크기 (px) */
const PROFILE_IMAGE_SIZE = 500;

/** 공지사항/게시판 이미지 리사이즈 최대 너비 (px) */
const ANNOUNCEMENT_IMAGE_MAX_WIDTH = 1200;

/** 이미지 압축 품질 (0-1) */
const IMAGE_QUALITY = 0.8;

/** 비공개 버킷 서명 URL 유효기간 (1년, 초 단위) */
const SIGNED_URL_EXPIRY = 31536000;

// ============================================================================
// Types
// ============================================================================

export interface UploadResult {
  downloadURL: string;
  path: string;
  /**
   * impeccable v2 §18 — blurhash placeholder 해시(~30자).
   * 계산 실패 시 null(업로드 자체는 성공). 소비자는 optional 로 취급.
   */
  blurhash: string | null;
}

interface ImageResizeOptions {
  width: number;
  height?: number;
}

/**
 * impeccable v2 §18 — 업로드와 병렬로 blurhash 계산.
 * 실패 시 null 로 fallback(업로드는 막지 않음).
 */
async function computeBlurhashSafe(uri: string): Promise<string | null> {
  try {
    return await computeBlurhash(uri);
  } catch (error) {
    logger.warn('blurhash 계산 실패 — null fallback', { error: toError(error).message });
    return null;
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * 이미지 리사이즈 + 압축 + 크기 검증
 *
 * @param uri 로컬 이미지 URI
 * @param options 리사이즈 옵션
 * @returns 처리된 이미지 Blob
 */
async function prepareImage(uri: string, options: ImageResizeOptions): Promise<Blob> {
  const resizeAction: ImageManipulator.Action = options.height
    ? { resize: { width: options.width, height: options.height } }
    : { resize: { width: options.width } };

  const manipulatedImage = await ImageManipulator.manipulateAsync(uri, [resizeAction], {
    compress: IMAGE_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const response = await fetch(manipulatedImage.uri);
  const blob = await response.blob();

  if (blob.size > MAX_IMAGE_SIZE) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: '이미지 크기가 5MB를 초과합니다',
    });
  }

  return blob;
}

/**
 * Supabase Storage에 이미지 업로드 후 URL 반환
 *
 * @param bucket 버킷 이름
 * @param filePath 버킷 내 파일 경로
 * @param blob 업로드할 Blob
 * @param isPublicBucket 공개 버킷 여부
 * @returns 업로드 결과 (URL + 경로)
 */
async function uploadToStorage(
  bucket: string,
  filePath: string,
  blob: Blob,
  isPublicBucket: boolean
): Promise<Pick<UploadResult, 'downloadURL' | 'path'>> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    throw new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      userMessage: '이미지 업로드에 실패했습니다',
      originalError: new Error(uploadError.message),
    });
  }

  let downloadURL: string;

  if (isPublicBucket) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    downloadURL = data.publicUrl;
  } else {
    const { data, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (signedError || !data) {
      throw new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
        userMessage: '이미지 URL 생성에 실패했습니다',
        originalError: new Error(signedError?.message ?? '서명 URL 생성 실패'),
      });
    }
    downloadURL = data.signedUrl;
  }

  return { downloadURL, path: filePath };
}

/**
 * Supabase Storage에서 이미지 삭제 (not-found는 무시)
 *
 * @param bucket 버킷 이름
 * @param filePath 버킷 내 파일 경로
 */
async function deleteFromStorage(bucket: string, filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);

  if (error) {
    // 이미 삭제된 경우 무시
    if (error.message?.includes('Not found') || error.message?.includes('not found')) {
      logger.warn('이미지가 이미 삭제됨', { bucket, filePath });
      return;
    }
    throw error;
  }
}

/**
 * 이미지 URL에서 Storage 상대 경로 추출
 *
 * Firebase Storage URL과 Supabase Storage URL 모두 지원 (마이그레이션 기간)
 *
 * @param imageUrl 이미지 URL 또는 직접 경로
 * @param expectedBucket 예상 버킷 이름 (경로 검증용)
 * @returns 버킷 내 상대 경로 또는 null (경로 추출 실패 시)
 */
function extractStoragePath(imageUrl: string, expectedBucket: string): string | null {
  let imagePath = imageUrl;

  // Firebase Storage URL 처리
  if (imageUrl.includes('firebasestorage.googleapis.com')) {
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
    if (pathMatch) {
      imagePath = decodeURIComponent(pathMatch[1]);
    }
  }

  // Supabase Storage URL 처리
  // 형식: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  // 또는: https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>
  if (imageUrl.includes('supabase.co/storage/v1/object/')) {
    const match = imageUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/);
    if (match) {
      imagePath = decodeURIComponent(match[1]);
    }
  }

  // Firebase 경로 형식: "profile-images/userId/timestamp.jpg" → 버킷 prefix 제거
  if (imagePath.startsWith(`${expectedBucket}/`)) {
    return imagePath.substring(expectedBucket.length + 1);
  }

  // 이미 상대 경로인 경우 (Supabase 업로드 후 저장된 경우)
  // 예: "userId/timestamp.jpg"
  if (!imagePath.includes('/storage/v1/') && !imagePath.includes('firebasestorage')) {
    // 버킷 prefix가 없는 순수 상대 경로
    if (!imagePath.startsWith('http')) {
      return imagePath;
    }
  }

  logger.warn('이미지 경로 추출 실패', { imageUrl: imageUrl.substring(0, 80), expectedBucket });
  return null;
}

// ============================================================================
// Profile Image Service
// ============================================================================

/**
 * 프로필 이미지 업로드
 *
 * @param userId 사용자 ID
 * @param uri 로컬 이미지 URI
 * @returns 업로드된 이미지의 다운로드 URL
 */
export async function uploadProfileImage(userId: string, uri: string): Promise<UploadResult> {
  try {
    logger.info('프로필 이미지 업로드 시작', { userId });

    const blob = await prepareImage(uri, { width: PROFILE_IMAGE_SIZE, height: PROFILE_IMAGE_SIZE });

    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.jpg`;

    const [result, blurhash] = await Promise.all([
      uploadToStorage('profile-images', filePath, blob, true),
      computeBlurhashSafe(uri),
    ]);

    logger.info('프로필 이미지 업로드 성공', {
      userId,
      path: result.path,
      hasBlurhash: !!blurhash,
    });

    return { ...result, blurhash };
  } catch (error) {
    logger.error('프로필 이미지 업로드 실패', toError(error), { userId });

    if (isAppError(error)) {
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

    const filePath = extractStoragePath(imageUrl, 'profile-images');
    if (!filePath) {
      logger.warn('프로필 이미지 경로가 아님', { imageUrl: imageUrl.substring(0, 50) });
      return;
    }

    await deleteFromStorage('profile-images', filePath);

    logger.info('프로필 이미지 삭제 성공', { filePath });
  } catch (error) {
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
): Promise<UploadResult> {
  // 1. 새 이미지 업로드 먼저 (실패 시 이전 이미지 보존)
  const result = await uploadProfileImage(userId, newImageUri);

  // 2. 업로드 성공 후 이전 이미지 삭제 (삭제 실패는 deleteProfileImage 내부에서 무시)
  if (oldImageUrl) {
    await deleteProfileImage(oldImageUrl);
  }

  return result;
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

    const blob = await prepareImage(uri, { width: ANNOUNCEMENT_IMAGE_MAX_WIDTH });
    onProgress?.(40);

    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.jpg`;
    onProgress?.(50);

    const [result, blurhash] = await Promise.all([
      uploadToStorage('announcements', filePath, blob, true),
      computeBlurhashSafe(uri),
    ]);
    onProgress?.(100);

    logger.info('공지사항 이미지 업로드 성공', {
      userId,
      path: result.path,
      hasBlurhash: !!blurhash,
    });

    return { ...result, blurhash };
  } catch (error) {
    logger.error('공지사항 이미지 업로드 실패', toError(error), { userId });

    if (isAppError(error)) {
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

    const filePath = extractStoragePath(imageUrl, 'announcements');
    if (!filePath) {
      logger.warn('공지사항 이미지 경로가 아님', { imageUrl: imageUrl.substring(0, 50) });
      return;
    }

    await deleteFromStorage('announcements', filePath);

    logger.info('공지사항 이미지 삭제 성공', { filePath });
  } catch (error) {
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
        blurhash: result.blurhash,
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
export async function deleteMultipleAnnouncementImages(images: AnnouncementImage[]): Promise<void> {
  const deletePromises = images.map((image) =>
    deleteAnnouncementImage(image.url).catch((error) => {
      logger.warn('다중 이미지 삭제 중 실패', { url: image.url.substring(0, 50), error });
    })
  );

  await Promise.all(deletePromises);
  logger.info('다중 공지사항 이미지 삭제 완료', { count: images.length });
}

// ============================================================================
// Board Image Service
// ============================================================================

/**
 * 게시판 이미지 업로드 (비공개 버킷)
 *
 * @param userId 작성자 ID
 * @param uri 로컬 이미지 URI
 * @param onProgress 업로드 진행률 콜백 (0-100)
 * @returns 업로드된 이미지의 서명된 URL 및 경로
 */
export async function uploadBoardImage(
  userId: string,
  uri: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    logger.info('게시판 이미지 업로드 시작', { userId });
    onProgress?.(0);

    const blob = await prepareImage(uri, { width: ANNOUNCEMENT_IMAGE_MAX_WIDTH });
    onProgress?.(40);

    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.jpg`;
    onProgress?.(50);

    const [result, blurhash] = await Promise.all([
      uploadToStorage('boards', filePath, blob, false),
      computeBlurhashSafe(uri),
    ]);
    onProgress?.(100);

    logger.info('게시판 이미지 업로드 성공', {
      userId,
      path: result.path,
      hasBlurhash: !!blurhash,
    });

    return { ...result, blurhash };
  } catch (error) {
    logger.error('게시판 이미지 업로드 실패', toError(error), { userId });

    if (isAppError(error)) {
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
 * 게시판 이미지 삭제
 *
 * @param imageUrl 삭제할 이미지 URL 또는 Storage 경로
 */
export async function deleteBoardImage(imageUrl: string): Promise<void> {
  try {
    logger.info('게시판 이미지 삭제 시작', { imageUrl: imageUrl.substring(0, 50) });

    const filePath = extractStoragePath(imageUrl, 'boards');
    if (!filePath) {
      logger.warn('게시판 이미지 경로가 아님', { imageUrl: imageUrl.substring(0, 50) });
      return;
    }

    await deleteFromStorage('boards', filePath);

    logger.info('게시판 이미지 삭제 성공', { filePath });
  } catch (error) {
    logger.error('게시판 이미지 삭제 실패', toError(error));
    // 삭제 실패는 무시
  }
}

/**
 * 게시판 이미지 여러 개 업로드
 *
 * @param userId 작성자 ID
 * @param uris 로컬 이미지 URI 배열
 * @param onProgress 업로드 진행률 콜백 (index, progress)
 * @returns 업로드된 이미지 배열
 */
export async function uploadMultipleBoardImages(
  userId: string,
  uris: string[],
  onProgress?: (index: number, progress: number) => void
): Promise<AnnouncementImage[]> {
  const results: AnnouncementImage[] = [];

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    try {
      const result = await uploadBoardImage(userId, uri, (progress) => {
        onProgress?.(i, progress);
      });

      results.push({
        id: `${Date.now()}-${i}`,
        url: result.downloadURL,
        storagePath: result.path,
        order: i,
        blurhash: result.blurhash,
      });
    } catch (error) {
      logger.error('게시판 다중 이미지 업로드 중 실패', toError(error), { userId, index: i });
    }
  }

  return results;
}

/**
 * 게시판 이미지 여러 개 삭제
 *
 * @param images 삭제할 이미지 배열
 */
export async function deleteMultipleBoardImages(images: AnnouncementImage[]): Promise<void> {
  const deletePromises = images.map((image) =>
    deleteBoardImage(image.storagePath || image.url).catch((error) => {
      logger.warn('게시판 다중 이미지 삭제 중 실패', { url: image.url.substring(0, 50), error });
    })
  );

  await Promise.all(deletePromises);
  logger.info('게시판 다중 이미지 삭제 완료', { count: images.length });
}
