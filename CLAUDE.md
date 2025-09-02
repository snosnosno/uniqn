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

## 🔥 최근 업데이트 (2025-02-01)

### ✅ 완료된 작업 (2025-01-29)
- **스태프 관리 탭 개선** 📋
  - 날짜별 그룹화를 기본으로 설정
  - 체크박스 UI 제거로 인터페이스 단순화
  - 플랫 리스트 렌더링 코드 제거 (172줄 감소)
  - 각 날짜 그룹별 선택/해제 기능 유지

- **ScheduleDetailModal 데이터 동기화 개선** 🎯
  - 직접 WorkLog 조회 방식으로 복잡한 식별자 매칭 로직 대체
  - getTargetWorkLog 공통 함수로 데이터 접근 통일
  - JobPostingProvider 의존성 제거하여 독립성 확보
  - 역할, 출퇴근시간, 근무시간 표시 정확성 개선

- **전체 시스템 아키텍처 분석** 📊
  - 5개 탭(내스케줄, 공고관리, 지원자, 스태프, 정산)의 데이터 의존성 분석 완료
  - 중복 Firebase 구독 5개 발견 → 80% 최적화 가능
  - 월 운영비 77% 절약 가능한 전면 수정 계획 수립

### 🚀 **전면 아키텍처 개편 계획 확정** (2025-02-01)
- **테스트 단계 골든 타임 활용** - 실사용자 없는 현재가 유일한 기회
- **UnifiedDataContext 설계** - 단일 구독으로 모든 데이터 중앙 관리
- **4주 구현 계획** - Core → 스키마 → 마이그레이션 → 최적화

### 📊 현재 상태
- **빌드**: ✅ 성공 (경고만 있음)
- **TypeScript**: ✅ 에러 0개 (완벽한 타입 안전성)
- **ESLint**: 경고 약 40개 (주로 React Hook 의존성)
- **번들 크기**: 273.05KB (최적화됨)
- **아키텍처**: 🔥 전면 수정 대기 중 (77% 성능 향상 예상)

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

## 📈 성능 지표

| 항목 | 현재 | 목표 |
|------|------|------|
| 번들 크기 | 273KB | < 300KB |
| TypeScript 에러 | 0 | 0 |
| ESLint 에러 | 9 (테스트) | 0 |
| 테스트 커버리지 | ~10% | > 70% |
| Lighthouse 점수 | 91 | > 90 |

## 🔥 개선 계획 - 전면 아키텍처 개편

### **Phase 1: 즉시 시작 (4주) - UnifiedDataContext 전면 수정** 🚀
- [ ] **Week 1**: Core 아키텍처 설계 및 UnifiedDataProvider 구현
- [ ] **Week 2**: Firebase 스키마 최적화 및 인덱스 재설계  
- [ ] **Week 3**: 5개 탭 순차 마이그레이션 (내스케줄→스태프→정산→지원자→지원현황)
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

**즉시 실행 권장**: 테스트 단계의 골든 타임을 활용한 전면 아키텍처 개편
- 📋 상세 계획: `docs/SCHEDULE_PAGE_RENOVATION_PLAN.md` 참조
- ⚡ 예상 효과: 성능 90% 향상, 비용 77% 절약
- 🕐 구현 기간: 4주 집중 개발

---

*마지막 업데이트: 2025년 2월 1일 오후*
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.