/**
 * UNIQN Mobile - Event QR modal (employer)
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '@/hooks/useAuth';
import { useEventQR } from '@/hooks/useEventQR';
import { useJobDetail } from '@/hooks/useJobDetail';
import { formatDate } from '@/utils/date';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { CircularProgress } from '../../ui/CircularProgress';
import {
  QrCodeIcon,
  RefreshIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  XMarkIcon,
  LogInIcon,
  LogOutIcon,
} from '../../icons';
import { buildEventQRScopes, findPreferredEventQRScope, type EventQRScope } from './eventQRScope';

export interface EventQRModalProps {
  visible: boolean;
  onClose: () => void;
  jobPostingId: string;
  jobTitle?: string;
  eventDate?: string;
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
}

type QRMode = 'checkIn' | 'checkOut';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH * 0.55, 220);
const TOTAL_SECONDS = 180;

interface ModeToggleProps {
  mode: QRMode;
  onModeChange: (mode: QRMode) => void;
  disabled?: boolean;
}

interface ScopeSelectionPanelProps {
  scopes: EventQRScope[];
  selectedScopeKey: string | null;
  onSelect: (key: string) => void;
  disabled?: boolean;
}

function ModeToggle({ mode, onModeChange, disabled }: ModeToggleProps) {
  const checkInActive = mode === 'checkIn';
  const checkOutActive = mode === 'checkOut';

  return (
    <View
      className="flex-row rounded-2xl bg-gray-100 p-1.5 dark:bg-surface"
      accessibilityRole="tablist"
      accessibilityLabel="QR mode"
    >
      <Pressable
        onPress={() => onModeChange('checkIn')}
        disabled={disabled}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: checkInActive ? '#16A34A' : 'transparent',
          opacity: disabled ? 0.5 : 1,
          minHeight: 48,
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: checkInActive }}
        accessibilityLabel="Check-in mode"
      >
        <LogInIcon size={18} color={checkInActive ? '#FFFFFF' : '#9CA3AF'} />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 16,
            fontWeight: '600',
            color: checkInActive ? '#FFFFFF' : '#6B7280',
          }}
        >
          Check in
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onModeChange('checkOut')}
        disabled={disabled}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: checkOutActive ? '#9333EA' : 'transparent',
          opacity: disabled ? 0.5 : 1,
          minHeight: 48,
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: checkOutActive }}
        accessibilityLabel="Check-out mode"
      >
        <LogOutIcon size={18} color={checkOutActive ? '#FFFFFF' : '#9CA3AF'} />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 16,
            fontWeight: '600',
            color: checkOutActive ? '#FFFFFF' : '#6B7280',
          }}
        >
          Check out
        </Text>
      </Pressable>
    </View>
  );
}

function ScopeSelectionPanel({
  scopes,
  selectedScopeKey,
  onSelect,
  disabled,
}: ScopeSelectionPanelProps) {
  return (
    <View className="mb-5 w-full">
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Select schedule
      </Text>
      <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Choose the dated assignment slot to generate this QR.
      </Text>

      <View className="mt-3 gap-2">
        {scopes.map((scope) => {
          const isSelected = scope.key === selectedScopeKey;

          return (
            <Pressable
              key={scope.key}
              onPress={() => onSelect(scope.key)}
              disabled={disabled}
              className={`rounded-2xl border px-4 py-3 ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
                  : 'border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface'
              } ${disabled ? 'opacity-50' : 'active:opacity-80'}`}
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(scope.date)} ${scope.timeLabel}`}
            >
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {formatDate(scope.date)} · {scope.timeLabel}
              </Text>
              <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {scope.roleSummary}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function QRRefreshOverlay({ visible }: { visible: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      rotateLoop.start();

      return () => rotateLoop.stop();
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
    rotateAnim.setValue(0);

    return undefined;
  }, [fadeAnim, rotateAnim, visible]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className="absolute inset-0 z-10 items-center justify-center rounded-2xl bg-white/80 dark:bg-surface/80"
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshIcon size={32} color="#A855F7" />
      </Animated.View>
      <Text className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">
        Refreshing QR...
      </Text>
    </Animated.View>
  );
}

export function EventQRModal({
  visible,
  onClose,
  jobPostingId,
  jobTitle,
  eventDate,
  assignmentGroupId,
  timeSlot,
}: EventQRModalProps) {
  const today = useMemo(() => new Date().toISOString().split('T')[0] ?? '', []);
  const { user } = useAuth();
  const createdBy = user?.uid || '';
  const {
    job,
    isLoading: isJobLoading,
    error: jobError,
  } = useJobDetail(jobPostingId, {
    enabled: visible && !!jobPostingId,
  });

  const scopeOptions = useMemo(() => buildEventQRScopes(job), [job]);
  const preferredScope = useMemo(
    () =>
      findPreferredEventQRScope(scopeOptions, {
        eventDate,
        assignmentGroupId,
        timeSlot,
      }),
    [assignmentGroupId, eventDate, scopeOptions, timeSlot]
  );

  const [mode, setMode] = useState<QRMode>('checkIn');
  const [selectedScopeKey, setSelectedScopeKey] = useState<string | null>(
    preferredScope?.key ?? null
  );
  const lastGeneratedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedScopeKey(preferredScope?.key ?? null);
      setMode('checkIn');
      lastGeneratedSignatureRef.current = null;
      return;
    }

    if (scopeOptions.length === 1) {
      setSelectedScopeKey(scopeOptions[0]?.key ?? null);
      return;
    }

    if (preferredScope) {
      setSelectedScopeKey(preferredScope.key);
      return;
    }

    setSelectedScopeKey((current) =>
      scopeOptions.some((scope) => scope.key === current) ? current : null
    );
  }, [preferredScope, scopeOptions, visible]);

  const selectedScope = useMemo(
    () => scopeOptions.find((scope) => scope.key === selectedScopeKey) ?? null,
    [scopeOptions, selectedScopeKey]
  );

  const targetDate = selectedScope?.date ?? eventDate ?? today;
  const scopedAssignmentGroupId = selectedScope?.assignmentGroupId ?? null;
  const scopedTimeSlot = selectedScope?.timeSlot ?? null;

  const {
    qrValue,
    displayData,
    remainingSeconds,
    isActive,
    isLoading,
    isRefreshing,
    generate,
    refresh,
    deactivate,
  } = useEventQR(jobPostingId, targetDate, createdBy, {
    autoRefresh: visible && !!selectedScope,
    assignmentGroupId: scopedAssignmentGroupId,
    timeSlot: scopedTimeSlot,
  });

  useEffect(() => {
    if ((!visible || !selectedScope) && isActive) {
      lastGeneratedSignatureRef.current = null;
      deactivate().catch(() => undefined);
    }
  }, [deactivate, isActive, selectedScope, visible]);

  useEffect(() => {
    if (!visible || !createdBy || !selectedScope) {
      return;
    }

    const signature = `${selectedScope.key}:${mode}`;
    if (lastGeneratedSignatureRef.current === signature) {
      return;
    }

    lastGeneratedSignatureRef.current = signature;

    const timeoutId = setTimeout(() => {
      generate(mode).catch(() => undefined);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [createdBy, generate, mode, selectedScope, visible]);

  const hasDatedSchedule = job?.schedule.kind === 'dated';
  const isScopeLoading = visible && isJobLoading && !job;
  const formattedDate = selectedScope ? formatDate(selectedScope.date) : null;
  const scopeSubtitle = selectedScope
    ? `${selectedScope.timeLabel}${selectedScope.roleSummary ? ` · ${selectedScope.roleSummary}` : ''}`
    : null;
  const qrMatchesSelectedScope =
    Boolean(selectedScope) &&
    Boolean(displayData) &&
    displayData?.date === selectedScope?.date &&
    (displayData?.assignmentGroupId ?? null) === (selectedScope?.assignmentGroupId ?? null) &&
    (displayData?.timeSlot ?? null) === (selectedScope?.timeSlot ?? null);
  const hasQRData = Boolean(selectedScope && displayData && isActive && qrMatchesSelectedScope);
  const isExpired = remainingSeconds <= 0 && hasQRData;
  const scopeBlockReason = useMemo(() => {
    if (isScopeLoading) {
      return 'loading';
    }

    if (jobError) {
      return 'error';
    }

    if (!job) {
      return 'missing';
    }

    if (!hasDatedSchedule) {
      return 'unsupported';
    }

    if (scopeOptions.length === 0) {
      return 'empty';
    }

    if (!selectedScope) {
      return 'selection';
    }

    return null;
  }, [hasDatedSchedule, isScopeLoading, job, jobError, scopeOptions.length, selectedScope]);

  const handleModeChange = useCallback((newMode: QRMode) => {
    setMode(newMode);
  }, []);

  const handleRefresh = useCallback(() => {
    if (!selectedScope) {
      return;
    }

    refresh();
  }, [refresh, selectedScope]);

  const handleScopeSelect = useCallback((key: string) => {
    lastGeneratedSignatureRef.current = null;
    setSelectedScopeKey(key);
  }, []);

  const modeColor = mode === 'checkIn' ? '#16A34A' : '#9333EA';
  const modeLabel = mode === 'checkIn' ? 'Check-in' : 'Check-out';

  let qrPanelContent: React.ReactNode;

  if (scopeBlockReason === 'loading') {
    qrPanelContent = (
      <View style={{ width: QR_SIZE, height: QR_SIZE }} className="items-center justify-center">
        <ActivityIndicator size="large" color={modeColor} />
        <Text className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading QR scope...</Text>
      </View>
    );
  } else if (scopeBlockReason === 'error') {
    qrPanelContent = (
      <View
        style={{ width: QR_SIZE, height: QR_SIZE }}
        className="items-center justify-center rounded-xl bg-gray-50 px-4 dark:bg-gray-100"
      >
        <AlertCircleIcon size={48} color="#EF4444" />
        <Text className="mt-3 text-center text-sm font-medium text-red-500">
          Failed to load QR scope.
        </Text>
        <Text className="mt-2 text-center text-xs text-gray-500">
          {jobError?.message || 'Try reopening this modal.'}
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'unsupported') {
    qrPanelContent = (
      <View
        style={{ width: QR_SIZE, height: QR_SIZE }}
        className="items-center justify-center rounded-xl bg-gray-50 px-4 dark:bg-gray-100"
      >
        <AlertCircleIcon size={48} color="#F59E0B" />
        <Text className="mt-3 text-center text-sm font-medium text-gray-800">
          QR is available only for dated schedule postings.
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'empty') {
    qrPanelContent = (
      <View
        style={{ width: QR_SIZE, height: QR_SIZE }}
        className="items-center justify-center rounded-xl bg-gray-50 px-4 dark:bg-gray-100"
      >
        <AlertCircleIcon size={48} color="#F59E0B" />
        <Text className="mt-3 text-center text-sm font-medium text-gray-800">
          No dated slots are available for QR generation.
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'missing') {
    qrPanelContent = (
      <View
        style={{ width: QR_SIZE, height: QR_SIZE }}
        className="items-center justify-center rounded-xl bg-gray-50 px-4 dark:bg-gray-100"
      >
        <AlertCircleIcon size={48} color="#F59E0B" />
        <Text className="mt-3 text-center text-sm font-medium text-gray-800">
          This posting could not be loaded for QR generation.
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'selection') {
    qrPanelContent = (
      <View
        style={{ width: QR_SIZE, height: QR_SIZE }}
        className="items-center justify-center rounded-xl bg-gray-50 px-4 dark:bg-gray-100"
      >
        <AlertCircleIcon size={48} color="#6366F1" />
        <Text className="mt-3 text-center text-sm font-medium text-gray-800">
          Select a dated slot to generate QR.
        </Text>
      </View>
    );
  } else if (isLoading) {
    qrPanelContent = (
      <View style={{ width: QR_SIZE, height: QR_SIZE }} className="items-center justify-center">
        <ActivityIndicator size="large" color={modeColor} />
        <Text className="mt-4 text-sm text-gray-500 dark:text-gray-400">Generating QR...</Text>
      </View>
    );
  } else if (isExpired) {
    qrPanelContent = (
      <View
        style={{ width: QR_SIZE, height: QR_SIZE }}
        className="items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-100"
      >
        <AlertCircleIcon size={48} color="#EF4444" />
        <Text className="mb-4 mt-3 text-center font-medium text-red-500">QR code expired.</Text>
        <Button
          variant="primary"
          size="sm"
          onPress={() => {
            if (selectedScope) {
              void generate(mode);
            }
          }}
          icon={<RefreshIcon size={16} color="#FFFFFF" />}
          disabled={!selectedScope}
        >
          Regenerate QR
        </Button>
      </View>
    );
  } else if (hasQRData) {
    qrPanelContent = (
      <QRCode value={qrValue || ''} size={QR_SIZE} backgroundColor="white" color="black" />
    );
  } else {
    qrPanelContent = (
      <View
        style={{ width: QR_SIZE, height: QR_SIZE }}
        className="items-center justify-center rounded-xl bg-gray-50"
      >
        <ActivityIndicator size="large" color={modeColor} />
      </View>
    );
  }

  return (
    <Modal visible={visible} onClose={onClose} position="center" size="lg" showCloseButton={false}>
      <View>
        <View className="mb-2 flex-row justify-end">
          <Pressable
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-surface"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <XMarkIcon size={20} color="#6B7280" />
          </Pressable>
        </View>

        <View className="items-center pb-4">
          <View className="mb-1 flex-row items-center">
            <QrCodeIcon size={26} color={modeColor} />
            <Text className="ml-2 text-xl font-bold text-gray-900 dark:text-gray-100">
              Event {modeLabel} QR
            </Text>
          </View>

          {jobTitle && (
            <Text className="mb-0.5 text-base font-medium text-gray-700 dark:text-gray-300">
              {jobTitle}
            </Text>
          )}
          {formattedDate ? (
            <Text className="text-sm text-gray-400 dark:text-gray-500">{formattedDate}</Text>
          ) : null}
          {scopeSubtitle ? (
            <Text className="mb-5 text-xs text-gray-500 dark:text-gray-400">{scopeSubtitle}</Text>
          ) : (
            <View className="mb-5" />
          )}

          {scopeOptions.length > 1 ? (
            <ScopeSelectionPanel
              scopes={scopeOptions}
              selectedScopeKey={selectedScopeKey}
              onSelect={handleScopeSelect}
              disabled={isLoading || isRefreshing}
            />
          ) : selectedScope ? (
            <Card variant="filled" padding="sm" className="mb-5 w-full bg-gray-50 dark:bg-surface">
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Selected slot
              </Text>
              <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formattedDate} · {scopeSubtitle}
              </Text>
            </Card>
          ) : null}

          <View className="mb-5 w-full">
            <ModeToggle
              mode={mode}
              onModeChange={handleModeChange}
              disabled={Boolean(scopeBlockReason) || isLoading || isRefreshing}
            />
          </View>

          <View className="relative mb-4 rounded-2xl bg-white p-5 shadow-lg">
            <QRRefreshOverlay visible={isRefreshing} />
            {qrPanelContent}
          </View>

          {hasQRData && !isLoading && !isExpired ? (
            <View className="mb-4 flex-row items-center gap-5">
              <CircularProgress
                remainingSeconds={remainingSeconds}
                totalSeconds={TOTAL_SECONDS}
                size={70}
                strokeWidth={5}
                isExpired={isExpired}
              />

              <Pressable
                onPress={handleRefresh}
                disabled={isLoading || isRefreshing || !selectedScope}
                className={`flex-row items-center rounded-xl bg-gray-100 px-4 py-2.5 dark:bg-surface ${
                  isRefreshing ? 'opacity-50' : 'active:opacity-70'
                }`}
              >
                <RefreshIcon size={18} color="#6B7280" />
                <Text className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Refresh
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Card
            variant="filled"
            padding="md"
            className="w-full bg-primary-50 dark:bg-primary-900/20"
          >
            <View className="mb-2 flex-row items-start">
              <CheckCircleIcon size={16} color="#9333EA" />
              <Text className="ml-2 text-sm font-medium text-primary-800 dark:text-primary-300">
                How staff use this {modeLabel.toLowerCase()} QR
              </Text>
            </View>

            <View className="ml-6 gap-1">
              <Text className="text-xs text-primary-600 dark:text-primary-400">
                1. Open the staff QR scanner.
              </Text>
              <Text className="text-xs text-primary-600 dark:text-primary-400">
                2. Scan the QR code shown here.
              </Text>
              <Text className="text-xs text-primary-600 dark:text-primary-400">
                3. {modeLabel} is processed for the selected dated slot.
              </Text>
            </View>
          </Card>

          <View className="mt-3 flex-row items-start px-1">
            <AlertCircleIcon size={14} color="#9CA3AF" />
            <Text className="ml-1.5 flex-1 text-xs text-gray-400 dark:text-gray-500">
              QR codes stay valid for 3 minutes and refresh automatically while this modal remains
              open.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default EventQRModal;
