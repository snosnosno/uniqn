# Monetization Model Comparison — Consumable vs Subscription (v2)

- 작성일: 2026-04-26 (v2: 가격 1/10 + 한국 구인구직 모델 차용 반영)
- 브랜치: `design/monetization-subscription`
- 대응 spec:
  - Track A (Consumable): `2026-04-26-monetization-design.md` (Locked)
  - Track B (Subscription v2): `2026-04-26-monetization-subscription-design.md` (Auto-mode draft)
- 목적: 두 모델의 11개 축 비교 + 수치 시뮬레이션 + UNIQN 단계별 추천

---

## 0. TL;DR (v2)

| | Track A (Consumable) | Track B v2 (Subscription) |
|---|---|---|
| **한 줄 요약** | 다이아 충전 + 공고당 차감 | 저가 월정액 + 노출/검색/매칭 차등 |
| **첫 결제 단가** | ₩1,000 | ₩3,900 (또는 14일 trial) |
| **Tier 단가** | 1💎=₩300 | ₩3.9k / ₩9.9k / ₩29.9k |
| **공고 등록** | 1~10💎 차감 | **모든 tier 무제한 (Free 포함)** |
| **MRR (1,000명, 현실적)** | ~150,000원/월 | ~80,000원/월 |
| **MRR (1,000명, 낙관)** | ~700,000원/월 | ~150,000원/월 |
| **Year 2 MRR (5,000명)** | ~1,050,000원/월 | ~400,000원/월 |
| **예측 가능성** | 낮음 | 높음 |
| **진입 장벽** | ★★★★★ 낮음 | ★★★★ 낮음 (v1 대비 크게 개선) |
| **구현 복잡도** | 9개 마이그 / 높음 | 6개 마이그 / 중간 |
| **한국 시장 fit** | ★★★★ (게임 코인 익숙) | ★★★★★ (알바몬/잡코리아 패턴) |
| **참조 모델** | 게임 IAP | 알바몬 / 잡코리아 / 사람인 |

**v2 추천 결론** (§13 상세): **Track A로 출시 → M+3 시점에 Track B v2 paywall 옵션 추가 (early hybrid)**.
v1 대비 Track B 가격 매력이 크게 올라 hybrid 진입 시점을 6개월 → 3개월로 앞당김.

---

## 1. 11개 축 상세 비교 (v2)

### 1.1 수익 모델 구조

| 축 | Track A | Track B v2 |
|---|---|---|
| 과금 방식 | 다이아 사전 충전 + 공고당 차감 | 월/연 정액 자동 결제 |
| 과금 단위 | 행위 (post/extend/upgrade) | 시간 (기간) + 부가 카운터 (outreach) |
| 가격 단가 | 1💎=₩300, 공고당 1~10💎 | 월 ₩3.9k/9.9k/29.9k |
| **공고 등록** | 차감 발생 | **모든 tier 무제한 (Free 포함)** |
| **차등 영역** | 공고 타입 (긴급/고정 차감 큼) | 노출 위치 + 인재 검색 + 면접 제안 + 분석 |

### 1.2 예측 가능성 (변경 없음)

| 축 | Track A | Track B v2 |
|---|---|---|
| 매출 예측성 | 낮음 | 높음 (MRR 산식 명확) |
| Cohort 분석 | 충전 빈도 분포 | tier mix |
| 투자자 fit | 약함 | 강함 (단, 저가라 ARR 절댓값 낮음) |

### 1.3 LTV (1/10 가격 반영)

| 축 | Track A | Track B v2 |
|---|---|---|
| LTV 산식 | ARPPU × 평균 활성 개월 | ARPU × (1 / churn_rate) |
| 예시 (현실적) | 7,000원 × 8개월 = **56,000원** | 9,900원 × (1/0.10) = **99,000원** |
| 예시 (낙관) | 10,000원 × 12개월 = **120,000원** | 9,900원 × (1/0.06) = **165,000원** |

**해석**: v1에선 Track B LTV가 Track A의 11배였지만, v2는 약 2배. 가격 1/10으로 Track B의 매출 강점이 크게 줄어듦.

### 1.4 진입 장벽 (v2 핵심 변화)

