# T-HOLDEM 애플리케이션 가이드

**버전**: v0.2.2 (Production Ready + 인증 시스템 고도화)
**애플리케이션**: React 18 + TypeScript + Firebase
**상태**: Production Ready (96% 완성)

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

*T-HOLDEM 애플리케이션 개발팀*