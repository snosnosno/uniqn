# T-HOLDEM 라이브 대회 운영 엔진 부활 — 슬라이스 1 설계

- **작성일**: 2026-06-23 (화)
- **상태**: DESIGN — 사용자 리뷰 대기
- **브랜치**: `feat/tournament-ops-revival` (master 기반, `T-HOLDEM-ops` 워크트리)
- **선행 조사**: git 히스토리 원본 T-HOLDEM(`app/`, `app2/`) 기능 인벤토리 (별도 탐색 에이전트 보고)

---

## 1. 배경 & 목표

원본 **T-HOLDEM**은 Firestore 기반 라이브 토너먼트 운영툴이었으나, 앱이 **uniqn**(홀덤 스태프 관리앱, Supabase) 으로 피벗하며 운영 기능 전체가 삭제됐다(코드는 git 히스토리에만 잔존). 현재 uniqn에 남은 "대회" 기능은 운영툴이 아니라 **대회 공고(스태핑 채용)** 뿐이다.

**목표** — 와홀덤/kHold'em 같은 홀덤 대회 운영 플랫폼을 지향하되, 첫 조각으로 **원본 T-HOLDEM의 라이브 운영 엔진을 Supabase 위에 부활**시키고, **uniqn 계정·공고 확정 스태프를 그 대회의 운영 인력으로 연동**한다.

### 비목표 (이번 슬라이스 제외)
공개 플레이어 포털, 위치기반 대회 일정 노출, 랭킹/포인트, 예약/참가권, 커뮤니티, 정산 플랫폼, 매장 관리 확장, 히스토리 PDF/Excel export. → 후속 슬라이스.

---

## 2. 범위 (슬라이스 1)

### 포함
1. **대회 CRUD** — 생성/수정/상태(upcoming→active→completed), 시작 칩·테이블당 좌석 수 설정
2. **참가자 관리** — 운영자가 이름 직접 입력(워크인). 단건/벌크(CSV) 등록, 상태(active/busted/no_show), 칩 스택, 바이인/리바이/애드온
3. **테이블·좌석** — 테이블 개설/마감, 좌석 그리드, 3종 자동 배정(랜덤 / 대기채움 / 칩 스네이크드래프트), 좌석 이동(moveSeat)
4. **블라인드 & 타이머** — 블라인드 레벨 구조(SB/BB/ante/duration/break), 서버 동기 타이머
5. **딜러 배정 + uniqn 연동** — 대회↔공고 연결 시 확정 스태프 자동 등록 **AND** 내 스태프 풀 수동 선택 (둘 다 지원)
6. **상금 분배** — 순위별 상금 구조 + 파이널 순위 → 상금 산정
7. **실시간 동기화** — Supabase Realtime (참가자·테이블·클럭)

### 명시적 결정 (사용자 승인)
| 결정 | 선택 |
|---|---|
| 참가자 정체성 | 운영자 직접 입력 (플레이어 계정 불필요) |
| 스태프 연동 | 공고 자동 등록 + 스태프 풀 수동, **둘 다** |
| 상금/결과 | 상금 분배 **포함**, export **보류** |
| 코드 구조 | A — uniqn-mobile 모노레포 + `(ops)` 라우트그룹 |
| 데이터 공유 | uniqn과 **같은 Supabase 프로젝트** 공유 |

---

## 3. 아키텍처

### 코드 구조 (A안)
- **uniqn-mobile 단일 코드베이스**에 `app/(ops)/` 라우트그룹 신설. 웹 우선(운영자 = 노트북/태블릿).
- **2번째 Cloudflare Pages 프로젝트**로 새 도메인 배포. `EXPO_PUBLIC_APP_VARIANT=ops` 환경 플래그로 진입/탭 구성 분기(메인 앱과 빌드 산출물 분리).
- 같은 Supabase 프로젝트·같은 Auth → "uniqn 계정 공유"는 기존 `src/lib/supabase.ts` 클라이언트·인증 hook 재사용으로 **추가 코드 0줄**.
- 재사용 자산: NativeWind 디자인(Black & Gold·다크모드), UI 컴포넌트(Badge/Card/Button 등), `logger`, `AppError(E1~E7)`, Zod, react-query `queryClient`.

