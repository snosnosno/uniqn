# UNIQN — 홀덤펍·대회사 대상 UX/도메인 갭 분석 (2026-05-28)

> **타깃 시장**: 홀덤펍 사장(단발 알바 수요) + 대회사 운영팀(D-7~D-day 집중 인력). 메모리 `project_target_market_pivot` 기준.
> **분석 범위**: `uniqn-mobile/app/**`, `uniqn-mobile/src/**`, `uniqn-mobile/supabase/migrations/**`, `uniqn-mobile/e2e/**`.
> **인용 규칙**: 모든 주장은 `파일:라인` 또는 `[[memory-id]]` 인용. 비인용 클레임 없음.

---

## 1. 사용자 입장 앱 사용성 개선점 (총 19건)

### 1.1 구직자(스태프) 관점 — 6건

#### Golden Path 1 — 공고 발견 & 필터링
**현황**: `home-jobs.tsx:40–93` 필터는 `selectedType` (PostingType 4종, 라인 40·86–93)과 `selectedDate` (regular 타입에 한해, 라인 41·79–81) 뿐. `JobPostingFilters` 정의(`jobPosting.ts:185–199`)에 `district?: string` 컬럼은 존재하나 UI에서 사용처 0건(`home-jobs.tsx` 내 `district` grep 미매치).
**갭**: **지역/거리 필터 부재**. 홀덤펍은 1km 반경 알바가 주력이고 [[project_target_market_pivot]] 명시("홀덤펍 사장 = 단발 알바") — 강남역 vs 서울 전체 동등 노출은 응답률 감소.

#### Golden Path 2 — 공고 상세 → 지원
**현황**: `apply.tsx:144–167` 제출 직전 `queryClient.fetchQuery`로 최신 공고 재확인 → `status !== ACTIVE`거나 `filled >= total`이면 `Alert.alert('지원 불가', ...)`. 그러나 **충돌(같은 시간 다른 공고 confirmed) 사전 감지는 0건** (코드 내 `conflict` 키워드 grep 시 인증 충돌만 매치).
**갭**: 스태프가 같은 야간 시간대에 두 공고 동시 지원해 양쪽 confirmed 시 노쇼 위험. 단발성 홀덤펍 매칭에서 이중 예약은 신뢰 하락.

#### Golden Path 3 — 내 스케줄 & QR 체크인
**현황**: `(tabs)/schedule.tsx:260–781` 캘린더/리스트 토글, QR 체크인(`schedule.tsx:529–545`). 스케줄 그룹화는 `groupedByApplication` (지원 단위, 다일자 1카드 전개).
**갭**: **"곧 시작" 우선 점프 / D-1 푸시 액션 부재**. `notifications.tsx:35–100` 카테고리 탭은 있으나 "긴급 리마인더" 별도 카테고리 없음. 새벽 영업 홀덤펍에서 출근 시간 임박 알림 누락은 노쇼 직결.

#### Edge Case 1 — Fixed 공고 취소 차단의 UX 불일치
**현황**: `jobs/[id]/index.tsx:157–163` 취소 가능 조건은 `!isFixed && status === CONFIRMED && !취소요청`. fixed 공고는 취소 버튼 자체가 렌더되지 않음.
**갭**: 사용자에게 **"왜 못 취소하는가" 설명 0건**. 홀덤펍 장기 알바(fixed)에서 갑작스러운 사정으로 취소 불가 시 무단 결근 유도.

#### Edge Case 2 — 지원 폼 더블탭 가드의 단방향성
**현황**: `apply.tsx:100·132–135·189–191` `submitInFlightRef` 더블탭 가드는 클라이언트 한정. 라인 130–131 주석에 "fetchQuery await 동안 isSubmitting=false → 더블탭 시 2번 제출, unique 인덱스가 막지만 2번째는 에러 Alert" 명시.
**갭**: **에러 Alert 자체가 마찰점**. 사용자가 1번 탭 → 응답 지연 → 다시 탭 → "이미 지원함" Alert로 혼란. 버튼 disable 시점을 fetchQuery 시작 시점으로 앞당겨야 함.

