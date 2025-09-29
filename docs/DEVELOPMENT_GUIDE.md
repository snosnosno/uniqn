# T-HOLDEM 개발 가이드

**최종 업데이트**: 2025년 9월 30일
**프로젝트 버전**: v0.2.2 (Production Ready)
**대상**: T-HOLDEM 개발팀, Claude Code 사용자

---

## 📌 개요

이 문서는 T-HOLDEM 프로젝트에 새로운 기능을 추가할 때 반드시 지켜야 할 개발 가이드라인입니다. 프로젝트의 일관성과 품질을 유지하면서 안전하게 기능을 개발하기 위한 체계적인 절차를 제공합니다.

## 🎯 핵심 원칙

1. **표준 준수**: 기존 아키텍처와 패턴을 따름
2. **타입 안전성**: TypeScript strict mode 100% 준수
3. **실시간성**: Firebase 실시간 구독 필수
4. **사용자 경험**: Toast, 로딩 상태, 에러 처리 완벽 구현
5. **국제화**: 모든 텍스트를 i18n으로 관리
6. **네이티브 호환**: Capacitor 모바일 앱과 완벽 호환

---

## 1. 📋 코드 작성 전 확인사항

### 1.1 기존 기능 확인

**새 기능 개발 전 반드시 확인:**
```bash
# 유사 기능이 이미 있는지 확인
grep -r "검색할기능" app2/src/

# 재사용 가능한 컴포넌트 확인
ls app2/src/components/

# 재사용 가능한 유틸리티 확인
ls app2/src/utils/

# 서비스 레이어 확인
ls app2/src/services/
```

### 1.2 데이터 구조 확인

**Firebase 컬렉션과 표준 필드명:**
| 컬렉션 | 표준 필드 | 레거시 필드 (사용금지) |
|--------|-----------|----------------------|
| `staff` | `staffId` | ~~`dealerId`~~ |
| `workLogs` | `staffId`, `eventId` | ~~`dealerId`~~, ~~`jobPostingId`~~ |
| `applications` | `eventId` | ~~`jobPostingId`~~ |
| `attendanceRecords` | `staffId` | ~~`dealerId`~~ |

**UnifiedDataContext 활용:**
```typescript
import { useUnifiedData } from '@/contexts/UnifiedDataContext';

const MyComponent = () => {
  const { staff, workLogs, loading, error, actions } = useUnifiedData();

  // 기존 데이터 구조 활용
  const handleStaffAction = (staffId: string) => {
    actions.updateStaff(staffId, updateData);
  };
};
```

---

## 2. ✏️ 코드 작성 규칙

### 2.1 TypeScript Strict Mode

**✅ 올바른 예:**
```typescript
interface NewFeatureData {
  staffId: string;
  eventId: string;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected';
}

const processFeature = (data: NewFeatureData): Promise<void> => {
  // 타입이 명확하게 정의됨
  return apiCall(data);
};
```

**❌ 금지사항:**
```typescript
// any 타입 사용 금지
const badFunction = (data: any) => { }

// 암시적 any 금지
const badVariable = {};

// 레거시 필드 사용 금지
interface BadData {
  dealerId: string;  // ❌ 사용 금지
  jobPostingId: string;  // ❌ 사용 금지
}
```

### 2.2 Logger 사용

**✅ 올바른 사용:**
```typescript
import { logger } from '@/utils/logger';

const handleUserAction = (staffId: string, eventId: string) => {
  logger.info('사용자 액션 시작', { staffId, eventId });

  try {
    // 비즈니스 로직
    logger.debug('처리 완료', { result });
  } catch (error) {
    logger.error('처리 실패', { error, staffId, eventId });
  }
};
```

**❌ 금지사항:**
```typescript
// console 직접 사용 금지
console.log('디버그');
console.error('에러');
console.warn('경고');
```

### 2.3 Firebase 실시간 구독

**✅ 올바른 패턴:**
```typescript
import { onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

const useRealtimeData = (staffId: string) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'workLogs'),
      where('staffId', '==', staffId)
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const newData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setData(newData);
        setLoading(false);
      },
      (err) => {
        logger.error('실시간 구독 에러', { error: err, staffId });
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [staffId]);

  return { data, loading, error };
};
```

