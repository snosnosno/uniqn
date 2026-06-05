/**
 * UNIQN Mobile - Event QR controller hook (employer)
 *
 * @description EventQRModal 상태/이펙트/데이터 패칭/파생 플래그/핸들러를 캡슐화한 컨트롤러 훅.
 *   lastGeneratedSignatureRef 및 generate/deactivate/isActive 는 훅 내부에만 머문다.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useEventQR } from '@/hooks/useEventQR';
import { useJobDetail } from '@/hooks/useJobDetail';
import { formatDate, getTodayString } from '@/utils/date';
import { buildEventQRScopes, findPreferredEventQRScope, type EventQRScope } from './eventQRScope';

export type QRMode = 'checkIn' | 'checkOut';

export type ScopeBlockReason =
  | 'loading'
  | 'error'
  | 'missing'
  | 'unsupported'
  | 'empty'
  | 'selection'
  | null;

export interface UseEventQRControllerArgs {
  visible: boolean;
  jobPostingId: string;
  eventDate?: string;
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
}

export interface EventQRController {
  qrSize: number;
  scopeOptions: EventQRScope[];
  selectedScope: EventQRScope | null;
  selectedScopeKey: string | null;
  mode: QRMode;
  modeColor: string;
  modeLabel: string;
  qrValue: string;
  remainingSeconds: number;
  isLoading: boolean;
  isRefreshing: boolean;
  scopeBlockReason: ScopeBlockReason;
  scopeErrorMessage: string;
  hasQRData: boolean;
  isExpired: boolean;
  formattedDate: string | null;
  scopeSubtitle: string | null;
  onModeChange: (mode: QRMode) => void;
  onRefresh: () => void;
  onScopeSelect: (key: string) => void;
  onRegenerate: () => void;
}

export function useEventQRController({
  visible,
  jobPostingId,
  eventDate,
  assignmentGroupId,
  timeSlot,
}: UseEventQRControllerArgs): EventQRController {
  const { width: windowWidth } = useWindowDimensions();
  const today = useMemo(() => getTodayString(), []);
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
  const scopeBlockReason = useMemo<ScopeBlockReason>(() => {
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

  const onModeChange = useCallback((newMode: QRMode) => {
    setMode(newMode);
  }, []);

  const onRefresh = useCallback(() => {
    if (!selectedScope) {
      return;
    }

    refresh();
  }, [refresh, selectedScope]);

  const onScopeSelect = useCallback((key: string) => {
    lastGeneratedSignatureRef.current = null;
    setSelectedScopeKey(key);
  }, []);

  const onRegenerate = useCallback(() => {
    if (selectedScope) {
      void generate(mode);
    }
  }, [generate, mode, selectedScope]);

  const modeColor = mode === 'checkIn' ? '#16A34A' : '#B8962E';
  const modeLabel = mode === 'checkIn' ? '출근' : '퇴근';
  const scopeErrorMessage =
    jobError?.message && /[가-힣]/.test(jobError.message)
      ? jobError.message
      : '모달을 다시 열어주세요.';

  return {
    qrSize,
    scopeOptions,
    selectedScope,
    selectedScopeKey,
    mode,
    modeColor,
    modeLabel,
    qrValue: qrValue || '',
    remainingSeconds,
    isLoading,
    isRefreshing,
    scopeBlockReason,
    scopeErrorMessage,
    hasQRData,
    isExpired,
    formattedDate,
    scopeSubtitle,
    onModeChange,
    onRefresh,
    onScopeSelect,
    onRegenerate,
  };
}
