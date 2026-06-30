# 핸드오프 — 주간 배치 그리드 QA & 플래그 ON (다음 세션 메인 프롬프트)

> **상태: PR #219 master 머지 완료. PROD 스키마 13종 적용·플래그 `weekly_grid_enabled` OFF(휴면, 사용자 무영향).**
> 남은 건 **플래그 ON 전 QA뿐**. 코드/DB는 광범위하게 자동검증됨 — 유일한 미검증은 **iOS 실기기 터치 거동**과 **운영자 엔드투엔드 스모크**다. 이 문서를 메인 프롬프트로 순서대로 진행하라.

---

## 0. 검증된 사실 (이번까지)

- 머지: PR #219 (squash) → master. 피처 브랜치 SHA `c362bc863`(머지 직전). 워크트리 `C:\Users\user\Desktop\T-HOLDEM-weekly-grid`.
- PROD 마이그 **13종 적용 완료**: `20260629000000`(스태프 직접추가 토대) + `20260630000000`~`20260702000000`(그리드 12종) + `20260703000000`(M1 read RPC workspace 재필터). enum #2 단독·1→12 순서·advisor(security/performance) **ERROR 0**·anon REVOKE **9/9 false**·플래그 OFF 실측.
- 자동검증(fresh): `npm run quality` EXIT0(머지 트리) · grid pgTAP **53/53** · jest 영향범위 전부 통과.
- 적대 전체리뷰(8에이전트) SHIP-WITH-FIXES → **H1·H2·H3·M1·M3·M4·M2·M5 전부 수정·검증 완료**.
- **미검증(이 세션이 할 수 없던 유일 항목)**: H1/H2 의 iOS **실기기 터치/스크롤** 거동(코드는 검증된 `SheetModal`+`overlay`(absoluteFill) 패턴이나 #186/#188 자체가 "실기기 미검증" 이력).

---

## 1. 🔴 BLOCKING — H1/H2 iOS 실기기 피커 QA (플래그 ON 전 필수)

중첩 RN Modal(iOS 터치먹통)을 `SheetModal`+`overlay`(absoluteFill, 자체 Modal 제거)로 교체했다. **실기기/시뮬레이터에서 터치가 실제로 살아있는지** 확인하라.

대상 화면:

- **EditSlotSheet**(`src/components/weeklyGrid/EditSlotSheet.tsx`) — 슬롯 편집. 시작/종료 시간 트리거 탭 → `TimeWheelPicker embedded` 휠 오버레이.
- **AddStaffModal**(`src/components/employer/applicants/AddStaffModal.tsx`) — **플래그 무관 라이브**(일반 스태프관리 '스태프 추가'). 근무 날짜 트리거 탭 → `CalendarPicker` absoluteFill 오버레이.

체크리스트(각 피커):

- [ ] 트리거 탭 → 오버레이가 **부모 시트 위에 뜨고**, 휠/캘린더 **스크롤·탭이 정상 동작**(iOS 터치먹통 없음).
- [ ] 백드롭(어두운 영역) 탭 → 오버레이만 닫힘(부모 시트 유지).
- [ ] **Android 하드웨어 백** → 오버레이만 닫힘(부모 시트가 통째로 닫히지 않음 — BackHandler 소비).
- [ ] 확인/선택 → 값이 트리거 라벨에 반영, 부모 폼에 정상 저장.
- [ ] **다크모드** 트리거/오버레이 색상 정상.
- [ ] (EditSlotSheet) 시작 30분 간격 휠·종료 휠 양쪽 / (AddStaffModal) 캘린더 월 이동·날짜 선택.

> 참조 패턴(이미 실사용·테스트됨): `src/components/employer/settlement/WorkTimeEditor.tsx:333-351` + `src/components/ui/SheetModal.tsx`(overlay prop) + `src/components/ui/TimeWheelPicker.tsx`(embedded). 거동이 다르면 이 참조와 diff.

---

## 2. 운영자 엔드투엔드 스모크 (플래그 ON 후)

플래그를 켠 환경에서 운영자 1명으로 전체 루프 1회:

1. (employer) 홈 → **"주간 배치 그리드" 진입 버튼**(플래그 ON일 때만 노출, `app/(app)/(tabs)/employer.tsx`) → 그리드 화면.
2. **운영처 생성/선택**(VenueSelector) → 숨김 컨테이너 자동 확보.
3. **월 그리드**: 날짜별 인원/공고 뱃지 표시.
4. 날짜 탭 → **하루 슬롯** 목록.
5. **스태프 추가**(전화검색→선택→날짜/역할/시간) → 그리드 반영.
6. **슬롯 편집**(시간/역할/색상/메모) → 반영.
7. **소프트타깃** 설정 → "부족 N명" 신호.
8. **공고 열기**로 1명 공개모집 확정 → 그 인원도 **같은 운영처 인원에 합산**되는지(E1 venue 스팬).
9. **QR**: 운영처 QR로 출근→퇴근(auto 판정).
10. **정산**: 운영처 단위 합산(컨테이너+open 공고 전부).
11. **지난주 복사** → 이번 주 반영(재실행 시 멱등=중복 안 늘어남).
12. **배치확인 알림** 발송 → 알림 탭 시 **그리드로** 이동(`/employer/weekly-grid`, H3 수정 확인 — '내 공고'로 가면 회귀).

---

## 3. 플래그 ON 전 코드 체크 1건 (R5, 적대리뷰 적출)

enum 신규값 `'container'` 가 **범용 공고 목록/카드/통계 read Zod** 를 throw 시키지 않는지 1회 실측(`status IN allow-list` 필터로 자동 탈락하므로 보통 안전하나, strict parse 경로가 있으면 `.catch()/.or()` 또는 reader 필터 필요). 대상: `src/schemas/jobPosting.schema.ts`, `src/types/jobPosting.ts`, `src/constants/statusConfig.ts`/`statusValues.ts`, `JobPostingCard`. 그리드 전용 RPC는 무관. (컨테이너는 fail-closed로 공개 경로에 안 뜨지만, 혹시 운영자 read 경로에 섞이는지 확인.)

---

## 4. 플래그 ON 절차 (점진)

QA + 스모크 통과 후에만:

```sql
-- PROD(또는 대상 환경) app_config
UPDATE app_config SET value = '{"enabled": true}'::jsonb WHERE key = 'weekly_grid_enabled';
-- 되돌리기: value = '{"enabled": false}'
```

- 플래그는 **전역**(per-workspace 아님) → ON 시 모든 운영자에게 진입버튼 노출. 점진 롤아웃하려면 소수 파일럿 운영처로 먼저 안내.
- OTA: JS만 변경(네이티브 무변경) → EAS update 가능. 함정: `android/` mv + `NODE_ENV=production` + `--environment production`(메모리 `pitfall_fixed_schedule_strict_parse_kills_backcompat`), `eas update`는 shell `process.env`만 평가(`pitfall_eas_update_shell_env_not_loaded`).

---

## 5. QA 방법 (플래그를 어디서 켜나)

진입 버튼이 플래그 게이트라 **켜야 보인다.** 안전한 순서:

- **로컬 dev 빌드 + 로컬 Supabase**(권장 1차): `.env.development.local`(NODE_ENV=dev 우선), `npm run db:start`. 로컬 DB엔 grid 마이그가 적용돼 있음(없으면 §7 멱등 재적용). 로컬 app_config 플래그만 ON → 시뮬레이터/실기기 dev 빌드로 §1 피커 + §2 스모크. PROD 무영향.
- **PROD 플래그**는 전역이라 켜는 순간 전체 노출 → §1·§2·§3 모두 통과한 뒤 마지막에.

테스트 계정: review-\*@uniqn.app(`Review2026!`) 또는 운영자 계정. 웹 QA는 `.env.development.local` 복사 + `/(employer)/weekly-grid` 직접 URL.

---

## 6. 비차단 후속 (추적용, QA 차단 아님)

- 배치확인 알림이 전용 타입 없이 `SCHEDULE_CREATED` 재사용 — 전용 타입 도입 시 `Record<NotificationType, X>` 전수 보강.
- 다중슬롯/일 venue QR 비대칭: 같은 (스태프, 컨테이너, 오늘) work_log 2건↑이면 venue QR(slot-agnostic)이 `BUSINESS_INVALID_STATE`(잘못 매칭은 아님). 단발 타깃엔 희소.
- "공고 열기" 스태프는 venue QR로 안 잡힘(정산은 스팬이라 잡힘) — 기존 공고 QR 사용 가정 문서화 또는 venue QR 스팬 확장.
- `getByOwnerAndPostingType`/`getByPostingTypeAndApprovalStatus` 방어 `.neq('status','container')`(현재 실누수 아님, 심층방어).
- softTargets 무한누적 정리 · 그리드 role 변경 감사 · `read_rpcs.test.sql` deny `WHEN OTHERS` 광역포획 정밀화.

---

## 7. 셋업 함정 (메모리)

- 공유 로컬 DB는 타 세션 `db reset`으로 grid 객체 수시 소실 → pgTAP/DB작업 전 멱등 재적용:
  ```bash
  cd uniqn-mobile && echo "CREATE EXTENSION IF NOT EXISTS pgtap;" > /tmp/pg.sql && docker cp /tmp/pg.sql supabase_db_uniqn:/tmp/pg.sql && MSYS_NO_PATHCONV=1 docker exec supabase_db_uniqn psql -U postgres -d postgres -q -f /tmp/pg.sql
  for f in supabase/migrations/20260629*.sql supabase/migrations/20260630*.sql supabase/migrations/20260701*.sql supabase/migrations/20260702*.sql supabase/migrations/20260703*.sql; do docker cp "$f" supabase_db_uniqn:/tmp/m.sql; MSYS_NO_PATHCONV=1 docker exec supabase_db_uniqn psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -f /tmp/m.sql; done
  ```
  전부 멱등. docker `/tmp` 경로엔 `MSYS_NO_PATHCONV=1` 접두. 정션은 PowerShell `New-Item -ItemType Junction`.
- pgTAP 단건: `-X -t -A` 로 클린 TAP(`^ok`/`^not ok` 집계).
- 진실의 원천: 설계 `docs/planning/2026-06-28-weekly-batch-grid-design.md`, 배포 핸드오프 `uniqn-mobile/docs/planning/2026-06-30-weekly-grid-deploy-handoff.md`.
