# 푸시 알림 테스트 체크리스트

최종 업데이트: 2026-03-30  
기준 코드: `src/services/notifications/pushNotificationService.ts`, `src/components/notifications/NotificationSettings.tsx`

## 사전 준비

- 실제 Android/iOS 기기
- EAS 빌드된 앱
- Firebase Functions 배포
- 테스트 계정: `staff`, `employer`, 필요 시 `admin`

## 권한

- [ ] 첫 실행 시 권한 요청 흐름 확인
- [ ] 권한 거부 상태에서 앱이 정상 동작하는지 확인
- [ ] 권한 거부 후 설정 앱 이동 흐름 확인

## 토큰 등록

- [ ] 로그인 후 토큰 등록 확인
- [ ] 로그아웃 시 토큰 해제 확인
- [ ] 재로그인 시 토큰 재등록 확인

## 알림 수신

- [ ] 포그라운드 알림 표시
- [ ] 백그라운드 알림 표시
- [ ] 앱 종료 상태에서 알림 터치 후 관련 화면 이동

## 알림 센터

- [ ] 목록 로드
- [ ] 카테고리 필터
- [ ] 그룹화 on/off
- [ ] 모두 읽음
- [ ] 개별 삭제

## 카테고리 설정

- [ ] 전체 알림 on/off
- [ ] 카테고리별 enabled on/off
- [ ] 카테고리별 pushEnabled on/off
- [ ] 방해 금지 시간

현재 카테고리:

- 지원/확정
- 출퇴근
- 정산
- 공고
- 시스템
- 관리자
- 평가

## Android 채널

- [ ] `default`
- [ ] `applications`
- [ ] `reminders`
- [ ] `settlement`
- [ ] `announcements`

## 트리거 시나리오

- [ ] 지원 제출
- [ ] 지원 상태 변경
- [ ] 일정 생성/취소
- [ ] 출퇴근
- [ ] 정산 완료
- [ ] 공지 발송
- [ ] 평가 생성 / 평가 리마인더

## 관련 확인 포인트

- `functions/src/utils/notificationUtils.ts`
- `functions/src/notifications/`
- `src/hooks/useDeepLink.ts`
- `src/services/notifications/notificationService.ts`
