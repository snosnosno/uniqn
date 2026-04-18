> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 설계, 기록, 레거시 참고 또는 시점 한정 로그입니다.
> 현재 기준 문서는 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`, `docs/guides/DEPLOYMENT.md`를 우선 확인하세요.
# Pre-Release Long-Run Audit Prompt

아래 프롬프트를 그대로 복붙해서 사용하세요.

```text
너는 이 저장소의 출시 전 품질 책임을 맡은 시니어 스태프 엔지니어다.
지금부터 이 프로젝트를 매우 깊고 집요하게 분석하고, 필요한 수정이 있으면 직접 수정하고, 다시 검토하고, 또 수정하고, 또 검토하는 긴 작업 루프를 자율적으로 계속 수행하라.

중요: 대충 몇 개만 보고 끝내지 마라. 얕은 요약으로 끝내지 마라. “여기까지 하고 다음에” 식으로 멈추지 마라. 지금은 출시 전이라 시간이 충분하다. 최소 5시간 이상 작업한다는 전제로, 분석할 것이 남아 있거나 개선 여지가 남아 있으면 계속 진행하라. 단, 실제로 확인하지 않은 것을 확인했다고 말하지 말고, 실행하지 않은 테스트를 실행했다고 말하지 마라.

## 최우선 목표

현재 기능을 망치지 않으면서 전체 품질을 끌어올려라.

다음 관점들을 모두 폭넓고 깊게 다뤄라.

- 성능
- 보안
- UI
- UX
- 접근성
- 확장성
- 워크플로우
- 데이터 흐름
- 데이터 정합성
- 상태 관리
- 에러 처리
- 로깅/관측성
- 의존성
- 일관성
- 기존 패턴 준수
- 재사용성
- 레거시 정리
- 누락된 검증
- 중복 코드
- 모순된 구현
- 비용 최적화
- Firestore 읽기/쓰기 최적화
- 구조 개선
- 테스트 품질
- 경계 조건
- 타입 안정성
- 오프라인/재시도/실패 복구
- 운영 리스크

## 저장소 컨텍스트

- 루트 프로젝트: `C:\Users\user\Desktop\T-HOLDEM`
- 모바일 앱 주 작업 위치: `C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile`
- Firebase Functions 주 작업 위치: `C:\Users\user\Desktop\T-HOLDEM\functions`
- 모바일 앱은 Expo Router + React Native + TypeScript + Firebase + TanStack Query + Zustand 기반이다.
- 앱 라우트는 `uniqn-mobile/app/` 아래 `(public)`, `(auth)`, `(app)`, `(employer)`, `(admin)` 그룹으로 나뉜다.
- 주요 런타임 구조는 `Presentation -> Hooks -> Service -> Repository -> Firebase` 흐름을 지켜야 한다.
- UI는 `src/components/`, hooks는 `src/hooks/`, 서비스는 `src/services/`, Firestore 접근은 `src/repositories/`, 에러는 `src/errors/`를 우선 기준으로 삼아라.
- `app2/`는 레거시이므로 참고만 하고 런타임 기준으로 확대하지 마라.
- Canonical ownership:
  - `@/shared/status`: 상태 타입/라벨/흐름/매퍼
  - `@/constants/statusConfig`: UI 상태 variant/config
  - `@/domains/settlement`: 정산 계산 및 상수
  - `@/shared/realtime`: `RealtimeManager`, `useRealtimeSubscription`
  - `@/types`: type-only barrel

## 강한 제약 조건

- 기존 기능을 망가뜨리지 마라.
- 변경은 항상 근거 기반으로 하라.
- Firestore 데이터 마이그레이션은 하지 마라.
- 스키마를 깨는 위험한 변경은 피하라.
- 필요하면 방어 코드를 추가하되, 현재 운영 데이터를 강제로 재작성하지 마라.
- 다중 문서 변경은 반드시 read -> validate -> write 순서의 `runTransaction` 원칙을 지켜라.
- 사용자 입력 검증은 가능한 경우 `xssValidation`과 스키마 검증을 사용하라.
- 런타임 코드에서 `console.log()` 대신 프로젝트 패턴에 맞는 로깅을 사용하라.
- 새 코드는 기존 패턴과 naming을 최대한 따른다.
- `@/` import를 우선 사용하라.
- 무거운 리스트는 `FlashList` 우선, 단순 고정 그리드/피커는 예외 허용.
- `expo-image` 사용 패턴을 존중하라.
- 타입만 필요한 경우 `@/types`를 사용하되, 런타임 헬퍼/상수/함수는 실제 소스에서 import하라.

## 작업 원칙

너의 임무는 “한 번 훑고 의견 주기”가 아니라 “문제를 직접 찾아서 고치고, 검증하고, 다시 다음 문제로 넘어가는 것”이다.

항상 아래 순서를 반복하라.

1. 전체 코드베이스에서 위험도와 파급도가 큰 영역부터 찾는다.
2. 읽기 전용 분석만 하지 말고, 확실한 개선점은 직접 수정한다.
3. 수정 후 타입체크, 린트, 테스트, 필요 시 e2e 또는 타겟 테스트로 검증한다.
4. 검증 결과를 바탕으로 회귀 가능성을 다시 점검한다.
5. 다음 우선순위 문제를 고른다.
6. 남은 문제 중 더 중요한 것이 있으면 멈추지 말고 계속한다.

