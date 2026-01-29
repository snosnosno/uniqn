# EAS Build 설정 가이드

> UNIQN Mobile 앱의 EAS Build 설정 및 배포 가이드

## 현재 설정 상태

| 항목 | 상태 | 비고 |
|------|:----:|------|
| eas.json | ✅ | development/preview/production 프로파일 |
| app.config.ts | ✅ | 환경별 동적 설정 |
| Firebase 설정 (Android) | ✅ | google-services.json |
| Firebase 설정 (iOS) | ✅ | GoogleService-Info.plist |
| expo-notifications | ✅ | 플러그인 활성화됨 |
| @react-native-firebase | ✅ | crashlytics, analytics 설치됨 |

---

## 1. 사전 요구사항

### 1.1 EAS CLI 설치
```bash
npm install -g eas-cli
```

### 1.2 Expo 계정 로그인
```bash
eas login
```

### 1.3 프로젝트 연결 확인
```bash
eas project:info
```

---

## 2. Credentials 설정

### 2.1 iOS Credentials

#### Apple Developer 계정 필요 정보
- **Apple ID**: Apple Developer 계정 이메일
- **App Store Connect App ID**: 앱 등록 후 발급
- **Team ID**: Apple Developer 계정의 Team ID

#### 설정 방법
```bash
# iOS credentials 설정 (대화형)
eas credentials --platform ios

# 또는 환경 변수로 설정
export APPLE_ID="your-apple-id@email.com"
export ASC_APP_ID="1234567890"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

#### Push Notification 인증서 (APNs)
1. Apple Developer Console → Certificates, Identifiers & Profiles
2. Keys → Create a new key
3. "Apple Push Notifications service (APNs)" 체크
4. 키 다운로드 (.p8 파일)
5. EAS에 등록:
```bash
eas credentials --platform ios
# "Push Notifications" 선택 → 키 업로드
```

### 2.2 Android Credentials

#### Google Play Console 설정
1. Google Play Console → 설정 → API 액세스
2. 서비스 계정 생성
3. JSON 키 다운로드 → `playstore-credentials.json`으로 저장

#### Keystore 설정
```bash
# Android credentials 설정 (대화형)
eas credentials --platform android

# EAS가 자동으로 keystore 생성 및 관리
# 또는 기존 keystore 업로드 가능
```

---

## 3. 빌드 프로파일

### 3.1 Development (개발용)
```bash
# iOS 시뮬레이터용
eas build --profile development --platform ios

# Android APK
eas build --profile development --platform android
```

**특징:**
- Development Client 포함
- 디버그 가능
- 내부 배포용

### 3.2 Preview (테스트용)
```bash
# 양 플랫폼 동시 빌드
eas build --profile preview --platform all
```

**특징:**
- 내부 테스터 배포용
- staging 환경 연결
- APK 형식 (Android)

### 3.3 Production (출시용)
```bash
# 스토어 제출용 빌드
eas build --profile production --platform all
```

**특징:**
- 앱스토어/플레이스토어 제출용
- 자동 버전 증가
- App Bundle 형식 (Android)

---

## 4. 앱 제출 (Submit)

### 4.1 iOS App Store
```bash
# App Store Connect에 제출
eas submit --platform ios --latest
```

### 4.2 Google Play Store
```bash
# Internal 트랙에 제출
eas submit --platform android --latest
```

### 4.3 환경 변수 설정
```bash
# .env.local 또는 EAS Secrets에 등록
APPLE_ID=your-apple-id@email.com
ASC_APP_ID=1234567890
APPLE_TEAM_ID=XXXXXXXXXX
```

EAS Secrets 등록:
```bash
eas secret:create --name APPLE_ID --value "your-apple-id@email.com"
eas secret:create --name ASC_APP_ID --value "1234567890"
eas secret:create --name APPLE_TEAM_ID --value "XXXXXXXXXX"
```

---

## 5. Firebase 설정

### 5.1 현재 설치된 Firebase 패키지
- `firebase` (12.6.0) - Modular API
- `@react-native-firebase/app` - 네이티브 코어
- `@react-native-firebase/crashlytics` - 크래시 리포팅
- `@react-native-firebase/analytics` - 이벤트 분석

### 5.2 Firebase Console 설정
1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택 (tholdem-ebc18)
3. iOS/Android 앱 등록 확인

### 5.3 설정 파일 위치
```
uniqn-mobile/
├── google-services.json      # Android
└── GoogleService-Info.plist  # iOS
```

---

## 6. Push Notification 설정

### 6.1 FCM 서버 키
1. Firebase Console → 프로젝트 설정 → Cloud Messaging
2. 서버 키 복사
3. 백엔드 서버에 설정

### 6.2 APNs 설정 (iOS)
1. Firebase Console → 프로젝트 설정 → Cloud Messaging
2. Apple 앱 구성 → APNs 인증 키 업로드
3. Team ID, Key ID 입력

---

## 7. 빌드 명령어 요약

```bash
# 개발 빌드
eas build --profile development --platform ios
eas build --profile development --platform android

# 테스트 빌드
eas build --profile preview --platform all

# 프로덕션 빌드
eas build --profile production --platform all

# 앱 제출
eas submit --platform ios --latest
eas submit --platform android --latest

# Credentials 관리
eas credentials --platform ios
eas credentials --platform android

# 빌드 상태 확인
eas build:list

# OTA 업데이트
eas update --branch production --message "버그 수정"
```

---

## 8. 체크리스트

### 빌드 전 확인사항
- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과
- [ ] Firebase 설정 파일 존재 확인
- [ ] 앱 버전 및 빌드 번호 확인 (app.config.ts)

### 제출 전 확인사항
- [ ] 앱 아이콘 및 스플래시 스크린
- [ ] 앱스토어 스크린샷 준비
- [ ] 개인정보처리방침 URL
- [ ] 앱 설명 및 키워드

---

## 9. 문제 해결

### 빌드 실패 시
```bash
# 캐시 클리어
eas build --clear-cache --profile development --platform ios
```

### Credentials 문제
```bash
# Credentials 리셋
eas credentials --platform ios
# "Remove credentials" 선택 후 재설정
```

### 네이티브 모듈 문제
```bash
# Prebuild 재실행
npx expo prebuild --clean
```

---

*마지막 업데이트: 2025-01-29*
