---
name: session-end
description: 세션 마무리 완결 절차 — 착지(커밋·PR·머지)·최신화(메모리·문서·파리티)·정리(워크트리·로컬DB)·인계(잔여). "세션 종료", "세션종료", "마무리하자", "끝내자" 요청 시 활성화
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, mcp__supabase__execute_sql, mcp__supabase__list_migrations, AskUserQuestion
---

# 세션 종료 스킬

> "세션종료" 한 마디로 **남은 것을 남기지 않고** 끝낸다.
> 탐지·제안은 전역 `/session-wrap` 의 몫이다. 이 스킬은 **실행과 인계**만 한다.

## 원칙

1. **말한 것은 끝낸다** — "다음에 하겠다"로 미루지 말고, 미룰 거면 인계 원장에 적는다.
2. **증거 없는 완료 보고 금지** — 각 단계는 도구 결과로 확인한다(전역 verification 규칙).
3. **다른 세션 것은 건드리지 않는다** — 충돌은 고치지 말고 **계약으로 기록**한다.
4. **되돌리기 어려운 것은 확인 후** — push·머지·prod 반영·삭제.

---

## Phase 0 — 현황 스캔 (병렬)

한 메시지에 동시 실행:

```bash
git status --short && git branch --show-current && git worktree list
git log --oneline origin/master..HEAD          # 미푸시 커밋
gh pr list --author @me --state open           # 열린 내 PR
```

수집 결과로 **미착지 항목**을 만든다: 미커밋 변경 / 미푸시 커밋 / 열린 PR / 미머지 브랜치.

⚠️ 워크트리 목록에 **내 것이 아닌 브랜치**가 있으면 그건 병렬 세션이다 — 이후 모든 단계에서 제외.

---

## Phase 1 — 착지 (커밋 → PR → 머지)

### 1-1. 커밋

- 커밋은 **사전 승인**되어 있다(전역 git-workflow). 물어보지 말 것.
- 🚨 **커밋 메시지에 백틱 금지** — 명령치환으로 문장이 통째로 사라진다. `git commit -F -` + heredoc 사용.
- master 위라면 브랜치부터 만든다.

### 1-2. push

```bash
git push -u origin <branch>
```

🚨 **push 가 타임아웃돼도 실패로 단정하지 말 것** — 후처리 훅 때문에 셸만 늦게 돌아오는 경우가 많다.
반드시 원격 실측으로 판정한다:

```bash
git ls-remote origin <branch>      # 커밋 SHA 가 보이면 성공
```

### 1-3. PR 생성

`/pr` 스킬 규약을 따르되, 본문에 **다음 4가지는 반드시** 넣는다:

| 항목 | 이유 |
|---|---|
| 원인(어디서 비롯됐는지) | 증상만 적으면 재발 시 같은 조사를 반복한다 |
| 검증 증거(명령+출력값) | "통과함"이 아니라 실제 수치 |
| ⚠️ prod 마이그 적용 여부 | **재적용 금지** 표기가 없으면 다음 세션이 다시 적용한다 |
| 잔여·인계 계약 | 실기기 QA / OTA / 다른 브랜치와의 충돌 |

### 1-4. CI 확인 후 머지

```bash
gh pr checks <번호>
```

- 전부 pass 확인 후 머지. **pending 상태에서 머지하지 말 것.**
- 실패가 이 PR과 무관한 기존 red 인지 반드시 구분한다(master 베이스라인부터 red 인 게이트가 있다 — knip 래칫 등).
- 이 레포는 **squash 저장소**다(rebase 금지).
- 머지 후 원격 브랜치 삭제.

---

## Phase 2 — 최신화

### 2-1. 메모리 (필수)

`/memory-sync` 규약. **PR 머지 직후**에 한다.

- 토픽 파일(`memory/project_*.md`) 갱신 — 상태·커밋 SHA·prod 적용 여부·잔여
- `MEMORY.md` 인덱스 한 줄 갱신 — **한 줄=한 메모리**, 본문 넣지 말 것
- 🔑 **조사 중 밝혀진 오귀인은 반드시 교정한다** — 틀린 원인 기록은 다음 세션을 통째로 헛돌게 만든다
- 해결·머지된 함정은 `/ingest` 로 wiki 졸업 후 인덱스에서 가지치기 (매 세션 `/ingest` 는 하지 말 것 — 토큰 낭비)
- 🚨 한글 파일은 **Edit/python** 으로만 (PS5 `Set-Content` 는 cp949 로 깨뜨린다)

### 2-2. DB 파리티 계약 (마이그레이션을 건드린 세션만)

```sql
SELECT (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public'
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
          AND p.proname NOT LIKE 'jpc\_%' AND p.proname NOT LIKE 'ops\_test\_%') AS funcs,
       (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies;
```

