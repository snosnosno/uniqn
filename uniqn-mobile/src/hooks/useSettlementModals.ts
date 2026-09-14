/**
 * UNIQN Mobile - [근무] 화면 모달 상태 관리 훅
 *
 * @description settlements.tsx에서 추출된 모달 상태/핸들러 관리
 * @version 2.0.0 - 구인자 IA S2: 지급 완료 확인·지급 완료 취소 모달 상태 제거
 */

import { useState, useCallback } from 'react';
import type { WorkLog, ConfirmedStaff, GroupedSettlement } from '@/types';

const MODAL_TRANSITION_DELAY_MS = 300;

export function useSettlementModals() {
  // 근무 수정 시트
  const [selectedWorkLog, setSelectedWorkLog] = useState<WorkLog | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // 계산 근거 모달
  const [selectedWorkLogForDetail, setSelectedWorkLogForDetail] = useState<WorkLog | null>(null);
  const [selectedGroupForDetail, setSelectedGroupForDetail] = useState<GroupedSettlement | null>(
    null
  );
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  // 스태프 관리 모달 — 역할 변경 모달은 통합 편집 시트로 흡수돼 사라졌다.
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<ConfirmedStaff | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // 근무 금액 수정 모달
  const [isEditAmountModalVisible, setIsEditAmountModalVisible] = useState(false);
  const [selectedWorkLogForEdit, setSelectedWorkLogForEdit] = useState<WorkLog | null>(null);

  // 급여 설정 모달
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  // --- 계산 근거 모달 핸들러 ---

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

  // --- 근무 수정 시트 (계산 근거에서 전환) ---

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

  // --- 금액 수정 모달 (계산 근거에서 전환) ---

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

  // --- 스태프 관리 모달 ---

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
    // 근무 수정
    selectedWorkLog,
    isEditModalVisible,
    closeEditModal,
    // 계산 근거
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
    // 스태프 관리
    showReportModal,
    selectedStaff,
    isSubmittingReport,
    setIsSubmittingReport,
    openReportModal,
    closeReportModal,
    // 설정
    isSettingsModalVisible,
    openSettingsModal,
    closeSettingsModal,
  };
}
