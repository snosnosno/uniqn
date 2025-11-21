# Feature Specification: Phase 3 통합 - DateFilter 마이그레이션 & 유틸리티 리팩토링

**Feature Branch**: `002-phase3-integration`
**Created**: 2025-11-20
**Status**: Draft
**Input**: User description: "Phase 3 통합: DateFilter 마이그레이션 + 유틸리티 리팩토링 - 프로젝트: T-HOLDEM (app2/) - 목표: 남은 Context 제거 및 코드 품질 개선"

## Clarifications

### Session 2025-11-20

- Q: 날짜 유틸리티 함수의 에러 처리 전략 - 잘못된 입력 시 예외를 던지는지, null을 반환하는지? → A: null 반환 + logger 경고 (프로덕션 안정성, TypeScript null 체크 활용, 앱 크래시 방지)

- Q: localStorage 마이그레이션 전략 - 기존 `tournament_selected_date` 키(단순 문자열)와 Zustand persist(객체 구조)의 호환성 문제를 어떻게 처리할 것인가? → A: 새로운 키 사용 + 기존 데이터 무시 (구현 단순성 우선, 사용자는 페이지 새로고침 시 날짜 재선택 필요)

- Q: 날짜 유틸리티 마이그레이션 범위 - 5개 파일(점진적) vs 15개 파일(목표 달성) vs 20개 파일(완전 제거) 중 어느 범위로 진행할 것인가? → A: 20개 파일 전체 마이그레이션 (중복 코드 완전 제거, 29회 → 0회, 향후 유지보수 최소화 우선)

- Q: 날짜 포맷 함수 설계 - 날짜만 지원(YYYY-MM-DD) vs 포맷 옵션 지원(날짜+시간) 중 어느 방식을 채택할 것인가? → A: 포맷 옵션 지원 (`formatDate(date, 'date' | 'datetime')`) - 향후 확장성 확보, 다양한 케이스 대응 가능

- Q: FormUtils 우선순위 - FR-016(`createFormHandler()`)이 필수 요구사항인데 Out of Scope에서는 선택 사항으로 명시되어 충돌함. Phase 3에 포함할 것인가? → A: Phase 3에 포함 (완전한 유틸리티 세트 구축, 폼 처리 코드 중복 제거, 작업 시간 0.5-1일 추가 예상)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - DateFilter 상태 관리 중앙화 (Priority: P1)

개발자가 날짜 필터 상태를 사용할 때, Context API 대신 Zustand Store를 통해 더 간단하고 효율적으로 접근할 수 있어야 합니다. localStorage 연동은 자동으로 유지되어 사용자가 페이지를 새로고침해도 선택한 날짜가 보존됩니다.

**Why this priority**: DateFilter는 6개 파일에서 사용되며 토너먼트 페이지의 핵심 기능입니다. Context 제거는 Phase 3의 주요 목표이며, 다른 작업들의 기반이 됩니다.

**Independent Test**:
- TablesPage에서 날짜를 선택하고 ParticipantsPage로 이동했을 때 선택한 날짜가 유지되는지 확인
- 브라우저를 새로고침했을 때 localStorage에서 날짜가 복원되는지 확인
- DateNavigator의 이전/다음/오늘 버튼이 정상 작동하는지 확인

**Acceptance Scenarios**:

1. **Given** 사용자가 TablesPage에서 날짜를 선택했을 때, **When** ParticipantsPage로 이동하면, **Then** 동일한 날짜가 선택되어 있어야 함
2. **Given** 사용자가 날짜를 선택하고 브라우저를 새로고침했을 때, **When** 페이지가 다시 로드되면, **Then** 이전에 선택한 날짜가 자동으로 복원되어야 함
3. **Given** 사용자가 DateNavigator를 사용할 때, **When** "다음" 버튼을 클릭하면, **Then** 다음 토너먼트 날짜로 이동해야 함
4. **Given** 오늘 날짜에 토너먼트가 없을 때, **When** "오늘" 버튼을 클릭하면, **Then** 오늘과 가장 가까운 미래 토너먼트 날짜로 이동해야 함

