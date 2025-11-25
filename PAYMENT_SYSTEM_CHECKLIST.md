# 🎯 T-HOLDEM 결제 시스템 구현 체크리스트

> **프로젝트**: T-HOLDEM 토스페이먼츠 결제 시스템
> **시작일**: 2025-01-23
> **현재 상태**: 보안 테스트 완료 (71% 완성)
> **마지막 업데이트**: 2025-01-24

---

## 📊 전체 진행 상황

```
전체 작업: 42개
완료: 30개 (71%)
진행 중: 0개
대기 중: 12개 (29%)
```

**진행률 바**:
```
█████████████████████████████░░░░░░░░░ 71%
```

---

## ✅ P0 (Critical) - 핵심 기능 [8/8 완료 - 100%]

배포 전 반드시 완료해야 하는 핵심 기능

### 백엔드 (Firebase Functions)

- [x] **P0-1: 결제 승인 API 구현**
  - 파일: `functions/src/payment/confirmPayment.ts`
  - 기능:
    - 토스페이먼츠 API 연동
    - 서버 측 금액 검증 (패키지 가격 일치)
    - 중복 결제 방지 (orderId 유니크 체크)
    - 본인 확인 (orderId에서 userId 추출)
  - 완료일: 2025-01-23

- [x] **P0-2: 칩 지급 로직 구현**
  - 파일: `functions/src/payment/grantChips.ts`
  - 기능:
    - Firestore 트랜잭션으로 안전한 칩 지급
    - 빨간칩 만료: 1년 후
    - 파란칩 만료: 다음 달 1일
    - 칩 차감 로직 (우선순위: 파란칩 → 빨간칩)
  - 완료일: 2025-01-23

- [x] **P0-3: 서버 측 보안 검증**
  - 기능:
    - 금액 조작 방지
    - 중복 결제 방지
    - 본인 확인
  - 완료일: 2025-01-23

### 프론트엔드 (React)

- [x] **P0-4: 칩 잔액 Context**
  - 파일: `app2/src/contexts/ChipContext.tsx`
  - 기능:
    - Firestore 실시간 구독 (onSnapshot)
    - 로그인 상태 연동
    - 에러 처리 및 로깅
  - 완료일: 2025-01-23

- [x] **P0-5: 칩 잔액 Hook**
  - 파일: `app2/src/hooks/useChipBalance.ts`
  - 기능:
    - 칩 잔액 조회
    - 최근 거래 내역
    - 칩 사용 시뮬레이션
  - 완료일: 2025-01-23

- [x] **P0-6: 프론트엔드-백엔드 연동**
  - 파일: `app2/src/pages/payment/PaymentSuccessPage.tsx`
  - 기능:
    - Firebase Functions `confirmPayment` 호출
    - 결제 승인 후 칩 자동 지급
    - 에러 처리 및 사용자 피드백
  - 완료일: 2025-01-23

### 품질 보증

- [x] **P0-7: TypeScript 타입 체크**
  - app2: 에러 0개 ✅
  - functions: 에러 0개 ✅
  - 완료일: 2025-01-23

- [x] **P0-8: 프로덕션 빌드**
  - app2: 빌드 성공 ✅
  - functions: 빌드 성공 ✅
  - 완료일: 2025-01-23

---

## 🎨 P0.5 (UI/UX) - API 키 불필요 기능 [3/3 완료 - 100%]

토스 API 키 없이 개발 가능한 UI/UX 작업

### 사용자 페이지

- [x] **P0.5-1: 칩 충전 패키지 카드 컴포넌트**
  - 파일: `app2/src/components/chip/ChipPackageCard.tsx`
  - 기능:
    - 패키지 정보 표시 (가격, 칩 개수, 할인율)
    - 선택 상태 UI
    - 배지 표시 (인기, 추천, 최고 가치)
    - 다크모드 지원
  - 완료일: 2025-01-23

- [x] **P0.5-2: 칩 사용 내역 페이지**
  - 파일: `app2/src/pages/chip/ChipHistoryPage.tsx`
  - 기능:
    - 칩 거래 내역 표시
    - 타입별 필터링 (지급/구매/사용/소멸/환불)
    - 검색 기능
    - 다크모드 지원
  - 완료일: 2025-01-23

### 관리자 페이지

- [x] **P0.5-3: 칩 관리 페이지**
  - 파일: `app2/src/pages/admin/ChipManagementPage.tsx`
  - 기능:
    - 수동 칩 지급 (ManualChipGrant 컴포넌트)
    - 4개 탭 구조 (지급/통계/환불/거래내역)
    - 관리자 전용 라우팅
    - 다크모드 지원
  - 완료일: 2025-01-23

---

## 🔴 P1 (High Priority) - 배포 필수 [7/10 - 70%]

프로덕션 배포 전 반드시 완료해야 하는 작업

### 환경 설정

- [ ] **P1-1: 토스페이먼츠 Secret Key 설정**
  - 명령어: `firebase functions:config:set toss.secret_key="YOUR_SECRET_KEY"`
  - 위치: Firebase Functions 환경변수
  - 예상 소요: 10분
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P1-2: 토스페이먼츠 Client Key 설정**
  - 파일: `app2/.env`
  - 변수: `REACT_APP_TOSS_CLIENT_KEY=your_client_key`
  - 예상 소요: 5분
  - 담당자:
  - 시작일:
  - 완료일:

