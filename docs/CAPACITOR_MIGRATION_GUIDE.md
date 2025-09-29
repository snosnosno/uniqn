# T-HOLDEM Capacitor Migration Guide

> T-HOLDEM 웹 애플리케이션을 Capacitor를 사용한 iOS/Android 네이티브 앱으로 전환하는 체계적인 가이드

## 📌 개요

- **프로젝트**: T-HOLDEM (홀덤 포커 토너먼트 관리 플랫폼)
- **현재 상태**: React 18 + TypeScript + Firebase 웹 애플리케이션
- **목표**: Capacitor를 통한 iOS/Android 앱 배포
- **예상 기간**: 7-10일
- **코드 재사용률**: 95% 이상
- **진행 상황**: 🎉 **Phase 1 완료** (2025-09-30)
- **현재 브랜치**: `feature/capacitor-migration`

---

## 🎯 Phase 0: 사전 준비 및 프로젝트 최적화

### **0.1 프로젝트 분석 및 정리** ✅ 체크리스트

#### **불필요한 문서 정리**
- [x] `/docs/EXPO_MOBILE_PLAN.md` - 사용하지 않는 Expo 계획 (삭제 완료)
- [x] `/docs/SUBSCRIPTION_MODEL.md` - 미구현 구독 모델 (보관으로 복구 완료)
- [x] `/docs/mobile/` 디렉토리 - 빈 디렉토리 (삭제 완료)
- [x] 기타 미사용 문서 확인 및 정리

#### **코드 최적화**
- [x] 사용하지 않는 import 제거
- [x] Dead code 제거 (QRScannerModal.tsx 등)
- [x] Console.log → logger로 완전 교체 확인 (performanceTest.js)
- [x] TypeScript any 타입 최종 점검 (빌드 에러 수정)

#### **패키지 정리**
```bash
# 패키지 분석 명령어
npm ls --depth=0  # 설치된 패키지 목록
npm outdated      # 오래된 패키지 확인
```

- [x] 미사용 패키지 확인
  - [x] `react-qr-scanner` - QR 스캔 사용 안함 (제거 완료)
  - [x] `xlsx` - 엑셀 내보내기 기능에서 사용 중 (유지)
  - [x] `@dnd-kit` - 테이블 드래그앤드롭 기능에서 사용 중 (유지)
- [x] 패키지 버전 업데이트 (Capacitor 7.4.3 설치)
- [x] package-lock.json 재생성

#### **번들 크기 최적화**
```bash
# 번들 분석
npm run build
npm install -g source-map-explorer
source-map-explorer build/static/js/*.js
```

- [ ] 큰 라이브러리 dynamic import 처리
- [ ] 이미지 최적화 (WebP 변환)
- [ ] 미사용 CSS 제거

### **0.2 환경 설정 준비**

#### **개발 환경 체크**
- [x] Node.js 22.15.0 설치 확인 ✅
- [x] npm 10.9.2 최신 버전 ✅
- [x] Git 설정 확인 ✅

#### **모바일 개발 환경** (선택적)
- [ ] Xcode 설치 (Mac만 해당)
- [ ] Android Studio 설치
- [ ] Java JDK 11+ 설치

### **0.3 백업 및 브랜치 생성**
- [x] 현재 코드 전체 백업 ✅
- [x] `feature/capacitor-migration` 브랜치 생성 ✅
- [x] .gitignore 업데이트 완료 ✅

---

## 📱 Phase 1: Capacitor 기본 설정 ✅ **완료됨 (2025-09-30)**

### **1.1 Capacitor 설치**

```bash
# Capacitor 코어 패키지 설치
npm install @capacitor/core
npm install -D @capacitor/cli
```

- [x] @capacitor/core 설치 ✅
- [x] @capacitor/cli 설치 ✅
- [x] package.json 확인 ✅

### **1.2 Capacitor 초기화**

```bash
# Capacitor 프로젝트 초기화
npx cap init "T-HOLDEM" "com.tholdem.app" --web-dir build
```

설정 값:
- [x] App name: "T-HOLDEM" ✅
- [x] App Package ID: "com.tholdem.app" ✅
- [x] Web Directory: "build" (React 빌드 출력 디렉토리) ✅

### **1.3 플랫폼 추가**

```bash
# 플랫폼 패키지 설치 (먼저 필요)
npm install @capacitor/ios @capacitor/android

# iOS/Android 플랫폼 추가
npx cap add ios
npx cap add android
```

- [x] iOS 플랫폼 추가 ✅
- [x] Android 플랫폼 추가 ✅
- [x] 생성된 네이티브 프로젝트 확인 ✅

