# UNIQN 토너먼트 관리 플랫폼

[![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen.svg)](./CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-blue.svg)](./uniqn-mobile/)

**UNIQN**은 홀덤 포커 토너먼트 운영의 모든 과정을 디지털화하여, 운영 효율성을 극대화하는 것을 목표로 하는 종합 관리 플랫폼입니다.

---

## 🚀 현재 상태 (v1.0.0)

- **버전**: `1.0.0` (모바일앱 중심 + RevenueCat 연동)
- **상태**: **Production Ready**
- **주력 플랫폼**: React Native + Expo (모바일앱)
- **핵심 성과**: 모바일앱 Phase 2 완료, 💎 하트/다이아 포인트 시스템 구현

### ✅ 구현된 주요 기능 (v1.0.0)

#### 핵심 비즈니스 기능
- **구인구직 시스템**
  - **지원 공고** (📋 regular): 기본 구인공고 (💎 1다이아)
  - **고정 공고** (📌 fixed): 상단 고정 공고 (💎 5다이아/주)
  - **대회 공고** (🏆 tournament): 대회 전용 공고 (관리자 승인 필요, 무료)
  - **긴급 공고** (🚨 urgent): 긴급 구인 공고 (💎 10다이아)
- **💎 하트/다이아 포인트 시스템** (신규 ⭐)
  - 💖 **하트**: 무료 획득 (활동 보상), 90일 만료
  - 💎 **다이아**: 유료 충전 (RevenueCat), 영구 보유
  - **사용 우선순위**: 하트(만료 임박 순) → 다이아
- **대회 공고 승인 시스템**: Admin 전용 승인/거부 워크플로우 (Firebase Functions)
- **실시간 알림 시스템**: 14개 알림 타입, FCM 푸시 알림
- **고급 인증 시스템**: 이메일/소셜 로그인, 2FA, 세션 관리
- **다국어 지원**: i18n 국제화 (한국어/영어)
- **지원자 관리**: 공고 지원 및 지원자 목록 관리
- **스태프 관리**: 지원자 확정을 통한 스태프 전환
- **QR 출퇴근**: 이벤트 QR 생성/검증 (3분 유효)
- **정산 시스템**: 근무 기록 기반 급여 계산 및 정산

#### 💎 포인트 시스템 상세
| 구분 | 💖 하트 | 💎 다이아 |
|------|---------|----------|
| **획득 방법** | 활동 보상 | 유료 충전 (RevenueCat) |
| **만료** | 90일 | 영구 |
| **환불** | 불가 | 불가 (App Store/Google Play 정책) |
| **가치** | ₩300/개 | ₩300/개 |

**하트 획득 경로:**
- 첫 가입: +10💖
- 매일 출석: +1💖
- 7일 연속 출석: +3💖 보너스
- 리뷰 작성: +1💖
- 친구 초대: +5💖

**다이아 패키지:**
| 패키지 | 가격 | 다이아 | 보너스 |
|--------|------|--------|--------|
| 스타터 | ₩1,000 | 3💎 | - |
| 베이직 | ₩3,300 | 8💎 | +3 (27%) |
| 인기 | ₩10,000 | 30💎 | +10 (33%) |
| 프리미엄 | ₩100,000 | 333💎 | +67 (20%) |

#### 기술적 성과
- **모바일앱 아키텍처**: Repository 패턴, SSOT 원칙, 5단계 Provider 구조
- **코드 규모**: 460+ TypeScript 파일, 198개 컴포넌트, 40개 커스텀 훅
- **테스트 커버리지**: 14%+ (MVP 기준), TypeScript strict mode 100%
- **Firebase Functions**: 알림, 정산, RevenueCat 웹훅 등 배포
- **성능 최적화**: FlashList 가상화, expo-image Blurhash, React.memo

## 🛠️ 기술 스택

### 모바일앱 (uniqn-mobile/) - 주력
```yaml
Core:
  - Expo SDK: 54
  - React Native: 0.81.5
  - React: 19.1.0
  - TypeScript: 5.9.2 (strict)

Navigation & State:
  - Expo Router: 6.0.19
  - Zustand: 5.0.9
  - TanStack Query: 5.90.12

UI/Styling:
  - NativeWind: 4.2.1
  - @shopify/flash-list
  - expo-image: 3.0.11
  - @gorhom/bottom-sheet: 5.2.8

Backend:
  - Firebase: 12.6.0 (Modular API)
  - RevenueCat: IAP 결제

Forms & Validation:
  - React Hook Form: 7.68.0
  - Zod: 4.1.13
```