**❌ 수동 새로고침 금지:**
```typescript
// getDocs 사용하여 수동으로 데이터 가져오기 금지
const badFetchData = async () => {
  const snapshot = await getDocs(collection(db, 'staff'));
  // 실시간 업데이트 안됨
};
```

---

## 3. 🎨 UI/UX 일관성

### 3.1 Toast 시스템

**✅ Toast 사용:**
```typescript
import { showToast } from '@/utils/toast';

const handleSave = async () => {
  try {
    await saveData();
    showToast.success('저장되었습니다');
  } catch (error) {
    showToast.error('저장에 실패했습니다');
  }
};

// 다양한 Toast 타입
showToast.info('정보 메시지');
showToast.warning('경고 메시지');
```

**❌ alert() 사용 금지:**
```typescript
// 절대 사용하지 말 것
alert('저장되었습니다');
confirm('정말 삭제하시겠습니까?');
```

### 3.2 로딩 상태 처리

**필수 패턴:**
```typescript
const MyComponent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsyncAction = async () => {
    setLoading(true);
    setError(null);

    try {
      await asyncOperation();
    } catch (err) {
      setError(err.message);
      logger.error('비동기 작업 실패', { error: err });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">{error}</div>;

  return <div>{/* 정상 UI */}</div>;
};
```

### 3.3 국제화 (i18n)

**✅ 번역 키 사용:**
```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.title')}</h1>
      <button>{t('actions.save')}</button>
      <p>{t('messages.success', { name: userName })}</p>
    </div>
  );
};
```

**❌ 하드코딩 텍스트 금지:**
```typescript
// 절대 하지 말 것
<button>저장</button>
<h1>T-HOLDEM 관리</h1>
```

---

## 4. ⚡ 성능 최적화

### 4.1 메모이제이션

**필수 적용 케이스:**
```typescript
import { useMemo, useCallback } from 'react';

const ExpensiveComponent = ({ data, onUpdate }) => {
  // 복잡한 계산은 useMemo
  const calculatedValue = useMemo(() => {
    return heavyCalculation(data);
  }, [data]);

  // 함수는 useCallback
  const handleClick = useCallback((id: string) => {
    onUpdate(id);
  }, [onUpdate]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    return data.filter(item => item.active);
  }, [data]);

  return <div>{/* UI */}</div>;
};
```

### 4.2 React.memo

**컴포넌트 최적화:**
```typescript
import React from 'react';

interface Props {
  staffId: string;
  name: string;
  onUpdate: (id: string) => void;
}

const StaffCard = React.memo<Props>(({ staffId, name, onUpdate }) => {
  return (
    <div className="p-4 border rounded">
      <h3>{name}</h3>
      <button onClick={() => onUpdate(staffId)}>
        업데이트
      </button>
    </div>
  );
});

StaffCard.displayName = 'StaffCard';
export default StaffCard;
```

---

## 5. 📱 네이티브 앱 호환성

### 5.1 플랫폼 체크

**Capacitor 플랫폼 감지:**
```typescript
import { Capacitor } from '@capacitor/core';

const MyComponent = () => {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform(); // 'ios', 'android', 'web'

  return (
    <div>
      {isNative ? (
        <NativeFeature />
      ) : (
        <WebFallback />
      )}
    </div>
  );
};
```

### 5.2 Safe Area 처리

**CSS 클래스 활용:**
```tsx
const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 - Safe Area 대응 */}
      <header className="header-safe bg-blue-600 text-white">
        <h1>T-HOLDEM</h1>
      </header>

      {/* 메인 콘텐츠 - Safe Area 대응 */}
      <main className="content-safe">
        {children}
      </main>
    </div>
  );
};
```

### 5.3 네이티브 서비스 활용

**기존 서비스 활용:**
```typescript
// 카메라 기능
import { capturePhoto } from '@/services/camera';

// QR 스캔 기능
import { scanQRCode } from '@/services/qrScanner';

// 로컬 알림
import { scheduleNotification } from '@/services/localNotifications';

// 푸시 알림
import { sendPushNotification } from '@/services/notifications';
```

---

## 6. 🧪 테스트 작성

### 6.1 단위 테스트

**컴포넌트 테스트 예시:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { StaffCard } from './StaffCard';

