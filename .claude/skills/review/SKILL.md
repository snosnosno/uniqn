---
name: review
description: 코드 리뷰. 코드 리뷰, review, PR 리뷰, 코드 검사, 변경 검토 요청 시 활성화. gstack review 기반 + Uniqn 프로젝트 특화.
allowed-tools: Read, Grep, Glob, Bash, Edit, Agent, Task
---

# 코드 리뷰 스킬 (gstack review + Uniqn 특화)

gstack의 specialist review army 방식을 따르되, Uniqn 프로젝트 규칙을 적용합니다.

## 프로젝트 컨텍스트

```yaml
스택: Expo SDK 55 / RN 0.83.6 / React 19.2 / TS 5.9.2 / Supabase(@supabase/supabase-js 2.x)
아키텍처: Presentation → Hooks → Service → Repository → Supabase
작업 디렉토리: uniqn-mobile/
품질 게이트: npm run quality (type-check + lint + format:check)
에러 코드: E1xxx~E7xxx (src/errors/)
```

## 리뷰 프로세스

### 1단계: 변경 범위 파악
```bash
git diff --stat HEAD~1
git diff HEAD~1 --name-only
```

### 2단계: 5대 전문가 리뷰 (병렬 실행)

각 전문가는 독립적으로 변경 사항을 분석합니다:

#### 전문가 1: 아키텍처 감사관
- 레이어 위반 탐지: Presentation/Hooks에서 Supabase 직접 호출
- 의존성 방향: 상위→하위만 허용, 역방향 금지
- 허용 예외: Supabase Auth(authService·인증 hook·authStore의 세션/프로필 갱신 액션), TanStack Query 읽기전용 조회(Repository 직접), 읽기전용 realtime 구독(`createRealtimeSubscription`, 콜백은 캐시 무효화만)
- 파일 크기: 800줄 초과 경고
- 함수 크기: 50줄 초과 경고

#### 전문가 2: 타입 안전성 검사관
- `any` 타입 사용 탐지
- Supabase row의 `null` → `undefined` 정규화 누락 (Zod optional 파싱 전 필수)
- 명시적 타입 선언 누락
- Zod 스키마와 TypeScript 타입 일치 여부

#### 전문가 3: 보안 감사관
- `xssValidation` 미적용 사용자 입력
- `console.log()` 앱 런타임 코드 (logger 사용 필수)
- 하드코딩된 시크릿/API 키
- 다중 테이블 쓰기에 Supabase RPC(PL/pgSQL 함수) 미사용 (클라이언트 다단계 뮤테이션 금지)
- SecureStore 미사용 (민감 데이터)

#### 전문가 4: UI/UX 감사관
- `dark:` 클래스 누락 (NativeWind)
- `<Image>` (RN 기본) 대신 `expo-image` 사용 여부
- `FlatList` 대형 목록 사용 (→ `FlashList`)
- 로딩/에러/빈 상태 처리 여부
- 터치 타겟 크기 (최소 44x44)

#### 전문가 5: 컨벤션 감사관
- `snake_case` 필드명 사용 (→ `camelCase`)
- 시스템 절대 경로 사용 (→ `@/` 경로)
- `alert()` 단순 안내 사용 (→ `toast.success()`)
- 커밋 메시지 형식: `<타입>(mobile): 한글 제목`

### 3단계: 품질 게이트 실행
```bash
cd uniqn-mobile && npm run quality
```

### 4단계: 종합 리포트

```markdown
## 코드 리뷰 결과

### 요약
- 변경 파일: [N개]
- 심각도: CRITICAL [N] / HIGH [N] / MEDIUM [N] / LOW [N]

### CRITICAL (즉시 수정)
- [위치] [문제] → [해결책]

### HIGH (커밋 전 수정)
- [위치] [문제] → [해결책]

### MEDIUM (권장 수정)
- [위치] [문제] → [해결책]

### LOW (개선 제안)
- [위치] [문제] → [해결책]

### 품질 게이트
- [ ] npm run quality 통과
- [ ] 아키텍처 위반 없음
- [ ] 보안 이슈 없음
```

## 자동 수정

CRITICAL/HIGH 이슈는 사용자 확인 후 자동으로 수정합니다:
- `console.log` → `logger.info`
- Supabase row의 `null` → `undefined` 정규화 추가
- `<Image>` → `Image` from `expo-image`
- `FlatList` (대형) → `FlashList`