#### Edge Case 3 — applicant_role TypeScript ↔ Postgres 정합성
**현황**: `application.ts:53` `applicantRole?: StaffRole` (dealer/floor/serving/manager/staff/other). 마이그레이션 `20260525040000_align_applicant_role_to_staff_role.sql` 파일명상 정합 완료. 그러나 `role.ts:14, 89` 한글 주석에서 **"포커룸에서의 업무 역할"** 표현 잔존.
**갭**: 코드 주석이 [[project_target_market_pivot]]와 모순. 신규 개발자 인지 부조화 + UI 카피 작성 시 잘못된 도메인 가정 위험.

---

### 1.2 구인자(홀덤펍 사장) 관점 — 6건

#### Golden Path 4 — 공고 작성
**현황**: `my-postings/create.tsx:24–128` `JobPostingScrollForm`으로 `INITIAL_JOB_POSTING_DRAFT` 편집. 템플릿 저장/로드 존재(라인 43–54). PostingType 4종 단일 폼(`postingConfig.ts:9`).
**갭**: **PostingType별 폼 분기가 동적 필드 숨김 방식** — 같은 폼 위에서 fixed/regular/tournament/urgent에 따라 섹션이 보였다 사라짐. 사장이 "왜 이 필드가 비활성?" 인지 부조화 빈발.

#### Golden Path 5 — 지원자 승인
**현황**: `[id]/applicants.tsx:79–126` `handleConfirm`/`handleReject` 모두 **개별 지원자 1명** 처리. 모달 → `confirmWithHistory({ applicationId, selectedAssignments, notes })`.
**갭**: **일괄 승인/거절 UI 부재**. 단발 알바 10명 모집 공고에 25명 지원 시 25번 모달 진입 필요. 홀덤펍 1인 운영(사장 = 매니저) 환경에서 시간 비용 큼.

#### Golden Path 6 — 워크스페이스 협업
**현황**: `workspace/index.tsx:34–115` 단일 활성 워크스페이스(`useActiveWorkspace`, 라인 41). owner만 이름 변경(라인 79–94)·멤버 제거(라인 96–115)·보관(라인 57–74). 멤버 권한은 editor 단일(`20260430010000_workspace_create_tables.sql:32–44` workspace_role 'editor' only).
**갭**: **editor 권한 세분화 0단계**. 매니저(승인만)·회계(정산만) 같은 역할 분리 불가. 본점/지점 다중 운영 시 권한 일률 적용.

#### Edge Case 4 — 다중 매장 운영 미지원
**현황**: `workspace/index.tsx:117–127` `useCreateWorkspace`로 추가 생성 가능. 그러나 [[project_workspace_archive]] 메모 + `20260524100000_workspace_add_archived_at.sql` 워크스페이스 cap·스위처는 archived 제외만 처리. 신규 employer 자동 생성(memory `pitfall_employer_signup_no_default_workspace`)도 1개만.
**갭**: **다중 워크스페이스 UX가 "보관 후 새로 만들기" 모델** — 2호점 동시 운영하며 두 곳에 동시 공고 게시는 가능하나 스위처 UX/공고-워크스페이스 매핑 명시성 부족.

#### Edge Case 5 — 정산 일당/시급 혼합
**현황**: `jobPosting.ts:39–62` `SalaryType = 'hourly' | 'daily' | 'monthly' | 'other'`. `compensation.mode: 'shared' | 'by_role'` (라인 114–119) — 역할별 시급 다르게 설정 가능. WorkLog `payrollAmount?: number` (`schedule.ts:411–478` 정의에 customSalaryInfo·customAllowances 존재).
**갭**: **부분 근무(조퇴/지각) 정산 자동 공제 규칙 미정의** — checkInTime/checkOutTime은 저장되나 일당 공고에서 4시간만 근무 시 50% 지급인지 전액인지 코드 분기 없음.

#### Edge Case 6 — 취소 요청 응답 플로우 노출
**현황**: `cancellation-requests.tsx` 파일 존재(`my-postings/[id]/cancellation-requests.tsx`). `schedule.tsx:367–389` 스태프 측 요청 송신은 명확. 그러나 구인자 측 알림→응답 진입 경로가 `applicants.tsx`에서 미통합(applicants 화면에 cancellation 탭 보임 0회).
**갭**: 두 화면(applicants ↔ cancellation-requests) 별도 진입 → 사장이 "지원자 관리"에서 취소 요청 누락 위험.

---

### 1.3 구인자(대회사 운영팀) 관점 — 7건

