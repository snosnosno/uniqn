> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 설계, 기록, 레거시 참고 또는 시점 한정 로그입니다.
> 현재 기준 문서는 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`, `docs/guides/DEPLOYMENT.md`를 우선 확인하세요.
# Legacy Notice

`app2/` is preserved for historical reference only.

Current V3 canonical job posting and application contracts are defined in `uniqn-mobile/` and `functions/`.
Do not treat `app2/` types or legacy Firestore shapes as the source of truth for new work.
 # T-HOLDEM 애플리케이션 가이드

> ⚠️ **[DEPRECATED - 레거시 웹앱]**
>
> **이 디렉토리(app2/)는 레거시 웹앱입니다. 개발이 중단되었습니다.**
>
> 현재 주력 플랫폼은 **uniqn-mobile/** (React Native + Expo)입니다.
> 이 웹앱은 **토너먼트 로직 참고용**으로만 보관됩니다.

**버전**: v0.2.2 (레거시 - 개발 중단)
**애플리케이션**: React 18 + TypeScript + Firebase (Capacitor)
**상태**: 📁 **개발 중단** - 토너먼트 로직 참고용

---

## 🚀 빠른 시작

### 필수 요구사항
- Node.js 18.0.0 이상
- npm 9.0.0 이상
- Firebase CLI 13.0.0 이상

### 설치 및 실행
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm start

# Firebase 에뮬레이터와 함께 실행
npm run dev
```

## 📦 주요 기능

### 🔐 인증 시스템
- **이메일/소셜 로그인**: Firebase Authentication 기반
- **2단계 인증(2FA)**: 보안 강화 기능
- **세션 관리**: 안전한 로그인 상태 유지
- **권한 관리**: 역할 기반 접근 제어

### 🌐 국제화 (i18n)
- **다국어 지원**: 한국어/영어 완전 지원
- **동적 언어 전환**: 실시간 언어 변경
- **번역 파일 관리**: `public/locales/` 폴더

### 💼 비즈니스 기능
- **구인공고 관리**: CRUD 기능
- **지원자 관리**: 지원 프로세스
- **스태프 관리**: 직원 정보 관리
- **출석 관리**: 실시간 출석 추적
- **급여 계산**: 자동 급여 정산

## 🗂️ 프로젝트 구조

```
app2/
├── public/                 # 정적 파일
│   ├── locales/           # 다국어 번역 파일
│   │   ├── ko/            # 한국어
│   │   └── en/            # 영어
│   └── index.html
├── src/
│   ├── components/        # 재사용 가능한 컴포넌트
│   │   ├── attendance/    # 출석 관련 (2개)
│   │   ├── auth/          # 인증 관련 (4개)
│   │   ├── errors/        # 에러 처리 (3개)
│   │   ├── layout/        # 레이아웃 (3개)
│   │   ├── modals/        # 모달 관리 (12개)
│   │   ├── staff/         # 스태프 관리 (9개)
│   │   ├── tables/        # 테이블 관리 (2개)
│   │   ├── time/          # 시간 관리 (2개)
│   │   └── upload/        # 업로드 (1개)
│   ├── contexts/          # React Context
│   │   ├── UnifiedDataContext.tsx  # 통합 데이터 관리 ⭐
│   │   └── AuthContext.tsx         # 인증 관리
│   ├── hooks/             # 커스텀 훅
│   │   ├── useUnifiedData.ts       # 데이터 접근 ⭐
│   │   └── useAuth.ts              # 인증 훅
│   ├── pages/             # 페이지 컴포넌트
│   │   ├── JobBoard/      # 구인 게시판
│   │   ├── MySchedulePage/ # 내 스케줄
│   │   └── ProfilePage/   # 프로필
│   ├── services/          # 비즈니스 로직
│   │   ├── unifiedDataService.ts   # 통합 데이터 서비스 ⭐
│   │   └── i18n.ts        # 국제화 설정
│   ├── types/             # TypeScript 타입
│   │   ├── unifiedData.ts # 통합 데이터 타입 ⭐
│   │   └── common.ts      # 공통 타입
│   └── utils/             # 유틸리티
│       ├── logger.ts      # 로깅 시스템
│       └── formatters.ts  # 데이터 포맷터
├── package.json           # 프로젝트 설정
└── tsconfig.json         # TypeScript 설정
```

