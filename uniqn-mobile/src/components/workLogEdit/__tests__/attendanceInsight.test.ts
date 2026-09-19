/**
 * deriveAttendanceInsight — 총 근무 시간 · 12시간 경고 · 저장 차단 판정
 *
 * 🔴 이 파생 4종은 **폐기될 `WorkTimeEditor` 에만 있던 것**이고, Task 5·6 은 범위 밖이라
 *    만들지 않았다. 즉 지금 앱 어디에도 없다 — 통합 시트가 붙이지 않으면 기능 후퇴다.
 *    (구 `isValidTimeOrder`:240-243 · `isLongShift`:246-249 · 총 근무 시간:474-482)
 *
 * ⚠️ 구 편집기는 'HH:mm' 문자열 축에서 판정했지만(`deriveOvernightPreview`) 이 시트의 실적은
 *    **Date** 다. 문자열로 되돌리면 `applyPickedTime` 이 이미 적용한 익일 보정이 한 번 더
 *    일어나거나 사라진다 — 판정을 Date 차이 하나로 모으는 이유다.
 *
 * ⚠️ 날짜는 **로컬 시각 생성자**로 만든다(jest.config 에 TZ 고정이 없다).
 */
import { deriveAttendanceInsight } from '../attendanceInsight';

const AT = (day: number, hour: number, minute = 0) => new Date(2026, 7, day, hour, minute);

describe('deriveAttendanceInsight — 총 근무 시간', () => {
  it('출퇴근이 다 있으면 근무 시간을 계산한다', () => {
    const insight = deriveAttendanceInsight(AT(10, 18), AT(11, 2));

    expect(insight.durationMinutes).toBe(8 * 60);
    expect(insight.durationLabel).toBe('8시간');
  });

  it('분 단위도 라벨에 담는다', () => {
    const insight = deriveAttendanceInsight(AT(10, 18), AT(10, 22, 30));

    expect(insight.durationLabel).toBe('4시간 30분');
  });

  it('한쪽만 있으면 산정하지 않는다 — 0시간으로 단정하지 않는다', () => {
    const onlyIn = deriveAttendanceInsight(AT(10, 18), null);

    expect(onlyIn.durationMinutes).toBeNull();
    expect(onlyIn.durationLabel).toBeNull();
  });

  it('둘 다 없으면 산정하지 않는다', () => {
    const empty = deriveAttendanceInsight(null, null);

    expect(empty.durationMinutes).toBeNull();
    expect(empty.hasBlockingError).toBe(false);
  });
});

describe('deriveAttendanceInsight — 저장을 막아야 하는 입력', () => {
  it('🔴 출근 == 퇴근은 차단 대상이고 근무 시간을 산정하지 않는다', () => {
    const insight = deriveAttendanceInsight(AT(10, 18), AT(10, 18));

    expect(insight.isEqual).toBe(true);
    expect(insight.hasBlockingError).toBe(true);
    expect(insight.durationMinutes).toBeNull();
  });

  it('🔴 퇴근이 출근보다 이르면 차단한다 — 음수 근무 시간이 저장되면 정산이 틀어진다', () => {
    // 퇴근을 먼저 22:00 로 찍고 나중에 출근을 23:00 으로 고치면 도달한다.
    // `applyPickedTime` 의 익일 보정은 **퇴근을 고를 때만** 걸리므로 이 순서는 보정되지 않는다.
    const insight = deriveAttendanceInsight(AT(10, 23), AT(10, 22));

    expect(insight.isReversed).toBe(true);
    expect(insight.hasBlockingError).toBe(true);
    expect(insight.durationMinutes).toBeNull();
  });

  it('정상 입력은 차단하지 않는다', () => {
    expect(deriveAttendanceInsight(AT(10, 18), AT(11, 2)).hasBlockingError).toBe(false);
  });
});

describe('deriveAttendanceInsight — 익일 · 장시간 경고', () => {
  it('퇴근이 다음 달력일이면 익일이다', () => {
    expect(deriveAttendanceInsight(AT(10, 18), AT(11, 2)).isNextDay).toBe(true);
  });

  it('같은 날 안에서 끝나면 익일이 아니다', () => {
    expect(deriveAttendanceInsight(AT(10, 9), AT(10, 18)).isNextDay).toBe(false);
  });

  it('12시간을 넘기면 경고한다 (비차단)', () => {
    const insight = deriveAttendanceInsight(AT(10, 9), AT(10, 21, 30));

    expect(insight.isLongShift).toBe(true);
    expect(insight.hasBlockingError).toBe(false);
  });

  it('정확히 12시간은 경고하지 않는다 — 경계는 "초과"다', () => {
    expect(deriveAttendanceInsight(AT(10, 9), AT(10, 21)).isLongShift).toBe(false);
  });
});
