# 권한 시스템 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 모바일앱 기준

현재 권한 시스템은 `uniqn-mobile/`의 역할 계층과 라우트 가드를 기준으로 설명합니다.

## 현재 역할

- `admin`
- `employer`
- `staff`

정의 기준:

- `uniqn-mobile/src/schemas/user.schema.ts`
- `uniqn-mobile/src/shared/role/RoleResolver.ts`

## 권한 계층

`RoleResolver` 기준:

- `admin`은 모든 하위 권한을 포함합니다.
- `employer`는 구인자 전용 기능과 일반 사용자 기능에 접근할 수 있습니다.
- `staff`는 기본 로그인 사용자 기능에 접근할 수 있습니다.

## 라우트 그룹별 접근

`uniqn-mobile/src/hooks/useAuthGuard.ts` 기준:

- `(public)`: 비로그인 접근 가능
- `(auth)`: 로그인/회원가입
- `(app)`: 로그인 사용자
- `(employer)`: `employer` 이상
- `(admin)`: `admin`

## 코드에서 쓰는 핵심 API

### 권한 확인

```ts
RoleResolver.hasPermission(userRole, 'admin');
RoleResolver.hasPermission(userRole, 'employer');
```

### 강제 검사

```ts
RoleResolver.requireAdmin(userRole);
RoleResolver.requireRole(userRole, 'employer');
```

### 역할 플래그 계산

```ts
const flags = RoleResolver.computeRoleFlags(role);
```

## 현재 화면 예시

### 관리자 전용

- `app/(admin)/index.tsx`
- `app/(admin)/users/*`
- `app/(admin)/reports/*`
- `app/(admin)/inquiries/*`

### 구인자 전용

- `app/(employer)/my-postings/*`

### 로그인 사용자 공통

- `app/(app)/(tabs)/*`
- `app/(app)/notifications.tsx`
- `app/(app)/support/*`
- `app/(app)/settings/*`

## 문서화 원칙

현재 문서에는 아래 내용을 넣지 않습니다.

- 현재 코드에 없는 과거 역할명
- 레거시 웹앱 라우트 예시
- 별도 커스텀 권한 엔진이 있는 것처럼 보이게 하는 설명
