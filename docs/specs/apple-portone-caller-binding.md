# Spec v3: External IdP 토큰 caller binding (현실적 축소판)

**작성일**: 2026-05-11
**버전**: v3 (v1 폐기 — codex review / v2 폐기 — prod 검증 실패 / v3 — prod 실태 정렬)
**출처**: `/cso` finding #2 #3 + 4-way review (CEO / UX / DX / Codex) + prod 검증 (auth.identities + 코드베이스)
**상태**: 구현 대기

---

## v2 → v3 변경 이유 (prod 검증 실패 3건)

prod state 직접 조회로 v2의 핵심 가정 3건이 깨짐:

1. **Sentry 통합 자체 부재**: `@sentry/*` 패키지 없음, `Sentry.init` 코드 없음, `beforeSend` 없음. eas.json `SENTRY_ORG` env와 `.env.local` DSN만 설정되고 코드 통합 안 됨. v2의 "PR-A에 Sentry redact 핵심"은 **Sentry SDK 통합부터 시작해야** 가능 → 별도 spec
2. **prod Apple user = 0**: `auth.identities WHERE provider='apple'` 결과 0건 (이메일 4건만). v2의 "PR-B 0단계 prod fixture 검증" 불가능. revoke-apple-token이 실 프로덕션에서 호출된 적 0회 가능성. PR-B 코드 작성은 가능하지만 dead path
3. **PortOne `di` 응답 미검증**: 코드베이스에 `verifiedCustomer.di` 사용 흔적 0개. PortOne docs는 "PG사가 di 미제공 가능" 명시. 한국 KCP/INICIS의 실제 di 응답 여부 불명

→ v3는 prod에서 검증 가능한 항목만 즉시 진행, 나머지는 사전 작업 후 별도 spec.

## 진행 가능한 항목 (PR-A)

### 1. verifiedAt 5분 TTL (양 함수)

leak된 PortOne ID의 replay 차단. PortOne API 응답의 `verifiedAt` 필드는 v1/v2 시점에 코드에 이미 사용 (`verify-and-save-portone-profile/index.ts:221`). 응답 형태 변경 0.

```typescript
// _shared/idp-binding.ts (신규)
import { IDP_ERROR_CODES, type IdpErrorCode } from './idp-errors.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function idpError(code: IdpErrorCode, detail?: string): Response {
  const { status, message } = IDP_ERROR_CODES[code];
  return new Response(JSON.stringify({ error: message, code, ...(detail ? { detail } : {}) }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function isVerificationRecent(verifiedAt: string | undefined, maxAgeMs = 5 * 60 * 1000): boolean {
  const ms = verifiedAt ? new Date(verifiedAt).getTime() : NaN;
  return !isNaN(ms) && Date.now() - ms <= maxAgeMs;
}
```

`verify-portone-identity` (line 84 이후):
```typescript
const verification = await portoneRes.json();
if (verification.status !== 'VERIFIED') {
  return idpError('PORTONE_NOT_VERIFIED');
}
if (!isVerificationRecent(verification.verifiedAt)) {
  return idpError('IV_TIMESTAMP_EXPIRED');
}
```

`verify-and-save-portone-profile` (line 134 이후): 동일 패턴. `idpError` 함수가 throw/catch 없이 직접 Response 반환 — explicit + 짧음.

**`verify-portone-identity`에 authHeader 강제 추가 안 함** (codex F1 — signup flow 깨짐 방지). 대신 leak 경로 차단으로 위협 완화.

### 2. 에러 코드 enum