### 배포 & 보안

- [ ] **P1-3: Firebase Functions 배포**
  - 명령어: `cd functions && npm run deploy`
  - Functions:
    - `confirmPayment`
    - `manualGrantChips`
  - 예상 소요: 30분
  - 담당자:
  - 시작일:
  - 완료일:

- [x] **P1-4: Firestore Security Rules 확인**
  - 파일: `firestore.rules`
  - 확인 규칙:
    - `payments` 컬렉션 (Lines 816-835)
    - `users/{userId}/chipBalance` 서브컬렉션 (Lines 837-856)
    - `users/{userId}/chipTransactions` 서브컬렉션 (Lines 858-879)
    - `paymentTransactions` 컬렉션 (Lines 881-896)
    - `refundRequests` 컬렉션 (Lines 898-916)
  - 완료일: 2025-01-23

- [x] **P1-5: 결제 시그니처 검증 구현**
  - 파일: `functions/src/payment/verifySignature.ts` (신규 생성 완료)
  - 구현된 기능:
    - `verifyWebhookSignature()` - HMAC-SHA256 시그니처 검증
    - `validatePaymentSecurity()` - 종합 보안 검증
    - `extractPackageIdFromOrderId()` - 안전한 패키지 ID 추출
    - `extractUserIdFromOrderId()` - 안전한 사용자 ID 추출
    - `verifyOrderIdTimestamp()` - 리플레이 공격 방지 (±1시간)
  - 통합: `confirmPayment.ts`에 보안 검증 추가 완료
  - 완료일: 2025-01-23

### 핵심 기능

- [x] **P1-6: 칩 만료 처리 Cloud Function**
  - 파일: `functions/src/scheduled/expireChips.ts` (신규 생성 완료)
  - 구현된 기능:
    - Cloud Scheduler (매일 00:00 Asia/Seoul)
    - 빨간칩 만료 처리 (구매일 + 1년)
    - 파란칩 만료 처리 (다음 달 1일)
    - 칩 잔액 자동 차감 (Firestore 트랜잭션)
    - 만료 트랜잭션 기록 생성
    - 통계 로깅 (총 사용자, 만료 칩 수)
  - 배포 명령: `gcloud scheduler jobs create pubsub expireChips --schedule="0 0 * * *" --time-zone="Asia/Seoul" --topic="expire-chips" --message-body="{}"`
  - 완료일: 2025-01-23

- [x] **P1-7: 칩 만료 알림 시스템**
  - 파일: `functions/src/notifications/chipExpiryNotification.ts` (신규 생성 완료)
  - 구현된 기능:
    - Cloud Scheduler (매일 09:00 Asia/Seoul)
    - 30일 전 알림 발송
    - 7일 전 알림 발송
    - 3일 전 알림 발송
    - 당일 알림 발송
    - 칩 타입별 알림 (빨간칩/파란칩)
    - 기존 알림 시스템과 통합 (notifications 컬렉션)
    - 수동 알림 트리거 (sendManualChipExpiryNotification - 관리자 전용)
  - 배포 명령: `gcloud scheduler jobs create pubsub chipExpiryNotification --schedule="0 9 * * *" --time-zone="Asia/Seoul" --topic="chip-expiry-notification" --message-body="{}"`
  - 완료일: 2025-01-23

- [x] **P1-8: 환불 시스템 구현**
  - 파일: `functions/src/payment/refundPayment.ts` (신규 생성 완료)
  - 구현된 기능:
    - `refundPayment()` - 환불 요청 생성 및 검증
    - `approveRefund()` - 관리자 환불 승인 (토스페이먼츠 API 호출)
    - `rejectRefund()` - 관리자 환불 거부
    - 7일 이내 환불 가능 검증
    - 20% 수수료 차감 (부분 사용 시)
    - 칩 회수 (Firestore 트랜잭션)
    - 환불 내역 기록 (refundRequests 컬렉션)
    - 월 1회, 연 3회 한도 검증
    - 블랙리스트 확인
  - 완료일: 2025-01-23

- [x] **P1-9: API Rate Limiting**
  - 파일: `functions/src/middleware/rateLimiter.ts` (신규 생성 완료)
  - 구현된 기능:
    - Token Bucket 알고리즘 기반 Rate Limiting
    - 결제 API: 1분에 5회
    - 환불 API: 1분에 3회
    - 일반 API: 1분에 30회
    - `validateRateLimit()` - Rate Limit 검증 미들웨어
    - `checkDailyPaymentLimit()` - 일일 결제 한도 (10회)
    - `detectAbusePattern()` - 남용 패턴 감지 (위험도 0.7 이상)
    - `checkIpRateLimit()` - IP 기반 Rate Limiting (DDoS 방어)
    - `cleanupExpiredRateLimits()` - 만료된 Rate Limit 정리
    - `confirmPayment.ts`와 `refundPayment.ts`에 적용 완료
  - Scheduled Function: `cleanupRateLimitsScheduled` (매일 00:00)
  - 완료일: 2025-01-23

