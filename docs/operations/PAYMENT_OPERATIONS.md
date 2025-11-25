# 💼 결제 시스템 운영 가이드

**버전**: v1.0.0
**작성일**: 2025-01-24
**프로젝트**: UNIQN 결제 시스템

---

## 📋 목차

1. [운영 개요](#-운영-개요)
2. [환불 처리 절차](#-환불-처리-절차)
3. [사기/어뷰징 대응](#-사기어뷰징-대응)
4. [모니터링 및 알림](#-모니터링-및-알림)
5. [긴급 대응 절차](#-긴급-대응-절차)
6. [일상 운영 작업](#-일상-운영-작업)
7. [데이터 관리](#-데이터-관리)
8. [성능 관리](#-성능-관리)
9. [보안 점검](#-보안-점검)
10. [고객 지원](#-고객-지원)

---

## 🎯 운영 개요

### 운영 목표

- **가용성**: 99.9% 이상 서비스 가용성 유지
- **응답 시간**: 환불 요청 처리 24시간 이내
- **보안**: 사기 거래 0% 달성
- **고객 만족**: 불만 사항 48시간 이내 해결

### 운영 조직

| 역할 | 책임 | 근무 시간 |
|------|------|-----------|
| **시스템 관리자** | 시스템 모니터링, 긴급 대응 | 24/7 |
| **환불 담당자** | 환불 요청 검토 및 승인/거절 | 평일 09:00-18:00 |
| **보안 담당자** | 사기/어뷰징 탐지 및 대응 | 평일 09:00-18:00 |
| **고객 지원** | 고객 문의 응대 | 평일 09:00-18:00 |

### 주요 도구

- **Firebase Console**: Firestore 데이터 관리, Functions 모니터링
- **Google Cloud Console**: Cloud Scheduler, Logging, Monitoring
- **Toss Payments 대시보드**: 결제 내역 조회, API 키 관리
- **Sentry** (예정): 에러 추적 및 알림

---

## 💸 환불 처리 절차

### 1. 환불 요청 검토

#### 1.1 환불 요청 확인

**Firebase Console** → **Firestore Database** → **`refundRequests`** 컬렉션

환불 요청 상태:
- `pending`: 검토 대기 중 ⏳
- `approved`: 승인 완료 ✅
- `rejected`: 거절됨 ❌
- `completed`: 환불 처리 완료 ✅

#### 1.2 검토 기준

**승인 가능한 경우**:
- ✅ 7일 이내 요청
- ✅ 사용한 칩 비율이 합리적 (20% 미만)
- ✅ 월/연 환불 한도 내
- ✅ 정상적인 사용자 (어뷰징 이력 없음)

**거절 사유**:
- ❌ 7일 초과
- ❌ 칩 대부분 사용 (80% 이상)
- ❌ 월 3회 또는 연 12회 초과
- ❌ 사기/어뷰징 의심 계정
- ❌ 중복 환불 요청

#### 1.3 환불 금액 계산

**환불 수수료**: 20% (사용한 칩 비율에 따라 부과)

```typescript
// 예시: 5,500원 패키지 (30 chips)
// 사용한 칩: 10개 (33.3%)
// 수수료: 5,500 * 33.3% * 20% = 366원
// 환불액: 5,500 - 366 = 5,134원
```

**계산 공식**:
```
사용 비율 = (초기 칩 수 - 현재 칩 수) / 초기 칩 수
수수료 = 결제 금액 × 사용 비율 × 20%
환불액 = 결제 금액 - 수수료
```

### 2. 환불 승인 처리

#### 2.1 Firebase Admin SDK 사용

```bash
# Firebase Console → Functions → approveRefund 함수 직접 호출
```

또는 **Admin 페이지**에서 처리:

```
https://tholdem-ebc18.web.app/admin/refunds
```

**승인 버튼 클릭** → 확인 → 처리 완료

#### 2.2 Toss Payments에서 환불 처리

1. **Toss Payments 대시보드** 로그인
2. **결제 내역** → 해당 `paymentKey` 검색
3. **환불 버튼** 클릭 → 환불액 입력 → 환불 처리

**⚠️ 주의**: Firestore에서 승인 후, Toss에서도 반드시 환불 처리해야 실제 환불됩니다!

#### 2.3 사용자 칩 차감

`approveRefund` Cloud Function이 자동으로 처리:
- 환불액만큼 칩 차감 (사용 우선순위: blue → red)
- `chipBalance` 업데이트
- `chipTransactions` 기록 추가

### 3. 환불 거절 처리

#### 3.1 거절 사유 작성

**Admin 페이지** → **환불 요청 목록** → **거절 버튼**

거절 사유 예시:
- "7일 환불 기간이 경과했습니다."
- "칩의 80% 이상을 사용하여 환불이 불가능합니다."
- "월 환불 한도(3회)를 초과했습니다."
- "어뷰징 의심으로 환불이 거절되었습니다."

#### 3.2 고객 안내

거절 사유가 포함된 알림이 자동 발송됩니다:
- 앱 내 알림 (notifications 컬렉션)
- 이메일 (선택 사항)

### 4. 환불 완료 확인

#### 4.1 Firestore 확인

```
refundRequests/{refundId}
  status: "completed"
  processedAt: "2025-01-24T12:00:00.000Z"
  refundAmount: 5134
```

#### 4.2 Toss Payments 확인

**Toss 대시보드** → **환불 내역** → 상태: "환불 완료"

#### 4.3 사용자 칩 잔액 확인

```
chipBalance/{userId}
  redChips: 0 (차감됨)
  blueChips: 20 (차감됨)
```

---

## 🚨 사기/어뷰징 대응

### 1. 사기 패턴 탐지

#### 1.1 의심 패턴

**자동 탐지 (예정 - P3-1)**:
- ⚠️ 동일 IP에서 다수 계정 생성
- ⚠️ 동일 카드로 다수 결제 후 즉시 환불
- ⚠️ 결제 후 칩 사용 없이 즉시 환불 (여러 번)
- ⚠️ 비정상적으로 빠른 칩 사용 (봇 의심)
- ⚠️ 구독 가입 후 즉시 환불 반복

#### 1.2 수동 검토 필요 케이스

- 환불 요청이 월 3회 이상
- 결제 금액과 환불 금액 차이가 미미 (수수료만 내고 환불)
- 동일 이메일/전화번호로 여러 계정 생성
- 비정상적인 칩 사용 패턴 (예: 1분에 100칩 소진)

### 2. 조사 절차

#### 2.1 사용자 활동 이력 조회

**Firestore 쿼리**:

```typescript
// 결제 내역
paymentTransactions
  .where('userId', '==', suspiciousUserId)
  .orderBy('createdAt', 'desc')

// 환불 내역
refundRequests
  .where('userId', '==', suspiciousUserId)
  .orderBy('createdAt', 'desc')

// 칩 사용 내역
chipTransactions
  .where('userId', '==', suspiciousUserId)
  .orderBy('timestamp', 'desc')
```

#### 2.2 IP/디바이스 분석

**Firebase Authentication** → **Users** → 해당 사용자 → **Sign-in methods**

확인 사항:
- IP 주소 (여러 계정이 동일 IP 사용?)
- 디바이스 정보 (여러 계정이 동일 디바이스 사용?)
- 로그인 시간 패턴 (비정상적으로 짧은 간격?)

#### 2.3 Toss Payments 거래 조회

**Toss 대시보드** → **거래 내역** → 해당 `paymentKey` 검색

확인 사항:
- 결제 카드 정보 (여러 계정이 동일 카드 사용?)
- 거래 상태 (취소/환불 반복?)
- 거래 시간 패턴 (비정상적 빈도?)

### 3. 대응 조치

#### 3.1 계정 경고

**Firestore** → **`users/{userId}`** → 경고 필드 추가:

```typescript
{
  warningCount: 1,
  warningReason: "환불 반복 의심",
  warningDate: "2025-01-24T12:00:00.000Z"
}
```

사용자에게 알림 발송:
- "부적절한 환불 요청이 감지되었습니다. 재발 시 계정 정지될 수 있습니다."

#### 3.2 계정 정지

**Firebase Authentication** → **Users** → 해당 사용자 → **Disable user**

Firestore 업데이트:

```typescript
{
  accountStatus: "suspended",
  suspendedReason: "반복적인 환불 어뷰징",
  suspendedAt: "2025-01-24T12:00:00.000Z"
}
```

#### 3.3 환불 차단

모든 환불 요청 자동 거절:

```typescript
// Cloud Function: refundPayment
if (user.accountStatus === 'suspended') {
  throw new Error('계정이 정지되어 환불이 불가능합니다.');
}
```

#### 3.4 IP/카드 블랙리스트 (예정)

**Firestore** → **`blacklist`** 컬렉션:

```typescript
{
  type: "ip" | "card" | "email",
  value: "123.45.67.89",
  reason: "사기 거래 의심",
  blockedAt: "2025-01-24T12:00:00.000Z"
}
```

### 4. 사기 보고서 작성

**월간 사기 리포트**:

- 사기 의심 건수
- 계정 정지 건수
- 환불 차단 건수
- 총 피해 금액 (차단한 금액)

**저장 위치**: `docs/reports/fraud-report-YYYY-MM.md`

---

## 📊 모니터링 및 알림

### 1. 시스템 모니터링

#### 1.1 Cloud Functions 모니터링

**Google Cloud Console** → **Cloud Functions** → 각 함수 선택

확인 지표:
- **실행 횟수**: 평균 실행 횟수 대비 급증/급감
- **에러율**: 1% 미만 유지 (초과 시 알림)
- **실행 시간**: 평균 3초 이내 (초과 시 조사)
- **메모리 사용량**: 256MB 이하 (초과 시 최적화 필요)

#### 1.2 Firestore 모니터링

**Firebase Console** → **Firestore Database** → **Usage**

확인 지표:
- **읽기/쓰기 횟수**: 일일 한도 대비 사용량
- **저장 용량**: 1GB 이하 유지
- **인덱스 성능**: 쿼리 실행 시간 1초 이내

#### 1.3 Cloud Scheduler 모니터링

**Google Cloud Console** → **Cloud Scheduler** → 각 작업 선택

확인 사항:
- **실행 성공률**: 100% 유지 (실패 시 즉시 조사)
- **실행 시간**: 예정 시간 정확히 실행
- **로그**: 에러 로그 확인

### 2. 알림 설정

#### 2.1 Cloud Functions 에러 알림

**Google Cloud Console** → **Monitoring** → **Alerting** → **Create Policy**

알림 조건:
- **에러율 > 1%**: 즉시 알림
- **실행 시간 > 10초**: 경고 알림
- **메모리 사용량 > 256MB**: 경고 알림

알림 채널:
- 이메일
- Slack (예정)
- SMS (긴급 시)

#### 2.2 Firestore 사용량 알림

**Firebase Console** → **Usage** → **Set budget alerts**

알림 조건:
- **일일 읽기 > 50,000건**: 경고
- **일일 쓰기 > 20,000건**: 경고
- **저장 용량 > 1GB**: 경고

#### 2.3 보안 알림

**Firebase Console** → **Authentication** → **Settings** → **Monitoring**

알림 조건:
- **실패한 로그인 시도 > 5회/분**: 경고
- **동일 IP에서 계정 생성 > 3개/시간**: 경고
- **비정상적인 칩 사용 패턴**: 경고

### 3. 로그 관리

#### 3.1 Cloud Functions 로그

**Google Cloud Console** → **Logging** → **Logs Explorer**

필터 예시:

```
resource.type="cloud_function"
resource.labels.function_name="confirmPayment"
severity>=ERROR
```

중요 로그:
- **에러 로그**: 결제 실패, 환불 실패, API 에러
- **경고 로그**: Rate Limit 초과, 금액 불일치
- **정보 로그**: 정상 거래 완료, 칩 지급

#### 3.2 로그 보관 정책

- **에러 로그**: 90일 보관
- **경고 로그**: 30일 보관
- **정보 로그**: 7일 보관

---

## 🚑 긴급 대응 절차

### 1. 결제 시스템 장애

#### 1.1 증상

- 사용자가 결제 완료 후 칩을 받지 못함
- `confirmPayment` 함수 에러율 급증
- Toss Payments API 응답 없음

#### 1.2 대응 절차

**Step 1: 에러 로그 확인**

```bash
# Cloud Functions 로그 확인
gcloud functions logs read confirmPayment --limit 50
```

**Step 2: Toss Payments 상태 확인**

- Toss Payments 대시보드 접속
- API 상태 페이지 확인: https://status.tosspayments.com

**Step 3: 긴급 점검 모드 활성화**

Firestore → `config/maintenance` 문서 생성:

```typescript
{
  isMaintenanceMode: true,
  reason: "결제 시스템 점검 중",
  estimatedEndTime: "2025-01-24T13:00:00.000Z"
}
```

앱에서 결제 버튼 비활성화 및 안내 문구 표시

**Step 4: 수동 칩 지급**

결제는 완료됐으나 칩을 받지 못한 사용자에게 수동 지급:

```typescript
// Admin 페이지 → Manual Grant Chips
const manualGrantChips = httpsCallable(functions, 'manualGrantChips');
await manualGrantChips({
  userId: 'abc123',
  amount: 30,
  type: 'red',
  reason: '결제 시스템 장애로 인한 수동 지급'
});
```

**Step 5: 복구 후 점검 모드 해제**

```typescript
{
  isMaintenanceMode: false
}
```

### 2. Cloud Scheduler 실행 실패

#### 2.1 증상

- 월간 블루칩이 지급되지 않음
- 칩 만료 처리가 되지 않음
- Cloud Scheduler 로그에 실패 기록

#### 2.2 대응 절차

**Step 1: 실행 이력 확인**

```bash
# Cloud Scheduler 로그 확인
gcloud scheduler jobs describe grantMonthlyBlueChips
```

**Step 2: 수동 실행**

```bash
# Cloud Scheduler 강제 실행
gcloud scheduler jobs run grantMonthlyBlueChips
```

**Step 3: 함수 에러 확인**

```bash
# Functions 로그 확인
gcloud functions logs read grantMonthlyBlueChips --limit 50
```

**Step 4: 복구 및 모니터링**

- 에러 원인 수정
- 다음 실행 시간까지 모니터링

### 3. 대량 환불 요청 (사기 공격)

#### 3.1 증상

- 짧은 시간 내 환불 요청 급증 (10건 이상/시간)
- 동일 IP에서 다수 계정으로 환불 요청

#### 3.2 대응 절차

**Step 1: 환불 처리 일시 중단**

Admin 페이지에서 환불 승인 중단 (수동 검토 대기)

**Step 2: 의심 계정 조사**

```typescript
// Firestore 쿼리
refundRequests
  .where('status', '==', 'pending')
  .where('createdAt', '>', last24Hours)
  .orderBy('createdAt', 'desc')
```

**Step 3: IP/계정 차단**

의심 계정 정지 및 IP 블랙리스트 추가

**Step 4: 정상 환불 처리**

정상 사용자 환불 요청만 선별하여 처리

### 4. Firestore 한도 초과

#### 4.1 증상

- Firestore 읽기/쓰기 에러
- "Quota exceeded" 에러 메시지

#### 4.2 대응 절차

**Step 1: 사용량 확인**

Firebase Console → Usage → 현재 사용량 확인

**Step 2: 긴급 최적화**

- 불필요한 쿼리 제거
- 캐싱 활성화
- 읽기 횟수가 많은 쿼리 최적화

**Step 3: 한도 증액 요청**

Firebase Console → Usage → Request quota increase

**Step 4: 점검 모드 활성화 (필요 시)**

---

## 🔧 일상 운영 작업

### 1. 매일 작업

#### 1.1 모니터링 대시보드 확인 (09:00)

- Cloud Functions 에러율 확인
- Firestore 사용량 확인
- 결제 성공률 확인 (95% 이상 유지)

#### 1.2 환불 요청 검토 (10:00, 15:00)

- 새로운 환불 요청 확인
- 승인/거절 처리
- 사용자에게 결과 안내

#### 1.3 고객 문의 응대 (수시)

- 결제 문의
- 환불 문의
- 칩 관련 문의

### 2. 매주 작업

#### 2.1 시스템 성능 리포트 작성 (월요일)

```markdown
# 주간 성능 리포트 (2025-01-20 ~ 2025-01-26)

## 결제 통계
- 총 결제 건수: 120건
- 총 결제 금액: ₩660,000
- 평균 결제 금액: ₩5,500
- 결제 성공률: 98.3%

## 환불 통계
- 환불 요청: 5건
- 환불 승인: 3건
- 환불 거절: 2건
- 환불 금액: ₩16,500

## 시스템 성능
- Cloud Functions 평균 실행 시간: 2.3초
- 에러율: 0.5%
- Firestore 읽기: 3,500건
- Firestore 쓰기: 1,200건
```

#### 2.2 보안 점검 (금요일)

- 사기 의심 계정 조사
- IP 블랙리스트 검토
- 환불 패턴 분석

### 3. 매월 작업

#### 3.1 월간 정산 보고서 작성 (매월 1일)

```markdown
# 월간 정산 보고서 (2025년 1월)

## 수익
- 총 결제: ₩2,640,000
- 구독 수익: ₩1,500,000
- 칩 판매 수익: ₩1,140,000

## 비용
- 환불: ₩66,000 (2.5%)
- 결제 수수료: ₩79,200 (3%)
- Firebase 비용: ₩50,000

## 순이익
- ₩2,444,800
```

#### 3.2 데이터베이스 정리 (매월 1일)

- 90일 이상 된 거래 로그 아카이브
- 만료된 칩 내역 정리
- 비활성 사용자 데이터 정리

#### 3.3 Cloud Scheduler 점검 (매월 15일)

- 모든 스케줄 작업 실행 확인
- 실패 로그 검토
- 필요 시 재실행

---

## 💾 데이터 관리

### 1. 데이터 백업

#### 1.1 Firestore 백업

**자동 백업** (Cloud Scheduler):

```bash
# 매일 02:00 KST 자동 실행
gcloud firestore export gs://tholdem-ebc18-backups/$(date +%Y%m%d)
```

**수동 백업**:

```bash
# 즉시 백업
gcloud firestore export gs://tholdem-ebc18-backups/manual-backup-$(date +%Y%m%d-%H%M%S)
```

#### 1.2 백업 보관 정책

- **일일 백업**: 30일 보관
- **주간 백업**: 90일 보관
- **월간 백업**: 1년 보관

### 2. 데이터 복구

#### 2.1 Firestore 복구

**특정 시점으로 복구**:

```bash
# 2025-01-24 백업으로 복구
gcloud firestore import gs://tholdem-ebc18-backups/20250124
```

**특정 컬렉션만 복구**:

```bash
# paymentTransactions 컬렉션만 복구
gcloud firestore import gs://tholdem-ebc18-backups/20250124 \
  --collection-ids=paymentTransactions
```

#### 2.2 복구 시나리오

**시나리오 1: 실수로 데이터 삭제**
1. 최신 백업 확인
2. 해당 컬렉션/문서 복구
3. 데이터 무결성 검증

**시나리오 2: 데이터베이스 손상**
1. 서비스 점검 모드 활성화
2. 전체 데이터베이스 복구
3. 복구 후 데이터 검증
4. 서비스 재개

### 3. 데이터 정리

#### 3.1 아카이브 정책

**90일 이상 된 데이터**:

- `chipTransactions` → Cloud Storage 아카이브
- `notifications` (읽음 처리) → 삭제
- `rateLimits` (만료된 항목) → 자동 삭제 (Cloud Scheduler)

**아카이브 스크립트**:

```typescript
// functions/src/scheduled/archiveOldData.ts
export const archiveOldData = functions.pubsub
  .schedule('0 3 * * 0') // 매주 일요일 03:00 KST
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    // chipTransactions 아카이브
    const oldTransactions = await db
      .collection('chipTransactions')
      .where('timestamp', '<', cutoffDate)
      .get();

    const archiveData = oldTransactions.docs.map(doc => doc.data());

    // Cloud Storage에 저장
    const bucket = admin.storage().bucket();
    const file = bucket.file(`archives/chipTransactions-${Date.now()}.json`);
    await file.save(JSON.stringify(archiveData));

    // Firestore에서 삭제
    const batch = db.batch();
    oldTransactions.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    logger.info('데이터 아카이브 완료', { count: oldTransactions.size });
  });
```

---

## ⚡ 성능 관리

### 1. 성능 지표

#### 1.1 목표 성능

| 지표 | 목표 | 현재 |
|------|------|------|
| 결제 확인 시간 | < 3초 | 2.3초 ✅ |
| 환불 처리 시간 | < 5초 | 3.8초 ✅ |
| Firestore 쿼리 시간 | < 1초 | 0.5초 ✅ |
| Cloud Functions 콜드 스타트 | < 5초 | 3.2초 ✅ |

#### 1.2 성능 모니터링

**Google Cloud Console** → **Cloud Functions** → **Performance**

확인 지표:
- **실행 시간 분포**: 95%가 목표 시간 내
- **에러율**: < 1%
- **메모리 사용량**: < 256MB
- **동시 실행 수**: < 100

### 2. 성능 최적화

#### 2.1 Cloud Functions 최적화

**메모리 할당 증가**:

```bash
# 512MB로 증가 (필요 시)
gcloud functions deploy confirmPayment --memory=512MB
```

**타임아웃 증가**:

```bash
# 60초로 증가 (필요 시)
gcloud functions deploy confirmPayment --timeout=60s
```

**동시 실행 수 제한**:

```bash
# 최대 100개 동시 실행
gcloud functions deploy confirmPayment --max-instances=100
```

#### 2.2 Firestore 쿼리 최적화

**인덱스 생성**:

```bash
# firestore.indexes.json 배포
firebase deploy --only firestore:indexes
```

**쿼리 캐싱**:

```typescript
// 자주 조회되는 데이터 캐싱
const cache = new Map<string, any>();

async function getUserChips(userId: string) {
  if (cache.has(userId)) {
    return cache.get(userId);
  }

  const doc = await db.collection('chipBalance').doc(userId).get();
  const data = doc.data();
  cache.set(userId, data);

  return data;
}
```

#### 2.3 Rate Limiting 조정

**현재 제한**:

- `confirmPayment`: 5회/분
- `refundPayment`: 3회/분
- `sendPhoneVerificationCode`: 3회/분

**필요 시 조정**:

```typescript
// functions/src/utils/rateLimiter.ts
const RATE_LIMITS = {
  confirmPayment: 10, // 5 → 10으로 증가
  refundPayment: 5,   // 3 → 5로 증가
  sendPhoneVerificationCode: 5
};
```

---

## 🔒 보안 점검

### 1. 월간 보안 점검

#### 1.1 API 키 로테이션

**Toss Payments API 키** (6개월마다):

1. Toss Payments 대시보드 로그인
2. 새 API 키 생성
3. Firebase Functions 환경 변수 업데이트
4. Functions 재배포
5. 구 API 키 비활성화

```bash
# 새 API 키 설정
firebase functions:config:set toss.secret_key="NEW_SECRET_KEY"
firebase deploy --only functions
```

#### 1.2 Firebase Security Rules 검토

**Firestore Rules**:

```bash
# 현재 Rules 백업
firebase firestore:rules:get > firestore-rules-backup.txt

# Rules 테스트
firebase emulators:start --only firestore
```

검토 항목:
- 사용자가 자신의 데이터만 읽기/쓰기 가능한지
- Admin 권한이 올바르게 설정되었는지
- Rate Limiting이 적용되었는지

#### 1.3 로그 점검

**의심 활동 검색**:

```
# 실패한 결제 시도
resource.type="cloud_function"
resource.labels.function_name="confirmPayment"
severity>=ERROR

# Rate Limit 초과
textPayload=~"Rate limit exceeded"

# 금액 불일치
textPayload=~"Amount mismatch"
```

### 2. 보안 사고 대응

#### 2.1 API 키 유출 의심

**즉시 조치**:

1. **API 키 비활성화**
   - Toss Payments 대시보드 → API 키 비활성화
   - Firebase Console → Functions 환경 변수 삭제

2. **새 API 키 발급 및 배포**

3. **유출 경로 조사**
   - GitHub 커밋 이력 확인
   - 서버 로그 확인
   - 의심 IP 차단

4. **피해 확인**
   - 최근 24시간 거래 내역 확인
   - 비정상 거래 환불 처리

#### 2.2 대량 계정 생성 (봇 공격)

**탐지**:

```typescript
// 동일 IP에서 1시간 내 3개 이상 계정 생성
SELECT ip, COUNT(*) as count
FROM users
WHERE createdAt > NOW() - INTERVAL 1 HOUR
GROUP BY ip
HAVING count > 3
```

**대응**:

1. IP 차단 (blacklist 추가)
2. reCAPTCHA 강화
3. 생성된 계정 검토 및 정지

---

## 👥 고객 지원

### 1. 자주 묻는 질문 (FAQ)

#### Q1: 결제했는데 칩이 안 들어왔어요!

**A**: 다음을 확인해주세요:
1. 앱을 새로고침해주세요 (pull to refresh)
2. 로그아웃 후 다시 로그인
3. 여전히 안 들어온 경우 → 고객 지원 문의

**운영 조치**:
- Firestore `paymentTransactions` 확인
- Toss Payments 거래 내역 확인
- 칩이 지급되지 않았다면 수동 지급

#### Q2: 환불은 어떻게 하나요?

**A**:
1. 마이페이지 → 결제 내역 → 환불 요청
2. 7일 이내, 칩 사용 20% 미만 시 환불 가능
3. 수수료 20% 차감 후 환불
4. 처리 기간: 영업일 기준 1-3일

#### Q3: 구독을 취소하고 싶어요!

**A**:
1. 마이페이지 → 구독 관리 → 구독 취소
2. 다음 결제일부터 구독이 해지됩니다
3. 현재 기간의 칩은 계속 사용 가능

#### Q4: 칩이 사라졌어요!

**A**:
1. 칩 만료 확인:
   - Red Chip: 구매일로부터 90일
   - Blue Chip: 매월 1일 만료
2. 칩 사용 내역 확인:
   - 마이페이지 → 칩 사용 내역

#### Q5: 전화번호 인증이 안 돼요!

**A**:
1. 전화번호 형식 확인 (010-1234-5678)
2. 문자 수신 대기 (최대 5분)
3. 3회 실패 시 1시간 후 재시도
4. 여전히 안 되면 → 이메일 인증 사용

### 2. 고객 문의 처리

#### 2.1 문의 채널

- **이메일**: support@uniqn.com
- **앱 내 문의**: 마이페이지 → 고객 지원
- **카카오톡**: @uniqn (예정)

#### 2.2 응대 시간

- **평일**: 09:00 - 18:00 (점심시간 12:00-13:00 제외)
- **주말/공휴일**: 휴무

#### 2.3 응답 목표

- **긴급 문의** (결제 오류): 1시간 이내
- **일반 문의**: 24시간 이내
- **환불 요청**: 영업일 기준 1-3일

### 3. 고객 만족도 관리

#### 3.1 만족도 조사

환불 처리 완료 후 자동 발송:

```
환불 처리가 완료되었습니다.
서비스에 만족하셨나요?

⭐⭐⭐⭐⭐ (5점 만점)

개선 사항이 있다면 알려주세요:
[의견 입력란]
```

#### 3.2 불만 사항 처리

**높은 우선순위**:
- 결제 오류로 인한 손실
- 환불 지연
- 칩 미지급

**처리 절차**:
1. 즉시 조사 및 원인 파악
2. 24시간 이내 고객 응대
3. 보상 제공 (필요 시)
4. 재발 방지 조치

---

## 📝 부록

### A. 운영 체크리스트

#### 일일 체크리스트

- [ ] Cloud Functions 에러율 확인 (< 1%)
- [ ] Firestore 사용량 확인 (한도 내)
- [ ] 환불 요청 검토 및 처리
- [ ] 고객 문의 응대

#### 주간 체크리스트

- [ ] 주간 성능 리포트 작성
- [ ] 보안 점검 (사기 의심 계정 조사)
- [ ] Cloud Scheduler 실행 확인

#### 월간 체크리스트

- [ ] 월간 정산 보고서 작성
- [ ] 데이터베이스 정리 (90일 이상 된 데이터 아카이브)
- [ ] Cloud Scheduler 점검
- [ ] Firebase Security Rules 검토

### B. 긴급 연락처

| 역할 | 이름 | 연락처 | 이메일 |
|------|------|--------|--------|
| 시스템 관리자 | - | - | admin@uniqn.com |
| 보안 담당자 | - | - | security@uniqn.com |
| Toss Payments 지원 | - | 1544-7772 | support@tosspayments.com |
| Firebase 지원 | - | - | firebase-support@google.com |

### C. 관련 문서

- [결제 시스템 개발 문서](../PAYMENT_SYSTEM_DEVELOPMENT.md)
- [API 레퍼런스](../reference/API_REFERENCE.md)
- [데이터 스키마](../reference/DATA_SCHEMA.md)
- [보안 가이드](SECURITY.md)

---

**문서 버전**: v1.0.0
**최종 업데이트**: 2025-01-24
**작성자**: UNIQN 개발팀
