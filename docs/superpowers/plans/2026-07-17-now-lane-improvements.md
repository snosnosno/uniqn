# "지금" 레인 개선 Implementation Plan (공유 신뢰성 · 용어 · 진입점)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공유를 성장 루프로 만들고(죽은 링크 차단 + 카톡 OG 카드), 개발자 어휘를 자연어로 바꾸고, 워크스페이스 진입점을 내 공고 탭 하나로 통일한다.

**Architecture:** 3개 독립 PR. PR-1(공유)=클라이언트 `canShareJob` 단일 게이트 + Cloudflare Pages Function OG 주입. PR-2(용어)=문자열 전용. PR-3(진입점)=ActionSheet ⋯ 메뉴로 3진입점 수렴. 서로 의존 없음 — 순서 무관하게 병렬 가능하나 본 계획은 PR-1→PR-2→PR-3 순.

**Tech Stack:** TypeScript strict, React Native/Expo, Jest + @testing-library/react-native, Cloudflare Pages Functions(Workers 런타임), Supabase PostgREST(anon).

## Global Constraints

- UI 문자열·주석·커밋 **한글**. (CLAUDE.md)
- `console.log` 금지 → `logger`. 불변성(스프레드). 커밋 `<type>(<scope>): <한글>`.
- **DB·RLS·서버 마이그레이션 변경 없음.** OG Function은 anon 읽기만.
- OG title 등 **사용자 입력은 HTML 이스케이프 필수**(XSS).
- 기존 마이그레이션 수정 금지, `mcp__supabase__*` 직접 호출 금지.
- "워크스페이스"→"사업장" 개명 **하지 않음**(isSolo 다음 레인).

---

## File Structure

**PR-1 신규**
- `src/domains/job-posting/__tests__/canShareJob.test.ts`
- `uniqn-mobile/functions/jobs/[id].ts` — Pages Function 본체
- `uniqn-mobile/functions/_shared/ogHtml.ts` — 이스케이프·OG HTML 빌더·크롤러 UA 판별(순수)
- `uniqn-mobile/functions/_shared/__tests__/ogHtml.test.ts`

**PR-1 수정**
- `src/domains/job-posting/approvalGate.ts` — `canShareJob` 추가
- `src/domains/job-posting/index.ts` — 배럴 export
- `src/hooks/useShare.ts:159-217` — `runJobShare` 진입부 가드

**PR-2 수정** (문자열 + 테스트)
- `src/components/weeklyGrid/{AddSlotSheet,EditSlotSheet,VenueDayDetail,VenueCreateSheet,VenueDayPanel}.tsx`
- `app/(app)/(tabs)/employer.tsx:327,329`, `app/(employer)/weekly-grid.tsx:223,269-271`
- 관련 `__tests__/*` 문구 assert 갱신

**PR-3 수정**
- `app/(app)/(tabs)/employer.tsx:104-127` — `WorkspaceHeaderAction` → ActionSheet ⋯ 메뉴
- `app/(app)/settings/index.tsx:382-401` — "공고 협업" 섹션 제거
- `app/(employer)/workspace/index.tsx:52-74` — 임시 배너 제거

---

## PR-1 공유 신뢰성

### Task 1: canShareJob 가드 헬퍼

**Files:**
- Modify: `src/domains/job-posting/approvalGate.ts`, `src/domains/job-posting/index.ts`
- Test: `src/domains/job-posting/__tests__/canShareJob.test.ts`

**Interfaces:**
- Consumes: `isTournamentApprovalBlocked`(동 파일), `BROWSABLE_POSTING_STATUSES`(`./constants`).
- Produces: `canShareJob(posting: Pick<JobPosting,'status'|'postingType'|'tournamentConfig'>): boolean`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/domains/job-posting/__tests__/canShareJob.test.ts
import { canShareJob } from '../approvalGate';

const base = { status: 'active', postingType: 'regular', tournamentConfig: null } as const;

