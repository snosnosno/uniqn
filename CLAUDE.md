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
- **상태**: 🏆 100% 완성 (v4.0) - Production-Ready ✅
- **핵심 기능**: 토너먼트 운영, 스태프 관리, 구인공고, 실시간 출석 추적, 급여 정산

### 기술 스택
```typescript
// 핵심 스택
React 18 + TypeScript (Strict Mode)
Tailwind CSS + Context API + Zustand
Firebase v11 (Auth, Firestore, Functions)
@tanstack/react-table + date-fns + React Window
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
npm run analyze:bundle     # 번들 크기 분석
```

### 테스트 & 품질
```bash
npm run test               # Jest 테스트 실행
npm run test:coverage      # 커버리지 확인
npm run test:ci           # CI용 테스트 (watch 모드 없음)
```

## 📦 **핵심 파일 & 유틸리티**

### 🔑 필수 컨텍스트
- `contexts/UnifiedDataContext.tsx` - 모든 데이터 중앙 관리
- `contexts/AuthContext.tsx` - Firebase 인증

### 💰 급여 계산 시스템
- `utils/payrollCalculations.ts` - **통합 급여 계산 유틸리티**
- `utils/workLogMapper.ts` - WorkLog 데이터 정규화
- `hooks/useEnhancedPayroll.ts` - 급여 계산 훅

### 🔍 데이터 처리
- `utils/logger.ts` - 통합 로깅 (console.log 대신 사용)
- `utils/smartCache.ts` - 지능형 캐싱 (92% 히트율)
- `utils/dateUtils.ts`, `utils/scheduleUtils.ts` - 날짜/시간 처리
- `hooks/useUnifiedData.ts` - 데이터 통합 관리

### ⚡ 성능 최적화
- `hooks/useSystemPerformance.ts` - 실시간 성능 모니터링
- `hooks/useSmartCache.ts` - 스마트 캐싱 훅
- `hooks/usePayrollWorker.ts` - Web Worker 급여 계산

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

### 훅 사용 패턴
```typescript
// ✅ UnifiedDataContext 사용
const { staff, loading, error } = useUnifiedData();

// ✅ 메모이제이션 활용
const memoizedData = useMemo(() => 
  processData(staff), [staff]
);

// ✅ 실시간 구독
useEffect(() => {
  const unsubscribe = onSnapshot(collection, (snapshot) => {
    // 실시간 데이터 처리
  });
  return unsubscribe;
}, []);
```

## 🧪 **테스트 지침**

### 테스트 환경 구축
```bash
npm run test:coverage    # 커버리지 확인 (목표: 85%)
npm run test:ci         # CI 환경 테스트
```

### E2E 테스트 (Playwright)
- 모든 탭 간 데이터 동기화 자동 검증
- 급여 계산 로직 통합 테스트 포함
- 85% 테스트 커버리지 달성

### 테스트 작성 시 주의사항
- Firebase 에뮬레이터 사용 필수
- 실시간 구독 테스트 포함
- 급여 계산 로직 정확성 검증

## 🔧 **개발 환경 설정**

### 필수 설치
```bash
Node.js 18+
Firebase CLI: npm install -g firebase-tools
```

### 환경 변수 (.env 파일)
```bash
# Firebase 설정
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
# ... 기타 Firebase 설정
```

### 에디터 설정 (권장)
- TypeScript strict mode
- ESLint + Prettier 자동 실행
- 저장 시 자동 포맷

## ⚠️ **중요 주의사항 & 예상 문제**

### 🚨 **알려진 이슈**
- **무한 로딩 문제**: `loading.initial` 사용 (해결됨 ✅)
- **근무시간 계산**: `scheduledStartTime/scheduledEndTime` 사용 필수
- **급여 계산**: `payrollCalculations.ts` 통합 유틸리티만 사용

### ⚡ **성능 관련**
- 대용량 리스트: React Window 가상화 적용됨
- 메인 스레드 블로킹: Web Workers로 해결됨
- 캐시 히트율: 92% 달성 (smartCache 활용)

### 🔒 **보안 규칙**
- Firebase Admin SDK 키 파일 절대 커밋 금지
- 환경 변수 파일 (.env) 보안 처리 완료
- 모든 민감한 데이터 gitignore 등록됨

## 🔥 **Firebase 최적화 정보**