### **1.4 기본 빌드 테스트**

```bash
# 웹 애플리케이션 빌드
npm run build

# Capacitor 동기화
npx cap sync

# 플랫폼별 실행
npx cap open ios     # Xcode 열기
npx cap open android # Android Studio 열기
```

- [x] 웹 빌드 성공 ✅ (283.33 KB gzipped)
- [x] Capacitor sync 성공 ✅
- [ ] iOS 시뮬레이터 실행 테스트 (Windows 환경에서 불가능)
- [ ] Android 에뮬레이터 실행 테스트 (Android Studio 설치 필요)

### **✅ Phase 1 완료 요약 (2025-09-30)**

#### **🎉 성과 지표**
- **총 파일 변경**: 73개 파일, 2,435줄 추가
- **번들 크기**: 283.33 KB (gzipped) - 최적화됨
- **빌드 상태**: ✅ 성공 (일부 lint 경고는 정상 범위)
- **Capacitor 버전**: 7.4.3 (최신)
- **브랜치**: `feature/capacitor-migration` → GitHub 푸시 완료

#### **📁 생성된 주요 구조**
```
app2/
├── capacitor.config.ts           # 최적화된 Capacitor 설정
├── android/                      # Android 네이티브 프로젝트
├── ios/                          # iOS 네이티브 프로젝트
├── build/                        # React 빌드 출력
└── package.json                  # Capacitor 의존성 추가
```

#### **🔧 설치된 패키지**
- `@capacitor/core`: ^7.4.3
- `@capacitor/cli`: ^7.4.3
- `@capacitor/ios`: ^7.4.3
- `@capacitor/android`: ^7.4.3

#### **⚙️ 최적화 설정**
- HTTPS 스키마 설정 (Android)
- 자동 content inset (iOS)
- 웹 콘텐츠 디버깅 비활성화 (프로덕션)
- .gitignore 보안 파일 제외 규칙 추가

#### **🧪 테스트 방법 (Windows 환경)**
```bash
# 웹 브라우저 모바일 모드 테스트
cd app2 && npm start
# Chrome DevTools → 📱 아이콘 → iPhone 선택

# Android 에뮬레이터 테스트 (Android Studio 필요)
cd app2 && npm run build && npx cap sync && npx cap open android
```

---

## 🔧 Phase 2: 핵심 기능 통합

### **2.1 Firebase 설정**

#### **Firebase 프로젝트 설정**
- [ ] Firebase Console에서 iOS 앱 추가
  - [ ] Bundle ID: com.tholdem.app
  - [ ] GoogleService-Info.plist 다운로드
- [ ] Firebase Console에서 Android 앱 추가
  - [ ] Package name: com.tholdem.app
  - [ ] google-services.json 다운로드

#### **네이티브 설정 파일 배치**
- [ ] iOS: `ios/App/App/GoogleService-Info.plist`
- [ ] Android: `android/app/google-services.json`

### **2.2 푸시 알림 설정**

```bash
# 푸시 알림 플러그인 설치
npm install @capacitor/push-notifications
```

#### **iOS 설정**
- [ ] Apple Developer 계정에서 Push Notification 인증서 생성
- [ ] Firebase Console에 APNs 인증서 업로드
- [ ] Xcode에서 Push Notifications capability 활성화

#### **Android 설정**
- [ ] Firebase Cloud Messaging 자동 설정 확인
- [ ] AndroidManifest.xml 권한 확인

#### **코드 통합**
```typescript
// src/services/notifications.ts
import { PushNotifications } from '@capacitor/push-notifications';

export const initializePushNotifications = async () => {
  // 권한 요청
  await PushNotifications.requestPermissions();

  // 토큰 등록
  await PushNotifications.register();

  // FCM 토큰 수신
  PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token: ' + token.value);
  });
};
```

- [ ] 푸시 알림 서비스 파일 생성
- [ ] App.tsx에 초기화 코드 추가
- [ ] Firestore에 FCM 토큰 저장 로직

### **2.3 카메라 기능**

```bash
# 카메라 플러그인 설치
npm install @capacitor/camera
```

- [ ] 카메라 플러그인 설치
- [ ] iOS Info.plist 권한 설명 추가
- [ ] Android 권한 설정
- [ ] 카메라 서비스 파일 생성

### **2.4 QR 스캐너**

```bash
# 바코드 스캐너 플러그인 설치
npm install @capacitor-community/barcode-scanner
```

- [ ] 바코드 스캐너 설치
- [ ] 권한 설정
- [ ] QR 스캔 컴포넌트 업데이트

### **2.5 로컬 알림**

```bash
# 로컬 알림 플러그인 설치
npm install @capacitor/local-notifications
```

