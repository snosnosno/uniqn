# 주간 배치 그리드 (홀덤펍 운영 그리드) — 설계 v2

- **작성일**: 2026-06-28 (일) · **개정**: v2 (엔지니어링/보안/디자인/유저플로우 4종 검토 반영)
- **상태**: DESIGN v2 — 검증 완료, Phase 1 착수 준비됨 (전체 6 Phase 진행 확정)
- **확정 결정**: ① **전체 6 Phase 진행**(MVP 컷 없음) ② **QR 트리밍 포함** ③ **컨테이너 카운터 = read-time COUNT(추천안)**
- **v2 핵심 수정(검토 결함 반영)**: ①**E1 집계축을 컨테이너→venue_id 스팬으로**(count/정산/부족신호: 컨테이너+그 venue의 open 공고 work_logs 합산 — 단일 컨테이너만 보면 "공고 열기" 유입 인원이 조용히 누락) ②**E2 venue 식별 키 + 유니크 인덱스**(워크스페이스당 운영처 多 지원, 동명 충돌 방지) ③**E3 컨테이너 생성 race → ON CONFLICT 멱등** ④**E4 enum ADD VALUE 마이그 2단 분리**(같은 트랜잭션 내 사용 불가) ⑤**E5 날짜 키 포맷 SSOT** ⑥**E7 remove_direct_staff 대칭 분기** ⑦**S1 XSS(운영처명/메모/색상)·S2 anon REVOKE·S5 QR is_active 가드 유지** ⑧**U1~U4 a11y 부족신호/뱃지밀도/다크색상/빈상태**.
- **브랜치**: (예정) `feat/weekly-batch-grid` — master 기반
- **선행 의존**: `origin/claude/staff-management-add-feature-g8wvsz`(직접배치 토대, 마이그 `20260629000000_staff_management_direct_add.sql`) **선머지·배포 필수**
- **피처플래그**: `weeklyGrid` (권장: `app_config` 원격 플래그 / 최소 `src/config/featureFlags.ts` 빌드타임)

> **이 문서의 위상**: 원본 구현 지시서를 실제 코드와 대조 검증(2회) + 4종 검토(eng/guard/design/userflow)한 **정식 설계 확정본**. 지시서의 *구조*는 채택하고, 검증으로 드러난 디테일을 교정. 변경·이력은 `wiki/log.md`·`CHANGELOG.md`에 별도 누적.

---

## 1. 배경 & 목표

### 1.1 타깃과 문제
타깃은 **홀덤펍 사장(상시 단발 알바)** + **대회사 운영팀(D-7 집중 인력)**. 멘탈모델은 "공고 매번 게시"가 아니라 **"이번 주 배치표(그리드)에 사람을 꽂는다"**. 현 uniqn은 공고 중심이라 단골 반복 배치의 마찰이 크다.

### 1.2 목표
펍/대회를 **운영처(venue)** 하나로 보고, **주간 캘린더 그리드 + 단골 직접배치 + 출퇴근(QR)·정산** 운영 루프를 기존 도메인 위에 얹는다. 새 앱이 아니라 **기존 자산 재사용·확장**.

### 1.3 비목표 / 금지 (불변)
- 기존 기능(정산·QR·알림·공고·직접배치) 중복 구현 금지
- 추천·매칭·랭킹·중간 정산(돈) 금지 — 법적 중립(카피: "배치/확정/기록/계산")
- 종료시간 필수 강요 / `clocked_out_raw` 덮어쓰기 / 새 디자인토큰 / analytics 의존 금지
- **신규 테이블 금지** — 허용 신규 스키마는 §4뿐(`'container'` enum + `venue_id` + work_logs 4컬럼 + `schedule.softTargets` JSONB + venue 유니크 인덱스)

---

## 2. 결정적 제약 — 왜 "컨테이너-as-공고"인가