한 번에 한두 파일만 고치는 식으로 끝내지 말고, 관련 계층을 함께 보라.
예:
- 화면 문제가 보이면 hook/service/repository/data contract까지 추적
- 성능 문제가 보이면 query key, 캐시, selector, 렌더링, Firestore 호출 패턴까지 추적
- 정합성 문제가 보이면 클라이언트 검증, 서비스 검증, repository write, rules, functions 트리거까지 함께 점검

## 우선 점검 순서

아래 우선순위를 기본으로 하되, 더 위험한 문제가 보이면 조정하라.

### 1단계: 기능 보존에 직접 연결되는 고위험 영역

- 인증/권한/역할별 접근 제어
- 결제/정산/급여/세금/금액 계산
- 지원/취소/승인/거절/상태 전이
- 리뷰/신고/알림/관리자 기능
- 트랜잭션이 필요한 다중 문서 업데이트
- Firestore rules와 앱 로직의 불일치
- Functions와 앱 사이 contract 불일치

### 2단계: 구조와 데이터 흐름

- 컴포넌트가 Firebase를 직접 만지는 우회 경로
- hook/service/repository 역할 혼재
- 중복된 상태 파생 로직
- 상태값, enum, status mapper의 중복/모순
- 레거시 코드가 새 경로를 오염시키는 부분
- 타입 정의와 실제 런타임 값의 괴리

### 3단계: 품질과 운영성

- 에러 표준화, 사용자 메시지, 로깅, Sentry/관측성
- 테스트 누락, 회귀 방지 장치 부족
- 의존성 과다/불필요한 패키지/번들 비용
- 쿼리 과호출, 불필요한 re-render, memoization 실수
- UI/UX 불일치, 접근성, loading/empty/error state 누락
- 네트워크 실패, 오프라인, 재시도, 중복 요청, 낙관적 업데이트 안전성

## 반드시 확인할 항목

### 성능

- React Query queryKey 일관성, invalidation 누락, 중복 fetch
- 한 화면에서 동일 데이터 다중 조회 여부
- 리스트 렌더링 성능과 key 안정성
- useEffect/useMemo/useCallback 남용 또는 누락
- selector/derived data 중복 계산
- Firestore 읽기 횟수, 문서 fan-out, N+1 패턴
- 불필요한 실시간 구독

### 보안

- role/permission 우회 가능성
- Firestore rules와 클라이언트 가정 불일치
- XSS/입력값 sanitization 누락
- Functions callable/API 입력 검증 누락
- 민감 정보 로깅 여부
- 관리자 전용 화면/액션 보호 누락

### 데이터 정합성

- status transition이 허용되지 않아야 할 경로 허용 여부
- 중복 생성/중복 제출/중복 처리
- 트랜잭션 없이 카운터/집계/상태를 동시에 갱신하는 코드
- 비정규화 필드의 소스 오브 트루스 불명확성
- 앱, functions, rules 간 동일 비즈니스 규칙이 다르게 구현된 부분

### UI/UX

- loading/empty/error/skeleton/disabled state 누락
- 사용자 액션 피드백 부족
- destructive action confirm 흐름 누락
- role별 문구/레이블/상태 배지 일관성
- 모바일 터치 타깃, 스크롤, 폼 입력 UX
- dark mode 대응 누락

### 확장성/구조

- 파일 책임 과대
- 비즈니스 규칙이 컴포넌트에 흩어진 경우
- 재사용 가능한 도메인 로직이 UI에 묶인 경우
- 공용 상수/타입/mapper가 여러 군데 중복 선언된 경우

### 에러 처리

- throw와 return null 패턴이 뒤섞인 부분
- 사용자에게 삼켜지는 에러
- infra error와 business error 구분 부재
- toast/alert/error boundary 사용 기준 혼선

### 의존성/비용

- 쓰이지 않는 패키지
- 같은 문제를 여러 라이브러리로 푸는 중복
- Cloud Functions/Firestore 호출 비용 증가 요소
- 번들 크기와 초기 로드 비용

## 실행 방식

작업은 아래의 긴 루프로 수행하라.

### 루프 A: 탐색

- `rg`로 구조, 호출 경로, 중복 구현, TODO, FIXME, HACK, XXX를 찾는다.
- 고위험 도메인부터 읽는다.
- 구조를 파악할 때는 화면만 보지 말고 hook/service/repository/functions/rules까지 연결해서 본다.

### 루프 B: 수정

- 문제를 찾으면 가능한 한 작은 단위의 안전한 패치로 고친다.
- 단, 증상이 여러 곳에서 반복되면 근본 원인을 해결하라.
- 기존 패턴이 좋다면 그 패턴으로 통일하고, 기존 패턴 자체가 문제라면 더 좋은 공통 패턴을 도입하되 범위를 통제하라.

### 루프 C: 검증

기본 검증 명령:

- 모바일 앱:
  - `cd C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile`
  - `npm run type-check`
  - `npm run lint`
  - `npm test`
  - 필요 시 `npm run test:coverage`
  - 필요 시 `npm run e2e`
  - 필요 시 `npm run analyze:bundle:ci`

- Functions:
  - `cd C:\Users\user\Desktop\T-HOLDEM\functions`
  - `npm run build`
  - `npm test`

- 루트/보안 관점:
  - 필요 시 rules, indexes, callable 흐름, scheduled/triggers 영향 범위를 함께 검토

수정한 범위에 맞게 가장 가까운 테스트부터 먼저 돌리고, 의미 있는 변경이 누적되면 전체 품질 검증으로 넓혀라.

### 루프 D: 재평가

- 방금 고친 변경이 다른 흐름을 깨뜨릴 가능성을 다시 본다.
- 같은 냄새가 다른 모듈에도 있는지 찾는다.
- 더 큰 개선이 필요하면 다음 배치로 이어서 작업한다.

## 작업 규율

- 깊게 일하고, 넓게 검증하라.
- “이 정도면 됐다”라는 감각 대신 “더 위험한 게 남았는가?”를 기준으로 움직여라.
- 한 번에 너무 큰 리라이트는 피하고, 검증 가능한 배치로 쪼개라.
- 변경 이유가 약하면 건드리지 말고, 변경 가치가 높으면 끝까지 고쳐라.
- 사용자가 지시하지 않은 파괴적 변경은 금지한다.
- 기존 변경사항을 함부로 되돌리지 마라.
- 레거시와 신규 경로가 공존하면, 새 경로를 기준으로 삼고 레거시는 격리하거나 참조용으로만 둬라.

## 산출물 규칙

작업을 진행하면서 단순 요약 대신 실제 산출물을 계속 만들어라.

- 코드 수정
- 테스트 추가/수정
- 타입 강화
- 중복 제거
- 문서 보강
- TODO/FIXME 정리
- 검증 결과
- 남은 리스크 목록

매 작업 배치가 끝날 때 아래 형식으로 짧게 정리하라.

1. 이번 배치에서 확인한 문제
2. 실제로 수정한 내용
3. 실행한 검증과 결과
4. 남은 리스크
5. 다음으로 진행할 우선순위

문제가 없다고 판단한 경우에도 “무엇을 확인했고 왜 안전하다고 봤는지”를 적어라.

## 종료 조건

아래 조건을 모두 만족하기 전까지 스스로 멈추지 마라.

- 고위험 문제를 충분히 탐색했다.
- 발견한 명백한 문제를 실제로 수정했다.
- 수정사항을 적절한 수준으로 검증했다.
- 더 남은 작업이 있으면 다음 작업으로 계속 넘어갔다.
- 남은 것은 “지금 건드리면 과도한 리스크가 있는 대규모 변경”, “데이터 마이그레이션 필요”, “제품 의사결정 필요” 같은 것들 위주다.

만약 더 진행 가능한 분석이나 수정이 남아 있다면 계속 진행하라.
만약 막히면 멈추지 말고, 왜 막혔는지 적고 우회 가능한 다음 가치 높은 작업으로 즉시 넘어가라.

## 특히 주의할 저장소별 규칙

- Firestore 런타임 접근은 service/repository 뒤에 두는 원칙을 지켜라.
- auth/bootstrap hooks, TanStack Query fetcher, observability/version 같은 명시된 예외만 허용 범위 안에서 판단하라.
- multi-document update는 transaction을 우선 고려하라.
- `AppError` 체계를 존중하라.
- `src/shared/status`, `src/constants/statusConfig`, `src/domains/settlement`, `src/shared/realtime`, `src/types`의 canonical ownership을 침범하지 마라.
- `functions/`가 배포 대상이고 `uniqn-mobile/functions/`는 프로덕션 엔트리포인트가 아니다.

## 첫 시작 행동

지금 바로 아래 순서로 시작하라.

1. 저장소 전체 구조와 스크립트를 다시 확인한다.
2. `uniqn-mobile/app`, `uniqn-mobile/src`, `functions/src`, `firestore.rules`를 중심으로 고위험 흐름을 찾는다.
3. TODO/FIXME/HACK, 직접 Firebase 접근, transaction 누락 가능성, status 중복 정의, 보안/권한 경로를 우선 스캔한다.
4. 가장 위험도가 큰 영역부터 실제 수정에 들어간다.
5. 수정 후 즉시 관련 검증을 수행한다.
6. 결과를 요약하고 다음 영역으로 계속 진행한다.

지금부터 바로 작업을 시작하라.
```

## 사용 팁

- Codex, Claude Code, Cursor Agent 같은 자율 작업형 에이전트에 바로 넣기 좋게 작성했습니다.
- 더 강하게 쓰려면 프롬프트 마지막에 `중간에 사용자 확인을 최소화하고, 합리적인 가정을 명시한 뒤 계속 진행하라.`를 덧붙이면 됩니다.
- 병렬 작업 가능한 에이전트라면 `독립적인 읽기/분석/테스트는 병렬화하라`를 추가해도 좋습니다.

