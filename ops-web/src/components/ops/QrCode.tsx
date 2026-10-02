/** QR 코드 — 인쇄·스캔 안정성을 위해 테마와 무관하게 항상 흰 바탕 검은 점. */
import { useMemo } from 'react';
import { qrPath } from '@/lib/qr';

export function QrCode({
  value,
  size = 160,
  label,
  className,
}: {
  value: string;
  size?: number;
  /** 스크린리더용 설명 */
  label: string;
  className?: string;
}) {
  const qr = useMemo(() => qrPath(value), [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.d} fill="#000" />
    </svg>
  );
}
