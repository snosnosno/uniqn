# 🎯 T-HOLDEM 결제 시스템 구현 체크리스트

> **프로젝트**: T-HOLDEM 토스페이먼츠 결제 시스템
> **시작일**: 2025-01-23
> **현재 상태**: P0 + UI 완료 (26% 완성)
> **마지막 업데이트**: 2025-01-23

---

## 📊 전체 진행 상황

```
전체 작업: 42개
완료: 15개 (36%)
진행 중: 0개
대기 중: 27개 (64%)
```

**진행률 바**:
```
█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 36%
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

## 🔴 P1 (High Priority) - 배포 필수 [4/10 - 40%]

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

- [ ] **P1-8: 환불 시스템 구현**
  - 파일: `functions/src/payment/refundPayment.ts` (신규)
  - 기능:
    - 7일 이내 환불 가능
    - 20% 수수료 차감
    - 칩 회수
    - 환불 내역 기록
  - 예상 소요: 8시간
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P1-9: API Rate Limiting**
  - 파일: `functions/src/middleware/rateLimiter.ts` (신규)
  - 기능:
    - 결제 API 호출 제한 (사용자당 1분에 5회)
    - 남용 방지
  - 예상 소요: 3시간
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P1-10: 전화번호/이메일 인증 시스템**
  - 파일: `functions/src/auth/verifyIdentity.ts` (신규)
  - 기능:
    - 전화번호 인증 (SMS)
    - 이메일 인증
    - 중복 계정 방지
  - 예상 소요: 12시간
  - 담당자:
  - 시작일:
  - 완료일:

---

## 🟡 P2 (Medium Priority) - UX 개선 [1/7 - 14%]

사용자 경험 향상 및 편의 기능

### 구독 & 결제 내역

- [ ] **P2-1: 구독 플랜 시스템**
  - 파일:
    - `functions/src/subscription/grantBlueChips.ts` (신규)
    - `app2/src/pages/subscription/SubscriptionPage.tsx` (신규)
  - 기능:
    - 매월 자동 파란칩 지급
    - 구독 플랜 관리 (Free, Standard, Pro)
    - 구독 결제 처리
  - 예상 소요: 2일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P2-2: 결제 내역 페이지**
  - 파일: `app2/src/pages/payment/PaymentHistoryPage.tsx` (신규)
  - 기능:
    - 결제 내역 조회
    - 필터링 (날짜, 상태)
    - 페이지네이션
  - 예상 소요: 1일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P2-3: 영수증 다운로드**
  - 파일: `functions/src/payment/generateReceipt.ts` (신규)
  - 기능:
    - PDF 영수증 생성
    - 이메일 발송
  - 예상 소요: 1일
  - 담당자:
  - 시작일:
  - 완료일:

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

- [ ] **P2-5: 환불 블랙리스트 관리**
  - 파일: `app2/src/pages/admin/RefundBlacklistPage.tsx` (신규)
  - 기능:
    - 환불 악용 사용자 차단
    - 관리자 페이지
  - 예상 소요: 0.5일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P2-6: 약관 동의 시스템**
  - 파일: `app2/src/pages/payment/PaymentTermsPage.tsx` (신규)
  - 기능:
    - 결제 약관 동의
    - 환불 정책 동의
  - 예상 소요: 0.5일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **P2-7: 결제 플로우 UI 개선**
  - 파일: `app2/src/components/payment/PaymentStepIndicator.tsx` (신규)
  - 기능:
    - 결제 진행 단계 표시
    - 프로그레스 바
  - 예상 소요: 0.5일
  - 담당자:
  - 시작일:
  - 완료일:

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

## 🧪 TEST - 테스트 계획 [0/5 - 0%]

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

- [ ] **TEST-3: 칩 로직 테스트**
  - 테스트 케이스:
    - 칩 지급
    - 칩 차감 (우선순위)
    - 칩 만료
  - 예상 소요: 3시간
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **TEST-4: 에러 시나리오 테스트**
  - 시나리오:
    - 결제 실패
    - 네트워크 오류
    - 타임아웃
  - 예상 소요: 3시간
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **TEST-5: 보안 테스트**
  - 테스트:
    - 금액 조작 시도
    - 중복 결제 시도
    - 타인 결제 승인 시도
  - 예상 소요: 4시간
  - 담당자:
  - 시작일:
  - 완료일:

---

## 📚 DOC - 문서화 [0/3 - 0%]

운영 및 유지보수를 위한 문서

- [ ] **DOC-1: 결제 시스템 개발 문서**
  - 파일: `docs/PAYMENT_SYSTEM_DEVELOPMENT.md` (신규)
  - 내용:
    - 아키텍처 설명
    - API 명세
    - 데이터 모델
  - 예상 소요: 1일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **DOC-2: API 레퍼런스 업데이트**
  - 파일: `docs/reference/API_REFERENCE.md`
  - 추가 API:
    - `confirmPayment`
    - `manualGrantChips`
    - `refundPayment` (P1-8 완료 후)
  - 예상 소요: 0.5일
  - 담당자:
  - 시작일:
  - 완료일:

- [ ] **DOC-3: 운영 가이드**
  - 파일: `docs/operations/PAYMENT_OPERATIONS.md` (신규)
  - 내용:
    - 환불 처리 절차
    - 이상 거래 대응
    - 모니터링 방법
  - 예상 소요: 1일
  - 담당자:
  - 시작일:
  - 완료일:

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

### ✅ 완료된 작업 (P1-4 ~ P1-7)
1. ✅ **P1-4**: Firestore Security Rules 확인 완료
2. ✅ **P1-5**: 결제 시그니처 검증 구현 완료 (HMAC-SHA256, 리플레이 공격 방지)
3. ✅ **P1-6**: 칩 만료 처리 Cloud Function 완료 (매일 00:00 자동 만료)
4. ✅ **P1-7**: 칩 만료 알림 시스템 완료 (4단계 알림)

### 🔴 다음 우선순위 작업 (API 키 불필요)

**핵심 기능 (P1)**
1. **P1-8**: 환불 시스템 구현 (8시간) - 7일 내 환불, 20% 수수료, 칩 회수
2. **P1-9**: API Rate Limiting (4시간) - 결제 API 호출 제한
3. **P1-10**: 관리자 로그 시스템 (4시간) - 결제/환불 감사 로그

**UX 개선 (P2)**
4. **P2-5**: 환불 블랙리스트 관리 (4시간) - 관리자 페이지
5. **P2-6**: 약관 동의 시스템 (4시간) - 결제 전 약관 동의
6. **P2-7**: 결제 플로우 UI 개선 (4시간) - 프로그레스 바, 로딩 상태

### 📋 토스 API 키 필요 작업 (대기 중)
- **P1-1**: 토스페이먼츠 Secret Key 설정 (10분) ⏸️ API 키 대기
- **P1-2**: Client Key 환경변수 설정 (5분) ⏸️ API 키 대기
- **P1-3**: Firebase Functions 배포 (30분) ⏸️ API 키 대기

### 🎯 권장 작업 순서
토스 API 키를 받기 전까지 아래 순서로 진행하는 것을 권장합니다:
1. P1-8 (환불 시스템) - 비즈니스 로직이 중요하므로 최우선
2. P1-9 (Rate Limiting) - 보안 강화
3. P2-5 (환불 블랙리스트) - P1-8과 연계되는 기능
4. P2-6, P2-7 (UX 개선) - 사용자 경험 향상

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

**백엔드 (P1-4 ~ P1-7)**
7. `functions/src/payment/verifySignature.ts` - 시그니처 검증 (P1-5)
8. `functions/src/payment/confirmPayment.ts` - 보안 검증 통합 (P1-5)
9. `functions/src/scheduled/expireChips.ts` - 칩 만료 스케줄러 (P1-6)
10. `functions/src/notifications/chipExpiryNotification.ts` - 칩 만료 알림 (P1-7)
11. `functions/src/index.ts` - 함수 export 추가

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

**마지막 업데이트**: 2025-01-23
**작성자**: Claude Code
**버전**: 1.0.0
