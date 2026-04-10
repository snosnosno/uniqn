# Phase 3-1: Storage Buckets + storageService + versionService 이전

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firebase Storage → Supabase Storage, Firebase Remote Config → Supabase app_config 테이블로 전환

**Architecture:** Supabase Storage API로 이미지 업로드/삭제/URL 생성을 교체하고, versionService는 Supabase `app_config` 테이블에서 버전 정보를 조회하도록 변경

**Tech Stack:** @supabase/supabase-js (storage, from), expo-image-manipulator, React Native Platform API

---

## 현재 상태

- **Storage 버킷**: Supabase에 0개 (생성 필요)
- **storageService.ts** (522줄): Firebase Storage API 사용 — profile-images, announcements, boards 3개 경로
- **versionService.ts** (259줄): Firestore `appVersions/{platform}` 문서 조회
- **app_config 테이블**: 이미 존재, 3개 행 (`force_update_version`, `maintenance_mode`, `feature_flags`)
  - `force_update_version.value` = `{ios: "1.0.0", web: "1.0.0", android: "1.0.0"}` (minVersion만 있음)
  - 누락: `latestVersion`, `recommendedVersion`, `releaseNotes` per platform

## 파일 맵

| 액션 | 파일                                  | 역할                                            |
| ---- | ------------------------------------- | ----------------------------------------------- |
| SQL  | Supabase Migration                    | 9개 Storage 버킷 + RLS + app_config 데이터 보강 |
| 수정 | `src/services/auth/storageService.ts` | Firebase → Supabase Storage API                 |
| 수정 | `src/services/versionService.ts`      | Firestore → Supabase `app_config` 조회          |

---

### Task 1: Storage 버킷 + RLS 정책 생성 (SQL Migration)

**Files:**

- Supabase Migration (apply_migration)

- [ ] **Step 1: 9개 Storage 버킷 생성 + RLS 정책 적용**

```sql
-- ============================================================================
-- Storage Buckets
-- ============================================================================

-- 1. profile-images (공개 읽기, 본인 쓰기, 5MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-images', 'profile-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- 2. job-postings (인증 읽기, employer/admin 쓰기, 10MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-postings', 'job-postings', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- 3. announcements (공개 읽기, 본인/admin 쓰기, 5MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('announcements', 'announcements', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- 4. boards (인증 읽기, 본인 쓰기, 5MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('boards', 'boards', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- 5. chat (인증 읽기, 인증 쓰기, 20MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat', 'chat', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

-- 6. id-verification (본인/admin 읽기, 본인 쓰기, 10MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('id-verification', 'id-verification', false, 10485760, ARRAY['image/jpeg', 'image/png']);

-- 7. qr-codes (본인/admin 읽기, 본인 쓰기, 1MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('qr-codes', 'qr-codes', false, 1048576, ARRAY['image/png', 'image/svg+xml']);

-- 8. receipts (본인/admin 읽기, service_role만 쓰기)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']);

-- 9. exports (본인만 읽기, service_role만 쓰기)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exports', 'exports', false, 52428800, ARRAY['application/json', 'text/csv', 'application/zip']);

-- 10. temp (본인 읽기/쓰기, 20MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('temp', 'temp', false, 20971520, NULL);

-- ============================================================================
-- Helper: admin 여부 판별 함수
-- ============================================================================

CREATE OR REPLACE FUNCTION storage.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

CREATE OR REPLACE FUNCTION storage.is_employer_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'employer'),
    false
  );
$$;

-- ============================================================================
-- RLS Policies: profile-images (public bucket)
-- ============================================================================

-- 공개 읽기는 public bucket이므로 별도 정책 불필요
-- 본인 폴더만 쓰기
CREATE POLICY "profile_images_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "profile_images_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "profile_images_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- RLS Policies: job-postings (private bucket)
-- ============================================================================

CREATE POLICY "job_postings_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'job-postings');

CREATE POLICY "job_postings_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'job-postings'
  AND storage.is_employer_or_admin()
);

CREATE POLICY "job_postings_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'job-postings'
  AND storage.is_employer_or_admin()
);

CREATE POLICY "job_postings_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'job-postings'
  AND storage.is_employer_or_admin()
);

-- ============================================================================
-- RLS Policies: announcements (public bucket)
-- ============================================================================

CREATE POLICY "announcements_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'announcements'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR storage.is_admin()
  )
);

CREATE POLICY "announcements_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'announcements'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR storage.is_admin()
  )
);

CREATE POLICY "announcements_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'announcements'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR storage.is_admin()
  )
);

-- ============================================================================
-- RLS Policies: boards (private bucket)
-- ============================================================================

CREATE POLICY "boards_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'boards');

CREATE POLICY "boards_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'boards'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "boards_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'boards'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "boards_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'boards'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- RLS Policies: chat (private bucket)
-- ============================================================================

CREATE POLICY "chat_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat');

CREATE POLICY "chat_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat');

CREATE POLICY "chat_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat');

CREATE POLICY "chat_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat');

-- ============================================================================
-- RLS Policies: id-verification (private bucket)
-- ============================================================================

CREATE POLICY "id_verification_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'id-verification'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR storage.is_admin()
  )
);

CREATE POLICY "id_verification_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'id-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "id_verification_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'id-verification'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR storage.is_admin()
  )
);

-- ============================================================================
-- RLS Policies: qr-codes (private bucket)
-- ============================================================================

CREATE POLICY "qr_codes_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR storage.is_admin()
  )
);

CREATE POLICY "qr_codes_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "qr_codes_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- RLS Policies: receipts (본인/admin 읽기, service_role만 쓰기)
-- ============================================================================

CREATE POLICY "receipts_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR storage.is_admin()
  )
);
-- INSERT/UPDATE/DELETE: service_role만 가능 (RLS bypass) → 정책 불필요

-- ============================================================================
-- RLS Policies: exports (본인만 읽기, service_role만 쓰기)
-- ============================================================================

CREATE POLICY "exports_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- RLS Policies: temp (본인 읽기/쓰기)
-- ============================================================================

CREATE POLICY "temp_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "temp_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "temp_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

- [ ] **Step 2: apply_migration으로 실행**

Run: Supabase MCP `apply_migration` (name: `create_storage_buckets_and_policies`)

- [ ] **Step 3: 검증 쿼리 실행**

```sql
-- 버킷 10개 확인
SELECT id, name, public, file_size_limit FROM storage.buckets ORDER BY name;

