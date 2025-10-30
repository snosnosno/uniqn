<!--
  Sync Impact Report

  Version: 1.0.0 (Initial Constitution)
  Created: 2025-10-30

  Changes:
  - ✅ NEW: Initial constitution created with 5 core principles
  - ✅ NEW: TypeScript 타입 안전성 원칙
  - ✅ NEW: 테스트 우선 개발 원칙
  - ✅ NEW: 사용자 경험 일관성 원칙
  - ✅ NEW: 성능 표준 원칙
  - ✅ NEW: 로깅 및 관찰성 원칙
  - ✅ NEW: 품질 게이트 섹션
  - ✅ NEW: 개발 워크플로우 섹션

  Template Updates:
  - ✅ VERIFIED: plan-template.md - Constitution Check section aligns
  - ✅ VERIFIED: spec-template.md - Requirements align with quality standards
  - ✅ VERIFIED: tasks-template.md - Task categorization reflects principles

  No Deferred Items
-->

# UNIQN 프로젝트 헌장

## 핵심 원칙

### I. TypeScript 타입 안전성 (NON-NEGOTIABLE)

**규칙**:
- TypeScript strict mode를 100% 준수해야 합니다
- `any` 타입 사용을 절대 금지합니다
- 모든 함수 매개변수와 반환값에 명시적 타입을 선언해야 합니다
- Firebase 데이터 구조는 명확한 인터페이스로 정의해야 합니다
- 타입 에러가 0개일 때만 배포가 가능합니다

**근거**: 타입 안전성은 런타임 에러를 방지하고, 코드 유지보수성을 향상시키며, 개발자 경험을 개선합니다. `any` 타입은 TypeScript의 이점을 무효화하므로 명시적 타입을 사용해야 합니다.

**검증**:
```bash
npm run type-check  # 에러 0개 필수
```

### II. 테스트 우선 개발

**규칙**:
- 새로운 기능은 테스트를 먼저 작성해야 합니다 (TDD Red-Green-Refactor)
- 핵심 비즈니스 로직은 최소 80% 테스트 커버리지를 유지해야 합니다
- 통합 테스트는 다음 영역을 반드시 포함해야 합니다:
  - 인증 플로우
  - Firebase Firestore 데이터 조작
  - 실시간 구독 (onSnapshot)
  - Context API 상태 관리
- PR 병합 전 모든 테스트가 통과해야 합니다

**근거**: 테스트는 코드 품질의 안전망이며, 리팩토링 시 기존 기능 보호를 보장합니다. 테스트 우선 접근은 설계 개선과 요구사항 명확화를 촉진합니다.

**테스트 레벨**:
- **Unit Tests**: 개별 함수/컴포넌트 (80%+ 커버리지)
- **Integration Tests**: 다중 컴포넌트 상호작용 (70%+ 커버리지)
- **E2E Tests**: 핵심 사용자 플로우 (주요 시나리오 100%)

### III. 사용자 경험 일관성 (NON-NEGOTIABLE)

**규칙**:
- 모든 UI 컴포넌트는 다크모드를 필수로 지원해야 합니다 (`dark:` Tailwind 클래스)
- 사용자 피드백은 Toast 시스템을 사용해야 합니다 (`alert()` 금지)
- 표준 필드명을 일관되게 사용해야 합니다:
  - `staffId` (dealerId 사용 금지)
  - `eventId` (jobPostingId 사용 금지)
- 다국어 지원: 모든 사용자 대면 텍스트는 i18n 키를 사용해야 합니다 (하드코딩 금지)
- 로딩 상태와 에러 상태를 명확하게 표시해야 합니다

**근거**: 일관된 사용자 경험은 앱의 전문성과 사용성을 향상시킵니다. 다크모드는 접근성과 사용자 선호도를 지원하며, 표준 필드명은 코드 가독성과 유지보수성을 높입니다.

**다크모드 패턴**:
```tsx
// ✅ 올바른 예시
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <p className="text-gray-600 dark:text-gray-300">텍스트</p>
</div>

// ❌ 금지된 예시
<div className="bg-white text-gray-900">  // dark: 없음
```

### IV. 성능 표준

**규칙**:
- 프로덕션 번들 크기는 350KB 이하를 유지해야 합니다
- 메모이제이션을 활용해야 합니다:
  - `React.memo`: 리렌더링 방지가 필요한 컴포넌트
  - `useMemo`: 비용이 큰 계산
  - `useCallback`: 자식 컴포넌트에 전달되는 함수
- Firebase 실시간 구독은 `onSnapshot`을 사용해야 합니다
- 대용량 리스트는 가상화(virtualization)를 적용해야 합니다
- 코드 스플리팅을 활용하여 초기 로드 시간을 최소화해야 합니다

**근거**: 성능은 사용자 경험의 핵심 요소입니다. 느린 앱은 사용자 이탈을 초래하며, 모바일 환경에서 특히 중요합니다.

**성능 목표**:
- 초기 로드: < 3초 (3G 네트워크)
- Time to Interactive: < 5초
- First Contentful Paint: < 1.5초
- 번들 크기: < 350KB (gzip)

