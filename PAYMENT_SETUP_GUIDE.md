# 🔧 T-HOLDEM 결제 시스템 설정 가이드

> **작성일**: 2025-01-23
> **대상**: 개발자, DevOps 담당자
> **소요 시간**: 약 30분

---

## 📋 사전 준비물

1. **토스페이먼츠 계정**
   - 회원가입: https://developers.tosspayments.com/
   - 테스트/프로덕션 API 키 발급

2. **Firebase 프로젝트**
   - 프로젝트 ID: `tholdem-ebc18`
   - Firebase CLI 설치: `npm install -g firebase-tools`
   - Firebase 로그인: `firebase login`

3. **권한**
   - Firebase 프로젝트 Owner 권한
   - 토스페이먼츠 개발자 센터 접근 권한

---

## 🔑 Step 1: 토스페이먼츠 API 키 발급

### 1-1. 개발자 센터 접속

```
https://developers.tosspayments.com/my/api-keys
```

### 1-2. API 키 확인

**테스트 환경 (개발용)**:
- 클라이언트 키: `test_ck_xxxxxxxxxx`
- 시크릿 키: `test_sk_xxxxxxxxxx`

**프로덕션 환경**:
- 클라이언트 키: `live_ck_xxxxxxxxxx`
- 시크릿 키: `live_sk_xxxxxxxxxx`

> ⚠️ **주의**: 시크릿 키는 절대 프론트엔드에 노출하지 마세요!

---

## 🔧 Step 2: 프론트엔드 환경변수 설정

### 2-1. .env 파일 생성

```bash
cd app2
cp .env.example .env
```

### 2-2. 토스페이먼츠 클라이언트 키 설정

**파일**: `app2/.env`

```env
# 토스페이먼츠 클라이언트 키 (테스트)
REACT_APP_TOSS_CLIENT_KEY=test_ck_xxxxxxxxxx

# 프로덕션 배포 시
# REACT_APP_TOSS_CLIENT_KEY=live_ck_xxxxxxxxxx
```

### 2-3. 설정 확인

```bash
# .env 파일이 .gitignore에 포함되어 있는지 확인
cat .gitignore | grep ".env"

# 출력: .env (있어야 함)
```

---

## 🔐 Step 3: Firebase Functions 환경변수 설정

### 3-1. 토스페이먼츠 시크릿 키 설정

**명령어**:

```bash
# 테스트 환경
firebase functions:config:set toss.secret_key="test_sk_xxxxxxxxxx"

# 프로덕션 환경
firebase functions:config:set toss.secret_key="live_sk_xxxxxxxxxx"
```

### 3-2. 설정 확인

```bash
firebase functions:config:get

# 출력:
# {
#   "toss": {
#     "secret_key": "test_sk_xxxxxxxxxx"
#   }
# }
```

### 3-3. 로컬 개발 환경 설정 (선택사항)

**파일**: `functions/.runtimeconfig.json`

```json
{
  "toss": {
    "secret_key": "test_sk_xxxxxxxxxx"
  }
}
```

> ⚠️ **주의**: `.runtimeconfig.json`은 Git에 커밋하지 마세요!

---

## 🔒 Step 4: Firestore Security Rules 업데이트

### 4-1. Security Rules 파일 수정

**파일**: `firestore.rules`

다음 규칙을 추가합니다:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ========================================
    // 결제 관련 규칙
    // ========================================

    // 결제 기록 (payments)
    match /payments/{paymentId} {
      // 읽기: 본인의 결제 기록만 조회 가능
      allow read: if request.auth != null
                  && request.auth.uid == resource.data.userId;

      // 쓰기: 서버 측에서만 생성 가능 (Firebase Functions)
      allow write: if false;
    }

    // 사용자별 칩 잔액 (users/{userId}/chipBalance)
    match /users/{userId}/chipBalance/{document=**} {
      // 읽기: 본인의 칩 잔액만 조회 가능
      allow read: if request.auth != null
                  && request.auth.uid == userId;

      // 쓰기: 서버 측에서만 수정 가능 (Firebase Functions)
      allow write: if false;
    }

    // 사용자별 칩 거래 내역 (users/{userId}/chipTransactions)
    match /users/{userId}/chipTransactions/{document=**} {
      // 읽기: 본인의 거래 내역만 조회 가능
      allow read: if request.auth != null
                  && request.auth.uid == userId;

      // 쓰기: 서버 측에서만 생성 가능 (Firebase Functions)
      allow write: if false;
    }

    // ... 기존 규칙 유지 ...
  }
}
```

### 4-2. Security Rules 배포

```bash
firebase deploy --only firestore:rules
```

### 4-3. 배포 확인

```bash
# Firebase 콘솔에서 확인
# https://console.firebase.google.com/project/tholdem-ebc18/firestore/rules
```

---

## 🚀 Step 5: Firebase Functions 배포

### 5-1. Functions 빌드

```bash
cd functions
npm run build
```

### 5-2. Functions 배포

**전체 배포**:
```bash
npm run deploy
```

**결제 관련 Functions만 배포**:
```bash
firebase deploy --only functions:confirmPayment,functions:manualGrantChips
```

### 5-3. 배포 확인

```bash
firebase functions:list