| 축 | Track A | Track B v1 (39k+) | Track B v2 (3.9k+) |
|---|---|---|---|
| 첫 결제 | ₩1,000 | ₩39,000 (월) | ₩3,900 (월) |
| 의사결정 부담 | 매우 낮음 | 높음 | **낮음** |
| 한국 영세 사업자 부담 | 거의 없음 | 부담 | **거의 없음** |
| Free → Paid 전환율 | 30~40% | 3~7% | **8~15%** |

**v2 의의**: Track B 진입 장벽이 Track A 수준으로 떨어짐. "월 ₩3,900 = 커피 한 잔보다 싸다" 마케팅 가능.

### 1.5 이탈 (Churn) Dynamics

| 축 | Track A | Track B v2 |
|---|---|---|
| 이탈 형태 | 자연 이탈 | 명시적 cancel (자동 갱신) |
| 한국 정서 | 거부감 적음 | 자동결제 거부감 존재 (v1과 동일) |
| 저가의 효과 | N/A | 부담 작아 자동결제 수용도 ↑ |

### 1.6 App Store / Google Play 수수료 (변경 없음)

둘 다 small biz 1억 이하 → **15%**.

### 1.7 한국 시장 적합성 (v2 강화)

| 축 | Track A | Track B v2 |
|---|---|---|
| 사용자 학습도 | ★★★★★ (게임 코인) | **★★★★★ (알바몬/잡코리아 패턴 친숙)** |
| B2B 사업자 친화도 | ★★ (영수증 매번) | ★★★★★ (월 인보이스) |
| 자동결제 수용도 | N/A | ★★★★ (저가는 수용 ↑) |
| 영세 사업자 부담 | 매우 낮음 | **낮음** (v2 핵심 개선) |

### 1.8 구현 복잡도

| 축 | Track A | Track B v2 |
|---|---|---|
| 마이그레이션 수 | 9 | 6 |
| RPC 수 | 4 (consume/credit/grant/refund) | 4 (sync/check_access/check_increment/get_active) |
| Trigger 수 | 2 | 0 |
| pg_cron 작업 | 매일 만료 | 월 1회 archive |
| 멱등성 키 | revenuecat_transaction_id | revenuecat_event_id |
| 코드 LOC 추정 | ~2,500 | ~1,800 (v1 1,500 + 10-feature 매트릭스) |

### 1.9 환불 처리 (변경 없음)

| 축 | Track A | Track B v2 |
|---|---|---|
| 정책 | 24h 100% / 이후 50% | RC + 스토어 표준 |
| 분쟁 가능성 | 충전 후 환불 어뷰징 | annual cancel 일할 분쟁 (저가라 영향 ↓) |

### 1.10 Upgrade/Downgrade

| 축 | Track A | Track B v2 |
|---|---|---|
| Upgrade | 일반→긴급 (10💎) | Basic→Pro 즉시 (proration RC 자동) |
| Plan 변경 UX | 충전 패키지 변경 | 4 tier 카드 1탭 |
| Upsell 자연 유도 | 약함 | **강함** (Pro 면접 제안 quota 도달 시 paywall) |

### 1.11 영업 fit (v2 강화)

| 축 | Track A | Track B v2 |
|---|---|---|
| 마케팅 fit | B2C 광고 (충전 funnel) | B2B SaaS + B2C ("월 ₩3,900") |
| Inbound | 광고 → 충전 ₩1k | 광고 → 14일 trial → ₩3.9k |
| Outbound | 약함 | **Enterprise ₩29.9k 직접 영업 가능** |
| Reference 판매 | 약함 | **저가라 reference 확보 쉬움** |

---

## 2. 수치 시뮬레이션 (사용자 1,000명, v2 가격)

### 2.1 Track A — Year 1 (변경 없음)

```
구인자 100명 × 결제자 30% × ARPPU 5,000원/월
MRR = 150,000원, ARR = 1.8M, LTV = 40k
```

### 2.2 Track B v2 — Year 1

```
구인자 100명 × 결제자 8% (저가 진입장벽 낮음, v1 5% 대비 1.6배)
Plan mix: Basic 50% / Pro 35% / Enterprise 15%
평균 plan 가격: 3,900×0.5 + 9,900×0.35 + 29,900×0.15 = 9,900원/월

MRR = 100 × 0.08 × 9,900 = 79,200원/월
ARR = 950,400원
LTV = 9,900 × (1/0.10 churn) = 99,000원
```

