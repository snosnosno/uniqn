/**
 * UNIQN Mobile - OptimizedImage 컴포넌트
 *
 * @description expo-image 기반 최적화된 이미지 컴포넌트
 * @version 1.0.0
 *
 * 기능:
 * - blurhash placeholder 지원
 * - 자동 캐싱 (memory-disk)
 * - 부드러운 전환 애니메이션
 * - 로딩/에러 상태 처리
 * - 접근성 지원
 */

import React, { memo, useState } from 'react';
import { View } from 'react-native';
import { Image, type ImageContentFit, type ImageProps } from 'expo-image';

// ============================================================================
// Constants
// ============================================================================

/**
 * 기본 blurhash 값들 (이미지 유형별)
 *
 * @see https://blurha.sh/ 에서 생성
 */
export const DEFAULT_BLURHASH = {
  /** 기본 그레이 placeholder */
  default: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
  /** 프로필 이미지용 (원형) */
  avatar: 'L5H2EC=PM+yV0g-mq.wG9c010J}@',
  /** 풍경/배너 이미지용 */
  landscape: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.',
  /** 상품/아이템 이미지용 */
  product: 'L4SPe,xu00Rj~qay4nof00fQ00j[',
  /** 밝은 배경 placeholder */
  light: 'L2S$~=-:00-:~WM{4nof00fQ00fQ',
  /** 어두운 배경 placeholder */
  dark: 'L02r;GWB00of~qay00fQ00fQ00fQ',
} as const;

export type BlurhashPreset = keyof typeof DEFAULT_BLURHASH;

// ============================================================================
// Types
// ============================================================================

export interface OptimizedImageProps {
  /** 이미지 URL 또는 require 경로 */
  source: string | number;
  /** 너비 (픽셀 또는 퍼센트) */
  width?: number | string;
  /** 높이 (픽셀 또는 퍼센트) */
  height?: number | string;
  /** 이미지 맞춤 방식 */
  contentFit?: ImageContentFit;
  /**
   * blurhash 문자열 (커스텀).
   * null/undefined 이면 `blurhashPreset` 기반 기본 해시가 자동 적용.
   * DB 선계산된 해시를 그대로 넘기면 해당 해시가 우선 적용.
   */
  blurhash?: string | null;
  /** blurhash 프리셋 */
  blurhashPreset?: BlurhashPreset;
  /** 전환 애니메이션 시간 (ms) */
  transition?: number;
  /** 캐시 정책 */
  cachePolicy?: ImageProps['cachePolicy'];
  /** 추가 스타일 클래스 */
  className?: string;
  /** 접근성 레이블 */
  alt?: string;
  /** 로딩 실패 시 콜백 */
  onError?: () => void;
  /** 로딩 완료 시 콜백 */
  onLoad?: () => void;
  /** 원형 이미지 여부 */
  rounded?: boolean;
  /** 테두리 radius */
  borderRadius?: number;
  /** 에러 시 폴백 이미지 */
  fallbackSource?: string | number;
  /** 우선순위 로딩 */
  priority?: ImageProps['priority'];
}

// ============================================================================
// Component
// ============================================================================

/**
 * OptimizedImage 컴포넌트
 *
 * expo-image 기반 최적화된 이미지 렌더링
 * - blurhash placeholder로 부드러운 로딩 경험
 * - memory-disk 캐싱으로 빠른 재로딩
 * - 에러 시 폴백 이미지 지원
 */
