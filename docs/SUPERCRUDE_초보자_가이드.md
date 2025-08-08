# 🚀 SuperClaude 초보자 가이드

> 이 가이드는 SuperClaude 명령어를 처음 사용하는 분들을 위한 친절한 설명서입니다.

## 📌 SuperClaude란?

SuperClaude는 Claude Code를 더 강력하게 만들어주는 확장 프레임워크입니다. 
복잡한 작업을 간단한 명령어로 처리할 수 있게 도와줍니다.

---

## 🔥 /sc: 특별 명령어 완벽 가이드 (Claude Code 전용)

`/sc:`로 시작하는 명령어는 Claude Code에서만 사용할 수 있는 강력한 특별 기능들입니다.

---

### 📊 세션 관리 명령어

#### `/sc:help` - 📖 종합 도움말
```bash
/sc:help                  # 모든 명령어 목록
/sc:help [명령어]         # 특정 명령어 상세 설명
```
**용도**: Claude Code의 모든 기능과 사용법을 확인
**예시**: `/sc:help workflow` → workflow 명령어 상세 가이드

#### `/sc:status` - 📈 현재 상태 확인
```bash
/sc:status               # 전체 상태 확인
/sc:status --detailed    # 상세 정보 포함
```
**표시 정보**:
- 현재 세션 ID와 지속 시간
- 메모리 사용량 (%)
- 진행 중인 작업 목록
- 활성화된 페르소나
- MCP 서버 상태

#### `/sc:reset` - 🔄 대화 초기화
```bash
/sc:reset               # 대화만 초기화 (메모리 유지)
/sc:reset --full       # 메모리까지 완전 초기화
```
**주의**: 저장하지 않은 작업은 모두 사라집니다
**팁**: 중요한 작업은 `/sc:save`로 먼저 저장하세요

---

### 💾 저장 및 복원 명령어

#### `/sc:save` - 💾 체크포인트 저장
```bash
/sc:save 프로젝트_v1           # 이름으로 저장
/sc:save                       # 자동 이름으로 저장
/sc:save --with-context        # 컨텍스트 포함 저장
```
**저장 내용**: 현재 대화, 작업 상태, 설정, 활성 페르소나

#### `/sc:load` - 📂 체크포인트 불러오기
```bash
/sc:load 프로젝트_v1           # 특정 체크포인트 복원
/sc:load --list               # 저장된 체크포인트 목록
/sc:load --latest             # 가장 최근 저장 복원
```
**활용**: 실험적 작업 전 저장 → 문제 발생 시 복원

#### `/sc:resume` - ⏯️ 대화 재개
```bash
/sc:resume                    # 이전 대화 이어가기
/sc:resume --from [날짜]     # 특정 날짜 대화 재개
```
**용도**: 중단된 작업을 이어서 진행

---

### 🧠 메모리 및 컨텍스트 관리

#### `/sc:memory` - 🧠 메모리 관리
```bash
/sc:memory show              # 현재 메모리 내용 보기
/sc:memory add "중요 정보"    # 메모리에 정보 추가
/sc:memory clear             # 메모리 초기화
/sc:memory edit              # 메모리 편집 모드
```
**메모리 위치**: `CLAUDE.md` 파일에 영구 저장

#### `/sc:context` - 📋 컨텍스트 관리
```bash
/sc:context show             # 현재 컨텍스트 확인
/sc:context clear            # 컨텍스트 초기화
/sc:context optimize         # 컨텍스트 최적화 (토큰 절약)
/sc:context --tokens         # 토큰 사용량 확인
```
**팁**: 토큰이 부족하면 `optimize`로 압축

---

### 🛠️ 작업 관리 명령어

#### `/sc:plan` - 📝 계획 모드
```bash
/sc:plan                     # 계획 모드 진입
/sc:plan --exit             # 계획 모드 종료
/sc:plan --review           # 현재 계획 검토
```
**특징**: 실제 실행 없이 계획만 수립하여 검토 가능

#### `/sc:undo` - ↩️ 실행 취소
```bash
/sc:undo                     # 마지막 작업 취소
/sc:undo 3                   # 최근 3개 작업 취소
/sc:undo --preview          # 취소될 내용 미리보기
```
**제한**: 파일 시스템 변경은 취소 불가