### 레이어 (CLAUDE.md 준수)
```
Presentation (app/(ops)/*)
  → Hooks (src/hooks/ops/*)
    → Service (src/services/ops/*)
      → Repository (src/repositories/ops/*)
        → Supabase (tournament_* 테이블 / RPC / Realtime)
```
- Presentation/Hooks에서 Supabase 직접 호출 금지.
- TanStack Query 읽기 전용 조회는 Repository 직접 호출 허용(기존 규약).

### 도메인 모듈 분리 (작은 파일 원칙)
- `src/domains/tournament/` — 순수 도메인 로직(좌석 배정 알고리즘, 상금 산정, 블라인드 진행)을 I/O와 분리하여 단위 테스트 가능하게.
- 배정 알고리즘 3종은 각각 독립 모듈(`seatAssignment/random.ts`, `waitingFill.ts`, `chipSnakeDraft.ts`) + 공통 검증.

---

## 4. 데이터 모델 (Postgres)

> Firestore 서브컬렉션 `users/{uid}/tournaments/{tid}/...` → FK + RLS 평탄화. 모든 테이블 `owner_id`/`tournament_id` 스코프 RLS. Realtime publication 등록.

### 4.1 `tournaments`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK→auth.users | 생성·소유 운영자 |
| job_posting_id | uuid FK→job_postings **nullable** | uniqn 대회 공고 연결(시너지) |
| name | text NOT NULL | XSS Zod refine |
| venue | text | 매장/장소 |
| event_date | date | |
| status | text CHECK(upcoming/active/completed) | enum SSOT 파생 |
| starting_chips | int DEFAULT 30000 | |
| seats_per_table | int DEFAULT 9 | |
| color | text | UI 색상 |
| created_at / updated_at | timestamptz | 트리거 갱신 |

### 4.2 `tournament_blind_levels`
`id, tournament_id FK, level int, sb int, bb int, ante int DEFAULT 0, duration_sec int, is_break bool DEFAULT false, sort int` — `(tournament_id, sort)` 유니크.

### 4.3 `tournament_participants`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| tournament_id | uuid FK | |
| name | text NOT NULL | XSS refine |
| phone | text nullable | |
| status | text CHECK(active/busted/no_show) DEFAULT active | |
| chips | int DEFAULT 0 | 인-게임 스택 |
| buy_in_amount | int | |
| rebuys | int DEFAULT 0 | |
| add_ons | int DEFAULT 0 | |
| table_no | int nullable | 현재 좌석(역정규화) |
| seat_no | int nullable | |
| player_identifier | text nullable | |
| note | text nullable | |

인덱스: `(tournament_id, status)`.

### 4.4 `tournament_tables`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| tournament_id | uuid FK | |
| table_no | int NOT NULL | |
| name | text nullable | |
| seats | uuid[] | 각 원소 = participant_id 또는 NULL(빈 좌석) |
| status | text CHECK(open/closed/standby) DEFAULT open | |
| assigned_staff_id | uuid FK→users **nullable** | 배정 딜러 |
| position | jsonb nullable | `{x,y}` 캔버스 좌표 |

`(tournament_id, table_no)` 유니크.

### 4.5 `tournament_staff` (uniqn 연동 조인)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| tournament_id | uuid FK | |
| staff_id | uuid FK→users | |
| role | text CHECK(dealer/floor/serving) | StaffRole |
| source | text CHECK(job_posting/manual) | 자동 등록 vs 수동 |
| source_application_id | uuid nullable | 공고 자동 등록 시 출처 |
| assigned_at | timestamptz DEFAULT now() | |