### 인덱스 최적화
- **기존**: 18개 → **현재**: 6개 (70% 감소 ✅)
- **월 운영비**: 77% 절약 ($300 → $70)
- **파일**: `firestore.indexes.optimized.json`

### 실시간 구독 필수
```typescript
// ✅ 올바른 실시간 구독
const unsubscribe = onSnapshot(collection(db, 'staff'), (snapshot) => {
  const staffData = snapshot.docs.map(doc => doc.data());
  setStaff(staffData);
});
```

### 쿼리 최적화
- 복합 인덱스 활용
- 필터링은 클라이언트 측에서 최소화
- 페이지네이션 구현 완료

## 📚 **프로젝트 문서 위치**

### 핵심 문서
- `docs/SCHEDULE_PAGE_RENOVATION_PLAN.md` - **전면 아키텍처 개편 계획서** (필독)
- `docs/DATA_USAGE_MAPPING.md` - **데이터 사용처 완전 분석** (페이지/탭/모달별 매핑)
- `docs/SYNCHRONIZATION_BUG_FIX_REPORT.md` - 동기화 문제 해결 보고서
- `docs/FIREBASE_DATA_FLOW.md` - Firebase 데이터 구조 및 흐름
- `docs/TECHNICAL_DOCUMENTATION.md` - 기술 문서
- `docs/TESTING_GUIDE.md` - 테스트 가이드

### 참고 문서  
- `docs/PROJECT_STRUCTURE.md` - 프로젝트 구조
- `docs/PRODUCT_SPEC.md` - 제품 사양서
- `docs/API_DOCUMENTATION.md` - API 문서
- `docs/DEPLOYMENT.md` - 배포 가이드

## 🌟 **주요 라이브러리 사용법**

### React & TypeScript
```typescript
// 기본 컴포넌트 패턴
import React, { memo, useMemo } from 'react';
import type { FC } from 'react';

const MyComponent: FC<Props> = memo(({ data }) => {
  const processedData = useMemo(() => 
    processData(data), [data]
  );
  return <div>{processedData}</div>;
});
```

### Tailwind CSS 클래스 (자주 사용)
```css
/* 레이아웃 */
flex flex-col space-y-4 p-4
grid grid-cols-1 md:grid-cols-2 gap-4

/* 버튼 스타일 */
bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg
```

### Date-fns (날짜 처리)
```typescript
import { format, parseISO, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';

const formattedDate = format(new Date(), 'yyyy-MM-dd', { locale: ko });
```

## 📈 **성능 지표 현황**

| 지표 | 현재 값 | 목표 | 상태 |
|------|--------|------|------|
| 번들 크기 | 278.56KB | < 300KB | ✅ |
| TypeScript 에러 | 0개 | 0개 | ✅ |
| **E2E 테스트** | **100%** (32/32) | > 90% | ✅ |
| 캐시 히트율 | 92% | > 80% | ✅ |
| Firebase 인덱스 | 6개 | 최적화 | ✅ |
| 월 운영비 | $70 | < $100 | ✅ (77% 절약) |

## 🔄 **최근 주요 업데이트**

### 2025-09-04: **E2E 테스트 100% 달성!** 🏆
- **Playwright E2E 테스트 100% 통과** (32/32 tests passing) 
- 실제 관리자 계정 인증 시스템 완전 구현
- test-auth-helper.ts 완전 재구축으로 안정성 확보
- 크로스브라우저 호환성 검증 완료

### 2025-02-04: 보안 강화 & 버그 수정 ✅
- 무한 로딩 문제 완전 해결 (`loading.initial` 사용)
- gitignore 보안 강화 (Firebase Admin SDK 키 보호)
- 환경 변수 파일 보안 처리

### 2025-02-02: Week 4 성능 최적화 완료 🚀
- Web Workers 시스템 구축 (메인 스레드 블로킹 제거)
- React Window 가상화 (대용량 리스트 최적화)
- 스마트 캐싱 시스템 (Firebase 호출 90% 감소)
- E2E 테스트 시스템 구축 (85% 커버리지 달성)

### Week 3: 아키텍처 최적화
- Firebase 인덱스 18개→6개 (70% 감소)
- UnifiedDataContext 중심 구조 완성
- 스태프/지원자 탭 타입 통합 완료

## 🎯 **프로젝트 상태**

**🏆 현재 상태: 100% 완성 (v4.0)**
- **프로덕션 준비**: 완료 ✅
- **성능 최적화**: Enterprise급 달성 ✅  
- **안정성**: TypeScript 에러 0개 ✅
- **확장성**: UnifiedDataContext 기반 ✅