---

### User Story 2 - 날짜 포맷팅 중복 제거 (Priority: P2)

개발자가 날짜를 문자열로 변환할 때, 20개 파일에서 반복되는 `toISOString().split('T')[0]` 패턴 대신 명확한 유틸리티 함수를 사용할 수 있어야 합니다. 이는 코드 가독성과 유지보수성을 향상시킵니다.

**Why this priority**: 29회 사용되는 가장 많이 중복된 패턴입니다. 날짜 처리는 버그가 발생하기 쉬운 영역이므로 중앙화된 유틸리티로 일관성을 확보하는 것이 중요합니다.

**Independent Test**:
- 기존 `toISOString().split('T')[0]` 패턴을 사용하는 5개 파일을 선택
- 유틸리티 함수로 교체 후 기존과 동일한 결과가 나오는지 단위 테스트로 검증
- TypeScript strict mode에서 타입 에러가 없는지 확인

**Acceptance Scenarios**:

1. **Given** 개발자가 Date 객체를 YYYY-MM-DD 형식으로 변환해야 할 때, **When** `formatDate(date, 'YYYY-MM-DD')`를 호출하면, **Then** 정확한 ISO 날짜 문자열이 반환되어야 함
2. **Given** 개발자가 날짜 문자열의 유효성을 검증해야 할 때, **When** `isValidDate(dateString)`을 호출하면, **Then** 유효한 날짜이면 true, 아니면 false가 반환되어야 함
3. **Given** 기존 코드에서 날짜 변환 로직이 있을 때, **When** 유틸리티 함수로 교체하면, **Then** 기존과 동일한 결과가 나와야 함
4. **Given** 잘못된 형식의 날짜 문자열을 입력했을 때, **When** 유틸리티 함수를 호출하면, **Then** 명확한 에러 메시지와 함께 예외가 발생해야 함

---

### User Story 3 - Firebase 에러 처리 표준화 (Priority: P3)

개발자가 Firebase 에러를 처리할 때, 각 파일마다 다른 방식으로 처리하는 대신 표준화된 유틸리티를 사용하여 일관된 사용자 메시지를 제공할 수 있어야 합니다.

**Why this priority**: Firebase 에러는 20개 파일에서 처리되지만, 날짜 처리보다 덜 빈번하게 변경됩니다. 표준화는 중요하지만 우선순위는 상대적으로 낮습니다.

**Independent Test**:
- 권한 거부 시나리오를 시뮬레이션하여 `isPermissionDenied()` 함수가 정확히 감지하는지 검증
- 다양한 Firebase 에러 코드에 대해 `getFirebaseErrorMessage()`가 사용자 친화적인 한국어/영어 메시지를 반환하는지 확인

**Acceptance Scenarios**:

1. **Given** Firebase 권한 거부 에러가 발생했을 때, **When** `isPermissionDenied(error)`를 호출하면, **Then** true가 반환되어야 함
2. **Given** Firebase 에러가 발생했을 때, **When** `getFirebaseErrorMessage(error)`를 호출하면, **Then** 사용자가 이해할 수 있는 한국어 메시지가 반환되어야 함
3. **Given** 알 수 없는 Firebase 에러가 발생했을 때, **When** 에러 메시지를 요청하면, **Then** "일시적인 오류가 발생했습니다. 다시 시도해주세요." 같은 기본 메시지가 반환되어야 함

---

### Edge Cases

- **빈 날짜 목록**: 토너먼트가 하나도 없을 때 DateFilter는 어떻게 동작하는가? (빈 배열 반환, 초기 선택 없음)
- **localStorage 실패**: localStorage가 비활성화되거나 용량이 초과된 경우 날짜 선택은 세션 메모리에만 저장됨
- **잘못된 날짜 형식**: `formatDate()`에 잘못된 형식의 Date 객체나 문자열이 전달되면 명확한 TypeError 발생
- **타임존 차이**: 서버와 클라이언트의 타임존이 다를 때 날짜 경계에서 오차 발생 가능 (UTC 기준으로 통일)
- **동시 업데이트**: 여러 컴포넌트가 동시에 날짜를 변경하려고 할 때 Zustand의 원자적 업데이트로 충돌 방지
- **레거시 Context 호출**: 마이그레이션 완료 후 실수로 Context를 import하면 명확한 에러 메시지 표시 (Context 파일 삭제됨)

