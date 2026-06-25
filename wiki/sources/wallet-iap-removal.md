---
area: sources
updated: 2026-06-23
status: current
sources:
  - memory/project_wallet_iap_removal_20260622.md
  - memory/pitfall_195_caller_binding_broke_pgtap_dbtests.md
  - memory/pitfall_job_postings_insert_loose_rls_by_design.md
  - PR#196
  - PR#198
tags: [wallet, iap, revenue, removal, db-tests, rls, pgtap]
---

# 소스: 지갑/IAP 수익모델 전체 제거 (2026-06-22~23)

가상화폐(하트/다이아) 지갑 + RevenueCat IAP 수익모델을 **전체 제거**하기로 결정하고 작업한 세션의 요약. **✅ PR#198·#196 둘 다 master 머지 + prod drop 마이그 적용 + 웹 배포·라이브 스모크 통과 완료(2026-06-23).** 잔여는 모바일 EAS OTA(사용자 보류)와 스토어 IAP 수동 해지.

## 결정 (why)
- 구인구직 잡보드 공고 수수료로는 돈 안 됨: 시장 작음, 이탈(disintermediation) 심함, 직업안정법상 **구직자 과금 제한**.
- 진짜 수익처 = "딜러 임금이 흐르는 **정산-레일** + **노쇼 보증**"이나 PG제휴·세무·법률이 묶인 별도 핀테크 사업 → 지금은 보류.
- 안티스팸(무분별 공고/지원)은 가상화폐 대신 **기존 PortOne 본인인증 + 지원/공고 한도 + 평판**으로 충분.
- 상세 비판: [[revenue-model]] 전략 갭 참조.

## PR #196 — 제거 + 공고 생성 경로 복원 (✅머지 `967e9f5e2`)
- 들어냄: `src/components/wallet/`(PurchaseSheet·PaywallModal 등), `src/services/purchases/`(RevenueCat), 지갑 훅, `diamond_products`/`wallet_ledger`/`wallets`/`heart_lots` 테이블 + RPC, `revenuecat-webhook`, IAP footer, signup 하트 grant.
- **핵심**: 공고 생성/취소가 `create_job_posting_with_payment_atomically` RPC를 통과했는데 → 결제 없는 직접 `supabase.insert()`/`status=cancelled UPDATE`로 복원. flag-off legacy 동등성 보장 R1 회귀테스트 근거.
- 보강: drop 마이그 DROP 시그니처 정합(`wallet_reason` 타입, CASCADE 의존 제거), `handle_new_user()` 하트블록 제거(dangling 참조 경고 해소), `react-native-purchases` + eas RC키 제거.
- 유지: 출퇴근/정산 전부, 공고 게시/지원/확정 핵심 동선.

## PR #198 — db-tests 회귀 수정 (master 대상, CI GREEN)
- pg_prove RED의 원인은 지갑이 아니라 [[wallet-pgtap-caller-binding]] — PR#195 하드닝이 pgTAP를 깨뜨림. JWT 주입으로 수정.

## 잔여 (2026-06-23 기준)
- ✅완료: #196 머지·웹 Cloudflare 배포·라이브 웹 스모크(공고 작성→등록 201→삭제 204, wallet RPC 0)·prod drop 마이그·`supabase.ts` 재생성·잔액확인(유료 0)·RevenueCat 웹훅삭제+상품15 archive·PR#160 폐기·app_config monetization 키 제거.
- 🔲 사용자: 모바일 EAS OTA(`eas update --channel production`, android/ 임시 mv + `--environment production`)·신규 빌드(보류)·App Store Connect/Play Console IAP 수동 해지.
- 🔲 owner_id 위조 조임은 [[rls-model]] 느슨 INSERT 설계 때문에 별도 PR(설계 doc 작성됨).

## 관련
- [[revenue-model]] — 폐기 대상 구조 + 전략 갭
- [[target-market]] — 정산-레일 수익처는 대회사/홀덤펍 임금 흐름
- [[wallet-pgtap-caller-binding]] — db-tests 회귀(PR#198)
- [[rls-model]] — 공고 INSERT 느슨 RLS는 의도(조임 금지)