### 2.3 비교 결론 (Year 1, 1,000명, v2)

| 지표 | Track A | Track B v2 | v1 Track B 대비 변화 |
|---|---|---|---|
| MRR | 150,000원 | **79,200원** | v1 415k → v2 79k (1/5로 줄음) |
| ARR | 1.8M | 0.95M | 동일 비율 |
| LTV | 40k | **99k** | v1 830k → v2 99k (1/8로 줄음) |
| 결제자 수 | 30 | **8** | v1 5명 → v2 8명 (1.6배) |
| Free→Paid 전환 | 30% | 8% | v1 5% → v2 8% |
| 진입 장벽 | 매우 낮음 | **낮음** | v1 높음 → v2 낮음 |

**v2 핵심 변화**:
- Track B 매출 ceiling이 Track A 아래로 떨어짐
- 단, LTV는 여전히 Track B가 2배 이상 우위
- 진입 장벽 차이가 극적으로 줄어 user acquisition은 비슷
- **결론: 두 모델 모두 매출 가설로 진지하게 검토 가능**

### 2.4 Year 2 (사용자 5,000명)

```
Track A:
구인자 500 × 30% × 7,000원 = 1,050,000원/월 → ARR 12.6M

Track B v2:
구인자 500 × 8% × 9,900원 = 396,000원/월 → ARR 4.7M
```

**격차**: Track A가 v2 Track B의 약 2.6배.

**Year 2 시점 trade-off**:
- Track A: 매출 우위, 사용자당 평균 7,000원/월 충전 빈도 의존
- Track B v2: 안정적 MRR, 단 ceiling 낮음. Enterprise 영업으로 보강 필요

### 2.5 Hybrid 시뮬레이션 (Track A 기본 + Track B 옵션)

```
사용자 1,000명 시나리오:
- Track A 베이스: 100 × 30% × 5,000 = 150,000원/월
- 추가 Track B v2: 100 × 5% × 9,900 = 49,500원/월 (heavy user 자발 전환)
- Hybrid MRR = 199,500원/월 (단일 Track A 대비 33% ↑)

Year 2 5,000명:
- Track A: 1,050,000원
- + Track B v2 추가: 250,000원 (5% 추가 전환)
- Hybrid Year 2 MRR = 1,300,000원/월 (단일 대비 24% ↑)
```

**Hybrid 의의**: 두 모델 합쳐서 매출이 한쪽만보다 크고, 사용자 선택권 확장.

---

## 3. 하이브리드 옵션 (v2 재검토)

### 3.1 v2 가격 변경의 hybrid 영향

v1에선 hybrid가 코드 복잡도 60% 증가 부담. v2에선:
- Track B 코드량 ~1,800 LOC
- Hybrid = Track A + Track B = ~4,300 LOC
- 단, **Track B v2 가격이 친화적이라 사용자 friction 작음**
- 결제 UX 통합: "Free 사용자 화면에 [충전] + [구독] 두 CTA"

### 3.2 시퀀싱 권장안 (v2)

```
Phase 1 (M+0~M+2): Track A only
  → 충전 진입 + 사용 패턴 학습 (3개월로 단축, v1 6개월 → v2 3개월)

Phase 2 (M+3~M+6): Track A + Track B v2 (Soft hybrid)
  → 노출/검색 paywall은 Track B v2 구독으로
  → 공고 차감은 Track A 충전 유지
  → "월 ₩3,900으로 강조 표시 무제한" upsell

Phase 3 (M+7~): Hybrid 정착 또는 단일화 결정
  → Track B v2 전환 5% 이상이면 Hybrid 유지
  → 미달이면 Track B 폐기 또는 추가 마케팅
```

**v1 대비 차이**: Phase 2 시작 시점이 6개월 → 3개월로 앞당김. v2 가격이 충분히 낮아 hybrid 도입 부담 적음.

---

## 4. 의사결정 매트릭스 (v2)

### 4.1 단계별 권장 모델

