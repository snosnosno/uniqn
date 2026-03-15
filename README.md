# UNIQN 프로젝트

UNIQN은 홀덤 토너먼트 운영을 위한 모바일 중심 관리 플랫폼입니다. 현재 저장소의 기준 구현은 `uniqn-mobile/`과 `functions/`입니다.

## 현재 상태

- 주력 앱: React Native + Expo
- 백엔드: Firebase Auth / Firestore / Functions / Storage
- 주요 역할: `staff`, `employer`, `admin`
- 레거시 웹앱: `app2/` 참고용

현재 코드로 확인되는 핵심 기능:

- 회원가입 / 로그인 / 소셜 로그인 / 생체 인증
- 구인공고 탐색과 지원
- 구인자 공고 관리와 지원자 관리
- 스케줄 / QR 출퇴근 / 정산
- 공지 / 신고 / 문의 / 관리자 통계
- Sentry 기반 에러 추적
- Feature Flag와 관리자 설정 화면

## 빠른 시작

```bash
cd uniqn-mobile
npm install
cp .env.example .env.local
npm run quality
npm start
```

필수 환경변수:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

Functions 작업:

```bash
cd functions
npm install
cp .env.example .env
npm run build
npm test
```

필수 값:

- `RECAPTCHA_SECRET_KEY`
- `WEB_API_KEY`

## 주요 디렉토리

```text
T-HOLDEM/
├── uniqn-mobile/   # 모바일앱
├── functions/      # Firebase Functions
├── docs/           # 문서
├── specs/          # 스펙
└── app2/           # 레거시 웹앱
```

## 먼저 볼 문서

- `CLAUDE.md`
- `docs/core/DEVELOPMENT_GUIDE.md`
- `docs/reference/ARCHITECTURE.md`
- `docs/core/TESTING_GUIDE.md`
- `docs/user/ONBOARDING.md`

## 주의

- 저장소 안의 결제/포인트 관련 문서 중 일부는 설계 또는 계획 문서입니다.
- 현재 런타임 구현 여부는 항상 `uniqn-mobile/package.json`, `functions/src/`, `uniqn-mobile/src/`를 기준으로 판단해야 합니다.