## Requirements *(mandatory)*

### Functional Requirements

#### Part 1: DateFilter 마이그레이션

- **FR-001**: 시스템은 Zustand Store를 사용하여 선택된 날짜 상태를 관리해야 함
- **FR-002**: 시스템은 localStorage에 선택된 날짜를 자동으로 저장하고 복원해야 함 (persist 미들웨어 사용)
- **FR-003**: 시스템은 날짜 변경 시 모든 구독 컴포넌트에 즉시 반영해야 함
- **FR-004**: 시스템은 토너먼트가 있는 날짜 목록을 제공해야 함
- **FR-005**: 시스템은 이전/다음/오늘 날짜로 이동하는 함수를 제공해야 함
- **FR-006**: 기존 DateFilterContext를 사용하는 6개 파일이 새로운 Zustand Store를 사용하도록 마이그레이션되어야 함
- **FR-007**: 마이그레이션 완료 후 DateFilterContext.tsx 파일은 삭제되어야 함
- **FR-008**: 기존 API (`selectedDate`, `setSelectedDate`, `goToNextDate`, `goToPreviousDate`, `goToToday`, `availableDates`)는 100% 호환되어야 함

#### Part 2: 유틸리티 생성

- **FR-009**: `formatDate()` 함수는 Date 객체 또는 문자열을 'YYYY-MM-DD' 또는 'YYYY-MM-DD HH:mm' 형식으로 변환해야 함
- **FR-010**: `parseDate()` 함수는 날짜 문자열을 Date 객체로 변환해야 함
- **FR-011**: `isValidDate()` 함수는 주어진 값이 유효한 날짜인지 검증해야 함
- **FR-012**: `toISODateString()` 함수는 기존 `toISOString().split('T')[0]` 패턴을 대체해야 함
- **FR-013**: `getFirebaseErrorMessage()` 함수는 Firebase 에러 코드를 사용자 친화적인 메시지로 변환해야 함
- **FR-014**: `isPermissionDenied()` 함수는 Firebase 권한 거부 에러를 감지해야 함
- **FR-015**: `handleFirebaseError()` 함수는 Firebase 에러를 로깅하고 적절한 사용자 메시지를 제공해야 함
- **FR-016**: `createFormHandler()` 함수는 폼 상태 업데이트를 위한 제네릭 핸들러를 생성해야 함
- **FR-017**: 모든 유틸리티 함수는 TypeScript Generic을 활용하여 타입 안전성을 보장해야 함
- **FR-018**: 20개 파일 전체에서 중복된 날짜 포맷팅 패턴이 유틸리티 함수로 교체되어야 함 (29회 사용 → 0회)

### Key Entities

- **DateFilterStore**: 날짜 필터 상태를 저장하는 Zustand Store
  - `selectedDate`: 현재 선택된 날짜 (YYYY-MM-DD 형식)
  - `availableDates`: 토너먼트가 있는 날짜 목록 (정렬된 배열)
  - `setSelectedDate`: 날짜 설정 함수
  - `goToNextDate`: 다음 날짜로 이동 함수
  - `goToPreviousDate`: 이전 날짜로 이동 함수
  - `goToToday`: 오늘 날짜로 이동 함수

- **DateUtils**: 날짜 처리 유틸리티 모듈
  - `formatDate`: 날짜 포맷팅 함수
  - `parseDate`: 문자열 파싱 함수
  - `isValidDate`: 유효성 검증 함수
  - `toISODateString`: ISO 날짜 문자열 변환 함수

