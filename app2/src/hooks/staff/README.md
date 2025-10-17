# Staff Management Hooks

StaffManagementTab 리팩토링으로 생성된 커스텀 훅 모음입니다.

## 📁 구조

```
hooks/staff/
├── useStaffData.ts          # 데이터 변환 및 필터링
├── useStaffSelection.ts     # 다중 선택 모드 관리
├── useStaffModals.ts        # 모달 상태 통합 관리
└── useStaffActions.ts       # 액션 처리 (삭제, 수정 등)
```

## 🎯 useStaffData

WorkLog 데이터를 StaffData로 변환하고 필터링/그룹화합니다.

### 사용법

```typescript
import { useStaffData } from '@/hooks/staff/useStaffData';
import useUnifiedData from '@/hooks/useUnifiedData';

function MyComponent({ jobPosting }) {
  const { state } = useUnifiedData();
  const [filters, setFilters] = useState({ searchTerm: '' });

  const { staffData, groupedStaffData, uniqueStaffCount, filteredStaffCount } =
    useStaffData({
      workLogs: state.workLogs,
      jobPostings: state.jobPostings,
      currentJobPosting: jobPosting,
      filters,
    });

  return (
    <div>
      <p>총 {uniqueStaffCount}명</p>
      {groupedStaffData.sortedDates.map(date => (
        <div key={date}>
          <h3>{date}</h3>
          {groupedStaffData.grouped[date]?.map(staff => (
            <div key={staff.id}>{staff.name}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### 반환값

| 속성 | 타입 | 설명 |
|------|------|------|
| `staffData` | `StaffData[]` | 변환된 스태프 데이터 배열 |
| `groupedStaffData` | `GroupedStaffData` | 날짜별로 그룹화된 데이터 |
| `uniqueStaffCount` | `number` | 고유 스태프 수 (이름 기준) |
| `filteredStaffCount` | `number` | 필터링 후 고유 스태프 수 |

---

## 🎯 useStaffSelection

다중 선택 모드와 선택 상태를 관리합니다.

### 사용법

```typescript
import { useStaffSelection } from '@/hooks/staff/useStaffSelection';

function MyComponent() {
  const selection = useStaffSelection();

  return (
    <div>
      {/* 선택 모드 토글 */}
      <button onClick={selection.toggleMultiSelectMode}>
        {selection.multiSelectMode ? '선택 완료' : '선택 모드'}
      </button>

      {/* 선택된 스태프 수 */}
      {selection.selectedStaff.size > 0 && (
        <p>{selection.selectedStaff.size}명 선택됨</p>
      )}

      {/* 전체 선택/해제 */}
      <button onClick={() => selection.selectAll(staffIds)}>전체 선택</button>
      <button onClick={selection.deselectAll}>전체 해제</button>

      {/* 스태프 목록 */}
      {staffList.map(staff => (
        <div
          key={staff.id}
          onClick={() => selection.toggleStaffSelection(staff.id)}
          className={selection.selectedStaff.has(staff.id) ? 'selected' : ''}
        >
          {staff.name}
        </div>
      ))}
    </div>
  );
}
```

### API

| 메서드 | 파라미터 | 설명 |
|--------|----------|------|
| `toggleMultiSelectMode` | - | 선택 모드 on/off |
| `toggleStaffSelection` | `staffId: string` | 개별 스태프 선택/해제 |
| `selectAll` | `staffIds: string[]` | 전체 선택 |
| `deselectAll` | - | 전체 해제 |
| `resetSelection` | - | 선택 초기화 및 모드 종료 |
| `isAllSelected` | `staffIds: string[]` | 전체 선택 여부 확인 |

---

## 🎯 useStaffModals

모든 모달 상태를 중앙 관리합니다.

### 사용법

```typescript
import { useStaffModals } from '@/hooks/staff/useStaffModals';

function MyComponent() {
  const modals = useStaffModals();

  return (
    <div>
      {/* QR 스캔 모달 */}
      <button onClick={modals.qrModal.open}>QR 스캔</button>
      <QRModal
        isOpen={modals.qrModal.isOpen}
        onClose={modals.qrModal.close}
      />

      {/* 근무 시간 수정 모달 */}
      <button onClick={() => modals.workTimeEditor.open(workLog)}>
        시간 수정
      </button>
      <WorkTimeEditor
        isOpen={modals.workTimeEditor.isOpen}
        onClose={modals.workTimeEditor.close}
        workLog={modals.workTimeEditor.workLog}
      />

      {/* 프로필 모달 */}
      <button onClick={() => modals.profileModal.open(staff)}>
        프로필 보기
      </button>
      <ProfileModal
        isOpen={modals.profileModal.isOpen}
        onClose={modals.profileModal.close}
        staff={modals.profileModal.staff}
      />

      {/* 삭제 확인 모달 */}
      <button onClick={() => modals.deleteConfirmModal.open(id, name, date)}>
        삭제
      </button>
      <ConfirmModal
        isOpen={modals.deleteConfirmModal.data.isOpen}
        onClose={modals.deleteConfirmModal.close}
      />
    </div>
  );
}
```

### 관리하는 모달

1. **qrModal** - QR 스캔
2. **workTimeEditor** - 근무 시간 수정
3. **profileModal** - 스태프 프로필
4. **deleteConfirmModal** - 삭제 확인
5. **bulkTimeEditModal** - 일괄 시간 수정
6. **reportModal** - 신고

---

## 🎯 useStaffActions

스태프 관련 액션 (삭제, 수정 등)을 처리합니다.

### 사용법

```typescript
import { useStaffActions } from '@/hooks/staff/useStaffActions';
import useUnifiedData from '@/hooks/useUnifiedData';

