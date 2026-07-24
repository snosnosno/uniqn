/** ops 운영 콘솔 반응형 분기(L4·L8). 600dp 이상 = 태블릿 사이드바 레이아웃. */
import { useWindowDimensions } from 'react-native';
import { ANDROID_COMPLIANCE } from '@/constants';

export interface OpsConsoleLayout {
  isWide: boolean;
  width: number;
}

export function useOpsConsoleLayout(): OpsConsoleLayout {
  const { width } = useWindowDimensions();
  return {
    width,
    isWide: width >= ANDROID_COMPLIANCE.LARGE_SCREEN_MIN_WIDTH_DP,
  };
}
