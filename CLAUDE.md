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

## 🚀 최근 업데이트 (2025-01-29)

### ✅ 완료된 작업
- **스태프 관리 탭 개선** 📋
  - 날짜별 그룹화를 기본으로 설정
  - 체크박스 UI 제거로 인터페이스 단순화
  - 플랫 리스트 렌더링 코드 제거 (172줄 감소)
  - 각 날짜 그룹별 선택/해제 기능 유지

- **UI/UX 개선** 🎨
  - 스태프 이름 클릭 시 프로필 모달 표시
  - 헤더에 출석체크 버튼 추가
  - 지원자탭 이름 클릭 시 스태프 프로필 모달 표시
  - 정산 UI 개선 및 불필요한 기능 제거
  - 급여 설정 제목 간소화

- **날짜 형식 표준화** 🗓️
  - 모든 날짜 표시를 "8월 25일 (월)" 한글 형식으로 통일
  - 년도 제거하여 간결한 표시
  
- **레거시 필드 완전 제거** ✨
  - 모든 `dealerId` → `staffId` 마이그레이션 완료
  - 모든 `jobPostingId` → `eventId` 변환 완료
  - 하위 호환성 코드 완전 제거

### 📊 현재 상태
- **빌드**: ✅ 성공 (경고만 있음)
- **TypeScript**: ✅ 에러 0개 (완벽한 타입 안전성)
- **ESLint**: 경고 약 40개 (주로 React Hook 의존성)
- **번들 크기**: 273.05KB (최적화됨)
- **레거시 코드**: 0개 (100% 제거 완료)

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

## 🔧 개선 계획

### 단기 (1주일)
- [ ] 테스트 파일 ESLint 에러 수정
- [ ] React Hooks 의존성 경고 해결
- [ ] 미사용 코드 제거

### 중기 (1개월)
- [ ] any 타입 제거
- [ ] 테스트 커버리지 70% 달성
- [ ] E2E 테스트 추가

### 장기 (3개월)
- [ ] 성능 최적화 (React.memo, lazy loading)
- [ ] 모바일 앱 개발
- [ ] 국제화 (i18n) 완성

## 📚 참고 문서

- [Firebase 데이터 구조](docs/FIREBASE_DATA_FLOW.md)
- [프로젝트 구조](docs/PROJECT_STRUCTURE.md)
- [기술 문서](docs/TECHNICAL_DOCUMENTATION.md)
- [제품 사양서](docs/PRODUCT_SPEC.md)

---

*마지막 업데이트: 2025년 1월 29일 오후 11시 30분*
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.