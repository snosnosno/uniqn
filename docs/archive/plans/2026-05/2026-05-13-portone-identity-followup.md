# 본인인증 보류 항목 후속 작업 (2026-05-13)

> 이전 세션 (2026-05-12) 의 3 PR 머지 후 남은 보류 항목들을 그룹 A (기능/보안)
> + 그룹 B (UX 폴리시) 로 정리. 동일 세션에서 awk drift 점검도 동시 수행.

## 우선 작업 — Edge Function awk drift 점검 (완료)

`pitfall_deploy_edge_functions_awk_bug.md` 보강 작업. workflow 도입 (be0415837,
2026-05-11 00:36) ~ awk fix (ceaea0136, 2026-05-12 18:30) 사이 약 42시간 동안
master push 자동 배포가 모두 무력화됨.

8개 커밋 / 4 함수 검증 매트릭스:

| 함수 | 마지막 변경 | prod updated_at (검증 시점) | 결과 |
|------|------------|---------------------------|------|
| `verify-portone-identity` | 72d39d6c9 (05-12 17:58) | 05-12 18:28 | ✓ prev 세션 MCP 수동 배포 |
| `verify-and-save-portone-profile` | 72d39d6c9 (05-12 17:58) | 05-12 18:29 | ✓ prev 세션 MCP 수동 배포 |
| `sync-schedule-board-outbox` | 06b64efde (05-11 01:08) | 05-11 00:38 | ❌ drift |
| `revoke-apple-token` | f7cde84c3 (05-11 07:44) + 94c3b4aee (05-12 03:50) | 05-11 00:38 | ❌ drift |

drift 2건 보안 P1 (`sync-schedule-board-outbox`: CSO finding #1 service_role 일치,
`revoke-apple-token`: Apple JWKS caller binding). 2026-05-13 MCP `deploy_edge_function`
재배포 완료. 사후 검증 — prod 코드에 caller binding step 1.5 + clockTolerance 5s
포함 확인.

## 그룹 A — 기능/보안

### A2. signup form state 영속화 (완료)

소셜 가입 도중 강제 종료 시 약관/단계 손실 방지. 신규 서비스
`src/services/auth/signupDraftService.ts` 추가:

- MMKV STORAGE_KEYS.SIGNUP_DRAFT 키 + 24h TTL + 버전 가드
- 소셜 모드는 OAuth user.id 와 1:1 바인딩 (다른 계정 draft 격리)
- 보안: `account.password` 는 저장하지 않음 — 복원 시 사용자 재입력 필수
- 성공 onSubmit 후 자동 clear, 실패 시 retain
- SignupForm 마운트 시 mode·socialUserId 일치 검증 후 stepIndex + formData 복원

### A3. 재가입 회복 UX (완료)

`callVerifyAndSavePortOneProfile` 에서 edge function 응답의 `code` 를 파싱하여
`PROFILE_ALREADY_COMPLETED` 일 때 `AuthError(AUTH_EMAIL_ALREADY_EXISTS, metadata.reason)`
변환. signup.tsx 양쪽 핸들러(`handleSignUp`, `handleSocialSignUp`)에서 분기:

- 기존 Toast 대신 `Alert.alert("이미 가입된 계정입니다", ...)`
- 사용자 선택: "취소" / "로그인하기" — 후자는 `redirect` 보존하며 `/(auth)/login` 이동

### A4. consumePortOneIdentityVerificationResult 죽은 코드 제거 (완료)

`portOneIdentityService.ts` 정의 + `services/auth/index.ts` barrel export 양쪽 삭제.
유일한 caller 없음 grep 으로 검증. save/clear 함수는 유지.

### A8. verify-portone-identity rate-limit (완료, 배포 대기)

PortOne 호출 비용 + 쿼터 보호. in-memory per-instance rate limit:

- key: `x-forwarded-for` (첫 IP, 64자 trim) → `x-real-ip` → 'unknown' fallback
- limit: 20 req / 60s
- prune: 5분마다 만료 entry 정리
- 신규 error code `IV_RATE_LIMITED` (429) `_shared/idp-errors.ts` 추가

defense-in-depth — 분산 공격엔 한계가 있으나 단일 IP 봇 차단에 충분.
배포: master 커밋 시 edge function workflow 가 자동 배포 (awk fix 완료).

### A9. isVerificationRecent TTL 비대칭 (false alarm — 닫힘)

두 edge function 모두 `isVerificationRecent(verification.verifiedAt)` 호출 시
명시적 maxAgeMs 미전달 → default 5분 (`maxAgeMs = 5 * 60 * 1000`) 사용. 대칭 확인.
별도 작업 불필요.

### A12. user.uid vs user.id 불일치 (false alarm — 닫힘)

`authStore.toAuthUser` 가 `{ uid: supabaseUser.id, ... }` 로 wrap 하여
`AuthUser` 인터페이스의 `uid` 필드 보장 (line 174). `my-data.tsx` 는
`useAuthStore()` 에서 `user` 를 가져오므로 `.uid` 는 정상.

## 그룹 B — UX 폴리시

### B7. Focus ring (이미 적용됨)

`src/components/ui/Button.tsx` 가 이미 impeccable §22 outset 패턴 구현:
- focus state useState 관리 + onFocus/onBlur 핸들러
- m-[-2px] 외부 wrapper + border-2 (focused: info-500 `#2563EB`, default: transparent)
- layout shift 없음

본인인증 + signup 의 주요 CTA 는 Button 사용 — B7 핵심 충족. 잔존 raw Pressable
(SignupStepTerms 체크박스, Modal close 등) 은 follow-up 으로 잔류.

### B9. 본인인증 빈 상태 = 온보딩 (완료)

impeccable §9 3단 구성 적용 (인지 / 가치 / 행동):

- 인지: ShieldCheck + "이니시스 본인인증" 헤더
- 가치 1: ClockIcon + "약 30초~1분이면 끝나요"
- 가치 2: 인증 수단 chip — PASS / 토스 / 카카오 / 네이버 / 신한 / KB
- 가치 3: LockIcon + privacy disclosure (수집 항목 + 암호화 처리 안내)
- 행동: "본인인증 시작" CTA

`.tsx` + `.web.tsx` 양쪽 적용.

### B10. Truncation 정책 (완료)

`verifiedIdentity.name`/`birthDate`/`gender`/`phoneNumber` 표시 영역에 적용:

- 이름: `numberOfLines={1}` `ellipsizeMode="tail"` `flex-shrink`
- 기타: `numberOfLines={1}` (overflow 안전망)
- 전화번호: 포맷 고정이므로 사실상 overflow 없음 — 안전망만

impeccable §26 — 금액·전화번호 truncation 금지 원칙 준수.

### B11. handleIdentityBack identity 보존 (완료)

이전: default 모드에서 `setFormData((prev) => ({ ...prev, identity: undefined }))`
로 인증 결과 silent 폐기.

수정: `handleIdentityBack` 에서 identity 데이터 그대로 유지하고 stepIndex 만 감소.
사용자가 다시 본인인증 step 으로 돌아오면 인증된 정보가 표시됨.

### B13. socialStepIndex 별도 상태 (완료)

`currentStep` (1=terms, 2=account, 3=identity) → 사회 모드에서 1→3 점프 발생.

리팩토링:
- `StepKey` 타입 ('terms' | 'account' | 'identity')
- `STEP_FLOW` 매핑: default `['terms', 'account', 'identity']`, social `['terms', 'identity']`, reverify `['identity']`
- `stepIndex` (0-based linear, 항상 +1/-1 만) + 파생 `currentStepKey` + `displayStep`
- `goToStep(key)` helper 로 명시적 점프 (이메일 중복 fallback 등)
- `renderStep` switch 가 `currentStepKey` 분기

