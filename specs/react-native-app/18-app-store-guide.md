# 18. App Store 심사 가이드

## 개요

iOS App Store와 Google Play Store 앱 심사를 통과하기 위한 종합 가이드입니다.
UNIQN 앱의 특성(구인구직, 결제 연동, 위치 정보)에 맞는 심사 준비 사항을 다룹니다.

---

## 1. 공통 준비 사항

### 앱 메타데이터

| 항목 | 내용 | 참고 |
|------|------|------|
| **앱 이름** | UNIQN (유니큰) | 30자 이내 |
| **부제목** | 홀덤 스태프 매칭 플랫폼 | iOS만 해당 |
| **설명** | 아래 참고 | 4,000자 이내 |
| **카테고리** | 비즈니스 / 구인구직 | 주 카테고리 |
| **키워드** | 홀덤,포커,딜러,스태프,아르바이트,구인,구직 | iOS만, 100자 |
| **연령 등급** | 17+ (도박 관련) | 중요 |
| **가격** | 무료 | 인앱 결제 없음 |

### 앱 설명 예시

```
UNIQN - 홀덤 스태프 매칭 플랫폼

홀덤펍, 포커 토너먼트 운영에 필요한 전문 스태프를 쉽고 빠르게 구하세요.

[스태프용]
• 내 주변 홀덤펍 구인공고 확인
• 원터치 지원 및 실시간 확정 알림
• QR 체크인/체크아웃으로 간편한 출퇴근
• 근무 이력 및 정산 내역 관리

[구인자용]
• 검증된 스태프 풀에서 빠른 채용
• 지원자 프로필 및 경력 확인
• 실시간 지원 현황 모니터링
• 간편한 정산 시스템

※ 본 앱은 스태프 매칭 서비스이며, 도박 행위를 조장하거나 제공하지 않습니다.
※ 만 19세 이상만 이용 가능합니다.
```

### 스크린샷 요구사항

| 플랫폼 | 사이즈 | 수량 |
|--------|--------|------|
| **iPhone 6.7"** | 1290 x 2796 | 3-10장 |
| **iPhone 6.5"** | 1284 x 2778 | 3-10장 |
| **iPhone 5.5"** | 1242 x 2208 | 3-10장 |
| **iPad Pro 12.9"** | 2048 x 2732 | 3-10장 (iPad 지원 시) |
| **Android Phone** | 1080 x 1920+ | 2-8장 |
| **Android Tablet** | 1200 x 1920+ | 선택 |

### 필수 스크린샷 구성

1. **홈 화면** - 메인 기능 소개
2. **구인공고 목록** - 핵심 기능
3. **공고 상세/지원** - 주요 플로우
4. **QR 체크인** - 차별화 기능
5. **정산 내역** - 신뢰성

---

## 2. iOS App Store 심사

### 2.1 필수 요구사항

#### App Store Connect 설정

```yaml
# 앱 정보
Bundle ID: com.uniqn.app
SKU: UNIQN001
Primary Language: Korean

# 가격 및 배포
Price: Free
Availability: 대한민국

# 앱 심사 정보
Demo Account:
  Email: review@uniqn.app
  Password: ReviewTest123!

Notes for Reviewer: |
  본 앱은 홀덤(포커) 매장의 스태프 구인구직 플랫폼입니다.
  도박 서비스를 직접 제공하지 않으며, 스태프 매칭만 담당합니다.

  테스트 방법:
  1. 제공된 계정으로 로그인
  2. '구인공고' 탭에서 공고 목록 확인
  3. 공고 상세에서 '지원하기' 테스트
  4. '내 지원' 탭에서 지원 현황 확인
```

#### 연령 등급 설정

```yaml
Age Rating Questionnaire:
  # 도박 관련 필수 체크
  - "Simulated Gambling": No
  - "Real Gambling": No

  # 설명 추가
  Notes: |
    본 앱은 도박 서비스를 제공하지 않습니다.
    홀덤(포커) 매장의 스태프 구인구직 기능만 제공합니다.

  # 최종 등급: 17+ (도박 관련 컨텐츠 참조)
  Recommended Rating: 17+
```