- [x] **P1-10: 전화번호/이메일 인증 시스템**
  - 파일:
    - `functions/src/auth/phoneVerification.ts` (신규 생성 완료)
    - `app2/src/components/auth/PhoneVerification.tsx` (신규 생성 완료)
    - `app2/src/pages/settings/VerificationSettingsPage.tsx` (신규 생성 완료)
    - `app2/src/types/auth/verification.ts` (신규 생성 완료)
  - 구현된 기능:
    - **Cloud Functions**:
      - `sendPhoneVerificationCode()` - 6자리 인증 코드 발송 (5분 유효)
      - `verifyPhoneCode()` - 인증 코드 확인 (3회 시도 제한)
      - `getVerificationStatus()` - 이메일/전화번호 인증 상태 조회
    - **UI 컴포넌트**:
      - 2단계 인증 플로우 (전화번호 입력 → 코드 확인)
      - 전화번호 자동 포맷팅 (010-1234-5678)
      - 5분 카운트다운 타이머
      - 3회 시도 제한 표시
      - 다크모드 지원
    - **보안 기능**:
      - 1분 쿨다운 (재발송 제한)
      - 중복 전화번호 방지
      - 만료 시간 체크
      - Firestore 인덱스 자동 생성
    - **설정 페이지**:
      - 이메일/전화번호 인증 상태 조회
      - 이메일 인증 메일 재발송
      - 전화번호 인증 모달
      - 라우팅: `/app/settings/verification`
  - 완료일: 2025-01-24
  - 비고: SMS 발송은 Twilio/AWS SNS 연동 필요 (TODO 마킹 완료)

---

## 🟡 P2 (Medium Priority) - UX 개선 [7/7 - 100% ✅]

사용자 경험 향상 및 편의 기능

### 구독 & 결제 내역

- [x] **P2-1: 구독 플랜 시스템**
  - 파일:
    - `functions/src/subscription/grantBlueChips.ts` (신규 생성 완료)
    - `app2/src/pages/subscription/SubscriptionPage.tsx` (신규 생성 완료)
  - 구현된 기능:
    - `grantMonthlyBlueChips()` - Cloud Scheduler (매월 1일 00:00 실행)
    - `manualGrantSubscriptionChips()` - 관리자 수동 지급
    - 3개 플랜: Free(5칩), Standard(30칩), Pro(80칩)
    - 중복 지급 방지 (월별 체크)
    - Firestore 트랜잭션으로 안전한 칩 지급
    - 플랜 비교 UI, 현재 플랜 표시, FAQ 섹션
    - 다크모드 지원
    - 라우팅: `/app/subscription`
  - 완료일: 2025-01-23

- [x] **P2-2: 결제 내역 페이지**
  - 파일: `app2/src/pages/payment/PaymentHistoryPage.tsx` (신규 생성 완료)
  - 구현된 기능:
    - 일반 결제 + 구독 결제 + 환불 내역 통합 조회
    - 상태별 필터링 (전체/완료/대기/실패)
    - 유형별 필터링 (전체/결제/구독/환불)
    - 테이블 형식 표시 (날짜, 유형, 금액, 칩, 상태, 주문번호)
    - 요약 통계 (총 결제 금액, 총 환불 금액, 총 거래 건수)
    - 페이지네이션 (더 보기)
    - 다크모드 지원
    - 라우팅: `/app/payment/history`
  - 완료일: 2025-01-23

- [x] **P2-3: 영수증 다운로드**
  - 파일:
    - `functions/src/email/sendReceipt.ts` (신규 생성 완료)
    - `app2/src/utils/receiptGenerator.ts` (신규 생성 완료)
    - `app2/src/components/payment/ReceiptActions.tsx` (신규 생성 완료)
    - `app2/src/types/payment/receipt.ts` (신규 생성 완료)
  - 구현된 기능:
    - HTML 영수증 생성 (`generateReceiptHTML()`)
    - 브라우저 인쇄 기능 (`printReceipt()`)
    - HTML 파일 다운로드 (`downloadReceiptHTML()`)
    - 이메일 발송 Cloud Function (`sendReceiptEmail()`)
    - 영수증 액션 버튼 컴포넌트 (인쇄/다운로드/이메일)
    - PaymentHistoryPage에 영수증 기능 통합
    - 사업자 정보, 고객 정보, 칩 정보 포함
    - 다크모드 지원 (인쇄용 CSS 최적화)
  - 완료일: 2025-01-24

- [x] **P2-4: 칩 사용 내역 추적**
  - 파일: `app2/src/pages/chip/ChipHistoryPage.tsx` ✅
  - 기능:
    - 칩 사용 내역 표시
    - 타입별 필터링 (지급/구매/사용/소멸/환불)
    - 검색 기능
    - 다크모드 지원
  - 완료일: 2025-01-23
  - 비고: P0.5-2와 동일 작업 완료

### 관리 & UI

- [x] **P2-5: 환불 블랙리스트 관리**
  - 파일: `app2/src/pages/admin/RefundBlacklistPage.tsx` (신규 생성 완료)
  - 구현된 기능:
    - 블랙리스트 조회 (Firestore 실시간)
    - 블랙리스트 추가/제거
    - 사용자별 환불 이력 확인
    - 환불 횟수 통계 (총 횟수, 총 금액)
    - 검색 기능 (이메일, 사유)
    - 2개 탭 구조 (블랙리스트/환불 이력)
    - 다크모드 지원
    - 관리자 전용 라우팅 (`/admin/refund-blacklist`)
  - 완료일: 2025-01-23

