# 22. 마이그레이션 매핑 가이드

## 목차
1. [개요](#1-개요)
2. [코드 재사용 매트릭스](#2-코드-재사용-매트릭스)
3. [일관성 개선](#3-일관성-개선)
4. [성능 개선](#4-성능-개선)
5. [보안 개선](#5-보안-개선)
6. [UI/UX 개선](#6-uiux-개선)
7. [확장성 개선](#7-확장성-개선)
8. [데이터 흐름 개선](#8-데이터-흐름-개선)
9. [에러 처리 개선](#9-에러-처리-개선)
10. [의존성 최적화](#10-의존성-최적화)
11. [재사용성 개선](#11-재사용성-개선)
12. [컴포넌트 변환 가이드](#12-컴포넌트-변환-가이드)
13. [훅 마이그레이션 가이드](#13-훅-마이그레이션-가이드)
14. [서비스 마이그레이션 가이드](#14-서비스-마이그레이션-가이드)

---

## 1. 개요

### 현재 app2/ 코드베이스 분석

```yaml
총계:
  컴포넌트: 132+
  페이지: 57
  훅: 46+
  서비스: 20+
  타입 파일: 50
  유틸리티: 38+
  Zustand 스토어: 5
  Context: 6
```

### 마이그레이션 목표

1. **일관성**: 코드 패턴, 네이밍, 구조 통일
2. **성능**: 불필요한 리렌더링 제거, 메모리 최적화
3. **보안**: Certificate Pinning, 앱 무결성 검증
4. **UI/UX**: 네이티브 UX 패턴 적용
5. **확장성**: 모듈화, 플러그인 아키텍처
6. **데이터 흐름**: 단방향 데이터 흐름 강화
7. **에러 처리**: 일관된 에러 핸들링
8. **의존성**: 번들 크기 최적화
9. **재사용성**: 공통 로직 추출

---

## 2. 코드 재사용 매트릭스

### 100% 재사용 (복사만)

| 소스 (app2/src/) | 대상 (uniqn-mobile/src/) | 파일 수 | 변경 사항 |
|------------------|---------------------------|---------|----------|
| `types/` | `types/` | 50 | 없음 |
| `schemas/` | `schemas/` | 3 | 없음 |
| `constants/` | `constants/` | 5+ | 없음 |

### 90% 재사용 (경로/import 수정)

| 소스 | 대상 | 변경 사항 |
|------|------|----------|
| `utils/dateUtils.ts` | `utils/dateUtils.ts` | import 경로만 |
| `utils/timeUtils.ts` | `utils/timeUtils.ts` | import 경로만 |
| `utils/formatters.ts` | `utils/formatters.ts` | import 경로만 |
| `utils/validators.ts` | `utils/validators.ts` | import 경로만 |
| `utils/payrollCalculations.ts` | `utils/payrollCalculations.ts` | import 경로만 |

### 70-80% 재사용 (Firebase/플랫폼 수정)

| 소스 | 대상 | 변경 사항 |
|------|------|----------|
| `stores/unifiedDataStore.ts` | `stores/unifiedDataStore.ts` | Firebase import 변경 |
| `stores/toastStore.ts` | `stores/toastStore.ts` | Toast 구현체 변경 |
| `services/` | `services/` | Firebase import, 플랫폼 분기 |
| `hooks/firestore/` | `hooks/firestore/` | Firebase import 변경 |

### 재작성 필요

| 소스 | 대상 | 이유 |
|------|------|------|
| `components/` (132+) | `components/` | React DOM → React Native |
| `pages/` (57) | `app/` | React Router → Expo Router |
| `contexts/` (6) | `hooks/` or `stores/` | Context → Zustand 통합 |

---

## 3. 일관성 개선

### 3.1 네이밍 컨벤션 통일

#### 현재 문제점

```typescript
// ❌ 불일치: 파일명과 export명
// staffManagement.ts
export const useStaffManagement = () => {}  // OK
export const staffService = {}              // ❌ 불일치

// ❌ 불일치: 함수명 패턴
const handleClick = () => {}    // 이벤트 핸들러
const onSubmit = () => {}       // 이벤트 핸들러 (다른 패턴)
const clickHandler = () => {}   // 또 다른 패턴

// ❌ 불일치: 상태명
const [data, setData] = useState()      // 너무 일반적
const [staffList, setStaffList] = useState()  // OK
const [items, setItems] = useState()    // 컨텍스트 불명확
```

#### 개선안

```typescript
// ✅ 통일된 네이밍 규칙
// 파일명: camelCase
// staffManagement.ts → StaffManagementService.ts (서비스)
// useStaffManagement.ts (훅)

// 훅 네이밍
export function useStaffManagement() {}     // 항상 use 접두사
export function useJobPostings() {}

// 이벤트 핸들러: handle + 동사
const handleSubmit = () => {}
const handleClick = () => {}
const handleChange = () => {}

// 콜백 props: on + 동사 (외부에서 전달받는 경우)
interface Props {
  onSubmit: () => void
  onChange: (value: string) => void
}

// 상태: 명확한 컨텍스트
const [staffList, setStaffList] = useState<Staff[]>([])
const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
const [isLoadingStaff, setIsLoadingStaff] = useState(false)
```

### 3.2 폴더 구조 통일

#### 현재 문제점

```
app2/src/
├── components/
│   ├── staff/              # 기능별 폴더
│   ├── common/             # 공통 컴포넌트
│   ├── ui/                 # UI 컴포넌트 (common과 중복?)
│   └── StaffCard.tsx       # 루트에 있는 파일도 있음
├── hooks/
│   ├── useStaffData.ts     # 단일 파일
│   ├── staff/              # 폴더 (불일치)
│   └── useScheduleData/    # 폴더 (불일치)
```

#### 개선안

```
uniqn-mobile/src/
├── components/
│   ├── ui/                 # 기본 UI (Button, Input, Card)
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── index.ts
│   │   └── index.ts        # 배럴 export
│   ├── common/             # 공통 비즈니스 컴포넌트
│   │   ├── EmptyState/
│   │   ├── LoadingSpinner/
│   │   └── index.ts
│   └── features/           # 기능별 컴포넌트
│       ├── staff/
│       ├── job/
│       └── schedule/
├── hooks/
│   ├── common/             # 공통 훅
│   │   ├── useDebounce.ts
│   │   └── useMediaQuery.ts
│   ├── firebase/           # Firebase 훅
│   │   └── useFirestoreQuery.ts
│   └── features/           # 기능별 훅
│       ├── staff/
│       └── job/
├── services/
│   ├── api/                # API 서비스
│   ├── firebase/           # Firebase 서비스
│   └── features/           # 기능별 서비스
```

### 3.3 Export 패턴 통일

#### 현재 문제점

```typescript
// 파일마다 다른 export 패턴
// staffService.ts
export const staffService = {}  // named export (객체)

// AuthContext.tsx
export const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)
export default AuthProvider  // default export (컴포넌트)

// dateUtils.ts
export function formatDate() {}
export function parseDate() {}
// default export 없음
```

#### 개선안

```typescript
// ✅ 통일된 Export 규칙

// 1. 컴포넌트: default export
// Button.tsx
export default function Button() {}

// 2. 훅: named export
// useStaff.ts
export function useStaff() {}
export function useStaffList() {}

// 3. 서비스: named export (클래스 또는 객체)
// StaffService.ts
export class StaffService {}
// 또는
export const staffService = {}

// 4. 유틸리티: named export
// dateUtils.ts
export function formatDate() {}
export function parseDate() {}

// 5. 타입: named export
// staff.ts
export interface Staff {}
export type StaffRole = 'dealer' | 'floor'

// 6. 배럴 파일 (index.ts)
export { Button } from './Button'
export { Card } from './Card'
export * from './types'
```

---

## 4. 성능 개선

### 4.1 불필요한 리렌더링 방지

#### 현재 문제점

```typescript
// ❌ 매 렌더링마다 새 객체 생성
const StaffList = () => {
  const filters = { status: 'active', sort: 'name' }  // 새 객체

  return <StaffGrid filters={filters} />  // 매번 리렌더링
}

// ❌ 인라인 함수
<Button onClick={() => handleClick(item.id)} />

// ❌ Context 과도한 사용
const { staff, workLogs, applications } = useUnifiedData()
// 하나만 필요해도 전체 리렌더링
```

#### 개선안

```typescript
// ✅ useMemo로 객체 메모이제이션
const StaffList = () => {
  const filters = useMemo(() => ({
    status: 'active',
    sort: 'name'
  }), [])

  return <StaffGrid filters={filters} />
}

// ✅ useCallback으로 함수 메모이제이션
const handleItemClick = useCallback((id: string) => {
  handleClick(id)
}, [handleClick])

<Button onPress={() => handleItemClick(item.id)} />

// ✅ Zustand 셀렉터로 필요한 상태만 구독
const staff = useUnifiedDataStore(state => state.staff)
const getStaffById = useUnifiedDataStore(state => state.getStaffById)

// ✅ Zustand shallow 비교
import { shallow } from 'zustand/shallow'

const { staff, loading } = useUnifiedDataStore(
  state => ({ staff: state.staff, loading: state.loading }),
  shallow
)
```

### 4.2 리스트 최적화

#### 현재 (React Window 사용)

```typescript
// app2/src/components/staff/StaffList.tsx
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={400}
  itemCount={items.length}
  itemSize={80}
>
  {({ index, style }) => (
    <div style={style}>
      <StaffCard staff={items[index]} />
    </div>
  )}
</FixedSizeList>
```

#### 개선안 (FlashList 사용)

```typescript
// uniqn-mobile/src/components/features/staff/StaffList.tsx
import { FlashList } from '@shopify/flash-list'

<FlashList
  data={items}
  renderItem={({ item }) => <StaffCard staff={item} />}
  estimatedItemSize={80}
  keyExtractor={item => item.id}
  // 추가 최적화
  getItemType={item => item.type}
  overrideItemLayout={(layout, item) => {
    layout.size = item.type === 'header' ? 40 : 80
  }}
/>
```

### 4.3 메모리 최적화

#### 현재 문제점

```typescript
// ❌ 대용량 데이터 전체 메모리 유지
const [allWorkLogs, setAllWorkLogs] = useState<WorkLog[]>([])
// 10,000+ 레코드가 메모리에

// ❌ 이미지 캐싱 없음
<img src={profileUrl} />
```

#### 개선안

```typescript
// ✅ 페이지네이션 / 무한스크롤
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['workLogs', filters],
  queryFn: ({ pageParam = null }) => fetchWorkLogs(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})

// ✅ expo-image로 이미지 캐싱
import { Image } from 'expo-image'

<Image
  source={profileUrl}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"  // 메모리 + 디스크 캐싱
/>
```

### 4.4 번들 최적화

```typescript
// ✅ 동적 import (코드 스플리팅)
// app/(tabs)/admin.tsx
const AdminDashboard = lazy(() => import('@/components/features/admin/Dashboard'))

// ✅ 조건부 로드
const loadHeavyComponent = async () => {
  if (Platform.OS === 'web') {
    return import('./HeavyWebComponent')
  }
  return import('./HeavyNativeComponent')
}
```

---

## 5. 보안 개선

### 5.1 인증 토큰 관리

#### 현재 (localStorage)

```typescript
// ❌ 웹: localStorage (XSS 취약)
localStorage.setItem('token', token)
```

#### 개선안 (Secure Storage)

```typescript
// ✅ React Native: expo-secure-store
import * as SecureStore from 'expo-secure-store'

// src/lib/secureStorage.ts
export const secureStorage = {
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      // 웹: httpOnly 쿠키 또는 sessionStorage (제한적)
      sessionStorage.setItem(key, value)
    } else {
      // 네이티브: 암호화된 저장소
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
    }
  },

  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return sessionStorage.getItem(key)
    }
    return SecureStore.getItemAsync(key)
  },

  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      sessionStorage.removeItem(key)
    } else {
      await SecureStore.deleteItemAsync(key)
    }
  },
}
```

### 5.2 입력 검증 강화

#### 현재 (Zod 일부 적용)

```typescript
// 일부 스키마만 존재
// schemas/jobPosting/*.ts
// schemas/announcement.schema.ts
// schemas/penalty.schema.ts
```

#### 개선안 (전체 스키마 적용)

```typescript
// ✅ 모든 사용자 입력에 Zod 스키마 적용
// src/schemas/index.ts

export * from './auth.schema'
export * from './staff.schema'
export * from './jobPosting.schema'
export * from './workLog.schema'
export * from './payment.schema'
export * from './profile.schema'

// src/schemas/staff.schema.ts
import { z } from 'zod'
import { xssValidation } from '@/utils/security'

export const staffProfileSchema = z.object({
  name: z.string()
    .min(2, '이름은 2자 이상')
    .max(50, '이름은 50자 이하')
    .refine(xssValidation, 'XSS 차단'),
  phone: z.string()
    .regex(/^01[0-9]-\d{3,4}-\d{4}$/, '올바른 전화번호 형식'),
  email: z.string()
    .email('올바른 이메일 형식'),
  bio: z.string()
    .max(500, '자기소개는 500자 이하')
    .transform(sanitizeHtml)
    .optional(),
})

// ✅ 훅에서 사용
export function useProfileForm() {
  const form = useForm<z.infer<typeof staffProfileSchema>>({
    resolver: zodResolver(staffProfileSchema),
  })

  return form
}
```

### 5.3 네트워크 보안

```typescript
// ✅ src/lib/apiClient.ts
import { pinnedFetch } from './pinnedFetch'
import { securityGate } from './securityGate'

class ApiClient {
  private baseURL = 'https://api.uniqn.app'

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // 1. 앱 무결성 검증
    const integrity = await securityGate.performStartupCheck()
    if (integrity.action === 'block') {
      throw new AppError({
        code: 'INTEGRITY_CHECK_FAILED',
        message: integrity.message,
      })
    }

    // 2. 인증 토큰 첨부
    const token = await secureStorage.get('authToken')
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    }

    // 3. Certificate Pinning 적용 fetch
    const response = await pinnedFetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      throw await this.handleError(response)
    }

    return response.json()
  }
}

export const apiClient = new ApiClient()
```

---

## 6. UI/UX 개선

### 6.1 플랫폼별 UX 패턴

#### 현재 (웹 중심)

```typescript
// 모든 플랫폼에서 동일한 UI
<button onClick={handleClick}>
  Click
</button>
```

#### 개선안 (플랫폼 적응형)

```typescript
// ✅ iOS: 스와이프 백, 바운스 효과
// ✅ Android: 백 버튼, 리플 효과

// src/components/ui/Button/Button.tsx
import { Platform, Pressable, Text, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'

interface ButtonProps {
  onPress: () => void
  title: string
  variant?: 'primary' | 'secondary' | 'ghost'
  haptic?: boolean
}

export default function Button({
  onPress,
  title,
  variant = 'primary',
  haptic = true,
}: ButtonProps) {
  const handlePress = () => {
    // iOS: 햅틱 피드백
    if (haptic && Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        // Android: 리플 효과는 android_ripple로
        Platform.OS === 'ios' && pressed && styles.pressed,
      ]}
      android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
    >
      <Text style={[styles.text, styles[`${variant}Text`]]}>
        {title}
      </Text>
    </Pressable>
  )
}
```

### 6.2 네비게이션 개선

```typescript
// ✅ iOS: 스와이프 제스처, 모달 프레젠테이션
// ✅ Android: 시스템 백 버튼

// app/_layout.tsx
import { Stack } from 'expo-router'
import { Platform } from 'react-native'

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        // iOS: 네이티브 헤더
        headerLargeTitle: Platform.OS === 'ios',
        // 제스처 설정
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        // Android: 머티리얼 디자인 전환
        animation: Platform.select({
          ios: 'default',
          android: 'slide_from_right',
        }),
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="job-posting/[id]"
        options={{
          // iOS: 모달 스타일
          presentation: Platform.OS === 'ios' ? 'card' : 'modal',
        }}
      />
    </Stack>
  )
}
```

### 6.3 로딩/에러 상태 개선

```typescript
// ✅ Skeleton 로딩 (UX 개선)
// src/components/ui/Skeleton/Skeleton.tsx
import { MotiView } from 'moti'

export function Skeleton({ width, height, radius = 4 }) {
  return (
    <MotiView
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
      }}
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: '#E5E7EB',
      }}
    />
  )
}

// ✅ 에러 상태 컴포넌트
// src/components/common/ErrorState/ErrorState.tsx
export function ErrorState({
  error,
  onRetry,
}: {
  error: AppError
  onRetry?: () => void
}) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <ExclamationCircleIcon className="w-16 h-16 text-red-500" />
      <Text className="text-lg font-bold mt-4 text-gray-900 dark:text-white">
        {error.userMessage || '문제가 발생했습니다'}
      </Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
        {error.description}
      </Text>
      {onRetry && (
        <Button
          title="다시 시도"
          onPress={onRetry}
          variant="primary"
          className="mt-6"
        />
      )}
    </View>
  )
}
```

### 6.4 접근성 개선

```typescript
// ✅ WCAG 2.1 AA 준수
// src/components/ui/Card/Card.tsx
import { AccessibilityInfo, View, Text } from 'react-native'

interface CardProps {
  title: string
  description?: string
  onPress?: () => void
  accessible?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
}

export function Card({
  title,
  description,
  onPress,
  accessible = true,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessible={accessible}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      // 최소 터치 영역 44x44
      style={{ minHeight: 44 }}
    >
      <View className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <Text
          className="text-lg font-semibold text-gray-900 dark:text-white"
          accessibilityRole="header"
        >
          {title}
        </Text>
        {description && (
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
```

---

## 7. 확장성 개선

### 7.1 모듈화 아키텍처

#### 현재 문제점

```typescript
// ❌ 기능이 여러 폴더에 분산
// components/staff/StaffCard.tsx
// hooks/useStaffData.ts
// hooks/staff/useStaffActions.ts
// services/staffService.ts
// types/staff.ts
// utils/staff/staffUtils.ts
```

#### 개선안 (Feature Module 패턴)

```
src/
├── modules/                    # 기능 모듈
│   ├── staff/                 # Staff 모듈
│   │   ├── components/        # Staff 전용 컴포넌트
│   │   │   ├── StaffCard.tsx
│   │   │   ├── StaffList.tsx
│   │   │   └── index.ts
│   │   ├── hooks/             # Staff 전용 훅
│   │   │   ├── useStaff.ts
│   │   │   └── index.ts
│   │   ├── services/          # Staff 전용 서비스
│   │   │   └── StaffService.ts
│   │   ├── types.ts           # Staff 타입
│   │   ├── schemas.ts         # Staff 스키마
│   │   └── index.ts           # 모듈 export
│   │
│   ├── job/                   # Job 모듈
│   ├── schedule/              # Schedule 모듈
│   ├── payment/               # Payment 모듈
│   └── admin/                 # Admin 모듈
│
├── shared/                     # 공유 코드
│   ├── components/            # 공유 컴포넌트
│   ├── hooks/                 # 공유 훅
│   ├── services/              # 공유 서비스
│   ├── types/                 # 공유 타입
│   └── utils/                 # 공유 유틸리티
```

### 7.2 플러그인 시스템

```typescript
// ✅ src/lib/pluginSystem.ts
interface Plugin {
  name: string
  version: string
  initialize: () => Promise<void>
  cleanup?: () => void
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map()

  register(plugin: Plugin): void {
    this.plugins.set(plugin.name, plugin)
  }

  async initializeAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.initialize()
        logger.info(`Plugin initialized: ${name}`)
      } catch (error) {
        logger.error(`Plugin failed: ${name}`, error)
      }
    }
  }
}

// 사용 예
pluginManager.register({
  name: 'analytics',
  version: '1.0.0',
  initialize: async () => {
    await analyticsService.initialize()
  },
})

pluginManager.register({
  name: 'crashlytics',
  version: '1.0.0',
  initialize: async () => {
    await crashlyticsService.initialize()
  },
})
```

### 7.3 Feature Flag 시스템 개선

```typescript
// ✅ src/config/features.ts
import { Platform } from 'react-native'

type FeatureFlag = {
  enabled: boolean
  platforms?: ('ios' | 'android' | 'web')[]
  rolloutPercentage?: number
  minVersion?: string
}

const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // 비활성화된 기능 (Phase 2)
  TOURNAMENTS: {
    enabled: false,
  },

  // 플랫폼별 기능
  BIOMETRIC_AUTH: {
    enabled: true,
    platforms: ['ios', 'android'],  // 웹 제외
  },

  // 점진적 출시
  NEW_JOB_BOARD_UI: {
    enabled: true,
    rolloutPercentage: 50,  // 50% 사용자에게만
  },

  // 버전별 기능
  ADVANCED_FILTERS: {
    enabled: true,
    minVersion: '1.2.0',
  },
}

export function isFeatureEnabled(
  featureName: string,
  userId?: string
): boolean {
  const flag = FEATURE_FLAGS[featureName]
  if (!flag || !flag.enabled) return false

  // 플랫폼 체크
  if (flag.platforms && !flag.platforms.includes(Platform.OS)) {
    return false
  }

  // 롤아웃 퍼센티지 체크
  if (flag.rolloutPercentage && userId) {
    const hash = hashUserId(userId)
    if (hash > flag.rolloutPercentage) return false
  }

  // 버전 체크
  if (flag.minVersion) {
    const currentVersion = Constants.expoConfig?.version || '0.0.0'
    if (compareVersions(currentVersion, flag.minVersion) < 0) {
      return false
    }
  }

  return true
}
```

---

## 8. 데이터 흐름 개선

### 8.1 단방향 데이터 흐름 강화

#### 현재 문제점

```typescript
// ❌ Context와 Zustand 혼용
<AuthContext.Provider>
  <TournamentContextAdapter>  {/* Zustand 래퍼 */}
    <ChipContext.Provider>
      <JobPostingContextAdapter>  {/* Zustand 래퍼 */}
        <App />
```

#### 개선안 (Zustand 단일화)

```typescript
// ✅ Zustand 스토어로 통합
// src/stores/index.ts
export { useAuthStore } from './authStore'
export { useUnifiedDataStore } from './unifiedDataStore'
export { useJobPostingStore } from './jobPostingStore'
export { useThemeStore } from './themeStore'
export { useToastStore } from './toastStore'

// AuthContext → authStore
// src/stores/authStore.ts
interface AuthState {
  currentUser: User | null
  isLoading: boolean
  isAdmin: boolean
  role: UserRole | null

  // Actions
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        currentUser: null,
        isLoading: true,
        isAdmin: false,
        role: null,

        initialize: async () => {
          const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
              const userData = await fetchUserData(user.uid)
              set({
                currentUser: userData,
                isAdmin: userData.role === 'admin',
                role: userData.role,
                isLoading: false,
              })
            } else {
              set({
                currentUser: null,
                isAdmin: false,
                role: null,
                isLoading: false,
              })
            }
          })

          return unsubscribe
        },

        signIn: async (email, password) => {
          set({ isLoading: true })
          await auth.signInWithEmailAndPassword(email, password)
        },

        signOut: async () => {
          await auth.signOut()
          set({ currentUser: null, isAdmin: false, role: null })
        },
      }),
      { name: 'auth-store' }
    )
  )
)
```

### 8.2 서버 상태 관리 (TanStack Query)

```typescript
// ✅ src/hooks/queries/useJobPostings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query Keys 중앙화
export const jobPostingKeys = {
  all: ['jobPostings'] as const,
  lists: () => [...jobPostingKeys.all, 'list'] as const,
  list: (filters: JobPostingFilters) =>
    [...jobPostingKeys.lists(), filters] as const,
  details: () => [...jobPostingKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobPostingKeys.details(), id] as const,
}

// Query Hook
export function useJobPostings(filters: JobPostingFilters) {
  return useQuery({
    queryKey: jobPostingKeys.list(filters),
    queryFn: () => jobPostingService.getList(filters),
    staleTime: 5 * 60 * 1000,  // 5분
    gcTime: 30 * 60 * 1000,    // 30분
  })
}

// Mutation Hook
export function useCreateJobPosting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: jobPostingService.create,
    onSuccess: () => {
      // 리스트 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: jobPostingKeys.lists(),
      })
    },
    onError: (error) => {
      logger.error('Failed to create job posting', error)
      useToastStore.getState().addToast({
        type: 'error',
        message: '공고 등록에 실패했습니다',
      })
    },
  })
}
```

### 8.3 실시간 데이터 구독

```typescript
// ✅ src/hooks/firebase/useRealtimeSubscription.ts
import { useEffect } from 'react'
import { onSnapshot, Query } from 'firebase/firestore'
import { useQueryClient } from '@tanstack/react-query'

export function useRealtimeSubscription<T>(
  queryKey: string[],
  firestoreQuery: Query<T>
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = onSnapshot(
      firestoreQuery,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // React Query 캐시 업데이트
        queryClient.setQueryData(queryKey, data)
      },
      (error) => {
        logger.error('Realtime subscription error', error, {
          queryKey: queryKey.join('/'),
        })
      }
    )

    return () => unsubscribe()
  }, [queryKey, firestoreQuery, queryClient])
}

// 사용 예
function StaffList() {
  const staffQuery = query(collection(db, 'staff'), where('active', '==', true))

  // 실시간 구독
  useRealtimeSubscription(['staff', 'active'], staffQuery)

  // React Query로 데이터 접근
  const { data: staff } = useQuery({
    queryKey: ['staff', 'active'],
    queryFn: () => [],  // 초기값 (구독이 업데이트)
    staleTime: Infinity,  // 구독이 관리
  })

  return <StaffGrid staff={staff} />
}
```

---

## 9. 에러 처리 개선

### 9.1 에러 타입 체계화

```typescript
// ✅ src/lib/errors/AppError.ts
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  FIREBASE = 'FIREBASE',
  SECURITY = 'SECURITY',
  BUSINESS = 'BUSINESS',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorCode {
  // 네트워크
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',

  // 인증
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',

  // 검증
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Firebase
  FIREBASE_PERMISSION_DENIED = 'FIREBASE_PERMISSION_DENIED',
  FIREBASE_NOT_FOUND = 'FIREBASE_NOT_FOUND',

  // 보안
  SECURITY_INTEGRITY_FAILED = 'SECURITY_INTEGRITY_FAILED',
  SECURITY_CERTIFICATE_INVALID = 'SECURITY_CERTIFICATE_INVALID',

  // 비즈니스
  BUSINESS_INSUFFICIENT_CHIPS = 'BUSINESS_INSUFFICIENT_CHIPS',
  BUSINESS_ALREADY_APPLIED = 'BUSINESS_ALREADY_APPLIED',
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly category: ErrorCategory
  readonly userMessage: string
  readonly context?: Record<string, unknown>
  readonly originalError?: Error
  readonly isRetryable: boolean

  constructor(params: {
    code: ErrorCode
    message: string
    userMessage?: string
    category?: ErrorCategory
    context?: Record<string, unknown>
    originalError?: Error
    isRetryable?: boolean
  }) {
    super(params.message)
    this.name = 'AppError'
    this.code = params.code
    this.category = params.category || this.inferCategory(params.code)
    this.userMessage = params.userMessage || this.getDefaultUserMessage(params.code)
    this.context = params.context
    this.originalError = params.originalError
    this.isRetryable = params.isRetryable ?? this.inferRetryable(params.code)
  }

  private inferCategory(code: ErrorCode): ErrorCategory {
    if (code.startsWith('NETWORK_')) return ErrorCategory.NETWORK
    if (code.startsWith('AUTH_')) return ErrorCategory.AUTH
    if (code.startsWith('VALIDATION_')) return ErrorCategory.VALIDATION
    if (code.startsWith('FIREBASE_')) return ErrorCategory.FIREBASE
    if (code.startsWith('SECURITY_')) return ErrorCategory.SECURITY
    if (code.startsWith('BUSINESS_')) return ErrorCategory.BUSINESS
    return ErrorCategory.UNKNOWN
  }

  private getDefaultUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.NETWORK_OFFLINE]: '인터넷 연결을 확인해주세요',
      [ErrorCode.NETWORK_TIMEOUT]: '요청 시간이 초과되었습니다. 다시 시도해주세요',
      [ErrorCode.AUTH_INVALID_CREDENTIALS]: '이메일 또는 비밀번호가 올바르지 않습니다',
      [ErrorCode.AUTH_SESSION_EXPIRED]: '세션이 만료되었습니다. 다시 로그인해주세요',
      [ErrorCode.AUTH_UNAUTHORIZED]: '접근 권한이 없습니다',
      [ErrorCode.VALIDATION_FAILED]: '입력 내용을 확인해주세요',
      [ErrorCode.FIREBASE_PERMISSION_DENIED]: '접근 권한이 없습니다',
      [ErrorCode.FIREBASE_NOT_FOUND]: '요청한 데이터를 찾을 수 없습니다',
      [ErrorCode.SECURITY_INTEGRITY_FAILED]: '보안 검증에 실패했습니다',
      [ErrorCode.SECURITY_CERTIFICATE_INVALID]: '보안 연결에 실패했습니다',
      [ErrorCode.BUSINESS_INSUFFICIENT_CHIPS]: '칩이 부족합니다',
      [ErrorCode.BUSINESS_ALREADY_APPLIED]: '이미 지원한 공고입니다',
    }
    return messages[code] || '문제가 발생했습니다'
  }

  private inferRetryable(code: ErrorCode): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_OFFLINE,
      ErrorCode.NETWORK_TIMEOUT,
    ]
    return retryableCodes.includes(code)
  }
}
```

### 9.2 에러 바운더리 개선

```typescript
// ✅ src/components/errors/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text } from 'react-native'
import { logger } from '@/lib/logger'
import { analyticsService } from '@/services/analytics'
import { ErrorState } from '@/components/common/ErrorState'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 로깅
    logger.error('ErrorBoundary caught error', error, {
      componentStack: errorInfo.componentStack,
    })

    // 분석
    analyticsService.logEvent('error_boundary_caught', {
      errorMessage: error.message,
      errorName: error.name,
    })

    // 콜백
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorState
          error={this.state.error!}
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}

// 기능별 에러 바운더리
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode
    onError?: (error: Error) => void
  }
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary {...options}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
```

### 9.3 글로벌 에러 핸들링

```typescript
// ✅ src/lib/errorHandler.ts
import { AppError, ErrorCategory, ErrorCode } from './errors/AppError'
import { logger } from './logger'
import { useToastStore } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'

class ErrorHandler {
  handle(error: unknown): AppError {
    const appError = this.normalize(error)

    // 로깅
    this.log(appError)

    // 특별 처리
    this.handleSpecialCases(appError)

    // 사용자 알림
    this.notify(appError)

    return appError
  }

  private normalize(error: unknown): AppError {
    // 이미 AppError
    if (error instanceof AppError) {
      return error
    }

    // Firebase 에러
    if (this.isFirebaseError(error)) {
      return this.fromFirebaseError(error)
    }

    // 네트워크 에러
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new AppError({
        code: ErrorCode.NETWORK_OFFLINE,
        message: 'Network request failed',
        originalError: error as Error,
      })
    }

    // 일반 Error
    if (error instanceof Error) {
      return new AppError({
        code: ErrorCode.UNKNOWN,
        message: error.message,
        originalError: error,
      })
    }

    // 알 수 없는 에러
    return new AppError({
      code: ErrorCode.UNKNOWN,
      message: String(error),
    })
  }

  private log(error: AppError): void {
    if (error.category === ErrorCategory.UNKNOWN) {
      logger.error('Unhandled error', error.originalError || error, {
        code: error.code,
        category: error.category,
        context: error.context,
      })
    } else {
      logger.warn('Handled error', {
        code: error.code,
        category: error.category,
        message: error.message,
        context: error.context,
      })
    }
  }

  private handleSpecialCases(error: AppError): void {
    switch (error.code) {
      case ErrorCode.AUTH_SESSION_EXPIRED:
      case ErrorCode.AUTH_UNAUTHORIZED:
        // 자동 로그아웃
        useAuthStore.getState().signOut()
        break

      case ErrorCode.SECURITY_INTEGRITY_FAILED:
        // 앱 종료 고려
        break
    }
  }

  private notify(error: AppError): void {
    // 보안 에러는 다르게 표시
    if (error.category === ErrorCategory.SECURITY) {
      useToastStore.getState().addToast({
        type: 'error',
        message: error.userMessage,
        duration: 10000,  // 더 오래 표시
      })
      return
    }

    // 일반 에러
    useToastStore.getState().addToast({
      type: 'error',
      message: error.userMessage,
    })
  }

  private isFirebaseError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as any).code === 'string' &&
      (error as any).code.startsWith('auth/')
    )
  }

  private fromFirebaseError(error: any): AppError {
    const codeMap: Record<string, ErrorCode> = {
      'auth/invalid-email': ErrorCode.VALIDATION_FAILED,
      'auth/user-not-found': ErrorCode.AUTH_INVALID_CREDENTIALS,
      'auth/wrong-password': ErrorCode.AUTH_INVALID_CREDENTIALS,
      'auth/too-many-requests': ErrorCode.AUTH_UNAUTHORIZED,
      'permission-denied': ErrorCode.FIREBASE_PERMISSION_DENIED,
      'not-found': ErrorCode.FIREBASE_NOT_FOUND,
    }

    return new AppError({
      code: codeMap[error.code] || ErrorCode.UNKNOWN,
      message: error.message,
      originalError: error,
    })
  }
}

export const errorHandler = new ErrorHandler()

// 훅으로 사용
export function useErrorHandler() {
  return {
    handle: (error: unknown) => errorHandler.handle(error),
    handleAsync: async <T>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn()
      } catch (error) {
        errorHandler.handle(error)
        return null
      }
    },
  }
}
```

---

## 10. 의존성 최적화

### 10.1 현재 의존성 분석

```yaml
# 제거 가능
react-window: "FlashList로 대체"
@heroicons/react: "React Native 용 아이콘 라이브러리로 대체"
react-router-dom: "Expo Router로 대체"

# 대체 필요
tailwindcss: "NativeWind"
dnd-kit: "react-native-draggable-flatlist"
@tanstack/react-table: "react-native-table-component 또는 커스텀"

# 그대로 사용
zustand: "RN 호환"
@tanstack/react-query: "RN 호환"
zod: "RN 호환"
date-fns: "RN 호환"
i18next: "RN 호환"
firebase: "RN Firebase SDK로 교체"
```

### 10.2 번들 크기 최적화

```typescript
// ✅ package.json 최적화
{
  "dependencies": {
    // 필수 코어
    "react": "18.2.0",
    "react-native": "0.73.x",
    "expo": "~50.0.0",

    // 네비게이션
    "expo-router": "~3.0.0",

    // 상태 관리 (경량)
    "zustand": "^4.5.0",           // 1.2KB
    "@tanstack/react-query": "^5.0.0",

    // 스타일
    "nativewind": "^4.0.0",

    // Firebase (필요한 것만)
    "@react-native-firebase/app": "^18.0.0",
    "@react-native-firebase/auth": "^18.0.0",
    "@react-native-firebase/firestore": "^18.0.0",
    // storage, functions는 필요시 추가

    // 유틸리티 (경량)
    "zod": "^3.23.0",
    "date-fns": "^3.0.0",

    // UI (경량 대안)
    "@expo/vector-icons": "^14.0.0",  // 아이콘
    "expo-image": "^1.0.0",            // 이미지 최적화
  },

  "devDependencies": {
    // 타입
    "typescript": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/react-native": "^0.73.0",
  }
}
```

### 10.3 트리 쉐이킹

```typescript
// ❌ 전체 import
import { format, parse, addDays, subDays, ... } from 'date-fns'

// ✅ 개별 import (트리 쉐이킹)
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import addDays from 'date-fns/addDays'

// ❌ lodash 전체
import _ from 'lodash'

// ✅ 필요한 함수만 (또는 네이티브 대안)
import debounce from 'lodash/debounce'
// 또는 직접 구현
const debounce = (fn, delay) => {...}
```

---

## 11. 재사용성 개선

### 11.1 공통 훅 추출

```typescript
// ✅ src/shared/hooks/useAsync.ts
interface AsyncState<T> {
  data: T | null
  error: AppError | null
  isLoading: boolean
}

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  dependencies: unknown[] = []
): AsyncState<T> & { execute: () => Promise<T | null> } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
  })

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const data = await asyncFn()
      setState({ data, error: null, isLoading: false })
      return data
    } catch (error) {
      const appError = errorHandler.handle(error)
      setState({ data: null, error: appError, isLoading: false })
      return null
    }
  }, dependencies)

  return { ...state, execute }
}

// ✅ src/shared/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// ✅ src/shared/hooks/useForm.ts
export function useForm<T extends Record<string, unknown>>(
  schema: z.ZodSchema<T>,
  initialValues: T
) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setValue = useCallback(<K extends keyof T>(
    field: K,
    value: T[K]
  ) => {
    setValues(prev => ({ ...prev, [field]: value }))
    // 필드 검증
    const result = schema.shape[field as string]?.safeParse(value)
    if (result && !result.success) {
      setErrors(prev => ({
        ...prev,
        [field]: result.error.errors[0]?.message,
      }))
    } else {
      setErrors(prev => {
        const { [field]: _, ...rest } = prev
        return rest
      })
    }
  }, [schema])

  const validate = useCallback((): boolean => {
    const result = schema.safeParse(values)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        const field = err.path[0] as string
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return false
    }
    setErrors({})
    return true
  }, [schema, values])

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => Promise<void>) => async () => {
      if (!validate()) return

      setIsSubmitting(true)
      try {
        await onSubmit(values)
      } finally {
        setIsSubmitting(false)
      }
    },
    [validate, values]
  )

  return {
    values,
    errors,
    isSubmitting,
    setValue,
    validate,
    handleSubmit,
    reset: () => {
      setValues(initialValues)
      setErrors({})
    },
  }
}
```

### 11.2 공통 컴포넌트 추출

```typescript
// ✅ src/shared/components/DataList.tsx
interface DataListProps<T> {
  data: T[]
  renderItem: (item: T, index: number) => ReactNode
  keyExtractor: (item: T) => string
  isLoading?: boolean
  error?: AppError | null
  emptyMessage?: string
  onRetry?: () => void
  onEndReached?: () => void
  ListHeaderComponent?: ReactNode
  ListFooterComponent?: ReactNode
}

export function DataList<T>({
  data,
  renderItem,
  keyExtractor,
  isLoading,
  error,
  emptyMessage = '데이터가 없습니다',
  onRetry,
  onEndReached,
  ListHeaderComponent,
  ListFooterComponent,
}: DataListProps<T>) {
  // 로딩 상태
  if (isLoading && !data.length) {
    return <ListSkeleton />
  }

  // 에러 상태
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  // 빈 상태
  if (!data.length) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <FlashList
      data={data}
      renderItem={({ item, index }) => renderItem(item, index)}
      keyExtractor={keyExtractor}
      estimatedItemSize={80}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={
        <>
          {ListFooterComponent}
          {isLoading && <ActivityIndicator />}
        </>
      }
    />
  )
}
```

### 11.3 공통 서비스 패턴

```typescript
// ✅ src/shared/services/BaseService.ts
export abstract class BaseService<T extends { id: string }> {
  protected abstract collectionName: string

  protected get collection() {
    return collection(db, this.collectionName)
  }

  async getById(id: string): Promise<T | null> {
    const docRef = doc(this.collection, id)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      return null
    }

    return { id: snapshot.id, ...snapshot.data() } as T
  }

  async getAll(options?: QueryOptions): Promise<T[]> {
    let q: Query = this.collection

    if (options?.where) {
      options.where.forEach(([field, op, value]) => {
        q = query(q, where(field, op, value))
      })
    }

    if (options?.orderBy) {
      q = query(q, orderBy(options.orderBy.field, options.orderBy.direction))
    }

    if (options?.limit) {
      q = query(q, limit(options.limit))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as T[]
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const docRef = await addDoc(this.collection, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return { id: docRef.id, ...data } as T
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const docRef = doc(this.collection, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(this.collection, id)
    await deleteDoc(docRef)
  }

  subscribe(
    callback: (data: T[]) => void,
    errorCallback?: (error: Error) => void,
    options?: QueryOptions
  ): () => void {
    let q: Query = this.collection

    // Query 옵션 적용...

    return onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as T[]
        callback(data)
      },
      (error) => {
        logger.error(`Subscription error: ${this.collectionName}`, error)
        errorCallback?.(error)
      }
    )
  }
}

// 사용 예
// src/modules/staff/services/StaffService.ts
import { BaseService } from '@/shared/services/BaseService'
import { Staff } from '../types'

class StaffServiceImpl extends BaseService<Staff> {
  protected collectionName = 'staff'

  // Staff 전용 메서드
  async getActiveStaff(): Promise<Staff[]> {
    return this.getAll({
      where: [['status', '==', 'active']],
      orderBy: { field: 'name', direction: 'asc' },
    })
  }

  async getByUserId(userId: string): Promise<Staff | null> {
    const result = await this.getAll({
      where: [['userId', '==', userId]],
      limit: 1,
    })
    return result[0] || null
  }
}

export const staffService = new StaffServiceImpl()
```

---

## 12. 컴포넌트 변환 가이드

### 12.1 기본 요소 매핑

| React (Web) | React Native | NativeWind |
|-------------|--------------|------------|
| `<div>` | `<View>` | 그대로 |
| `<span>`, `<p>`, `<h1>` | `<Text>` | 그대로 |
| `<button>` | `<Pressable>` | 그대로 |
| `<input type="text">` | `<TextInput>` | 그대로 |
| `<img>` | `<Image>` | 그대로 |
| `<a>` | `<Link>` (expo-router) | 그대로 |
| `<ul>`, `<ol>` | `<FlatList>` | - |
| `<table>` | 커스텀 또는 라이브러리 | - |

### 12.2 변환 예제

#### Button 컴포넌트

```tsx
// ❌ React (Web) - app2/src/components/ui/Button.tsx
interface ButtonProps {
  onClick: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  className?: string
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  disabled,
  className,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 rounded-lg font-medium
        ${variant === 'primary'
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  )
}
```

```tsx
// ✅ React Native - uniqn-mobile/src/components/ui/Button.tsx
import { Pressable, Text, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'

interface ButtonProps {
  onPress: () => void
  title: string
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  loading?: boolean
  className?: string
}

export default function Button({
  onPress,
  title,
  variant = 'primary',
  disabled,
  loading,
  className,
}: ButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  const variantStyles = {
    primary: 'bg-blue-600 active:bg-blue-700',
    secondary: 'bg-gray-200 active:bg-gray-300',
    ghost: 'bg-transparent',
  }

  const textStyles = {
    primary: 'text-white',
    secondary: 'text-gray-800',
    ghost: 'text-blue-600',
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      className={`
        px-4 py-3 rounded-lg items-center justify-center
        ${variantStyles[variant]}
        ${(disabled || loading) ? 'opacity-50' : ''}
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? 'white' : 'gray'} />
      ) : (
        <Text className={`font-medium ${textStyles[variant]}`}>
          {title}
        </Text>
      )}
    </Pressable>
  )
}
```

#### Card 컴포넌트

```tsx
// ❌ React (Web)
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
    {title}
  </h3>
  <p className="text-gray-600 dark:text-gray-400 mt-2">
    {description}
  </p>
</div>
```

```tsx
// ✅ React Native (NativeWind)
import { View, Text, Pressable } from 'react-native'

interface CardProps {
  title: string
  description?: string
  onPress?: () => void
}

export default function Card({ title, description, onPress }: CardProps) {
  const Container = onPress ? Pressable : View

  return (
    <Container
      onPress={onPress}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
      style={{
        // RN에서 shadow는 style로 추가 필요
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,  // Android
      }}
    >
      <Text className="text-lg font-bold text-gray-900 dark:text-white">
        {title}
      </Text>
      {description && (
        <Text className="text-gray-600 dark:text-gray-400 mt-2">
          {description}
        </Text>
      )}
    </Container>
  )
}
```

### 12.3 Form 컴포넌트 변환

```tsx
// ❌ React (Web) - HTML form
<form onSubmit={handleSubmit}>
  <input
    type="email"
    value={email}
    onChange={e => setEmail(e.target.value)}
    placeholder="이메일"
    className="border rounded px-3 py-2"
  />
  <input
    type="password"
    value={password}
    onChange={e => setPassword(e.target.value)}
    placeholder="비밀번호"
    className="border rounded px-3 py-2"
  />
  <button type="submit">로그인</button>
</form>
```

```tsx
// ✅ React Native
import { View, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import Button from '@/components/ui/Button'

export default function LoginForm({ onSubmit }: { onSubmit: (data: LoginData) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = () => {
    onSubmit({ email, password })
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <View className="p-4 gap-4">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="이메일"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholderTextColor="#9CA3AF"
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          secureTextEntry
          autoComplete="password"
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholderTextColor="#9CA3AF"
        />

        <Button
          title="로그인"
          onPress={handleSubmit}
          variant="primary"
        />
      </View>
    </KeyboardAvoidingView>
  )
}
```

---

## 13. 훅 마이그레이션 가이드

### 13.1 그대로 사용 가능한 훅

```typescript
// 플랫폼 독립적인 훅들
// 100% 재사용 가능

// useDebounce.ts - 그대로
// useAsync.ts - 그대로
// useForm.ts - 그대로 (react-hook-form 사용 시)
// useToast.ts - 구현체만 변경 (Zustand 기반)
// useLogger.ts - 그대로
```

### 13.2 수정 필요한 훅

```typescript
// ❌ Web 전용 (window, document 사용)
// useMediaQuery.ts
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    window.matchMedia(query).matches  // ❌ window 사용
  )
  // ...
}

// ✅ React Native 버전
// useMediaQuery.ts
import { useWindowDimensions } from 'react-native'

export function useMediaQuery(breakpoint: 'sm' | 'md' | 'lg' | 'xl'): boolean {
  const { width } = useWindowDimensions()

  const breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  }

  return width >= breakpoints[breakpoint]
}

// 또는 더 유연하게
export function useResponsive() {
  const { width } = useWindowDimensions()

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    width,
  }
}
```

### 13.3 Firebase 훅 변환

```typescript
// ❌ Web Firebase SDK
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase'

// ✅ React Native Firebase SDK
import firestore from '@react-native-firebase/firestore'

// useFirestoreCollection.ts (RN 버전)
export function useFirestoreCollection<T>(
  collectionPath: string,
  queryConstraints?: QueryConstraint[]
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let query = firestore().collection(collectionPath)

    // Query constraints 적용
    if (queryConstraints) {
      queryConstraints.forEach(constraint => {
        if (constraint.type === 'where') {
          query = query.where(constraint.field, constraint.op, constraint.value)
        }
        if (constraint.type === 'orderBy') {
          query = query.orderBy(constraint.field, constraint.direction)
        }
        if (constraint.type === 'limit') {
          query = query.limit(constraint.value)
        }
      })
    }

    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as T[]
        setData(items)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
        logger.error('Firestore subscription error', err, {
          collection: collectionPath,
        })
      }
    )

    return () => unsubscribe()
  }, [collectionPath, JSON.stringify(queryConstraints)])

  return { data, loading, error }
}
```

---

## 14. 서비스 마이그레이션 가이드

### 14.1 그대로 사용 가능한 서비스

```typescript
// 플랫폼 독립적인 서비스들
// 90%+ 재사용

// PayrollCalculations.ts - 순수 계산 로직
// DateUtils.ts - date-fns 기반
// Validators.ts - Zod 기반
// Formatters.ts - 문자열 변환
```

### 14.2 Firebase 서비스 변환

```typescript
// ❌ Web Firebase SDK
// services/staffService.ts
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase'

export const staffService = {
  async getById(id: string): Promise<Staff | null> {
    const docRef = doc(db, 'staff', id)
    const snapshot = await getDoc(docRef)
    return snapshot.exists()
      ? { id: snapshot.id, ...snapshot.data() } as Staff
      : null
  },
}

// ✅ React Native Firebase SDK
// services/staffService.ts
import firestore from '@react-native-firebase/firestore'

export const staffService = {
  async getById(id: string): Promise<Staff | null> {
    const doc = await firestore().collection('staff').doc(id).get()
    return doc.exists
      ? { id: doc.id, ...doc.data() } as Staff
      : null
  },

  async create(data: Omit<Staff, 'id'>): Promise<Staff> {
    const docRef = await firestore().collection('staff').add({
      ...data,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    })
    return { id: docRef.id, ...data } as Staff
  },

  async update(id: string, data: Partial<Staff>): Promise<void> {
    await firestore().collection('staff').doc(id).update({
      ...data,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    })
  },

  async delete(id: string): Promise<void> {
    await firestore().collection('staff').doc(id).delete()
  },
}
```

### 14.3 알림 서비스 변환

```typescript
// ✅ React Native 푸시 알림
// services/notifications/pushNotificationService.ts
import messaging from '@react-native-firebase/messaging'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

class PushNotificationService {
  async initialize(): Promise<void> {
    // 권한 요청
    const authStatus = await messaging().requestPermission()
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL

    if (!enabled) {
      logger.warn('Push notifications not authorized')
      return
    }

    // FCM 토큰 획득
    const token = await messaging().getToken()
    await this.registerToken(token)

    // 토큰 갱신 리스너
    messaging().onTokenRefresh(async (newToken) => {
      await this.registerToken(newToken)
    })

    // 포그라운드 메시지 핸들러
    messaging().onMessage(async (remoteMessage) => {
      await this.handleForegroundMessage(remoteMessage)
    })

    // 백그라운드 메시지 핸들러
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      await this.handleBackgroundMessage(remoteMessage)
    })
  }

  private async registerToken(token: string): Promise<void> {
    const userId = useAuthStore.getState().currentUser?.uid
    if (!userId) return

    await firestore()
      .collection('users')
      .doc(userId)
      .update({
        fcmTokens: firestore.FieldValue.arrayUnion({
          token,
          platform: Platform.OS,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }),
      })
  }

  private async handleForegroundMessage(
    message: FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    // 로컬 알림으로 표시
    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.notification?.title || '',
        body: message.notification?.body || '',
        data: message.data,
      },
      trigger: null, // 즉시
    })
  }

  private async handleBackgroundMessage(
    message: FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    // 백그라운드 처리 로직
    logger.info('Background message received', { messageId: message.messageId })
  }
}

