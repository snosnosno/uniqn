---
name: performance
description: 성능 분석 및 최적화. 성능, 느려, 최적화, 렌더링, 번들 크기 요청 시 활성화
allowed-tools: Read, Grep, Glob, Bash, Task
---

# 성능 분석 스킬

애플리케이션 성능을 분석하고 최적화합니다.

## 성능 지표 (목표)

| 지표 | 웹 (app2) | 모바일 (uniqn-mobile) |
|------|-----------|----------------------|
| 번들 크기 | < 300KB (gzip) | < 500KB |
| LCP | < 2.5s | - |
| FID | < 100ms | - |
| 첫 로드 | < 3s | < 2s |
| 화면 전환 | < 300ms | < 300ms |
| 리스트 스크롤 | 60fps | 60fps |

## 성능 분석 영역

### 1. 번들 크기 분석

```bash
# 웹앱 번들 분석
cd app2
npm run build
npm run analyze:bundle  # webpack-bundle-analyzer

# 모바일 번들 분석
cd uniqn-mobile
npx expo export --platform web
# dist 폴더 크기 확인
```

#### 번들 최적화 체크리스트
- [ ] Tree shaking 적용 (사용하지 않는 코드 제거)
- [ ] 코드 스플리팅 (lazy loading)
- [ ] 큰 라이브러리 대체 (moment → date-fns)
- [ ] lodash 개별 import
- [ ] 이미지 최적화

```typescript
// ❌ 전체 import
import _ from 'lodash';
import * as Icons from '@heroicons/react/24/outline';

// ✅ 개별 import
import debounce from 'lodash/debounce';
import { HomeIcon } from '@heroicons/react/24/outline';
```

### 2. 렌더링 성능

#### 불필요한 리렌더링 감지
```typescript
// React DevTools Profiler 사용
// 또는 why-did-you-render 라이브러리

// 렌더링 추적
function MyComponent() {
  console.log('MyComponent rendered');  // 개발 시 확인용
  // ...
}
```

#### 메모이제이션 적용
```tsx
// useMemo: 비용이 큰 계산
const sortedItems = useMemo(() =>
  items.sort((a, b) => b.date - a.date),
  [items]
);

// useCallback: 콜백 함수 안정화
const handleClick = useCallback(() => {
  onAction(id);
}, [onAction, id]);

// React.memo: 컴포넌트 메모이제이션
const ListItem = React.memo(({ item, onPress }) => (
  <Pressable onPress={() => onPress(item.id)}>
    <Text>{item.name}</Text>
  </Pressable>
));
```

#### 리스트 최적화
```tsx
// ❌ FlatList (느림)
<FlatList data={items} renderItem={...} />

// ✅ FlashList (빠름)
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={renderItem}
  estimatedItemSize={80}  // 필수!
  keyExtractor={item => item.id}
/>
```

### 3. 네트워크 성능

#### Firebase 쿼리 최적화
```typescript
// ❌ 전체 조회
const snapshot = await getDocs(collection(db, 'items'));

// ✅ 필요한 것만 조회
const q = query(
  collection(db, 'items'),
  where('status', '==', 'active'),
  orderBy('createdAt', 'desc'),
  limit(20)
);
```

#### 캐싱 전략
```typescript
// TanStack Query 캐싱
const { data } = useQuery({
  queryKey: ['items', filters],
  queryFn: fetchItems,
  staleTime: 5 * 60 * 1000,  // 5분
  gcTime: 30 * 60 * 1000,    // 30분
});
```

### 4. 이미지 최적화

```tsx
// React Native
import { Image } from 'expo-image';

<Image
  source={uri}
  placeholder={blurhash}
  cachePolicy="memory-disk"
  transition={200}
  contentFit="cover"
/>

// 웹
<img
  src={imageUrl}
  loading="lazy"
  decoding="async"
  width={300}
  height={200}
/>
```

### 5. 메모리 관리

```typescript
// 구독 해제 필수
useEffect(() => {
  const unsubscribe = onSnapshot(query, callback);
  return () => unsubscribe();  // 클린업
}, []);

// 타이머 정리
useEffect(() => {
  const timer = setInterval(() => { ... }, 1000);
  return () => clearInterval(timer);
}, []);
```

## 성능 측정

### 웹 성능 측정
```bash
# Lighthouse CI
npx lighthouse https://tholdem-ebc18.web.app --view

# Web Vitals
import { getCLS, getFID, getLCP } from 'web-vitals';
getCLS(console.log);
getFID(console.log);
getLCP(console.log);
```

### React Native 성능 측정
```typescript
// 렌더링 시간 측정
const startTime = performance.now();
// ... 렌더링
const endTime = performance.now();
console.log(`Render time: ${endTime - startTime}ms`);

// Flipper 사용 (개발 시)
```

## 성능 안티패턴

### 1. 인라인 객체/함수
```tsx
// ❌ 매 렌더링마다 새 객체 생성
<Component style={{ marginTop: 10 }} />
<Button onPress={() => handlePress(id)} />

// ✅ 메모이제이션 또는 외부 정의
const styles = StyleSheet.create({ container: { marginTop: 10 } });
const handlePress = useCallback(() => { ... }, []);
```

### 2. 무분별한 상태 업데이트
```typescript
// ❌ 여러 번 상태 업데이트
setA(1);
setB(2);
setC(3);

// ✅ 하나로 합치기
setState({ a: 1, b: 2, c: 3 });
```

### 3. 부모 컴포넌트에서 전체 리렌더링
```tsx
// ❌ 부모 상태 변경 → 모든 자식 리렌더링
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <View>
      <ExpensiveChild />  {/* 불필요한 리렌더링 */}
      <Counter count={count} />
    </View>
  );
}

// ✅ React.memo 또는 상태 분리
const ExpensiveChild = React.memo(() => { ... });
```

## 체크리스트

### 렌더링
- [ ] React.memo 적용 (리스트 아이템)
- [ ] useMemo/useCallback 적용
- [ ] 불필요한 리렌더링 제거
- [ ] FlashList 사용 (긴 리스트)

### 번들
- [ ] 코드 스플리팅 적용
- [ ] 사용하지 않는 코드 제거
- [ ] 이미지 최적화

### 네트워크
- [ ] Firebase 쿼리 최적화
- [ ] 적절한 캐싱 적용
- [ ] 배치 요청 사용

### 메모리
- [ ] 구독 해제 확인
- [ ] 타이머 정리
- [ ] 이벤트 리스너 정리

## 출력 형식

```markdown
## 성능 분석 결과

### 현황
- 번들 크기: [크기]
- 렌더링 시간: [시간]
- 주요 병목: [영역]

### 발견된 이슈
1. **[이슈 1]**
   - 위치: [파일:라인]
   - 영향: [설명]
   - 해결: [방법]

### 최적화 제안
| 우선순위 | 항목 | 예상 효과 |
|---------|------|----------|
| 높음 | ... | ... |
| 중간 | ... | ... |

### 개선 후 예상 지표
- 번들 크기: [크기] → [목표]
- 렌더링: [현재] → [목표]
```
