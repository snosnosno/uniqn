/**
 * QR 행렬 → SVG path — `uqr`(MIT, 의존성 0, 2026-10-01 /oss-vet 통과)로 행렬만 만들고
 * 그리기는 직접 한다(innerHTML 없이 React 로 렌더 → CSP·XSS 걱정 없음).
 */
import { encode } from 'uqr';

/** 켜진 칸마다 1×1 사각형을 이은 path d 문자열과 한 변 칸 수(테두리 2칸 포함). */
export function qrPath(text: string): { size: number; d: string } {
  const { size, data } = encode(text, { ecc: 'M', border: 2 });
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y][x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, d };
}
