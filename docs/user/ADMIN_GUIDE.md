# UNIQN 관리자 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 모바일앱 기준

현재 관리자 기능은 `uniqn-mobile/app/(admin)/` 라우트 그룹에서 제공합니다. 예전 웹 포털 `/admin` 기준 설명은 더 이상 기본 운영 문서가 아닙니다.

## 접근 조건

- 관리자 권한이 있는 계정으로 로그인해야 합니다.
- `uniqn-mobile/app/(admin)/_layout.tsx`에서 인증 여부와 `isAdmin` 권한을 검사합니다.
- 권한이 없으면 일반 앱 홈으로 리다이렉트됩니다.

## 현재 관리자 화면

`uniqn-mobile/app/(admin)/index.tsx` 기준:

- 대회공고 승인
- 사용자 관리
- 신고 관리
- 문의 관리
- 시스템 설정
- 통계
- 공지사항 관리

주의:

- 대시보드 카드에 `/(admin)/security` 링크가 남아 있지만 현재 라우트 파일은 없습니다.
- 운영 문서 기준으로는 위 실제 존재 화면만 안내합니다.

## 화면별 역할

### 1. 대회공고 승인

- 파일: `uniqn-mobile/app/(admin)/tournaments/index.tsx`
- 승인 대기 / 승인 / 반려 상태의 대회공고를 검토합니다.
- 승인 작업은 관련 훅과 Repository를 통해 Firestore 데이터를 갱신합니다.

### 2. 사용자 관리

- 파일:
  - `uniqn-mobile/app/(admin)/users/index.tsx`
  - `uniqn-mobile/app/(admin)/users/[id].tsx`
- 사용자 목록 조회, 검색, 상세 조회, 역할 변경, 활성화 상태 변경을 처리합니다.

### 3. 신고 관리

- 파일:
  - `uniqn-mobile/app/(admin)/reports/index.tsx`
  - `uniqn-mobile/app/(admin)/reports/[id].tsx`
- 상태/심각도 필터, 검색, 상세 검토 흐름을 지원합니다.

### 4. 문의 관리

- 파일:
  - `uniqn-mobile/app/(admin)/inquiries/index.tsx`
  - `uniqn-mobile/app/(admin)/inquiries/[id].tsx`
- 전체 문의 목록, 상태 필터, 미답변 건수 확인, 답변 처리를 지원합니다.

### 5. 공지사항 관리

- 파일:
  - `uniqn-mobile/app/(admin)/announcements/index.tsx`
  - `uniqn-mobile/app/(admin)/announcements/create.tsx`
  - `uniqn-mobile/app/(admin)/announcements/[id]/index.tsx`
  - `uniqn-mobile/app/(admin)/announcements/[id]/edit.tsx`
- 초안/발행/보관 상태별 공지사항을 관리합니다.

### 6. 시스템 설정

- 파일: `uniqn-mobile/app/(admin)/settings.tsx`
- 점검 모드 상태, Feature Flag, 앱 버전, 캐시 새로고침을 제공합니다.
- Feature Flag 수정 자체는 Firebase Remote Config 기준입니다.

### 7. 통계

- 파일: `uniqn-mobile/app/(admin)/stats/index.tsx`
- 총 사용자, 오늘 신규 가입, 활성 공고, 오늘 지원, 미처리 신고, 7일 트렌드를 표시합니다.

## 운영 체크리스트

- 관리자 계정 로그인 확인
- 대회공고 승인 대기 건 확인
- 미처리 신고 및 미답변 문의 확인
- 공지사항 발행 상태 확인
- 점검 모드와 주요 Feature Flag 상태 확인

## 코드 기준 참고 파일

- `uniqn-mobile/app/(admin)/_layout.tsx`
- `uniqn-mobile/app/(admin)/index.tsx`
- `uniqn-mobile/app/(admin)/users/index.tsx`
- `uniqn-mobile/app/(admin)/reports/index.tsx`
- `uniqn-mobile/app/(admin)/inquiries/index.tsx`
- `uniqn-mobile/app/(admin)/announcements/index.tsx`
- `uniqn-mobile/app/(admin)/settings.tsx`
- `uniqn-mobile/app/(admin)/stats/index.tsx`
