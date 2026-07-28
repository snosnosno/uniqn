/**
 * Cloudflare Pages Functions 쪽 "브라우즈 가능한 공고 상태" 단일 소스.
 *
 * ⚠️ 왜 src/ 의 BROWSABLE_POSTING_STATUSES 를 그대로 import 하지 않는가:
 *   functions/ 는 tsconfig.json 의 exclude 대상이고(`npm run quality` 의 type-check 범위 밖),
 *   CF Pages 가 별도 번들로 빌드해 `@/` 경로 alias 가 해석되지 않는다. src 를 상대경로로
 *   끌어오면 앱 모듈 그래프가 엣지 번들에 딸려 들어간다.
 *
 * 그래서 값은 여기 한 번만 적고, src 원본과의 일치는 __tests__/postingStatus.test.ts 가
 * 강제한다(그 테스트는 jest moduleNameMapper 덕에 양쪽을 동시에 import 할 수 있다).
 * 종전에는 functions/jobs/index.ts 와 functions/jobs/[id].ts 가 각자 리터럴을 들고 있어
 * src 까지 합쳐 같은 값이 세 벌이었다.
 */
export const BROWSABLE_POSTING_STATUSES = ['active', 'capacity_full'] as const;

/** 상세 OG 의 공유 가능 판정용 — 목록 노출 규칙과 같은 집합이다. */
export const BROWSABLE_POSTING_STATUS_SET: ReadonlySet<string> = new Set(
  BROWSABLE_POSTING_STATUSES
);
