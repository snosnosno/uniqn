/**
 * Cloudflare Pages Function — 공고 공유 링크 OG 메타태그 주입
 *
 * 경로: /jobs/:id
 * 동작:
 *   1. User-Agent로 봇/크롤러 판별
 *   2. 봇이면 Workers KV에서 OG 데이터 조회
 *   3. HTMLRewriter로 index.html <head>에 OG 메타태그 삽입
 *   4. 봇이 아니거나 데이터 없으면 원본 SPA 반환
 */

interface Env {
  ASSETS: Fetcher;
  OG_KV: KVNamespace;
}

interface OGData {
  title: string;
  description: string;
  url: string;
  image: string;
}

// 주요 크롤러/봇 User-Agent 패턴
const BOT_UA = /kakaotalk|facebookexternalhit|twitterbot|slackbot|linebot|discord|telegram|whatsapp|linkedinbot|pinterest|googlebot|bingbot|yandex|naver|daum|applebot/i;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const jobId = params.id as string;
  const ua = request.headers.get('user-agent') || '';

  // 봇이 아니면 SPA 반환
  if (!BOT_UA.test(ua)) {
    return env.ASSETS.fetch(request);
  }

  try {
    // KV에서 OG 데이터 읽기
    const raw = await env.OG_KV.get<OGData>(`og:jobs:${jobId}`, 'json');

    // 런타임 검증: 필수 필드 존재 확인
    if (!raw || !raw.title || !raw.description || !raw.url) {
      return env.ASSETS.fetch(request);
    }

    // index.html 가져오기 (루트 경로로 요청)
    const url = new URL(request.url);
    const assetResponse = await env.ASSETS.fetch(
      new Request(url.origin + '/', {
        headers: request.headers,
      })
    );

    // HTMLRewriter로 OG 메타태그 주입
    const response = new HTMLRewriter()
      .on('head', new OGMetaInjector(raw))
      .transform(assetResponse);

    // 봇 응답에 짧은 캐시 TTL 설정 (공고 수정 반영 위해)
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=300');
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch {
    // 에러 시 원본 SPA 반환 (graceful degradation)
    return env.ASSETS.fetch(request);
  }
};

/**
 * HTMLRewriter handler — <head>에 OG + Twitter Card 메타태그 삽입
 */
class OGMetaInjector implements HTMLRewriterElementContentHandlers {
  private og: OGData;

  constructor(og: OGData) {
    this.og = og;
  }

  element(el: Element) {
    const e = escapeHtml;
    el.append(
      // Open Graph
      `<meta property="og:type" content="website" />` +
      `<meta property="og:site_name" content="UNIQN" />` +
      `<meta property="og:title" content="${e(this.og.title)}" />` +
      `<meta property="og:description" content="${e(this.og.description)}" />` +
      `<meta property="og:image" content="${e(this.og.image)}" />` +
      `<meta property="og:url" content="${e(this.og.url)}" />` +
      `<meta property="og:locale" content="ko_KR" />` +
      // Twitter Card
      `<meta name="twitter:card" content="summary_large_image" />` +
      `<meta name="twitter:title" content="${e(this.og.title)}" />` +
      `<meta name="twitter:description" content="${e(this.og.description)}" />` +
      `<meta name="twitter:image" content="${e(this.og.image)}" />`,
      { html: true }
    );
  }
}

/**
 * HTML 특수문자 이스케이프 (XSS 방지)
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
