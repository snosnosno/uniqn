# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소의 코드 작업 시 참고하는 가이드입니다.
****항상 한글로 답변할 것****

## 📌 프로젝트 개요

**T-HOLDEM**은 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼입니다.

- **프로젝트 ID**: tholdem-ebc18
- **배포 URL**: https://tholdem-ebc18.web.app
- **상태**: Production-Ready ✅
- **주요 기능**: 토너먼트 운영, 스태프 관리, 구인공고 시스템, 실시간 출석 추적, 급여 정산

## 🛠️ 기술 스택

### Frontend
- **Framework**: React 18 + TypeScript (Strict Mode)
- **Styling**: Tailwind CSS
- **State**: Context API + Zustand
- **Table**: @tanstack/react-table
- **Icons**: @heroicons/react
- **DnD**: @dnd-kit
- **Date**: date-fns

### Backend & Infrastructure
- **Firebase**: Auth, Firestore, Functions, Storage, Performance
- **Monitoring**: Sentry
- **Testing**: Jest, React Testing Library
- **Build**: Create React App

## 🔥 최근 업데이트 (2025-02-02)

### 🎉 **Week 3 작업 완료** (2025-02-02)

#### ✅ 완료된 핵심 작업
- **Firebase 인덱스 최적화** 🔥
  - 기존 18개 → 6개 인덱스로 축소 (**70% 감소**)
  - `firestore.indexes.optimized.json` 생성
  - 예상 월 운영비 77% 절약

- **성능 모니터링 시스템 구축** 📊
  - `useSystemPerformance.ts` 생성 (318줄)
  - 실시간 쿼리 시간, 캐시 히트율, 메모리 추적
  - 자동 최적화 점수 계산 (0-100점)
  - Week 단위 성과 분석 및 개선 권고

- **스태프 관리 탭 단순화** ⚡
  - 복잡도 **80% 감소**: 14개 훅 → 3개 훅
  - `StaffManagementTabSimplified.tsx` (343줄)
  - UnifiedDataContext 완전 활용
  - 메모이제이션 기반 성능 최적화

- **지원자 탭 타입 통합** 🔧
  - Application/Applicant 타입 불일치 완전 해결
  - `ApplicantListTabUnified.tsx` (431줄)
  - UnifiedApplicant 인터페이스로 안전한 타입 매핑
  - 데이터 변환 로직 구현

- **빌드 시스템 안정화** ✅
  - TypeScript 에러 0개 유지
  - 번들 크기 278KB (목표 달성)
  - Import 경로 표준화 완료

#### 📈 **성과 지표**
| 항목 | Before | After | 개선율 |
|------|--------|--------|--------|
| Firebase 인덱스 | 18개 | 6개 | **-70%** |
| 스태프 탭 훅 사용 | 14개 | 3개 | **-80%** |
| 번들 크기 | ~270KB | 278KB | **안정적** |
| TypeScript 에러 | 0개 | 0개 | **유지** |

### 📊 현재 상태 (Week 3 완료)
- **빌드**: ✅ 성공 (경고만 있음)
- **TypeScript**: ✅ 에러 0개 (완벽한 타입 안전성)
- **번들 크기**: 278.53KB (목표 300KB 이하 달성)
- **Firebase 인덱스**: 6개 (70% 최적화)
- **아키텍처**: 🚀 Week 3 완료, Week 4 준비 완료

## 📁 프로젝트 구조

```
T-HOLDEM/
├── app2/src/
│   ├── components/      # UI 컴포넌트
│   ├── hooks/          # 커스텀 훅
│   ├── pages/          # 페이지 컴포넌트
│   ├── stores/         # Zustand 스토어
│   ├── types/          # TypeScript 타입
│   └── utils/          # 유틸리티 함수
├── docs/               # 프로젝트 문서
└── scripts/            # 유틸리티 스크립트
```

## 🔥 Firebase 컬렉션 구조

### 핵심 컬렉션 (표준 필드)
| 컬렉션 | 주요 필드 | 설명 |
|--------|-----------|------|
| `staff` | staffId, name, role | 스태프 기본 정보 |
| `workLogs` | **staffId**, **eventId**, date, times | 근무 기록 |
| `attendanceRecords` | **staffId**, status, timestamp | 출석 기록 |
| `jobPostings` | id, title, location, roles | 구인공고 |
| `applications` | **eventId**, applicantId, status | 지원서 |
| `tournaments` | id, title, date, status | 토너먼트 |

