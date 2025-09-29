# CLAUDE.md

**T-HOLDEM 프로젝트 개발 가이드** - Claude Code (claude.ai/code) 전용

## 🎯 **최우선 지침** (모든 작업에서 필수 준수)

### ✅ **필수 규칙**
- ****항상 한글로 답변할 것****
- TypeScript strict mode 준수 (any 타입 최소화)
- 표준 필드명 사용: `staffId`, `eventId` (레거시 필드 사용 금지)
- Firebase `onSnapshot`으로 실시간 구독
- `logger` 사용 (console.log 직접 사용 금지)
- 메모이제이션 활용 (`useMemo`, `useCallback`)

### ❌ **절대 금지**
- 레거시 필드: ~~`dealerId`~~, ~~`jobPostingId`~~ (완전 제거됨)
- `console.log` 직접 사용
- Firebase 실시간 구독 없이 수동 새로고침
- 파일 생성 시 절대 경로 사용 안함

## 📌 프로젝트 개요

**T-HOLDEM** - 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼

- **프로젝트 ID**: tholdem-ebc18  
- **배포 URL**: https://tholdem-ebc18.web.app
- **상태**: 🚀 **Production Ready (96% 완성)** 
- **버전**: 0.2.2 (프로덕션 준비 완료 - 인증 시스템 고도화)
- **핵심 기능**: 토너먼트 운영, 스태프 관리, 구인공고, 실시간 출석 추적, 급여 정산

### 🗂️ 프로젝트 구조
```
📁 T-HOLDEM/                    # 프로젝트 루트
├── 📁 app2/                    # 메인 애플리케이션 (React 18 + TypeScript)
│   ├── 📁 src/                 # 소스 코드
│   ├── 📁 public/              # 정적 자산
│   ├── package.json            # 프로젝트 의존성 ⭐
│   └── firebase.json           # Firebase 설정
├── 📁 docs/                    # 문서 모음
├── 📁 functions/               # Firebase Functions (서버리스)
├── README.md                   # 프로젝트 개요
├── CLAUDE.md                   # 개발 가이드 (이 파일)
└── CHANGELOG.md                # 버전 히스토리
```

**⚠️ 중요**: 메인 애플리케이션 코드는 `app2/` 디렉토리에 있습니다!

### 기술 스택
```typescript
// 핵심 스택
React 18 + TypeScript (Strict Mode)
Tailwind CSS + Context API + Zustand
Firebase v11 (Auth, Firestore, Functions)
@tanstack/react-table + date-fns
```

## 🏗️ **핵심 아키텍처**

### UnifiedDataContext 중심 구조
```typescript
// 모든 데이터는 UnifiedDataContext를 통해 관리
const { 
  staff, workLogs, applications, 
  loading, error, 
  actions 
} = useUnifiedData();
```

### 표준 필드명 (Firebase 컬렉션)
| 컬렉션 | 핵심 필드 | 용도 |
|--------|-----------|------|
| `staff` | staffId, name, role | 스태프 기본 정보 |
| `workLogs` | **staffId**, **eventId**, date | 근무 기록 |
| `applications` | **eventId**, applicantId, status | 지원서 |
| `jobPostings` | id, title, location, roles | 구인공고 |
| `attendanceRecords` | **staffId**, status, timestamp | 출석 기록 |

## 📋 **기능 추가 필수 체크리스트**

### ✅ **코드 작성 전 확인**
- [ ] 유사 기능이 이미 있는지 확인
- [ ] 표준 필드명 사용 (`staffId`, `eventId`)
- [ ] UnifiedDataContext 활용 여부 확인
- [ ] 재사용 가능한 컴포넌트/유틸 확인

### ✅ **코드 작성 규칙**
- [ ] TypeScript strict mode 준수 (any 타입 사용 금지)
- [ ] Logger 사용 (`logger.info()`, `console.log` 금지)
- [ ] Firebase 실시간 구독 (`onSnapshot`)
- [ ] Toast 시스템 사용 (`showToast()`, `alert()` 금지)
- [ ] 메모이제이션 적용 (`useMemo`, `useCallback`)

### ✅ **UI/UX 일관성**
- [ ] 로딩 상태 처리 (`loading`, `error` state)
- [ ] 국제화 준수 (하드코딩 텍스트 금지, `t('key')` 사용)
- [ ] 네이티브 앱 호환성 (Safe Area, 플랫폼 체크)
- [ ] 반응형 디자인 (모바일 우선)

### ✅ **배포 전 필수 확인**
- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] `npx cap sync` 성공
- [ ] 테스트 케이스 작성

> 📖 **상세 가이드**: [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)

## ⚡ **자주 사용하는 명령어**

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
npm run deploy:all         # Firebase 전체 배포  
```

### 테스트 & 품질
```bash
npm run test               # Jest 테스트 실행
npm run test:coverage      # 커버리지 확인
npm run test:ci           # CI용 테스트 (watch 모드 없음)
```

## 💻 **코드 스타일 가이드라인**

### TypeScript 패턴
```typescript
// ✅ 올바른 사용
const { staffId, eventId } = data;
logger.info('데이터 처리 중', { staffId, eventId });

