import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  quality?: number;
  sizes?: string;
  priority?: boolean; // 중요한 이미지는 즉시 로드
}

/**
 * 최적화된 이미지 컴포넌트
 * - WebP 포맷 지원
 * - Lazy loading
 * - 블러 플레이스홀더
 * - Intersection Observer 사용
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjE0Ij5sb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg==',
  quality = 85,
  sizes,
  priority = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // WebP 지원 확인
  const supportsWebP = () => {
    if (typeof window === 'undefined') return false;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('webp') > -1;
  };

  // WebP 버전 URL 생성
  const getOptimizedSrc = (originalSrc: string): string => {
    if (hasError || !supportsWebP()) return originalSrc;

    // Firebase Storage URL인 경우 변환 파라미터 추가
    if (originalSrc.includes('firebasestorage.googleapis.com')) {
      const url = new URL(originalSrc);
      url.searchParams.set('alt', 'media');
      if (!url.searchParams.has('token')) {
        // WebP 변환을 위한 파라미터 추가 (Firebase Storage 자동 변환 사용)
        return `${url.toString()}&format=webp&quality=${quality}`;
      }
      return url.toString();
    }

    // 다른 이미지 URL의 경우 WebP 확장자로 시도
    if (originalSrc.match(/\.(jpg|jpeg|png)$/i)) {
      return originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }

    return originalSrc;
  };

  // Intersection Observer 설정
  useEffect(() => {
    if (priority) return; // priority 이미지는 즉시 로드

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '50px', // 50px 전에 로드 시작
        threshold: 0.1,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 플레이스홀더 */}
      {!isLoaded && (
        <img
          src={placeholder}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover blur-sm ${className}`}
          aria-hidden="true"
        />
      )}

      {/* 실제 이미지 */}
      <img
        ref={imgRef}
        src={isInView ? getOptimizedSrc(src) : placeholder}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        sizes={sizes}
        style={{
          contentVisibility: 'auto',
        }}
      />

      {/* 에러 상태 */}
      {hasError && isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
          이미지를 불러올 수 없습니다
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;