# app2 토너먼트 웹 제품 재활성화 계획

> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 설계, 분석, 재활성화 준비 문서입니다.
> 현재 운영 기준은 `uniqn-mobile/`, `functions/`, `docs/reference/ARCHITECTURE.md`입니다.

최종 업데이트: 2026-04-04

## 목적

`app2/`를 단순 레거시 폐기물이 아니라, 향후 다시 살릴 수 있는 `토너먼트 전용 별도 웹 제품 후보`로 관리한다.

현재 목표는 두 가지다.

- 지금 운영 중인 `uniqn-mobile/`, `functions/`에 영향을 주지 않는다.
- 나중에 `app2`를 재가동할 때 필요한 구조, 범위, 복구 순서를 명확히 남긴다.

## 현재 판단

### 결론

`app2/`는 참고용 보관 폴더 수준이 아니라, 인증/라우팅/토너먼트 운영/UI/Capacitor 초기화까지 갖춘 `휴면 제품(dormant product)`이다.

다만 그대로 다시 배포 가능한 상태는 아니다.

핵심 이유:

- 현재 실행 기준 문서와 충돌하는 `legacy/deprecated` 표현이 많다.
- 의존성 설치가 없는 상태에서는 빌드 자체가 불가능하다.
- CRA + CRACO 기반 구성이 오래되었고 현재 저장소 표준과 다르다.
- 토너먼트 전용 제품으로 보기에는 공고/지원/알림/문의/프로필까지 범위가 넓다.
- 데이터 모델 일부가 `eventId` 중심의 과거 계약에 의존한다.

## 실제 코드 기준 분석

### 1. 제품 범위는 이미 "토너먼트 중심"으로 기울어져 있다

토너먼트 기능 플래그가 핵심 기능으로 남아 있다.

- `TOURNAMENTS`
- `PARTICIPANTS`
- `TABLES`

근거:

- `app2/src/config/features.ts`

앱 기본 진입도 `/app/tournaments`로 리다이렉트한다.

근거:

- `app2/src/App.tsx`

토너먼트 데이터 전역 관리 계층도 따로 존재한다.

- `app2/src/stores/tournamentStore.ts`
- `app2/src/contexts/TournamentContextAdapter.tsx`
- `app2/src/contexts/TournamentDataContext.tsx`
- `app2/src/hooks/useTournaments.ts`

즉, `app2`를 다시 살릴 때 전체 웹앱을 다 살리는 것보다 `토너먼트 운영 제품`으로 좁히는 것이 자연스럽다.

### 2. 현재 빌드 실패는 "제품 논리 붕괴"보다 "개발 환경 붕괴" 성격이 강하다

2026-04-04 기준 점검 결과:

- `app2/node_modules` 없음
- `npm run build` 실패
  - `craco` 명령 자체를 찾지 못함
- `npm run type-check` 실패
  - Jest/React 타입 해석 실패가 대량 발생
  - 로컬 의존성 부재 영향이 큼

이 의미는 다음과 같다.

- 지금 당장 배포는 불가
- 하지만 토너먼트 도메인 자체가 죽은 것은 아님
- 재가동 1단계는 기능 개발보다 `개발 환경 복구`가 우선

### 3. 현재 app2는 별도 제품으로 쓰기엔 범위가 너무 넓다

현재 라우트와 lazy chunk를 보면 다음이 함께 섞여 있다.

- 토너먼트
- 참가자
- 테이블
- 알림
- 공지
- 설정
- 프로필
- 문의 관리
- 사용자 관리

근거:

- `app2/src/App.tsx`
- `app2/src/utils/lazyChunks.ts`
- `app2/src/pages/*`

토너먼트 전용 웹 제품으로 되살리려면 이 중 핵심만 남겨야 한다.

### 4. 데이터 모델은 현재 모바일 canonical contract와 바로 맞지 않는다

`app2` 코드에는 여전히 `eventId` 기반 흔적이 강하다.

