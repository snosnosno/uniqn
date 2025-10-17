/**
 * useStaffModals.ts
 * 스태프 관리 탭의 모든 모달 상태 관리 커스텀 훅
 *
 * @version 1.0
 * @since 2025-02-04
 */

import { useState, useCallback } from 'react';
import type { StaffData } from '../../utils/staff/staffDataTransformer';

export interface DeleteConfirmData {
  isOpen: boolean;
  staffId: string;
  staffName: string;
  date: string;
}

export interface ReportTarget {
  id: string;
  name: string;
}

export interface UseStaffModalsReturn {
  // QR 스캔 모달
  qrModal: {
    isOpen: boolean;
    open: () => void;
    close: () => void;
  };
  // 근무 시간 수정 모달
  workTimeEditor: {
    isOpen: boolean;
    workLog: any | null;
    open: (workLog: any) => void;
    close: () => void;
    setWorkLog: (workLog: any) => void;
  };
  // 스태프 프로필 모달
  profileModal: {
    isOpen: boolean;
    staff: StaffData | null;
    open: (staff: StaffData) => void;
    close: () => void;
  };
  // 삭제 확인 모달
  deleteConfirmModal: {
    data: DeleteConfirmData;
    open: (staffId: string, staffName: string, date: string) => void;
    close: () => void;
  };
  // 일괄 시간 수정 모달
  bulkTimeEditModal: {
    isOpen: boolean;
    open: () => void;
    close: () => void;
  };
  // 신고 모달
  reportModal: {
    isOpen: boolean;
    target: ReportTarget | null;
    open: (staffId: string, staffName: string) => void;
    close: () => void;
  };
}

/**
 * 모든 모달 상태를 중앙 관리
 *
 * @returns 각 모달의 상태 및 열기/닫기 함수
 */
export function useStaffModals(): UseStaffModalsReturn {
  // QR 스캔 모달
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // 근무 시간 수정 모달
  const [isWorkTimeEditorOpen, setIsWorkTimeEditorOpen] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState<any | null>(null);

  // 스태프 프로필 모달
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedStaffForProfile, setSelectedStaffForProfile] =
    useState<StaffData | null>(null);

  // 삭제 확인 모달
  const [deleteConfirmModal, setDeleteConfirmModal] =
    useState<DeleteConfirmData>({
      isOpen: false,
      staffId: '',
      staffName: '',
      date: '',
    });

  // 일괄 시간 수정 모달
  const [isBulkTimeEditOpen, setIsBulkTimeEditOpen] = useState(false);

  // 신고 모달
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  return {
    qrModal: {
      isOpen: isQrModalOpen,
      open: useCallback(() => setIsQrModalOpen(true), []),
      close: useCallback(() => setIsQrModalOpen(false), []),
    },
    workTimeEditor: {
      isOpen: isWorkTimeEditorOpen,
      workLog: selectedWorkLog,
      open: useCallback((workLog: any) => {
        setSelectedWorkLog(workLog);
        setIsWorkTimeEditorOpen(true);
      }, []),
      close: useCallback(() => {
        setIsWorkTimeEditorOpen(false);
        setSelectedWorkLog(null);
      }, []),
      setWorkLog: useCallback((workLog: any) => {
        setSelectedWorkLog(workLog);
      }, []),
    },
    profileModal: {
      isOpen: isProfileModalOpen,
      staff: selectedStaffForProfile,
      open: useCallback((staff: StaffData) => {
        setSelectedStaffForProfile(staff);
        setIsProfileModalOpen(true);
      }, []),
      close: useCallback(() => {
        setIsProfileModalOpen(false);
        setSelectedStaffForProfile(null);
      }, []),
    },
    deleteConfirmModal: {
      data: deleteConfirmModal,
      open: useCallback((staffId: string, staffName: string, date: string) => {
        setDeleteConfirmModal({ isOpen: true, staffId, staffName, date });
      }, []),
      close: useCallback(() => {
        setDeleteConfirmModal({
          isOpen: false,
          staffId: '',
          staffName: '',
          date: '',
        });
      }, []),
    },
    bulkTimeEditModal: {
      isOpen: isBulkTimeEditOpen,
      open: useCallback(() => setIsBulkTimeEditOpen(true), []),
      close: useCallback(() => setIsBulkTimeEditOpen(false), []),
    },
    reportModal: {
      isOpen: isReportModalOpen,
      target: reportTarget,
      open: useCallback((staffId: string, staffName: string) => {
        setReportTarget({ id: staffId, name: staffName });
        setIsReportModalOpen(true);
      }, []),
      close: useCallback(() => {
        setIsReportModalOpen(false);
        setReportTarget(null);
      }, []),
    },
  };
}
