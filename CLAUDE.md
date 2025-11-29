# CLAUDE.md

**UNIQN 프로젝트 개발 가이드** - Claude Code (claude.ai/code) 전용

## 🎯 **최우선 지침** (모든 작업에서 필수 준수)

### ✅ **필수 규칙**
- ****항상 한글로 답변할 것****
- TypeScript strict mode 100% 준수 (any 타입 사용 금지)
- 표준 필드명 사용: `staffId`, `eventId`
- Firebase `onSnapshot`으로 실시간 구독
- `logger` 사용 (`console.log` 금지)
- 메모이제이션 활용 (`useMemo`, `useCallback`)
- **다크모드 필수 적용**: 모든 UI 요소에 `dark:` 클래스 추가

### ❌ **절대 금지**
- `console.log`, `console.error` 직접 사용 (logger 사용할 것)
- `any` 타입 사용
- 다크모드 미적용 (`dark:` 클래스 누락)
- 절대 경로 사용 (상대 경로만 사용)

---

## 📌 프로젝트 개요

**UNIQN** - 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼

- **프로젝트 ID**: tholdem-ebc18
- **배포 URL**: https://tholdem-ebc18.web.app
- **상태**: 🚀 **Production Ready (100% 완성)**
- **버전**: v0.2.3
- **핵심 기능**: 실시간 알림, 구인공고(4타입), 스태프 관리, 출석 추적, 급여 정산, 토너먼트 운영

### 🗂️ 프로젝트 구조
```
📁 T-HOLDEM/                 # 프로젝트 루트
├── 📁 app2/                 # 메인 애플리케이션 ⭐
│   ├── 📁 src/              # 소스 코드
│   ├── 📁 public/           # 정적 자산
│   └── package.json         # 의존성 관리
├── 📁 functions/            # Firebase Functions
├── 📁 docs/                 # 문서
├── CLAUDE.md                # 개발 가이드 (이 파일)
├── README.md                # 프로젝트 개요
└── CHANGELOG.md             # 버전 히스토리
```

**⚠️ 중요**: 모든 작업은 `app2/` 디렉토리에서 진행합니다!

### 기술 스택
```typescript
// 핵심 스택
React 18.2 + TypeScript 4.9 (Strict Mode)
Tailwind CSS 3.3 + Context API + Zustand 5.0
Firebase 11.9 (Auth, Firestore, Functions)
@tanstack/react-table 8.21 + date-fns 4.1
Capacitor 7.4 (모바일 앱)
```

---

## 🏗️ **핵심 아키텍처**

### Context 구조
```typescript
// 1. UnifiedDataContext - 구인공고 및 지원자 데이터
const { staff, workLogs, applications } = useUnifiedData();

// 2. TournamentContext - 토너먼트 데이터
const { tournament, userId } = useTournamentContext();

// 3. AuthContext - 인증 상태
const { currentUser, role, isAdmin } = useAuth();

// 4. ThemeContext - 다크모드
const { isDarkMode, toggleDarkMode } = useTheme();
```

### 표준 필드명 (Firebase 컬렉션)
| 컬렉션 | 핵심 필드 | 용도 |
|--------|-----------|------|
| `staff` | staffId, name, role | 스태프 정보 |
| `workLogs` | staffId, eventId, date | 근무 기록 |
| `applications` | eventId, applicantId, status | 지원서 |
| `jobPostings` | id, title, location | 구인공고 |
| `notifications` | userId, type, isRead | 알림 |

---

## 📋 **기능 추가 체크리스트**

### ✅ **코드 작성 전**
- [ ] 유사 기능 존재 여부 확인
- [ ] 표준 필드명 확인 (`staffId`, `eventId`)
- [ ] Context 활용 여부 확인
- [ ] 재사용 가능한 컴포넌트 확인

### ✅ **코드 작성 중**
- [ ] TypeScript strict mode 준수
- [ ] `logger` 사용 (`console.log` 금지)
- [ ] Firebase 실시간 구독 (`onSnapshot`)
- [ ] Toast 시스템 사용 (`alert()` 금지)
- [ ] 메모이제이션 적용
- [ ] **다크모드 적용** (`dark:` 클래스 필수)

