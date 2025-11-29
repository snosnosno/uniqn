import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTournament } from '../contexts/TournamentContext';
import { useTournamentData } from '../contexts/TournamentDataContext';
import { Tournament, isDefaultTournament } from '../hooks/useTournaments';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/modals/ConfirmModal';
import {
  FaPlus,
  FaCog,
  FaTrash,
  FaCheck,
  FaChevronDown,
} from '../components/Icons/ReactIconsReplacement';
import { TOURNAMENT_COLORS, COLOR_EMOJIS } from '../utils/tournamentColors';
import { useGroupByDate } from '../hooks/useGroupByDate';
import { formatDateDisplay, toISODateString } from '../utils/dateUtils';

const TournamentsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, dispatch } = useTournament();
  const { tournaments, loading, error, createTournament, updateTournament, deleteTournament } =
    useTournamentData();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [deletingTournamentId, setDeletingTournamentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<{
    name: string;
    date: string;
    location: string;
    status: Tournament['status'];
    color: string;
  }>({
    name: '',
    date: '',
    location: '',
    status: 'upcoming',
    color: TOURNAMENT_COLORS[0], // 기본 색상
  });

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      location: '',
      status: 'upcoming',
      color: TOURNAMENT_COLORS[0],
    });
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setFormData({
      name: tournament.name,
      date: tournament.date,
      location: tournament.location || '',
      status: tournament.status,
      color: tournament.color || TOURNAMENT_COLORS[0],
    });
    setIsEditModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.date) {
      toast.warning(t('toast.tournament.inputRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await createTournament({
        name: formData.name,
        date: formData.date,
        location: formData.location,
        status: formData.status,
        color: formData.color,
      });
      toast.success(t('toast.tournament.createSuccess'));
      setIsCreateModalOpen(false);
      resetForm();
    } catch (err) {
      logger.error('토너먼트 생성 실패:', err instanceof Error ? err : new Error(String(err)), {
        component: 'TournamentsPage',
      });
      toast.error(t('toast.tournament.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTournament) return;
    if (!formData.name || !formData.date) {
      toast.warning(t('toast.tournament.inputRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTournament(editingTournament.id, {
        name: formData.name,
        date: formData.date,
        location: formData.location,
        status: formData.status,
        color: formData.color,
      });
      toast.success(t('toast.tournament.updateSuccess'));
      setIsEditModalOpen(false);
      setEditingTournament(null);
      resetForm();
    } catch (err) {
      logger.error('토너먼트 수정 실패:', err instanceof Error ? err : new Error(String(err)), {
        component: 'TournamentsPage',
      });
      toast.error(t('toast.tournament.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (tournamentId: string) => {
    setDeletingTournamentId(tournamentId);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTournamentId) return;

    setIsSubmitting(true);
    try {
      await deleteTournament(deletingTournamentId);

      // 삭제된 토너먼트가 현재 선택된 토너먼트라면 초기화
      if (state.tournamentId === deletingTournamentId) {
        dispatch({ type: 'SET_TOURNAMENT', payload: { tournamentId: null } });
        localStorage.removeItem('lastTournamentId');
      }

      toast.success(t('toast.tournament.deleteSuccess'));
      setIsDeleteConfirmOpen(false);
      setDeletingTournamentId(null);
    } catch (err) {
      logger.error('토너먼트 삭제 실패:', err instanceof Error ? err : new Error(String(err)), {
        component: 'TournamentsPage',
      });
      toast.error(t('toast.tournament.deleteError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTournament = (tournamentId: string) => {
    dispatch({ type: 'SET_TOURNAMENT', payload: { tournamentId } });
    localStorage.setItem('lastTournamentId', tournamentId);
    toast.success(t('toast.tournament.selectSuccess'));
    navigate('/app/participants');
  };

  const getStatusLabel = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return '예정';
      case 'active':
        return '진행 중';
      case 'completed':
        return '완료';
    }
  };

  const getStatusColor = (status: Tournament['status']) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'completed':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  // 기본 테이블 토너먼트 필터링 (날짜별 전체보기 토너먼트 숨김)
  const visibleTournaments = useMemo(
    () => tournaments.filter((tournament) => !isDefaultTournament(tournament.id)),
    [tournaments]
  );

  // 날짜별 그룹화 (useGroupByDate 훅 사용)
  const { groupedData, isExpanded, toggleExpansion, expandAll, collapseAll, getItemCount } =
    useGroupByDate<Tournament>({
      data: visibleTournaments,
      getDateKey: (tournament) => tournament.dateKey || tournament.date,
      sortItems: (a, b) => {
        // 같은 날짜 내에서 시간순 정렬
        return a.name.localeCompare(b.name);
      },
      storageKey: 'tournament_sections_expanded',
      defaultExpanded: true,
    });

  // 상대적 날짜 라벨 생성 (오늘, 내일 등)
  const getDateLabel = (dateKey: string): string => {
    const today = toISODateString(new Date()) || '';
    const tomorrow = toISODateString(new Date(Date.now() + 86400000)) || '';

    if (dateKey === today) {
      return '오늘';
    } else if (dateKey === tomorrow) {
      return '내일';
    } else {
      return formatDateDisplay(dateKey);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
        <div className="text-red-500 dark:text-red-400">
          토너먼트 목록을 불러오는데 실패했습니다: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">토너먼트 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={collapseAll}
            className="btn btn-secondary btn-sm"
            disabled={isSubmitting}
          >
            전체 접기
          </button>
          <button onClick={expandAll} className="btn btn-secondary btn-sm" disabled={isSubmitting}>
            전체 펼치기
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="btn btn-primary flex items-center gap-2"
            disabled={isSubmitting}
          >
            <FaPlus className="w-4 h-4" />새 토너먼트
          </button>
        </div>
      </div>

      {visibleTournaments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">생성된 토너먼트가 없습니다.</p>
          <button onClick={handleOpenCreateModal} className="btn btn-primary">
            첫 번째 토너먼트 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 날짜별 섹션 */}
          {groupedData.sortedKeys.map((dateKey) => {
            const tournamentsInDate = groupedData.grouped[dateKey] || [];
            const expanded = isExpanded(dateKey);
            const count = getItemCount(dateKey);

            return (
              <div
                key={dateKey}
                className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden"
              >
                {/* 날짜 섹션 헤더 */}
                <button
                  onClick={() => toggleExpansion(dateKey)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 hover:from-blue-100 hover:to-blue-150 dark:hover:from-blue-900/40 dark:hover:to-blue-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expanded ? (
                      <FaChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400 text-xl">▶</span>
                    )}
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      {getDateLabel(dateKey)}
                      <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-300">
                        ({count}개)
                      </span>
                    </h2>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{dateKey}</div>
                </button>

                {/* 토너먼트 카드 그리드 (확장 시에만 표시) */}
                {expanded && (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tournamentsInDate.map((tournament) => (
                        <div
                          key={tournament.id}
                          className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow border-l-8"
                          style={{ borderLeftColor: tournament.color || TOURNAMENT_COLORS[0] }}
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">
                                {COLOR_EMOJIS[tournament.color || TOURNAMENT_COLORS[0]]}
                              </span>
                              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                {tournament.name}
                              </h3>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(tournament.status)}`}
                            >
                              {getStatusLabel(tournament.status)}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSelectTournament(tournament.id)}
                              className={`btn btn-sm flex-1 flex items-center justify-center gap-1 ${
                                state.tournamentId === tournament.id
                                  ? 'btn-primary'
                                  : 'btn-secondary'
                              }`}
                              disabled={isSubmitting}
                            >
                              {state.tournamentId === tournament.id && (
                                <FaCheck className="w-3 h-3" />
                              )}
                              선택
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(tournament)}
                              className="btn btn-secondary btn-sm"
                              disabled={isSubmitting}
                            >
                              <FaCog className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(tournament.id)}
                              className="btn btn-danger btn-sm"
                              disabled={isSubmitting}
                            >
                              <FaTrash className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !isSubmitting && setIsCreateModalOpen(false)}
        title="새 토너먼트 만들기"
        closeOnEsc={!isSubmitting}
        closeOnBackdrop={!isSubmitting}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">토너먼트 이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field w-full"
              placeholder="예: 2025 홀덤 대회"
              required
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">날짜 *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="input-field w-full"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">장소</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input-field w-full"
              placeholder="예: 서울 강남구"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">상태</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as Tournament['status'] })
              }
              className="input-field w-full"
              disabled={isSubmitting}
            >
              <option value="upcoming">예정</option>
              <option value="active">진행 중</option>
              <option value="completed">완료</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">색상 *</label>
            <div className="flex gap-3 flex-wrap">
              {TOURNAMENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  disabled={isSubmitting}
                  className={`w-12 h-12 rounded-lg border-4 transition-all flex items-center justify-center ${
                    formData.color === color
                      ? 'border-gray-800 dark:border-gray-200 scale-110'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {formData.color === color && (
                    <span className="text-white text-2xl font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title="토너먼트 수정"
        closeOnEsc={!isSubmitting}
        closeOnBackdrop={!isSubmitting}
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">토너먼트 이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field w-full"
              required
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">날짜 *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="input-field w-full"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">장소</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input-field w-full"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">상태</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as Tournament['status'] })
              }
              className="input-field w-full"
              disabled={isSubmitting}
            >
              <option value="upcoming">예정</option>
              <option value="active">진행 중</option>
              <option value="completed">완료</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">색상 *</label>
            <div className="flex gap-3 flex-wrap">
              {TOURNAMENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  disabled={isSubmitting}
                  className={`w-12 h-12 rounded-lg border-4 transition-all flex items-center justify-center ${
                    formData.color === color
                      ? 'border-gray-800 dark:border-gray-200 scale-110'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {formData.color === color && (
                    <span className="text-white text-2xl font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? '수정 중...' : '수정'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => !isSubmitting && setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="토너먼트 삭제"
        message="이 토너먼트를 삭제하시겠습니까? 관련된 모든 데이터가 함께 삭제됩니다."
        confirmText="삭제"
        cancelText="취소"
        isDangerous={true}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default TournamentsPage;