- **FirebaseErrorUtils**: Firebase 에러 처리 유틸리티 모듈
  - `getFirebaseErrorMessage`: 에러 메시지 변환 함수
  - `isPermissionDenied`: 권한 거부 감지 함수
  - `handleFirebaseError`: 에러 핸들링 함수

- **FormUtils**: 폼 처리 유틸리티 모듈
  - `createFormHandler`: 제네릭 폼 핸들러 생성 함수

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: DateFilterContext를 사용하는 6개 파일이 모두 Zustand Store로 마이그레이션되어 기존과 동일하게 작동해야 함
- **SC-002**: localStorage에서 날짜 복원이 100% 정확하게 동작해야 함 (브라우저 새로고침 후 검증)
- **SC-003**: 날짜 포맷팅 중복 패턴이 100% 제거되어야 함 (29회 → 0회, 20개 파일 전체 마이그레이션)
- **SC-004**: 모든 유틸리티 함수의 단위 테스트 커버리지가 80% 이상이어야 함
- **SC-005**: TypeScript strict mode에서 타입 에러가 0개여야 함 (`npm run type-check` 통과)
- **SC-006**: 기존 기능 회귀 테스트가 100% 통과해야 함 (`npm run test` 통과)
- **SC-007**: 프로덕션 빌드가 성공해야 함 (`npm run build` 통과)
- **SC-008**: 코드 중복도가 측정 가능하게 감소해야 함 (20개 파일 전체에서 유틸리티 사용, 중복 완전 제거)

### User Impact

- 개발자가 날짜 필터 상태에 접근할 때 코드 라인 수가 평균 30% 감소 (Context Provider 제거)
- 날짜 처리 버그 발생 가능성이 중앙화된 유틸리티로 인해 감소
- 새로운 개발자가 날짜 처리 로직을 이해하는 시간이 50% 감소 (명확한 유틸리티 함수명)

## Assumptions *(optional)*

1. **Zustand 5.0 설치 완료**: Phase 3-1에서 Zustand가 이미 설치되고 검증되었음
2. **localStorage 사용 가능**: 대부분의 사용자 브라우저에서 localStorage가 활성화되어 있음 (비활성화 시 세션 메모리로 폴백)
3. **날짜 형식 표준**: 모든 날짜는 YYYY-MM-DD (ISO 8601) 형식을 따름
4. **타임존**: 서버와 클라이언트 모두 UTC 기준으로 날짜를 처리함
5. **토너먼트 데이터**: TournamentDataContext가 유효한 토너먼트 목록을 제공함
6. **단계적 마이그레이션**: 한 번에 모든 파일을 변경하지 않고 5개씩 점진적으로 마이그레이션
7. **테스트 환경**: Jest와 React Testing Library가 설정되어 있음
8. **국제화**: 에러 메시지는 한국어 기본, 영어 지원 (i18n 시스템 존재 가정)

## Out of Scope *(optional)*

- **새로운 날짜 기능 추가**: 날짜 범위 선택, 캘린더 UI 등은 포함되지 않음 (기존 기능만 마이그레이션)
- **다른 Context 마이그레이션**: TournamentDataContext, AuthContext 등은 이번 작업에 포함되지 않음
- **성능 최적화**: Zustand 자체의 성능 향상은 부수 효과이지만 주 목표는 아님
- **UI/UX 변경**: 사용자 인터페이스는 변경되지 않음 (내부 구현만 변경)
- **검증 유틸리티**: 이메일, 전화번호 검증은 우선순위가 낮아 제외 (날짜, Firebase, 폼만 포함)
- **E2E 테스트**: 단위 테스트와 통합 테스트만 포함, Playwright E2E는 Phase 3 완료 후 별도 작업

## Dependencies *(optional)*

