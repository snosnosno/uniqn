# Apple App Review Demo Setup

최종 업데이트: 2026-03-30  
기준 스크립트: `uniqn-mobile/scripts/manage-app-review-package.js`

## 목적

Apple 심사에서 바로 로그인하고 주요 역할별 화면을 검증할 수 있도록 리뷰 계정과 샘플 데이터를 고정 패키지로 준비합니다.

## 권장 계정

- `employer`: 공고 작성, 지원자 관리, 정산
- `staff`: 공고 탐색, 지원, 일정, 알림
- `admin`: 사용자/신고/문의/공지/통계

## 준비 env

```powershell
$env:APP_REVIEW_ADMIN_EMAIL="apple-review-admin@yourdomain.com"
$env:APP_REVIEW_ADMIN_PASSWORD="StrongAdmin12!!"
$env:APP_REVIEW_EMPLOYER_EMAIL="apple-review-employer@yourdomain.com"
$env:APP_REVIEW_EMPLOYER_PASSWORD="StrongEmployer12!!"
$env:APP_REVIEW_STAFF_EMAIL="apple-review-staff@yourdomain.com"
$env:APP_REVIEW_STAFF_PASSWORD="StrongStaff12!!"
```

선택 env:

- `APP_REVIEW_ADMIN_NAME`
- `APP_REVIEW_EMPLOYER_NAME`
- `APP_REVIEW_STAFF_NAME`
- `APP_REVIEW_ADMIN_PHONE`
- `APP_REVIEW_EMPLOYER_PHONE`
- `APP_REVIEW_STAFF_PHONE`

## 생성

```powershell
cd uniqn-mobile
node scripts/manage-app-review-package.js create
```

출력:

- `output/app-review/review-package.json`

## 정리

```powershell
cd uniqn-mobile
node scripts/manage-app-review-package.js cleanup
```

## 운영 팁

- 제출 직전에 다시 생성해 날짜 기반 샘플 데이터를 최신 상태로 맞춥니다.
- App Store Connect 로그인 정보는 기본적으로 `employer` 계정을 사용하고, `staff`, `admin`은 Review Notes에 함께 적습니다.
- 계정과 비밀번호는 제출마다 임의로 바꾸지 않는 편이 안전합니다.
