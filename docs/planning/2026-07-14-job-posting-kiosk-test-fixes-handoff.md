# 핸드오프 — 키오스크 주문서 테스트 수정사항 적용 (다음 세션 메인 프롬프트)

> 아래 "---" 블록을 다음 세션 첫 메시지로 그대로 사용. **수정사항 목록은 § 테스트 발견 수정사항에 사용자가 채워 넣는다.**

---

공고작성 키오스크 "주문서"는 **전량 출하 완료** 상태다. 내가 테스트하며 발견한 **수정사항을 아래에 붙여넣을 테니, 순서대로 끝까지 구현·검증·재배포**해줘. push/PR/OTA는 이 프롬프트가 명시 승인이다.

## 현재 상태 (완료된 기반 — 재작업·재설계 금지)

- **전량 머지·출하**: PR **#246**(본 개편)·**#247**(후속: 모집조건 지원자 표시 + 폴리시 소건 5)·**#248**(위키 졸업) 전부 squash 머지. **origin/master HEAD = `0d9d7c572`**. 배포된 앱 코드 = `0326682f4`(#247).
- **DB**: 마이그 `20260714000000_job_postings_conditions.sql`(`job_postings.conditions` jsonb nullable) **prod 적용 완료**.
- **OTA**: production channel, android+ios, update group `4193f9ab` 출하 완료(env-inject 검증됨).
- ⇒ 이 세션의 수정사항은 **출하된 코드 위의 신규 버그픽스/개선**이다. 기존 기능 재구현 금지.

## 테스트 발견 수정사항 (사용자 입력)

<!-- 여기에 붙여넣기 — 각 항목: 화면 · 증상 · 기기(iOS / Android / web) · 재현 절차 · 기대 동작 -->

1.
2.
3.

## 작업 방법

1. **병렬세션 격리**: 착수 전 `git status`. `git fetch origin` 후 **최신 origin/master 기준 새 브랜치**(예: `fix/order-sheet-followup-2`).
   - 워크트리 `.claude/worktrees/job-posting-kiosk-ux`(node_modules junction 연결)가 master로 남아있어 재사용 가능. 메인 체크아웃은 detached HEAD + **타 세션 미커밋 있으니 건드리지 말 것**.
2. **주문서 코드 위치** (착수점):
   - 진입/프레임: `app/(employer)/my-postings/create.tsx` · `create-success.tsx`
   - 프레임 컴포넌트: `src/components/employer/order-sheet/` (OrderSheetScreen·PresetCarousel·orderRowMeta·rows)
   - 시트: `src/components/employer/order-sheet/sheets/` (TitleSheet·PlaceSheet·ContactSheet·일정/모집·TimeSlotsSheet·RolesSheet·급여/복지/세금·ConditionsSheet·사전질문)
   - 폼 계약: `src/schemas/orderSheet.schema.ts`(z.input/z.output 2형·3제네릭) · 매퍼 `src/utils/order-sheet/mappers.ts`(신구 등가성)
   - 지원자 상세 표시: `src/components/jobs/JobDetail.tsx`('모집 조건' 섹션 — 스태프 탭+공유링크 공용)
   - 직렬화: `src/domains/job-posting/serialization.ts`
3. **모델 라우팅**: 구현=opus · 리뷰/판정=fable(code-reviewer). 429 시 fable→opus→sonnet 폴백·보고 명시.
4. **완료 게이트**: 완료 주장 전 `npm run quality`(exit 0) + 관련 `npx jest` **이 세션 fresh 실행** 증거. 새 동작엔 회귀 테스트.
5. **🔑 신규 필드 추가 시**(만약 수정이 새 DB 컬럼/필드를 요구하면): 왕복 **9지점** 전수 + 읽기 방향 테스트 + **표시 UI 별도 확인** — wiki `decisions/whitelist-silent-drop` 규칙 준수(안 하면 read 증발).

## 로컬 테스트 (반복 확인용)

- **Web**: 워크트리에 `.env.local`(=prod) 복사돼 있음. `EXPO_PUBLIC_RELEASE_CHANNEL=development npx expo start --web --port 8090` → http://localhost:8090. ⚠️ **최종 "공고 등록" 제출 시 prod에 실제 공고 생성** — 만들면 즉시 삭제/마감. mmkv 등 네이티브는 웹 폴백 있음(부팅 O).
- **웹 한계**: iOS 터치 먹통·중첩 모달·TimeWheelPicker 제스처·홈 인디케이터(#186/#243/#244)는 **웹 재현 불가** → 실기기 OTA로만 검증.
- **안전 풀플로우**: 로컬 Supabase(`npm run db:start` + `npm run db:reset`, `.env.development.local`) + review 계정.
- **Android 로컬**(dev build): `npm run android`(에뮬/기기 연결 필요, SDK 설치돼 있음). iOS 로컬은 Windows라 불가.

## 배포 (수정 완료 후 — 순서 엄수)

1. PR 생성 → CI **9/9 green** 확인 → CHANGELOG Unreleased 갱신 → squash 머지.
2. **OTA 재출하**: [[feedback_ota_refetch_local_tree_before_update]] — 직전 `git fetch` + 로컬 master **ff-merge** → OTA 출력 `Commit` 필드 = origin HEAD 확인 후:
   ```bash
   cd uniqn-mobile
   EXPO_PUBLIC_RELEASE_CHANNEL=production npx eas-cli update \
     --channel production --environment production \
     --message "…" --non-interactive
   ```
   env 검증: dist `.hbc` 번들 + `eas env:list production`에 `EXPO_PUBLIC_SUPABASE_URL=https://ygfxukhktpqymahfrvbz.supabase.co` 확인(PortOne류 빈값 방지 — [[pitfall_eas_update_shell_env_not_loaded]]).
3. 실기기 재검증(수정 항목별).

## 규율

- 커밋 사전승인(한글 `<type>(scope): …`). **amend 금지**(리뷰 디스패치 커밋은 append 커밋). 기존 마이그레이션 수정 금지. Workflow 도구 옵트인 없음.
- 관련 지식: memory `project_job_posting_kiosk_order_sheet` · wiki `sources/job-posting-kiosk-order-sheet`·`decisions/order-sheet-form-contract`·`decisions/whitelist-silent-drop`.

---
