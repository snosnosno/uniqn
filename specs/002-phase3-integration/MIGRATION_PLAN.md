# Phase 3-2 점진적 적용 계획

**작성일**: 2025-11-21
**Feature ID**: 002-phase3-integration-progressive-adoption
**상태**: 🚀 **진행 중**

---

## 📊 발견된 파일 분석

### Firebase 에러 처리 패턴 (20개 파일)

| 우선순위 | 파일 | 이유 | 예상 시간 |
|---------|------|------|----------|
| ✅ **High** | `hooks/staff/useStaffActions.ts` | 스태프 삭제/수정, 사용자 대면 기능 | 1h |
| ✅ **High** | `pages/JobBoard/hooks/useJobBoard.ts` | 구인공고 지원, 취소 | 1h |
| ⏭️ **High** | `components/tabs/StaffManagementTab.tsx` | 커스텀 훅 사용 중 (skip) | - |
| ⏭️ **Medium** | `hooks/useStaffWorkData.ts` | catch 블록 없음 (skip) | - |
| ✅ **Medium** | `services/BulkOperationService.ts` | 일괄 처리 서비스 | 30min |
| ✅ **Medium** | `components/modals/BulkTimeEditModal.tsx` | 시간 수정 모달 | 30min |
| **Medium** | `components/modals/TableDetailModal.tsx` | 테이블 상세 모달 | 30min |
| **Low** | `utils/workLogUtils.ts` | 유틸리티 함수 | 20min |
| **Low** | `workers/payrollCalculator.worker.ts` | 워커 스레드 | 20min |
| **Low** | `hooks/useScheduleData/dataProcessors.ts` | 데이터 처리기 | 20min |

**Total**: 10개 파일 우선 적용 (약 6시간)

### FormUtils 적용 대상 (2개 파일)

| 우선순위 | 파일 | 현재 코드 | 개선 효과 | 예상 시간 |
|---------|------|----------|----------|----------|
| ✅ **High** | `modals/EditUserModal.tsx` | 개별 handleChange (Line 97-99) | 81% 코드 감소 | 30min |
| ⏭️ **High** | `settings/PasswordChangeModal.tsx` | 이미 최적화됨 (skip) | - | - |

**Total**: 2개 파일 (약 1시간)

---

## 🎯 Phase 1: FormUtils 마이그레이션 (1시간)

### 1️⃣ EditUserModal.tsx

**Before** (Line 55-99):
```typescript
const [formData, setFormData] = useState({
  name: '',
  role: '',
  experience: '',
  // ... 9개 필드
});

const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  setFormData({ ...formData, [e.target.name]: e.target.value });
};
```

**After**:
```typescript
import { createFormHandler } from '../../utils/formUtils';

interface UserFormData {
  name: string;
  role: string;
  experience: string;
  // ... 9개 필드
}

const [formData, setFormData] = useState<UserFormData>({
  name: '',
  role: '',
  experience: '',
  // ... 9개 필드
});

const { handleChange, handleSelectChange, handleReset } = createFormHandler(setFormData);
```

**개선 사항**:
- ✅ 코드 80% 감소 (43줄 → 8줄)
- ✅ TypeScript Generic으로 타입 안전성 보장
- ✅ handleChange, handleSelectChange 자동 생성

---

### 2️⃣ PasswordChangeModal.tsx

**Before** (Line 54-59):
```typescript
const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [showCurrentPassword, setShowCurrentPassword] = useState(false);
const [showNewPassword, setShowNewPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
```

**After**:
```typescript
import { createFormHandler } from '../../utils/formUtils';

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const [formData, setFormData] = useState<PasswordFormData>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const [showPasswords, setShowPasswords] = useState({
  current: false,
  new: false,
  confirm: false,
});

const { handleChange, handleReset } = createFormHandler(setFormData);
```

**개선 사항**:
- ✅ 폼 상태 통합 (3개 useState → 1개)
- ✅ 표시 상태 통합 (3개 useState → 1개)
- ✅ 일관된 폼 핸들링 패턴

---

## 🎯 Phase 2: Firebase Error Handling (3시간)

### 1️⃣ useStaffActions.ts (High Priority)

**적용 패턴**:

