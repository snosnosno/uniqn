/**
 * timePickerUtils — 휠 피커 스냅 판정 테스트
 *
 * resolveSnap 핵심(2026-07-22 Android 실기기 프리징 수정): 스크롤 종료 오프셋이 이미
 * 스냅 위치면 needsScroll=false — programmatic scrollTo(animated)가 onMomentumScrollEnd를
 * 재발화시켜 핸들러가 스스로를 무한 재호출(휠 터치 먹통)하는 재진입 고리를 끊는다.
 */
import { generateHours, generateMinutes, normalizeMinute, resolveSnap } from '../timePickerUtils';

const ITEM_HEIGHT = 44;

describe('resolveSnap', () => {
  it('정렬된 오프셋이면 재스크롤이 필요 없다 (프리징 재진입 고리 차단)', () => {
    expect(resolveSnap(0, 24, ITEM_HEIGHT)).toEqual({ index: 0, needsScroll: false });
    expect(resolveSnap(3 * ITEM_HEIGHT, 24, ITEM_HEIGHT)).toEqual({ index: 3, needsScroll: false });
  });

  it('서브픽셀 오차(±0.5 이내)는 정렬로 간주한다', () => {
    expect(resolveSnap(3 * ITEM_HEIGHT + 0.3, 24, ITEM_HEIGHT)).toEqual({
      index: 3,
      needsScroll: false,
    });
  });

  it('중간 오프셋은 가장 가까운 인덱스로 스냅하고 재스크롤을 요구한다', () => {
    expect(resolveSnap(3 * ITEM_HEIGHT + 20, 24, ITEM_HEIGHT)).toEqual({
      index: 3,
      needsScroll: true,
    });
    expect(resolveSnap(3 * ITEM_HEIGHT + 30, 24, ITEM_HEIGHT)).toEqual({
      index: 4,
      needsScroll: true,
    });
  });

  it('범위 밖 오프셋(오버스크롤)은 경계 인덱스로 클램프한다', () => {
    expect(resolveSnap(-30, 24, ITEM_HEIGHT)).toEqual({ index: 0, needsScroll: true });
    expect(resolveSnap(999 * ITEM_HEIGHT, 24, ITEM_HEIGHT)).toEqual({
      index: 23,
      needsScroll: true,
    });
  });
});

describe('기존 유틸 (동작 고정)', () => {
  it('generateHours/generateMinutes/normalizeMinute', () => {
    expect(generateHours(0, 2)).toEqual([0, 1, 2]);
    expect(generateMinutes(15)).toEqual([0, 15, 30, 45]);
    expect(normalizeMinute(8, 15)).toBe(15); // 반올림 상향
    expect(normalizeMinute(5, 15)).toBe(0); // 반올림 하향 — 기존 19:05 값은 :00으로 정규화
  });
});
