#!/usr/bin/env bash
# 본인인증 보류 항목 후속 PR — 8개 단일 커밋 시퀀스
# auto-mode classifier 가 master 직접 커밋을 차단하므로 사용자 수동 실행 필요.
# 실행 위치: 프로젝트 루트 (C:/Users/user/Desktop/T-HOLDEM)
#
# 각 커밋은 단일 PR 컨셉. 머지 시 awk 수정된 Deploy Edge Functions workflow 가
# verify-portone-identity 변경만 자동 배포 (rate-limit). 다른 함수는 영향 없음.

set -euo pipefail

# 0. plan + 후속 작업 문서 (선커밋)
git add docs/superpowers/plans/2026-05-13-portone-identity-followup.md
git commit -m "$(cat <<'EOF'
docs(auth): 본인인증 보류 항목 후속 plan + commit 시퀀스 (2026-05-13)

- awk drift 점검 결과 (2건 재배포 완료)
- A2/A3/A4/A8 + B9/B10/B11/B13/B14/B15/B16/B18 항목별 결정 사항
- A9/A12 false alarm 종결, B7 기존 충족 명시

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 1. A4 — consumePortOneIdentityVerificationResult 죽은 코드 제거
git add uniqn-mobile/src/services/auth/portOneIdentityService.ts \
        uniqn-mobile/src/services/auth/index.ts
git commit -m "$(cat <<'EOF'
refactor(auth): A4 consumePortOneIdentityVerificationResult 죽은 코드 제거

호출처 없는 export 를 portOneIdentityService + barrel(index.ts) 양쪽에서 삭제.
result 저장은 savePortOneIdentityVerificationResult, 정리는 clear* 로 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 2. B10+B14+B15+B16 — UX 폴리시 묶음
git add uniqn-mobile/src/components/ui/Modal.tsx \
        uniqn-mobile/src/components/auth/PortOneIdentityVerification.tsx \
        uniqn-mobile/src/components/auth/PortOneIdentityVerification.web.tsx
git commit -m "$(cat <<'EOF'
style(auth): B10/B14/B15/B16 본인인증 UX 폴리시 4건

- B10 Truncation 정책 — 이름 numberOfLines=1 ellipsizeMode=tail, 나머지 값 안전망
- B14 ARIA — 자동 채움 완료 시 AccessibilityInfo.announceForAccessibility
- B15 stale errorMessage — 5초 후 자동 dismiss (carry-over 방지)
- B16 Modal closeAccessibilityLabel prop — 본인인증 모달은 "본인인증 취소"

Modal 컴포넌트에 closeAccessibilityLabel?: string 추가, WebModal + NativeModal 양쪽 적용.
PortOneIdentityVerification .tsx + .web.tsx 동기 적용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 3. B11+B13 — Signup navigation/state 리팩토링
# NOTE: 이 커밋은 SignupForm 만 변경. A2 작업이 같은 파일을 추가로 수정하므로
# 5번째 커밋(A2)에서 함께 staging.
# B11/B13/A2 통합 커밋은 4. 에서 처리.

# 4. A2 + B11 + B13 — SignupForm 통합 변경 (form draft 영속화 + linear stepIndex + identity 보존)
git add uniqn-mobile/src/lib/mmkvStorage.ts \
        uniqn-mobile/src/services/auth/signupDraftService.ts \
        uniqn-mobile/src/services/auth/index.ts \
        uniqn-mobile/src/components/auth/signup/SignupForm.tsx
git commit -m "$(cat <<'EOF'
feat(auth): A2/B11/B13 회원가입 폼 draft 영속화 + step state 정리

- A2 signupDraftService 신규 — MMKV 24h TTL + 버전 가드 + 소셜 user.id 바인딩
  - password 는 저장하지 않음 (보안). email/terms/identity 만 복원
  - SignupForm 마운트 시 복원, formData/stepIndex 변경 시 저장, onSubmit 성공 시 clear
