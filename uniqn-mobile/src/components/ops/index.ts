/** ops 1b/1c UI 컴포넌트 배럴. */
export { TablesTab } from './TablesTab';
export { RedrawModal } from './RedrawModal';
export { SeatGrid } from './SeatGrid';
export { TableRow } from './TableRow';
export { AddTableForm, type AddTableInput } from './AddTableForm';
// 1e — 딜러 지정 피커는 TablesTab 이 상대경로로 직접 import(barrel 미등록 — 현재 유일 소비처).
// Task 8(STAFF 탭)은 방향 불일치(테이블→스태프 vs 스태프→테이블)로 DealerPickerSheet 를 재사용하지
// 않고 인라인 SelectBottomSheet 로 대체했다(브리프가 허용한 대안) — 계속 미등록 유지.
// 1c — 클럭/통계/블라인드/HISTORY
export { ClockControl } from './ClockControl';
export { LiveStatsPanel } from './LiveStatsPanel';
export { BlindLevelsTab } from './BlindLevelsTab';
export { BlindLevelForm } from './BlindLevelForm';
// 계획 B — 블라인드 프리셋 시트(BlindLevelsTab 프리셋 바가 소비).
export { BlindPresetSheet } from './BlindPresetSheet';
export { HistoryTab } from './HistoryTab';
export { MonitorLinkButton } from './MonitorLinkButton';
export { MonitorConfigCard } from './MonitorConfigCard';
export { PlayerClaimButton } from './PlayerClaimButton';
// 1e — STAFF 탭(7번째 세그먼트). StaffAddSheet 는 현재 StaffTab 이 상대경로로
// 직접 import(barrel 미등록 — DealerPickerSheet 와 동일 관례: 현재 유일 소비처가 같은 디렉토리 내부).
export { StaffTab } from './StaffTab';
// PostingPickerSheet — Task 9(대회 생성 폼 공고 picker)가 재사용을 시작해 barrel 에 등록
// (StaffTab·new.tsx 두 소비처 — knip 미사용 export 오탐 조건 해소).
export { PostingPickerSheet } from './PostingPickerSheet';
// 1d — PAYOUTS 탭 / 1f — 2부 재설계(구조 편집기·대장·정정 시트)
export { PayoutsTab } from './PayoutsTab';
export { PayoutStructureEditor } from './PayoutStructureEditor';
export { PayoutLedger } from './PayoutLedger';
export { PrizeCorrectSheet } from './PrizeCorrectSheet';
// 1f(T10) — PLAYERS 탭 추출
export { PlayersTab } from './PlayersTab';
// L7 — 참가 등록 FAB→시트(인라인 폼 제거). PlayersTab 헤더 토글 폼 대체, 오픈 상태는 [id].tsx 소유.
export { OpsRegisterParticipantSheet } from './OpsRegisterParticipantSheet';
// 2부 리디자인(Task 7) — 참가·좌석 공용 액션시트(L5·L6)
export { OpsParticipantActionSheet } from './OpsParticipantActionSheet';
// 1f(T12) — 종료 결과 뷰(§7.3)
export { TournamentResultCard } from './TournamentResultCard';
// 2부 리디자인(Task 2) — 상시 한 줄 요약 스트립(L1)
export { OpsSummaryStrip } from './OpsSummaryStrip';
// 2부 리디자인(Task 3) — 상시 클럭 스트립 + 제어 시트(L1)
export { OpsClockStrip } from './OpsClockStrip';
export { OpsClockControlSheet } from './OpsClockControlSheet';
// 2부 리디자인(Task 4) — 현황 탭 콘텐츠(L2, 클럭 제외)
export { OpsStatusTab } from './OpsStatusTab';
// 2부 리디자인(Task 5) — 반응형 콘솔 셸(폰 5탭+⋯ / 태블릿 사이드바 7탭)
export { OpsConsoleShell, type OpsTabKey } from './OpsConsoleShell';
