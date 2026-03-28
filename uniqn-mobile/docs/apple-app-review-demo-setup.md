# Apple App Review Demo Setup

## 목적

Apple 심사에서 막힌 핵심은 `리뷰 계정 로그인 실패`와 `전체 기능 접근 불가`입니다.

이 프로젝트에서는 심사용으로 아래 3가지를 한 번에 준비하는 방식이 가장 안전합니다.

1. 실제 운영 Firebase에 존재하는 고정 리뷰 계정 3개
2. 계정끼리 연결된 심사용 샘플 데이터
3. App Store Connect에 그대로 붙여 넣을 수 있는 리뷰 노트

## 권장 계정 구성

- `employer`: 공고 생성, 내 공고, 지원자 관리, 확정 스태프, 정산 관리
- `staff`: 공고 탐색, 실제 지원, 내 일정, 알림, 문의 확인
- `admin`: 사용자, 신고, 문의, 공지사항, 대회 승인

중요:

- App Store Connect의 로그인 필드에는 `employer` 계정을 기본으로 넣는 것을 권장합니다.
- 추가 계정(`staff`, `admin`)은 Review Notes에 함께 적어야 합니다.
- 계정은 매 제출마다 바뀌면 안 됩니다. 고정 이메일/비밀번호를 유지해야 합니다.

## 추가된 스크립트

파일:

- `scripts/manage-app-review-package.js`

기능:

- 고정 리뷰 계정 3개 생성 또는 재사용
- 계정 비밀번호/클레임(role) 재정렬
- 리뷰용 공고/지원/정산/공지/신고/문의/알림 데이터 생성
- App Store Connect용 안내문을 `output/app-review/review-package.json`에 저장
- cleanup 모드로 리뷰 데이터와 계정 정리

## 준비할 환경 변수

PowerShell 예시:

```powershell
$env:APP_REVIEW_ADMIN_EMAIL="apple-review-admin@yourdomain.com"
$env:APP_REVIEW_ADMIN_PASSWORD="StrongAdmin12!!"
$env:APP_REVIEW_EMPLOYER_EMAIL="apple-review-employer@yourdomain.com"
$env:APP_REVIEW_EMPLOYER_PASSWORD="StrongEmployer12!!"
$env:APP_REVIEW_STAFF_EMAIL="apple-review-staff@yourdomain.com"
$env:APP_REVIEW_STAFF_PASSWORD="StrongStaff12!!"
```

선택값:

- `APP_REVIEW_ADMIN_NAME`
- `APP_REVIEW_EMPLOYER_NAME`
- `APP_REVIEW_STAFF_NAME`
- `APP_REVIEW_ADMIN_PHONE`
- `APP_REVIEW_EMPLOYER_PHONE`
- `APP_REVIEW_STAFF_PHONE`

전제:

- `uniqn-mobile/.env.local`에 Firebase 운영 프로젝트 정보가 있어야 합니다.
- Firebase CLI 로그인 상태가 유효해야 합니다.

## 생성 명령

```powershell
cd uniqn-mobile
node scripts/manage-app-review-package.js create
```

생성 후 아래 파일을 확인합니다.

- `output/app-review/review-package.json`

이 파일에는 다음이 들어 있습니다.

- 실제 생성/재사용된 계정 이메일과 비밀번호
- 생성된 문서 경로 목록
- 심사 데이터 날짜
- App Store Connect Review Notes에 넣을 문구

## 생성되는 리뷰 데이터

스크립트는 아래 테스트 동선을 바로 만들도록 구성되어 있습니다.

- `Apple Review | 신규 지원 테스트`
  - staff 계정으로 실제 지원 버튼 테스트 가능
- `Apple Review | 지원자 관리 테스트`
  - employer 계정에서 대기 지원자 관리 화면 즉시 확인 가능
- `Apple Review | 확정 스태프 관리`
  - employer 계정에서 확정 스태프 관리 화면 즉시 확인 가능
- `Apple Review | 정산 관리 테스트`
  - employer 계정에서 정산 화면 즉시 확인 가능
- `Apple Review | 승인 대기 대회 공고`
  - admin 계정에서 대회 승인 화면 즉시 확인 가능
- 공지사항, 신고, 문의, 알림 카운터
  - admin/staff 화면에서 빈 화면이 아니라 실제 데이터를 확인 가능

## App Store Connect 입력 방법

### 1. Login Information

- Username: `employer` 계정 이메일
- Password: `employer` 계정 비밀번호

### 2. Review Notes

`output/app-review/review-package.json`의 `instructions.appStoreConnectNote` 내용을 그대로 붙여 넣습니다.

권장 설명 포인트:

- 이 앱은 인력/운영 관리 앱이며 실머니 게임 앱이 아님
- employer, staff, admin 3개 계정 제공
- SMS/OTP 없이 바로 로그인 가능
- 어떤 공고/화면을 어떤 계정으로 보면 되는지 명시

## 정리 명령

심사가 끝나고 리뷰 데이터와 계정을 제거하려면:

```powershell
cd uniqn-mobile
node scripts/manage-app-review-package.js cleanup
```

## 운영 팁

- 제출 직전에 다시 `create`를 실행해 날짜 기반 공고를 최신 상태로 맞추는 것이 좋습니다.
- 심사 리젝 이력이 있으면 Review Notes 첫 줄에 `updated valid review accounts` 같은 문구를 명확히 적는 편이 좋습니다.
- 로그인 실패를 막으려면 비밀번호를 중간에 변경하지 말고, 변경 시에는 스크립트를 다시 실행한 뒤 App Store Connect도 즉시 업데이트해야 합니다.
