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

/**
 * 폰트 조건부 프리로딩 (실제 사용될 때만)
 */
export const preloadFont = (_config: FontConfig): void => {
  // 완전 비활성화 - 404 오류 방지
  return;
};

/**
 * 중요한 폰트들 프리로딩 (완전 비활성화)
 */
export const preloadCriticalFonts = (): void => {
  // 완전 비활성화 - 404 오류 방지
  return;
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
 * CSS에서 font-display 최적화 적용 (최신 버전 사용)
 */
export const applyFontDisplay = (): void => {
  // @fontsource/pretendard 최신 버전 사용 (더 안정적)
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/@fontsource/pretendard@5.2.5/400.css';
  document.head.appendChild(link);

  const link2 = document.createElement('link');
  link2.rel = 'stylesheet';
  link2.href = 'https://cdn.jsdelivr.net/npm/@fontsource/pretendard@5.2.5/600.css';
  document.head.appendChild(link2);

  // 폰트 로딩 중 레이아웃 시프트 방지
  const style = document.createElement('style');
  style.textContent = `
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
 * 폰트 최적화 초기화 (성능 우선, 에러 처리 강화)
 */
export const initializeFontOptimization = (): void => {
  try {
    // 폰트 디스플레이 최적화 먼저 적용 (즉시 실행)
    applyFontDisplay();

    // 폰트 프리로딩은 지연 실행 (성능 경고 방지)
    requestIdleCallback(() => {
      try {
        preloadCriticalFonts();
      } catch (error) {
        console.warn('폰트 프리로딩 실패:', error);
      }
    }, { timeout: 5000 });

    // 폰트 로드 완료 후 성능 분석 (에러 처리 포함)
    if (document.fonts) {
      document.fonts.ready
        .then(() => {
          analyzeUsedFontWeights();
        })
        .catch((error) => {
          console.warn('폰트 로드 상태 확인 실패:', error);
        });
    }
  } catch (error) {
    console.error('폰트 최적화 초기화 실패:', error);
    // 폴백: 시스템 폰트만 사용
    const fallbackStyle = document.createElement('style');
    fallbackStyle.textContent = `
      body, * {
        font-family: ${systemFonts.join(', ')} !important;
      }
    `;
    document.head.appendChild(fallbackStyle);
  }
};