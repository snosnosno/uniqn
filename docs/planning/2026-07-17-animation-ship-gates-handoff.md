# 핸드오프 — 애니메이션 브랜치 출하 게이트 끝까지 (다음 세션 메인 프롬프트)

> 작성: 2026-07-17. 전제 세션: 계획 001~005 SDD 실행 + /review 멀티패스·fix 완료.
> 아래 블록을 새 세션에 그대로 붙여넣는다. **실기기 QA 결과를 함께 붙여넣으면 가장 빠르다.**

---

애니메이션 브랜치(feat/animation-motion-polish)의 남은 출하 게이트를 끝까지 진행해줘.
QA 결과 반영 → (필요시) 계획006·튜닝 → push → PR → 머지 → OTA → 정리까지, 이 문서가 push/PR/머지/OTA의 명시 승인이다.

## 배경 (전 세션 산출 — 재작업 금지)

- 워크트리 `C:\Users\user\Desktop\T-HOLDEM-anim`, 브랜치 `feat/animation-motion-polish` (origin/master cb825815e 기반, **미push**). ⚠️ 메인 트리(`C:\Users\user\Desktop\T-HOLDEM`)는 다른 세션 점유 가능 — 작업은 전부 워크트리에서.
- 완료: 계획 001~004 DONE·005 IMPLEMENTED(`docs/planning/animation-plans/`) + fable 최종리뷰 fix(유령모달·상향플릭) + /review 멀티패스 fix 4건(RM 프리페치·panGesture useMemo·Toast 타이머 분리·grab 오프셋) + 회귀 테스트 14개.
- 최종 검증(전 세션 실측): quality EXIT 0 · jest ui+hooks 43스위트 287테스트 통과 · 4컴포넌트 Easing 리터럴 0건. 서버/DB 무변경 → **OTA 가능**.
- SDD 원장: 워크트리 `.superpowers/sdd/progress.md` (이월 Minor 전 목록). 계획 006(`animation-plans/006-*.md`) = 실기기 관찰 선행 구조 후속.

## 1. 실기기 QA 게이트 (사용자 결과 수신 → 분기)

사용자에게 아래 체크리스트 결과를 요청(이미 프롬프트에 붙어 있으면 바로 분기):

1. **005 제스처**: 헤더 드래그 1:1 밀착(그랩 점프 없음) / 빠른 플릭 dismiss / 중간 릴리즈 스프링 복귀(바운스 0) / 위로 러버밴드 / 드래그 중 백드롭 비례 페이드 / isLoading 중 무반응 / **25% 초과 후 위로 플릭 → 복귀**
2. **확인형 계약**: 지원하기 시트에 내용 입력 → 드래그 dismiss → "계속 편집" → 시트가 열린 채 편집 지속
3. **003 reduce-motion**: OS 동작줄이기 ON → 모달/시트/토스트가 페이드만으로 등장(첫 프레임 모션 재생 없어야 함 — RM 프리페치 fix 검증), 토스트 자동닫힘 정상, OFF 복원
4. **006 관찰 항목**: ①일반 닫기·드래그 dismiss의 퇴장이 슬라이드 아웃으로 보이는가, "팝 소멸"인가 ②짧은 시트(필터류)를 천천히 끝까지 끌면 닫히는가·백드롭 잔존하는가
5. **임계 체감**: 400px/s·25%가 너무 쉽게/어렵게 닫히는지

분기:
- **1~3 실패** → 해당 fix 커밋 회귀 조사(/investigate) 후 수정 커밋. 원장·계획 문서 갱신.
- **4에서 "팝 소멸"/백드롭 잔존 확인** → 계획 006 구현(별도 커밋들, isClosing 지연 언마운트는 키보드·overlay·SHEET_DISMISS_ANIMATION_MS 교차 주의 — 006 문서 Boundaries). 문제없으면 006 Status를 `폐기(실기기 관찰 무결)`로 갱신.
- **5 튜닝 필요** → `src/components/ui/sheetModalGesture.ts` 상수 수정(300~600 범위) + 테스트 기대값 갱신 + 계획005 Tuning note에 기록.
- QA 결과를 끝내 못 받으면: push/PR까지만 진행하고 머지·OTA는 중단, 사유 보고.

## 2. push → PR → 머지 (QA 통과 후)

1. 검증 재실행: `cd C:/Users/user/Desktop/T-HOLDEM-anim/uniqn-mobile && npm run quality && npx jest src/components/ui src/hooks --silent` EXIT 0 확인(출력 증거).
2. push: `git -C C:/Users/user/Desktop/T-HOLDEM-anim push -u origin feat/animation-motion-polish`.
3. PR 생성(gh, 한글 본문): 계획 5건+리뷰 fix 요약, 테스트 플랜=quality·jest 증거+실기기 QA 결과. 커밋 전체 이력 기반(`git log origin/master..HEAD`).
4. **머지 직전 최신 master 재통합**(메모리 규칙): `git fetch origin && git merge origin/master` (squash 저장소 — rebase 금지), 충돌 해결 후 재검증·push. stale-base CI green은 무효.
5. e2e 등 required check 통과 대기 → `gh pr merge --squash`. ⚠️함정(메모리): 워크트리가 브랜치 점유 중이라 `--delete-branch`의 로컬 checkout이 실패해도 **원격 머지는 성공**(state=MERGED 확인). 원격 브랜치 삭제는 `gh api -X DELETE repos/snosnosno/uniqn/git/refs/heads/feat/animation-motion-polish` (pre-push 훅 hang 회피).
6. master 직접 push 금지(e2e 우회 — hotfix도 PR).

## 3. OTA (머지 후)

메모리 `feedback_ota_refetch_local_tree_before_update` 절차 엄수:
- OTA는 **로컬 워킹트리를 번들링**한다 — 메인 트리가 다른 세션 점유 중이면 워크트리를 master로 전환하거나 새 클론에서: `git fetch origin && git checkout master && git merge --ff-only origin/master`.
- `eas update`는 shell process.env만 평가(eas.json env 무시) — 기존 배포 스크립트/명령 관례 확인(`wiki/log.md`·`docs/guides/DEPLOYMENT.md`). 실행 후 Commit 필드 = origin/master HEAD 확인.
- OTA 후 메모리의 다른 대기 항목(주문서 S1+S2 등)이 같은 master에 있으면 함께 나감 — OTA 전에 사용자에게 스코프 1회 확인.

## 4. 마무리

- 워크트리 정리: 머지 확인 후 `git worktree remove C:/Users/user/Desktop/T-HOLDEM-anim` (로컬 브랜치는 checkout --detach 후 -D — 메모리 함정 참조). PR 머지됐으므로 아카이브 태그 불필요.
- 메모리 갱신: `project_emil_animation_skills_20260716.md` → 머지·OTA 상태 반영, MEMORY.md 한 줄 갱신. 잔여가 0이면 /ingest로 wiki 졸업 후보(barrel 순환 함정·RNModal 퇴장 비가시 구조).
- `/session-wrap` 권고.

## 금지·규율

- 계획 밖 리팩터링 금지. `mcp__supabase__*` 불필요(서버 무관). 완료 주장 전 실행 증거(quality·jest 출력) 필수.
- 모델 라우팅: 구현=opus/sonnet 서브에이전트(SDD), 중요 판정만 fable. fable 429/529 시 opus 폴백(다운그레이드 명시).
- 검증 SHA push는 `git push origin <SHA>:refs/heads/<branch>` 명시(단일트리 동시세션 함정).
