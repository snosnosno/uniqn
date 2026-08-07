/**
 * ops 대회 날짜 형식 계약 (결함 ④).
 *
 * 회귀 대상은 "에러 없는 성공"이다 — "7/1" 이 저장에 성공하면 '이어서 운영' 카드의
 * 정확 문자열 비교가 영영 실패한다. 그래서 **거부되어야 하는 값**들이 이 파일의 본체다.
 */
import {
  isOpsEventDate,
  kstDateString,
  kstTodayLocalDate,
  opsEventDateToString,
} from '../opsEventDate';

describe('isOpsEventDate', () => {
  it.each(['2026-08-08', '2026-01-01', '2026-12-31', '2024-02-29'])('허용: %s', (v) => {
    expect(isOpsEventDate(v)).toBe(true);
  });

  it.each([
    ['7/1', '슬래시 손입력 — 결함 ④의 실제 증상'],
    ['2026-7-1', '0 패딩 없음'],
    ['2026/08/08', '구분자 슬래시'],
    ['2026-08-08T00:00:00Z', 'ISO 타임스탬프'],
    ['', '빈 문자열'],
    ['   ', '공백'],
    ['오늘', '한글'],
    ['20260808', '구분자 없음'],
    ['2026-08-08 ', '뒤 공백(스키마가 trim 하지만 이 함수 자체는 거부)'],
  ])('거부: %s (%s)', (v) => {
    expect(isOpsEventDate(v)).toBe(false);
  });

  it.each([
    ['2026-02-30', '2월 30일'],
    ['2026-13-01', '13월'],
    ['2026-00-10', '0월'],
    ['2026-04-31', '4월 31일'],
    ['2026-02-29', '평년 2월 29일'],
  ])('패턴은 맞지만 실재하지 않는 날짜는 거부: %s (%s)', (v) => {
    expect(isOpsEventDate(v)).toBe(false);
  });
});

describe('kstTodayLocalDate — 쓰기(시드)와 읽기(재개 카드)가 같은 "오늘"을 본다', () => {
  // KST 00~09시 = UTC 전날 15~24시. 이 구간이 알려진 하루-밀림 플레이크다.
  it.each([
    ['2026-08-07T16:30:00.000Z', '2026-08-08'], // KST 08-08 01:30
    ['2026-08-07T23:59:00.000Z', '2026-08-08'], // KST 08-08 08:59
    ['2026-08-07T14:59:00.000Z', '2026-08-07'], // KST 08-07 23:59
    ['2026-08-08T03:00:00.000Z', '2026-08-08'], // KST 08-08 12:00
  ])('%s → %s', (iso, expected) => {
    const nowMs = Date.parse(iso);
    // 달력에서 고른 Date 를 저장 문자열로 되돌리면 kstDateString 과 정확히 같아야 한다.
    // 이 왕복이 깨지면 카드는 "오늘 만든 대회"를 못 집는다.
    expect(opsEventDateToString(kstTodayLocalDate(nowMs))).toBe(expected);
    expect(kstDateString(nowMs)).toBe(expected);
  });

  it('로컬 자정 Date 를 반환한다(시/분/초 0)', () => {
    const d = kstTodayLocalDate(Date.parse('2026-08-07T16:30:00.000Z'));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});