describe('StaffCard', () => {
  const mockProps = {
    staffId: 'staff-1',
    name: '홍길동',
    onUpdate: jest.fn()
  };

  it('should render staff information correctly', () => {
    render(<StaffCard {...mockProps} />);

    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '업데이트' })).toBeInTheDocument();
  });

  it('should call onUpdate with correct staffId', () => {
    render(<StaffCard {...mockProps} />);

    fireEvent.click(screen.getByRole('button', { name: '업데이트' }));

    expect(mockProps.onUpdate).toHaveBeenCalledWith('staff-1');
  });
});
```

### 6.2 유틸리티 테스트

```typescript
import { calculateWorkHours } from '@/utils/workLogUtils';

describe('calculateWorkHours', () => {
  it('should calculate work hours correctly', () => {
    const startTime = '09:00';
    const endTime = '18:00';
    const result = calculateWorkHours(startTime, endTime);

    expect(result).toBe(9); // 9시간
  });

  it('should handle overnight shifts', () => {
    const startTime = '22:00';
    const endTime = '06:00';
    const result = calculateWorkHours(startTime, endTime);

    expect(result).toBe(8); // 8시간
  });
});
```

---

## 7. 🏗️ 빌드 검증

### 7.1 배포 전 필수 명령어

```bash
# 1. TypeScript 에러 체크 (반드시 통과해야 함)
npm run type-check

# 2. Lint 검사 (에러 0개)
npm run lint

# 3. 테스트 실행
npm run test

# 4. 프로덕션 빌드 (성공해야 함)
npm run build

# 5. Capacitor 동기화 (네이티브 앱)
npx cap sync
```

### 7.2 에러 대응

**TypeScript 에러:**
- `any` 타입 사용 → 구체적 타입 정의
- 암시적 any → 명시적 타입 선언
- 레거시 필드 사용 → 표준 필드로 변경

**Lint 에러:**
- console 사용 → logger 사용
- 사용하지 않는 import → 제거
- 접근성 문제 → aria 속성 추가

---

## 8. 📖 기능별 특별 고려사항

### 8.1 출석/QR 기능

```typescript
import { scanQRCode } from '@/services/qrScanner';
import { Capacitor } from '@capacitor/core';

const AttendanceComponent = () => {
  const handleQRScan = async () => {
    if (!Capacitor.isNativePlatform()) {
      showToast.warning('QR 스캔은 모바일 앱에서만 가능합니다');
      return;
    }

    try {
      const result = await scanQRCode();
      // QR 데이터 처리
    } catch (error) {
      logger.error('QR 스캔 실패', { error });
      showToast.error('QR 스캔에 실패했습니다');
    }
  };
};
```

### 8.2 결제/급여 기능

```typescript
import { calculatePayroll } from '@/utils/payrollCalculations';