```typescript
// _shared/idp-errors.ts
export const IDP_ERROR_CODES = {
  IV_TIMESTAMP_EXPIRED: { status: 400, message: '본인인증 세션이 만료되었습니다. 다시 진행해주세요.' },
  IV_INVALID: { status: 400, message: '본인인증 정보가 올바르지 않습니다.' },
  IV_DUPLICATE_PHONE: { status: 409, message: '이미 등록된 전화번호입니다.' },
  IV_DUPLICATE_CI: { status: 409, message: '이미 인증된 신원입니다.' },
  IV_DUPLICATE_NICKNAME: { status: 409, message: '이미 사용 중인 닉네임입니다.' },
  AUTH_REQUIRED: { status: 401, message: '인증이 필요합니다.' },
  AUTH_FAILED: { status: 401, message: '인증 실패' },
  PORTONE_FETCH_FAILED: { status: 400, message: '본인인증 정보 조회 실패' },
  PORTONE_NOT_VERIFIED: { status: 400, message: '본인인증이 완료되지 않았습니다.' },
  PORTONE_INCOMPLETE: { status: 400, message: '본인인증 데이터가 불완전합니다.' },
  PORTONE_AGE_RESTRICTED: { status: 400, message: '14세 이상만 가입할 수 있습니다.' },
  PROFILE_ALREADY_COMPLETED: { status: 409, message: '이미 프로필이 완료된 계정입니다.' },
} as const;

export type IdpErrorCode = keyof typeof IDP_ERROR_CODES;
```

기존 코드의 inline 한글 에러 메시지 → enum 참조로 정리. 클라이언트는 `code` 키로 분기 가능.

### 3. DRY 정리 — `_shared/idp-binding.ts`

기존 `verify-portone-identity`와 `verify-and-save-portone-profile`에 중복된 헬퍼를 추출:
- `corsHeaders`
- `jsonResponse(data, status)`
- `createDeterministicHash(value, secret)` (HMAC-SHA256)
- `normalizeBirthDate(value)`
- `normalizeGender(value)`
- `toE164(phone)`
- `validateAge(birthDate, minAge)`
- `isVerificationRecent(verifiedAt, maxAgeMs)` (신규)
- `idpError(code, detail?)` (신규)
- `IDP_ERROR_CODES` enum (신규, idp-errors.ts에 분리)

기존 함수 두 개를 utils import로 정리. PR 크기는 ~+150 / -80 lines 정도.

### 4. di 응답 여부 — PR-A에서 다루지 않음

PortOne v2 `verifiedCustomer.di` 응답 여부는 PortOne support 직접 문의로 확인 후 spec C 진입 결정. 진단 로그/임시 테이블 도입 0. PR-A는 timestamp + DRY + 에러 enum만.

## 보류 항목 (별도 spec)

### Spec A: Sentry SDK 통합 + leak filter
- `@sentry/react-native` 또는 `sentry-expo` 도입 (RN 0.83.4 호환 버전 평가)
- `Sentry.init` + `beforeSend`/`beforeBreadcrumb` redact (`authorizationCode`, `identityVerificationId`, `id_token`, `refresh_token`, `access_token`)
- DSN, ORG, PROJECT는 이미 env에 있음
- 별도 spec 이유: Sentry 도입은 +1주 작업 (init, source map, alert 룰, sampling, performance 모니터링). 보안 leak filter는 그 후 자연스럽게.

### Spec B: Apple id_token sub 검증 (PR-B 보류)
- prod Apple user 등장 후 또는 baseline 검증용 staging Apple user 1건 만든 후 진행
- 코드 자체는 v2 spec과 동일 (`_shared/apple-jwks.ts` + `revoke-apple-token`에 sub 비교)
- 트리거: Apple sign-in 베타 user 등장, 또는 staging에 Apple test account 1건 시드

### Spec C: PortOne di_hash dedup (조건부)
- v3 PR-A의 진단 로그 결과로 di 응답 확인된 경우 진행
- 마이그레이션 + 코드 + dedup 쿼리

## 영향 범위 (v3 단순화)

| 파일 | 변경 | PR |
|---|---|---|
| `_shared/idp-binding.ts` | 신규 (헬퍼 + IdpError + assertRecentVerification) | PR-A |
| `_shared/idp-errors.ts` | 신규 (IDP_ERROR_CODES enum) | PR-A |
| `verify-portone-identity/index.ts` | timestamp 가드 + utils import + 에러 코드 | PR-A |
| `verify-and-save-portone-profile/index.ts` | timestamp 가드 + utils import + 에러 코드 | PR-A |

