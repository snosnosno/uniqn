/**
 * timePickerUtils — 휠 피커 스냅 인덱스 테스트
 *
 * snapIndex는 **선택 인덱스만** 계산한다(2026-07-22 Android 프리징 2회차 수정).
 * 호출부가 이 값으로 scrollTo를 하면 momentum 재발화 → 재-scrollTo 무한 재진입으로
 * 휠이 먹통이 되므로, 재스크롤 여부라는 개념 자체를 없앴다 — snapToInterval이 OS 레벨에서
 * 이미 정렬한다. (1회차 ±0.5dp 정렬 가드는 dp↔px 반올림 오차로 무력화돼 실패했다.)
 */
import { generateHours, generateMinutes, normalizeMinute, snapIndex } from '../timePickerUtils';

const ITEM_HEIGHT = 44;

describe('snapIndex', () => {
  it('정렬된 오프셋은 그 인덱스를 그대로 준다', () => {
    expect(snapIndex(0, 24, ITEM_HEIGHT)).toBe(0);
    expect(snapIndex(3 * ITEM_HEIGHT, 24, ITEM_HEIGHT)).toBe(3);
  });

  it('서브픽셀 오차가 있어도 같은 인덱스로 떨어진다 (dp↔px 반올림 내성)', () => {
    expect(snapIndex(3 * ITEM_HEIGHT + 0.3, 24, ITEM_HEIGHT)).toBe(3);
    expect(snapIndex(3 * ITEM_HEIGHT - 2, 24, ITEM_HEIGHT)).toBe(3);
  });

  it('중간 오프셋은 가장 가까운 인덱스로 반올림한다', () => {
    expect(snapIndex(3 * ITEM_HEIGHT + 20, 24, ITEM_HEIGHT)).toBe(3);
    expect(snapIndex(3 * ITEM_HEIGHT + 30, 24, ITEM_HEIGHT)).toBe(4);
  });

  it('범위 밖 오프셋(오버스크롤)은 경계 인덱스로 클램프한다', () => {
    expect(snapIndex(-30, 24, ITEM_HEIGHT)).toBe(0);
    expect(snapIndex(999 * ITEM_HEIGHT, 24, ITEM_HEIGHT)).toBe(23);
  });
});

describe('기존 유틸 (동작 고정)', () => {
  it('generateHours/generateMinutes/normalizeMinute', () => {
    expect(generateHours(0, 2)).toEqual([0, 1, 2]);
    expect(generateMinutes(15)).toEqual([0, 15, 30, 45]);
    expect(normalizeMinute(8, 15)).toBe(15); // 반올림 상향
    expect(normalizeMinute(5, 15)).toBe(0); // 반올림 하향 — 기존 19:05 값은 :00으로 정규화
    // 상한 근처는 배열 밖(60)이 아니라 마지막 유효 분으로 클램프한다.
    expect(normalizeMinute(53, 15)).toBe(45);
    expect(normalizeMinute(58, 30)).toBe(30);
  });
});
