/**
 * 이미지 프리로딩 및 최적화 유틸리티
 */

interface PreloadOptions {
  priority?: 'high' | 'low' | 'auto';
  sizes?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
}

// 이미지 프리로딩
export const preloadImage = (
  src: string,
  options: PreloadOptions = {}
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;

    if (options.sizes) {
      link.setAttribute('imagesizes', options.sizes);
    }

    if (options.crossOrigin) {
      link.crossOrigin = options.crossOrigin;
    }

    if (options.priority && options.priority !== 'auto') {
      link.setAttribute('fetchpriority', options.priority);
    }

    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to preload image: ${src}`));

    document.head.appendChild(link);
  });
};

// 여러 이미지 배치 프리로딩
export const preloadImages = async (
  images: Array<{ src: string; options?: PreloadOptions }>
): Promise<void> => {
  const promises = images.map(({ src, options = {} }) =>
    preloadImage(src, options)
  );

  try {
    await Promise.all(promises);
  } catch (error) {
    console.warn('일부 이미지 프리로딩에 실패했습니다:', error);
  }
};

// 중요한 이미지들을 조건부로 지연 로드 (실제 필요할 때만)
export const preloadCriticalImages = async () => {
  // 2초 지연 후 프리로딩 (앱 초기화 완료 후)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // DOM에서 실제 사용되는 이미지만 확인
  const hasFavicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');

  const criticalImages: Array<{ src: string; options?: PreloadOptions }> = [];

  // 현재 존재하는 파비콘만 프리로드 (필요한 경우)
  if (hasFavicon) {
    const faviconHref = hasFavicon.getAttribute('href');
    if (faviconHref && !faviconHref.startsWith('data:')) {
      criticalImages.push({
        src: faviconHref,
        options: { priority: 'low' as const },
      });
    }
  }

  if (criticalImages.length > 0) {
    return preloadImages(criticalImages);
  }

  // 프리로드할 이미지가 없으면 아무것도 하지 않음
  console.debug('프리로드할 중요한 이미지가 없습니다.');
};

// WebP 지원 확인
export const supportsWebP = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dataURL = canvas.toDataURL('image/webp');
    return dataURL.indexOf('webp') > -1;
  } catch {
    return false;
  }
};

// 이미지 포맷 최적화
export const getOptimizedImageUrl = (
  originalUrl: string,
  options: {
    format?: 'webp' | 'avif' | 'auto';
    quality?: number;
    width?: number;
    height?: number;
  } = {}
): string => {
  const { format = 'auto', quality = 85, width, height } = options;

  // Firebase Storage URL 처리
  if (originalUrl.includes('firebasestorage.googleapis.com')) {
    try {
      const url = new URL(originalUrl);

      // WebP 지원 확인 후 포맷 설정
      if (format === 'auto') {
        if (supportsWebP()) {
          url.searchParams.set('format', 'webp');
        }
      } else {
        url.searchParams.set('format', format);
      }

      // 품질 설정
      url.searchParams.set('quality', quality.toString());

      // 크기 설정
      if (width) {
        url.searchParams.set('w', width.toString());
      }
      if (height) {
        url.searchParams.set('h', height.toString());
      }

      return url.toString();
    } catch (error) {
      console.warn('이미지 URL 최적화 실패:', error);
      return originalUrl;
    }
  }

  return originalUrl;
};

// 이미지 캐시 정리
export const clearImageCache = (): void => {
  // Service Worker에서 이미지 캐시 정리 요청
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_IMAGE_CACHE',
    });
  }
};