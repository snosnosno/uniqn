# app2 Dormant Product

## 공식 상태 정의

`app2/`의 공식 상태명은 `dormant product`입니다.

이 표현은 다음을 동시에 의미합니다.

- 현재 운영 제품의 runtime source of truth는 아니다.
- 폐기 예정 자산도 아니다.
- 향후 토너먼트 전용 웹 제품으로 재개발할 수 있는 시드다.

현재 운영 기준은 계속 `uniqn-mobile/`, `functions/`이며, `app2/`는 운영 배포, CI, 신규 기능 기준에서 분리된 상태를 유지합니다.

## 제품 목적

`app2`는 토너먼트 운영 경험을 웹에서 다루기 위한 제품 시드입니다. 나중에 다시 시작할 때의 목표는 범용 운영 웹앱 복구가 아니라, 토너먼트 전용 웹 제품을 별도 successor로 추출하는 것입니다.

기본 successor 이름은 `tournament-web/`를 사용합니다. 이 디렉터리는 아직 생성하지 않았습니다.

## 지금 비운영 상태인 이유

- 현재 제품 기준이 `uniqn-mobile/`와 `functions/`로 정리되어 있습니다.
- `app2`는 토너먼트 기능 외에 공고, 지원, 근무, 출석, 공지, 알림, 문의, 설정 등 범위가 넓게 섞여 있습니다.
- 빌드 체인과 타입체크가 바로 부팅 가능한 상태가 아닙니다.
- 데이터 계층 일부가 과거 `eventId` 중심 계약과 범용 운영 흐름에 묶여 있습니다.

따라서 지금 `app2`를 직접 운영 제품으로 되살리는 것보다, 토너먼트 전용 successor를 의도적으로 추출하는 편이 안전합니다.

## 왜 `app2` 직접 부활이 아닌가

- 현재 폴더에는 토너먼트와 무관한 범용 운영 기능이 너무 많이 포함되어 있습니다.
- 웹 전용 제품으로 다시 시작할 때 필요한 범위보다 현재 구조가 큽니다.
- 빌드, 타입, 데이터 계층을 복구하면서 동시에 범위를 줄여야 하므로, 신규 successor로 경계를 명확히 하는 편이 회귀 위험이 낮습니다.
- 현재 모바일 앱과 Functions의 canonical 계약을 침범하지 않으려면 독립 제품처럼 재개하는 것이 맞습니다.

## 왜 토너먼트 전용 successor인가

`app2`에서 가장 일관되게 가치가 남아 있는 부분이 토너먼트 흐름이기 때문입니다. 현재 라우트와 상태 구조도 토너먼트 쪽을 중심으로 남아 있습니다. 재개 시에는 웹에서 강점이 큰 운영 화면만 남기고 범위를 작게 시작하는 것이 좋습니다.

v1 포함 범위:
- 로그인
- 토너먼트
- 참가자
- 테이블
- 블라인드/타이머

v1 제외 범위:
- 공고/지원/근무/출석 범용 운영
- 공지/알림/문의/일반 설정
- Capacitor 네이티브 기능

## 메인 제품과의 경계

- 현재 운영 source of truth는 `uniqn-mobile/`, `functions/`입니다.
- `app2` 타입과 Firestore shape를 신규 기능의 기준 계약으로 사용하지 않습니다.
- `uniqn-mobile/` 내부 구현을 `app2`가 직접 참조하는 구조로 다시 묶지 않습니다.
- 재사용이 필요하면 순수 타입, 스키마, 계산 로직만 별도 공용 모듈로 추출합니다.

## 재사용 후보 자산

다음 파일군은 successor 설계 시 우선 검토 대상입니다.

- `src/stores/tournamentStore.ts`
- `src/contexts/TournamentContextAdapter.tsx`
- `src/contexts/TournamentDataContext.tsx`
- `src/hooks/useTournaments.ts`
- `src/hooks/tables/*`
- `src/pages/TournamentsPage.tsx`
- `src/pages/ParticipantsPage.tsx`
- `src/pages/TablesPage.tsx`

## 그대로 가져가지 않을 자산

다음 파일군과 흐름은 successor에 직접 승계하지 않습니다.

- `UnifiedData` 범용 운영 계층
- `eventId` 기반 구인/지원/출석 흐름
- 알림/공지/문의/범용 프로필 관리
- Capacitor 전용 초기화와 네이티브 의존 로직

## 금지사항

- `app2`를 현재 제품의 canonical 구현처럼 다루지 않습니다.
- `app2` 재개 명목으로 현재 모바일/Functions 계약을 역으로 바꾸지 않습니다.
- 토너먼트 전용 제품 범위를 확정하기 전에는 범용 운영 기능을 되살리지 않습니다.
- 사용자 데이터가 없더라도 런타임 계약 변경을 성급히 섞지 않습니다.

## 다음 문서

실제 재개 절차와 현재 기술 상태는 [`RESTART_GUIDE.md`](./RESTART_GUIDE.md)에서 확인합니다.
