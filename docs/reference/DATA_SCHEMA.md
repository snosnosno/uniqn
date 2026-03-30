# 데이터 스키마 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/src/schemas/`, `uniqn-mobile/src/types/`, `uniqn-mobile/src/repositories/`, `functions/src/`

이 문서는 현재 런타임에서 실제로 중요한 컬렉션과 canonical 필드만 요약합니다. 결제/포인트 설계 초안은 운영 스키마가 아니며 별도 아카이브 문서로 취급합니다.

## Source of Truth

- 앱 입력/문서 스키마: `uniqn-mobile/src/schemas/`
- 앱 타입: `uniqn-mobile/src/types/`
- Firestore 접근 규칙: `uniqn-mobile/src/repositories/firebase/`
- 서버 후처리/집계/검증: `functions/src/`

## 핵심 컬렉션

### `users`

주요 역할:

- 앱 권한 역할
- 프로필 기본 정보
- 구인자 등록 상태
- 알림/마케팅 동의

중요 필드 예시:

- `role`
- `email`
- `name`
- `phone`
- `phoneVerified`
- `marketingAgreed`
- `profileCompleted`

### `jobPostings`

현재 공고 문서는 strict canonical V3 기준으로 다룹니다.

중요 top-level 필드:

- `schemaVersion`
- `status`
- `ownerId`
- `postingType`
- `workDate`
- `workDates`
- `roleKeys`
- `createdAt`
- `updatedAt`
- `totalPositions`
- `filledPositions`
- `stats`

중요 nested 필드:

- `location`
- `schedule`
- `roleCatalog`
- `compensation`
- `questions`
- `fixedConfig`
- `tournamentConfig`
- `urgentConfig`

### `applications`

주요 목적:

- 공고 지원
- 상태 추적
- 날짜/역할 assignment
- 취소 요청 및 이력

중요 필드:

- `jobPostingId`
- `applicantId`
- `status`
- `assignments`
- `confirmationHistory`
- `cancellationRequest`

### `workLogs`

주요 목적:

- 근무 기록
- 출퇴근 시간
- 완료 상태 동기화
- 정산 계산 근거

중요 필드:

- `jobPostingId`
- `staffId`
- `date`
- `checkInTime`
- `checkOutTime`
- `status`

### `notifications`

주요 목적:

- 알림 센터 표시
- unread counter 동기화
- 딥링크 이동 데이터 저장

중요 필드:

- `recipientId`
- `type`
- `category`
- `isRead`
- `link`
- `data`

### 운영성 컬렉션

- `announcements`
- `reports`
- `inquiries`
- `settlements`
- `eventQRCodes`

## 현재 스키마 해석 원칙

- 문서보다 코드가 우선입니다.
- `jobPostings`는 strict parse 기반 canonical 문서를 우선합니다.
- 레거시 fallback이 일부 남아 있어도 새 문서는 canonical 필드만 써야 합니다.
- 결제/포인트 관련 컬렉션은 현재 운영 스키마가 아닙니다.

## 참고 경로

- `uniqn-mobile/src/schemas/auth.schema.ts`
- `uniqn-mobile/src/schemas/notification.schema.ts`
- `uniqn-mobile/src/types/user.ts`
- `uniqn-mobile/src/types/notification.ts`
- `uniqn-mobile/src/repositories/firebase/jobPosting/`
- `functions/src/triggers/jobPostings.ts`
- `functions/src/utils/notificationUtils.ts`
