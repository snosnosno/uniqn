/**
 * weekdayDates — 이번 달 같은 요일 날짜 산출(P1-5 soft-target 요일 반복) 테스트
 *
 * getSameWeekdayDatesInMonth(date): 입력일이 속한 달에서 같은 요일의 모든 날짜를
 * YYYY-MM-DD 오름차순으로 반환한다(달 경계 밖은 제외).
 *
 * 앵커 요일은 시스템 date 로 실측(머리 계산 금지):
 *   date -d '2026-07-03' '+%A' → Friday
 *   date -d '2026-07-06' '+%A' → Monday
 *   date -d '2026-07-01' '+%A' → Wednesday
 *   date -d '2026-07-31' '+%A' → Friday
 *   date -d '2026-02-27' '+%A' → Friday
 *   ⇒ 2026-07 금요일: 3·10·17·24·31(5주 요일) / 월요일: 6·13·20·27(4주 요일)
 *   ⇒ 2026-07 수요일: 1·8·15·22·29(1일이 그 달 첫날) / 2026-02 금요일: 6·13·20·27(28일 짧은달)
 */
import { getSameWeekdayDatesInMonth } from '../weekdayDates';

// 로컬 자정 기준 Date(월 인덱스 0=1월). getDay()·toDateString 모두 로컬이라 TZ 드리프트 없음.
const localDate = (y: number, mZeroBased: number, d: number, h = 0) =>
  new Date(y, mZeroBased, d, h);

describe('getSameWeekdayDatesInMonth', () => {
  it('5주 요일: 2026-07 금요일 입력 → 3·10·17·24·31', () => {
    expect(getSameWeekdayDatesInMonth(localDate(2026, 6, 3))).toEqual([
      '2026-07-03',
      '2026-07-10',
      '2026-07-17',
      '2026-07-24',
      '2026-07-31',
    ]);
  });

  it('4주 요일: 2026-07 월요일 입력 → 6·13·20·27', () => {
    expect(getSameWeekdayDatesInMonth(localDate(2026, 6, 6))).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
    ]);
  });

  it('월 경계(첫날): 2026-07-01(수) 입력 → 전달 제외, 그 달 수요일만(1·8·15·22·29)', () => {
    expect(getSameWeekdayDatesInMonth(localDate(2026, 6, 1))).toEqual([
      '2026-07-01',
      '2026-07-08',
      '2026-07-15',
      '2026-07-22',
      '2026-07-29',
    ]);
  });

  it('월 경계(마지막날): 2026-07-31(금) 입력 → 다음달 제외, 그 달 금요일 전체', () => {
    const result = getSameWeekdayDatesInMonth(localDate(2026, 6, 31));
    expect(result).toEqual(['2026-07-03', '2026-07-10', '2026-07-17', '2026-07-24', '2026-07-31']);
    // 8월로 새어나가지 않음.
    expect(result.every((d) => d.startsWith('2026-07'))).toBe(true);
  });

  it('짧은달(28일): 2026-02 금요일 입력 → 6·13·20·27', () => {
    expect(getSameWeekdayDatesInMonth(localDate(2026, 1, 27))).toEqual([
      '2026-02-06',
      '2026-02-13',
      '2026-02-20',
      '2026-02-27',
    ]);
  });

  it('시간 성분이 있어도 날짜(요일)만으로 산출', () => {
    // 2026-07-03 23:30(금) — 시각 무관하게 같은 결과.
    expect(getSameWeekdayDatesInMonth(localDate(2026, 6, 3, 23))).toEqual([
      '2026-07-03',
      '2026-07-10',
      '2026-07-17',
      '2026-07-24',
      '2026-07-31',
    ]);
  });
});
