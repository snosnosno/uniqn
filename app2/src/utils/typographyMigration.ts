/**
 * 타이포그래피 마이그레이션 유틸리티
 * text-xs를 text-sm으로 점진적 교체
 */

export const getTextSize = (variant: 'xs' | 'sm' | 'base' | 'lg' | 'xl' = 'base', responsive: boolean = true) => {
  const sizes = {
    xs: responsive ? 'text-sm' : 'text-sm', // 14px로 통일 (text-xs 제거)
    sm: responsive ? 'text-sm md:text-base' : 'text-sm',
    base: responsive ? 'text-base md:text-lg' : 'text-base',
    lg: responsive ? 'text-lg md:text-xl' : 'text-lg',
    xl: responsive ? 'text-xl md:text-2xl' : 'text-xl',
  };
  
  return sizes[variant];
};

export const getHeadingSize = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
  const sizes = {
    1: 'text-3xl md:text-5xl font-bold',
    2: 'text-2xl md:text-4xl font-bold',
    3: 'text-xl md:text-3xl font-semibold',
    4: 'text-lg md:text-2xl font-semibold',
    5: 'text-base md:text-xl font-medium',
    6: 'text-base md:text-lg font-medium',
  };
  
  return sizes[level];
};

export const getCaptionSize = () => 'text-sm text-gray-500'; // text-xs 대신 text-sm 사용

export const getLabelSize = () => 'text-sm font-medium text-gray-700';

export const getBodyTextSize = () => 'text-base leading-relaxed text-gray-700';