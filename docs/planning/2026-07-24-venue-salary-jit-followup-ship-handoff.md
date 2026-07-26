# 핸드오프 — 지점 역할별 급여(JIT) 후속·출하 마무리·정리 (다음 세션 메인 프롬프트)

> 작성: 2026-07-24. 이전 세션 = SDD 완주(#311 머지 `4bf68eaa5`) + prod 마이그 적용 + fable 리뷰 3종 APPROVE.
> 아래 `---` 아래 블록 전체를 다음 세션 첫 프롬프트로 붙여넣는다.

---

지점 역할별 급여(JIT) 기능의 **후속 개선 → 출하 게이트 → 정리**를 이 순서로 끝까지 진행한다. 신규 설계 없음 — 전부 리뷰가 이미 판정한 항목이다.

## 상태 스냅샷 (전제 — 재확인만, 재작업 금지)

- **#311 머지 완료** (`4bf68eaa5`, squash): 단가표 도메인/RPC/쓰기 경로/정산 해소 + 접점 1(AddSlotSheet JIT)·2(지점 정산 배지)·3(VenueSettingsSheet). 원격 브랜치 삭제됨.
- **⚠️ prod 마이그 `set_venue_role_salary` 적용 완료 — 절대 재적용 금지.** SECDEF·anon REVOKE 실측 검증됨.
- 검증 이력: 전체 jest 5767 GREEN · pgTAP 14/14 · quality 0에러 · knip:gate(2189) · 웹 실관찰(정산 화면 렌더).
- 리뷰 판정 상세·이월 Minor 전체 목록: 워크트리 `C:\Users\user\Desktop\T-HOLDEM-salary\.superpowers\sdd\progress.md` (**정리 단계에서 삭제 전 필요 내용 회수**) + 메모리 `project_venue_role_salary_jit_20260723.md`.

## Phase 1 — 후속 Minor 수정 (한 PR, TDD)

**워크트리 격리 먼저**: `git status`로 메인 체크아웃 점유 확인 → 점유 시 origin/master 기반 새 워크트리+브랜치(`fix/venue-salary-jit-followup`), node_modules `mklink /J` junction(`feedback_worktree_node_modules_junction`). 구현=opus 서브에이전트, 리뷰=opus(태스크)/fable(최종) 라우팅.

동작 개선 (리뷰가 위치까지 특정해 둠):
1. **RoleSalaryField editing↔타입 전환 desync** — 직접입력 열린 상태에서 타입 세그먼트 탭 시 stale draftText가 blur 시점에 재시드 금액을 덮어씀. 타입 전환 시 `setEditing(false)` 리셋. 3표면 공용 프리미티브라 최우선. + 직접입력 commit 경로(parseInt·클램프·NaN) 테스트 동반.
2. **AddSlotSheet 커스텀명 키입력 재시드** — `[roleKey, customRole]` effect가 'other'에서 키 입력마다 jitDraft를 기본값으로 되돌림(수정 단가 소실). customRole은 JIT 노출 조건 리셋에만 쓰고 draft 재시드는 roleKey 변경 시만.
3. **JIT catch 무바인딩** — `catch {`를 `catch (error)`로, logger.warn에 원인 포함.
4. **지점 정산 소소** — 월 라벨 "07월"→"7월" · saveFix 성공 토스트 후 `refetch()` reject 시 모순 토스트(성공 토스트를 refetch 후로 이동 또는 refetch 실패 무시).

테스트/방어 보강 (같은 PR 허용):
5. pgTAP: collaborator·admin 인가 경로 2케이스 추가(현재 owner/member만). ⚠️ 마이그 파일은 **이미 prod 적용됨 — 수정 금지**, 테스트 파일만.
6. 등가 회귀 테스트 `role.name` 키 경로 1케이스.
7. (선택·저비용일 때만) tablist 부재·TextInput border dark: — a11y 소소.

**범위 밖 (하지 말 것)**: 컨테이너 건별 override(customSalaryInfo) UI·SettlementDetailModal 배선 — 별도 설계 세션 필요(제품 결정). 마이그 SQL 변경 일체.

## Phase 2 — 출하 게이트

1. **머지**: Phase 1 PR을 fable 최종 리뷰 통과 후 머지(auto-merge는 Quality만으로 발동 — 로컬 전체 검증 후 머지).
2. **웹 재배포**: 머지된 master 기준. `node scripts/deploy-cloudflare.js --force`(node 직접). ⚠️함정: 빈 번들 게이트(`pitfall_expo_web_empty_bundle_deployed` — 라우트 0 번들 검증), 배포 후 grep 검증은 대조군 동시검사(`pitfall_web_bundle_verify_grep_unicode_cdn_cache`), 워크트리 배포=Preview로 감(`--branch=master` 필요).
3. **OTA**: `feedback_ota_refetch_local_tree_before_update` — 직전 origin/master 재fetch·ff, Commit 필드=origin HEAD 확인. `eas update`는 shell env만 평가(`pitfall_eas_update_shell_env_not_loaded`).
4. **실기기 QA 안내문 출력**(사용자 수행): ①근무표 배치 시 미설정 역할 JIT 입력·"나중에 설정" ②설정된 역할은 JIT 미노출 ③근무표 헤더 "정산"→지점 정산 월 네비·폴백 배지 탭→단가 저장→재계산 ④⚙ 단가표 시트 추가/수정/삭제(confirmAction) ⑤커스텀 역할 왕복.

## Phase 3 — 정리

1. **워크트리 정리**: `T-HOLDEM-salary` — ⚠️ **junction 함정**: `uniqn-mobile\node_modules`가 메인의 실디렉토리를 가리키는 junction. `git worktree remove --force` 전에 **반드시 `rmdir uniqn-mobile\node_modules`(cmd, 링크만 제거)** 후 worktree remove. 과거 --force 직행으로 메인 node_modules 소실→npm install 재실행 사고 이력. 삭제 전 `.superpowers/sdd/progress.md`에서 회수할 내용 확인.
2. **메모리 갱신**: `project_venue_role_salary_jit_20260723.md` 잔여 항목 소거·완료 표시, MEMORY.md 인덱스 한 줄 갱신.
3. **wiki 졸업**: `/ingest`로 이번 작업 교훈 졸업 — 후보: ①배지·구제 스코프 게이트(공고 defaultSalary도 'fallback' 라벨 — 출처 라벨과 UI 스코프는 별개 축) ②상시 마운트 시트 폼 상태 리셋([visible, container?.id]) ③customRole XSS는 서비스 단일 지점 ④시드 유저 온보딩 게이트(phone/identity_verified)로 웹 그라운딩 차단 → 로컬 UPDATE 해제 절차. 졸업 후 MEMORY.md 가지치기.
4. `/session-wrap`으로 마무리.

## 실행 규칙 (엄수)

- 완료 주장은 이 세션 도구 출력 증거로만(fablize). TDD Red-Green 스킵 금지.
- 디스패치 금지 3종: `mcp__supabase__*` 직접 호출 · 기존 마이그 수정 · PROD 우회.
- push/PR/배포는 각 단계에서 사용자 확인 후(웹/OTA는 이 핸드오프가 사전 승인 근거 — 단 실행 직전 한 번 확인).
- 병렬 세션 감지 시(내가 안 만든 미커밋 변경) 워크트리 격리.

## 완료 정의 (exit proof)

- Phase 1: 항목 1~6 커밋 + 해당 테스트 GREEN 출력 + fable 최종 리뷰 APPROVE + 머지.
- Phase 2: 웹 배포 검증(대조군 grep) + OTA Commit=origin HEAD 확인 출력 + QA 안내문 출력.
- Phase 3: 워크트리 제거 확인(`git worktree list`) + 메모리/wiki 갱신 diff.
