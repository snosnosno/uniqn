---
area: sources
updated: 2026-07-14
status: current
sources:
  - uniqn-mobile/src/hooks/__tests__/extractPostingFilledSubmap.test.ts
  - uniqn-mobile/src/components/jobs/shared/postingSurfaceModel.ts
  - uniqn-mobile/src/components/schedule/useOwnerReport.ts
  - PR#243
  - PR#244
  - memory/pitfall_filled_counts_global_vs_submap_keyspace
tags: [ios, ux, filled-counts, modal, regression]
---

# 소스: iOS 유저플로우 버그 8종 + 후속 (PR #243·#244, 2026-07-13~14)

## 무엇을 고쳤나 (#243)
확정 인원 카운터 0/N 드리프트 · 회원가입 뒤로가기 GO_BACK 미처리(스택 빈 경우 로그인 폴백) · 중첩 RN Modal 터치 먹통·스태프 추가 footer 화면밖 · employer 확정카운트 배선 · 홈 통계 월스코프 · 신고모달 시트 밖 승격(`useOwnerReport` — 시트 안 중첩 모달 회피). 후속 #244: 시트 지연액션 타이머 정리·더블탭 재진입 가드 + 회귀 테스트 3종.

## 핵심 함정: filled counts 전역맵 vs 서브맵 키스페이스
`usePostingFilledCounts(ids)`는 **전역맵**(키 `${jobPostingId}__${date}__${slot}__${role}`)을 반환하는데, `buildPostingScheduleModel`의 hydrate 조회키는 **접두 없는** `${date}__${slot}__${role}`이다. 전역맵을 그대로 넘기면 전건 미스 → SP3 dead counter 폴백 → **확정 인원 항상 0/N**, 에러 없이 조용히 오표시.

- **규칙**: 소비자는 렌더 전 반드시 `extractPostingFilledSubmap(globalMap, posting.id)`로 서브맵 변환. 정답 패턴 = `JobCard.tsx` · `JobDetail.tsx` · `useShare.ts`.
- 실제 회귀: employer "내 공고" 카드가 추출을 빠뜨려 버그 #4의 절반이 무동작(코드리뷰 P1 적발 → #243 교정). "배선했다"는 커밋이 표제 목적을 못 채운 케이스 — **배선 통합 가드 테스트**(추출 호출 제거 시 실패하는 Red-Green)로 고정.
- 이 함정은 [[whitelist-silent-drop]] 클래스의 인스턴스(키스페이스 불일치 → 조용한 증발).

## 검증·사후
7패스 사후 리뷰(메인+전문가5+적대+red-team) CRITICAL 0. 슬롯키 startTime-우선은 facts·selectors·DB 3면 일치 + prod `NEGOTIABLE` work_logs 0건 실측으로 안전 확정. 제품결정: 홈 '이번 달 요약' 월스코프 현행유지(사용자 승인).

관련: [[whitelist-silent-drop]] · [[capacity-full]] · [[userflow-audit-2026-07]] · [[layers]]
