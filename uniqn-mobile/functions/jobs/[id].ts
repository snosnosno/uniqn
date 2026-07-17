import { buildOgHtml, isCrawlerUserAgent, escapeHtml } from '../_shared/ogHtml';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

// 공유 가능 상태(클라이언트 canShareJob 과 동일 규칙: active/capacity_full + 승인 대회)
const SHAREABLE = new Set(['active', 'capacity_full']);
const BRAND_IMAGE = 'https://uniqn.app/og-default.png'; // public/og-default.png 정적 폴백

export const onRequest: (ctx: {
  request: Request;
  env: Env;
  params: { id: string };
}) => Promise<Response> = async ({ request, env, params }) => {
  const ua = request.headers.get('user-agent');

  // 크롤러가 아니면 정적 SPA 그대로 서빙(패스스루)
  if (!isCrawlerUserAgent(ua)) {
    return env.ASSETS.fetch(request);
  }

  // params.id 는 공격자 제어 가능한 URL 경로 → encodeURIComponent 로 안전하게 URL 구성.
  // (Task 3 buildOgHtml 이 스크립트 본문 이스케이프를 이미 수행 — 이는 2차 방어선)
  const url = `https://uniqn.app/jobs/${encodeURIComponent(params.id)}`;
  const fallback = () =>
    new Response(
      buildOgHtml({
        title: 'UNIQN 공고',
        description: '홀덤펍·대회 단기 인력 매칭',
        image: BRAND_IMAGE,
        url,
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );

  try {
    const query =
      `${env.SUPABASE_URL}/rest/v1/job_postings?id=eq.${encodeURIComponent(params.id)}` +
      `&select=title,location,status,posting_type,tournament_config,salary_daily_max,work_date,og_image_url`;
    const res = await fetch(query, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return fallback();
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const job = rows[0];
    if (!job) return fallback();

    // 공유 불가 상태(마감·취소·미승인 대회)는 상세 메타 노출 안 함
    const status = String(job.status ?? '');
    const isTournament = String(job.posting_type ?? 'regular') === 'tournament';
    const approval = (job.tournament_config as { approvalStatus?: string } | null)?.approvalStatus;
    const blocked = isTournament && approval !== 'approved';
    if (!SHAREABLE.has(status) || blocked) return fallback();

    const title = String(job.title ?? 'UNIQN 공고');
    const locationName =
      (job.location as { region?: string; district?: string } | null)?.region ?? '';
    const salary = job.salary_daily_max
      ? `일급 ${Number(job.salary_daily_max).toLocaleString('ko-KR')}원`
      : '';
    const workDate = job.work_date ? String(job.work_date) : '';
    const description = [locationName, workDate, salary].filter(Boolean).join(' · ');
    const image = job.og_image_url ? String(job.og_image_url) : BRAND_IMAGE;

    return new Response(
      buildOgHtml({ title, description: description || '지원하러 가기', image, url }),
      {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=300',
        },
      }
    );
  } catch {
    return fallback();
  }
};
