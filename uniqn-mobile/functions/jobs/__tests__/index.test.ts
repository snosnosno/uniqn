/**
 * /jobs OG 함수 계약 테스트
 *
 * 묶음 공유의 링크가 이 URL 하나뿐이라, 카톡이 스크랩할 때 카드가 반드시 떠야 한다.
 * 동시에 실사용자(비크롤러)는 기존과 똑같이 SPA 를 받아야 한다 — 이 경계가 깨지면
 * 앱 진입이 OG 리다이렉트 페이지로 바뀌어 무한 루프가 난다.
 */

import { onRequest } from '../index';

type Ctx = Parameters<typeof onRequest>[0];

const KAKAO_UA = 'facebookexternalhit/1.1 kakaotalk-scrap/1.0';
const HUMAN_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15';

function makeEnv(overrides: Partial<Ctx['env']> = {}): Ctx['env'] {
  return {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    ASSETS: { fetch: jest.fn(async () => new Response('SPA', { status: 200 })) },
    ...overrides,
  } as Ctx['env'];
}

function request(ua: string) {
  return new Request('https://uniqn.app/jobs', { headers: { 'user-agent': ua } });
}

describe('/jobs OG 함수', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('크롤러가 아니면 정적 SPA 를 그대로 서빙한다 (패스스루)', async () => {
    const env = makeEnv();
    global.fetch = jest.fn();

    const res = await onRequest({ request: request(HUMAN_UA), env } as Ctx);

    expect(await res.text()).toBe('SPA');
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
    // 사람에게는 Supabase 조회조차 하지 않는다
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('크롤러에는 구인구직 탭 OG 카드를 준다', async () => {
    global.fetch = jest.fn(
      async () => new Response(null, { status: 200, headers: { 'content-range': '0-0/42' } })
    ) as unknown as typeof fetch;

    const res = await onRequest({ request: request(KAKAO_UA), env: makeEnv() } as Ctx);
    const html = await res.text();

    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<meta property="og:title" content="UNIQN 구인구직"');
    expect(html).toContain('<meta property="og:url" content="https://uniqn.app/jobs"');
    // 모집 건수를 본문에 노출
    expect(html).toContain('지금 42건 모집 중');
  });

  it('건수 조회가 실패해도 기본 문구로 카드를 발급한다', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;

    const res = await onRequest({ request: request(KAKAO_UA), env: makeEnv() } as Ctx);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('<meta property="og:title" content="UNIQN 구인구직"');
    expect(html).toContain('홀덤펍·대회 단기 인력 매칭');
  });

  it('모집 건수가 0이면 건수를 표기하지 않는다', async () => {
    global.fetch = jest.fn(
      async () => new Response(null, { status: 200, headers: { 'content-range': '*/0' } })
    ) as unknown as typeof fetch;

    const html = await (
      await onRequest({ request: request(KAKAO_UA), env: makeEnv() } as Ctx)
    ).text();

    expect(html).not.toContain('0건 모집 중');
    expect(html).toContain('홀덤펍·대회 단기 인력 매칭');
  });

  it('승인 대기 대회는 건수에서 제외하도록 질의한다', async () => {
    const fetchMock = jest.fn(
      async () => new Response(null, { status: 200, headers: { 'content-range': '0-0/7' } })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await onRequest({ request: request(KAKAO_UA), env: makeEnv() } as Ctx);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('status=in.(active,capacity_full)');
    expect(url).toContain('approvalStatus.eq.approved');
  });
});
