# 🔧 T-HOLDEM 문제 해결 가이드

**최종 업데이트**: 2025년 9월 8일  
**버전**: v4.1 (Production Ready)  
**상태**: ✅ 주요 이슈 모두 해결 완료 (스태프 삭제 이슈 포함)

## 📋 목차

1. [해결된 주요 이슈](#-해결된-주요-이슈)
2. [자주 발생하는 문제](#-자주-발생하는-문제)
3. [개발 환경 문제](#-개발-환경-문제)
4. [Firebase 관련 이슈](#-firebase-관련-이슈)
5. [성능 최적화 이슈](#-성능-최적화-이슈)
6. [UI/UX 문제](#-uiux-문제)
7. [배포 관련 문제](#-배포-관련-문제)
8. [긴급 상황 대응](#-긴급-상황-대응)

## ✅ 해결된 주요 이슈

### 🎯 스태프 삭제 시 인원 카운트 미반영 문제 (완전 해결)

**문제**: 스태프 삭제 시 JobPosting의 confirmedStaff에서 제거되지 않아 인원 카운트가 정확하지 않은 문제

**원인**: 
```typescript
// ❌ 문제 코드 - staffId와 userId 매칭 실패
const filteredStaff = confirmedStaff.filter(
  staff => !(staff.userId === staffId && staff.date === date)
);
// staffId: "abc123_0", staff.userId: "abc123" → 매칭 실패
```

**해결 방법**:
```typescript
// ✅ 해결 코드 - baseStaffId 추출 로직 추가
const baseStaffId = staffId.replace(/_\d+$/, ''); // "_0", "_1" 등 제거

const filteredStaff = confirmedStaff.filter(staff => {
  const staffUserId = staff.userId || staff.staffId;
  return !(staffUserId === baseStaffId && staff.date === date);
});
```

**결과**: 
- ✅ confirmedStaff 정확한 삭제
- ✅ JobPostingCard 인원 카운트 실시간 반영
- ✅ 사용자 피드백 개선 (예: "플로어 10:00: 5 → 4명")

### 🎉 WorkLog 중복 생성 문제 (완전 해결)

**문제**: 시간 수정 + 출석 상태 변경 시 WorkLog가 2개 생성되는 문제

**해결 방법**:
```typescript
// 1. 스태프 확정 시 WorkLog 사전 생성 (useApplicantActions.ts)
const createWorkLogForConfirmedStaff = async (staffData) => {
  const workLogId = `${eventId}_${staffId}_0_${date}`;
  
  // 중복 방지를 위한 ID 패턴 통일
  await addDoc(collection(db, 'workLogs'), {
    id: workLogId,
    staffId: staffData.staffId,
    eventId: eventId,
    // ... 기타 필드
  });
};

// 2. 출석 상태 변경 시 기존 WorkLog만 업데이트
const updateExistingWorkLog = async (workLogId, updates) => {
  const workLogRef = doc(db, 'workLogs', workLogId);
  await updateDoc(workLogRef, updates);
};
```

**결과**: ✅ WorkLog 중복 생성 100% 해결

### 🎉 데이터 표시 일관성 문제 (완전 해결)

**문제**: 지원자 탭과 내 지원 현황 탭 간 데이터 표시 불일치

**해결 방법**:
```typescript
// AssignmentDisplay 컴포넌트 통합 사용
const AssignmentDisplay = ({ assignments, showGroupLabel = false }) => {
  const hasGroupSelection = assignments?.some(a => a.checkMethod === 'group');
  
  return (
    <div className="flex flex-wrap gap-1">
      {hasGroupSelection && showGroupLabel && (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
          그룹선택
        </span>
      )}
      {assignments?.map((assignment, index) => (
        <span key={index} className="px-2 py-1 bg-gray-100 rounded text-sm">
          {assignment.date} - {assignment.role}
        </span>
      ))}
    </div>
  );
};
```

**결과**: ✅ 탭 간 데이터 표시 일관성 100% 확보

### 🎉 무한 로딩 문제 (완전 해결)

**문제**: `loading` 상태 관리 오류로 인한 무한 로딩

**해결 방법**:
```typescript
// ❌ 문제가 있던 코드
if (loading) return <div>로딩중...</div>;

// ✅ 올바른 해결법
const { loading } = useUnifiedData();
if (loading.initial) return <div>로딩중...</div>;

// loading 상태 구조
interface LoadingState {
  initial: boolean;    // 초기 로딩
  refreshing: boolean; // 새로고침
  updating: boolean;   // 업데이트
}
```

**결과**: ✅ 무한 로딩 문제 100% 해결

### 🎉 동기화 문제 (완전 해결)

**문제**: 지원서 제출 후 관리자 패널에서 데이터가 표시되지 않음

**해결 방법**:
```typescript
// 1. transformApplicationData에서 eventId 보장
const transformApplicationData = (doc: DocumentData): Application => ({
  id: doc.id,
  eventId: doc.eventId || doc.postId || '', // ✅ eventId 필드 보장
  // ... 기타 필드
});

// 2. 사용자별 권한 기반 데이터 필터링
const applicationsQuery = this.isAdmin() 
  ? query(collection(db, 'applications'))  // 관리자: 모든 데이터
  : query(collection(db, 'applications'),   // 사용자: 개인 데이터만
          where('applicantId', '==', this.currentUserId));
```

**결과**: ✅ 실시간 동기화 100% 정상화

## 🚨 자주 발생하는 문제

### 1. 개발 서버 시작 실패

**증상**: `npm start` 실행 시 포트 충돌 또는 의존성 오류

**해결법**:
```bash
# 1. 포트 충돌 해결
lsof -ti:3000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :3000   # Windows (프로세스 ID 확인 후 종료)

# 2. 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 3. 캐시 클리어
npm start -- --reset-cache
```

### 2. TypeScript 컴파일 에러

**증상**: 빌드 시 TypeScript 에러 발생

**해결법**:
```bash
# 1. 타입 체크 실행
npm run type-check

# 2. 일반적인 에러 해결
# - any 타입 사용 금지
# - 표준 필드명 사용 (staffId, eventId)
# - optional 체이닝 활용

// ❌ 문제 코드
const name = staff.name;

// ✅ 해결 코드
const name = staff?.name || 'Unknown';
```

### 3. Firebase 연결 실패

**증상**: Firebase 초기화 오류 또는 권한 거부

**해결법**:
```typescript
// 1. 환경 변수 확인
console.log('Firebase Config:', {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  // ... 기타 설정
});

// 2. 에뮬레이터 연결 확인
if (process.env.NODE_ENV === 'development') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (error) {
    console.log('에뮬레이터 이미 연결됨');
  }
}

// 3. 인증 상태 확인
const { currentUser } = useAuth();
if (!currentUser) {
  return <Navigate to="/login" />;
}
```

## 🛠️ 개발 환경 문제

### Node.js 버전 호환성

**요구사항**: Node.js 18.0.0 이상

```bash
# 현재 버전 확인
node --version

# nvm을 사용한 버전 관리
nvm install 18
nvm use 18

# 또는 직접 설치
# https://nodejs.org에서 LTS 버전 다운로드
```

### ESLint/Prettier 충돌

**증상**: 저장 시 포맷팅이 계속 변경됨

**해결법**:
```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### 환경 변수 문제

**증상**: 환경 변수가 로드되지 않음

**해결법**:
```bash
# 1. .env 파일 위치 확인 (app2/.env)
# 2. REACT_APP_ 접두어 확인
# 3. 파일 권한 확인

# .env 파일 예시
REACT_APP_FIREBASE_API_KEY=your_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain.firebaseapp.com
# 주의: 따옴표나 공백 없이 작성
```

## 🔥 Firebase 관련 이슈

### Firestore 권한 오류

**증상**: `permission-denied` 또는 `unauthenticated` 오류

**해결법**:
```javascript
// 1. 보안 규칙 확인
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 개인 데이터만 접근
    match /applications/{applicationId} {
      allow read, write: if request.auth != null && 
        (resource.data.applicantId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager']);
    }
  }
}
```

### 쿼리 성능 문제

**증상**: 느린 쿼리 실행 또는 timeout 오류

**해결법**:
```typescript
// ❌ 비효율적인 쿼리
const getAllWorkLogs = async () => {
  return getDocs(collection(db, 'workLogs')); // 모든 데이터 로드
};

// ✅ 최적화된 쿼리
const getWorkLogsByEvent = async (eventId: string, limit = 100) => {
  return getDocs(query(
    collection(db, 'workLogs'),
    where('eventId', '==', eventId),
    orderBy('date', 'desc'),
    limitToLast(limit)
  ));
};
```

### 실시간 구독 메모리 누수

**증상**: 페이지 이동 후에도 구독이 유지되어 메모리 사용량 증가

**해결법**:
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'staff'),
    (snapshot) => {
      // 데이터 처리
    }
  );

  // ✅ 컴포넌트 언마운트 시 구독 해제
  return unsubscribe;
}, []);
```

## ⚡ 성능 최적화 이슈

### 대용량 리스트 렌더링 느림

**해결법**: React Window 가상화 적용

```typescript
import { FixedSizeList as List } from 'react-window';

const VirtualizedList = ({ items }) => (
  <List
    height={600}        // 컨테이너 높이
    itemCount={items.length}
    itemSize={80}       // 각 아이템 높이
    itemData={items}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <ItemComponent item={data[index]} />
      </div>
    )}
  </List>
);
```

### 메인 스레드 블로킹

**해결법**: Web Worker 사용

```typescript
// payrollWorker.ts
self.onmessage = function(e) {
  const { workLogs } = e.data;
  const result = calculateHeavyPayroll(workLogs);
  self.postMessage(result);
};

// 컴포넌트에서 사용
const worker = new Worker('/payrollWorker.js');
worker.postMessage({ workLogs });
worker.onmessage = (e) => {
  setPayrollData(e.data);
};
```

### 불필요한 리렌더링

**해결법**: 메모이제이션 적용

```typescript
// ✅ useMemo로 계산 결과 캐싱
const filteredData = useMemo(() => 
  data.filter(item => item.status === selectedStatus),
  [data, selectedStatus]
);

// ✅ useCallback으로 함수 캐싱
const handleClick = useCallback((id) => {
  onItemClick(id);
}, [onItemClick]);

// ✅ React.memo로 컴포넌트 최적화
const ItemComponent = memo(({ item, onClick }) => (
  <div onClick={() => onClick(item.id)}>
    {item.name}
  </div>
));
```

## 🎨 UI/UX 문제

### 모바일 반응형 문제

**해결법**: Tailwind CSS 반응형 클래스 사용

```typescript
// ✅ 반응형 디자인 적용
<div className="
  grid grid-cols-1 gap-4
  md:grid-cols-2 md:gap-6
  lg:grid-cols-3 lg:gap-8
">
  {items.map(item => (
    <div key={item.id} className="
      p-4 border rounded-lg
      hover:shadow-md transition-shadow
      focus:ring-2 focus:ring-blue-500
    ">
      {item.content}
    </div>
  ))}
</div>
```

### 접근성 문제

**해결법**: ARIA 속성과 시맨틱 HTML 사용

```typescript
// ✅ 접근성 개선
<button
  aria-label="스태프 편집"
  aria-describedby="edit-help"
  className="sr-only focus:not-sr-only"  // 스크린 리더 지원
>
  편집
</button>

<div id="edit-help" className="sr-only">
  선택한 스태프의 정보를 편집합니다
</div>

// 키보드 네비게이션 지원
const handleKeyDown = (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleClick();
  }
};
```

### 다크 모드 문제

**해결법**: CSS 변수와 Tailwind 다크 모드 사용

```css
/* globals.css */
:root {
  --primary-color: #3b82f6;
  --background-color: #ffffff;
}

[data-theme="dark"] {
  --primary-color: #60a5fa;
  --background-color: #1f2937;
}
```

```typescript
// 다크 모드 토글
const toggleTheme = () => {
  const newTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  document.documentElement.setAttribute('data-theme', newTheme);
};
```

## 🚀 배포 관련 문제

### 빌드 실패

**해결법**:
```bash
# 1. 의존성 업데이트
npm update

# 2. TypeScript 에러 수정
npm run type-check

# 3. ESLint 경고 수정
npm run lint --fix

# 4. 메모리 부족 시
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```

### 환경별 설정 문제

**해결법**: 환경별 설정 파일 분리

```javascript
// config/environment.js
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    firebaseConfig: {
      // 개발용 Firebase 설정
    }
  },
  production: {
    apiUrl: 'https://tholdem-ebc18.web.app',
    firebaseConfig: {
      // 프로덕션용 Firebase 설정
    }
  }
};

export default config[process.env.NODE_ENV] || config.development;
```

### Firebase Hosting 배포 실패

**해결법**:
```bash
# 1. Firebase CLI 업데이트
npm install -g firebase-tools@latest

# 2. 로그인 재시도
firebase logout
firebase login

# 3. 프로젝트 설정 확인
firebase use --list
firebase use your-project-id

# 4. 배포 실행
firebase deploy --only hosting
```

## 🆘 긴급 상황 대응

### 프로덕션 서비스 중단

**즉시 조치**:
1. **현상 파악**: 에러 로그 확인 (Firebase Console, Sentry)
2. **영향 범위 확인**: 어떤 기능이 영향받는지 파악
3. **임시 조치**: 문제 기능 비활성화 또는 이전 버전으로 롤백

```bash
# 이전 버전으로 롤백
firebase hosting:releases:list
firebase hosting:releases:rollback TARGET_NAME --version-id VERSION_ID
```

### 데이터 손실 위험

**즉시 조치**:
1. **백업 확인**: Firebase Console에서 최근 백업 상태 확인
2. **쓰기 작업 중단**: 위험한 대량 업데이트 작업 중단
3. **데이터 내보내기**: 중요 데이터 즉시 내보내기

```bash
# Firestore 데이터 내보내기
gcloud firestore export gs://your-bucket-name/backup-$(date +%Y%m%d)
```

### 보안 취약점 발견

**즉시 조치**:
1. **취약점 격리**: 해당 기능 즉시 비활성화
2. **패치 적용**: 보안 업데이트 즉시 적용
3. **영향 분석**: 로그 분석으로 악용 여부 확인

```bash
# 의존성 보안 스캔
npm audit
npm audit fix --force

# Firebase 보안 규칙 업데이트
firebase deploy --only firestore:rules
```

## 📞 지원 연락처

### 개발팀 연락처
- **긴급 상황**: GitHub Issues 생성
- **일반 문의**: 프로젝트 저장소 Discussions
- **버그 리포트**: GitHub Issues 템플릿 사용

### 외부 서비스 지원
- **Firebase**: [Firebase Support](https://firebase.google.com/support)
- **Sentry**: [Sentry Support](https://sentry.io/support/)
- **Vercel**: [Vercel Support](https://vercel.com/support)

## 🔗 관련 문서

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: 시스템 아키텍처 이해
- **[DEVELOPMENT.md](./DEVELOPMENT.md)**: 개발 환경 설정
- **[DATA_SCHEMA.md](./DATA_SCHEMA.md)**: 데이터 구조 이해
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: 배포 환경 설정

---

*마지막 업데이트: 2025년 9월 8일 - 주요 이슈 해결 완료 및 대응 가이드 통합*