| UNIQN 단계 | 사용자 규모 | 추천 모델 | 근거 |
|---|---|---|---|
| Pre-launch | 0 | **결정 필요** | 본 spec 채택 결정 |
| Soft launch | 0~500 | **Track A** | 충전 패턴 학습, 진입 가장 쉬움 |
| MVP (M+1~M+2) | 500~1,500 | **Track A** | 가격 탄력성 데이터 수집 |
| Growth (M+3~M+6) | 1,500~3,000 | **Hybrid (A + B v2)** | Track B v2 paywall 추가 (v1 6개월 → v2 3개월) |
| Scale (M+7~12) | 3,000~5,000 | **Hybrid 정착** | 두 모델 데이터 비교, 마케팅 강한 쪽 더블다운 |
| Enterprise | 5,000+ | **Hybrid + B2B 영업** | Enterprise tier (₩29.9k) + 직접 영업 |

### 4.2 시그널 기반 Track 선택

**Track A 단일 유지 시그널**:
- 충전 funnel 전환율 50%+ 유지
- 평균 ARPPU ₩7k 이상 안정
- 자동결제 거부감 NPS ≥ -10

**Track B v2 더블다운 시그널**:
- Track B 전환율 10%+ (저가라 가능)
- 충전 abandonment 50%+ (단가 부담)
- B2B 인보이스 요청 분기당 5건 이상

**Hybrid 정착 시그널**:
- 두 모델 모두 MRR 기여 30%+
- 사용자 선호 양극화 (heavy user vs light user)

### 4.3 Pivot 비용 (v2)

| Pivot 방향 | 코드 변경 | 데이터 마이그레이션 | 사용자 영향 |
|---|---|---|---|
| A → Hybrid | +Track B 6개 마이그 (2주) | 없음 | "신기능 추가" 가벼움 |
| A → B 완전 전환 | 9 revert + 6 신규 (3주) | 다이아 잔액 환불 | 약관 개정 + 30일 고지 |
| B → A 완전 전환 | 6 revert + 9 신규 (3주) | 미사용 quota → 다이아 환산 | 약관 개정 + 30일 고지 |
| Hybrid → A only | 6 revert (1주) | 활성 구독자 grandfather | 자동결제 cancel 처리 |
| Hybrid → B only | 9 revert (1.5주) | 다이아 잔액 환불 | 충전 사용자 통보 |

**v2에서 Hybrid 추가 비용 가장 저렴** (2주, 사용자 영향 최소).

---

## 5. 추천 결론 (CEO 모드, v2)

### 5.1 결론

> **Track A로 출시 → M+3 시점에 Track B v2 paywall 추가 (early hybrid)**

v1 추천 (M+6 hybrid 평가)을 v2 가격 변경으로 **3개월 앞당김**.

### 5.2 근거 (v2 변경 반영)

1. **데이터 부재**: 결제 코드/사용자 0 → 충전 가설부터 검증 (Track A 우선).
2. **Track B v2 진입 장벽 해결**: 월 ₩3,900은 한국 영세 사업자도 부담 없음. v1의 ₩39k 부담 사라짐.
3. **알바몬/잡코리아 모델 친숙도**: 한국 구인구직 사용자는 "노출 등급 + 패키지" 패턴에 이미 익숙. 학습 비용 거의 없음.
4. **공고 무제한이 가져오는 효과**:
   - Free 사용자도 공고를 마음껏 등록 → DAU/MAU 상승
   - 매장이 가입할 동기 제공
   - 매출은 노출/검색/제안에서 발생 → "공고 등록은 무료"가 마케팅 메시지로 강력
5. **Pivot 비용**: Hybrid 추가 2주, 가장 저렴.
6. **Track A spec 진행 중**: 5개 마이그레이션 적용. 매몰비용은 아니지만 momentum 활용.

### 5.3 실행 plan (시간순)

```
M+0 ~ M+2: Track A only
  - 다이아 충전 + 공고당 차감 (이미 spec/마이그레이션 진행 중)
  - 충전 패턴 / 사용 빈도 / 가격 탄력성 데이터 수집

M+3: Track B v2 layer 추가 (Hybrid 시작)
  - subscription_plans / subscriptions / feature_usage 테이블
  - check_feature_access RPC
  - Pro/Enterprise 노출 옵션 paywall
  - 면접 제안 / AI 매칭 기능 추가 (Pro+ 한정)

M+4 ~ M+6: 데이터 기반 최적화
  - tier 가격 / quota 조정
  - Free vs Basic vs Pro vs Enterprise 전환 funnel 분석
  - 마케팅 강한 쪽 더블다운

M+7 ~: Enterprise B2B 영업
  - 매장 5개 이상 체인은 Enterprise tier 인보이스
  - 자체 매니저 SLA
```

