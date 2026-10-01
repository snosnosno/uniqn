import { describe, expect, it } from 'vitest';
import { encode } from 'uqr';
import { qrPath } from './qr';

describe('qrPath', () => {
  it('켜진 칸 수만큼 사각형을 그린다(행렬과 1:1)', () => {
    const text = 'https://ops.uniqn.app/live/abc123';
    const { size, d } = qrPath(text);
    const { data } = encode(text, { ecc: 'M', border: 2 });
    const on = data.flat().filter(Boolean).length;
    expect(size).toBe(data.length);
    expect(d.match(/M/g)?.length).toBe(on);
  });

  it('같은 입력이면 같은 결과(렌더마다 흔들리지 않는다)', () => {
    expect(qrPath('x')).toEqual(qrPath('x'));
  });

  it('테두리 2칸은 비어 있다(스캐너 quiet zone)', () => {
    const { d } = qrPath('quiet');
    expect(d).not.toMatch(/M[01] /);
    expect(d).not.toMatch(/M\d+ [01]h/);
  });
});