**🚀 주요 달성 성과**:
- 95% 성능 향상, 77% 운영비 절약
- 메인 스레드 블로킹 완전 제거
- Firebase 호출 90% 감소, 캐시 히트율 92%
- 자동화된 E2E 테스트 시스템 구축

## 🐛 **자주 발생하는 문제 & 해결법**

### Firebase 연결 문제
```bash
# 에뮬레이터 실행
firebase emulators:start

# Firebase 로그인 확인
firebase login:list

# 프로젝트 설정 확인
firebase use --list
```

### 빌드 실패 해결
```bash
# 1단계: TypeScript 에러 체크
npm run type-check

# 2단계: 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 3단계: 캐시 클리어
npm start -- --reset-cache

# 4단계: 빌드 재시도
npm run build
```

### 무한 로딩 문제
```typescript
// ❌ 잘못된 로딩 상태 사용
if (loading) return <div>로딩중...</div>;

// ✅ 올바른 로딩 상태 사용  
if (loading.initial) return <div>로딩중...</div>;
```

### 급여 계산 오류
```typescript
// ❌ 하드코딩된 시급 사용 금지
const hourlyRate = 10000;

// ✅ 통합 유틸리티 사용
import { calculatePayroll } from '../utils/payrollCalculations';
const result = calculatePayroll(workLogs, role, jobPosting);
```

## 📝 **Git 커밋 컨벤션**

### 커밋 메시지 형식
```
<타입>: <제목>

<본문 (선택사항)>
```

### 타입별 분류
- `feat`: 새 기능 추가
- `fix`: 버그 수정  
- `refactor`: 코드 리팩토링
- `style`: 코드 스타일 변경 (포맷팅, 세미콜론 등)
- `docs`: 문서 수정
- `test`: 테스트 추가/수정
- `chore`: 빌드 설정, 패키지 설정 등

### 커밋 예시
```bash
feat: 급여 계산 통합 유틸리티 추가
fix: 무한 로딩 상태 문제 해결
refactor: UnifiedDataContext 성능 최적화
docs: CLAUDE.md 개발 가이드 업데이트
test: Playwright E2E 테스트 추가
```

### 한국어 커밋 허용
- 프로젝트 특성상 한국어 커밋 메시지 사용 가능
- 명확하고 간결하게 작성
- 50자 이내 권장

## 🔒 **보안 체크리스트**

### 개발 전 필수 확인
- [ ] **환경변수 설정**: `.env` 파일 보안 처리 완료
- [ ] **Firebase 규칙**: Firestore 보안 규칙 검증
- [ ] **API 키 보호**: 모든 키 환경변수 처리
- [ ] **gitignore 설정**: 민감한 파일 무시 처리 완료

### 코드 작성 시 보안 수칙
```typescript
// ✅ 사용자 입력값 검증
import DOMPurify from 'dompurify';
const cleanInput = DOMPurify.sanitize(userInput);

// ✅ Firebase 권한 체크
const canAccess = user?.uid === staffId || user?.role === 'admin';
if (!canAccess) throw new Error('접근 권한 없음');

// ✅ 민감한 데이터 로깅 금지
logger.info('사용자 로그인', { userId: user.uid }); // ✅
logger.info('사용자 정보', { user }); // ❌ 개인정보 포함
```

### Firebase 보안 규칙 확인사항
- 인증된 사용자만 데이터 접근
- 본인 데이터만 수정 가능
- 관리자 권한 분리
- 민감한 컬렉션 접근 제한

### 배포 전 보안 점검
- [ ] 개발용 API 키 제거
- [ ] console.log 모든 제거
- [ ] Firebase Admin SDK 키 보호
- [ ] HTTPS 적용 확인
- [ ] CSP (Content Security Policy) 설정

---

**📋 개발 시 체크리스트**:
1. `npm run type-check` 실행 (TypeScript 에러 0개 확인)
2. `logger` 사용 (console.log 금지)
3. 표준 필드명 사용 (staffId, eventId)
4. UnifiedDataContext 활용
5. Firebase 실시간 구독 적용
6. 보안 체크리스트 확인
7. 커밋 컨벤션 준수

*마지막 업데이트: 2025년 1월 (DATA_USAGE_MAPPING.md 추가)*  
*프로젝트 버전: v4.0 (Production Ready)*