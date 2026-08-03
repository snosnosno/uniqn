# 세션 프롬프트 — 시간 모델 재설계 R0+R1 구현 (ULTRACODE)

> 사용 방법: 새 세션에 이 파일을 읽히고 시작한다. 본 세션은 **ULTRACODE 옵트인** — Workflow 도구로 다단계 오케스트레이션을 기본 사용하되, 아래 배치 한도·금지사항을 준수.
> 설계 진실원: `docs/analysis/2026-08-03-time-model-redesign.md` (적대 검토 반영판, **착수 전 전문 필독**)
> 메모리 토픽: `project_time_model_no_scheduled_end.md` (도메인 결정 + 검토 교훈)

## 0. 미션 (한 줄)

근무 시간 모델의 "미정 4종 표현"을 NULL 하나로 통일하는 첫 두 단계 — **R0(서버 선행 마이그레이션 1건) → R0 prod 적용 → R1(클라이언트 통일)** — 을 PR 2건으로 착지한다. R2(배포)~R4(REVOKE)는 이 세션 범위 밖.

## 1. 확정된 설계 결정 (재론 금지)

| 결정 | 내용 |
|---|---|
| 도메인 | 당일알바 — **예정 퇴근 시각 없음**(의도적). 정산=실제 `check_in_ts`/`check_out_ts` |
| D1 | 'NEGOTIABLE' 폐지 — 미정 상태는 **NULL 하나** |
| D2 | 일괄 편집 RPC **만들지 않는다** (개인별 #407 `update_work_log_slot` 로 충분) |
| D3 | 새벽 시작 근무=실제 시작 날짜로 공고 (공고 작성 화면 안내 문구만) |
| D4 | 협의/미정 **구분 표시 포기** — 스케줄 화면 전부 "미정" 표기 |
| 타입 | `time_slot` 은 **text 'HH:mm' 유지** — timestamptz 승격안은 폐기됨. 되살리지 말 것 |
| 의미론 | 공고=광고, work_log=계약. 자동 전파 장치 만들지 않음 |

## 2. 착수 절차 (순서 엄수)

1. **`git pull`** — 로컬 master 가 origin 대비 6커밋 뒤(08-03 실측). #407 마이그 `20260802180000_update_work_log_slot_rpc.sql` 이 디스크에 없으면 R0 설계가 불가능하다. pull 후 이 파일의 정규화·assignments 동시 갱신 로직을 실측하고 R0 규칙과 정합 확인.
2. **전용 워크트리 생성**(상시 규칙) + node_modules 정션: `mklink /J <worktree>\uniqn-mobile\node_modules <메인레포>\uniqn-mobile\node_modules` (MSYS 경로변환 주의, `.ps1` 은 ASCII 만). 메인 체크아웃은 읽기 전용.
3. `git status` 로 타 세션 미커밋 변경 확인 — docs/analysis/ 의 08-02~08-03 미추적 문서들은 **건드리지 말 것**(타 세션·본 설계 산출물).
4. 마이그레이션 착수 전 `/guard` 스킬 호출(RLS/위험 변경 규칙).

## 3. R0 — 서버 선행 마이그레이션 (PR 1건 + prod 적용)

**신규 마이그레이션 1개 파일** (타임스탬프는 오늘 날짜 신규 채번 — ⚠️ prod 기록명 재적용 금지 목록이 메모리에 다수 있음, `mcp__supabase__list_migrations` 실측 + `pg_proc` 카운트 대조 병행):

### 변경 내용
1. **`_posting_slot_key`**: 'NEGOTIABLE' 을 '미정' 으로 흡수 (현행: NULL/''/'미정'→'미정' 인데 'NEGOTIABLE' 만 그대로 키가 됨 — `20260710000002_baseline_schema_from_prod.sql:535-542` 실측 확인됨). 이 헬퍼는 인덱스 미사용이라 재정의 안전.
2. **정원 CASE 정합**: `confirm_application`·`add_direct_staff`·seat-basis 정원 카운트 계열의 `WHEN v_is_fixed THEN 'NEGOTIABLE'` 리터럴(baseline:711-715, 1341-1345 및 `20260718000100` 최신본)을 새 키 규약과 정합시킨다 — 공고 측 키와 지원서 측 키가 반드시 같은 값으로 접히게.
3. **INSERT 시점 정규화**: `confirm_application`·`add_direct_staff` 의 work_logs INSERT 에서 timeSlot 정규화 — 센티널('미정'/'NEGOTIABLE'/'')→NULL, 범위형('18:30 - 03:00')→시작시각. 구클라·구데이터·취소복원(`restore_original_assignments_on_cancel` 이 `original_application` 통째 복원)이 낡은 값을 재전송해도 여기서 전부 흡수된다. **applications jsonb 백필은 하지 않는다** — 이 정규화가 그 대체다.
4. **공고 변경 알림 분리**: schedule 변경 시 확정자(`status='confirmed'`) 대상 알림 문구에 "내 확정 시간은 변경되지 않음(근무표 기준)" + 링크를 `/jobs/{id}` 대신 `/schedule` 로. `add_direct_staff` 스태프는 applications 조인에 안 걸려 알림을 못 받는 현행 누락(baseline:5054-5056)도 해소.

### R0 함정 (전부 실사고·실측 근거)
- 함수 재정의는 **`CREATE OR REPLACE` 만** — DROP 금지(회수된 PUBLIC EXECUTE 부활). `SET search_path = public, extensions, pg_temp` 명시(`SET` 은 proconfig 통째 교체 — `20260731140000:20-26` 선례 참조).
- `jsonb ->> 'key'` 의 JSON null 은 SQL NULL 이 아니다 — 0원 확정 실사고 이력. 정규화 조건에 JSON null 케이스 포함할 것.
- SECDEF 안에서 `current_user` ≠ `auth.uid()`.
- 재정의 전사 검증은 `md5(prosrc)` 대조.
- 구클라 하위호환이 R0 의 존재 이유 — 센티널이 와도 **에러가 아니라 흡수**여야 한다. 23514 를 내면 설계 위반.

### R0 검증 게이트
- pgTAP: 신규 테스트 — ①fixed 공고에서 클라가 NULL/'NEGOTIABLE' 어느 쪽을 보내도 정원 매칭 동작(키 분열 회귀 차단) ②INSERT 정규화(센티널→NULL, 범위→시작시각) ③red-green: 정규화 제거 시 red 확인. 공유 Docker 스택은 병렬세션 상존 — 실행 전 상태 재확인.
- 로컬 적용은 타 세션 기록 충돌 시 `repair --status reverted` **금지** — `docker cp`+`psql -f` 우회(세션 G 실증).
- prod 적용: **`mcp__supabase__apply_migration` 전용**(db push 금지). 적용 후 `pg_proc` 카운트+`md5(prosrc)` 로 반영 실측. 현재 prod 파리티 기준 **192** (세션 G 메모리).

## 4. R1 — 클라이언트 통일 (PR 1건, R0 prod 적용 후)

### ⚠️ 전환기 원칙 (R1 전체를 지배 — 위반 시 실사고)
- **읽기는 관용, 쓰기는 보수**: prod 의 기존 센티널·범위형 행은 **R3 백필까지 남는다**(R0 은 신규 INSERT 만 정규화). 또한 R2 이후에도 구버전 사장 앱(엄격 `z.string()`)이 공존한다.
- 따라서 R1 은 ①읽기: NULL+센티널+범위형 전부 수용 ②쓰기: **null 전송 금지 — '미정' 문자열로 통일**('NEGOTIABLE' 도 '미정' 으로. 구 zod 리더가 문자열은 통과시키므로 안전). **null 쓰기 전환과 레거시 읽기 경로 삭제는 R3 의 일이다.**
- 이유: R1 이 null 을 쓰면 구버전 사장 앱이 그 지원서를 파싱 실패로 통째 증발시킨다(알려진 사고의 역방향). R1 이 레거시 파싱을 지우면 기존 행 표시가 깨진다.

### 변경 내용
1. **zod**: `schemas/application.schema.ts:177` `timeSlot: z.string()` → `z.string().nullable()` — **읽기 관용 목적**(미래의 null 데이터 대비). 쓰기 경로는 위 원칙대로 '미정' 문자열 유지. workLog.schema 쪽 2곳도 정합 확인.
2. **마커 상수 정리**: `types/assignment.ts` 의 `FIXED_TIME_MARKER('NEGOTIABLE')` 는 쓰기에서 제거('미정' 으로 통일). `TBA_TIME_MARKER('미정')` 는 **전환기 쓰기 상수로 유지**(제거는 R3). 미정 **판정**은 `isTimeTBD(v) = v === null || v === '미정' || v === 'NEGOTIABLE' || v === ''` 헬퍼 하나로 수렴 — 13개 파일이 이 헬퍼만 쓰게.
3. **13개 파일 분기 통일**(클라 인벤토리 실측 목록): `domains/workSchedule/slotEdit.ts` · `shared/time/WorkTimeDisplay.ts` · `components/schedule/helpers/{timeHelpers,index}.ts` · `utils/scheduleOverlap.ts` · `domains/application/slotCapacity.ts` · `components/jobs/shared/postingSurfaceModel.ts` · `services/work/selectWorkLogForQR` 등 — Grep 도구로 전수 재확인(Bash grep 은 app/ 트리 조용한 0건 함정).
4. **키 빌더 정합**: `slotCapacity.ts:56-60`·`postingSurfaceModel.ts:196-199` 를 R0 의 새 키 규약과 일치시키고, `slotCapacity.fixed.test.ts`("항상 마감 회귀" 가드) 재작성.
5. **D4 반영**: `WorkTimeDisplay` 의 negotiable 분기 제거 — 전부 "미정" 표기. `WorkTimeDisplay.test.ts:112`(협의/미정 혼합 금지 가드) 재작성. 소비처 `ScheduleCard.tsx:147`·`NextShiftCard.tsx:73`·`WorkTab.tsx:251`·`timeHelpers.ts:158`.
6. **TimeNormalizer 판정 통일**: 미정 판정을 `isTimeTBD` 헬퍼로 교체하되 **레거시 파싱 경로(센티널·범위형 읽기)는 삭제하지 않는다** — prod 기존 행이 R3 백필까지 남아 있다. 경로 삭제는 R3 이후 별도 정리. 소비 11개 파일 회귀 확인.
7. **안내 문구 2건**: ①공고 시간 수정 시 확정자 존재하면 "이미 확정된 N명에게는 적용되지 않습니다. 근무표에서 변경하세요" ②공고 작성 화면에 새벽 근무 날짜 관례(D3).
8. **23514 매핑 분기**: `utils/supabase.ts:130-137` — 구클라 지원서를 확정하다 맞는 케이스에 "지원자의 앱 업데이트가 필요합니다" 계열 문구 추가(현행 "시간을 다시 선택해 주세요"는 사장이 고칠 수 없는 원인이라 오도).

### R1 함정
- **jest 는 타입을 안 본다** — `tsc --noEmit` 필수. pre-commit 훅도 tsc 를 안 돈다.
- 상수·문구 변경 시 **`e2e/` 별도 Grep 필수**(eslint·quality 사각지대). e2e 10개 spec 이 `'18:00'` 단일값 하드코딩 — 즉시 충돌은 없으나 시드 정합 확인.
- CHECK 제약명 `work_logs_time_slot_format` 은 이 세션에서 **변경 대상 아님**(R3 의 일). 에러 매핑이 이름 참조 중.
- 오프라인 시 `useSchedules` 는 error 를 null 로 접는다 — 미정 표시 회귀 테스트에서 오프라인 케이스 유의.

### R1 검증 게이트
- `npm run quality`(type-check+lint+format 포함) + `npm test` — 실행 출력 증거 필수.
- red-green: 미정 통일 가드 테스트는 가드 제거 시 red 를 실제 확인("green ≠ 결함을 잡는다" 재발 방지).

## 5. ULTRACODE 운용 지침

- Workflow 페이즈 권장: **이해**(변경 지점 재실측, sonnet/haiku) → **구현**(R0·R1 병렬 불가 — R0 완주 후 R1) → **리뷰**(fable 다렌즈: correctness/security/db) → **적대 검증**(지적별 재현 프로브 — fable 리뷰 오탐 이력 2/5, 재현 안 되면 기각).
- 대규모 팬아웃은 **5개 단위 배치**(버스트 전원실패 이력).
- 서브에이전트 금지사항을 디스패치 프롬프트에 명시: `mcp__supabase__*` 직접 호출 금지 · **기존 마이그레이션 파일 수정 금지**(신규 파일만) · PROD 우회 금지 · 워크트리 절대경로 하드코딩 금지(`@/` alias).
- 에이전트 "성공" 보고는 VCS diff·테스트 실행으로 독립 검증 후 채택.

## 6. 완료 기준 & 인계

- [ ] R0 PR 머지 + prod 적용 실측(`pg_proc`/`md5`) — 적용 기록명을 메모리에 **재적용 금지**로 등재
- [ ] R1 PR 머지 (R0 prod 적용이 선행 조건 — 순서 뒤집기 금지)
- [ ] 검증 증거: pgTAP·jest·quality 실행 출력 + red-green 각 1회
- [ ] 메모리 `project_time_model_no_scheduled_end.md` 갱신 + 실행 원장(`docs/planning/2026-07-31-execution-session-prompts.md`) §5 인계 로그 반영
- [ ] 잔여 게이트 명시 인계: **R2(웹 배포·OTA)=사용자 게이트** → R3(백필+CHECK + **클라 null 쓰기 전환 + 레거시 읽기 경로·`TBA_TIME_MARKER` 삭제**, 센티널 신규 기록률 0 근접 측정 후) → R4(REVOKE). R3 의 트리거 비활성화·pgTAP lives_ok→throws_ok 스왑·`clocked_in_raw` 소급 금지는 설계 문서 §3 참조
- 마무리는 `/session-end`
