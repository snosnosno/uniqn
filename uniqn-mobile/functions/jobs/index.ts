/**
 * /jobs (구인구직 탭) OpenGraph 카드
 *
 * 묶음 공유는 개별 공고 링크를 넣지 않고 이 URL 하나만 본문 끝에 붙인다.
 * 그래서 카톡이 스크랩하는 대상도 항상 여기다 — 이 함수가 없으면 SPA index.html 이
 * 그대로 서빙되어 미리보기 카드가 아예 뜨지 않는다.
 *
 * 크롤러가 아니면 정적 SPA 로 패스스루 — 실사용자 동작은 바뀌지 않는다.
 */

import { buildOgHtml, isCrawlerUserAgent } from '../_shared/ogHtml';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

// 상세 OG(functions/jobs/[id].ts)와 동일 규칙 — 브라우징 가능 상태만 센다.
const BROWSABLE = ['active', 'capacity_full'];
const BRAND_IMAGE = 'https://uniqn.app/og-default.png'; // public/og-default.png
const URL = 'https://uniqn.app/jobs';
const TITLE = 'UNIQN 구인구직';
const FALLBACK_DESCRIPTION = '홀덤펍·대회 단기 인력 매칭 — 모집 중인 공고를 확인하세요';

/**
 * 모집 중인 공고 수. Supabase REST 의 count 헤더만 읽어 행 본문은 받지 않는다.
 * 실패하면 undefined — 카드가 안 뜨는 것보다 건수 없는 카드가 낫다.
 */
async function fetchOpenPostingCount(env: Env): Promise<number | undefined> {
  const query =
    `${env.SUPABASE_URL}/rest/v1/job_postings` +
    `?select=id&status=in.(${BROWSABLE.join(',')})` +
    // 승인 대기 대회는 공유 대상이 아니다 — 일반 공고(tournament_config IS NULL)와
    // 승인 완료 대회만 센다.
    `&or=(tournament_config.is.null,tournament_config->>approvalStatus.eq.approved)`;

  const res = await fetch(query, {
    method: 'HEAD',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      prefer: 'count=exact',
      range: '0-0',
    },
  });
  if (!res.ok) return undefined;

  // content-range: "0-0/123" 또는 "*/123"
  const total = res.headers.get('content-range')?.split('/')[1];
  const parsed = total ? Number(total) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const onRequest: (ctx: { request: Request; env: Env }) => Promise<Response> = async ({
  request,
  env,
}) => {
  const ua = request.headers.get('user-agent');

  // 크롤러가 아니면 정적 SPA 그대로 서빙(패스스루)
  if (!isCrawlerUserAgent(ua)) {
    return env.ASSETS.fetch(request);
  }

  let description = FALLBACK_DESCRIPTION;
  try {
    const count = await fetchOpenPostingCount(env);
    if (count !== undefined && count > 0) {
      description = `지금 ${count.toLocaleString('ko-KR')}건 모집 중 — 홀덤펍·대회 단기 인력 매칭`;
    }
  } catch {
    // 건수 조회 실패는 무시하고 기본 문구로 카드 발급
  }

  return new Response(buildOgHtml({ title: TITLE, description, image: BRAND_IMAGE, url: URL }), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};