### ✅ **배포 전**
- [ ] `npm run type-check` 통과 (에러 0개)
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] `npx cap sync` 성공 (모바일)

---

## 🎛️ **Feature Flag 시스템**

### 현재 상태
```typescript
// src/config/features.ts
export const FEATURE_FLAGS = {
  // ✅ 활성화된 기능
  TOURNAMENTS: true,        // 토너먼트 관리
  PARTICIPANTS: true,       // 참가자 관리
  TABLES: true,            // 테이블 관리
  JOB_BOARD: true,         // 구인구직
  NOTIFICATIONS: true,     // 알림 시스템

  // ❌ 준비 중 기능
  SHIFT_SCHEDULE: false,   // 교대 관리
  PRIZES: false,           // 상금 관리
}
```

---

## 📢 **알림 시스템** (v0.2.3 완성 ✅)

### 구현 현황
- **프론트엔드**: 100% 완성 ✅
- **백엔드**: 100% 완성 ✅ (Firebase Functions 5개 배포)
- **알림 타입**: 8개 (system, work, schedule, finance)

### 주요 컴포넌트
```typescript
// 1. Hook
useNotifications(userId)  // Firestore 실시간 구독

// 2. UI 컴포넌트
<NotificationBadge />     // 헤더 배지
<NotificationItem />      // 개별 알림
<NotificationDropdown />  // 드롭다운 메뉴
<NotificationsPage />     // 전체 페이지
```

### 배포된 Functions
1. `sendWorkAssignmentNotification` - 근무 배정
2. `sendApplicationStatusNotification` - 지원 상태 변경
3. `sendScheduleChangeNotification` - 일정 변경
4. `sendScheduleReminderNotification` - 일정 알림
5. `sendJobPostingAnnouncement` - 공고 공지

---

## 🏢 **멀티테넌트 아키텍처** (100% 완료 ✅)

### 경로 구조
```typescript
// 멀티테넌트 경로
users/{userId}/tournaments/{tournamentId}/
  ├── participants/     ✅
  ├── settings/         ✅
  └── tables/           ✅
```

### 완료된 Hook
- `useParticipants(userId, tournamentId)` ✅
- `useSettings(userId, tournamentId)` ✅
- `useTables(userId, tournamentId)` ✅

---

## ⚡ **자주 사용하는 명령어**

### 개발
```bash
cd app2

npm start                 # 개발 서버
npm run dev              # Firebase 에뮬레이터 + 개발 서버
npm run type-check       # TypeScript 에러 체크 ⭐
npm run lint             # ESLint 검사
npm run format           # Prettier 포맷팅
```

### 빌드 & 배포
```bash
npm run build            # 프로덕션 빌드
npm run deploy:all       # Firebase 전체 배포
npx cap sync            # 모바일 앱 동기화
```

### 테스트
```bash
npm run test            # Jest 테스트
npm run test:coverage   # 커버리지 확인
npm run test:e2e        # E2E 테스트
```

---

## 💻 **코드 스타일 가이드**

### TypeScript 패턴
```typescript
// ✅ 올바른 사용
const { staffId, eventId } = data;
logger.info('데이터 처리', { staffId });

interface WorkLog {
  staffId: string;  // ✅
  eventId: string;  // ✅
  date: string;
}

// ❌ 사용 금지
console.log('Debug');        // ❌ logger 사용
const data: any = {};        // ❌ any 타입 금지
```

### 다크모드 패턴
```tsx
// ✅ 올바른 다크모드
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <p className="text-gray-600 dark:text-gray-300">텍스트</p>
  <button className="bg-blue-600 dark:bg-blue-700">버튼</button>
</div>

// ❌ 다크모드 미적용 (금지)
<div className="bg-white text-gray-900">  // dark: 없음 ❌
```

---

## 🎯 **프로젝트 상태**

### ✅ 완료된 기능
- **알림 시스템**: Firestore 실시간 구독, 8개 타입, Firebase Functions 5개
- **인증 시스템**: 이메일/소셜 로그인, 2FA, 세션 관리
- **국제화**: 한국어/영어 완전 지원
- **멀티테넌트**: Phase 1-6 완료, Security Rules 배포
- **다크모드**: 100개+ 컴포넌트 적용 완료
- **토너먼트**: 테이블 관리, 참가자 관리, 설정 관리