-- 정책 확인
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
```

Expected: 10개 버킷, 약 28개 정책

---

### Task 2: app_config 데이터 보강 (versionService 지원)

**Files:**

- Supabase Migration (apply_migration)

- [ ] **Step 1: app_config에 버전 관련 추가 행 INSERT**

현재 `force_update_version`은 minVersion만 저장. versionService가 필요로 하는 `latestVersion`, `recommendedVersion`, `releaseNotes`를 추가 행으로 생성:

```sql
-- latestVersion per platform
INSERT INTO public.app_config (key, value, description)
VALUES (
  'latest_version',
  '{"ios": "1.0.0", "web": "1.0.0", "android": "1.0.0"}'::jsonb,
  '각 플랫폼 최신 버전'
)
ON CONFLICT (key) DO NOTHING;

-- recommendedVersion per platform
INSERT INTO public.app_config (key, value, description)
VALUES (
  'recommended_version',
  '{"ios": "1.0.0", "web": "1.0.0", "android": "1.0.0"}'::jsonb,
  '각 플랫폼 권장 업데이트 버전'
)
ON CONFLICT (key) DO NOTHING;

-- releaseNotes per platform
INSERT INTO public.app_config (key, value, description)
VALUES (
  'release_notes',
  '{"ios": "", "web": "", "android": ""}'::jsonb,
  '각 플랫폼 릴리즈 노트'
)
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: apply_migration으로 실행**

Run: Supabase MCP `apply_migration` (name: `add_version_config_rows`)

- [ ] **Step 3: 검증**

```sql
SELECT key, value FROM public.app_config ORDER BY key;
```

Expected: 6개 행 (feature_flags, force_update_version, latest_version, maintenance_mode, recommended_version, release_notes)

---

### Task 3: storageService.ts → Supabase Storage API 교체

**Files:**

- Modify: `src/services/auth/storageService.ts` (전체 재작성)

- [ ] **Step 1: storageService.ts를 Supabase Storage API로 교체**

Firebase Storage → Supabase Storage 매핑:

- `ref(storage, path)` + `uploadBytes()` → `supabase.storage.from(bucket).upload(path, blob)`
- `getDownloadURL(ref)` → `supabase.storage.from(bucket).getPublicUrl(path)` (public) 또는 `createSignedUrl(path, expiresIn)` (private)
- `deleteObject(ref)` → `supabase.storage.from(bucket).remove([path])`