### 2.1 스키마가 강제한다
`base_schema.sql:195` — `work_logs.job_posting_id uuid **NOT NULL** REFERENCES job_postings(id)`. **모든 근무기록은 공고에 매달려야 한다.** 공개 공고 없이 단골을 표에 꽂으려면 work_log를 매달 **anchor 공고**가 필요하다.

### 2.2 대안 비교
| 대안 | 평가 | 판정 |
|---|---|---|
| **A. 영속 컨테이너 1개/운영처** (채택) | work_logs FK 충족 + RLS/게시판/QR/정산 무상 상속 + 캘린더·게시판 연속성·지난주복사 자연 | ✅ **채택** |
| B. 주 단위 실공고 자동생성 | 정산 자연 스코핑이나 월 캘린더·게시판 분절 | ❌ UX 손해 |
| C. `venues` 테이블 + FK nullable | 6테이블 NOT NULL + 5트리거 참조 → 금지 스코프 | ❌ 과대 |
| D. 컨테이너 없이 기존 공고 직접배치 | "공개 광고 없이 배치" 가치 상실 | ❌ 무의미 |

### 2.3 enum 새 값이 boolean보다 나은 이유
공개 경로가 이미 `status IN (allow-list)`로 필터 → 목록에 없는 새 status는 **자동 탈락(fail-closed)**. boolean이면 경로마다 `AND is_container=false`를 추가해야 해 더 샌다.

### 2.4 ⚠️ venue는 컨테이너보다 넓다 (E1 — 집계축의 근거)
`confirm_application`은 work_logs를 INSERT한다(20260415120000:369 외 다수). 즉 **"공고 열기"로 만든 open 공고의 확정 스태프 work_log는 컨테이너가 아니라 그 open 공고에 매달린다.** 따라서 운영처의 진짜 데이터는:
```
venue(V)의 work_logs = work_logs WHERE job_posting_id IN (컨테이너 V ∪ {venue_id=V 인 open 공고들})
```
**모든 count·부족신호·정산은 이 venue 스팬으로 집계한다.** 컨테이너 단일 posting만 보면 open 공고 유입 인원이 누락된다(§6/§8/§9에 반영).

```
                    workspace (접근 진실 = RLS)
                        │
                  venue (그룹핑 축 = venue_id)
                  ┌─────┴───────────────┐
          컨테이너(status=container)   open 공고들(status=active, venue_id=컨테이너)
          │ 직접배치 work_logs          │ 확정 work_logs (confirm_application)
          └──────────┬─────────────────┘
                     ▼
        venue 스팬 집계 = COUNT/정산/부족신호의 단위
```

---

## 3. 핵심 설계 결정 (확정)

1. **통합 운영처(venue) 모델**: 펍/대회를 운영처 하나로. 차이는 속성(`kind 'pub'|'tournament'` + 기간).
2. **컨테이너 = 숨김 공고, `status='container'`**(신규 enum, fail-closed). schemaVersion=3, posting_type='regular', schedule.kind='dated', total_positions=0, title=운영처명, venue_id=self.
3. **`venue_id`**(job_postings, nullable): 컨테이너 자기참조 + 그 운영처 open 공고가 가리킴. **접근 진실=workspace_id RLS, venue_id=그룹핑/집계 축**. 인덱스 필수.
4. **슬롯 = 자유 추가/삭제/편집**. 기본역할 딜러 + 기존역할. 셀 색상(work_logs.color, 토큰 팔레트 제한). 메모=work_logs.notes.
5. **soft-target**: 운영처 날짜별 목표인원 → "부족 N명" → 공고열기. **컨테이너 `schedule.softTargets`에 저장**(§4.4).
6. **홈 = 캘린더 오버뷰** → 날짜 탭 → 그 날 슬롯 리스트. 상단 운영처 선택기(list_my_workspaces + venue 목록). "내 공고"는 보조 토글.
7. **QR 트리밍**: 고정 운영처 QR 1개(회전/만료/카운트다운/날짜재생성 제거, in/out 자동판정). 출퇴근 엔진+운영자 수정 유지. QR RPC에 'container' 허용(§7).
8. **게시판**: 운영처(컨테이너) 단위 지속. 멤버=최근30일+예정. 공개피드 제외.
9. **법적**: 추천/랭킹/중간돈 없음, 중립 정렬, 신고번호 유지.

