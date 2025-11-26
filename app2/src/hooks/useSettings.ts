import { doc, setDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { useMemo } from 'react';

import { db } from '../firebase';
import { useFirestoreDocument } from './firestore';

import { logAction } from './useLogger';

export interface TournamentSettings {
  minWorkMinutesForClockOut?: number;
  qrClockInEnabled?: boolean;
  qrCodeValue?: string;
  maxSeatsPerTable?: number;
}

// 기본 설정
const DEFAULT_SETTINGS: TournamentSettings = {
  minWorkMinutesForClockOut: 60,
  qrClockInEnabled: true,
  maxSeatsPerTable: 9,
};

export const useSettings = (userId: string | null, tournamentId: string | null) => {
  // 문서 경로 생성
  const settingsPath = useMemo(() => {
    if (!userId || !tournamentId) return null;
    return `users/${userId}/tournaments/${tournamentId}/settings/tournament`;
  }, [userId, tournamentId]);

  // useFirestoreDocument로 구독
  const {
    data: settingsData,
    loading,
    error,
  } = useFirestoreDocument<TournamentSettings>(settingsPath || '', {
    enabled: settingsPath !== null,
    errorOnNotFound: false,
    onError: (err) => {
      logger.error('Error fetching settings:', err, { component: 'useSettings' });
    },
  });

  // 문서가 없으면 기본 설정 반환
  const settings = useMemo(() => {
    return settingsData || DEFAULT_SETTINGS;
  }, [settingsData]);

  const updateSettings = async (newSettings: Partial<TournamentSettings>) => {
    if (!userId || !tournamentId) {
      throw new Error('사용자 ID와 토너먼트 ID가 필요합니다.');
    }
    const settingsDocRef = doc(
      db,
      `users/${userId}/tournaments/${tournamentId}/settings`,
      'tournament'
    );
    try {
      await setDoc(settingsDocRef, newSettings, { merge: true });
      logAction('settings_updated', { ...newSettings });
    } catch (e) {
      logger.error('Error updating settings:', e instanceof Error ? e : new Error(String(e)), {
        component: 'useSettings',
      });
      throw e;
    }
  };

  return { settings, loading, error, updateSettings };
};

export default useSettings;