#### `/sc:history` - 📜 작업 기록
```bash
/sc:history                  # 전체 기록
/sc:history 20              # 최근 20개 작업
/sc:history --today         # 오늘 작업만
/sc:history --search "API"  # 특정 키워드 검색
```
**활용**: 이전 작업 참조 및 재실행

---

### 🔧 설정 및 도구

#### `/sc:settings` - ⚙️ 설정 관리
```bash
/sc:settings                 # 설정 메뉴 열기
/sc:settings --language ko   # 언어 변경
/sc:settings --theme dark    # 테마 변경
/sc:settings --show         # 현재 설정 보기
```
**설정 가능 항목**: 언어, 테마, 출력 형식, 자동 저장

#### `/sc:debug` - 🐛 디버그 모드
```bash
/sc:debug on                # 디버그 모드 켜기
/sc:debug off               # 디버그 모드 끄기
/sc:debug --level verbose   # 상세 로그 레벨
```
**표시 정보**: API 호출, 토큰 사용, 실행 시간, 에러 상세

#### `/sc:export` - 📤 내보내기
```bash
/sc:export markdown         # 마크다운으로 내보내기
/sc:export json            # JSON으로 내보내기
/sc:export pdf             # PDF로 내보내기
/sc:export --range 1-10    # 특정 범위만 내보내기
```
**용도**: 작업 결과 문서화 및 공유

---

### 🚀 고급 워크플로우 명령어

#### `/sc:workflow` - 🎯 워크플로우 생성기
```bash
/sc:workflow "프로젝트 설명"        # 기본 워크플로우
/sc:workflow prd.md --strategy mvp  # MVP 전략
/sc:workflow --persona backend      # 백엔드 중심
```
**전략 옵션**: 
- `systematic` - 체계적 단계별 구현
- `agile` - 스프린트 기반 애자일
- `mvp` - 최소 기능 빠른 구현

#### `/sc:implement` - 💻 구현 도우미
```bash
/sc:implement "기능 설명"           # 기본 구현
/sc:implement --from-workflow      # 워크플로우 기반 구현
/sc:implement --test-driven       # TDD 방식 구현
```
**특징**: 워크플로우와 연계하여 단계별 구현 가이드

#### `/sc:task` - 📋 태스크 관리
```bash
/sc:task create "작업명"           # 새 태스크 생성
/sc:task list                     # 태스크 목록
/sc:task complete [ID]            # 태스크 완료
/sc:task --priority high          # 우선순위 설정
```
**활용**: 장기 프로젝트 관리 및 진행 상황 추적

---

### 🔗 통합 및 연동

#### `/sc:mcp` - 🔌 MCP 서버 관리
```bash
/sc:mcp status                    # MCP 서버 상태
/sc:mcp enable context7           # Context7 활성화
/sc:mcp disable all              # 모든 MCP 비활성화
```
**서버 목록**: context7, sequential, magic, playwright

#### `/sc:feedback` - 💬 피드백 전송
```bash
/sc:feedback "의견 내용"           # 텍스트 피드백
/sc:feedback --bug               # 버그 리포트
/sc:feedback --feature           # 기능 제안
```
**용도**: Claude 팀에 직접 의견 전달

---

### 💡 활용 시나리오

#### 시나리오 1: 프로젝트 시작
```bash
/sc:workflow "온라인 쇼핑몰"       # 워크플로우 생성
/sc:save 쇼핑몰_초기              # 체크포인트 저장
/sc:implement --from-workflow     # 구현 시작
```

#### 시나리오 2: 실험적 작업
```bash
/sc:save 안전지점                 # 현재 상태 저장
/sc:plan                         # 계획 모드로 실험
# ... 실험 진행 ...
/sc:load 안전지점                 # 문제 발생 시 복원
```

#### 시나리오 3: 팀 협업
```bash
/sc:export markdown              # 작업 내용 문서화
/sc:task create "API 개발"       # 태스크 생성
/sc:history --today             # 오늘 작업 정리
```

---

### ⚡ 프로 팁

1. **자주 저장하기**: 중요한 작업 전 `/sc:save` 습관화
2. **계획 먼저**: `/sc:plan`으로 검토 후 실행
3. **디버그 활용**: 문제 발생 시 `/sc:debug on`
4. **워크플로우 활용**: 큰 프로젝트는 `/sc:workflow`로 시작
5. **기록 확인**: `/sc:history`로 이전 작업 참조

