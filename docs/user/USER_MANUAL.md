# UNIQN 사용자 매뉴얼

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 모바일앱 기준

이 문서는 `uniqn-mobile/`의 실제 화면 흐름만 정리합니다. 예전 웹 중심 설명은 현재 기본 사용 경로가 아닙니다.

## 시작하기

- 앱 설치: App Store / Google Play에서 `UNIQN`
- 로그인 경로: `uniqn-mobile/app/(auth)/login.tsx`
- 회원가입 경로: `uniqn-mobile/app/(auth)/signup.tsx`

회원가입 흐름:

1. 약관 동의
2. 계정 정보 입력
3. 본인인증
4. 가입 완료 후 메인 탭 이동

## 메인 사용 흐름

### 구인공고 보기

- 메인 탭 홈: `uniqn-mobile/app/(app)/(tabs)/index.tsx`
- 공고 검색, 공고 유형 필터, 날짜 필터를 사용할 수 있습니다.
- 공고 상세: `uniqn-mobile/app/(app)/jobs/[id]/index.tsx`

### 지원하기

- 지원 화면: `uniqn-mobile/app/(app)/jobs/[id]/apply.tsx`
- 역할 선택, 사전 질문 답변, 제출 흐름을 처리합니다.

### 지원 취소

- 취소 화면: `uniqn-mobile/app/(app)/applications/[id]/cancel.tsx`
- 취소 가능 상태에서만 취소 요청을 진행합니다.

### 일정 확인

- 스케줄 탭: `uniqn-mobile/app/(app)/(tabs)/schedule.tsx`
- 캘린더/목록 전환, 일정 상세, QR 출퇴근, 월별 수익 확인을 지원합니다.

### 알림 확인

- 알림 화면: `uniqn-mobile/app/(app)/notifications.tsx`
- 카테고리 필터, 그룹핑, 모두 읽음, 삭제를 지원합니다.

### 고객지원

- 고객센터 메인: `uniqn-mobile/app/(app)/support/index.tsx`
- FAQ: `/(app)/support/faq`
- 1:1 문의: `/(app)/support/create-inquiry`
- 내 문의: `/(app)/support/my-inquiries`

## 설정

- 설정 메인: `uniqn-mobile/app/(app)/settings/index.tsx`

현재 설정 화면에서 제공하는 항목:

- 푸시 알림 허용 및 설정
- 비밀번호 변경
- 자동 로그인
- 생체 인증
- 다크 모드
- 캐시 삭제
- 튜토리얼 다시 보기
- 이용약관 / 개인정보처리방침 / 사업자정보
- 마케팅 정보 수신 동의
- 계정 삭제

관련 세부 화면:

- `/(app)/settings/change-password`
- `/(app)/settings/delete-account`
- `/(app)/settings/my-data`
- `/(app)/settings/terms`
- `/(app)/settings/privacy`

## 자주 확인할 항목

- 로그인이 안 되면 이메일/비밀번호와 본인 계정 상태를 먼저 확인합니다.
- 알림이 오지 않으면 앱 알림 권한과 설정 화면의 푸시 알림 토글을 함께 확인합니다.
- 스케줄이 비어 있으면 지원 상태와 확정 여부를 먼저 확인합니다.
- 문의 답변은 고객센터의 `문의 내역`에서 확인합니다.

## 현재 문서 범위 밖

아래 내용은 현재 기본 사용자 문서에 포함하지 않습니다.

- 웹 우선 설치 절차
- 레거시 웹앱 화면 설명
- 현재 앱에 없는 과거 웹 구현 상세
