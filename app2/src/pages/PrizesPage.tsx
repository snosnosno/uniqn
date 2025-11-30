import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../utils/toast';

import { useTournament } from '../contexts/TournamentContextAdapter';
import TournamentSelector from '../components/TournamentSelector';

// 예시: ITM(In The Money) 비율에 따른 상금 분배 (조정 가능)
const PRIZE_DISTRIBUTION_RULES = {
  10: [1], // 10%
  15: [0.7, 0.3], // 15%
  20: [0.6, 0.3, 0.1], // 20%
};

// 가장 가까운 규칙을 찾는 헬퍼 함수
const getDistribution = (itmPercentage: number) => {
  const percentages = Object.keys(PRIZE_DISTRIBUTION_RULES).map(Number);
  const closest = percentages.reduce((prev, curr) =>
    Math.abs(curr - itmPercentage) < Math.abs(prev - itmPercentage) ? curr : prev
  );
  return PRIZE_DISTRIBUTION_RULES[closest as keyof typeof PRIZE_DISTRIBUTION_RULES];
};

const PrizesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { state } = useTournament();
  const { participants, settings } = state;

  const [manualPayouts, setManualPayouts] = useState<number[]>([]);
  const [isManual, setIsManual] = useState(false);

  const totalPlayers = participants.length;
  const buyIn = settings.startingChips; // 예시로 startingChips를 바이인으로 사용
  const prizePool = totalPlayers * buyIn;

  const itmCount = useMemo(() => {
    // ITM을 전체 참가자의 15%로 가정 (설정으로 뺄 수 있음)
    return Math.max(1, Math.floor(totalPlayers * 0.15));
  }, [totalPlayers]);

  const calculatedPayouts = useMemo(() => {
    if (totalPlayers === 0) return [];
    const itmPercentage = (itmCount / totalPlayers) * 100;
    const distribution = getDistribution(itmPercentage);
    return distribution.map((ratio) => Math.floor(prizePool * ratio));
  }, [prizePool, itmCount, totalPlayers]);

  useEffect(() => {
    setManualPayouts(calculatedPayouts);
  }, [calculatedPayouts]);

  const handleManualChange = (index: number, value: string) => {
    const newPayouts = [...manualPayouts];
    newPayouts[index] = parseInt(value, 10) || 0;
    setManualPayouts(newPayouts);
  };

  const handleSave = () => {
    // const payoutsToSave = isManual ? manualPayouts : calculatedPayouts;
    // SAVE_PAYOUTS action not yet implemented
    toast.success(t('prizes.alertSaved'));
  };

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';
    const currency = i18n.language === 'ko' ? 'KRW' : 'USD';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  };

  const totalManualPayout = manualPayouts.reduce((sum, v) => sum + v, 0);

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <TournamentSelector />

      {!state.tournamentId ? (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">⚠️ 토너먼트를 먼저 선택해주세요.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            위의 드롭다운에서 토너먼트를 선택하거나 새로 만들어주세요.
          </p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('prizes.title')}
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-4 text-center">
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('prizes.totalPrizePool')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(prizePool)}
              </p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.participants')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalPlayers}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('prizes.itm')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{itmCount}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2 cursor-pointer text-gray-900 dark:text-gray-100">
              <input
                type="checkbox"
                checked={isManual}
                onChange={(e) => setIsManual(e.target.checked)}
                className="rounded"
              />
              {t('prizes.adjustManually')}
            </label>
            {isManual ? (
              <div
                className={`text-sm ${totalManualPayout > prizePool ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-300'}`}
              >
                {t('prizes.totalDistributed')} {formatCurrency(totalManualPayout)}
              </div>
            ) : null}
          </div>

          <div className="space-y-2 mb-4">
            {(isManual ? manualPayouts : calculatedPayouts).map((payout, i) => (
              <div key={`rank-${i + 1}`} className="flex items-center gap-4">
                <span className="font-semibold w-12 text-lg text-gray-900 dark:text-gray-100">
                  {t('prizes.rank', { rank: i + 1 })}
                </span>
                {isManual ? (
                  <input
                    type="number"
                    value={payout}
                    onChange={(e) => handleManualChange(i, e.target.value)}
                    className="input-field !mt-0 flex-grow"
                  />
                ) : (
                  <span className="text-lg font-mono bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1 rounded-md">
                    {formatCurrency(payout)}
                  </span>
                )}
              </div>
            ))}
          </div>

          <button onClick={handleSave} className="btn btn-primary w-full mt-4">
            {t('prizes.saveButton')}
          </button>
        </div>
      )}
    </div>
  );
};

export default PrizesPage;