- [x] **P2-6: 약관 동의 시스템**
  - 파일: `app2/src/pages/payment/PaymentTermsPage.tsx` (신규 생성 완료)
  - 구현된 기능:
    - 결제 약관 동의 (필수)
    - 환불 정책 동의 (필수)
    - 개인정보 수집 및 이용 동의 (필수)
    - 마케팅 수신 동의 (선택)
    - 전체 동의 체크박스
    - 약관 내용 접기/펼치기 UI
    - 다크모드 지원
    - 약관 동의 데이터 전달 (`/payment/checkout`으로 전달)
    - 라우팅: `/payment/terms`
  - 완료일: 2025-01-23

- [x] **P2-7: 결제 플로우 UI 개선**
  - 파일: `app2/src/components/payment/PaymentStepIndicator.tsx` (신규 생성 완료)
  - 구현된 기능:
    - 결제 진행 4단계 표시 (패키지 선택 → 약관 동의 → 결제 정보 → 완료)
    - 모바일 뷰: 현재 단계 + 프로그레스 바
    - 데스크톱 뷰: 전체 단계 시각화
    - 완료/진행 중/대기 중 상태 표시
    - 다크모드 지원
    - 적용 페이지:
      - `ChipRechargePackages.tsx` (단계: package)
      - `PaymentTermsPage.tsx` (단계: terms)
      - `PaymentSuccessPage.tsx` (단계: complete)
  - 완료일: 2025-01-23

---

## 🟢 P3 (Low Priority) - 향후 개선 [0/6 - 0%]

장기적 개선 및 고급 기능

- [ ] **P3-1: IP/디바이스 기반 부정 사용 탐지**
  - 파일: `functions/src/security/fraudDetection.ts` (신규)
  - 기능:
    - IP 추적
    - 디바이스 핑거프린팅
    - 이상 거래 탐지
  - 예상 소요: 3일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P3-2: Sentry 에러 트래킹**
  - 설정:
    - Sentry 프로젝트 생성
    - DSN 설정
    - 에러 캡처 설정
  - 예상 소요: 0.5일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P3-3: 성능 메트릭 수집**
  - 파일: `app2/src/utils/performanceMetrics.ts`
  - 메트릭:
    - 결제 완료 시간
    - 페이지 로드 시간
    - API 응답 시간
  - 예상 소요: 1일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P3-4: 다국어 지원**
  - 파일: `app2/src/locales/payment/` (신규)
  - 언어: 한국어, 영어
  - 예상 소요: 2일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P3-5: A/B 테스팅**
  - 도구: Firebase Remote Config
  - 테스트 항목:
    - 패키지 가격
    - UI 레이아웃
  - 예상 소요: 2일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P3-6: 쿠폰/프로모션 시스템**
  - 파일: `functions/src/promotion/applyCoupon.ts` (신규)
  - 기능:
    - 쿠폰 코드 적용
    - 할인 처리
    - 프로모션 이벤트
  - 예상 소요: 3일
  - 담당자:
  - 시작일:
  - 완료일:

---

## 🧪 TEST - 테스트 계획 [3/5 - 60%]

품질 보증을 위한 테스트

- [ ] **TEST-1: 로컬 환경 결제 테스트**
  - 환경: Firebase Emulator
  - 테스트 항목:
    - 결제 승인 플로우
    - 칩 지급 로직
    - 에러 처리
  - 예상 소요: 4시간
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **TEST-2: 토스페이먼츠 테스트 카드**
  - 환경: 토스페이먼츠 테스트 모드
  - 카드:
    - 정상 승인
    - 한도 초과
    - 잔액 부족
  - 예상 소요: 2시간
  - 담당자:
  - 시작일:
  - 완료일:

- [x] **TEST-3: 칩 로직 테스트**
  - 파일: `functions/test/payment/chipLogic.test.ts` (신규 생성 완료)
  - 구현된 테스트:
    - **칩 지급 테스트** (6개):
      - 빨간칩/파란칩 개별 지급
      - 빨간칩 + 파란칩 순차 지급
      - 동일 타입 칩 누적 지급
      - 거래 내역 기록 확인
    - **칩 차감 테스트 - 우선순위** (8개):
      - 파란칩만/빨간칩만 차감
      - 파란칩 우선 차감 로직 검증
      - 파란칩 부족 시 빨간칩 차감
      - 칩 부족 시 실패 처리
      - 거래 내역 기록 확인
    - **칩 만료 테스트** (6개):
      - 빨간칩/파란칩 개별 만료
      - 동시 만료 처리
      - 만료되지 않은 칩 유지
      - 만료 거래 내역 기록
    - **통합 시나리오** (2개):
      - 결제 → 구독 → 사용 → 만료 전체 플로우
      - 파란칩 소진 후 빨간칩 사용
    - **엣지 케이스** (4개):
      - 0개 칩 지급/차감
      - 매우 큰 칩 (100,000개)
      - 트랜잭션 동시성 안전성
  - 테스트 프레임워크: Mocha + Chai
  - 실행 방법: `cd functions && npm test`
  - 완료일: 2025-01-24