#### 개인정보 처리방침

```yaml
Privacy Policy URL: https://uniqn.app/privacy

Data Collection:
  - Contact Info: Name, Email, Phone (계정 생성)
  - Location: Precise Location (근처 공고 탐색)
  - Identifiers: User ID (서비스 제공)
  - Usage Data: 앱 사용 패턴 (서비스 개선)

Data Linked to User:
  - Contact Info
  - Location
  - User Content (프로필, 지원서)

Data Used for Tracking: No
```

### 2.2 자주 발생하는 리젝션 사유

#### Guideline 4.3 - Spam (중복 앱)

```yaml
Issue: 유사 앱으로 인식
Prevention:
  - 명확한 차별화 포인트 강조
  - 고유 기능 설명 (QR 체크인, 실시간 매칭)
  - 스크린샷에 핵심 기능 부각

Response Template: |
  UNIQN은 홀덤 매장 전문 스태프 매칭 플랫폼으로,
  다음과 같은 고유 기능을 제공합니다:

  1. QR 기반 실시간 출퇴근 체크
  2. 확정 동의 시스템 (48시간 내 수락/거절)
  3. 홀덤 산업 특화 스태프 프로필
  4. 실시간 정산 시스템

  일반 구인구직 앱과 달리, 홀덤 매장 운영에
  최적화된 기능을 제공합니다.
```

#### Guideline 5.1.1 - 데이터 수집

```yaml
Issue: 불필요한 개인정보 수집
Prevention:
  - 위치 권한: "공고 탐색 시에만" 명시
  - 카메라 권한: "QR 스캔용" 명시
  - 연락처: "구인자와 연락용" 명시

Info.plist 설정:
  NSLocationWhenInUseUsageDescription: |
    내 주변 구인공고를 찾기 위해 위치 정보가 필요합니다.
  NSCameraUsageDescription: |
    출퇴근 QR 코드 스캔을 위해 카메라 접근이 필요합니다.
  NSPhotoLibraryUsageDescription: |
    프로필 사진 등록을 위해 사진 라이브러리 접근이 필요합니다.
```

#### Guideline 5.3.4 - 도박

```yaml
Issue: 도박 앱으로 분류
Prevention:
  - 앱 설명에 "스태프 매칭 전용" 명시
  - "도박 서비스 미제공" 명시
  - 심사 노트에 상세 설명

Response Template: |
  UNIQN은 도박 서비스를 제공하지 않습니다.

  본 앱의 기능:
  - 홀덤펍/포커룸의 스태프(딜러, 서버 등) 구인구직
  - 출퇴근 관리
  - 급여 정산

  홀덤 게임 자체는 앱 내에서 제공되지 않으며,
  오직 매장 운영에 필요한 인력 매칭만 담당합니다.

  참고: 국내 홀덤펍은 합법적으로 운영되는 사업장이며,
  본 앱은 해당 사업장의 인력 관리를 지원합니다.
```

#### Guideline 2.1 - 앱 완성도

```yaml
Issue: 미완성/버그
Prevention:
  - 모든 화면 접근 가능
  - 데드링크 없음
  - 크래시 없음
  - 데모 계정으로 전체 플로우 테스트 가능

Pre-Submission Checklist:
  - [ ] 회원가입 플로우 완료
  - [ ] 로그인/로그아웃 작동
  - [ ] 공고 목록/상세 표시
  - [ ] 지원하기 기능 작동
  - [ ] 알림 수신 확인
  - [ ] 프로필 수정 가능
  - [ ] 설정 화면 접근 가능
```

### 2.3 iOS 전용 요구사항

#### App Tracking Transparency

```typescript
// iOS 14.5+ ATT 권한 요청
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

async function requestTracking() {
  const { status } = await requestTrackingPermissionsAsync();

  if (status === 'granted') {
    // Analytics 활성화
    await analyticsService.initialize();
  }
}
```

#### Sign in with Apple

```yaml
# 소셜 로그인 제공 시 필수
Requirement: 다른 소셜 로그인 제공 시 Apple 로그인 필수
Implementation: expo-apple-authentication

Exception: 이메일 로그인만 제공 시 불필요
```

