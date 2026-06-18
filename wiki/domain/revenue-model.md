---
area: domain
updated: 2026-06-18
status: current
sources:
  - memory/project_revenue_model_audit_20260609.md
  - PR#172
  - PR#168
tags: [domain, revenue, wallet, iap, revenuecat, diamond, heart]
---

# 수익 모델

**한 줄:** 이중통화(하트·다이아) + 공고 게시 차감 + IAP 충전. 현재 출시 게이트 OFF(서버 `_calc_posting_cost`=0) 휴면 상태. (주장: memory/project_revenue_model_audit_20260609.md)

## 통화 구조

| 통화 | 획득 | 만료 | 용도 |
|---|---|---|---|
| 하트(💗) | 무료(출석/보너스) | 90일 FIFO 만료 | 공고 게시 차감 우선 |
| 다이아(💎) | 유료 IAP | 영구 | 공고 게시 차감(하트 소진 후) |

SSOT: `wallet_ledger`(append-only), `wallets`=트리거 캐시, `heart_lots`=만료 추적 (주장: memory 기반).

## 공고 게시 비용

주장 (memory/project_revenue_model_audit_20260609.md):
- regular 1💎 / urgent 10💎 / fixed 5💎 / tournament 0

**현황**: `app_config.monetization` = `{paid_types: 모두 false, rollout: 0}` → 전 공고 무료(이중 게이트 휴면).

## IAP 충전

주장 (memory 기반): 다이아 6종(₩1,000=3 ~ ₩100,000=333+67개, 약 ₩300/💎). RevenueCat(RC) SDK 연동.

PR#172(2026-06-10 머지): PurchaseSheet footer(약관·Restore·복원) TDD 구현 + RC publishable 키 fallback.

## P1 결함 — 출시 前 필수 수정

주장 (memory 기반, PR#172 수정 완료):
1. **환불 세탁 봉쇄**: 하트 소비분 환불이 전액 다이아 적립(무료→영구 전환 farming). M2(통화별 환불 분리)로 수정됨.
2. **취소+환불 원자성**: M3 `cancel_job_posting_with_refund_atomically`로 단일 트랜잭션화.
3. **IAP 심사 footer**: App Store 3.1.1/3.1.2 준수.

## 출시 게이트 잔여 외부 작업 (주장)

- RC 웹훅 Authorization 헤더 일치 확인(RC 대시보드 수동)
- Play Console 소모성 IAP 6종 수동 생성
- sandbox 결제 e2e(실기기)
- `app_config.monetization` 게이트 ON

## 전략 갭 (주장)

대회사(최대 ARPU, 현재 과금 0). 다이아 선불은 B2B 단발 구인에 부적합 — PortOne 카드후불 + 대회사 패키지 재정렬 권고. (주장: memory 기반)

## 관련

- [[target-market]] — 대회사가 최대 ARPU 잠재이지만 현재 과금 0
- [[data-flow]] — 지갑 차감·충전 흐름 상세
- [[enum-divergence]] — wallet_ledger enum(`streak_7d` 등 6종 dead) 참고
