# 구인자 IA 재설계 — S5 실행 세션 프롬프트

- 작성일: 2026-09-15
- 선행: S3 `b879c4b9b` · S4 `4eeca9724` + `853de01de` (둘 다 **로컬 커밋, push·PR 전**, fable APPROVE)
- 설계 원본: [구인자 IA 실행 세션 프롬프트](2026-09-13-employer-ia-session-prompts.md) — §0 합의 · §2 S5 · §4 결정 · §7.4 규칙

아래 블록을 새 세션에 그대로 붙여 넣는다.

---

```text
# 구인자 IA 재설계 — S5 팀·협업자 구분 문구 (+ S3·S4 착지)

한글로 답하라. 병렬 세션이 상시 있으니 상태는 가정하지 말고 실측부터 한다.

## 0. 시작 실측
git fetch origin && git worktree list && git status --short
git log --oneline origin/master -3
git log --oneline origin/master..feat/employer-ia-s4
gh pr list --state open --json number,title,headRefName
- 기대 상태: feat/employer-ia-s3(b879c4b9b) 위에 feat/employer-ia-s4(4eeca9724, 853de01de) 가 쌓여 있고 둘 다 원격에 없다.
  워크트리 ../T-HOLDEM-ia-s3 · ../T-HOLDEM-ia-s4.
- 기대와 다르면(누가 push·머지했거나 master 가 앞서 갔으면) 그 사실부터 보고한다.
- 기준 문서: docs/planning/2026-09-13-employer-ia-session-prompts.md (§0, §2 S5, §4, §7.4)

## 1. 먼저 사용자에게 물을 것 (1회, 묶어서)
- S3·S4 를 PR 로 올릴지. push·PR 은 사용자가 요청할 때만 한다.
  올린다면 순서는 S3 PR → 머지 → S4 를 master 에 재통합(merge, rebase 금지) → S4 PR.
  머지 직전 최신 master 재통합 + 재검증. squash 저장소다.
- 올리지 않으면 S5 는 feat/employer-ia-s4 위에 새 브랜치로 쌓는다.

## 2. 확정된 결정 (재논의 금지)
- 세그먼트 기본값 [공고], 오늘 한 줄 범위=내 공고 전체(owner_id), 공고 1개면 그 [근무] / 여러 개면 [근무표] 날짜.
- ⋯ 의 팀 진입점은 **숨기지 않는다**. 팀원 0명이면 같은 자리에 `팀원 초대`, 있으면 `팀`(S3).
  → 원래 S5 항목 "멤버가 본인뿐이면 팀 진입점 미노출" 은 **폐기**됐다. 되살리지 말 것.
- 근무표: 지점 1곳이면 칩 줄만 접고 ⚙설정·`+ 지점 추가` 유지 · GridBadgeLegend 유지 · 출처 칩 탭 → 공고 상세(S4).
- 출퇴근 QR 지점당 1장 / 구인자가 스태프 QR 스캔: 보류. 건드리지 말 것.
- UI 문구는 정식 용어만(구어체 금지).

## 3. S5 범위
- 팀 화면 app/(employer)/workspace/index.tsx 상단 한 줄: `이 팀의 모든 공고를 함께 봅니다`
- 협업자 화면 app/(employer)/my-postings/[id]/collaborators.tsx 상단 한 줄: `이 공고 하나만 함께 봅니다` + 팀 화면으로 가는 링크
- 같은 협업자 화면의 #478 후속: viewer(보기 권한)를 지정할 때 `이 사람도 지원자 노쇼 횟수를 봅니다` 를 알린다
  (근거: supabase/migrations/20260813150000_job_posting_collaborator_role.sql:243 경고 주석. 지금 UI 에는 없다).
  문구 위치(권한 선택지 설명 vs 확인창)는 화면을 읽고 정하되, 사장이 모르고 지정하는 일이 없어야 한다.
- 기존 문구와 겹치는지 확인: workspace/invite.tsx:143 · workspace/invitations.tsx:101 에 "이 팀의 모든 공고를 만들고 수정할 수 있어요" 가 있다.
- 검증: 두 화면 상단 문구 렌더 단언 + 협업자 화면 팀 링크 이동 단언 + viewer 노쇼 안내 노출 단언(대조군 포함).

## 4. 되돌리면 안 되는 규칙 (웨이브 누적)
- 진입점을 신호에 따라 숨기지 않는다. 조건부 숨김은 0개일 때만.
- 배지는 합치지 않는다. 앱은 돈을 보내지 않는다(지급 보증 문구 금지).
- DB 컬럼 · RPC · 트리거 · pgTAP 는 이 웨이브에서 손대지 않는다.
- #488 근무표 헤더 아이콘 재도입 금지 · #490 manualTarget/derivedRequired 분리 유지 · 빼기는 카드 액션.
- accessible + 명시 accessibilityLabel 컨테이너에 안내 문구를 넣으면 라벨에도 넣는다.
- 접기·펼치기 토글은 accessibilityState.expanded + 상태에 맞는 라벨(S4 리뷰).
- 터치 타깃 44px(작은 칩은 hitSlop 으로 보충 — S4 리뷰).

## 5. 작업 방식
- 전용 워크트리 + 새 브랜치. node_modules 는 PowerShell New-Item -ItemType Junction 으로 정션
  (cmd //c mklink 는 따옴표 문제로 실패했다). 워크트리에서 npm install 금지.
- 워크트리 정리 시 정션을 먼저 해제하고 원본 존재를 확인한 뒤 제거한다(git worktree remove --force 가 원본을 지운 사고).
- 3+ 파일 변경 = 계획 제시 후 승인받고 시작.
- 테스트 먼저 → RED 확인 → 구현 → prettier → npm run quality · npm run type-check:e2e · 영향권 jest
  → fable 코드리뷰(커밋 범위 지정) → 새 커밋(amend 금지).
- jest 에 괄호 경로를 넘길 땐 이스케이프한다: "app/\(employer\)/..." (안 하면 0 suites 로 무음 통과).
- e2e/ 는 eslint 사각지대: 문구 · testID 변경 시 Grep 도구로 확인(Bash grep 은 app 트리에서 무음 0건 함정).
- prettier 와 jest/quality 는 같은 파일을 만지므로 한 명령 안에서 순서대로 돌린다.
- 워크트리 expo start 는 라우트 0 함정 — 실렌더 확인은 PR 프리뷰에서.
- 로컬 npm run e2e 는 기본 겨냥이 prod — 실행 금지.

## 6. 사람 게이트 (코드로 못 닫음)
- 실기기 QA(누적): iOS 공유 시트 퇴장 후 OS 공유창 · 계산 근거→평가 전환 · 대시보드 금액 칸 낭독 ·
  [근무] 전화 버튼 · 취소 요청 띠 낭독 · **근무표 출처 칩 탭이 카드 편집이 아니라 공고 상세로 가는지(Pressable 3중 중첩)**
- PR 프리뷰: S3 탭바 하단 여백 · S4 §34 Before/After 픽셀 · 오늘 한 줄 숫자 = 공고 상세 미출근 숫자 일치
  (getAttentionByOwnerId 의 .or(and(..),and(..)) 필터는 실DB 미검증)
- 클라이언트 전용이라 OTA 발행 전까지 앱 사용자에게 반영되지 않는다.

## 7. 후속(이 세션 범위 밖, 기록만)
- 출처 칩 제목 캐시 최대 10분(당겨서 새로고침으로 갱신) — 필요하면 공고 수정 시 postingTitles 무효화
- DB 트리거 notify_on_work_log_update 의 "정산 완료" · "지급 완료 취소" 푸시 문구 — 컬럼·RPC 정리 웨이브에서 제거
- ConfirmedStaffCard 아이콘 hex 고정 — 아이콘 색 토큰화 때 처리
- S5 가 끝나면 웨이브 교훈을 /ingest 로 wiki 에 졸업
```
