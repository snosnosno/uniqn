---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/src/components/address/PostcodeSearch.tsx
  - uniqn-mobile/src/components/address/PostcodeSearch.web.tsx
  - uniqn-mobile/supabase/migrations/20260803160000_job_postings_geocode_columns.sql
  - PR#391
  - PR#411
  - PR#419
tags: [address, geocoding, webview, kakao, edge-function]
---

# 소스: 공고 주소 2단계 — 우편번호 위젯(B1) → 좌표 지오코딩(B2) (PR#391·#411·#419)

## WebView 는 origin 이 없으면 위젯이 조용히 죽는다 (PR#419)

주소 검색 결과를 **탭해도 입력되지 않는** 문제. 원인은 WebView 문서에 실제 origin 이
부여되지 않아 우편번호 위젯의 콜백이 동작하지 않은 것이었다.

> 🔑 서드파티 위젯을 WebView 에 얹을 때는 **문서에 실제 origin 을 준다**(`baseUrl`).
> origin 이 `about:blank` 이면 postMessage·쿠키·리퍼러 기반 동작이 전부 무음 실패한다.
> 에러가 안 나고 "눌러도 아무 일 없음"으로 보이므로 UI 버그로 오진하기 쉽다.

네이티브(`PostcodeSearch.tsx`)와 웹(`PostcodeSearch.web.tsx`)이 별도 구현이라
**한쪽만 고치면 다른 쪽이 남는다** — 플랫폼 분기 파일은 항상 쌍으로 확인할 것.

## 좌표 지오코딩 (PR#411)

주소를 좌표로 변환해 길찾기를 **정밀 핀**으로 승격. 컬럼 추가는
`20260803160000_job_postings_geocode_columns.sql`(prod 기록명 `20260803015905`).

> 🔑 **카카오 로컬 API 는 `x`=경도(longitude), `y`=위도(latitude)** 다.
> 지도 라이브러리 다수가 `(lat, lng)` 순서를 쓰므로 그대로 넘기면 좌표가 뒤집힌다 —
> 국내 좌표에서는 뒤집어도 "바다 한가운데"가 아니라 **그럴듯한 다른 위치**가 나와서
> 눈으로 검증하기 어렵다.

Edge Function `geocode-address`(v3)가 **선배포**돼 있다 — 클라 배포와 비대칭이므로
EF 만 바뀐 구간에서 구 클라가 새 응답을 받는 창이 존재한다.

**잔여**: iOS 스킴 판단(⏸).

## 연결

- 지도 앱 실행·스킴 선언 문제: [[ui-device-report-2026-08]]
- EF/클라 롤아웃 비대칭: [[notification-offline-contract-2026-08]]
- 레이어상 외부 API 호출 위치: [[layers]]
- 공고 도메인 전반: [[order-sheet-form-contract]]
