# 앱 내 채팅 S4 — 안전(차단·뮤트·신고·탈퇴 익명화) + 보안 M1(사진 서버 정화)

> 상태: 구현 계획 · 작성 2026-09-25 · 워크트리 `T-HOLDEM-chat-s4` / 브랜치 `feat/chat-s4-safety`
> 정본: `docs/planning/2026-09-24-in-app-chat-design.md` §7 · §14-5 · §4-2(M7) · §15(D5·D10·D12).
> S1 구현(`20260925100000_chat_schema_and_rpcs.sql`)과 설계가 다르면 **S1 이 이긴다**(prod 반영됨).

## 한 줄 결론

차단·뮤트·신고 RPC 4개와 탈퇴 익명화를 서버에 넣고, **사진은 앱이 올린 원본을 서버(EF)가 한 번 더
걸러야만 전송할 수 있게** 경로를 바꾼다. 마이그 3건(각각 prod-migrate) + EF 2개 + 클라 UI.

비유: 지금 사진은 손님이 가져온 액자를 그대로 벽에 거는 구조다. 앞으로는 **접수 창구(inbox)** 에만
놓을 수 있고, 직원(EF)이 뒷면 메모(EXIF)를 떼고 크기를 확인한 뒤에야 벽(`chat-media`)에 건다.
벽에 직접 거는 문은 잠근다.

## 확정 결정 (2026-09-25 사용자)

| # | 결정 |
|---|---|
| D5 | 보존 = 마지막 메시지 후 **1년** purge(S5-b) · 탈퇴자 메시지 **본문·사진 삭제**, 표시 이름 `[탈퇴한 사용자]`, 상대가 받은 알림 미리보기도 비움 |
| D1-C | 공지 팬아웃 **안 함** → ts3(공지 팬아웃) 생략 |
| 문구 | 초안 A — 차단 확인 "이 대화를 차단할까요? 서로 메시지를 보낼 수 없어요. 지원·근무에는 영향이 없어요." · 차단 상태 "대화할 수 없는 상태예요" · 신고 사유 5종(욕설·비하 / 사기·금전 요구 / 음란·불쾌한 사진 / 스팸·광고 / 기타) · 신고 완료 "신고가 접수됐어요. 운영팀이 확인할게요." · 알림 끄기 "이 대화 알림 끄기" |
| M1 | **스테이징 + EF 정화** — 디코딩 없이 JPEG 마커만 파싱 |

## 마이그 3건 (적용 순서 = 파일 순서, 각각 prod-migrate 1건씩)

| 파일 | 내용 | 파리티 | `verify_function` |
|---|---|---|---|
| `20260925210000_chat_blocks_mute_report.sql` | `chat_blocks`+SELECT 정책 · `reports.evidence_snapshot` · RPC 4(`chat_set_muted`·`chat_block`·`chat_unblock`·`chat_report_message`) · `chat_send_message` 재정의(차단 게이트) · `chat_list_conversations` 재정의(`blocked` 실값) · `chat_media_can_read` 재정의(관리자 = 신고 증거 사진만) | +5 / +1 → **243 / 106** (리뷰 반영: 스냅샷 = deny-all 테이블 · 관리자 스냅샷 RPC) | `chat_send_message` |
| `20260925220000_chat_media_inbox_sanitize.sql` | 버킷 `chat-media-inbox`(비공개·1.5MB·jpeg 만) + INSERT 정책 · `chat_media_can_stage`(S1 `can_write` 규칙 + 차단 + 두 버킷 합산 한도) · `chat_media_can_write` → **항상 false**(직접 업로드 봉쇄 — storage 정책 DROP 은 CI 42501 이력이라 함수로 끈다) | +1 → **244 / 106** | `chat_media_can_stage` |
| `20260925230000_chat_permanently_delete_user_anonymize.sql` | `chat_media_deletion_queue`(deny-all) · `permanently_delete_user` **CREATE OR REPLACE**(prod 본문 그대로 + [5] 에 채팅 블록) | 0 | `permanently_delete_user` |

- `permanently_delete_user` 최신 정의 = prod `pg_proc`(md5 `273aed3a…`, 09-25 실측) = 레포 `20260807150000`.
  `20260915133500` 은 GRANT 만 건드린다(본문 무변경) — 설계 §14-5 의 미확인 해소.
- 가드 문구 `PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능` 등은 **글자 그대로** 유지
  (`anon_rpc_security_hardening.test.sql` 정확 비교).

### 차단 (D10 — 방 단위)
- `chat_blocks(conversation_id PK, blocked_by_side, created_by, created_at)`. 방당 1행 — 한쪽이 막으면 양방향 전송 불가.
- 해제는 **막은 쪽**만(구인자 측은 쪽 단위 — 같은 쪽 누구나). 반대쪽 해제 시도 = `PERMISSION_DENIED`.
- 효과: `chat_send_message` → `CHAT_BLOCKED` · `chat_media_can_stage` → false · 읽기·지원·근무 무영향.