#### In-App Purchase 관련

```yaml
# UNIQN은 인앱 결제 없음
IAP Required: No

Note: |
  스태프 급여 정산은 앱 외부에서 직접 이체 방식으로 진행됩니다.
  앱 내 결제 기능은 없습니다.
```

---

## 3. Google Play Store 심사

### 3.1 필수 요구사항

#### Google Play Console 설정

```yaml
# 앱 정보
Package Name: com.uniqn.app
App Category: Business
Content Rating: Mature 17+

# 스토어 등록정보
Title: UNIQN - 홀덤 스태프 매칭
Short Description: 홀덤펍 전문 스태프 구인구직 플랫폼 (80자)
Full Description: (위 앱 설명 참고)

# 태그
Tags:
  - 구인구직
  - 비즈니스
  - 아르바이트
```

#### 콘텐츠 등급 질문지

```yaml
Content Rating Questionnaire:
  Violence: None
  Sexual Content: None
  Language: None
  Controlled Substance: None

  # 도박 관련
  Gambling:
    Simulated Gambling: No
    Real Money Gambling: No

  Additional Info: |
    본 앱은 도박 서비스를 제공하지 않습니다.
    홀덤(포커) 매장의 스태프 채용 서비스만 제공합니다.

  # 결과: Mature 17+ (도박 관련 산업)
```

#### 데이터 안전 섹션

```yaml
Data Safety:
  Data Collection:
    - Account Info: Name, Email, Phone
    - Location: Approximate/Precise
    - App Activity: App interactions
    - Device Info: Device ID

  Data Sharing:
    - "데이터는 제3자와 공유되지 않습니다"

  Security Practices:
    - "데이터 전송 시 암호화"
    - "데이터 삭제 요청 가능"

  Data Deletion:
    URL: https://uniqn.app/account/delete
    Instructions: |
      설정 > 계정 > 계정 삭제에서 삭제 요청 가능
```

### 3.2 자주 발생하는 리젝션 사유

#### 정책 위반 - 도박 앱

```yaml
Issue: Play 도박 정책 위반
Policy: "실제 돈이 오가는 도박 앱 금지"

Response Template: |
  UNIQN은 도박 앱이 아닙니다.

  앱의 목적:
  홀덤(포커) 매장에서 일하는 스태프(딜러, 서버, 매니저)의
  구인구직을 돕는 플랫폼입니다.

  앱 내 기능:
  1. 구인공고 등록/검색
  2. 지원서 제출/관리
  3. 출퇴근 체크 (QR)
  4. 급여 정산 내역 확인

  도박 관련 기능:
  - 게임 플레이: 없음
  - 베팅: 없음
  - 칩 구매: 없음
  - 현금 거래: 없음 (급여 정산은 앱 외부)

  본 앱은 합법적인 홀덤펍 사업장의
  인력 관리 도구입니다.
```

#### 메타데이터 정책 위반

```yaml
Issue: 부적절한 키워드/설명
Prevention:
  - 과장된 표현 금지 ("최고", "유일한")
  - 경쟁사 언급 금지
  - 허위 기능 설명 금지
  - 이모지 과다 사용 금지
```

#### 기능 문제

```yaml
Issue: 핵심 기능 작동 안 함
Pre-Submission Checklist:
  - [ ] APK 서명 확인
  - [ ] 타겟 API 레벨 준수 (API 34+)
  - [ ] 64비트 지원
  - [ ] 권한 요청 정상 작동
  - [ ] 백그라운드 제한 대응
```

### 3.3 Android 전용 요구사항

#### 타겟 API 레벨

```yaml
# 2024년 기준
Target SDK: 34 (Android 14)
Min SDK: 24 (Android 7.0)

# build.gradle 또는 app.json
android:
  targetSdkVersion: 34
  minSdkVersion: 24
```

#### 권한 선언

```xml
<!-- AndroidManifest.xml -->
<manifest>
  <!-- 필수 권한 -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

  <!-- 위치 (공고 탐색) -->
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

  <!-- 카메라 (QR 스캔) -->
  <uses-permission android:name="android.permission.CAMERA" />

  <!-- 알림 (Android 13+) -->
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

  <!-- 생체인증 -->
  <uses-permission android:name="android.permission.USE_BIOMETRIC" />
</manifest>
```

