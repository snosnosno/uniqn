export function formatCompactCount(value: number | null | undefined): string {
  if (value === null || value === undefined || value < 0) return '0';
  if (value < 1000) return String(value);

  const kValue = value / 1000;
  const rounded = Math.round(kValue * 10) / 10;
  if (rounded === Math.floor(rounded)) return `${Math.floor(rounded)}k`;
  return `${rounded}k`;
}
