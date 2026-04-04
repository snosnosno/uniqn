# app2 Restart Guide

## 목적

이 문서는 `app2`를 다시 개발할 때 "무엇부터 확인하고 어떤 순서로 복구할지"를 고정하기 위한 체크리스트입니다. 목표는 `app2`를 그대로 장기 유지하는 것이 아니라 `tournament-web/` successor를 추출하는 것입니다.

## 2026-04-04 기준 사실

- `app2/node_modules`는 현재 존재하지 않습니다.
- `npm run build`는 `craco`를 찾지 못해 바로 통과하지 않습니다.
- `npm run type-check`는 테스트 타입과 패키지 해상도 문제로 대량 실패합니다.
- 현재 운영 source of truth는 `uniqn-mobile/`, `functions/`입니다.
- 아직 사용자가 없으므로 지금은 데이터 마이그레이션이 필요하지 않습니다.

## 재개 전 원칙

- 현재 모바일 앱과 Functions 계약은 그대로 둡니다.
- `app2` 직접 부활보다 `tournament-web/` successor 추출을 기본 전략으로 사용합니다.
- 범위는 토너먼트 전용 제품으로 제한합니다.
- 빌드 복구와 범위 축소를 동시에 진행하되, 데이터 계층 재설계는 마지막에 합니다.

## 가장 먼저 볼 항목

- 환경 변수 파일과 Firebase 설정
- `src/firebase.ts`
- `src/stores/tournamentStore.ts`
- `src/contexts/TournamentContextAdapter.tsx`
- `src/contexts/TournamentDataContext.tsx`
- `src/hooks/useTournaments.ts`
- `src/hooks/tables/*`
- `src/App.tsx`의 현재 라우트 범위

## 복구 순서

### 1. 의존성 설치 재현

- `package-lock.json`을 기준으로 설치 재현 가능 여부를 먼저 확인합니다.
- Node 버전, npm 버전, lockfile 상태를 문서로 고정합니다.
- 이 단계의 목적은 "무엇이 깨졌는가"보다 "어디까지 부팅 가능한가"를 재현하는 것입니다.

체크:
- `npm install`
- 잠금 파일 변경 여부
- 설치 후 `node_modules` 정상 생성 여부

### 2. 빌드 체인 복구

- `package.json`의 `craco` 기반 빌드 체인이 실제로 부팅 가능한지 확인합니다.
- `npm run build`를 가장 먼저 녹색으로 만드는 것이 목표입니다.
- React, CRACO, TypeScript, 환경 변수 로딩 경로가 맞는지 함께 점검합니다.

체크:
- `npm run build`
- `craco.config` 또는 대응 설정 파일 존재 여부
- Firebase, 라우터, 정적 자산 import 깨짐 여부

### 3. 타입체크 범위 분리

- 현재 `npm run type-check` 실패에는 테스트 타입과 패키지 해상도 이슈가 섞여 있습니다.
- 먼저 앱 런타임 타입체크와 테스트 타입체크를 분리합니다.
- 이 단계에서 목표는 모든 타입 문제를 즉시 해결하는 것이 아니라, 제품 복구에 필요한 신호와 노이즈를 분리하는 것입니다.

체크:
- 앱 코드용 tsconfig 분리 가능 여부
- 테스트 전용 타입 정의 정리
- 누락 의존성과 경로 alias 충돌 여부

### 4. 토너먼트 외 기능 다이어트

- successor v1에 포함하지 않을 범용 운영 기능을 라우트, 메뉴, 상태 계층에서 제거 후보로 분류합니다.
- 이 단계에서는 삭제보다 먼저 "무엇을 남길지"를 확정합니다.

우선 제거 후보:
- 공고/지원/근무/출석 흐름
- 공지/알림/문의/일반 설정
- Capacitor 네이티브 초기화

남길 후보:
- 로그인
- 토너먼트
- 참가자
- 테이블
- 블라인드/타이머

### 5. 토너먼트 전용 데이터 계층 분리

- 마지막에 토너먼트 전용 데이터 계층만 남기는 방향으로 정리합니다.
- `UnifiedData` 중심의 범용 운영 계층은 successor로 직접 가져가지 않습니다.
- 필요한 경우 토너먼트 전용 fetcher, store, context만 별도 추출합니다.

집중할 파일군:
- `src/stores/tournamentStore.ts`
- `src/contexts/TournamentContextAdapter.tsx`
- `src/contexts/TournamentDataContext.tsx`
- `src/hooks/useTournaments.ts`
- `src/hooks/tables/*`

## 재사용할 자산

- `src/stores/tournamentStore.ts`
- `src/contexts/TournamentContextAdapter.tsx`
- `src/contexts/TournamentDataContext.tsx`
- `src/hooks/useTournaments.ts`
- `src/hooks/tables/*`
- `src/pages/TournamentsPage.tsx`
- `src/pages/ParticipantsPage.tsx`
- `src/pages/TablesPage.tsx`

## 그대로 승계하지 않을 자산

- `UnifiedData` 범용 운영 계층
- `eventId` 기반 구인/지원/출석 흐름
- 알림/공지/문의/범용 프로필 관리
- Capacitor 네이티브 기능

## 완료 기준

다음을 만족하면 재개 준비가 된 것으로 봅니다.

- 새 엔지니어가 `app2/README.md`와 이 문서만 보고 작업 순서를 설명할 수 있다.
- `tournament-web/` successor 전략이 문서상 확정되어 있다.
- 빌드 복구, 타입체크 분리, 범위 축소, 데이터 계층 분리 순서가 문서에 명확하다.
- 토너먼트 전용 v1 범위를 벗어나는 기능이 문서에서 명시적으로 차단된다.
- 현재 운영 기준과 휴면 제품 기준이 혼동되지 않는다.

## 참고 문서

- [`README.md`](./README.md)
- [`DORMANT_PRODUCT.md`](./DORMANT_PRODUCT.md)
- [`../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md`](../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md)
