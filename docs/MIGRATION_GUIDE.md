# 📋 T-HOLDEM 마이그레이션 가이드

> **버전**: v0.2.0 → v0.2.1  
> **작업일**: 2025년 9월 16일  
> **목적**: 대규모 코드 정리 및 폴더 구조 체계화

## 🎯 마이그레이션 개요

v0.2.1에서는 **47개 컴포넌트를 17개로 정리**하고 **10개 카테고리로 체계화**하는 대규모 폴더 구조 개선이 이루어졌습니다.

### 주요 변경사항
- **컴포넌트 파일 65% 감소**: 47개 → 17개
- **카테고리별 폴더 생성**: 10개 전문 폴더
- **Import 경로 100+ 개 수정**: 새로운 폴더 구조 반영
- **중복 컴포넌트 제거**: Input 컴포넌트 통일
- **TODO/FIXME 해결**: 모든 미완성 작업 완료

---

## 📁 폴더 구조 변경사항

### Before (v0.2.0)
```
📁 components/
├── AttendanceStatusCard.tsx
├── AttendanceStatusPopover.tsx
├── CSVUploadButton.tsx
├── DateDropdownSelector.tsx
├── ErrorBoundary.tsx
├── FirebaseErrorBoundary.tsx
├── JobBoardErrorBoundary.tsx
├── TableCard.tsx
├── Seat.tsx
├── TimeIntervalSelector.tsx
├── ... (47개 파일이 루트에 산재)
```

### After (v0.2.1)
```
📁 components/
├── 📁 attendance/        # 출석 관련 (2개)
│   ├── AttendanceStatusCard.tsx
│   └── AttendanceStatusPopover.tsx
├── 📁 errors/           # 에러 처리 (3개)
│   ├── ErrorBoundary.tsx
│   ├── FirebaseErrorBoundary.tsx
│   └── JobBoardErrorBoundary.tsx
├── 📁 tables/           # 테이블 관련 (2개)
│   ├── TableCard.tsx
│   └── Seat.tsx
├── 📁 time/             # 시간 관련 (2개)
│   ├── DateDropdownSelector.tsx
│   └── TimeIntervalSelector.tsx
├── 📁 upload/           # 업로드 (1개)
│   └── CSVUploadButton.tsx
└── ... (기존 카테고리별 폴더들)
```

---

## 🔄 이동된 컴포넌트 매핑

### 새로 생성된 카테고리 폴더

| 원래 위치 | 새 위치 | 카테고리 |
|-----------|---------|----------|
| `AttendanceStatusCard.tsx` | `attendance/AttendanceStatusCard.tsx` | 출석 관리 |
| `AttendanceStatusPopover.tsx` | `attendance/AttendanceStatusPopover.tsx` | 출석 관리 |
| `ErrorBoundary.tsx` | `errors/ErrorBoundary.tsx` | 에러 처리 |
| `FirebaseErrorBoundary.tsx` | `errors/FirebaseErrorBoundary.tsx` | 에러 처리 |
| `JobBoardErrorBoundary.tsx` | `errors/JobBoardErrorBoundary.tsx` | 에러 처리 |
| `TableCard.tsx` | `tables/TableCard.tsx` | 테이블 관련 |
| `Seat.tsx` | `tables/Seat.tsx` | 테이블 관련 |
| `DateDropdownSelector.tsx` | `time/DateDropdownSelector.tsx` | 시간 관련 |
| `TimeIntervalSelector.tsx` | `time/TimeIntervalSelector.tsx` | 시간 관련 |
| `CSVUploadButton.tsx` | `upload/CSVUploadButton.tsx` | 업로드 |

### 제거된 컴포넌트

| 제거된 파일 | 대체 컴포넌트 | 이유 |
|-------------|---------------|------|
| `components/common/Input.tsx` | `components/ui/Input.tsx` | 중복 컴포넌트, ui/Input이 더 기능 풍부 |

---