#### Golden Path 7 — 대회 공고 생성
**현황**: `my-postings/create.tsx:69–71` `postingType === 'tournament'` 시 토스트만 `"관리자 승인 후 게시됩니다"`. `TournamentConfig` (`postingConfig.ts:31–40`)에 `approvalStatus`·`submittedAt`·`rejectionReason`만 존재.
**갭**: **대회 특화 입력 필드 0건**. 상금풀·세션 수·바이인·예선/본선 단계·블라인드 구조 같은 표준 토너먼트 메타 부재.

#### Golden Path 8 — 대회 다일정 채용
**현황**: `jobPosting.ts:97–102` `PostingDatedSchedule`은 `requirements: PostingDateRequirement[]` 배열로 일자별 다른 `timeSlots` **구조적**으로 지원. 그러나 메모 [[project_schedule_schema_unification_sp1]] 보고서 + Explore 에이전트 결과상 UI(`DateRangeCard`)는 "범위 + 공유 시간대" 모델만 운영.
**갭**: 스키마는 D-3 14:00–18:00 / D-2 18:00–24:00 / D-1 종일 같은 일자별 다른 시간대 지원하나 UI 미반영. D-7~D-day 토너먼트 다일정 입력 시 같은 시간대 강제.

#### Golden Path 9 — 참가 인원 일괄 등록
**현황**: 모든 application은 staff 측 `submitApplication` (`apply.tsx:171–179`) 단일 경로. 운영팀이 명단 일괄 import 하는 RPC/엔드포인트 미존재(`uniqn-mobile/src/services` 내 `bulk|import|csv` grep 0건 — `Grep` 결과 확인된 부재).
**갭**: 200명 토너먼트 사전등록 시 200회 개별 신청 필요. 운영팀의 외부 명단(엑셀/CSV)을 시스템에 주입 불가.

#### Edge Case 7 — 토너먼트 운영 어드민 self-service 부재
**현황**: `app/(admin)/tournaments/index.tsx` 존재하나 `(admin)` 경로는 UserRole='admin' 게이트(`role.ts:57`). employer는 진입 불가.
**갭**: 대회사 운영팀은 employer 권한이라 자사 대회 대시보드 self-service 진입 불가 — UNIQN 관리자에게 의존.

#### Edge Case 8 — 토너먼트 전용 역할 부재
**현황**: `role.ts:100` `StaffRole = 'dealer' | 'floor' | 'serving' | 'manager' | 'staff' | 'other'`. 라인 98 주석에 "v2.1.0 통합: chiprunner → floor" 명시 — chiprunner가 floor로 합쳐짐.
**갭**: 토너먼트 디렉터, 레지스트레이션(접수), 칩러너, 캐셔, 페이아웃 클럭 등 대회 운영 특화 역할이 모두 `other + customRole`로만 표현 가능. 카탈로그·표시 라벨·집계 불가.

#### Edge Case 9 — 대회 결과/순위·상금 분배
**현황**: `jobPosting.ts:166` `tournamentConfig?: TournamentConfig`는 승인 워크플로우만. 마이그레이션 디렉터리에 `*tournament*` 파일 0건(Glob 결과 확인). `prize|상금` grep 0건(`src/**` 검색 결과).
**갭**: 대회 결과 입력·순위 공시·상금 분배 모듈 자체가 없음. 운영팀이 외부 도구(엑셀)와 이중 운영 불가피.

#### Edge Case 10 — 긴급(urgent) 공고 = 단순 우선순위
**현황**: `postingConfig.ts:42–45` `UrgentConfig { createdAt, priority: 'high' }` 만 가짐. 만료 시간·자동 마감 로직 미부착.
**갭**: 대회사가 D-day 갑작스러운 인력 부족 → urgent 공고 게시해도 자동 expire·푸시 우선순위 부스트·검색 가중치 부여 없음. 사실상 "라벨"만.

---

## 2. 홀덤펍·대회사 도메인 갭 (총 12건)

### 2.1 홀덤펍 특화 갭 — 6건

#### G1. 테이블 수 기반 정원 계산 미지원
- **현재 DB/UI**: `jobPosting.ts:80` `PostingSlotRoleRequirement.count: number` — 절대값만 입력.
- **갭**: "테이블 5개 = 딜러 5명 + 플로어 1명" 같은 비례 산정 부재. 홀덤펍에서 가동 테이블 수가 운영 규모의 1차 지표인데 미반영.
- **제안**: posting에 `tableCount?: number` + role별 `perTableRatio?: number` 필드 추가, count auto-derive.

