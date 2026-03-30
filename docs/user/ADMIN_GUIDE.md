# 관리자 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/app/(admin)/`

이 문서는 현재 관리자 영역의 실제 화면과 운영 포인트만 정리합니다.

## 접근 조건

- 관리자 계정으로 로그인해야 합니다.
- 관리자 가드는 `uniqn-mobile/app/(admin)/_layout.tsx`와 인증 훅 흐름을 따릅니다.
- 권한이 없으면 일반 사용자 흐름으로 리다이렉트됩니다.

## 현재 관리자 메뉴

- `uniqn-mobile/app/(admin)/index.tsx`: 관리자 대시보드
- `uniqn-mobile/app/(admin)/tournaments/index.tsx`: 대회 공고 승인
- `uniqn-mobile/app/(admin)/users/index.tsx`: 사용자 관리
- `uniqn-mobile/app/(admin)/reports/index.tsx`: 신고 관리
- `uniqn-mobile/app/(admin)/inquiries/index.tsx`: 문의 관리
- `uniqn-mobile/app/(admin)/announcements/index.tsx`: 공지사항 관리
- `uniqn-mobile/app/(admin)/stats/index.tsx`: 서비스 통계

현재 관리자 라우트에는 별도 `settings` 화면이 없습니다.

## 화면별 역할

### 대회 공고 승인

- 승인 대기 목록 확인
- 승인, 반려, 재제출 흐름 처리
- 관련 callable 흐름 확인

### 사용자 관리

- 사용자 목록 조회
- 상세 정보 확인
- 역할과 상태 점검

### 신고 관리

- 신고 목록 조회
- 상세 검토와 처리

### 문의 관리

- 문의 목록 조회
- 상세 답변 처리

### 공지사항 관리

- 공지 생성
- 공지 수정과 상세 확인

### 서비스 통계

- 핵심 운영 지표 확인
- 최근 추세와 누적 현황 점검

## 운영 체크리스트

- 승인 대기 공고 확인
- 미처리 신고와 문의 확인
- 공지 발행 상태 확인
- 통계 화면 오류 여부 확인

## 관련 문서

- `docs/operations/MONITORING.md`
- `docs/operations/TROUBLESHOOTING.md`
- `docs/reference/API_REFERENCE.md`
