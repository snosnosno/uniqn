# 핸드오프 — 좌석 기준 인원카운트 통일: Subagent-Driven 실행 (다음 세션 메인 프롬프트)

> 사용법: 새 세션에서 아래 "메인 프롬프트" 블록을 그대로 붙여넣는다.

## 메인 프롬프트

```
좌석 기준 인원카운트 통일을 Subagent-Driven으로 끝까지 구현해줘.

1. 먼저 Read: docs/planning/2026-07-17-seat-basis-execution-handoff.md (이 문서)
2. 계획: uniqn-mobile/docs/superpowers/plans/2026-07-17-seat-basis-posting-count.md
3. 스펙: uniqn-mobile/docs/superpowers/specs/2026-07-17-seat-basis-posting-count-design.md

superpowers:subagent-driven-development 스킬로 Task 1~5를 순서대로,
태스크당 신선한 서브에이전트 + 태스크 사이 리뷰로 진행해.
```

## 상태 (2026-07-17 설계 세션 종료 시점)

- **브랜치**: `feat/seat-basis-posting-count` (main 체크아웃에 존재, 미push)
  - `550aab9a5` 스펙 초안 · `6061bc540` 스펙 검토 반영(fable) · `bfe8049ba` 구현 계획
- **완료**: 분석(4계층 카운트 지도·DB 함수 실측) → 제품 결정(좌석 단일화, 사용자 확정) → 스펙 → 적대 검토(C1 취소 RPC 순서·C2 가드 우회·C3 전이 단일 지점) → 구현 계획(Task 5개, 자기검토 갭 0)
- **미착수**: 구현 전부 (코드 0줄 — Task 1부터)

## 실행 규칙

1. **시작 프로토콜**: `git status` 먼저 — 내가 만들지 않은 미커밋 변경(다른 세션 작업)이 있으면 `feat/seat-basis-posting-count` 브랜치로 **새 워크트리** 생성 후 격리 작업(메모리 `feedback_isolate_worktree_parallel_session` · node_modules는 `mklink /J` junction · expo 불필요, jest/psql만이라 junction으로 충분). 트리가 조용하면 main 체크아웃에서 해당 브랜치 checkout.
2. **모델 라우팅**: 구현 서브에이전트=`opus` · 태스크 사이 리뷰/판정=`code-reviewer`(fable). 계획 스텝을 벗어난 재설계 필요 시 중단하고 사용자에게 보고.
3. **서브에이전트 금지사항**(디스패치 프롬프트에 매번 명시): `mcp__supabase__*` 직접 호출 금지 · 기존 마이그레이션 수정 금지 · prod 우회 금지 · push/PR 금지.
4. **Task 4(DB)**: 로컬 Docker 검증까지만(`npm run db:start`/`db:reset` + psql pgTAP). 공유 Docker 스택 병렬세션 함정 주의(pgTAP 전 스택 상태 재확인 — 메모리 규칙). **prod 마이그 적용·OTA는 절대 하지 말 것 — 사용자 게이트.**
5. **완료 기준(증거 필수)**: Task 5까지 완료 + jest 전 스위트 pass 수치 + pgTAP ok 수치 + `npm run quality` exit 0을 실측 출력으로 보고. 로컬 커밋은 사전승인(스탠딩), **push/PR은 사용자 명시 요청 시만**.
6. **막히면**: 같은 문제 2회 이상 실패 시 증거 패키지(증상·시도·재현)와 함께 fable 서브에이전트 위임 또는 사용자 보고 (fablize 에스컬레이션).

## 배경 요약 (계획/스펙 읽기 전 30초 맥락)

- 현재 정원=`역할별 날짜간 peak 합`(사람·회전 가정), 확정=사람 단위 — 대회형(날짜마다 다른 인력)에서 **조기 정원마감**·그룹 "6/3" 표시 오도 발생.
- 새 계약: **정원=날짜×슬롯×역할 count 총합(좌석) · 확정=활성 work_logs 행 수(좌석) · 전이=job_postings BEFORE 트리거 단일 지점**.
- 핵심 함정 3개(스펙 검토에서 적발, 계획에 반영됨): ① cancel RPC는 DELETE-먼저 재배열 필수 ② `v_capacity=0`이면 슬롯가드 스킵(관측 로그만 추가) ③ 전이 로직 3곳 중복 → BEFORE 트리거로 수렴.

## 이후 게이트 (구현 완료 후, 사용자 소관)

push/PR 요청 → CI green → prod 마이그(`mcp__supabase__apply_migration`, 사용자 요청 시) → OTA(재fetch+ff 규율) 순. 계획 Task 5 Step 5의 보고에 이 잔여 게이트를 명시할 것.
