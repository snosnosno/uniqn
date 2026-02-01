# 🌍 T-HOLDEM 국제화 가이드 (i18n)

**최종 업데이트**: 2026년 2월 1일
**버전**: v1.0.0 (모바일앱 중심 + RevenueCat 연동)
**상태**: 🚀 **Production Ready - 완전 구현됨**

> ⚠️ **참고**: 현재 주력 플랫폼은 **uniqn-mobile/** (React Native + Expo)입니다.
> 모바일앱은 `i18next` + `react-i18next`를 사용합니다.

---

## 📋 목차

1. [개요](#-개요)
2. [설치 및 설정](#-설치-및-설정)
3. [사용법](#-사용법)
4. [번역 파일 관리](#-번역-파일-관리)
5. [새 언어 추가](#-새-언어-추가)
6. [모범 사례](#-모범-사례)
7. [문제 해결](#-문제-해결)

## 🎯 개요

T-HOLDEM은 **react-i18next**를 사용하여 다국어 지원을 구현했습니다.

### 지원 언어
- **한국어** (ko): 기본 언어
- **영어** (en): 보조 언어

### 핵심 기능
- 실시간 언어 전환
- 자동 언어 감지
- 번역 파일 분리 관리
- TypeScript 타입 안전성

## 🚀 설치 및 설정

### 의존성 패키지
```json
{
  "i18next": "^23.15.1",
  "i18next-browser-languagedetector": "^8.2.0",
  "i18next-http-backend": "^3.0.2",
  "react-i18next": "^14.1.3"
}
```

### 초기 설정 (`src/services/i18n.ts`)
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'ko',
    lng: 'ko',
    debug: false,

    interpolation: {
      escapeValue: false,
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

## 📖 사용법

### 기본 사용법
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('auth.login.emailPlaceholder')}</p>
    </div>
  );
}
```

### 네임스페이스 사용
```typescript
function AuthComponent() {
  const { t } = useTranslation('auth');

  return (
    <div>
      <h1>{t('login.title')}</h1>
      <button>{t('login.submit')}</button>
    </div>
  );
}
```

### 변수 보간
```typescript
function WelcomeMessage({ userName }: { userName: string }) {
  const { t } = useTranslation();

  return (
    <p>{t('welcome.message', { name: userName })}</p>
  );
}
```

### 언어 전환
```typescript
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex space-x-2">
      <button
        onClick={() => changeLanguage('ko')}
        className={i18n.language === 'ko' ? 'active' : ''}
      >
        한국어
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={i18n.language === 'en' ? 'active' : ''}
      >
        English
      </button>
    </div>
  );
}
```

## 📁 번역 파일 관리

### 파일 구조
```
public/locales/
├── ko/                    # 한국어
│   ├── translation.json   # 기본 번역
│   ├── auth.json         # 인증 관련
│   ├── common.json       # 공통 텍스트
│   ├── errors.json       # 에러 메시지
│   └── menu.json         # 메뉴 텍스트
└── en/                    # 영어
    ├── translation.json
    ├── auth.json
    ├── common.json
    ├── errors.json
    └── menu.json
```

### 번역 파일 예시

#### `public/locales/ko/auth.json`
```json
{
  "login": {
    "title": "로그인",
    "emailPlaceholder": "이메일을 입력하세요",
    "passwordPlaceholder": "비밀번호를 입력하세요",
    "submit": "로그인",
    "forgotPassword": "비밀번호를 잊으셨나요?",
    "noAccount": "계정이 없으신가요?",
    "signUpLink": "회원가입"
  },
  "signup": {
    "title": "회원가입",
    "nameLabel": "이름",
    "emailLabel": "이메일",
    "passwordLabel": "비밀번호",
    "phoneLabel": "전화번호",
    "genderLabel": "성별",
    "roleLabel": "역할",
    "submit": "가입하기"
  },
  "errors": {
    "invalidEmail": "올바른 이메일 주소를 입력해주세요",
    "passwordTooShort": "비밀번호는 최소 6자 이상이어야 합니다",
    "emailExists": "이미 존재하는 이메일입니다"
  }
}
```

#### `public/locales/en/auth.json`
```json
{
  "login": {
    "title": "Login",
    "emailPlaceholder": "Enter your email",
    "passwordPlaceholder": "Enter your password",
    "submit": "Sign In",
    "forgotPassword": "Forgot your password?",
    "noAccount": "Don't have an account?",
    "signUpLink": "Sign Up"
  },
  "signup": {
    "title": "Sign Up",
    "nameLabel": "Name",
    "emailLabel": "Email",
    "passwordLabel": "Password",
    "phoneLabel": "Phone Number",
    "genderLabel": "Gender",
    "roleLabel": "Role",
    "submit": "Create Account"
  },
  "errors": {
    "invalidEmail": "Please enter a valid email address",
    "passwordTooShort": "Password must be at least 6 characters",
    "emailExists": "Email already exists"
  }
}
```

#### `public/locales/ko/support.json` (신규)
```json
{
  "title": "고객 지원",
  "subtitle": "FAQ를 확인하거나 문의사항을 보내주세요",
  "tabs": {
    "faq": "FAQ",
    "inquiry": "문의하기",
    "myInquiries": "내 문의"
  },
  "faq": {
    "all": "전체",
    "noResults": "해당 카테고리에 FAQ가 없습니다."
  },
  "inquiry": {
    "loginRequired": "로그인이 필요합니다",
    "loginMessage": "문의를 작성하려면 먼저 로그인해주세요.",
    "category": "문의 분류",
    "subject": "제목",
    "subjectPlaceholder": "문의 제목을 입력해주세요",
    "message": "내용",
    "messagePlaceholder": "문의 내용을 자세히 작성해주세요",
    "submit": "문의 제출",
    "submitting": "제출 중..."
  },
  "myInquiries": {
    "loading": "문의 내역을 불러오는 중...",
    "empty": "문의 내역이 없습니다",
    "emptyMessage": "문의사항이 있으시면 언제든지 문의해주세요.",
    "response": "답변"
  }
}
```

### 공통 번역 파일

#### `public/locales/ko/common.json`
```json
{
  "buttons": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제",
    "edit": "편집",
    "submit": "제출",
    "close": "닫기",
    "confirm": "확인"
  },
  "status": {
    "loading": "로딩 중...",
    "success": "성공",
    "error": "오류",
    "pending": "대기 중",
    "completed": "완료"
  },
  "validation": {
    "required": "필수 입력 항목입니다",
    "invalidFormat": "형식이 올바르지 않습니다",
    "tooShort": "너무 짧습니다",
    "tooLong": "너무 깁니다"
  }
}
```

## 🔄 새 언어 추가

### 1. 번역 파일 생성
```bash
# 새 언어 폴더 생성 (예: 일본어)
mkdir public/locales/ja

# 기존 한국어 파일 복사
cp public/locales/ko/*.json public/locales/ja/
```

### 2. 번역 작업
- 복사된 JSON 파일들의 값을 새 언어로 번역
- 키는 변경하지 않고 값만 번역

### 3. i18n 설정 업데이트
```typescript
// src/services/i18n.ts
i18n.init({
  fallbackLng: 'ko',
  lng: 'ko',
  supportedLngs: ['ko', 'en', 'ja'], // 새 언어 추가
  // ... 나머지 설정
});
```

### 4. 언어 선택기 업데이트
```typescript
const languages = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' }, // 새 언어 추가
];
```

## 💡 모범 사례

### 번역 키 네이밍
```typescript
// ✅ 좋은 예
t('auth.login.title')
t('common.buttons.save')
t('errors.validation.required')

// ❌ 나쁜 예
t('loginTitle')
t('saveBtn')
t('err1')
```

### 컴포넌트별 네임스페이스
```typescript
// AuthPage.tsx
const { t } = useTranslation('auth');

// CommonButton.tsx
const { t } = useTranslation('common');

// ErrorMessage.tsx
const { t } = useTranslation('errors');
```

### 복수형 처리
```json
{
  "notifications": {
    "message_zero": "메시지가 없습니다",
    "message_one": "메시지 {{count}}개",
    "message_other": "메시지 {{count}}개"
  }
}
```

```typescript
t('notifications.message', { count: messageCount })
```

### 날짜/시간 형식
```typescript
import { useTranslation } from 'react-i18next';

function DateDisplay({ date }: { date: Date }) {
  const { i18n } = useTranslation();

  return (
    <span>
      {date.toLocaleDateString(i18n.language)}
    </span>
  );
}
```

## 🔧 문제 해결

### 번역이 표시되지 않을 때
1. 번역 파일 경로 확인
2. 네임스페이스 이름 확인
3. 브라우저 개발자 도구에서 네트워크 요청 확인

### 언어 변경이 적용되지 않을 때
```typescript
// 강제 리렌더링
const { i18n } = useTranslation();

useEffect(() => {
  i18n.changeLanguage('en');
}, []);
```

### TypeScript 타입 에러
```typescript
// react-i18next.d.ts 파일 생성
import 'react-i18next';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof ko;
      auth: typeof authKo;
      common: typeof commonKo;
    };
  }
}
```

### 개발 환경에서 디버깅
```typescript
// i18n.ts에서 debug 모드 활성화
i18n.init({
  debug: process.env.NODE_ENV === 'development',
  // ... 나머지 설정
});
```

## 📊 번역 완성도 확인

### 스크립트 예시
```bash
#!/bin/bash
# check-translations.sh

echo "번역 완성도 확인 중..."

for lang in en ja; do
  echo "언어: $lang"

  for file in public/locales/ko/*.json; do
    filename=$(basename "$file")
    if [ ! -f "public/locales/$lang/$filename" ]; then
      echo "  ❌ 누락: $filename"
    else
      echo "  ✅ 존재: $filename"
    fi
  done
  echo
done
```

## 🔗 관련 문서

- **React i18next 공식 문서**: https://react.i18next.com/
- **i18next 공식 문서**: https://www.i18next.com/
- **프로젝트 아키텍처**: `../reference/ARCHITECTURE.md`
- **개발 가이드**: `../../app2/README.md`

---

*국제화 관련 문의는 개발팀에 연락하세요.*