#### Google Play Integrity

```typescript
// 앱 무결성 검증 (선택)
import { PlayIntegrity } from 'react-native-play-integrity';

async function verifyAppIntegrity() {
  try {
    const token = await PlayIntegrity.requestIntegrityToken();
    // 서버에서 토큰 검증
    await verifyTokenOnServer(token);
  } catch (error) {
    console.error('Integrity check failed:', error);
  }
}
```

---

## 4. 심사 대응 프로세스

### 4.1 심사 제출 전 체크리스트

```yaml
General:
  - [ ] 앱 아이콘 준비 (1024x1024)
  - [ ] 스크린샷 준비 (모든 사이즈)
  - [ ] 앱 설명 작성
  - [ ] 개인정보 처리방침 URL 준비
  - [ ] 지원 URL 준비
  - [ ] 데모 계정 준비

iOS Specific:
  - [ ] App Store Connect 앱 생성
  - [ ] 연령 등급 설문 완료
  - [ ] 개인정보 라벨 설정
  - [ ] 심사 노트 작성
  - [ ] ATT 설명 추가 (필요 시)

Android Specific:
  - [ ] Google Play Console 앱 생성
  - [ ] 콘텐츠 등급 설문 완료
  - [ ] 데이터 안전 섹션 작성
  - [ ] 타겟 API 레벨 확인
  - [ ] 64비트 지원 확인
```

### 4.2 리젝션 대응 템플릿

```yaml
Response Structure:
  1. 감사 인사
  2. 문제 이해 확인
  3. 구체적 해결 방안
  4. 증거 자료 (스크린샷 등)
  5. 재심사 요청

Example: |
  안녕하세요, App Review 팀 여러분.

  피드백 감사드립니다.

  지적하신 [Guideline X.X] 관련하여
  다음과 같이 수정하였습니다:

  1. [구체적 변경 사항 1]
  2. [구체적 변경 사항 2]

  첨부된 스크린샷에서 변경 내용을 확인하실 수 있습니다.

  재심사 부탁드립니다.
  감사합니다.
```

### 4.3 심사 일정 관리

```yaml
iOS Timeline:
  - 첫 심사: 24-48시간
  - 재심사: 24시간 내
  - 긴급 심사: Expedited Review 요청 가능

Android Timeline:
  - 신규 앱: 최대 7일
  - 업데이트: 1-3일
  - 내부 테스트: 즉시

Best Practices:
  - 중요 출시일 2주 전 제출
  - 주말 제출 피하기
  - 연휴 기간 고려
```

---

## 5. 출시 후 관리

### 5.1 버전 관리

```yaml
Version Numbering:
  Format: Major.Minor.Patch (예: 1.2.3)

  Major: 큰 기능 변경
  Minor: 새 기능 추가
  Patch: 버그 수정

Build Number:
  iOS: 연속 증가 (1, 2, 3...)
  Android: 연속 증가 (versionCode)
```

### 5.2 단계적 출시

```yaml
iOS Phased Release:
  - 1일차: 1%
  - 2일차: 2%
  - 3일차: 5%
  - 4일차: 10%
  - 5일차: 20%
  - 6일차: 50%
  - 7일차: 100%

Android Staged Rollout:
  - 초기: 5-10%
  - 모니터링 후: 25%, 50%, 100%

Rollback:
  - iOS: 단계적 출시 중지 가능
  - Android: 이전 버전으로 롤백 가능
```

### 5.3 리뷰 관리

```yaml
Review Response Guidelines:
  Positive Reviews:
    - 감사 인사
    - 추가 기능 안내 (해당 시)

  Negative Reviews:
    - 사과 및 공감
    - 구체적 해결 방안 안내
    - 지원 연락처 제공
    - 후속 조치 후 업데이트 알림

Response Template (Negative): |
  안녕하세요, [사용자명]님.
  불편을 드려 죄송합니다.

  말씀하신 [문제]는 [버전 X.X]에서 수정되었습니다.
  앱 업데이트 후에도 문제가 지속되면
  support@uniqn.app으로 연락 주세요.

  더 나은 서비스로 보답하겠습니다.
  감사합니다.
```

