---
name: i18n
description: 다국어 검사 및 국제화. 다국어, i18n, 번역, 국제화, localization 요청 시 활성화
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# 다국어 (i18n) 스킬

애플리케이션의 다국어 지원을 검사하고 관리합니다.

## 지원 언어

| 코드 | 언어 | 상태 |
|------|------|------|
| ko | 한국어 | 기본 언어 |
| en | 영어 | 지원 예정 |

## i18n 구조

### 파일 구조
```
src/
├── i18n/
│   ├── index.ts          # i18n 설정
│   ├── locales/
│   │   ├── ko.json       # 한국어
│   │   └── en.json       # 영어
│   └── types.ts          # 타입 정의
```

### 설정 (react-i18next)
```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
    },
    lng: 'ko',
    fallbackLng: 'ko',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

## 번역 키 규칙

### 네이밍 컨벤션
```json
{
  "common": {
    "confirm": "확인",
    "cancel": "취소",
    "save": "저장",
    "delete": "삭제",
    "loading": "로딩 중..."
  },
  "auth": {
    "login": "로그인",
    "logout": "로그아웃",
    "signup": "회원가입"
  },
  "job": {
    "title": "공고 제목",
    "apply": "지원하기",
    "status": {
      "open": "모집중",
      "closed": "마감"
    }
  },
  "error": {
    "network": "네트워크 오류가 발생했습니다",
    "auth": {
      "invalidEmail": "유효하지 않은 이메일입니다",
      "wrongPassword": "비밀번호가 올바르지 않습니다"
    }
  },
  "validation": {
    "required": "{{field}} 필수 입력입니다",
    "minLength": "{{field}}은(는) 최소 {{min}}자 이상이어야 합니다"
  }
}
```

### 키 네이밍 규칙
1. **계층 구조**: `섹션.항목.하위항목`
2. **camelCase**: `auth.forgotPassword`
3. **명확한 의미**: `job.applyButton` (O), `job.btn1` (X)
4. **재사용**: 공통 텍스트는 `common.*`에

## 사용법

### 기본 사용
```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{t('common.confirm')}</Text>
      <Button title={t('job.apply')} />
    </View>
  );
}
```

### 변수 삽입 (Interpolation)
```tsx
// JSON
{
  "greeting": "안녕하세요, {{name}}님",
  "itemCount": "{{count}}개의 항목"
}

// 사용
t('greeting', { name: '홍길동' })  // "안녕하세요, 홍길동님"
t('itemCount', { count: 5 })       // "5개의 항목"
```

### 복수형 (Pluralization)
```tsx
// JSON (영어)
{
  "item": "{{count}} item",
  "item_plural": "{{count}} items"
}

// JSON (한국어 - 복수형 없음)
{
  "item": "{{count}}개 항목"
}

// 사용
t('item', { count: 1 })  // "1 item" / "1개 항목"
t('item', { count: 5 })  // "5 items" / "5개 항목"
```

### 언어 변경
```tsx
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <View>
      <Button title="한국어" onPress={() => changeLanguage('ko')} />
      <Button title="English" onPress={() => changeLanguage('en')} />
    </View>
  );
}
```

## 검사 항목

### 1. 하드코딩된 텍스트 찾기
```bash
# JSX 내 한글 텍스트 검색
grep -r ">[가-힣]" src/ --include="*.tsx"

# 문자열 내 한글 검색
grep -r "'[가-힣]" src/ --include="*.ts"
grep -r '"[가-힣]' src/ --include="*.ts"
```

### 2. 누락된 번역 키 찾기
```typescript
// 번역 키 검증 스크립트
import ko from './locales/ko.json';
import en from './locales/en.json';

function findMissingKeys(source: object, target: object, path = ''): string[] {
  const missing: string[] = [];

  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;
    if (!(key in target)) {
      missing.push(currentPath);
    } else if (typeof source[key] === 'object') {
      missing.push(...findMissingKeys(source[key], target[key], currentPath));
    }
  }

  return missing;
}

// ko 기준으로 en에서 누락된 키 찾기
const missing = findMissingKeys(ko, en);
console.log('Missing in EN:', missing);
```

### 3. 사용되지 않는 번역 키 찾기
```bash
# 모든 번역 키 추출
node -e "console.log(Object.keys(require('./src/i18n/locales/ko.json')).join('\n'))"

# 코드에서 사용 여부 확인
grep -r "t('키이름')" src/
```

## 체크리스트

### 텍스트
- [ ] 모든 사용자 표시 텍스트가 번역 키 사용
- [ ] 하드코딩된 한글 없음
- [ ] 변수 삽입 올바르게 사용
- [ ] 복수형 처리 (필요시)

### 날짜/숫자
- [ ] 날짜 형식 로케일 적용
- [ ] 숫자 형식 로케일 적용
- [ ] 통화 형식 로케일 적용

```typescript
// 날짜 포맷
import { format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

const locale = i18n.language === 'ko' ? ko : enUS;
format(date, 'PPP', { locale });

// 숫자 포맷
new Intl.NumberFormat(i18n.language).format(1234567);
// ko: "1,234,567"
// en: "1,234,567"

// 통화 포맷
new Intl.NumberFormat(i18n.language, {
  style: 'currency',
  currency: 'KRW',
}).format(10000);
// ko: "₩10,000"
```

### 레이아웃
- [ ] 텍스트 길이 변화 대응 (영어가 더 김)
- [ ] RTL 언어 고려 (필요시)
- [ ] 폰트 지원 확인

### 품질
- [ ] 번역 일관성 검토
- [ ] 컨텍스트에 맞는 번역
- [ ] 문법/맞춤법 검사

## 번역 추가 워크플로우

### 1. 새 텍스트 추가
```typescript
// 1. 한국어 JSON에 키 추가
// ko.json
{
  "newFeature": {
    "title": "새 기능",
    "description": "새 기능 설명입니다"
  }
}

// 2. 영어 JSON에 번역 추가
// en.json
{
  "newFeature": {
    "title": "New Feature",
    "description": "This is a new feature"
  }
}

// 3. 코드에서 사용
t('newFeature.title')
```

### 2. 기존 하드코딩 텍스트 변환
```tsx
// Before
<Text>로그인</Text>

// After
<Text>{t('auth.login')}</Text>
```

## 출력 형식

```markdown
## i18n 검사 결과

### 요약
- 검사 범위: [파일/폴더]
- 지원 언어: ko, en
- 총 번역 키: [N개]
- 하드코딩 텍스트: [N개]
- 누락된 번역: [N개]

### 하드코딩된 텍스트
| 파일 | 라인 | 텍스트 | 제안 키 |
|------|------|--------|---------|
| JobCard.tsx | 42 | "지원하기" | job.apply |

### 누락된 번역 (en)
- job.newStatus
- error.timeout

### 사용되지 않는 키
- common.deprecated
- old.feature

### 권장 조치
1. 하드코딩 텍스트 번역 키로 변환
2. 누락된 영어 번역 추가
3. 사용되지 않는 키 정리
```