function MyComponent({ jobPosting, staffData }) {
  const { refresh } = useUnifiedData();
  const canEdit = true; // 권한 체크

  const actions = useStaffActions({
    jobPosting,
    staffData,
    canEdit,
    refresh,
  });

  const handleEdit = async (staffId) => {
    const workLog = await actions.handleEditWorkTime(
      staffId,
      'start',
      '2025-02-04'
    );
    if (workLog) {
      // 모달 열기 등
    }
  };

  const handleDelete = async (staffId, staffName, date) => {
    await actions.deleteStaff(staffId, staffName, date);
    // 삭제 완료 후 처리
  };

  const handleBulkDelete = async (staffIds) => {
    await actions.handleBulkDelete(staffIds);
    // 일괄 삭제 완료 후 처리
  };

  return (
    <div>
      <button onClick={() => handleEdit('user-1')}>시간 수정</button>
      <button onClick={() => handleDelete('user-1', '김철수', '2025-02-04')}>
        삭제
      </button>
      <button onClick={() => handleBulkDelete(['user-1', 'user-2'])}>
        일괄 삭제
      </button>
    </div>
  );
}
```

### API

| 메서드 | 설명 |
|--------|------|
| `handleEditWorkTime(staffId, timeType, targetDate)` | 근무 시간 수정용 WorkLog 조회 |
| `deleteStaff(staffId, staffName, date)` | 개별 스태프 삭제 (검증 포함) |
| `handleBulkDelete(staffIds)` | 일괄 스태프 삭제 (검증 포함) |

---

## 💡 전체 사용 예제

```typescript
import { useStaffData } from '@/hooks/staff/useStaffData';
import { useStaffSelection } from '@/hooks/staff/useStaffSelection';
import { useStaffModals } from '@/hooks/staff/useStaffModals';
import { useStaffActions } from '@/hooks/staff/useStaffActions';
import useUnifiedData from '@/hooks/useUnifiedData';

function StaffManagementPage({ jobPosting }) {
  const { state, refresh } = useUnifiedData();
  const [filters, setFilters] = useState({ searchTerm: '' });

  // 1. 데이터 변환 및 필터링
  const { staffData, groupedStaffData, uniqueStaffCount } = useStaffData({
    workLogs: state.workLogs,
    jobPostings: state.jobPostings,
    currentJobPosting: jobPosting,
    filters,
  });

  // 2. 선택 모드 관리
  const selection = useStaffSelection();

  // 3. 모달 상태 관리
  const modals = useStaffModals();

  // 4. 액션 처리
  const actions = useStaffActions({
    jobPosting,
    staffData,
    canEdit: true,
    refresh,
  });

  const handleEdit = async (staffId) => {
    const workLog = await actions.handleEditWorkTime(staffId);
    if (workLog) {
      modals.workTimeEditor.open(workLog);
    }
  };

  return (
    <div>
      {/* 헤더 */}
      <h1>총 {uniqueStaffCount}명</h1>

      {/* 검색 */}
      <input
        value={filters.searchTerm}
        onChange={(e) => setFilters({ searchTerm: e.target.value })}
      />

      {/* 선택 모드 토글 */}
      <button onClick={selection.toggleMultiSelectMode}>
        {selection.multiSelectMode ? '선택 완료' : '선택 모드'}
      </button>

      {/* 스태프 목록 */}
      {groupedStaffData.sortedDates.map(date => (
        <div key={date}>
          <h3>{date}</h3>
          {groupedStaffData.grouped[date]?.map(staff => (
            <div
              key={staff.id}
              onClick={() => {
                if (selection.multiSelectMode) {
                  selection.toggleStaffSelection(staff.id);
                }
              }}
            >
              {staff.name}
              <button onClick={() => handleEdit(staff.id)}>수정</button>
              <button onClick={() => actions.deleteStaff(staff.id, staff.name, date)}>
                삭제
              </button>
            </div>
          ))}
        </div>
      ))}

      {/* 일괄 작업 */}
      {selection.selectedStaff.size > 0 && (
        <button onClick={() => actions.handleBulkDelete(Array.from(selection.selectedStaff))}>
          선택 항목 삭제 ({selection.selectedStaff.size}명)
        </button>
      )}
    </div>
  );
}
```

---

## 🔧 유틸리티 함수

커스텀 훅에서 사용하는 유틸리티 함수들은 `utils/staff/` 디렉토리에 있습니다:

- [staffDataTransformer](../../utils/staff/staffDataTransformer.ts) - WorkLog → StaffData 변환
- [staffValidation](../../utils/staff/staffValidation.ts) - 삭제 가능 여부 검증
- [staffGrouping](../../utils/staff/staffGrouping.ts) - 필터링 및 그룹화

---

## 📊 성능 최적화

모든 훅은 `useMemo`와 `useCallback`을 사용하여 불필요한 재계산을 방지합니다:

```typescript
// useStaffData 내부
const staffData = useMemo(() => {
  return transformWorkLogsToStaffData(...);
}, [workLogs, jobPostings, currentJobPosting?.id]);

// useStaffSelection 내부
const toggleStaffSelection = useCallback((staffId: string) => {
  setSelectedStaff(prev => {
    // ...
  });
}, []);
```

---

## 🧪 테스트

각 훅과 유틸리티 함수에는 유닛 테스트가 포함되어 있습니다:

```bash
# 전체 테스트
npm test

# Staff 관련 테스트만
npm test -- --testPathPattern="staff"
```

---

## 📝 참고

- [StaffManagementTab.tsx](../../components/tabs/StaffManagementTab.tsx) - 실제 사용 예제
- [CLAUDE.md](../../../../CLAUDE.md) - 프로젝트 가이드