### 📊 품질 지표
- **TypeScript 에러**: 0개 ✅
- **번들 크기**: 299KB (최적화 완료)
- **테스트 커버리지**: 65%
- **다크모드 적용**: 100개+ 컴포넌트

### 🚀 향후 계획
- E2E 테스트 확대 (65% → 80%)
- 알림 설정 페이지 (사용자별 ON/OFF)
- 관리자 대시보드 통계
- PWA 고도화

---

## 📚 **주요 문서**

### 📘 핵심 가이드
- [DEVELOPMENT_GUIDE.md](docs/core/DEVELOPMENT_GUIDE.md) - 개발 가이드
- [TESTING_GUIDE.md](docs/core/TESTING_GUIDE.md) - 테스트 작성
- [CAPACITOR_MIGRATION_GUIDE.md](docs/core/CAPACITOR_MIGRATION_GUIDE.md) - 모바일 앱

### 🎯 기능별 가이드
- [FEATURE_FLAG_GUIDE.md](docs/features/FEATURE_FLAG_GUIDE.md) - Feature Flag
- [NOTIFICATION_IMPLEMENTATION_STATUS.md](docs/features/NOTIFICATION_IMPLEMENTATION_STATUS.md) - 알림 시스템
- [MULTI_TENANT_STATUS.md](docs/features/MULTI_TENANT_STATUS.md) - 멀티테넌트
- [ACCOUNT_MANAGEMENT_SYSTEM.md](docs/features/ACCOUNT_MANAGEMENT_SYSTEM.md) - 계정 관리
- [PERMISSION_SYSTEM.md](docs/features/PERMISSION_SYSTEM.md) - 권한 시스템

### 💳 결제/구인공고 시스템
- [MODEL_B_CHIP_SYSTEM_FINAL.md](docs/features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md) - 칩 시스템 설계
- [PAYMENT_SYSTEM_DEVELOPMENT.md](docs/features/payment/PAYMENT_SYSTEM_DEVELOPMENT.md) - 결제 개발
- [JOB_POSTING_SYSTEM_IMPLEMENTATION_SPEC.md](docs/features/jobposting/JOB_POSTING_SYSTEM_IMPLEMENTATION_SPEC.md) - 구인공고 명세

### 📋 기획/분석
- [REFACTORING_PLAN.md](docs/planning/REFACTORING_PLAN.md) - 리팩토링 계획
- [CRITICAL_ANALYSIS_V2.md](docs/planning/CRITICAL_ANALYSIS_V2.md) - 프로젝트 분석

### 📖 운영 가이드
- [DEPLOYMENT.md](docs/guides/DEPLOYMENT.md) - 배포
- [ROLLBACK_PROCEDURES.md](docs/guides/ROLLBACK_PROCEDURES.md) - 롤백 절차 🆕
- [MONITORING.md](docs/operations/MONITORING.md) - 모니터링
- [NOTIFICATION_OPERATIONS.md](docs/operations/NOTIFICATION_OPERATIONS.md) - 알림 운영 🆕
- [SECURITY.md](docs/operations/SECURITY.md) - 보안

### 📚 참조 문서
- [ARCHITECTURE.md](docs/reference/ARCHITECTURE.md) - 아키텍처
- [DATA_SCHEMA.md](docs/reference/DATA_SCHEMA.md) - 데이터 스키마
- [AUTHENTICATION.md](docs/reference/AUTHENTICATION.md) - 인증
- [API_REFERENCE.md](docs/reference/API_REFERENCE.md) - API

---

## 📝 **Git 커밋 컨벤션**

```
<타입>: <제목>

feat: 새로운 기능
fix: 버그 수정
refactor: 리팩토링
style: 스타일 (다크모드 등)
docs: 문서 수정
test: 테스트 추가/수정
chore: 기타 변경
```

---

*마지막 업데이트: 2025년 11월 30일*
*프로젝트 버전: v0.2.4 (Production Ready - 구인공고 4타입 완성)*
*문서 총 46개 (13개 폴더)*