// ✅ 표준 필드명 사용
interface WorkLogData {
  staffId: string;    // ✅
  eventId: string;    // ✅
  date: string;
}

// ❌ 사용 금지
const { dealerId, jobPostingId } = data; // 레거시 필드
console.log('Debug');                    // console 직접 사용
```

## 🔄 **최근 주요 업데이트**

### v0.2.2 (2025-09-19) - 인증 시스템 고도화 완료 🔐
- **고급 인증 시스템**: 로그인 안정화, 2FA, 세션 관리 구현
- **국제화 (i18n) 완성**: 한국어/영어 다국어 지원 완료
- **메뉴 시스템 개선**: 직관적 네비게이션 및 역할별 맞춤 메뉴
- **프로필 필수 정보**: 사용자 프로필 완성도 관리 시스템
- **글로벌 서비스 준비**: 해외 시장 진출 가능한 인프라 완성

### v0.2.0 (2025-09-16) - 5단계 개선 완성 🎉
- **레거시 시스템 현대화**: dealerId → staffId, jobPostingId → eventId 완전 전환
- **Toast 시스템 도입**: 77개 alert() → 모던 Toast 알림으로 교체
- **TypeScript 완전 준수**: any 타입 0개 달성, strict mode 100% 준수
- **성능 최적화**: React.memo 적용, 번들 크기 279KB 달성
- **코드 품질 개선**: 사용하지 않는 코드 제거, warning 대폭 감소
- **테스트 강화**: 65% 커버리지 달성 (Production Ready 수준)

### v0.1.0 (2025-09-10) - MVP 핵심 기능
- **사용자 인증**: 이메일 기반 회원가입 및 로그인 기능.
- **구인공고 관리**: 구인공고 생성, 조회, 수정, 삭제(CRUD) 기능.
- **지원자 관리**: 구인공고에 대한 지원 및 지원자 목록 관리.
- **스태프 관리**: 지원자 확정을 통한 스태프 전환 기능.
- **기본 출석 관리**: 스태프의 출석 상태 수동 변경 기능.
- **기본 급여 계산**: 근무 기록을 바탕으로 한 기본 급여 계산 로직.
- **아키텍처**: `UnifiedDataContext`를 사용한 중앙 데이터 관리 구조 확립.
- **테스트**: Jest, React Testing Library를 이용한 단위/통합 테스트 환경 구축.

## 🎯 **프로젝트 상태**

**🚀 현재 상태: Production Ready (96% 완성)**
- **프로덕션 준비**: 완료 ✅ (Enterprise 수준 품질)
- **인증 시스템**: 완료 ✅ (고급 보안 기능, 2FA, 세션 관리)
- **국제화 (i18n)**: 완료 ✅ (한국어/영어 다국어 지원)
- **성능 최적화**: 완료 ✅ (React.memo, 번들 최적화, 코드 스플리팅)
- **안정성**: TypeScript 에러 0개, any 타입 0개 ✅
- **코드 품질**: 사용하지 않는 코드 제거, warning 최소화 ✅
- **테스트**: 65% 커버리지, 핵심 기능 검증 완료 ✅
- **현대화**: 레거시 시스템 완전 제거, Toast 시스템 도입 ✅

### **최신 완료 기능 (v0.2.2)**
- **인증 시스템 고도화** ✅:
  - 로그인 시스템 안정화 및 사용자 경험 개선
  - 고급 보안 기능 (2FA, 세션 관리)
  - 프로필 필수 정보 설정 및 검증
- **국제화 (i18n)** ✅:
  - 한국어/영어 다국어 지원 완료
  - 하드코딩 텍스트 완전 제거
  - 동적 언어 전환 기능
- **메뉴 시스템 개선** ✅:
  - 직관적인 네비게이션 구조
  - 사용자 역할별 맞춤 메뉴

### **향후 계획 (Unreleased)**
- **고급 기능 안정화 및 테스트**:
  - Web Worker 기반 급여 계산 기능 테스트 및 안정화
  - 스마트 캐싱 및 가상화 기능 성능 검증
- **신규 기능**:
  - 실시간 알림 시스템
  - 관리자 대시보드 통계 기능
  - QR 코드를 이용한 자동 출퇴근 시스템
- **품질 개선**:
  - E2E 테스트 커버리지 확대 (현재 65%)
  - 모바일 최적화 및 PWA 고도화

## 📝 **Git 커밋 컨벤션**

### 커밋 메시지 형식
```
<타입>: <제목>
```
- **타입**: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`

---

*마지막 업데이트: 2025년 9월 19일*
*프로젝트 버전: v0.2.2 (Production Ready - 인증 시스템 고도화 완성)*
