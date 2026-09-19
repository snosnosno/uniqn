# 구인자·구직자 사용성 마찰 감사 (2026-08-02)

> 방법: 여정 6축 병렬 발굴(opus) → 축별 적대적 재검증(fable, 인용 파일 재열람) → 누락 표면 비평(fable). 총 13 에이전트, 코드 실측 근거 필수.

> 기준 커밋: `75d4b3fe4` (PR#393 머지 이후). 코드 변경 0건 — 분석 산출물.

> 판정: CONFIRMED=인용 코드가 주장대로 동작 확인 / PARTIAL=일부만 사실(사유 명시) / REFUTED=0건.


**집계: HIGH 13 · MEDIUM 64 · LOW 33 — 총 110건**


---


## P0 — HIGH (일을 못 하거나 돈·기회를 잃음)


### `profile-setup-no-exit` — 구직자 / 가입 직후 프로필 설정
- **축**: 구직자-진입 · **판정**: CONFIRMED · **빈도**: 프로필 미완성 사용자는 매번 · **수정 비용**: S
- **증상**: 프로필 설정 화면에 들어가면 나갈 방법이 없다. 화면 맨 아래 '이전' 버튼을 눌러도 "프로필을 완성해야 서비스를 이용할 수 있습니다" 토스트만 뜨고 아무 데도 안 간다. 로그아웃 버튼도 없고, 스와이프 back 도 막혀 있으며, 다른 화면으로 가려 해도 가드가 즉시 되돌린다. 닉네임이 계속 중복되거나 다른 계정으로 다시 로그인하고 싶으면 앱을 지우는 수밖에 없다.
- **근거**: app/(app)/profile-setup.tsx:84-86 — handleBack 이 toast.info 만 호출하고 네비게이션이 없다. 이 handleBack 이 SignupStepProfile 의 '이전' 버튼(src/components/auth/signup/SignupStepProfile.tsx:423-425)에 그대로 연결된다. app/(app)/_layout.tsx:128-133 은 profile-setup 스크린에 gestureEnabled:false 를 걸고, src/hooks/useAuthGuard.ts:341-352 는 profileCompleted=false 인 사용자가 다른 경로에 있으면 profile-setup 으로 replace 한다. 화면 어디에도 signOut 호출이 없다.
- **제안**: 헤더 또는 하단에 '로그아웃하고 나가기'(confirmAction 경유)를 상시 노출하고, 죽은 '이전' 버튼은 제거하거나 그 로그아웃 액션으로 교체한다.

### `jobs-list-order-inverted` — 구직자 / 공고 목록 둘러보기
- **축**: 구직자-탐색지원 · **판정**: CONFIRMED · **빈도**: 매번 · **수정 비용**: S
- **증상**: "내일/모레 일할 자리"를 찾는데 목록 맨 위에는 몇 달 뒤 공고가 뜨고, 가까운 날짜 공고는 한참 스크롤해야 나온다. 게다가 아래로 더 불러올 때마다 새 공고가 **목록 위쪽에 끼어들어** 보고 있던 자리가 밀린다.
- **근거**: 서버는 `orderBy: 'work_date', ascending: false`(먼 미래 먼저)로 페이지를 넘긴다 — `src/repositories/supabase/JobPostingRepository.ts:437-443`. 그런데 클라이언트는 받은 모든 페이지를 flatMap 한 뒤 `sortJobPostings`로 **가까운 미래 오름차순** 재정렬한다 — `src/hooks/useJobPostings.ts:48-67`, `src/utils/jobPostingSorter.ts:118-129`. 정렬 방향이 정반대라 2페이지 항목이 1페이지 항목보다 위로 삽입된다.
- **제안**: 브라우즈 기본 정렬을 서버에서 `work_date ASC`(오늘 이후 가까운 순)로 뒤집고, 클라이언트 재정렬은 같은 방향으로 맞춘다. 급여 정렬처럼 서버 순서를 보존하는 경로(`preserveServerOrder`)를 기본 경로에도 적용하면 페이지 경계에서 순서가 흔들리지 않는다.

### `posting-no-end-time` — 구직자 / 공고 상세 확인
- **축**: 구직자-탐색지원 · **판정**: CONFIRMED · **빈도**: 매번 · **수정 비용**: M
- **증상**: 공고에 근무 시작 시각만 적혀 있고 종료 시각·근무 시간이 없다. 시급 공고에서 "오늘 가면 얼마 버는지"를 계산할 수 없어 지원 여부를 판단하지 못한다.
- **근거**: 시간 라벨 생성이 `slot.startTime || slot.time`뿐이고 종료 시각을 합치는 분기가 없다 — `src/components/jobs/shared/postingSurfaceModel.ts:492-500`. 카드·상세 모두 이 라벨 하나만 렌더한다(`src/components/jobs/shared/PostingScheduleContent.tsx:73-88`, `PostingCardSurface.tsx:116-128`). 급여 영역도 단가만 표시하고 예상 총액 계산이 없다(`PostingCompensationContent.tsx:34-41`).
- **제안**: 공고 작성 시 종료 시각(또는 예상 근무시간)을 받아 `18:00~02:00 (8시간)` 형태로 표기하고, 시급 공고는 `시급 15,000원 · 예상 12만원` 같은 예상 총액을 병기한다. 미입력 공고는 "근무시간 협의"로 명시해 침묵과 구분한다.

### `qr-only-no-fallback` — 구직자 / 현장 출퇴근
- **축**: 구직자-근무정산 · **판정**: CONFIRMED · **빈도**: 가끔 (현장 사고 시마다) · **수정 비용**: M
- **증상**: QR 스캔이 안 되면 출근/퇴근을 기록할 방법이 앱 안에 하나도 없다. 카메라 권한을 거부했거나(설정 열기·닫기 두 버튼뿐), 현장에 QR이 안 붙어 있거나, 서버가 '오늘 이 공고에 배정된 근무가 없습니다'를 뱉으면 스태프가 할 수 있는 건 '다시 스캔하기'뿐이다. 구인자에게 알리는 버튼도, 수동 기록 요청도 없다. 출퇴근 기록이 없으면 정산까지 막힌다.
- **근거**: app/(app)/scan.tsx 전체가 스캐너 단일 경로다. src/components/qr/QRCodeScanner.tsx:199-224 권한 거부 화면의 액션은 '권한 허용하기/설정에서 권한 열기'와 '닫기'뿐. src/services/work/eventQRService.ts:111-115 의 실패 문구 3종(no_assignment/all_checked_out/not_active) 어디에도 다음 행동이 없고, 스캐너는 그 문구를 그대로 띄운 뒤 '다시 스캔하기'만 준다(QRCodeScanner.tsx:326-339). 스태프가 시간 정정을 요청하는 경로는 레포 전체에 없다(출퇴근 수정은 src/components/workSchedule/EditSlotSheet.tsx:81 구인자 전용).
- **제안**: 스캐너 실패 화면과 근무 탭에 '구인자에게 알리기'(전화 + 사전 정의 문구 전송) 및 '출퇴근 시간 정정 요청' 진입점을 붙인다. 최소한 실패 문구 옆에 해당 근무의 구인자 전화 CTA를 노출한다.

### `create-no-draft-autosave` — 구인자 / 공고 작성
- **축**: 구인자-공고 · **판정**: CONFIRMED · **빈도**: 자주 — 현장 사장이 영업 중 짬을 내 쓰는 화면이라 중단이 잦다 · **수정 비용**: M
- **증상**: 공고 작성은 제목·장소·연락처·설명·날짜·시간·역할·급여·복지·세금·조건·사전질문까지 12~13개 항목을 시트 하나씩 열어 채우는 긴 작업인데, 중간에 전화가 오거나 앱이 백그라운드에서 죽으면 지금까지 넣은 게 전부 사라진다. 뒤로가기를 눌렀을 때만 '정말 나가시겠습니까' 가 뜰 뿐, 임시저장은 어디에도 없다.
- **근거**: app/(employer)/my-postings/create.tsx:78 은 `useUnsavedChangesGuard(isDirty)` 하나만 걸어 두고, src/hooks/useUnsavedChangesGuard.ts:39-58 은 `navigation.addListener('beforeRemove')` 에서 확인 다이얼로그만 띄운다 — 어떤 저장소에도 폼 값을 쓰지 않는다. 폼 상태는 OrderSheetScreen.tsx:148-152 의 RHF 메모리 상태가 전부이고, create.tsx:70-76 initialValues 는 프리필용일 뿐 복구용이 아니다.
- **제안**: RHF 값을 MMKV 에 디바운스 저장(작성 화면 1건 한정)하고, 재진입 시 '작성하던 공고를 이어서 쓸까요?' 배너로 복구/버리기를 고르게 한다. 등록 성공·명시적 버리기에서만 스냅샷을 지운다.

### `sheet-backdrop-discards-input` — 구인자 / 공고 작성 (시트 입력)
- **축**: 구인자-공고 · **판정**: CONFIRMED · **빈도**: 가끔 — 하지만 한 번 겪으면 손실이 크다 · **수정 비용**: S
- **증상**: 시간·역할 시트에서 시간대 3개와 역할·인원을 다 채운 뒤 시트 바깥을 한 번 잘못 누르면 시트가 닫히면서 그 안에서 한 입력이 통째로 사라진다. 경고도, 되돌리기도 없다. 500자 상세 설명, 사전질문 10개도 똑같다.
- **근거**: src/components/ui/SheetModal.tsx:360-367 `handleBackdropPress` 가 곧바로 `onClose` 를 부르고, OrderSheetScreen.tsx:403-418 `closeSheet` 는 `setActiveSheet(null)` 만 한다(더티 검사 없음). 각 시트의 편집 값은 로컬 state 라 언마운트와 함께 증발한다 — ScheduleSlotsSheet.tsx:55 `useState<Slots>(seed)`, DescriptionSheet.tsx:24, PreQuestionsSheet.tsx:197. SheetModal 은 `onRequestClose` 훅을 제공하지만(SheetModal.tsx:49) 주문서 시트 중 이를 넘기는 곳이 하나도 없다.
- **제안**: 각 시트가 `onRequestClose` 를 넘겨, 초기값과 달라졌으면 '입력한 내용을 버릴까요?' 확인을 띄우게 한다. 최소한 시간·역할/설명/사전질문 3종만이라도.

### `fixed-posting-no-staff-settlement-entry` — 구인자 / 공고 운영 (확정 스태프·정산)
- **축**: 구인자-공고 · **판정**: CONFIRMED · **빈도**: 매번 — 고정 공고를 쓰는 펍 사장 전원 · **수정 비용**: S
- **증상**: 홀덤펍 상시(고정) 공고로 사람을 뽑은 사장은 그 공고 상세에서 '스태프 관리/정산' 도, '취소 요청 관리' 도 볼 수 없다. 카드 자체가 화면에 없어서 정산을 하려면 근무표(별도 플래그) 로 들어가는 우회로밖에 없다.
- **근거**: app/(employer)/my-postings/[id]/index.tsx:525-553 에서 '취소 요청 관리'·'스태프 관리/정산' 카드가 모두 `{!isFixed && (...)}` 로 감싸져 있다. 그런데 `/(employer)/my-postings/[id]/settlements` 로 가는 코드는 같은 파일 176-178 의 `handleSettlements` 단 하나뿐이다(레포 전역 grep 결과 push 1곳). 대안인 지점 정산(app/(employer)/venue-settlements.tsx)은 work-schedule.tsx:219 에서만 열리고, 그 근무표 버튼은 employer.tsx:399-409 처럼 `useWorkScheduleEnabled` 플래그 뒤에 있다.
- **제안**: 고정 공고에도 '스태프 관리/정산' 카드를 노출하거나(정산 화면이 고정 공고를 못 다루면 그 사유를 카드 안에 적고 지점 정산으로 보내는 링크를 준다), 최소한 '이 공고의 정산은 근무표에서 합니다' 안내 카드를 자리에 남긴다.

### `venue-chip-unselected-silently-unlinked` — 구인자 / 공고 작성 (지점 선택)
- **축**: 구인자-공고 · **판정**: CONFIRMED · **빈도**: 자주 — 지점 2곳 이상 운영하는 사장은 매 공고 · **수정 비용**: S
- **증상**: 지점이 2곳 이상인 사장에게 상단에 '지점 선택' 칩이 뜨는데 아무것도 미리 선택돼 있지 않다. 그냥 지나쳐 등록하면 공고는 정상 등록되지만 어느 지점 근무표에도 붙지 않아 셀에 인원이 안 잡힌다. 화면은 끝까지 아무 말도 하지 않는다.
- **근거**: create.tsx:65 `useState<string | undefined>(undefined)` 로 시작해 기본 선택이 없고, create.tsx:156 `applySelectedVenue(input, selectedVenueId)` → src/utils/order-sheet/venueSelection.ts:30-38 은 미선택이면 input 을 그대로 통과시킨다. 서버 폴백도 없다 — services/jobs/jobManagementService.ts:117-119 주석 그대로 '지점 2개 이상 → 자동 연결하지 않는다'. 제출 게이트(OrderSheetScreen.tsx:727-749)도 지점을 검사하지 않는다.
- **제안**: 칩에 '지점을 고르면 그 지점 근무표에 반영돼요' 캡션을 붙이고, 미선택 상태로 제출하면 '지점 없이 등록하면 근무표에 안 잡혀요 — 그래도 등록할까요?' 를 한 번 묻는다(또는 최근 사용 지점을 기본 선택).

### `fixed-posting-no-unconfirm` — 구인자 / 지원자 확정 취소 (고정공고)
- **축**: 구인자-인력관리 · **판정**: CONFIRMED · **빈도**: 가끔 (고정공고 운영 사장에겐 한 번만 발생해도 회복 불가) · **수정 비용**: M
- **증상**: 상시(고정) 공고에서 실수로 확정한 사람을 되돌릴 방법이 앱 어디에도 없다. 지원자 카드에 '확정 해제' 버튼이 안 뜨고, 스태프 관리·취소 요청 화면 자체가 고정공고에는 열리지 않는다. 잘못 누르면 그 자리는 영구히 점유된다.
- **근거**: src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx:115-119 `canShowConfirmedActions = showActions && !isFixedMode && status===CONFIRMED && Boolean(onCancelConfirmation)` — 고정이면 ConfirmedActions(확정 해제)가 렌더되지 않는다. 우회 경로도 막혀 있다: app/(employer)/my-postings/[id]/index.tsx:541·553(`{!isFixed && (<ActionCard ... '취소 요청 관리' / '스태프 관리/정산'`)에서 두 진입점 모두 !isFixed 게이트다. applicants.tsx:255 는 onCancelConfirmation 을 항상 넘기지만 카드가 삼킨다.
- **제안**: 고정공고에서도 확정 해제 버튼을 노출하되(ConfirmedActions 의 !isFixedMode 조건 제거), work_log 수명 문제가 남아 있으면 '해제는 되지만 QR 출퇴근은 아직 지원하지 않아요' 고지를 붙인다. 최소한 고정공고 관리 허브에 '확정 인원 보기/해제' 진입점 하나는 만들어야 한다.

### `grid-add-one-person-one-day` — 구인자 / 근무표 인원 배치
- **축**: 구인자-인력관리 · **판정**: CONFIRMED · **빈도**: 매번 (대회 편성 시) · **수정 비용**: L
- **증상**: 근무표에서 인원을 넣을 때 한 번에 1명·1일밖에 안 된다. 대회 D-7~D-day 에 딜러 20명을 7일 배치하려면 '추가 → 사람 고르기 → 역할 고르기 → 출근시간 고르기 → 추가' 를 140번 반복한다. 사람을 고를 때마다 역할·시간이 매번 초기화돼 같은 시각을 20번 다시 고른다.
- **근거**: src/components/workSchedule/AddSlotSheet.tsx:136-143 은 `picked`(단수)·`roleKey`·`startTime` 단일 상태이고, 274-339 handleSubmit 은 `buildAddSlotPayload({ staffId: picked.staffId, date })` 로 1건만 만든다(date 는 상위가 고정한 선택일). 202-212 `pickStaff` 가 `setStartTime('')`·`setIsTimeUndefined(false)` 로 매 선택마다 시간 입력을 비운다. 복수 선택·복수 날짜·복제 API 는 어디에도 없다.
- **제안**: 후보 행을 다중 선택(체크박스)으로 바꾸고, 역할·출근시각을 '선택한 전원에 적용'으로 한 번만 받게 한다. 여기에 '이 날짜 범위에 반복'(달력 다중 선택 또는 요일 반복)을 더하면 140회가 2~3회로 준다. 최소 개선으로는 직전 배치의 역할·시각을 기억해 다음 사람에게 프리필.

### `venue-settlement-detail-amount-mismatch` — 구인자 / 지점 정산 — 카드 탭해 상세 확인
- **축**: 구인자-정산운영 · **판정**: CONFIRMED · **빈도**: 자주 — 수당이나 세금 설정이 있는 공고에서 뽑은 근무가 지점 스팬에 섞이면 매번 · **수정 비용**: S
- **증상**: 지점 정산 목록에서 카드에 찍힌 금액과, 그 카드를 눌러 연 '정산 상세'의 총 정산 금액이 서로 다르게 보인다. 상세에는 수당 줄도 세금 공제 줄도 아예 안 뜬다. 금액을 확인하려고 연 화면이 오히려 어느 쪽이 진짜인지 모르게 만든다.
- **근거**: app/(employer)/venue-settlements.tsx:395-401 — SettlementDetailModal 에 `salaryInfo` 만 넘기고 `allowances`/`taxSettings` 를 넘기지 않는다. SettlementDetailModal.tsx:105-109 는 `calculateSettlementFromWorkLog(workLog, salaryInfo, allowances, taxSettings)` 로 **다시 계산**하므로 둘 다 undefined면 수당 0·세금 0이 된다. 반면 카드가 쓰는 `calculatedAmount` 는 settlementVenueQuery.ts:44-59 에서 유효 수당·세금을 해소한 `afterTaxPay` 다(공고 스팬 행은 공고의 수당·세금 컨텍스트를 가진다).
- **제안**: 지점 정산 화면도 상세 모달에 해소된 `allowances`/`taxSettings` 를 함께 넘기거나, 상세 모달이 `calculatedAmount` 가 주어지면 재계산하지 않고 그 값을 총액으로 쓰도록 한다(공고 정산 화면과 같은 계약).

### `noshow-marked-staff-never-told` — 구직자 / 노쇼 처리 통보 (구인자 처분 → 구직자 인지 이음새)
- **축**: 이음새·누락표면 · **판정**: CRITIC · **빈도**: 드묾 — 단, 노쇼 처리가 일어나면 매번 · **수정 비용**: S
- **증상**: 사장이 나를 노쇼 처리해도 나에게는 아무 알림이 오지 않는다. 앱을 열어 스케줄을 직접 봐야 '노쇼'가 된 걸 알게 되고, 노쇼를 해제해 줘도 역시 무통보다. 평판·정산에 직결되는 불이익 처분이 당사자 통보 없이 확정된다.
- **근거**: supabase/migrations/20260710000002_baseline_schema_from_prod.sql:5444-5449 — notify_on_work_log_no_show_update 의 INSERT 수신자가 v_owner_id(사장) 단 1건이고 NEW.staff_id 앞으로는 INSERT 가 없다. 같은 함수 상단 가드(OLD.no_show_at IS NOT NULL OR NEW.no_show_at IS NULL → RETURN)로 노쇼 해제(src/repositories/supabase/ConfirmedStaffRepository.ts:530 no_show_at:null)도 무발화. 클라이언트 발신 경로도 0건(src 전역 grep).
- **제안**: notify_on_work_log_no_show_update 에 스태프 본인 수신 INSERT 1건 추가(노쇼 처리·해제 양방향). 문구에 이의 경로(신고/문의 딥링크) 포함 — 기존 축의 noshow-contact-missing 과 짝으로 풀면 통보+이의가 한 번에 닫힌다.

### `settlement-request-dead-letter` — 구직자 / 근무 종료 → 정산 확인 (정산 지연·오류 이의 이음새)
- **축**: 이음새·누락표면 · **판정**: CRITIC · **빈도**: 가끔 — 정산 지연·오류가 나면 매번 · **수정 비용**: M
- **증상**: 근무가 끝났는데 사장이 정산을 잊거나 금액이 틀려도, 구직자가 앱 안에서 '정산해 주세요'라고 재촉하거나 이의를 제기할 공식 행동이 하나도 없다. 설계 어휘에는 '정산 요청(구인자에게)' 알림이 있지만 이를 발신하는 코드가 레포 어디에도 없다 — 수신 아이콘·딥링크·템플릿만 완비된 죽은 편지함이다.
- **근거**: src/types/notification.ts:61-62 SETTLEMENT_REQUESTED 선언, src/shared/deeplink/NotificationRouteMap.ts:63 라우팅, src/constants/notificationTemplates.ts:177 템플릿까지 수신측 완비 — 발신(INSERT/rpc/트리거)은 supabase/ 전체 grep 에서 typeCategoryMap.ts:35 카테고리 나열뿐, src/ 프로듀서 0건.
- **제안**: 스태프 SettlementTab 의 '정산 대기' 항목에 '정산 요청하기' 액션 1개를 배선해 SETTLEMENT_REQUESTED 알림을 실제로 발신(중복 방지 쿨다운 포함). 수신측이 이미 완성돼 있어 발신 RPC 하나로 회로가 닫힌다.

---

## P1 — MEDIUM (짜증나고 시간 낭비)


### [구인자-공고]


**`slots-confirm-disabled-no-reason`** — 공고 작성 (시간·역할) · CONFIRMED · 빈도 자주 — 시간대를 추가하면 역할이 빈 슬롯이 생긴다 · 수정 S
- 증상: 시간대를 추가한 뒤 역할을 안 넣은 채 '확인' 을 누르면 버튼이 아예 눌리지 않는다. 무엇이 모자란지 알려주는 문구가 없어서 사장은 버튼이 고장 난 줄 안다.
- 근거: ScheduleSlotsSheet.tsx:124-134 의 footer 는 `disabled={!areSlotsComplete(slots)}` 만 걸고 사유 텍스트가 없다. 판정은 orderRowMeta.ts:82-90 `isSlotComplete`(시간 확정 + 역할 1개 이상). 같은 파일군의 PlaceSheet.tsx:95-99 는 정확히 이 상황에 '장소명과 지역을 입력하면 확인할 수 있어요' 를 띄우고 있어 패턴은 이미 존재하는데 여기만 빠졌다.
- 제안: PlaceSheet 와 같은 자리에 '시간과 역할을 모두 정하면 확인할 수 있어요 (2번째 시간대에 역할이 없어요)' 처럼 어느 슬롯이 미완인지 짚어 주는 문구를 넣는다.

**`template-cannot-delete-or-rename`** — 공고 작성 (프리셋) · CONFIRMED · 빈도 가끔 — 프리셋을 쓰기 시작한 뒤 누적되며 악화 · 수정 M
- 증상: 프리셋으로 저장한 템플릿은 지울 수도, 이름을 바꿀 수도 없다. 잘못 저장한 '테스트' 프리셋이 캐러셀에 영원히 남고, 같은 이름으로 다시 저장하려 하면 '같은 이름의 템플릿이 이미 있습니다' 로 막혀 매번 새 이름을 지어내야 한다.
- 근거: src/hooks/useTemplateManager.ts:217-302 `handleDeleteTemplate` 는 Undo 토스트까지 구현돼 있지만 레포 전역 grep 결과 호출부가 테스트(src/__tests__/hooks/useTemplateManager.delete.test.tsx)뿐이다 — UI 배선 0곳. PresetCarousel.tsx:69-88 카드에는 삭제/편집 어포던스가 없고 탭은 곧바로 `onSelect`(적용)다. 중복 이름 차단은 useTemplateManager.ts:174-184, 덮어쓰기 경로 없음.
- 제안: 프리셋 카드 롱프레스(또는 '＋ 저장' 옆 관리 버튼)로 이름 변경·삭제 시트를 열고, 이미 만들어 둔 `handleDeleteTemplate` 의 Undo 토스트를 그대로 연결한다. 중복 이름은 차단 대신 '덮어쓸까요?' 로 바꾼다.

**`no-duplicate-existing-posting`** — 공고 재등록 · PARTIAL · 빈도 자주 — 같은 펍이 매주 비슷한 공고를 낸다 · 수정 S
- 증상: 지난달에 만든 공고와 똑같은 조건으로 하나 더 내고 싶어도 복제 버튼이 없다. 프리셋으로 재사용할 수 있는 건 '가장 최근 공고' 딱 1건과 미리 저장해 둔 템플릿뿐이라, 그 사이에 다른 공고를 하나라도 냈으면 처음부터 다시 입력해야 한다.
- 근거: create.tsx:88-97 은 내 공고 목록에서 `createdAt` 최댓값 **1건만** 골라 '마지막 공고' 프리셋을 만든다. 공고 상세의 관리 카드 목록([id]/index.tsx:511-609)에는 지원자관리·취소요청·정산·수정·라이브운영·공유관리만 있고 '이 공고로 새로 만들기' 가 없다. 목록 카드(JobPostingCard.tsx:123-212)의 액션도 공유·QR·마감/재오픈뿐이다.
- 제안: 공고 상세에 '이 공고로 새로 만들기' 액션을 추가해 `draftToValues(buildJobPostingDraft(posting))` 결과(날짜만 비움)를 create 화면 초기값으로 넘긴다 — 변환 함수는 프리셋 경로에 이미 있다.
- 검증 보정: 사실관계는 전부 확인: create.tsx:89-97 이 createdAt 최댓값 1건만 '마지막 공고' 프리셋으로 만들고, 상세 관리 카드(511-609)와 목록 카드 액션(공유·QR·마감/재오픈)에 복제가 없다. 그러나 '처음부터 다시 입력해야 한다'는 과장 — 옛 공고 상세 → '공고 수정' → 하단 '템플릿 저장'(OrderSheetScreen.tsx:936-946, edit 모드 ghost 버튼)으로 그 공고 구성을 템플릿화한 뒤 create 에서 프리셋으로 적용하는 우회로가 실존한다. 다만 3단계 우회이고 발견 가능성이 낮으며, '마지막 공고' 프리셋조차 날짜는 비워 적용된다(create.tsx:113).

**`detail-has-no-close-reopen`** — 공고 마감 · CONFIRMED · 빈도 자주 · 수정 S
- 증상: 공고 상세를 열어 지원자를 보다가 '이제 그만 받자' 싶어도 그 화면에는 마감 버튼이 없다. 뒤로 나가 목록에서 그 공고 카드를 다시 찾아 '마감하기' 를 눌러야 한다. 삭제 버튼은 상세 맨 아래 있는데 마감만 없다.
- 근거: app/(employer)/my-postings/[id]/index.tsx 의 관리 섹션(511-609)과 하단 파괴적 액션(690-716)을 통틀어 close/reopen 호출이 없다 — 이 화면은 `useDeleteJobPosting` 만 import 한다(index.tsx:60). 마감·재오픈 진입점은 목록 카드에만 있다: JobPostingCard.tsx:178-210 + employer.tsx:277-321.
- 제안: 상세 하단 '공고 삭제' 위에 '공고 마감'(마감 상태면 '재오픈')을 같은 확인 모달과 함께 놓는다. 훅(useCloseJobPosting/useReopenJobPosting)은 이미 있다.

**`filter-tabs-hide-pending-postings`** — 공고 목록 탐색 · CONFIRMED · 빈도 자주 — 대회 공고를 내는 대회사는 매번 · 수정 S
- 증상: 승인 대기 중인 대회 공고, 반려된 공고, 만료·취소된 공고는 '모집중' 에도 '마감' 에도 안 잡혀 '전체' 에서 스크롤로 찾아야 한다. 게다가 탭 숫자가 전체(10) ≠ 모집중(4)+마감(3) 이라 남은 3건이 어디 있는지 화면이 설명하지 않는다.
- 근거: src/utils/employerPostingFilter.ts:16-21 의 `STATUS_FILTER_BUCKET` 은 active·capacity_full·closed 만 매핑하고 draft/pending/rejected/expired/cancelled 는 어느 버킷에도 넣지 않는다(주석에 명시). 탭은 employer.tsx:54-58 의 3종 고정이고, 카운트는 employer.tsx:260-266 → `countPostingsByFilter` 그대로 표시된다(FilterTabs, employer.tsx:66-110).
- 제안: '승인대기/반려' 탭을 하나 더 두거나, 최소한 '전체' 탭에서 승인대기 공고를 맨 위로 올리고 상단에 '승인 대기 2건' 요약 줄을 띄운다.

**`no-posting-search-or-axis-filter`** — 공고 목록 탐색 · CONFIRMED · 빈도 자주 — 공고 20건 이상 운영 시 매번 · 수정 M
- 증상: 공고가 수십 건 쌓인 대회사 운영팀은 원하는 공고를 찾을 방법이 스크롤뿐이다. 제목 검색도, 날짜·지점·역할별 필터도 없고 정렬 축도 고를 수 없다(가까운 근무일 고정).
- 근거: app/(app)/(tabs)/employer.tsx 는 TextInput 을 import 조차 하지 않는다(imports: Pressable·RefreshControl·Text·View, 4행). 필터 UI 는 412행 `<FilterTabs>` 3탭이 전부이고, 정렬은 217-250 `filteredPostings` 의 `getEarliestDateTime` 기준 하나로 고정돼 있다.
- 제안: 목록 상단에 제목 검색 인풋 하나만 추가해도 대부분 해소된다. 다음 단계로 지점 칩 필터(이미 venue 데이터가 있다)를 얹는다.

**`edit-restriction-badge-overwarns-and-fails-late`** — 공고 수정 · CONFIRMED · 빈도 자주 — 확정자가 생긴 뒤 수정할 때마다 · 수정 S
- 증상: 확정 스태프가 있으면 상세의 '공고 수정' 카드에 '일정·역할 수정 제한' 이라는 겁주는 배지가 붙어 사장이 수정 자체를 포기한다. 실제로는 확정자가 배정된 역할을 '빼는' 것만 막히는데, 그 사실은 수정 폼을 다 채우고 저장을 누른 다음에야 에러로 알게 된다.
- 근거: app/(employer)/my-postings/[id]/index.tsx:559-564 는 `filledPositions > 0` 이면 무조건 '일정·역할 수정 제한' 배지를 붙인다. 그런데 실제 게이트는 src/repositories/supabase/JobPostingRepository.ts:86-122 `assertConfirmedRolesSurvive` 로, 주석이 '넓은 잠금을 걷어내고 이 한 축만 남긴다'(날짜 추가·인원 증감·시간 변경은 허용)고 못박고 있다. 수정 화면(edit.tsx:177-186)은 `mode="edit"` 로 공고 타입 세그먼트만 잠그고 역할 행에는 아무 표시도 하지 않는다.
- 제안: 배지 문구를 실제 제약에 맞춰 '확정 스태프 배정 역할은 뺄 수 없어요' 로 바꾸고, 수정 폼의 해당 역할 행에 잠금 표시를 붙여 저장 전에 알려준다.

**`regular-posting-max-7-dates`** — 공고 작성 (날짜) · CONFIRMED · 빈도 자주 — 주 단위가 아니라 월 단위로 돌리는 펍 · 수정 M
- 증상: 상시 인력을 한 달치 뽑으려는 펍 사장은 일반/급구 공고 하나에 날짜를 7개까지밖에 못 담는다. 8번째 날짜부터는 '＋ 일정 추가' 가 회색으로 죽고, 결국 같은 내용의 공고를 4~5개 따로 만들어야 한다.
- 근거: src/constants/jobPosting.ts:23-31 `DATE_CONSTRAINTS` — regular/urgent maxDates 7(대회만 30). OrderSheetScreen.tsx:474-479 `dateCapReached` 가 전 그룹 날짜 합으로 상한을 계산해 903-925 에서 '＋ 일정 추가' 를 비활성화하고 '날짜는 7개까지 담을 수 있어요' 로 바꾼다.
- 제안: 상한에 걸렸을 때 '남은 날짜로 이어서 공고 만들기'(현재 입력을 그대로 복제해 새 공고를 여는) 링크를 그 자리에 붙이거나, 상시 근무는 '고정' 타입으로 유도하는 안내를 띄운다.

### [구인자-인력관리]


**`venue-cannot-be-deleted`** — 지점(운영처) 관리 · CONFIRMED · 빈도 가끔 (한 번 생기면 영구) · 수정 M
- 증상: 지점을 잘못 만들면 지울 수가 없다. 이름을 한 글자 틀려 새로 만든 중복 지점이 근무표 상단 칩 줄에 영원히 남아, 매번 '어느 게 진짜지' 하고 고르게 된다.
- 근거: src/components/workSchedule/VenueSettingsSheet.tsx 전체에 지점 삭제 UI 가 없다(단가 삭제 confirmDelete:147-158 만 존재). src/hooks/workSchedule/ 디렉터리에도 useDeleteVenueContainer 가 없다(useCreateVenueContainer·useUpdateVenueContainer 만 존재). app/(employer)/work-schedule.tsx:278 주석이 스스로 인정한다 — "현재 지점 삭제 수단이 없어 영구 잔존".
- 제안: 배치 이력이 0건인 지점은 즉시 삭제, 이력이 있으면 '보관(숨김)' 처리로 칩 줄에서 빼는 2단 정책을 넣는다. 최소한 VenueSettingsSheet 에 '이 지점 숨기기'를 추가해 선택기에서 사라지게 한다.

**`no-bulk-reject`** — 지원자 거절 · CONFIRMED · 빈도 자주 (인기 공고마다) · 수정 M
- 증상: 일괄 처리가 '확정'에만 있다. 대회 공고에 100명이 지원해 20명을 뽑으면 나머지 80명은 카드마다 거절 → 모달 → 거절하기를 눌러야 한다. 거절을 안 하고 방치하면 지원자는 계속 대기 상태로 남는다.
- 근거: src/components/employer/applicants/ApplicantBulkActions.tsx:18-25 props 에 액션이 `onBulkConfirm` 하나뿐이다. ApplicantList.tsx:275-310 도 '일괄 확정 선택' 토글과 확정 액션바만 렌더한다. src/hooks/applicant/index.ts:220-221 에서 노출되는 일괄 변이도 `bulkConfirm` 하나이며, useApplicantMutations.ts 에 bulkReject 계열 훅이 없다.
- 제안: 같은 선택 모드에 '일괄 거절'을 추가하고 공통 거절 사유를 한 번만 입력받는다. 서버 다중 쓰기 규약상 RPC 1개(bulk_reject_applications) 추가가 필요하다.

**`bulk-confirm-blind-progress`** — 지원자 일괄 확정 · CONFIRMED · 빈도 자주 · 수정 M
- 증상: 20명 일괄 확정을 누르면 버튼이 '확정 중...'으로만 바뀌고 몇 명째인지 안 보인다(내부적으로 한 명씩 순차 처리라 수십 초 걸린다). 끝나고 '3명 확정이 실패했습니다' 토스트가 뜨는데 누가 실패했는지 안 알려주고, 선택은 이미 풀려 있어 처음부터 다시 골라야 한다.
- 근거: 서비스는 순차 루프다 — src/services/jobs/applicantManagementService.ts:198-220 (`for (const applicationId of applicationIds) { await confirmApplication(...) }`), 실패는 `result.failed[]` 에 applicationId·reason 까지 담긴다. 그런데 UI 는 카운트만 쓴다 — src/hooks/applicant/useApplicantMutations.ts:221-231 은 `result.failedCount`·`capacityFull` 숫자만 토스트로 만들고 `failed[]` 의 대상 id 를 버린다. 진행률 상태도 없다(index.ts:221 `isBulkConfirming` 은 boolean). 선택 해제는 결과를 보기 전에 일어난다 — ApplicantList.tsx:169-173 `onConfirm` 콜백이 `onBulkConfirm(ids)` 직후 `setSelectionMode(false); setSelectedIds(new Set())`.
- 제안: 진행률(n/N)을 노출하고, 실패 목록을 '실패 3명 보기' 로 펼쳐 해당 카드로 이동하거나 그 3명만 재선택된 상태로 남긴다. 최소한 실패 지원자 이름을 토스트 문구에 넣는다.

**`applicant-filter-axis-missing`** — 지원자 목록 훑기 · CONFIRMED · 빈도 매번 (지원자 10명 이상 공고) · 수정 S
- 증상: 지원자 필터가 전체/신규/확정/거절 4가지뿐이다. '8월 5일 딜러 지원자만' 처럼 날짜나 역할로 좁힐 수 없고, 평점순·신청순 정렬 버튼도 없다. 7일짜리 대회 공고에 역할 3종이 섞여 있으면 수십 장 카드를 눈으로 훑어야 한다.
- 근거: src/components/employer/applicants/ApplicantList.tsx:57-62 FILTER_OPTIONS 는 상태 4종뿐이고, 98-101 filteredApplicants 도 `a.status === selectedFilter` 만 본다. 정렬 UI 는 없다. 정작 훅에는 능력이 있다 — src/hooks/applicant/index.ts:130-184 `filterApplicants({ role, sortBy: 'appliedAt'|'name'|'status' })` 가 구현돼 있으나 app/(employer)/my-postings/[id]/applicants.tsx:57-69 의 destructure 에 포함되지 않아 화면이 한 번도 쓰지 않는다.
- 제안: 이미 있는 filterApplicants 를 화면에 배선해 역할 칩 필터 + 정렬 드롭다운(최신순/평점순)을 붙인다. 다일정 공고는 날짜 칩도 추가.

**`confirm-button-silently-disabled`** — 지원자 확정 · PARTIAL · 빈도 매번 · 수정 S
- 증상: 신규 지원자 카드의 확정 버튼이 처음부터 회색이고 라벨이 '0개 확정'이다. 왜 안 눌리는지 문구가 없어서, 날짜 체크박스를 먼저 골라야 한다는 걸 모르면 '버튼이 고장났다'고 느낀다. 5일 전부 확정하려면 날짜/그룹을 일일이 눌러야 하고 '전체 선택' 버튼이 카드에 없다.
- 근거: src/components/employer/applicants/ApplicantCard/useAssignmentSelection.ts:101 `useState<Set<string>>(new Set())` — 초기 선택 0건. src/components/employer/applicants/ApplicantCard/components/AppliedActions.tsx:44 `isConfirmDisabled = !isFixedMode && totalCount > 0 && selectedCount === 0`, 47-51 라벨은 `${selectedCount}개 확정` 이라 '0개 확정'으로 렌더된다. 안내 문구는 GroupedAssignmentSelector.tsx:126-131 의 '선택된 일정 0/N개 선택' 카운터뿐이고, 카드 단위 전체선택 핸들러는 존재하지 않는다(훅의 clearSelection 만 있고 selectAll 없음).
- 제안: 기본값을 '전체 선택'으로 두거나(부분 확정 경고는 이미 ConfirmModal.tsx:244-250 에 있다), 최소한 비활성 버튼 아래에 '확정할 날짜를 먼저 선택해주세요' 한 줄과 '전체 선택' 링크를 넣는다.
- 검증 보정: 사실인 부분: useAssignmentSelection.ts:101 초기 선택 0건, AppliedActions.tsx:44 비활성 조건, 47-51 라벨이 '0개 확정'으로 렌더, 카드 단위 전체선택 핸들러 부재(훅에 clearSelection 만 있고 selectAll 없음), 안내는 GroupedAssignmentSelector.tsx:126-131 카운터뿐 — 전부 실측 일치. 반박되는 부분: '5일 전부 확정하려면 날짜/그룹을 일일이 눌러야'는 부정확 — 같은 시간대·역할의 다중 날짜는 하나의 그룹으로 묶이고(useAssignmentSelection.ts:107-148) 그룹 헤더 1탭(toggleGroup, GroupedAssignmentSelector.tsx:213-217)이 그룹 전체를 선택한다. 단일 역할 5일 지원이면 1탭으로 끝난다. 그룹이 여러 개일 때만 그룹 수만큼 탭이 필요하고, 같은 날짜에 역할이 겹치면 전역 전체선택은 정의 자체가 모호하다(같은 날짜 1개 제약, toggleAssignment:180-189).

**`soft-target-day-by-day`** — 근무표 필요 인원 설정 · CONFIRMED · 빈도 매번 (월초마다) · 수정 M
- 증상: '필요 인원'을 하루씩만 저장할 수 있다. 매주 금·토 8명이 필요한 홀덤펍이라면 한 달치를 채우려고 날짜 탭 → 숫자 입력 → 저장을 8~9번, 평일까지 하면 30번 반복한다. 지난달 값을 이번 달로 복사하는 수단도 없다.
- 근거: src/components/workSchedule/VenueDayPanel.tsx:255-268 `handleSaveTarget` 은 `setSoftTarget.mutate({ venueId, date: toDateString(date), count })` 로 단일 날짜만 쓴다. src/hooks/workSchedule/ 에 useSetVenueSoftTarget 외 일괄/반복 훅이 없다(디렉터리 전체에 useSetVenueSoftTarget.ts 하나뿐). 입력 칸도 하나다(VenueDayPanel.tsx:343-356).
- 제안: '이 값을 매주 같은 요일에 적용' 체크박스 또는 '지난달 필요 인원 복사' 버튼을 붙인다. 요일별 기본 목표를 지점 설정에 두고 날짜별 값은 예외만 저장하는 구조가 더 낫다.

**`pool-list-no-search`** — 근무표 인원 추가 — 풀에서 고르기 · CONFIRMED · 빈도 자주 · 수정 S
- 증상: '스태프 추가' 탭의 확정 스태프 풀이 검색·필터 없이 전부 나열된다. 단골 50명을 굴리는 지점이면 원하는 사람 찾으려고 시트를 계속 스크롤해야 한다. 닉네임 검색은 옆 탭에 따로 있는데 그건 풀 밖 가입자를 찾는 용도라 이름을 정확히 알아야 한다.
- 근거: src/components/workSchedule/AddSlotSheet.tsx:500-510 은 `poolPeople.map(...)` 로 전량 렌더한다(가상화·검색 입력 없음). 검색 입력은 mode==='nickname' 일 때만 렌더된다(466-474 `{mode === 'nickname' ? <NicknameSearchField .../> : null}`), 그리고 그 검색은 `searchStaffByNickname` 으로 앱 전체 가입자를 치는 별개 경로다(hooks/useStaffNicknameSearch.ts:37).
- 제안: 풀 목록 위에 로컬 필터 입력 한 칸(이름 부분일치)을 넣고, 최근 배치순으로 정렬한다.

**`role-change-per-workday`** — 확정 스태프 역할 변경 · CONFIRMED · 빈도 가끔 · 수정 M
- 증상: 역할 변경이 근무 하루 단위다. 7일 근무하는 사람을 딜러→플로어로 바꾸려면 날짜별로 모달을 7번 열고, 매번 '변경 사유'를 필수로 다시 타이핑해야 한다(사유가 비면 저장 버튼이 안 눌린다).
- 근거: src/components/employer/applicants/RoleChangeModal.tsx:36 `onSave({ staffId, workLogId, newRole, reason })` — workLogId 단수. 220-229 handleSave 도 `staff.id`(단일 work_log) 하나만 보낸다. 216 `isValid = selectedRole.length>0 && selectedRole!==currentRoleKey && reason.trim().length>0` 로 사유가 필수다. 호출부도 스태프 카드 1행 단위다 — ConfirmedStaffCard.tsx:254-264 '역할 변경' 버튼.
- 제안: 모달에 '이 공고의 남은 근무일 전체에 적용' 체크박스를 추가하고 사유는 한 번만 받는다.

**`no-noshow-filter-in-staff-list`** — 확정 스태프 관리 · CONFIRMED · 빈도 자주 (정산 직전) · 수정 S
- 증상: 스태프 목록 필터에 '노쇼'와 '취소됨'이 없다. 정산 전에 노쇼 인원만 골라 확인하려 해도 전체 목록에서 배지를 눈으로 찾아야 한다. 날짜 섹션 카운트에는 노쇼 숫자가 뜨는데 정작 그걸로 걸러볼 수가 없다.
- 근거: src/components/employer/applicants/ConfirmedStaffList.tsx:39-47 FILTER_LABELS 에는 `cancelled: '취소됨'`·`no_show: '노쇼'` 가 정의돼 있으나, 실제 탭 목록인 49-55 FILTER_OPTIONS 에는 all/scheduled/checked_in/checked_out/completed 5개만 들어 있다. 반면 95-101 섹션 헤더는 `group.stats.noShow` 를 배지로 보여준다 — 숫자는 보이는데 필터가 없다.
- 제안: FILTER_OPTIONS 에 no_show·cancelled 를 추가한다(라벨은 이미 있다). 코드 두 줄.

**`cancellation-approve-no-undo-no-history`** — 취소 요청 검토 · PARTIAL · 빈도 가끔 · 수정 M
- 증상: 취소 요청을 '승인'하면 그 스태프의 확정이 바로 풀리고 되돌릴 버튼이 없다. 게다가 처리한 요청은 목록에서 사라져서, 나중에 '내가 누구 취소를 승인했더라' 를 확인할 방법이 없다. 잘못 승인하면 그 사람을 다시 검색해 직접 추가해야 한다.
- 근거: app/(employer)/my-postings/[id]/cancellation-requests.tsx:41 헤더 문구가 '검토 대기 요청만 표시됩니다' 이고, 목록 소스는 status===CANCELLATION_PENDING 만 담는다(src/hooks/applicant/index.ts:122-128). 승인 확인 모달(cancellation-requests.tsx:237-275)은 '취소' / '승인' 두 버튼뿐이고 되돌리기·토스트 Undo 가 없다. 처리 완료 항목을 보여주는 화면·탭도 존재하지 않는다(CancellationRequestCard.tsx:232-239 의 '검토 결과 표시' 분기는 목록이 pending 만 담아 실질적으로 도달하지 않는다).
- 제안: 승인 토스트에 5초 '되돌리기'를 붙이고, 화면에 '처리 완료' 필터 탭을 추가해 승인/거절 이력과 사유를 남긴다.
- 검증 보정: 사실인 부분: cancellation-requests.tsx:41 '검토 대기 요청만 표시됩니다', 목록 소스는 index.ts:122-128 CANCELLATION_PENDING 필터, 승인 모달(237-275)은 취소/승인 두 버튼뿐 Undo 없음, CancellationRequestCard.tsx:232-239 의 검토 결과 분기는 이 목록에선 도달 불가 — 전부 실측 일치. 승인 후 재확정 버튼도 없다(canShowActions 는 APPLIED 한정). 반박되는 부분: '누구 취소를 승인했더라를 확인할 방법이 없다'는 부정확 — 취소된 지원자는 지원자 관리 화면 '전체' 탭에 남고, ApplicantCard 의 StatusInfo(55-58행)가 ConfirmationHistoryTimeline 으로 확정·취소 이력을 노출한다. 전용 처리 이력 화면이 없을 뿐 추적 수단 자체는 존재한다.

**`applicants-capacity-strip-role-blind`** — 지원자 관리 — 인원 미달 파악 · CONFIRMED · 빈도 매번 (역할 2종 이상 공고) · 수정 S
- 증상: 지원자 화면 상단에 '확정 12 / 정원 20명' 만 뜬다. 딜러는 다 찼는데 플로어가 5명 비었다는 사실은 이 화면에서 알 수 없어서, 어떤 역할 지원자를 서둘러 확정해야 하는지 판단이 안 된다.
- 근거: app/(employer)/my-postings/[id]/applicants.tsx:231-245 는 `managementView.filledPositions` / `managementView.totalPositions` 총계 두 숫자만 렌더한다. 역할별 집계는 이미 계산돼 훅이 내보내는데(src/hooks/applicant/index.ts:121 `statsByRole`, 209-210 반환) 화면의 destructure(applicants.tsx:57-69)에 포함되지 않아 쓰이지 않는다.
- 제안: 정원 스트립을 역할별 칩(딜러 6/6 · 플로어 3/8)으로 바꾸고, 미달 역할은 경고 톤으로 표시한다. 데이터는 이미 있으므로 배선만 하면 된다.

**`collaborator-owner-sees-readonly-while-loading`** — 공고 공유 관리 · CONFIRMED · 빈도 자주 (첫 진입·느린 네트워크) · 수정 S
- 증상: '공유 관리'에 들어가면 공고 정보가 도착하기 전까지 협업자 검색창이 아예 안 보이고 '협업자가 추가되지 않은 공고예요'(남의 공고인 것처럼) 라는 안내가 뜬다. 네트워크가 느리거나 조회가 실패하면 자기 공고인데도 계속 그 상태로 남아, 협업자를 추가할 수 없다.
- 근거: app/(employer)/my-postings/[id]/collaborators.tsx:27 `const { job: jobPosting } = useJobDetail(jobPostingId)` — isLoading·error 를 받지 않는다. 33 `const isOwner = !!jobPosting && jobPosting.ownerId === currentUserId` 이라 job 이 없는 동안 isOwner=false 로 확정되고, 53 `{isOwner ? (검색+목록) : (읽기 전용 목록)}` 분기가 검색 UI 를 통째로 감춘다. 이때 빈 목록 문구는 비소유자용이다 — src/components/job-posting/CollaboratorList.tsx:48·52-53.
- 제안: isLoading 동안은 스켈레톤을 보여주고, 조회 실패는 '공고 정보를 불러오지 못했어요 + 다시 시도'로 분기한다. '없다'와 '아직 모른다'를 섞지 않는다.

### [구인자-정산운영]


**`monitor-transient-error-kills-board`** — 대회 현장 전광판 운영 · PARTIAL · 빈도 자주 — 홀덤펍/대회장 와이파이 환경에서 폴링 1회 실패는 흔하다 · 수정 S
- 증상: 대회 중 와이파이가 잠깐 끊기면 전광판이 "유효하지 않은 모니터 링크입니다 — 운영자에게 새 링크를 요청하세요"로 바뀌고, 네트워크가 돌아와도 **스스로 복구되지 않는다**. 화면에 새로고침 버튼도 없어서 운영자가 브라우저를 직접 새로고침해야 하고, 그 전까지는 링크가 죽은 줄 알고 새 토큰을 발급하러 다닌다. 플레이어 공개뷰도 같다.
- 근거: src/hooks/ops/useMonitorSnapshot.ts:26-28 — `refetchInterval: (q) => (q.state.status === 'error' ? false : POLL_INTERVAL_MS)` + `retry: false`. 한 번 실패하면 4초 폴링이 영구 중단된다. app/(public)/monitor/[token].tsx:172-183 은 `isError` 를 무조건 '유효하지 않은 링크'로 렌더하고 재시도 UI가 없다. src/hooks/ops/usePlayerView.ts:22-25 도 동일 구조.
- 제안: 에러를 '토큰 무효(4xx)'와 '일시 통신 실패'로 나눠, 후자는 마지막 스냅샷을 흐리게 유지한 채 '연결 끊김 · 재접속 중' 배너만 띄우고 폴링을 계속한다. 최소한 에러 화면에 '다시 시도' 버튼을 둔다.
- 검증 보정: useMonitorSnapshot.ts:26-28의 `refetchInterval: error→false` + `retry: false`, usePlayerView.ts:23-25 동일 구조, monitor/[token].tsx:172-183의 isError→'유효하지 않은 모니터 링크' 무조건 렌더·재시도 UI 부재는 전부 실재를 확인했다. 그러나 '네트워크가 돌아와도 스스로 복구되지 않는다'는 과장이다: queryClient.ts:189 `refetchOnReconnect: true`(전역) + services/offline/networkState.ts:61 `onlineManager.setOnline` NetInfo 배선(app/_layout.tsx:39에서 루트 초기화, 공개 라우트 포함) + queryClient.ts:187 `refetchOnWindowFocus` 때문에, NetInfo가 감지하는 오프라인→온라인 전환이나 앱 포그라운드 복귀 시 에러 상태의 활성 쿼리가 재조회되고 성공하면 status가 success로 돌아가 4초 폴링이 재개된다. 잔존 결함은 (a) onlineManager가 계속 online인 채 실패하는 경우(서버 5xx·타임아웃·AP는 붙어있는 순단)는 영구 정지, (b) 일시 실패 순간에도 원인과 무관하게 '유효하지 않은 링크'로 오귀속 표시(운영자가 토큰 재발급하러 가는 유인)라는 점이며 이 부분은 사실이다.

**`monitor-qr-no-keep-awake`** — 전광판 게시 · 현장 QR 비치 · PARTIAL · 빈도 매번 — 두 화면 모두 '오래 켜두는' 용도가 유일한 목적이다 · 수정 S
- 증상: 전광판(모니터 뷰)이나 출퇴근 QR 화면을 태블릿/폰에 띄워 현장에 세워두면 몇 분 뒤 화면이 꺼진다. 스태프가 QR을 찍으러 오면 화면을 깨워야 하고, 대회 전광판은 블라인드가 올라갈 때마다 누군가 화면을 만져야 한다.
- 근거: `keep-awake`/`KeepAwake`/`wakeLock` 검색 결과가 소스 0건(package-lock.json 의 expo 전이 의존만 존재). app/(public)/monitor/[token].tsx 와 app/(employer)/my-postings/[id]/qr.tsx 어디에도 화면 유지 처리가 없다. qr.tsx:101-103 은 오히려 "스크린샷으로 저장해 현장에 비치하세요"라고 안내해 상시 표시를 전제한다.
- 제안: `expo-keep-awake` 의 `useKeepAwake()` 를 monitor/[token].tsx, live/[view_token].tsx, my-postings/[id]/qr.tsx 세 화면에 건다. QR 화면은 진입 시 밝기 최대화까지 하면 어두운 홀에서 인식률이 올라간다.
- 검증 보정: 소스 전역 Grep 결과 keep-awake/wakeLock 사용은 0건(package-lock.json의 expo 전이 의존 expo-keep-awake ~55.0.8만 존재)임을 확인했고, monitor/[token].tsx와 qr.tsx 어디에도 화면 유지 처리가 없다. 전광판(모니터 뷰)을 태블릿/폰에 세워두면 화면이 꺼진다는 부분은 사실. 다만 QR 쪽은 과장이다: qr.tsx:101-103 안내문 '공고마다 1장이며 바뀌지 않습니다. 스크린샷으로 저장해 현장에 비치하세요'는 '상시 화면 표시를 전제'하는 게 아니라 반대로 인쇄물/저장 이미지 비치라는 대안 경로를 이미 제시하는 문구다 — 감사자가 근거를 뒤집어 읽었다.

**`venue-settlement-no-time-amount-edit`** — 지점 정산 — 금액이 이상할 때 · CONFIRMED · 빈도 가끔 — 출퇴근이 잘못 찍힌 달마다 · 수정 M
- 증상: 지점 정산에서 금액이 잘못돼 보여도 그 자리에서 근무 시간이나 금액을 고칠 수 없다. 상세 모달을 열어도 '시간 수정'·'금액 수정' 버튼이 없어서, 근무표 화면으로 되돌아가 날짜를 다시 찾아 들어가야 한다.
- 근거: app/(employer)/venue-settlements.tsx:395-401 — SettlementDetailModal 에 `onEditTime`/`onEditAmount`/`onSettle` 을 넘기지 않는다. SettlementDetailModal.tsx:276-282 의 SettlementActionButtons 는 이 콜백들이 있어야만 버튼을 그린다(공고 정산 화면은 SettlementModals.tsx:129-131 에서 전부 넘긴다).
- 제안: 지점 정산에도 시간/금액 수정 진입점을 배선하거나, 최소한 상세 모달에서 해당 근무의 근무표 날짜로 점프하는 '근무표에서 수정' 링크를 둔다.

**`bulk-settle-selection-lost-on-cancel`** — 공고 정산 — 일괄 정산 · CONFIRMED · 빈도 자주 — 확인 창에서 한 번 물러서면 매번 · 수정 S
- 증상: 여러 건을 하나씩 골라 '일괄 정산'을 누르면 확인 창이 뜨는데, 여기서 '취소'를 누르면 골라둔 선택이 통째로 사라지고 선택 모드까지 빠져나와 있다. 금액을 한 번 더 확인하려고 취소했을 뿐인데 처음부터 다시 체크해야 한다.
- 근거: src/components/employer/settlement/SettlementList.tsx:251-256 — `onBulkSettle?.(selectedLogs)` 직후 무조건 `setSelectedIds(new Set())` + `setSelectionMode(false)`. 그런데 이 콜백은 useStaffSettlementsHandlers.ts:189-204 에서 확인 모달을 '열기만' 하고, 실제 실행은 handleConfirmSettle(207-220)에서 일어난다.
- 제안: 선택 초기화를 확인 모달의 성공 콜백(handleConfirmSettle)으로 옮긴다. 취소하면 선택 상태가 그대로 남아 있어야 한다.

**`grouped-card-checkbox-one-way`** — 공고 정산 — 스태프 카드 선택 · PARTIAL · 빈도 자주 — 며칠 근무 중 하루가 퇴근 미기록인 스태프는 흔하다 · 수정 S
- 증상: 선택 모드에서 스태프 카드의 체크박스를 눌러 그 사람 근무를 다 골랐는데, 다시 눌러도 해제되지 않는다. 출퇴근이 아직 안 끝난 근무가 하나라도 섞인 스태프에서 그렇다. 해제하려면 '선택 취소'로 전부 날려버리는 수밖에 없다.
- 근거: src/components/employer/settlement/GroupedSettlementCard.tsx:258 — `isAllSelected = selectedCount === group.originalWorkLogs.length`. 그런데 SettlementList.tsx:228-241 의 `handleSelect` 는 `selectableIds`(미정산+출퇴근완료+status 통과)에 든 행만 담는다. 정산 불가 행이 1건이라도 있으면 selectedCount 는 total 에 영원히 못 미쳐 isAllSelected 가 항상 false → GroupedSettlementCard.tsx:291-308 의 토글이 계속 '선택' 분기만 타고, 이미 선택된 행은 `!selectedIds?.has(...)` 에서 걸러져 아무 일도 일어나지 않는다.
- 제안: 그룹의 '전체 선택' 판정 분모를 `originalWorkLogs` 가 아니라 선택 가능한 행 수로 바꾼다(카드가 선택 가능 여부를 props 로 받거나 `getSettlableWorkLogIds(group)` 를 함께 본다).
- 검증 보정: GroupedSettlementCard.tsx:258 `isAllSelected = selectedCount === group.originalWorkLogs.length`과 291-308의 토글 확인. SettlementList.tsx:228-241 handleSelect는 selectableIds에 든 행만 추가하므로, 정산 불가 행이 섞인 그룹은 isAllSelected가 영원히 false → 토글이 '선택' 분기만 타고 이미 선택된 행은 `!selectedIds?.has()`에서 걸러져 카드 체크박스 재탭이 무반응이다(체크박스는 324행에서 selectedCount>0이면 checked로 보이는데 탭해도 안 풀림). 이 부분은 사실이고 08-01 웨이브 감사에서도 신규 회귀로 기록된 건이다. 다만 '해제하려면 선택 취소로 전부 날려버리는 수밖에 없다'는 과장: 카드의 '날짜별 상세'를 펼치면(422-444) DateStatusRow마다 개별 체크박스(155-163)가 onToggleSelect를 호출하고 handleSelect의 delete 분기가 동작하므로 행 단위 해제는 가능하다.

**`csv-is-text-not-file`** — 정산 증빙 내보내기 · CONFIRMED · 빈도 가끔 — 월말 정산·세무 자료 만들 때마다 · 수정 M
- 증상: 모바일에서 CSV 내보내기를 하면 파일이 아니라 CSV **텍스트 덩어리**가 공유 메시지로 나간다. 스태프가 20명이면 카카오톡/메일 본문에 20줄짜리 쉼표 문자열이 붙는다. 내용도 사람·기간·일수·역할·상태·총액뿐이라, 세무 자료로 쓰려면 날짜별 근무시간과 시급이 없어 결국 손으로 다시 만든다.
- 근거: src/utils/settlement/settlementExport.ts:108-112 — 모바일 경로는 `Share.share({ message: csv })`. 같은 파일 14행의 `CSV_HEADER` 는 `['스태프','근무기간','근무일수','역할','정산상태','총정산액(원)']` 6열뿐이고, 날짜·출퇴근 시각·시급·수당·세금 열이 없다.
- 제안: `expo-file-system` + `expo-sharing` 으로 실제 .csv 파일을 공유한다. 열은 근무일 단위(날짜·역할·출근·퇴근·근무시간·시급·수당·세금·실지급액)로 넓히고, 기존 요약본은 별도 시트/파일로 남긴다.

**`venue-settlement-no-summary-no-export`** — 지점 정산 — 월 마감 · CONFIRMED · 빈도 매번 — 월 마감마다 · 수정 M
- 증상: 지점 정산 화면에는 그 달 총 지급액도, 완료/미정산 건수 요약도 없다. 하단 바에 '미정산 N건 · 합계'만 뜨고, 다 정산하고 나면 그 바마저 사라져서 그 달에 얼마 나갔는지 화면에서 알 수 없다. 내보내기도 없어 장부에 옮기려면 카드를 하나씩 세야 한다.
- 근거: app/(employer)/venue-settlements.tsx:341-365 — FlatList 위에 요약 카드가 없고, 합계 표시는 `settlableWorkLogs.length > 0` 일 때만 렌더되는 하단 바뿐이다. 공고 정산에는 SettlementSummaryCard(SettlementList.tsx:324)와 CSV 버튼(336-350)이 있지만, `exportSettlementCsv` 소비처는 SettlementList 한 곳뿐이다.
- 제안: 지점 정산 상단에도 SettlementSummaryCard(총 건수·미정산/완료 금액)를 얹고 CSV 내보내기 버튼을 공유한다. 완료된 뒤에도 '이 달 지급 완료 합계'가 남아 있어야 한다.

**`venue-cannot-be-deleted`** — 지점 관리 · CONFIRMED · 빈도 드묾 — 하지만 한 번 생기면 영구 · 수정 M
- 증상: 오타로 만들었거나 문 닫은 지점을 지울 방법이 없다. 지점 설정 시트에서 이름·장소·연락처는 고치고 단가 행은 지울 수 있는데 지점 자체를 지우는 버튼은 없어서, 잘못 만든 지점이 근무표 상단 칩 줄에 영원히 남아 매번 옆으로 스크롤해야 한다.
- 근거: src/components/workSchedule/VenueSettingsSheet.tsx — 삭제 버튼(257-267)은 역할별 단가 행 전용(`confirmDelete` 147-158)이고 지점 삭제 경로가 없다. app/(employer)/work-schedule.tsx:277-279 주석도 "현재 지점 삭제 수단이 없어 영구 잔존"이라고 적고 있다.
- 제안: 팀 보관(archive)과 같은 방식으로 지점 보관/복원을 붙인다. 배치 기록이 있는 지점은 하드 삭제 대신 숨김 처리해 과거 정산은 보존한다.

**`venue-settlement-entry-hidden`** — 지점 정산 진입 · CONFIRMED · 빈도 매번 — 월 정산 때마다 · 수정 S
- 증상: 지점 정산으로 가는 길이 '근무표 화면 헤더 오른쪽의 작은 정산 글씨' 하나뿐이다. 구인자 홈(내 공고)에도, 팀 화면에도 정산으로 가는 입구가 없어서 월 정산을 하려면 홈 → 근무표 → 헤더 정산 순으로 들어가야 하고, 근무표 자체가 기능 플래그 뒤에 있어 플래그가 꺼진 계정은 지점 정산이 존재하는지조차 알 수 없다.
- 근거: `venue-settlements` 라우트로 push 하는 곳은 app/(employer)/work-schedule.tsx:214-234 단 한 곳(텍스트 버튼). work-schedule.tsx:200-202 은 `weekly_grid_enabled` 가 OFF면 워크스페이스로 리다이렉트한다. 홈(app/(app)/(tabs)/employer.tsx:391-410)의 버튼은 '새 공고 작성'과 '근무표' 둘뿐이다.
- 제안: 팀 화면의 '근무표' 행 아래에 '지점 정산' 행을 추가하고, 구인자 홈에도 미정산 금액이 있을 때 '이번 달 미정산 N건' 배너로 바로 들어가게 한다.

**`revert-silent-to-staff`** — 지급 완료 취소 · CONFIRMED · 빈도 드묾 — 하지만 발생 시 돈 문제로 직결 · 수정 M
- 증상: 지급 완료를 취소해도 스태프에게는 아무 알림이 가지 않는다. 스태프는 이미 '정산 완료' 알림을 받아 돈이 들어올 줄 알고 기다리는데, 사장 화면에서만 조용히 대기 상태로 돌아간다. 취소 모달 문구에도 '스태프에게 알려지지 않는다'는 말이 없어 사장은 상대가 안다고 착각한다.
- 근거: app/(employer)/venue-settlements.tsx:92-99 주석 — "되돌리기(completed→pending)는 알림 트리거 조건에 걸리지 않는다 — notify_on_work_log_update Case 3 은 completed 전이에서만 발화하므로 '취소 시 무알림'은 이미 성립한다". SettlementRevertModal.tsx:66-72 의 고지 문구는 '지급일 기록 삭제·사유 이력·실이체 미복구'만 말하고 알림은 언급하지 않는다.
- 제안: 취소 시 스태프에게 '정산이 다시 확인 중으로 변경됐어요 + 사유' 알림을 보내거나, 최소한 취소 모달에 '스태프에게는 알림이 가지 않아요 — 직접 알려주세요'를 명시한다.

**`workspace-sent-invites-invisible`** — 팀 멤버 초대 · PARTIAL · 빈도 가끔 — 초대할 때마다 · 수정 M
- 증상: 초대를 보내면 '초대를 보냈어요' 토스트 후 이전 화면으로 돌아가는데, 팀 화면 어디에도 대기 중인 초대가 표시되지 않는다. 상대가 수락했는지 안 했는지 알 수 없고, 엉뚱한 사람에게 보냈어도 취소할 방법이 없다. 그 사람이 수락하면 팀의 모든 공고를 만들고 수정할 수 있게 된 뒤에야 '멤버 제거'로 회수할 수 있다.
- 근거: app/(employer)/workspace/invite.tsx:54-66 — 성공 시 `router.back()` 만 한다. workspace/index.tsx:290-392 의 멤버 섹션은 owner + accepted 멤버만 렌더한다. src/hooks/workspace/ 디렉터리에 보낸 초대 조회/취소 훅이 없고(`useWorkspaceInviteSearch` 는 검색 전용), `cancelInvitation|revokeInvitation|sentInvitation|pendingInvitation` 전역 검색 결과 0건. 받은 초대 화면(workspace/invitations.tsx)은 피초대자 전용이다.
- 제안: 팀 화면 멤버 섹션에 '초대 대기 중' 목록(닉네임 + 만료일 + 취소 버튼)을 추가한다. 초대 취소 RPC 를 붙이기 전이라도 최소한 대기 중이라는 사실은 보여야 한다.
- 검증 보정: UI 층 부재는 사실: invite.tsx:54-66은 성공 시 토스트 후 router.back()만 하고, workspace/index.tsx의 import(24-34행)에 보낸 초대 관련 훅이 없어 멤버 섹션은 owner+accepted만 렌더하며, 대기 초대 표시·취소 UI를 소비하는 화면은 app/ 전역 Grep 0건이다. 그러나 근거 진술이 틀렸다: 'src/hooks/workspace/에 보낸 초대 조회/취소 훅이 없고 전역 검색 0건'은 거짓 — useWorkspaceInvitationsSent(useWorkspaces.ts:199, owner가 보낸 초대 목록)와 useRevokeWorkspaceInvitation(useWorkspaces.ts:277), workspaceInvitationService.revoke('owner가 보낸 초대 회수', service:100), IWorkspaceRepository의 회수 RPC(:117)까지 훅·서비스·RPC 전 계층이 이미 존재하고 배럴(index.ts:12)로 export까지 돼 있다. 화면 배선만 없는 상태라 수정 비용이 감사 보고보다 훨씬 작다.

**`employer-home-no-today`** — 앱 진입 직후 · CONFIRMED · 빈도 매번 — 앱 열 때마다 · 수정 L
- 증상: 앱을 열면 '내 공고' 목록만 보인다. 오늘 몇 명이 출근했는지, 새 지원자가 왔는지, 미정산이 얼마 남았는지는 공고를 하나씩 열어봐야 안다. 공고를 서너 개 굴리는 사장은 매일 아침 같은 순회를 반복한다.
- 근거: app/(app)/(tabs)/employer.tsx:386-412 — 헤더 아래에 '새 공고 작성'/'근무표' 버튼과 상태 필터탭뿐, 오늘 요약이 없다. 당일 운영 요약은 TodayOpsStrip 뿐인데 이건 공고 상세 안(settlements.tsx:198-202)에서만 렌더되고, TodayOpsStrip.tsx:27-30 은 그 공고에 오늘 근무가 없으면 아예 숨는다.
- 제안: 홈 상단에 '오늘' 요약 스트립(오늘 근무 출근 N/M · 새 지원자 K명 · 미정산 P건)을 두고 각 칩이 해당 화면으로 점프하게 한다. 데이터는 이미 usePostingFilledCounts·useVenueSettlement 로 조회 중인 것을 재사용할 수 있다.

### [구직자-근무정산]


**`qr-16h-silent-block`** — 퇴근 기록 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 출근 후 16시간이 지나면 퇴근 스캔이 조용히 거부되는데, 화면에는 '오늘 이 공고에 배정된 근무가 없습니다'라고만 뜬다. 대회 철야나 퇴근 스캔을 깜빡한 다음 날 아침에 정확히 이 상황이 되는데, 사용자는 '앱이 내 근무를 잃어버렸다'로 읽고 원인도 해결법도 알 수 없다.
- 근거: src/services/work/eventQRService.ts:68 MAX_OVERNIGHT_SHIFT_MS=16시간, 90-108 filterStaleCandidates 가 후보에서 제거 → 170-175 에서 selection.reason 이 'no_assignment' 로 떨어져 111-115 의 문구가 그대로 노출된다. 주석 자체가 '16시간을 넘는 실제 근무는 이 경로로 퇴근할 수 없다'(eventQRService.ts:66)고 인정한다.
- 제안: 상한 초과로 걸러진 후보가 있으면 별도 사유('출근한 지 16시간이 지나 QR로는 퇴근할 수 없어요. 구인자에게 퇴근 시각 입력을 요청해 주세요')를 반환하고, 그 자리에서 구인자 연락 CTA를 띄운다.

**`staff-no-missing-checkout-safety-net`** — 퇴근 미기록 후 정산 대기 · CONFIRMED · 빈도 가끔 · 수정 M
- 증상: 퇴근을 안 찍은 근무는 영원히 '출근 중'으로 남아 정산 대상이 되지 않는데, 그 사실을 구직자에게 알려주는 화면이 하나도 없다. 안전망 배너는 구인자 근무표에만 있다. 스태프는 '왜 이 근무만 정산이 안 되지'를 몇 주 뒤에야 눈치챈다.
- 근거: src/domains/staff/missingCheckout.ts:2-9 주석이 '이 배너가 구인자에게 그 사실을 알리는 유일한 경로다'라고 명시. summarizeMissingCheckouts 소비처는 app/(employer)/work-schedule.tsx:155 단 한 곳(레포 전체 grep 결과). 구직자 스케줄 화면(app/(app)/(tabs)/schedule.tsx)에는 대응 배너가 없다.
- 제안: 같은 순수 함수를 구직자 스케줄 탭에서도 소비해 '퇴근이 기록되지 않은 근무 N건' 배너를 띄우고, 탭하면 해당 근무 상세 + 구인자 문의 CTA로 착지시킨다.

**`no-posting-link-from-shift`** — 출근 직전 준비 · CONFIRMED · 빈도 매번 · 수정 M
- 증상: 확정된 근무에서 원래 공고로 돌아갈 방법이 없다. 복장 규정·경력 조건 같은 '모집 조건'은 공고에만 있는데 스케줄 상세에는 전달되지도, 링크되지도 않는다. 검정 셔츠를 입어야 하는지 확인하려면 공고 목록에서 그 공고를 다시 찾아야 하고, 이미 마감된 공고면 그것도 안 된다.
- 근거: src/types/schedule.ts:85-94 SchedulePostingProjection 은 ownerName·description·settlement 세 가지뿐 — 모집 조건 필드가 아예 없다. 실제 공고 타입에는 있다(src/types/jobPosting.ts:79-81 dressCode). 스케줄 화면·컴포넌트에서 '/(app)/jobs/[id]' 로 이동하는 코드는 0건이다(grep: push 대상은 home-jobs.tsx:248, jobs/[id]/index.tsx:72, admin 뿐).
- 제안: ScheduleDetailModal 정보 탭에 '공고 원문 보기' 버튼을 추가하고, 최소한 requirements(복장·경력) 라벨을 postingProjection 에 실어 정보 탭에 노출한다.

**`unpaid-scope-current-month`** — 내 급여 확인 · CONFIRMED · 빈도 자주 · 수정 M
- 증상: '미지급' 필터와 그 건수 배지가 지금 보고 있는 달만 센다. 지난달 안 받은 돈이 있어도 이번 달 화면에는 미지급 탭 자체가 안 생겨서, 사용자는 '다 받았다'고 믿는다. 못 받은 돈을 찾으려면 달을 하나씩 뒤로 넘기며 눈으로 확인해야 한다.
- 근거: app/(app)/(tabs)/schedule.tsx:291-294 countUnpaidSchedules(groupedByApplication) 이고, groupedByApplication 은 useCalendarView → useSchedulesByMonth(현재 년/월) 결과다(src/hooks/useSchedules.ts:261-266). 탭은 unpaidCount>0 일 때만 추가된다(schedule.tsx:305-307). 구직자용 정산 집계 훅은 없다 — src/hooks/useSettlement.ts:1-3 은 '구인자용'이라 명시.
- 제안: 미지급 집계는 월 범위를 벗어나 전체(또는 최근 6개월) 기준으로 조회해 상단에 상시 노출하고, 탭하면 해당 근무의 달로 점프시킨다.

**`noshow-contact-missing`** — 노쇼 기록 이의 · PARTIAL · 빈도 드묾 · 수정 S
- 증상: '무단결근(노쇼)으로 기록되었습니다 … 사실과 다르면 구인자에게 문의해 주세요'라고 해놓고, 구인자 전화번호가 없는 공고면 화면 어디에도 연락 수단이 없다. 평판과 정산에 불리한 기록인데 반박할 창구가 막다른 길이 된다. 게다가 노쇼 상세는 장소·급여·구인자 정보를 통째로 감춰서 무엇을 근거로 항의할지도 안 보인다.
- 근거: src/components/schedule/helpers/statusConfig.ts:39-41 문구가 '구인자에게 문의'를 지시한다. 그런데 InfoTab.tsx:172-201 은 노쇼일 때 공고명·날짜만 남기고 조기 반환해 구인자 연락처 섹션(InfoTab.tsx:328-359)에 아예 도달하지 못한다. WorkTab.tsx:146 의 전화 CTA 는 schedule.ownerPhone 이 있을 때만 렌더된다.
- 제안: 노쇼 블록에 전화번호가 없을 때의 폴백(고객센터 1:1 문의로 이 근무를 첨부해 이의 접수)을 제공하고, 노쇼 정보 탭에서도 장소·급여 등 근거 정보를 그대로 보여준다.
- 검증 보정: statusConfig.ts:39-41 문구, InfoTab.tsx:172-201 노쇼 조기 반환(공고명·일정만 남기고 연락처 섹션 328-359 미도달), WorkTab.tsx:146-157 전화 CTA 의 ownerPhone 조건부 렌더 모두 실측 확인 — ownerPhone 없는 공고에서 연락 수단이 없는 것은 사실. 그러나 '무엇을 근거로 항의할지도 안 보인다'는 반박: WorkTab.tsx:136-145 가 구인자가 남긴 노쇼 사유(noShowReason)를 그대로 보여주고, 172행 주석대로 노쇼 분기는 정보를 흐리지 않기 위해 의도적으로 분리된 것이다. 급여·장소가 감춰지는 것은 사실이나 이의 근거의 핵심(사유)은 제공된다.

**`review-write-loses-input`** — 평가 작성 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 평가를 쓰다가 뒤로가기를 누르거나 알림을 탭해 화면을 벗어나면 고른 감정·태그·코멘트가 경고 없이 통째로 사라진다. 임시저장도 없다. 같은 앱의 구인자 공고 작성에는 이탈 경고가 붙어 있어서 더 어긋나 보인다.
- 근거: app/(app)/reviews/write.tsx:87-110 에 useUnsavedChangesGuard 가 없다. 훅 자체는 존재하며 app/(employer)/my-postings/create.tsx:78, [id]/edit.tsx:49 에서만 쓰인다. ReviewForm 은 로컬 RHF 상태만 갖고(src/components/review/ReviewForm.tsx:33-47) 어떤 영속화도 하지 않는다.
- 제안: isDirty 를 상위로 올려 useUnsavedChangesGuard 를 연결하고, 최소한 '작성 중인 내용이 사라집니다' 확인을 띄운다.

**`board-write-loses-input`** — 커뮤니티 글쓰기 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 최대 5,000자짜리 글을 쓰다가 '취소'를 누르거나 뒤로 밀면 확인 한 번 없이 전부 날아간다. 이미지까지 올려둔 상태여도 마찬가지다.
- 근거: src/components/board/BoardPostEditor.tsx:57-58 은 title/body 를 로컬 useState 로만 들고 있고 이탈 가드가 없다. app/(app)/(tabs)/board/write.tsx:40 의 onCancel 은 확인 없이 router.back() 을 바로 호출한다. 본문 상한은 BoardPostEditor.tsx:104 maxLength 5000.
- 제안: 제목·본문·첨부가 하나라도 있으면 이탈 시 확인을 띄우고(useUnsavedChangesGuard 재사용), MMKV 에 임시 draft 를 남긴다.

**`notif-delete-no-undo`** — 알림 정리 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 알림 항목 우측 상단 휴지통을 잘못 누르면 확인도 되돌리기도 없이 즉시 사라진다. 알림 본문에 담긴 확정 내용·근무 날짜를 다시 볼 방법이 없다. '모두 삭제'에는 확인 다이얼로그가 있는데 개별 삭제만 무방비다.
- 근거: src/components/notifications/NotificationItem.tsx:119-129 의 삭제 Pressable 은 onDelete 를 바로 호출하고, 위치가 제목 바로 옆(absolute right-2 top-3)이라 오탭이 쉽다. src/hooks/useNotifications.ts:346-364 는 낙관 제거 후 '알림이 삭제되었습니다' 성공 토스트만 띄우고 undo 액션이 없다. 대조: app/(app)/notifications.tsx:107-118 전체 삭제는 confirmAction 을 쓴다.
- 제안: 삭제 토스트에 5초짜리 '되돌리기' 액션을 붙이거나(프로젝트 impeccable §12 규칙), 스와이프 제스처로 옮겨 오탭 자체를 줄인다.

**`worktab-global-working-flag`** — 근무 탭에서 출퇴근 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 오늘 다른 근무에 출근 체크가 되어 있으면, 아직 출근도 안 한 다음 근무의 상세에서 버튼이 'QR 코드로 퇴근하기'라고 뜬다. 같은 화면 위쪽 '내 다음 근무' 카드는 '출근하기'라고 하고 있어서 두 라벨이 서로 어긋난다. 하루에 두 탕 뛰는 사람이 정확히 이 상황을 만난다.
- 근거: src/components/schedule/tabs/WorkTab.tsx:79 는 useCurrentWorkStatus() 의 isWorking 을 쓰는데, 그 값은 src/hooks/useWorkLogs.ts:218 getTodayCheckedInWorkLog(staffId) — 이 근무가 아니라 '오늘 어디든 출근 중인가'다. 반면 NextShiftCard.tsx:63 은 schedule.status === CHECKED_IN 으로 해당 근무 기준으로 판정한다. 라벨은 WorkTab.tsx:287-290.
- 제안: WorkTab 도 schedule.status 로 판정하도록 바꿔 NextShiftCard 와 판정 축을 일치시킨다.

**`board-hard-cap-50`** — 커뮤니티·공지 열람 · CONFIRMED · 빈도 가끔 · 수정 M
- 증상: 게시판이 50건에서 끊기고 더 불러오기도, 검색도 없다. 대타 구인 글이 몰리는 날이면 조금만 지난 글은 영영 못 찾고, 공지사항도 51번째부터는 접근 경로가 사라진다.
- 근거: app/(app)/(tabs)/board/[boardType].tsx:35 useBoardPosts(safeBoardType, 50) 로 상한이 하드코딩돼 있고, 같은 파일 62-113 의 FlashList 에 onEndReached 가 없다. src/hooks/useBoard.ts:259-276 도 useQuery 단발 조회라 페이지네이션 개념이 없다. 검색 UI 는 화면 어디에도 없다. 공지 화면도 같은 경로다(app/(app)/notices/index.tsx:4 → board/notice 리다이렉트).
- 제안: useInfiniteQuery 로 전환해 onEndReached 를 연결하고, 최소한 제목 검색 입력을 붙인다.

**`nextshift-qr-button-a11y`** — 출근 직전 QR 실행 · CONFIRMED · 빈도 매번(스크린리더 사용자) · 수정 S
- 증상: '내 다음 근무' 카드 안의 QR 출근 버튼이 카드 전체 버튼에 삼켜져, 스크린리더 사용자는 카드 요약만 듣고 QR 버튼에는 도달하지 못할 수 있다. 가장 급한 순간의 가장 큰 버튼이 음성으로는 존재하지 않는다.
- 근거: src/components/schedule/NextShiftCard.tsx:80-86 에서 카드 루트 Pressable 이 accessibilityRole='button' + 합성 accessibilityLabel 을 갖고, 그 자식으로 146-150 의 QR Pressable 이 중첩돼 있다. 같은 함정을 프로젝트가 이미 인지하고 ScheduleDashboard.tsx:171-182 에서는 라벨을 손으로 합성해 우회했다.
- 제안: 카드 루트에서 accessibilityRole/label 을 걷어내고 본문만 별도 Pressable 로 감싸거나, 카드 라벨에 'QR 출근 버튼 포함'을 합성하고 QR 버튼을 형제로 꺼낸다.

### [구직자-진입]


**`identity-duplicate-deadend`** — 회원가입 본인인증 · CONFIRMED · 빈도 재가입 시도자마다 · 수정 M
- 증상: PASS·토스 등으로 본인인증을 다 끝낸 뒤에야 "이미 가입된 번호예요. 기존 계정으로 로그인하시거나 비밀번호를 찾아주세요"가 뜬다. 그런데 그 문구는 5초 뒤 스스로 사라지고, 로그인 화면으로 가는 버튼도 어떤 이메일로 가입돼 있는지 힌트도 없다. 인증 시간만 쓰고 원점으로 돌아간다.
- 근거: src/components/auth/PortOneIdentityVerification.tsx:146-154 에서 hasDuplicatePhone/hasDuplicateIdentity 를 throw 하고, :364-371 은 그 메시지를 단순 에러 박스로만 렌더한다. :79-85 의 useEffect 가 5초 후 errorMessage 를 null 로 지운다(버튼 없음).
- 제안: 중복 감지는 자동 소멸 배너 대신 '로그인하기 / 비밀번호 찾기' 버튼이 달린 확인 다이얼로그로 승격하고(이미 signup.tsx:48-59 의 showAlreadyRegisteredAlert 패턴이 있다), 가능하면 마스킹된 가입 이메일을 함께 보여준다.

**`delete-account-recovery-blind`** — 회원탈퇴 · CONFIRMED · 빈도 탈퇴자마다 · 수정 S
- 증상: 탈퇴 화면은 "30일간 복구 가능합니다"라고만 하고 어떻게 복구하는지는 어디에도 없다. 탈퇴하면 곧바로 로그아웃돼 로그인 화면으로 튕기고, 실제 철회 방법인 '그 계정으로 다시 로그인'은 아무도 알려주지 않는다. 계정이 사라졌다고 생각한 사람은 30일을 그냥 흘려보낸다.
- 근거: app/(app)/settings/delete-account.tsx:234-238 경고 카드에 복구 절차 문구 없음, :190-196 은 토스트 후 곧바로 /(auth)/login 으로 replace. 실제 철회 UI 인 DeletionScheduledModal 은 app/(app)/_layout.tsx:165-173 에서 (app) 그룹 안에 로그인한 뒤에만 마운트된다.
- 제안: 경고 카드와 완료 토스트에 "30일 안에 같은 계정으로 다시 로그인하면 탈퇴를 철회할 수 있어요"를 명시하고, 탈퇴 완료 화면에 예정일(날짜)을 함께 보여준다.

**`login-lockout-no-warning`** — 로그인 · CONFIRMED · 빈도 비밀번호를 잊은 사람마다 · 수정 S
- 증상: 비밀번호를 헷갈려 네 번 틀리는 동안 앱은 매번 똑같이 "이메일 또는 비밀번호가 올바르지 않습니다"만 말한다. 다섯 번째에 갑자기 15분 잠금이 걸리고, 경고는 사전에 전혀 없었다. 근무 시작 직전이면 15분을 통째로 날린다.
- 근거: src/services/auth/loginAttemptService.ts:18-19(5회/15분), :38-41(잠금 후에야 남은 분 안내). 남은 횟수를 알려주는 getRemainingLoginAttempts(:98-110)는 서비스와 테스트 밖 어디에서도 호출되지 않는다(레포 전체 grep 결과 UI 호출 0건). app/(auth)/login.tsx:161-168 은 실패 시 동일 문구 토스트만 띄운다.
- 제안: 3회째 실패부터 "앞으로 2번 더 틀리면 15분간 로그인할 수 없어요" 를 경고하고, 그 토스트에 '비밀번호 찾기' 바로가기를 붙인다.

**`autologin-off-kills-biometric`** — 로그인 / 설정 · CONFIRMED · 빈도 자동 로그인을 끄는 사람마다 · 수정 S
- 증상: 로그인 화면이나 설정에서 '자동 로그인'을 끄면 지문·Face ID 등록까지 조용히 해제된다. 안내 문구는 "끄면 다음 실행부터 다시 로그인해야 합니다"뿐이라 생체 인증이 날아간 줄 모른다. 다시 켜도 생체 로그인 버튼은 사라진 채라, 설정에 들어가 지문을 처음부터 다시 등록해야 한다.
- 근거: src/hooks/useAutoLogin.ts:43-46 — enabled 가 false 면 setBiometricEnabled(false) 를 함께 호출한다. 같은 파일 :33 의 AUTO_LOGIN_HELPER_TEXT 에는 생체 인증 언급이 없고, 이 문구가 app/(auth)/login.tsx:269 와 app/(app)/settings/index.tsx:170 에 그대로 쓰인다. 로그인 화면의 생체 버튼 노출 조건은 login.tsx:218 의 loginAutoLoginEnabled && isBiometricEnabled 다.
- 제안: 헬퍼 문구를 "끄면 다음 실행부터 다시 로그인해야 하고, 지문/Face ID 로그인도 함께 해제됩니다"로 바꾸고, 끌 때 확인 다이얼로그를 띄운다.

**`reverify-no-reason`** — 재로그인 → 본인인증 재요구 · CONFIRMED · 빈도 구 계정 사용자 진입 시 · 수정 S
- 증상: 잘 쓰던 사용자가 어느 날 로그인하면 곧바로 '본인인증' 화면에 갇힌다. 화면 문구는 신규 가입자용("본인인증을 진행하면 이름·생년월일·휴대폰이 자동으로 확인됩니다")이라 왜 또 인증하라는지 설명이 없고, 뒤로가기를 누르면 '가입을 중단하시겠어요?'와 함께 로그아웃된다. 인증 안 하면 앱을 아예 못 쓴다.
- 근거: src/shared/navigation/authRedirect.ts 의 getAuthenticatedEntryRoute 는 identityVerified===false 면 AUTH_ENTRY_ROUTES.identityReverify 로 보낸다(파일 내 '본인인증 명시적 false' 분기). 이 모드의 화면 문구는 src/components/auth/signup/SignupStepIdentity.tsx:118-121 로 신규 가입과 동일하고, 뒤로가기는 app/(auth)/signup.tsx:257-281 에서 signOut 후 로그인 화면으로 보낸다. src/components/auth/signup/SignupForm.tsx:70 처럼 스텝도 1개뿐이라 맥락 설명이 없다.
- 제안: reverify 모드 전용 안내("보안 정책이 바뀌어 한 번만 다시 인증이 필요해요. 약관 동의와 기존 정보는 그대로 유지됩니다")를 상단에 넣고, 헤더 뒤로가기 라벨도 '가입 중단'이 아니라 '나중에 하기(로그아웃)'로 정정한다.

**`profile-edit-unsaved-loss`** — 프로필 수정 · CONFIRMED · 빈도 긴 자기소개를 쓰는 사람마다 · 수정 M
- 증상: 이력·기타사항을 한참 적다가 뒤로가기를 누르면 확인도 없이 그대로 빠져나가고 입력한 내용이 전부 사라진다. 안드로이드 하드웨어 back, 웹 브라우저 back 도 똑같다.
- 근거: app/(app)/settings/profile.tsx:225 의 StackHeader → src/components/navigation/HeaderBackButton.tsx:28-38 은 dirty 여부를 전혀 보지 않고 즉시 router.back()/replace 한다. 폼의 isDirty 는 profile.tsx:221 저장 버튼 활성화에만 쓰인다.
- 제안: isDirty 일 때 뒤로가기를 가로채 '저장하지 않고 나갈까요?' 확인을 띄우거나, 입력 중 로컬 draft 로 자동 저장한다.

### [구직자-탐색지원]


**`search-client-300-cap`** — 공고 검색 · PARTIAL · 빈도 자주 · 수정 M
- 증상: 아는 업체 이름이나 지점명으로 검색했는데 "검색 결과가 없습니다"가 뜬다. 실제로는 그 공고가 목록에 존재한다 — 검색이 최근 300건만 훑기 때문인데, 사용자에겐 "그런 공고 없음"으로 보인다.
- 근거: 검색은 서버 전문검색이 아니라 `getJobPostings(undefined, 300)`으로 300건을 받아와 메모리에서 substring 매칭한다 — `src/services/jobs/jobService.ts:186-193`, `src/services/jobs/searchService.ts:78-81`. 결과는 50건에서 잘리고(`home-jobs.tsx:187`) 목록은 `hasMore={false}`라 더 불러올 수도 없다(`home-jobs.tsx:315-316`).
- 제안: Postgres `ilike`/`tsvector` 서버 검색으로 옮겨 전체 공고를 대상으로 하고, 잘린 경우 "상위 50건만 표시 중 — 검색어를 좁혀보세요" 안내를 붙인다. 최소한 300건 상한에 걸렸을 때는 빈 결과 문구를 "최근 공고에서 찾지 못했어요"로 바꿔 사실과 맞춘다.
- 검증 보정: 코드 경로는 인용대로 확인: jobService.ts:186 `getJobPostings(undefined, 300)` 후 searchService.ts:79-81 메모리 substring 매칭, home-jobs.tsx:187 결과 50건 상한, :315-316 `hasMore={false}`. 그러나 (1) '최근 300건'이 아니라 work_date 내림차순(먼 미래 우선) 상위 300건이라 잘리는 쪽은 오히려 가까운 날짜 공고이고, (2) '결과가 없다고 뜨는데 실제 존재' 증상은 브라우즈 가시 공고(active+capacity_full)가 300건을 초과할 때만 발현하는데 현재 운영 규모에서 초과 여부는 미검증이다. 발현 조건부 결함이라 PARTIAL.

**`offline-list-always-empty`** — 공고 목록 둘러보기 · PARTIAL · 빈도 자주 · 수정 M
- 증상: 지하철·지하 홀덤펍처럼 신호가 약한 곳에서 앱을 열면 조금 전까지 보던 공고 목록이 통째로 사라지고 "공고 없음 / 등록된 공고가 없습니다"가 뜬다. 앱이 고장난 건지 공고가 없는 건지 알 수 없다.
- 근거: 오프라인 캐시는 `isDefaultFilter`(필터가 하나도 없을 때)에만 읽고 쓴다 — `src/hooks/useJobPostings.ts:34,69,85-92`. 그런데 홈 화면은 진입 시 항상 타입을 자동 선택해 `result.postingType`을 채우므로(`app/(app)/(tabs)/home-jobs.tsx:105-113,149-151`) `isDefaultFilter`가 참이 되는 순간이 없다. 결과적으로 이 화면에서 캐시는 한 번도 저장되지 않고, 오프라인이면 `enabled: enabled && isOnline`로 쿼리가 꺼져 빈 배열 → 빈 상태 문구가 뜬다(`JobList.tsx:98-109`).
- 제안: 캐시 키를 필터 해시 기준으로 바꿔 현재 보고 있던 목록을 저장/복원하고, 오프라인일 때는 빈 상태 대신 "오프라인이라 최근에 본 공고만 보여드려요" 배너 + 마지막 갱신 시각을 노출한다.
- 검증 보정: 메커니즘은 전부 확인: useJobPostings.ts:34 isDefaultFilter, :43 `enabled && isOnline`, :69/85-92 캐시 읽기·쓰기 모두 isDefaultFilter 게이트. home-jobs.tsx:105-113 이 진입 시 항상 postingType 을 자동 선택(없으면 'urgent' 강제)하므로 이 화면에서 isDefaultFilter 가 참이 되는 순간이 없다 — 캐시는 저장도 사용도 안 됨. TanStack Query 영속 persister 도 없음(persistQueryClient 계열 0건)이라 콜드스타트 오프라인이면 정말 빈 목록 + JobList.tsx:44 기본 문구 '등록된 공고가 없습니다'. 단, app/_layout.tsx:210 에 전역 OfflineStatusBar 가 마운트돼 '오프라인 상태입니다' 배너가 동시에 뜨므로 '앱이 고장난 건지 알 수 없다'는 과장 — 다만 목록 영역의 '공고 없음' 문구 자체는 여전히 오도한다.

**`apply-submit-disabled-no-reason`** — 공고 지원 (지원 폼) · CONFIRMED · 빈도 자주 · 수정 S
- 증상: 지원 폼 하단 "지원하기" 버튼이 회색이고 눌러도 아무 일이 없다. 날짜를 안 골라서인지, 필수 사전질문이 남아서인지, 동의 체크를 안 해서인지 화면 어디에도 안 나온다. 긴 폼을 위아래로 훑으며 스스로 찾아야 한다.
- 근거: `canSubmit`은 배정 선택·필수 사전질문·제공동의 3조건을 모두 요구하지만(`src/components/jobs/ApplicationForm.tsx:161-185`) 미충족 사유를 어디에도 표시하지 않는다. 버튼은 `disabled={!canSubmit}`이라 탭 자체가 먹히지 않고(`:246-250`), 미답변 질문을 붉게 표시하는 `setErrorQuestionIds` 경로는 `handleSubmit` 최상단 `if (!canSubmit) return;`(`:187-190`) 때문에 영원히 도달하지 못하는 죽은 코드다.
- 제안: 버튼을 활성 상태로 두고 탭 시 첫 번째 미충족 항목으로 스크롤 + 강조하거나, 버튼 바로 위에 "날짜·역할을 1개 이상 선택해 주세요" 같은 남은 조건 한 줄을 항상 띄운다.

**`bookmark-saved-nowhere-to-see`** — 공고 저장(북마크) · CONFIRMED · 빈도 자주 · 수정 M
- 증상: 공고 카드의 하트를 눌러 "북마크에 추가되었습니다" 토스트까지 받았는데, 저장한 공고를 다시 볼 수 있는 화면이 앱 어디에도 없다. 나중에 지원하려고 담아둔 공고를 목록에서 다시 찾아 헤매게 된다.
- 근거: `src/hooks/useBookmarks.ts:7`에 `@todo 북마크 목록 화면 구현 필요`가 그대로 남아 있고, 실제 소비처를 전수 검색하면 `src/components/jobs/JobCard.tsx:36`(토글) 한 곳뿐이다. `bookmarks`/`recentBookmarks`/`bookmarkCount`를 읽는 화면은 0개다.
- 제안: 프로필 탭에 "저장한 공고" 진입점을 만들어 `recentBookmarks`를 `JobList`로 렌더한다(기존 카드 컴포넌트 재사용). 그때까지는 하트 버튼을 숨기는 편이 사용자를 덜 속인다.

**`cancel-request-no-withdraw`** — 확정된 지원 취소 요청 · CONFIRMED · 빈도 가끔 · 수정 M
- 증상: 확정된 근무에 취소를 요청한 뒤 사정이 바뀌어 다시 나갈 수 있게 됐는데, 요청을 물릴 방법이 없다. 화면은 "결과를 기다려 주세요"만 반복하고, 구인자가 며칠 응답하지 않으면 구직자는 아무것도 할 수 없다.
- 근거: 취소 요청이 걸려 있으면 모든 취소/재요청 버튼이 사라진다 — `app/(app)/jobs/[id]/index.tsx:199-211`(`canRequestCancel`·`canCancelApplied` 둘 다 `!cancellationRequest` 조건). 안내 문구도 "취소 요청이 접수되어 검토 중이에요. 결과를 기다려 주세요."뿐이다(`src/utils/applicationStatusMessage.ts:38-42`). 레포 전체에서 구직자용 철회 액션은 검색되지 않는다(`철회` grep 결과는 회원탈퇴·문의 전용).
- 제안: `cancellation_pending` 상태에 "취소 요청 철회" 버튼을 추가하고(구인자가 아직 심사하지 않은 경우만 허용), 요청 시점과 함께 "구인자가 아직 확인하지 않았어요"를 보여준다.

**`no-all-types-view`** — 공고 목록 둘러보기 · CONFIRMED · 빈도 매번 · 수정 M
- 증상: 급구·대회·지원·고정 네 종류를 한 화면에서 같이 볼 수 없다. 오늘 일할 자리를 찾으려면 탭 네 개를 하나씩 돌아야 하고, 앱을 열 때마다 어떤 탭에 착지할지도 그날 데이터에 따라 달라져 "내가 어디를 보고 있는지"가 흔들린다.
- 근거: 칩 목록에 '전체'(value=null) 항목이 없고 재탭 해제도 없다 — `src/components/jobs/PostingTypeChips.tsx:36-41,109-117`. 진입 시 `firstAvailableType`(urgent→tournament→regular→fixed 우선순위 중 건수>0인 첫 타입)을 자동 선택하고, 없으면 'urgent'로 고정한다 — `app/(app)/(tabs)/home-jobs.tsx:105-113`, `src/hooks/usePostingTypeCounts.ts:25,150-158`.
- 제안: '전체' 칩을 맨 앞에 추가해 기본 선택으로 두고(카드에 타입 배지가 이미 있으므로 혼동 없음), 타입 칩은 좁히기 용도로만 쓴다.

**`date-filter-regular-only`** — 날짜로 공고 찾기 · CONFIRMED · 빈도 자주 · 수정 M
- 증상: "이번 주 토요일에 일할 자리"를 찾고 싶은데 달력은 '지원' 탭에서만 나온다. 급구·대회 탭에서는 날짜로 거를 수 없어 카드를 일일이 눈으로 훑어야 한다. 게다가 날짜를 고른 뒤 다른 탭을 눌렀다 돌아오면 골라둔 날짜가 지워져 있다.
- 근거: 달력은 `selectedType === 'regular'`일 때만 렌더된다 — `app/(app)/(tabs)/home-jobs.tsx:306-308`. 타입 변경 핸들러가 무조건 `setSelectedDate(null)`을 호출해 선택을 버린다 — `:235-238`. 필터 조립부도 `selectedType === 'regular'`일 때만 `workDate`를 넣는다(`:128-132`).
- 제안: 날짜 필터를 타입과 독립된 축(FilterBar의 네 번째 pill)으로 올려 모든 탭에 적용하고, 탭 전환 시 날짜 선택을 유지한다.

**`role-checkbox-tiny-target`** — 공고 지원 (날짜·역할 선택) · CONFIRMED · 빈도 매번 · 수정 S
- 증상: 지원 폼에서 날짜별 역할 체크박스가 너무 작고 서로 붙어 있어, 흔들리는 지하철이나 한 손 조작에서 옆 역할을 잘못 누르기 쉽다. 지원의 가장 중요한 선택인데 오탭이 잦다.
- 근거: `RoleCheckbox`는 20px 체크박스 + `text-sm` 텍스트로 이뤄진 한 줄 Pressable이고 `hitSlop`이 없다 — `src/components/jobs/AssignmentSelector/RoleCheckbox.tsx:20-41`(`className="mb-1 mr-3 flex-row items-center"`). 실질 높이가 22px 내외로 프로젝트 규칙(`impeccable-design` §5, WCAG 2.5.5의 44px)에 크게 못 미친다. 같은 폼의 다른 칩·필은 `min-h-[36px]`+hitSlop을 지키고 있어 이 컨트롤만 예외다.
- 제안: `min-h-[44px]`과 `hitSlop={{top:8,bottom:8}}`을 주고 역할 간 세로 간격을 gap-2 이상으로 벌린다.

**`detail-offline-says-not-found`** — 공고 상세 확인 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 알림이나 공유 링크로 공고를 열었는데 신호가 끊긴 상태면 "공고를 찾을 수 없습니다"가 뜬다. 사용자는 공고가 내려간 줄 알고 포기하지만 실제로는 그냥 네트워크 문제다.
- 근거: 오프라인이면 쿼리가 꺼지고(`enabled: enabled && !!jobId && isOnline` — `src/hooks/useJobDetail.ts:82`), 이전에 방문한 적이 없으면 캐시도 비어 `job=null`이 된다(`:146-147`). 동시에 `error`는 오프라인일 때 `null`로 눌러버려(`:163`) 상세 화면은 `error || !job` 분기로 떨어져 "공고를 찾을 수 없습니다"를 띄운다 — `app/(app)/jobs/[id]/index.tsx:126-134`.
- 제안: 오프라인 여부를 분기해 "오프라인이라 공고를 불러올 수 없어요. 연결되면 자동으로 다시 시도합니다"로 문구를 바꾸고, 재시도 버튼을 연결 복구 시 자동 실행으로 잇는다.

**`work-address-not-actionable`** — 공고 상세 확인 → 출근 준비 · CONFIRMED · 빈도 매번 · 수정 S
- 증상: 처음 가보는 홀덤펍 주소가 상세에 텍스트로만 적혀 있다. 길찾기를 하려면 주소를 눈으로 읽고 지도 앱에 손으로 다시 타이핑해야 한다(길게 눌러 복사도 안 된다). 새벽 근무 출근길에 매번 반복되는 노동이다.
- 근거: 근무지는 일반 `InfoRow`로만 렌더되고 터치 핸들러가 없다 — `src/components/jobs/JobDetail.tsx:157-165`. 반면 바로 아래 연락처는 `Pressable`로 감싸 `tel:` 링크가 걸려 있어(`:193-210`) 같은 화면 안에서 기준이 어긋난다.
- 제안: 근무지 행도 Pressable로 감싸 지도 앱 열기(`geo:`/카카오맵 스킴)와 "주소 복사"를 제공한다. 전화 행과 동일한 상호작용 언어를 쓰면 학습 비용이 0이다.

**`owner-rating-hidden-from-seeker`** — 공고 상세 확인 · CONFIRMED · 빈도 매번 · 수정 M
- 증상: 이 구인처가 믿을 만한 곳인지 판단할 근거가 구직자에게만 안 보인다. 구인처 섹션에 이름만 덩그러니 있고 평판 배지는 뜨지 않는데, 정작 같은 화면을 구인자·관리자가 열면 배지가 보인다.
- 근거: 구인처 프로필 조회가 `canReadOwnerProfile = isAdmin || isEmployer` 로 게이팅돼 있다 — `src/components/jobs/JobDetail.tsx:69,80-83`. 그래서 staff(구직자)는 `ownerProfile`이 항상 undefined가 되어 `BubbleScoreBadge` 렌더 조건(`:290-299`)을 만족하지 못한다.
- 제안: 평판 점수만 담은 공개 읽기 경로(RLS 허용 뷰 또는 공고 행에 비정규화)를 열어 구직자에게도 배지를 보여준다. 지원 여부를 가르는 신뢰 신호이므로 공고 카드에도 노출 가치가 있다.

**`waitlist-label-without-waitlist`** — 공고 지원 (마감된 자리 선택) · CONFIRMED · 빈도 가끔 · 수정 M
- 증상: 이미 찬 자리에 "마감 · 대기 지원 가능" 배지가 붙어 있어 대기 신청을 하면 순번이 잡히는 줄 알고 지원한다. 그런데 지원 후 어디에도 대기 상태·순번이 표시되지 않고, 자리가 비어도 자동으로 넘어오지 않는다.
- 근거: 체크박스는 마감 자리도 선택 가능하게 열어두고 '마감 · 대기 지원 가능' 배지를 붙인다 — `src/components/jobs/AssignmentSelector/RoleCheckbox.tsx:16-18,55-59`. 같은 파일 주석이 "자동 승계 기능은 없으므로"라고 명시한다(`:17`). 지원 후 상태 문구는 일반 지원과 동일한 "지원 완료 - 검토 중"뿐이라 대기 여부를 구분하지 않는다(`src/utils/applicationStatusMessage.ts:6-7`).
- 제안: 배지 문구를 "마감 — 예비 지원(자리가 나면 구인자가 검토)"처럼 실제 동작에 맞추고, 지원 후 상태에도 "예비" 표시를 남긴다. 자동 승계를 실제로 넣기 전까지는 기대를 낮춰 적는 편이 안전하다.

### [이음새·누락표면]


**`report-status-untrackable`** — 신고 접수 후 후속 확인 (실패 경로) · CRITIC · 빈도 드묾 · 수정 S
- 증상: 노쇼·임금체불·폭언을 신고하면 '관리자가 검토 후 처리됩니다'라는 안내만 받고 끝이다. 내가 낸 신고가 접수됐는지, 검토 중인지, 기각됐는지 볼 화면이 없다 — 서비스 함수와 쿼리키까지 만들어 놓고 화면만 안 붙였다.
- 근거: src/services/admin/reportService.ts:108 getMyReports 구현 존재 + src/lib/queryClient.ts:407 myReports 쿼리키 존재 — hooks/·app/ 소비처 0건(grep). 신고 목록 화면은 app/(admin)/reports/ 뿐이고, ReportModal.tsx:413-414 는 '관리자가 검토 후 처리됩니다'로 끝난다. 상태 라벨(report.ts:211-216 '검토 대기/검토 중/처리 완료/기각')도 관리자 화면만 소비.
- 제안: settings 또는 support 아래에 '내 신고 내역' 화면 1장을 추가해 getMyReports 를 소비 — 서비스·쿼리키·상태 라벨이 전부 준비돼 있어 순수 UI 작업이다. REPORT_RESOLVED 알림 착지도 이 화면으로 교체.

**`job-updated-notification-says-nothing`** — 지원·확정 후 공고 수정 통지 수신 (양쪽이 서로를 오해하는 지점) · CRITIC · 빈도 자주 — 공고 수정 시 매번 · 수정 S
- 증상: 사장이 급여·장소·일정을 고치면 지원자·확정자 전원에게 '공고가 수정되었습니다. 변경 내용을 확인하세요'만 온다. 뭐가 바뀌었는지는 알림에도, 착지한 공고 상세에도 없다 — 지원자는 공고 전체를 다시 읽으며 스스로 diff 를 떠야 하고, 급여가 바뀐 걸 못 알아채면 출근일에야 분쟁이 된다.
- 근거: supabase/migrations/20260727000000_posting_auto_close_gaps.sql:489-503 — body 는 고정 문구, 바뀐 필드 목록(v_changed_fields)은 data.changedFields 로만 싣는다. 수신자는 :505-517 에서 confirmed·applied·cancellation_pending 전원. 클라이언트에서 changedFields 를 렌더하는 코드는 src 전역 grep 0건 — 수집만 하고 아무도 안 보여준다.
- 제안: 트리거 body 에 바뀐 필드의 한글 라벨을 삽입('급여·근무 장소가 변경되었습니다')하거나, 최소한 NotificationItem 이 data.changedFields 를 칩으로 렌더하게 배선한다. 급여·일정 변경은 priority 를 high 로 승격.

**`applicant-reputation-invisible-to-employer`** — 지원자 검토·확정 판단 (평가 시스템 출력의 매칭 미배선) · CRITIC · 빈도 매번 — 지원자 확정 판단 때마다 · 수정 L
- 증상: 근무 후 양쪽 평가를 쓰라고 리마인더 크론까지 돌리면서, 정작 사장이 지원자를 고르는 화면에는 그 평가가 한 조각도 안 나온다. 평점·과거 근무 횟수·노쇼 이력 없이 전화번호와 자기소개만 보고 확정해야 한다 — 평가 데이터를 모으기만 하고 매칭 판단에는 쓰지 않는다(구직자 쪽 owner-rating 미노출과 대칭인 미커버 반쪽).
- 근거: 리뷰 수집 회로는 살아 있다(baseline_schema_from_prod.sql:2528 fn_send_review_reminders 크론, :5298 review_request 트리거). 그러나 src/components/employer/ 전역에 rating/평점 렌더 0건(grep), averageRating 은 src/types/admin.ts:66 관리자 타입뿐, src/hooks/useReviews.ts:43 은 본인 수신 평가 조회만이다. ApplicantProfileContent.tsx:95-118 '확정 이력'도 해당 지원 건의 확정/취소 타임스탬프뿐 교차 공고 이력이 아니다.
- 제안: 지원자 프로필에 '받은 평가 요약'(평균 별점·완료 근무 수·최근 평가 n건) 섹션을 추가 — 집계 뷰(RPC)와 RLS 설계가 필요하니 블라인드 상호공개 규칙(getReviewsWithBlindCheck)과 정합하게 설계 선행.

---

## P2 — LOW (거슬림)


### [구인자-공고]


**`close-jumps-filter-tab`** — 공고 마감 · CONFIRMED · 빈도 가끔 — 시즌 종료 후 일괄 정리 시 · 수정 S
- 증상: 모집중 목록에서 공고를 마감하면 화면이 자동으로 '마감' 탭으로 넘어간다. 여러 건을 연달아 정리할 때 매번 '모집중' 으로 되돌아와야 해서 탭 왕복이 반복된다.
- 근거: app/(app)/(tabs)/employer.tsx:284-291 `closeGate` 의 `onSuccess` 가 `await refetch()` 후 `setFilter('closed')` 를 호출한다. 재오픈도 대칭으로 306-313 에서 `setFilter('active')` 로 튄다.
- 제안: 필터를 바꾸지 말고 '마감했어요 · 마감 탭에서 보기' 액션 토스트로 이동을 선택지로 준다(Undo/이동 패턴은 이 코드베이스에 이미 있다).

**`prequestion-and-slot-delete-no-undo`** — 공고 작성 (사전질문·시간대) · PARTIAL · 빈도 가끔 · 수정 S
- 증상: 사전질문의 휴지통을 잘못 누르면 질문 내용과 선택지 5개가 확인도 되돌리기도 없이 즉시 사라진다. 시간대 카드의 '삭제' 도 마찬가지로 역할·인원까지 통째로 날린다. 같은 화면의 '일정 그룹 삭제' 는 되돌리기 토스트를 주는데 이 둘만 다르다.
- 근거: PreQuestionsSheet.tsx:85-93 의 삭제 Pressable 은 곧바로 `deleteQuestion(index)`(203-204) 를 부른다. SlotCard.tsx:104-115 의 '삭제' 도 `onRemove` 직행 → ScheduleSlotsSheet.tsx:109-117 `removeSlot`. 대조군: OrderSheetScreen.tsx:422-460 `handleDeleteGroup` 은 삭제 그룹을 깊은복사해 두고 5초 '되돌리기' 토스트를 띄운다.
- 제안: `handleDeleteGroup` 과 같은 스냅샷 + 5초 Undo 토스트 패턴을 사전질문·시간대 삭제에도 적용한다.
- 검증 보정: 코드 사실은 전부 확인 — PreQuestionsSheet.tsx:85-93 삭제 Pressable → deleteQuestion(203-204) 즉시, SlotCard.tsx:104-115 '삭제' → removeSlot(ScheduleSlotsSheet:109-117) 즉시, 대조군 handleDeleteGroup(OrderSheetScreen:422-460)만 5초 Undo. 그러나 결정적 차이가 빠졌다: 시트 내 삭제는 '확인'을 누르기 전까지 폼에 커밋되지 않는 작업본 조작이다 — 실수로 지웠으면 X/백드롭으로 시트를 닫아 커밋 전 값으로 복귀할 수 있다(그 시트에서 한 다른 편집도 함께 버려지는 대가는 있음). 반면 '일정 그룹 삭제'는 폼에 즉시 커밋되는 삭제라 Undo 가 필수였다 — 비대칭에는 구조적 이유가 있다. 시트 안에서 방금 새로 타이핑한 질문·역할의 삭제는 실제로 복구 불가이므로 마찰이 0은 아니다.

**`qr-cannot-save-or-share`** — 현장 QR 비치 · CONFIRMED · 빈도 가끔 — 공고당 1회지만 매 공고 · 수정 M
- 증상: 출퇴근 QR 화면에는 저장·공유·인쇄 버튼이 없어서 '스크린샷으로 저장해 현장에 비치하세요' 라는 안내만 있다. 현장 매니저에게 카톡으로 보내거나 A4로 뽑으려면 사장이 직접 스크린샷을 찍어 갤러리에서 다시 찾아 보내야 한다.
- 근거: app/(employer)/my-postings/[id]/qr.tsx:7-9 주석이 '저장/공유 버튼을 두지 않는다 — 네이티브 모듈이라 OTA 로 배포되지 않는다' 고 명시하고, 실제 화면(79-107)에는 QR 이미지와 안내 텍스트 두 줄만 있다. 웹 빌드에서도 동일 화면이 렌더된다.
- 제안: 최소한 웹에서는 브라우저 인쇄/다운로드 버튼을 노출하고, 네이티브는 다음 EAS 빌드 때 view-shot + 공유 시트를 얹는다. 그 전까지는 '공고 링크와 함께 매니저에게 보내기' 같은 텍스트 공유라도 제공한다.

### [구인자-인력관리]


**`unconfirm-without-reason`** — 확정 해제 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 확정 해제를 하면 스태프에게 알림은 가는데 사유를 적을 칸이 없다. 사장은 왜 뺐는지 설명할 방법이 없고, 스태프는 이유를 모른 채 전화로 물어보게 된다(거절할 때는 사유 입력칸이 있는데 해제만 없다).
- 근거: app/(employer)/my-postings/[id]/applicants.tsx:121-134 `handleCancelConfirmation` 은 confirmAction 다이얼로그(제목·메시지·확인 버튼)만 띄우고 `cancelConfirmationAsync({ applicationId: applicant.id })` 로 사유 없이 호출한다. 훅과 서비스는 사유를 받는다 — src/hooks/applicant/useStaffConversion.ts:64,68 `({ applicationId, reason }) => cancelConfirmation(applicationId, user.uid, reason, 'employer_initiates')`. 대조적으로 거절은 사유 입력 모달이 있다(ConfirmModal.tsx:80-85).
- 제안: 거절 모달을 재사용해 확정 해제에도 선택 사유 입력을 붙이고, 그 값을 이미 존재하는 reason 파라미터로 넘긴다.

**`staff-list-past-dates-all-collapsed`** — 확정 스태프 날짜별 확인 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 스태프 목록에서 지난 날짜 섹션이 전부 접혀 있고 '전체 펼치기'가 없다. 끝난 대회 7일치를 정산 전에 훑으려면 날짜 헤더를 하나씩 7번 눌러야 한다.
- 근거: src/components/employer/applicants/ConfirmedStaffList.tsx:132-143 초기 확장 집합은 `if (group.date >= today) initial.add(group.date)` 로 오늘 이후만 담고, 이 계산은 useState 지연 초기화라 이후 갱신되지 않는다. 179 `data: expandedDates.has(group.date) ? group.staff : []` 로 접힌 섹션은 행이 0개다. 전체 펼침/접기 컨트롤은 컴포넌트에 없다.
- 제안: 헤더에 '모두 펼치기/접기' 토글을 추가하거나, 필터 탭을 쓰는 순간에는 전 섹션을 자동으로 펼친다.

**`staff-card-delete-icon-unlabeled`** — 확정 스태프 제거 · CONFIRMED · 빈도 드묾 (스크린리더 사용자에겐 매번) · 수정 S
- 증상: 스태프 카드 오른쪽 끝 휴지통 버튼은 아이콘만 있고 텍스트도 라벨도 없다. 보이스오버를 쓰는 사용자에게는 정체불명의 버튼으로 읽히고, 그 버튼이 '확정 해제'라는 파괴적 동작이라 잘못 누를 위험이 크다.
- 근거: src/components/employer/applicants/ConfirmedStaffCard.tsx:290-297 의 Pressable 에는 accessibilityRole·accessibilityLabel 이 없고 자식은 `<TrashIcon size={14} .../>` 뿐이다. 같은 액션 행의 다른 버튼들은 텍스트를 동반한다(242-251 '시간 수정', 278-288 '신고'). 대조군으로 VenueSettingsSheet.tsx:257-267 의 삭제 아이콘은 accessibilityLabel 을 제대로 달고 있다.
- 제안: accessibilityRole="button" + accessibilityLabel={`${displayName} 확정 해제`} 를 추가하고, hitSlop 으로 터치 타깃을 44px 로 넓힌다.

**`assignment-checkbox-not-announced`** — 지원자 일정 선택 · CONFIRMED · 빈도 드묾 (스크린리더 사용자에겐 매번) · 수정 S
- 증상: 지원자 카드의 날짜 선택 항목이 스크린리더에서 체크박스로 읽히지 않는다. 선택했는지 안 했는지 음성으로 알 수 없어서, 확정 버튼이 왜 비활성인지 파악할 방법이 없다.
- 근거: src/components/employer/applicants/ApplicantCard/components/GroupedAssignmentSelector.tsx:156-159 단일 날짜 행 Pressable 과 213-216 그룹 헤더 Pressable 모두 accessibilityRole·accessibilityState(checked) 가 없다. 체크 표시는 순수 시각 요소다(161-174 의 View + CheckIcon). 같은 화면의 일괄 선택 체크박스는 제대로 돼 있어(ApplicantList.tsx:190-193 `accessibilityRole="checkbox"` + `accessibilityState={{checked}}`) 기준이 이미 존재한다.
- 제안: 두 Pressable 에 accessibilityRole="checkbox", accessibilityState={{ checked }}, accessibilityLabel(날짜+역할+시간)을 붙인다. 그룹 헤더는 'mixed' 상태도 함께 전달.

**`collaborator-empty-state-says-email`** — 공고 협업자 추가 · CONFIRMED · 빈도 가끔 (첫 협업자 추가 시) · 수정 S
- 증상: 협업자가 없을 때 안내문이 '위 검색창에서 이메일로 동료를 추가하면...' 이라고 말하는데, 실제 검색창은 닉네임만 받는다. 이메일을 넣으면 아무도 안 나와서 '이 사람 가입 안 했나 보다' 하고 잘못 결론 내린다.
- 근거: src/components/job-posting/CollaboratorList.tsx:52 `'위 검색창에서 이메일로 동료를 추가하면\n지원자 검토와 승인을 함께 진행할 수 있어요.'` 대 src/components/job-posting/CollaboratorSearch.tsx:111 placeholder `'닉네임으로 검색 (2자 이상)'`, 141 안내 `'닉네임 2자 이상 입력 후 검색을 눌러주세요'`.
- 제안: 문구를 '닉네임으로'로 고친다. 한 단어 수정.

**`missing-checkout-jump-one-at-a-time`** — 퇴근 미기록 정리 · CONFIRMED · 빈도 자주 (미기록이 쌓이는 지점) · 수정 M
- 증상: '퇴근 미기록 5건' 배너를 눌러도 가장 오래된 1건의 날짜로만 이동한다. 그 날을 고치고 나면 다시 근무표 위로 올라가 배너를 또 눌러야 하고, 배너가 지난달로 화면을 옮겨버려 원래 보던 달로 돌아오는 것도 수동이다.
- 근거: app/(employer)/work-schedule.tsx:161-167 `handleGoToMissingCheckout` 은 `missingCheckouts.earliestDate` 하나만 읽어 `setVisibleMonth`·`setSelectedDate` 를 옮긴다. 배너는 건수만 표시하고(253-269) 목록을 열지 않으며, 다음 건으로 넘어가는 컨트롤이나 원래 달 복귀 경로가 없다.
- 제안: 배너를 누르면 미기록 5건 목록 시트를 열어 한 자리에서 순차 처리하게 한다. 최소한 처리 후 '다음 미기록으로' 버튼을 남긴다.

### [구인자-정산운영]


**`csv-share-cancel-shows-error`** — 공고 정산 — CSV 내보내기 · CONFIRMED · 빈도 가끔 — 공유 시트를 열었다 닫을 때마다 · 수정 S
- 증상: CSV 내보내기를 눌렀다가 공유 시트에서 그냥 뒤로 나오면 '내보내기에 실패했어요' 빨간 토스트가 뜬다. 아무것도 실패하지 않았는데 실패했다고 하니 다시 눌러보게 된다.
- 근거: src/utils/settlement/settlementExport.ts:109-113 — 사용자가 공유를 취소하면 `result.action` 이 `dismissedAction` 이라 `{ success: false }` 를 반환하고 `reason` 은 undefined. SettlementList.tsx:206-211 은 `reason === 'empty'` 가 아니면서 `!result.success` 이면 무조건 `toast.error('내보내기에 실패했어요.')` 를 띄운다.
- 제안: `dismissedAction` 을 별도 reason('cancelled')으로 구분해 토스트를 띄우지 않는다.

**`venue-settlement-month-nav-friction`** — 지점 정산 — 기간 이동 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 월 이동이 '◀ 2026년 7월 ▶' 화살표뿐이라 반년 전 정산을 보려면 왼쪽 화살표를 여섯 번 눌러야 하고, 실수로 미래 달로 넘어가면(제한이 없어 2030년까지 간다) '이번 달로' 돌아오는 버튼이 없어 다시 화살표를 세며 돌아와야 한다.
- 근거: app/(employer)/venue-settlements.tsx:284-306 — 좌우 Pressable 두 개가 전부. shiftMonth(48-52)에 상·하한이 없고 월 라벨(294-296)은 텍스트라 탭할 수 없다.
- 제안: 월 라벨을 눌러 월 선택 시트를 열게 하고, 현재 달이 아니면 '이번 달' 복귀 버튼을 노출한다. 다음 달 화살표는 오늘이 속한 달을 넘지 않게 막는다.

**`settlement-badge-counts-unsettlable`** — 공고 정산 탭 진입 · PARTIAL · 빈도 자주 — 퇴근 미기록이 남은 공고마다 · 수정 S
- 증상: '정산 5' 배지를 보고 탭에 들어갔는데 실제로 지급 완료를 누를 수 있는 건 2건뿐이다. 나머지는 출퇴근이 안 끝나 정산 버튼이 아예 없다. 배지 숫자가 0이 될 때까지 처리하려고 해도 영영 0이 되지 않아, 뭔가 놓친 게 있나 계속 뒤지게 된다.
- 근거: app/(employer)/my-postings/[id]/settlements.tsx:189-191 — `pendingSettlementCount = workLogs.filter(log => log.payrollStatus !== COMPLETED).length` (출퇴근/ status 축 없음). 이 값이 TabHeader 배지(205-210)와 TodayOpsStrip(198-202)에 그대로 들어간다. 반면 실제 정산 가능 판정은 SettlementList.tsx:149-157 의 `isSettlableWorkLogStatus + checkInTime + checkOutTime` 이다.
- 제안: 배지를 '정산 가능 건수'로 바꾸고, 정산 불가 건은 '출퇴근 미완료 N건'으로 따로 보여준다(그룹 카드에는 이미 그 배지가 있다 — 상단 요약과 축을 맞춘다).
- 검증 보정: 축 불일치는 사실: settlements.tsx:189-191 `pendingSettlementCount = payrollStatus !== COMPLETED` 필터(출퇴근·status 축 없음)가 TabHeader 배지(205-210)와 TodayOpsStrip(198-202)에 그대로 들어가고, 실제 정산 가능 판정은 SettlementList.tsx:149-157의 isSettlableWorkLogStatus+checkInTime+checkOutTime이라 배지 수 > 즉시 처리 가능 수인 상황이 생긴다. TodayOpsStrip.tsx:16 주석도 '탭 배지와 동일 정의(payrollStatus !== completed)'를 명시한다. 그러나 '영영 0이 되지 않는다'는 과장: 미정산 건은 출퇴근이 끝나면 정산 가능해지고 전부 정산하면 0에 도달한다. '미정산 잔량' 배지로서는 정합한 설계 해석도 가능해, 실질 문제는 '지금 누를 수 있는 건수'와의 혼동에 그친다.

**`settlement-filter-no-date-axis`** — 공고 정산 — 특정 날짜 확인 · CONFIRMED · 빈도 가끔 — 여러 날에 걸친 대회 공고에서 · 수정 M
- 증상: 공고 정산 필터가 전체/미정산/완료 세 개뿐이라 '지난 주말 이틀치만 보고 싶다'가 안 된다. 스태프별로 묶여 있어 날짜로 보려면 사람마다 '날짜별 상세'를 펼쳐 눈으로 골라야 한다.
- 근거: src/components/employer/settlement/SettlementList.tsx:87-91 의 `FILTER_OPTIONS` 는 all/pending/completed 셋뿐. useSettlement.ts:418-422 에 `dateRange` 필터 로직이 존재하지만 화면에서 이를 호출하는 UI가 없다.
- 제안: 이미 있는 `filterWorkLogs({ dateRange })` 를 쓰는 날짜 칩(전체/이번 주/특정 날짜)을 필터탭 옆에 붙인다.

### [구직자-근무정산]


**`review-hub-opens-wrong-tab`** — 평가 작성 · PARTIAL · 빈도 매번 · 수정 S
- 증상: '작성할 평가가 3건 있어요' 배너나 평가 요청 푸시를 눌러 평가 허브에 들어가면 '받은 평가' 탭이 열린다. 미작성 목록을 보려면 탭을 한 번 더 눌러야 한다. 7일 지나면 자동으로 사라지는 화면인데 첫 착지가 엉뚱하다.
- 근거: app/(app)/reviews/history.tsx:34 는 useState 초기값으로 pendingCount>0 을 판정하는데, 첫 렌더에는 src/hooks/useReviews.ts:281(staffWorkLogs 기본 [])·380-385(isLoading) 때문에 pendingCount 가 항상 0 이다. 딥링크 쪽은 정반대를 의도한다 — src/services/observability/internal/deepLinkNavigationExecutor.ts:135-148 주석이 REVIEW_REQUEST/REMINDER 는 '허브 미작성 탭이 목적지'라고 못박고, NotificationRouteMap.ts:122-124 가 reviews/pending 으로 보내지만 app/(app)/reviews/pending.tsx:8 은 history 로 리다이렉트할 뿐이다.
- 제안: activeTab 을 파생값으로 바꾸거나(로딩 완료 후 pendingCount>0 이면 pending), 딥링크에 tab 파라미터를 실어 pending 탭으로 직행시킨다.
- 검증 보정: history.tsx:34 useState 초기값 판정, useReviews.ts:281(기본 [])·377-385 구조 실측 확인. 그러나 배너 경로 반박: '작성할 평가 N건' 배너(ReviewPromptBanner)는 schedule.tsx:230 에서 동일한 usePendingReviews 훅으로 렌더되므로, 배너가 보였다는 것 자체가 같은 queryKey 의 캐시가 채워졌다는 뜻 — history 마운트 첫 렌더에 TanStack Query 가 캐시를 동기 반환해 pendingCount>0 → 'pending' 탭으로 열린다. 틀리는 경로는 콜드 스타트 푸시/딥링크: NotificationRouteMap.ts:122-124 → reviews/pending → pending.tsx:8 이 탭 지정 없이 history 로 리다이렉트, 캐시가 비어 'received' 착지(deepLinkNavigationExecutor 138-152 주석의 의도와 어긋남). 이 부분은 사실.

**`offline-retry-does-nothing`** — 오프라인 스케줄 확인 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 오프라인 빈 상태에 뜨는 '다시 시도' 버튼과 당겨서 새로고침이 눌러도 아무 일도 일어나지 않는다. 스피너도 토스트도 없이 그냥 무반응이라, 지하 홀덤펍에서 근무를 확인하려던 사람은 앱이 멈춘 줄 안다. 정작 그 화면 주석은 '막다른 길을 만들지 않는다'고 적혀 있다.
- 근거: src/hooks/useSchedules.ts:392-395 refresh 는 !isOnline 이면 즉시 return 한다(useSchedulesByMonth). app/(app)/(tabs)/schedule.tsx:838-841 이 그 refresh 를 오프라인 EmptyState 의 actionLabel='다시 시도' 에 그대로 연결하고, 같은 refresh 가 PTR(schedule.tsx:1042)에도 물려 있다.
- 제안: 오프라인에서 refresh 호출 시 checkConnection() 을 한 번 태우고, 여전히 끊겨 있으면 '아직 연결이 없어요' 토스트로 눌린 사실을 되돌려준다.

**`notif-offline-says-empty`** — 알림 확인 · PARTIAL · 빈도 가끔 · 수정 S
- 증상: 오프라인이고 캐시가 없으면 알림 화면이 '알림이 없습니다 / 새로운 알림이 오면 이곳에 표시됩니다'라고 단언한다. 확정·취소 알림이 와 있어도 사용자는 '아무 소식 없다'고 믿게 된다. 스케줄 탭은 같은 상황을 '지금은 일정을 불러올 수 없어요'로 구분해 주는데 알림만 안 한다.
- 근거: src/hooks/useNotifications.ts:125 쿼리가 isOnline 일 때만 돌고, 228 isLoading 은 오프라인이면 무조건 false, 219-224 effectiveNotifications 는 빈 캐시를 그대로 반환한다. 그 결과 src/components/notifications/NotificationList.tsx:141-147 의 기본 EmptyState 가 뜬다. 대조군: app/(app)/(tabs)/schedule.tsx:827-841 은 isOfflineEmpty 를 따로 분기한다.
- 제안: 오프라인 + 캐시 0건이면 '지금은 알림을 불러올 수 없어요' 전용 빈 상태로 갈아끼운다.
- 검증 보정: useNotifications.ts:125(쿼리 isOnline 게이트)·228(오프라인 isLoading=false)·219-224(빈 캐시 그대로 반환) 및 NotificationList.tsx:141-147 기본 EmptyState('알림이 없습니다') 모두 실측 확인. 스케줄 탭의 isOfflineEmpty 분기(schedule.tsx:827-841)와의 비일관도 사실. 반박: app/_layout.tsx:210 의 전역 OfflineStatusBar 가 오프라인 동안 상시 배너를 띄우므로 '아무 소식 없다고 믿게 된다'는 단정은 과장 — 사용자는 오프라인임을 화면 상단에서 보고 있다.

**`qr-error-hint-obsolete`** — QR 스캔 실패 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 스캔 실패 화면이 '다시 스캔하거나 새 QR 코드를 요청하세요'라고 안내한다. 그런데 QR은 공고당 고정이라 '새 QR'이라는 게 존재하지 않는다. 사용자는 현장 담당자에게 없는 것을 달라고 하게 되고, 실제로 필요한 행동(배정 확인·시간 정정)은 끝내 안내받지 못한다.
- 근거: src/components/qr/QRCodeScanner.tsx:306-310 이 isRetryable 일 때 그 문구를 띄운다. 그러나 src/services/work/eventQRService.ts:5-8, 223-228 은 '회전 QR 제거, 공고당 고정 QR 단일 경로 … QR 은 바뀌지 않으므로 생성·만료·갱신 개념이 없다'고 명시한다.
- 제안: 문구를 실패 사유별로 갈라 쓴다 — 형식 오류는 'UNIQN 출근 QR인지 확인해 주세요', 배정 없음은 '구인자에게 배정 여부를 확인해 주세요' + 전화 CTA.

**`group-read-fanout-toasts`** — 알림 그룹 읽음 처리 · CONFIRMED · 빈도 가끔 · 수정 S
- 증상: 묶인 알림 그룹을 '읽음' 처리하면 내부적으로 한 건씩 따로 요청이 나간다. 네트워크가 흔들리면 '알림 읽음 처리에 실패했습니다' 토스트가 건수만큼 연달아 쌓여 화면을 덮는다.
- 근거: src/hooks/useNotifications.ts:713-721 markGroupAsRead 가 unreadIds.forEach 로 markAsRead 를 개별 mutate 한다. 각 실패는 useMarkAsRead 의 onError(같은 파일 268-274)에서 개별 토스트를 띄우고, 성공마다 266 에서 전체 쿼리를 무효화한다.
- 제안: 그룹 읽음은 일괄 RPC 한 번으로 처리하거나, 실패 토스트를 '알림 N건 읽음 처리 실패' 한 건으로 합친다.

**`qr-roundtrip-sheet-lost`** — 출근 직후 확인 · CONFIRMED · 빈도 매번 · 수정 M
- 증상: 근무 상세에서 QR 버튼을 누르면 시트가 닫히고 스캐너로 넘어가는데, 스캔이 끝나면 시트가 다시 열리지 않는다. 방금 찍힌 출근 시각을 확인하려면 캘린더에서 그 근무를 다시 찾아 열고 근무 탭까지 들어가야 한다.
- 근거: app/(app)/(tabs)/schedule.tsx:779-788 handleQRScan 이 handleCloseDetailSheet() 후 /(app)/scan 으로 push 하고, app/(app)/scan.tsx:34-49 의 성공 콜백은 goBack() 만 한다 — 시트 재오픈 로직이 없다. ScheduleDetailModal.tsx:181-188 주석도 '시트를 닫았다 다시 여는 왕복'을 전제로 탭 리셋만 막아둔 상태다.
- 제안: 스캔 성공 결과(workLogId)를 가지고 돌아와 해당 근무의 상세 시트를 근무 탭으로 자동 재오픈한다.

**`inquiry-attach-fail-deletes-all`** — 1:1 문의 접수 · PARTIAL · 빈도 가끔 · 수정 M
- 증상: 이미지 첨부가 하나라도 업로드에 실패하면 이미 접수된 문의를 서버에서 통째로 지운다. 사용자 입장에서는 '문의가 접수되었다'는 신호를 못 받은 채 처음부터 다시 제출해야 하고, 롤백까지 실패하면 본인은 모르는 유령 문의가 남는다.
- 근거: app/(app)/support/create-inquiry.tsx:60-83 — attachFilesAsync 실패 시 deleteInquiryAsync(inquiryId) 로 전체 롤백하고 에러 토스트만 띄운다. 롤백 실패 경로(72-77)는 로깅만 하고 사용자에게 아무 것도 알리지 않는다.
- 제안: 본문은 살리고 첨부만 재시도할 수 있게 한다 — '문의는 접수됐어요. 사진만 다시 올려볼까요?' + 재시도 버튼을 문의 상세에 붙인다.
- 검증 보정: create-inquiry.tsx:55-83 실측 — 첨부 실패 시 deleteInquiryAsync 전체 롤백, 롤백 실패는 로깅만(70-77) 하는 것 사실. 그러나 두 가지 반박: ① 78-82행에서 에러 토스트('이미지 업로드에 실패했어요… 다시 시도해주세요')를 띄우고 화면 이동 없이 폼 상태를 유지해 재시도 가능 — '신호를 못 받은 채 처음부터 다시 제출'은 과장(입력 보존됨). ② 롤백 실패로 남는 문의는 본인의 문의 목록(support/inquiry)에서 조회되므로 '본인은 모르는 유령'은 부정확 — 다만 개별 고지가 없는 것은 사실이고, 재시도 시 중복 문의가 생길 수 있는 것도 사실.

### [구직자-진입]


**`biometric-switch-disabled-silent`** — 설정 — 생체 인증 · CONFIRMED · 빈도 자동 로그인 꺼둔 사용자 · 수정 S
- 증상: 설정에서 Face ID 스위치가 회색으로 죽어 있는데 왜 그런지 아무 설명이 없다. 눌러도 반응이 없다(안내 토스트는 스위치가 비활성이라 뜨지 않는다). 실제 원인은 바로 위의 '자동 로그인'이 꺼져 있는 것인데 두 항목이 연결돼 있다는 표시가 없다.
- 근거: app/(app)/settings/index.tsx:182-184 — Switch 의 disabled 에 !autoLoginEnabled 가 들어가 onValueChange 자체가 호출되지 않는다. 사유를 알려주는 토스트는 src/hooks/useBiometricAuth.ts:185-189 의 setEnabled 안에 있어 도달하지 못한다.
- 제안: 비활성 상태일 때 스위치 아래에 "자동 로그인을 켜야 사용할 수 있어요" 보조 문구를 상시 노출하거나, 탭하면 자동 로그인을 함께 켤지 물어본다.

**`forgot-password-blind-success`** — 비밀번호 찾기 · PARTIAL · 빈도 비밀번호 찾기 사용자마다 · 수정 S
- 증상: 이메일을 잘못 적었거나 그 주소로 가입한 적이 없어도 화면은 똑같이 "이메일이 발송되었습니다"라고 한다. 메일이 안 와도 스팸함을 보라는 말도, 몇 분 걸린다는 말도, 미가입일 수 있다는 힌트도 없어 계속 기다리게 된다. 재발송 제한 안내도 없다.
- 근거: src/components/auth/ForgotPasswordForm.tsx:54-58, :61-75 — onSubmit 성공만 하면 무조건 성공 화면으로 전환하며 안내는 "이메일을 확인해주세요"뿐이다. 서비스는 src/services/auth/authCoreService.ts:472-479 의 supabase.auth.resetPasswordForEmail 로, 계정 존재 여부와 무관하게 성공을 반환한다.
- 제안: 성공 화면에 "메일이 안 오면 스팸함을 확인하고, 이 주소로 가입한 적이 없을 수도 있어요" + 예상 소요 시간 + 재발송 쿨다운 타이머를 추가한다.
- 검증 보정: ForgotPasswordForm.tsx:54-58·61-92 확인 — 성공 시 무조건 '이메일이 발송되었습니다' 화면 전환, 스팸함·소요시간·미가입 가능성 안내 없음(사실). 계정 존재와 무관한 성공 반환도 authCoreService.ts:472-479 resetPasswordForEmail 로 확인 — 단 이것은 이메일 열거 방지를 위한 업계 표준 보안 관행이라 '미가입 힌트 부재' 자체는 결함이 아니라 의도적 트레이드오프다. 또 '재발송 제한 안내도 없다'는 부정확 — authCoreService.ts:455-462 toResetPasswordError 가 레이트리밋 시 '메일은 이미 보냈어요. N초 후에 다시 요청할 수 있어요'를 사용자 문구로 변환해 토스트로 노출한다. 남는 실질 갭은 스팸함/지연 안내 부재뿐.

**`forgot-password-back-dead`** — 비밀번호 찾기 · CONFIRMED · 빈도 딥링크·웹 직접 진입 시 · 수정 S
- 증상: 메일 링크나 주소창으로 비밀번호 찾기 화면에 바로 들어오면 좌측 상단 뒤로가기가 아무 반응도 하지 않는다. 로그인으로 가려면 화면 아래쪽 작은 '로그인' 링크를 찾아야 한다.
- 근거: app/(auth)/forgot-password.tsx:46-48 — handleBack 이 router.back() 만 호출한다. 같은 상황을 처리한 app/(auth)/signup.tsx:287-295 는 router.canGoBack() 이 false 면 로그인으로 replace 하는 폴백을 두고, 주석에 '버튼이 죽은 것처럼 보임'이라고 명시돼 있다.
- 제안: signup.tsx 와 동일하게 canGoBack() 폴백으로 /(auth)/login 으로 replace 한다.

**`third-party-consent-unviewable`** — 가입 후 약관 재확인 · PARTIAL · 빈도 확인하려는 사람마다 · 수정 S
- 증상: 가입할 때 [필수]로 동의한 '개인정보 제3자 제공 동의' 전문을 나중에 다시 볼 방법이 없다. 설정의 정보 카드에는 이용약관·개인정보처리방침만 있고, '내 정보' 동의 내역에도 제3자 항목이 빠져 있어 내가 무엇에 동의했는지 확인할 수 없다.
- 근거: app/(app)/settings/index.tsx:247-263 은 terms·privacy·business-info 만 링크한다(제3자·마케팅 문서 라우트 없음). app/(app)/settings/my-data.tsx:180-182 의 동의 정보는 termsAgreed·privacyAgreed·marketingAgreed 3개뿐이고 thirdPartyAgreed 가 없다. THIRD_PARTY_CONSENT 는 가입 화면(src/components/auth/signup/SignupStepTerms.tsx:74)에서만 소비된다.
- 제안: 설정 > 정보에 '제3자 제공 동의'·'마케팅 수신 동의' 문서 화면을 추가하고, 내 정보 동의 내역에 thirdPartyAgreed 행을 넣는다.
- 검증 보정: 사실관계는 확인됨: settings/index.tsx:246-263 정보 카드는 이용약관·개인정보처리방침·사업자정보만 링크(설정 라우트 Glob 결과에도 제3자 문서 화면 없음), my-data.tsx:180-182 동의 정보는 terms/privacy/marketing 3개뿐, THIRD_PARTY_CONSENT 전문은 가입 SignupStepTerms 와 지원 시 버전 태그 기록에서만 소비. 그러나 '내가 무엇에 동의했는지 확인할 수 없다'는 과장 — 설정에서 열람 가능한 개인정보처리방침 제4조(privacyPolicy.ts:50-75)가 제공받는 자·제공 항목·목적·보유기간·별도 동의 방식까지 동의 전문의 실질 내용을 그대로 담고 있다. 남는 갭은 동의 '전문 원문' 재열람 경로와 my-data 의 동의 여부 표시 누락.

**`all-agree-includes-marketing`** — 회원가입 약관 동의 · PARTIAL · 빈도 전체 동의를 누르는 대다수 · 수정 S
- 증상: '전체 동의하기'를 누르면 [선택]인 마케팅 정보 수신까지 함께 켜진다. 빨리 넘어가려고 누른 사람은 광고 수신에 동의한 줄 모르고, 해제하려면 나중에 설정 > 알림까지 들어가야 한다.
- 근거: src/components/auth/signup/SignupStepTerms.tsx:170-176 — handleAllAgree 가 marketingAgreed 까지 동일 값으로 setValue 한다. 해제 경로는 app/(app)/settings/notifications.tsx:220-241 의 별도 화면뿐이다.
- 제안: '전체 동의'는 필수 3종만 켜고 마케팅은 별도 체크로 남기거나, 최소한 전체 동의 라벨에 '(마케팅 수신 포함)'을 병기한다.
- 검증 보정: SignupStepTerms.tsx:170-176 handleAllAgree 가 marketingAgreed 까지 동일 값으로 setValue 하는 것은 사실. 그러나 (1) 같은 화면에 '[선택] 마케팅 정보 수신 동의' 체크박스가 개별 표시되고 전체 동의 후에도 그 자리에서 개별 해제 가능(:239-258 Controller 개별 토글)하므로 '해제하려면 설정>알림까지 가야 한다'는 부정확 — 가입 완료 후에만 해당. (2) 전체 동의가 선택 항목을 포함하는 것은 국내 서비스 보편 관행이고 [선택] 라벨이 명시돼 있다. 몰래 동의로 서술한 심각도는 과대.

**`splash-silent-retry`** — 앱 실행 직후 · PARTIAL · 빈도 네트워크 불안정할 때 · 수정 S
- 증상: 지하철처럼 연결이 나쁜 곳에서 앱을 켜면 로고와 스피너만 몇 초째 돌아간다. 네트워크가 문제인지, 앱이 멈춘 건지, 다시 시도할 수 있는지 아무 말이 없어 사용자는 앱을 강제 종료하게 된다.
- 근거: app/index.tsx:31-33(MAX_PROFILE_RETRIES=5), :90-98(500ms 간격 무통보 재시도), :117-135(화면은 로고·타이틀·ActivityIndicator 뿐 — 상태 문구나 재시도 버튼 없음).
- 제안: 2초 이상 지연되면 "연결이 느려요. 네트워크를 확인해주세요" 문구와 '다시 시도' 버튼을 스플래시에 노출한다.
- 검증 보정: 인용 자체는 정확: app/index.tsx:30-32 MAX_PROFILE_RETRIES=5·500ms, :90-97 무통보 재시도, :117-139 로고+스피너뿐(상태 문구·재시도 버튼 없음). 그러나 세 가지 완화 장치가 이미 있다. (1) 재시도는 5회 상한 후 :98-103 에서 로그인/진입 라우트로 이탈하므로 무한 스피너가 아니다. (2) 루트 _layout.tsx:210 의 전역 OfflineStatusBar 가 스플래시 위에도 렌더되어 완전 오프라인이면 '오프라인' 배너가 뜬다. (3) 앱 초기화 실패는 _layout.tsx:222-228 ErrorState + 재시도 버튼으로 처리된다. 남는 갭 = '연결은 있으나 불량'일 때 안내 부재와, 재시도 소진 시 아무 설명 없이 로그인 화면으로 이탈하는 것.

**`photo-permission-no-settings-link`** — 프로필 사진 등록 · CONFIRMED · 빈도 권한 거부한 사용자 · 수정 S
- 증상: 사진 접근 권한을 한 번 거부하면 이후 사진 변경을 눌러도 "사진 접근 권한이 필요합니다" 토스트만 뜨고 끝난다. OS 설정에서 어떻게 켜는지 안내도, 설정으로 가는 버튼도 없어 사진을 영영 못 올린다.
- 근거: src/components/profile/ProfileImagePicker.tsx:65-69 — status !== 'granted' 이면 addToast 후 return 한다. 같은 상황에서 설정을 열어주는 패턴이 app/(app)/settings/notifications.tsx:66-72(Linking.openSettings)에 이미 있는데 여기엔 연결돼 있지 않다.
- 제안: 권한 거부 시 '설정 열기' 액션이 있는 안내(다이얼로그 또는 액션 토스트)로 바꾼다.

**`profile-region-freetext`** — 프로필 지역 입력 · CONFIRMED · 빈도 프로필 작성·수정 시마다 · 수정 M
- 증상: 활동 지역을 '예: 서울 강남구' 형태로 매번 손으로 타이핑해야 한다. 자동완성·선택지가 없어 '서울 강남'·'강남구'처럼 제각각 적히고, 나중에 수정할 때도 같은 타이핑을 반복한다.
- 근거: src/components/auth/signup/SignupStepProfile.tsx:280-298 과 app/(app)/settings/profile.tsx:377-398 모두 region 을 maxLength 50 자유 텍스트 Input 으로 받는다(선택 UI·검색 연동 없음).
- 제안: 시/도 + 시군구 선택 UI 또는 이미 도입된 주소 검색 컴포넌트를 재사용해 선택식으로 바꾼다.

**`profile-setup-no-photo-guidance`** — 가입 마지막 — 프로필 설정 · CONFIRMED · 빈도 신규 가입자 전원 · 수정 M
- 증상: 가입 마지막 단계에서 닉네임·지역·경력만 묻고 프로필 사진은 아예 언급되지 않는다. 구인자가 지원자를 볼 때 먼저 보는 것이 사진인데, 사진 없는 상태로 지원을 시작하게 되고 사진을 넣으려면 프로필 탭 → 프로필 수정까지 따로 찾아 들어가야 한다.
- 근거: src/components/auth/signup/SignupStepProfile.tsx 전체에 이미지 관련 필드가 없다(닉네임·성별·지역·경력·이력·기타). ProfileImagePicker 는 app/(app)/settings/profile.tsx:237-243 에서만 렌더된다.
- 제안: 프로필 설정 화면 상단에 사진 등록(건너뛰기 가능)을 넣거나, 최소한 "사진을 등록하면 채용 확률이 올라가요" 안내와 바로가기를 둔다.

### [구직자-탐색지원]


**`role-filter-drops-custom-roles`** — 역할 필터 적용 · PARTIAL · 빈도 자주 · 수정 S
- 증상: '딜러'로 역할 필터를 걸면 커스텀 역할명으로 올라온 공고가 통째로 사라진다. 사용자는 그런 공고가 원래 없는 줄 알고, 필터를 풀어야 다시 보인다는 사실을 알 방법이 없다.
- 근거: `FILTERABLE_STAFF_ROLES`에서 'other'가 제외돼 `role_keys` overlaps 매칭이 불가하다 — `src/components/jobs/filters/RoleFilterSheet.tsx:4-6,34-37`. 그런데 시트 안내문은 "선택하지 않으면 모든 역할의 공고를 보여드려요"뿐이고 제외 고지가 없다(`:136-142`). 같은 화면의 급여 필터는 "급여 협의 공고는 제외돼요"를 명시하고 있어(`SalaryFilterSheet.tsx:198-203`) 기준이 어긋난다.
- 제안: 급여 필터와 같은 위치에 "직접 입력한 역할(기타) 공고는 제외돼요" 한 줄을 추가하고, 가능하면 `other:` 접두 매칭을 지원해 '기타' 옵션 자체를 필터에 넣는다.
- 검증 보정: RoleFilterSheet.tsx:5(주석)·:35-37 에서 FILTERABLE_STAFF_ROLES 가 'other' 를 제외함을 확인, JobPostingRepository.ts:230-238 applyRoleScope 는 `overlaps('role_keys', roles)` 다. 따라서 '통째로 사라지는' 것은 역할이 전부 커스텀(`other:자유텍스트` 키)으로만 구성된 공고뿐이고, 표준 역할이 하나라도 섞인 공고는 overlaps 로 계속 매칭된다 — 증상이 과장됐다. 고지 부재는 사실: 시트 안내는 '선택하지 않으면 모든 역할의 공고를 보여드려요'(:139-141)뿐이고, SalaryFilterSheet.tsx:198-203 은 '급여 협의 공고는 제외돼요'를 명시해 기준 불일치도 확인된다.

### [이음새·누락표면]


**`employer-onboarding-asymmetric`** — 구인자 승인 직후 첫 공고 작성 (첫 사용자 경험) · CRITIC · 빈도 드묾 — 구인자당 1회지만 이탈 결정 시점 · 수정 M
- 증상: 구직자에게는 홈 진입 튜토리얼(appIntro)과 QR 출퇴근 튜토리얼이 있는데, 구인자로 승인된 직후에는 아무 안내가 없다. 공고 작성 주문서·지원자 관리·근무표·정산으로 이어지는 훨씬 복잡한 여정을 '등록된 공고가 없습니다. 새 공고를 작성해 보세요' 한 줄로 시작해야 한다.
- 근거: useTutorial 소비처는 app/(app)/(tabs)/home-jobs.tsx:57(appIntro)과 app/(app)/scan.tsx:31(qrCheckIn) 2곳뿐 — 전부 구직자 표면(전역 grep). 구인자 탭 빈 상태는 employer.tsx:469-472 문구가 전부. schedule.tsx:1192 에는 '{/* 스태프 정산 튜토리얼 */}' 고아 주석만 남아 튜토리얼 확장이 중단된 흔적이 있다.
- 제안: 기존 TutorialOverlay 인프라를 재사용해 employer 탭 최초 진입 시 3~4장짜리 employerIntro(공고 작성→지원자 확정→QR 출퇴근→정산 흐름)를 추가한다. 오버레이가 부담이면 빈 상태를 단계형 체크리스트(공고 작성/지점 등록/팀 초대)로 교체.

**`report-evidence-not-attachable`** — 신고 작성 — 증빙 첨부 (분쟁 실패 경로) · CRITIC · 빈도 드묾 · 수정 M
- 증상: 노쇼·임금체불·폭언처럼 심각도 critical 인 신고를 텍스트 설명만으로 내야 한다. 타입에는 증거 자료 URL 필드가 있지만 신고 모달에는 사진·스크린샷을 붙일 입력이 없어, 관리자는 진술 대 진술만 놓고 판정하게 된다.
- 근거: src/types/report.ts:281-282 evidenceUrls 필드와 CreateReportInput(:319)에 정의돼 있으나, ReportModal.tsx 전체(입력 영역 388-403)는 유형 선택 + 텍스트 설명뿐 — 첨부 UI·업로드 경로가 없어 evidenceUrls 를 채우는 코드가 존재하지 않는다.
- 제안: ReportModal 에 이미지 첨부(최대 3장, 기존 프로필 이미지 업로드 파이프라인 재사용)를 추가해 evidenceUrls 를 실제로 채운다. 최소안으로는 '증빙은 1:1 문의로 보내주세요' 안내라도 연결.

**`quiet-hours-schema-only`** — 알림 수신 시간대 제어 (새벽 근무 생활 패턴 배려) · CRITIC · 빈도 가끔 — 심야·주간 수면 시간대마다 · 수정 M
- 증상: 새벽 근무 후 낮에 자는 홀덤펍 스태프·사장에게 방해금지 시간 설정이 없다. 알림을 줄이려면 카테고리를 통째로 꺼야 해서 확정·정산 같은 중요 알림까지 같이 잃는 전부-아니면-전무 구조다. 스키마와 기본값(22:00~08:00)까지 만들어 놓고 UI 노출도, 발송 측 존중도 없다.
- 근거: src/types/notification.ts:368-373 quietHours 스키마 + createDefaultNotificationSettings(:547-551) 기본값 존재. 그러나 설정 화면 app/(app)/settings/notifications.tsx 전체(144-241)는 푸시 마스터·카테고리·마케팅 토글뿐 quietHours UI 없음, supabase/functions/ (발송 EF) grep quietHours 0건 — 저장돼도 아무도 안 읽는다.
- 제안: 설정 화면에 방해금지 시간 토글+시간대 입력을 노출하고 send-push-notification EF 가 발송 시각과 대조해 non-urgent 푸시를 보류(인앱 목록에는 그대로 적재)하게 한다. urgent(출근 리마인더·노쇼)는 예외로 관통.

---

## 축별 커버리지


**구직자-진입**: 실제로 읽은 파일: app/(auth)/{login,signup,forgot-password,reset-password,_layout}.tsx, app/index.tsx, app/(app)/_layout.tsx, app/(app)/profile-setup.tsx, app/(app)/settings/{index,profile,my-data,change-password,delete-account,notifications,terms,privacy}.tsx, app/(app)/(tabs)/profile.tsx(진입점 구간)·(tabs)/_layout.tsx(탭 라벨), src/components/auth/{LoginForm,ForgotPasswordForm,SocialLoginButtons,DeletionScheduledModal,PortOneIdentityVerification,PortOneIdentityVerification.web}.tsx, src/components/auth/signup/{SignupForm,SignupStepTerms,SignupStepIdentity,SignupStepAccount,SignupStepProfile,termsContent}.ts(x), src/components/onboarding/NotificationPermissionScreen.tsx, src/components/profile/ProfileImagePicker.tsx(권한 구간), src/components/settings/DangerZone.tsx, src/components/headers/StackHeader.tsx, src/components/navigation/HeaderBackButton.tsx, src/components/ui/{Input,SheetModal(웹 경로 일부)}.tsx, src/hooks/{useAuthGuard,useAutoLogin,useBiometricAuth,useOnboarding}.ts, src/services/auth/{authCoreService(login·signUp·resetPassword 구간),loginAttemptService,signupDraftService,accountDeletionService(요청 구간)}.ts, src/shared/navigation/authRedirect.ts, src/utils/confirmAction.ts, src/constants/legal/index.ts.

못 본 영역: ① 실제 렌더·실기기 관찰 없음(코드 정적 판독만) — 키보드 가림·다크모드 대비·터치 타깃 실측은 검증하지 못했다. ② PortOne 웹 경로 후반부(startVerification 이후)와 소셜(Apple) 로그인 실패 코드별 문구 매핑. ③ src/components/tutorial/* (홈·QR 화면 소속이라 이 축 밖). ④ useNotificationHandler·pushNotificationService 내부(권한 요청 타이밍은 (app)/_layout 배선까지만 확인). ⑤ e2e/ 디렉터리와 __tests__ 는 사용성 판단 근거로 쓰지 않았다. ⑥ settings/business-info·employer-terms·liability-waiver 화면 본문.

**구직자-탐색지원**: 실제로 Read 한 파일 — 라우트: app/(app)/(tabs)/home-jobs.tsx, app/(public)/jobs/index.tsx, app/jobs/index.tsx, app/jobs/[id].tsx, app/jobs/_layout.tsx, app/(app)/jobs/[id]/index.tsx, app/(app)/jobs/[id]/apply.tsx, app/(app)/applications/[id]/cancel.tsx, app/_layout.tsx(일부), app/(public)/_layout.tsx, app/index.tsx(일부), app/(app)/_layout.tsx(일부), app/(app)/(tabs)/schedule.tsx(취소 시트 배선부만 grep+부분 Read). 컴포넌트: jobs/{JobCard, JobList, JobDetail, ApplicationForm, PreQuestionForm, SearchBar, PostingTypeChips}, jobs/shared/{PostingCardSurface, PostingScheduleContent, PostingCompensationContent, PostingSurfaceState, postingSurfaceModel(부분)}, jobs/filters/{FilterBar, RegionFilterSheet, RoleFilterSheet, SalaryFilterSheet}, jobs/AssignmentSelector/{AssignmentSelector, DateSelection, RoleCheckbox}, jobs/DateCalendar/DateCalendar, applications/CancellationRequestForm, ui/{SheetModal, ErrorState(부분)}, headers/StackHeader. 훅: useJobPostings, useJobDetail, useApplications, useBookmarks, useSubmitGate, usePostingFilledCounts, useRegularDateCounts, usePostingTypeCounts, useInstallPrompt, internal/sessionUserId. 서비스·레포: jobs/jobService(검색부), jobs/searchService, jobs/applicationService(apply/requestCancellation), repositories/supabase/JobPostingRepository(getList·정렬·브라우즈 필터), utils/{jobPostingSorter, applicationStatusMessage}, domains/job-posting/{core(위치 라벨), projections}.

못 본 영역 — ① 실기기/웹 실렌더 관찰 없음(정적 코드만): 다크모드 대비·키보드 가림·터치 타깃은 코드 수치로만 판정했다. ② DateCalendar 하위(CalendarGrid/Cell/Header) 및 RegionTaxonomyBrowser 내부 상호작용 미독. ③ AssignmentSelector의 DateGroupSelection(그룹 날짜 범위 선택) 미독 — 다일 공고의 일괄 선택 마찰은 검증하지 못했다. ④ 알림 수신 후 착지 동선(useNotificationHandler)·딥링크 경로는 다른 축으로 남겨뒀다. ⑤ RLS/서버 측 지원 거부 사유(applyWithTransaction 내부 예외 → 사용자 문구 매핑)는 에러 레지스트리까지 따라가지 않았다. ⑥ e2e/ 디렉터리 미확인.

기각한 후보(코드 확인 결과 이미 처리돼 있었음) — ⓐ \"지원 폼 이탈 시 입력 소실\": SheetModal이 화면을 덮고 X·안드로이드 백 모두 `onRequestClose`→confirmAction 경유라 확인 다이얼로그가 있다(ApplicationForm.tsx:224-244). ⓑ \"대타 구인 글 생성 실패를 사용자에게 안 알림\": schedule.tsx:524-534에서 `substitutePost==='failed'` 시 경고 토스트를 띄운다. ⓒ \"지원 후 상태 확인 경로 없음\": schedule 탭에 `applied` 상태 필터가 존재한다(schedule.tsx:299). ⓓ \"필터 걸린 빈 목록에 다음 행동 없음\": `emptyActionLabel='필터 초기화'`가 배선돼 있다(home-jobs.tsx:340-346).

**구직자-근무정산**: 실제로 읽은 파일: app/(app)/(tabs)/schedule.tsx, app/(app)/scan.tsx, app/(app)/notifications.tsx, app/(app)/reviews/{write,history,pending,[workLogId]}.tsx, app/(app)/support/{index,create-inquiry,my-inquiries}.tsx, app/(app)/notices/index.tsx, app/(app)/(tabs)/board/{index,[boardType],write}.tsx, app/(app)/(tabs)/profile.tsx(리뷰 진입 구간), src/components/schedule/{ScheduleDetailModal,ScheduleCard,NextShiftCard,ScheduleDashboard}.tsx + tabs/{InfoTab,WorkTab,SettlementTab}.tsx + helpers/{timeHelpers,statusConfig}, src/components/qr/{QRCodeScanner,QRCodeScanner.web}.tsx, src/components/review/{ReviewForm,PendingReviewCard,ReviewPromptBanner}.tsx, src/components/notifications/{NotificationList,NotificationItem}.tsx, src/components/board/BoardPostEditor.tsx, src/components/headers/TabHeader.tsx, src/components/ui/OfflineStatusBar.tsx, src/hooks/{useSchedules,useJobSchedule,useQRCode,useNotifications,useNotificationHandler,useReviews,useSettlement(헤드),useNetworkStatus,useDeepLink,useWorkLogs(useCurrentWorkStatus 구간),useBoard(useBoardPosts 구간)}.ts, src/services/work/eventQRService.ts, src/services/observability/deepLinkService.ts + internal/deepLinkNavigationExecutor.ts, src/shared/deeplink/NotificationRouteMap.ts, src/domains/staff/missingCheckout.ts, src/utils/scheduleGrouping.ts(필터 구간), src/types/{schedule,report,review}.ts 일부.

못 본 영역: ① 실기기/시뮬레이터 실행 관찰 없음 — 키보드 가림·터치 타깃·다크모드 실렌더는 정적 독해로만 판단했고, 특히 NextShiftCard 중첩 Pressable 의 스크린리더 도달 여부는 VoiceOver 실측이 필요하다. ② 서버 측(RPC process_qr_checkin_atomically, 알림 트리거 SQL)은 읽지 않아 QR 실패 사유가 서버에서 더 세분화돼 오는지 미확인. ③ board/post/[postId].tsx 상세, support/inquiry/[id].tsx 상세, settings/notifications.tsx 는 목록·진입점만 보고 본문은 미독해. ④ CalendarView.tsx, GroupedScheduleCard.tsx 는 호출부에서만 확인. ⑤ 웹 빌드 전용 경로(QRCodeScanner.web.tsx)는 앞 120줄만 읽어 실패 표시 로직 후반부 미확인.

**구인자-공고**: 읽은 파일: app/(employer)/my-postings/create.tsx · create-success.tsx · [id]/index.tsx · [id]/edit.tsx · [id]/qr.tsx · [id]/collaborators.tsx / app/(app)/(tabs)/employer.tsx · employer-register.tsx · employer-application-status.tsx / src/components/employer/order-sheet 전체(OrderSheetScreen·orderRowMeta·PresetCarousel·VenueSelectChips + sheets 8종: Title·Place·Description·ScheduleDates·ScheduleSlots·SlotCard·RoleCountEditor·Salary·PreQuestions) / job-form/modals(DatePickerModal·TemplateModal) / posting(JobPostingCard·NonEmployerView) / share/BulkShareActionBar / hooks(useJobManagement·useTemplateManager·useShare·useUnsavedChangesGuard·useBulkShareSelection·useWorkScheduleEnabled·usePostingTypeCounts) / utils(employerPostingFilter·venueSelection) / constants/jobPosting.ts / services/jobs/jobManagementService.ts / repositories/supabase/JobPostingRepository.ts(수정 제한부) / services/offline/remoteMutationGuard.ts / ui/SheetModal.tsx(백드롭 처리부).
못 본 영역: 지원자 관리·취소요청·정산 화면 내부(applicants.tsx·settlements.tsx·cancellation-requests.tsx — 진입점만 확인), 근무표(work-schedule) 그리드 내부, ops 라이브 운영, workspace 초대 플로우, ConditionsSheet·WelfareSheet·TaxSheet·ContactSheet·WorkConditionSheet·RolesSheet 본문, 실기기/웹 렌더 실행 관찰(정적 코드 판독만).

**구인자-인력관리**: 실제로 읽은 파일 — 라우트: app/(employer)/my-postings/[id]/{applicants,cancellation-requests,collaborators,_layout}.tsx, app/(employer)/work-schedule.tsx, app/(employer)/my-postings/[id]/index.tsx(관리 액션 카드 구간 480-640). 근무표: src/components/workSchedule/{VenueDayPanel,VenueDayDetail,AddSlotSheet,EditSlotSheet,VenueSelector,VenueSettingsSheet}.tsx, src/components/jobs/DateCalendar/CalendarCell.tsx. 지원자/스태프: src/components/employer/applicants/{ApplicantList,ApplicantBulkActions,ConfirmModal,ConfirmedStaffCard,ConfirmedStaffList,CancellationRequestCard,StaffManagementTab,AddStaffModal,RoleChangeModal,ApplicantProfileContent,ApplicantProfileHeader,ProfileInfoSections}.tsx + ApplicantCard/{ApplicantCard.tsx,useAssignmentSelection.ts,components/{CardHeader,AppliedActions,ConfirmedActions,GroupedAssignmentSelector}.tsx}, src/components/applicant/StaffApplicantCard.tsx, src/components/employer/settlement/WorkTimeEditor.tsx, src/components/job-posting/{CollaboratorSearch,CollaboratorList,CollaboratorRow}.tsx. 훅/서비스: src/hooks/applicant/{index.ts,useApplicantMutations.ts,useApplicantsByJobPosting.ts,useStaffConversion.ts}, src/hooks/{useConfirmedStaff,useStaffNicknameSearch,useOptimisticLockBaseline}.ts, src/hooks/workSchedule/ 파일 목록·export 시그니처, src/services/jobs/applicantManagementService.ts. 못 본 영역: (1) 실기기·웹 렌더 관찰 없음 — 터치 타깃 실측, 키보드 가림, 다크모드 대비는 코드 판독만 했고 40px 그리드 셀 등 경계 항목은 근거 부족으로 제외했다. (2) settlements.tsx·venue-settlements.tsx 정산 화면은 다른 축이라 RoleChangeModal 호출부 확인 목적으로만 grep 했다. (3) work_logs/RPC 서버 계약(add_direct_staff, confirm_application)의 실제 제약은 미확인 — 일괄 거절·다중 배치 제안의 서버측 난이도는 추정이다. (4) src/components/staffPicker/{CandidateRow,RoleChips,NicknameSearchField}.tsx 내부는 미열람(소비처에서 동작만 확인). (5) 오프라인 큐·realtime 재연결 실동작은 코드상 경로만 봤고 실측하지 않아 오프라인 관련 항목은 넣지 않았다.

**구인자-정산운영**: 실제로 읽은 파일: app/(employer)/my-postings/[id]/settlements.tsx · [id]/qr.tsx · [id]/_layout.tsx · venue-settlements.tsx · work-schedule.tsx · workspace/{index,invite,invitations,archived}.tsx · app/(app)/(tabs)/employer.tsx · app/(public)/live/[view_token].tsx · app/(public)/monitor/[token].tsx · src/components/employer/settlement/{SettlementList,SettlementSummaryCard,SettlementBulkActions,SettlementCard,GroupedSettlementCard,SettlementRevertModal}.tsx · SettlementDetailModal/{SettlementDetailModal,SettlementAmountSection}.tsx · src/features/employer/settlements/{SettlementModals,TabHeader,TodayOpsStrip,useStaffSettlementsHandlers}.ts(x) · src/components/workspace/WorkspaceContextBar.tsx · src/components/workSchedule/{VenueSelector,VenueSettingsSheet}.tsx · src/hooks/{useSettlement,useSettlementModals,useSettlementDateNavigation,useQRCode}.ts · src/hooks/ops/{useMonitorSnapshot,usePlayerView}.ts · src/utils/settlement/settlementExport.ts · src/services/work/settlement/settlementVenueQuery.ts. 보조로 hooks/workspace 디렉터리 목록과 venue-settlements/초대취소/keep-awake 전역 grep 을 확인했다.

못 본 영역: StaffManagementTab 이하 스태프 관리 탭 전체(다른 축), WorkTimeEditor·SettlementEditModal·SettlementSettingsModal 내부 폼 UX(입력 고통 축을 더 팔 여지 있음), ops 운영자 콘솔 쪽 화면((ops) 라우트 — 전광판을 '만드는' 쪽), WorkspaceSwitcher/WorkspaceRevocationModal 내부, QRCodeScanner.web.tsx(스태프 스캔 측), 그리고 실제 렌더/실기기 관찰은 하지 않아 다크모드·터치 타깃 같은 시각 축은 코드에서 드러난 것만 다뤘다.

**이음새·누락표면**: 실제로 읽은/조사한 파일: src/types/{notification,report}.ts 전문, app/(app)/settings/notifications.tsx 전문, src/components/employer/ReportModal.tsx 전문, src/components/employer/applicants/ApplicantProfileContent.tsx(60-119), src/hooks/useNotifications.ts(100-160), src/repositories/supabase/JobPostingRepository.ts(804-890), app/(app)/(tabs)/schedule.tsx(1180-1207), app/(employer)/workspace/invite.tsx(빈 상태 구간). Grep/sed 실측: baseline_schema_from_prod.sql 의 notify_on_job_posting_update(4948-5040)·notify_on_work_log_no_show_update(5413-5470)·fn_send_review_reminders(2525-2628), 20260727000000_posting_auto_close_gaps.sql(430-530), 20260720002917 초대 검색 role 필터, settlement_requested/checkin_reminder/no_show_alert/review_* 프로듀서 전수 grep, getMyReports·changedFields·averageRating·quietHours·allowFontScaling·useTutorial 소비처 전수 grep, QRCodeScanner.web(getUserMedia), pushNotificationHandlers 웹 분기, ConfirmedStaffRepository 노쇼 구간, reviewService/useReviews 소비 경로. 기각한 후보(코드로 반증): 공고 삭제 시 확정자 방치(deleteWithTransaction 이 filled>0 차단 + 소프트캔슬로 job_cancelled 발화, JobPostingRepository.ts:823-833), 워크스페이스 초대의 role 함정(invite.tsx:161-169 가 제한을 문구로 안내), 웹 QR 스캔 불가(getUserMedia 구현 존재), 출근 리마인더 미발송(shiftReminderScheduler 가 발송 주체 0 문제를 이미 봉합), staff→구인자 신고 부재(schedule.tsx:766 useOwnerReport 존재). 못 본 영역: 실기기/웹 실렌더 관찰 없음(전 항목 정적 판독), send-push-notification EF 본문 전체(quietHours grep 만 수행), prod DB 의 pg_proc 실측(레포 마이그레이션 기준 — 특히 no_show/job_updated 트리거의 prod 현행본은 미확인), 리뷰 RLS 정책 상세, (ops) 콘솔·admin 화면 내부.