---

## 🎯 가장 자주 쓰는 명령어 TOP 10

### 1. `/build` - 무언가를 만들기
```bash
/build 로그인 페이지
/build 사용자 관리 시스템
```
**언제 쓰나요?** 새로운 기능이나 컴포넌트를 만들 때

### 2. `/implement` - 기능 구현하기
```bash
/implement 회원가입 기능
/implement 결제 시스템
```
**언제 쓰나요?** 구체적인 기능을 코드로 구현할 때

### 3. `/analyze` - 코드 분석하기
```bash
/analyze 현재 프로젝트
/analyze 성능 문제
```
**언제 쓰나요?** 코드를 검토하거나 문제를 찾을 때

### 4. `/improve` - 코드 개선하기
```bash
/improve 속도 최적화
/improve 코드 품질
```
**언제 쓰나요?** 기존 코드를 더 좋게 만들 때

### 5. `/troubleshoot` - 문제 해결하기
```bash
/troubleshoot 에러 메시지
/troubleshoot 페이지가 느려요
```
**언제 쓰나요?** 버그나 문제를 해결할 때

### 6. `/test` - 테스트하기
```bash
/test 로그인 기능
/test 전체 시스템
```
**언제 쓰나요?** 코드가 제대로 작동하는지 확인할 때

### 7. `/document` - 문서 작성하기
```bash
/document API 사용법
/document 프로젝트 설명서
```
**언제 쓰나요?** 설명서나 가이드를 만들 때

### 8. `/cleanup` - 코드 정리하기
```bash
/cleanup 사용하지 않는 코드
/cleanup 중복된 코드
```
**언제 쓰나요?** 프로젝트를 깔끔하게 정리할 때

### 9. `/explain` - 설명 받기
```bash
/explain 이 코드가 뭐하는 거예요?
/explain React hooks
```
**언제 쓰나요?** 코드나 개념을 이해하고 싶을 때

### 10. `/git` - Git 작업하기
```bash
/git 커밋하기
/git 브랜치 만들기
```
**언제 쓰나요?** 버전 관리 작업을 할 때

---

## 🎨 특별한 옵션들 (플래그)

### 💭 생각의 깊이 조절하기

#### `--think` (기본 분석)
```bash
/analyze 버그 --think
```
👉 일반적인 문제를 분석할 때

#### `--think-hard` (깊은 분석)
```bash
/analyze 복잡한 버그 --think-hard
```
👉 복잡한 문제를 심층 분석할 때

#### `--ultrathink` (최고 수준 분석)
```bash
/analyze 시스템 전체 --ultrathink
```
👉 매우 복잡한 문제를 완전히 분석할 때

### 💾 토큰 절약하기

#### `--uc` (압축 모드)
```bash
/build 컴포넌트 --uc
```
👉 응답을 짧고 간결하게 받고 싶을 때 (30-50% 토큰 절약!)

#### `--answer-only` (답변만)
```bash
/explain 이게 뭔가요 --answer-only
```
👉 설명 없이 답만 듣고 싶을 때

### 🔄 반복 개선하기

#### `--loop` (자동 반복)
```bash
/improve 코드 품질 --loop
```
👉 자동으로 여러 번 개선 작업을 반복

#### `--iterations 숫자` (반복 횟수)
```bash
/improve 성능 --loop --iterations 5
```
👉 5번 반복해서 개선

---

## 🎭 전문가 모드 (페르소나)

각 분야의 전문가처럼 작업하게 만들 수 있습니다:

### Frontend 전문가 모드
```bash
/build UI --persona-frontend
```
👉 UI/UX에 특화된 작업

### Backend 전문가 모드
```bash
/build API --persona-backend
```
👉 서버/데이터베이스 작업

### 보안 전문가 모드
```bash
/analyze --persona-security
```
👉 보안 취약점 검사

### 성능 전문가 모드
```bash
/improve --persona-performance
```
👉 속도 최적화

### 한국어 문서 작성
```bash
/document --persona-scribe=ko
```
👉 한국어로 문서 작성

---

## 🌊 Wave 모드 (고급 기능)