describe('canShareJob', () => {
  it('active 일반 공고는 공유 가능', () => {
    expect(canShareJob({ ...base })).toBe(true);
  });
  it('capacity_full 도 공유 가능(페이지 유효)', () => {
    expect(canShareJob({ ...base, status: 'capacity_full' })).toBe(true);
  });
  it('closed/cancelled/expired/pending/draft 는 공유 불가', () => {
    for (const status of ['closed', 'cancelled', 'expired', 'pending', 'draft'] as const) {
      expect(canShareJob({ ...base, status })).toBe(false);
    }
  });
  it('승인 대기 대회(pending tournament)는 active 여도 공유 불가', () => {
    expect(
      canShareJob({
        status: 'active',
        postingType: 'tournament',
        tournamentConfig: { approvalStatus: 'pending' } as never,
      })
    ).toBe(false);
  });
  it('승인 완료 대회는 공유 가능', () => {
    expect(
      canShareJob({
        status: 'active',
        postingType: 'tournament',
        tournamentConfig: { approvalStatus: 'approved' } as never,
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/domains/job-posting/__tests__/canShareJob.test.ts`
Expected: FAIL — `canShareJob` is not exported

- [ ] **Step 3: 구현**

`approvalGate.ts` 하단에 추가(상단 import에 `BROWSABLE_POSTING_STATUSES` 추가):

```typescript
import { BROWSABLE_POSTING_STATUSES } from './constants';

/**
 * 공유 가능 여부 — 죽은 링크(승인 대기 대회·마감/취소류)를 카톡에 뿌리는 것을 차단.
 * 공유 가능 상태 = 브라우징 가능(active/capacity_full) AND 승인 게이트 통과.
 * useShare 진입부 한 곳에서 호출해 7개 진입점을 일괄 방어한다.
 */
export function canShareJob(
  posting: Pick<JobPosting, 'status' | 'postingType' | 'tournamentConfig'>
): boolean {
  if (!(BROWSABLE_POSTING_STATUSES as readonly string[]).includes(posting.status)) {
    return false;
  }
  return !isTournamentApprovalBlocked(posting);
}
```

`src/domains/job-posting/index.ts`의 `isTournamentApprovalBlocked` export 줄 옆에 `canShareJob` 추가:

```typescript
export { isTournamentApprovalBlocked, canShareJob } from './approvalGate';
```

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/domains/job-posting/__tests__/canShareJob.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/domains/job-posting/approvalGate.ts uniqn-mobile/src/domains/job-posting/index.ts uniqn-mobile/src/domains/job-posting/__tests__/canShareJob.test.ts
git commit -m "feat(job-posting): 공유 가능 여부 canShareJob 가드 추가"
```

---

### Task 2: useShare 단일 게이트 배선

**Files:**
- Modify: `src/hooks/useShare.ts:159-217`
- Test: `src/hooks/__tests__/useShare.guard.test.ts` (신규)

**Interfaces:**
- Consumes: `canShareJob` (Task 1).

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/hooks/__tests__/useShare.guard.test.ts
import { renderHook } from '@testing-library/react-native';
import { useShare } from '../useShare';

// Share/webShare 모킹은 기존 useShare 테스트 패턴을 따를 것.
// 핵심: 승인 대기 대회 job 을 shareJob 에 넘기면 success=false, Share.share 미호출.
const pendingTournament = {
  id: 'jp1',
  title: '대회 딜러',
  status: 'active',
  postingType: 'tournament',
  tournamentConfig: { approvalStatus: 'pending' },
} as never;

it('공유 불가 상태면 시트를 열지 않고 success=false 반환', async () => {
  const { result } = renderHook(() => useShare());
  const r = await result.current.shareJob(pendingTournament);
  expect(r.success).toBe(false);
});
```

> 기존 `useShare` 테스트가 있으면 그 모킹 셋업(Share, navigator.share, toast, repository)을 복제. 없으면 위 최소 케이스만.

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/hooks/__tests__/useShare.guard.test.ts`
Expected: FAIL — 현재는 무조건 공유라 success 판정이 시트 동작에 의존

- [ ] **Step 3: runJobShare 진입부 가드 추가**

`useShare.ts` 상단 import에 추가:

```typescript
import { canShareJob } from '@/domains/job-posting';
```

`runJobShare`(159행) `try` 진입 직후 맨 위에 추가:

```typescript
        if (!canShareJob(job)) {
          logger.info('공유 차단 — 공유 불가 상태', { jobId: job.id, status: job.status });
          toast.error('지금은 공유할 수 없는 공고예요. (승인 대기 중이거나 마감된 공고)');
          return { success: false, error: new Error('공유 불가 상태') };
        }
```

`runJobShare`의 `useCallback` 의존성 배열(217행)에 `toast` 추가: `[webShare, toast]`.

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/hooks/__tests__/useShare.guard.test.ts src/hooks/__tests__/`
Expected: PASS (신규 + 기존 useShare 회귀)

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/hooks/useShare.ts uniqn-mobile/src/hooks/__tests__/useShare.guard.test.ts
git commit -m "feat(share): useShare 단일 게이트로 7개 진입점 죽은링크 차단"
```

---

### Task 3: OG HTML 순수 헬퍼 (이스케이프·빌더·UA 판별)

**Files:**
- Create: `functions/_shared/ogHtml.ts`, `functions/_shared/__tests__/ogHtml.test.ts`

**Interfaces:**
- Produces:
  - `escapeHtml(s: string): string`
  - `isCrawlerUserAgent(ua: string | null): boolean`
  - `buildOgHtml(meta: { title: string; description: string; image: string; url: string }): string`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// functions/_shared/__tests__/ogHtml.test.ts
import { escapeHtml, isCrawlerUserAgent, buildOgHtml } from '../ogHtml';

describe('ogHtml', () => {
  it('HTML 특수문자를 이스케이프한다', () => {
    expect(escapeHtml('<script>"&\'')).toBe('&lt;script&gt;&quot;&amp;&#39;');
  });
  it('카톡/페북 등 크롤러 UA 를 식별한다', () => {
    expect(isCrawlerUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isCrawlerUserAgent('kakaotalk-scrap/1.0')).toBe(true);
    expect(isCrawlerUserAgent('Mozilla/5.0 (iPhone)')).toBe(false);
    expect(isCrawlerUserAgent(null)).toBe(false);
  });
  it('OG 태그를 이스케이프해 삽입한다', () => {
    const html = buildOgHtml({
      title: '딜러 <b>모집</b>',
      description: '강남 · 7/17',
      image: 'https://cdn/x.png',
      url: 'https://uniqn.app/jobs/1',
    });
    expect(html).toContain('<meta property="og:title" content="딜러 &lt;b&gt;모집&lt;/b&gt;"');
    expect(html).toContain('<meta property="og:image" content="https://cdn/x.png"');
    expect(html).toContain('twitter:card');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest functions/_shared/__tests__/ogHtml.test.ts`
Expected: FAIL — 모듈 없음

> jest가 `functions/`를 수집하도록 `jest.config` roots에 포함돼 있는지 확인. 미포함이면 테스트를 `src/` 하위 미러 위치가 아니라 `functions/_shared/__tests__`로 두고 `--roots functions`로 실행하거나, jest config `roots`에 `<rootDir>/functions` 추가(설정 변경도 이 Task에 포함).

- [ ] **Step 3: 구현**

```typescript
// functions/_shared/ogHtml.ts
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
<script>location.replace(${JSON.stringify(meta.url)});</script>
<p>UNIQN 공고로 이동 중…</p>
</body></html>`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest functions/_shared/__tests__/ogHtml.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/functions/_shared/ogHtml.ts uniqn-mobile/functions/_shared/__tests__/ogHtml.test.ts
git commit -m "feat(og): OG HTML 빌더·이스케이프·크롤러 UA 판별 순수 헬퍼"
```

---

### Task 4: OG Pages Function 본체 (배포는 사용자 게이트)

**Files:**
- Create: `functions/jobs/[id].ts`

**Interfaces:**
- Consumes: `escapeHtml`, `isCrawlerUserAgent`, `buildOgHtml` (Task 3).

> 이 Task는 통합 함수라 로컬 유닛 테스트 대상이 아님(Workers 런타임 + 실제 요청 필요). 순수 조립 로직만 담고, 배포·실측은 아래 "완료 후 게이트"에서 사용자가 수행.

- [ ] **Step 1: 함수 본체 작성**

```typescript
// functions/jobs/[id].ts
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

  const url = `https://uniqn.app/jobs/${params.id}`;
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
    const salary = job.salary_daily_max ? `일급 ${Number(job.salary_daily_max).toLocaleString('ko-KR')}원` : '';
    const workDate = job.work_date ? String(job.work_date) : '';
    const description = [locationName, workDate, salary].filter(Boolean).join(' · ');
    const image = job.og_image_url ? String(job.og_image_url) : BRAND_IMAGE;

    return new Response(
      buildOgHtml({ title, description: description || '지원하러 가기', image, url }),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } }
    );
  } catch {
    return fallback();
  }
};
```

- [ ] **Step 2: 정적 폴백 이미지 배치**

`uniqn-mobile/public/og-default.png` 에 1200×630 브랜드 OG 이미지 추가(디자인 자산). 없으면 임시로 기존 로고를 해당 규격으로. (없이 배포하면 og:image 404 — 폴백 이미지 필수.)

- [ ] **Step 3: 타입체크(함수는 exclude라 별도 확인)**

Run: `cd uniqn-mobile && npm run type-check`
Expected: exit 0 (functions/ 는 tsconfig exclude 라 메인 타입체크에 미포함 — 무영향 확인). 함수 자체 타입 안전이 필요하면 `@cloudflare/workers-types` devDependency 추가 + `functions/tsconfig.json` 생성(선택).

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/functions/jobs/[id].ts uniqn-mobile/public/og-default.png
git commit -m "feat(og): 공고 링크 OG 메타 주입 Pages Function"
```

---

## PR-2 용어 교정

### Task 5: 개발자 어휘 → 자연어 일괄 교정

**Files:**
- Modify: 스펙 §PR-2 교정표의 각 파일. Test: 해당 컴포넌트 테스트의 문구 assert 갱신.

**Interfaces:** 없음(문자열).

- [ ] **Step 1: 교정 대상 전수 grep**

Run: `cd uniqn-mobile && npx --no-install rg -n "주간 배치 그리드|풀 꽂기|배치 슬롯|배치 빼기|배치 편집|운영처|목표 인원|배치 확인 알림|인원 배치하기" src app`
목록을 확보(스펙 §PR-2 표가 기준, 잔여 지점 포함).

- [ ] **Step 2: 실패 테스트 우선 갱신(대표 1건)**

`EditSlotSheet` 토스트 문구 테스트를 새 문구로 바꿔 먼저 실패시킴:

```typescript
// EditSlotSheet 관련 테스트에 추가/수정
expect(getByText('근무 일정을 수정했어요')).toBeTruthy(); // 기존 '배치 슬롯을 수정했어요'
```

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/EditSlotSheet`
Expected: FAIL(아직 옛 문구)

- [ ] **Step 3: 교정표 일괄 적용**

스펙 §PR-2 표대로 각 화면 문자열 교체. 예:
- `EditSlotSheet.tsx:218` `'배치 슬롯을 수정했어요.'` → `'근무 일정을 수정했어요.'`
- `EditSlotSheet.tsx:248` `'배치에서 뺐어요.'` → `'근무에서 뺐어요.'`
- `EditSlotSheet.tsx:270,346` `accessibilityLabel="배치 빼기"/"배치 빼기 확정"` → `"근무 빼기"/"근무 빼기 확정"`
- `EditSlotSheet.tsx:299` `title="배치 편집"` → `"근무 수정"`
- `AddSlotSheet.tsx:246` `label="풀 꽂기"` → `"스태프 추가"`
- `employer.tsx:327,329` `"주간 배치 그리드 열기"/"주간 배치 그리드"` → `"이번 주 근무표 열기"/"이번 주 근무표"`
- `weekly-grid.tsx:223` `title="주간 배치 그리드"` → `"이번 주 근무표"`
- `weekly-grid.tsx:269-271` `"운영처가 없어요"/"...운영처(상시 배치 장소)를..."/"운영처 만들기"` → `"지점이 없어요"/"...지점(상시 근무 장소)을..."/"지점 만들기"`
- `VenueCreateSheet.tsx` `"운영처 이름"/"운영처 만들기"` → `"지점 이름"/"지점 만들기"`
- `VenueDayDetail.tsx:111-113` `"이 날 배치된 인원이 없어요"/"인원 배치하기"` → `"이 날 근무 인원이 없어요"/"근무 추가하기"`
- `VenueDayPanel.tsx` 목표 인원 라벨 → `"필요 인원"`
- 주간 액션 "배치 확인 알림" → "출근 확인 요청"

> `운영처`는 accessibilityLabel·테스트 셀렉터(`VenueCreateSheet.test.tsx:66,67,81,95,117`의 `getByLabelText('운영처 이름'/'운영처 만들기')`)에도 있으니 함께 교체.

- [ ] **Step 4: 전 테스트 갱신 + 통과**

각 컴포넌트 테스트의 옛 문구 assert/셀렉터를 새 문구로 교체 후:

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid app`
Expected: PASS

- [ ] **Step 5: 잔여 grep 0 확인 + 커밋**

Run: `cd uniqn-mobile && npx --no-install rg -n "주간 배치 그리드|풀 꽂기|배치 슬롯|운영처|목표 인원" src app` (주석·변수명 제외, 화면 문자열 0건 목표)

```bash
git add -A
git commit -m "refactor(grid): 개발자 어휘를 사장의 자연어로 교정(근무표·지점·필요인원)"
```

---

## PR-3 진입점 통일

### Task 6: WorkspaceHeaderAction → ⋯ ActionSheet 메뉴

**Files:**
- Modify: `app/(app)/(tabs)/employer.tsx:104-127`
- Test: `app/(app)/(tabs)/__tests__/employer.workspaceMenu.test.tsx` (신규)

**Interfaces:**
- Consumes: `ActionSheet`, `ActionSheetOption`(`@/components/ui`), `EllipsisHorizontalIcon`(`@/components/icons`).
- 참고 선례: `src/components/board/BoardCommentItem.tsx:100-115,273-286`.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// ⋯ 버튼 탭 → 시트에 '워크스페이스'·'받은 초대' 옵션 노출, 선택 시 각 라우트로 push.
// router.push 모킹으로 검증.
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest app/(app)/(tabs)/__tests__/employer.workspaceMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: WorkspaceHeaderAction 재작성**

`employer.tsx:104-127`을 ActionSheet 패턴으로 교체(선례 그대로):

```tsx
function WorkspaceHeaderAction() {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const { invitations: pendingInvitations } = useReceivedWorkspaceInvitations();
  const pendingCount = pendingInvitations.length;
  const [menuVisible, setMenuVisible] = useState(false);

  const options = useMemo<ActionSheetOption[]>(
    () => [
      { label: '워크스페이스', value: 'workspace' },
      {
        label: pendingCount > 0 ? `받은 초대 (${pendingCount}건)` : '받은 초대',
        value: 'invitations',
      },
    ],
    [pendingCount]
  );

  const handleSelect = useCallback((value: string) => {
    setMenuVisible(false);
    if (value === 'workspace') router.push('/(employer)/workspace');
    else if (value === 'invitations') router.push('/(employer)/workspace/invitations');
  }, []);

  return (
    <>
      <Pressable
        onPress={() => setMenuVisible(true)}
        className="relative rounded-sm p-2"
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`더보기${pendingCount > 0 ? ', 대기 중인 초대 있음' : ''}`}
      >
        <EllipsisHorizontalIcon size={24} color={getIconColor(isDarkMode, 'primary')} />
        {pendingCount > 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-error-500 dark:border-surface"
          />
        ) : null}
      </Pressable>
      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={options}
        onSelect={handleSelect}
      />
    </>
  );
}
```

import 추가: `ActionSheet, type ActionSheetOption`(`@/components/ui`), `EllipsisHorizontalIcon`(`@/components/icons`), `useMemo`.

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest app/(app)/(tabs)/__tests__/employer.workspaceMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "uniqn-mobile/app/(app)/(tabs)/employer.tsx" "uniqn-mobile/app/(app)/(tabs)/__tests__/employer.workspaceMenu.test.tsx"
git commit -m "feat(nav): 워크스페이스 진입을 내 공고 탭 더보기 메뉴로 통일"
```

---

### Task 7: 설정 협업 섹션 + 워크스페이스 배너 제거

**Files:**
- Modify: `app/(app)/settings/index.tsx:382-401`, `app/(employer)/workspace/index.tsx:52-74`
- Test: `app/(app)/settings/__tests__/*` (협업 섹션 미렌더 검증)

**Interfaces:** 없음.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// 설정 화면 렌더 시 '공고 협업' 섹션/'워크스페이스' SettingItem 이 더 이상 없어야 함.
expect(queryByText('공고 협업')).toBeNull();
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest app/(app)/settings/__tests__`
Expected: FAIL(아직 섹션 존재)

- [ ] **Step 3: 제거**

- `settings/index.tsx:382-401` "공고 협업" Card 블록 전체 삭제. 관련 미사용 import(`useReceivedWorkspaceInvitations`, `pendingInvitationsCount`, `BriefcaseIcon`/`InboxIcon` 중 이 블록 전용) 정리 — 다른 곳에서 안 쓰면 삭제(knip 경고 방지).
- `workspace/index.tsx:52-74` `pendingInvitationBanner` 정의 + 렌더 지점 삭제. `useReceivedWorkspaceInvitations`가 이 화면에서 다른 용도 없으면 import도 정리.

> 받은 초대 딥링크(`NotificationRouteMap`)는 건드리지 않는다 — 알림 경로 유지.

- [ ] **Step 4: 통과 + 타입/린트(미사용 import 확인)**

Run: `cd uniqn-mobile && npx jest app/(app)/settings/__tests__ && npm run type-check`
Expected: PASS + exit 0(미사용 import 없음)

- [ ] **Step 5: 커밋**

```bash
git add "uniqn-mobile/app/(app)/settings/index.tsx" "uniqn-mobile/app/(employer)/workspace/index.tsx"
git commit -m "refactor(nav): 설정 협업 섹션·워크스페이스 배너 제거(진입점 단일화)"
```

---

### Task 8: 전체 검증

- [ ] **Step 1: 품질 + 관련 테스트 전량**

Run: `cd uniqn-mobile && npm run quality && npx jest src/domains/job-posting src/hooks functions src/components/weeklyGrid "app/(app)"`
Expected: type-check 0 / lint 0 / format OK / 테스트 PASS

- [ ] **Step 2: 커밋(문서)**

```bash
git add docs/superpowers/specs/2026-07-17-now-lane-improvements-design.md docs/superpowers/plans/2026-07-17-now-lane-improvements.md
git commit -m "docs: 지금 레인 개선 스펙·계획 반영"
```

---

## Self-Review

**Spec coverage:** PR-1A(canShareJob)→Task1·2, PR-1B(OG)→Task3·4, PR-2(용어)→Task5, PR-3(진입점)→Task6·7. 전 항목 매핑됨. ✓

**Placeholder scan:** 순수 로직(Task1·2·3·4 함수 본체)은 완전한 코드. Task5는 교정표+대표 예시, Task6은 완전한 컴포넌트, Task7은 삭제 지시(라인 범위 명시). UI 테스트(Task2·6·7)는 "기존 모킹 패턴 복제" 지시 — 각 화면 테스트 셋업이 파일별로 달라 실측 의존.

**Type consistency:** `canShareJob(posting)` 시그니처 Task1 정의 = Task2 소비 일치. `escapeHtml/isCrawlerUserAgent/buildOgHtml` Task3 정의 = Task4 소비 일치. `ActionSheetOption` Task6에서 `@/components/ui` 타입 사용.

**배포 게이트(사용자, 자동 금지):** OG Function은 CF 대시보드에 `SUPABASE_URL`/`SUPABASE_ANON_KEY`(공개값) 등록 + `node scripts/deploy-cloudflare.js --force` 배포 후 실측 — (a)`curl -A "facebookexternalhit" https://uniqn.app/jobs/<실제id>` → OG 태그 확인, (b)일반 UA → SPA 로드 확인, (c)`_redirects` 우선순위 문제 시 `/jobs/*` 예외 추가. `public/og-default.png` 자산 필요.
