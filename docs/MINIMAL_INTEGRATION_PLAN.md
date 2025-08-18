# T-HOLDEM 최소 통합 계획

## 📌 목표
**기존 구조 유지 + 최소한의 통합만 진행**
- 새로운 기능 추가 ❌
- 대규모 개편 ❌  
- 단순 중복 제거와 통합만 ✅

## 🎯 핵심 통합 사항

### 1. staff + applicants → persons (단순 통합)
```typescript
// 기존 구조 그대로, 단지 하나의 컬렉션으로 통합
interface Person {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: 'staff' | 'applicant';  // 구분용 필드만 추가
  
  // 기존 staff 필드들
  role?: string;
  bankName?: string;
  accountNumber?: string;
  
  // 기존 applicant 필드들
  availableRoles?: string[];
  applicationHistory?: string[];
}
```

### 2. workLogs 구조 유지 (최소 수정)
```typescript
// 기존 workLog 구조 그대로 유지
// 단지 같은 날짜에 여러 개 생성 가능하도록만 변경
interface WorkLog {
  id: string;
  staffId: string;  // persons.id 참조로 변경
  date: string;
  role: string;  // 세션별 역할 지정
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  // 기존 필드 모두 유지
}
```

### 3. 기존 컬렉션 유지
- `jobPostings` - 그대로 유지
- `attendanceRecords` - 그대로 유지
- `applications` - 그대로 유지 (personId 참조만 변경)

## 🔧 최소 수정 사항

### 컴포넌트 수정
```typescript
// StaffCard.tsx - 최소 수정
// persons 컬렉션에서 읽도록만 변경
const person = persons.find(p => p.id === staffId);
const isStaff = person?.type === 'staff';

// useStaffManagement.ts - 쿼리만 변경
query(collection(db, 'persons'), where('type', '==', 'staff'))
```

### 호환성 유지
```typescript
// 기존 인터페이스 유지
type Staff = Person & { type: 'staff' };
type Applicant = Person & { type: 'applicant' };

// 기존 필드명 유지
const staffId = person.id;  // 변경 없음
const dealerId = person.id;  // deprecated but working
```

## ⏱️ 구현 일정 (5일)

### Day 1: 데이터 통합
- staff + applicants 데이터를 persons로 복사
- type 필드로 구분

### Day 2: 참조 변경
- staffId, applicantId → personId 참조 변경
- 기존 필드명은 alias로 유지

### Day 3: 컴포넌트 수정
- StaffCard, useStaffManagement 최소 수정
- 쿼리만 persons로 변경

### Day 4: WorkLog 다중 세션
- 같은 날짜 여러 workLog 생성 가능하도록 수정
- UI에서 여러 세션 표시

### Day 5: 테스트
- 기존 기능 정상 동작 확인
- 호환성 테스트

## ✅ 장점
- **최소 변경**: 기존 코드 90% 유지
- **빠른 구현**: 5일 내 완료
- **낮은 리스크**: 구조 변경 최소화
- **즉시 효과**: 중복 데이터 제거

## ❌ 하지 않는 것
- 새로운 기능 추가
- 복잡한 구조 변경
- 자동화 시스템
- 불필요한 최적화

## 📊 예상 결과

| 항목 | 기존 | 통합 후 |
|------|------|---------|
| 컬렉션 수 | 6개 | 5개 |
| 중복 데이터 | 있음 | 없음 |
| 코드 변경량 | - | 10% |
| 구현 기간 | - | 5일 |

## 🚀 즉시 시작 가능
출시 전이라 데이터가 없으므로 바로 구현 가능합니다.