### B14. ARIA announcement (완료)

`handleVerificationComplete` 성공 path 에서
`AccessibilityInfo.announceForAccessibility('본인인증이 완료되었습니다')` 호출.
`.tsx` + `.web.tsx` 양쪽 적용. 자동 채움된 폼 필드 변경을 스크린리더 사용자에게
즉시 전달.

### B15. errorMessage 자동 dismiss (완료)

`useEffect(() => { ... setTimeout(setErrorMessage(null), 5000); ... })` 추가.
errorMessage 가 set 되면 5초 후 자동 clear. 모달 닫은 후 stale 에러가 남는
carry-over 방지. cleanup 으로 unmount 후 setState 차단.

### B16. Modal close 라벨 분기 (완료)

`Modal` 컴포넌트에 `closeAccessibilityLabel?: string` prop 추가 (기본 "닫기").
PortOneIdentityVerification 의 모달은 `closeAccessibilityLabel="본인인증 취소"`
전달 — 진행 중 컨텍스트 (모달은 SDK 표시 중에만 열려 있으므로 항상 "취소"
시맨틱). WebModal + NativeModal 양쪽 적용.

### B18. Modal height 안전영역 (완료)

iPhone SE 1세대 (568px) 등 작은 기기에서 헤더(~45px) + 패딩(~40px) + safeArea
버퍼(60px) 차감 후 가용 영역 부족하던 문제 수정:

```ts
const MODAL_MAX_RATIO = 0.85;
const MODAL_CHROME = 45 + 40 + 60;
const availableHeight = height * MODAL_MAX_RATIO - MODAL_CHROME;
const modalHeight = Math.max(360, Math.min(640, availableHeight));
```

- 작은 화면: max(360, ...) → 360 fallback (PortOne iframe responsive)
- 큰 화면: min(640, ...) → 640 cap (과도 확장 방지)

## 변경 파일 목록

| 항목 | 파일 |
|------|------|
| A4 | `src/services/auth/portOneIdentityService.ts`, `src/services/auth/index.ts` |
| B10 / B14 / B15 / B16 | `src/components/ui/Modal.tsx`, `src/components/auth/PortOneIdentityVerification.tsx`, `src/components/auth/PortOneIdentityVerification.web.tsx` |
| B11 / B13 | `src/components/auth/signup/SignupForm.tsx` |
| A2 | `src/services/auth/signupDraftService.ts` (신규), `src/services/auth/index.ts`, `src/lib/mmkvStorage.ts`, `src/components/auth/signup/SignupForm.tsx` |
| A3 | `src/services/auth/portOneIdentityService.ts`, `app/(auth)/signup.tsx` |
| B9 | `src/components/auth/PortOneIdentityVerification.tsx`, `src/components/auth/PortOneIdentityVerification.web.tsx` |
| A8 | `supabase/functions/_shared/idp-errors.ts`, `supabase/functions/verify-portone-identity/index.ts` |
| B18 | `src/components/auth/PortOneIdentityVerification.tsx` |

## 검증

- `npm run quality`: 0 errors (기존 11 warnings — 본 작업 외 파일)
- `npx jest --testPathPattern="portOneIdentity|authService|idp-binding|PortOneIdentityVerification|authRedirect"`: 56/56 passed

## 미배포 항목

- **A8 verify-portone-identity rate-limit**: 코드 변경만 완료. master 커밋 시
  Deploy Edge Functions workflow 가 자동 배포 (awk fix 적용 완료).

## 잔존 follow-up

- B7 raw Pressable 보강: SignupStepTerms 체크박스 3건, Modal close 버튼 등
  외부 키보드 사용자용 focus ring 미적용. 사용자 영향 미미 (주요 CTA 모두 Button).
- A2 통합 테스트: 강제 종료 + 재진입 시나리오 e2e 추가 권장.
- A3 통합 테스트: PROFILE_ALREADY_COMPLETED 시 Alert 분기 단위 테스트 권장.
