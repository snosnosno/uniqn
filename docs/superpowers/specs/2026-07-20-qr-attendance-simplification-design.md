# QR 출석 단순화 — 고정 QR 전환 설계

> 작성일: 2026-07-20
> 상태: 설계 승인 완료 (구현 계획 대기)

## 배경

QR 스캔·생성·출석 기능이 "얽혀서 쓰기 어렵다"는 문제 제기에서 출발했다. 코드 전수 조사 결과, 얽힘의 정체는 **진입점 난립**과 **회전 QR이 강제하는 선택지**였다.

### 현재 상태 (2026-07-20 실측)

**사장 — QR 생성 진입점 3개, 그중 2개는 서로 다른 모달 인스턴스**

| # | 경로 | 탭 수 | 모달 소유 |
|---|---|---|---|
| 1 | 내 공고 → 카드 QR 아이콘 | 1 | `employer.tsx` |
| 2 | 공고 상세 → 헤더 QR 버튼 | 2 | `[id]/_layout.tsx` |
| 3 | 공고 → 정산 → "이벤트 QR 열기" | 3 | `SettlementModals.tsx` |

정산 화면에서는 헤더 QR 아이콘과 본문 "이벤트 QR 열기" 버튼이 각각 독립적인 `EventQRModal`/`useEventQR` 상태를 연다. 사용자 입장에서 구분 불가.

**스태프 — 스캔 진입점 2개, 서로 다른 코드 경로**

- 전역 헤더 QR 아이콘 → `/qr` 화면 → "카메라로 스캔하기" (2탭)
- 내 스케줄 → 카드 → `WorkTab` "QR로 출근/퇴근" (2탭, `/qr`를 거치지 않는 인라인 스캐너)

**두 가지 QR 스키마가 공존**

- `event` (회전): 3분 만료, 2분마다 자동 갱신. 사장이 날짜·시간슬롯·출근/퇴근 모드를 매번 선택해야 함
- `venue` (고정): `{type, jobPostingId}`만. 서버가 현재 상태로 출/퇴근 자동 판정. **앱 내 생성 UI가 없어 사실상 사용 불가**

**기타 발견**

- 고정(`isFixed`) 공고는 QR 완전 비활성 (`handleShowQR`가 토스트만 띄우고 리턴)
- `index.tsx`에 `!(contextIsFixed || isFixed)` 이중 판정 — 두 소스가 어긋날 가능성을 암묵 방어

### 문제의 근원

회전 QR은 사장에게 다음을 요구한다: 폰을 꺼내 → 모달을 열고 → 날짜를 고르고 → 시간슬롯을 고르고 → 출근인지 퇴근인지 토글하고 → 스태프가 몰리는 동안 3분마다 갱신되는 화면을 들고 서 있는다. 이 선택지들이 UI 복잡도의 원천이고, 진입점이 3개로 갈라진 이유이기도 하다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| QR 방식 | **고정 QR(`venue`) 중심으로 전환** |
| QR 범위 | **공고당 1장** (`{type:'venue', jobPostingId}`) |
| 부정 방지 | **v1은 제한 없음**. 위치(GPS) 검증은 후속 — 확장 지점을 한 곳으로 모아둔다 |
| 스태프 동선 | **전역 헤더 버튼 → 카메라 즉시 오픈**, 코드 경로 1개로 통일 |
| 회전 QR | **완전 제거** (실사용자 0 — 되돌리려면 `git revert`) |

### 결정 근거

- **고정 QR 중심**: 사장이 고를 것이 0개가 되고, 폰을 꺼낼 필요 자체가 사라진다. 인쇄가 필수는 아니며 화면 표시·이미지 저장·공유 모두 가능하다.
- **공고당 1장**: 현재 `venue` 스키마와 정확히 일치해 DB 변경이 불필요하다. 팀(매장) 단위도 검토했으나 공고 단위가 기존 계약과 맞물린다.
- **v1 제한 없음**: 어차피 현장에 사장이 있고 정산 전 검토 단계가 있다. 과설계를 피하되 후속 확장 지점은 남긴다.
- **회전 QR 완전 제거**: UI만 감추면 죽은 코드가 남아 knip 래칫·유지보수 부담이 된다. "얽힘"을 근본적으로 없애려면 삭제가 맞다.

## 설계

### 1. QR 데이터 계약

```json
{ "type": "venue", "jobPostingId": "<uuid>" }
```

`securityCode`·`expiresAt`·`createdAt`·`date`·`timeSlot`·`assignmentGroupId`·`action` 전부 제거.

