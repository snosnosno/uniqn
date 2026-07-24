/* eslint-disable @typescript-eslint/no-require-imports */

import type React from 'react';

import { useOpsConsoleLayout, type OpsConsoleLayout } from '../useOpsConsoleLayout';

// @types/react-test-renderer 미설치라 ES import는 TS7016 —
// 선례(useAndroidOrientationPolicy.test.ts)와 동일한 typed require 문형 사용.
const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: React.ReactElement) => { unmount: () => void };
};

let mockWidth = 390;
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: mockWidth, height: 800, scale: 2, fontScale: 1 }),
}));

// 선례(useAndroidOrientationPolicy.test.ts)와 동일하게 @/constants를 모킹한다.
// 실제 @/constants는 version.ts를 통해 로드시 Platform.select()를 호출하는데,
// 위 react-native 모킹에는 Platform이 없어 모듈 평가 시점에 크래시하기 때문이다.
jest.mock('@/constants', () => ({
  ANDROID_COMPLIANCE: {
    LARGE_SCREEN_MIN_WIDTH_DP: 600,
  },
}));

function renderLayout(): OpsConsoleLayout {
  let captured: OpsConsoleLayout | null = null;
  function Probe() {
    captured = useOpsConsoleLayout();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return captured!;
}

describe('useOpsConsoleLayout', () => {
  it('폰 폭(390)에서 isWide=false', () => {
    mockWidth = 390;
    const r = renderLayout();
    expect(r.isWide).toBe(false);
    expect(r.width).toBe(390);
  });

  it('600dp 경계에서 isWide=true', () => {
    mockWidth = 600;
    expect(renderLayout().isWide).toBe(true);
  });

  it('태블릿 폭(834)에서 isWide=true', () => {
    mockWidth = 834;
    expect(renderLayout().isWide).toBe(true);
  });
});