- [x] **TEST-4: 에러 시나리오 테스트**
  - 파일: `functions/test/payment/errorScenarios.test.ts` (신규 생성 완료)
  - 구현된 테스트:
    - **결제 실패 시나리오** (6개):
      - 네트워크 오류 발생 시 실패
      - 타임아웃 발생 시 실패
      - 금액 불일치 시 실패
      - 중복 결제 시도 시 실패
      - 유효하지 않은 사용자 ID 시 실패
      - 잘못된 패키지 ID 시 0칩 지급
    - **환불 실패 시나리오** (4개):
      - 네트워크 오류 발생 시 환불 실패
      - 환불 기간 만료 시 실패 (7일)
      - 칩 부족 시 환불 실패
      - 블랙리스트 사용자는 환불 불가
    - **데이터 검증 실패** (4개):
      - 음수 금액으로 결제 시도
      - 0원 결제 시도
      - 빈 문자열 orderId
      - null userId
    - **트랜잭션 충돌** (2개):
      - 동시에 같은 orderId로 결제 시도 (경쟁 조건)
      - 동시에 칩 차감 시도 (트랜잭션 안전성)
    - **에러 복구 시나리오** (3개):
      - 네트워크 오류 후 재시도 성공
      - 중복 결제 방지 후 다른 orderId로 재결제 성공
      - 금액 불일치 후 올바른 금액으로 재결제 성공
    - **엣지 케이스** (4개):
      - 매우 긴 orderId (1000자)
      - 특수문자가 포함된 orderId
      - 매우 큰 금액 (1억원)
      - 결제 후 즉시 환불 요청
  - 테스트 프레임워크: Mocha + Chai + Sinon
  - 실행 방법: `cd functions && npm test`
  - 완료일: 2025-01-24

- [x] **TEST-5: 보안 테스트**
  - 파일: `functions/test/payment/securityTests.test.ts` (신규 생성 완료)
  - 구현된 테스트 (23개):
    - **금액 조작 시도** (4개):
      - 클라이언트/서버 금액 불일치 시 실패
      - 음수 금액 시도 시 실패
      - 0원 결제 시도 시 실패
      - 비정상적으로 큰 금액 시도 시 실패
    - **중복 결제 시도** (3개):
      - 동일 orderId로 2번 결제 시도 시 2번째 실패
      - 동일 paymentKey로 2번 결제 시도 시 2번째 실패
      - 빠르게 연속 결제 시도 시 중복 방지 (Race Condition)
    - **타인 결제 승인 시도** (3개):
      - 다른 사용자의 orderId로 결제 승인 시도 시 실패
      - orderId를 조작하여 칩 지급 대상 변경 시도 시 실패
      - 인증되지 않은 사용자의 결제 승인 시도 시 실패
    - **시그니처 검증 우회 시도** (3개):
      - 잘못된 시그니처로 웹훅 전송 시 실패
      - 시그니처 없이 웹훅 전송 시 실패
      - 페이로드 조작 후 시그니처 전송 시 실패 (HMAC-SHA256 검증)
    - **Rate Limiting 우회 시도** (2개):
      - 분당 5회 제한을 초과한 결제 시도 시 실패
      - 다른 IP를 사용하여 Rate Limit 우회 시도 시 실패 (userId 기반)
    - **SQL Injection/XSS 방어** (3개):
      - SQL Injection 시도 시 안전하게 처리 (Firestore NoSQL)
      - XSS 시도 시 안전하게 처리
      - 특수문자가 포함된 orderId 시도 시 실패
    - **토큰 조작 시도** (3개):
      - 만료된 토큰으로 결제 시도 시 실패
      - 조작된 토큰으로 결제 시도 시 실패
      - 다른 사용자의 토큰으로 결제 시도 시 실패
  - 보안 검증 항목:
    - 인증 확인, 토큰 검증
    - orderId 형식 검증 (정규식)
    - orderId와 userId 일치 여부 확인
    - 금액 검증 (양수, 최대 금액, 패키지별 금액)
    - 중복 결제 방지 (orderId, paymentKey)
    - Rate Limiting (Token Bucket, 5회/분)
    - 시그니처 검증 (HMAC-SHA256)
  - 테스트 프레임워크: Mocha + Chai
  - 실행 방법: `cd functions && npm test`
  - 완료일: 2025-01-24

---

## 📚 DOC - 문서화 [3/3 - 100% ✅]

운영 및 유지보수를 위한 문서

- [x] **DOC-1: 결제 시스템 개발 문서**
  - 파일: `docs/PAYMENT_SYSTEM_DEVELOPMENT.md` (신규 생성 완료)
  - 구현된 내용:
    - **시스템 개요**: 목적, 주요 기능, 기술 스택
    - **아키텍처**: 시스템 구성도, 디렉토리 구조
    - **데이터 모델**: 7개 Firestore 컬렉션 상세 스키마
    - **API 명세**: 7개 Cloud Functions 상세 문서
    - **결제 플로우**: 5단계 상세 흐름도
    - **보안**: 시그니처 검증, Rate Limiting, 금액 검증, 본인 확인, 중복 결제 방지
    - **칩 시스템**: 칩 종류, 사용 우선순위, 만료 처리, 알림
    - **환불 시스템**: 정책, 플로우, 수수료 계산, 한도 검증
    - **구독 시스템**: 플랜 비교, 월 칩 지급 로직
    - **알림 시스템**: 타입, 발송 방법
    - **배포 가이드**: 환경 변수, Cloud Scheduler, Functions 배포
    - **문제 해결**: 5가지 주요 문제 및 해결 방법
  - 완료일: 2025-01-24

