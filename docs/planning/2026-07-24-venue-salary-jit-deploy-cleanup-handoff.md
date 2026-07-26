# 핸드오프 — 지점 역할별 급여(JIT) 출하 게이트(웹/OTA) + 정리 (다음 세션 메인 프롬프트)

> 선행 세션(2026-07-24)이 후속 Minor 전건을 PR #317로 머지 완료. 이 문서는 남은 Phase 2(배포)·Phase 3(정리)만 담는다. **신규 설계 없음.**

## 상태 스냅샷 (전제 — 재확인만, 재작업 금지)

- **#311 머지**(`4bf68eaa5`, JIT 본편) + **#317 머지**(`4f816c872`, 후속 Minor 전건 — desync·재시드·catch·정산 소소·pgTAP 인가 4분기·role.name 등가). 두 원격 브랜치 모두 삭제됨.
- **⚠️ prod 마이그 `set_venue_role_salary` 적용 완료 — 절대 재적용 금지.**
- #317 검증 이력: fable 최종 리뷰 APPROVE(C/H/M 0) · 전체 jest 510스위트/5829 GREEN · tsc 0 · quality 0에러 · pgTAP 16/16(master #312~#316 재통합 후 재실행 포함).
- 이월 Minor 중 **의도적 미착수(제품 결정 필요)**: SettlementDetailModal 배선 · 컨테이너 건별 override(customSalaryInfo) UI — 별도 설계 세션에서.
- 워크트리 `C:\Users\user\Desktop\T-HOLDEM-salary`: 브랜치 fix/venue-salary-jit-followup(머지 완료). **node_modules junction은 이미 해제되고 실설치로 교체됨(#314 의존성 드리프트 대응) → 통삭제 가능, rmdir 선행 불필요.** `.superpowers/sdd/progress.md` 필요 내용은 회수 완료(이 문서+메모리에 반영) — 추가 회수 불요.

## Phase 2 — 출하 게이트 (실행 직전 사용자 확인 1회)

1. **웹 재배포**: 최신 master 기준(#317 포함). `node scripts/deploy-cloudflare.js --force`(node 직접).
   - ⚠️ 빈 번들 게이트: 라우트 0 번들 검증(`pitfall_expo_web_empty_bundle_deployed`)
   - ⚠️ 워크트리에서 배포하면 Preview로 감 — `--branch=master` 필요
   - 배포 후 grep 검증은 **대조군(기존 문구) 동시검사**(`pitfall_web_bundle_verify_grep_unicode_cdn_cache` — 한글은 `\uXXXX` 인코딩·CDN 엣지캐시 주의)
2. **OTA**: 직전 origin/master 재fetch·ff-merge, `eas update` Commit 필드=origin HEAD 확인(`feedback_ota_refetch_local_tree_before_update`). `eas update`는 shell env만 평가(`pitfall_eas_update_shell_env_not_loaded`).
3. **실기기 QA 안내문**(사용자 수행):
   - ① 근무표 배치 시 미설정 역할 JIT 입력 · "나중에 설정"
   - ② 설정된 역할은 JIT 미노출
   - ③ 근무표 헤더 "정산" → 지점 정산 월 네비(라벨 "7월" — leading zero 없음) · 폴백 배지 탭 → 단가 저장 → 재계산 · 저장 토스트 1회만
   - ④ ⚙ 단가표 시트 추가/수정/삭제(confirmAction)
   - ⑤ 커스텀 역할 왕복 — 커스텀명 타이핑 중 수정 단가 유지(#317 수정 확인)
   - ⑥ 직접입력 열고 타입 세그먼트 전환 → 재시드 금액 유지(#317 수정 확인)

## Phase 3 — 정리

1. **워크트리 제거**: `git worktree remove --force C:/Users/user/Desktop/T-HOLDEM-salary` (junction 이미 해제 — 바로 실행 가능). 로컬 브랜치 fix/venue-salary-jit-followup·feat/venue-role-salary-jit 정리(`git branch -D`, 머지 완료라 안전). `git worktree list`로 부재 확인.
2. **메모리**: `project_venue_role_salary_jit_20260723.md`는 선행 세션이 갱신 완료. 배포 후 잔여 항목(웹/OTA) 소거만.
3. **wiki 졸업**(`/ingest`) 후보 — 선행 세션 교훈 포함:
   - ① 배지·구제 스코프 게이트(공고 defaultSalary도 'fallback' 라벨 — 출처 라벨과 UI 스코프는 별개 축)
   - ② 상시 마운트 시트 폼 상태 리셋([visible, container?.id])
   - ③ customRole XSS는 서비스 단일 지점(gridWriteService)
   - ④ 시드 유저 온보딩 게이트(phone/identity_verified) 웹 그라운딩 차단 → 로컬 UPDATE 해제 절차
   - ⑤ (신규, #317) 워크트리 junction node_modules는 master 의존성 패치 머지 시 드리프트 — junction 해제 후 실설치로 전환이 안전(메인 오염 방지)
4. 졸업 후 MEMORY.md 가지치기(현재 예산 초과 상태) + `/session-wrap`.

## 실행 규칙
- 완료 주장은 도구 출력 증거로만. 디스패치 금지 3종: `mcp__supabase__*` 직접 호출 · 기존 마이그 수정 · PROD 우회.
- 배포(웹/OTA)는 실행 직전 사용자 확인 1회.

## 완료 정의 (exit proof)
- Phase 2: 웹 배포 대조군 grep 검증 출력 + OTA Commit=origin HEAD 확인 출력 + QA 안내문 출력.
- Phase 3: `git worktree list`에 T-HOLDEM-salary 부재 + 메모리/wiki 갱신 diff.
