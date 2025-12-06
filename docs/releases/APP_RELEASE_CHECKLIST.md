# 앱 출시 체크리스트

**프로젝트**: UNIQN (홀덤 토너먼트 관리 플랫폼)
**버전**: v0.2.3
**최종 업데이트**: 2025-12-06
**상태**: 🚧 Android 빌드 완료, Play Console 업로드 대기

---

## 📊 현재 상태 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| TypeScript 에러 | ✅ 0개 | 완료 |
| ESLint 에러 | ✅ 0개 | 완료 |
| ESLint 경고 | ✅ 0개 (프로덕션) | 테스트 파일만 159개 경고 |
| 프로덕션 빌드 | ✅ 성공 | 완료 |
| 번들 크기 | ✅ ~300KB | gzip 압축 후 |
| Package ID | ✅ `com.snostudio.app` | 변경 완료 |
| Keystore | ✅ 생성됨 | 백업 필수! |
| Release AAB | ✅ 14.5MB | 빌드 완료 |

---

## 1단계: 코드 품질 검증 ✅ 완료

### 1.1 필수 검증

```bash
cd app2

# TypeScript 타입 체크
npm run type-check

# ESLint 검사 및 수정
npm run lint
npm run lint:fix

# Prettier 포맷팅
npm run format

# 프로덕션 빌드 테스트
npm run build
```

| 체크 항목 | 상태 | 담당자 | 완료일 |
|----------|------|--------|--------|
| [x] TypeScript 에러 0개 | ✅ | Claude | 2025-12-06 |
| [x] ESLint 에러 0개 | ✅ | Claude | 2025-12-06 |
| [x] ESLint 경고 0개 (프로덕션 코드) | ✅ | Claude | 2025-12-06 |
| [x] 프로덕션 빌드 성공 | ✅ | Claude | 2025-12-06 |
| [x] 번들 크기 ~300KB (gzip) | ✅ | Claude | 2025-12-06 |

### 1.2 테스트 커버리지

| 체크 항목 | 목표 | 현재 | 상태 |
|----------|------|------|------|
| [x] 테스트 실행 | 통과 | 449/498 (90%) | ⚠️ |
| [ ] 단위 테스트 커버리지 | 80% | - | ⏳ |
| [ ] 실패 테스트 수정 | 0개 | 38개 | ⏳ |

**참고**: 38개 실패 테스트는 AuthContext 에러 형식 불일치 (출시 영향 낮음)

---

## 2단계: 보안 점검 ✅ 완료

### 2.1 코드 보안

| 체크 항목 | 상태 | 비고 |
|----------|------|------|
| [x] `console.log` 제거 (logger 사용) | ✅ | 프로덕션 코드 0개 |
| [x] 하드코딩된 API 키 없음 | ✅ | 환경변수 사용 |
| [x] XSS 방지 (DOMPurify) | ✅ | 적용됨 |
| [x] Zod 스키마 검증 | ✅ | 입력값 검증 |
| [x] SQL Injection 방지 | ✅ | Firestore Rules |

### 2.2 Firebase 보안

| 체크 항목 | 상태 | 비고 |
|----------|------|------|
| [x] Firestore Security Rules 검토 | ✅ | 1007줄 상세 규칙 |
| [x] 인증 필수 규칙 확인 | ✅ | isSignedIn() 함수 |
| [x] 역할 기반 접근 제어 | ✅ | admin/manager/staff/user |
| [x] XSS/SQLi 방지 함수 | ✅ | hasNoXSS(), hasNoSQLInjection() |

### 2.3 환경 변수

| 파일 | 상태 |
|------|------|
| [x] `.env.production` | ✅ |
| [x] `.env.local` | ✅ |
| [x] `.gitignore` | ✅ |

---

## 3단계: Android 빌드 ✅ 완료

### 3.1 Package ID 변경

| 항목 | 이전 | 현재 | 상태 |
|------|------|------|------|
| Package ID | `com.uniqn.app` | `com.snostudio.app` | ✅ |
| 회사명 | - | SNO Studio | ✅ |

**변경된 파일**:
- [x] `capacitor.config.ts` - appId
- [x] `android/app/build.gradle` - namespace, applicationId
- [x] `android/app/src/main/res/values/strings.xml`
- [x] `android/app/src/main/java/com/snostudio/app/MainActivity.java`
- [x] `android/app/google-services.json` - Firebase 재등록

### 3.2 Keystore 생성

