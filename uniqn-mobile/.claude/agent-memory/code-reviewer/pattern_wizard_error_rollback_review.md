---
name: pattern-wizard-error-rollback-review
description: 멀티스텝 폼의 "에러코드 기반 이전 단계 자동 복귀" 리뷰 레시피 — 에러 사슬 4지점·rethrow 매트릭스·모드 비대칭·단측 신선도 증명
metadata:
  type: project
---

멀티스텝 폼(회원가입 등)에서 "특정 에러면 이전 단계로 자동 복귀" 변경 리뷰는 4가지를 실측한다.

**Why:** 2026-07-25 signup 순서 재배치 복구 리뷰(#325 후속)에서 확립. 감지 헬퍼가 `error.metadata.code`에 의존하는데, 사슬 중간 어디서든 래핑되면 metadata가 증발해 복귀가 조용히 죽는다. 실제로는 EF→mapIdpErrorCodeToAppError→handleServiceError(AppError pass-through, serviceErrorHandler.ts:175-184)→화면 rethrow→폼 감지로 온전했지만, 이 사슬은 diff 밖 3개 파일에 걸쳐 있어 diff만 보면 판정 불가.

**How to apply:**

1. **에러 사슬 끝까지**: 에러 생산지(EF/서비스 매퍼)→서비스 래퍼(handleServiceError류가 pass-through인지 재래핑인지)→화면 핸들러(rethrow 유무)→감지 지점. 특히 최종 제출 경로가 인증 시점 경로와 **다른 함수**를 탈 수 있음(callVerifyPortOneIdentity vs callVerifyAndSavePortOneProfile — 둘 다 매핑하는지 확인).
2. **rethrow/swallow 매트릭스 전수**: 모드(default/social/reverify)×핸들러별로 "호출자가 await 하는가 / catch 있는가 / 상위가 rethrow 하는가" 표를 만든다. 한 경로만 rethrow 계약을 바꾸면 나머지 경로가 unhandled rejection이 된다. rethrow 안 하는 쪽엔 "rethrow 금지" 불변식 주석이 있는지도 본다(없으면 후임이 대칭 맞추다 터뜨림).
3. **모드 비대칭**: 자동 폐기·복귀를 default에만 넣으면 social/기타 모드는 "완료 카드 표시 + 재제출 무한실패" UI 모순이 남는다. 같은 에러 집합을 소비하는 모든 모드에 대칭 적용 여부 확인.
4. **타임스탬프 근사 게이트는 단측 증명으로 판정**: `savedAt ≥ eventTime` 불변이 성립하면 "저장이 오래됨 ⇒ 이벤트도 오래됨"(false-discard 없음)만 보장되고 false-keep은 남는다 — false-keep을 런타임 실패 경로가 회수하는지 확인. 저장 트리거가 실제로 언제 발화하는지(로컬 RHF 필드는 제출 전까지 draft 미갱신) 실측하면 근사 오차 범위가 좁혀진다.

관련: [[pattern-optional-field-wiring-six-points]] (필드 배선 전사 점검), e2e draft 주입 시 storage key/version/직렬화(JSON.stringify, prefix 유무)를 실제 storage 어댑터 코드와 대조.