`(tournament_id, staff_id)` 유니크.

### 4.6 `tournament_clock` (서버 동기 타이머)
`tournament_id uuid PK FK, current_level int DEFAULT 0, level_started_at timestamptz, is_running bool DEFAULT false, paused_remaining_sec int nullable` — 원본의 클라 전용 타이머 약점 해결.

### 4.7 `tournament_prizes`
`id, tournament_id FK, rank int, amount int nullable, pct numeric nullable, participant_id uuid nullable(파이널 확정 시)` — `(tournament_id, rank)` 유니크.

### RLS 전략
- `owner_id = auth.uid()` 기본 스코프 + 협업자(향후 uniqn collaborator 패턴 재사용).
- 신규 함수/RPC는 `REVOKE FROM anon` 명시(프로젝트 함정 [pitfall_supabase_new_function_anon_default_grant] 준수).
- `tournament_staff.staff_id`로 배정된 딜러는 본인 배정 대회 read 허용(별도 정책).

---

## 5. uniqn 연동 (시너지 핵심)

1. **대회↔공고 연결**: `tournaments.job_posting_id` 설정 시, 해당 대회 공고의 **확정 스태프**(확정 지원/근무 = uniqn의 confirmed application·work_log 경로)를 `tournament_staff(source=job_posting)`로 가져오는 RPC `import_confirmed_staff(tournament_id)`.
2. **수동 풀 선택**: 공고 연결 없이 운영자의 staff 목록에서 직접 추가 → `tournament_staff(source=manual)`.
3. **테이블 배정**: `tournament_tables.assigned_staff_id`는 `tournament_staff`의 dealer 역할 중에서 선택.
4. **재사용**: users·권한(admin>employer>staff)·StaffRole(dealer/floor/serving) 그대로. UserRole(앱권한) ≠ StaffRole(직무) 구분 유지.

---

## 6. 실시간 + 타이머

- **Supabase Realtime** 채널로 `tournament_participants`·`tournament_tables`·`tournament_clock` 구독 → 좌석 점유·칩·상태·블라인드 라이브 반영. (원본 Firestore `onSnapshot` 대체)
- **서버 동기 타이머**: 클럭은 `tournament_clock.level_started_at + blind_levels[current_level].duration_sec`로 서버 기준 산출. 클라는 부드러운 카운트다운만 담당하고, 포커스/재접속 시 서버값으로 재동기화. → 새로고침·멀티디바이스 desync 및 원본 `useChipBalance 무한루프` 클래스 회피.
- 구독 cleanup·의존성을 `tournament_id` 변경에만 한정(무한 재구독 방지).

---

## 7. 이식할 알고리즘 (로직 보존, 데이터레이어만 교체)

원본 `useTableAssignment.ts`(350+줄)의 3종 알고리즘을 순수 함수로 이식 + PG RPC 트랜잭션으로 원자 커밋:

1. **랜덤 리밸런스** — 전체 셔플 → 라운드로빈 분배 → 좌석 셔플. 참가자 > 총좌석이면 에러.
2. **대기 채움** — 대기 참가자를 최소 인원 테이블부터 채움. 빈좌석 ≥ 대기수 검증.
3. **칩 스네이크 드래프트** — active만, 칩 DESC 정렬 → 상/중/하 분류 → 스네이크 분배(테이블 간 인원차 ≤1, 칩 균등). 

- **moveSeat**: 출발 좌석 점유·도착 좌석 빈자리 검증 → 트랜잭션으로 `tables.seats[]` 2건 + participant `table_no/seat_no` 갱신. 대회 간 이동 불가.
- **블라인드 진행**: `setLevel` → clock 갱신. 휴식 레벨(is_break) 처리.
- **다중 문서 갱신은 `runTransaction`/RPC 필수**(CLAUDE.md: 좌석배정·이동·상태변경).

---

## 8. 상금 분배

