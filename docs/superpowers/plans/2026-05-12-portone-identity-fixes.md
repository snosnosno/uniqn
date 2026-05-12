# 포트원 본인인증 — 결함 일괄 수정 (3 PR)

## 배경
직전 세션의 코드베이스 분석 결과 A1-A14 / B1-B18 결함 식별. 사용자 선택:
- PR 분할: **단계별 3개 PR**
- HASH_PEPPER: **즉시 cutover** (운영 협의 후 회전 가능)
- 본인인증 화면: **`signup?mode=reverify` 재활용** (전용 화면 신설 X)

## PR1 — A1 reverify + A14 어드민 배지 (🔴 Critical 차단 해소)

### 목표
1. `identityVerified === false` 사용자가 앱 진입 막힌 문제 해소
2. 사장님 등록 dead-end (A13) 해소
3. 어드민 배지가 잘못된 컬럼(phoneVerified) 으로 본인인증 여부 판단하는 문제 해소

### 변경 파일
| 파일 | 변경 |
|------|------|
| `uniqn-mobile/app/(auth)/signup.tsx` | `mode='reverify'` 분기 추가, 핸들러 `handleReverify` 신설 |
| `uniqn-mobile/src/components/auth/signup/SignupForm.tsx` | `mode='reverify'` 추가, REVERIFY_STEPS(본인인증 1단계만) |
| `uniqn-mobile/supabase/functions/verify-and-save-portone-profile/index.ts` | `mode='reverify'` 분기 — `PROFILE_ALREADY_COMPLETED` 차단 해제, update only |
| `uniqn-mobile/src/services/auth/portOneIdentityService.ts` | `VerifyAndSavePortOneProfilePayload.mode` 에 `'reverify'` 추가 |
| `uniqn-mobile/src/services/auth/socialLoginService.ts` 또는 신설 `reverifyService.ts` | `callReverifyIdentity` 신규 export |
| `uniqn-mobile/app/(app)/employer-register.tsx` | toast dead-end → `router.push('/(auth)/signup?mode=reverify')` |
| `uniqn-mobile/app/(admin)/employer-applications/index.tsx:142` | `phoneVerified` → `identityVerified` |
| `uniqn-mobile/app/(admin)/employer-applications/[id].tsx:195, 302-303` | 동일 교체 |
| `uniqn-mobile/app/(admin)/users/[id].tsx:267` | 라벨 확인 + 값 일치 검증 |

### 보안 가드
- `verify-and-save` 의 reverify 분기는 여전히 caller binding + AUTH 필수
- reverify 는 본인인증 핵심 필드(name, birth_date, gender, phone, identity_*) 만 갱신; nickname/region 등 프로필 필드는 건드리지 않음
- 멱등성 INSERT 는 동일하게 적용 (재인증 verificationId 도 1회 처리)
- audit log: reverify 분기 진입 시 `console.info('[reverify]', { uid, prev_identity_verified })` 명시

### 테스트
- 단위: `verify-and-save-portone-profile` reverify 분기 (mode=reverify, 기존 profile_completed=true 케이스)
- e2e: `auth-signup.spec.ts` 에 reverify 시나리오 추가 (identity_verified=false 사용자 로그인 → reverify 페이지 자동 이동 → 인증 완료 → 홈)

### 검증
- `tsc --noEmit`
- `npm test -- portOneIdentity reverify`
- 로컬 dev 서버에서 수동 reverify 흐름

---

## PR2 — 보안 강화 A5/A6/A7/A10/A11 (🟠 High)

### 변경 파일
| 파일 | 변경 |
|------|------|
| `uniqn-mobile/supabase/functions/verify-and-save-portone-profile/index.ts` | A5: auth.admin.updateUserById 실패를 명시 에러로 승격(`AUTH_METADATA_UPDATE_FAILED`) |
| `uniqn-mobile/supabase/functions/_shared/idp-binding.ts` | A6: `createDeterministicHash` 가 별도 `IDENTITY_HASH_PEPPER` env 사용; portoneSecret 사용 분기 제거 |
| `uniqn-mobile/supabase/functions/verify-portone-identity/index.ts` | A6 적용 (검증 측에서도 동일 pepper) |
| `uniqn-mobile/supabase/functions/_shared/idp-errors.ts` | A5: AUTH_METADATA_UPDATE_FAILED 매핑 추가 |
| `uniqn-mobile/supabase/functions/verify-and-save-portone-profile/index.ts` | A7: 멱등성 롤백 실패 시 console.error → Sentry capture (Sentry SDK 가 edge function 에 있으면) 또는 명시 alert payload |
| `uniqn-mobile/src/services/auth/portOneIdentityService.ts` | A10: `expectedBindingToken` 정확 64자 hex 정규식 |
| `uniqn-mobile/supabase/functions/verify-portone-identity/index.ts` | A10: 서버측에서도 동일 검증 (`/^[0-9a-f]{64}$/`) |
| `uniqn-mobile/supabase/functions/verify-and-save-portone-profile/index.ts` | A10: 동일 |
| `uniqn-mobile/src/components/auth/PortOneIdentityVerification.tsx` | A11: `useIsMounted` 가드, SDK 콜백 race 방지 |
| `uniqn-mobile/src/components/auth/PortOneIdentityVerification.web.tsx` | A11: 동일 (cleanup 통일) |