---

## 6. 법적 요구사항

### 6.1 필수 문서

| 문서 | URL | 내용 |
|------|-----|------|
| 개인정보 처리방침 | /privacy | 데이터 수집/사용/보호 |
| 이용약관 | /terms | 서비스 이용 규칙 |
| 환불 정책 | /refund | 환불 불가 (무료 앱) |

### 6.2 연령 제한

```yaml
# 도박 관련 산업 → 19세 이상
Age Restriction: 19+

Implementation:
  - 회원가입 시 생년월일 확인
  - 19세 미만 가입 차단
  - 앱 스토어 연령 등급: 17+
```

### 6.3 위치 정보 동의

```yaml
Location Data:
  Purpose: 근처 구인공고 탐색
  Type: 이용 중 위치 접근

  Required Consent:
    - 앱 내 위치 권한 요청 시 설명
    - 개인정보 처리방침에 명시
```

---

## 7. 앱 심사 자동화

### 7.1 Fastlane 설정 (iOS)

```ruby
# fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Submit to App Store Review"
  lane :submit_review do
    deliver(
      submit_for_review: true,
      automatic_release: false,
      force: true,

      # 심사 정보
      app_review_information: {
        first_name: "Review",
        last_name: "Team",
        phone_number: "+82-10-1234-5678",
        email_address: "review@uniqn.app",
        demo_user: "review@uniqn.app",
        demo_password: "ReviewTest123!",
        notes: "테스트 계정으로 모든 기능 확인 가능합니다."
      },

      # 메타데이터
      metadata_path: "./fastlane/metadata"
    )
  end
end
```

### 7.2 Fastlane 설정 (Android)

```ruby
# fastlane/Fastfile
default_platform(:android)

platform :android do
  desc "Submit to Play Store"
  lane :deploy do
    upload_to_play_store(
      track: 'production',
      release_status: 'completed',
      aab: '../android/app/build/outputs/bundle/release/app-release.aab'
    )
  end

  desc "Submit to Internal Testing"
  lane :internal do
    upload_to_play_store(
      track: 'internal',
      aab: '../android/app/build/outputs/bundle/release/app-release.aab'
    )
  end
end
```

---

## 8. 심사 체크리스트

### 최종 제출 전 확인

```yaml
Functionality:
  - [ ] 모든 버튼/링크 작동
  - [ ] 로그인/로그아웃 정상
  - [ ] 핵심 기능 완전히 작동
  - [ ] 크래시 없음
  - [ ] 네트워크 오류 처리

Content:
  - [ ] 플레이스홀더 텍스트 없음
  - [ ] 테스트 데이터 제거
  - [ ] 개발자 도구 비활성화
  - [ ] 디버그 로그 제거

Metadata:
  - [ ] 앱 아이콘 최종 확인
  - [ ] 스크린샷 현재 버전 반영
  - [ ] 설명 오타 확인
  - [ ] 개인정보 처리방침 링크 작동

Legal:
  - [ ] 연령 등급 적절
  - [ ] 데이터 수집 설명 정확
  - [ ] 필수 권한 설명 추가

Demo Account:
  - [ ] 계정 활성화 상태
  - [ ] 비밀번호 작동
  - [ ] 충분한 테스트 데이터
  - [ ] 모든 기능 접근 가능
```

---

## 9. 칩 결제 모델 법적 검토

### 개요

UNIQN 앱의 "칩" 시스템이 앱 스토어 정책 및 법률에 미치는 영향을 분석합니다.

```yaml
현재 칩 시스템:
  용도:
    - 구인공고 등록 수수료
    - 프리미엄 기능 이용료 (상단 노출, 긴급 모집 등)
    - 향후 추가 기능 확장 가능

  획득 방법:
    - 초기 가입 보너스
    - 이벤트/프로모션 지급
    - 추천인 보상
    - (미정) 유료 구매

  특징:
    - 현금 환급 불가
    - 타 사용자에게 양도 불가
    - 유효기간 없음
```