- B11 handleIdentityBack identity 보존 — 이전 step 이동 시 인증 결과 silent 폐기 제거
- B13 socialStepIndex 정리 — StepKey type + STEP_FLOW 매핑 + 0-based linear stepIndex
  - currentStep 1→3 점프 제거, goToStep(key) 명시적 jump 도입

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 5. A3 — 재가입 회복 UX
git add uniqn-mobile/src/services/auth/portOneIdentityService.ts \
        uniqn-mobile/app/'(auth)'/signup.tsx
git commit -m "$(cat <<'EOF'
fix(auth): A3 PROFILE_ALREADY_COMPLETED 재가입 회복 UX

- callVerifyAndSavePortOneProfile 에서 edge function 응답의 code 파싱
- PROFILE_ALREADY_COMPLETED 시 AuthError(AUTH_EMAIL_ALREADY_EXISTS) + metadata.reason
- signup.tsx 의 handleSignUp/handleSocialSignUp 에서 isProfileAlreadyCompletedError 분기
  - Toast 대신 Alert 으로 "취소 / 로그인하기" 선택지 제공
  - "로그인하기" 는 redirect 보존하며 /(auth)/login 이동

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 6. B9 — 본인인증 빈 상태 = 온보딩
git add uniqn-mobile/src/components/auth/PortOneIdentityVerification.tsx \
        uniqn-mobile/src/components/auth/PortOneIdentityVerification.web.tsx
git commit -m "$(cat <<'EOF'
style(auth): B9 본인인증 빈 상태 = 온보딩 (impeccable §9)

- 인지: ShieldCheck + 이니시스 본인인증
- 가치 1: Clock + "약 30초~1분이면 끝나요"
- 가치 2: PASS/토스/카카오/네이버/신한/KB chip
- 가치 3: Lock + 수집 항목 + 암호화 disclosure
- 행동: 본인인증 시작 CTA

.tsx + .web.tsx 양쪽 동기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 7. B18 — Modal height 안전영역 수정
git add uniqn-mobile/src/components/auth/PortOneIdentityVerification.tsx
git commit -m "$(cat <<'EOF'
fix(auth): B18 iPhone SE 1세대 모달 SafeArea 잘림 방지

modalHeight 계산을 가용 영역 기반으로 재설계:
- height * 0.85 - (헤더 45 + 패딩 40 + safeArea 60) = availableHeight
- min 360 (PortOne iframe responsive 하한) / max 640 (큰 화면 cap)

568px 디바이스에서 헤더+패딩 합산 시 0.85 max 초과로 잘리던 회귀 해결.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 8. A8 — verify-portone-identity rate-limit (edge function 변경, master 푸시 시 자동 배포)
git add uniqn-mobile/supabase/functions/_shared/idp-errors.ts \
        uniqn-mobile/supabase/functions/verify-portone-identity/index.ts
git commit -m "$(cat <<'EOF'
feat(security): A8 verify-portone-identity rate-limit (defense-in-depth)

- in-memory per-instance rate-limit — 20 req/60s by x-forwarded-for/x-real-ip key
- 5분 주기 prune, 64자 key truncate, 'unknown' fallback (글로벌 bucket)
- 신규 error code IV_RATE_LIMITED (429) _shared/idp-errors.ts 추가

PortOne API 호출 비용 보호용 best-effort. 분산 공격엔 한계가 있으나 단일 IP 봇 차단에 충분.
master push 시 Deploy Edge Functions workflow 가 자동 배포 (awk fix 적용 완료).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

echo ""
echo "✅ 8개 커밋 완료. git push origin master 로 푸시하면:"
echo "   - master CI / Cloudflare Pages 자동 배포 (웹)"
echo "   - Deploy Edge Functions workflow 가 verify-portone-identity 만 재배포 (rate-limit)"
echo "   - 다른 함수는 변경 없으므로 영향 없음"
