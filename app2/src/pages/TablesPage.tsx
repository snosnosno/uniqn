import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaThList, FaUserPlus } from '../components/Icons/ReactIconsReplacement';

import MoveSeatModal from '../components/modals/MoveSeatModal';
import ParticipantDetailModal from '../components/modals/ParticipantDetailModal';
import PlayerActionModal from '../components/modals/PlayerActionModal';
import TableCard from '../components/tables/TableCard';
import TableDetailModal from '../components/modals/TableDetailModal';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useParticipants, Participant } from '../hooks/useParticipants';
import { useSettings } from '../hooks/useSettings';
import { useTables, Table } from '../hooks/useTables';
import { exportTablesToExcel } from '../utils/excelExport';

const TablesPage: React.FC = () => {
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
        closeTable,
        autoAssignSeats,
        autoBalanceByChips,
        activateTable,
        updateTableDetails,
        updateTableMaxSeats,
    } = useTables(null, null);
    
    const { 
        participants, 
        loading: participantsLoading, 
        error: participantsError, 
        updateParticipant 
    } = useParticipants(null, null);

    const { settings, updateSettings, loading: settingsLoading } = useSettings();
    
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [detailModalTable, setDetailModalTable] = useState<Table | null>(null);
    const [detailModalParticipant, setDetailModalParticipant] = useState<Participant | null>(null);
    const [isMoveSeatModalOpen, setMoveSeatModalOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<{ participant: Participant; table: Table; seatIndex: number } | null>(null);
    const [actionMenu, setActionMenu] = useState<{ x: number, y: number } | null>(null);
    
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
        try {
            await exportTablesToExcel(tables, participants, t);
            toast.success(t('tables.exportExcelSuccess'));
        } catch (error) {
            logger.error('엑셀 내보내기 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'TablesPage' });
            toast.error(t('tables.exportExcelError'));
        }
    };
    
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
            {/* Header */}
            <div className="mb-6 bg-white p-4 rounded-lg shadow">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
                    <h1 className="text-3xl font-bold text-gray-800 mb-3 md:mb-0">{t('tables.title')}</h1>
                    <div className="flex flex-wrap items-center gap-2 md:space-x-3 md:gap-0">
                        <button
                            onClick={handleExportToExcel}
                            className="btn btn-secondary bg-blue-600 hover:bg-blue-700 text-white text-sm"
                            disabled={tablesLoading || participantsLoading || tables.length === 0}
                        >
                            {t('tables.exportExcel')}
                        </button>
                        <button
                            onClick={() => autoAssignSeats(participants.filter(p => p.status === 'active'))}
                            className="btn btn-secondary text-sm"
                            disabled={tablesLoading || participantsLoading}
                        >
                            {t('tables.buttonAutoAssign')}
                        </button>
                        <button
                            onClick={() => autoBalanceByChips(participants)}
                            className="btn btn-secondary bg-green-600 hover:bg-green-700 text-white text-sm"
                            disabled={tablesLoading || participantsLoading}
                        >
                            {t('common.chipRebalance')}
                        </button>
                        <button onClick={openNewTable} className="btn btn-primary text-sm">
                            {t('tables.buttonAddTable')}
                        </button>
                    </div>
                </div>

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
                        {tables.map(table => (
                            <TableCard
                                key={table.id}
                                table={table}
                                onTableClick={() => setDetailModalTable(table)}
                                isMobile={isMobile}
                                getDealerName={(staffId) => staffId || t('common.undecided')}
                                participants={participants}
                                onPlayerSelect={handlePlayerSelect}
                            />
                        ))}
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
        </div>
    );
};

export default TablesPage;
