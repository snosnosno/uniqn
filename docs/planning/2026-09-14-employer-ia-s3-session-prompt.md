# 구인자 IA 재설계 — S3 실행 세션 프롬프트

- 작성일: 2026-09-14
- 선행: PR **#490**(근무표 진입점 복원 + 인계 문서) · PR **#492**(S1 · S2a · S2b · S1b)
- 설계 원본: [구인자 IA 실행 세션 프롬프트](2026-09-13-employer-ia-session-prompts.md) — §0 합의 · §2 S3 · §4 결정 · §7 진행 현황

아래 블록을 새 세션에 그대로 붙여 넣는다.

---

```text
# 구인자 IA 재설계 — S3 내 공고 탭 세그먼트 + 오늘 한 줄

한글로 답하라. 병렬 세션이 상시 있으니 상태는 가정하지 말고 실측부터 한다.

## 0. 시작 실측
git fetch origin && git worktree list && git status --short
gh pr view 490 --json state,mergeCommit
gh pr view 492 --json state,mergeCommit
- 두 PR 모두 MERGED 여야 한다. 아니면 S3 를 시작하지 말고 사용자에게 보고한다.
- 기준 문서: docs/planning/2026-09-13-employer-ia-session-prompts.md (§0 합의, §2 S3, §4 결정, §7 진행 현황)

## 1. 확정된 결정 (재논의 금지)
- 세그먼트 범위: 기준은 '나', 지점은 필터. 지점이 1곳이면 필터를 숨긴다.
- 대회는 공고 하나에 여러 직무 → 묶음 단위 = 공고.
- 출퇴근 QR 지점당 1장 / 구인자가 스태프 QR 스캔: 보류. 건드리지 말 것.
- UI 문구는 정식 용어만(구어체 금지).

## 2. S3 범위
내 공고 탭(app/(app)/(tabs)/employer.tsx)
- [공고] / [근무표] 세그먼트. 기본값 [공고] — 신규 사용자 경험을 바꾸지 않는다.
- 오늘 한 줄: 미출근 · 퇴근 미기록. 0건이면 렌더하지 않는다. 누르면 오늘 상세로.
  데이터는 기존 셀렉터를 재사용: TodayOpsStrip 계열 · summarizeMissingCheckouts · useVenueMissingCheckouts · selectPostingCapacityGaps
- ⋯ 로 이동: 묶음 공유 · 받은 초대
- 팀 링크: 멤버 2명 이상일 때만 노출
- 검증: 세그먼트 전환 단언 + 오늘 한 줄 0건 미렌더 단언

## 3. 되돌리면 안 되는 규칙
- 진입점을 신호에 따라 숨기지 않는다. 조건부 숨김은 0개일 때만.
- 배지는 합치지 않는다.
- 앱은 돈을 보내지 않는다(지급 보증 문구 금지).
- DB 컬럼 · RPC · 트리거 · pgTAP 는 이 웨이브에서 손대지 않는다.
- #488 에서 되돌린 근무표 헤더 아이콘을 다시 하지 않는다. #490 의 manualTarget / derivedRequired 분리를 깨지 않는다.
- accessible + 명시 accessibilityLabel 컨테이너에 안내 문구를 넣으면 라벨에도 넣는다.

## 4. 작업 방식
- 전용 워크트리 + 새 브랜치(origin/master 에서). node_modules 는 mklink /J 정션. 워크트리에서 npm install 금지.
- 3+ 파일 변경 = 계획 제시 후 승인받고 시작.
- 테스트 먼저 → RED 확인 → 구현 → npm run quality · npm run type-check:e2e · 영향권 jest → fable 코드리뷰(커밋 범위 지정) → 새 커밋(amend 금지).
- e2e/ 는 eslint 사각지대: 문구 · testID 변경 시 Grep 필수.
- Grep 도구에 중괄호 glob 을 쓰면 조용히 0건이 나올 수 있다. 0건이면 glob 없이 재확인.
- 같은 파일 여러 곳 수정은 순차로. 병렬 Edit 금지.
- 워크트리 expo start 는 라우트 0 함정 — 실렌더 확인은 메인 체크아웃이나 PR 프리뷰에서.
- 로컬 npm run e2e 는 기본 겨냥이 prod — 실행 금지.
- push · PR 은 사용자가 요청할 때만.

## 5. 사람 게이트 (코드로 못 닫음)
- 실기기 QA 5건: iOS 공유 시트 퇴장 후 OS 공유창 · 계산 근거→평가 전환 · 대시보드 금액 칸 낭독 · [근무] 전화 버튼 · 취소 요청 띠 낭독
- #490 · #492 는 클라이언트 전용이라 OTA 발행 전까지 앱 사용자에게 반영되지 않는다.

## 6. 후속(이 세션 범위 밖, 기록만)
- DB 트리거 notify_on_work_log_update 의 "정산 완료" · "지급 완료 취소" 푸시 문구 — 컬럼·RPC 정리 웨이브에서 제거
- ConfirmedStaffCard 아이콘 hex 고정(리뷰 LOW) — 아이콘 색 토큰화 때 처리
- 이후 순서: S4 근무표 밀도 정리 + 출처 칩 → S5 팀·협업자 구분 문구
```
