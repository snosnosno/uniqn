# 핸드오프 — 근무표 반복 액션 제거 출하 게이트 + 급여 정책 구현 착수 (다음 세션 메인 프롬프트)

> 작성: 2026-07-22. 이전 세션 = 구현+리뷰+PR까지 완료. 이 문서를 다음 세션 첫 프롬프트로 사용.

## 상태 스냅샷

- **PR #297** `refactor/grid-remove-repeat-actions` → master, **auto-squash-merge 대기**(CI: Quality 3종 + E2E).
  브랜치 HEAD `6586feb5e`(origin/master `02efe46b0` #296 재통합 완료, tsc 0·grid 25스위트 134테스트 통과 재검증됨).
- 내용: 근무표 반복 전제 도구 3종 제거(지난주 복사·출근 확인 요청·요일 반복 벌크) + 라벨 교정 + 죽은 코드 17파일 + knip 래칫 2200→2189 + guide.html 문구 교정.
- 리뷰: fable 적대 리뷰 완료 — 코드 결함 0, guide.html P2 1건 발견·반영(`e73e8a4d7`).
- 급여 정책 ✅결정: **역할별 단가표 + 슬롯 override** — `docs/planning/2026-07-22-venue-role-salary-policy-decision.md`.

## 순서 (게이트 순수 엄수)

### 1. PR #297 머지 확인
```bash
gh pr view 297 --json state,mergedAt,statusCheckRollup
```
- E2E red면: 러너 경합 45분 timeout 함정 먼저 의심(메모리 `pitfall_e2e_runner_contention_timeout`) — 코드 결함 단정 금지, 재실행 1회 후 조사.
- 머지 후 정리: 원격 브랜치는 자동삭제 여부 확인, 수동 삭제는 `gh api -X DELETE repos/snosnosno/uniqn/git/refs/heads/refactor/grid-remove-repeat-actions`(pre-push 훅 hang 우회). 워크트리 `C:\Users\user\Desktop\T-HOLDEM-grid` 제거는 `/worktree-cleanup`.

### 2. 웹 재배포 (guide.html 교정이 라이브 반영되는 유일 경로)
- 메인 체크아웃에서 **origin/master 재fetch + ff 후** `node scripts/deploy-cloudflare.js --force`.
- ⚠️ 함정: ①`expo export -p web` 빈 번들(라우트 0)도 exit 0 — 배포 전 라우트 수 검증 ②워크트리/브랜치에서 배포하면 Preview로 감 — **master 체크아웃에서** ③deploy 스크립트는 미추적 파일에 exit 0 중단 이력.

### 3. OTA
- ⚠️ `eas update`는 로컬 워킹트리를 번들링 — 직전 재fetch·ff-merge, Commit 필드=origin HEAD 확인(메모리 `feedback_ota_refetch_local_tree_before_update`). env는 shell process.env만 평가.
- 이번 변경은 JS 전용(네이티브 추가 0) — 빌드 불필요 판정 4체크 통과 전제.

### 4. 실기기 QA (코드로 대체 불가)
근무표 진입 → 지점 선택 → 월 달력 → 날짜 탭 → 배치 패널:
- [ ] 액션 행(지난주 복사/출근 확인)이 **없고** 요일 헤더 겹침도 없음
- [ ] 필요 인원 저장(단건) 정상 + 저장 후 뱃지 갱신
- [ ] 요일 반복 체크박스 없음
- [ ] 인원 추가(AddSlotSheet)·슬롯 편집 정상
- [ ] 부족 N명 → "공고로 모집" 진입(프리필) 정상
- [ ] employer 탭 진입 버튼 라벨 = "근무표"

### 5. 급여 정책 구현 — 별도 설계 세션 (HARD-GATE: /plan 먼저)
결정문서 `docs/planning/2026-07-22-venue-role-salary-policy-decision.md` 기준:
- 정책: 슬롯 override > 지점 역할별 단가표(JobPosting `salaryType` 재사용) > 폴백 ₩15,000+가시화 배지. 역할 변경 시 단가 자동 추종.
- 설계 쟁점: 단가표 데이터 위치(컨테이너 `schedule` JSONB vs 별도 컬럼/테이블) · `settlementVenueQuery.ts` 폴백 경로에 해소 삽입 · EditSlotSheet override 필드 · 지점 단가표 입력 UI 진입점.
- RLS/SECDEF 영향 시 `/guard` 먼저. DB 마이그는 MCP `apply_migration` 전용.

## 별건 (이번에 안 함 — 재확인만)
- UI 겹침 근본 메커니즘 미규명(증상만 해소) — 재발 시 조사 착수(재현→경쟁 가설→인과사슬)
- 필요 인원 하향 불가 — `buildGridCells.ts:37` `Math.max(manual, requiredCount)` 제품 결정 필요

## 세션 교훈 (메모리 반영됨)
- 기능 제거 시 `public/*.html` 마케팅 문구 grep 필수 — 정적 HTML은 tsc/eslint/jest/knip 사각지대
- 삭제 TDD의 RED는 크래시가 아니라 단언 실패여야(제거 대상 훅을 목에 임시 투입 후 GREEN에서 제거)
- 제거 회귀 테스트엔 대조군 단언 필수(vacuous green 배제)
