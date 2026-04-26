# Monetization Model Comparison — Consumable vs Subscription

- 작성일: 2026-04-26
- 브랜치: `design/monetization-subscription`
- 대응 spec:
  - Track A (Consumable): `2026-04-26-monetization-design.md` (Locked)
  - Track B (Subscription): `2026-04-26-monetization-subscription-design.md` (Auto-mode draft)
- 목적: 두 수익 모델의 11개 축 비교 + 수치 시뮬레이션 + UNIQN 단계별 추천

---

## 0. TL;DR

| | Track A (Consumable) | Track B (Subscription) |
|---|---|---|
| **한 줄 요약** | 다이아 충전 + 공고당 차감 | 월 정액 + quota 내 무제한 |
| **MRR 1,000명 가정** | ~705,000원/월 (BUSINESS_PLAN) | ~1,950,000원/월 (5% 전환 가정) |
| **예측 가능성** | 낮음 (사용량 의존) | 높음 (정액) |
| **진입 장벽** | 낮음 (₩1,000~) | 높음 (월 ₩39,000~) |
| **구현 복잡도** | 높음 (ledger + idempotency + lot) | 중간 (entitlement only) |
| **한국 시장 fit** | ★★★★ (마이크로페이먼트 익숙) | ★★★ (구독 학습 중) |
| **B2B 영업 fit** | ★★ (단가 낮음) | ★★★★★ (Enterprise tier) |

**추천 결론** (§13 상세): **6개월 Consumable → Year 2부터 Subscription 옵션 추가 (Hybrid)**.

---

## 1. 11개 축 상세 비교

### 1.1 수익 모델 구조

| 축 | Track A | Track B |
|---|---|---|
| 과금 방식 | 다이아 사전 충전 + 공고당 차감 | 월/연 정액 자동 결제 |
| 과금 단위 | 행위 (post/extend/upgrade) | 시간 (기간) |
| 가격 단가 | 1💎=₩300, 공고당 1~10💎 | 월 ₩39k/99k/299k |

### 1.2 예측 가능성

| 축 | Track A | Track B |
|---|---|---|
| 매출 예측성 | 낮음 — 사용량 변동 큼 | 높음 — MRR 산식 명확 |
| Cohort 분석 | 충전 빈도 분포 분석 필요 | tier mix만 보면 끝 |
| 투자자/대출 fit | 약함 | 강함 (SaaS 평가배수 6~10x ARR) |

**시뮬레이션 (Year 1 사용자 1,000명 기준)**:

| 모델 | 핵심 변수 | M+6 MRR 시나리오 |
|---|---|---|
| Track A | 결제자 30%, ARPPU 5,000원 | 1,000 × 0.30 × 5,000 = **1,500,000원** (낙관) |
| Track A | 결제자 10%, ARPPU 7,000원 | 1,000 × 0.10 × 7,000 = **700,000원** (현실적) |
| Track B | 전환율 5%, 평균 plan ₩78k | 1,000 × 0.05 × 78,000 = **3,900,000원** (낙관) |
| Track B | 전환율 2%, 평균 plan ₩50k | 1,000 × 0.02 × 50,000 = **1,000,000원** (현실적) |

**해석**: Subscription은 전환율이 낮아도 객단가가 높아 ceiling이 높음. 하지만 전환율 2% 미달 시 Consumable에 패배.

### 1.3 LTV (Lifetime Value)

| 축 | Track A | Track B |
|---|---|---|
| LTV 산식 | ARPPU × 평균 활성 개월 | ARPU × (1 / churn_rate) |
| 예시 (현실적) | 7,000원 × 8개월 = **56,000원** | 50,000원 × (1/0.08) = **625,000원** |
| 변동 요인 | 충전 주기 변동 큼 | churn rate 안정적 |

**Track B 압승 — 단, churn 8% 가정이 깨지면 무너짐 (한국 SaaS 평균 5~12%)**.

### 1.4 진입 장벽

| 축 | Track A | Track B |
|---|---|---|
| 첫 결제 | ₩1,000 | ₩39,000 (또는 14일 trial) |
| 의사결정 부담 | 낮음 (탭 한 번) | 높음 (월 약정 인지) |
| Free → Paid 전환율 | 30~40% (예상) | 3~7% (한국 SaaS 평균) |

**해석**: Track A는 "한 번 써본다"가 쉽지만, "지속 충전"이 어려움. Track B는 첫 결제 어렵지만 retention 자동.

### 1.5 이탈 (Churn) Dynamics