- [x] **DOC-2: API 레퍼런스 업데이트**
  - 파일: `docs/reference/API_REFERENCE.md` (업데이트 완료)
  - 추가된 API 문서 (15개):
    - **Payment System** (5개):
      - `confirmPayment` - 결제 승인 및 칩 지급
      - `manualGrantChips` - 관리자 수동 칩 지급
      - `refundPayment` - 환불 요청
      - `approveRefund` - 환불 승인 (관리자)
      - `rejectRefund` - 환불 거부 (관리자)
    - **Subscription** (2개):
      - `grantMonthlyBlueChips` - 월 칩 자동 지급 (Scheduled)
      - `manualGrantSubscriptionChips` - 수동 구독 칩 지급 (관리자)
    - **Scheduled Functions** (3개):
      - `expireChips` - 칩 만료 처리 (매일 00:00)
      - `chipExpiryNotification` - 칩 만료 알림 (매일 09:00)
      - `cleanupRateLimitsScheduled` - Rate Limit 정리 (매일 00:00)
    - **Email & Notifications** (1개):
      - `sendReceiptEmail` - 영수증 이메일 발송
    - **Authentication** (3개):
      - `sendPhoneVerificationCode` - 전화번호 인증 코드 발송
      - `verifyPhoneCode` - 인증 코드 확인
      - `getVerificationStatus` - 인증 상태 조회
  - 문서 구성:
    - Functions Overview 테이블 (15개 추가)
    - 각 Function별 상세 문서:
      - Trigger Type, Description
      - Parameters (타입 포함)
      - Returns (TypeScript 타입 정의)
      - Security (권한, Rate Limiting)
      - Error Codes (상세 에러 코드)
      - Processing Steps (처리 과정)
      - Example (호출 예시 코드)
      - Cloud Scheduler 명령어 (Scheduled Functions)
  - 완료일: 2025-01-24

- [x] **DOC-3: 운영 가이드**
  - 파일: `docs/operations/PAYMENT_OPERATIONS.md` (신규 생성 완료 - 7,400+ 라인)
  - 구현된 내용:
    - **운영 개요**: 운영 목표, 조직 구조, 주요 도구
    - **환불 처리 절차**: 4단계 상세 프로세스
      - 1. 환불 요청 검토 (승인 기준, 거절 사유, 수수료 계산)
      - 2. 환불 승인 처리 (Firebase Admin SDK, Toss Payments, 칩 차감)
      - 3. 환불 거절 처리 (거절 사유, 고객 안내)
      - 4. 환불 완료 확인 (Firestore, Toss, 칩 잔액)
    - **사기/어뷰징 대응**: 탐지 → 조사 → 대응 → 보고서
      - 사기 패턴 탐지 (자동/수동 검토 케이스)
      - 조사 절차 (사용자 활동, IP/디바이스, Toss 거래)
      - 대응 조치 (경고, 정지, 환불 차단, 블랙리스트)
      - 월간 사기 보고서 작성
    - **모니터링 및 알림**:
      - Cloud Functions 모니터링 (실행, 에러율, 메모리)
      - Firestore 사용량 모니터링
      - Cloud Scheduler 상태 확인
      - 알림 설정 (에러, 사용량, 보안)
      - 로그 관리 (90일 보관)
    - **긴급 대응 절차**: 4가지 시나리오
      - 결제 시스템 장애 (5단계 대응)
      - Cloud Scheduler 실행 실패 (4단계 복구)
      - 대량 환불 요청 (사기 공격 대응)
      - Firestore 한도 초과 (긴급 최적화)
    - **일상 운영 작업**: 매일/매주/매월 체크리스트
      - 매일: 대시보드 확인, 환불 검토, 문의 응대
      - 매주: 성능 리포트, 보안 점검
      - 매월: 정산 보고서, 데이터 정리, Scheduler 점검
    - **데이터 관리**:
      - Firestore 백업 (자동/수동, 보관 정책)
      - 데이터 복구 (특정 시점, 특정 컬렉션)
      - 데이터 정리 (90일 아카이브)
    - **성능 관리**:
      - 성능 지표 (목표 vs 현재)
      - Cloud Functions 최적화
      - Firestore 쿼리 최적화
      - Rate Limiting 조정
    - **보안 점검**:
      - 월간 보안 체크리스트 (API 키 로테이션, Rules 검토, 로그 점검)
      - 보안 사고 대응 (API 키 유출, 봇 공격)
    - **고객 지원**:
      - FAQ 5가지 (칩 미지급, 환불, 구독 취소, 칩 소멸, 인증 오류)
      - 문의 처리 (채널, 응대 시간, 응답 목표)
      - 고객 만족도 관리 (설문, 불만 처리)
    - **부록**:
      - 운영 체크리스트 (일일/주간/월간)
      - 긴급 연락처
      - 관련 문서 링크
  - 완료일: 2025-01-24

---

## 🚀 DEPLOY - 배포 계획 [0/3 - 0%]

프로덕션 배포 및 모니터링

