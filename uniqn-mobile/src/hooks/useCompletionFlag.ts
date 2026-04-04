/**
 * UNIQN Mobile - completion flag state management
 *
 * Shared persistence layer for "show once" UX such as onboarding and tutorials.
 * Uses MMKV for fast local reads and mirrors to secure storage so the flag
 * survives app restarts even when MMKV falls back to volatile memory storage.
 */

import { useCallback, useEffect, useState } from 'react';
import { getMMKVInstance } from '@/lib/mmkvStorage';
import {
  getItem as getSecureStorageItem,
  setItem as setSecureStorageItem,
  deleteItem as deleteSecureStorageItem,
} from '@/lib/secureStorage';
import { useUserHash } from '@/hooks/useUserHash';
import { logger } from '@/utils/logger';

export interface UseCompletionFlagOptions {
  readonly completedKeyPrefix: string;
  readonly versionKeyPrefix: string;
  readonly currentVersion: number;
  readonly timeoutMs?: number;
  readonly delayMs?: number;
  readonly label?: string;
  readonly onTimeout?: () => void;
}

export interface UseCompletionFlagReturn {
  readonly needsAction: boolean;
  readonly complete: () => void;
  readonly reset: () => void;
  readonly isLoading: boolean;
}

interface CompletionStateSnapshot {
  isCompleted: boolean;
  savedVersion: number;
}

function parseSavedVersion(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

async function loadSnapshot(
  completedKey: string,
  versionKey: string
): Promise<CompletionStateSnapshot> {
  const mmkv = getMMKVInstance();
  const mmkvCompletedValue = mmkv.getString(completedKey);
  const mmkvVersionValue = mmkv.getString(versionKey);

  const [secureCompletedValue, secureVersionValue] = await Promise.all([
    getSecureStorageItem<boolean>(completedKey),
    getSecureStorageItem<number>(versionKey),
  ]);

  const isCompleted = mmkvCompletedValue === 'true' || secureCompletedValue === true;
  const savedVersion = Math.max(
    parseSavedVersion(mmkvVersionValue),
    parseSavedVersion(secureVersionValue)
  );

  if (isCompleted && mmkvCompletedValue !== 'true') {
    mmkv.set(completedKey, 'true');
  }

  if (savedVersion > 0 && mmkvVersionValue !== String(savedVersion)) {
    mmkv.set(versionKey, String(savedVersion));
  }

  if (isCompleted && secureCompletedValue !== true) {
    await setSecureStorageItem(completedKey, true);
  }

  if (savedVersion > 0 && secureVersionValue !== savedVersion) {
    await setSecureStorageItem(versionKey, savedVersion);
  }

  return {
    isCompleted,
    savedVersion,
  };
}

function mirrorCompletedState(
  completedKey: string,
  versionKey: string,
  currentVersion: number,
  label: string
): void {
  const mmkv = getMMKVInstance();
  mmkv.set(completedKey, 'true');
  mmkv.set(versionKey, String(currentVersion));

  void Promise.all([
    setSecureStorageItem(completedKey, true),
    setSecureStorageItem(versionKey, currentVersion),
  ]).catch((error) => {
    logger.warn(`${label} secure mirror save failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function clearMirroredState(completedKey: string, versionKey: string, label: string): void {
  const mmkv = getMMKVInstance();
  mmkv.delete(completedKey);
  mmkv.delete(versionKey);

  void Promise.all([
    deleteSecureStorageItem(completedKey),
    deleteSecureStorageItem(versionKey),
  ]).catch((error) => {
    logger.warn(`${label} secure mirror reset failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function useCompletionFlag(options: UseCompletionFlagOptions): UseCompletionFlagReturn {
  const {
    completedKeyPrefix,
    versionKeyPrefix,
    currentVersion,
    timeoutMs,
    delayMs,
    label = 'completionFlag',
    onTimeout,
  } = options;

  const userHash = useUserHash();
  const [isLoading, setIsLoading] = useState(true);
  const [needsAction, setNeedsAction] = useState(false);
  const [isDelaying, setIsDelaying] = useState(false);

  const completedKey = userHash ? `${completedKeyPrefix}:${userHash}` : null;
  const versionKey = userHash ? `${versionKeyPrefix}:${userHash}` : null;

  useEffect(() => {
    let isActive = true;

    if (!userHash || !completedKey || !versionKey) {
      setNeedsAction(false);
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    const loadState = async () => {
      try {
        const snapshot = await loadSnapshot(completedKey, versionKey);
        const needs = !snapshot.isCompleted || snapshot.savedVersion < currentVersion;

        if (!isActive) {
          return;
        }

        setNeedsAction(needs);

        logger.debug(`${label} state checked`, {
          userHash,
          isCompleted: snapshot.isCompleted,
          savedVersion: snapshot.savedVersion,
          currentVersion,
          needs,
        });
      } catch (error) {
        logger.error(`${label} state check failed`, error as Error);
        if (isActive) {
          setNeedsAction(false);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadState();

    return () => {
      isActive = false;
    };
  }, [userHash, completedKey, versionKey, currentVersion, label]);

  useEffect(() => {
    if (!needsAction || !delayMs) {
      setIsDelaying(false);
      return;
    }

    setIsDelaying(true);
    const timer = setTimeout(() => setIsDelaying(false), delayMs);
    return () => clearTimeout(timer);
  }, [needsAction, delayMs]);

  useEffect(() => {
    if (!needsAction || !timeoutMs || !completedKey || !versionKey) {
      return;
    }

    const timeout = setTimeout(() => {
      logger.warn(`${label} timed out and was auto-completed`);
      setNeedsAction(false);
      onTimeout?.();

      try {
        mirrorCompletedState(completedKey, versionKey, currentVersion, label);
      } catch {
        // Ignore mirror failures on timeout to avoid blocking the UI.
      }
    }, timeoutMs);

    return () => clearTimeout(timeout);
  }, [needsAction, timeoutMs, completedKey, versionKey, currentVersion, label, onTimeout]);

  const complete = useCallback(() => {
    if (!completedKey || !versionKey) {
      return;
    }

    try {
      mirrorCompletedState(completedKey, versionKey, currentVersion, label);
      setNeedsAction(false);

      logger.info(`${label} completed`, { userHash });
    } catch (error) {
      logger.error(`${label} completion save failed`, error as Error);
      setNeedsAction(false);
    }
  }, [completedKey, versionKey, currentVersion, userHash, label]);

  const reset = useCallback(() => {
    if (!completedKey || !versionKey) {
      return;
    }

    try {
      clearMirroredState(completedKey, versionKey, label);
      setNeedsAction(true);

      logger.info(`${label} reset`, { userHash });
    } catch (error) {
      logger.error(`${label} reset failed`, error as Error);
    }
  }, [completedKey, versionKey, userHash, label]);

  return {
    needsAction: needsAction && !isDelaying,
    complete,
    reset,
    isLoading,
  };
}
