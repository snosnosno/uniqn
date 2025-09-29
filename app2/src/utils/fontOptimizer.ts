/**
 * 폰트 최적화 유틸리티
 * - 폰트 프리로딩
 * - 폰트 디스플레이 최적화
 * - 사용하지 않는 폰트 제거
 */

interface FontConfig {
  family: string;
  weight: number | string;
  style?: 'normal' | 'italic';
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  unicode?: string; // 유니코드 범위 (서브셋팅용)
}

// 시스템에서 사용 중인 폰트들
export const systemFonts = [
  'Pretendard',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'sans-serif',
];

// 프로젝트에서 실제 사용하는 폰트 웨이트들
export const usedFontWeights = [
  300, // light
  400, // normal
  500, // medium
  600, // semibold
  700, // bold
];

// 한글 유니코드 범위 (Pretendard 서브셋팅용)
const koreanUnicodeRanges = [
  'U+AC00-D7AF', // 한글 음절
  'U+1100-11FF', // 한글 자모
  'U+3130-318F', // 한글 호환 자모
  'U+3200-32FF', // 괄호 CJK
  'U+FF00-FFEF', // 반각 및 전각 형식
];

// 기본 ASCII 범위
const basicLatinRange = 'U+0000-00FF';

// 필수 폰트 설정
const criticalFonts: FontConfig[] = [
  {
    family: 'Pretendard',
    weight: 400,
    display: 'swap',
    unicode: [basicLatinRange, ...koreanUnicodeRanges].join(','),
  },
  {
    family: 'Pretendard',
    weight: 600,
    display: 'swap',
    unicode: [basicLatinRange, ...koreanUnicodeRanges].join(','),
  },
];

/**
 * 폰트 프리로딩
 */
export const preloadFont = (config: FontConfig): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.type = 'font/woff2';
  link.crossOrigin = 'anonymous';

  // Google Fonts 또는 로컬 폰트 URL 생성
  if (config.family === 'Pretendard') {
    // CDN에서 Pretendard 폰트 로드
    link.href = `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-std-${config.weight}.woff2`;
  }

  document.head.appendChild(link);
};

/**
 * 중요한 폰트들을 프리로딩
 */
export const preloadCriticalFonts = (): void => {
  criticalFonts.forEach(font => {
    preloadFont(font);
  });
};

/**
 * 폰트 로드 상태 확인
 */
export const checkFontLoad = async (fontFamily: string): Promise<boolean> => {
  if (!document.fonts) {
    return false;
  }

  try {
    await document.fonts.load(`16px "${fontFamily}"`);
    return document.fonts.check(`16px "${fontFamily}"`);
  } catch (error) {
    console.warn(`폰트 로드 확인 실패: ${fontFamily}`, error);
    return false;
  }
};

/**
 * 사용 가능한 시스템 폰트 확인
 */
export const getAvailableSystemFonts = async (): Promise<string[]> => {
  const availableFonts: string[] = [];

  for (const font of systemFonts) {
    if (font.startsWith('-') || font === 'sans-serif') {
      // 시스템 폰트 키워드는 항상 사용 가능
      availableFonts.push(font);
    } else {
      const isAvailable = await checkFontLoad(font);
      if (isAvailable) {
        availableFonts.push(font);
      }
    }
  }

  return availableFonts;
};

/**
 * 최적화된 폰트 스택 생성
 */
export const createOptimizedFontStack = async (): Promise<string> => {
  const availableFonts = await getAvailableSystemFonts();
  return availableFonts.join(', ');
};

/**
 * 폰트 메트릭스를 이용한 레이아웃 시프트 방지
 */
export const getFontMetrics = (fontFamily: string) => {
  const metrics: Record<string, any> = {
    'Pretendard': {
      ascent: 0.8,
      descent: 0.2,
      lineGap: 0.1,
      unitsPerEm: 1000,
    },
    '-apple-system': {
      ascent: 0.8,
      descent: 0.2,
      lineGap: 0.1,
      unitsPerEm: 1000,
    },
    'Roboto': {
      ascent: 0.8,
      descent: 0.2,
      lineGap: 0.1,
      unitsPerEm: 1000,
    },
  };

  return metrics[fontFamily] || metrics['Pretendard'];
};

/**
 * CSS에서 font-display 최적화 적용
 */
export const applyFontDisplay = (): void => {
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: 'Pretendard';
      src: url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-std-400.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
      unicode-range: ${[basicLatinRange, ...koreanUnicodeRanges].join(',')};
    }

    @font-face {
      font-family: 'Pretendard';
      src: url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-std-600.woff2') format('woff2');
      font-weight: 600;
      font-style: normal;
      font-display: swap;
      unicode-range: ${[basicLatinRange, ...koreanUnicodeRanges].join(',')};
    }

    /* 폰트 로딩 중 레이아웃 시프트 방지 */
    body {
      font-family: ${systemFonts.join(', ')};
    }
  `;

  document.head.appendChild(style);
};

/**
 * 사용하지 않는 폰트 웨이트 제거 확인
 */
export const analyzeUsedFontWeights = (): number[] => {
  const usedWeights = new Set<number>();

  // DOM에서 실제 사용 중인 font-weight 수집
  const elements = document.querySelectorAll('*');
  elements.forEach(element => {
    const styles = window.getComputedStyle(element);
    const weight = parseInt(styles.fontWeight);
    if (!isNaN(weight)) {
      usedWeights.add(weight);
    }
  });

  return Array.from(usedWeights).sort();
};

/**
 * 폰트 최적화 초기화
 */
export const initializeFontOptimization = (): void => {
  // 중요한 폰트 프리로딩
  preloadCriticalFonts();

  // 폰트 디스플레이 최적화 적용
  applyFontDisplay();

  // 폰트 로드 완료 후 성능 분석
  if (document.fonts) {
    document.fonts.ready.then(() => {
      console.info('폰트 로딩 완료');
      const usedWeights = analyzeUsedFontWeights();
      console.info('사용 중인 폰트 웨이트:', usedWeights);
    });
  }
};