**Before** (Line 272-278):
```typescript
} catch (error) {
  logger.error(
    '스태프 삭제 실패',
    error instanceof Error ? error : new Error(String(error))
  );
  showError('스태프 삭제 중 오류가 발생했습니다.');
}
```

**After**:
```typescript
import {
  handleFirebaseError,
  isPermissionDenied,
  FirebaseError
} from '../../utils/firebaseErrors';

} catch (error) {
  // 권한 거부 특별 처리
  if (isPermissionDenied(error)) {
    showError('관리자 권한이 필요합니다. 관리자에게 문의하세요.');
    return;
  }

  // 표준화된 에러 처리
  const message = handleFirebaseError(
    error as FirebaseError,
    {
      operation: 'deleteStaff',
      staffId,
      jobPostingId: jobPosting.id,
      userId: currentUser?.uid
    },
    'ko'
  );
  showError(message);
}
```

**개선 사항**:
- ✅ 7개 Firebase 에러 코드 자동 감지
- ✅ 한국어/영어 i18n 메시지
- ✅ Type Guard로 권한 에러 특별 처리
- ✅ 로깅 + 사용자 메시지 통합

---

### 2️⃣ useJobBoard.ts (High Priority)

**적용 위치**: Line 110-125 (지원서 제출/취소 에러 처리)

**적용 패턴**: useStaffActions와 동일

---

### 3️⃣ StaffManagementTab.tsx (High Priority)

**적용 위치**: Line 67-77 (localStorage 에러 처리)

**Before**:
```typescript
} catch (error) {
  return new Set();
}
```

**After** (간단한 에러는 그대로 유지):
```typescript
} catch (error) {
  logger.warn('localStorage 복원 실패', error as Error, {
    component: 'StaffManagementTab',
  });
  return new Set();
}
```

---

## 🎯 Phase 3: 검증 & 문서화 (1시간)

### 검증 단계
```bash
cd app2

# 1. TypeScript 에러 체크
npm run type-check  # 목표: 0 errors

# 2. Lint 체크
npm run lint  # 목표: 0 new errors

# 3. 테스트 실행
npm test  # 목표: all tests pass

# 4. 프로덕션 빌드
npm run build  # 목표: success
```

### 문서화
- [ ] 마이그레이션 전후 코드 스크린샷
- [ ] FormUtils 사용 예시 추가
- [ ] Firebase Error Handling 가이드 작성

---

## 📈 예상 효과

### FormUtils 적용 효과
- **코드 감소**: 86줄 → 15줄 (82% 감소)
- **타입 안전성**: Generic 타입으로 100% 보장
- **유지보수성**: 일관된 패턴으로 버그 감소

### Firebase Error Handling 효과
- **일관된 메시지**: 한국어/영어 자동 지원
- **디버깅 향상**: 중앙 집중식 로깅
- **사용자 경험**: 명확한 에러 메시지

### 전체 효과
- **개발 시간**: 향후 폼/에러 처리 50% 단축
- **버그 감소**: 표준화된 패턴으로 30% 감소
- **코드 품질**: 타입 안전성 + 일관성 향상

---

## ✅ 체크리스트

### Phase 1: FormUtils (1h)
- [x] EditUserModal.tsx 분석 완료
- [x] PasswordChangeModal.tsx 분석 완료
- [ ] EditUserModal 마이그레이션
- [ ] PasswordChangeModal 마이그레이션
- [ ] type-check 통과
- [ ] 테스트 통과

### Phase 2: Firebase Error Handling (3h)
- [ ] useStaffActions.ts 마이그레이션
- [ ] useJobBoard.ts 마이그레이션
- [ ] StaffManagementTab.tsx 마이그레이션
- [ ] type-check 통과
- [ ] 테스트 통과

### Phase 3: 검증 & 문서화 (1h)
- [ ] 전체 type-check
- [ ] 전체 lint
- [ ] 전체 테스트
- [ ] 프로덕션 빌드
- [ ] 문서 업데이트

---

**Total Estimated Time**: 5 hours
**Expected Completion**: 2025-11-21

---

## 📝 Notes

- 이미 `logger`를 사용하고 있는 파일들이 많아서 마이그레이션이 쉬울 것으로 예상
- `console.log`, `alert()` 사용 없음 ✅
- FormUtils는 새로운 폼에도 즉시 적용 가능
- Firebase Error Handling은 점진적으로 19개 파일에 추가 확산 가능