# 출력 예시:
# ┌──────────────────────┬────────────────┬─────────────┐
# │ Function Name        │ Version        │ Trigger     │
# ├──────────────────────┼────────────────┼─────────────┤
# │ confirmPayment       │ 1              │ HTTPS       │
# │ manualGrantChips     │ 1              │ HTTPS       │
# └──────────────────────┴────────────────┴─────────────┘
```

---

## ✅ Step 6: 설정 검증

### 6-1. 환경변수 확인 체크리스트

- [ ] 프론트엔드 `.env` 파일에 `REACT_APP_TOSS_CLIENT_KEY` 설정됨
- [ ] Firebase Functions에 `toss.secret_key` 설정됨
- [ ] `.env` 파일이 `.gitignore`에 포함됨
- [ ] `.runtimeconfig.json` 파일이 `.gitignore`에 포함됨 (생성한 경우)

### 6-2. Security Rules 확인 체크리스트

- [ ] `payments` 컬렉션 규칙 추가됨
- [ ] `users/{userId}/chipBalance` 규칙 추가됨
- [ ] `users/{userId}/chipTransactions` 규칙 추가됨
- [ ] Security Rules 배포됨

### 6-3. Functions 확인 체크리스트

- [ ] `confirmPayment` 함수 배포됨
- [ ] `manualGrantChips` 함수 배포됨
- [ ] Functions 로그 확인 (에러 없음)

---

## 🧪 Step 7: 테스트

### 7-1. 로컬 테스트 (에뮬레이터)

```bash
# Firebase 에뮬레이터 실행
cd functions
npm run serve

# 다른 터미널에서 프론트엔드 실행
cd app2
npm start
```

### 7-2. 테스트 시나리오

1. **결제 승인 테스트**:
   - 칩 충전 페이지 접속 (`/chip/recharge`)
   - 패키지 선택 및 결제
   - 토스페이먼츠 테스트 카드 사용
   - 결제 성공 확인

2. **칩 지급 확인**:
   - 프로필 페이지에서 칩 잔액 확인
   - Firestore에서 `chipBalance` 확인
   - `chipTransactions` 기록 확인

3. **에러 처리 테스트**:
   - 잘못된 금액으로 결제 시도
   - 중복 결제 시도
   - 네트워크 오류 시뮬레이션

### 7-3. 토스페이먼츠 테스트 카드

| 카드사 | 카드번호 | 유효기간 | CVC | 비밀번호 |
|--------|----------|----------|-----|----------|
| 신한 | 5570 0000 0000 0001 | 25/12 | 123 | 00 |
| 국민 | 9430 0000 0000 0008 | 25/12 | 123 | 00 |
| 하나 | 5410 0000 0000 0009 | 25/12 | 123 | 00 |

> 📌 **상세 정보**: https://docs.tosspayments.com/resources/test-card

---

## 🐛 문제 해결

### 문제 1: "토스페이먼츠 클라이언트 키가 설정되지 않았습니다"

**원인**: `.env` 파일에 클라이언트 키가 없음

**해결**:
```bash
cd app2
echo "REACT_APP_TOSS_CLIENT_KEY=test_ck_xxxxxxxxxx" >> .env
npm start  # 재시작 필수
```

### 문제 2: "결제 시스템 설정 오류"

**원인**: Firebase Functions에 시크릿 키가 없음

**해결**:
```bash
firebase functions:config:set toss.secret_key="test_sk_xxxxxxxxxx"
firebase deploy --only functions
```

### 문제 3: "permission-denied" 에러

**원인**: Firestore Security Rules 미배포

**해결**:
```bash
firebase deploy --only firestore:rules
```

### 문제 4: Functions 배포 실패

**원인**: TypeScript 컴파일 에러

**해결**:
```bash
cd functions
npm run build  # 에러 확인
npm run lint   # 린트 에러 수정
npm run deploy
```

---

## 📚 추가 리소스

### 공식 문서
- [토스페이먼츠 개발 가이드](https://docs.tosspayments.com/)
- [Firebase Functions 문서](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

### 프로젝트 문서
- [결제 시스템 체크리스트](./PAYMENT_SYSTEM_CHECKLIST.md)
- [개발 가이드](./docs/core/DEVELOPMENT_GUIDE.md)
- [API 레퍼런스](./docs/reference/API_REFERENCE.md)

---

## ✅ 설정 완료 체크리스트

전체 설정을 완료했다면 다음 항목을 체크하세요:

- [ ] 토스페이먼츠 API 키 발급 완료
- [ ] 프론트엔드 `.env` 파일 설정 완료
- [ ] Firebase Functions 환경변수 설정 완료
- [ ] Firestore Security Rules 배포 완료
- [ ] Firebase Functions 배포 완료
- [ ] 로컬 테스트 성공
- [ ] 테스트 카드 결제 성공
- [ ] 칩 지급 확인 완료

**모든 항목이 체크되면 프로덕션 배포 준비가 완료됩니다!** 🎉

---

**마지막 업데이트**: 2025-01-23
**작성자**: Claude Code
**버전**: 1.0.0