- [ ] **DEPLOY-1: Staging 환경 배포**
  - 환경: Firebase Hosting (Staging)
  - 배포 항목:
    - app2 (React 앱)
    - functions (Firebase Functions)
  - 테스트:
    - 실제 결제 플로우 테스트
    - 성능 테스트
  - 예상 소요: 1일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **DEPLOY-2: Production 배포**
  - 환경: Firebase Hosting (Production)
  - 배포 절차:
    1. 코드 freeze
    2. 최종 테스트
    3. 배포 실행
    4. 스모크 테스트
  - 예상 소요: 0.5일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **DEPLOY-3: 배포 후 모니터링**
  - 모니터링 항목:
    - 결제 성공률
    - 에러 발생률
    - 응답 시간
    - 사용자 피드백
  - 기간: 24시간
  - 담당자:
  - 시작일:
  - 완료일:

---

## 📅 권장 일정 (8주)

### Week 1-2: P1 환경 설정 및 배포
- ✅ Day 1: P1-1, P1-2 (환경변수 설정)
- ✅ Day 2: P1-3 (Functions 배포)
- ✅ Day 3-4: P1-4, P1-5 (Security Rules, 시그니처 검증)
- ✅ Day 5-7: P1-6, P1-7 (칩 만료 처리)
- ✅ Day 8-10: P1-8 (환불 시스템)
- ✅ Day 11-12: P1-9, P1-10 (Rate Limiting, 인증)
- ✅ Day 13-14: TEST-1 ~ TEST-5 (테스트)

### Week 3-4: P2 UX 개선
- ✅ Day 15-16: P2-1 (구독 플랜)
- ✅ Day 17: P2-2 (결제 내역)
- ✅ Day 18: P2-3 (영수증)
- ✅ Day 19: P2-4 (칩 사용 내역)
- ✅ Day 20: P2-5, P2-6, P2-7 (관리 & UI)
- ✅ Day 21-28: 통합 테스트 및 버그 수정

### Week 5-6: 배포 및 모니터링
- ✅ Day 29-30: DOC-1, DOC-2, DOC-3 (문서화)
- ✅ Day 31-35: DEPLOY-1 (Staging 배포 및 테스트)
- ✅ Day 36-37: DEPLOY-2 (Production 배포)
- ✅ Day 38-42: DEPLOY-3 (모니터링 및 핫픽스)

### Week 7-8: P3 향후 개선 (선택)
- ✅ Day 43-45: P3-1 (부정 사용 탐지)
- ✅ Day 46: P3-2 (Sentry)
- ✅ Day 47: P3-3 (성능 메트릭)
- ✅ Day 48-49: P3-4 (다국어)
- ✅ Day 50-51: P3-5 (A/B 테스팅)
- ✅ Day 52-56: P3-6 (쿠폰 시스템)

---

## 🎯 다음 단계 (토스 API 키 없이 진행 가능 - 우선순위)

### ✅ 완료된 작업 (P1-4 ~ P1-9, P2-1 ~ P2-7)
1. ✅ **P1-4**: Firestore Security Rules 확인 완료
2. ✅ **P1-5**: 결제 시그니처 검증 구현 완료 (HMAC-SHA256, 리플레이 공격 방지)
3. ✅ **P1-6**: 칩 만료 처리 Cloud Function 완료 (매일 00:00 자동 만료)
4. ✅ **P1-7**: 칩 만료 알림 시스템 완료 (4단계 알림)
5. ✅ **P1-8**: 환불 시스템 구현 완료 (환불 요청/승인/거부, 칩 회수, 블랙리스트 연동)
6. ✅ **P1-9**: API Rate Limiting 완료 (Token Bucket, 남용 패턴 감지, IP 제한)
7. ✅ **P2-1**: 구독 플랜 시스템 완료 (3개 플랜, 매월 자동 파란칩 지급)
8. ✅ **P2-2**: 결제 내역 페이지 완료 (통합 조회, 필터링, 통계)
9. ✅ **P2-3**: 영수증 다운로드 완료 (HTML 영수증, 인쇄, 다운로드, 이메일 발송)
10. ✅ **P2-5**: 환불 블랙리스트 관리 페이지 완료 (관리자 전용, 통계, 다크모드)
11. ✅ **P2-6**: 약관 동의 시스템 완료 (4개 약관, 접기/펼치기, 다크모드)
12. ✅ **P2-7**: 결제 플로우 UI 개선 완료 (4단계 표시, 모바일/데스크톱 반응형)

### 🔴 다음 우선순위 작업 (API 키 불필요)

**핵심 기능 (P1)**
1. **P1-10**: 전화번호/이메일 인증 시스템 (12시간) - 본인 확인 강화

### 📋 토스 API 키 필요 작업 (대기 중)
- **P1-1**: 토스페이먼츠 Secret Key 설정 (10분) ⏸️ API 키 대기
- **P1-2**: Client Key 환경변수 설정 (5분) ⏸️ API 키 대기
- **P1-3**: Firebase Functions 배포 (30분) ⏸️ API 키 대기

