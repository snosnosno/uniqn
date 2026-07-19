/**
 * UNIQN Mobile - Button 테두리 대비 회귀 가드
 *
 * @description outline variant 테두리가 WCAG 1.4.11(비텍스트 3:1)을 유지하는지 검증한다.
 *
 * 배경: 2026-07-19 실기기 QA에서 "버튼에 테두리가 없어서 뭔지 모르겠다"는 보고.
 * 원인은 렌더 버그가 아니라 토큰 선택이었다 — secondary-300 은 라이트 배경 대비
 * 1.66:1, surface-overlay 는 다크 배경 대비 1.31:1 로 사실상 보이지 않는 값이었다.
 * 색을 눈대중으로 되돌리는 회귀를 막기 위해 대비를 수치로 고정한다.
 */

import { SECONDARY_PALETTE } from '@/constants/colors';

/** sRGB 채널 → 선형 광도 (WCAG 2.x 정의) */
function toLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** 상대 광도 (WCAG 2.x) */
function relativeLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색의 명암비 (1 ~ 21) */
function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Button.tsx outline variant 가 실제로 쓰는 테두리 토큰 */
const OUTLINE_BORDER = SECONDARY_PALETTE[600];

/** global.css 의 표면 토큰 값 */
const SURFACES = {
  lightPage: '#F5F5F2',
  lightCard: '#FFFFFF',
  darkSurface: '#0B0B0E',
  darkCard: '#141418',
} as const;

/** WCAG 1.4.11 — UI 컴포넌트 경계 최소 명암비 */
const MIN_NON_TEXT_CONTRAST = 3;

describe('Button outline 테두리 대비', () => {
  it.each(Object.entries(SURFACES))(
    '%s 배경에서 3:1 이상을 유지한다',
    (_surfaceName, background) => {
      expect(contrastRatio(OUTLINE_BORDER, background)).toBeGreaterThanOrEqual(
        MIN_NON_TEXT_CONTRAST
      );
    }
  );

  it('회귀했던 옛 토큰들은 기준에 미달한다 (가드가 실제로 작동함을 증명)', () => {
    // 이 단언이 깨지면 팔레트 값이 바뀐 것이므로 위 기준도 재검토해야 한다.
    expect(contrastRatio(SECONDARY_PALETTE[300], SURFACES.lightPage)).toBeLessThan(
      MIN_NON_TEXT_CONTRAST
    );
    expect(contrastRatio('#26262C', SURFACES.darkSurface)).toBeLessThan(MIN_NON_TEXT_CONTRAST);
  });
});
