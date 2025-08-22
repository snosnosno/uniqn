# 데이터 동기화 개선 사항

## 개요
스태프 탭, 정산 탭, 정산 모달 간의 데이터 동기화 문제를 해결하여 날짜별, 역할별 데이터가 실시간으로 정확하게 반영되도록 개선했습니다.

## 주요 개선 사항

### 1. 날짜별 WorkLog 관리 체계 구축
- **WorkLog ID 구조**: `eventId_staffId_date` 형식으로 날짜별 고유 관리
- **다중 날짜 지원**: 한 스태프가 여러 날짜에 다른 시간과 역할로 근무 가능
- **예시**:
  - 8/22(금): dealer, 12:00-17:00
  - 8/23(토): floor, 10:00-19:00
  - 8/24(일): dealer, 12:00-21:00

### 2. Timestamp 파싱 통일
- **통합 파싱 함수**: `parseTimeToString()` 함수로 모든 시간 파싱 로직 통일
- **지원 형식**:
  - Firebase Timestamp 객체
  - Date 객체
  - ISO 문자열
  - HH:mm 형식 문자열
- **시간 계산 간소화**: 문자열 기반 분 단위 계산으로 로직 단순화

### 3. 역할별 급여 설정 Firestore 동기화
- **실시간 저장**: 역할별 급여 설정 변경 시 즉시 Firestore에 저장
- **JobPosting 문서 업데이트**:
  ```javascript
  {
    useRoleSalary: true,
    roleSalaries: {
      "dealer": { salaryType: "hourly", salaryAmount: "15000" },
      "floor": { salaryType: "hourly", salaryAmount: "18000" }
    }
  }
  ```

### 4. WorkTimeEditor 역할 정보 추가
- **WorkLog 생성 시 역할 포함**: 새 WorkLog 생성/수정 시 역할 정보 자동 포함
- **날짜별 역할 구분**: 같은 스태프가 다른 날짜에 다른 역할로 근무하는 경우 정확히 구분

### 5. DetailEditModal 개선
- **근무내역 탭**: 날짜별, 역할별 근무 내역 상세 표시
- **역할별 소계**: 여러 역할로 근무한 경우 역할별 근무시간 소계 표시
- **급여계산 탭**: 역할별 급여 계산 내역 표시

## 데이터 흐름

```
스태프 탭 (시간 수정)
    ↓
WorkLog 업데이트 (Firestore)
    ↓
useUnifiedWorkLogs (실시간 구독)
    ↓
JobPostingContextAdapter (중앙 관리)
    ↓
├── 정산 탭 (EnhancedPayrollTab)
│   ├── 역할별 급여 설정
│   ├── 일괄 수당 적용
│   └── 정산 내역 표시
│
└── 정산 모달 (DetailEditModal)
    ├── 기본정보 탭
    ├── 근무내역 탭 (날짜별/역할별)
    └── 급여계산 탭

```

## 기술적 개선

### 1. 컨텍스트 통합
- `JobPostingContextAdapter`에서 `useUnifiedWorkLogs` 훅을 통해 WorkLog 데이터 중앙 관리
- 실시간 동기화 활성화로 모든 컴포넌트가 동일한 데이터 구독

### 2. 타입 안전성
- TypeScript strict mode 준수
- undefined/null 안전한 처리
- 타입 가드 및 기본값 처리

### 3. 성능 최적화
- 메모이제이션 적용 (useMemo, useCallback)
- 중복 WorkLog 처리 방지
- 효율적인 데이터 그룹화 및 집계

## 검증 완료 항목

- ✅ 스태프 탭에서 시간 수정 시 정산 탭에 즉시 반영
- ✅ 역할별 급여 설정이 Firestore에 저장되고 유지됨
- ✅ 날짜별 다른 역할과 시간이 정확히 구분되어 표시
- ✅ 정산 모달에서 날짜별 근무 내역 정확히 표시
- ✅ TypeScript 타입 체크 통과
- ✅ ESLint 검사 통과 (경고만 존재)

## 사용 방법

1. **스태프 탭에서 시간 수정**
   - 스태프 카드의 시간 편집 버튼 클릭
   - 원하는 시간 입력 후 저장

2. **정산 탭에서 역할별 급여 설정**
   - "역할별 급여 설정" 섹션 확장
   - 각 역할별로 급여 유형과 금액 설정
   - 변경사항은 자동으로 Firestore에 저장

3. **정산 모달에서 상세 내역 확인**
   - 정산 탭에서 스태프 행 클릭
   - 근무내역 탭에서 날짜별, 역할별 근무 시간 확인
   - 급여계산 탭에서 역할별 급여 계산 내역 확인

## 주의사항

- WorkLog 문서는 날짜별로 생성되므로 같은 스태프가 여러 날짜에 근무하면 여러 WorkLog 문서가 생성됩니다
- 역할별 급여 설정은 jobPosting 문서에 저장되어 모든 스태프에게 일괄 적용됩니다
- 시간 수정은 scheduledStartTime/scheduledEndTime 필드를 업데이트하며, 실제 출퇴근 시간(actualStartTime/actualEndTime)과는 별개입니다