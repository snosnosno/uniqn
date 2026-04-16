/**
 * 1000 이상의 숫자를 compact notation으로 포맷 (1.2k)
 * @param value - 포맷할 숫자 (null/undefined/음수는 '0'으로 처리)
 * @returns compact 포맷된 문자열 ('999', '1.2k', '0')
 */
export function formatCompactCount(value: number | null | undefined): string {
  if (value === null || value === undefined || value < 0) return '0';
  if (value < 1000) return String(value);

  const kValue = value / 1000;
  const rounded = Math.round(kValue * 10) / 10;
  if (rounded === Math.floor(rounded)) return `${Math.floor(rounded)}k`;
  return `${rounded}k`;
}