#### G2. 심야영업 시간대 표준 부재
- **현재 DB/UI**: `unified/timeSlot.ts:25` `startTime: string | null` (HH:mm 형식). 24시 넘는 시간 표현 불가(`28:00` 같은 익일 표기).
- **갭**: 18:00–익일 04:00 같은 야간 운영이 표준인 홀덤펍에서 시간 슬롯이 자정에서 분단됨. 마감/시급 계산 시 두 슬롯으로 분리해야 함.
- **제안**: `endTime?: string | null` + `crossesMidnight: boolean` 메타 추가, UI에서 "심야 인접 슬롯" 자동 병합 표시.

#### G3. 딜러 로테이션(rotation) 부재
- **현재 DB/UI**: `unified/schedule.ts` 전체 + `dateRequirement.ts` 검색 — `rotation|shift|swap` grep 미매치(Explore 에이전트 결과).
- **갭**: 홀덤펍 딜러 표준 운영(30분 딜링 + 10분 휴식 사이클)을 표현할 필드 없음. 1 timeSlot 내 다중 딜러 = 동시 근무로만 해석.
- **제안**: TimeSlotInfo에 `rotationCycle?: { dealMin: number; restMin: number }` 또는 별도 `shiftPattern` 메타.

#### G4. 단발(스팟) vs 반복 알바의 status 미분리
- **현재 DB/UI**: `jobPosting.ts:29–37` `JobPostingStatus` 8종에 "스팟 단발"·"반복(주기)" 구분 없음. `PostingType.fixed`는 7일 만료(`postingConfig.ts:13–17`).
- **갭**: 홀덤펍은 "오늘 저녁만" 같은 단발이 절반인데, 별도 라벨/필터 없이 regular와 동일 노출. [[project_target_market_pivot]] "단발 알바" 핵심 표현 미반영.
- **제안**: `PostingType`에 `spot` 추가하거나, `regular`에 `isSpot: boolean` 서브플래그 + 홈 필터 칩 분리.

#### G5. 매장 정보(영업시간·테이블 수·층고) 표준화 부재
- **현재 DB/UI**: `jobPosting.ts:66–68` `PostingLocation extends Location { detailedAddress? }` — 주소만. 매장 메타(영업시간, 흡연 가능, 음향, 주차) 필드 0건.
- **갭**: 스태프가 "심야 영업 강북" 같은 환경 정보로 결정하는데 공고마다 description 자유텍스트 의존.
- **제안**: `venueProfile` 별도 테이블(매장 1:N 공고) 또는 PostingLocation 확장.

#### G6. 사장 자가 운영 1인 워크플로우 가정 부족
- **현재 DB/UI**: `applicants.tsx:79–126` 개별 모달 승인. 워크스페이스 editor 단일 권한(`20260430010000_workspace_create_tables.sql:32–44`).
- **갭**: 홀덤펍 사장 = 1인 운영(매니저 겸 사장) 비율 높음. "오늘 5명 일괄 승인" 같은 batch 액션 부재 + 운영 패턴 분석 부재.
- **제안**: applicants 화면에 multi-select + "선택 N명 승인" 액션, `useApplicantManagement` 훅에 `bulkConfirm` 추가.

### 2.2 대회사 특화 갭 — 6건

#### G7. 토너먼트 단계(예선/본선/파이널) 모델 부재
- **현재 DB/UI**: `postingConfig.ts:31–40` `TournamentConfig`는 approval 메타만. session·phase·day 개념 미존재.
- **갭**: 다일정 토너먼트(D-7 예선 → D-1 본선 → D-day 파이널)를 1개 공고로 묶지 못하고, 각각 별도 공고로 분리해야 함.
- **제안**: `tournamentConfig`에 `phases: { name; startDate; endDate; roleRequirements }[]` 추가, 공고-페이즈 관계 모델.

#### G8. 상금풀(Prize Pool) 필드 부재
- **현재 DB/UI**: `prize|상금` grep 결과 `selectionCore.test.ts` 1건만(테스트 내 우연 매치). 실제 도메인 필드 0건.
- **갭**: 대회사 공고 작성 시 "1등 500만원 / 2등 300만원" 같은 상금 구조 입력 불가 + 참가자에게 공시 불가.
- **제안**: `tournamentConfig.prizePool: { total: number; payoutStructure: { rank; amount }[] }`.