const PayrollComponent = () => {
  const handlePayrollCalculation = useCallback(async (staffId: string) => {
    setLoading(true);

    try {
      // Web Worker 사용 (대용량 계산)
      const result = await calculatePayroll(staffId);

      // 소수점 정확도 보장
      const roundedAmount = Math.round(result.amount * 100) / 100;

      showToast.success(`급여가 계산되었습니다: ${roundedAmount.toLocaleString()}원`);
    } catch (error) {
      logger.error('급여 계산 실패', { error, staffId });
      showToast.error('급여 계산에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);
};
```

### 8.3 알림 기능

```typescript
import { sendPushNotification } from '@/services/notifications';
import { scheduleNotification } from '@/services/localNotifications';

const NotificationComponent = () => {
  // FCM 푸시 알림
  const sendPush = async (staffId: string, message: string) => {
    await sendPushNotification(staffId, {
      title: 'T-HOLDEM 알림',
      body: message,
      data: { type: 'general', timestamp: Date.now() }
    });
  };

  // 로컬 알림 (스케줄)
  const scheduleReminder = async (date: Date, message: string) => {
    await scheduleNotification({
      title: '근무 리마인더',
      body: message,
      schedule: { at: date }
    });
  };
};
```

---

## 9. ❌ 절대 하면 안 되는 것들 (Anti-patterns)

### 9.1 레거시 코드 패턴
```typescript
// ❌ 절대 사용하지 말 것
const badComponent = () => {
  // 레거시 필드 사용
  const dealerId = user.dealerId;  // ❌
  const jobPostingId = job.jobPostingId;  // ❌

  // console 직접 사용
  console.log('Debug');  // ❌

  // alert 사용
  alert('완료되었습니다');  // ❌

  // any 타입
  const data: any = {};  // ❌

  // 하드코딩 텍스트
  return <button>저장</button>;  // ❌
};
```

### 9.2 Firebase 안티패턴
```typescript
// ❌ 수동 데이터 갱신
const badDataUpdate = async () => {
  // onSnapshot 없이 수동으로 데이터 가져오기
  const snapshot = await getDocs(collection(db, 'staff'));
  // 실시간 업데이트 안됨
};

// ❌ 트랜잭션 없는 복잡한 업데이트
const badMultiUpdate = async () => {
  // 여러 컬렉션을 동시에 업데이트할 때 트랜잭션 미사용
  await updateDoc(staffRef, staffData);
  await updateDoc(workLogRef, workLogData);  // 중간에 실패하면 불일치
};
```

### 9.3 성능 안티패턴
```typescript
// ❌ 메모이제이션 없는 복잡한 계산
const BadComponent = ({ data }) => {
  // 매 렌더링마다 복잡한 계산 실행
  const expensiveResult = heavyCalculation(data);  // ❌

  // 매 렌더링마다 새 함수 생성
  const handleClick = () => {  // ❌
    doSomething();
  };

  return <div onClick={handleClick}>{expensiveResult}</div>;
};
```

---

## 10. 🚀 권장 개발 순서

### 10.1 기능 개발 프로세스

1. **요구사항 분석**
   - [ ] 기존 기능과 중복 확인
   - [ ] 재사용 가능 컴포넌트 파악
   - [ ] 데이터 모델 설계

2. **개발 준비**
   - [ ] TypeScript 인터페이스 정의
   - [ ] Firebase 스키마 설계
   - [ ] 컴포넌트 구조 계획

3. **UI 컴포넌트 개발**
   - [ ] 모바일 우선 디자인
   - [ ] Safe Area 대응
   - [ ] 국제화 적용

4. **비즈니스 로직 구현**
   - [ ] Service 레이어 활용
   - [ ] 실시간 구독 구현
   - [ ] 에러 처리 완벽하게

5. **테스트 작성**
   - [ ] 단위 테스트
   - [ ] 통합 테스트
   - [ ] 접근성 테스트

6. **최적화 및 검증**
   - [ ] 성능 프로파일링
   - [ ] 번들 크기 확인
   - [ ] 빌드 검증

7. **문서화 및 배포**
   - [ ] 코드 주석 추가
   - [ ] README 업데이트
   - [ ] 배포 준비

### 10.2 코드 리뷰 체크리스트

**리뷰어가 확인해야 할 항목:**
- [ ] 표준 필드명 사용 여부
- [ ] TypeScript strict mode 준수
- [ ] Logger 사용 여부
- [ ] 실시간 구독 구현
- [ ] Toast 시스템 사용
- [ ] 로딩/에러 상태 처리
- [ ] 국제화 적용
- [ ] 테스트 케이스 작성
- [ ] 성능 최적화 적용
- [ ] 네이티브 앱 호환성

---

## 📚 참고 자료

### 내부 문서
- [CLAUDE.md](../CLAUDE.md) - 프로젝트 기본 가이드
- [CAPACITOR_MIGRATION_GUIDE.md](CAPACITOR_MIGRATION_GUIDE.md) - 네이티브 앱 개발 가이드
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - 테스트 작성 가이드
- [CONTRIBUTING.md](../CONTRIBUTING.md) - 기여 가이드

### 외부 참조
- [React TypeScript 가이드](https://react-typescript-cheatsheet.netlify.app/)
- [Firebase v11 문서](https://firebase.google.com/docs)
- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 🤝 문의사항

이 가이드에 대한 문의사항이나 개선 제안이 있으시면 다음을 통해 연락해주세요:

- **GitHub Issues**: 버그 리포트, 기능 제안
- **팀 채널**: 실시간 질의응답
- **코드 리뷰**: 구체적인 구현 관련 논의

---

**마지막 업데이트**: 2025년 9월 30일
**버전**: v1.0.0
**관리자**: T-HOLDEM Development Team