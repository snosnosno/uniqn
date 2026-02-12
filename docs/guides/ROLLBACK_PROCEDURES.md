# 배포 롤백 절차 가이드

**최종 업데이트**: 2026년 2월 1일
**버전**: v1.0.0 (모바일앱 중심 + RevenueCat 연동)
**상태**: ✅ **Production Ready**

> ⚠️ **참고**: 모바일앱은 **EAS Build** (Expo Application Services)로 빌드/배포됩니다.
> 앱스토어 배포 롤백은 각 스토어 콘솔에서 수행합니다.

> 📚 **관련 문서**:
> - 📋 **배포 가이드**: [DEPLOYMENT.md](./DEPLOYMENT.md)
> - 📊 **모니터링**: [MONITORING.md](../operations/MONITORING.md)
> - 🔧 **문제 해결**: [TROUBLESHOOTING.md](../operations/TROUBLESHOOTING.md)

---

## 📋 목차

1. [롤백 결정 기준](#-롤백-결정-기준)
2. [롤백 유형별 절차](#-롤백-유형별-절차)
3. [Firebase Hosting 롤백](#-firebase-hosting-롤백)
4. [Firebase Functions 롤백](#-firebase-functions-롤백)
5. [Firestore Rules 롤백](#-firestore-rules-롤백)
6. [데이터베이스 롤백](#-데이터베이스-롤백)
7. [긴급 대응 체크리스트](#-긴급-대응-체크리스트)
8. [사후 분석 (Post-mortem)](#-사후-분석-post-mortem)

---

## 🚨 롤백 결정 기준

### 즉시 롤백 (5분 이내)

| 증상 | 심각도 | 조치 |
|------|--------|------|
| 앱이 완전히 로드되지 않음 (화이트 스크린) | 🔴 Critical | 즉시 Hosting 롤백 |
| 로그인 불가능 | 🔴 Critical | 즉시 Functions 롤백 |
| 결제 오류 발생 | 🔴 Critical | 즉시 Functions 롤백 |
| Security Rules로 인한 액세스 거부 | 🔴 Critical | 즉시 Rules 롤백 |

### 빠른 롤백 (30분 이내)

| 증상 | 심각도 | 조치 |
|------|--------|------|
| 핵심 기능 작동 안함 (공고 작성, 지원 등) | 🟠 High | Hosting + Functions 롤백 |
| 실시간 업데이트 안됨 | 🟠 High | Functions 롤백 검토 |
| 에러율 10% 초과 | 🟠 High | 원인 파악 후 롤백 |

### 모니터링 후 결정 (1시간 이내)

| 증상 | 심각도 | 조치 |
|------|--------|------|
| 성능 저하 (로딩 3초 초과) | 🟡 Medium | 원인 분석 후 결정 |
| UI 버그 (기능 작동은 함) | 🟡 Medium | 핫픽스 또는 롤백 |
| 에러율 5-10% | 🟡 Medium | 원인 분석 후 결정 |

---

## 🔄 롤백 유형별 절차

### 롤백 우선순위

```
1. Firebase Hosting (프론트엔드)  → 가장 빠름, 사용자 영향 최소화
2. Firebase Functions (백엔드)   → 함수 단위 롤백 가능
3. Firestore Rules (보안)        → 즉시 적용, 데이터 보호
4. Firestore Data (데이터)       → 최후의 수단, 복잡함
```

---

## 🌐 Firebase Hosting 롤백

### 방법 1: Firebase Console (권장)

1. [Firebase Console](https://console.firebase.google.com) 접속
2. **프로젝트 선택** → `tholdem-ebc18`
3. **Hosting** 메뉴 클릭
4. **릴리즈 기록** 탭 선택
5. 롤백할 버전의 **...** 메뉴 클릭
6. **이 버전으로 롤백** 선택
7. **롤백** 확인

### 방법 2: Firebase CLI

```bash
# 현재 호스팅 채널 목록 확인
firebase hosting:channel:list

# 릴리즈 기록 확인
firebase hosting:releases:list --limit 10

# 특정 버전으로 롤백 (version_id는 위 명령어에서 확인)
firebase hosting:clone tholdem-ebc18:VERSION_ID tholdem-ebc18:live
```

### 방법 3: Git + 재배포

```bash
# 1. 안정적인 커밋으로 체크아웃
git checkout v0.2.3  # 또는 특정 커밋 해시

# 2. 재빌드
cd app2
npm run build

# 3. 재배포
cd ..
firebase deploy --only hosting
```

### 롤백 후 확인

```bash
# 배포 상태 확인
firebase hosting:channel:list

# 브라우저에서 확인
# https://tholdem-ebc18.web.app 접속
```

---

## ⚡ Firebase Functions 롤백

### 방법 1: 이전 버전 재배포

```bash
# 1. 안정적인 커밋으로 체크아웃
git checkout v0.2.3

# 2. 종속성 설치
cd functions
npm install

# 3. 함수 재배포
firebase deploy --only functions
```

### 방법 2: 특정 함수만 롤백

```bash
# 특정 함수만 재배포
firebase deploy --only functions:sendWorkAssignmentNotification

# 여러 함수 재배포
firebase deploy --only functions:sendWorkAssignmentNotification,functions:confirmPayment
```

### 방법 3: 함수 비활성화 (긴급)

```bash
# 함수 삭제 (트래픽 즉시 차단)
firebase functions:delete sendWorkAssignmentNotification --force

# 주의: 삭제 후 재배포 필요
```

### 함수 로그 확인

```bash
# 실시간 로그
firebase functions:log

# 에러만 필터링
firebase functions:log | grep -E "ERROR|WARN"
```

---

## 🔐 Firestore Rules 롤백

### 방법 1: 이전 규칙 파일 복원

```bash
# 1. Git에서 이전 규칙 파일 복원
git checkout HEAD~1 -- firestore.rules

# 2. 규칙 재배포
firebase deploy --only firestore:rules
```

### 방법 2: Firebase Console에서 직접 수정

1. Firebase Console → Firestore → **규칙** 탭
2. 이전 규칙으로 직접 수정
3. **게시** 클릭

### 긴급 허용 규칙 (임시)

```javascript
// ⚠️ 주의: 개발/디버깅용 - 프로덕션에서 장시간 사용 금지
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### 규칙 테스트

```bash
# 규칙 테스트 실행
firebase emulators:exec --only firestore "npm run test:rules"
```

---

## 💾 데이터베이스 롤백

### ⚠️ 주의사항

- 데이터베이스 롤백은 **최후의 수단**
- 데이터 손실 위험이 있음
- 가능하면 **특정 문서만 수정**하는 것을 권장

### 방법 1: 특정 문서 복원 (권장)

```typescript
// Admin SDK 사용
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

// 백업에서 특정 문서 복원
const backupData = { /* 백업된 데이터 */ };
await db.doc('users/USER_ID').set(backupData, { merge: true });
```

### 방법 2: Firestore 내보내기/가져오기

```bash
# 1. 기존 백업 확인 (Cloud Storage)
gsutil ls gs://tholdem-ebc18-backups/

# 2. 백업에서 복원 (전체 컬렉션)
gcloud firestore import gs://tholdem-ebc18-backups/2025-11-26
```

### 방법 3: 포인트-인-타임 복구 (Blaze 플랜)

Firebase Console → Firestore → **백업** → **복원** 선택

---

## ✅ 긴급 대응 체크리스트

### 🔴 심각도: Critical (즉시 대응)

```
□ 1. 문제 확인 및 범위 파악 (2분)
□ 2. 팀원 알림 (Slack/카톡)
□ 3. 롤백 결정
□ 4. 롤백 실행 (아래 선택)
   □ Hosting 롤백
   □ Functions 롤백
   □ Rules 롤백
□ 5. 롤백 성공 확인
   □ 사이트 접속 테스트
   □ 핵심 기능 테스트 (로그인, 공고 조회)
□ 6. 사용자 공지 (필요시)
□ 7. 사후 분석 일정 수립
```

### 🟠 심각도: High (30분 내 대응)

```
□ 1. 문제 상세 로그 수집
□ 2. 영향 범위 파악
□ 3. 핫픽스 vs 롤백 결정
□ 4. 조치 실행
□ 5. 모니터링 강화
```

### 🟡 심각도: Medium (1시간 내 대응)

```
□ 1. 문제 재현 및 원인 분석
□ 2. 수정 방안 수립
□ 3. 스테이징 테스트
□ 4. 조치 실행
```

---

## 📝 사후 분석 (Post-mortem)

### 필수 기록 항목

```markdown
## 인시던트 보고서

**날짜**: YYYY-MM-DD HH:mm
**심각도**: Critical / High / Medium
**영향 시간**: X분 / X시간
**영향 사용자 수**: 약 XX명

### 타임라인
- HH:mm - 문제 감지
- HH:mm - 롤백 결정
- HH:mm - 롤백 완료
- HH:mm - 서비스 정상화 확인

### 근본 원인
[원인 상세 설명]

### 대응 내용
[수행한 조치 상세]

### 재발 방지 대책
1. [대책 1]
2. [대책 2]
3. [대책 3]

### 교훈
[배운 점]
```

### 사후 분석 회의 (권장)

- **참석자**: 배포 담당자, 개발자, (필요시) 관리자
- **시기**: 인시던트 해결 후 24-48시간 이내
- **목적**: 원인 분석, 재발 방지, 프로세스 개선

---

## 🔗 빠른 참조

### 롤백 명령어 요약

```bash
# Hosting 롤백
firebase hosting:clone tholdem-ebc18:VERSION_ID tholdem-ebc18:live

# Functions 롤백 (전체)
git checkout v0.2.3 && cd functions && npm install && firebase deploy --only functions

# Functions 롤백 (특정 함수)
firebase deploy --only functions:FUNCTION_NAME

# Rules 롤백
git checkout HEAD~1 -- firestore.rules && firebase deploy --only firestore:rules
```

### 주요 링크

- [Firebase Console](https://console.firebase.google.com/project/tholdem-ebc18)
- [Hosting 릴리즈 기록](https://console.firebase.google.com/project/tholdem-ebc18/hosting/sites)
- [Functions 대시보드](https://console.firebase.google.com/project/tholdem-ebc18/functions)
- [Firestore Rules](https://console.firebase.google.com/project/tholdem-ebc18/firestore/rules)

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2025-11-27 | 1.0.0 | 초기 문서 작성 |

---

*작성자: Claude (Sonnet 4.5)*
*최종 검토: 2025년 11월 27일*
