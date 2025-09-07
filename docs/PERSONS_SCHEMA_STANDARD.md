# persons 컬렉션 스키마 표준화 가이드

**작성일**: 2025년 9월 6일  
**버전**: v1.0  
**목적**: Firebase persons 컬렉션의 데이터 일관성 및 표준화 규칙 정의

## 📋 개요

`persons` 컬렉션은 **지원자가 확정되어 스태프로 등록될 때 생성되는 컬렉션**입니다.
- 기본 스태프 정보 저장
- users 컬렉션과 별도 관리 (통합 불가)
- Staff 타입과 직접 매핑

## 🏗️ 표준 스키마 구조

### 필수 필드 (Required)
```typescript
{
  // 기본 식별 정보
  id: string,              // 문서 ID (자동 생성)
  staffId: string,         // 스태프 고유 ID
  userId: string,          // users 컬렉션과 연결하는 사용자 ID
  name: string,            // 이름
  role: string,            // 역할 (dealer, floor, manager 등)
  type: "staff" | "both",  // persons 컬렉션 필터링용
  
  // 타임스탬프
  createdAt: Timestamp,    // 생성일시
  updatedAt: Timestamp     // 수정일시
}
```

### 선택 필드 (Optional)
```typescript
{
  // 연락처 정보
  phone?: string,          // 전화번호
  email?: string,          // 이메일
  
  // 지원자 확정 시 배정 정보
  assignedRole?: string,   // 확정된 역할
  assignedTime?: string,   // 확정된 시간 (예: "09:00~18:00")
  assignedDate?: string,   // 확정된 날짜 (예: "2025-01-06")
  
  // 원래 지원 정보
  postingId?: string,      // 원래 지원한 공고 ID (사전질문 조회용)
  
  // 추가 개인정보 (users에서 복사된 스냅샷)
  gender?: string,         // 성별 ("male" | "female" | "other")
  age?: number,            // 나이 (숫자 타입)
  experience?: string,     // 경력 (예: "2년")
  nationality?: string,    // 국적 (KR, US, JP 등)
  region?: string,         // 지역 (seoul, gyeonggi 등)
  history?: string,        // 이력
  notes?: string,          // 기타 메모
  
  // 은행 정보
  bankName?: string,       // 은행명
  bankAccount?: string,    // 계좌번호
  residentId?: string      // 주민등록번호 뒷자리
}
```

## 🔧 필드명 표준화 규칙

### ✅ 올바른 필드명 (소문자 camelCase)
```typescript
{
  gender: "male",          // ✅
  age: 25,                 // ✅ (숫자 타입)
  experience: "2년",        // ✅
  nationality: "KR",       // ✅
  bankName: "국민은행",      // ✅
  bankAccount: "123456"    // ✅
}
```

### ❌ 잘못된 필드명 (대문자 시작)
```typescript
{
  Gender: "male",          // ❌ 대문자 시작
  Age: "25",               // ❌ 문자열 타입
  Experience: "2년",       // ❌ 대문자 시작
  Nationality: "KR"        // ❌ 대문자 시작
}
```

## 📊 데이터 타입 규칙

| 필드명 | 타입 | 예시 | 설명 |
|--------|------|------|------|
| `age` | `number` | `25` | 문자열 아닌 숫자 |
| `gender` | `string` | `"male"` | male, female, other |
| `nationality` | `string` | `"KR"` | ISO 국가 코드 |
| `region` | `string` | `"seoul"` | 소문자 지역 코드 |
| `assignedDate` | `string` | `"2025-01-06"` | YYYY-MM-DD 형식 |
| `phone` | `string` | `"010-1234-5678"` | 하이픈 포함 |

## 🔄 데이터 생성 흐름

### 1. 지원자 확정 시 생성
```
applications (지원서) → 확정 → persons (스태프 등록)
```

### 2. 생성 시점 데이터 복사
- users 컬렉션의 개인정보를 스냅샷으로 복사
- 확정 시점의 데이터 보존
- 이후 users 변경과 독립적 관리

### 3. 실시간 정보는 users에서 조회
- 최신 개인정보는 users 컬렉션에서 조회
- persons는 기본 정보 + 스냅샷용

## ⚠️ 주의사항

### 데이터 일관성
1. **필수 필드는 반드시 포함**
   - staffId, userId, name, role, type
   - 누락 시 Staff 타입 변환 오류 발생

2. **타입 일치 필수**
   - age는 반드시 number 타입
   - 문자열로 저장 시 parseInt 변환 필요

3. **필드명 표준화**
   - 모든 필드는 camelCase 사용
   - 대소문자 일치 확인 필수

### 성능 고려사항
1. **인덱스 최적화**
   - type 필드 인덱스 (필터링용)
   - staffId 인덱스 (조회용)
   - createdAt 인덱스 (정렬용)

2. **쿼리 최적화**
   ```typescript
   // ✅ 올바른 쿼리
   query(
     collection(db, 'persons'),
     where('type', 'in', ['staff', 'both']),
     orderBy('name', 'asc')
   )
   ```

## 🧪 검증 방법

### 1. 타입 체크
```typescript
// transformStaffData 함수에서 검증
const staff = transformStaffData(doc);
console.assert(typeof staff.age === 'number', 'age must be number');
console.assert(staff.userId, 'userId is required');
```

### 2. 런타임 검증
```typescript
// 필수 필드 검증
const requiredFields = ['staffId', 'userId', 'name', 'role', 'type'];
requiredFields.forEach(field => {
  if (!doc[field]) {
    logger.warn(`Missing required field: ${field}`, { docId: doc.id });
  }
});
```

## 📚 관련 파일

### 코드 파일
- `types/unifiedData.ts` - Staff 인터페이스 정의
- `services/unifiedDataService.ts` - transformStaffData 함수
- `components/tabs/StaffManagementTab.tsx` - 데이터 변환 로직
- `components/StaffProfileModal.tsx` - 프로필 표시

### 문서 파일
- `docs/DATA_USAGE_MAPPING.md` - 데이터 사용처 매핑
- `docs/FIREBASE_DATA_FLOW.md` - Firebase 데이터 흐름
- `docs/SYNCHRONIZATION_BUG_FIX_REPORT.md` - 동기화 문제 해결

## 🔍 마이그레이션 가이드

기존 persons 문서를 표준화하려면:

1. **필드명 정규화**
   ```javascript
   // 대문자 필드를 소문자로 변경
   Gender → gender
   Age → age
   Experience → experience
   ```

2. **타입 정규화**
   ```javascript
   // 문자열 age를 숫자로 변경
   age: "25" → age: 25
   ```

3. **필수 필드 추가**
   ```javascript
   // userId 필드 추가 (staffId와 동일한 값 사용)
   userId: doc.staffId
   ```

---

**작성자**: T-HOLDEM Development Team  
**최종 업데이트**: 2025년 9월 6일