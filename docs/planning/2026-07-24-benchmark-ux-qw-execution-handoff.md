# 핸드오프 — 벤치마크 UX 퀵윈(QW) 구현 + 잔여 백로그 검토 (다음 세션 메인 프롬프트)

> 아래 블록을 다음 세션 첫 프롬프트로 그대로 사용.

---

벤치마크 UX 감사(2026-07-24)의 퀵윈 12건을 구현하고, 남은 M/R 백로그를 검토해 다음 단계를 제안해줘.

## 필독 문서 (순서대로)
1. `docs/analysis/2026-07-24-benchmark-ux-audit.md` — 감사 보고서. §4 백로그의 **QW1~QW12가 이번 구현 범위** (각 항목에 file:line 앵커 있음)
2. `docs/superpowers/specs/2026-07-24-benchmark-ux-audit-design.md` — 감사 설계(벤치마크 기준 B1~B10 정의)

## 작업 절차
1. **워크트리 격리 필수**: `git status`로 타 세션 미커밋 확인 후, origin/master 기준 새 워크트리+브랜치(`feat/benchmark-ux-quickwins`) 생성. node_modules는 `cmd /c mklink /J <워크트리>\uniqn-mobile\node_modules C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules` 정션. ⚠️ 정션 워크트리에서 expo 실행 시 `EXPO_ROUTER_APP_ROOT` 절대경로+`--clear` 필수(라우트0 함정).
2. QW 1건 = 1커밋. 구현 전 해당 파일 정독 → TDD 가능한 항목(로직 변경: QW1·QW2·QW3·QW6·QW7)은 테스트 먼저. 문구·배선만인 항목은 기존 테스트 회귀 확인.
3. 항목별 주의:
   - **QW1** (JobList applicationStatus 배선): `JobCard`가 이미 prop 지원. `useApplications`의 상태 맵을 목록에 공급 — 대형 리스트 성능(FlashList) 고려해 맵 lookup만.
   - **QW2** (거절 딥링크 착지 구제): `schedule.tsx:487-494`의 `applicationId` 매치 실패 시 안내 토스트. ⚠️근본 해소는 M1(스케줄 쿼리 rejected 포함)이므로 여기선 응급 처치만.
   - **QW4** ("정산하기" 문구): e2e 셀렉터 의존 문자열 grep 후 변경(과거 카피 변경이 e2e 깨뜨린 이력).
   - **QW6** (NonEmployerView 신청 상태 반영): `useEmployerApplication` 조회 추가 — 탭 진입마다 fetch되지 않게 캐시 키 확인.
   - **QW12** ⏳ 이모지 제거는 룰14(이모지 상태 표시 금지) 준수 확인.
4. **검증 게이트**: 각 커밋 전 `cd uniqn-mobile && npm run quality` exit 0 + 관련 jest green. 전체 완료 후 전체 jest 1회. 증거 없는 완료 선언 금지.
5. 구현 완료 후 **code-reviewer(model: fable)** 디스패치 → CRITICAL/HIGH 수정 후 사용자에게 push/PR 여부 질문 (push는 명시 요청 시만).

## 구현 후: 잔여 백로그 검토 (같은 세션에서)
1. **M1 결정 상신**: 보고서의 M1(지원 내역 화면)은 사용자 문답으로 **A안(스케줄 탭 확장: 쿼리에 rejected 포함 + 리스트 뷰 "거절" 필터 + 거절 착지 연결, 1~2일)** 이 권장으로 조정됨 — B안(전용 화면 신설, 3~5일)과 함께 AskUserQuestion으로 확정받을 것.
2. M2~M12·R1~R4를 효과/비용/의존관계로 서열화해 "다음 3개" 추천안 제시. R3(배포 가드: verify-web-build.js env 마커 검사 + deploy-cloudflare.js 중첩 node_modules 처리)는 **prod 장애 재발 방지라 우선 승격 검토**.
3. 착수는 사용자 승인 후.

## 금지·주의
- `mcp__supabase__*` 직접 호출 금지, 기존 마이그레이션 수정 금지, master 직접 커밋 금지, push/PR은 사용자 명시 요청 시만.
- QW 범위 밖 리팩터링 금지(발견 시 백로그에 기록만).
- 브랜치 `feat/order-sheet-chain-polish`는 타 세션 docs 커밋 혼입 — 접촉 금지.

## 배경 요약 (컨텍스트 없이 시작해도 되도록)
- 감사 결론: 입력 마찰은 벤치마크급(지원 텍스트0·재공고 6탭·QR 1탭). 갭은 **B4 상태 투명성**(거절 지원 증발 CRITICAL — `scheduleService.ts:42-46`가 rejected 원천 제외) + **B7 회복 경로**(QR 실패·임시저장·expired 재게시·리뷰 만료) 2축.
- 같은 날 prod 웹 env누락 장애를 복구·검증 완료(메모리 `project_benchmark_ux_audit_20260724` 참조) — 웹 배포 시 wrangler의 node_modules 경로 제외 함정 주의.