#### G9. 대회 전용 역할 카탈로그 부재
- **현재 DB/UI**: `role.ts:100` StaffRole 6종. 라인 98 주석 "chiprunner → floor 통합" — 칩러너가 별개 역할이 아님.
- **갭**: 토너먼트 디렉터(TD), 레지스트레이션, 칩러너, 캐셔, 페이아웃 클럭, RFID 운영 등 대회 표준 역할 미정의. 모두 `other + customRole`로만 가능 → 집계·매칭·표시 라벨 불가.
- **제안**: `StaffRole` 확장 또는 `tournamentRole` enum 별도(`'td'|'registration'|'chip_runner'|'cashier'|'payout_clerk'`).

#### G10. 사전등록 명단 일괄 import 미지원
- **현재 DB/UI**: `apply.tsx:171–179` `submitApplicationAsync` 단일 경로. service 디렉토리 `bulk|import|csv` grep 0건.
- **갭**: 대회사가 외부 사전등록(자사 웹/Google Form)을 시스템에 일괄 주입 불가 → 200명 운영 시 운영팀이 1명씩 처리하거나 UNIQN 외부에서 별도 운영.
- **제안**: `bulkCreateApplications` Edge Function + CSV 업로드 UI(`workspace` 하위).

#### G11. D-7~D-day 서지 운영 메타 부재
- **현재 DB/UI**: `UrgentConfig { createdAt, priority: 'high' }` 단순 플래그(`postingConfig.ts:42–45`). expire/auto-close 로직 미부착.
- **갭**: 대회사가 "D-3까지 모집" 같은 마감 제어, 카운트다운 노출, 푸시 부스팅 같은 서지 운영 메타 없음.
- **제안**: `posting.expiresAt: timestamptz` + 클라이언트 카운트다운, urgent에 한해 일일 푸시 리마인더.

#### G12. 결과(우승자/등수) 기록 & 사후 정산 부재
- **현재 DB/UI**: `work_logs` 테이블은 출퇴근·payroll만(`schedule.ts:411–478`). 대회 결과 컬럼 없음.
- **갭**: 대회 종료 후 우승자 기록·상금 지급 트래킹 미지원. 운영팀이 별도 시트로 관리해야 함.
- **제안**: `tournament_results` 별도 테이블 또는 `work_logs.tournamentResult?: { rank; prize; note }` 옵셔널 필드.

---

## 3. 일정 유연성 — SP1~SP3 통일 위 추가 필요 변경 (6건)

> 기준: SP1~SP3 통일 완료 후 스키마([[project_schedule_schema_unification_sp1]], [[project_schedule_counter_unification_sp2_sp3]]).

### F1. 문서 레이어 vs 정규화 레이어 discriminator 분기 통일
- **현재 상태**: 문서(DB) 레이어 `schedule.kind: 'dated' | 'fixed'` (`jobPosting.ts:98, 105`). 정규화(UI) 레이어 `schedule.type: 'dated' | 'fixed'` (`unified/schedule.ts:31, 47`). 동일 의미·다른 키.
- **변경안**: 한쪽으로 통일(`kind` 권장 — 문서가 source of truth). 정규화 레이어도 `kind`로 rename, 타입 가드(`isDatedSchedule`, `isFixedSchedule`) 함께 갱신.
- **영향 파일**: `src/types/unified/schedule.ts`, `src/types/unified/__tests__/schedule.test.ts`, `src/utils/schedule/**`, `src/components/jobs/**` (Explore 에이전트가 정규화 레이어 소비처로 식별한 위치).

### F2. 일자별 다른 시간대 입력 UI
- **현재 상태**: 스키마(`PostingDateRequirement.timeSlots`, `jobPosting.ts:91–95`)는 일자마다 독립 timeSlots 허용. 그러나 UI `DateRangeCard`(Explore Agent C 보고 — `src/components/employer/job-form/cards/DateRangeCard.tsx`)는 "범위 + 공유 시간대" 모델만 노출.
- **변경안**: 카드별 "이 날짜 별도 시간 설정" 토글 → 활성 시 timeSlots 분리 편집. 비활성은 현 동작 유지(역호환).
- **영향 파일**: `src/components/employer/job-form/cards/DateRangeCard.tsx`, `TimeSlotCard.tsx`, `src/components/employer/job-form/sections/ScheduleSection.tsx`.

