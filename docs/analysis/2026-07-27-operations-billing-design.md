# 운영 과금 설계 (2026-07-27)

> **확정 사항**: 구인구직 = 영구 무료. 매칭 영역에서 과금하는 것은 **긴급공고 1건뿐**.
> **이 문서의 범위**: 그 다음 영역인 **운영(매장 운영 · 대회 운영)** 과금 설계.
> **설계 목표**: 사용자가 요금 안내 페이지를 **스크롤 없이** 이해할 것. 요금제 비교표가 필요하면 실패한 설계다.
> 시장·경쟁 분석 배경은 `2026-07-27-revenue-model-rebuild.md` 참조 (요금 구조는 이 문서가 최신).

---

## 1. 요금표 (전부)

| 무엇을 | 얼마 |
|---|---|
| **구인구직** — 공고 등록·지원자 관리·확정·리뷰·게시판 | **무료** (영구, 무제한) |
| **긴급공고** — 상단 고정 + 타겟 푸시 | **건당 10,000원** |
| **매장 운영** — QR 근태 · 정산 · 근무표 전부 | **월 50,000원** (무제한) |
| **대회 운영** — 등록데스크 · 좌석 · 클럭 · 전광판 · 상금 | **대회 1건당 100,000원** |

*VAT 별도 · 매장 운영 연납 500,000원(2개월 무료) · 매장 운영 첫 30일 무료 · 대회 첫 1건 무료*

**이게 전부다.** 요금제 등급 없음, 사용량 한도 없음, 좌석 추가금 없음, 크레딧 묶음 없음.

---

## 2. 단순함을 만드는 규칙 4개

이 4개를 지키면 과금이 복잡해질 수 없다. 이후 모든 기능 요청은 이 규칙에 비춰 판단한다.

| # | 규칙 | 버리는 것 |
|---|---|---|
| 1 | **요금제는 1개다.** 매장 운영은 켜거나 끈다 | Free/Pro/Business 3단 비교표 |
| 2 | **한도가 없다.** 무제한이므로 사용량을 셀 필요가 없다 | "월 30건까지 무료" · 초과 안내 UX · 카운터 테이블 |
| 3 | **단위는 눈에 보이는 것으로.** 매장 1곳/월, 대회 1건, 긴급공고 1건 | 좌석·건수·용량 등 추상 단위 |
| 4 | **처음은 무료.** 매장 30일, 대회 1건 | 무료 체험 조건·자격 심사 |

> 규칙 2가 가장 중요하다. **한도가 복잡함의 근원**이다. 한도를 없애는 순간 사용량 집계, 초과 시점 판정, 잔여량 표시 UI, 월초 리셋 크론, 초과분 청구 로직이 전부 사라진다. 대신 가격을 한도 없는 값으로 잡으면 된다(월 5만 원은 딜러 4시간 인건비다 — 한도로 아낄 금액이 아니다).

---

## 3. 무료 / 유료 경계

경계를 **기능 단위가 아니라 목적 단위**로 긋는다. 사용자가 외우기 쉽다.

> **"사람 구하는 건 공짜, 사람 굴리는 건 유료."**

| 무료 (영구) | 매장 운영 구독 | 대회 건당 |
|---|---|---|
| 공고 등록·수정·마감 | QR 출퇴근 체크인 | 대회 생성·복제 |
| 지원자 조회·확정·취소 처리 | 근무시간 수정 | 등록데스크·체크인 |
| 리뷰 작성·평판 조회 | 정산 계산·확정 | 테이블/좌석 배정·리드로 |
| 게시판·알림·프로필 | 지점 월정산·역할별 단가표 | 블라인드 클럭 |
| 워크스페이스·협업자 (인원 무제한) | 주간 근무표 편집·직접 배치 | 전광판·플레이어뷰 |
| 대회 **공고** 등록 | 정산 내보내기 | 상금·바운티 계산 |

### 3.1 잠겨도 데이터는 인질이 아니다

미결제 상태에서 막히는 것은 **새로 쓰는 것과 새로 산출하는 것**뿐이다.

| 미결제 시 | 동작 |
|---|---|
| 새 QR 체크인 / 정산 확정 / 근무표 편집 | ❌ 잠금 |
| 지점 월정산 **집계 산출** | ❌ 잠금 |
| 과거 근무 기록·정산 내역 **열람** | ✅ 항상 열림 |
| 내 데이터 내보내기 (`settings/my-data`) | ✅ 항상 열림 |
| 구인구직 전체 | ✅ 정상 작동 |

정산 데이터를 볼모로 잡는 순간 신뢰가 무너진다. 잠금은 "앞으로 못 쓴다"이지 "지난 걸 뺏는다"가 아니다.

---

## 4. 생명주기

상태는 4개, 판정은 **컬럼 하나**로 한다.