| 축 | Track A | Track B |
|---|---|---|
| 이탈 형태 | 자연 이탈 (안 쓰면 끝) | 명시적 cancel + 자동 갱신 |
| 이탈 측정 | 모호 (n개월 미사용 정의) | 명확 (status='expired') |
| 재활성화 | 충전만 다시 하면 됨 | re-subscribe (UX friction) |
| 한국 정서 | 거부감 적음 | "자동결제 무서움" 정서 존재 |

### 1.6 App Store / Google Play 수수료

| 축 | Track A | Track B |
|---|---|---|
| 수수료 (Year 1) | **30%** (consumable IAP) | **30%** (첫 1년 구독) |
| 수수료 (Year 2+) | **30%** 동일 | **15%** (1년차 후 자동 인하) |
| Small Business | 매출 1억 이하 시 15% | 매출 1억 이하 시 15% |
| 현실 적용 | UNIQN 매출 1억 이하 → 15% | UNIQN 매출 1억 이하 → 15% |

**핵심**: 앱스토어 수수료는 1억 이하 small biz program에서 둘 다 15%. 차이는 Year 2+에서 Track B만 자동 인하 (large biz로 진입 시).

### 1.7 한국 시장 적합성

| 축 | Track A | Track B |
|---|---|---|
| 사용자 학습도 | ★★★★★ (게임 코인 익숙) | ★★★ (넷플릭스/유튜브로 학습 중) |
| B2B 사업자 친화도 | ★★ (충전 영수증 처리 번거로움) | ★★★★★ (정액 인보이스 가능) |
| 자동결제 수용도 | N/A | ★★★ (개인사업자 거부감 존재) |
| Tax 처리 | 매번 영수증 발행 부담 | 월 1회 인보이스로 단순 |

### 1.8 구현 복잡도

| 축 | Track A | Track B |
|---|---|---|
| 마이그레이션 수 | 9개 | 6개 |
| RPC 수 | 4개 (consume/credit/grant/refund) | 3개 (sync/check_quota/get_entitlement) |
| Trigger 수 | 2개 (cache sync + lot consume) | 0개 (단순 UPDATE로 충분) |
| pg_cron 작업 | 매일 만료 처리 | 거의 없음 (RC가 처리) |
| 멱등성 키 | `revenuecat_transaction_id` | `revenuecat_event_id` |
| 시간 복잡도 | O(n) lot 순회 | O(1) row UPDATE |
| 코드 LOC 추정 | ~2,500 (RN+SQL) | ~1,500 (RN+SQL) |

**Track B가 약 40% 코드량 적음**.

### 1.9 환불 처리

| 축 | Track A | Track B |
|---|---|---|
| 정책 | 24h 100% / 이후 50% (custom) | RC + 스토어 정책 자동 |
| 처리 흐름 | webhook → 음수 ledger row + cache 0 floor | webhook → status=expired |
| 남은 가치 | 다이아 잔액 → 0 floor 처리 복잡 | period_end까지 사용 가능 (annual 일할 X) |
| 분쟁 가능성 | "공고 작성 후 환불 어뷰징" | "annual cancel 즉시 환불 분쟁" |

### 1.10 Upgrade/Downgrade

| 축 | Track A | Track B |
|---|---|---|
| Upgrade 개념 | 일반→긴급 전환만 (10💎 차감) | Basic→Pro 즉시, proration 자동 |
| Downgrade 개념 | 없음 | 다음 period부터 적용 |
| Plan 변경 UX | 패키지 단위 충전만 | 4 tier 카드, 1탭으로 변경 |
| 매출 영향 | upsell 미약 | upsell 강력 (quota 초과 paywall이 자연 유도) |

### 1.11 영업 fit

| 축 | Track A | Track B |
|---|---|---|
| 마케팅 fit | B2C 광고 (전환 funnel) | B2B SaaS 영업 |
| Inbound | 광고 → 첫 충전 ₩1,000 | 광고 → trial → 결제 |
| Outbound (대형 매장) | 약함 | Enterprise tier 직접 영업 |
| Reference 판매 | 약함 (단가 낮음) | 강함 (월 ₩299k 인보이스) |

---

## 2. 수치 시뮬레이션 (사용자 1,000명 기준)

### 2.1 Track A — Year 1

```
사용자 1,000명 (구인자 100명 + 스태프 900명)
구인자 100명 중 결제자: 30명 (30%)
ARPPU: 5,000원/월
MRR: 30 × 5,000 = 150,000원
ARR: 1,800,000원
LTV: 5,000 × 8 = 40,000원
CAC 가정: 10,000원 → CAC payback 2개월
```

### 2.2 Track B — Year 1

