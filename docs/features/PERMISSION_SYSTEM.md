# 권한 시스템 전체 정리 (Permission System Overview)

**최종 업데이트**: 2025년 11월 27일
**버전**: v0.2.4 (Production Ready + 구인공고 4타입)
**상태**: 🚀 **Production Ready**

T-HOLDEM 프로젝트 권한 관리 체계 문서

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [역할(Role) 정의](#역할role-정의)
3. [권한 범위(Permission Scope)](#권한-범위permission-scope)
4. [리소스별 권한 매트릭스](#리소스별-권한-매트릭스)
5. [주요 컴포넌트](#주요-컴포넌트)
6. [라우팅 권한 설정](#라우팅-권한-설정)
7. [페이지별 탭 권한 설정](#페이지별-탭-권한-설정)
8. [사용 예시](#사용-예시)
9. [트러블슈팅](#트러블슈팅)

---

## 시스템 개요

T-HOLDEM은 **역할 기반 접근 제어(RBAC)** + **세분화된 권한 시스템**을 결합한 하이브리드 모델을 사용합니다.

### 핵심 원칙
- **역할(Role)**: 사용자의 기본 직책 (admin, manager, staff)
- **권한 범위(Scope)**: 접근 가능한 데이터 범위 (none, own, team, all)
- **리소스(Resource)**: 보호되는 기능 영역 (공고, 스태프, 스케줄 등)
- **작업(Action)**: 리소스에 대한 구체적인 행위 (view, create, edit, delete 등)

### 파일 구조
```
src/
├── types/permissions.ts              # 권한 타입 정의 및 기본 설정
├── hooks/usePermissions.ts           # 권한 훅
├── components/auth/
│   ├── PermissionGuard.tsx           # 권한 기반 컴포넌트 가드
│   └── RoleBasedRoute.tsx            # 라우팅 권한 가드
└── App.tsx                           # 라우팅 설정
```

---

## 역할(Role) 정의

### 1. Admin (관리자)
**모든 권한 보유** - 시스템 전체 관리 가능

```typescript
role: 'admin'
권한: ALL 리소스에 대한 ALL 작업
```

**접근 가능 페이지**:
- ✅ CEO 대시보드 (`/app/admin/ceo-dashboard`)
- ✅ 승인 관리 (`/app/admin/approvals`)
- ✅ 사용자 관리 (`/app/admin/user-management`)
- ✅ 문의 관리 (`/app/admin/inquiries`)
- ✅ 토너먼트 관리 (전체)
- ✅ 공고 관리 (전체)
- ✅ 스태프 관리 (전체)
- ✅ 교대 관리
- ✅ 정산 관리 (전체)

---

### 2. Manager (매니저)
**팀/본인 데이터 관리** - 제한적 관리 권한

```typescript
role: 'manager'
권한:
  - 공고: own (본인이 작성한 공고만)
  - 스태프: team
  - 스케줄: team
  - 정산: viewOwn만
```

**접근 가능 페이지**:
- ✅ 본인이 작성한 공고 관리
- ✅ 스태프 신규 등록 (`/app/admin/staff/new`)
- ✅ 교대 관리 (`/app/admin/shift-schedule`)
- ✅ 팀 스케줄 조회/수정
- ❌ CEO 대시보드 (Admin 전용)
- ❌ 사용자 관리 (Admin 전용)

---

### 3. Staff (스태프)
**본인 데이터만 접근** - 최소 권한

```typescript
role: 'staff'
권한:
  - 공고: own (본인이 작성한 공고만)
  - 스태프: own (본인 정보만)
  - 스케줄: own (본인 스케줄만)
  - 정산: viewOwn만
```

**접근 가능 페이지**:
- ✅ 본인이 작성한 공고 조회/수정
- ✅ 프로필 (`/app/profile`)
- ✅ 내 스케줄 (`/app/my-schedule`)
- ✅ 출석 관리 (`/app/attendance`)
- ✅ 본인 정산 조회
- ❌ 타인의 공고/스태프 정보 (own 권한)
- ❌ 관리자 기능 전체

---

## 권한 범위(Permission Scope)

```typescript
type PermissionScope = 'none' | 'own' | 'team' | 'all';
```

| Scope | 설명 | 예시 |
|-------|------|------|
| `none` | 접근 불가 | staff의 delete 권한 |
| `own` | 본인 데이터만 | staff의 공고 조회 (본인 작성) |
| `team` | 팀 데이터 접근 | manager의 스태프 관리 |
| `all` | 모든 데이터 접근 | admin의 모든 권한 |

---

## 리소스별 권한 매트릭스

### 📋 공고 관리 (jobPostings)

| 작업 | Admin | Manager | Staff |
|------|-------|---------|-------|
| view | all | **own** | **own** |
| create | all | **own** | **own** |
| edit | all | **own** | **own** |
| delete | all | **own** | **own** |
| manageApplicants | all | **own** | **own** |
| viewAnalytics | all | **own** | **own** |

**주요 특징**:
- ✅ **Staff도 공고 생성/관리 가능** (본인이 작성한 공고만)
- ✅ Manager와 Staff는 `createdBy` 필드로 본인 공고만 접근
- ✅ Admin은 모든 공고 관리 가능

---

### 👥 스태프 관리 (staff)

| 작업 | Admin | Manager | Staff |
|------|-------|---------|-------|
| view | all | all | **own** |
| edit | all | team | **own** |
| delete | all | none | none |
| approve | all | team | none |

**주요 특징**:
- Admin: 모든 스태프 관리
- Manager: 팀 스태프 수정/승인 가능
- Staff: 본인 정보만 조회/수정

---

### 📅 스케줄 관리 (schedules)

| 작업 | Admin | Manager | Staff |
|------|-------|---------|-------|
| view | all | all | **own** |
| edit | all | team | none |
| requestChanges | all | **own** | **own** |
| approveChanges | all | team | none |

**주요 특징**:
- ✅ **Staff도 일정 변경 요청 가능** (본인 스케줄만)
- Manager: 팀 일정 수정/승인 가능
- Admin: 모든 일정 관리

---

### 💰 정산 관리 (payroll)

| 작업 | Admin | Manager | Staff |
|------|-------|---------|-------|
| viewOwn | ✅ | ✅ | ✅ |
| viewAll | ✅ | ❌ | ❌ |
| process | ✅ | ❌ | ❌ |

**주요 특징**:
- 모든 역할이 본인 급여 조회 가능
- 전체 급여 조회/처리는 Admin만 가능

---

### 📢 공지 관리 (announcements)

| 작업 | Admin | Manager | Staff |
|------|-------|---------|-------|
| view | all | all | all |
| create | all | team | none |
| edit | all | **own** | none |
| delete | all | **own** | none |

**주요 특징**:
- 모든 역할이 공지 조회 가능
- Manager: 팀 공지 작성, 본인 공지만 수정/삭제
- Staff: 조회만 가능

---

### ⚙️ 시스템 관리 (system)

| 작업 | Admin | Manager | Staff |
|------|-------|---------|-------|
| manageUsers | ✅ | ❌ | ❌ |
| viewLogs | ✅ | ❌ | ❌ |
| manageSettings | ✅ | ❌ | ❌ |

**주요 특징**:
- Admin 전용 기능
- 사용자 관리, 로그 조회, 시스템 설정

---

## 주요 컴포넌트

### 1. usePermissions Hook

**위치**: `src/hooks/usePermissions.ts`

```typescript
const {
  permissions,                    // 현재 사용자의 권한 객체
  checkPermission,                // 일반 권한 체크
  checkJobPostingPermission,      // 공고 권한 체크 (createdBy 기반)
  canViewJobPostings,             // 공고 조회 가능 여부
  canCreateJobPostings,           // 공고 생성 가능 여부
  canManageApplicants,            // 지원자 관리 가능 여부
  canRequestScheduleChanges,      // 일정 변경 요청 가능 여부
  canApproveScheduleChanges,      // 일정 변경 승인 가능 여부
  canManageJobPostings            // 공고 관리 가능 여부
} = usePermissions();
```

**사용 예시**:
```typescript
// 일반 권한 체크
const canEdit = checkPermission('jobPostings', 'edit');

// 공고 권한 체크 (작성자 확인)
const canEditThisPosting = checkJobPostingPermission('edit', jobPosting.createdBy);
```

---

### 2. PermissionGuard 컴포넌트

**위치**: `src/components/auth/PermissionGuard.tsx`

```typescript
// 기본 사용
<PermissionGuard resource="jobPostings" action="view">
  <JobPostingList />
</PermissionGuard>

// Fallback 제공
<PermissionGuard
  resource="staff"
  action="edit"
  fallback={<p>수정 권한이 없습니다.</p>}
>
  <EditButton />
</PermissionGuard>
```

**추가 컴포넌트**:
```typescript
// 조건부 렌더링 (권한 없으면 null)
<ConditionalRender resource="payroll" action="viewAll">
  <AllPayrollView />
</ConditionalRender>

// 역할 기반 렌더링
<RoleGuard allowedRoles={['admin', 'manager']}>
  <AdminPanel />
</RoleGuard>

// 공고 접근 권한 가드
<JobPostingAccessGuard requireManagement={true}>
  <ApplicantManagement />
</JobPostingAccessGuard>
```

---

### 3. RoleBasedRoute 컴포넌트

**위치**: `src/components/auth/RoleBasedRoute.tsx`

```typescript
// 역할 기반 라우팅
<Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager']} />}>
  <Route path="staff/new" element={<StaffNewPage />} />
</Route>

// 세분화된 권한 추가
<Route
  path="admin"
  element={
    <RoleBasedRoute
      allowedRoles={['admin']}
      requiredPermission={{ resource: 'system', action: 'manageUsers' }}
    />
  }
>
  <Route path="user-management" element={<UserManagementPage />} />
</Route>
```

---

## 라우팅 권한 설정

**위치**: `src/App.tsx`

### 1. Admin + Manager 공통 라우트

```typescript
<Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager']} />}>
  <Route path="staff/new" element={<StaffNewPage />} />
  <Route path="shift-schedule" element={<ShiftSchedulePage />} />
</Route>
```

**접근 가능**: Admin, Manager
**제한**: Staff

---

### 2. Admin + Manager + Staff 공통 라우트 (공고 관리)

```typescript
<Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager', 'staff']} />}>
  <Route path="job-postings" element={<JobPostingAdminPage />} />
  <Route path="job-posting/:id" element={<JobPostingDetailPage />} />
</Route>
```

**접근 가능**: Admin, Manager, Staff (본인 공고만)
**특징**: `JobPostingDetailPage` 내부에서 `checkJobPostingPermission`으로 추가 검증

---

### 3. Admin 전용 라우트

```typescript
<Route path="admin" element={<RoleBasedRoute allowedRoles={['admin']} />}>
  <Route path="ceo-dashboard" element={<CEODashboard />} />
  <Route path="approvals" element={<ApprovalPage />} />
  <Route path="user-management" element={<UserManagementPage />} />
  <Route path="inquiries" element={<InquiryManagementPage />} />
</Route>
```

**접근 가능**: Admin만
**제한**: Manager, Staff

---

## 페이지별 탭 권한 설정

### JobPostingDetailPage 탭 권한

**위치**: `src/pages/JobPostingDetailPage.tsx` (49-60줄)

```typescript
const allTabs: TabConfig[] = [
  {
    id: 'applicants',
    label: '지원자',
    component: ApplicantListTab,
    requiredPermission: { resource: 'jobPostings', action: 'manageApplicants' }
  },
  {
    id: 'staff',
    label: '스태프',
    component: StaffManagementTab,
    requiredPermission: { resource: 'jobPostings', action: 'manageApplicants' }
  },
  {
    id: 'shifts',
    label: '시프트',
    component: ShiftManagementTab,
    allowedRoles: ['admin', 'manager']  // ⚠️ Staff는 접근 불가
  },
  {
    id: 'payroll',
    label: '정산',
    component: EnhancedPayrollTab,
    allowedRoles: ['admin', 'manager', 'staff']  // ✅ 모든 역할 접근 가능
  },
];
```

**탭별 접근 권한** (✅ 2025-10-23 업데이트):

| 탭 | Admin | Manager | Staff | 비고 |
|----|-------|---------|-------|------|
| 지원자 | ✅ | ✅ (본인 공고) | ✅ (본인 공고) | manageApplicants 권한 |
| 스태프 | ✅ | ✅ (본인 공고) | ✅ (본인 공고) | manageApplicants 권한 |
| **시프트** | ✅ | ✅ (본인 공고) | ✅ (본인 공고) | **✅ 업데이트: Staff 접근 가능** |
| 정산 | ✅ | ✅ (본인 공고) | ✅ (본인 공고) | payroll.viewOwn |

**중요**:
- ✅ **Manager와 Staff는 본인이 작성한 공고(`createdBy`)에서만 모든 탭 접근 가능**
- ✅ **Admin은 모든 공고의 모든 탭 접근 가능**
- 🔒 공고 접근 권한은 `JobPostingDetailPageContent`의 76-104줄에서 검증

---

### ~~시프트 탭 접근 확대 방법~~ (✅ 해결됨)

**~~문제~~**: ~~Staff가 시프트 탭을 볼 수 없음~~ → **해결 완료 (2025-10-23)**

**적용된 해결책**:
```typescript
{
  id: 'shifts',
  label: '시프트',
  component: ShiftManagementTab,
  allowedRoles: ['admin', 'manager', 'staff']  // ✅ Staff 추가됨
}
```

---

## 사용 예시

### 1. 공고 조회 권한 체크

```typescript
import { usePermissions } from '../hooks/usePermissions';

const JobPostingList = () => {
  const { canViewJobPostings, checkJobPostingPermission } = usePermissions();
  const { currentUser } = useAuth();

  if (!canViewJobPostings) {
    return <p>공고 조회 권한이 없습니다.</p>;
  }

  return (
    <div>
      {jobPostings.map(posting => {
        const canEdit = checkJobPostingPermission('edit', posting.createdBy);
        return (
          <JobPostingCard
            key={posting.id}
            posting={posting}
            showEditButton={canEdit}
          />
        );
      })}
    </div>
  );
};
```

---

### 2. 조건부 버튼 렌더링

```typescript
import { ConditionalRender } from '../components/auth/PermissionGuard';

const StaffManagement = ({ staffId }) => {
  return (
    <div>
      {/* Admin만 삭제 버튼 표시 */}
      <ConditionalRender resource="staff" action="delete" targetUserId={staffId}>
        <button onClick={handleDelete}>삭제</button>
      </ConditionalRender>

      {/* Admin/Manager만 승인 버튼 표시 */}
      <ConditionalRender resource="staff" action="approve" targetUserId={staffId}>
        <button onClick={handleApprove}>승인</button>
      </ConditionalRender>
    </div>
  );
};
```

---

### 3. 페이지 전체 권한 가드

```typescript
import PermissionGuard from '../components/auth/PermissionGuard';

const PayrollPage = () => {
  return (
    <PermissionGuard
      resource="payroll"
      action="viewAll"
      fallback={
        <div>
          <h2>접근 제한</h2>
          <p>전체 급여 조회 권한이 없습니다.</p>
        </div>
      }
    >
      <AllPayrollView />
    </PermissionGuard>
  );
};
```

---

## 트러블슈팅

### 문제 1: Staff가 본인 공고를 볼 수 없음

**원인**: `createdBy` 필드가 누락되었거나 잘못됨

**해결**:
```typescript
// 공고 생성 시 createdBy 필드 추가
const newPosting = {
  ...formData,
  createdBy: currentUser.uid,  // ✅ 필수
  createdAt: serverTimestamp()
};
```

---

### 문제 2: Manager가 타인 공고를 수정할 수 있음

**원인**: `checkJobPostingPermission` 미사용

**해결**:
```typescript
// ❌ 잘못된 방법
const canEdit = checkPermission('jobPostings', 'edit');

// ✅ 올바른 방법
const canEdit = checkJobPostingPermission('edit', jobPosting.createdBy);
```

---

### 문제 3: 탭이 보이지 않음

**원인**: `allowedRoles` 또는 `requiredPermission` 제한

**해결**:
```typescript
// availableTabs 필터링 로직 확인 (JobPostingDetailPage.tsx 76-104줄)
const availableTabs = useMemo(() => {
  if (!permissions || !jobPosting) return [];

  return allTabs.filter(tab => {
    // 역할 확인
    if (tab.allowedRoles && !tab.allowedRoles.includes(permissions.role)) {
      return false;
    }

    // 권한 확인
    if (tab.requiredPermission) {
      if (permissions.role === 'manager' || permissions.role === 'staff') {
        return checkJobPostingPermission(
          tab.requiredPermission.action,
          jobPosting.createdBy
        );
      }
      return checkPermission(
        tab.requiredPermission.resource,
        tab.requiredPermission.action
      );
    }

    return true;
  });
}, [permissions, jobPosting]);
```

---

### 문제 4: 권한 변경이 즉시 반영되지 않음

**원인**: usePermissions Hook의 캐싱

**해결**:
```typescript
// usePermissions는 role 변경 시 자동 업데이트됨 (useEffect 의존성)
// 강제 새로고침이 필요한 경우:
window.location.reload();

// 또는 AuthContext에서 role 업데이트
await updateUserRole(userId, newRole);
```

---

## 권장 사항

### 1. 새 기능 추가 시 체크리스트

- [ ] `types/permissions.ts`에 권한 정의 추가
- [ ] `usePermissions` Hook에 헬퍼 함수 추가 (필요시)
- [ ] 라우팅에 `RoleBasedRoute` 적용
- [ ] 컴포넌트에 `PermissionGuard` 적용
- [ ] 공고 관련 기능은 `checkJobPostingPermission` 사용

---

### 2. 보안 Best Practices

```typescript
// ✅ Good: 서버 측 검증 + 클라이언트 측 UI 제어
const handleDelete = async () => {
  // 클라이언트 체크 (UX)
  if (!checkPermission('staff', 'delete')) {
    showToast({ message: '삭제 권한이 없습니다.', type: 'error' });
    return;
  }

  // 서버 측 검증 (Firebase Security Rules)
  await deleteDoc(doc(db, 'staff', staffId));
};

// ❌ Bad: 클라이언트 체크만
const handleDelete = async () => {
  // 누군가 콘솔에서 직접 호출하면 우회 가능
  await deleteDoc(doc(db, 'staff', staffId));
};
```

---

### 3. Firebase Security Rules 연동

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 공고 관리 권한
    match /jobPostings/{postingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
        resource.data.createdBy == request.auth.uid
      );
    }

    // 스태프 관리 권한
    match /staff/{staffId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager']
      );
      allow delete: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

---

## 요약

### 역할별 핵심 권한

| 역할 | 핵심 권한 | 제한 사항 |
|------|----------|----------|
| **Admin** | 모든 기능 | 없음 |
| **Manager** | 팀 관리 + 본인 공고 | CEO 대시보드, 사용자 관리 불가 |
| **Staff** | 본인 데이터만 | 관리 기능 대부분 불가, 조회/요청만 |

### 주요 체크포인트

1. ✅ **공고 관리**: Staff도 본인 공고 생성/관리 가능
2. ✅ **시프트 탭**: Admin/Manager만 (현재 설정)
3. ✅ **정산**: 모든 역할이 본인 급여 조회 가능
4. ✅ **일정 변경**: Staff도 요청 가능 (승인은 Manager 이상)

---

**문의사항**: [CLAUDE.md](../../CLAUDE.md) 참조

*마지막 업데이트: 2025-10-23*
