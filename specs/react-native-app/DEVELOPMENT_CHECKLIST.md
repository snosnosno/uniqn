# UNIQN Mobile 개발 체크리스트

**목표**: iOS + Android + Web 단일 코드베이스 (React Native + Expo)
**예상 기간**: 16주 (Phase 1-6) + 버퍼 2주
**개발 도구**: Claude Code (Opus 4.5)

---

## 우선순위 범례

| 태그 | 의미 | 설명 |
|:----:|------|------|
| `[P0]` | **필수** | MVP 출시에 반드시 필요 |
| `[P1]` | **중요** | 출시 전 구현 권장 |
| `[P2]` | **나중** | 출시 후 구현 가능 |

---

## Phase 1: 프로젝트 기반 (3주)

### 1.1 프로젝트 초기화 [P0]
- [ ] Expo 프로젝트 생성 (`npx create-expo-app@latest`)
- [ ] TypeScript strict 모드 설정
- [ ] 폴더 구조 생성 ([00-overview.md](./00-overview.md#프로젝트-구조))
- [ ] Path alias 설정 (`@/` → `src/`)
- [ ] ESLint/Prettier 설정
- [ ] Husky + lint-staged 설정 (pre-commit 검증)

### 1.2 코드 이전 (app2/ → uniqn-app/) [P0]
- [ ] `types/` 복사 (100% 재사용)
- [ ] `schemas/` 복사 (Zod 스키마)
- [ ] `constants/` 복사
- [ ] `utils/` 복사 및 RN 호환 수정
- [ ] `services/` 복사 및 함수형 변환

#### 컴포넌트 변환 ([22-migration-mapping.md](./22-migration-mapping.md))
| Web 요소 | RN 요소 | 체크 |
|---------|---------|:----:|
| div | View | [ ] |
| span/p | Text | [ ] |
| button | Pressable | [ ] |
| input | TextInput | [ ] |
| img | expo-image | [ ] |
| a (링크) | Link (expo-router) | [ ] |
| onClick | onPress | [ ] |
| className | style (NativeWind) | [ ] |
| localStorage | MMKV/SecureStore | [ ] |

### 1.3 핵심 기반 시스템 [P0] ([03-state-management.md](./03-state-management.md))
| 항목 | 체크 | 우선순위 |
|------|:----:|:--------:|
| Firebase 연동 (Auth, Firestore) | [ ] | P0 |
| NativeWind 설정 | [ ] | P0 |
| Expo Router 설정 | [ ] | P0 |
| Zustand 설정 (authStore, toastStore) | [ ] | P0 |
| React Query 설정 | [ ] | P0 |
| 환경변수 설정 (.env.dev/prod) | [ ] | P0 |
| ThemeProvider (다크모드) | [ ] | P0 |
| 디자인 토큰 (colors, spacing) | [ ] | P0 |
| AppError 클래스 | [ ] | P0 |

### 1.4 추가 기반 시스템 [P1]
| 항목 | 체크 | 우선순위 |
|------|:----:|:--------:|
| React Hook Form + zodResolver | [ ] | P1 |
| i18n 설정 (한/영) | [ ] | P1 |
| modalStore 설정 | [ ] | P1 |
| errorStore 설정 | [ ] | P1 |
| useNetworkStatus 훅 | [ ] | P1 |
| Platform 플래그 (isWeb, isIOS, isAndroid) | [ ] | P1 |
| mmkvStorage 설정 | [ ] | P1 |
| AuthError, NetworkError 클래스 | [ ] | P1 |

### 1.5 나중에 추가할 기반 [P2]
| 항목 | 체크 | 우선순위 |
|------|:----:|:--------:|
| cachingPolicies 설정 | [ ] | P2 |
| onlineManager 설정 | [ ] | P2 |
| NetworkProvider | [ ] | P2 |
| OfflineBanner 컴포넌트 | [ ] | P2 |
| useInterval 훅 | [ ] | P2 |
| useFirestoreSubscription 훅 | [ ] | P2 |
| SEO 컴포넌트 (웹) | [ ] | P2 |
| JobPostingStructuredData | [ ] | P2 |
| IndexedDBStorage (웹) | [ ] | P2 |

### 1.6 핵심 컴포넌트 (15개) [P0] ([05-components.md](./05-components.md))

#### UI 기본 [P0]
- [ ] Button (variants: primary, secondary, outline)
- [ ] Input (text, password, email)
- [ ] Card (기본 컨테이너)
- [ ] Modal (기본 모달)
- [ ] Toast (알림 메시지)
- [ ] Loading (스피너)
- [ ] EmptyState (빈 상태)
- [ ] ErrorState (에러 상태)

#### 모달/토스트 시스템 [P0]
- [ ] ModalManager (중앙 모달 관리)
- [ ] ToastManager (중앙 토스트 관리)

#### 폼 컴포넌트 [P0]
- [ ] FormField (폼 필드 래퍼)
- [ ] FormSelect (선택 필드)

#### 레이아웃 [P0]
- [ ] LoadingOverlay (전체 로딩)
- [ ] Skeleton (스켈레톤 로딩)
- [ ] MobileHeader (모바일 헤더)

### 1.7 네비게이션 [P0] ([02-navigation.md](./02-navigation.md))
- [ ] useAppInitialize (앱 초기화)
- [ ] useAuthGuard (인증 가드)
- [ ] +not-found.tsx (404 처리)
- [ ] 기본 탭 네비게이션 구조

### 1.8 플랫폼 빌드 확인 [P0]
- [ ] iOS 시뮬레이터 실행
- [ ] Android 에뮬레이터 실행
- [ ] Web 빌드 성공 (`npx expo export -p web`)

### 1.9 Phase 1 테스트 [P0]
- [ ] Jest 설정 (jest.config.js)
- [ ] Testing Library 설정
- [ ] 핵심 컴포넌트 단위 테스트 (Button, Input, Card)
- [ ] 스토어 단위 테스트 (authStore)
- [ ] ESLint 에러 0개 확인

### ✓ Phase 1 검증 기준
```
□ 앱이 iOS/Android/Web 모두 실행됨
□ Firebase Auth 로그인/로그아웃 동작
□ 다크모드 토글 동작
□ Toast 알림 표시됨
□ 테스트 통과율 100%
```

**관련 문서**: [01-architecture.md](./01-architecture.md), [05-components.md](./05-components.md)

---

## Phase 2: 인증 + 구인구직 (3주)

### 2.1 인증 시스템 [P0]
| 기능 | 체크 | 우선순위 |
|------|:----:|:--------:|
| 로그인 (이메일) | [ ] | P0 |
| 회원가입 (3단계) | [ ] | P0 |
| 비밀번호 찾기 | [ ] | P0 |
| 세션 관리 (토큰 갱신) | [ ] | P0 |
| 소셜 로그인 (Google) | [ ] | P1 |
| 소셜 로그인 (Apple) | [ ] | P1 |
| 소셜 로그인 (카카오) | [ ] | P1 |
| 생체 인증 | [ ] | P2 |

#### 인증 컴포넌트 [P0]
- [ ] LoginScreen
- [ ] SignupScreen (AccountStep, ProfileStep, CompleteStep)
- [ ] ForgotPasswordScreen
- [ ] StepIndicator (단계 표시)
- [ ] PasswordStrength (비밀번호 강도)
- [ ] SocialLoginButtons

### 2.2 본인인증 (Mock) [P1]
> ⚠️ **실제 연동은 Phase 6에서 진행. 지금은 뼈대만 구현**

- [ ] IdentityVerificationData 타입 정의
- [ ] 본인인증 상태 머신 (idle → verifying → verified/failed)
- [ ] MockIdentityService (테스트용 가짜 인증)
- [ ] 본인인증 화면 UI (실제 연동 없이)
- [ ] 인증 상태 저장 구조 (users/{uid}/verification)

### 2.3 구인구직 [P0]
| 기능 | 체크 | 우선순위 |
|------|:----:|:--------:|
| 공고 목록 (FlashList) | [ ] | P0 |
| 공고 상세 | [ ] | P0 |
| 지원하기 | [ ] | P0 |
| 지원 내역 | [ ] | P0 |
| 필터/검색 | [ ] | P1 |
| 찜하기 | [ ] | P1 |

#### 비즈니스 컴포넌트 [P0]
- [ ] JobCard (공고 카드)
- [ ] JobFilters (필터 UI)
- [ ] ApplicationStatus (지원 상태)
- [ ] Badge (상태 표시)

#### 위치 기반 검색 [P2]
- [ ] geofire-common 설치
- [ ] useUserLocation 훅
- [ ] useNearbyJobs 훅

### 2.4 Phase 2 테스트 [P0]
- [ ] 인증 플로우 통합 테스트
- [ ] 공고 목록 컴포넌트 테스트
- [ ] 지원하기 플로우 테스트
- [ ] E2E: 로그인 → 공고 보기 → 지원 (Maestro)

### ✓ Phase 2 검증 기준
```
□ 이메일 회원가입 → 로그인 완료
□ 공고 목록 무한스크롤 동작
□ 공고 상세 → 지원하기 완료
□ 지원 내역 확인 가능
□ 본인인증 Mock UI 동작
□ 테스트 통과율 80%+
```

**관련 문서**: [04-screens.md](./04-screens.md), [06-firebase.md](./06-firebase.md)

---

## Phase 3: 스케줄 + 알림 (3주)

### 3.1 내 스케줄 & QR [P0]
| 기능 | 체크 | 우선순위 |
|------|:----:|:--------:|
| 캘린더 뷰 | [ ] | P0 |
| 스케줄 상세 (BottomSheet) | [ ] | P0 |
| QR 스캐너 (네이티브) | [ ] | P0 |
| QR 스캐너 (웹) | [ ] | P0 |
| 출근/퇴근 체크 | [ ] | P0 |
| 근무 기록 목록 | [ ] | P1 |

#### 스케줄 컴포넌트 [P0]
- [ ] CalendarView (캘린더)
- [ ] ScheduleCard (스케줄 카드)
- [ ] BottomSheet (하단 시트)
- [ ] QRScanner (네이티브)
- [ ] QRScannerWeb (웹용)

### 3.2 푸시 알림 [P1]
| 기능 | 체크 | 우선순위 |
|------|:----:|:--------:|
| FCM 설정 | [ ] | P1 |
| 알림 권한 요청 | [ ] | P1 |
| 포그라운드 알림 | [ ] | P1 |
| 알림 목록 화면 | [ ] | P1 |
| 알림 설정 화면 | [ ] | P2 |
| 백그라운드 알림 | [ ] | P2 |

#### 알림 서비스 [P1]
- [ ] FCMService (토큰 관리)
- [ ] notificationStore (Zustand)
- [ ] useNotificationListener 훅
- [ ] NotificationTemplates 상수

#### Firebase Functions 트리거 [P1]
- [ ] onApplicationCreated → 구인자 알림
- [ ] onApplicationConfirmed → 스태프 알림
- [ ] onCheckIn/onCheckOut → 구인자 알림

### 3.3 Phase 3 테스트 [P0]
- [ ] 캘린더 렌더링 테스트
- [ ] QR 스캔 플로우 테스트
- [ ] 출퇴근 체크 통합 테스트
- [ ] E2E: 스케줄 확인 → QR 출근 → 퇴근 (Maestro)

### ✓ Phase 3 검증 기준
```
□ 캘린더에서 스케줄 확인 가능
□ QR 스캔으로 출근/퇴근 체크
□ 출퇴근 기록 저장됨
□ FCM 토큰 발급 및 저장
□ 테스트 통과율 80%+
```

**관련 문서**: [10-notifications.md](./10-notifications.md), [02-navigation.md](./02-navigation.md)

---

## Phase 4: 구인자 기능 (3주)

### 4.1 공고 관리 [P0]
| 기능 | 체크 | 우선순위 |
|------|:----:|:--------:|
| 공고 작성 (5단계) | [ ] | P0 |
| 공고 수정 | [ ] | P0 |
| 공고 삭제 | [ ] | P0 |
| 상태 관리 (모집중/마감) | [ ] | P0 |
| 임시저장 | [ ] | P1 |

#### 다단계 폼 [P0]
- [ ] useAutoSave 훅 (30초 자동 저장)
- [ ] 단계별 유효성 검사 (Zod)
- [ ] StepNavigation (이전/다음)

### 4.2 지원자 관리 [P0]
| 기능 | 체크 | 우선순위 |
|------|:----:|:--------:|
| 지원자 목록 | [ ] | P0 |
| 확정/거절 처리 | [ ] | P0 |
| 일괄 확정 | [ ] | P1 |
| 대기자 관리 | [ ] | P2 |

#### 지원자 컴포넌트 [P0]
- [ ] ApplicantCard (지원자 카드)
- [ ] ApplicantList (지원자 목록)
- [ ] ConfirmModal (확인 모달)

### 4.3 출퇴근/정산 [P0]
| 기능 | 체크 | 우선순위 |
|------|:----:|:--------:|
| 출퇴근 현황 | [ ] | P0 |
| 시간 수정 | [ ] | P1 |
| 정산 계산 | [ ] | P0 |
| 개별 정산 | [ ] | P0 |
| 일괄 정산 | [ ] | P1 |

#### 서비스 레이어 [P0]
- [ ] SettlementService (정산 계산)
- [ ] CalendarService (캘린더 이벤트)

### 4.4 Phase 4 테스트 [P0]
- [ ] 공고 작성 플로우 테스트
- [ ] 지원자 확정/거절 테스트
- [ ] 정산 계산 로직 단위 테스트
- [ ] E2E: 공고 등록 → 지원자 확정 → 정산 (Maestro)

### ✓ Phase 4 검증 기준
```
□ 5단계 공고 작성 완료
□ 지원자 확정 시 알림 발송
□ 정산 금액 정확히 계산
□ 구인자 대시보드 동작
□ 테스트 통과율 80%+
```

**관련 문서**: [06-firebase.md](./06-firebase.md), [08-data-flow.md](./08-data-flow.md)

---

## Phase 5: 최적화 + 배포 준비 (2주)

### 5.1 관리자 기능 [P1]
| 기능 | 체크 | 우선순위 |
|------|:----:|:--------:|
| 사용자 목록/검색 | [ ] | P1 |
| 사용자 상세/수정 | [ ] | P1 |
| 문의 관리 | [ ] | P2 |

### 5.2 성능 최적화 [P0]

#### 번들 최적화 [P0]
- [ ] 코드 스플리팅 설정
- [ ] Tree shaking 확인
- [ ] 번들 크기 < 500KB (gzip)

#### 렌더링 최적화 [P0]
- [ ] FlashList 가상화 전체 적용
- [ ] React.memo 적절히 사용
- [ ] 리렌더링 프로파일링

#### 성능 지표 [P0]
| 지표 | 목표 | 체크 |
|------|------|:----:|
| 첫 로드 (웹) | < 3초 | [ ] |
| 첫 로드 (모바일) | < 2초 | [ ] |
| 화면 전환 | < 300ms | [ ] |
| 리스트 스크롤 | 60fps | [ ] |

### 5.3 Analytics [P1] ([16-analytics.md](./16-analytics.md))
- [ ] Firebase Analytics 초기화
- [ ] AnalyticsService 구현
- [ ] 화면 조회 자동 추적
- [ ] 핵심 이벤트 (login, signup, job_apply)
- [ ] CrashlyticsService 구현
- [ ] ErrorBoundary-Crashlytics 연동

### 5.4 딥링킹 [P1] ([17-deep-linking.md](./17-deep-linking.md))
- [ ] Custom Scheme (`uniqn://`)
- [ ] DeepLinkService 구현
- [ ] 알림 → 딥링크 연동
- [ ] Universal Links (iOS) [P2]
- [ ] App Links (Android) [P2]

### 5.5 Phase 5 테스트 [P0]
- [ ] 성능 측정 자동화
- [ ] 전체 E2E 테스트 (스태프 + 구인자 시나리오)
- [ ] 접근성 테스트 (WCAG 2.1 AA)
- [ ] 테스트 커버리지 80%+ 확인

### ✓ Phase 5 검증 기준
```
□ 성능 지표 모두 충족
□ Analytics 이벤트 수집됨
□ 딥링크로 앱 내 이동 동작
□ 전체 테스트 커버리지 80%+
□ 크래시 리포팅 동작
```

**관련 문서**: [07-improvements.md](./07-improvements.md), [09-error-handling.md](./09-error-handling.md)

---

## Phase 6: 앱스토어 출시 (2주 + 버퍼 2주)

### 6.1 본인인증 실제 연동 [P1]
> ⚠️ **외부 서비스 연동 - 지연 가능성 있음**

| 방식 | 체크 | 플랫폼 |
|------|:----:|:------:|
| PASS 본인인증 | [ ] | 네이티브 |
| 카카오 본인인증 | [ ] | All |
| WebView 브릿지 구현 | [ ] | 네이티브 |
| 인증 결과 저장 | [ ] | All |

### 6.2 앱스토어 에셋 [P0] ([18-app-store-guide.md](./18-app-store-guide.md))
- [ ] 앱 아이콘 (1024x1024)
- [ ] 스플래시 스크린
- [ ] 스크린샷 (6.7", 6.5", 5.5")
- [ ] 앱 설명문 (한/영)
- [ ] 개인정보처리방침 URL
- [ ] 이용약관 URL

### 6.3 iOS 심사 준비 [P0]
- [ ] 데모 계정 준비
- [ ] 심사 노트 작성 (영문)
- [ ] 연령 등급 (17+)
- [ ] ATT 권한 요청
- [ ] Sign in with Apple

### 6.4 Android 심사 준비 [P0]
- [ ] 데모 계정 준비
- [ ] 콘텐츠 등급 질문지
- [ ] 개인정보 신고
- [ ] 타겟 연령 설정

### 6.5 배포 파이프라인 [P0] ([15-cicd.md](./15-cicd.md))

#### EAS Build 설정 [P0]
- [ ] eas.json (development/preview/production)
- [ ] app.config.ts 동적 설정
- [ ] 환경별 Firebase 설정

#### GitHub Actions [P0]
- [ ] ci.yml (Lint/Test)
- [ ] build-prod.yml (태그 트리거)
- [ ] OTA 업데이트 설정

#### 배포 [P0]
- [ ] TestFlight 배포
- [ ] Google Play 내부 테스트
- [ ] Firebase Hosting (웹)

### 6.6 전환 체크리스트 [P0]

#### 출시 전
- [ ] 모든 P0 기능 구현
- [ ] iOS/Android/Web 모두 동작
- [ ] 테스트 커버리지 80%+
- [ ] 성능 기준 충족

#### 전환 당일
- [ ] 기존 웹앱에 안내 배너
- [ ] Firebase Hosting 배포
- [ ] DNS 전환
- [ ] 모니터링 대시보드 확인

#### 전환 후 (D+7)
- [ ] 에러율 < 5% 확인
- [ ] 사용자 피드백 수집
- [ ] 핫픽스 대응

### ✓ Phase 6 검증 기준
```
□ 앱스토어 심사 통과
□ 웹/iOS/Android 모두 배포 완료
□ 실 사용자 로그인 성공
□ 에러율 5% 미만
□ 모니터링 정상 동작
```

**관련 문서**: [14-migration-plan.md](./14-migration-plan.md), [18-app-store-guide.md](./18-app-store-guide.md)

---

## 품질 게이트 (모든 Phase)

### 코드 품질 [P0] ([01-architecture.md](./01-architecture.md))
- [ ] TypeScript strict 에러 0개
- [ ] ESLint 경고 < 10개
- [ ] 네이밍 컨벤션 통일

### 보안 [P0] ([12-security.md](./12-security.md))
- [ ] 모든 입력 검증 (Zod)
- [ ] XSS 방지
- [ ] SecureStorage 사용 (민감 정보)
- [ ] Firestore Security Rules

### UI/UX [P0] ([11-ux-guidelines.md](./11-ux-guidelines.md))
- [ ] 다크모드 100% 지원
- [ ] 터치 타겟 44px 이상
- [ ] 로딩/에러/빈 상태 처리
- [ ] 반응형 (모바일/태블릿/데스크톱)

### 접근성 [P1] ([19-accessibility.md](./19-accessibility.md))
- [ ] 스크린리더 호환
- [ ] 색상 대비 4.5:1 이상
- [ ] accessibilityLabel 적용

### 에러 처리 [P0] ([09-error-handling.md](./09-error-handling.md))
- [ ] AppError 클래스 계층
- [ ] 사용자 친화적 메시지 (한글)
- [ ] 글로벌 에러 핸들러

---

## 스펙 문서 인덱스

| 번호 | 문서 | 주요 내용 |
|:----:|------|----------|
| 00 | [overview.md](./00-overview.md) | 프로젝트 개요, 구조 |
| 01 | [architecture.md](./01-architecture.md) | 아키텍처 설계 |
| 02 | [navigation.md](./02-navigation.md) | 네비게이션 구조 |
| 03 | [state-management.md](./03-state-management.md) | 상태 관리 전략 |
| 04 | [screens.md](./04-screens.md) | 화면별 상세 설계 |
| 05 | [components.md](./05-components.md) | 컴포넌트 시스템 |
| 06 | [firebase.md](./06-firebase.md) | Firebase 연동 |
| 07 | [improvements.md](./07-improvements.md) | 기존 문제점 개선 |
| 08 | [data-flow.md](./08-data-flow.md) | 데이터 흐름 패턴 |
| 09 | [error-handling.md](./09-error-handling.md) | 에러 처리 전략 |
| 10 | [notifications.md](./10-notifications.md) | 푸시 알림 시스템 |
| 11 | [ux-guidelines.md](./11-ux-guidelines.md) | UX 가이드라인 |
| 12 | [security.md](./12-security.md) | 보안 설계 |
| 13 | [testing-strategy.md](./13-testing-strategy.md) | 테스트 전략 |
| 14 | [migration-plan.md](./14-migration-plan.md) | 마이그레이션 계획 |
| 15 | [cicd.md](./15-cicd.md) | CI/CD 파이프라인 |
| 16 | [analytics.md](./16-analytics.md) | 분석 시스템 |
| 17 | [deep-linking.md](./17-deep-linking.md) | 딥링킹 |
| 18 | [app-store-guide.md](./18-app-store-guide.md) | 앱스토어 심사 |
| 19 | [accessibility.md](./19-accessibility.md) | 접근성 |
| 20 | [offline-caching.md](./20-offline-caching.md) | 오프라인/캐싱 |
| 21 | [react-native-web.md](./21-react-native-web.md) | RN Web 전략 |
| 22 | [migration-mapping.md](./22-migration-mapping.md) | 코드 변환 매핑 |
| 23 | [api-reference.md](./23-api-reference.md) | API 참조 |

---

## 플랫폼별 주의사항

### iOS [P0]
- [ ] Info.plist 권한 문구 (한글)
- [ ] 키체인 그룹 설정
- [ ] Push 인증서/키 설정

### Android [P0]
- [ ] AndroidManifest 권한 선언
- [ ] FCM 설정 (google-services.json)
- [ ] 타겟 API 레벨 (34+)

### Web [P0]
- [ ] 플랫폼 분기 코드 확인
- [ ] QR 스캐너 대체 구현 (html5-qrcode)
- [ ] Firebase Hosting 설정

---

## 진행 상태 요약

| Phase | 기간 | 상태 | 진행률 |
|-------|------|:----:|:------:|
| 1. 프로젝트 기반 | 3주 | ⬜ | 0% |
| 2. 인증 + 구인구직 | 3주 | ⬜ | 0% |
| 3. 스케줄 + 알림 | 3주 | ⬜ | 0% |
| 4. 구인자 기능 | 3주 | ⬜ | 0% |
| 5. 최적화 + 배포준비 | 2주 | ⬜ | 0% |
| 6. 앱스토어 출시 | 2주+버퍼 | ⬜ | 0% |

**범례**: ⬜ 미시작 | 🟨 진행중 | ✅ 완료

**총 예상 기간**: 16주 + 버퍼 2주 = 18주

---

*생성일: 2024-12*
*업데이트: 2025-12*
*버전: 3.0*
