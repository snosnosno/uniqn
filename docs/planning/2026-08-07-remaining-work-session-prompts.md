# 잔여 작업 실행 원장 — 2026-08-07 기준

> **새 세션은 이 파일부터 읽는다.** 세션 하나 = 프롬프트 하나. 위에서부터 순서대로가 권고이나,
> 각 프롬프트는 **자립적**이라 골라 착수해도 된다.
>
> 기준 커밋: `origin/master` = **`a6a59cf9c`** (#436 머지, 2026-08-07 23:50 갱신)
> 트랙 현황: **S-A~S-E·S-G 착지 완료**(S-D=#436, S-E1=#433) · **남은 트랙 = S-F(MEDIUM 9)** + #433·#436 의 prod 적용.
> 전체감사 트랙(`2026-08-07-full-audit-followup-prompt.md`)은 **A4 까지 착지**(#434) — 다음 항목 미정.
> 선행 원장 `2026-07-31-execution-session-prompts.md` 는 **전량 착지 완료**(S1~S7·정원0·A감사·B1·B2·P1~P6·과제4).
> 그 파일은 이제 **참조용 이력**이고, 진행 중 작업의 진실원은 **이 파일**이다.

---

## 0. 현재 상태 스냅샷 (실측)

| 축 | 값 |
|---|---|
| `origin/master` | **`a6a59cf9c`** (#436 머지) — 2026-08-07 23:50 실측. **PR 번호가 빠르게 움직인다, 착수 전 `git fetch`** |
| 마지막 OTA | ⚠️ **`078e857d-49ca-4002-abae-849783163cf0`** (runtime 1.0.5, commit `fefe6b609`) — #420~#429 발행. **그 뒤 #432~#436 5건 미발행** |
| 마지막 웹배포 | ⚠️ **CF Production `92416de0`** (source `fefe6b6`) — #432~#436 미배포. #435 의 **AASA `/jobs` 는 웹 배포로만 전달**된다 |
| DB 파리티 | 마지막 실측 **200 funcs / 111 policies**(#429 시점). #433·#436 이 prod 미적용이라 **현재는 재측정 필요** |
| **branch protection** | ✅ **활성화** — required = `Quality Gate` · `E2E Gate` · force push/삭제 차단 (`enforce_admins=false`) |
| 열린 PR | Dependabot 4건뿐(#380·#414·#415·#416). **#379·#381 은 SDK 결합이라 닫음** |
| 열린 워크트리 | **3개**(08-08 00:05 재실측) — `T-HOLDEM-opschips`(🔴미머지·PR 없음) · `T-HOLDEM-opsurl`(🔴미머지·PR 없음) · `T-HOLDEM-sf`(🔴**S-F 작업 중, 건드리지 말 것**). `T-HOLDEM-settle` 은 #436 머지 후 정리 완료 |

### 🚨 2026-08-07 23:50 점검에서 새로 드러난 것

1. **마이그 접두사 충돌 — 발생했고, 병렬 세션이 닫았다.** `20260807190000` 을 master(#436
   `update_work_log_custom_settlement_rpc`)와 `feat/ops-chip-count-20260807`(`ops_chip_count_event_type`)이
   동시에 썼다. 그대로 PR 을 열었으면 CI 의 신선한 `db reset` 에서 `schema_migrations_pkey` 충돌로 죽었다.
   `990f35555` 에서 `200000`·`210000` 으로 리네임돼 해소됨. **하루에 2번 터진 함정이니 머지 직전 재확인을 규칙으로.**
2. **prod 가 레포보다 앞선 구간이 있다.** `list_migrations` 실측:
   - prod 에만: `20260807144558 ops_chip_count_event_type` · `20260807144632 ops_set_participant_chips`
     → **코드는 미머지 브랜치에 있는데 마이그만 prod 에 먼저 적용됐다.** opschips 머지 후 **재적용 금지** 목록에 넣을 것.
   - master 에만: `20260807180000`(#433) · `20260807190000`(#436) → **prod 미적용**.
3. **미머지 작업 2건이 PR 없이 로컬에만 있다** — opschips(칩 카운트)·opsurl(Android 딥링크 축소). 유실 위험.

> 🚨 **원장 초판의 "열린 워크트리 없음"·"`T-HOLDEM-a3-notify` 빈 껍데기" 는 둘 다 오판이었다.**
> a3-notify 는 측정 시점엔 커밋 0이었으나 그 사이 다른 세션이 A3 작업을 커밋했다(#429 로 머지).
> **워크트리 정리 판단은 실행 직전에 재실측할 것** — 세션 중에 바뀐다.

> ⚠️ **이 파일(`61aa650eb`)은 `origin` 에 없다.** 로컬 브랜치 `docs/remaining-work-handoff-20260807`
> 에만 있어 클론·다른 워크트리에서는 보이지 않는다. 푸시 여부는 사용자 결정 대기.

### ⚠️ prod 마이그레이션 재적용 금지 (누적)

레포 파일명과 prod 기록명이 **다르다**. `list_migrations` 로 확인하되 아래는 이미 적용됨:

| 레포 파일 | prod 기록명 |
|---|---|
| `20260805120000` | `work_logs_payroll_direct_write_block` |
| `20260806120000`·`130000`·`140000`·`20260807120000`·`130000` | `20260806233224`·`233316`·`233616`·`234002`·`234415` |
| `20260807140000`·`150000` | `20260807022947`·`20260807023036` |
| `20260804120000`/`130000` | `20260804115100`·`20260804115209` |
| `20260804140000` | `20260804142737`·`20260804142944` |
| `20260803160000` | `20260803015905` |
| `20260803120000` | `20260803025714` |
| `20260802190000` | `20260803013055` |

그 외 아카이브 졸업분은 `memory/MEMORY-archive.md` 참조.

---

## S-A. 보안 마무리 — ✅**2·3 완료** (2026-08-07, PR #428) · 🔴**1 남음**

> **착지 상태**: 브랜치 `docs/security-wrapup-20260807` 커밋 `e111bbca5` → **PR #428**.
> 마이그 0건 · 파리티 **200/111 불변** · `npm run quality` exit 0.
>
> ### ✅ 2. 전수 스캔 완료 — 잔여 노출 **1건**
> 🚨 **시드가 만드는 `@uniqn.app` 계정은 4개가 아니라 5개다.**
> `pending-employer-staff@uniqn.app`(시드 §5, AD-001)가 **`review-%` 패턴 회전에서
> 1차·2차 모두 누락**돼 prod 에서 아직 시드 평문이 유효하다.
> 실측: 4계정 `updated_at`=`08-07 04:50:31`, 5번째만 **`05-07`** 그대로.
> 권한이 `staff` 라 `permanently_delete_user` 경로는 **없고** 세션·refresh token 0건 → 즉시위험 낮음.
> **사용자가 "두고 보고만" 을 선택해 미조치.** 회전할 때는 패턴이 아니라 5개 이메일 목록 기준으로.
>
> 그 외는 깨끗: prod 27계정×평문10종 = 매치 위 1건뿐 · `supabase/seed.sql` 의 `TestPass1!` 4계정은
> `@uniqn.test` 라 prod 0건(마이그 이력 없음=정상) · 시크릿 하드코딩 0건
> (`wrangler.toml:17` anon key 만, publishable 이라 정상) · 추적 `.env` 는 `.example` 2개뿐.
> 🔑 **"archive 폴더에 있으니 무력"은 거짓** — archive 시드 3개 전부 prod 마이그 이력에 있다.
> 판정은 파일 위치가 아니라 `schema_migrations` 실측으로.
>
> ### ✅ 3. 문서 갱신 완료
> `docs/app-review/review-test-accounts.md`(평문 6개 제거 + 계정 5종 인벤토리 + 시드 마이그 경로 정정
> — `20260419031905` 는 **실존하지 않는 파일명**이었다) · `uniqn-mobile/docs/local-development.md`
> (로컬 전용 경고 + 5번째 계정) · `uniqn-mobile/e2e/config.ts`("4계정"→5계정 주석, 동작 무변).
>
> ### 🔴 1. 남은 것 — App Store Connect 심사 노트 갱신 (사용자 콘솔)
> 새 비밀번호는 `uniqn-mobile/e2e/.env.test` 의 `E2E_TEST_ACCOUNT_PASSWORD` 에 **실제로 있다**
> (2차 회전분, 실측 확인). ⚠️ 그 파일 주석도 "review-* 4계정"으로 적혀 있다 — gitignore 라
> 커밋 불가, **수동 정정 필요**.
>
> <details><summary>원본 프롬프트 (이력)</summary>

```
공개 레포 평문 자격증명 사고(#427, 2026-08-07)의 잔여를 마무리해줘.

배경: supabase/migrations/20260710000004_baseline_data_seed.sql:100-109 의 review-* 4계정이
평문 'Review2026!' 로 레포(PUBLIC)에 있었고 그게 prod 에 실제로 살아 있었다. review-admin 은
role=admin·미정지라 누구나 로그인해 permanently_delete_user 로 임의 계정을 지울 수 있었다.
비밀번호 회전 + 세션 93건/refresh token 108건 파기는 완료됐다.
상세: memory/pitfall_public_repo_seed_credentials_live_in_prod.md

할 일:
1. 🔴 App Store Connect **심사 노트 자격증명 갱신** — 회전한 계정이 심사용이다.
   안 바꾸면 다음 심사가 로그인 실패로 반려된다. 새 비밀번호는
   uniqn-mobile/e2e/.env.test 의 E2E_TEST_ACCOUNT_PASSWORD (gitignore 확인됨).
   docs/app-review/review-test-accounts.md 도 같이 본다.
2. 🔴 유사 평문 자격증명 **전수 스캔** — supabase/migrations/archive/ 3개에 같은 문자열이
   남아 있다(무력화됐다고 기록됐으나 미확인). 레포 전체에서 crypt(·password·secret 패턴을
   훑고, prod 에 흘러들어간 것이 더 없는지 확인해라.
   🔑 판정 기준: "평문이 레포에 있다"가 아니라 **"로컬 전용 시드가 prod 에 적용됐다"** 가 결함이다.
3. 🔴 docs/local-development.md 등 문서 3곳의 옛 비밀번호 안내 갱신.

주의:
- CI E2E 는 supabase start 로 로컬 스택을 쓴다(e2e.yml) → 회전이 CI 를 깨지 않는다.
- prod 세션이 찍힌 이유는 로컬 dev 가 prod 를 겨냥하기 때문이다
  (memory/feedback_localhost_dev_production_db.md).

완료 기준: 심사 노트 갱신 확인 + 스캔 결과 보고(발견 0건이면 0건이라고) + 문서 diff.
```

</details>

### S-A2. Firebase / GCP 정리 (#375 잔여, 사용자 콘솔 작업)

```
GitHub 하드닝 #375 의 잔여 3건을 마무리해줘. 전부 콘솔 작업이라 내가 해야 하면 절차를 알려줘.

1. Firebase Auth 제공업체 off
2. GCP 웹 API 키 3개 삭제
3. GitHub ruleset 설정

🔒 절대 금지: Firebase 프로젝트 tholdem-ebc18 **삭제 금지** — FCM 이 살아 있다.
상세: memory/project_github_hardening_firebase_legacy_20260731.md
```

---

## S-B. 웹배포 + OTA — ✅**완료** (2026-08-07)

> **웹**: CF Production `92416de0` (source `fefe6b6`). 라이브 번들 before/after 마커 대조로 확정 —
> `map.kakao.com/link/map/` 0→2 · `link/to/`(구) 1→0 · `work_log_check_in`/`_out` 0→1 · 대조군 `uniqn` 22→57.
> **OTA**: group `078e857d-49ca-4002-abae-849783163cf0` · runtime **1.0.5** · android+ios ·
> **Commit `fefe6b609` = origin/master 일치**(재fetch 규칙 충족). 네이티브 변경 0건이라 리빌드 없이 발행.
>
> ### 🚨 배포 중 발견 — 워크트리에서 웹배포하면 **빈 번들이 나온다**
> 정션 `node_modules` 때문에 expo-router 가 앱 루트를 못 찾아 **1.04MB / 749 모듈 / 라우트 1개**가 나왔다
> (정상 9.5MB / 9청크). **`verify-web-build.js` 게이트가 잡아서 배포는 차단됐다** — 게이트가 실제로 일했다.
> 해법: `EXPO_ROUTER_APP_ROOT="<워크트리 절대경로>/uniqn-mobile/app"` + `--clear`
> ([[pitfall_worktree_junction_expo_router_empty_routes]]). 추가로 워크트리엔 `.env.local` 이 없어
> **메인에서 복사**해야 한다(없으면 Supabase 설정이 빈 번들이 된다).
>
> ### 🚨 detached HEAD 워크트리는 **Preview 로 올라간다**
> wrangler 가 현재 git 브랜치로 환경을 정하는데 detached 면 프로덕션 판정이 안 된다.
> **`--branch=master` 명시 필수.** (실측: 명시 후 `Environment=Production`)
>
> ### 🔴 남은 것: 슬롯편집 RPC REVOKE (#407 잔여) — **여전히 불가**
> 마이그 주석(`20260802180000:50-53`)이 순서를 못박았다: "머지 → 배포+OTA → **롤아웃 확인(사용자 게이트)** → 그 다음.
> 역순이면 아직 전환되지 않은 구 빌드가 즉사한다." OTA 는 방금 발행됐고 채택률을 잴 계기판이 없다.
>
> <details><summary>원본 프롬프트 (이력)</summary>

```
#420~#427 8건을 웹과 앱에 배포해줘. 마지막 OTA 는 81ddba293(#419)이라 2주치가 밀려 있다.

배포 대상 커밋 범위: 81ddba293..732c300a5
  #420 정산 payroll 직접쓰기 차단(DB, 이미 prod 적용)
  #422 지도 앱 선택 + 문자하기
  #423 QR 헤더·유령 스피너·캘린더 스크롤
  #424 근무 시간 편집 통일
  #425 조건 유도 그룹핑
  #426 머지 리뷰 후속 5건 (중첩 Modal·프리셋 묶음 유출·퇴근 날짜 소실·조건 시트 막다른 길)
  #427 탈퇴 파이프라인 A1·A2 + 보안 차단

순서:
1. 웹배포: node scripts/deploy-cloudflare.js --force
   🚨 빈 번들 사고 이력 있음(21시간 다운) — 배포 후 라우트 수·번들 마커를 실측 확인.
   🚨 번들 마커 검사는 **grep -F + 대조군** (BRE 가 \u 를 삼켜 48건→0건 오판 2회).
   🚨 CDN 엣지 캐시 때문에 즉시 반영이 아닐 수 있다.
2. OTA: eas update
   🚨 직전에 **재fetch + ff-merge** 필수 — Commit 필드가 origin HEAD 인지 확인
      (memory/feedback_ota_refetch_local_tree_before_update.md)
   🚨 eas update 는 **shell env 만 평가**한다 — app.config fallback + 명시 export
   🚨 runtimeVersion 정책 = appVersion. 네이티브 변경이 있었다면 bump 는 사람 책임.
      이번 범위에 네이티브 변경이 있는지 먼저 확인해라(#422 가 canOpenURL 을 걷어내서
      LSApplicationQueriesSchemes/Android <queries> 가 불필요해졌으므로 **리빌드 없이 OTA 가능**할 것으로
      기록돼 있다 — 실측 확인할 것).
3. 롤아웃 후: 슬롯편집 RPC REVOKE 실행 (#407 잔여)

⚠️ 롤아웃 확인 계기판이 없다 — expo-insights 미설치, Sentry release/dist 미태깅,
   앱 버전 서버 기록 0건. 채택률로는 판정 불가하다. prod 트래픽도 작다(users 27 / work_logs 3).
   대안: 관계자 기기 직접 수신(fcm_tokens 16) 또는 차단 직전 관측 트리거(RAISE LOG).

완료 기준: 웹 라이브 번들에서 신규 마커 실측 + OTA 그룹 ID·runtime·플랫폼 보고.
```

</details>

---

## S-C. 실기기 QA — ✅**체크리스트 산출 완료** (실행은 사용자 게이트)

> **산출물**: `docs/qa/2026-08-07-device-qa-checklist.md` (#432 머지 `035fa697d`).
> 항목별 "무엇이 보이면 통과/실패인지" 1줄 · 0번 선행 게이트(OTA 미적용이면 이하 무효) ·
> 1순위 = #426 중첩 Modal(증상 자체를 재현한 적 없음) · 추정 통과 방지용 ⬜ 미확인 표기 분리.
> **이미 아는 미수정 결함(4-7 · 5-3 · 5-4 · 5-5)은 "재현되는 것이 정상"이라고 표기**해 오보고를 막았다.
> 🔴 **실행은 사용자가 해야 한다.** 결과를 위 파일 말미 보고 양식으로 남길 것.
>
> 🔑 R3 게이트(S-E2)의 하류 표본 3건도 **이 QA 때 같이 만든다** — `confirm_application`·
> `add_direct_staff`·QR 체크인을 각 1회. 안 하면 R3 판정이 영영 UNMEASURED 다.
>
> <details><summary>원본 프롬프트 (이력)</summary>

```
실기기 QA 체크리스트를 만들어줘. 내가 직접 돌릴 거다. 화면별 재현 절차와 기대 결과를 적어줘.

미검증 누적:
🔴 #426 중첩 Modal 수정 — **증상 자체를 재현한 적이 없다**(iOS 실기기 부재).
   일정 상세 → 정보 탭 → '지도에서 보기' 첫 탭 → 인라인 라디오가 실제로 눌리는가.
   고른 뒤 '변경'으로 다시 열리는가. (이게 이번 QA 의 1순위)
🔴 #422 지도 앱 선택 + 구인자 문자하기 — iOS 시뮬은 sms: 미지원이라 실기기 필수
🔴 #423 UI 5건 (QR 헤더 침범·유령 스피너·캘린더 스크롤 잠김)
🔴 #424 근무 시간 편집 통일 — 3 진입점(근무표·스태프관리·정산)이 같은 답을 주는가
🔴 #425 조건 유도 그룹핑 — 프리셋 1탭 후 날짜 선택 시 묶음 토글이 꺼진 채 나오는가(#426 수정 확인)
🔴 #427 탈퇴 파이프라인
🔴 Android 키보드 회귀 17화면 (#302→#335)
🔴 오프라인 UI (#262)
🔴 구 빌드 QR 거부 고지

각 항목에 "무엇이 보이면 통과/실패인지"를 한 줄로 적어줘.
```

</details>

---

## S-D. 정산 R4 선행 — RPC화 2경로 + Lost Update + 애널리틱스

```
정산 도메인의 남은 직접 쓰기 경로를 RPC 화해줘. 시간모델 R4 의 선행 조건이다.

착수점:
1. uniqn-mobile/src/repositories/supabase/SettlementRepository.ts:372
   (출퇴근·메모 직접 UPDATE — updateWorkTimeWithTransaction)
2. uniqn-mobile/src/repositories/supabase/SettlementRepository.ts:587-604
   (개인 정산 설정 저장 — custom_salary_info/allowances/tax + settlement_modification_history)
   🔴 여기가 **이력 jsonb Lost Update** 잔여 1경로다. select → 배열 append → update 통째 덮어쓰기라
      동시 요청이 앞 이력 항목을 조용히 지운다.
      (work_logs.modification_history 쪽은 #424 가 서버 RPC 로 이관해 이미 닫혔다 — FOR UPDATE + 단일 문장)
3. 🔴 정산완료 애널리틱스 복구 — trackSettlementComplete 는 호출부가 **0건**이다(실측:
   정의 analyticsService.ts:358 + 배럴 재export 2곳뿐). 유일 호출부였던
   workLogService.updatePayrollStatus 가 #402 이후 죽은 회로였고 #426 웨이브에서 제거됐다.
   복구하려면 RPC 경로 settlementMutation.updateSettlementStatus 에 붙여야 한다.
   묘비 주석: src/services/work/workLogService.ts:154-162

전제/함정:
- 다중 쓰기는 RPC 필수(CLAUDE.md). 서버가 FOR UPDATE + 단일 문장으로 처리해야 한다.
- 🚨 트리거로 쓰기 채널을 좁히면 기존 pgTAP 이 깨진다 — **착수 전 supabase/tests/ 전수 grep**
- 🚨 마이그레이션은 mcp__supabase__apply_migration 전용(db push 금지)
- 파리티 기대값은 **머지 시점에 재산정**한다(현재 200/111). parity_baseline_guard.test.sql 의
  PARITY_EXPECT_FUNCS/POLICIES 마커와 단언 리터럴을 **동시** 갱신.

완료 기준: RPC 화 + pgTAP red-swap 1:1 + quality exit 0 + jest green.
```

---

## S-E. 서버 검증 강화 + R3 설계 — ✅**둘 다 산출, PR #433 (머지·prod 적용 대기)**

> ### ✅ (1) 퇴근 ≥ 출근 서버 검증
> 마이그 `20260807180000_work_log_slot_checkout_after_checkin.sql`.
> 직전 정의의 함수 본문을 **바이트 단위 복사** 후 앵커 뒤에 가드만 삽입 — diff 실측 **추가 28줄 / 삭제 0줄**.
> 설계 3원칙: **병합 후 최종값**으로 판정(패치 값만 보면 "한쪽만 고쳐 역전"이 뚫린다) ·
> **같음(=)도 거부**(24시간 근무가 아니라 입력 오류) · **한쪽 NULL 이면 판정 안 함**(퇴근 전 정상 상태).
> 검증: pgTAP **red-green** `PASS(41)` → 되돌림 `FAIL(39·40·41)` → 복원 `PASS(41)` · 형제 2종 PASS · CI DB Tests PASS.
>
> 🔴 **prod 미적용.** 함수 전체 750줄/36KB 를 `CREATE OR REPLACE` 하는데, `apply_migration` 인자로
> 사람이 다시 옮겨 적으면 **주석 축약·전사 드리프트**로 정본이 갈린다(동작이 같아 테스트로 안 잡히는 부류).
> 파일을 그대로 실을 수 있는 경로로 적용한 뒤 `md5(replace(pg_get_functiondef(oid), chr(13),''))` 대조할 것.
> 적용 전 prod md5 = `58e62b584695cd60732c39b7b7a79cfb`(길이 25397, 가드 부재).
> **파리티 영향 없음** — `CREATE OR REPLACE` 라 함수 수 불변.
>
> ### ✅ (2) R3 착수 게이트 측정 설계
> `docs/analysis/2026-08-07-r3-gate-measurement-design.md`. 실행 가능한 SQL + PASS/FAIL/**UNMEASURED** 판정.
> 🔑 **UNMEASURED 를 1급 결과로 둔 것이 핵심** — 분모가 비면 통과가 아니다(#427 의 "0건=피해자 없음" 오독과 같은 부류).
> 🔑 코호트 술어는 `created_at` 이 아니라 **`updated_at`**(실측 3 vs 9 — 공고 편집도 쓰기다).
> 🔑 저트래픽 대응은 **기다리기가 아니라 능동 실행** — QA 때 3경로를 각 1회 밟아 분모를 만든다.
> **현재 판정 = UNMEASURED**(상류 9/센티널 0 · 하류 3/센티널 0). prod 전 기간 공고 슬롯 **112건 전수 정본**.
>
> <details><summary>원본 프롬프트 (이력)</summary>

```
두 가지를 해줘. (1) 은 R4 착수 전 필수다.

(1) 🔴 퇴근 ≥ 출근 순서 검증을 서버에 넣어라
    update_work_log_slot RPC(20260807130000:376-407)가 reason 200자·memo 500자·XSS·HH:mm 형식·
    역할 enum 을 전부 서버에서 재현하면서 **checkOut <= checkIn 만 재현하지 않는다**.
    유일한 방어가 클라 attendanceInsight.ts:66-80 이고, DB CHECK 도 없다
    (work_logs_status_timestamp_consistency 는 NULL 여부만 본다).

    실패 시나리오: 인증된 employer 가 rpc('update_work_log_slot', {p_patch:{checkIn:"18:00Z",
    checkOut:"09:00Z"}}) 직접 호출 → 저장 성공 → status='checked_out' 파생 → 정산 게이트 통과 →
    fn_settlement_amount 가 GREATEST(0, v_diff_s) 로 음수를 0 으로 접어 **₩0 정산이 에러 없이 확정**되고
    스태프에게 "정산 완료. 지급액: 0원" 알림이 간다.

    ⚠️ 지금은 work_logs 직접 PATCH 도 열려 있어 RPC 만의 구멍은 아니다. 다만 R4(직접 UPDATE REVOKE)
       이후 이 RPC 가 **유일 경로**가 되므로 그때 반드시 남는다.
    ⚠️ 경계: 퇴근==출근은 24시간 근무가 아니라 검증 오류다(등호 포함 금지 규칙 — WorkTimeFields.tsx:178-182 주석).

(2) 🔴 시간모델 R3 착수 게이트 설계
    R3 의 착수 조건이 "센티널 신규 기록률"인데 **그 측정 쿼리가 설계문서에 없다**.
    docs/analysis/2026-08-03-time-model-redesign.md 를 읽고 측정 쿼리를 새로 설계해라.
    prod 트래픽이 작다는 점을 감안해라(users 27 / work_logs 3 / 30일 지원 5건) —
    "기다려서 로그가 쌓이길 기대하는" 방식은 성립하지 않는다.
```

</details>

---

## S-F. 머지 리뷰 잔여 MEDIUM / LOW 정리

```
2026-08-07 머지 리뷰(#420~#425 대상)에서 확정했으나 #426 에서 고치지 않은 MEDIUM 9 / LOW 12+ 를
정리해줘. 상세: memory/project_merge_review_followups_20260807.md

MEDIUM (실재 확인됨):
1. useManualRefresh identity churn — src/hooks/useManualRefresh.ts:78 이 useCallback(..., [refreshing]).
   주석 :51 이 "onRefresh 정체성 고정 — 매 렌더 새 함수면 iOS 제스처가 끊긴다"고 선언했는데
   deps 때문에 **제스처가 시작되는 바로 그 순간** identity 가 바뀐다. 26개 화면 적용.
   해법: in-flight 플래그를 state 가 아닌 useRef 로 두고 deps 를 비운다.
2. 자정 이후 출근이 편집할 때마다 하루 앞으로 접힘 — WorkTimeFields.tsx:177 의 field==='checkIn'
   갈래에 익일 보정이 **아예 없다**(표시도 (익일) 표식 없음). #426 은 checkOut 갈래만 고쳤다.
   근무일 08-10 / check_in_ts 08-11 00:30 인 야간조 지각 입장 행에서 00:45 로 5분 고치면
   08-10 00:45 가 되어 근무가 31.5시간(1890분)이 되고 12시간 초과 **경고만** 뜬다.
3. 저장 1회 ≠ 알림 1통 — 20260806120000 의 병합은 notify_on_work_log_update **한 함수 안**만
   흡수한다. check_in_ts/check_out_ts 가 같은 UPDATE 에 실리면 tr_notify_work_log_checkinout 이
   독립 발화 → 출퇴근 첫 입력 시 스태프 4통·구인자 3통. **회귀는 아니나** 마이그가 선언한
   불변식(:12-13, COMMENT :454)이 사실이 아니다.
4. checkOut 을 null 로 지워도 end_time_source='manual' 이 박힘 — 20260807130000:587.
   형제 경로 ConfirmedStaffRepository.updateStatusWithTransaction:551 은 null 갈래가 있다.
5. no_show 행은 3 진입점 중 1곳(정산)만 열림 — ConfirmedStaffCard.tsx:104-105 canEditTime 게이트가
   버튼에서 거른다. 그런데 WorkLogEditSheet.tsx:87-88 주석은 "스태프관리·정산 두 진입점"이라 **거짓**이고,
   바로 위 :100-102 주석은 "세 진입점이 같은 답을 주는 것이 D2"라 **5줄 간격 자기모순**이다.
   cancelled 행은 어디서도 못 열어 시트의 cancelled 불가침 분기는 도달 불가 코드다.
6. 묶음 토글을 끄기만 해도 "같은 조건이라 하나로 합쳐졌어요" + auto_merge 계기판 오염 —
   scheduleNotices.ts:99. bundleToggledByUser 는 ②(묶음해제)만 건너뛰고 ③(자동병합)은 그대로 탄다.
   해법: bundleToggledByUser===true 면 ③의 after.length < before.length 항도 건너뛴다
   (dedupe 축 dateCount(after) < expectedDates 는 남겨도 무해).
7. 날짜 시트가 전 일정 스코프인데 여전히 "N개 추가" 어휘 — DatePickerModal.tsx:184,171,200.
   4일 공고에서 하루를 빼려고 칩 하나를 해제하면 버튼이 "3개 추가"라고 적혀 있다(실제는 1일 삭제).
   전체 해제하면 확인이 잠기고 카드가 1개면 삭제 X 도 없어 빈 상태로 되돌아갈 길이 없다.
8. OrderSheetScreen.tsx **1,400줄** — 800줄 상한 위반이 #425 로 +200줄 악화됐다(주석은 1,200줄이라
   적어 놨다). notifyScheduleChange(586-652)도 함수 50줄 초과. 일정 뮤테이션 핸들러 6종은
   폼만 의존하므로 useScheduleMutations 훅으로 통째 추출 가능.
9. expectedDateCount 가 타입이 아니라 주석으로만 강제됨 — scheduleNotices.ts:45,98. 옵셔널이고
   폴백이 곧 버그 동작인데 호출부 3곳 중 1곳만 전달한다.

LOW: dark: 짝 누락(⚠️ **오탐이었다 — 아래 참조**), editedBy 3곳 중 1곳만 전달,
     SafeArea/sticky 가드 테스트가 .some() 이라 약함, mapLink probe:false 테스트 0건,
     Android geo: probe 비일관(추정), 죽은 회로 3건, 드리프트 가드 키 1개 부족,
     ConfirmedStaffCard 빼기 버튼 accessibilityLabel 없음, 레거시 grouped 싱글턴 강등(추정),
     draftToValues 날짜 중복 dedupe(추정), 묶음의 새 날짜 승계.

🔑 **dark: 짝 누락은 대부분 오탐이다.** 진실원은 src/components/ui/__tests__/darkModePairRatchet.test.ts
   머리말 — CSS 변수 토큰 단독은 **포탈 밖에서 정상 동작**하고 깨지는 건 @gorhom/bottom-sheet 뿐이며
   **RNModal 기반 시트는 실기기 QA 에서 멀쩡했다**(2026-07-19). SheetModal·ui/Modal = RNModal 이다.
   판정 절차: ①토큰이 global.css 에 라이트/다크 둘 다 정의됐나 ②그 컴포넌트가 gorhom 시트 안인가.

우선순위는 네가 판단해서 제안하고, 내 확인 후 착수해라.
```

---

## S-G. 인프라 · 의존성 — ✅**1·2 대부분 완료** · 🔴 3·4·5 남음

> ### ✅ 1. branch protection **활성화** (2026-08-07)
> required = **`Quality Gate`** · **`E2E Gate`** · force push 차단 · 브랜치 삭제 차단. `enforce_admins=false`(소유자 긴급 우회 허용 — 원치 않으면 `true` 로).
>
> 🔑 **데드락을 어떻게 피했나**: 그냥 required 로 걸면 #375 사고가 재현된다(`paths` 필터에 안 걸리는 PR 은
> 워크플로가 트리거되지 않아 체크가 **영구 pending**). 그래서 #432 에서 먼저:
> `pull_request` 의 `paths` 제거 → `changes` 잡이 `base..head` diff 로 판정(**판정 불가면 보수적 전체 실행**) →
> 무거운 잡은 조건부 → 애그리게이터 `Quality Gate`/`E2E Gate` 가 `if: always()` 로 **항상 결론 보고 + `skipped`를 성공 처리**.
> 이 게이트 두 개만 required 다.
>
> 🚨 **기존 열린 PR 은 protection 켜는 즉시 BLOCKED 된다**(새 게이트가 그 브랜치에 없어서).
> `gh pr update-branch` 로 master 를 흡수시켜 풀었다 — #414·#415·#416 처리 완료.
> ⚠️ **`false`(건너뜀) 경로는 아직 실검증 안 됐다.** 다음 문서 전용 PR 에서 두 게이트가 green 인지 확인할 것.
>
> ### ✅ 2. Dependabot 6건 → 판정 완료 (4건 남음)
> 근거는 `npx expo install --check` 실측(SDK 55): 호환 드리프트는 **`react-native@0.83.6 → 0.83.10` 하나뿐**.
>
> | PR | 판정 |
> |---|---|
> | **#381** expo-camera 55.0.21→57.0.3 | ❌ **닫음** — 55.0.21 이 SDK 55 의 정답. 57 은 SDK 57 용이라 QR 체크인이 깨진다 |
> | **#379** react-native-webview 13.16→14.0.1 | ❌ **닫음** — 13.16.0 이 SDK 55 기대 범위. 올리면 다음 check 에서 오히려 부적합 |
> | **#380** eslint-plugin-react-hooks 5.2→7.1.1 | ⏸ **열어 둠** — 실제로 올려야 하지만 설정 마이그레이션 필요. 원인 확정: v6+ 가 자체 flat config 로 플러그인을 등록하는데 `eslint.config.js:50` 이 수동 등록을 유지해 `Cannot redefine plugin "react-hooks"`. 🔴 진짜 비용은 v6+ React Compiler 규칙군이 낳을 **신규 위반 대량 발생**(현 warning 기준선 114) — 전용 세션 필요 |
> | #414·#415·#416 | ⏸ 미머지. update-branch 로 게이트 재실행함. #416(postcss patch)은 보안 알림 1건을 닫으므로 **먼저 머지 권장** |
>
> ### 🔴 3. GitHub 취약점 5건 — **직접 수정 불가로 판정**
> 3× brace-expansion(high) · postcss(medium, #416 이 해결) · uuid(medium).
> `npm audit` 실측 13건이 전부 **Expo 툴체인 내부 전이 의존성**(`@expo/config-plugins` → `@expo/config` →
> `expo-splash-screen`·`@expo/metro-config`). `npm audit fix --force` 는 SDK 핀을 깬다.
> **SDK 업그레이드로만 해소되는 부류**이고, 빌드 타임 도구라 앱 런타임 노출 경로가 아니다.
>
> ### 🔴 4. 빈 웹 번들 게이트 CI 배선 — 여전히 미완
> ⚠️ 다만 **배포 스크립트에는 이미 있다**(`deploy-cloudflare.js` Step 3.5 → `verify-web-build.js`).
> 이번 세션에 **실제로 작동해서 1.04MB 깨진 번들을 차단했다.** 남은 건 CI 쪽 배선뿐이다.
>
> ### 🔴 5. 롤아웃 계기판 부재 — 손 안 댐
> 이게 #407 REVOKE 를 막고 있는 유일한 병목이다. 근본 해결 = Sentry `release`/`dist` 태깅.
>
> <details><summary>원본 프롬프트 (이력)</summary>

```
인프라 잔여를 정리해줘.

1. 🔴 master **branch protection 이 없다** — E2E 게이트가 우회 가능하다(#331·#334 잔여 ①).
   🚨 함정: paths 필터 + required check 조합은 **영구 pending 데드락**을 만든다(#375 실사고).
2. Dependabot PR 6건 — 뒤 3개는 메이저라 검증 필요:
   #414 supabase/setup-cli 1.7.1→3.0.0   (🔑 v1 은 태그가 아니라 움직이는 브랜치였다)
   #415 actions/github-script 7.1.0→9.0.0
   #416 postcss 8.5.22→8.5.25
   #379 react-native-webview 13.16.0→14.0.1  ← 메이저. B1 주소검색 WebView 가 의존
   #380 eslint-plugin-react-hooks 5.2.0→7.1.1 ← 메이저
   #381 expo-camera 55.0.21→57.0.3           ← 메이저. QR 체크인이 의존
   🚨 mmkv 4.1.2 / nitro 0.33.2 는 **정확 핀 유지** — 캐럿으로 되돌리면 Android Kotlin 컴파일 실패
3. GitHub 취약점 5건(high 3, moderate 2) — dependabot 보안 알림 확인
4. 빈 웹 번들 배포 방지 게이트 **CI 배선 미완**(사고 이력: 21시간 다운)
5. 🔴 **롤아웃 계기판 부재** — expo-insights 미설치 · Sentry init 에 release/dist 미태깅 ·
   앱 버전 서버 기록 0건. 근본 해결은 Sentry release 태깅이다.
```

</details>

---

## 🔴 남은 트랙 — S-D · S-F (미착수)

2026-08-07 세션은 S-B·S-C·S-E·S-G 를 처리하고 **S-D 와 S-F 에는 손대지 않았다.**
각각 전용 세션 분량이고, 정산 도메인은 보안 민감도가 높아 남은 컨텍스트로 착수하면 품질이 떨어진다고 판단했다.
아래 프롬프트는 그대로 유효하다.

---

## ⏸ 사용자 판단 대기 (착수 전 결정 필요)

| # | 안건 | 지금 상태 | 결정하면 |
|---|---|---|---|
| 1 | **assignments 자가 치유가 의도인가** | `update_work_log_slot` 6단계 진입 게이트가 `v_sync_app_id IS NOT NULL` 뿐이라 축을 안 본다. `checkOut` 만 담긴 패치로도 다일 묶음 원소가 분해되고 `duration` 삭제·`isGrouped` 반전된다(조각 C 주석: "패치 여부와 무관하게 갱신"). 부수로 `applications` 잠금이 실적 편집 전체로 넓어져 QR 경로와 **잠금 순서가 정반대**(데드락 창) | 의도 아니면 6단계에 축 게이트 추가 → `work_log_slot_sync_rpc.test.sql` 의 특성화 단언 33~39 가 red 로 알려준다 |
| 2 | 정원0 원인 **B(축 미매칭)** | 의도적으로 열어 둠(A·C 만 닫음) | 실사용 로그 후 판단 |
| 3 | `ScheduleSlotsSheet` **(a) 경로** 추가 적용 | #426 은 (b)(`mustPickDate` 분리 + 잠금 사유 노출)만 적용. 리뷰가 "정본"이라 한 (a)(`handlePressCondition` → 날짜 시트)는 미적용 | 화면 단위 회귀 테스트가 이미 막다른 길 부재를 고정하므로 선택 사항 |
| 4 | iOS `LSApplicationQueriesSchemes` | `canOpenURL` 을 안 쓰게 됐으므로 **불필요할 가능성** | 확인 후 닫기 |
| 5 | 1.0.5 웨이브 잔여 | W2 10항목 · W3-1 보류 · P0-3/P0-4 | 범위 확정 필요 |
| 6 | 감사 **M11 축 통일** | 인덱스가 유일 기록(토픽·wiki 미기재) — 내용부터 복원 필요 | |

---

## 📋 메모리 stale 정정 (2026-08-07 실측)

다음 세션에서 `MEMORY.md` 를 고칠 때 반영할 것:

- **`MEMORY.md` 실행 원장 줄의 "남은 것=S7 구현" 은 stale** — S7 은 #412(`d5ff28ec5`)로 머지 완료,
  후속 정원0 도 #417(`d410c791b`)로 완료. **선행 원장 트랙은 전량 착지**다.
- **B2 지오코딩 줄의 "잔여=🔴머지" 는 stale** — PR #411 은 2026-08-03T13:27:53Z 에 머지됐다.

---

## 세션 운영 규칙 (매번 적용)

- 🔴 **모든 구현 세션 = 전용 워크트리**. 메인 체크아웃은 읽기·계획 전용.
  정션: `powershell New-Item -ItemType Junction -Path <wt>\uniqn-mobile\node_modules -Target <main>\uniqn-mobile\node_modules`
  (Git Bash `ls` 로는 1개로 보이지만 정상 — PowerShell `Get-ChildItem` 으로 821 확인)
- 🚨 워크트리 제거 전 **정션 먼저 해제** — 안 하면 원본 `node_modules` 가 날아간다(전 워크트리 동반 사망 이력).
  복구는 `npm ci`(개별 `npm install` 은 캐럿 드리프트).
- 🚨 jest 에 `app/(employer)/...` 경로를 직접 넘기면 **괄호가 정규식 그룹이라 조용히 미매칭**된다
  (실패가 아니라 그 스위트가 안 도는 것). `--testPathPattern "<파일명>"` 을 써라.
- 🚨 로컬 pgTAP 단일 파일 실행은 `npm run test:db:helpers && npx supabase test db <파일> --local`.
  bare `docker exec psql -f` 는 pgtap 확장 미설치라 `function plan(integer) does not exist` 로 죽어
  **테스트 결함으로 오판**하기 쉽다.
- 🚨 상수·enum·사용자 문구를 바꾸면 **`e2e/` 별도 Grep 필수** — `npm run quality` 범위 밖이라 CI 에서야 터진다.
  page object 경유(`getStatLabel` 류)면 사전 grep 을 해도 안 걸린다.
- 🚨 커밋 메시지에 **백틱 금지** — 명령치환으로 문장이 사라진다. `git commit -F -` + heredoc.
- 마이그레이션은 `mcp__supabase__apply_migration` 전용(`db push` 금지). 주석 축약 금지 —
  적용 직후 `md5(replace(pg_get_functiondef(oid), chr(13), ''))` 대조(**`chr(13)` 없으면 전부 가짜 불일치**).