- `applications.eventId`
- `workLogs.eventId`
- `attendanceRecords.eventId`
- `jobPostings/{eventId}/workLogs/*`류의 서브컬렉션 타입 설명

근거:

- `app2/src/types/application.ts`
- `app2/src/types/unifiedData.ts`
- `app2/src/types/subcollection/index.ts`
- `app2/src/hooks/useUnifiedData.ts`

반면 현재 메인 제품은 `jobPostingId`, strict canonical schema, `uniqn-mobile/` 중심 계약으로 수렴 중이다.

따라서 `app2`를 재활성화할 때는 아래 둘 중 하나를 반드시 선택해야 한다.

1. 토너먼트 전용 독립 데이터 모델로 분리
2. 현재 canonical contract에 맞춰 전면 어댑트

토너먼트 전용 별도 제품이라는 목표에는 1번이 훨씬 적합하다.

## 추천 전략

## 추천안: "app2 직접 부활"이 아니라 "app2 기반 successor 제품 추출"

가장 추천하는 방법은 다음과 같다.

- `app2/`는 휴면 기준본으로 유지
- 실제 재활성화는 별도 워크스페이스에서 진행
- 후보 이름:
  - `tournament-web/`
  - `products/tournament-web/`
  - `app-tournament/`

이 방법을 추천하는 이유:

- 현재 모바일 제품과 충돌을 최소화할 수 있다
- `app2`의 넓은 범위를 그대로 안고 가지 않아도 된다
- 필요한 토너먼트 자산만 골라서 새 제품으로 옮길 수 있다
- 이후 CI/배포/문서 정책도 독립적으로 관리 가능하다

### 왜 app2를 그대로 다시 켜지 않는가

그대로 재가동하는 방식의 문제:

- 오래된 도구 체인(CRA/CRACO) 유지 필요
- 과거 범용 기능이 함께 살아남아 scope creep 발생
- 현재 제품과 데이터 계약 충돌 가능
- "토너먼트 전용"보다 "옛 웹앱 부활"이 되어버림

반대로 successor 추출 방식의 장점:

- 토너먼트/참가자/테이블만 남기는 구조적 다이어트 가능
- 현대화(Vite, TS5, 최신 테스트 체계)를 자연스럽게 적용 가능
- 현재 운영 코드와 명확히 분리 가능

## 제품 범위 제안

### v1 재활성화 범위에 포함할 것

- 로그인
- 권한 기반 진입
- 토너먼트 생성/조회/수정/삭제
- 날짜별 기본 토너먼트
- 참가자 등록/관리
- 테이블 생성/배정/이동/밸런싱
- 토너먼트 상태/블라인드 레벨/타이머

핵심 재사용 후보:

- `app2/src/stores/tournamentStore.ts`
- `app2/src/contexts/TournamentContextAdapter.tsx`
- `app2/src/contexts/TournamentDataContext.tsx`
- `app2/src/hooks/useTournaments.ts`
- `app2/src/hooks/tables/*`
- `app2/src/pages/TournamentsPage.tsx`
- `app2/src/pages/ParticipantsPage.tsx`
- `app2/src/pages/TablesPage.tsx`
- `app2/src/components/tables/*`

### v1 재활성화 범위에서 제외할 것

- 구인공고/지원/근무기록/출석 운영 전반
- 알림 센터
- 공지사항
- 문의 관리
- 일반 프로필/설정
- 하이브리드 Capacitor 네이티브 기능

제외 이유:

- 토너먼트 전용 제품의 핵심과 직접 관련이 약함
- 현재 메인 앱과 중복됨
- 과거 데이터 모델과 얽혀 있어 복구 비용이 큼

## 데이터 전략 제안

## 권장안: 토너먼트 전용 독립 데이터 모델 유지

현재 `useTournaments`와 테이블 관련 훅은 다음 경로를 사용한다.