## 🛠️ Import 경로 변경 가이드

### 변경 패턴

#### 1. 출석 관련 컴포넌트
```typescript
// Before
import AttendanceStatusPopover from '../AttendanceStatusPopover';
import AttendanceStatusCard from './AttendanceStatusCard';

// After
import AttendanceStatusPopover from '../attendance/AttendanceStatusPopover';
import AttendanceStatusCard from './attendance/AttendanceStatusCard';
```

#### 2. 에러 처리 컴포넌트
```typescript
// Before
import ErrorBoundary from './components/ErrorBoundary';
import FirebaseErrorBoundary from '../FirebaseErrorBoundary';

// After
import ErrorBoundary from './components/errors/ErrorBoundary';
import FirebaseErrorBoundary from '../errors/FirebaseErrorBoundary';
```

#### 3. 테이블 관련 컴포넌트
```typescript
// Before
import { Seat } from '../Seat';
import TableCard from './TableCard';

// After
import { Seat } from '../tables/Seat';
import TableCard from './tables/TableCard';
```

#### 4. 시간 관련 컴포넌트
```typescript
// Before
import DateDropdownSelector from './DateDropdownSelector';
import TimeIntervalSelector from '../TimeIntervalSelector';

// After
import DateDropdownSelector from './time/DateDropdownSelector';
import TimeIntervalSelector from '../time/TimeIntervalSelector';
```

#### 5. 업로드 컴포넌트
```typescript
// Before
import CSVUploadButton from './CSVUploadButton';

// After
import CSVUploadButton from './upload/CSVUploadButton';
```

#### 6. Input 컴포넌트 통일
```typescript
// Before
import Input from '../common/Input';

// After
import Input from '../ui/Input';
```

---

## ✅ 마이그레이션 체크리스트

### 개발자 작업 목록

#### Phase 1: 환경 준비
- [ ] 현재 작업 중인 변경사항 모두 커밋
- [ ] `git pull origin master`로 최신 코드 받기
- [ ] `npm install`로 의존성 업데이트
- [ ] `npm run type-check`로 현재 상태 확인

#### Phase 2: Import 경로 업데이트
- [ ] **출석 관련**: `AttendanceStatus` import 경로 확인
- [ ] **에러 처리**: `ErrorBoundary` import 경로 확인
- [ ] **테이블**: `Seat`, `TableCard` import 경로 확인
- [ ] **시간**: `DateDropdown`, `TimeInterval` import 경로 확인
- [ ] **업로드**: `CSVUploadButton` import 경로 확인
- [ ] **Input 컴포넌트**: `common/Input` → `ui/Input` 변경

#### Phase 3: 테스트 파일 업데이트
- [ ] `__tests__/` 폴더의 테스트 파일 import 경로 확인
- [ ] Mock 파일 경로 업데이트 필요 시 수정
- [ ] `npm run test`로 테스트 통과 확인

#### Phase 4: 빌드 검증
- [ ] `npm run type-check` → TypeScript 에러 0개 확인
- [ ] `npm run build` → 프로덕션 빌드 성공 확인
- [ ] `npm run lint` → 린트 규칙 준수 확인

#### Phase 5: 기능 테스트
- [ ] 출석 관리 기능 정상 작동 확인
- [ ] 에러 페이지 정상 표시 확인
- [ ] 테이블 레이아웃 정상 렌더링 확인
- [ ] 시간 선택 컴포넌트 정상 작동 확인
- [ ] CSV 업로드 기능 정상 작동 확인

---

## 🚨 주의사항 및 문제 해결

### 일반적인 문제들

#### 1. TypeScript 모듈 찾기 오류
```
Error: Cannot find module '../AttendanceStatusCard'
```
**해결방법**: Import 경로를 새로운 폴더 구조에 맞게 업데이트
```typescript
// 수정 전
import AttendanceStatusCard from '../AttendanceStatusCard';
// 수정 후
import AttendanceStatusCard from '../attendance/AttendanceStatusCard';
```

