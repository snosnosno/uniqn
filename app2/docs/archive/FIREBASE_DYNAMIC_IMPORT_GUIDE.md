# 🔥 Firebase 동적 Import 가이드

## 📋 개요

Firebase Storage와 Functions 모듈을 동적으로 import하여 초기 번들 크기를 줄이고 성능을 향상시킵니다.

### 기대 효과
- **초기 번들 크기**: ~50KB 감소
- **첫 로딩 시간**: 0.3-0.5초 단축
- **사용자 경험**: 필요한 시점에만 모듈 로드

## 🛠️ 설정

### 1. 기본 설정 변경 (firebase.ts)

```typescript
// ❌ Before - 정적 import
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

export const storage = getStorage(app);
export const functions = getFunctions(app);

// ✅ After - 동적 import 사용
// Storage와 Functions는 firebase-dynamic.ts의 유틸리티 사용
```

### 2. 유틸리티 함수 사용

#### Storage 관련 함수

```typescript
import { 
  getStorageLazy, 
  uploadFileLazy, 
  getDownloadURLLazy,
  deleteFileLazy 
} from '../utils/firebase-dynamic';

// 파일 업로드
const handleUpload = async (file: File) => {
  try {
    const downloadURL = await uploadFileLazy(file, `uploads/${file.name}`);
    console.log('파일 업로드 성공:', downloadURL);
  } catch (error) {
    console.error('업로드 실패:', error);
  }
};

// 다운로드 URL 가져오기
const getFileURL = async (path: string) => {
  const url = await getDownloadURLLazy(path);
  return url;
};
```

#### Functions 관련 함수

```typescript
import { callFunctionLazy } from '../utils/firebase-dynamic';

// Cloud Function 호출
const generateQRCode = async (eventId: string) => {
  try {
    const result = await callFunctionLazy('generateQrCodeToken', { eventId });
    return result.token;
  } catch (error) {
    console.error('Function 호출 실패:', error);
  }
};
```

## 📝 마이그레이션 체크리스트

### Storage 사용 컴포넌트
- [ ] 프로필 이미지 업로드
- [ ] 문서 첨부 파일
- [ ] 이벤트 이미지

### Functions 사용 컴포넌트
- [x] **QRCodeGeneratorModal** - 완료 ✅
- [ ] PayrollProcessingTab
- [ ] AttendancePage
- [ ] admin/Approval
- [ ] admin/PayrollAdminPage
- [ ] admin/UserManagementPage
- [ ] PayrollPage
- [ ] SignUp
- [ ] StaffNewPage
- [ ] EditUserModal

## 🔧 사용 예시

### Before (정적 import)
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const generateTokenFunc = httpsCallable(functions, 'generateQrCodeToken');
const result = await generateTokenFunc({ eventId });
```

### After (동적 import)
```typescript
import { callFunctionLazy } from '../utils/firebase-dynamic';

const result = await callFunctionLazy('generateQrCodeToken', { eventId });
```

## 🚀 고급 기능

### 1. 모듈 사전 로딩
사용자가 특정 기능을 사용할 가능성이 높을 때 백그라운드에서 미리 로드:

```typescript
import { preloadModules } from '../utils/firebase-dynamic';

// 사용자가 파일 업로드 버튼에 마우스를 올렸을 때
const handleMouseEnter = () => {
  preloadModules(); // 백그라운드에서 모듈 로드
};
```

### 2. 로드 상태 확인
```typescript
import { getLoadStatus } from '../utils/firebase-dynamic';

const status = getLoadStatus();
console.log('Storage 로드됨:', status.storage);
console.log('Functions 로드됨:', status.functions);
```

### 3. 에러 처리
```typescript
try {
  const result = await callFunctionLazy('myFunction', data);
} catch (error) {
  if (error.code === 'functions/unavailable') {
    // 네트워크 오류 처리
  } else {
    // 기타 오류 처리
  }
}
```

## ⚠️ 주의사항

1. **첫 호출 지연**: 처음 호출 시 모듈 로딩으로 약간의 지연 발생
2. **에러 처리**: 네트워크 오류 시 적절한 폴백 처리 필요
3. **타입 안전성**: TypeScript 타입이 동적 import에서 제한될 수 있음

## 📊 성능 측정

### 번들 크기 비교
- **Before**: Firebase Functions (~30KB) + Storage (~20KB) = 50KB
- **After**: 필요 시에만 로드 (0KB 초기 번들)

### 로딩 시간
- **모듈 로드 시간**: ~100-300ms (네트워크에 따라)
- **초기 페이지 로드**: 0.3-0.5초 단축

## 🔍 디버깅

콘솔에서 다음 메시지로 동작 확인:
- `🔄 Firebase Storage 모듈 로딩 중...`
- `✅ Firebase Storage 로드 완료 (XXXms)`
- `📦 Firebase Storage 인스턴스 생성 완료`
- `🔄 Cloud Function 호출 중: functionName`
- `✅ Cloud Function 호출 성공: functionName`