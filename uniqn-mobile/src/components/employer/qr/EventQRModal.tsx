/**
 * UNIQN Mobile - Event QR modal (employer)
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '@/hooks/useAuth';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
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
      className="flex-row rounded-lg bg-surface-card p-1.5 dark:bg-surface"
      accessibilityRole="tablist"
      accessibilityLabel="QR 모드"
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
        accessibilityLabel="출근 QR 모드"
      >
        <LogInIcon size={18} color={checkInActive ? '#FFFFFF' : SECONDARY_PALETTE[400]} />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 16,
            fontWeight: '600',
            fontFamily: 'PlusJakartaSans_600SemiBold',
            color: checkInActive ? '#FFFFFF' : SECONDARY_PALETTE[500],
          }}
        >
          출근
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
          backgroundColor: checkOutActive ? '#B8962E' : 'transparent',
          opacity: disabled ? 0.5 : 1,
          minHeight: 48,
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: checkOutActive }}
        accessibilityLabel="퇴근 QR 모드"
      >
        <LogOutIcon size={18} color={checkOutActive ? '#FFFFFF' : SECONDARY_PALETTE[400]} />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 16,
            fontWeight: '600',
            fontFamily: 'PlusJakartaSans_600SemiBold',
            color: checkOutActive ? '#FFFFFF' : SECONDARY_PALETTE[500],
          }}
        >
          퇴근
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
      <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
        일정 선택
      </Text>
      <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
        QR을 생성할 날짜와 시간 슬롯을 선택하세요.
      </Text>

      <View className="mt-3 gap-2">
        {scopes.map((scope) => {
          const isSelected = scope.key === selectedScopeKey;

          return (
            <Pressable
              key={scope.key}
              onPress={() => onSelect(scope.key)}
              disabled={disabled}
              className={`rounded-lg border px-4 py-3 ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
                  : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
              } ${disabled ? 'opacity-50' : 'active:opacity-80'}`}
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(scope.date)} ${scope.timeLabel}`}
            >
              <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
                {formatDate(scope.date)} · {scope.timeLabel}
              </Text>
              <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
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
      className="absolute inset-0 z-10 items-center justify-center rounded-lg bg-white/80 dark:bg-surface/80"
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshIcon size={32} color="#D4AF37" />
      </Animated.View>
      <Text className="mt-3 text-sm font-sans-medium text-content-muted dark:text-secondary-400">
        QR 새로고침 중...
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
  const { width: windowWidth } = useWindowDimensions();
  const today = useMemo(() => new Date().toISOString().split('T')[0] ?? '', []);
  const qrSize = Math.min(Math.max(windowWidth * 0.55, 180), 220);
  const { user } = useAuth();
  const createdBy = user?.uid || '';
  const {
    job,
    isLoading: isJobLoading,
    error: jobError,
  } = useJobDetail(jobPostingId, {
    enabled: visible && !!jobPostingId,
  });
  const { staff: confirmedStaff, isLoading: isConfirmedStaffLoading } = useConfirmedStaff(
    visible ? jobPostingId : '',
    {
      realtime: visible,
    }
  );

  const scopeOptions = useMemo(
    () => buildEventQRScopes(job, confirmedStaff),
    [confirmedStaff, job]
  );
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
  const isScopeLoading =
    visible && ((isJobLoading && !job) || (isConfirmedStaffLoading && confirmedStaff.length === 0));
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

  const modeColor = mode === 'checkIn' ? '#16A34A' : '#B8962E';
  const modeLabel = mode === 'checkIn' ? '출근' : '퇴근';
  const scopeErrorMessage =
    jobError?.message && /[가-힣]/.test(jobError.message)
      ? jobError.message
      : '모달을 다시 열어주세요.';

  let qrPanelContent: React.ReactNode;

  if (scopeBlockReason === 'loading') {
    qrPanelContent = (
      <View style={{ width: qrSize, height: qrSize }} className="items-center justify-center">
        <ActivityIndicator size="large" color={modeColor} />
        <Text className="mt-4 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
          QR 대상 일정을 불러오는 중...
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'error') {
    qrPanelContent = (
      <View
        style={{ width: qrSize, height: qrSize }}
        className="items-center justify-center rounded-md bg-surface-page dark:bg-surface px-4 dark:bg-secondary-100"
      >
        <AlertCircleIcon size={48} color="#DC2626" />
        <Text className="mt-3 text-center text-sm font-sans-medium text-error-500">
          QR 대상 일정을 불러오지 못했습니다.
        </Text>
        <Text className="mt-2 text-center text-xs text-secondary-500 font-sans">
          {scopeErrorMessage}
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'unsupported') {
    qrPanelContent = (
      <View
        style={{ width: qrSize, height: qrSize }}
        className="items-center justify-center rounded-md bg-surface-page dark:bg-surface px-4 dark:bg-secondary-100"
      >
        <AlertCircleIcon size={48} color="#D4A017" />
        <Text className="mt-3 text-center text-sm font-sans-medium text-secondary-800">
          QR은 날짜 지정형 스케줄 공고에서만 사용할 수 있습니다.
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'empty') {
    qrPanelContent = (
      <View
        style={{ width: qrSize, height: qrSize }}
        className="items-center justify-center rounded-md bg-surface-page dark:bg-surface px-4 dark:bg-secondary-100"
      >
        <AlertCircleIcon size={48} color="#D4A017" />
        <Text className="mt-3 text-center text-sm font-sans-medium text-secondary-800">
          QR을 생성할 수 있는 날짜 지정 슬롯이 없습니다.
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'missing') {
    qrPanelContent = (
      <View
        style={{ width: qrSize, height: qrSize }}
        className="items-center justify-center rounded-md bg-surface-page dark:bg-surface px-4 dark:bg-secondary-100"
      >
        <AlertCircleIcon size={48} color="#D4A017" />
        <Text className="mt-3 text-center text-sm font-sans-medium text-secondary-800">
          QR 생성을 위한 공고 정보를 불러오지 못했습니다.
        </Text>
      </View>
    );
  } else if (scopeBlockReason === 'selection') {
    qrPanelContent = (
      <View
        style={{ width: qrSize, height: qrSize }}
        className="items-center justify-center rounded-md bg-surface-page dark:bg-surface px-4 dark:bg-secondary-100"
      >
        <AlertCircleIcon size={48} color="#D4A017" />
        <Text className="mt-3 text-center text-sm font-sans-medium text-secondary-800">
          QR을 생성할 날짜 슬롯을 선택하세요.
        </Text>
      </View>
    );
  } else if (isLoading) {
    qrPanelContent = (
      <View style={{ width: qrSize, height: qrSize }} className="items-center justify-center">
        <ActivityIndicator size="large" color={modeColor} />
        <Text className="mt-4 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
          QR 생성 중...
        </Text>
      </View>
    );
  } else if (isExpired) {
    qrPanelContent = (
      <View
        style={{ width: qrSize, height: qrSize }}
        className="items-center justify-center rounded-md bg-surface-page dark:bg-surface dark:bg-secondary-100"
      >
        <AlertCircleIcon size={48} color="#DC2626" />
        <Text className="mb-4 mt-3 text-center font-sans-medium text-error-500">
          QR 코드가 만료되었습니다.
        </Text>
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
          QR 다시 생성
        </Button>
      </View>
    );
  } else if (hasQRData) {
    qrPanelContent = (
      <QRCode value={qrValue || ''} size={qrSize} backgroundColor="white" color="black" />
    );
  } else {
    qrPanelContent = (
      <View
        style={{ width: qrSize, height: qrSize }}
        className="items-center justify-center rounded-md bg-surface-page dark:bg-surface"
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
            className="h-10 w-10 items-center justify-center rounded-sm bg-surface-card dark:bg-surface"
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <XMarkIcon size={20} color={SECONDARY_PALETTE[500]} />
          </Pressable>
        </View>

        <View className="items-center pb-4">
          <View className="mb-1 flex-row items-center">
            <QrCodeIcon size={26} color={modeColor} />
            <Text className="ml-2 text-xl font-display text-content-primary dark:text-secondary-100">
              이벤트 {modeLabel} QR
            </Text>
          </View>

          {jobTitle && (
            <Text className="mb-0.5 text-base font-sans-medium text-content-secondary">
              {jobTitle}
            </Text>
          )}
          {formattedDate ? (
            <Text className="text-sm text-content-placeholder font-sans">{formattedDate}</Text>
          ) : null}
          {scopeSubtitle ? (
            <Text className="mb-5 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              {scopeSubtitle}
            </Text>
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
            <Card
              variant="filled"
              padding="sm"
              className="mb-5 w-full bg-surface-page dark:bg-surface"
            >
              <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
                선택한 슬롯
              </Text>
              <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
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

          <View className="relative mb-4 rounded-lg bg-white p-5 shadow-lg">
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
                className={`flex-row items-center rounded-md bg-surface-card px-4 py-2.5 dark:bg-surface ${
                  isRefreshing ? 'opacity-50' : 'active:opacity-70'
                }`}
              >
                <RefreshIcon size={18} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-2 text-sm font-sans-medium text-content-muted dark:text-secondary-400">
                  새로고침
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
              <CheckCircleIcon size={16} color="#B8962E" />
              <Text className="ml-2 text-sm font-sans-medium text-primary-800 dark:text-primary-300">
                {modeLabel} QR 사용 방법
              </Text>
            </View>

            <View className="ml-6 gap-1">
              <Text className="text-xs text-primary-600 dark:text-primary-400 font-sans">
                1. 스태프 앱에서 QR 스캐너를 엽니다.
              </Text>
              <Text className="text-xs text-primary-600 dark:text-primary-400 font-sans">
                2. 이 화면의 QR 코드를 스캔합니다.
              </Text>
              <Text className="text-xs text-primary-600 dark:text-primary-400 font-sans">
                3. 선택한 날짜 슬롯으로 {modeLabel} 처리가 완료됩니다.
              </Text>
            </View>
          </Card>

          <View className="mt-3 flex-row items-start px-1">
            <AlertCircleIcon size={14} color={SECONDARY_PALETTE[400]} />
            <Text className="ml-1.5 flex-1 text-xs text-content-placeholder font-sans">
              QR 코드는 3분 동안 유효하며, 이 모달이 열려 있는 동안 자동으로 갱신됩니다.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default EventQRModal;
