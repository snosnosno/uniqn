---
name: autoplan
description: 자동 계획 생성. autoplan, 계획, 설계, 기능 구현 계획, 어떻게 만들지 요청 시 활성화. gstack autoplan 기반 + Uniqn 특화.
allowed-tools: Read, Grep, Glob, Bash, Agent, Task
---

# 자동 계획 생성 (gstack autoplan + Uniqn 특화)

요구사항을 받아 Uniqn 아키텍처에 맞는 구현 계획을 자동 생성합니다.

## 프로젝트 컨텍스트

```yaml
스택: Expo 55 / RN 0.83.6 / React 19.2 / TS 5.9 strict / Supabase(PostgreSQL + RLS + Edge Functions) / NativeWind 4.2 / Zustand 5 / TanStack Query 5
아키텍처: Presentation → Hooks → Service → Repository → Supabase
에러 코드: E1xxx~E7xxx
역할: admin(100) > employer(50) > staff(10)
```

## 계획 생성 프로세스

### 1단계: 요구사항 분석

사용자 요구사항을 다음 관점에서 분석합니다:
- **무엇을**: 기능/변경의 핵심
- **왜**: 비즈니스 가치
- **누가**: 대상 사용자 역할 (admin/employer/staff)
- **어디서**: 영향받는 아키텍처 레이어

### 2단계: 아키텍처 레이어별 계획

각 레이어에서 필요한 변경을 구분합니다:

```markdown
#### Supabase (데이터 모델)
- 테이블/컬럼 스키마 변경 (`supabase/migrations/` 마이그레이션)
- RLS 정책 · SECURITY DEFINER 함수 변경 → pgTAP 회귀 테스트(`supabase/tests/`) 동반 필수
- 인덱스 추가

#### Repository (데이터 접근)
- CRUD 함수
- 쿼리 정의

#### Service (비즈니스 로직)
- 도메인 규칙
- 다중 쓰기 원자성 → Supabase RPC(PL/pgSQL 함수) 호출 (클라이언트 다단계 뮤테이션 금지)
- 에러 코드 할당

#### Hooks (상태 관리)
- TanStack Query 훅 (useQuery/useMutation)
- Zustand 스토어 (필요시)
- 커스텀 훅

#### Presentation (UI)
- 화면/컴포넌트
- 다크모드 (dark: 클래스)
- 다국어 (AppLocalizations)
- 로딩/에러/빈 상태
```

### 3단계: 엔지니어링 리뷰

자동으로 다음을 검토합니다:
- 기존 코드 재사용 가능성 (유사 기능 검색)
- Supabase 부하·비용 영향 (쿼리 수·조회 행 수·Edge Function 호출 증가량)
- 타입 안전성 (TypeScript strict 통과 여부)
- 테스트 가능성 (단위 테스트 작성 용이성)

### 4단계: 마이그레이션 계획 (DB 스키마 변경 시)

Supabase 스키마가 변경되면 자동으로 포함:
- 마이그레이션 SQL (`supabase/migrations/`) + 기존 행 백필
- 하위 호환성 유지 방법
- 롤백 계획

### 5단계: 에러 코드 할당

새로운 에러 시나리오가 있으면 적절한 범위에 할당:
| 범위 | 용도 |
|------|------|
| E1xxx | 네트워크 에러 |
| E2xxx | 인증 에러 |
| E3xxx | 검증 에러 |
| E4xxx | 인프라 에러 (DB·권한·가용성) |
| E5xxx | 보안 에러 |
| E6xxx | 비즈니스 로직 에러 |
| E7xxx | 알 수 없는 에러 |

## 출력 형식

```markdown
## 구현 계획

### 요약
- 기능: [기능명]
- 대상 역할: [admin/employer/staff]
- 예상 변경 파일: [N개]
- 난이도: [상/중/하]

### 레이어별 변경 계획

#### 1. Supabase 데이터 모델
[변경 내용]

#### 2. Repository
[변경 내용]

#### 3. Service
[변경 내용]

#### 4. Hooks
[변경 내용]

#### 5. Presentation
[변경 내용]

### 마이그레이션 (해당 시)
[마이그레이션 계획]

### 에러 코드
[새 에러 코드 할당]

### 커밋 단위
1. `feat(mobile): [1차 변경]`
2. `feat(mobile): [2차 변경]`

### 테스트 계획
- 단위: [대상]
- 통합: [대상]
```