- [ ] 로컬 알림 설치
- [ ] 승인 요청 알림 구현

---

## 🎨 Phase 3: UI/UX 최적화

### **3.1 앱 아이콘 및 스플래시 스크린**

#### **아이콘 준비**
- [ ] 1024x1024 원본 아이콘 제작
- [ ] iOS 아이콘 세트 생성 (모든 크기)
- [ ] Android 아이콘 세트 생성 (adaptive icon)

#### **스플래시 스크린**
```bash
npm install @capacitor/splash-screen
```
- [ ] 2732x2732 스플래시 이미지 제작
- [ ] iOS 스플래시 설정
- [ ] Android 스플래시 설정

### **3.2 Safe Area 처리**

```css
/* Safe area CSS 변수 활용 */
.app-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] iOS notch 대응
- [ ] Android 시스템 바 대응
- [ ] 전체 레이아웃 점검

### **3.3 네이티브 UI 요소**

- [ ] 상태바 스타일 설정
- [ ] 네비게이션 바 색상
- [ ] 키보드 처리 최적화

---

## 🚀 Phase 4: 성능 최적화

### **4.1 웹뷰 최적화**

#### **Capacitor 설정 최적화**
```json
// capacitor.config.json
{
  "server": {
    "androidScheme": "https",
    "iosScheme": "capacitor"
  },
  "ios": {
    "contentInset": "automatic"
  },
  "android": {
    "webContentsDebuggingEnabled": false
  }
}
```

- [ ] HTTPS 스키마 설정
- [ ] 디버깅 비활성화 (프로덕션)
- [ ] 콘텐츠 인셋 최적화

### **4.2 번들 크기 최적화**

- [ ] 코드 스플리팅 적용
- [ ] Tree shaking 확인
- [ ] 이미지 lazy loading
- [ ] 폰트 최적화

### **4.3 오프라인 지원**

```typescript
// Firebase 오프라인 지속성
import { enableIndexedDbPersistence } from 'firebase/firestore';

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // 여러 탭이 열려있는 경우
  } else if (err.code === 'unimplemented') {
    // 브라우저가 지원하지 않는 경우
  }
});
```

- [ ] Firebase 오프라인 캐싱 설정
- [ ] Service Worker 설정
- [ ] 오프라인 UI 처리

---

## 📦 Phase 5: 빌드 및 배포 준비

### **5.1 앱 정보 설정**

#### **iOS 설정 (Info.plist)**
- [ ] Display Name 설정
- [ ] Bundle Version 설정
- [ ] 권한 설명 문구 작성
- [ ] URL Schemes 설정

#### **Android 설정 (AndroidManifest.xml)**
- [ ] 앱 이름 설정
- [ ] 버전 코드/이름 설정
- [ ] 권한 선언
- [ ] 인텐트 필터 설정

### **5.2 앱 서명**

#### **iOS 서명**
- [ ] Apple Developer 계정 준비
- [ ] App ID 생성
- [ ] Provisioning Profile 생성
- [ ] 인증서 설정

#### **Android 서명**
```bash
# Keystore 생성
keytool -genkey -v -keystore tholdem-release.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias tholdem
```

- [ ] Keystore 파일 생성
- [ ] gradle 서명 설정
- [ ] ProGuard 설정

### **5.3 앱스토어 준비**

#### **App Store (iOS)**
- [ ] App Store Connect 앱 생성
- [ ] 스크린샷 준비 (모든 크기)
- [ ] 앱 설명 작성
- [ ] 키워드 선정
- [ ] 심사 정보 준비

#### **Google Play Store**
- [ ] Google Play Console 앱 생성
- [ ] 스크린샷 준비
- [ ] 그래픽 자산 준비
- [ ] 스토어 등록정보 작성
- [ ] 콘텐츠 등급 설정

---

## 🧪 Phase 6: 테스트

### **6.1 기능 테스트**

#### **핵심 기능 체크리스트**
- [ ] 로그인/회원가입
- [ ] 구인공고 CRUD
- [ ] 지원서 관리
- [ ] 스태프 관리
- [ ] 출석 체크
- [ ] 급여 계산
- [ ] 푸시 알림
- [ ] QR 스캔
- [ ] 카메라 촬영

### **6.2 디바이스 테스트**

#### **iOS 테스트**
- [ ] iPhone SE (작은 화면)
- [ ] iPhone 14 (일반)
- [ ] iPhone 14 Pro Max (큰 화면)
- [ ] iPad (태블릿)

#### **Android 테스트**
- [ ] 저사양 디바이스
- [ ] 중간 사양 디바이스
- [ ] 최신 플래그십
- [ ] 태블릿

### **6.3 성능 테스트**
- [ ] 앱 시작 시간 측정
- [ ] 메모리 사용량 모니터링
- [ ] 배터리 소모 확인
- [ ] 네트워크 사용량 체크

---

## 🚢 Phase 7: 배포

### **7.1 베타 테스트**

#### **TestFlight (iOS)**
- [ ] 베타 빌드 업로드
- [ ] 내부 테스터 초대
- [ ] 외부 테스터 그룹 생성
- [ ] 피드백 수집

#### **Google Play Beta**
- [ ] 베타 트랙 생성
- [ ] 테스터 그룹 설정
- [ ] 베타 APK 업로드
- [ ] 피드백 분석

### **7.2 프로덕션 배포**

- [ ] 최종 빌드 생성
- [ ] App Store 심사 제출
- [ ] Google Play 심사 제출
- [ ] 단계적 출시 설정
- [ ] 모니터링 대시보드 설정

---

## 📈 Phase 8: 배포 후 관리

### **8.1 모니터링**
- [ ] Crashlytics 설정
- [ ] Analytics 설정
- [ ] 성능 모니터링
- [ ] 사용자 리뷰 모니터링

### **8.2 업데이트 전략**
- [ ] 버전 관리 정책 수립
- [ ] 업데이트 주기 결정
- [ ] 긴급 패치 프로세스

---

## 🛠️ 유용한 명령어 모음

### **현재 사용 가능한 명령어 (Phase 1 완료)**
```bash
# 개발 중 자주 사용
cd app2
npm run build && npx cap sync           # ✅ 완료된 설정

