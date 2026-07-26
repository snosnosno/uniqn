---
name: commit
description: Git 커밋 자동화. 커밋, commit, 변경사항 커밋, git commit 요청 시 활성화
allowed-tools: Bash, Read, Grep, Glob
---

# Git 커밋 스킬

Git 변경사항을 분석하여 프로젝트 컨벤션에 맞는 커밋 메시지를 생성합니다.

## 커밋 컨벤션

```
<타입>(<스코프>): <제목>

<본문 - 선택>

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 타입
| 타입 | 용도 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `style` | UI/스타일 변경 |
| `docs` | 문서 수정 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정 등 기타 |
| `perf` | 성능 개선 |

### 스코프 (선택)
- `mobile`: uniqn-mobile/ 앱 코드 관련
- `web`: 웹(Cloudflare Pages) 빌드·웹 전용 동작 관련
- `functions`: Supabase Edge Functions / Cloudflare Pages Functions(`uniqn-mobile/functions/`) 관련
- `db`: Supabase 마이그레이션·RLS 정책 관련

## 프로세스

### 1단계: 변경사항 확인
```bash
git status
git diff --staged
git diff
```

### 2단계: 변경 내용 분석
- 어떤 파일이 변경되었는지
- 어떤 종류의 변경인지 (기능 추가, 버그 수정, 리팩토링 등)
- 변경의 목적이 무엇인지

### 3단계: 커밋 메시지 생성
- 제목: 50자 이내, 명령문 형태, 한글
- 본문: 변경 이유와 내용 설명 (필요시)
- Co-Authored-By 포함

### 4단계: 커밋 실행
```bash
git add -A
git commit -m "$(cat <<'EOF'
<커밋 메시지>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## 커밋 메시지 예시

### 기능 추가
```
feat(mobile): 지원자 확정 시 일정 선택 기능 추가

- ApplicantCard에 체크박스 추가
- 확정 모달에서 선택된 일정 목록 표시
- 다크모드 UI 개선

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 버그 수정
```
fix(mobile): 지원 취소 시 카운터 불일치 수정

- cancel_application_atomically RPC로 다중 테이블 갱신을 원자화
- 클라이언트 다단계 뮤테이션은 중간 실패 시 카운터가 어긋남

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 리팩토링
```
refactor(mobile): 정산 계산 로직 통합

- calculateSettlement 유틸리티 추가
- 시급/일급/월급 계산 일원화
- 중복 코드 제거

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 주의사항

- **커밋 전 확인**: `npm run type-check && npm run lint` 통과 확인
- **작은 단위**: 하나의 커밋은 하나의 논리적 변경만 포함
- **민감 정보 제외**: .env, API 키 등이 포함되지 않았는지 확인
- **amend 주의**: 이미 push된 커밋은 amend하지 않음
