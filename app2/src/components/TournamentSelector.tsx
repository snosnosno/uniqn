import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTournament } from '../contexts/TournamentContextAdapter';
import { useTournamentData } from '../contexts/TournamentDataContext';
import { isDefaultTournament, getDefaultTournamentId } from '../hooks/useTournaments';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { FaCog } from './Icons/ReactIconsReplacement';

interface TournamentSelectorProps {
  className?: string;
  dateFilter?: string | null; // YYYY-MM-DD 형식의 날짜 필터 (옵션)
}

const TournamentSelector: React.FC<TournamentSelectorProps> = ({
  className = '',
  dateFilter = null,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, dispatch } = useTournament();
  const { tournaments, loading } = useTournamentData();

  // 날짜 필터가 있으면 해당 날짜의 토너먼트만 표시
  const filteredTournaments = React.useMemo(() => {
    if (!dateFilter) return tournaments;
    return tournaments.filter((t) => t.dateKey === dateFilter || t.date === dateFilter);
  }, [tournaments, dateFilter]);

  // 날짜별 기본 토너먼트(전체보기) 찾기
  const defaultTournamentForDate = React.useMemo(() => {
    if (!dateFilter) return null;
    const defaultId = getDefaultTournamentId(dateFilter);
    return tournaments.find((t) => t.id === defaultId);
  }, [tournaments, dateFilter]);

  const handleTournamentChange = (tournamentId: string) => {
    if (!tournamentId) return;

    dispatch({ type: 'SET_TOURNAMENT', payload: { tournamentId } });
    localStorage.setItem('lastTournamentId', tournamentId);

    logger.info('토너먼트 선택 변경', {
      component: 'TournamentSelector',
      data: { tournamentId },
    });

    toast.success(t('toast.tournament.changeSuccess'));
  };

  const handleManageTournaments = () => {
    navigate('/app/tournaments');
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 mb-4 ${className}`}>
        <div className="text-gray-500 dark:text-gray-400 text-sm">로딩 중...</div>
      </div>
    );
  }

  const selectedTournament = tournaments.find((t) => t.id === state.tournamentId);

  return (
    <div className={`bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
          🏆 토너먼트:
        </label>
        <select
          value={state.tournamentId || ''}
          onChange={(e) => handleTournamentChange(e.target.value)}
          className="input-field flex-1 min-w-0"
          disabled={filteredTournaments.length === 0}
        >
          {filteredTournaments.length === 0 ? (
            <option value="">
              {dateFilter ? '선택한 날짜에 토너먼트가 없습니다' : '토너먼트가 없습니다'}
            </option>
          ) : (
            <>
              <option value="">선택하세요</option>
              {!dateFilter && <option value="ALL">🌐 전체 토너먼트</option>}
              {/* 날짜가 선택되었고 해당 날짜의 기본 토너먼트가 있으면 표시 */}
              {dateFilter && defaultTournamentForDate && (
                <option value={defaultTournamentForDate.id}>🌐 전체 ({dateFilter})</option>
              )}
              {filteredTournaments
                .filter((tournament) => !isDefaultTournament(tournament.id))
                .map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name} ({tournament.date})
                  </option>
                ))}
            </>
          )}
        </select>
        <button
          onClick={handleManageTournaments}
          className="btn btn-secondary btn-sm flex items-center gap-1 whitespace-nowrap"
          title="토너먼트 관리"
        >
          <FaCog className="w-4 h-4" />
          <span className="hidden sm:inline">관리</span>
        </button>
      </div>

      {selectedTournament && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {selectedTournament.location && `📍 ${selectedTournament.location} | `}
          상태: {selectedTournament.status === 'upcoming' && '예정'}
          {selectedTournament.status === 'active' && '진행 중'}
          {selectedTournament.status === 'completed' && '완료'}
        </div>
      )}
    </div>
  );
};

export default TournamentSelector;