복잡한 작업을 여러 단계로 나누어 처리합니다:

### 자동 Wave 모드
```bash
/improve 전체 시스템 --wave-mode auto
```
👉 시스템이 자동으로 판단해서 단계별 처리

### 강제 Wave 모드
```bash
/analyze 대규모 프로젝트 --wave-mode force
```
👉 무조건 단계별로 처리

---

## 💡 실전 예제

### 예제 1: 로그인 페이지 만들기
```bash
/build 로그인 페이지 --persona-frontend --think
```
이렇게 하면: Frontend 전문가 모드로 생각하면서 로그인 페이지를 만듭니다

### 예제 2: API 버그 수정
```bash
/troubleshoot API 500 에러 --think-hard --persona-backend
```
이렇게 하면: Backend 전문가 모드로 깊게 분석하여 API 에러를 해결합니다

### 예제 3: 성능 최적화
```bash
/improve 페이지 로딩 속도 --persona-performance --loop --iterations 3
```
이렇게 하면: 성능 전문가 모드로 3번 반복하여 로딩 속도를 개선합니다

### 예제 4: 보안 검사
```bash
/analyze 보안 취약점 --persona-security --ultrathink --validate
```
이렇게 하면: 보안 전문가 모드로 최고 수준의 분석과 검증을 수행합니다

### 예제 5: 한국어 문서 작성
```bash
/document 사용자 가이드 --persona-scribe=ko
```
이렇게 하면: 한국어로 사용자 가이드를 작성합니다

### 예제 6: 작업 계획 및 저장
```bash
/sc:plan                    # 계획 모드로 진입
/build 쇼핑몰 시스템         # 계획 수립
/sc:save 쇼핑몰_v1          # 체크포인트 저장
# ... 작업 진행 ...
/sc:undo                    # 실수한 부분 취소
/sc:load 쇼핑몰_v1          # 저장 지점으로 복원
```
이렇게 하면: 계획을 세우고, 중간 저장하며, 필요시 복원할 수 있습니다

### 예제 7: 대화 내보내기 및 공유
```bash
/sc:export markdown         # 마크다운으로 내보내기
/sc:history 20             # 최근 20개 작업 확인
/sc:status                 # 현재 상태 확인
```
이렇게 하면: 작업 내용을 문서로 만들어 팀과 공유할 수 있습니다

---

## 🚦 초보자를 위한 단계별 가이드

### 1단계: 간단한 명령어부터 시작
```bash
/explain React가 뭔가요?
/build 간단한 버튼
```

### 2단계: 옵션 추가해보기
```bash
/build 로그인 폼 --think
/improve 코드 --uc
```

### 3단계: 전문가 모드 사용
```bash
/build 대시보드 --persona-frontend --think
```

### 4단계: 복잡한 조합 시도
```bash
/improve 전체 프로젝트 --wave-mode auto --persona-performance --loop
```

---

## ❓ 자주 묻는 질문

### Q: 어떤 명령어를 써야 할지 모르겠어요
**A:** `/explain`으로 물어보거나 `/index`로 명령어 목록을 확인하세요. Claude Code 전용 명령어는 `/sc:help`로 확인 가능합니다.

### Q: 응답이 너무 길어요
**A:** `--uc` 옵션을 추가하면 짧고 간결한 답변을 받을 수 있습니다

### Q: 더 자세한 분석이 필요해요
**A:** `--think`, `--think-hard`, `--ultrathink` 순서로 더 깊은 분석을 요청하세요

### Q: 한국어로 문서를 만들고 싶어요
**A:** `--persona-scribe=ko` 옵션을 사용하세요

### Q: 여러 번 개선하고 싶어요
**A:** `--loop --iterations 5` 처럼 반복 횟수를 지정하세요

### Q: 작업을 취소하고 싶어요
**A:** `/sc:undo`로 마지막 작업을 취소할 수 있습니다

### Q: 현재 상태를 저장하고 싶어요
**A:** `/sc:save 저장명`으로 체크포인트를 만들고, `/sc:load 저장명`으로 복원할 수 있습니다

### Q: 대화를 처음부터 다시 시작하고 싶어요
**A:** `/sc:reset`으로 대화를 초기화할 수 있습니다 (메모리는 유지됩니다)

