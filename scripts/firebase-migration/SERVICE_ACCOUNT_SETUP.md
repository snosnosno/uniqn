# Firebase 서비스 계정 설정 가이드

## 서비스 계정 키 다운로드 방법

Firebase Admin SDK를 사용하여 백업/복원을 수행하려면 서비스 계정 키가 필요합니다.

### 1. Firebase Console에서 서비스 계정 키 다운로드

1. [Firebase Console](https://console.firebase.google.com)에 로그인
2. T-HOLDEM 프로젝트 선택
3. **프로젝트 설정** (톱니바퀴 아이콘) 클릭
4. **서비스 계정** 탭 선택
5. **새 비공개 키 생성** 버튼 클릭
6. 경고 메시지 확인 후 **키 생성** 클릭
7. JSON 파일이 다운로드됨

### 2. 서비스 계정 키 파일 배치

다운로드한 JSON 파일을 프로젝트 루트에 배치:

```bash
# 파일명을 firebase-service-account.json으로 변경
T-HOLDEM/
├── firebase-service-account.json  # ← 여기에 배치
├── app2/
├── scripts/
└── ...
```

### 3. 보안 확인

⚠️ **중요**: 서비스 계정 키는 매우 민감한 정보입니다!

- ✅ `.gitignore`에 이미 추가됨
- ❌ 절대 Git에 커밋하지 마세요
- ❌ 공개 저장소에 업로드하지 마세요
- ✅ 로컬에서만 사용하세요

### 4. 백업 실행

서비스 계정 키를 배치한 후:

```bash
cd app2
npm run backup:admin
```

## 대체 방법

서비스 계정 키 없이 백업하려면:

1. **Firebase Emulator 사용**
   - 로컬 에뮬레이터에서 데이터 내보내기
   ```bash
   firebase emulators:export ./backup
   ```

2. **Firebase CLI 사용**
   - gcloud CLI로 직접 백업
   ```bash
   gcloud firestore export gs://your-bucket/backup
   ```

3. **수동 백업**
   - Firebase Console에서 수동으로 데이터 내보내기
   - Firestore > 설정 > 가져오기/내보내기

## 문제 해결

### 권한 오류
- Firebase Console에서 IAM 권한 확인
- 서비스 계정에 다음 역할 부여:
  - Cloud Datastore User
  - Firebase Admin SDK Administrator Service Agent

### 파일 찾을 수 없음
- 경로 확인: `firebase-service-account.json`
- 환경 변수 설정: `FIREBASE_SERVICE_ACCOUNT_KEY=path/to/key.json`