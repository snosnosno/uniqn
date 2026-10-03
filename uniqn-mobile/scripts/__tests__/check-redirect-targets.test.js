const fs = require('fs');
const path = require('path');
const { extractExternalOrigins, probeOrigin } = require('../check-redirect-targets');

const REDIRECTS_PATH = path.join(__dirname, '..', '..', 'public', '_redirects');

describe('check-redirect-targets: extractExternalOrigins', () => {
  it('외부 절대 URL 대상의 origin 만 중복 없이 뽑는다', () => {
    const text = [
      '# 주석 https://ignored.example/x 302',
      '',
      '/.well-known/*  /.well-known/:splat  200',
      '/monitor/*  https://ops.uniqn.app/monitor/:splat  302',
      '/live/*  https://ops.uniqn.app/live/:splat  302',
      '/old  https://other.example/new  301',
      '/*  /index.html  200',
    ].join('\n');

    expect(extractExternalOrigins(text)).toEqual([
      'https://ops.uniqn.app',
      'https://other.example',
    ]);
  });

  it('외부 대상이 없으면 빈 배열', () => {
    expect(extractExternalOrigins('/*  /index.html  200\n')).toEqual([]);
  });
});

describe('check-redirect-targets: probeOrigin', () => {
  const okFetch = (url, status = 200) =>
    jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, url });

  it('같은 호스트에서 2xx 면 통과', async () => {
    const r = await probeOrigin('https://ops.uniqn.app', okFetch('https://ops.uniqn.app/'));
    expect(r.ok).toBe(true);
  });

  it('2xx 가 아니면 실패', async () => {
    const r = await probeOrigin('https://ops.uniqn.app', okFetch('https://ops.uniqn.app/', 522));
    expect(r.ok).toBe(false);
  });

  it('다른 호스트(접근 제한 로그인 등)로 넘어가면 2xx 여도 실패', async () => {
    const r = await probeOrigin(
      'https://ops.uniqn.app',
      okFetch('https://team.cloudflareaccess.com/cdn-cgi/access/login')
    );
    expect(r.ok).toBe(false);
  });

  it('DNS 미해석 등 네트워크 오류는 실패', async () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    const r = await probeOrigin('https://ops.uniqn.app', jest.fn().mockRejectedValue(err));
    expect(r).toEqual({ origin: 'https://ops.uniqn.app', ok: false, detail: 'ENOTFOUND' });
  });
});

describe('public/_redirects — ops 공개뷰 이전 규칙', () => {
  const lines = fs
    .readFileSync(REDIRECTS_PATH, 'utf-8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const indexOfFrom = (from) => lines.findIndex((l) => l.split(/\s+/)[0] === from);

  it.each([
    ['/monitor/*', 'https://ops.uniqn.app/monitor/:splat'],
    ['/live/*', 'https://ops.uniqn.app/live/:splat'],
  ])('%s 는 ops 도메인으로 302', (from, to) => {
    const rule = lines[indexOfFrom(from)];
    expect(rule?.split(/\s+/)).toEqual([from, to, '302']);
  });

  it('SPA fallback(/*) 보다 위에 있다 — 아래면 /* 가 먼저 매칭돼 영영 안 넘어간다', () => {
    const fallback = indexOfFrom('/*');
    expect(fallback).toBeGreaterThan(-1);
    expect(indexOfFrom('/monitor/*')).toBeLessThan(fallback);
    expect(indexOfFrom('/live/*')).toBeLessThan(fallback);
  });
});