### 앱 스토어 정책 분석

#### Apple App Store (IAP 필수 정책)

```yaml
관련 가이드라인: 3.1.1

IAP 필수 대상:
  - 디지털 콘텐츠 및 서비스
  - 앱 내 가상 화폐
  - 구독 서비스
  - 프리미엄 기능 잠금 해제

IAP 예외 대상:
  - 실물 상품/서비스 (음식 배달, 운송 등)
  - 1:1 대면 서비스 예약
  - 앱 외부에서 소비되는 콘텐츠

UNIQN 칩 분류:
  현재 해석: "앱 내 가상 화폐" → IAP 필수 가능성 높음

  그러나 예외 주장 가능:
    - 구인/구직 매칭 = 실제 노동 서비스 연결
    - 급여는 앱 외부 직접 거래
    - 칩 = 플랫폼 이용료 (마켓플레이스 모델)

Apple 수수료:
  - 표준: 30%
  - 소규모 비즈니스 프로그램: 15% (연 매출 $1M 미만)
```

#### Google Play Store

```yaml
관련 정책: 결제 정책

Google Play 결제 필수:
  - 디지털 상품 및 콘텐츠
  - 가상 화폐/아이템

예외:
  - 실제 세계에서 사용되는 상품/서비스
  - P2P 결제 서비스
  - 구독 뉴스 콘텐츠

Google 수수료:
  - 표준: 30%
  - 소규모 개발자: 15% (첫 $1M)
  - 구독: 15% (첫 해 후)
```

### 법적 리스크 분석

#### 도박 규제 관련

```yaml
위험 요소:
  - "홀덤" 키워드가 도박 연상 가능
  - 실시간 대전/경쟁 기능 (향후 추가 시)

완화 요소:
  - 실제 게임 기능 없음 (일자리 매칭만)
  - 결제/베팅 기능 없음

권장 조치:
  - 앱 설명에 "도박 아님" 명시
  - 한국 사행산업통합감독위원회 유권해석 검토
```

### 수익 모델

```yaml
현재 모델:
  - 앱 내 결제 기능 없음
  - 마켓플레이스 모델 (매칭만 제공)

수익 채널:
  - 구인자 대상 외부 결제 (웹사이트)
  - B2B 기업 제휴 (수수료 기반)
  - 광고 수익

장점:
  - 앱 스토어 수수료 0%
  - 심사 리스크 최소화
  - 법적 복잡성 회피
```

### 심사 대응 준비

#### 예상 질문 및 답변

```yaml
Q1: "이 앱은 도박과 관련이 있나요?"
A1: |
  아니요. UNIQN은 홀덤 토너먼트 딜러/스태프를 위한 일자리 매칭 플랫폼입니다.
  - 실제 게임 기능 없음
  - 도박/베팅 기능 없음
  - 앱 내 결제 기능 없음

Q2: "급여는 어떻게 지급되나요?"
A2: |
  급여는 앱 외부에서 구인자가 스태프에게 직접 지급합니다.
  - 앱 내 결제/정산 기능 없음
  - 앱은 매칭만 제공
  - 은행 이체 등 외부 수단 사용

```

### 법률 자문 체크리스트

```yaml
자문 필요 항목:
  - [ ] 전자금융거래법 해당 여부 최종 확인
  - [ ] 사행산업 규제 해당 여부 확인
  - [ ] 개인정보 처리 적법성
  - [ ] 이용약관 검토

담당 법무법인:
  - [ ] IT/핀테크 전문 법무법인 선정
  - [ ] 앱 스토어 정책 경험 확인
  - [ ] 금융 규제 경험 확인

예상 비용:
  - 초기 자문: 200-500만원
  - 유권해석 신청 대행: 별도
  - 정기 자문 계약: 월 50-100만원
```

---

## 부록: 유용한 리소스

### 공식 문서

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)

### 심사 현황 확인

- iOS: App Store Connect > 앱 > 앱 심사
- Android: Google Play Console > 출시 > 프로덕션 > 출시 대시보드

### 긴급 연락처

- Apple App Review: App Store Connect에서 연락
- Google Play Support: Play Console에서 지원 요청