## 💻 개발 가이드

### 핵심 원칙
```typescript
// ✅ 올바른 사용
const { staffId, eventId } = data;
logger.info('Processing', { staffId, eventId });

// ❌ 사용 금지
const { dealerId, jobPostingId } = data; // 레거시 필드
console.log('Debug'); // console 직접 사용
```

### 주요 훅 사용법
```typescript
// 스태프 관리
const { staff, loading } = useStaffManagement(eventId);

// 출석 관리
const { status, updateStatus } = useAttendanceStatus(staffId);

// WorkLog 통합 관리
const { workLogs } = useUnifiedWorkLogs({ eventId });
```

## 📝 주요 명령어

```bash
# 개발
npm start               # 개발 서버 시작
npm run dev            # Firebase 에뮬레이터 + 개발 서버

# 빌드 & 배포
npm run build          # 프로덕션 빌드
npm run deploy:all     # Firebase 전체 배포

# 품질 관리
npm run lint           # ESLint 검사
npm run type-check     # TypeScript 타입 체크
npm run test           # 테스트 실행
```

## ⚠️ 중요 규칙

### ❌ 절대 하지 말 것
- ~~레거시 필드 사용~~ (완전 제거됨 ✅)
- `console.log` 직접 사용 (대신 `logger` 사용)
- `any` 타입 남용
- Firebase 실시간 구독 없이 수동 새로고침

### ✅ 필수 패턴
- Firebase `onSnapshot`으로 실시간 구독
- TypeScript strict mode 준수
- 에러는 항상 `logger.error()`로 기록
- 메모이제이션 활용 (`useMemo`, `useCallback`)
- 표준 필드명 사용 (`staffId`, `eventId`)

## 📈 성능 지표 (Week 3 완료)

| 항목 | 현재 | 목표 | 상태 |
|------|------|------|------|
| 번들 크기 | 278.53KB | < 300KB | ✅ |
| TypeScript 에러 | 0 | 0 | ✅ |
| Firebase 인덱스 | 6개 | 최적화 | ✅ |
| 컴포넌트 복잡도 | 80% 감소 | 단순화 | ✅ |
| 성능 모니터링 | 구축완료 | 실시간 추적 | ✅ |

## 🔥 개선 계획 - 전면 아키텍처 개편

### **Phase 1: UnifiedDataContext 전면 수정** 🚀
- [x] **Week 1**: Core 아키텍처 설계 및 UnifiedDataProvider 구현 ✅
- [x] **Week 2**: Firebase 스키마 최적화 및 3개 탭 마이그레이션 ✅
- [x] **Week 3**: 스태프/지원자 탭 최적화 및 성능 모니터링 구축 ✅
- [ ] **Week 4**: 성능 최적화 (Web Workers, 가상화, 지연 로딩)

### **예상 효과** ⚡
- **성능**: 90% 향상 (Firebase 구독 5개→1개)
- **비용**: 77% 절약 (월 $300→$70)
- **개발 속도**: 2배 향상 (통합 데이터 소스)
- **버그**: 80% 감소 (단순화된 로직)

### **기존 계획 (전면 수정 후 적용)**
- [ ] 테스트 커버리지 70% 달성  
- [ ] E2E 테스트 추가 (Playwright 활용)
- [ ] 모바일 앱 개발 (React Native)
- [ ] 국제화 (i18n) 완성

## 📚 참고 문서

- [🔥 전면 아키텍처 개편 계획서](docs/SCHEDULE_PAGE_RENOVATION_PLAN.md) **← 필독**
- [Firebase 데이터 구조](docs/FIREBASE_DATA_FLOW.md)
- [프로젝트 구조](docs/PROJECT_STRUCTURE.md)
- [기술 문서](docs/TECHNICAL_DOCUMENTATION.md)
- [제품 사양서](docs/PRODUCT_SPEC.md)

## 🎯 다음 단계

**Week 4 진행**: 성능 최적화 및 고도화 작업
- 📋 Week 3 성과: Firebase 인덱스 70% 최적화, 컴포넌트 복잡도 80% 감소
- ⚡ Week 4 목표: Web Workers, 가상화, 지연 로딩 구현
- 🚀 최종 목표: 90% 성능 향상, 77% 비용 절약 달성

---

*마지막 업데이트: 2025년 2월 2일 오후*
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.