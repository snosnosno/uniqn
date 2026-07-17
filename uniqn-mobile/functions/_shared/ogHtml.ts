// OpenGraph 공유 카드용 순수 헬퍼 (이스케이프·HTML 빌더·크롤러 UA 판별)
// - RN/Node 의존성 없는 순수 TypeScript. Cloudflare Pages Function 이 소비한다.
// - 보안: 사용자 입력(공고 title 등)이 HTML 에 삽입되므로 escapeHtml 필수.

const CRAWLER_UA = [
  'facebookexternalhit',
  'kakaotalk-scrap',
  'twitterbot',
  'discordbot',
  'slackbot',
  'telegrambot',
  'whatsapp',
  'line-podcast',
  'skypeuripreview',
  'naver',
];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isCrawlerUserAgent(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_UA.some((bot) => lower.includes(bot));
}

export interface OgMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

export function buildOgHtml(meta: OgMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
</head><body>
<script>location.replace(${JSON.stringify(meta.url).replace(/</g, '\\u003c')});</script>
<p>UNIQN 공고로 이동 중…</p>
</body></html>`;
}