### 뮤트
- `chat_set_muted(conv, muted)` → 내 `chat_read_states.muted_until = 'infinity' | NULL`. S1 전송 RPC 가 이미 `muted_until > now` 수신자를 거른다.

### 신고 (D12 — 증거 보존)
- `chat_report_message(p_message_id, p_reason, p_detail)` → `reports` 1행(`type='inappropriate_behavior'`).
  대상 = 메시지 발신자(상대 쪽만 · 탈퇴자 불가), 사유 코드 5종, detail ≤ 500자, 같은 메시지 재신고 거부(`DUPLICATE_REPORT`), 하루 20건.
- **스냅샷은 RPC 가 DB 에서 채운다**(클라 본문을 받지 않는다): 신고 메시지 + 직전 10개 + `imagePaths` 배열.
- 관리자는 스냅샷만 본다(`chat_messages` RLS 0행 유지). 사진은 `chat_media_can_read` 에
  "관리자 AND 어떤 신고의 `evidence_snapshot->'imagePaths'` 에 있는 경로" 절을 더해 서명 URL 로 본다.
- 탈퇴·보존 purge 는 신고 증거 사진을 지우지 않는다(D12). 증거 사진 만료 삭제는 S5-b.

### 탈퇴 익명화 (D5 · M7)
`permanently_delete_user` [5] 에서 `DELETE FROM users` **전에**:
1. `storage.objects`(chat-media · chat-media-inbox, 2세그먼트 = 탈퇴자) → `chat_media_deletion_queue` 적재. 신고 증거 사진은 제외.
2. 탈퇴자 발신 메시지: `body=''` · `image_path/width/height=NULL` · `deleted_at` · `sender_display_name='[탈퇴한 사용자]'`.
3. 탈퇴자가 구직자인 방의 `seeker_display_name='[탈퇴한 사용자]'`.
4. 상대가 받은 `chat_message` 알림(`data->>'senderId'`) 본문 비움 · 제목(구직자 이름)을 `[탈퇴한 사용자]`로.
- 큐는 EF `process-scheduled-deletions` 가 매일 비운다(Storage API `remove` — 없는 파일도 성공, 멱등). 실패 시 `attempts`·`last_error` 기록 후 다음 날 재시도.

## 보안 M1 — 사진 서버 정화

```
앱: 재인코딩(1600·JPEG) → chat-media-inbox/<방>/<나>/<cid>.jpg 업로드 (정책: 멤버·본인 경로·차단 아님·한도)
  → EF chat-media-sanitize {path} (사용자 JWT)
       · 경로 형식 · 2세그먼트 = 호출자 · inbox 객체 ≤ 1.5MB
       · JPEG 마커 파싱: SOI 필수 · APP1~15·COM 제거(EXIF·GPS·XMP·ICC) · SOF 가로·세로 1~2048
         · 프레임 1개 · SOS ≤ 16 · EOI 뒤 꼬리 버림 · 알 수 없는 마커/길이 불일치 = 거부
       · chat-media/<같은 경로> 로 기록(service_role, upsert=false, 이미 있으면 멱등 성공) → inbox 삭제
       · 응답 {width, height}
  → chat_send_message(kind='image', 같은 경로) — S1 그대로: chat-media 실재 확인 = 정화 통과 증명
```
- 디코딩을 하지 않으므로 EF 가 디코딩 폭탄에 노출되지 않고, 가로·세로 상한으로 **받는 쪽 앱의 디코딩 크기**도 묶인다.
- PNG·WebP 는 받지 않는다(앱은 항상 JPEG). S1 의 `.png/.webp` 경로 허용은 chat-media 에 그런 객체가 생길 수 없어 무해.
- 정화 로직은 Deno 비의존 순수 함수 `supabase/functions/_shared/jpegSanitize.ts` — jest 로 검증(선례 `_shared/__tests__/idp-binding.test.ts`).

## 클라

| 영역 | 내용 |
|---|---|
| Repository/Service/Hook | `setMuted`·`block`·`unblock`·`reportMessage`·방 안전 상태 조회(`chat_blocks` SELECT + 내 `muted_until`) · 사진 업로드 → inbox + EF 호출(`supabaseFunctions` 헬퍼) |
| 방 화면 | 헤더 `⋯` 메뉴(알림 끄기/켜기 · 차단하기/차단 해제 · 나가기) · 상대 메시지 길게 눌러 신고(사유 5종 + 선택 설명) · 차단 상태면 입력창 대신 "대화할 수 없는 상태예요"(막은 쪽엔 해제 버튼) |
| 에러 | `CHAT_BLOCKED`(이미 있음) · 신고 중복·한도 · 정화 실패 → `CHAT_IMAGE_INVALID` |
| 관리자 | 신고 상세에 채팅 스냅샷(사유·메시지 타임라인·증거 사진) |
| e2e | `admin-report-resolution.spec.ts` 확장 — 채팅 메시지 신고 → 관리자 상세에서 스냅샷 확인. 로컬 겨냥 규칙(prod 오염 금지) |