### Q: 이전 대화를 이어가고 싶어요
**A:** `/sc:resume`으로 이전 대화를 재개할 수 있습니다

### Q: 현재 작업 상태를 확인하고 싶어요
**A:** `/sc:status`로 현재 세션 상태와 진행 중인 작업을 확인할 수 있습니다

---

## 📝 치트시트 (빠른 참조)

### 일반 명령어
| 작업 | 명령어 예시 |
|------|------------|
| 새로 만들기 | `/build 컴포넌트` |
| 기능 구현 | `/implement 기능` |
| 분석하기 | `/analyze 코드 --think` |
| 개선하기 | `/improve 성능 --loop` |
| 문제 해결 | `/troubleshoot 에러` |
| 테스트 | `/test 기능` |
| 문서 작성 | `/document 가이드 --persona-scribe=ko` |
| 정리하기 | `/cleanup 미사용 코드` |
| 설명 듣기 | `/explain 개념` |
| Git 작업 | `/git 커밋` |

### /sc: 특별 명령어 (빠른 참조)

#### 📊 세션 관리
| 명령어 | 사용법 | 설명 |
|--------|--------|------|
| `/sc:help` | `/sc:help [명령어]` | 도움말 및 명령어 가이드 |
| `/sc:status` | `/sc:status [--detailed]` | 현재 상태 및 세션 정보 |
| `/sc:reset` | `/sc:reset [--full]` | 대화 초기화 |

#### 💾 저장/복원
| 명령어 | 사용법 | 설명 |
|--------|--------|------|
| `/sc:save` | `/sc:save [이름]` | 체크포인트 저장 |
| `/sc:load` | `/sc:load [이름/--latest]` | 체크포인트 복원 |
| `/sc:resume` | `/sc:resume [--from 날짜]` | 이전 대화 재개 |

#### 🧠 메모리/컨텍스트
| 명령어 | 사용법 | 설명 |
|--------|--------|------|
| `/sc:memory` | `/sc:memory [show/add/clear]` | 메모리 관리 |
| `/sc:context` | `/sc:context [show/clear/optimize]` | 컨텍스트 관리 |

#### 🛠️ 작업 관리
| 명령어 | 사용법 | 설명 |
|--------|--------|------|
| `/sc:plan` | `/sc:plan [--exit/--review]` | 계획 모드 |
| `/sc:undo` | `/sc:undo [숫자]` | 작업 취소 |
| `/sc:history` | `/sc:history [숫자/--today]` | 작업 기록 |

#### 🔧 설정/도구
| 명령어 | 사용법 | 설명 |
|--------|--------|------|
| `/sc:settings` | `/sc:settings [--language/--theme]` | 설정 변경 |
| `/sc:debug` | `/sc:debug [on/off]` | 디버그 모드 |
| `/sc:export` | `/sc:export [markdown/json/pdf]` | 내보내기 |

#### 🚀 고급 기능
| 명령어 | 사용법 | 설명 |
|--------|--------|------|
| `/sc:workflow` | `/sc:workflow "설명" [--strategy]` | 워크플로우 생성 |
| `/sc:implement` | `/sc:implement "기능" [--test-driven]` | 구현 가이드 |
| `/sc:task` | `/sc:task [create/list/complete]` | 태스크 관리 |
| `/sc:mcp` | `/sc:mcp [status/enable/disable]` | MCP 서버 관리 |
| `/sc:feedback` | `/sc:feedback "내용" [--bug/--feature]` | 피드백 전송 |

---

## 🎯 프로 팁

1. **작업이 복잡하면**: `--wave-mode auto` 추가
2. **토큰을 아끼려면**: `--uc` 추가
3. **전문적인 작업**: 해당 `--persona-전문가` 추가
4. **깊은 분석이 필요하면**: `--think-hard` 또는 `--ultrathink` 추가
5. **반복 개선**: `--loop --iterations 숫자` 추가

---

## 🆘 도움말

더 자세한 정보가 필요하면:
- `/index` - 모든 명령어 목록 보기
- `/explain SuperClaude` - SuperClaude 설명 듣기
- 그냥 물어보세요! Claude가 도와드립니다 😊

---

*이 가이드는 초보자를 위해 작성되었습니다. 더 고급 기능은 경험을 쌓으면서 천천히 익혀보세요!*