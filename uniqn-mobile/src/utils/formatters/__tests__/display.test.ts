/**
 * 그림자 해소(8-1) 회귀 — flat 파일에서 흡수한 표시 포맷터가 canonical
 * 배럴(`@/utils/formatters`)을 통해 동일 출력으로 노출되는지 검증.
 * 흡수 전 flat 파일 판의 출력 문자열을 그대로 단언(런타임 기록값).
 */

import {
  formatSalary,
  formatSalaryType,
  formatBirthDate,
  formatGenderLabel,
  formatPositions,
  maskEmail,
  formatPercent,
} from '../index';

describe('흡수된 표시 포맷터 (barrel 노출)', () => {
  it('formatSalary 는 "라벨 ₩금액" (flat 파일 판과 동일, ₩ 접두)', () => {
    expect(formatSalary('hourly', 15000)).toBe('시급 ₩15,000');
    expect(formatSalary('daily', 120000)).toBe('일급 ₩120,000');
    expect(formatSalary('monthly', 3000000)).toBe('월급 ₩3,000,000');
  });

  it('formatSalaryType 는 라벨, 미지정은 원문 반환', () => {
    expect(formatSalaryType('hourly')).toBe('시급');
    expect(formatSalaryType('other')).toBe('협의');
    expect(formatSalaryType(undefined)).toBe('');
  });

  it('formatBirthDate YYYYMMDD → YYYY.MM.DD, 무효는 "-"', () => {
    expect(formatBirthDate('19900215')).toBe('1990.02.15');
    expect(formatBirthDate('123')).toBe('-');
    expect(formatBirthDate(null)).toBe('-');
  });

  it('formatGenderLabel', () => {
    expect(formatGenderLabel('male')).toBe('남성');
    expect(formatGenderLabel('female')).toBe('여성');
    expect(formatGenderLabel(undefined)).toBe('확인 필요');
  });

  it('formatPositions / maskEmail / formatPercent', () => {
    expect(formatPositions(3, 5)).toBe('3/5명');
    expect(maskEmail('hello@gmail.com')).toBe('h***@gmail.com');
    expect(formatPercent(12.345, 1)).toBe('12.3%');
  });
});
