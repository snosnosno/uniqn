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
export { HistoryTab } from './HistoryTab';
export { MonitorLinkButton } from './MonitorLinkButton';
export { PlayerClaimButton } from './PlayerClaimButton';
// 1e — STAFF 탭(7번째 세그먼트). StaffAddSheet/PostingPickerSheet 는 현재 StaffTab 이 상대경로로
// 직접 import(barrel 미등록 — DealerPickerSheet 와 동일 관례: 현재 유일 소비처가 같은 디렉토리 내부).
// PostingPickerSheet 는 Task 9(생성 폼 공고 picker)가 재사용을 시작하면 그때 barrel 에 추가
// (knip 미사용 export 오탐 예방 — 등록만 하고 외부 소비처가 없으면 그 자체가 오탐 소스가 된다).
export { StaffTab } from './StaffTab';
// 1d — PAYOUTS 탭 / 1f — 2부 재설계(구조 편집기·대장·정정 시트)
export { PayoutsTab } from './PayoutsTab';
export { PayoutStructureEditor } from './PayoutStructureEditor';
export { PayoutLedger } from './PayoutLedger';
export { PrizeCorrectSheet } from './PrizeCorrectSheet';
// 1f(T10) — PLAYERS 탭 추출
export { PlayersTab } from './PlayersTab';
// 1f(T12) — 종료 결과 뷰(§7.3)
export { TournamentResultCard } from './TournamentResultCard';
