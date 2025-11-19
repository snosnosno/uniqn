# Zustand Store API Reference

**Feature**: 001-zustand-migration - UnifiedDataStore API 완전 가이드
**버전**: 2.0.0
**최종 업데이트**: 2025-11-19
**대상**: UNIQN 프로젝트 개발자

---

## 📚 목차

1. [Store 구조](#store-구조)
2. [State 조회 API](#state-조회-api)
3. [CRUD Operations](#crud-operations)
4. [Batch Actions](#batch-actions)
5. [Selectors](#selectors)
6. [Firebase 구독 관리](#firebase-구독-관리)
7. [타입 정의](#타입-정의)

---

## Store 구조

### UnifiedDataStore

**전역 상태 관리를 위한 Zustand Store**

```typescript
interface UnifiedDataState {
  // State - Map 기반 데이터 저장
  staff: Map<string, Staff>
  workLogs: Map<string, WorkLog>
  applications: Map<string, Application>
  attendanceRecords: Map<string, AttendanceRecord>
  jobPostings: Map<string, JobPosting>

  // Loading & Error States
  isLoading: boolean
  error: string | null

  // Actions (35개 함수)
  // - Firebase 구독: 2개
  // - CRUD: 15개
  // - Batch Actions: 10개
  // - Selectors: 6개
  // - Loading/Error: 2개
}
```

---

## State 조회 API

### 기본 State 가져오기

```typescript
import { useUnifiedDataStore } from '../stores/unifiedDataStore'

// ✅ Selector를 사용한 최적화된 구독
const staff = useUnifiedDataStore((state) => state.staff)
const isLoading = useUnifiedDataStore((state) => state.isLoading)
const error = useUnifiedDataStore((state) => state.error)

// ✅ useShallow를 사용한 객체 구독 (리렌더링 최적화)
import { useShallow } from 'zustand/react/shallow'

const { staff, workLogs, isLoading } = useUnifiedDataStore(
  useShallow((state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
    isLoading: state.isLoading,
  }))
)

// ❌ 전체 Store 구독 (비추천 - 불필요한 리렌더링)
const store = useUnifiedDataStore()
```

### Map → Array 변환

```typescript
// Map을 Array로 변환
const staffArray = Array.from(staff.values())
const workLogsArray = Array.from(workLogs.values())

// Map에서 특정 값 조회
const specificStaff = staff.get('staff123')
```

---

## CRUD Operations

### Set (전체 교체)

**Map 전체를 교체합니다. Firebase onSnapshot에서 사용합니다.**

```typescript
const setStaff = useUnifiedDataStore((state) => state.setStaff)

// 전체 Map 교체
setStaff(new Map([
  ['staff1', { id: 'staff1', name: '홍길동', ... }],
  ['staff2', { id: 'staff2', name: '김철수', ... }],
]))
```

**사용 가능한 Set 함수**:
- `setStaff(items: Map<string, Staff>)`
- `setWorkLogs(items: Map<string, WorkLog>)`
- `setApplications(items: Map<string, Application>)`
- `setAttendanceRecords(items: Map<string, AttendanceRecord>)`
- `setJobPostings(items: Map<string, JobPosting>)`

### Update (개별 업데이트)

**Map에 개별 항목을 추가하거나 업데이트합니다.**

```typescript
const updateStaff = useUnifiedDataStore((state) => state.updateStaff)

// 개별 항목 업데이트/추가
updateStaff({
  id: 'staff1',
  staffId: 'staff1',
  name: '홍길동',
  email: 'hong@example.com',
  phone: '010-1234-5678',
  role: 'dealer',
  userId: 'user1',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
})
```

**사용 가능한 Update 함수**:
- `updateStaff(item: Staff)`
- `updateWorkLog(item: WorkLog)`
- `updateApplication(item: Application)`
- `updateAttendanceRecord(item: AttendanceRecord)`
- `updateJobPosting(item: JobPosting)`

### Delete (개별 삭제)

**Map에서 특정 ID의 항목을 삭제합니다.**

```typescript
const deleteStaff = useUnifiedDataStore((state) => state.deleteStaff)

// 개별 항목 삭제
deleteStaff('staff1')
```

**사용 가능한 Delete 함수**:
- `deleteStaff(id: string)`
- `deleteWorkLog(id: string)`
- `deleteApplication(id: string)`
- `deleteAttendanceRecord(id: string)`
- `deleteJobPosting(id: string)`

---

## Batch Actions

**Phase 3에서 추가된 대량 작업 최적화 API**

### Update Batch (대량 업데이트)

**여러 항목을 한 번에 업데이트합니다. 1번의 리렌더링만 발생합니다.**

```typescript
const updateStaffBatch = useUnifiedDataStore((state) => state.updateStaffBatch)

// 여러 항목을 한 번에 업데이트
const staffList: Staff[] = [
  { id: 'staff1', name: '홍길동', ... },
  { id: 'staff2', name: '김철수', ... },
  { id: 'staff3', name: '이영희', ... },
]

updateStaffBatch(staffList) // ✅ 1번의 리렌더링
```

**성능 비교**:
```typescript
// ❌ 개별 업데이트 (10번의 리렌더링)
staffList.forEach(staff => updateStaff(staff))

// ✅ Batch 업데이트 (1번의 리렌더링)
updateStaffBatch(staffList)

// 성능 향상: 약 90% 리렌더링 감소
```

**사용 가능한 Update Batch 함수**:
- `updateStaffBatch(items: Staff[])`
- `updateWorkLogsBatch(items: WorkLog[])`
- `updateApplicationsBatch(items: Application[])`
- `updateAttendanceRecordsBatch(items: AttendanceRecord[])`
- `updateJobPostingsBatch(items: JobPosting[])`

### Delete Batch (대량 삭제)

**여러 항목을 한 번에 삭제합니다.**

```typescript
const deleteStaffBatch = useUnifiedDataStore((state) => state.deleteStaffBatch)

// 여러 항목을 한 번에 삭제
const idsToDelete = ['staff1', 'staff2', 'staff3']
deleteStaffBatch(idsToDelete) // ✅ 1번의 리렌더링
```

**사용 가능한 Delete Batch 함수**:
- `deleteStaffBatch(ids: string[])`
- `deleteWorkLogsBatch(ids: string[])`
- `deleteApplicationsBatch(ids: string[])`
- `deleteAttendanceRecordsBatch(ids: string[])`
- `deleteJobPostingsBatch(ids: string[])`

---

## Selectors

**O(1) 시간 복잡도로 데이터를 조회하는 최적화된 함수들**

### getStaffById

```typescript
const getStaffById = useUnifiedDataStore((state) => state.getStaffById)

const staff = getStaffById('staff123')
// Returns: Staff | undefined
```

### getWorkLogsByStaffId

```typescript
const getWorkLogsByStaffId = useUnifiedDataStore((state) => state.getWorkLogsByStaffId)

const workLogs = getWorkLogsByStaffId('staff123')
// Returns: WorkLog[]
```

### getWorkLogsByEventId

```typescript
const getWorkLogsByEventId = useUnifiedDataStore((state) => state.getWorkLogsByEventId)

const workLogs = getWorkLogsByEventId('event456')
// Returns: WorkLog[]
```

### getAttendanceByStaffId

```typescript
const getAttendanceByStaffId = useUnifiedDataStore((state) => state.getAttendanceByStaffId)

const attendance = getAttendanceByStaffId('staff123')
// Returns: AttendanceRecord[]
```

### getApplicationsByEventId

```typescript
const getApplicationsByEventId = useUnifiedDataStore((state) => state.getApplicationsByEventId)

const applications = getApplicationsByEventId('event456')
// Returns: Application[]
```

### getJobPostingById

```typescript
const getJobPostingById = useUnifiedDataStore((state) => state.getJobPostingById)

const jobPosting = getJobPostingById('posting789')
// Returns: JobPosting | undefined
```

---

## Firebase 구독 관리

### subscribeAll

**모든 컬렉션을 Firebase onSnapshot으로 실시간 구독합니다.**

```typescript
const subscribeAll = useUnifiedDataStore((state) => state.subscribeAll)

useEffect(() => {
  if (userId && role) {
    subscribeAll(userId, role)
  }
}, [userId, role, subscribeAll])
```

**구독 대상 컬렉션**:
- `staff` - 스태프 정보
- `workLogs` - 근무 기록
- `applications` - 지원서
- `attendanceRecords` - 출석 기록
- `jobPostings` - 구인공고

### unsubscribeAll

**모든 구독을 해제하고 메모리를 정리합니다.**

```typescript
const unsubscribeAll = useUnifiedDataStore((state) => state.unsubscribeAll)

useEffect(() => {
  return () => {
    unsubscribeAll()
  }
}, [unsubscribeAll])
```

**정리 작업**:
- Firebase onSnapshot 구독 해제
- Map 초기화 (메모리 해제)
- Loading/Error 상태 초기화

---

## 타입 정의

### Staff

```typescript
interface Staff {
  id: string
  staffId: string
  name: string
  role: string
  phone?: string
  email?: string
  userId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### WorkLog

```typescript
interface WorkLog {
  id: string
  staffId: string
  staffName: string
  eventId: string
  date: string
  staffInfo: {
    userId: string
    name: string
    jobRole: string[]
  }
  assignmentInfo: {
    role: string
    assignedTime: string
    postingId: string
  }
  status: 'not_started' | 'checked_in' | 'checked_out' | 'completed'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Application

```typescript
interface Application {
  id: string
  eventId: string
  applicantId: string
  name: string
  email: string
  phone: string
  role: string
  userId: string
  status: 'applied' | 'confirmed' | 'rejected'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### AttendanceRecord

```typescript
interface AttendanceRecord {
  id: string
  staffId: string
  eventId: string
  workLogId?: string
  status: 'not_started' | 'checked_in' | 'checked_out'
  checkInTime?: Timestamp
  checkOutTime?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### JobPosting

```typescript
interface JobPosting {
  id: string
  title: string
  location: string
  startDate: Timestamp
  endDate: Timestamp
  status: 'draft' | 'published' | 'closed'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## 사용 예제

### 완전한 컴포넌트 예제

```typescript
import React, { useEffect } from 'react'
import { useUnifiedDataStore } from '../stores/unifiedDataStore'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '../contexts/AuthContext'

function StaffList() {
  const { currentUser, role } = useAuth()

  // State 구독
  const { staff, isLoading, error } = useUnifiedDataStore(
    useShallow((state) => ({
      staff: state.staff,
      isLoading: state.isLoading,
      error: state.error,
    }))
  )

  // Actions
  const subscribeAll = useUnifiedDataStore((state) => state.subscribeAll)
  const unsubscribeAll = useUnifiedDataStore((state) => state.unsubscribeAll)
  const updateStaff = useUnifiedDataStore((state) => state.updateStaff)
  const deleteStaff = useUnifiedDataStore((state) => state.deleteStaff)

  // Firebase 구독
  useEffect(() => {
    if (currentUser && role) {
      subscribeAll(currentUser.uid, role)
    }

    return () => {
      unsubscribeAll()
    }
  }, [currentUser, role, subscribeAll, unsubscribeAll])

  // Loading 상태
  if (isLoading) return <div>로딩 중...</div>

  // Error 상태
  if (error) return <div>에러: {error}</div>

  // Map → Array 변환
  const staffArray = Array.from(staff.values())

  // 핸들러
  const handleUpdate = (staffId: string) => {
    const staffToUpdate = staff.get(staffId)
    if (staffToUpdate) {
      updateStaff({
        ...staffToUpdate,
        name: '홍길동 (수정)',
        updatedAt: Timestamp.now(),
      })
    }
  }

  const handleDelete = (staffId: string) => {
    deleteStaff(staffId)
  }

  return (
    <div>
      <h2>스태프 목록 ({staffArray.length}명)</h2>
      {staffArray.map((staff) => (
        <div key={staff.id}>
          <p>{staff.name} - {staff.role}</p>
          <button onClick={() => handleUpdate(staff.id)}>수정</button>
          <button onClick={() => handleDelete(staff.id)}>삭제</button>
        </div>
      ))}
    </div>
  )
}

export default StaffList
```

---

## 성능 최적화 팁

### 1. Selector 사용

```typescript
// ✅ 좋음 - 필요한 state만 구독
const staff = useUnifiedDataStore((state) => state.staff)

// ❌ 나쁨 - 전체 store 구독
const store = useUnifiedDataStore()
```

### 2. useShallow 사용

```typescript
// ✅ 좋음 - 객체 구독 시 useShallow 사용
const { staff, workLogs } = useUnifiedDataStore(
  useShallow((state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
  }))
)

// ❌ 나쁨 - 매번 새 객체 생성으로 불필요한 리렌더링
const { staff, workLogs } = useUnifiedDataStore((state) => ({
  staff: state.staff,
  workLogs: state.workLogs,
}))
```

### 3. Batch Actions 사용

```typescript
// ✅ 좋음 - Batch로 한 번에 처리
updateStaffBatch(staffList)

// ❌ 나쁨 - 개별 업데이트로 여러 번 리렌더링
staffList.forEach(staff => updateStaff(staff))
```

---

**작성자**: Claude Code
**버전**: 2.0.0
**최종 업데이트**: 2025-11-19
