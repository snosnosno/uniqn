# CLAUDE.md

## 기본 규칙

```yaml
언어: 항상 한글로 답변
작업 디렉토리: uniqn-mobile/
배포 전 검증: npm run quality  # type-check + lint + format:check
```

| 항목 | 필수 | 금지 |
|------|------|------|
| 로깅 | 앱 런타임은 `logger.info()` | 앱 런타임의 `console.log()` |
| 타입 | 명시적 타입 선언 | `any` 타입 |
| 다크모드 | `dark:` 클래스 항상 적용 | 라이트 모드만 |
| 경로 | `@/` 절대 경로 (같은 폴더 내는 `./` 허용) | 시스템 절대 경로 |
| 알림 | 일반 피드백은 `toast.success()`, 확인 다이얼로그는 `Alert.alert()` / `window.confirm()` | 단순 안내에 `alert()` |
| 필드명 | camelCase (`staffId`) | snake_case (`staff_id`) |
| 리스트 | `FlashList` (대형 데이터 목록), `FlatList` (picker/소형 고정 그리드) | 대형 스크롤 목록의 `FlatList` |
| 이미지 | `expo-image` | `<Image>` (RN 기본) |

예외:
- `functions/*.js` 같은 CLI/운영 스크립트는 사용자 콘솔 출력 목적으로 `console.log()` 허용

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
- Firebase Auth는 예외 (authService + 인증/부트스트랩 전용 hook에서 직접 호출 허용)
- Firebase Functions 초기화/호출도 앱 초기화·인증 연동용 hook에서는 예외 허용
- TanStack Query 데이터 소스 hook의 읽기 전용 조회는 Repository 직접 호출 허용
- 버전 체크/관측성 같은 인프라성 Service는 Firebase SDK 직접 호출 허용
- Presentation/Hooks에서 Firestore 직접 호출 금지
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

## 스킬 사용 가이드

gstack 기반 커스텀 스킬 + superpowers + 프로젝트 전용 스킬을 조합하여 사용.

### 개발 워크플로우

| 단계 | 스킬 | 설명 |
|------|------|------|
| 아이디어 검증 | `/office-hours` | YC식 6가지 강제 질문 |
| 브레인스토밍 | `superpowers:brainstorming` | 요구사항·의도 탐색 |
| 계획 수립 | `/autoplan` | 아키텍처 레이어별 구현 계획 |
| 계획 리뷰 | `/plan-eng-review` | 엔지니어링 관점 검토 |
| TDD | `superpowers:test-driven-development` | Red→Green→Improve |
| 코드 리뷰 | `/review` | 5대 전문가 리뷰 + 자동 수정 |
| 보안 감사 | `/cso` | OWASP + STRIDE + Firebase Rules |
| 버그 조사 | `/investigate` | 4단계 근본 원인 조사 |
| 커밋 | `/commit` | 프로젝트 컨벤션 한글 커밋 |
| PR | `/pr` | PR 생성 자동화 |
| 배포 | `/deploy` | Firebase/EAS/Cloudflare 배포 |
| 품질 점수 | `/health` | 0-10점 종합 대시보드 |
| 위험 확인 | `/guard` | Firebase/결제/권한 변경 경고 |
| 회고 | `/retro` | 커밋 기반 주간 회고 |
| 완료 검증 | `superpowers:verification-before-completion` | 증거 기반 완료 확인 |

### 스킬 우선순위

1. **프로젝트 로컬** (`.claude/skills/`) — 프로젝트 규칙 내장, 최우선
2. **gstack 전역** (`~/.claude/skills/gstack/`) — 프로젝트 오버라이드 없는 것만
3. **superpowers** — 프로세스/규율 (TDD, 디버깅, 검증, 병렬 에이전트)

### 상황별 선택

| 상황 | 사용 스킬 |
|------|----------|
| "이거 리뷰해줘" | `/review` |
| "에러 났어" / "안돼" | `/investigate` |
| "보안 검사" | `/cso` |
| "이 기능 어떻게 만들지" | `/autoplan` |
| "프로젝트 상태" | `/health` |
| "이번 주 뭐했지" | `/retro` |
| "Security Rules 바꿔야 해" | `/guard` 먼저 → 작업 |
| "테스트 작성해줘" | `/test` |
| "리팩토링 해줘" | `/refactor` |
| "배포해줘" | `/deploy` |
| "타입 에러" | `/type-check` |

---

*마지막 업데이트: 2026-04-11*

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