**서버 변경 없음.** `process_qr_checkin_atomically`가 이미 다음을 지원한다:

- `p_action='auto'` → 현재 `status`가 `checked_in`이면 `checkOut`, 아니면 `checkIn` (69~75행)
- 공고 상태 `active` / `container` 둘 다 허용 (65행)
- `is_fixed_posting=true`인 work_log는 날짜 검증 건너뜀 (64행)
- 클라 시각 서버 ±5분 클램프 (48~53행)

### 2. 사장 — QR 화면

**원칙: 진입점은 여러 개여도 되지만 도착지는 하나여야 한다.**

| 지금 | 바뀐 후 |
|---|---|
| 리스트 카드 QR 아이콘 → 모달 A | 리스트 카드 QR 아이콘 → **QR 화면** |
| 상세 헤더 QR 버튼 → 모달 B | 상세 헤더 QR 버튼 → **QR 화면** (동일 도착지) |
| 정산 "이벤트 QR 열기" → 모달 C | **삭제** (헤더 버튼이 같은 화면에 이미 존재) |

모달이 아니라 **전용 화면**으로 바꾼다 — 이미지 저장·공유 버튼을 붙이기에 화면이 자연스럽다.

화면 구성 전부:

```
  ○○ 홀덤펍 주말 딜러 모집
  ┌─────────────────┐
  │   [ QR 코드 ]   │
  └─────────────────┘
```

**사라지는 UI**: 출근/퇴근 모드 토글, 날짜 선택, 시간슬롯 선택, 남은시간 카운트다운, 자동 갱신, 수동 새로고침. 사장이 고를 것 **0개**. 안내 문구도 두지 않는다.

**저장/공유 버튼은 두지 않는다.** `expo-media-library`·`react-native-view-shot`·`expo-sharing`·`expo-file-system`이 전부 미설치이고(설치된 QR 관련 패키지는 `react-native-qrcode-svg` 하나뿐), 이들은 네이티브 모듈이라 **OTA로 배포되지 않고 새 EAS 빌드를 요구한다.** 저장은 스크린샷으로 충분하다 — iOS·Android 모두 기본 기능이다. 이 원칙 덕분에 이번 작업 전체가 OTA로 나간다.

**고정(`isFixed`) 공고도 QR 활성화.** 막았던 이유(날짜·슬롯 선택 복잡도)가 사라지므로 막을 근거가 없다. `index.tsx`의 `!(contextIsFixed || isFixed)` 이중 판정도 함께 정리한다.

### 3. 스태프 — 스캔 동선

```
아무 화면 우상단 QR 아이콘 [1탭]
        ↓
   카메라 즉시 오픈 (풀스크린)
        ↓
      QR 인식
        ↓
  ┌──────────────────┐
  │  ✓ 출근 완료      │
  │  ○○ 홀덤펍        │
  │  오늘 09:02       │
  │      [확인]       │
  └──────────────────┘
```

- **`/qr` 중간 화면 삭제** — 고를 게 없으니 거칠 이유가 없다
- 내 스케줄 `WorkTab`의 "QR로 출근/퇴근" 버튼은 **같은 카메라 화면으로 라우팅** (인라인 스캐너 제거 → 코드 경로 1개)
- 출근/퇴근은 서버 자동 판정 — 스태프도 고를 것 **0개**

**실패 문구 명확화** (현재는 "유효하지 않은 QR"로 뭉뚱그려짐):

| 서버 에러 코드 | 문구 |
|---|---|
| `work_log_not_found` (조회 실패) | "오늘 이 공고에 배정된 근무가 없습니다" |
| `already_checked_in` | "오늘 근무는 이미 퇴근 처리됐습니다" |
| `already_settled` | "정산이 끝난 근무는 변경할 수 없습니다" |
| 파싱 실패 / `type!=='venue'` | "UNIQN 출근 QR이 아닙니다" |
| `job_posting_inactive` | "종료된 공고입니다" |

### 4. 삭제 대상