export const pushNotificationService = new PushNotificationService()
```

---

## 요약

### 마이그레이션 체크리스트

| 영역 | 현재 상태 | 목표 | 우선순위 |
|------|----------|------|----------|
| **타입/스키마** | 50 파일 | 100% 재사용 | P0 |
| **유틸리티** | 38 파일 | 90% 재사용 | P0 |
| **서비스** | 20+ 파일 | 80% 재사용 | P1 |
| **훅** | 46+ 파일 | 70% 재사용 | P1 |
| **스토어** | 5 파일 | 90% 재사용 | P1 |
| **컴포넌트** | 132+ 파일 | 재작성 | P2 |
| **페이지** | 57 파일 | 재작성 | P2 |

### 개선 우선순위

1. **P0 (즉시)**: 보안 (Certificate Pinning, Secure Storage)
2. **P0 (즉시)**: 에러 처리 체계화
3. **P1 (단기)**: 상태 관리 통합 (Context → Zustand)
4. **P1 (단기)**: 네이밍/구조 일관성
5. **P2 (중기)**: 성능 최적화 (FlashList, 메모이제이션)
6. **P2 (중기)**: 모듈화 아키텍처
7. **P3 (장기)**: 플러그인 시스템, Feature Flag 고도화

---

## 관련 문서

- [00-overview.md](./00-overview.md) - 프로젝트 개요
- [01-architecture.md](./01-architecture.md) - 아키텍처 설계
- [03-state-management.md](./03-state-management.md) - 상태 관리
- [12-security.md](./12-security.md) - 보안 설계
- [14-migration-plan.md](./14-migration-plan.md) - 마이그레이션 계획