```
[운영 기능 첫 사용]
      ↓ 자동 시작 (아무것도 묻지 않음)
   trialing  ── 30일 ──→  [D-7 / D-3 / D-1 알림]
      ↓ 결제                    ↓ 미결제
   active                    past_due (7일 유예, 기능 그대로)
      ↑                          ↓
      └────── 결제 즉시 해제 ──── locked
```

- **판정식은 `valid_until > now()` 단 하나.** 유예기간은 상태 분기로 처리하지 않고 `valid_until`에 +7일을 반영해 넣는다 → 코드에 `if (status === 'past_due')` 같은 분기가 존재하지 않는다.
- `status`는 **화면 표시 전용**. 권한 판정에 절대 쓰지 않는다.
- 대회 패스는 생명주기가 없다. 결제했으면 그 대회는 영구히 열린 상태다.

---

## 5. 데이터 모델 — 테이블 2개, 함수 2개

```sql
-- ① 매장 운영 구독: 워크스페이스당 0 또는 1행
create table public.workspace_subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  status       text not null check (status in ('trialing','active','past_due','locked','canceled')),
  valid_until  timestamptz not null,        -- ★ 권한 판정의 유일한 근거
  billing_key  text,                        -- PortOne 빌링키
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ② 단건 결제: 긴급공고 · 대회 (영수증 겸 이용권)
create table public.purchases (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  kind         text not null check (kind in ('urgent_posting','tournament')),
  target_id    uuid not null,               -- job_postings.id | ops_tournaments.id
  amount_krw   integer not null,            -- 0 = 무료 제공분
  status       text not null check (status in ('paid','refunded')),
  paid_at      timestamptz not null default now(),
  unique (kind, target_id)                  -- 같은 대상 중복 결제 불가
);
```

```sql
-- 매장 운영 열림 여부
create function public.has_operations(p_workspace uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.workspace_subscriptions
    where workspace_id = p_workspace and valid_until > now()
  );
$$;

-- 단건 이용권 보유 여부
create function public.is_purchased(p_kind text, p_target uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.purchases
    where kind = p_kind and target_id = p_target and status = 'paid'
  );
$$;
```

**요금제 테이블은 만들지 않는다.** 요금제가 1개이므로 가격은 `app_config`의 값 3개(`price.operations_monthly`, `price.urgent_posting`, `price.tournament`)면 충분하다.

**과금 주체는 `workspace`.** `job_postings.workspace_id`가 이미 NOT NULL이라 경계가 스키마상 확정돼 있다. 별도 매장/지점 과금 단위를 만들지 않는다(§8).

---

## 6. 게이트를 걸 지점 (실제 코드 위치)

기존 아키텍처 규칙 그대로 — **쓰기는 전부 SECDEF RPC 경유**이므로, RPC 진입부에 검사 한 줄을 추가하는 것으로 끝난다.

### 매장 운영 (`has_operations(workspace_id)`)

| 대상 | 지점 |
|---|---|
| QR 출퇴근 | `process_qr_checkin_atomically` |
| 근무표 직접 배치 | `add_direct_staff` · `remove_direct_staff` · `set_venue_soft_target` |
| 역할별 단가표 | `set_venue_role_salary` |
| 지점 월정산 산출 | `get_venue_grid_summary` · `get_venue_day_slots` |
| 정산 확정·시간 수정 | `src/services/work/settlement/settlementMutation.ts` — `updateSettlementStatus` / `updateWorkTimeForSettlement` / `updateWorkLogCustomSettlement` 대응 쓰기 경로 |

### 긴급공고 (`is_purchased('urgent_posting', posting_id)`)

- 지점: 공고 **발행 시점** (`src/repositories/supabase/JobPostingRepository.ts:616` insert 경로 — `posting_type='urgent'`인 경우)
- 흐름: 작성 → 저장(draft, 무료) → **발행 시 결제** → open
- 결제 전에는 draft로 보존되므로 작성 내용이 날아가지 않는다
- **미충원 시 자동 환불**: 마감 시각까지 확정 인원 0명이면 `purchases.status='refunded'` + 환불. 성과 보증이 첫 구매 저항을 크게 낮춘다

### 대회 운영 (`is_purchased('tournament', tournament_id)`)

- 지점: `ops_create_tournament` · `ops_duplicate_tournament`
- 대회 **공고**(스태프 모집)는 무료다. 과금은 **운영 엔진을 켤 때**만
- 결제 실패 시 대회 행 자체를 만들지 않는다(고아 데이터 방지)

### 검사 실패 시 에러

`AppError` E6(비즈니스) 계열 신규 코드 1개(`PAYMENT_REQUIRED`)를 추가하고, 클라이언트는 이 코드를 받으면 결제 안내 시트를 띄운다. **화면마다 개별 분기하지 않는다.**