## pgTAP

- `chat_safety_blocks_mute_report.test.sql`: 차단 양방향 전송 거부 · 읽기 유지 · 지원·근무 무영향 · 막은 쪽만 해제 · 뮤트 수신자 알림 0(대조군 ≥1) · 신고 스냅샷 = DB 본문 · 자기 메시지/탈퇴자/중복 거부 · 관리자 `chat_messages` 0행·신고 사진만 읽기 · 권한(anon false, authenticated true) · `blocked` 컬럼.
- `chat_media_inbox_sanitize.test.sql`: chat-media 직접 INSERT 42501 · inbox 멤버 INSERT 성공 · 비멤버/남의 경로/차단 42501 · 버킷 행 정확 일치.
- `chat_account_deletion_anonymize.test.sql`: 익명화 4종 · 큐 적재(증거 사진 제외) · 가드 문구 불변 · anon EXECUTE 비부활.
- S1 `storage_chat_media_scope` 의 "멤버 chat-media INSERT 성공" 단언은 M1 로 의미가 바뀐다 → 새 동작으로 갱신.
- `parity_baseline_guard.test.sql` 3곳 = **244 / 106**.

Red-Green: 차단 게이트 제거 → 전송 성공으로 실패 · 익명화 UPDATE 제거 → 실패 · `can_write` false 제거 → 직접 INSERT 성공으로 실패 · 정화기 APP1 제거 단계 제거 → EXIF 잔존 단언 실패.

## 배포(단계 규칙)
머지 직후 prod-migrate 3건(파일 순서) → 실측(md5·파리티 243/106·버킷·정책) → EF 2개는 master push 자동배포(`deploy-edge-functions.yml`) → OTA·웹은 S5 뒤 1회.
⚠️ **순서 위험**: 새 클라(inbox+EF)가 나가기 전에 `can_write=false` 가 prod 에 적용되면 기존 1.0.7 번들의 사진 업로드가 막힌다 — 플래그 OFF·서버 다크라 실사용자 영향 0.

## 후속(이번 범위 밖)
관리자 메시지 삭제 RPC(설계 §7 사진 모더레이션) · 업장 단위 차단(D10 확장).

## 리뷰 반영 (2026-09-25, opus)
- 보안 H1 · DB M1: `reports` 에 authenticated INSERT/UPDATE 가 열려 있고(prod 실측) rep_select 로 신고자가 자기 행을 읽어, 컬럼이면 위조·탈퇴자 원문 열람이 가능 → 스냅샷을 **deny-all 테이블 `chat_report_evidence`** 로. 관리자는 `admin_get_report_evidence`.
  - 1차 시도(컬럼 권한으로 가리기)는 기존 앱 관리자 신고 목록의 `select('*')` 를 42501 로 깨뜨렸다(CI E2E 실측 — 1.0.6 은 OTA 불가라 영구) → 폐기.
- 보안 M1: 방당 1행 차단은 가해자가 먼저 막고 풀어 피해자 차단을 무력화 → **쪽별 1행**(PK `(conversation_id, blocked_by_side)`), 클라는 상대만 막은 방에서도 차단 가능.
- 보안 M2: 정화기가 구조 필드를 안 봄 → 정밀도·샘플링·표 번호·길이·SOS 선택자 검증(`BAD_STRUCTURE`). 엔트로피 데이터 속 디코더 0-day 는 **수용한 잔여 위험**.
- DB M2: `chat_block` 이 전송과 같은 방 잠금 · DB M3: 큐 삭제 묶음 20개.
- LOW: 전송 `.jpg`·≤2048 · 잠금 뒤 차단 재확인 · 중복 신고 부분 유니크 · 탈퇴 알림 제목은 구직자일 때만 · EF 중복 시 저장본 크기 · GIN 인덱스 · 단언 문구 고정.
- 기존 결함 동시 수정: `permanently_delete_user` 의 죽은 `board_votes` DELETE(09-10 DROP 이후 모든 탈퇴가 42P01).
- 후속: 관리자 메시지 삭제 RPC · 업장 단위 차단 · EF 큐 삭제 직전 참조 재확인(DB L4) · `evidence_expired` reason 미사용(DB L5).