- `users/{userId}/tournaments/{tournamentId}`
- `users/{userId}/tournaments/{tournamentId}/tables`
- `users/{userId}/tournaments/{tournamentId}/participants`

이 구조는 토너먼트 전용 제품에 비교적 잘 맞는다.

장점:

- 현재 모바일 `jobPosting` 계약과 직접 충돌하지 않음
- 제품 경계가 분명함
- 별도 배포/권한 설계가 쉬움

### 하지 말아야 할 것

토너먼트 웹 부활 1단계에서 아래를 같이 하지는 않는다.

- `eventId -> jobPostingId` 전면 변환
- 메인 앱 도메인과 스키마 통합
- 앱/웹 간 모든 타입 공유

이 작업은 범위를 터뜨린다.

### 데이터 원칙

- 토너먼트 제품의 source of truth는 토너먼트 전용 컬렉션으로 둔다
- 메인 앱의 고용/지원/정산 도메인과 직접 결합하지 않는다
- 연동이 필요하면 API/adapter로 연결한다

## 재활성화 단계별 해결 방법

### Phase 0. 상태 재정의

먼저 `app2`를 레거시가 아니라 휴면 제품으로 명명한다.

해야 할 일:

- `LEGACY_NOTICE` 용어를 `DORMANT_PRODUCT` 성격으로 교체
- README 상단에 현재 상태를 명시
  - 개발 중단
  - 운영 비포함
  - 향후 토너먼트 전용 웹 제품 후보
- 현재 source of truth가 아님을 유지

완료 기준:

- 팀이 `app2`를 "버릴 것"이 아니라 "보류 중인 별도 제품"으로 인식한다

### Phase 1. 부팅 가능 상태 복구

목표는 기능 추가가 아니라 `개발 서버/빌드/기본 테스트가 돈다`를 만드는 것이다.

해야 할 일:

- `app2` 로컬 의존성 설치
- Node/npm 버전 고정
- `.env.example` 정비
- `tsconfig`와 테스트 타입 범위 분리
- `type-check`, `build`, 최소 smoke test 복구

예상 이슈:

- 테스트 파일이 `src` 내부에 섞여 있어 `type-check`를 오염시킴
- Jest/Playwright/React 타입 선언 누락
- CRACO 의존성 설치 누락

해결 방법:

- `tsconfig.json`에서 앱 빌드용 include/exclude 재정의
- 필요 시 `tsconfig.app.json`, `tsconfig.test.json` 분리
- 빌드 성공 전에는 기능 리팩터링 금지

완료 기준:

- `npm run type-check`
- `npm run build`
- 핵심 페이지 진입 smoke

### Phase 2. 제품 다이어트

토너먼트 전용 제품으로 남길 기능만 추린다.

남길 영역:

- auth
- tournaments
- participants
- tables
- tournament dashboard

잠글 영역:

- notifications
- announcements
- settings
- support
- inquiry management
- user management
- non-tournament job/app/worklog flow

해결 방법:

- feature flag가 아니라 라우트 제거 기준으로 정리
- menu/navigation도 함께 축소
- `UnifiedData` 계층에서 토너먼트 외 컬렉션 의존 분리

완료 기준:

- 제품 메뉴가 토너먼트 운영 작업만 남음
- 앱 범위가 팀원 누구에게나 한 문장으로 설명 가능함

### Phase 3. 토너먼트 데이터 계층 분리

현재 `UnifiedData` 쪽은 범용 운영 데이터까지 같이 보고 있다.
토너먼트 전용 제품에는 이 계층이 너무 무겁다.

해야 할 일:

- 토너먼트 전용 query/service 계층으로 단순화
- `eventId` 중심의 구인/지원/출석 로직 제거
- 토너먼트/참가자/테이블 도메인만 남기는 read/write 경로 재구성

추천 구조:

- `domains/tournament`
- `domains/participant`
- `domains/table`
- `services/tournament`
- `repositories/firebase/tournament`

완료 기준:

- 토너먼트 화면이 `jobPostings`, `applications`, `attendanceRecords`, `workLogs` 없이 동작

### Phase 4. 플랫폼 현대화

제품 방향이 확정되면 그때 도구 체인을 현대화한다.

추천:

- CRA/CRACO -> Vite
- TypeScript 4.9 -> 5.x
- React 18 유지 후 안정화, 이후 필요 시 업그레이드
- Jest 중심 테스트를 Vitest/Playwright 혼합 체계로 재정비 가능

중요:

- Phase 1 부팅 복구 전에 현대화를 같이 하지 않는다
- 먼저 돌아가게 만들고, 그 다음 교체한다

완료 기준:

- 로컬 부팅 속도 개선
- 번들 구성 단순화
- 향후 유지보수자가 쉽게 진입 가능

### Phase 5. 배포 및 운영 분리

토너먼트 전용 제품은 메인 모바일 제품과 따로 운영해야 한다.

해야 할 일:

- 별도 호스팅 경로 또는 별도 서브도메인
- 별도 CI
- 별도 환경 변수
- 별도 배포 문서
- 권한 정책 문서화

예시:

- `tournament.example.com`
- GitHub Actions에서 `app2` 또는 successor workspace 전용 workflow

## 추천 실행 순서

가장 현실적인 순서는 아래와 같다.

1. `app2`를 휴면 제품으로 문서 상태 재정의
2. successor 전략 확정
   - `app2` 직접 복구
   - `tournament-web` 신설
3. Phase 1 부팅 복구
4. 토너먼트 외 기능 제거
5. 토너먼트 전용 데이터 계층 분리
6. 도구 체인 현대화
7. 별도 배포

## 직접 복구와 successor 추출 비교

### A. app2 직접 복구

장점:

- 파일 이동이 적음
- 초기 착수 속도가 빠름
- 기존 UI/라우팅을 그대로 보며 고칠 수 있음

단점:

- 불필요한 과거 기능이 계속 따라옴
- 구조 정리가 늦어짐
- 결국 "다이어트"를 또 해야 함

추천 상황:

- 아주 빠른 내부 데모가 필요할 때

### B. successor 추출

장점:

- 범위를 토너먼트 전용으로 깔끔하게 제한 가능
- 현재 제품과 충돌이 적음
- 기술 부채를 같이 정리 가능

단점:

- 초기 설계와 파일 이동이 더 필요함
- 시작 비용이 조금 더 큼

추천 상황:

- 실제로 다시 운영할 제품을 만들려는 경우

## 최종 권장안

실제 운영 재개를 목표로 한다면 `B. successor 추출`을 권장한다.

즉:

- `app2/`는 휴면 기준본으로 남긴다
- 실제 부활 작업은 `tournament-web/` 같은 새 워크스페이스에서 한다
- `app2`에서는 토너먼트 관련 자산만 선별 이관한다

## 지금 바로 해두면 좋은 최소 조치

아직 재가동을 시작하지 않더라도 아래는 지금 해둘 가치가 크다.

- `app2` 상태 문서 재정의
- 재활성화 범위 명시
- 토너먼트 핵심 파일 목록 확정
- 복구 우선순위 체크리스트 생성
- 현재 빌드 실패 원인을 문서화

## 재가동 체크리스트

- 제품명이 확정되었는가
- 토너먼트 전용 범위가 문서화되었는가
- data source가 독립 구조인지 결정했는가
- 로컬 의존성 설치가 재현 가능한가
- `type-check`, `build`, 핵심 페이지 smoke가 통과하는가
- 메인 모바일 제품과 배포/권한/문서 경계가 분리되었는가

## 한 줄 결론

`app2`는 버릴 레거시가 아니라 `토너먼트 전용 웹 제품의 휴면 시드`로 보는 것이 맞다. 다만 그대로 다시 켜기보다, 토너먼트 기능만 추출한 successor 제품으로 재출발하는 것이 가장 안전하고 유지보수 가능성이 높다.