- **Phase 3-1 완료**: Zustand Store (unifiedDataStore) 마이그레이션이 완료되어 패턴 참고 가능
- **TournamentDataContext**: 토너먼트 목록을 제공하는 Context (마이그레이션 대상 아님)
- **Logger 시스템**: `utils/logger.ts`가 존재하고 사용 가능해야 함
- **TypeScript 설정**: strict mode가 활성화되어 있어야 함
- **Zustand 5.0**: persist 미들웨어가 포함된 버전
- **Jest & React Testing Library**: 테스트 작성을 위한 환경
- **date-fns 4.1**: 날짜 처리 라이브러리 (유틸리티 구현 시 참고, 필수는 아님)

## Risks & Mitigation *(optional)*

### Risk 1: localStorage 호환성 문제
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Zustand persist 미들웨어는 localStorage 실패 시 자동으로 메모리 스토리지로 폴백
- 기존 DateFilterContext의 localStorage 구조와 동일한 키(`tournament_selected_date`) 사용하여 기존 데이터 호환

### Risk 2: 날짜 직렬화 문제
**Probability**: Medium
**Impact**: High
**Mitigation**:
- Date 객체는 localStorage에 직접 저장할 수 없으므로 문자열(YYYY-MM-DD)로만 저장
- persist 옵션에서 Date 타입 변환 로직 명확히 정의
- 단위 테스트로 직렬화/역직렬화 검증

### Risk 3: 마이그레이션 중 Breaking Changes
**Probability**: Low
**Impact**: High
**Mitigation**:
- 호환성 레이어(`useDateFilter` Hook)로 기존 API 100% 유지
- 한 번에 모든 파일을 변경하지 않고 점진적 마이그레이션
- 각 파일 마이그레이션 후 개별 테스트 실행

### Risk 4: 테스트 커버리지 부족
**Probability**: Medium
**Impact**: Medium
**Mitigation**:
- 각 유틸리티 함수마다 최소 5개 이상의 테스트 케이스 작성
- Edge cases (null, undefined, 잘못된 형식) 필수 테스트
- 기존 회귀 테스트 활용

## Notes *(optional)*

### 기술 참고사항

1. **Zustand persist 설정**:
   ```typescript
   // 날짜 직렬화/역직렬화 예시
   storage: {
     getItem: (name) => {
       const value = localStorage.getItem(name);
       return value ? JSON.parse(value) : null;
     },
     setItem: (name, value) => {
       localStorage.setItem(name, JSON.stringify(value));
     },
     removeItem: (name) => localStorage.removeItem(name),
   }
   ```

2. **호환성 레이어 패턴** (Phase 3-1 참고):
   - `hooks/useDateFilter.ts`가 Zustand Store를 내부적으로 사용
   - 기존 Context API와 동일한 인터페이스 제공
   - 컴포넌트는 변경 최소화

3. **유틸리티 함수 네이밍**:
   - 동사로 시작 (`formatDate`, `parseDate`, `isValidDate`)
   - 명확하고 자기 설명적
   - JSDoc 주석으로 사용 예시 제공

4. **에러 처리**:
   - logger 사용 필수 (`console.log` 금지)
   - 사용자 메시지는 한국어 기본
   - 개발 환경에서는 상세 로그, 프로덕션에서는 간결한 로그

### 성공 사례 참고

- **Phase 3-1**: UnifiedDataContext → Zustand 마이그레이션 성공
  - Context API 완전 제거
  - Batch Actions 성능 32.3배 향상
  - 기존 API 100% 호환 유지
  - 이번 작업도 동일한 패턴 적용

### 작업 순서 권장

1. **Day 1**: DateFilterStore 생성 및 테스트 (Part 1)
2. **Day 2**: 6개 파일 마이그레이션 및 Context 제거 (Part 1)
3. **Day 3**: 날짜 유틸리티 생성 및 테스트 (Part 2)
4. **Day 4-5**: Firebase 유틸리티 생성 및 20개 파일 전체 마이그레이션 (Part 2)
5. **Day 6**: FormUtils 생성 및 테스트 (Part 2)
6. **Day 7**: 통합 테스트, 빌드, 문서화, 최종 검증

**참고**:
- 20개 파일 전체 마이그레이션: 5일 → 6일
- FormUtils 포함: 6일 → 7일 (최종)