# Windows 환경 테스트
npm start                               # 웹 개발 서버
npx cap open android                    # Android Studio 열기 (설치 필요)

# 디버깅 및 동기화
npx cap sync                            # ✅ 작동 확인됨
npx cap copy                            # 웹 자산 복사
npx cap update                          # 플러그인 업데이트
```

### **iOS 관련 (Mac 환경에서만 가능)**
```bash
npx cap run ios -l --external          # iOS 시뮬레이터 + 라이브 리로드
npx cap open ios                        # Xcode 열기
npx cap build ios                       # iOS 빌드
```

### **Android 관련 (모든 OS)**
```bash
npx cap run android -l --external      # Android 에뮬레이터 + 라이브 리로드
npx cap open android                    # Android Studio 열기
npx cap build android                  # Android 빌드
```

---

## ⚠️ 주의사항

### **Phase 1 완료 후 현재 상태**
1. **Windows 환경 제약**: iOS 개발은 Mac에서만 가능 (Xcode 필요)
2. **Android Studio 필요**: Android 테스트를 위해서는 Android Studio 설치 필요
3. **Node.js 버전**: 22.15.0 사용 중 (권장: 16+ LTS)
4. **Firebase 설정 대기**: Phase 2에서 GoogleService-Info.plist, google-services.json 추가 예정

### **향후 배포 시 주의사항**
1. **코드 서명**: 배포 전 반드시 올바른 인증서로 서명
2. **API 키 보안**: 환경 변수로 관리, 코드에 하드코딩 금지 (이미 .gitignore 설정됨)
3. **버전 관리**: iOS와 Android 버전 동기화
4. **권한**: 최소 필요 권한만 요청
5. **테스트**: 실제 디바이스에서 충분한 테스트

---

## 📚 참고 자료

- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [Firebase + Capacitor 가이드](https://capacitorjs.com/docs/guides/firebase)
- [App Store 심사 가이드라인](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play 정책](https://play.google.com/console/about/programs/policies/)

---

## ✅ 최종 체크리스트

### **출시 전 필수 확인사항**
- [ ] 모든 console.log 제거
- [ ] API endpoint 프로덕션으로 변경
- [ ] 에러 처리 완성
- [ ] 로딩 상태 처리
- [ ] 오프라인 처리
- [ ] 권한 요청 UX
- [ ] 딥링킹 테스트
- [ ] 푸시 알림 테스트
- [ ] 앱 업데이트 로직
- [ ] 개인정보처리방침 링크

---

**작성일**: 2025년 9월 30일
**버전**: 1.1.0 (Phase 1 완료 반영)
**작성자**: T-HOLDEM Development Team
**마지막 업데이트**: Phase 1 Capacitor 기본 설정 완료 (2025-09-30)

---

*이 가이드는 지속적으로 업데이트됩니다. 최신 버전은 GitHub 저장소를 확인하세요.*
*Phase 1 완료! 현재 `feature/capacitor-migration` 브랜치에서 Phase 2 진행 가능*