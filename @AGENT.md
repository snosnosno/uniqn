# UNIQN Project - Build & Run Instructions

> Ralph와 개발자를 위한 프로젝트 빌드/실행 가이드

## Quick Start

### uniqn-mobile (주 개발 대상)

```bash
cd uniqn-mobile

# 의존성 설치
npm install

# 개발 서버 실행
npm start

# 플랫폼별 실행
npx expo run:ios      # iOS 시뮬레이터
npx expo run:android  # Android 에뮬레이터
```

### app2 (유지보수 모드)

```bash
cd app2

# 의존성 설치
npm install

# 개발 서버 실행
npm start
```

## Quality Checks (필수)

### uniqn-mobile

```bash
cd uniqn-mobile

# TypeScript 타입 체크 (0 에러 필수)
npm run type-check

# ESLint 린트 체크 (0 에러 필수)
npm run lint

# 전체 품질 검사
npm run quality

# 테스트
npm test
```

### app2

```bash
cd app2

# TypeScript 타입 체크
npm run type-check

# ESLint 린트 체크
npm run lint

# 전체 품질 검사
npm run quality

# 테스트
npm test
```

## Build Commands

### uniqn-mobile

```bash
cd uniqn-mobile

# Web 빌드
npm run build:web

# EAS 빌드 (iOS/Android)
eas build --platform ios
eas build --platform android
```

### app2

```bash
cd app2

# 프로덕션 빌드
npm run build

# Firebase 배포
npm run deploy:all

# 모바일 동기화 (Capacitor)
npx cap sync
```

## Project Structure

```
T-HOLDEM/
├── uniqn-mobile/           # React Native + Expo (주 개발)
│   ├── app/                # Expo Router 라우트
│   ├── src/
│   │   ├── components/     # UI 컴포넌트
│   │   ├── hooks/          # 커스텀 훅
│   │   ├── services/       # 비즈니스 로직
│   │   ├── stores/         # Zustand 스토어
│   │   ├── types/          # TypeScript 타입
│   │   └── schemas/        # Zod 스키마
│   └── package.json
│
├── app2/                   # React + Capacitor (유지보수)
│   ├── src/
│   └── package.json
│
├── functions/              # Firebase Cloud Functions
├── specs/                  # 스펙 문서
├── docs/                   # 운영 문서
│
├── CLAUDE.md              # 프로젝트 개발 가이드 (필독)
├── PROMPT.md              # Ralph 개발 지침
├── @fix_plan.md           # 우선순위 작업 목록
└── @AGENT.md              # 빌드/실행 가이드 (이 파일)
```

## Environment Setup

### Required
- Node.js 18+
- npm 9+
- Git

### For Mobile Development
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- iOS: Xcode (macOS only)
- Android: Android Studio

### Firebase
- Firebase CLI: `npm install -g firebase-tools`
- Login: `firebase login`

## Common Issues

### TypeScript Errors
```bash
# 타입 에러 상세 확인
npx tsc --noEmit --pretty

# 특정 파일만 확인
npx tsc --noEmit src/path/to/file.ts
```

### ESLint Errors
```bash
# 자동 수정 가능한 에러 수정
npm run lint -- --fix

# 특정 파일만 확인
npx eslint src/path/to/file.ts
```

### Expo/React Native Issues
```bash
# 캐시 클리어
npx expo start --clear

# node_modules 재설치
rm -rf node_modules && npm install

# Metro 캐시 클리어
npx expo start --reset-cache
```

## Git Workflow

### Commit Convention
```
<타입>: <제목> (한글)

타입:
- feat: 새로운 기능
- fix: 버그 수정
- refactor: 리팩토링
- style: UI 변경
- docs: 문서 수정
- test: 테스트
- chore: 기타
```

### Before Commit
```bash
# 반드시 품질 검사 통과 확인
npm run type-check && npm run lint
```

## References

- [CLAUDE.md](./CLAUDE.md) - 프로젝트 개발 가이드 (필독)
- [specs/react-native-app/](./specs/react-native-app/) - RN 앱 스펙 문서
- [docs/](./docs/) - 운영 문서