## 📜 개발 명령어

### 개발 & 디버깅
```bash
npm start                    # 개발 서버 (localhost:3000)
npm run dev                 # Firebase 에뮬레이터 + 개발 서버
npm run type-check          # TypeScript 에러 체크 (필수!)
npm run lint               # ESLint 검사
npm run format             # Prettier 포맷 정리
```

### 빌드 & 배포
```bash
npm run build              # 프로덕션 빌드
npm run analyze            # 번들 크기 분석
```

### 테스트 & 품질
```bash
npm run test               # Jest 테스트 실행
npm run test:coverage      # 커버리지 확인 (목표: 65%)
npm run test:ci           # CI용 테스트 (watch 모드 없음)
```

## 🔧 핵심 아키텍처

### UnifiedDataContext
모든 데이터를 중앙에서 관리하는 핵심 아키텍처:

```typescript
const {
  staff, workLogs, applications,
  loading, error,
  actions
} = useUnifiedData();
```

### Firebase 컬렉션 구조
| 컬렉션 | 핵심 필드 | 용도 |
|--------|-----------|------|
| `staff` | staffId, name, role | 스태프 기본 정보 |
| `workLogs` | **staffId**, **eventId**, date | 근무 기록 |
| `applications` | **eventId**, applicantId, status | 지원서 |
| `jobPostings` | id, title, location, roles | 구인공고 |
| `attendanceRecords` | **staffId**, status, timestamp | 출석 기록 |

## 🌍 국제화 (i18n) 사용법

### 텍스트 번역
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('auth.login.success')}</p>
    </div>
  );
}
```

### 언어 전환
```typescript
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div>
      <button onClick={() => changeLanguage('ko')}>한국어</button>
      <button onClick={() => changeLanguage('en')}>English</button>
    </div>
  );
}
```

## 🛡️ 보안 고려사항

### Firebase 보안 규칙
- 인증된 사용자만 데이터 접근 가능
- 역할 기반 권한 제어
- 민감한 정보 암호화

### 코딩 규칙
- TypeScript strict mode 준수
- `logger` 사용 (console.log 금지)
- 표준 필드명 사용: `staffId`, `eventId`

## 📊 성능 지표

- **번들 크기**: 279KB (최적화 완료)
- **테스트 커버리지**: 65% (Production Ready 수준)
- **TypeScript 에러**: 0개
- **컴포넌트**: 47개 → 17개 (65% 감소)

## 🔗 관련 문서

- **아키텍처**: `../docs/reference/ARCHITECTURE.md`
- **배포 가이드**: `../docs/guides/DEPLOYMENT.md`
- **API 명세**: `../docs/reference/API_REFERENCE.md`
- **테스트 가이드**: `TESTING_GUIDE.md`

---

*T-HOLDEM 애플리케이션 개발팀* # Redux DevTools 모니터링 가이드

Zustand Store를 Redux DevTools로 모니터링하는 방법입니다.

## 📦 설치 (이미 완료됨)

```bash
# Redux DevTools Extension 설치
# Chrome: https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd
```

## 🎯 Zustand Store에 devtools 미들웨어 적용 (이미 완료됨)

```typescript
// app2/src/stores/unifiedDataStore.ts
import { devtools } from 'zustand/middleware';

export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({
      // ... Store 정의
    })),
    { name: 'UnifiedDataStore' } // Redux DevTools에 표시될 이름
  )
);
```

## 🔍 Redux DevTools 사용 방법

### 1. Redux DevTools 열기

브라우저 개발자 도구(F12) → **Redux** 탭 클릭

### 2. State 탭

현재 Zustand Store의 전체 상태를 확인할 수 있습니다.

```json
{
  "staff": {}, // Map 객체 (비어 보이지만 실제로는 데이터 있음)
  "workLogs": {},
  "applications": {},
  "attendanceRecords": {},
  "jobPostings": {},
  "isLoading": false,
  "error": null
}
```

⚠️ **주의**: Map 객체는 JSON.stringify로 직렬화되지 않아 빈 객체로 표시될 수 있습니다.

### 3. Diff 탭

상태 변경 전후를 비교할 수 있습니다.

```diff
- isLoading: false
+ isLoading: true
```

### 4. Action 탭

실행된 Action 이력을 확인할 수 있습니다.

```
setStaff
setWorkLogs
setApplications
updateWorkLog
deleteJobPosting
```

### 5. Trace 탭

Action이 실행된 소스 코드 위치를 추적할 수 있습니다.

## 📊 주요 모니터링 포인트

### 1. Firebase 실시간 구독 확인

```javascript
// UnifiedDataInitializer가 구독 시작하면:
Action: subscribeAll