### 5.4 단점 인지 + 대응

| 단점 | 대응 |
|---|---|
| Hybrid 코드 복잡도 ↑ | 별도 모듈로 격리 (services/wallet vs services/subscription) |
| 두 결제 UX 혼재 | 명확한 가이드 ("이번 1건만 결제 vs 매달 결제") |
| 회계 처리 복잡 | RC가 두 IAP 분리 reporting 자동 |
| Track B v2 매출 ceiling 낮음 | Enterprise B2B 영업으로 보강 |

### 5.5 대안 시나리오

**Track B v2만 단독 채택 시 조건**:
- 한국 영세 사업자가 충전보다 자동결제 수용 가능하다는 확신
- 출시 전 Pro/Enterprise 사전 가입 LOI 10건 이상
- 알바몬식 노출 패키지에 사용자가 ₩3.9k 지불 의향 명확

→ 현재 데이터 부재. Track A 먼저 검증 권장.

**Track A만 영구 유지 시 조건**:
- 충전 funnel 전환율 40%+ 안정
- 자동결제 거부감 명확 (NPS 데이터)
- B2B 영업 의지 없음

→ M+3 시점에서 데이터로 확인 후 결정.

---

## 6. 결과물 매트릭스 (v2)

| 산출물 | 위치 | 상태 |
|---|---|---|
| Track A spec | `2026-04-26-monetization-design.md` | Locked, 5개 마이그 적용됨 |
| Track B spec v2 | `2026-04-26-monetization-subscription-design.md` | v2 작성 완료, 검토 대기 |
| 비교 문서 v2 (본 문서) | `2026-04-26-monetization-comparison.md` | 작성 완료 |
| 추천 | **Track A 시작 → M+3 Hybrid (Track B v2 layer 추가)** | 본 문서 §5 |
| 새 브랜치 | `design/monetization-subscription` | spec 보존용 |

---

## 7. Open Questions (v2 의사결정 필요)

| # | 질문 | 추천 답변 (auto-mode v2) |
|---|---|---|
| Q1 | 본 추천 채택? | **Track A 출시 + M+3 Hybrid (Track B v2 layer)** |
| Q2 | Track B v2 spec 보관? | **보관 + M+3 시점에 implementation plan 진행** |
| Q3 | Hybrid 시작 시점 | **M+3 (v1 M+6 → v2 M+3, 가격 매력 ↑)** |
| Q4 | B2B Enterprise 영업 | Track B v2 Enterprise tier (₩29.9k) 활용 |
| Q5 | 본 브랜치 머지 | **머지하지 않음** (spec 보존용 docs only PR도 가능) |
| Q6 | 알바몬식 단발 부스팅 (₩1,000 강조 1회) | Phase 2/3 검토 (Track A의 충전 성격과 가까움) |

---

## 8. v1 → v2 변경 요약

| 영역 | v1 | v2 |
|---|---|---|
| Basic 가격 | ₩39,000/월 | **₩3,900/월** |
| Pro 가격 | ₩99,000/월 | **₩9,900/월** |
| Enterprise 가격 | ₩299,000/월 | **₩29,900/월** |
| 공고 quota | 3 / 20 / 100 / -1 | **모든 tier 무제한** |
| 차등 영역 | 공고 quota + 매장 수 | **노출 위치 + 검색 + 제안 + 분석 + 매장 + SLA (10 dim)** |
| 참조 모델 | 일반 SaaS | **알바몬 / 잡코리아 / 사람인** |
| 진입 장벽 | 높음 | 낮음 |
| MRR ceiling (1k명) | 415k | 79k |
| LTV (1k명) | 830k | 99k |
| 추천 hybrid 시점 | M+6 | **M+3** |

---

*비교 v2 종료 — 사용자 검토 대기.*
