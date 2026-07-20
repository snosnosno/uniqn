/**
 * UNIQN Mobile - 정산 모달 상태 관리 훅
 *
 * @description settlements.tsx에서 추출된 모달 상태/핸들러 관리
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import type { WorkLog, ConfirmedStaff, GroupedSettlement } from '@/types';

const MODAL_TRANSITION_DELAY_MS = 300;

interface SettleConfirmState {
  visible: boolean;
  workLog: WorkLog | null;
  workLogs: WorkLog[];
  amount: number;
  isBulk: boolean;
}

const INITIAL_SETTLE_CONFIRM: SettleConfirmState = {
  visible: false,
  workLog: null,
  workLogs: [],
  amount: 0,
  isBulk: false,
};

export function useSettlementModals() {
  // 시간 수정 모달
  const [selectedWorkLog, setSelectedWorkLog] = useState<WorkLog | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // 정산 상세 모달
  const [selectedWorkLogForDetail, setSelectedWorkLogForDetail] = useState<WorkLog | null>(null);
  const [selectedGroupForDetail, setSelectedGroupForDetail] = useState<GroupedSettlement | null>(
    null
  );
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  // 정산 확인 모달
  const [settleConfirm, setSettleConfirm] = useState<SettleConfirmState>(INITIAL_SETTLE_CONFIRM);

  // 스태프 관리 모달
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // 정산 금액 수정 모달
  const [isEditAmountModalVisible, setIsEditAmountModalVisible] = useState(false);
  const [selectedWorkLogForEdit, setSelectedWorkLogForEdit] = useState<WorkLog | null>(null);

  // 정산 설정 모달
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  // --- 상세 모달 핸들러 ---

  const openDetailModal = useCallback((workLog: WorkLog, group: GroupedSettlement) => {
    setSelectedWorkLogForDetail(workLog);
    setSelectedGroupForDetail(group);
    setIsDetailModalVisible(true);
  }, []);

  const closeDetailModal = useCallback(() => {
    setIsDetailModalVisible(false);
    setSelectedWorkLogForDetail(null);
    setSelectedGroupForDetail(null);
  }, []);

  const handleDateChange = useCallback((workLog: WorkLog) => {
    setSelectedWorkLogForDetail(workLog);
  }, []);

  // --- 시간 수정 모달 (상세 모달 전환) ---

  const openEditTimeFromDetail = useCallback((workLog: WorkLog) => {
    setIsDetailModalVisible(false);
    setSelectedWorkLogForDetail(null);
    setTimeout(() => {
      setSelectedWorkLog(workLog);
      setIsEditModalVisible(true);
    }, MODAL_TRANSITION_DELAY_MS);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalVisible(false);
    setSelectedWorkLog(null);
  }, []);

  // --- 금액 수정 모달 (상세 모달 전환) ---

  const openEditAmountFromDetail = useCallback((workLog: WorkLog) => {
    setIsDetailModalVisible(false);
    setSelectedWorkLogForDetail(null);
    setTimeout(() => {
      setSelectedWorkLogForEdit(workLog);
      setIsEditAmountModalVisible(true);
    }, MODAL_TRANSITION_DELAY_MS);
  }, []);

  const closeEditAmountModal = useCallback(() => {
    setIsEditAmountModalVisible(false);
    setSelectedWorkLogForEdit(null);
  }, []);

  // --- 정산 확인 모달 ---

  const openSettleConfirm = useCallback((state: SettleConfirmState) => {
    setSettleConfirm(state);
  }, []);

  const openSettleFromDetail = useCallback(
    (workLog: WorkLog, amount: number) => {
      setIsDetailModalVisible(false);
      setSelectedWorkLogForDetail(null);
      setTimeout(() => {
        openSettleConfirm({
          visible: true,
          workLog,
          workLogs: [],
          amount,
          isBulk: false,
        });
      }, MODAL_TRANSITION_DELAY_MS);
    },
    [openSettleConfirm]
  );

  const closeSettleConfirm = useCallback(() => {
    setSettleConfirm(INITIAL_SETTLE_CONFIRM);
  }, []);

  // --- 스태프 관리 모달 ---

  const openRoleChangeModal = useCallback((staff: ConfirmedStaff) => {
    setSelectedStaff(staff);
    setShowRoleChangeModal(true);
  }, []);

  const closeRoleChangeModal = useCallback(() => {
    setShowRoleChangeModal(false);
    setSelectedStaff(null);
  }, []);

  const openReportModal = useCallback((staff: ConfirmedStaff) => {
    setSelectedStaff(staff);
    setShowReportModal(true);
  }, []);

  const closeReportModal = useCallback(() => {
    setShowReportModal(false);
    setSelectedStaff(null);
  }, []);

  // --- 설정 모달 ---

  const openSettingsModal = useCallback(() => {
    setIsSettingsModalVisible(true);
  }, []);

  const closeSettingsModal = useCallback(() => {
    setIsSettingsModalVisible(false);
  }, []);

  return {
    // 시간 수정
    selectedWorkLog,
    isEditModalVisible,
    closeEditModal,
    // 상세
    selectedWorkLogForDetail,
    selectedGroupForDetail,
    isDetailModalVisible,
    openDetailModal,
    closeDetailModal,
    handleDateChange,
    openEditTimeFromDetail,
    // 금액 수정
    selectedWorkLogForEdit,
    isEditAmountModalVisible,
    openEditAmountFromDetail,
    closeEditAmountModal,
    // 정산 확인
    settleConfirm,
    openSettleConfirm,
    openSettleFromDetail,
    closeSettleConfirm,
    // 스태프 관리
    showRoleChangeModal,
    showReportModal,
    selectedStaff,
    isSubmittingReport,
    setIsSubmittingReport,
    openRoleChangeModal,
    closeRoleChangeModal,
    openReportModal,
    closeReportModal,
    // 설정
    isSettingsModalVisible,
    openSettingsModal,
    closeSettingsModal,
  };
}