// Firebase onSnapshot이 데이터를 받으면:
Action: setStaff (count: 0)
Action: setWorkLogs (count: 3)
Action: setApplications (count: 4)
Action: setJobPostings (count: 1)
```

### 2. 데이터 업데이트 추적

```javascript
// WorkLog 업데이트 시:
Action: updateWorkLog
State Diff:
  workLogs:
    - "wl123": { status: "not_started", ... }
    + "wl123": { status: "checked_in", ... }
```

### 3. 에러 발생 추적

```javascript
// Firebase 에러 발생 시:
Action: setError
State Diff:
  - error: null
  + error: "Firestore error: permission-denied"
```

## 🛠️ 유용한 기능

### 1. Time Travel Debugging

Redux DevTools에서 특정 Action으로 이동하여 상태를 확인할 수 있습니다.

- **Jump**: 특정 시점으로 이동
- **Skip**: 특정 Action 건너뛰기

### 2. Action Filtering

특정 Action만 필터링하여 볼 수 있습니다.

```
setWorkLogs  (근무 기록 변경만 보기)
setError     (에러 발생만 보기)
```

### 3. Export/Import State

현재 상태를 JSON으로 내보내거나 가져올 수 있습니다.

```json
{
  "isLoading": false,
  "error": null,
  "staff": {},
  "workLogs": {},
  ...
}
```

## 🔧 실전 디버깅 예제

### 예제 1: 지원자가 표시되지 않는 문제

1. **Redux DevTools** → **State** 탭 확인
2. `applications` 객체 확인 (Map이라 빈 객체로 보임)
3. **브라우저 콘솔**에서 실제 데이터 확인:

```javascript
// 콘솔에서 실행
window.__REDUX_DEVTOOLS_EXTENSION__.send({ type: 'GET_STATE' }, window.__zustand_store_state__);
```

4. **Action** 탭에서 `setApplications` 실행 이력 확인
5. 로그 메시지 확인:

```
[UnifiedDataStore] Applications 데이터 업데이트 { count: 4 }
```

### 예제 2: 실시간 업데이트 확인

1. Firestore에서 데이터 수정
2. **Redux DevTools** → **Action** 탭에서 자동으로 Action 발생 확인
3. **Diff** 탭에서 변경 사항 확인

## 📈 성능 모니터링

### 1. 렌더링 최적화 확인

```typescript
// useShallow로 불필요한 리렌더링 방지 확인
const { staff, workLogs } = useUnifiedDataStore(
  useShallow((state) => ({
    staff: state.staff,
    workLogs: state.workLogs,
  }))
);
```

**Redux DevTools**에서:
- `setApplications` 실행 시
- `staff`, `workLogs`만 구독한 컴포넌트는 리렌더링되지 않아야 함

### 2. Map 데이터 직접 확인

Redux DevTools는 Map을 직렬화하지 못하므로, 브라우저 콘솔 로그로 확인:

```typescript
// unifiedDataStore.ts의 onSnapshot 콜백에서
logger.info('[UnifiedDataStore] Applications 데이터 업데이트', {
  count: appsMap.size,
  data: Array.from(appsMap.entries()), // Map → Array 변환
});
```

## 🎯 권장 워크플로우

1. **개발 시작**: Redux DevTools 열기
2. **로그인**: `subscribeAll` Action 발생 확인
3. **데이터 로딩**: 각 컬렉션의 `set*` Actions 확인
4. **기능 테스트**: CRUD Actions 실행 확인
5. **에러 발생**: `setError` Action 확인, State에 에러 메시지 확인

## 🚨 트러블슈팅

### Map 데이터가 빈 객체로 표시됨

**원인**: Map 객체는 JSON.stringify로 직렬화되지 않음

**해결책**: 
1. 브라우저 콘솔 로그 확인
2. logger.info로 Array.from(map.values()) 출력

### Redux DevTools에서 Action이 보이지 않음

**원인**: devtools 미들웨어가 제대로 적용되지 않음

**해결책**:
```typescript
// unifiedDataStore.ts 확인
export const useUnifiedDataStore = create<UnifiedDataStore>()(
  devtools(
    immer((set, get) => ({ ... })),
    { name: 'UnifiedDataStore' } // ← 이 부분 확인
  )
);
```

### 실시간 업데이트가 Redux DevTools에 반영되지 않음

**원인**: Zustand의 set 함수를 사용하지 않고 직접 Map을 수정함

**해결책**: 항상 set 함수 사용
```typescript
// ❌ 잘못된 방법
state.staff.set('id', newStaff);