- `supabase/tests/parity_baseline_guard.test.sql` 의 `PARITY_EXPECT_FUNCS` / `PARITY_EXPECT_POLICIES` **마커와 단언 리터럴을 동시** 갱신 (둘 중 하나만 고치면 조용히 어긋난다)
- 🚨 **prod 실측이 레포 기대와 다르면 원인부터 찾는다** — 대개 *다른 브랜치가 prod 에 선적용하고 PR 을 안 올린* 상태다.
  그 브랜치는 **고치지 말고**, 내 파일 주석 + 메모리에 **합류 계약**(누가 먼저 머지되면 몇으로 맞출 것)을 남긴다.
- 방치하면 주간 `parity-smoke`(월 01:17 UTC)가 빨개진다.

### 2-3. 문서

- `wiki/log.md` · `CHANGELOG.md` 는 **스택·계약이 바뀐 세션만**. 날짜 노트를 CLAUDE.md 에 쌓지 말 것(규칙 전용).
- 상수·enum·사용자 문구를 바꿨다면 **`e2e/` 별도 Grep 필수** — `npm run quality` 범위 밖이라 CI 에서야 터진다.

---

## Phase 3 — 정리

### 3-1. 로컬 공유 자원 오염 확인

병렬 세션이 같은 Docker 스택·`node_modules` 를 쓴다. 내가 남긴 잔여를 확인한다.

```bash
docker exec supabase_db_uniqn psql -U postgres -d postgres -t -c \
  "SELECT (SELECT count(*) FROM pg_extension WHERE extname='pgtap') AS pgtap_left;"
```

- 테스트용으로 설치한 확장·픽스처가 남아 있으면 제거 (트랜잭션 롤백으로 검증했다면 0이어야 정상)
- 🚨 `npm install <pkg>` 로 복구하지 말 것 — 캐럿 타고 드리프트한다. 필요하면 **`npm ci`**

### 3-2. 워크트리 정리

머지가 끝난 워크트리만 정리한다.

```bash
git worktree remove <경로> --force
git branch -d <브랜치>
```

- 🚨 **워크트리는 레포 트리 밖에 만든다** — `git -C <repo> worktree add <상대경로>` 는 레포 **안쪽**에 만들어 버린다. 절대경로로.
- 🚨 정션(`node_modules`)을 먼저 해제하지 않으면 삭제가 원본까지 건드릴 수 있다.
- 다른 세션이 쓰는 워크트리는 **절대 건드리지 않는다**.

---

## Phase 4 — 인계

다음 세션이 **파일 하나만 읽고 이어받을 수 있게** 남긴다.

`docs/planning/<날짜>-execution-session-prompts.md` 규약(§2·§5)을 따르되, 최소한 다음을 적는다:

| 항목 | 형식 |
|---|---|
| 🔴 사용자 게이트 | 실기기 QA / 스토어 심사 / OTA — **누가** 해야 하는지 명시 |
| 🔴 미완 작업 | 착수점 파일 경로 + 왜 멈췄는지 |
| ⚠️ 다른 세션과의 계약 | 파리티 합류, 공유 브랜치, prod 선적용 |
| ⚠️ 재적용 금지 | prod 에 이미 반영된 마이그레이션 목록 |

---

## Phase 5 — 최종 보고

한 화면에 끝낸다. 결론 먼저.

```
## 세션 종료

**착지**: PR #NNN 머지 <SHA> · prod 적용 <있음/없음>
**최신화**: 메모리 N건 · 파리티 X→Y · 문서 N건
**정리**: 워크트리 N개 제거 · 로컬 잔여 0
**잔여**: (사용자 게이트만 남았으면 그렇게 명시)
```

- 검증하지 않은 것은 **검증하지 않았다고 적는다**. 추정을 완료로 적지 말 것.
- 잔여가 0이면 "잔여 없음"이라고 분명히 쓴다(모호한 마무리 금지).

---

## 자주 빠뜨리는 것 (실측 누적)

| 빠뜨림 | 결과 |
|---|---|
| 파리티 기대값 미갱신 | 주간 parity-smoke red (다른 사람이 원인 추적) |
| prod 마이그 "적용됨" 미표기 | 다음 세션이 재적용 시도 |
| 메모리 오귀인 방치 | 다음 세션이 틀린 원인으로 조사 시작 |
| 워크트리 미정리 | 디스크 + 다음 세션이 어느 트리가 살아있는지 못 알아봄 |
| `e2e/` 미확인 | 상수 변경이 CI 에서만 터짐 |
| push 타임아웃을 실패로 오판 | 같은 브랜치를 두 번 올리려다 꼬임 |
| 커밋 메시지 백틱 | 문장 소실 |