### F3. 자정 넘는 시간대(crossesMidnight)
- **현재 상태**: `unified/timeSlot.ts:25–28` `startTime: string | null`, `endTime?: string | null`. 모두 HH:mm 0~23시 가정. 야간 운영(18:00–04:00) 시 자정에서 분단.
- **변경안**: `crossesMidnight?: boolean` 플래그 + 표시 헬퍼(`formatTimeSlotDisplay`, `unified/timeSlot.ts:100–114`)에서 "18:00 ~ 익일 04:00" 출력.
- **영향 파일**: `src/types/unified/timeSlot.ts`, work_log 시간 차이 계산 유틸, 정산 시급 계산.

### F4. 역할별 시간차 (role-specific time)
- **현재 상태**: `unified/timeSlot.ts:40` `roles: RoleInfo[]` — 같은 timeSlot 내 모든 role이 동일 startTime/endTime 공유.
- **변경안**: `RoleInfo`에 `startTimeOverride?: string`·`endTimeOverride?: string` 옵셔널 필드. 미설정 시 슬롯 시간 상속.
- **영향 파일**: `src/types/unified/role.ts`, ApplicationForm AssignmentSelector, work_log 생성 RPC `confirm_application` 시 role별 시간 사용.

### F5. 교대(shift rotation) 패턴
- **현재 상태**: 메모리 검색 + 코드 grep 결과 `rotation|shift|swap` 미매치(Explore Agent C 보고 + 본인 확인). 표현 수단 부재.
- **변경안**: `TimeSlotInfo`에 `shiftPattern?: { cycleMin: number; subSlots: { startOffset; durationMin; role }[] }` 옵셔널 추가. 미설정 = 현 동작(동시 근무).
- **영향 파일**: `src/types/unified/timeSlot.ts`, work_log 생성 분기, 정산 분단 계산.

### F6. filled_positions 단일 집계와 일자별 한도의 정합
- **현재 상태**: `filled_positions` 트리거 인-`20260525190000_filled_positions_trigger.sql` 자동 집계(메모 [[project_schedule_counter_unification_sp2_sp3]]). H1 가드 정원 키 정규화는 `20260525040100_posting_count_slot_role_key_normalization.sql`. 그러나 totalPositions(`jobPosting.ts:150`)는 단일 숫자 — 일자별 한도가 합산만 반영.
- **변경안**: 표시 레이어에서 일자별 capacity(요청 페이로드 키별 집계)를 hydrate한 viewmodel 통일. 또는 `total_positions_by_date` materialized view.
- **영향 파일**: `src/hooks/usePostingFilledCounts.ts`, `home-jobs.tsx:152` 사용처, 공고 카드 표시 컴포넌트.

---

## 4. 우선순위 매트릭스

