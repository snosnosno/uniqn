# ops 1e 스태프 연동 — SDD 실행 핸드오프 프롬프트 (다음 세션 메인)

> 설계·계획·적대검증 완료. 이 세션은 **코드 구현**(SDD)만 남았다. 아래를 다음 세션 첫 프롬프트로 복붙.

---

## 다음 세션 첫 프롬프트 (복붙용)

```
ops 1e 스태프 연동을 SDD로 구현한다(코드 착수). 설계·계획·적대검증(20에이전트)은 이미 끝났고 전건 반영됨.

권위 문서(둘 다 워크트리 T-HOLDEM-ops-1e, 브랜치 docs/ops-1e-staff-design에 있음):
- 스펙: uniqn-mobile/docs/superpowers/specs/2026-07-06-ops-1e-staff-integration-design.md
- 계획: uniqn-mobile/docs/superpowers/plans/2026-07-06-ops-1e-staff-integration-plan.md (SDD 10태스크·RPC 5종 SQL 전문 포함)

핵심 결정(브레인스토밍 확정):
- work_logs=import 소스(읽기 전용, 무변이), ops_staff=대회 로스터 신설.
- 방향=대회에 공고를 연결(N:1, ops_set_tournament_posting). "공고→대회 생성" 브릿지·/t/from-posting 라우트는 제거됨.
- UX=STAFF 탭 신설(7번째 세그먼트) + TABLES 탭 딜러 지정. 딜러-테이블 배정은 기존 ops_tables.assigned_staff_id 재사용.
- import=1회성 스냅샷+멱등 add-only(ON CONFLICT DO NOTHING). 딜러 로테이션·딜러뷰·live동기화는 범위 외.

적대검증 반영 완료(구현 시 이 6개는 계획 SQL·문구에 이미 교정돼 있으니 그대로 따를 것):
- SEC-1: ops_add_staff에 employer/admin 롤 게이트(이름 하베스팅 차단).
- COALESCE(status,'active'): ops_add_staff 대상검증(add_direct_staff:112·search:65와 문자 일치).
- SEC-2: ops_staff SELECT 정책 is_admin()을 (SELECT ...) initplan 래핑.
- SEC-3: Realtime publication ADD를 IF NOT EXISTS 멱등 가드로.
- C-1/F2: OpsTable.assignedStaffId는 이미 존재 → 재추가 금지(기존 필드 소비).
- C-3/F1: opsRpcError에 POSTING_NOT_FOUND 포함 신규 4코드 매핑. TABLE_NOT_FOUND는 기존 매핑 재사용(재추가 금지).

착수 절차:
1. 병렬세션 격리 확인: git status. 이 작업은 워크트리 T-HOLDEM-ops-1e(브랜치 docs/ops-1e-staff-design, origin/master 8e2293aad 기반)에서 진행하거나, 새 구현 브랜치를 origin/master 최신 기반으로 만들 것. 문서 2커밋(스펙·계획·핸드오프)이 이 브랜치에 있으니 구현 커밋을 그 위에 쌓아도 되고, 별도 feat 브랜치를 파도 됨(설계문서는 cherry-pick 또는 base로).
2. node_modules 정션: PowerShell New-Item -ItemType Junction (mklink는 MSYS 경로변환 실패).
3. superpowers:subagent-driven-development로 Task 1→10 순차. 태스크당 fresh implementer + 태스크 리뷰(code-reviewer/database-reviewer) + 최종 whole-branch 리뷰(opus). 각 태스크 완료는 계획의 검증 명령 실행 증거로만 인정.

서브에이전트 가드(디스패치 프롬프트에 명시): 브랜치 생성/전환 금지 · mcp__supabase__* 등 MCP 직접 호출 금지(로컬 docker/npm만) · 기존 마이그레이션 수정 금지(신규 3종만) · prod 접근 금지 · 한글 · 작업디렉토리 uniqn-mobile/.

검증(전 태스크 GREEN 후 완료 주장): npm run db:reset && npm run test:db:helpers && npx supabase test db · npx tsc --noEmit · npx jest · npm run quality.

종료선: Task 10 로컬 GREEN까지. prod 마이그 적용(MCP apply_migration 3종)·push·PR·배포는 계획 밖 = 사용자 "go" 게이트(스펙 §8: apply→advisors ERROR0+anon SECDEF 2개 실측→push+PR→CI 9종→squash).
```

---

## 세션 산출물 요약 (이 설계 세션에서 한 것)