---

## 4. 데이터 모델 (additive 마이그레이션)

### 4.1 enum / 컬럼 — ⚠️ E4: 마이그 2단 분리 필수
Postgres는 `ALTER TYPE ... ADD VALUE`로 추가한 enum 값을 **같은 트랜잭션 내에서 사용 불가**. Supabase `apply_migration`은 마이그=트랜잭션. → **마이그 ①(enum 추가)** 와 **마이그 ②(그 값을 쓰는 제약/생성)** 를 분리.

```sql
-- 마이그 ① (단독): enum 값 추가
ALTER TYPE posting_status ADD VALUE IF NOT EXISTS 'container';

-- 마이그 ② (이후): 컬럼·인덱스
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES job_postings(id);
CREATE INDEX IF NOT EXISTS idx_job_postings_venue_id ON job_postings(venue_id);
-- E2: 운영처당 1 컨테이너 멱등 보장 (workspace + 정규화명 + kind)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_venue_container
  ON job_postings(workspace_id, lower(title), (schedule->>'kind'))
  WHERE status = 'container';
ALTER TABLE work_logs
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS clocked_out_raw timestamptz,
  ADD COLUMN IF NOT EXISTS end_time_source text,   -- 'qr' | 'manual'
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES users(id);
```
> 마이그=MCP `apply_migration` 전용(db push 금지). **신규 함수는 `REVOKE EXECUTE FROM anon` 명시(S2)**, SECDEF는 `SET search_path=public,extensions,pg_temp`(S3).

### 4.2 Zod SSOT 갱신 (BLOCKING)
`POSTING_STATUS_VALUES`(SSOT)에 **`'container'` 반드시 추가**. 누락 시 `parseJobPostingDocument` safeParse가 컨테이너를 null 증발(함정: enum 발산→읽기 증발). 가시성 차단은 §5 중앙 deny가 담당.

### 4.3 컨테이너 생성 헬퍼 — E2/E3 (식별 키 + race)
`getOrCreateVenueContainer(workspaceId, { name, kind, period })`:
- 멱등 키 = `(workspace_id, lower(name), kind)`(§4.1 유니크 인덱스).
- **race 방지**: `INSERT ... ON CONFLICT (멱등 키) DO NOTHING RETURNING` 후 미반환 시 SELECT(동시 생성 1개 보장).
- `status='container'`, `total_positions=0`, `title=name`, `posting_type='regular'`, `schemaVersion=3`, `schedule.kind='dated'`, `venue_id=self`.
- **S1**: name은 사용자 입력 → `z.string().refine(xssValidation)` 통과분만 title 저장.

### 4.4 soft-target 저장 (모순 해소 + S1/E5)
컨테이너의 비어있는 `schedule` JSONB 재사용:
```jsonc
schedule: { kind: 'dated', softTargets: { "2026-07-01": 3, "2026-07-02": 5 } }
```
- ⚠️ **`requirements[].count`와 분리 필수** — requirements에 넣으면 `add_direct_staff` `MAX_CAPACITY` 하드가드(20260629000000:167) 발동해 자유슬롯 막힘. softTargets는 표시·신호 전용.
- **E5 날짜 키 포맷 SSOT**: softTargets 키 · work_logs.date(text, base_schema:198) · COUNT-by-date가 **동일 포맷(YYYY-MM-DD)** 이어야 부족신호 정합. 경계에서 정규화(과거 ISO 정규화 함정 20260421020000 참조).

---