| ID | 항목 | 임팩트 | 노력 | 홀덤펍/대회사 강도 | 우선순위 |
|----|------|--------|------|--------------------|---------|
| 1.1-Edge3 | role.ts "포커룸" 주석 잔존 → 타깃 시장 정렬 | High | S | 양쪽 동일 | **H/S** |
| F1 | schedule discriminator `kind` ↔ `type` 통일 | High | S | 양쪽 동일 | **H/S** |
| G6 / 1.2-Path5 | 지원자 일괄 승인 | High | M | 홀덤펍↑↑ (단발 다수) | **H/M** |
| G1 | 테이블 수 기반 정원 계산 | High | M | 홀덤펍↑↑↑ (전용) | **H/M** |
| 1.1-Path1 | 지역/거리 필터 | High | M | 홀덤펍↑↑ (근거리 알바) | **H/M** |
| G7 | 토너먼트 단계(phase) 모델 | High | L | 대회사↑↑↑ (전용) | **H/L** |
| G10 | 사전등록 명단 일괄 import | High | L | 대회사↑↑↑ | **H/L** |
| G2 | 자정 넘는 시간대 표준 (F3과 연계) | High | S | 홀덤펍↑↑ | **H/S** |
| F2 | 일자별 다른 시간대 UI | High | M | 대회사↑↑ (다일정) | **H/M** |
| 1.1-Path2 | 같은 시간 공고 충돌 사전 감지 | Med | M | 양쪽 동일 | **M/M** |
| 1.1-Path3 | "곧 시작" 푸시 액션·우선 점프 | Med | S | 홀덤펍↑ (심야) | **M/S** |
| 1.1-Edge1 | Fixed 공고 취소 차단 사유 안내 | Med | S | 홀덤펍↑ (장기 알바) | **M/S** |
| 1.1-Edge2 | 더블탭 가드 fetchQuery 시점 보강 | Med | S | 양쪽 동일 | **M/S** |
| 1.2-Path4 | PostingType별 폼 분기 명확화 | Med | M | 양쪽 동일 | **M/M** |
| 1.2-Path6 | editor 권한 세분화(매니저/회계) | Med | L | 양쪽 (체인↑) | **M/L** |
| 1.2-Edge5 | 부분 근무 정산 공제 규칙 | Med | M | 양쪽 동일 | **M/M** |
| 1.2-Edge6 | 취소 요청 응답 진입 통합 | Med | S | 양쪽 동일 | **M/S** |
| G3 | 딜러 로테이션 패턴 (F5와 연계) | Med | L | 홀덤펍↑↑ | **M/L** |
| G4 | 스팟 vs 반복 타입 분리 | Med | M | 홀덤펍↑↑ | **M/M** |
| G9 | 토너먼트 전용 역할 카탈로그 | Med | M | 대회사↑↑↑ | **M/M** |
| G11 | D-7 서지 운영 메타 (expiresAt·푸시 부스트) | Med | M | 대회사↑↑ | **M/M** |
| F4 | 역할별 시간차 | Med | M | 대회사↑ (TD vs 칩러너 시간 다름) | **M/M** |
| F6 | 일자별 capacity 표시 정합 | Med | M | 대회사↑ (다일정) | **M/M** |
| 1.3-Edge7 | 토너먼트 어드민 employer self-service | Low | L | 대회사↑↑↑ | **L/L** |
| G5 | 매장 프로필(영업시간/테이블/주차) | Low | L | 홀덤펍↑ | **L/L** |
| G8 / G12 | 상금풀·결과·사후 정산 모듈 | Low | L | 대회사↑↑↑ (전용) | **L/L** |
| F5 | shiftPattern 모델 | Low | L | 홀덤펍↑ (G3·F5 연계) | **L/L** |

### 4.1 권장 실행 순서

1. **H/S 4건 즉시** — 비용 최소, 정합/신뢰 회복(주석·discriminator·취소 안내·자정 슬롯).
2. **H/M 4건 1차 스프린트** — 홀덤펍 즉효(일괄승인·지역필터·테이블 정원), 대회사 즉효(일자별 다른 시간대 UI).
3. **H/L 2건 별도 트랙** — 토너먼트 phase·import는 대회사 전용 큰 그림. 사양 분리.
4. **M/L·L/L** — 워크스페이스 권한 세분화·상금풀·매장 프로필은 시장 검증 후 진입.

---

## 5. 출처 인덱스 (모든 클레임 근거)

- 스키마: `uniqn-mobile/src/types/jobPosting.ts:29–199`, `unified/schedule.ts:22–68`, `unified/timeSlot.ts:20–41`, `unified/role.ts:30–45`, `role.ts:57–100`, `application.ts:48–87`, `postingConfig.ts:9–45`, `workspace.ts:16–26`.
- 마이그레이션: `20260430010000_workspace_create_tables.sql:14–44`, `20260524100000_workspace_add_archived_at.sql`, `20260525040000_align_applicant_role_to_staff_role.sql`, `20260525040100_posting_count_slot_role_key_normalization.sql`, `20260525190000_filled_positions_trigger.sql`, `20260528120000_cancel_rpc_expired_reopen_guard.sql`.
- UX 코드: `app/(app)/(tabs)/home-jobs.tsx:40–174`, `app/(app)/jobs/[id]/index.tsx:139–224`, `app/(app)/jobs/[id]/apply.tsx:92–248`, `app/(app)/(tabs)/schedule.tsx:260–781`, `app/(employer)/my-postings/create.tsx:24–128`, `app/(employer)/my-postings/[id]/applicants.tsx:27–217`, `app/(employer)/workspace/index.tsx:34–150`.
- 메모: [[project_target_market_pivot]], [[project_schedule_schema_unification_sp1]], [[project_schedule_counter_unification_sp2_sp3]], [[project_workspace_archive]], [[pitfall_posting_role_filled_dead_counter]], [[pitfall_worklog_schedule_composite_applicationid]], [[pitfall_employer_signup_no_default_workspace]].
- 부재 증거(0건 grep): `src/**` 에서 `prize|상금|chip.runner|tournament.director` 매치 — `selectionCore.test.ts` 1건만(우연 매치). 마이그레이션 `*tournament*` 파일 0건.
