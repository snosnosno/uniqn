import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from './Loading';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  fallback?: React.ReactNode;
  loading?: 'lazy' | 'eager';
  decoding?: 'sync' | 'async' | 'auto';
  sizes?: string;
  srcSet?: string;
}

/**
 * 지연 로딩 이미지 컴포넌트
 * Intersection Observer를 사용한 최적화
 * WCAG 2.1 AA 접근성 준수
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  placeholder,
  onLoad,
  onError,
  fallback,
  loading = 'lazy',
  decoding = 'async',
  sizes,
  srcSet,
}) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholder || '');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // 브라우저가 native lazy loading을 지원하는 경우
    if ('loading' in HTMLImageElement.prototype) {
      setImageSrc(src);
      return;
    }

    // Intersection Observer를 사용한 lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 이미지 프리로드
            const tempImg = new Image();
            tempImg.src = src;

            tempImg.onload = () => {
              setImageSrc(src);
              setImageLoaded(true);
              onLoad?.();
              observer.disconnect();
            };

            tempImg.onerror = () => {
              setHasError(true);
              onError?.();
              observer.disconnect();
            };
          }
        });
      },
      {
        rootMargin: '50px', // 뷰포트에서 50px 전에 로드 시작
        threshold: 0.01,
      }
    );

    observer.observe(img);

    return () => {
      observer.disconnect();
    };
  }, [src, placeholder, onLoad, onError]);

  const handleLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // 에러 발생 시 fallback 표시
  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  // 에러 발생 시 기본 에러 이미지
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 dark:bg-gray-800 ${className}`}
        style={{ width, height }}
        role="img"
        aria-label={alt}
      >
        <svg
          className="w-12 h-12 text-gray-400 dark:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {!imageLoaded && (
        <Skeleton className="absolute inset-0" variant="rectangular" width="100%" height="100%" />
      )}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`
          ${className}
          ${imageLoaded ? 'opacity-100' : 'opacity-0'}
          transition-opacity duration-300
        `}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        sizes={sizes}
        srcSet={srcSet}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

/**
 * 이미지 갤러리 컴포넌트
 * 썸네일과 라이트박스 기능 포함
 */
export const ImageGallery: React.FC<{
  images: Array<{
    src: string;
    alt: string;
    thumbnail?: string;
  }>;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}> = ({ images, className = '', columns = 3 }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <>
      <div className={`grid ${columnClasses[columns]} gap-4 ${className}`}>
        {images.map((image, index) => (
          <button
            key={image.src || `image-${index}`}
            onClick={() => setSelectedIndex(index)}
            className="relative aspect-square overflow-hidden rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
            aria-label={`이미지 ${index + 1} 보기: ${image.alt}`}
          >
            <LazyImage
              src={image.thumbnail || image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* 라이트박스 */}
      {selectedIndex !== null &&
        (() => {
          const selectedImage = images[selectedIndex];
          if (!selectedImage) return null;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
              onClick={() => setSelectedIndex(null)}
              role="dialog"
              aria-label="이미지 확대 보기"
            >
              <button
                className="absolute top-4 right-4 text-white hover:text-gray-300 dark:hover:text-gray-400 z-10"
                onClick={() => setSelectedIndex(null)}
                aria-label="닫기"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <img
                src={selectedImage.src}
                alt={selectedImage.alt}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />

              {/* 이전/다음 버튼 */}
              {selectedIndex > 0 && (
                <button
                  className="absolute left-4 text-white hover:text-gray-300 dark:hover:text-gray-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(selectedIndex - 1);
                  }}
                  aria-label="이전 이미지"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}

              {selectedIndex < images.length - 1 && (
                <button
                  className="absolute right-4 text-white hover:text-gray-300 dark:hover:text-gray-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(selectedIndex + 1);
                  }}
                  aria-label="다음 이미지"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
            </div>
          );
        })()}
    </>
  );
};

export default LazyImage;