```typescript
/**
 * UNIQN Mobile - Supabase Storage 서비스
 *
 * @description 이미지 업로드/삭제/교체 (Supabase Storage)
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { ValidationError, AppError, ERROR_CODES, toError, isAppError } from '@/errors';
import type { AnnouncementImage } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_SIZE = 500;
const ANNOUNCEMENT_IMAGE_MAX_WIDTH = 1200;
const IMAGE_QUALITY = 0.8;

// ============================================================================
// Types
// ============================================================================

export interface UploadResult {
  downloadURL: string;
  path: string;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * 이미지 리사이징 + blob 변환 공용 헬퍼
 */
async function prepareImage(
  uri: string,
  options: { width: number; height?: number }
): Promise<Blob> {
  const resize: ImageManipulator.Action[] = options.height
    ? [{ resize: { width: options.width, height: options.height } }]
    : [{ resize: { width: options.width } }];

  const manipulated = await ImageManipulator.manipulateAsync(uri, resize, {
    compress: IMAGE_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();

  if (blob.size > MAX_IMAGE_SIZE) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: '이미지 크기가 5MB를 초과합니다',
    });
  }

  return blob;
}

/**
 * Supabase Storage에 이미지 업로드 (public/private 자동 분기)
 */
async function uploadToStorage(
  bucket: string,
  filePath: string,
  blob: Blob,
  isPublicBucket: boolean
): Promise<UploadResult> {
  const { error } = await supabase.storage.from(bucket).upload(filePath, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw new AppError({
      code: ERROR_CODES.FIREBASE_STORAGE,
      category: 'firebase',
      userMessage: '이미지 업로드에 실패했습니다',
      originalError: new Error(error.message),
    });
  }

  let downloadURL: string;
  if (isPublicBucket) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    downloadURL = data.publicUrl;
  } else {
    const { data, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1년
    if (signedError || !data) {
      throw new AppError({
        code: ERROR_CODES.FIREBASE_STORAGE,
        category: 'firebase',
        userMessage: '이미지 URL 생성에 실패했습니다',
        originalError: new Error(signedError?.message ?? 'Unknown error'),
      });
    }
    downloadURL = data.signedUrl;
  }

  return { downloadURL, path: filePath };
}

/**
 * Supabase Storage에서 파일 삭제
 */
async function deleteFromStorage(bucket: string, filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);

  if (error) {
    // object not found는 무시
    if (error.message?.includes('not found') || error.message?.includes('Not Found')) {
      logger.warn('이미지가 이미 삭제됨', { bucket, filePath });
      return;
    }
    logger.error('이미지 삭제 실패', new Error(error.message), { bucket, filePath });
  }
}

/**
 * Supabase Storage URL 또는 경로에서 버킷 내 상대 경로 추출
 */
function extractStoragePath(imageUrl: string, expectedBucket: string): string | null {
  // 이미 상대 경로인 경우 (예: "userId/timestamp.jpg")
  if (!imageUrl.startsWith('http')) {
    return imageUrl;
  }

  // Supabase Storage URL 패턴: .../storage/v1/object/public|sign/bucket/path
  try {
    const url = new URL(imageUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
    if (match && match[1] === expectedBucket) {
      return decodeURIComponent(match[2]);
    }
  } catch {
    // URL 파싱 실패
  }

  // Firebase Storage URL 레거시 지원
  if (imageUrl.includes('firebasestorage.googleapis.com')) {
    try {
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        const fullPath = decodeURIComponent(pathMatch[1]);
        // "profile-images/userId/file.jpg" → "userId/file.jpg"
        const prefix = `${expectedBucket}/`;
        if (fullPath.startsWith(prefix)) {
          return fullPath.substring(prefix.length);
        }
      }
    } catch {
      // URL 파싱 실패
    }
  }

  return null;
}

// ============================================================================
// Profile Image
// ============================================================================

export async function uploadProfileImage(userId: string, uri: string): Promise<UploadResult> {
  try {
    logger.info('프로필 이미지 업로드 시작', { userId });

    const blob = await prepareImage(uri, {
      width: PROFILE_IMAGE_SIZE,
      height: PROFILE_IMAGE_SIZE,
    });

    const filePath = `${userId}/${Date.now()}.jpg`;
    const result = await uploadToStorage('profile-images', filePath, blob, true);

    logger.info('프로필 이미지 업로드 성공', { userId, path: result.path });
    return result;
  } catch (error) {
    logger.error('프로필 이미지 업로드 실패', toError(error), { userId });
    if (isAppError(error)) throw error;
    throw new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      userMessage: '이미지 업로드에 실패했습니다',
      originalError: toError(error),
    });
  }
}

export async function deleteProfileImage(imageUrl: string): Promise<void> {
  try {
    logger.info('프로필 이미지 삭제 시작', { imageUrl: imageUrl.substring(0, 50) });

    const filePath = extractStoragePath(imageUrl, 'profile-images');
    if (!filePath) {
      logger.warn('프로필 이미지 경로 추출 실패', { imageUrl: imageUrl.substring(0, 50) });
      return;
    }

    await deleteFromStorage('profile-images', filePath);
    logger.info('프로필 이미지 삭제 성공', { filePath });
  } catch (error) {
    logger.error('프로필 이미지 삭제 실패', toError(error));
  }
}

export async function replaceProfileImage(
  userId: string,
  newImageUri: string,
  oldImageUrl?: string | null
): Promise<string> {
  const result = await uploadProfileImage(userId, newImageUri);

  if (oldImageUrl) {
    await deleteProfileImage(oldImageUrl);
  }

  return result.downloadURL;
}

// ============================================================================
// Announcement Image
// ============================================================================

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

    const filePath = `${userId}/${Date.now()}.jpg`;
    onProgress?.(50);

    const result = await uploadToStorage('announcements', filePath, blob, true);
    onProgress?.(100);

    logger.info('공지사항 이미지 업로드 성공', { userId, path: result.path });
    return result;
  } catch (error) {
    logger.error('공지사항 이미지 업로드 실패', toError(error), { userId });
    if (isAppError(error)) throw error;
    throw new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      userMessage: '이미지 업로드에 실패했습니다',
      originalError: toError(error),
    });
  }
}

export async function deleteAnnouncementImage(imageUrl: string): Promise<void> {
  try {
    logger.info('공지사항 이미지 삭제 시작', { imageUrl: imageUrl.substring(0, 50) });

    const filePath = extractStoragePath(imageUrl, 'announcements');
    if (!filePath) {
      logger.warn('공지사항 이미지 경로 추출 실패', { imageUrl: imageUrl.substring(0, 50) });
      return;
    }

    await deleteFromStorage('announcements', filePath);
    logger.info('공지사항 이미지 삭제 성공', { filePath });
  } catch (error) {
    logger.error('공지사항 이미지 삭제 실패', toError(error));
  }
}

export async function replaceAnnouncementImage(
  userId: string,
  newImageUri: string,
  oldImageUrl?: string | null,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  if (oldImageUrl) {
    await deleteAnnouncementImage(oldImageUrl);
  }
  return uploadAnnouncementImage(userId, newImageUri, onProgress);
}

// ============================================================================
// Multiple Announcement Images
// ============================================================================

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
    }
  }

  return results;
}

export async function deleteMultipleAnnouncementImages(images: AnnouncementImage[]): Promise<void> {
  const deletePromises = images.map((image) =>
    deleteAnnouncementImage(image.storagePath || image.url).catch((error) => {
      logger.warn('다중 이미지 삭제 중 실패', {
        url: image.url.substring(0, 50),
        error,
      });
    })
  );

  await Promise.all(deletePromises);
  logger.info('다중 공지사항 이미지 삭제 완료', { count: images.length });
}

// ============================================================================
// Board Image
// ============================================================================

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

    const filePath = `${userId}/${Date.now()}.jpg`;
    onProgress?.(50);

    const result = await uploadToStorage('boards', filePath, blob, false);
    onProgress?.(100);

    logger.info('게시판 이미지 업로드 성공', { userId, path: result.path });
    return result;
  } catch (error) {
    logger.error('게시판 이미지 업로드 실패', toError(error), { userId });
    if (isAppError(error)) throw error;
    throw new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      userMessage: '이미지 업로드에 실패했습니다',
      originalError: toError(error),
    });
  }
}

export async function deleteBoardImage(imageUrl: string): Promise<void> {
  try {
    logger.info('게시판 이미지 삭제 시작', { imageUrl: imageUrl.substring(0, 50) });

    const filePath = extractStoragePath(imageUrl, 'boards');
    if (!filePath) {
      logger.warn('게시판 이미지 경로 추출 실패', { imageUrl: imageUrl.substring(0, 50) });
      return;
    }

    await deleteFromStorage('boards', filePath);
    logger.info('게시판 이미지 삭제 성공', { filePath });
  } catch (error) {
    logger.error('게시판 이미지 삭제 실패', toError(error));
  }
}

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
      });
    } catch (error) {
      logger.error('게시판 다중 이미지 업로드 실패', toError(error), { userId, index: i });
    }
  }

  return results;
}

export async function deleteMultipleBoardImages(images: AnnouncementImage[]): Promise<void> {
  const deletePromises = images.map((image) =>
    deleteBoardImage(image.storagePath || image.url).catch((error) => {
      logger.warn('게시판 다중 이미지 삭제 실패', {
        url: image.url.substring(0, 50),
        error,
      });
    })
  );

  await Promise.all(deletePromises);
  logger.info('게시판 다중 이미지 삭제 완료', { count: images.length });
}
```