## 5. fail-closed 중앙화 (BLOCKING)

공개 경로는 allow-list로 자동 탈락 ✅. **누수 2곳**만 차단:

| 경로 | 현 상태 | 조치 |
|---|---|---|
| 공개 RLS `jp_select`·검색·`getList` 기본값·capacity_full 트리거·만료 크론 | 자동 제외 ✅ | 무변경(회귀 테스트 고정) |
| `getByOwnerId`/`getManagedJobPostings`(status 선택필터) | 컨테이너 노출 ❌ | **명시 deny** |
| Zod document 스키마 | enum 추가 시 통과 | §4.2 + 중앙 deny |

**원칙: "N곳 allow-list 관례" → "1곳 deny 강제".**
- (a) `JobPostingRepository` **베이스 쿼리**가 기본 `status != 'container'` 제외(컨테이너 조회만 opt-in `includeContainer`).
- (b) 공개 RLS/뷰는 현행 allow-list 유지.
- (c) **모든 SUM/통계 reader**에 `status != 'container'` 집계 deny.
- (d) Phase 1에 **누수 감사 테스트 먼저**(컨테이너가 크론·공개검색·운영자리스트·통계에 새면 FAIL → deny로 GREEN). pgTAP+jest.

---

## 6. 카운터 전략 — read-time COUNT, venue 스팬 (확정 (c) + E1/E7)

**컨테이너는 `filled_positions`를 쓰지 않는다**(이유: add_direct_staff의 무조건 `filled+1`(20260629000000:220) → 컨테이너 `filled=N,total=0` 드리프트·0 나누기. 함정: denormalized counter drift).

- **add_direct_staff 분기**: `IF v_job.status='container' THEN` filled+1/capacity_full 미러 블록(20260629000000:218-238) **skip**.
- **E7 remove_direct_staff 대칭 분기**: `IF status='container' THEN` filled 감소 블록(20260629000000:306-) skip. (현재 `GREATEST(...,0)`로 underflow는 막히나, 대칭 분기로 명시해 혼란 방지)
- **하루 인원(venue 스팬, E1)**:
  ```sql
  COUNT(*) FROM work_logs
  WHERE job_posting_id IN (SELECT id FROM job_postings WHERE venue_id = :V OR id = :V)
    AND date = :D AND status NOT IN ('cancelled','no_show')
  ```
- **부족 N명** = `softTargets[D] − 위 COUNT` (음수면 0 clamp).
- **집계 deny**(§5c)로 컨테이너 행이 전역 통계에 안 섞임.

---

## 7. QR 트리밍 (스코프 포함 — 최고 위험)

### 7.1 ⚠️ live 함수 기준 작업 (BLOCKING)
`20260414120200_...` 파일은 **구버전**(이후 `worklog_ts_phase_c/d`로 check_in/out timestamptz 이관). **변경은 live 함수(`pg_get_functiondef`) 기준.**

### 7.2 변경 (S5 가드 구분 주의)
| 항목 | 현재 | 변경 |
|---|---|---|
| action | `p_action` 명시 | **`'auto'` 분기** — status `checked_in`→checkOut, 아니면 checkIn |
| status 가드 | `!= 'active'` 차단(원본 line 68) | `NOT IN ('active','container')` 허용 |
| **is_active 가드(S5)** | 계정 비활성 차단(20260415120000) | **유지**(완화 금지) — status 가드만 완화 |
| QR 페이로드 | jobPostingId+date+action, 3분 유효·2분 회전·날짜재생성 | 고정 운영처 QR(container_id만) |
| work_log 해소 | QR이 date·action 운반 | 앱이 `(staff, container_id, date=today)` 조회 → 없으면 "오늘 배정 없음" / 다중슬롯이면 슬롯 선택 or 시간 근접 매칭 |
| 신규 컬럼 | — | checkOut 시 `clocked_out_raw`(원시각, **덮어쓰기 금지**)·`end_time_source='qr'`·`edited_by` |

