import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';

import { db } from '../firebase';

import { logAction } from './useLogger';

export interface TournamentSettings {
  minWorkMinutesForClockOut?: number;
  gpsClockInEnabled?: boolean;
  qrClockInEnabled?: boolean;
  allowedLocation?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  qrCodeValue?: string;
  maxSeatsPerTable?: number;
}

export const useSettings = () => {
  const [settings, setSettings] = useState<TournamentSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const settingsDocRef = doc(db, 'tournaments', 'settings');

    const unsubscribe = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as TournamentSettings);
        } else {
          // Default settings if the document doesn't exist
          setSettings({
            minWorkMinutesForClockOut: 60,
            gpsClockInEnabled: true,
            qrClockInEnabled: true,
            maxSeatsPerTable: 9,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching settings:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);
  
  const updateSettings = async (newSettings: Partial<TournamentSettings>) => {
    const settingsDocRef = doc(db, 'tournaments', 'settings');
    try {
      await setDoc(settingsDocRef, newSettings, { merge: true });
      logAction('settings_updated', { ...newSettings });
    } catch (e) {
      console.error("Error updating settings:", e);
      setError(e as Error);
    }
  };

  return { settings, loading, error, updateSettings };
};

export default useSettings;
