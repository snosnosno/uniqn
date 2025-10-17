import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';

import { db } from '../firebase';

import { logAction } from './useLogger';

export interface TournamentSettings {
  minWorkMinutesForClockOut?: number;
  qrClockInEnabled?: boolean;
  qrCodeValue?: string;
  maxSeatsPerTable?: number;
}

export const useSettings = (userId: string | null, tournamentId: string | null) => {
  const [settings, setSettings] = useState<TournamentSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || !tournamentId) {
      setSettings({
        minWorkMinutesForClockOut: 60,
        qrClockInEnabled: true,
        maxSeatsPerTable: 9,
      });
      setLoading(false);
      return;
    }

    const settingsDocRef = doc(db, `users/${userId}/tournaments/${tournamentId}/settings`, 'tournament');

    const unsubscribe = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as TournamentSettings);
        } else {
          // Default settings if the document doesn't exist
          setSettings({
            minWorkMinutesForClockOut: 60,
            qrClockInEnabled: true,
            maxSeatsPerTable: 9,
          });
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching settings:', err instanceof Error ? err : new Error(String(err)), { component: 'useSettings' });
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, tournamentId]);
  
  const updateSettings = async (newSettings: Partial<TournamentSettings>) => {
    if (!userId || !tournamentId) {
      throw new Error('사용자 ID와 토너먼트 ID가 필요합니다.');
    }
    const settingsDocRef = doc(db, `users/${userId}/tournaments/${tournamentId}/settings`, 'tournament');
    try {
      await setDoc(settingsDocRef, newSettings, { merge: true });
      logAction('settings_updated', { ...newSettings });
    } catch (e) {
      logger.error('Error updating settings:', e instanceof Error ? e : new Error(String(e)), { component: 'useSettings' });
      setError(e as Error);
    }
  };

  return { settings, loading, error, updateSettings };
};

export default useSettings;
