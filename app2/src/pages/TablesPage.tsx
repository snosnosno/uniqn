import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { logger } from '../utils/logger';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaThList, FaUserPlus } from '../components/Icons/ReactIconsReplacement';

import MoveSeatModal from '../components/modals/MoveSeatModal';
import ParticipantDetailModal from '../components/modals/ParticipantDetailModal';
import PlayerActionModal from '../components/modals/PlayerActionModal';
import TableCard from '../components/tables/TableCard';
import TableDetailModal from '../components/modals/TableDetailModal';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useParticipants, Participant } from '../hooks/useParticipants';
import { useSettings } from '../hooks/useSettings';
import { useTables, Table } from '../hooks/useTables';

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
    } = useTables();
    
    const { 
        participants, 
        loading: participantsLoading, 
        error: participantsError, 
        updateParticipant 
    } = useParticipants();

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

    const getStaffName = (_staffId: string | null): string => {
        return t('tables.dealerNotApplicable');
    };

    const handlePlayerSelect = (participant: Participant | null, table: Table, seatIndex: number, event?: React.MouseEvent) => {
        if (participant && event) {
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
        setActionMenu(null);
        setSelectedPlayer(null);
    };
    
    const handleOpenMoveSeatModal = () => {
        if (selectedPlayer?.participant) {
            setMoveSeatModalOpen(true);
        }
        setActionMenu(null);
    };
    
    const handleCloseMoveSeatModal = () => {
        setMoveSeatModalOpen(false);
        setSelectedPlayer(null);
    };

    const handleConfirmMove = async (toTableId: string, toSeatIndex: number) => {
        if (selectedPlayer?.participant && selectedPlayer.table) {
            try {
                await moveSeat(selectedPlayer.participant.id,
                    { tableId: selectedPlayer.table.id, seatIndex: selectedPlayer.seatIndex },
                    { tableId: toTableId, seatIndex: toSeatIndex }
                );
                handleCloseMoveSeatModal();
            } catch (error) {
                logger.error('Failed to move participant:', error instanceof Error ? error : new Error(String(error)), { component: 'TablesPage' });
                alert(`${t('tables.errorMoveFailed')} ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };

    const handleBustOut = async () => {
        if (selectedPlayer?.participant) {
            await bustOutParticipant(selectedPlayer.participant.id);
        }
        handleCloseActionMenu();
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

    return (
        <div className="p-4 bg-gray-100 min-h-screen" onClick={handleCloseActionMenu}>
            {/* Header */}
            <div className="mb-6 bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold text-gray-800">{t('tables.title')}</h1>
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={() => autoAssignSeats(participants.filter(p => p.status === 'active'))}
                            className="btn btn-secondary"
                            disabled={tablesLoading || participantsLoading}
                        >
                            {t('tables.buttonAutoAssign')}
                        </button>
                        <button 
                            onClick={() => autoBalanceByChips(participants)}
                            className="btn btn-secondary bg-green-600 hover:bg-green-700 text-white"
                            disabled={tablesLoading || participantsLoading}
                        >
                            칩 균형 재배치
                        </button>
                        <button onClick={openNewTable} className="btn btn-primary">
                            <FaPlus className="w-4 h-4 mr-2"/>{t('tables.buttonAddTable')}
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
                                getDealerName={(staffId) => staffId || '미정'}
                                participants={participants}
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
