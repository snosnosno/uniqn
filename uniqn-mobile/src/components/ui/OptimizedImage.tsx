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
  /** blurhash 문자열 (커스텀) */
  blurhash?: string;
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
  const roundedClass = rounded ? 'rounded-full overflow-hidden' : '';
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
        placeholder={placeholder}
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
 * 이미지에서 blurhash 생성 (서버 사이드에서 사용)
 *
 * @description 이 함수는 클라이언트에서는 사용하지 않음.
 * Firebase Functions 또는 백엔드에서 이미지 업로드 시 생성하여 저장.
 *
 * @example
 * // Firebase Functions에서 사용
 * const blurhash = await generateBlurhash(imageBuffer);
 * await updateDoc(ref, { imageUrl, blurhash });
 */
export const BLURHASH_GENERATION_NOTE = `
Blurhash는 서버에서 생성되어야 합니다.
Firebase Storage 업로드 시 Cloud Functions에서 생성하거나,
이미지 업로드 API에서 생성하여 Firestore 문서에 저장합니다.

사용 라이브러리: blurhash (npm install blurhash)

Cloud Functions 예시:
import { encode } from 'blurhash';
import sharp from 'sharp';

export const generateBlurhash = async (buffer: Buffer): Promise<string> => {
  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encode(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    4, // componentX
    3  // componentY
  );
};
`;

export default OptimizedImage;