### 7.3 보안 트레이드 (수용+보정)
- 회전/만료 제거 = **원격 대리체크인(QR 사진 공유)만** 새 위험. 소수 단골 팀 → 수용 + 운영자 수기수정(end_time_source='manual', edited_by) 감사.
- **double check-in·음수 work_duration 무손실**: QR 회전이 아니라 RPC `FOR UPDATE`+상태가드가 막음.

---

## 8. 정산 — venue 스팬 + 날짜범위 (BLOCKING, E1/§8)

검증: `WorkLogRepository.getByJobPostingId`는 date 필터 없음(limit만), settlementQuery는 클라 필터.
- **조치**: work_logs 조회를 **venue 스팬 + 날짜범위 SQL 레벨**로:
  ```sql
  ... WHERE job_posting_id IN (SELECT id FROM job_postings WHERE venue_id=:V OR id=:V)
        AND date >= :from AND date <= :to
  ```
  단일 컨테이너 posting만 보면 open 공고 정산 누락(E1). 날짜범위 기본값(예: 당월) 정의.
- 정산 게이트 `isCanonicalDatedPosting`은 status 무시(`jobPostingVisibility.ts:30-40`) → 컨테이너 통과, 변경 불요.

---

## 9. 읽기계층 & UI/UX

### 9.1 읽기계층 (venue 스팬)
- `useGridSummary(workspaceId, month)`: venue별 월 1쿼리(GROUP BY date), venue 스팬 집계(§6). open 공고 수 많으면 IN→JOIN 전환.
- `useVenueDaySlots(venueId, date)`: 그 날 컨테이너+open 공고 work_logs union.
- 기존 repo 조합, TanStack Query 읽기전용(Repository 직접 호출 허용).

### 9.2 재사용 자산 (검증)
| 자산 | 위치 | 재사용 |
|---|---|---|
| featureFlags | `src/config/featureFlags.ts` | ✅(빌드타임→app_config 권장) |
| DateCalendar/CalendarGrid | `src/components/jobs/DateCalendar/` | ✅ |
| **CalendarCell** | 동상 | ⚠️ 단일 count만 → 다중뱃지 prop 확장 |
| ConfirmedStaffList | `.../applicants/ConfirmedStaffList.tsx` | ✅ `showActions=false` |
| templateToDraft/useTemplateManager | `types/jobTemplate.ts:145` 외 | ✅ |
| list_my_workspaces/activeWorkspaceStore | `WorkspaceRepository.ts:92`, `stores/activeWorkspaceStore.ts` | ✅ |
| add_direct_staff/AddStaffModal/useStaffPhoneSearch | 의존 브랜치 | ✅ 벌크·협업자 허용 |
| boardScheduleService | `services/board/boardScheduleService.ts` | ✅ |
| 디자인 토큰(Midnight Craft) | `tailwind.config.js` | ✅ |

### 9.3 UI/UX 보강 (U1~U4)
- **U1 a11y**: 부족신호를 색상 단독 금지(색맹) → **숫자+아이콘** 병기, 캘린더 빨강에 카운트 동반.
- **U2 뱃지 밀도**: 모바일 셀 3뱃지 과밀 → 우선순위 1개(부족>공고>배치) 압축, 상세는 탭 후.
- **U3 셀 색상 다크모드**: 동적 className `dark:` 유실 함정 → **토큰 팔레트 칩 선택**(자유 hex 금지) + inline style/CSS-var. color 값 화이트리스트(S1).
- **U4 빈/경계 상태**: 운영처 0·그날 0명·부족 0·로딩·에러 화면 정의.
- 그 날 슬롯 리스트=FlatList(소형), 월/대형=FlashList(CLAUDE.md).

---

## 10. Phase별 구현 계획

> 각 Phase 끝 멈춤·보고·승인 대기. 빅뱅 금지. 전부 `weeklyGrid` 플래그 뒤. OFF면 기존과 동일.