### 레거시 웹앱 (app2/) - 참고용
```yaml
Core:
  - React: 18.2
  - TypeScript: 4.9
  - Tailwind CSS: 3.3

State:
  - Zustand: 5.0
  - React Query: 5.17

Backend:
  - Firebase: 11.9
  - Capacitor: 7.4 (하이브리드)
```

## 🚀 시작하기

### 모바일앱 개발 (권장)
```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd T-HOLDEM/uniqn-mobile

# 2. 의존성 설치
npm install

# 3. Expo 개발 서버 실행
npm start

# 4. 플랫폼별 실행
npx expo run:ios      # iOS 시뮬레이터
npx expo run:android  # Android 에뮬레이터
```

### 레거시 웹앱 (참고용)
```bash
cd T-HOLDEM/app2
npm install
npm run dev
```

더 자세한 개발 환경 설정은 `CLAUDE.md` 문서를 참고하세요.

## 📚 문서

### 📁 문서 구조
```
📁 docs/
├── 📁 core/           # 핵심 개발 가이드
│   ├── DEVELOPMENT_GUIDE.md
│   └── TESTING_GUIDE.md
├── 📁 features/       # 기능별 가이드
│   └── payment/       # 💎 하트/다이아 포인트 시스템
│       ├── MODEL_B_CHIP_SYSTEM_FINAL.md
│       ├── CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md
│       ├── REVENUE_MODEL_ANALYSIS.md
│       └── PAYMENT_SYSTEM_DEVELOPMENT.md
├── 📁 guides/         # 운영 가이드
│   ├── DEPLOYMENT.md
│   └── PERFORMANCE.md
├── 📁 operations/     # 운영 문서
│   ├── PAYMENT_OPERATIONS.md  # 💎 포인트 시스템 운영
│   └── MONITORING.md
├── 📁 reference/      # 참조 문서
│   ├── ARCHITECTURE.md
│   ├── DATA_SCHEMA.md  # v3.0 하트/다이아 스키마
│   └── API_REFERENCE.md
└── 📁 user/           # 사용자 가이드
    ├── ADMIN_GUIDE.md
    ├── ONBOARDING.md
    └── USER_MANUAL.md

📁 specs/react-native-app/  # 모바일앱 스펙
├── README.md
├── 04-screens.md      # 64개 화면 설계
├── 18-app-store-guide.md  # 앱스토어 가이드 + RevenueCat
└── 23-api-reference.md    # API 레퍼런스 + RevenueCat 웹훅
```

### 🎯 핵심 문서
- **개발 가이드**: `CLAUDE.md` (Claude Code 전용 개발 지침)
- **💎 포인트 시스템**: `docs/features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md`
- **아키텍처**: `docs/reference/ARCHITECTURE.md`
- **데이터 스키마**: `docs/reference/DATA_SCHEMA.md`
- **모바일앱 스펙**: `specs/react-native-app/README.md`

### 📖 결제 시스템 문서
- **시스템 설계**: `docs/features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md`
- **구현 가이드**: `docs/features/payment/CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md`
- **운영 가이드**: `docs/operations/PAYMENT_OPERATIONS.md`
- **앱스토어 가이드**: `specs/react-native-app/18-app-store-guide.md`

## 📱 프로젝트 구조

```
T-HOLDEM/
├── uniqn-mobile/           # 📱 모바일앱 (React Native + Expo) ⭐ 주력
│   ├── app/                # Expo Router (64개 라우트)
│   └── src/                # 소스 코드 (460+ 파일)
│       ├── components/     # UI 컴포넌트 (198개)
│       ├── hooks/          # Custom Hooks (40개)
│       ├── services/       # 비즈니스 서비스 (33개)
│       ├── stores/         # Zustand Stores (8개)
│       └── repositories/   # Repository 패턴 (9개)
│
├── functions/              # Firebase Functions
├── specs/                  # 스펙 문서
│   └── react-native-app/   # 모바일앱 스펙 (23개)
├── docs/                   # 운영 문서 (46개)
└── app2/                   # [레거시] 웹앱 - 참고용
```

## 🗓️ 로드맵

### Phase 1 ✅ 완료
- 인증 시스템 (소셜 로그인, 2FA)
- 구인구직 시스템
- 지원자/스태프 관리

### Phase 2 ✅ 완료
- Repository 패턴 도입
- 💎 하트/다이아 포인트 시스템
- RevenueCat 연동

### Phase 3 (예정)
- 앱스토어 출시 (iOS/Android)
- 프리미엄 기능 확장
- 분석 대시보드

## 🤝 기여하기

이 프로젝트에 기여하고 싶으신가요? `CLAUDE.md` 파일을 참고하여 개발 규칙을 확인해주세요.

---

**마지막 업데이트**: 2026년 2월 1일
**버전**: v0.2.3 (모바일앱 중심 + RevenueCat 연동)