**검증**:
```bash
npm run build  # 번들 크기 확인
npm run analyze  # 번들 분석
```

### V. 로깅 및 관찰성

**규칙**:
- `console.log`, `console.error` 직접 사용을 금지합니다
- `logger` 유틸리티를 반드시 사용해야 합니다
- 로그 레벨을 적절히 사용해야 합니다:
  - `logger.error`: 에러 및 예외 상황
  - `logger.warn`: 경고 및 주의 사항
  - `logger.info`: 중요 이벤트 및 상태 변경
  - `logger.debug`: 디버깅 정보 (개발 환경만)
- 에러 로그에는 충분한 컨텍스트를 포함해야 합니다
- 민감한 정보(비밀번호, 토큰 등)는 절대 로깅하지 않습니다

**근거**: 구조화된 로깅은 프로덕션 환경에서의 문제 진단을 가능하게 하며, 보안과 규정 준수를 지원합니다. `console.*` 직접 사용은 프로덕션 환경에서 제어가 불가능합니다.

**로깅 패턴**:
```typescript
// ✅ 올바른 예시
logger.info('데이터 처리 완료', { staffId, count: results.length });
logger.error('API 호출 실패', { error, endpoint, payload });

// ❌ 금지된 예시
console.log('Debug:', data);  // logger 사용
```

## 품질 게이트

모든 코드는 다음 게이트를 통과해야 배포 가능합니다:

### Gate 1: 타입 안전성
```bash
npm run type-check  # TypeScript 에러 0개
```

### Gate 2: 코드 품질
```bash
npm run lint  # ESLint 에러 0개
```

### Gate 3: 테스트
```bash
npm run test  # 모든 테스트 통과
npm run test:coverage  # 커버리지 ≥ 65%
```

### Gate 4: 빌드
```bash
npm run build  # 프로덕션 빌드 성공
# 번들 크기 ≤ 350KB
```

### Gate 5: 모바일 동기화 (해당 시)
```bash
npx cap sync  # Capacitor 동기화 성공
```

## 개발 워크플로우

### 기능 개발 프로세스

1. **설계**: Spec 작성 및 리뷰
2. **테스트 작성**: 실패하는 테스트 먼저 작성 (Red)
3. **구현**: 테스트를 통과하도록 구현 (Green)
4. **리팩토링**: 코드 품질 개선 (Refactor)
5. **품질 게이트**: 5개 게이트 모두 통과
6. **코드 리뷰**: 헌장 준수 확인
7. **배포**: Production 또는 Staging

### 코드 리뷰 체크리스트

리뷰어는 다음을 반드시 확인해야 합니다:

- [ ] TypeScript strict mode 준수 (`any` 타입 없음)
- [ ] 테스트 커버리지 기준 충족
- [ ] 다크모드 적용 (`dark:` 클래스)
- [ ] 표준 필드명 사용 (`staffId`, `eventId`)
- [ ] `logger` 사용 (`console.*` 없음)
- [ ] Toast 시스템 사용 (`alert()` 없음)
- [ ] i18n 키 사용 (하드코딩 없음)
- [ ] 메모이제이션 적용 (필요 시)
- [ ] 모든 품질 게이트 통과

### 커밋 컨벤션

```
<타입>: <제목>

feat: 새로운 기능
fix: 버그 수정
refactor: 리팩토링
style: 스타일 (다크모드 등)
docs: 문서 수정
test: 테스트 추가/수정
chore: 기타 변경
```

## 거버넌스

### 헌장 우선순위

이 헌장은 모든 다른 개발 관행보다 우선합니다. 헌장과 충돌하는 기존 코드는 점진적으로 수정되어야 합니다.

### 예외 처리

헌장 원칙의 예외는 다음 조건에서만 허용됩니다:
1. 기술적 제약으로 인한 불가피한 경우
2. 명확한 근거와 문서화
3. 팀 리드의 승인
4. 기술 부채 백로그에 등록

### 헌장 개정

헌장 개정은 다음 프로세스를 따릅니다:
1. 개정 제안서 작성 (근거 포함)
2. 팀 리뷰 및 토론
3. 승인 후 버전 업데이트:
   - **MAJOR**: 원칙 제거 또는 재정의 (하위 호환 불가)
   - **MINOR**: 새 원칙 추가 또는 섹션 확장
   - **PATCH**: 명확화, 오타 수정, 비의미적 개선
4. 영향받는 템플릿 및 문서 업데이트
5. 기존 코드 마이그레이션 계획 수립

### 준수 검증

- 모든 PR은 헌장 준수를 검증받아야 합니다
- 자동화된 품질 게이트는 CI/CD 파이프라인에 통합되어야 합니다
- 월간 헌장 준수 리뷰를 실시해야 합니다

### 추가 가이던스

일상적인 개발 지침은 `CLAUDE.md`를 참조하세요. 이 문서는 헌장의 원칙을 구체적인 개발 관행으로 확장한 것입니다.

---

**Version**: 1.0.0 | **Ratified**: 2025-09-10 | **Last Amended**: 2025-10-30
