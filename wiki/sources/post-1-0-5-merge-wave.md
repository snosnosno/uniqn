---
area: sources
updated: 2026-07-28
status: current
sources:
  - uniqn-mobile/src/domains/schedule/StatusMapper.ts
  - uniqn-mobile/src/constants/motion.ts
  - uniqn-mobile/src/hooks/share/useBulkShare.ts
  - uniqn-mobile/functions/jobs/index.ts
  - uniqn-mobile/supabase/migrations/20260726191107_posting_auto_close_gaps.sql
  - uniqn-mobile/supabase/migrations/20260727180000_cancel_rpc_rebase_on_seat_basis.sql
  - PR#350
  - PR#351
  - PR#353
  - PR#354
  - PR#355
  - PR#356
  - PR#357
  - PR#358
  - PR#359
  - PR#360
  - PR#361
tags: [release, merge-wave, schedule, share, posting, ota, deploy]
---

# 소스: 1.0.5 스토어 빌드 이후 머지 웨이브 (2026-07-26 ~ 07-28)

**범위:** 1.0.5 빌드(iOS 43 / Android 41, 2026-07-26) 직후 `191d21641` 부터 `3c6efef93` 까지. 11 PR / 435 파일 / +24.9k −3.4k. **네이티브 구성 변경 0** → `version` bump 불필요, OTA 로 전량 전달 가능.

## 세 갈래로 수렴한다

### 1. 공고 도메인 전면 감사 W1 (PR#351·#360)
공고와 연결된 10개 영역을 32 에이전트로 감사해 결함 189건(CRITICAL 7 / HIGH 37 / MEDIUM 104 / LOW 41)을 뽑고 W1 12항목을 먼저 출하했다. 대표 결함:
- **유령 컬럼으로 근무시간 수정이 프로덕션에서 전량 실패** — UPDATE payload 에 `settlement_breakdown: null` 이 섞였는데 `work_logs` 에 그런 컬럼이 없다. PostgREST 는 모르는 컬럼이 하나라도 있으면 요청 전체를 PGRST204 로 거부한다. `settlementBreakdown` 은 읽기 시점 파생값이었고, 기존 테스트는 **SELECT 화이트리스트만** 지켜 쓰기 payload 가 무방비였다([[whitelist-silent-drop]]).
- **수동 상태 변경에 감사 이력 부재** — '출근 예정으로 변경'이 `check_in_ts`/`check_out_ts` 를 null 로 덮어쓰는데 이력도 알림도 없었다. 체크인 알림 트리거는 NULL→값 전이만 보므로 **삭제는 통보조차 되지 않았다**.
- 선행 PR#351 은 자동 마감 사각지대 5종(유령 크론·미확정 지원 방치·고정공고 영구 미마감·관측 부재·죽은 수정 알림)을 닫았다([[capacity-full]]).
- 감사 자체의 한계가 명시돼 있다: 적대 검증이 189건 중 **반박 0건**이라 확정 판정은 '증명'이 아니라 '근거 인용된 유력 가설'이다.