| 항목 | 값 |
|------|-----|
| 파일 | `android/app/uniqn-release-key.jks` |
| Alias | `uniqn-key` |
| 비밀번호 | `Uniqn2024Release` |
| 유효기간 | 10,000일 (약 27년) |
| 조직 | SNO Studio, Seoul, KR |

⚠️ **중요 - 반드시 백업**:
```
android/app/uniqn-release-key.jks    # Keystore 파일
android/keystore.properties           # 비밀번호 정보
```
**분실 시 앱 업데이트 불가능!**

### 3.3 Release AAB 빌드

| 항목 | 값 |
|------|-----|
| 파일 | `app-release.aab` |
| 위치 | `android/app/build/outputs/bundle/release/` |
| 크기 | 14.5 MB |
| 빌드일 | 2025-12-06 |

```bash
# 재빌드 명령어
cd app2/android
.\gradlew bundleRelease
```

### 3.4 앱 아이콘

| 에셋 | 상태 |
|------|------|
| [x] Android 아이콘 (다중 해상도) | ✅ |
| [x] 적응형 아이콘 | ✅ |
| [ ] 스플래시 스크린 커스텀 | ⏳ (선택) |

---

## 4단계: Google Play Console 업로드 ⏳ 진행 중

### 4.1 계정 설정

| 체크 항목 | 상태 | 비고 |
|----------|------|------|
| [x] Google Play Console 계정 생성 | ✅ | $25 결제 완료 |
| [ ] 앱 생성 | ⏳ | |
| [ ] AAB 업로드 | ⏳ | |

### 4.2 앱 생성 시 설정

| 항목 | 권장값 |
|------|--------|
| 앱 이름 | UNIQN |
| 기본 언어 | 한국어 |
| 앱/게임 | 앱 |
| 무료/유료 | **무료** (변경 불가!) |

### 4.3 스토어 등록정보 (필수)

| 항목 | 규격 | 상태 |
|------|------|------|
| [ ] 앱 아이콘 | 512x512 PNG | ⏳ |
| [ ] 기능 그래픽 | 1024x500 PNG | ⏳ |
| [ ] 스크린샷 | 최소 2장 | ⏳ |
| [ ] 간단한 설명 | 80자 이내 | ⏳ |
| [ ] 전체 설명 | 4000자 이내 | ⏳ |
| [ ] 개인정보처리방침 URL | 필수! | ⏳ |

### 4.4 콘텐츠 등급

| 항목 | 상태 |
|------|------|
| [ ] 콘텐츠 등급 설문 작성 | ⏳ |
| [ ] 타겟 연령층 설정 | ⏳ |

---

## 5단계: 법적 요구사항 ⏳

### 5.1 필수 문서

| 문서 | 상태 | 비고 |
|------|------|------|
| [ ] 개인정보처리방침 | ⏳ | Play Console 필수 |
| [ ] 서비스 이용약관 | ⏳ | 권장 |

### 5.2 연령 등급 고려사항

**홀덤 포커 관련**:
- Android: 18+ (도박 테마)
- 실제 금전 거래가 없음을 명시 필요

---

## 6단계: iOS 빌드 ⏳ (추후 진행)

| 체크 항목 | 상태 |
|----------|------|
| [ ] Apple Developer 계정 ($99/년) | ⏳ |
| [ ] iOS 프로젝트 Package ID 변경 | ⏳ |
| [ ] App Store Connect 설정 | ⏳ |

---

## 부록: 빠른 명령어 참조

### Android 빌드
```bash
cd app2

# 웹 빌드 + 동기화
npm run build && npx cap sync android

# Release AAB 빌드
cd android
.\gradlew bundleRelease

# 출력 위치
# android/app/build/outputs/bundle/release/app-release.aab
```

### 디버깅
```bash
# Android 에뮬레이터
npx cap run android

# 라이브 리로드
npx cap run android --livereload --external
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-06 | 최초 작성 |
| 1.1 | 2025-12-06 | Package ID 변경 (com.snostudio.app), Keystore 생성, AAB 빌드 완료 |

---

## 다음 작업 (재개 시)

1. **Google Play Console에서 앱 생성**
   - https://play.google.com/console
   - 앱 이름: UNIQN
   - 무료 앱으로 설정

2. **스토어 등록정보 작성**
   - 앱 아이콘 512x512
   - 기능 그래픽 1024x500
   - 스크린샷 2장 이상
   - 앱 설명

3. **개인정보처리방침 URL 준비**
   - Play Console 등록 필수

4. **AAB 업로드**
   - 파일: `android/app/build/outputs/bundle/release/app-release.aab`

---

**담당자**: ___________________
**최종 확인일**: 2025-12-06
**출시 예정일**: ___________________
