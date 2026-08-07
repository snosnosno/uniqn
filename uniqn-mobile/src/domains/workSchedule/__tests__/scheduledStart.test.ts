/**
 * readScheduledStart — "값이 없다"(미정)와 "값은 있는데 못 읽는다"(지워야 할 값)를 가르는 판정.
 *
 * 이 구분이 무너지면 레거시 자유 텍스트 행에서 미정 선택이 변경으로 잡히지 않아
 * 사용자에게 "고쳤는데 그대로"가 된다 — 그래서 두 필드를 **함께** 단언한다.
 */
import { readScheduledStart } from '../scheduledStart';

describe('readScheduledStart', () => {
  it('정본 형식은 그대로 읽고 unreadable 이 아니다', () => {
    expect(readScheduledStart('18:00')).toEqual({
      scheduledStart: '18:00',
      scheduledUnreadable: false,
      hadLegacyEnd: false,
    });
  });

  it('값이 아예 없으면 미정 — unreadable 이 아니다', () => {
    expect(readScheduledStart(null)).toEqual({
      scheduledStart: null,
      scheduledUnreadable: false,
      hadLegacyEnd: false,
    });
    expect(readScheduledStart('')).toEqual({
      scheduledStart: null,
      scheduledUnreadable: false,
      hadLegacyEnd: false,
    });
  });

  it('🔴 자유 텍스트는 미정이 아니라 unreadable 이다', () => {
    expect(readScheduledStart('저녁 6시')).toEqual({
      scheduledStart: null,
      scheduledUnreadable: true,
      hadLegacyEnd: false,
    });
  });

  it('🔴 범위 밖 시각도 unreadable 이다(시각인 척하는 값 차단)', () => {
    expect(readScheduledStart('25:00')).toEqual({
      scheduledStart: null,
      scheduledUnreadable: true,
      hadLegacyEnd: false,
    });
  });

  it('🔴 폐지된 범위 데이터는 시작만 취하되 종료가 있었다는 사실을 남긴다', () => {
    // 이 사실을 잃으면 시트가 종료를 보여줄 수도, 사라진다고 알릴 수도 없다 — 조용한 소실.
    expect(readScheduledStart('18:00 - 02:00')).toEqual({
      scheduledStart: '18:00',
      scheduledUnreadable: false,
      hadLegacyEnd: true,
    });
  });

  it('물결(~) 구분자 범위도 종료를 인식한다', () => {
    expect(readScheduledStart('18:00~02:00')).toEqual({
      scheduledStart: '18:00',
      scheduledUnreadable: false,
      hadLegacyEnd: true,
    });
  });

  it('공백은 정본으로 다듬는다', () => {
    expect(readScheduledStart('  18:00  ')).toEqual({
      scheduledStart: '18:00',
      scheduledUnreadable: false,
      hadLegacyEnd: false,
    });
  });
});