```
사용자 1,000명 (구인자 100명 + 스태프 900명)
구인자 100명 중 결제자: 5명 (5%)
Plan mix: Basic 60% / Pro 30% / Enterprise 10%
평균 plan 가격: 39k×0.6 + 99k×0.3 + 299k×0.1 = 83,000원
MRR: 5 × 83,000 = 415,000원
ARR: 4,980,000원
LTV: 83,000 × (1/0.10 churn) = 830,000원
CAC 가정: 50,000원 (B2B 광고 비쌈) → CAC payback 0.6개월
```

### 2.3 비교 결론 (Year 1)

| 지표 | Track A | Track B | 차이 |
|---|---|---|---|
| MRR | 150,000원 | 415,000원 | **B 2.8배** |
| ARR | 1.8M | 5.0M | **B 2.8배** |
| LTV | 40k | 830k | **B 21배** |
| 결제자 수 | 30 | 5 | A 6배 |
| 진입 어려움 | 낮음 | 높음 | A 우위 |

**해석**:
- Track B는 결제자가 6분의 1이지만 MRR/LTV는 압도적으로 큼.
- Track B는 결제자 5명 확보가 Track A 30명 확보보다 어려움 (B2B 영업 코스트).
- **초기 5명 확보 실패 시 매출 0**. Track A는 30명 → 10명만 돼도 매출 일부 발생.

### 2.4 Year 2 (사용자 5,000명) — 성숙기

```
Track A:
구인자 500 × 30% × 7,000원 = 1,050,000원/월 → ARR 12.6M

Track B:
구인자 500 × 5% × 100,000원 = 2,500,000원/월 → ARR 30M

격차: B가 2.4배
```

---

## 3. 하이브리드 옵션 검토

### 3.1 모델

```
┌──────────────────────────────────────────────────────────┐
│  Hybrid: Subscription + Consumable                        │
├──────────────────────────────────────────────────────────┤
│  Free tier:    quota 3건/월, 추가는 다이아 충전           │
│  Basic tier:   quota 20건/월, 초과는 다이아 충전          │
│  Pro tier:     quota 100건/월, 초과는 다이아 충전         │
│  Enterprise:   무제한                                     │
└──────────────────────────────────────────────────────────┘
```

### 3.2 장단점

**장점**:
- Free 사용자도 다이아로 즉시 결제 가능 → conversion 갭 메움
- 구독자도 긴급공고 추가 시 다이아로 보강 가능
- Track A + B의 인프라 모두 보유 → 유연성 최대

**단점**:
- 코드량 ~4,000 LOC (단일 모델 대비 60% 증가)
- 두 RPC 흐름 동시 유지 (consume + check_quota)
- UX 복잡도: 사용자가 quota 초과 시 "구독 업그레이드 vs 다이아 충전" 둘 중 선택 → decision fatigue
- 회계 처리 복잡 (consumable IAP + 구독 IAP 분리 reporting)

### 3.3 시퀀싱 권장안

```
Phase 1 (M+0 ~ M+6): Track A only
  → 6개월 PMF 검증, 사용 패턴 데이터 수집
  → 질문: "사용자가 기꺼이 충전하는가?"

Phase 2 (M+7 ~ M+12): Track A + Soft Subscription
  → 데이터 기반 결정: heavy user (월 충전 5만+ 인 사용자)에게만 Pro 제안
  → "월 99k로 충전 무제한" upsell
  → 코드: subscription 테이블 추가, check_quota는 미적용

Phase 3 (M+13 ~): Hybrid 또는 Subscription Pivot
  → Phase 2에서 Subscription 전환 5% 이상이면 Hybrid 정착
  → 미달 시 Subscription 폐기, Track A에 집중
```

---

## 4. 의사결정 매트릭스

### 4.1 단계별 권장 모델

| UNIQN 단계 | 사용자 규모 | 추천 모델 | 근거 |
|---|---|---|---|
| Pre-launch (현재) | 0 | **결정 보류** | 둘 다 결제 0% 코드 → 구현 비용만 비교 |
| Soft launch | 0~500 | **Track A** | 진입 장벽 낮춰 사용 패턴 학습 |
| MVP (M+1~3) | 500~1,500 | **Track A** | 충전 funnel 데이터로 가격 탄력성 확인 |
| Growth (M+4~6) | 1,500~3,000 | **Track A + Soft Sub** | heavy user에게 구독 제안 (수동 영업) |
| Scale (M+7~12) | 3,000~5,000 | **Hybrid 결정** | Track B 전환 데이터 기반 판단 |
| Enterprise | 5,000+ | **Hybrid 또는 Sub** | B2B 영업 본격화, large account 인보이스 |

### 4.2 시그널 기반 Pivot 트리거

**Track A → Hybrid로 이동 시그널**:
- 월 충전 5만원 이상 사용자 비율 ≥ 10%
- 평균 충전 주기 ≤ 14일
- 구인자 NPS에서 "정액제 원함" 응답 ≥ 30%