- [ ] **Step 2: `npm run quality` 실행**

Run: `cd uniqn-mobile && npm run quality`
Expected: 0 에러

- [ ] **Step 3: 커밋**

```bash
git add src/services/auth/storageService.ts
git commit -m "refactor(mobile): storageService Firebase → Supabase Storage API 교체"
```

---

### Task 4: versionService.ts → Supabase app_config 조회로 교체

**Files:**

- Modify: `src/services/versionService.ts`

- [ ] **Step 1: versionService.ts Supabase 버전으로 교체**

Firebase Firestore `appVersions/{platform}` → Supabase `app_config` 테이블 (`force_update_version`, `latest_version`, `recommended_version`, `release_notes`, `maintenance_mode` 5개 행 조회)

```typescript
/**
 * UNIQN Mobile - 버전 관리 서비스
 *
 * @description 앱 버전 확인 및 강제 업데이트 체크 (Supabase app_config)
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { APP_VERSION, compareVersions, type UpdateType } from '@/constants/version';

const VERSION_CHECK_TIMEOUT_MS = Platform.OS === 'web' ? 3000 : 5000;

// ============================================================================
// Types
// ============================================================================

export interface RemoteVersionConfig {
  minVersion: string;
  latestVersion: string;
  recommendedVersion?: string;
  releaseNotes?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
}

export interface VersionCheckResult {
  updateType: UpdateType;
  mustUpdate: boolean;
  shouldUpdate: boolean;
  isMaintenanceMode: boolean;
  maintenanceMessage?: string;
  latestVersion?: string;
  releaseNotes?: string;
  currentVersion: string;
}

// ============================================================================
// Service
// ============================================================================

type PlatformKey = 'ios' | 'android' | 'web';

function getPlatformKey(): PlatformKey {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * Supabase app_config에서 원격 버전 설정 가져오기
 */
export async function getRemoteVersionConfig(): Promise<RemoteVersionConfig | null> {
  try {
    const platform = getPlatformKey();

    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [
        'force_update_version',
        'latest_version',
        'recommended_version',
        'release_notes',
        'maintenance_mode',
      ]);

    if (error) {
      logger.error('원격 버전 설정 로드 실패', new Error(error.message), {
        component: 'versionService',
      });
      return null;
    }

    if (!data || data.length === 0) {
      logger.warn('원격 버전 설정 없음', { component: 'versionService', platform });
      return null;
    }

    // key → value 맵으로 변환
    const configMap = new Map<string, Record<string, unknown>>();
    for (const row of data) {
      configMap.set(row.key, row.value as Record<string, unknown>);
    }

    const forceUpdate = configMap.get('force_update_version');
    const latestVer = configMap.get('latest_version');
    const recommendedVer = configMap.get('recommended_version');
    const releaseNotesData = configMap.get('release_notes');
    const maintenance = configMap.get('maintenance_mode');

    const config: RemoteVersionConfig = {
      minVersion: (forceUpdate?.[platform] as string) ?? '1.0.0',
      latestVersion: (latestVer?.[platform] as string) ?? '1.0.0',
      recommendedVersion: (recommendedVer?.[platform] as string) ?? undefined,
      releaseNotes: (releaseNotesData?.[platform] as string) ?? undefined,
      maintenanceMode: (maintenance?.enabled as boolean) ?? false,
      maintenanceMessage: (maintenance?.message as string) ?? '',
    };

    logger.debug('원격 버전 설정 로드', {
      component: 'versionService',
      platform,
      minVersion: config.minVersion,
      latestVersion: config.latestVersion,
    });

    return config;
  } catch (error) {
    logger.error(
      '원격 버전 설정 로드 실패',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'versionService' }
    );
    return null;
  }
}

/**
 * 강제 업데이트 체크
 */
export async function checkForceUpdate(): Promise<VersionCheckResult> {
  const currentVersion = APP_VERSION;

  const defaultResult: VersionCheckResult = {
    updateType: 'none',
    mustUpdate: false,
    shouldUpdate: false,
    isMaintenanceMode: false,
    currentVersion,
  };

  try {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const remoteConfig = await Promise.race([
      getRemoteVersionConfig(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), VERSION_CHECK_TIMEOUT_MS);
      }),
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!remoteConfig) {
      logger.info('원격 버전 설정 없음 - 업데이트 체크 스킵', {
        component: 'versionService',
        currentVersion,
      });
      return defaultResult;
    }

    if (remoteConfig.maintenanceMode) {
      logger.info('점검 모드 활성화', {
        component: 'versionService',
        message: remoteConfig.maintenanceMessage,
      });
      return {
        ...defaultResult,
        isMaintenanceMode: true,
        maintenanceMessage: remoteConfig.maintenanceMessage,
      };
    }

    const { minVersion, latestVersion, recommendedVersion, releaseNotes } = remoteConfig;

    const mustUpdate = compareVersions(currentVersion, minVersion) < 0;

    const shouldUpdate = recommendedVersion
      ? compareVersions(currentVersion, recommendedVersion) < 0
      : compareVersions(currentVersion, latestVersion) < 0;

    let updateType: UpdateType = 'none';
    if (mustUpdate) {
      updateType = 'required';
    } else if (shouldUpdate) {
      updateType = 'recommended';
    } else if (compareVersions(currentVersion, latestVersion) < 0) {
      updateType = 'optional';
    }

    const result: VersionCheckResult = {
      updateType,
      mustUpdate,
      shouldUpdate,
      isMaintenanceMode: false,
      latestVersion,
      releaseNotes,
      currentVersion,
    };

    logger.info('버전 체크 완료', {
      component: 'versionService',
      currentVersion,
      minVersion,
      latestVersion,
      updateType,
      mustUpdate,
    });

    return result;
  } catch (error) {
    logger.error('버전 체크 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'versionService',
      currentVersion,
    });
    return defaultResult;
  }
}

// ============================================================================
// Error Classes
// ============================================================================

export class ForceUpdateError extends Error {
  constructor(
    message: string,
    public readonly latestVersion?: string,
    public readonly releaseNotes?: string
  ) {
    super(message);
    this.name = 'ForceUpdateError';
    Object.setPrototypeOf(this, ForceUpdateError.prototype);
  }
}

export class MaintenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceError';
    Object.setPrototypeOf(this, MaintenanceError.prototype);
  }
}

export const isForceUpdateError = (error: unknown): error is ForceUpdateError => {
  return (
    error instanceof ForceUpdateError ||
    (error instanceof Error && error.name === 'ForceUpdateError')
  );
};

export const isMaintenanceError = (error: unknown): error is MaintenanceError => {
  return (
    error instanceof MaintenanceError ||
    (error instanceof Error && error.name === 'MaintenanceError')
  );
};

export default {
  getRemoteVersionConfig,
  checkForceUpdate,
};
```

- [ ] **Step 2: `npm run quality` 실행**

Run: `cd uniqn-mobile && npm run quality`
Expected: 0 에러

- [ ] **Step 3: 커밋**

```bash
git add src/services/versionService.ts
git commit -m "refactor(mobile): versionService Firestore → Supabase app_config 교체"
```

---

### Task 5: 최종 검증 + 통합 커밋

- [ ] **Step 1: Storage 버킷 + 정책 최종 확인**

```sql
SELECT id, name, public, file_size_limit FROM storage.buckets ORDER BY name;
SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
```

- [ ] **Step 2: app_config 행 확인**

```sql
SELECT key, value FROM public.app_config ORDER BY key;
```

- [ ] **Step 3: `npm run quality` 최종 통과 확인**

Run: `cd uniqn-mobile && npm run quality`
Expected: 0 에러

- [ ] **Step 4: Firebase import 잔여 확인**

```bash
grep -r "from 'firebase/storage'" src/services/auth/storageService.ts
grep -r "from 'firebase/firestore'" src/services/versionService.ts
grep -r "getFirebaseStorage\|getFirebaseDb" src/services/auth/storageService.ts src/services/versionService.ts
```

Expected: 0 matches (모든 Firebase import 제거 확인)