### 2. 근무표·내 스케줄 축 (PR#353·#354·#356·#357)
- **용어 통일** `weeklyGrid → workSchedule`(#354). 단 DB 계약 키 `weekly_grid_enabled` 와 딥링크 구 세그먼트 `weekly-grid` 는 **리네임 금지·하위호환 유지**.
- **빼기를 소프트 취소로 전환**(#357): 하드 `DELETE` → `status='cancelled'`. 취소 알림이 복구되고, 부족 인원 계산에서 죽은 공고가 빠진다.
- **내 스케줄 탭 완성도 41건**(#356): 노쇼 분리·색 SSOT·오프라인 캐시·탭 동적화. 상태 zod 를 라벨표(`SCHEDULE_TYPE_LABELS`)에서 **파생**시켜 신규 상태의 조용한 drop 을 구조적으로 차단했다([[enum-divergence]]).
- **과잉 가드 폐지**(#353): 확정자 일정 잠금을 걷어냈다. 근거 — total/capacity 전이는 DB 트리거가 자동 재계산하고([[capacity-full]]) `work_logs` 는 비정규화 사본이라 편집이 영향을 주지 않는다. 실질 위험은 **역할 소멸 → 정산 기본단가 폴백** 하나뿐이었고 옛 가드는 그 축을 겨냥하지도 못했다(역할 추가는 막으면서 시급 인하는 허용).

### 3. 공유 3종 + 모션 (PR#350·#355·#358·#359 + 묶음 공유 3커밋)
- **데스크톱 웹 공유**(#358): 갈림 기준은 "Web Share API 지원 여부"가 아니라 **"모바일인가"** 다 — 데스크톱도 API 를 지원하지만 시트에 카톡이 없다. 폴백은 클립보드 복사.
- **묶음 공유**: 다중 선택 → 1회 공유. 링크는 구인구직 탭 하나로 통합하고 `functions/jobs`(Cloudflare Pages Function)에 OG 카드를 붙였다. #359 는 전체선택 컨트롤의 접근성(버튼 승격 + 전체 해제 토글).
- **고정공고 지원 차단**(#355): 딥링크로 정책이 우회되던 구멍. 차단은 실수가 아니라 **의도된 정책**이며 `public/guide.html:780` 이 "연락처로 직접 문의"를 공표 중이다 — **배포되는 사용자 문서도 정책 증거**다.
- **모션 토큰**(#350): `constants/motion.ts` 신설 + OS "동작 줄이기" 최초 존중.

## DB 변화

prod 적용 완료 6건(`list_migrations` 실측, **재적용 금지**): `posting_auto_close_gaps` · `work_schedule_soft_cancel_and_required_status_filter` · `fix_cancellation_request_camel_keys` · `restore_original_assignments_on_cancel` · `qr_checkin_status_whitelist` · `cancel_rpc_rebase_on_seat_basis`. parity 함수 183 / 정책 111 불변([[prod-parity-baseline]]).

마지막 항목이 이 웨이브 최대의 자책골이다 — 취소 RPC 를 **낡은 정의를 베이스로** 재정의해 07-18 개선 3종을 되돌린 채 prod 까지 나갔고, 머지 직전 CI 가 잡았다. 규칙은 [[secdef-replace-search-path-loss]] 확장절에 봉인.

## 배포 판정 (2026-07-28 실측)

| 항목 | 결과 |
|---|---|
| `npm run quality` | exit 0 (type-check·prettier 통과, lint 0 errors / 92 warnings) |
| `npm test` | 579 스위트 / 6333 테스트 / 122 스냅샷 전부 통과 |
| master CI | CI · DB Tests(pg_prove) 모두 success |
| 미적용 마이그레이션 | 0건 |
| Supabase Edge Function 변경 | 0건 |
| 네이티브 영향 파일 | 0건 → `runtimeVersion` 1.0.5 유지 |

`expo-updates runtimeversion:resolve` 가 android/ios 모두 `{"runtimeVersion":"1.0.5","fingerprintSources":null}` 를 반환해 `appVersion` 정책이 살아 있음을 확인했다. `eas build:list` 상 production 채널의 FINISHED 빌드가 전부 `rt=1.0.5` 이므로 이번 OTA 가 이들에게 **처음으로 도달하는 업데이트**다(직전 브랜치 업데이트는 구 정책 `exposdk:55.0.0` 로 발행돼 있어 매칭되지 않는다 — [[e2e-gate-absence]] 와 별개로 OTA 전달 공백이 있었다는 뜻).

## 저장소 정리 동반 (2026-07-28)

머지 판정을 커밋 메시지가 아니라 **"해당 커밋이 건드린 파일의 master 대비 diff 가 공백"** 으로 내려 브랜치 4개를 정리했다(스쿼시 저장소라 조상 관계로는 판정 불가 — [[parity-baseline-squash]] 와 같은 이유). 스테일 워크트리 1개(디렉토리는 사라지고 등록만 남음)를 prune 했고, 유일한 미머지 브랜치였던 수익모델 분석 문서 2건을 PR#361 로 편입했다([[revenue-model]]).