### Phase 0 — 탐색 (완료)
본 설계로 갈음(fail-closed·QR·정산·카운터·집계축·재사용 전수 실측).

### Phase 1 — 데이터 토대 🔴 BLOCKING 집결
- 마이그 **2단**(§4.1 E4: enum → 컬럼/인덱스/유니크) + Zod SSOT(§4.2) + getOrCreateVenueContainer(§4.3 E2/E3 ON CONFLICT)
- **fail-closed 중앙화**(§5) + **누수 감사 테스트 먼저**
- 날짜 포맷 SSOT(§4.4 E5) + 슬롯 상태머신(순수함수) + 단위테스트

### Phase 2 — 그리드 읽기 전용
- `useGridSummary`/`useVenueDaySlots`(§9.1, venue 스팬, 월 1쿼리)
- CalendarCell **다중뱃지 prop**(U2 우선순위 압축, U1 a11y) + 운영처 선택기 + 날짜 상세=ConfirmedStaffList(읽기)

### Phase 3 — 추가/편집
- 추가 시트: 풀 꽂기/전화검색(AddStaffModal)/공고 열기(templateToDraft→인원→발행, venue_id=컨테이너)
- add_direct_staff(**카운터 분기 §6**)/remove(**대칭 분기 E7**)/시간·역할·색상(U3 팔레트)·메모(S1) 편집/시작시간 자동정렬/중복충돌 경고
- soft-target 입력(§4.4) + 부족 신호(U1)

### Phase 4 — QR + 정산
- QR 트리밍(§7, live 함수 기준, 'auto'+'container', is_active 가드 유지, 원본보존)
- 정산: SettlementCalculator + **venue 스팬 + SQL 날짜범위(§8)**

### Phase 5 — 편의
- 지난주 복사: 지난주 동요일 work_logs(venue 스팬, no_show/cancelled 제외) → add_direct_staff 벌크(중복가드 멱등). 대량이면 단일 벌크 RPC(선택)
- "이번 주 배치 확인" 알림(FCM)

### Phase 6 — 정합
- "내 공고" 토글 정리(컨테이너 deny 확인) + 공고작성 풀폼→"템플릿/상세편집" 강등
- venue_id를 draft 경로 추가 시 **draftAdapter 5매퍼 전수갱신**(region 유실 함정) + 고정공고 lifecycle 무회귀

---

## 11. 리스크 레지스터

| # | 리스크 | 심각도 | 확신도 | Phase | 완화 |
|---|---|---|---|---|---|
| E1 | venue 집계축 누락(open공고 인원 조용히 누락) | 🔴 | 9 | 1·2·4 | §6/§8/§9 venue 스팬 집계 |
| E2 | 컨테이너 식별 키 모호(동명/다중 운영처) | 🔴 | 8 | 1 | §4.1 유니크 인덱스 |
| E3 | 컨테이너 생성 race | 🟠 | 8 | 1 | ON CONFLICT 멱등 |
| E4 | enum ADD VALUE 동일 트랜잭션 사용 불가 | 🔴 | 8 | 1 | 마이그 2단 분리 |
| E5 | 날짜 키 포맷 드리프트 | 🟠 | 7 | 1·3 | 포맷 SSOT |
| E7 | remove 카운터 분기 비대칭 | 🟠 | 8 | 3 | 대칭 분기 |
| R1 | 컨테이너 filled 드리프트 | 🔴 | 9 | 3 | §6 read-time COUNT + 분기 |
| R2 | fail-closed 운영자/Zod 누수 | 🔴 | 9 | 1 | §5 중앙 deny + SSOT + 감사 테스트 |
| R3 | soft-target 저장소 부재 | 🔴 | 8 | 3 | §4.4 schedule.softTargets |
| S1 | XSS(운영처명/메모/색상) | 🔴 | 7 | 1·3 | xssValidation + color 화이트리스트 |
| S2 | 신규 RPC anon default-grant | 🔴 | 8 | 1·4 | REVOKE FROM anon |
| S5 | QR is_active 가드 완화 위험 | 🔴 | 8 | 4 | status 가드만 완화, is_active 유지 |
| R4 | QR live 함수 drift | 🔴 | 8 | 4 | pg_get_functiondef 기준 |
| R5 | 정산 전기간/잘림 | 🟠 | 9 | 4 | §8 venue+날짜범위 SQL |
| R6 | 토대 브랜치 미머지 | 🔴 | — | 0 | 선머지·배포 |
| R7 | QR 원격 대리체크인 | 🟠 | 7 | 4 | 수용 + 감사 보정 |
| R8 | venue_id draft 누락(region 유실 재현) | 🟠 | 7 | 6 | draftAdapter 5매퍼 |
| U1 | 부족신호 색상 단독 a11y | 🟠 | 8 | 2·3 | 숫자+아이콘 |
| U3 | 셀 동적색상 dark: 유실 | 🟡 | 7 | 3 | 토큰 팔레트/inline |

