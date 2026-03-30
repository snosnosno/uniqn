# 온보딩 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/app/`

이 문서는 현재 앱 구조 기준의 첫 실행과 역할별 진입 지점을 정리합니다.

## 일반 사용자 첫 흐름

1. 앱을 실행합니다.
2. 로그인 또는 회원가입으로 진입합니다.
3. 회원가입 시 약관 동의, 계정 입력, 전화번호 인증, 프로필 입력 순서로 진행합니다.
4. 로그인 후 홈과 공고 목록, 알림, 설정 화면을 확인합니다.

## 첫 사용 체크리스트

- 프로필 기본 정보 확인
- 공고 목록과 상세 화면 확인
- 알림 권한 허용 여부 확인
- 고객센터 또는 문의 진입 위치 확인
- 설정 화면에서 자동 로그인, 생체 인증, 알림 설정 확인

## 구인자 기준 파일

- `uniqn-mobile/app/(employer)/my-postings/index.tsx`
- `uniqn-mobile/app/(employer)/my-postings/create.tsx`
- `uniqn-mobile/app/(employer)/my-postings/[id]/applicants.tsx`
- `uniqn-mobile/app/(employer)/my-postings/[id]/settlements.tsx`

## 관리자 기준 파일

- `uniqn-mobile/app/(admin)/index.tsx`
- `uniqn-mobile/app/(admin)/tournaments/index.tsx`
- `uniqn-mobile/app/(admin)/users/index.tsx`
- `uniqn-mobile/app/(admin)/reports/index.tsx`
- `uniqn-mobile/app/(admin)/inquiries/index.tsx`
- `uniqn-mobile/app/(admin)/announcements/index.tsx`
- `uniqn-mobile/app/(admin)/stats/index.tsx`

## 개발 환경 준비

### 요구 사항

```text
Node.js 22
npm
Firebase CLI
Java 17+
Git
```

### 앱

```powershell
cd uniqn-mobile
npm install
Copy-Item .env.example .env.local
npm run quality
npm start
```

### Functions

```powershell
cd functions
npm install
Copy-Item .env.example .env
npm run build
npm test
```

## 현재 제외 범위

- 레거시 웹앱 온보딩
- 현재 코드에 없는 관리자 추가 설정 화면
- 과거 결제 및 포인트 출시 흐름