**총 4파일, 0 마이그레이션, 0 신규 함수, 0 신규 테이블**. 일정 1일.

## 테스트 계획

### unit tests (12건)

**verify-portone-identity** (`uniqn-mobile/supabase/functions/verify-portone-identity/_tests/`):
- [ ] verifiedAt 4분 전 → 200
- [ ] verifiedAt 6분 전 → 400 IV_TIMESTAMP_EXPIRED [REGRESSION]
- [ ] verifiedAt missing → 400 IV_TIMESTAMP_EXPIRED
- [ ] verifiedAt invalid string → 400 IV_TIMESTAMP_EXPIRED
- [ ] status !== 'VERIFIED' → PORTONE_NOT_VERIFIED, 기존 한글 메시지 그대로 유지 [REGRESSION]

**verify-and-save-portone-profile** (`_tests/`):
- [ ] 동일 timestamp 4 케이스 [REGRESSION]
- [ ] 에러 응답이 `{ error, code }` 동시 포함, error 한글 메시지 변경 없음 [REGRESSION contract]

**`_shared/idp-binding.ts`** (`_tests/`):
- [ ] `isVerificationRecent` 경계: 정확히 5분 → false, 4분59초 → true
- [ ] `idpError` 응답 형식 검증 (error/code 필드, status, headers)

### e2e (2건)
- [ ] 정상 가입 (PortOne 호출 → save) — timestamp 가드 도입 후에도 정상
- [ ] 본인인증 30분 방치 후 재시도 → IV_TIMESTAMP_EXPIRED 명확한 에러

총 14건 (unit 12 + e2e 2). v2의 21건 → v3 14건 (Sentry/Apple/di 테스트 보류).

## 위협 모델 재평가 (v3 시점)

| 시나리오 | v3 잔존 위험 | 정당화 |
|---|---|---|
| Apple authorization code leak | 그대로 | PR-B 보류로 인해 잔존. 단 prod에 Apple user 0명이라 실효적 attack surface도 0. 첫 Apple user 등장 즉시 spec B 발동 |
| PortOne iv_id replay (5분 후) | 차단 ✓ | timestamp 가드 |
| PortOne iv_id replay (5분 이내) | 부분 차단 | profile_completed 가드 + ci_hash 충돌 검사가 이미 가입 user 보호. 미가입 user 잔존 위험은 낮음 (iv_id 입수 난이도 매우 높음) |
| Sentry breadcrumb leak | 미차단 | Spec A 도입 전엔 그대로. 단, Sentry가 통합 안 됐으니 leak 채널도 아직 없음 (역설적으로 안전) |
| verify-portone-identity 익명 oracle | 미차단 | iv_id는 client per-session 생성, 추측 불가. 실효 위험 매우 낮음. 추후 rate limit 별도 spec 가능 |

핵심: **v3는 잔존 위험을 정직하게 표시**. v1/v2가 했던 "다 막은 것처럼" 표현 안 함.

## 단계별 PR

### PR-A: timestamp + DRY + 에러 enum (예상 0.5일)
- `_shared/idp-binding.ts` + `_shared/idp-errors.ts` 추출
- 양 함수에 timestamp 가드 + utils import + 에러 코드 enum 적용
- unit tests 10건 + e2e 2건

### Spec A/B/C: 별도 spec, 별도 일정

## 비고

- **error contract for client**: `code` 필드는 stable contract. 기존 한글 메시지가 변경되어도 code는 유지. 클라가 `error.code === 'IV_TIMESTAMP_EXPIRED'`로 분기
- **에러 응답 형태 변경 호환성**: v3 PR-A는 기존 한글 message는 그대로 두고 `code`/`detail` 필드만 추가. 클라이언트가 `error.error` (한글 메시지)를 읽고 있어도 깨지지 않음
- **rollback**: PR-A는 단일 commit으로 revert 가능. 마이그레이션 0개, 신규 외부 의존 0개
- **운영 모니터링**: Spec A/B/C 진입 트리거 = (a) Apple user 1건 등장, (b) di 진단 로그 1주 결과
- **prod 검증 도구화**: 향후 spec에 "사전 prod 검증 체크리스트" 섹션 도입 권장 — Sentry 통합 여부, 외부 IdP 응답 필드 실데이터, prod auth.identities 분포 등을 spec 작성 전 기록