### 마이그레이션 (즉시 cutover)
- 새 secret: `IDENTITY_HASH_PEPPER` (32바이트 random hex) — Supabase secrets 에 추가
- 기존 `identity_ci_hash` 데이터는 그대로 유지 (DB 변경 없음)
- 새 가입자부터 pepper hash 사용 → 중복 검사 시 두 hash 가 다른 알고리즘이라 false negative 가능 → 단기적으로 수용 (운영 협의 결과)
- `MEMORY.md` 에 pepper 회전 시점 기록

### 테스트
- `__tests__/supabase-shared/idp-binding.test.ts` — pepper 적용 확인
- A11: 컴포넌트 unmount 중 onComplete 콜백 호출 시 state 업데이트 안 일어남 확인

---

## PR3 — UX 폴리시 B1/B3/B5/B6/B8/B12/B14 (🟡 Medium)

### 변경 파일
| 파일 | 변경 |
|------|------|
| `uniqn-mobile/src/components/auth/PortOneIdentityVerification.tsx` | B1: 에러 메시지에 CTA 액션. B5: Haptics 3 트리거. B8: statusBarStyle 분기. B14: announceForAccessibility |
| `uniqn-mobile/src/components/auth/PortOneIdentityVerification.web.tsx` | 동일 (Haptics 제외, statusBar 제외) |
| `uniqn-mobile/src/utils/formatters/birthDate.ts` (신규) | B6: 인라인 함수 추출 |
| `uniqn-mobile/src/utils/formatters/index.ts` | re-export |
| `uniqn-mobile/app/(app)/settings/my-data.tsx` | B12: 기본 정보 카드에서 이름·연락처 중복 제거 (본인인증 카드는 인증 상태 + 생년월일/성별만) |
| `uniqn-mobile/src/utils/haptics.ts` | 기존 헬퍼 확인, throttle 적용 (Rule 17) |

### 에러 메시지 + CTA 매핑 (B1)
| 코드 | 새 메시지 | CTA |
|------|----------|-----|
| `hasDuplicatePhone` | "이미 가입된 번호예요. 로그인하시거나 비밀번호를 찾아주세요." | [로그인] [비밀번호 찾기] |
| `hasDuplicateIdentity` | "동일한 명의로 가입된 계정이 있어요. 기존 계정으로 로그인해주세요." | [로그인] |
| `phoneVerified=false` | "본인인증 결과에서 휴대폰 번호를 받지 못했어요. 다른 인증 수단(PASS·토스·카카오)으로 다시 시도해주세요." | [다시 시도] |
| `gender 누락` | "성별 정보가 누락되었어요. 다른 인증 수단으로 다시 시도해주세요." | [다시 시도] |
| `isReady=false` | "본인인증 서비스 일시 점검 중이에요. 잠시 후 다시 시도해주세요." | [닫기] + Sentry capture |
| 인증 창 닫힘 | "본인인증을 완료하지 못했어요. 다시 시도하시겠어요?" | [다시 시도] |

### 테스트
- `__tests__/components/PortOneIdentityVerification.web.test.tsx` — CTA 동작 확인
- A11y: VoiceOver 시뮬레이션 (가능한 범위)

---

## 실행 순서
1. PR1 plan → 구현 → 검증 → 사용자 리뷰 → master 머지
2. PR2 plan → secret 등록 → 구현 → 검증 → 머지
3. PR3 plan → 구현 → 검증 → 머지

각 PR 의 type-check, lint, test 통과 후 사용자 컨펌 받고 머지.

## 미해결/보류 항목
- A2 (소셜 도중 강제 종료 시 약관 손실) — form state 영속화 필요. 후속 PR 후보
- A3 (회원가입 실패 후 같은 이메일 회복 흐름) — 정책 결정 후 별도 PR
- A4 (consumePortOneIdentityVerificationResult 죽은 코드) — 별도 cleanup PR
- A8 (verify-portone-identity anon rate-limit) — Cloudflare/Supabase rate-limit 설정 별도 작업
- A9 (TTL 비대칭) — `idp-binding.ts` 본문 미열람, 별도 검증 필요
- A12 (`user.uid` vs `user.id`) — store wrapper 검증 별도
- B2/B7/B9/B10/B11/B13/B15/B16/B17/B18 — UX 폴리시 후속 PR