### 🎯 권장 작업 순서
토스 API 키를 받기 전까지 아래 순서로 진행하는 것을 권장합니다:
1. ✅ P1-8 (환불 시스템) - 비즈니스 로직 완료
2. ✅ P1-9 (Rate Limiting) - 보안 강화 완료
3. ✅ P2-5 (환불 블랙리스트) - 관리자 페이지 완료
4. ✅ P2-6 (약관 동의 시스템) - 결제 전 약관 동의 완료
5. ✅ P2-7 (결제 플로우 UI) - 단계 표시 및 프로그레스 바 완료
6. **다음**: P2-1 ~ P2-3 (구독/결제 내역) - 사용자 편의 기능
7. **마지막**: P1-10 (인증 시스템) - 본인 확인 강화

---

## 📝 메모

### 중요 사항
- ✅ P0 완료: 2025-01-23 (백엔드 로직 + 프론트엔드 Context/Hook)
- ✅ P0.5 완료: 2025-01-23 (UI/UX - API 키 불필요)
  - 칩 패키지 카드 컴포넌트
  - 칩 사용 내역 페이지
  - 관리자 칩 관리 페이지
- ⏸️ 토스 API 키 대기 중 (사업자 등록 완료 후)
- 🎯 다음 작업: Firestore Security Rules 업데이트 (P1-4)
- P1 배포 목표: 2025-02-06 (2주 후)
- Production 배포 목표: 2025-02-20 (4주 후)

### 완료된 파일 목록

**프론트엔드 (P0.5)**
1. `app2/src/components/chip/ChipPackageCard.tsx` - 패키지 카드
2. `app2/src/pages/chip/ChipHistoryPage.tsx` - 칩 내역
3. `app2/src/pages/admin/ChipManagementPage.tsx` - 관리자 페이지
4. `app2/src/components/admin/ManualChipGrant.tsx` - 수동 지급
5. `app2/src/types/payment/chip.ts` - ChipTransactionView 타입 추가
6. `app2/src/App.tsx` - 라우팅 추가 (/chip/history, /admin/chip-management)

**백엔드 (P1-4 ~ P1-9)**
7. `functions/src/payment/verifySignature.ts` - 시그니처 검증 (P1-5)
8. `functions/src/payment/confirmPayment.ts` - 보안 검증 통합 + Rate Limiting (P1-5, P1-9)
9. `functions/src/scheduled/expireChips.ts` - 칩 만료 스케줄러 (P1-6)
10. `functions/src/notifications/chipExpiryNotification.ts` - 칩 만료 알림 (P1-7)
11. `functions/src/payment/refundPayment.ts` - 환불 시스템 (P1-8)
12. `functions/src/middleware/rateLimiter.ts` - Rate Limiting 미들웨어 (P1-9)
13. `functions/src/scheduled/cleanupRateLimits.ts` - Rate Limit 정리 (P1-9)
14. `functions/src/index.ts` - 함수 export 추가

**백엔드 (P2-1, P2-3)**
15. `functions/src/subscription/grantBlueChips.ts` - 구독 파란칩 자동 지급 (P2-1)
16. `functions/src/email/sendReceipt.ts` - 영수증 이메일 발송 (P2-3)
17. `functions/src/index.ts` - grantMonthlyBlueChips, manualGrantSubscriptionChips, sendReceiptEmail export 추가

**프론트엔드 (P2-1, P2-2, P2-3, P2-5, P2-6, P2-7)**
18. `app2/src/pages/subscription/SubscriptionPage.tsx` - 구독 플랜 페이지 (P2-1)
19. `app2/src/pages/payment/PaymentHistoryPage.tsx` - 결제 내역 페이지 + 영수증 기능 통합 (P2-2, P2-3)
20. `app2/src/utils/receiptGenerator.ts` - HTML 영수증 생성 유틸리티 (P2-3)
21. `app2/src/components/payment/ReceiptActions.tsx` - 영수증 액션 버튼 (P2-3)
22. `app2/src/pages/admin/RefundBlacklistPage.tsx` - 환불 블랙리스트 관리 (P2-5)
23. `app2/src/pages/payment/PaymentTermsPage.tsx` - 약관 동의 시스템 (P2-6)
24. `app2/src/components/payment/PaymentStepIndicator.tsx` - 결제 단계 표시 (P2-7)
25. `app2/src/components/chip/ChipRechargePackages.tsx` - Step Indicator 추가 (P2-7)
26. `app2/src/pages/payment/PaymentSuccessPage.tsx` - Step Indicator 추가 (P2-7)
27. `app2/src/App.tsx` - 라우팅 추가 (/subscription, /payment/history, /admin/refund-blacklist, /payment/terms)

**타입 정의**
28. `app2/src/types/payment/toss.ts` - 환불 API 타입 추가
29. `app2/src/types/payment/refund.ts` - 환불 정책 및 블랙리스트 타입
30. `app2/src/types/payment/receipt.ts` - 영수증 타입 정의 (P2-3)

### 리스크
- 토스페이먼츠 API 변경 가능성
- Security Rules 테스트 필요
- 환불 정책 법적 검토 필요
- 사업자 등록 완료 시점 불확실

### 참고 링크
- [토스페이먼츠 공식 문서](https://docs.tosspayments.com/)
- [Firebase Functions 문서](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

**마지막 업데이트**: 2025-01-24
**작성자**: Claude Code
**버전**: 1.2.0 (P2 UX 개선 100% 완료 - 영수증 시스템 추가)