---

## 7. 결제 수단

- **PortOne 빌링키** — 본인인증으로 이미 연동된 벤더라 추가 통합 비용이 최소다
- 카드 1회 등록 → 매장 운영은 매월 자동 청구, 긴급공고·대회는 원클릭
- 세금계산서 자동 발행 (사업자 대상 필수)

### 앱스토어 IAP 판단 — 앞선 문서 정정

이전 분석에서 "모든 결제는 웹 전용"이라고 했는데, 이는 과하게 보수적이었다. 구인 광고·오프라인 인력 운영 서비스 요금은 디지털 재화가 아니어서 IAP 대상으로 보기 어렵고, 실제로 알바몬·잡코리아 앱은 앱 내에서 유료공고를 PG 결제한다.

다만 심사 판단은 케이스별로 갈릴 수 있으므로:

1. **1차 출시**: 웹 결제 + 앱은 상태 표시·안내만 (확실히 안전)
2. **2차**: 앱 내 PG 결제를 심사 문의 후 도입 — 긴급공고는 "당장 사람이 없는 순간"에 사는 상품이라 웹 이동 마찰이 전환율을 직접 깎는다. 이 마찰 제거의 가치가 크다

---

## 8. 의도적으로 만들지 않는 것

기능 요청이 들어와도 아래는 기각한다. 근거로 이 절을 인용한다.

| 요청 | 기각 사유 |
|---|---|
| 사용량 한도 / 초과 과금 | 규칙 2 위반. 카운팅·리셋·초과 UI가 전부 따라붙는다 |
| 좌석(멤버)당 과금 | 협업자 초대를 억제해 제품 활성도를 떨어뜨린다. 멤버는 무제한 |
| 요금제 3단계 | 규칙 1 위반. 사용자가 비교표를 읽어야 하는 순간 진다 |
| 크레딧 선불 충전·묶음 할인 | 잔액 개념 = 또 하나의 통화. 지갑을 걷어낸 이력이 있다 |
| 지점별·다지점 번들 할인 | 과금 단위가 workspace 하나로 유지되어야 판정이 한 줄로 끝난다 |
| 기능별 개별 판매 (근태만, 정산만) | 조합 폭발. 매장 운영은 하나의 묶음 |

---

## 9. 기존 사용자 이행 (v1.0.5 배포 중)

복잡한 grandfathering 규칙을 두지 않는다.

- 시행일에 **모든 기존 워크스페이스에 90일 무료 부여** (`valid_until = 시행일 + 90일`, `status='trialing'`)
- 시행 **60일 전 공지** → 30일 / 7일 / 1일 알림
- 별도 예외·특례 없음. 90일 후 전원 동일 규칙

---

## 10. 롤아웃 순서

| 단계 | 내용 | 비고 |
|---|---|---|
| 1 | 테이블 2개 + 함수 2개 배포 | 전 워크스페이스 `valid_until` 미래값 → **아무도 잠기지 않음**. 무해한 선반영 |
| 2 | 게이트 검사 코드 삽입 | 여전히 전원 통과. 회귀 테스트만 확인 |
| 3 | PortOne 빌링키 + 결제 페이지 | |
| 4 | **긴급공고 건당 과금 오픈** | 가장 단순·저가·즉시 검증. 지불의사 실측 |
| 5 | 매장 운영 구독 오픈 | 4에서 결제 경험을 쌓은 뒤 |
| 6 | 대회 운영 건당 오픈 | 대회 시즌에 맞춰 |

**1~2단계는 기능 변화가 0**이라 언제 배포해도 안전하다. 여기부터 시작하면 된다.

---

## 11. 매출 재추정 (본 요금표 기준)

| 항목 | 12개월차 | 24개월차 |
|---|---|---|
| 매장 운영 (5만 원) | 105곳 → 525만 | 250곳 → 1,250만 |
| 긴급공고 (1만 원) | 250건 → 250만 | 600건 → 600만 |
| 대회 운영 (10만 원) | 15건 → 150만 | 30건 → 300만 |
| **MRR** | **약 925만 원** | **약 2,150만 원** |

- 유료 매장 ARPU ≈ 월 70,000원 (구독 5만 + 긴급공고 평균 2건)
- 월 이탈률 3% → LTV 약 185만 원, CAC 10~30만 원 → **LTV/CAC 6~18**
- 손익분기(고정비 월 500만 원): **매장 운영 100곳** 또는 혼합 기준 12개월차 전후

앞선 분석 대비 MRR이 약 14% 낮지만, 가격을 외울 수 있게 만든 대가로 타당한 교환이다. 한도·좌석·티어를 유지했을 때 발생할 구현·CS·이탈 비용이 그 차이보다 크다.
