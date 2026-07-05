---
name: a11y
description: 접근성 검사. 접근성, a11y, accessibility, 스크린리더, 키보드 네비게이션 요청 시 활성화
allowed-tools: Read, Grep, Glob, Task
---

# 접근성 검사 스킬

웹/앱의 접근성을 검사하고 개선합니다.

## 접근성 기준

- **WCAG 2.1 AA** 준수 목표
- **iOS/Android 접근성 가이드라인** 준수

## 핵심 원칙 (POUR)

| 원칙 | 설명 | 예시 |
|------|------|------|
| **Perceivable** | 인지 가능 | 대체 텍스트, 색상 대비 |
| **Operable** | 조작 가능 | 키보드 접근, 터치 타겟 |
| **Understandable** | 이해 가능 | 명확한 레이블, 에러 메시지 |
| **Robust** | 견고함 | 보조 기술 호환 |

## 검사 항목

### 1. 대체 텍스트 (Alt Text)

```tsx
// ❌ 접근성 없음
<Image source={logoUri} />
<Pressable onPress={handleMenu}>
  <MenuIcon />
</Pressable>

// ✅ 접근성 있음
<Image
  source={logoUri}
  accessibilityLabel="UNIQN 로고"
/>
<Pressable
  onPress={handleMenu}
  accessibilityLabel="메뉴 열기"
  accessibilityRole="button"
>
  <MenuIcon accessibilityElementsHidden={true} />
</Pressable>
```

### 2. 터치 타겟 크기

```tsx
// ❌ 너무 작음 (WCAG: 최소 44x44px)
<Pressable style={{ width: 24, height: 24 }}>

// ✅ 적절한 크기
<Pressable style={{ minWidth: 44, minHeight: 44, padding: 10 }}>
```

### 3. 색상 대비

```typescript
// 최소 대비 비율
// - 일반 텍스트: 4.5:1
// - 큰 텍스트 (18pt+): 3:1
// - UI 요소: 3:1

// ❌ 낮은 대비
const styles = {
  text: { color: '#999999', backgroundColor: '#ffffff' }, // 2.85:1
};

// ✅ 충분한 대비
const styles = {
  text: { color: '#595959', backgroundColor: '#ffffff' }, // 7:1
};
```

### 4. 포커스 관리

```tsx
// 모달 열릴 때 포커스 이동
const modalRef = useRef<View>(null);

useEffect(() => {
  if (isOpen) {
    modalRef.current?.focus();
  }
}, [isOpen]);

<Modal>
  <View ref={modalRef} accessible accessibilityViewIsModal>
    {/* 모달 내용 */}
  </View>
</Modal>
```

### 5. 폼 접근성

```tsx
// ❌ 레이블 없음
<TextInput placeholder="이메일" />

// ✅ 레이블 연결
<View>
  <Text nativeID="email-label">이메일</Text>
  <TextInput
    accessibilityLabelledBy="email-label"
    accessibilityLabel="이메일 입력"
    placeholder="example@email.com"
  />
</View>

// 에러 상태 알림
<TextInput
  accessibilityLabel="이메일 입력"
  accessibilityHint={error ? `오류: ${error}` : '이메일 주소를 입력하세요'}
  accessibilityState={{ invalid: !!error }}
/>
```

### 6. 상태 알림

```tsx
// 상태 변화 알림 (스크린리더)
import { AccessibilityInfo } from 'react-native';

// 성공/실패 알림
AccessibilityInfo.announceForAccessibility('저장되었습니다');

// 로딩 상태
<ActivityIndicator
  accessibilityLabel="로딩 중"
  accessibilityRole="progressbar"
/>
```

### 7. 헤딩 구조

```tsx
// 논리적 헤딩 계층
<Text accessibilityRole="header" style={styles.h1}>
  페이지 제목
</Text>
<Text accessibilityRole="header" style={styles.h2}>
  섹션 제목
</Text>
```

### 8. 리스트 접근성

```tsx
<FlashList
  data={items}
  renderItem={({ item, index }) => (
    <View
      accessibilityRole="listitem"
      accessibilityLabel={`${index + 1}번째 항목: ${item.title}`}
    >
      <Text>{item.title}</Text>
    </View>
  )}
  accessibilityRole="list"
  accessibilityLabel={`총 ${items.length}개 항목`}
/>
```

## React Native 접근성 Props

| Prop | 용도 |
|------|------|
| `accessible` | 접근성 요소로 그룹화 |
| `accessibilityLabel` | 스크린리더가 읽을 텍스트 |
| `accessibilityHint` | 동작에 대한 추가 설명 |
| `accessibilityRole` | 요소의 역할 (button, link, header 등) |
| `accessibilityState` | 상태 (disabled, selected, checked 등) |
| `accessibilityValue` | 값 (슬라이더 등) |
| `accessibilityActions` | 커스텀 액션 정의 |
| `accessibilityLiveRegion` | 동적 콘텐츠 알림 |

## 웹 접근성 (app2)

### ARIA 속성
```tsx
// 버튼
<button aria-label="닫기" aria-expanded={isOpen}>

// 모달
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">모달 제목</h2>
</div>

// 탭
<div role="tablist">
  <button role="tab" aria-selected={selected} aria-controls="panel-1">
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
```

### 키보드 네비게이션
```tsx
// Tab 순서
<button tabIndex={0}>첫 번째</button>
<button tabIndex={0}>두 번째</button>

// 포커스 트랩 (모달)
import { FocusTrap } from '@headlessui/react';
<FocusTrap>
  <Modal />
</FocusTrap>
```

## 검사 도구

### 자동 검사
```bash
# 웹 - axe-core
npx @axe-core/cli https://example.com

# React Native - jest-axe
npm install --save-dev jest-axe
```

### 수동 검사
- **iOS**: 설정 → 손쉬운 사용 → VoiceOver
- **Android**: 설정 → 접근성 → TalkBack
- **웹**: Chrome DevTools → Lighthouse → Accessibility

## 체크리스트

### 시각
- [ ] 모든 이미지에 alt/accessibilityLabel
- [ ] 색상 대비 4.5:1 이상
- [ ] 색상만으로 정보 전달하지 않음
- [ ] 텍스트 크기 조절 가능

### 조작
- [ ] 터치 타겟 44x44px 이상
- [ ] 키보드로 모든 기능 접근 가능
- [ ] 포커스 순서 논리적
- [ ] 모달에 포커스 트랩

### 이해
- [ ] 폼 필드에 레이블
- [ ] 에러 메시지 명확
- [ ] 일관된 네비게이션

### 기술
- [ ] 적절한 role 사용
- [ ] 상태 변화 알림
- [ ] 스크린리더 테스트

## 출력 형식

```markdown
## 접근성 검사 결과

### 요약
- 검사 범위: [파일/컴포넌트]
- 발견된 이슈: [N개]
- 심각도: 높음 [N] / 중간 [N] / 낮음 [N]

### 이슈 목록

#### [심각도 높음] 대체 텍스트 누락
- 위치: `JobCard.tsx:45`
- 문제: 이미지에 accessibilityLabel 없음
- 해결:
\`\`\`tsx
<Image
  source={uri}
  accessibilityLabel="공고 이미지"
/>
\`\`\`

#### [심각도 중간] 터치 타겟 작음
- 위치: `Header.tsx:23`
- 문제: 버튼 크기 32x32px
- 해결: minWidth/minHeight 44px 적용

### 권장 사항
1. ...
2. ...
```
