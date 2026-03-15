# UNIQN 온보딩 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 코드 기준

현재 주력 플랫폼은 `uniqn-mobile/`입니다. 사용자 온보딩도 모바일앱 기준으로 진행합니다.

## 일반 사용자

### 첫 시작

1. App Store / Google Play에서 `UNIQN` 앱을 설치합니다.
2. `회원가입` 또는 `로그인`을 선택합니다.
3. 회원가입 시 약관 동의와 본인인증을 완료합니다.
4. 로그인 후 홈 탭에서 공고를 확인합니다.

### 첫 10분 체크리스트

- 프로필 및 기본 정보 확인
- 관심 공고 1건 이상 확인
- 알림 권한 허용
- 고객센터 위치 확인
- 설정 화면에서 비밀번호 변경/생체 인증 가능 여부 확인

## 구인자

### 첫 운영 체크리스트

- 구인자 등록 또는 관련 프로필 설정 확인
- 내 공고 목록 확인
- 새 공고 작성
- 지원자 목록 확인
- 확정 후 일정 및 정산 화면 흐름 확인

참고 라우트:

- `uniqn-mobile/app/(employer)/my-postings/index.tsx`
- `uniqn-mobile/app/(employer)/my-postings/create.tsx`
- `uniqn-mobile/app/(employer)/my-postings/[id]/applicants.tsx`
- `uniqn-mobile/app/(employer)/my-postings/[id]/settlements.tsx`

## 관리자

관리자 계정은 `uniqn-mobile/app/(admin)/_layout.tsx`의 권한 검사를 통과해야 합니다.

첫 점검 체크리스트:

- 대회공고 승인 대기 건 확인
- 신고/문의 미처리 건 확인
- 공지사항 관리 화면 확인
- 시스템 설정에서 점검 모드와 Feature Flag 확인
- 통계 화면에서 주요 지표 확인

## 개발자 온보딩

### 필수 요구사항

```bash
Node.js 22
npm
Firebase CLI
Java 17+   # Emulator 사용 시
Git
```

### 앱 실행

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

### Functions 작업이 필요한 경우

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

### 코드 읽기 순서

1. `CLAUDE.md`
2. `README.md`
3. `uniqn-mobile/src/lib/env.ts`
4. `uniqn-mobile/app/`
5. `functions/src/index.ts`

## 제외한 항목

이 문서에는 현재 기준이 아닌 내용을 넣지 않습니다.

- 웹 우선 설치 절차
- 레거시 웹앱 개발 절차
- 현재 앱에 없는 과거 웹 구현 설명
