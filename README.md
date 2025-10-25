# UNIQN 토너먼트 관리 플랫폼

[![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen.svg)](./CHANGELOG.md)

**UNIQN**은 홀덤 포커 토너먼트 운영의 모든 과정을 디지털화하여, 운영 효율성을 극대화하는 것을 목표로 하는 종합 관리 플랫폼입니다.

---

## 🚀 현재 상태 (v0.2.3)

- **버전**: `0.2.3` (Production Ready + 실시간 알림 시스템)
- **상태**: **Production Ready (97% 완성)**
- **핵심 성과**: 실시간 알림 센터 시스템 구현으로 사용자 경험 대폭 향상.

### ✅ 구현된 주요 기능 (v0.2.3)

#### 핵심 비즈니스 기능
- **실시간 알림 시스템**: 14개 알림 타입, Firestore 실시간 구독 (신규 ⭐)
- **고급 인증 시스템**: 이메일/소셜 로그인, 2FA, 세션 관리
- **다국어 지원**: i18n 국제화 (한국어/영어)
- **구인공고 관리**: 구인공고 CRUD 기능
- **지원자 관리**: 공고 지원 및 지원자 목록 관리
- **스태프 관리**: 지원자 확정을 통한 스태프 전환
- **출석 관리**: 출석 상태 수동 변경 및 실시간 추적
- **급여 계산**: 근무 기록 기반 급여 계산 로직

#### 기술적 성과
- **알림 시스템**: 실시간 구독, 14개 타입, 확장 가능한 아키텍처 (신규 ⭐)
- **인증 시스템**: 보안 강화 및 사용자 경험 개선
- **국제화**: i18n 완전 구현으로 글로벌 서비스 준비
- **코드 체계화**: 47개 컴포넌트 → 17개 (65% 감소), 10개 카테고리 분류
- **코드 품질**: TypeScript strict mode 100% 준수, any 타입 0개
- **성능 최적화**: React.memo 적용, 번들 크기 299KB (+8.46KB)
- **아키텍처**: `UnifiedDataContext`를 사용한 중앙 데이터 관리 구조

### 🚀 향후 로드맵 (v0.3.0+)

- **고급 기능 안정화**: Web Worker 기반 급여 계산, 스마트 캐싱 등 이미 코드가 구현된 기능들의 테스트 및 안정화
- **신규 기능 개발**: 알림 설정 페이지, QR코드 출퇴근, 관리자 대시보드 통계 기능
- **품질 개선**: E2E 테스트 커버리지 확대 (65% → 80%), 모바일 최적화 및 PWA 고도화

## 🛠️ 기술 스택

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend & DB**: Firebase (Authentication, Firestore, Functions)
- **State Management**: Context API, Zustand
- **Testing**: Jest, React Testing Library

## 🚀 시작하기

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd UNIQN/app2

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행 (Firebase 에뮬레이터와 함께)
npm run dev
```

더 자세한 개발 환경 설정은 `docs/DEVELOPMENT.md` 문서를 참고하세요.

## 📚 문서

프로젝트의 모든 상세 문서는 `docs/` 폴더에서 체계적으로 관리됩니다.

### 📁 문서 구조 (v0.2.3 업데이트)
```
📁 docs/
├── 📁 guides/          # 개발 및 배포 가이드
│   ├── DEPLOYMENT.md    # 배포 가이드
│   ├── MIGRATION_GUIDE.md # 마이그레이션 가이드
│   └── PERFORMANCE.md   # 성능 최적화 가이드
├── 📁 reference/        # 기술 레퍼런스
│   ├── API_REFERENCE.md # API 명세
│   ├── ARCHITECTURE.md  # 시스템 아키텍처
│   ├── BUSINESS_CASE.md # 비즈니스 케이스
│   └── DATA_SCHEMA.md   # 데이터베이스 스키마
├── 📁 operations/       # 운영 및 관리
│   ├── MONITORING.md    # 모니터링 가이드
│   ├── SECURITY.md      # 보안 가이드
│   └── TROUBLESHOOTING.md # 문제 해결
├── 📁 user/            # 사용자 가이드
│   ├── ADMIN_GUIDE.md   # 관리자 가이드
│   ├── ONBOARDING.md    # 온보딩 가이드
│   └── USER_MANUAL.md   # 사용자 매뉴얼
├── 📁 mobile/          # 모바일 개발 (향후)
│   ├── MOBILE_API_SPEC.md
│   └── MOBILE_DEVELOPMENT.md
├── NOTIFICATION_SYSTEM.md # 알림 시스템 완료 문서 (v0.2.3 ⭐)
└── FEATURE_FLAG_GUIDE.md  # Feature Flag 시스템 가이드 (v0.2.3 신규 ⭐)
```

### 🎯 **핵심 문서**
- **Feature Flag 시스템**: `docs/FEATURE_FLAG_GUIDE.md` (v0.2.3 신규 ⭐)
- **알림 시스템**: `docs/NOTIFICATION_SYSTEM.md` (v0.2.3 완료 ⭐)
- **아키텍처**: `docs/reference/ARCHITECTURE.md` (폴더 구조 체계화 포함)
- **마이그레이션**: `docs/guides/MIGRATION_GUIDE.md` (v0.2.1 폴더 구조 변경)
- **성능 최적화**: `docs/guides/PERFORMANCE.md` (번들 299KB, React.memo 적용)
- **배포 가이드**: `docs/guides/DEPLOYMENT.md` (Production Ready)

### 📖 **참고 문서**
- **API 명세**: `docs/reference/API_REFERENCE.md`
- **데이터베이스 스키마**: `docs/reference/DATA_SCHEMA.md`
- **문제 해결 가이드**: `docs/operations/TROUBLESHOOTING.md`
- **사용자 가이드**: `docs/user/USER_MANUAL.md`, `docs/user/ADMIN_GUIDE.md`
- **보안 가이드**: `docs/operations/SECURITY.md`
- **인증 시스템**: `docs/user/authentication-system.md`
- **국제화 가이드**: `docs/guides/I18N_GUIDE.md`

### 🔄 **최신 완료 기능 (v0.2.2)**
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

## 🤝 기여하기

이 프로젝트에 기여하고 싶으신가요? `CONTRIBUTING.md` 파일을 참고하여 기여 규칙을 확인해주세요.
