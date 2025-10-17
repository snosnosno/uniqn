import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaThList, FaUserPlus } from '../components/Icons/ReactIconsReplacement';

import MoveSeatModal from '../components/modals/MoveSeatModal';
import ParticipantDetailModal from '../components/modals/ParticipantDetailModal';
import PlayerActionModal from '../components/modals/PlayerActionModal';
import TableCard from '../components/tables/TableCard';
import TableDetailModal from '../components/modals/TableDetailModal';
import TournamentSelector from '../components/TournamentSelector';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTournament } from '../contexts/TournamentContext';
import { useParticipants, Participant } from '../hooks/useParticipants';
import { useSettings } from '../hooks/useSettings';
import { useTables, Table } from '../hooks/useTables';
import { exportTablesToExcel } from '../utils/excelExport';
import { useTournamentData } from '../contexts/TournamentDataContext';
import { DEFAULT_TOURNAMENT_ID } from '../hooks/useTournaments';
import { getTournamentColorById, COLOR_EMOJIS, UNASSIGNED_COLOR } from '../utils/tournamentColors';

const TablesPage: React.FC = () => {
    const { state } = useTournament();
    const { t } = useTranslation();
    const {
        tables,
        setTables,
        loading: tablesLoading,
        error: tablesError,
        updateTableOrder,
        bustOutParticipant,
        moveSeat,
        openNewTable,
        openNewTableInTournament,
        closeTable,
        autoAssignSeats,
        autoBalanceByChips,
        activateTable,
        updateTableDetails,
        updateTableMaxSeats,
        assignTableToTournament,
    } = useTables(state.userId, state.tournamentId);

    const {
        participants,
        loading: participantsLoading,
        error: participantsError,
        updateParticipant
    } = useParticipants(state.userId, state.tournamentId);

    const { settings, updateSettings, loading: settingsLoading } = useSettings(state.userId, state.tournamentId);
    const { tournaments, ensureDefaultTournament } = useTournamentData();

    const isMobile = useMediaQuery('(max-width: 768px)');

    const [detailModalTable, setDetailModalTable] = useState<Table | null>(null);
    const [detailModalParticipant, setDetailModalParticipant] = useState<Participant | null>(null);
    const [isMoveSeatModalOpen, setMoveSeatModalOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<{ participant: Participant; table: Table; seatIndex: number } | null>(null);
    const [actionMenu, setActionMenu] = useState<{ x: number, y: number } | null>(null);

    // 테이블 선택 모드 state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
    const [targetTournamentId, setTargetTournamentId] = useState<string>('');

    // 확인 모달 state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });
    
    const handleMaxSeatsChange = (newMaxSeats: number) => {
        if (newMaxSeats > 0) {
            updateSettings({ maxSeatsPerTable: newMaxSeats });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (isMobile) return;
        const { active, over } = event;
        
        if (over && active.id !== over.id) {
            const oldIndex = tables.findIndex((t) => t.id === active.id);
            const newIndex = tables.findIndex((t) => t.id === over.id);
            
            if (oldIndex !== -1 && newIndex !== -1) {
                const newTables = arrayMove(tables, oldIndex, newIndex);
                setTables(newTables);
                updateTableOrder(newTables);
            }
        }
    };

    const getParticipantName = (participantId: string | null): string => {
        if (!participantId) return t('tables.participantEmpty');
        const p = participants.find(p => p.id === participantId);
        return p ? p.name : t('tables.participantUnknown');
    };

    // getStaffName - 향후 사용 예정
    // const getStaffName = (_staffId: string | null): string => {
    //     return t('tables.dealerNotApplicable');
    // };

    const handlePlayerSelect = (participant: Participant | null, table: Table, seatIndex: number, event?: React.MouseEvent) => {
        if (participant && event) {
            logger.info('참가자가 선택되었습니다', { component: 'TablesPage', additionalData: { participantId: participant.id, participantName: participant.name, tableId: table.id, seatIndex } });
            event.preventDefault();
            event.stopPropagation();
            setActionMenu({ x: event.clientX, y: event.clientY });
            setSelectedPlayer({ participant, table, seatIndex });
        }
    };
    
    const handleShowDetails = () => {
        if (selectedPlayer?.participant) {
            setDetailModalParticipant(selectedPlayer.participant);
        }
        handleCloseActionMenu();
    };

    const handleCloseActionMenu = () => {
        // 자리 이동 모달이 열려있을 때는 액션 메뉴를 닫지 않음
        if (isMoveSeatModalOpen) return;

        setActionMenu(null);
        setSelectedPlayer(null);
    };
    
    const handleOpenMoveSeatModal = () => {
        if (selectedPlayer?.participant) {
            logger.info('자리 이동 모달 열기 시도', { component: 'TablesPage', additionalData: { participantId: selectedPlayer.participant.id, participantName: selectedPlayer.participant.name } });
            setMoveSeatModalOpen(true);
        } else {
            logger.warn('자리 이동 모달 열기 실패: selectedPlayer가 없음', { component: 'TablesPage' });
        }
        setActionMenu(null);
    };
    
    const handleCloseMoveSeatModal = () => {
        setMoveSeatModalOpen(false);
        setSelectedPlayer(null);
    };

    const handleConfirmMove = async (toTableId: string, toSeatIndex: number) => {
        if (selectedPlayer?.participant && selectedPlayer.table) {
            logger.info('자리 이동 확정 시도', {
                component: 'TablesPage',
                additionalData: {
                    participantId: selectedPlayer.participant.id,
                    participantName: selectedPlayer.participant.name,
                    fromTableId: selectedPlayer.table.id,
                    fromSeatIndex: selectedPlayer.seatIndex,
                    toTableId,
                    toSeatIndex
                }
            });

            try {
                await moveSeat(selectedPlayer.participant.id,
                    { tableId: selectedPlayer.table.id, seatIndex: selectedPlayer.seatIndex },
                    { tableId: toTableId, seatIndex: toSeatIndex }
                );
                handleCloseMoveSeatModal();
                toast.success('참가자가 성공적으로 이동되었습니다.');
                logger.info('자리 이동 성공', { component: 'TablesPage', additionalData: { participantId: selectedPlayer.participant.id } });
            } catch (error) {
                logger.error('참가자 이동 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'TablesPage' });
                toast.error('참가자 이동 중 오류가 발생했습니다.');
            }
        } else {
            logger.warn('자리 이동 확정 실패: 필요한 정보가 없음', {
                component: 'TablesPage',
                additionalData: {
                    hasSelectedPlayer: !!selectedPlayer,
                    hasParticipant: !!selectedPlayer?.participant,
                    hasTable: !!selectedPlayer?.table
                }
            });
        }
    };

    const handleBustOut = async () => {
        if (selectedPlayer?.participant) {
            await bustOutParticipant(selectedPlayer.participant.id);
        }
        handleCloseActionMenu();
    };

    const handleExportToExcel = async () => {
        setConfirmModal({
            isOpen: true,
            title: '엑셀 내보내기',
            message: `현재 테이블 배치를 엑셀 파일로 내보내시겠습니까?\n\n총 ${tables.length}개의 테이블과 ${participants.length}명의 참가자 정보가 포함됩니다.`,
            onConfirm: async () => {
                try {
                    await exportTablesToExcel(tables, participants, t);
                    toast.success(t('tables.exportExcelSuccess'));
                } catch (error) {
                    logger.error('엑셀 내보내기 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'TablesPage' });
                    toast.error(t('tables.exportExcelError'));
                }
            }
        });
    };

    // 테이블 선택 모드 관련 핸들러
    const handleToggleSelectionMode = () => {
        setIsSelectionMode(prev => !prev);
        setSelectedTableIds([]);
        setTargetTournamentId('');
    };

    const handleTableSelect = (tableId: string, checked: boolean) => {
        if (checked) {
            setSelectedTableIds(prev => [...prev, tableId]);
        } else {
            setSelectedTableIds(prev => prev.filter(id => id !== tableId));
        }
    };

    const handleAssignTables = async () => {
        if (selectedTableIds.length === 0) {
            toast.warning('할당할 테이블을 선택해주세요.');
            return;
        }

        if (!targetTournamentId) {
            toast.warning('목적지 토너먼트를 선택해주세요.');
            return;
        }

        await assignTableToTournament(selectedTableIds, targetTournamentId);
        setIsSelectionMode(false);
        setSelectedTableIds([]);
        setTargetTournamentId('');
    };

    const handleCancelSelection = () => {
        setIsSelectionMode(false);
        setSelectedTableIds([]);
        setTargetTournamentId('');
    };

    // 테이블 추가 핸들러 (전체 보기 모드)
    const handleAddTableInAllMode = async () => {
        if (state.tournamentId === 'ALL') {
            // 전체 보기 모드에서는 기본 토너먼트에 테이블 추가
            try {
                await ensureDefaultTournament(); // 기본 토너먼트 확인/생성
                await openNewTableInTournament(DEFAULT_TOURNAMENT_ID);
            } catch (error) {
                logger.error('기본 토너먼트 테이블 추가 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'TablesPage' });
                toast.error('테이블 추가 중 오류가 발생했습니다.');
            }
        } else {
            openNewTable();
        }
    };

    // 토너먼트별 범례 데이터
    const legend = useMemo(() => {
        if (state.tournamentId !== 'ALL') return [];

        const legendMap: Record<string, { color: string; count: number; name: string }> = {};

        tables.forEach(table => {
            const tid = table.tournamentId || 'UNASSIGNED';
            if (!legendMap[tid]) {
                const tournament = tournaments.find(t => t.id === tid);
                const color = tid === 'UNASSIGNED' ? UNASSIGNED_COLOR : (tournament?.color || UNASSIGNED_COLOR);
                const name = tid === 'UNASSIGNED' ? '기본 테이블' : (tournament?.name || '알 수 없음');

                legendMap[tid] = { color, count: 0, name };
            }
            legendMap[tid]!.count++;
        });

        return Object.entries(legendMap).map(([tid, data]) => ({
            id: tid,
            ...data,
        }));
    }, [state.tournamentId, tables, tournaments]);

    const onPlayerSelectInModal = (participantId: string, tableId: string, seatIndex: number, event: React.MouseEvent) => {
        const participant = participants.find(p => p.id === participantId);
        const table = tables.find(t => t.id === tableId);
        if (participant && table) {
            handlePlayerSelect(participant, table, seatIndex, event);
        }
    };

    if (tablesLoading || participantsLoading || settingsLoading) return <div className="p-4">{t('tables.loading')}</div>;
    if (tablesError || participantsError) return <div className="p-4 text-red-500">{t('tables.error')} {tablesError?.message || participantsError?.message}</div>;

    const totalEmptySeats = tables
        .filter(t => t.status === 'open')
        .reduce((sum, table) => sum + table.seats.filter(seat => seat === null).length, 0);
    
    const currentDetailTable = tables.find(t => t.id === detailModalTable?.id) || null;

    const handleContainerClick = (_e: React.MouseEvent) => {
        // 자리 이동 모달이나 다른 모달이 열려있을 때는 이벤트 무시
        if (isMoveSeatModalOpen || detailModalParticipant || currentDetailTable) return;
        handleCloseActionMenu();
    };

    return (
        <div className="p-4 bg-gray-100 min-h-screen" onClick={handleContainerClick}>
            <TournamentSelector />

            {!state.tournamentId ? (
                <div className="bg-white shadow-md rounded-lg p-8 text-center">
                    <p className="text-gray-500 mb-4">⚠️ 토너먼트를 먼저 선택해주세요.</p>
                    <p className="text-sm text-gray-400">위의 드롭다운에서 토너먼트를 선택하거나 새로 만들어주세요.</p>
                </div>
            ) : (
                <>
            {/* Header */}
            <div className="mb-6 bg-white p-4 rounded-lg shadow">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
                    <h1 className="text-3xl font-bold text-gray-800 mb-3 md:mb-0">{t('tables.title')}</h1>
                    <div className="flex flex-wrap items-center gap-2 md:space-x-3 md:gap-0">
                        {/* 전체 보기 모드에서만 테이블 배정 버튼 표시 */}
                        {state.tournamentId === 'ALL' && (
                            <button
                                onClick={handleToggleSelectionMode}
                                className={`btn text-sm ${isSelectionMode ? 'btn-secondary bg-gray-600' : 'btn-primary'}`}
                            >
                                📌 {isSelectionMode ? '취소' : '테이블 배정'}
                            </button>
                        )}
                        <button
                            onClick={handleExportToExcel}
                            className="btn btn-secondary bg-blue-600 hover:bg-blue-700 text-white text-sm"
                            disabled={tablesLoading || participantsLoading || tables.length === 0}
                        >
                            {t('tables.exportExcel')}
                        </button>
                        <button
                            onClick={() => {
                                const activePlayers = participants.filter(p => p.status === 'active');
                                setConfirmModal({
                                    isOpen: true,
                                    title: '자동 재배치',
                                    message: `활성 참가자 ${activePlayers.length}명을 자동으로 재배치하시겠습니까?\n\n현재 좌석 배치가 초기화되고 새로운 자리가 배정됩니다.`,
                                    onConfirm: async () => {
                                        await autoAssignSeats(activePlayers);
                                    }
                                });
                            }}
                            className="btn btn-secondary text-sm"
                            disabled={tablesLoading || participantsLoading || state.tournamentId === 'ALL'}
                        >
                            {t('tables.buttonAutoAssign')}
                        </button>
                        <button
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: '칩 균형 재배치',
                                    message: `참가자들을 칩 스택 기준으로 균형있게 재배치하시겠습니까?\n\n각 테이블의 평균 칩이 비슷하도록 자동으로 조정됩니다.\n현재 좌석 배치가 변경됩니다.`,
                                    onConfirm: async () => {
                                        await autoBalanceByChips(participants);
                                    }
                                });
                            }}
                            className="btn btn-secondary bg-green-600 hover:bg-green-700 text-white text-sm"
                            disabled={tablesLoading || participantsLoading || state.tournamentId === 'ALL'}
                        >
                            {t('common.chipRebalance')}
                        </button>
                        <button onClick={handleAddTableInAllMode} className="btn btn-primary text-sm">
                            {t('tables.buttonAddTable')}
                        </button>
                    </div>
                </div>

                {/* 선택 모드 활성화 시 할당 UI */}
                {isSelectionMode && state.tournamentId === 'ALL' && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="font-semibold text-gray-700">토너먼트 선택:</label>
                            <select
                                value={targetTournamentId}
                                onChange={(e) => setTargetTournamentId(e.target.value)}
                                className="input-field flex-1 min-w-[200px]"
                            >
                                <option value="">목적지 선택</option>
                                {tournaments.filter(t => t.id !== 'ALL').map(tournament => (
                                    <option key={tournament.id} value={tournament.id}>
                                        {tournament.name} ({tournament.date})
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleAssignTables}
                                className="btn btn-primary text-sm"
                                disabled={selectedTableIds.length === 0 || !targetTournamentId}
                            >
                                ✅ 할당 ({selectedTableIds.length}개)
                            </button>
                            <button
                                onClick={handleCancelSelection}
                                className="btn btn-secondary text-sm"
                            >
                                ❌ 취소
                            </button>
                        </div>
                    </div>
                )}

                {/* 범례 (전체 보기 모드) */}
                {state.tournamentId === 'ALL' && legend.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex flex-wrap items-center gap-3">
                            {legend.map(item => {
                                const emoji = COLOR_EMOJIS[item.color] || '⚪';
                                return (
                                    <div key={item.id} className="flex items-center gap-2">
                                        <span style={{ color: item.color }} className="text-lg">{emoji}</span>
                                        <span className="text-sm font-medium">{item.name}</span>
                                        <span className="text-sm text-gray-600">({item.count})</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center text-gray-600">
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center"><FaThList className="w-5 h-5 mr-2 text-blue-500" /> {t('tables.infoTables')} <span className="font-bold ml-1">{tables.length}</span></div>
                        <div className="flex items-center"><FaUserPlus className="w-5 h-5 mr-2 text-green-500" /> {t('tables.infoEmptySeats')} <span className="font-bold ml-1">{totalEmptySeats}</span></div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <label htmlFor="max-seats" className="font-semibold">{t('tables.labelMaxSeats')}</label>
                        <select
                            id="max-seats"
                            value={settings.maxSeatsPerTable || 9}
                            onChange={(e) => handleMaxSeatsChange(parseInt(e.target.value, 10))}
                            className="select select-bordered"
                            disabled={state.tournamentId === 'ALL'}
                        >
                            {Array.from({ length: 8 }, (_, i) => i + 4).map(num => (
                                <option key={num} value={num}>{num}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tables Grid */}
            <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
                <SortableContext items={tables} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {tables.map(table => {
                            // 토너먼트 색상 가져오기 (테이블에 저장된 색상 우선 사용, 없으면 토너먼트 목록에서 찾기)
                            const tournamentColor = table.tournamentColor || getTournamentColorById(table.tournamentId, tournaments) || UNASSIGNED_COLOR;

                            return (
                                <TableCard
                                    key={table.id}
                                    table={table}
                                    onTableClick={() => {
                                        // 배정 모드일 때는 선택 토글, 일반 모드일 때는 모달 열기
                                        if (isSelectionMode) {
                                            handleTableSelect(table.id, !selectedTableIds.includes(table.id));
                                        } else {
                                            setDetailModalTable(table);
                                        }
                                    }}
                                    isMobile={isMobile}
                                    getDealerName={(staffId) => staffId || t('common.undecided')}
                                    participants={participants}
                                    onPlayerSelect={handlePlayerSelect}
                                    tournamentColor={tournamentColor}
                                    isSelectionMode={isSelectionMode}
                                    isSelected={selectedTableIds.includes(table.id)}
                                    onSelect={(checked) => handleTableSelect(table.id, checked)}
                                />
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Modals */}
            {currentDetailTable ? <TableDetailModal
                    isOpen={!!currentDetailTable}
                    onClose={() => setDetailModalTable(null)}
                    table={currentDetailTable}
                    activateTable={activateTable}
                    onCloseTable={closeTable}
                    getParticipantName={getParticipantName}
                    participants={participants}
                    onMoveSeat={moveSeat}
                    _onBustOut={(participantId) => bustOutParticipant(participantId)}
                    onPlayerSelect={onPlayerSelectInModal}
                    updateTableDetails={updateTableDetails}
                    updateTableMaxSeats={updateTableMaxSeats}
                /> : null}
            
            {actionMenu && selectedPlayer?.participant ? <PlayerActionModal
                    isOpen={!!actionMenu}
                    onClose={handleCloseActionMenu}
                    position={{ top: actionMenu.y, left: actionMenu.x }}
                    _onBustOut={handleBustOut}
                    onMoveSeat={handleOpenMoveSeatModal}
                    onShowDetails={handleShowDetails}
                /> : null}

            {isMoveSeatModalOpen && selectedPlayer?.participant ? <MoveSeatModal
                    isOpen={isMoveSeatModalOpen}
                    onClose={handleCloseMoveSeatModal}
                    tables={tables}
                    movingParticipant={selectedPlayer.participant}
                    onConfirmMove={handleConfirmMove}
                    getParticipantName={getParticipantName}
                /> : null}
            
            {detailModalParticipant ? <ParticipantDetailModal
                    isOpen={!!detailModalParticipant}
                    onClose={() => setDetailModalParticipant(null)}
                    participant={detailModalParticipant}
                    onUpdate={updateParticipant}
                /> : null}

            {/* 확인 모달 */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
            />
                </>
            )}
        </div>
    );
};

export default TablesPage;
