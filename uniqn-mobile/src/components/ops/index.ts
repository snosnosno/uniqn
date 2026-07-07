/** ops 1b/1c UI 컴포넌트 배럴. */
export { TablesTab } from './TablesTab';
export { RedrawModal } from './RedrawModal';
export { SeatGrid } from './SeatGrid';
export { TableRow } from './TableRow';
export { AddTableForm, type AddTableInput } from './AddTableForm';
// 1e — 딜러 지정 피커는 TablesTab 이 상대경로로 직접 import(barrel 미등록 — 현재 유일 소비처).
// Task 8(STAFF 탭)이 재사용을 시작하면 그때 barrel 에 추가(knip 미사용 export 오탐 예방).
// 1c — 클럭/통계/블라인드/HISTORY
export { ClockControl } from './ClockControl';
export { LiveStatsPanel } from './LiveStatsPanel';
export { BlindLevelsTab } from './BlindLevelsTab';
export { BlindLevelForm } from './BlindLevelForm';
export { HistoryTab } from './HistoryTab';
export { MonitorLinkButton } from './MonitorLinkButton';
export { PlayerClaimButton } from './PlayerClaimButton';
// 1d — PAYOUTS 탭 / 1f — 2부 재설계(구조 편집기·대장·정정 시트)
export { PayoutsTab } from './PayoutsTab';
export { PayoutStructureEditor } from './PayoutStructureEditor';
export { PayoutLedger } from './PayoutLedger';
export { PrizeCorrectSheet } from './PrizeCorrectSheet';
// 1f(T10) — PLAYERS 탭 추출
export { PlayersTab } from './PlayersTab';
// 1f(T12) — 종료 결과 뷰(§7.3)
export { TournamentResultCard } from './TournamentResultCard';
