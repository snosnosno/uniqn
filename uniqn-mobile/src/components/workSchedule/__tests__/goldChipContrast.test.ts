/**
 * 근무표 골드 칩 전경 대비 회귀 가드
 *
 * @description 선택 상태 칩/탭(bg-primary-500 골드) 위 글자가 WCAG 1.4.3(본문 4.5:1)을
 * 유지하는지 수치로 고정한다.
 *
 * 배경: AddSlotSheet 모드 칩과 RoleSalaryField 급여타입 탭이 선택 시 `text-white` 를 썼다.
 * 골드(#D4AF37) 위 흰색은 약 1.9:1 로, "선택된 항목의 글자가 가장 안 보이는" 역전 상태였다.
 * 프로젝트에는 이 목적의 토큰 content-onGold(#09090B)가 이미 있었는데 쓰이지 않았다.
 * 눈대중으로 흰색을 되돌리는 회귀를 막기 위해 대비를 고정한다.
 */

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

/** tailwind.config.js — 선택 칩 배경 */
const GOLD_LIGHT = '#D4AF37'; // primary-500
const GOLD_DARK = '#B8962E'; // primary-600 (dark: 변형)

/** tailwind.config.js — content.onGold */
const ON_GOLD = '#09090B';

const WHITE = '#FFFFFF';

/** WCAG 1.4.3 — 본문 텍스트 최소 명암비 */
const MIN_TEXT_CONTRAST = 4.5;

describe('골드 배경 위 전경 대비', () => {
  it('content-onGold 는 라이트 골드(primary-500) 위에서 4.5:1 이상', () => {
    expect(contrastRatio(ON_GOLD, GOLD_LIGHT)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('content-onGold 는 다크 골드(primary-600) 위에서도 4.5:1 이상', () => {
    expect(contrastRatio(ON_GOLD, GOLD_DARK)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('회귀했던 흰색은 두 골드 모두에서 기준 미달이다(가드가 실제로 작동함을 증명)', () => {
    expect(contrastRatio(WHITE, GOLD_LIGHT)).toBeLessThan(MIN_TEXT_CONTRAST);
    expect(contrastRatio(WHITE, GOLD_DARK)).toBeLessThan(MIN_TEXT_CONTRAST);
  });
});
