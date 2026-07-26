# 지갑/IAP 수익모델 — 아카이브

이 폴더의 문서는 **제거된 가상화폐(하트/다이아) 지갑 + RevenueCat IAP 수익모델**의 기획/구현 문서입니다. 현재 코드·DB·인프라에는 해당 기능이 존재하지 않습니다.

- **제거 결정**: 2026-06 — 잡보드 공고 수수료 수익성 부재 + 직업안정법상 구직자 과금 제한. 안티스팸은 PortOne 본인인증 + 지원/공고 한도 + 평판으로 대체.
- **제거 PR**: #196(코드/DB 전체 제거, 머지 `967e9f5e2`), #199(후속 정리 + `app_config` monetization 키 드롭).
- **잔재 정리**: 2026-06-24 전수감사 — 앱코드·의존성·prod DB(테이블/RPC/enum/cron) 0 확인, 고아 Edge Function `revenuecat-webhook` 삭제, 죽은 `is_featured` SELECT 제거(PR #201).
- **아카이브 사유**: 위 구현 문서들은 더 이상 유효하지 않으므로 보존용으로 이관(2026-06-24).
- **통합**: 2026-07-26 — 같은 아카이브가 `uniqn-mobile/docs/archive/wallet-iap-removal/` 에도 중복 존재해
  `laneB2-payment-wiring` · `laneC-revenuecat` · `remove-wallet-iap` 3건을 이곳으로 합치고 중복 README 를 제거했다.
  이 폴더가 지갑/IAP 아카이브의 단일 위치다.

> 향후 수익 방향(딜러 임금 정산-레일 / 노쇼 보증 등)은 별개 사업으로 **보류** 중이며 본 문서들과 무관합니다. 상위 수익모델 전략/설계 문서(`monetization-model-recommendation`, `monetization-design` 등)는 `docs/`에 그대로 보존됩니다.
