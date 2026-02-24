# CLAUDE.md

## 기본 규칙

```yaml
언어: 항상 한글로 답변
작업 디렉토리: uniqn-mobile/
배포 전 검증: npm run quality  # type-check + lint + format:check
레거시 참고: app2/  # 토너먼트 로직 참고용 (개발 중단)
```

| 항목 | 필수 | 금지 |
|------|------|------|
| 로깅 | `logger.info()` | `console.log()` |
| 타입 | 명시적 타입 선언 | `any` 타입 |
| 다크모드 | `dark:` 클래스 항상 적용 | 라이트 모드만 |
| 경로 | `@/` 절대 경로 (같은 폴더 내는 `./` 허용) | 시스템 절대 경로 |
| 알림 | `toast.success()` | `alert()` |
| 필드명 | camelCase (`staffId`) | snake_case (`staff_id`) |
| 리스트 | `FlashList` (데이터 목록) | `FlatList` (picker 등 소형 제외) |
| 이미지 | `expo-image` | `<Image>` (RN 기본) |

---

## 기술 스택

```yaml
Expo SDK 54 / React Native 0.81.5 / React 19.1.4 / TypeScript 5.9.2 (strict)
Expo Router 6.0 / Zustand 5.0 / TanStack Query 5.90 / NativeWind 4.2
Firebase 12.6 (Modular API) / Zod 4.1 / React Hook Form 7.68
RevenueCat (인앱 결제) / FlashList 2.0 / expo-image 3.0
```

---

## 아키텍처

```
Presentation (app/, components/)
  → Hooks (+ Zustand, TanStack Query)
    → Service (+ Domain, Shared)
      → Repository
        → Firebase
```

**의존성 규칙**:
- Firestore 데이터 접근: Service → Repository → Firebase (필수)
- Firebase Auth만 예외 (authService에서 직접 호출 허용)
- Presentation/Hooks에서 Firebase 직접 호출 금지
- 상위 → 하위 의존만 허용, 역방향 금지

---

## 역할 체계

```typescript
type UserRole = 'admin' | 'employer' | 'staff';
// admin(100) > employer(50) > staff(10)
// UserRole(앱 권한) vs StaffRole(포커룸 직무: dealer, floor, serving 등) 구분 필수
```

| 라우트 그룹 | 최소 권한 |
|------------|----------|
| `(public)` | 없음 |
| `(auth)` | 없음 |
| `(app)` | staff |
| `(employer)` | employer |
| `(admin)` | admin |

---

## 커밋 컨벤션

```
<타입>(<스코프>): <한글 제목>
타입: feat / fix / refactor / style / docs / test / chore / perf
스코프: mobile / firestore / functions 등 (선택)
```

---

## 보안

사용자 텍스트 입력에는 반드시 XSS 검증 적용:
```typescript
import { xssValidation } from '@/utils/security';
z.string().refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
```

---

## 트랜잭션 규칙

여러 문서를 동시에 변경할 때는 반드시 `runTransaction` 사용 (읽기 → 검증 → 쓰기 순서).

예: 지원/취소, 출퇴근, 정산, 역할 변경 등 다중 문서 수정 전부

---

## 에러 처리

`src/errors/`의 AppError 계층 사용. 에러 코드 체계:
- E1xxx 네트워크 / E2xxx 인증 / E3xxx 검증 / E4xxx Firebase / E5xxx 보안 / E6xxx 비즈니스 / E7xxx 알 수 없음

---

## 주요 명령어

```bash
npm start              # Expo 개발 서버
npm run quality        # type-check + lint + format:check
npm test               # Jest
eas build --platform ios|android
```

---

*마지막 업데이트: 2026-02-24*