| 파일 / 심볼 | 사유 |
|---|---|
| `src/hooks/useEventQR.ts` | 2분 갱신·카운트다운·재시도 전부 불필요 |
| `src/components/employer/qr/eventQRScope.ts` | 날짜×슬롯 스코프 산출 불필요 |
| `src/components/employer/qr/useEventQRController.ts` | 모달 상태 컨트롤러 불필요 |
| `eventQRService`: `generateEventQR`, `validateEventQR`, `getActiveEventQR`, `deactivateEventQR`, `cleanupExpiredQRCodes`, `stringifyQRData`, `parseQRData`, `QR_VALIDITY_DURATION_MS`, `QR_REFRESH_INTERVAL_MS` | event 경로 전체 |
| `EventQRRepository`: `create`, `deactivateByJobAndDate`, `deactivate`, `deactivateExpired`, `validateSecurityCode`, `getActiveByJobAndDate` | `event_qr_codes` 앱 사용 종료 |
| `app/(app)/(tabs)/qr.tsx` | 중간 화면 제거 |
| `schedule.tsx` 인라인 `QRCodeScanner` 배선 | 라우팅으로 대체 |
| `SettlementModals.tsx`의 `EventQRModal` 배선 | 중복 진입점 |
| `QRCodeDisplay.tsx` | 레거시 — 신규 QR 화면으로 대체 (사용처 확인 후) |

`processEventQRCheckIn`은 `processVenueQRCheckIn` 내용으로 대체한다. **서비스 함수 6개 → 1개.**

### 5. 리스크 (계획 단계에서 해소)

1. **고정(`isFixed`) 공고의 work_log 조회 — ✅ 실측 완료, 해소 방법 확정**
   고정 공고 work_log의 `date`는 `null`이 아니라 **`'FIXED_SCHEDULE'` 리터럴**이다(`FIXED_DATE_MARKER`, `src/types/assignment.ts:19`). 컬럼 자체가 `NOT NULL` 제약이라 NULL이 들어갈 수 없다(baseline 스키마 3863행). 그런데 `findByJobPostingStaffDate`는 `.eq('date', 오늘)`로 조회하므로 **고정 공고는 현재 코드로 QR 출근이 불가능하다.**
   → 해소: `.in('date', [오늘, 'FIXED_SCHEDULE'])`로 한 쿼리에서 함께 조회하는 신규 메서드 `findQRCandidates`를 추가한다.

1-b. **하루 다중 배정 — 신규 발견, 자동 선택으로 해소**
   `(job_posting_id, staff_id, date)`에 UNIQUE 제약이 **없고**(PK는 `id`뿐), `confirm_application`이 `roleIds × dates`를 개별 행으로 flat INSERT하므로 같은 날 다른 시간대/역할로 여러 행이 정상 생성된다. 기존 `findByJobPostingStaffDate`는 2행 이상이면 `BusinessError`("assignment별 QR이 필요합니다")를 던지는데, 이는 회전 QR 전제라 고정 QR과 정면 충돌한다.
   → 해소: 스태프가 고를 것을 0개로 유지하기 위해 **클라이언트가 자동 선택**한다. ①`checked_in` 후보가 있으면 그것(퇴근) ②없으면 `scheduled` 후보 중 시작시각이 현재와 가장 가까운 것(출근, 자정 넘는 근무를 위해 24시간 순환 거리) ③둘 다 없으면 사유별 문구로 거부.

2. **`event_qr_codes` 테이블 처리**
   앱에서 안 쓰게 되지만 RLS 정책과 pgTAP 테스트 4종이 물려 있다. **이번 PR에서는 테이블을 남기고 앱 코드만 끊는다.** DROP은 별도 PR로 분리 — 컬럼/테이블 DROP 전 `pg_proc.prosrc` 의존성 실측 규율을 따른다.

3. **위치 검증 확장 지점 단일화**
   후속으로 GPS를 얹을 때 건드릴 곳이 한 군데가 되도록, 스캔 → 검증 → RPC 호출 경로를 `processVenueQRCheckIn` 하나로 모은다.

### 6. 테스트

- `eventQRService.test.ts`의 event 케이스 제거
- `eventQRService.venue.test.ts` 확장:
  - 일반 공고 출근 → 재스캔 시 퇴근 자동 판정
  - 고정(`isFixed`) 공고 출/퇴근 (리스크 #1 회귀 가드)
  - 실패 문구 매핑 5종
  - 배정 없는 스태프 스캔 시 거부
- E2E(`qr-checkin.spec.ts`)는 웹 카메라 제약으로 여전히 UI 표시만 검증 → **실제 스캔 성공 경로는 실기기 QA 항목으로 남는다** (이번 작업으로 해소되지 않는 커버리지 공백)

## 범위 밖 (후속)

- `event_qr_codes` 테이블 DROP
- 위치(GPS) 기반 부정 출근 방지
- 팀(매장) 단위 QR
- 대회 운영(ops) 모니터/플레이어 셀프체크인 — URL 토큰 기반 별도 시스템이며 이 작업과 무관
