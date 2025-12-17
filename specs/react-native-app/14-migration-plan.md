# 14. 마이그레이션 계획

## 목차
1. [마이그레이션 전략 개요](#1-마이그레이션-전략-개요)
2. [React Native Web 통합 전략](#2-react-native-web-통합-전략)
3. [코드 재사용 분석](#3-코드-재사용-분석)
4. [단계별 마이그레이션](#4-단계별-마이그레이션)
5. [기능별 상세 계획](#5-기능별-상세-계획)
6. [데이터 호환성](#6-데이터-호환성)
7. [리스크 관리](#7-리스크-관리)
8. [품질 보증](#8-품질-보증)
9. [전환 체크리스트](#9-전환-체크리스트)

---

## 1. 마이그레이션 전략 개요

### 마이그레이션 접근 방식: 완전 대체 (Full Replacement)

```
┌─────────────────────────────────────────────────────────────────────────┐
│               Migration Strategy: Complete Replacement                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   기존 React 웹앱 (app2/)              React Native + Expo               │
│   ┌─────────────────┐                  ┌─────────────────┐              │
│   │                 │                  │                 │              │
│   │   DEPRECATED    │  ────────────▶   │   단일 코드베이스  │              │
│   │   (폐기 예정)    │                  │   iOS + Android  │              │
│   │                 │                  │   + Web          │              │
│   └─────────────────┘                  └─────────────────┘              │
│                                                 │                        │
│                                                 ▼                        │
│                               ┌───────────────────────────────┐         │
│                               │    React Native Web (Expo)    │         │
│                               │                               │         │
│                               │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│                               │  │   iOS   │ │ Android │ │   Web   │   │
│                               │  │   App   │ │   App   │ │   App   │   │
│                               │  └─────────┘ └─────────┘ └─────────┘   │
│                               │                               │         │
│                               └───────────────────────────────┘         │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Firebase (동일 프로젝트)                      │   │
│   │  • Firestore (기존 데이터 그대로)                                │   │
│   │  • Authentication (기존 사용자 그대로)                           │   │
│   │  • Cloud Functions (업데이트)                                    │   │
│   │  • Firebase Hosting (웹 배포)                                    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 전략 선택 이유

| 전략 | Big Bang | Strangler Fig | Parallel | **Complete Replace (선택)** |
|------|----------|---------------|----------|------------------------------|
| 코드 중복 | 없음 | 높음 | 높음 | **없음** |
| 유지보수 부담 | 전환 후 감소 | 높음 | 높음 | **최소** |
| 플랫폼 일관성 | 낮음 | 중간 | 낮음 | **최고** |
| 개발 효율 | 낮음 | 중간 | 낮음 | **높음** |
| 리스크 | 높음 | 낮음 | 낮음 | 중간 |

**선택 이유**:
1. **단일 코드베이스**: iOS, Android, Web 모두 하나의 코드로 관리
2. **Expo Router 통합**: 웹과 모바일 모두 동일한 라우팅 시스템
3. **유지보수 효율**: 버그 수정, 기능 추가가 모든 플랫폼에 동시 적용
4. **기술 부채 청산**: 기존 웹앱의 레거시 코드 완전히 제거
5. **React Native Web 성숙도**: Expo의 웹 지원이 프로덕션 레벨에 도달

### 전환 전후 비교

```
전환 전 (현재)                           전환 후 (목표)
─────────────────────────────────────────────────────────────────────────

T-HOLDEM/                               T-HOLDEM/
├── app2/           # React 웹앱        └── uniqn-app/     # 통합 앱
│   ├── src/        # ~50,000줄              ├── app/      # Expo Router
│   └── (유지보수 중)                        ├── src/      # ~25,000줄
│                                            │   ├── components/
└── functions/      # Cloud Functions        │   ├── services/
                                             │   ├── hooks/
                                             │   └── ...
                                             ├── functions/ # Cloud Functions
                                             └── (iOS + Android + Web)

장점:
- 코드량 50% 감소 (플랫폼 공유)
- 일관된 UX/UI
- 배포 파이프라인 단일화
- 테스트 코드 재사용
```

---

## 2. React Native Web 통합 전략

### 2.1 플랫폼 분기 패턴

```typescript
// src/utils/platform.ts
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isMobile = isIOS || isAndroid;

// 플랫폼별 값 선택
export function platformSelect<T>(options: {
  web?: T;
  ios?: T;
  android?: T;
  native?: T;
  default: T;
}): T {
  if (isWeb && options.web !== undefined) return options.web;
  if (isIOS && options.ios !== undefined) return options.ios;
  if (isAndroid && options.android !== undefined) return options.android;
  if (isMobile && options.native !== undefined) return options.native;
  return options.default;
}
```

### 2.2 컴포넌트 분기 전략

```
분기가 필요한 경우                     공유 가능한 경우
─────────────────────────────────────────────────────────────────────────

플랫폼별 파일:                         단일 파일:
├── Camera.tsx                        ├── Button.tsx
├── Camera.web.tsx                    ├── Card.tsx
└── Camera.native.tsx                 ├── Input.tsx
                                      ├── Modal.tsx (react-native-modal)
├── QRScanner/                        └── 대부분의 UI 컴포넌트
│   ├── index.tsx (export)
│   ├── QRScanner.native.tsx
│   └── QRScanner.web.tsx

분기 필요한 기능:
- 카메라/QR 스캐너
- 생체 인증
- 푸시 알림 권한
- 파일 다운로드
- 딥링크 처리
- 네이티브 공유
```

### 2.3 네이티브 전용 기능 처리

```typescript
// src/services/biometric/index.ts
import { isWeb } from '@/utils/platform';

// 웹에서는 생체 인증 불가
export const BiometricService = {
  isAvailable: async (): Promise<boolean> => {
    if (isWeb) return false;
    const { LocalAuthentication } = await import('expo-local-authentication');
    return LocalAuthentication.hasHardwareAsync();
  },

  authenticate: async (): Promise<boolean> => {
    if (isWeb) return false;
    const { LocalAuthentication } = await import('expo-local-authentication');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: '생체 인증으로 로그인',
    });
    return result.success;
  },
};

// src/services/camera/index.ts
export const CameraService = {
  scan: async () => {
    if (isWeb) {
      // 웹 QR 스캐너 (html5-qrcode 사용)
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      // ... 웹 구현
    } else {
      // 네이티브 카메라 (expo-camera)
      const { Camera } = await import('expo-camera');
      // ... 네이티브 구현
    }
  },
};
```

### 2.4 반응형 레이아웃

```typescript
// src/hooks/useResponsive.ts
import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

export function useResponsive() {
  const { width } = useWindowDimensions();

  const breakpoint: Breakpoint =
    width < 640 ? 'sm' :
    width < 1024 ? 'md' :
    width < 1280 ? 'lg' : 'xl';

  return {
    width,
    breakpoint,
    isMobile: breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: breakpoint === 'lg' || breakpoint === 'xl',
  };
}

// 컴포넌트에서 사용
function JobList() {
  const { isDesktop, isMobile } = useResponsive();

  return (
    <View style={isDesktop ? styles.grid : styles.list}>
      {jobs.map(job => (
        <JobCard
          key={job.id}
          job={job}
          layout={isMobile ? 'compact' : 'full'}
        />
      ))}
    </View>
  );
}
```

### 2.5 웹 전용 최적화

```typescript
// src/components/common/SEO.tsx
import Head from 'expo-router/head';
import { isWeb } from '@/utils/platform';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
}

export function SEO({ title, description, image }: SEOProps) {
  if (!isWeb) return null;

  return (
    <Head>
      <title>{title} | UNIQN</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
  );
}

// 페이지에서 사용
export default function JobDetailPage() {
  const { job } = useLocalSearchParams();

  return (
    <>
      <SEO
        title={job.title}
        description={`${job.location.name}에서 ${job.roles.join(', ')} 모집`}
      />
      <JobDetail job={job} />
    </>
  );
}
```

---

## 3. 코드 재사용 분석

### 기존 코드 → 새 코드 매핑

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Code Migration Analysis                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  직접 재사용 (80-100%)              수정 후 재사용 (50-80%)              │
│  ┌──────────────────────┐          ┌──────────────────────┐             │
│  │ • TypeScript 타입     │          │ • Zustand 스토어      │             │
│  │ • Zod 스키마          │          │ • React Query 로직    │             │
│  │ • 상수/에러 코드      │          │ • 비즈니스 로직       │             │
│  │ • Firebase 서비스     │          │ • 유틸리티 함수       │             │
│  │ • Cloud Functions    │          │ • 커스텀 훅 (로직)    │             │
│  └──────────────────────┘          └──────────────────────┘             │
│                                                                          │
│  로직만 참조 (30-50%)               새로 작성 (0%)                       │
│  ┌──────────────────────┐          ┌──────────────────────┐             │
│  │ • 컴포넌트 로직       │          │ • UI 컴포넌트         │             │
│  │ • 폼 검증 로직        │          │ • 네비게이션         │             │
│  │ • 필터링/정렬 로직    │          │ • 스타일 (NativeWind)│             │
│  └──────────────────────┘          │ • 플랫폼별 기능      │             │
│                                    └──────────────────────┘             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 상세 파일 매핑

#### 타입/스키마 (직접 복사)

```typescript
// 기존: app2/src/types/jobPosting.ts
// 새로: uniqn-app/src/types/jobPosting.ts (동일)

export interface JobPosting {
  id: string;
  title: string;
  location: Location;
  workDate: Date;
  timeSlot: string;
  roles: JobRole[];
  status: JobPostingStatus;
  ownerId: string;
  // ...
}

// 기존: app2/src/schemas/jobPosting.ts
// 새로: uniqn-app/src/schemas/jobPosting.ts (동일)

export const jobPostingSchema = z.object({
  title: z.string().min(5).max(100),
  // ... (그대로)
});
```

#### 서비스 레이어 (약간 수정)

```typescript
// 기존: app2/src/services/JobPostingService.ts
// 새로: uniqn-app/src/services/jobPosting.ts

// 변경점:
// 1. 클래스 → 함수형으로 변환
// 2. React Query 친화적 구조

// 기존
class JobPostingService {
  async create(data: CreateJobPostingInput) {
    return addDoc(collection(db, 'jobPostings'), data);
  }
}

// 새로
export const jobPostingService = {
  create: async (data: CreateJobPostingInput) => {
    return addDoc(collection(db, 'jobPostings'), data);
  },

  getById: async (id: string) => {
    const doc = await getDoc(doc(db, 'jobPostings', id));
    return doc.exists() ? { id: doc.id, ...doc.data() } : null;
  },

  // React Query용 쿼리 키 제공
  keys: {
    all: ['jobPostings'] as const,
    lists: () => [...jobPostingService.keys.all, 'list'] as const,
    list: (filters: JobFilters) => [...jobPostingService.keys.lists(), filters] as const,
    details: () => [...jobPostingService.keys.all, 'detail'] as const,
    detail: (id: string) => [...jobPostingService.keys.details(), id] as const,
  },
};
```

#### 훅 변환

```typescript
// 기존: app2/src/hooks/useJobPostings.ts
export function useJobPostings(filters: JobFilters) {
  const [data, setData] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(...), (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [filters]);

  return { data, loading };
}

// 새로: uniqn-app/src/hooks/useJobPostings.ts
export function useJobPostings(filters: JobFilters) {
  // TanStack Query로 기본 데이터 로드
  const query = useQuery({
    queryKey: jobPostingService.keys.list(filters),
    queryFn: () => jobPostingService.list(filters),
  });

  // 실시간 업데이트는 별도 훅으로 처리
  useJobPostingsSubscription(filters);

  return query;
}

// 실시간 구독 (로직 재사용)
export function useJobPostingsSubscription(filters: JobFilters) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // 기존 쿼리 빌드 로직 재사용
    const q = buildJobPostingsQuery(filters);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      queryClient.setQueryData(
        jobPostingService.keys.list(filters),
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      );
    });

    return () => unsubscribe();
  }, [filters, queryClient]);
}
```

### 프로젝트 구조

```
uniqn-app/                              # 새 프로젝트
├── app/                                # Expo Router (파일 기반 라우팅)
│   ├── (auth)/                         # 인증 그룹
│   │   ├── login.tsx
│   │   ├── register/
│   │   │   ├── index.tsx
│   │   │   ├── step2.tsx
│   │   │   └── step3.tsx
│   │   └── forgot-password.tsx
│   │
│   ├── (app)/                          # 인증된 사용자
│   │   ├── (tabs)/                     # 하단 탭
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx               # 홈
│   │   │   ├── job-board/              # 구인구직
│   │   │   │   ├── index.tsx
│   │   │   │   └── [id].tsx
│   │   │   ├── schedule.tsx            # 내 스케줄
│   │   │   ├── notifications.tsx       # 알림
│   │   │   └── profile.tsx             # 프로필
│   │   │
│   │   ├── (employer)/                 # 구인자 기능
│   │   │   ├── my-postings/
│   │   │   ├── create-posting/
│   │   │   └── [postingId]/
│   │   │
│   │   └── (admin)/                    # 관리자 기능
│   │
│   ├── _layout.tsx                     # 루트 레이아웃
│   └── +not-found.tsx
│
├── src/
│   ├── components/                     # 재사용 컴포넌트
│   │   ├── common/                     # 공통 (Button, Input, Card)
│   │   ├── job/                        # 구인 관련
│   │   ├── schedule/                   # 스케줄 관련
│   │   └── ...
│   │
│   ├── services/                       # Firebase 서비스
│   │   ├── auth.ts
│   │   ├── jobPosting.ts
│   │   ├── application.ts
│   │   └── ...
│   │
│   ├── hooks/                          # 커스텀 훅
│   │   ├── useAuth.ts
│   │   ├── useJobPostings.ts
│   │   └── ...
│   │
│   ├── stores/                         # Zustand 스토어
│   │   ├── authStore.ts
│   │   ├── toastStore.ts
│   │   └── ...
│   │
│   ├── types/                          # TypeScript 타입 (기존에서 복사)
│   ├── schemas/                        # Zod 스키마 (기존에서 복사)
│   ├── constants/                      # 상수 (기존에서 복사)
│   └── utils/                          # 유틸리티 함수
│
├── functions/                          # Cloud Functions (기존에서 이동)
├── assets/                             # 이미지, 폰트
├── app.json                            # Expo 설정
├── eas.json                            # EAS Build 설정
└── package.json
```

---

## 4. 단계별 마이그레이션

### Phase 개요

```
Phase 1          Phase 2          Phase 3          Phase 4          Phase 5
(2주)            (3주)            (3주)            (2주)            (2주)
───────────────────────────────────────────────────────────────────────────▶

┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ 프로젝트 │     │ 핵심 기능│     │ 구인자  │     │ 관리자  │     │ 전환 &  │
│ 설정    │     │ (스태프) │     │ 기능    │     │ + 최적화│     │  출시   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
    │               │               │               │               │
    ▼               ▼               ▼               ▼               ▼
• Expo 설정     • 로그인/가입   • 공고 관리    • 관리자 기능   • 웹 전환
• 기존 코드 이전 • 구인구직      • 지원자 관리   • 성능 최적화   • 스토어 제출
• 기본 UI       • 내 스케줄     • 출퇴근/정산   • 테스트       • DNS 전환
• Firebase 연동 • QR 출퇴근                                    • 모니터링
• 웹 빌드 확인
```

### Phase 1: 프로젝트 설정 (2주)

```yaml
Week 1:
  목표: 개발 환경 구축 + 코드 이전
  작업:
    - Expo 프로젝트 생성 (npx create-expo-app@latest)
    - TypeScript strict 모드 설정
    - 폴더 구조 생성
    - 기존 types/, schemas/, constants/ 복사
    - 기존 services/ 복사 및 수정
    - ESLint/Prettier 설정
    - NativeWind 설정
  산출물:
    - uniqn-app/ 프로젝트 골격
    - 타입/스키마/상수 이전 완료

Week 2:
  목표: 기반 시스템 + 웹 빌드 확인
  작업:
    - 디자인 토큰 정의
    - 기본 UI 컴포넌트 (Button, Input, Card 등)
    - Expo Router 네비게이션 설정
    - Firebase 연동 (Auth, Firestore)
    - 웹 빌드 테스트 (npx expo export -p web)
    - React Native Web 호환성 확인
  산출물:
    - 기본 컴포넌트 라이브러리
    - iOS/Android/Web 빌드 모두 동작
```

**Phase 1 체크리스트**:
- [ ] Expo 프로젝트 생성
- [ ] TypeScript 설정 (strict: true)
- [ ] 기존 types/ 100개+ 이전
- [ ] 기존 schemas/ 20개+ 이전
- [ ] 기존 constants/ 이전
- [ ] Firebase 서비스 복사/수정
- [ ] NativeWind 설정
- [ ] 기본 컴포넌트 10개 구현
- [ ] Expo Router 설정
- [ ] Firebase 초기화
- [ ] **웹 빌드 성공 확인**
- [ ] **iOS 시뮬레이터 실행 확인**
- [ ] **Android 에뮬레이터 실행 확인**

### Phase 2: 스태프 핵심 기능 (3주)

```yaml
Week 3:
  목표: 인증 시스템
  작업:
    - 로그인 화면 (이메일/비밀번호)
    - 회원가입 (4단계: 계정 → 본인인증 → 프로필 → 완료)
    - 휴대폰 본인인증 연동 (PASS, 카카오)
    - 비밀번호 찾기
    - 소셜 로그인 (Apple, Google, 카카오)
    - 세션 관리 (React Query)
    - 생체 인증 (네이티브만)
    - 웹 호환성 확인
  산출물:
    - 인증 플로우 완성
    - 웹/모바일 모두 동작

  참고:
    - ⚠️ 이메일 인증 사용 안함 (휴대폰 본인인증으로 대체)

Week 4:
  목표: 구인구직 기능
  작업:
    - 공고 목록 (FlashList + 웹 호환)
    - 필터 (BottomSheet → 웹은 Drawer)
    - 검색 (debounce)
    - 공고 상세
    - 지원하기 플로우
    - 지원 내역 관리
    - 찜하기 기능
  산출물:
    - 구인구직 전체 플로우

Week 5:
  목표: 스케줄 & QR
  작업:
    - 내 스케줄 (캘린더 뷰)
    - 스케줄 상세 BottomSheet
    - QR 스캐너 (플랫폼 분기)
      - 네이티브: expo-camera
      - 웹: html5-qrcode
    - 출퇴근 체크인/아웃
    - 근무 기록 조회
  산출물:
    - 스케줄 관리 완성
    - QR 출퇴근 시스템 (플랫폼별)
```

### Phase 3: 구인자 기능 (3주)

```yaml
Week 6:
  목표: 공고 관리
  작업:
    - 공고 작성 (5단계 마법사)
    - 공고 수정/삭제
    - 공고 상태 관리
    - 임시저장/불러오기
    - 반응형 레이아웃 (데스크톱 최적화)
  산출물:
    - 공고 CRUD 완성

Week 7:
  목표: 지원자 관리
  작업:
    - 지원자 목록 (탭: 전체/대기/확정)
    - 확정/거절 처리
    - 대기자 관리
    - 일괄 확정
    - 확정 취소
  산출물:
    - 지원자 관리 완성

Week 8:
  목표: 출퇴근/정산
  작업:
    - 출퇴근 현황 대시보드
    - 시간 수정 모달
    - 정산 계산 (기존 로직 재사용)
    - 개별/일괄 정산
    - 정산 내역 관리
  산출물:
    - 정산 시스템 완성
```

### Phase 4: 관리자 + 최적화 (2주)

```yaml
Week 9:
  목표: 관리자 기능
  작업:
    - 관리자 네비게이션
    - 사용자 목록/검색
    - 사용자 상세/수정
    - 문의 관리
    - 토너먼트 승인
  산출물:
    - 관리자 기능 완성

Week 10:
  목표: 최적화
  작업:
    - 번들 크기 최적화
    - 이미지 최적화 (expo-image)
    - 리스트 가상화 검증
    - 웹 성능 최적화 (코드 스플리팅)
    - 메모리 누수 점검
    - E2E 테스트 작성
  산출물:
    - 성능 지표 달성
```

### Phase 5: 전환 & 출시 (2주)

```yaml
Week 11:
  목표: 앱스토어 + 웹 준비
  작업:
    - 앱 아이콘/스플래시
    - 스토어 스크린샷
    - 앱 설명문 작성
    - TestFlight/내부 테스트
    - 웹 빌드 최종 점검
    - Firebase Hosting 설정
  산출물:
    - 스토어 제출 자료
    - 웹 배포 준비 완료

Week 12:
  목표: 전환 및 출시
  작업:
    - 베타 테스트
    - 피드백 수집/반영
    - 앱스토어 제출
    - DNS 전환 (uniqn.app → 새 웹앱)
    - 기존 웹앱 리다이렉트 설정
    - 모니터링 설정
  산출물:
    - iOS/Android 앱 출시
    - 웹 전환 완료
```

---

## 5. 기능별 상세 계획

### 인증 시스템 마이그레이션

```
기존 (app2/)                          새로 (uniqn-app/)
─────────────────────────────────────────────────────────────────────────
src/pages/auth/Login.tsx              app/(auth)/login.tsx
├─ 603줄                              ├─ ~200줄
├─ 6개 useState                       ├─ useForm + zodResolver
├─ 직접 Firebase 호출                  ├─ authService 분리
└─ 기본 검증                          └─ Zod 스키마 검증

핵심 변경:
1. React Hook Form으로 폼 관리
2. 검증 로직을 shared 스키마로 통합
3. 플랫폼별 처리:
   - 생체 인증: 네이티브만
   - 소셜 로그인: 플랫폼별 SDK
   - 세션 유지: AsyncStorage/localStorage
```

### QR 출퇴근 시스템

```typescript
// src/components/qr/QRScanner.tsx
import { isWeb } from '@/utils/platform';

export function QRScanner({ onScan }: { onScan: (data: string) => void }) {
  if (isWeb) {
    return <WebQRScanner onScan={onScan} />;
  }
  return <NativeQRScanner onScan={onScan} />;
}

// src/components/qr/QRScanner.native.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';

export function NativeQRScanner({ onScan }) {
  const [permission, requestPermission] = useCameraPermissions();
  // ... expo-camera 구현
}

// src/components/qr/QRScanner.web.tsx
import { Html5QrcodeScanner } from 'html5-qrcode';

export function WebQRScanner({ onScan }) {
  // ... html5-qrcode 구현
}
```

### 구인구직 (반응형)

```typescript
// src/app/(app)/(tabs)/job-board/index.tsx
import { useResponsive } from '@/hooks/useResponsive';

export default function JobBoardScreen() {
  const { isDesktop } = useResponsive();

  return (
    <View style={styles.container}>
      <SEO title="구인공고" description="홀덤 딜러/스태프 구인공고" />

      {isDesktop ? (
        // 데스크톱: 사이드바 필터 + 그리드 레이아웃
        <View style={styles.desktopLayout}>
          <FilterSidebar />
          <JobGrid jobs={jobs} />
        </View>
      ) : (
        // 모바일: 상단 검색 + 리스트
        <>
          <SearchHeader onFilter={() => setShowFilter(true)} />
          <JobList jobs={jobs} />
          <FilterSheet visible={showFilter} onClose={() => setShowFilter(false)} />
        </>
      )}
    </View>
  );
}
```

---

## 6. 데이터 호환성

### Firebase 스키마 (변경 없음)

```typescript
// 기존 Firestore 스키마 그대로 사용
// 데이터 마이그레이션 불필요

collections:
  users/:userId           → 그대로 사용
  jobPostings/:postingId  → 그대로 사용
  applications/:appId     → 그대로 사용
  workLogs/:logId         → 그대로 사용
  notifications/:notifId  → 그대로 사용

// 유일한 변경: fcmTokens 배열 지원
users/:userId
  - fcmTokens: string[]  // 멀티 디바이스 지원
```

### 인증 호환성

```typescript
// Firebase Auth 동일하게 사용
// 기존 사용자 그대로 로그인 가능

// 웹/모바일 세션 분리
// - 웹: localStorage (기존)
// - 모바일: AsyncStorage (신규)
// - Firebase Auth 상태는 공유
```

---

## 7. 리스크 관리

### 리스크 매트릭스

| 리스크 | 확률 | 영향 | 대응 전략 |
|--------|------|------|-----------|
| **React Native Web 호환성 이슈** | 중 | 높음 | 개발 초기 웹 빌드 지속 확인, 플랫폼 분기 패턴 |
| **앱스토어 심사 거절** | 중 | 높음 | 가이드라인 사전 검토, 1주일 버퍼 |
| **성능 저하 (특히 웹)** | 중 | 중 | 코드 스플리팅, 지연 로딩 |
| **기존 사용자 혼란** | 낮음 | 중 | 안내 페이지, 점진적 전환 |
| **일정 지연** | 중 | 중 | MVP 우선, 관리자 기능 후순위 |

### React Native Web 호환성 대응

```yaml
예방 조치:
  - 매 기능 구현 시 웹 빌드 확인
  - 호환되지 않는 라이브러리 사전 파악
  - 플랫폼 분기 패턴 표준화

알려진 이슈 및 대안:
  - react-native-reanimated: 웹에서 일부 제한 → CSS 애니메이션 대체
  - expo-camera: 웹 미지원 → html5-qrcode 사용
  - expo-local-authentication: 웹 미지원 → 웹에서는 비활성화
  - react-native-calendars: 웹 지원 O

대응 계획:
  - 호환성 이슈 발생 시 즉시 플랫폼 분기
  - 주간 웹 빌드 테스트 필수
```

### 전환 롤백 전략

```yaml
웹 전환 롤백:
  - DNS를 다시 기존 웹앱으로 변경 (5분 내)
  - 기존 app2/ 프로젝트 유지 (1개월)

모바일앱 롤백:
  - 심각한 버그 시 앱스토어 긴급 업데이트
  - OTA 업데이트로 빠른 수정
```

---

## 8. 품질 보증

### 테스트 전략

```yaml
Phase별 테스트:

Phase 1 (설정):
  - iOS/Android/Web 빌드 성공
  - 기본 네비게이션 동작

Phase 2 (스태프):
  - 단위 테스트: 80%+
  - E2E: 로그인 → 지원 → QR 출근
  - 웹/모바일 교차 테스트

Phase 3 (구인자):
  - 단위 테스트: 80%+
  - E2E: 공고 작성 → 확정 → 정산

Phase 4 (최적화):
  - 성능 테스트 (Lighthouse, 프로파일링)
  - 메모리 누수 테스트

Phase 5 (출시):
  - 전체 회귀 테스트
  - 베타 테스트 (50명+)
```

### 성능 기준

| 항목 | 웹 | 모바일 |
|------|-----|--------|
| 첫 로드 | < 3초 | < 2초 |
| 화면 전환 | < 300ms | < 200ms |
| 리스트 스크롤 | 60fps | 60fps |
| 번들 크기 | < 500KB (gzip) | < 30MB |
| 메모리 | - | < 150MB |

---

## 9. 전환 체크리스트

### 출시 전 필수

```yaml
개발 완료:
  - [ ] 모든 핵심 기능 구현
  - [ ] iOS/Android/Web 모두 동작
  - [ ] 테스트 커버리지 80%+
  - [ ] 성능 기준 충족

앱스토어:
  - [ ] iOS 앱 심사 제출
  - [ ] Android 앱 제출
  - [ ] 스토어 메타데이터 완성

웹:
  - [ ] Firebase Hosting 설정
  - [ ] 커스텀 도메인 연결 준비
  - [ ] SSL 인증서 확인
```

### 전환 당일 (D-Day)

```yaml
웹 전환 순서:
  1. 기존 웹앱에 "새 앱으로 이동" 배너 표시
  2. Firebase Hosting에 새 웹앱 배포
  3. DNS 전환 (uniqn.app → 새 앱)
  4. 기존 웹앱 URL을 새 앱으로 리다이렉트
  5. 모니터링 (에러율, 사용자 피드백)

롤백 트리거:
  - 에러율 > 5%
  - 핵심 기능 장애
  - 심각한 성능 저하
```

### 전환 후 (D+7)

```yaml
안정화:
  - [ ] 에러 모니터링 (Crashlytics, Sentry)
  - [ ] 사용자 피드백 수집
  - [ ] 성능 지표 확인
  - [ ] 버그 핫픽스

정리:
  - [ ] 기존 app2/ 프로젝트 아카이브
  - [ ] 문서 업데이트
  - [ ] CI/CD 파이프라인 정리
```

---

## 요약

### 마이그레이션 핵심 포인트

| 항목 | 내용 |
|------|------|
| **전략** | 완전 대체 (React → React Native + Web) |
| **플랫폼** | iOS + Android + Web (단일 코드베이스) |
| **기간** | 약 12주 |
| **코드 재사용** | 타입/스키마/서비스 80%+, UI 0% |
| **데이터 마이그레이션** | 불필요 (Firebase 동일) |
| **사용자 영향** | 최소 (계정 그대로, UI만 변경) |

### 성공 기준

| 항목 | 목표 |
|------|------|
| 플랫폼 동작 | iOS, Android, Web 모두 100% |
| 테스트 커버리지 | 80%+ |
| 앱 시작 시간 | < 2초 (모바일), < 3초 (웹) |
| 크래시 프리 비율 | 99.5%+ |
| 기존 기능 유지 | 100% |

---

## 관련 문서

- [21-react-native-web.md](./21-react-native-web.md) - React Native Web 상세 가이드
- [00-overview.md](./00-overview.md) - 프로젝트 개요
- [15-cicd.md](./15-cicd.md) - CI/CD 파이프라인
- [18-app-store-guide.md](./18-app-store-guide.md) - 앱스토어 제출 가이드