#### 2. 상대 경로 혼동
```
Error: Cannot find module './ErrorBoundary'
```
**해결방법**: 현재 파일 위치를 기준으로 정확한 상대 경로 계산
```typescript
// components/pages/에서 errors/ 폴더 접근 시
import ErrorBoundary from '../errors/ErrorBoundary';
```

#### 3. Input 컴포넌트 오류
```
Error: Cannot find module '../common/Input'
```
**해결방법**: ui/Input 컴포넌트 사용
```typescript
import Input from '../ui/Input'; // ✅ 올바름
```

#### 4. 테스트 파일 import 오류
**해결방법**: 테스트 파일의 import 경로도 함께 업데이트
```typescript
// __tests__/AttendanceStatusCard.test.tsx
import AttendanceStatusCard from '../attendance/AttendanceStatusCard';
```

### 문제 해결 단계
1. **TypeScript 컴파일 확인**: `npm run type-check`
2. **에러 메시지 분석**: 어떤 모듈을 찾지 못하는지 확인
3. **파일 위치 확인**: 실제 파일이 예상 위치에 있는지 확인
4. **상대 경로 계산**: 현재 파일에서 대상 파일까지의 정확한 경로 계산
5. **빌드 테스트**: 수정 후 반드시 빌드로 검증

---

## 📊 성과 및 효과

### 정량적 개선
- **파일 수 감소**: 47개 → 17개 (65% 감소)
- **TypeScript 에러**: 100+ 개 → 0개 (100% 해결)
- **폴더 카테고리**: 무질서 → 10개 체계적 분류
- **프로덕션 빌드**: 279KB (최적화 완료)

### 정성적 개선
- **개발 효율성**: 컴포넌트 찾기 시간 단축
- **유지보수성**: 카테고리별 분류로 코드 이해도 향상
- **확장성**: 새 컴포넌트 추가 시 명확한 분류 기준
- **일관성**: 프로젝트 전반의 구조 표준화

---

## 🔄 향후 컴포넌트 추가 가이드

### 새 컴포넌트 생성 시 규칙
1. **적절한 카테고리 폴더 확인**: 기존 10개 카테고리 중 적합한 위치
2. **폴더가 없는 경우**: 새 카테고리 폴더 생성 고려
3. **Import 경로 일관성**: 상대 경로 규칙 준수
4. **네이밍 컨벤션**: 기존 파일명 패턴 유지

### 카테고리별 역할 정의
- `attendance/`: 출석, 근무 시간 관련
- `auth/`: 인증, 로그인 관련
- `charts/`: 차트, 그래프 관련
- `errors/`: 에러 처리, 바운더리
- `layout/`: 레이아웃, 페이지 구조
- `modals/`: 모달, 팝업, 다이얼로그
- `staff/`: 스태프 관리, 직원 관련
- `tables/`: 테이블, 좌석 배치
- `time/`: 시간, 날짜 선택
- `upload/`: 파일 업로드, 가져오기

---

## 📞 지원 및 도움

### 마이그레이션 중 문제 발생 시
1. **TypeScript 에러**: `npm run type-check` 결과 확인
2. **빌드 실패**: 에러 메시지의 파일 경로 분석
3. **기능 동작 이상**: 관련 컴포넌트의 import 경로 재확인
4. **테스트 실패**: 테스트 파일의 import 경로 업데이트

### 추가 문서
- **CLEANUP_REPORT.md**: 상세한 작업 내역
- **PROJECT_STATUS.md**: 프로젝트 현황
- **ARCHITECTURE.md**: 새로운 폴더 구조 아키텍처
- **DEVELOPMENT.md**: 컴포넌트 구조 가이드

---

**마이그레이션 완료 후 프로젝트는 더욱 체계적이고 유지보수하기 쉬운 구조가 됩니다! 🎉**

*마지막 업데이트: 2025년 9월 16일*