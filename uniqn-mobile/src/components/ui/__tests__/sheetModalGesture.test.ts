/**
 * SheetModal 드래그 dismiss 판정·러버밴드 회귀 테스트 (2026-07-17 /review)
 *
 * 특히 방향 가드(상향 플릭 취소)는 실제 버그였던 지점(fix 2cec50fc7)의 회귀 고정.
 */

import {
  rubberband,
  shouldDismissSheet,
  SHEET_DISMISS_VELOCITY,
  SHEET_DISMISS_DISTANCE_RATIO,
} from '@/components/ui/sheetModalGesture';

const H = 800; // windowHeight 가정

describe('shouldDismissSheet', () => {
  it('빠른 하향 플릭(velocity > 임계)은 거리 무관 dismiss', () => {
    expect(shouldDismissSheet(10, SHEET_DISMISS_VELOCITY + 1, H)).toBe(true);
  });

  it('경계값: velocity 가 정확히 임계면 dismiss 아님(초과 조건)', () => {
    expect(shouldDismissSheet(10, SHEET_DISMISS_VELOCITY, H)).toBe(false);
  });

  it('거리 임계 초과 하향 드래그 + 정지 릴리즈는 dismiss', () => {
    expect(shouldDismissSheet(H * SHEET_DISMISS_DISTANCE_RATIO + 1, 0, H)).toBe(true);
  });

  it('경계값: 정확히 거리 임계면 dismiss 아님(초과 조건)', () => {
    expect(shouldDismissSheet(H * SHEET_DISMISS_DISTANCE_RATIO, 0, H)).toBe(false);
  });

  it('회귀: 거리 임계 초과여도 위로 플릭(velocity < 0)이면 취소 의도 → dismiss 금지', () => {
    expect(shouldDismissSheet(H * 0.5, -50, H)).toBe(false);
  });

  it('임계 미달 + 저속 릴리즈는 복귀', () => {
    expect(shouldDismissSheet(50, 100, H)).toBe(false);
  });
});

describe('rubberband', () => {
  it('overshoot 0 → 0', () => {
    expect(rubberband(0, H)).toBe(0);
  });

  it('저항: 결과 크기가 원 이동량보다 항상 작다', () => {
    for (const overshoot of [-10, -100, -400, -2000]) {
      expect(Math.abs(rubberband(overshoot, H))).toBeLessThan(Math.abs(overshoot));
    }
  });

  it('부호 보존: 위로 끌면(음수) 결과도 위(음수)', () => {
    expect(rubberband(-100, H)).toBeLessThan(0);
  });

  it('단조 증가 + 증가율 감소(저항 특성): 같은 간격에서 이동 증가분이 점점 줄어든다', () => {
    const r1 = Math.abs(rubberband(-100, H));
    const r2 = Math.abs(rubberband(-200, H));
    const r3 = Math.abs(rubberband(-300, H));
    expect(r2).toBeGreaterThan(r1);
    expect(r3).toBeGreaterThan(r2);
    expect(r2 - r1).toBeGreaterThan(r3 - r2);
  });

  it('점근 한계: 아무리 끌어도 dimension(windowHeight) 을 넘지 않는다', () => {
    // o·d·c/(d+c|o|) 의 |o|→∞ 극한은 d — 시트가 화면 높이 이상 밀려나지 않는다.
    expect(Math.abs(rubberband(-100000, H))).toBeLessThan(H);
  });
});
