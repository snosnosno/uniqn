# app2 문서 포털

> 상태: `dormant product`
> 현재 운영 source of truth: `uniqn-mobile/`, `functions/`
> 재개 기본 경로: `app2` 직접 부활이 아니라 `tournament-web/` successor 추출

## 30초 요약

- 이 폴더는 무엇인가: 토너먼트 전용 웹 제품으로 다시 살릴 수 있는 휴면 시드입니다.
- 지금 왜 멈춰 있나: 현재 운영 기준이 `uniqn-mobile/`, `functions/`로 이동했고, `app2`는 빌드 체인과 데이터 계층을 바로 재사용하기 어려운 상태이기 때문입니다.
- 다시 시작할 때 어디부터 보나: [`DORMANT_PRODUCT.md`](./DORMANT_PRODUCT.md) -> [`RESTART_GUIDE.md`](./RESTART_GUIDE.md) -> [`../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md`](../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md)
- 최종 목표가 무엇인가: `app2`를 장기 유지하는 것이 아니라 토너먼트 전용 successor `tournament-web/`를 추출하는 것입니다.

## 이 문서의 역할

`app2/`는 폐기 예정 폴더가 아닙니다. 다만 현재 운영 경로에서도, 현재 배포 기준에서도 사용하지 않는 휴면 제품입니다. 앞으로 다시 개발을 시작할 때 이 폴더는 "무엇을 살리고 무엇을 버릴지"를 판단하는 기준본 역할을 합니다.

## 먼저 읽을 문서

1. [`DORMANT_PRODUCT.md`](./DORMANT_PRODUCT.md)
2. [`RESTART_GUIDE.md`](./RESTART_GUIDE.md)
3. [`../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md`](../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md)

## 지금 확정된 방향

- `app2`의 공식 상태명은 `dormant product`입니다.
- 현재 운영 source of truth는 계속 `uniqn-mobile/`, `functions/`입니다.
- 재개 시 목표 디렉터리 이름은 `tournament-web/`를 기본값으로 사용합니다.
- `tournament-web/` 디렉터리는 아직 존재하지 않습니다.
- 이번 정리는 문서와 상태 정의만 다루며, 런타임 API나 Firestore 계약은 바꾸지 않습니다.

## successor 전략

`app2`를 그대로 장기 운영 대상으로 되살리지 않는 이유는 범위가 넓고, 토너먼트 외 일반 운영 기능과 과거 데이터 모델이 많이 섞여 있기 때문입니다. 재개 시에는 토너먼트 전용 기능만 추려 `tournament-web/`로 분리하는 편이 현재 제품과 충돌을 줄이고 복구 순서도 명확합니다.

## v1 범위

포함:
- 로그인
- 토너먼트
- 참가자
- 테이블
- 블라인드/타이머

제외:
- 공고/지원/근무/출석 범용 운영
- 공지/알림/문의/일반 설정
- Capacitor 네이티브 기능

## 재사용 후보 자산

- `src/stores/tournamentStore.ts`
- `src/contexts/TournamentContextAdapter.tsx`
- `src/contexts/TournamentDataContext.tsx`
- `src/hooks/useTournaments.ts`
- `src/hooks/tables/*`
- `src/pages/TournamentsPage.tsx`
- `src/pages/ParticipantsPage.tsx`
- `src/pages/TablesPage.tsx`

## 그대로 가져가지 않을 자산

- `src/hooks/useUnifiedData.ts`를 포함한 `UnifiedData` 범용 운영 계층
- `eventId` 기반 구인/지원/출석 흐름
- 알림/공지/문의/범용 프로필 관리 기능

## 주의

- `app2` 코드를 현재 모바일 앱이나 Functions의 기준 구현으로 간주하지 않습니다.
- 새 작업이 필요해도 `app2`를 기준으로 현재 계약을 덮어쓰지 않습니다.
- 사용자가 아직 없으므로 지금은 데이터 마이그레이션을 하지 않지만, 그 대신 재개 문서와 테스트 기준을 먼저 고정합니다.
