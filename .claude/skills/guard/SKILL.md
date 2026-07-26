---
name: guard
description: 안전 가드레일. guard, 안전, 위험, 조심, 프로덕션 변경 요청 시 활성화. gstack guard 기반 + Uniqn 특화.
allowed-tools: Read, Grep, Glob, Bash, Task
---

# 안전 가드레일 (gstack guard + Uniqn 특화)

위험한 변경을 감지하고 경고합니다.

## 프로젝트 컨텍스트

```yaml
프로덕션: ygfxukhktpqymahfrvbz (Supabase)
웹: uniqn-app.pages.dev (Cloudflare Pages)
본인인증: PortOne (인앱 결제 없음)
역할 체계: admin(100) > employer(50) > staff(10)
```

## 위험 변경 감지

### CRITICAL (즉시 확인 필요)

#### RLS 정책 / SECURITY DEFINER 함수 변경
```bash
git diff -- uniqn-mobile/supabase/migrations/ | grep -i "policy\|enable row level security\|security definer\|grant\|revoke"
```
- **위험**: 즉시 모든 사용자에게 적용, 마이그레이션은 전진 전용이라 롤백 어려움
- **필수 조치**: pgTAP 회귀 테스트(`npm run test:db`) → prod 적용 전 파리티 확인

#### UserRole 권한 체계 변경
```bash
git diff -- uniqn-mobile/src/ | grep -i "UserRole\|isAdmin\|isEmployer\|roleLevel\|ROLE_LEVELS"
```
- **위험**: 권한 상승/하락 취약점
- **필수 조치**: 모든 라우트 그룹 접근 제어 재검증

#### Supabase Auth 흐름 변경
```bash
git diff -- uniqn-mobile/src/ | grep -i "signInWithPassword\|signInWithIdToken\|signUp\|signOut\|supabase\.auth\.\|onAuthStateChange\|refreshSession"
```
- **위험**: 인증 중단 → 전체 서비스 불능
- **필수 조치**: 로그인/로그아웃/회원가입 전체 플로우 테스트

### HIGH (커밋 전 확인)

#### 원자성 RPC 제거·우회
```bash
git diff -- uniqn-mobile/src/ | grep -B5 -A5 "supabase.rpc("
```
- **위험**: 데이터 일관성 깨짐 (다중 행 쓰기가 원자성 없이 분리 실행)
- **필수 조치**: 단일 행 쓰기만 남았는지 확인 → 해당 RPC의 pgTAP 테스트 재실행

#### PostgreSQL 인덱스 변경
```bash
git diff -- uniqn-mobile/supabase/migrations/ | grep -i "create index\|drop index"
```
- **위험**: 기존 쿼리 성능 저하·타임아웃
- **필수 조치**: 인덱스 적용 → 주요 쿼리 실행계획(EXPLAIN) 확인

#### EAS Build 설정 변경
```bash
git diff -- uniqn-mobile/eas.json uniqn-mobile/app.json
```
- **위험**: 스토어 빌드 실패, 정책 위반
- **필수 조치**: 빌드 테스트 실행

### MEDIUM (확인 권장)

#### 다중 행 쓰기에 RPC 없음
- 하나의 Service/Repository 흐름에서 2개 이상 `insert`/`update`/`upsert`/`delete` 호출 시 경고
- **필수 조치**: Supabase RPC(PL/pgSQL 함수)로 이관해 서버에서 원자적으로 처리

#### 환경변수 변경
```bash
git diff -- .env* | head -20
```

## 자동 실행 시점

변경사항이 위 패턴에 해당하면 `/review` 스킬 실행 시 자동으로 guard 검사를 포함합니다.

## 출력 형식

```markdown
## 안전 검사 결과

### 위험도 요약
- CRITICAL: [N개]
- HIGH: [N개]
- MEDIUM: [N개]

### 감지된 위험 변경
#### [심각도] [변경 유형]
- 파일: [경로]
- 위험: [설명]
- 필수 조치: [확인 사항]
- [ ] 확인 완료
```