**Track A → Track B 완전 Pivot 시그널** (드물게):
- B2B 대형 매장 (10개 이상 체인) 단일 계약 요청 발생
- 충전 abandonment > 60% (결제 의향 있지만 단가 부담)

### 4.3 Pivot 비용 추정

| Pivot 방향 | 코드 변경 | 데이터 마이그레이션 | 사용자 커뮤니케이션 |
|---|---|---|---|
| A → B 완전 전환 | 9개 마이그 revert + 6개 신규 ≈ 3주 | wallet 잔액 → 환불 또는 grandfather | 약관 개정 + 30일 고지 |
| A → Hybrid (B 추가) | 6개 마이그 추가만, A 코드 유지 ≈ 2주 | 마이그레이션 없음 (병행) | "신규 옵션 추가" 가벼운 공지 |
| B → A 완전 전환 | 6개 마이그 revert + 9개 신규 ≈ 3주 | 미사용 quota → 다이아로 환산 (정책 결정) | 약관 개정 + 30일 고지 |

**Hybrid 추가가 가장 저렴**. Track A 보존 + Track B 옵트인 형태.

---

## 5. 추천 결론 (CEO 모드)

### 5.1 결론

> **6개월 Track A로 시작 → 데이터 기반 Hybrid 결정**

### 5.2 근거

1. **데이터 부재**: UNIQN은 결제 코드 0%, 결제 사용자 0명. 가격 탄력성/사용 빈도 데이터 없음. **Subscription을 처음부터 도입하는 건 가설을 두 배로 거는 것**.
2. **진입 장벽**: 한국 포커펍 운영자 평균은 1~5인 소상공인. 월 ₩39k는 첫 약정으로 부담. ₩1,000 충전은 부담 없음.
3. **Pivot 비용**: A → Hybrid는 가장 저렴 (+2주). A → B 완전 전환은 3주 + 사용자 마이그레이션 리스크.
4. **앱스토어 수수료**: small biz 1억 이하면 둘 다 15%. 차이 무시 가능.
5. **Track A spec 완성도**: 이미 11개 결정 lock + 5개 마이그레이션 적용 진행 중. 매몰비용은 아니지만 momentum 활용 가치.
6. **B2B Enterprise는 별도 트랙**: 대형 매장 (10+ 체인) 영업은 Track B와 무관하게 자체 인보이스로 가능. SaaS plan 등록 전에 영업 검증 가능.

### 5.3 단점 인지 + 대응

| 단점 | 대응 |
|---|---|
| MRR 예측성 낮음 | M+3부터 충전 패턴 분석 dashboard |
| 투자자 어필 약함 | "PMF 검증 후 SaaS pivot 옵션" 스토리 |
| Heavy user upsell 한계 | M+4부터 수동 Pro 제안 (Slack DM 영업) |

### 5.4 대안 시나리오 (만약 Subscription을 먼저 한다면)

다음 조건이 모두 맞으면 Track B 우선:
- 출시 전 B2B LOI (Letter of Intent) 5건 이상 확보
- Enterprise 대상 영업 인력 1명 이상 풀타임 배치
- Year 1 매출 목표 ≥ 5,000만원 (투자자 압박)

→ 현재 UNIQN에 해당 안 됨 → **Track A 유지 권장**.

---

## 6. 결과물 매트릭스

| 산출물 | 위치 | 상태 |
|---|---|---|
| Track A spec | `2026-04-26-monetization-design.md` | Locked, 5개 마이그레이션 적용됨 |
| Track B spec | `2026-04-26-monetization-subscription-design.md` | Auto-mode draft, 사용자 검토 대기 |
| 비교 문서 (본 문서) | `2026-04-26-monetization-comparison.md` | 작성 완료 |
| 추천 | **Track A 유지 + M+6 hybrid 평가** | 본 문서 §5 |
| 새 브랜치 | `design/monetization-subscription` | 생성됨 |

---

## 7. Open Questions (의사결정 필요)

| # | 질문 | 추천 답변 (auto-mode) |
|---|---|---|
| Q1 | 본 비교 결과 채택? | **Track A 유지 + Hybrid 옵션 보존** |
| Q2 | Track B spec은 보관? 폐기? | **보관** (Phase 2/3 평가 시 재활용) |
| Q3 | Hybrid 평가 시점? | **M+6 (사업계획 부분 유료화 시점)** |
| Q4 | B2B Enterprise 영업은? | **Track A와 별도, 자체 인보이스 시작** |
| Q5 | 이 브랜치는 머지? | **머지하지 않음, spec 보존용** (또는 docs만 master로 별도 PR) |

---

*비교 종료 — 사용자 검토 대기.*