export const OptimizedImage = memo(function OptimizedImage({
  source,
  width,
  height,
  contentFit = 'cover',
  blurhash,
  blurhashPreset = 'default',
  transition = 200,
  cachePolicy = 'memory-disk',
  className = '',
  alt,
  onError,
  onLoad,
  rounded = false,
  borderRadius,
  fallbackSource,
  priority,
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);

  // blurhash 결정: 커스텀 > 프리셋 > 기본
  const placeholder = blurhash ?? DEFAULT_BLURHASH[blurhashPreset];

  // 에러 발생 시 폴백 처리
  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // 표시할 소스 결정
  const displaySource = hasError && fallbackSource ? fallbackSource : source;

  // 스타일 클래스 조합
  const roundedClass = rounded ? 'rounded-sm overflow-hidden' : '';
  const combinedClassName = `${roundedClass} ${className}`.trim();

  return (
    <View
      style={{
        width: typeof width === 'number' ? width : undefined,
        height: typeof height === 'number' ? height : undefined,
        borderRadius: rounded ? 9999 : borderRadius,
        overflow: 'hidden',
      }}
      className={combinedClassName}
    >
      <Image
        source={displaySource}
        style={{
          width: '100%',
          height: '100%',
        }}
        contentFit={contentFit}
        placeholder={{ blurhash: placeholder }}
        placeholderContentFit="cover"
        transition={transition}
        cachePolicy={cachePolicy}
        onError={handleError}
        onLoad={onLoad}
        accessibilityLabel={alt}
        priority={priority}
      />
    </View>
  );
});

// ============================================================================
// Utility Components
// ============================================================================

/**
 * 아바타 이미지 (원형)
 */
export const AvatarImage = memo(function AvatarImage(
  props: Omit<OptimizedImageProps, 'rounded' | 'blurhashPreset'>
) {
  return <OptimizedImage {...props} rounded blurhashPreset="avatar" />;
});

/**
 * 배너/썸네일 이미지 (가로형)
 */
export const BannerImage = memo(function BannerImage(
  props: Omit<OptimizedImageProps, 'blurhashPreset'>
) {
  return <OptimizedImage {...props} blurhashPreset="landscape" />;
});

/**
 * 상품/아이템 이미지
 */
export const ProductImage = memo(function ProductImage(
  props: Omit<OptimizedImageProps, 'blurhashPreset'>
) {
  return <OptimizedImage {...props} blurhashPreset="product" />;
});

// ============================================================================
// Blurhash Utilities
// ============================================================================

/**
 * blurhash 생성 가이드 (impeccable v2 §18 / D4)
 *
 * **클라이언트 선계산** 방식이 프로젝트 표준.
 * 업로드 직전 `computeBlurhash(uri)` 로 해시를 생성 → 이미지와 함께 DB 저장.
 *
 * @example
 * ```tsx
 * import { computeBlurhash } from '@/utils/blurhash';
 * import { uploadImage } from '@/services/storage';
 *
 * async function uploadProfilePhoto(uri: string, userId: string) {
 *   // 병렬: 업로드와 해시 계산을 동시에 진행해 UX 지연 최소화
 *   const [uploadResult, blurhash] = await Promise.all([
 *     uploadImage(uri),
 *     computeBlurhash(uri).catch(() => null), // 실패해도 업로드는 진행
 *   ]);
 *
 *   await supabase
 *     .from('users')
 *     .update({ photo_url: uploadResult.url, photo_url_blurhash: blurhash })
 *     .eq('id', userId);
 * }
 * ```
 *
 * 소비 시:
 *
 * ```tsx
 * <OptimizedImage source={user.photoUrl} blurhash={user.photoUrlBlurhash} />
 * ```
 *
 * `blurhash` 가 null 이면 `blurhashPreset` 의 기본값이 자동 적용.
 */
export const BLURHASH_GENERATION_NOTE = `
Blurhash 는 클라이언트 선계산 (impeccable v2 §18).
사용 유틸: @/utils/blurhash.computeBlurhash(uri, options?)
DB 컬럼: {users.photo_url_blurhash, job_postings.og_image_url_blurhash,
         announcements.image_url_blurhash, applications.applicant_photo_url_blurhash,
         work_logs.staff_photo_url_blurhash}
JSON 배열: announcements.images[i].blurhash, board_posts.image_attachments[i].blurhash
`;
