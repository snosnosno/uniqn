import { describe, expect, it, vi } from 'vitest';
import {
  DEVICE_NAME_MAX,
  describeDevice,
  encodeDeviceName,
  normalizeDeviceName,
  withDeviceInfo,
} from './deviceName';

const decode = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

describe('normalizeDeviceName', () => {
  it('앞뒤 공백과 제어문자를 걷어 낸다', () => {
    expect(normalizeDeviceName('  등록\t데스크\n1 ')).toBe('등록데스크1');
  });

  it('40자로 자른다(서버와 같은 길이)', () => {
    expect(normalizeDeviceName('가'.repeat(60))).toHaveLength(DEVICE_NAME_MAX);
  });
});

describe('describeDevice', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'Chrome · Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      'Edge · Windows',
    ],
    [
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari · iPad',
    ],
    [
      'Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36',
      'Samsung Internet · Android',
    ],
    ['이상한 UA', '브라우저 · 기기'],
  ])('%s', (ua, expected) => {
    expect(describeDevice(ua)).toBe(expected);
  });
});

describe('encodeDeviceName', () => {
  it('한글 이름을 ASCII base64 로 바꾸고, 풀면 원래 이름이다', () => {
    const encoded = encodeDeviceName('등록데스크 1');
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(decode(encoded)).toBe('등록데스크 1');
  });

  it('서버 트리거의 정규식(본문 160자 + 패딩 2자) 안에 든다 — 한글 40자', () => {
    expect(encodeDeviceName('가'.repeat(60))).toMatch(/^[A-Za-z0-9+/]{1,160}={0,2}$/);
  });

  it('이모지를 반으로 가르지 않는다', () => {
    const name = normalizeDeviceName(`${'가'.repeat(39)}😀😀`);
    expect([...name]).toHaveLength(40);
    expect(name.endsWith('😀')).toBe(true);
  });
});

describe('withDeviceInfo', () => {
  const run = async (name: string, init?: RequestInit) => {
    const base = vi.fn<typeof fetch>(async () => new Response('ok'));
    await withDeviceInfo(base, () => name)('http://localhost/rest', init);
    return new Headers(base.mock.calls[0][1]?.headers);
  };

  it('기존 x-client-info 뒤에 device 를 붙인다', async () => {
    const headers = await run('플로어 태블릿', {
      headers: { 'X-Client-Info': 'supabase-js-web/2.117.2', apikey: 'k' },
    });
    const info = headers.get('x-client-info') ?? '';
    expect(info.startsWith('supabase-js-web/2.117.2; device=')).toBe(true);
    expect(decode(info.split('device=')[1])).toBe('플로어 태블릿');
    expect(headers.get('apikey')).toBe('k');
  });

  it('Headers 인스턴스로 온 헤더도 보존한다(supabase-js 가 넘기는 형태)', async () => {
    const headers = await run('A', {
      headers: new Headers({ 'X-Client-Info': 'supabase-js-web/2', Authorization: 'Bearer t' }),
    });
    expect(headers.get('x-client-info')).toBe(`supabase-js-web/2; device=${encodeDeviceName('A')}`);
    expect(headers.get('authorization')).toBe('Bearer t');
  });

  it('Request 로 온 요청의 헤더도 잃지 않는다', async () => {
    const base = vi.fn<typeof fetch>(async () => new Response('ok'));
    const request = new Request('http://localhost/rest', { headers: { apikey: 'k' } });
    await withDeviceInfo(base, () => 'A')(request);
    const sent = new Headers(base.mock.calls[0][1]?.headers);
    expect(sent.get('apikey')).toBe('k');
    expect(sent.get('x-client-info')).toBe(`device=${encodeDeviceName('A')}`);
  });

  it('x-client-info 가 없던 요청에도 device 만으로 붙인다', async () => {
    const headers = await run('A');
    expect(headers.get('x-client-info')).toBe(`device=${encodeDeviceName('A')}`);
  });

  it('이름이 없으면 요청을 그대로 넘긴다', async () => {
    const base = vi.fn<typeof fetch>(async () => new Response('ok'));
    const init = { headers: { apikey: 'k' } };
    await withDeviceInfo(base, () => '')('http://localhost/rest', init);
    expect(base).toHaveBeenCalledWith('http://localhost/rest', init);
  });
});