**critical gap**: E1 미수정 시 인원/정산이 silent하게 틀림(테스트·에러처리 둘 다 없음) → Phase 1·4에서 반드시 닫는다.

---

## 12. 수용 기준

- [ ] 각 Phase 멈춤·보고 / 플래그 OFF면 기존과 동일(무회귀)
- [ ] `status='container'` fail-closed: 크론·공개검색·운영자리스트·통계 노출 0 + 회귀 테스트(R2)
- [ ] **count·부족·정산이 venue 스팬(컨테이너+open공고) 집계**(E1) + 테스트
- [ ] 컨테이너 filled 미사용, read-time COUNT, 0 나누기 없음, add/remove 대칭(R1/E7)
- [ ] soft-target 저장·부족신호, requirements 분리, 날짜 포맷 SSOT(R3/E5)
- [ ] QR 'container' 허용·auto·원본보존·**is_active 가드 유지**, live 함수 기준(R4/S5/R7)
- [ ] 정산 venue+날짜범위 SQL(R5)
- [ ] enum 2단 마이그, anon REVOKE, XSS 검증(E4/S2/S1)
- [ ] 부족신호 a11y(숫자+아이콘), 셀 색상 토큰 제한·다크대비(U1/U3)
- [ ] 기존 add_direct_staff/정산/QR/공고 재사용(중복 0)
- [ ] 법적 금지 준수, Midnight Craft 토큰
- [ ] `npm run quality` 통과

---

## 13. 의존성 & 시퀀스

```
토대 브랜치 머지·배포(R6)
  → Phase 1(마이그 2단+SSOT+fail-closed 중앙화+ON CONFLICT+감사 테스트+상태머신)  ← BLOCKING 집결
  → Phase 2(읽기 그리드, venue 스팬, 다중뱃지)
  → Phase 3(추가/편집+카운터 대칭 분기+soft-target)
  → Phase 4(QR 트리밍+정산 venue+날짜범위)
  → Phase 5(지난주복사+알림)
  → Phase 6(정합·draftAdapter·lifecycle)
```

**병렬화**: Phase 2(읽기)와 Phase 3(쓰기)는 같은 venue 모듈을 공유 → 순차. QR(Phase 4)과 정산(Phase 4)은 분리 워크스트림이나 둘 다 work_logs 컬럼 의존 → Phase 1 이후. 사실상 순차(공유 모듈 다수).

> **다음**: 본 설계 v2를 Phase 1부터 `superpowers:test-driven-development`로 착수(마이그 2단 + fail-closed 중앙화 + 누수 감사 테스트). RLS/권한 변경은 작성 시 §5/§7/S1·S2·S5 체크리스트 적용. 결정·결론은 메모리 `project_weekly_grid_design_20260628`에 저장됨.