// ✅ 올바른 방법
set((state) => {
  state.staff.set('id', newStaff);
});
```

## 📚 참고 자료

- [Zustand DevTools 미들웨어](https://docs.pmnd.rs/zustand/integrations/persisting-store-data#how-can-i-use-it-with-typescript)
- [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools)
- [Immer + Map/Set](https://immerjs.github.io/immer/map-set)

---

**마지막 업데이트**: 2025-11-15  
**작성자**: Claude Code  
**프로젝트**: UNIQN (T-HOLDEM)
 # TODO 항목 정리

프로젝트 내 TODO/FIXME 주석 모음 및 향후 작업 계획

**마지막 업데이트**: 2025-10-04
**총 TODO 개수**: 14개

---

## 📋 카테고리별 분류

### 1. 미래 기능 준비 (7개)

#### StaffManagementTab.tsx
- **Line 375**: 대량 선택 기능 준비 완료
- **Line 381**: 가상화 기능 준비 완료
- **Line 801**: 대량 작업 기능 준비 완료
- **Line 954**: 대량 메시지 기능 준비 완료
- **Line 959**: 대량 상태 변경 기능 준비 완료

**우선순위**: 낮음
**계획**: v0.3.0에서 구현 예정

#### useUnifiedData.ts
- **Line 34**: UnifiedDataContext options 전달 로직

**우선순위**: 중간
**계획**: Context API 최적화 시 구현

---

### 2. 레거시 타입 (3개)

#### OptimizedUnifiedDataService.ts
- **Line 40**: LegacyApplication 타입 (현재 미사용)

**우선순위**: 낮음
**조치**: Phase 3 완료로 레거시 필드 제거 완료, 타입 정리만 남음

#### useStaffWorkData.ts
- **Line 6**: RolePayrollInfo 타입 (미래 급여 정보용)

**우선순위**: 낮음
**계획**: 급여 시스템 확장 시 활성화

#### MyApplicationsTab.tsx
- **Line 136**: 단일 지원 시간대 표시 컴포넌트 (미사용)

**우선순위**: 낮음
**조치**: 사용하지 않으면 제거 고려

---

### 3. 기능 구현 필요 (4개)

#### OptimizedUnifiedDataService.ts
- **Line 371**: 실제 사용자 역할 확인 로직 구현
- **Line 376**: 실제 사용자 역할 확인 로직 구현

**우선순위**: 높음
**계획**: 권한 시스템 강화 시 구현 (v0.2.4)

#### unifiedDataService.ts
- **Line 110**: 데이터 변환 유틸리티 (미사용)

**우선순위**: 낮음
**조치**: OptimizedUnifiedDataService로 이전 완료, 파일 정리 고려

#### setupEmulator.ts
- **Line 13**: where 필터링 기능 (미래용)

**우선순위**: 낮음
**계획**: 테스트 유틸리티 확장 시 구현

---

## 🎯 우선순위별 작업 계획

### 높음 (즉시 처리)
- [ ] 사용자 역할 확인 로직 구현 (OptimizedUnifiedDataService.ts:371, 376)

### 중간 (v0.2.4)
- [ ] UnifiedDataContext options 전달 로직 (useUnifiedData.ts:34)
- [ ] 미사용 코드 정리 (unifiedDataService.ts, MyApplicationsTab.tsx)

### 낮음 (v0.3.0)
- [ ] StaffManagementTab 대량 작업 기능 (5개 항목)
- [ ] 레거시 타입 정리
- [ ] 테스트 유틸리티 확장

---

## 📝 관련 문서
- [개발 가이드](../../docs/core/DEVELOPMENT_GUIDE.md)
- [변경 이력](../../CHANGELOG.md)
- [프로젝트 가이드](../../CLAUDE.md)

