---
name: investigate
description: 버그 조사 및 디버깅. 에러, 버그, 오류, 안돼, 왜 안되지, 문제, 해결, debug, investigate 요청 시 활성화. gstack investigate 기반 + Uniqn 특화.
allowed-tools: Read, Grep, Glob, Bash, Edit, Agent, Task
---

# 버그 조사 스킬 (gstack investigate + Uniqn 특화)

gstack의 4단계 근본 원인 조사 방식을 따릅니다.

## Iron Law: 근본 원인 없이 수정 금지

추측으로 코드를 수정하지 않습니다. 반드시 근본 원인을 찾은 후에만 수정합니다.

## 프로젝트 컨텍스트

```yaml
스택: Expo SDK 55 / RN 0.83.6 / React 19.2 / TS 5.9.2 / Supabase (@supabase/supabase-js 2.x)
로거: logger.info() / logger.error() (console.log 금지)
에러 체계: AppError 계층 (src/errors/)
에러 코드: E1xxx(네트워크) E2xxx(인증) E3xxx(검증) E4xxx(인프라·DB) E5xxx(보안) E6xxx(비즈니스) E7xxx(알 수 없음)
```

## 4단계 조사 프로세스

### Phase 1: INVESTIGATE (증거 수집)

에러 메시지, 스택 트레이스, 재현 조건을 수집합니다.

**에러 코드 자동 분류:**
| 코드 | 분류 | 조사 방향 |
|------|------|----------|
| E1xxx | 네트워크 | API 엔드포인트, 타임아웃, CORS |
| E2xxx | 인증 | Supabase Auth 세션·JWT, 토큰 갱신, `app_metadata.role` |
| E3xxx | 검증 | Zod 스키마, 입력 데이터, 타입 불일치 |
| E4xxx | 인프라(DB) | RLS 정책, 인덱스, RPC 시그니처, 제약 위반 |
| E5xxx | 보안 | 권한, XSS, 접근 제어 |
| E6xxx | 비즈니스 | 도메인 로직, 상태 전이, 규칙 위반 |
| E7xxx | 알 수 없음 | 전체 스택 트레이스 분석 |

**Supabase 전용 체크리스트:**
- [ ] RLS 정책이 접근을 허용하는가? (app role = `(auth.jwt() -> 'app_metadata' ->> 'role')`)
- [ ] 테이블/컬럼명·RPC 시그니처가 올바른가? (PostgREST 404 / PGRST202)
- [ ] SECURITY DEFINER 함수의 `search_path`·실행 권한이 올바른가?
- [ ] 복합 조건 쿼리에 인덱스가 생성되어 있는가?
- [ ] RPC 없이 클라이언트에서 다중 행을 나눠 쓰는가?

**React Native 전용 체크리스트:**
- [ ] Hook 사용 규칙 위반? (조건부 호출, 루프 내 호출)
- [ ] 컴포넌트 언마운트 후 상태 업데이트?
- [ ] Metro bundler 캐시 문제? (`npx expo start --clear`)
- [ ] Text가 View 직접 자식이 아닌가?
- [ ] Platform 분기 누락? (iOS/Android 차이)

### Phase 2: ANALYZE (패턴 분석)

수집된 증거를 분석하여 패턴을 찾습니다.

```bash
# 관련 코드 검색
grep -r "에러 관련 키워드" uniqn-mobile/src/
# Git blame으로 최근 변경 확인
git log --oneline -10 -- "문제 파일"
# 유사 패턴 검색
grep -rn "같은 함수/패턴" uniqn-mobile/src/
```

### Phase 3: HYPOTHESIZE (가설 수립)

최대 3개의 가설을 수립하고 각각 검증 방법을 정의합니다.

```markdown
### 가설 1: [가설 설명]
- 근거: [증거]
- 검증 방법: [구체적 확인 방법]
- 확률: [높음/중간/낮음]

### 가설 2: ...
```

### Phase 4: IMPLEMENT (수정 적용)

가장 유력한 가설부터 검증하고 수정합니다.

1. 최소한의 변경으로 수정
2. 디버그 로그 삽입 (`logger.debug()`, 절대 `console.log` 아님)
3. 수정 후 재현 테스트
4. 관련 회귀 테스트 작성
5. `npm run quality` 통과 확인

## 자주 발생하는 Uniqn 에러 패턴

### Supabase 에러의 네트워크 오분류
```typescript
// ❌ fetch 단절이 PostgrestError 형태(code='')로 오면 UNKNOWN(E7000)으로 오분류
if (error.code) return new AppError({ code: ERROR_CODES.UNKNOWN, ... });
// ✅ 메시지 패턴으로 네트워크 장애를 먼저 판별 (src/errors/errorUtils.ts)
// 매핑 진입점: handleSupabaseError (src/utils/supabase.ts)
if (isNetworkErrorMessage(error.message)) return new NetworkError(...);
```

### RN Text 감싸기 누락
```tsx
// ❌ View 직접 자식으로 텍스트
<View>{condition && "텍스트"}</View>
// ✅ Text로 감싸기
<View>{condition && <Text>텍스트</Text>}</View>
```

### TanStack Query 무한 리페치
```typescript
// ❌ queryFn에서 매번 새 참조 생성
useQuery({ queryKey: ['data'], queryFn: () => fetch(url) })
// ✅ 안정적 참조
const fetchData = useCallback(() => fetch(url), [url]);
useQuery({ queryKey: ['data', url], queryFn: fetchData })
```

## 출력 형식

```markdown
## 조사 결과

### 근본 원인
[원인 설명]

### 에러 분류
- 코드: [Exxx]
- 유형: [네트워크/인증/검증/인프라(DB)/보안/비즈니스]

### 수정 내용
[수정 설명 + 코드 diff]

### 검증
- [ ] 재현 테스트 통과
- [ ] 회귀 테스트 추가
- [ ] npm run quality 통과
```