- `tournament_prizes`에 순위별 상금(고정액 또는 %) 구조 입력.
- 참가자 busted 처리 시 탈락 순위 자동 부여 → 파이널 시 `participant_id` 매핑.
- 산정 로직은 순수 함수(`domains/tournament/prize.ts`) + 단위 테스트. (원본 `PrizeCalculator` 커밋 `00b7f225e` 참고, 코드 미복원분은 신규 구현)

---

## 9. 품질 / 규약 (CLAUDE.md · golden-principles)

- **불변성**: 상태 갱신은 스프레드로 신규 객체.
- **입력 검증**: 모든 사용자 입력 Zod + `z.string().refine(xssValidation)`.
- **에러**: `AppError`(E1~E7), 포괄 try/catch, 사용자 친화 메시지.
- **로깅**: `logger.info()` (앱 런타임 `console.log` 금지).
- **다크모드**: `dark:` 항상.
- **필드명**: camelCase(앱) / snake_case(DB), Repository 경계에서 매핑.
- **파일 크기**: 200~400줄 typical, 함수 <50줄.

---

## 10. 테스트 전략

| 레이어 | 도구 | 대상 |
|---|---|---|
| 도메인 로직 | Jest | 3종 배정·moveSeat·상금 산정·블라인드 진행 (RED→GREEN) |
| DB RLS/RPC | pgTAP | owner 스코프 격리, anon REVOKE, import_confirmed_staff, 좌석 트랜잭션 원자성 |
| 통합 | Jest + Supabase | Repository CRUD |
| E2E | Playwright | 대회 생성→참가자 등록→테이블 배정→블라인드 진행→상금 (웹) |

pgTAP는 SET ROLE 후 테이블 직접접근 → fixture 명시 GRANT 필요(프로젝트 함정 준수). 신규 enum 값(status) 도입 시 read/filter Zod·RLS·통계 reader 전수 갱신.

---

## 11. 마이그레이션 노트 (Firebase → Postgres)

| Firestore | 이슈 | Postgres 경로 |
|---|---|---|
| 서브컬렉션 | 계층 없음 | FK + RLS |
| 역정규화(participant.tournamentId) | ALL-모드 쿼리용 | 유지 + 인덱스 |
| serverTimestamp | — | `now()` 트리거 |
| WriteBatch 원자성 | — | RPC 트랜잭션(BEGIN/COMMIT) |
| onSnapshot | — | Supabase Realtime |
| Table.seats[] 배열 | — | `uuid[]` (필요 시 GIN) |

**참고 커밋**: 참가자 `6fb438c88`, 테이블/배정 `772d27079`, 칩/블라인드/타이머 `3011ba545`, 상금 `00b7f225e`, 히스토리 `ec26cacbc`, 풀스키마 직전 `18ba91113`.

---

## 12. 리스크 / 오픈 이슈

1. **prod DB 공유** — 신규 `tournament_*` 테이블이 uniqn prod에 추가됨. RLS 격리·anon REVOKE 철저, 마이그레이션은 멱등·로컬 검증 후 적용.
2. **번들 분리** — `(ops)` 라우트가 메인 앱 빌드에 섞이지 않도록 variant 플래그·코드 스플릿 검증 필요.
3. **상금/히스토리 원본 미복원** — 상금은 신규 설계로 커버, export는 보류.
4. **Realtime 부하** — 대규모 대회(다테이블) 구독 채널 수·throttle 설계 후속 검토.
5. **타임존/서버 시각** — 클럭 동기는 서버 timestamptz 기준, 클라 시계 신뢰 금지.

---

## 13. 다음 단계

이 설계 승인 후 `writing-plans` 스킬로 슬라이스 1 구현 계획(태스크 분해·순서·검증 게이트)을 작성한다. 후속 슬라이스(매장관리 → 공개포털 → 랭킹/정산/커뮤니티)는 각자 spec→plan 사이클.