1. **정찰 WF**(5에이전트): 스태프 표면(add_direct_staff/search_users_by_phone)·ops 스키마 9테이블·설계문서 1e 스코프·확정스태프 SSOT 쿼리·앱 표면 전수 실측.
2. **브레인스토밍**(사용자 확정): (A) ops_staff 신설 (B) 멱등 스냅샷 import (C) 로테이션 제외 (D) STAFF 탭 (E) 풀슬라이스. **방향 재편**: 공고→대회 생성이 아니라 **대회에 공고 연결(N:1)** — 공고 하나로 여러 대회.
3. **스펙**: `specs/2026-07-06-ops-1e-staff-integration-design.md`.
4. **계획**: `plans/2026-07-06-ops-1e-staff-integration-plan.md` (SDD 10태스크).
5. **적대검증 WF**(20에이전트, 5렌즈 find→3렌즈 verify): CRITICAL/HIGH 0. MED 6·LOW 5 적발, **전건 CONFIRM 다수결 → 스펙·계획에 반영**. 특히 COALESCE 누락은 3개 렌즈가 독립 적발.

## 적대검증 채택 결함 전체 (반영 완료)

| ID(렌즈)                  | 심각도   | 결함                                                                                                                | 반영                                                                |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| SEC-1(sec)                | MED/HIGH | ops_add_staff가 is_ops_member만 게이트 → 임의 uuid로 타인 실명 하베스팅(ops_create_tournament가 롤게이트 없이 열림) | 스펙 §2.3·계획 T3에 employer/admin 롤 게이트 추가                   |
| E1/L3-1/F3(db·domain·cov) | MED      | ops_add_staff 대상검증 COALESCE 누락 → NULL status 활성사용자 오거부(전화검색엔 뜸)                                 | `COALESCE(status,'active') NOT IN(...)`로 교정 + pgTAP NULL케이스   |
| SEC-2(sec)                | MED      | SELECT 정책 is_admin() initplan 미래핑(기존 6정책 위반)                                                             | `OR (SELECT public.is_admin())`로                                   |
| SEC-3(sec)                | MED      | Realtime ADD 멱등가드 누락 → db:reset 드리프트 시 42710                                                             | IF NOT EXISTS DO 블록으로                                           |
| C-1/F2(client·cov)        | MED      | "assigned_staff_id 미노출 실측" 오류 — 이미 존재(types/ops.ts:131·Repo COLUMNS)                                     | 재추가 금지, 기존 필드 소비로 정정                                  |
| C-3/F1(client·cov)        | MED      | POSTING_NOT_FOUND 클라 매핑 누락 → 원시에러 노출. TABLE_NOT_FOUND는 이미 매핑됨(재추가 지시 오류)                   | 신규 4코드 매핑 명시 + TABLE_NOT_FOUND 재추가 금지                  |
| C-2/L3-2(client·domain)   | MED/LOW  | "my-postings/index.tsx 훅" 인용 파일 부재 → 실제는 useMyJobPostings(useJobManagement.ts:71), activeWorkspace 스코프 | 인용 정정 + 스코프 제약 UX 반영 + 배럴 export(index.ts:5) 교체 명시 |
| C-4(client)               | LOW      | [id].tsx 세그먼트 줄 인용 오류(55-57·117-144은 실제 다른 코드)                                                      | 유니언35-37·배열76·라벨87-97·렌더103-176으로 정정                   |
| E2/F4(db·cov)             | LOW      | "anon SECDEF 총량 2개" 기존 테스트로 갈음 불가(총량 단언 부재)                                                      | 신규 카탈로그 카운트 pgTAP 작성 명시                                |
| F5(cov)                   | LOW      | picker 컴포넌트 소유 태스크 미지정 → 중복 위험                                                                      | Task 8이 PostingPickerSheet 산출, Task 9 재사용 고정                |
| L3-3/SEC-4(domain·sec)    | LOW      | 전체기간 import 역할 채택·스냅샷 잔존                                                                               | 스펙 §7 리스크표 2줄 추가(수용, 문서화)                             |

## 별도 게이트(코드 아님 — ops 실사용 오픈 전, 1e와 병행 인지)

수동 QA iOS SelectBottomSheet 피커 [BLOCKING] + ops.uniqn.app 2nd CF Pages + app_config 플래그 ON. 단 1e ActionCard 인앱 전환으로 ops 첫 실동선이 생기므로, 머지 후 OTA·플래그 타이밍은 사용자 결정.