## 변경 사항 추적 (v1 → v2 → v3)

| 항목 | v1 | v2 | v3 |
|---|---|---|---|
| `verify-portone-identity` authHeader | 강제 | anonymous 유지 | anonymous 유지 |
| iv_id 사전 등록 | PR-C | 폐기 | 폐기 |
| Sentry redact | 비고 | PR-A 핵심 | **별도 spec A** (Sentry SDK 통합 부재) |
| Apple JWKS verify | PR-B | PR-B + 0단계 검증 | **별도 spec B** (prod Apple user 0명) |
| di_hash dedup | PR-C | PR-A | **조건부 spec C** (PortOne 응답 미검증) |
| 에러 코드 contract | 미정 | 부분 enum | **완전 enum 도입** |
| Force update modal | PR-C | 별도 spec | 별도 spec |
| 총 PR 수 | 3 | 2 | **1 (즉시) + 3 (조건부)** |
| 총 테스트 | 32 | 21 | **12** |
| 예상 일정 (즉시) | 5일 | 1.5~2일 | **0.5~1일** |

## 다음 액션

1. ✅ v3 prod 검증 정렬 완료 (2026-05-11)
2. 🔄 신규 eng-review (`/plan-eng-review`) — v3 검토 대기
3. PR-A 구현 (eng-review 통과 후 0.5~1일)
4. PortOne support 문의: INICIS/KCP가 `verifiedCustomer.di` 응답에 포함하는지 → spec C 진입 결정
5. Apple user 첫 등장 시: spec B 진입
6. Sentry 도입 spec A는 보안 외 가치(observability) 평가 후 우선순위 결정

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 (v1) | RESOLVED | 4 insights, TOP: PR-C overkill — v3에 반영됨 |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 (v1) | ISSUES_FOUND → RESOLVED | 5 critical findings, 모두 v3 설계에 반영 |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 (v1) + prod check (v2 차단) | NEEDS_RERUN_ON_V3 | v1 7 resolved, v2 prod 검증 실패 → v3 작성. 신규 eng-review 필요 |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 (force update modal) | RESOLVED | force update 별도 spec으로 분리 |
| DX Review | `/plan-devex-review` | Developer experience | 1 (v1) | RESOLVED | 5 findings, 핵심 contract enum이 v3 PR-A에 포함 |

**CROSS-MODEL CONSENSUS**: v3는 4개 리뷰 + prod 검증을 모두 수용. PR-A 단독 진행 가능.

**VERDICT**: v3 ENG-REVIEW 진행 대기. 즉시 implementation 가능한 가장 작은 코어로 축소됨.

---

## PR-A 구현 완료 (2026-05-11)

- `_shared/idp-errors.ts` + `_shared/idp-binding.ts` 신규
- `verify-portone-identity/index.ts` + `verify-and-save-portone-profile/index.ts` 리팩토링 (timestamp 가드 + DRY + idpError 치환, authHeader 강제 추가 안 함 — codex F1 회피)
- unit test 10건 (`__tests__/supabase-shared/idp-binding.test.ts`) — isVerificationRecent 4 + idpError 2 + 헬퍼 회귀 4 모두 통과
- e2e skeleton 4건 (`e2e/tests/p1-important/portone-timestamp-guard.spec.ts`) — PortOne mock infrastructure 부재로 `test.skip` 처리, 인프라 도입 후 unskip
- `tsconfig.json` `allowImportingTsExtensions: true` (Deno-style `.ts` 확장자 import 호환)
- `npm run quality` + `npm test` (4054 pass) baseline 유지
- 보류: Spec A (Sentry SDK 통합) / Spec B (Apple JWKS) / Spec C (di_hash dedup) — 트리거 충족 시 별도 진행
