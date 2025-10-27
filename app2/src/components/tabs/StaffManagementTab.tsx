/**
 * StaffManagementTab - 리팩토링 버전
 * 1,351줄 → ~400줄 (70% 감소)
 *
 * @version 3.0 (리팩토링 완료)
 * @since 2025-02-04
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import useUnifiedData from '../../hooks/useUnifiedData';
import type { WorkLog } from '../../types/unifiedData';
import type { JobPosting } from '../../types/jobPosting/jobPosting';
import { getTodayString } from '../../utils/jobPosting/dateUtils';
import { createWorkLogId, generateWorkLogIdCandidates } from '../../utils/workLogSimplified';

// 🎯 커스텀 훅 imports
import { useStaffData } from '../../hooks/staff/useStaffData';
import { useStaffSelection } from '../../hooks/staff/useStaffSelection';
import { useStaffModals } from '../../hooks/staff/useStaffModals';
import { useStaffActions } from '../../hooks/staff/useStaffActions';

// 유틸리티 imports
import { useResponsive } from '../../hooks/useResponsive';
import BulkTimeEditModal from '../modals/BulkTimeEditModal';
import ReportModal from '../modals/ReportModal';
import ConfirmModal from '../modals/ConfirmModal';
import StaffDateGroup from '../staff/StaffDateGroup';
import StaffDateGroupMobile from '../staff/StaffDateGroupMobile';
import WorkTimeEditor, { WorkLogWithTimestamp } from '../staff/WorkTimeEditor';
import StaffProfileModal from '../modals/StaffProfileModal';
import MobileSelectionBar from '../layout/MobileSelectionBar';
import '../../styles/staffSelection.css';

// Lazy load QR 스캔 모달
const ManagerScannerModal = React.lazy(() => import('../qr/ManagerScannerModal'));

interface StaffManagementTabProps {
  jobPosting?: JobPosting | null;
}

const StaffManagementTab: React.FC<StaffManagementTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { isMobile, isTablet } = useResponsive();
  const { currentUser } = useAuth();

  // 🎯 UnifiedDataContext 연동
  const { state, loading, error, refresh, updateWorkLogOptimistic } = useUnifiedData();

  // 🎯 필터링 상태
  const [filters, setFilters] = useState({ searchTerm: '' });

  // 🎯 날짜 확장 상태 - localStorage 연동
  const getStorageKey = useCallback(
    () => `staff-expanded-dates-${jobPosting?.id || 'default'}`,
    [jobPosting?.id]
  );

  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    try {
      const storageKey = `staff-expanded-dates-${jobPosting?.id || 'default'}`;
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (error) {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(Array.from(expandedDates)));
    } catch (error) {
      // localStorage 저장 실패 무시
    }
  }, [expandedDates, getStorageKey]);

  const toggleDateExpansion = useCallback((date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  }, []);

  // 🚀 커스텀 훅 사용
  const { staffData, groupedStaffData, uniqueStaffCount, filteredStaffCount } =
    useStaffData({
      workLogs: state.workLogs,
      jobPostings: state.jobPostings as any,
      currentJobPosting: jobPosting,
      filters,
    });

  // 🔍 디버깅: state.workLogs 확인
  useEffect(() => {
    logger.info('🔍 [StaffManagementTab] state.workLogs 확인', {
      component: 'StaffManagementTab',
      data: {
        workLogsSize: state.workLogs.size,
        workLogsKeys: Array.from(state.workLogs.keys()),
        jobPostingId: jobPosting?.id,
        loading: loading.workLogs,
        error: error.workLogs,
      },
    });
  }, [state.workLogs, jobPosting?.id, loading.workLogs, error.workLogs]);

  const selection = useStaffSelection();

  const modals = useStaffModals();

  const canEdit = currentUser?.uid && currentUser.uid === jobPosting?.createdBy;

  const actions = useStaffActions({
    jobPosting,
    staffData,
    canEdit: !!canEdit,
    refresh,
  });

  // 🎯 출석 기록 배열 변환
  const attendanceRecords = useMemo(() => {
    return state.attendanceRecords ? Array.from(state.attendanceRecords.values()) : [];
  }, [state.attendanceRecords]);

  // 🎯 출석 상태 관련 헬퍼 함수
  const getStaffAttendanceStatus = useCallback(
    (staffId: string, targetDate?: string) => {
      const searchDate = targetDate || getTodayString();

      if (!jobPosting?.id) return null;

      const expectedWorkLogId = createWorkLogId(jobPosting.id, staffId, searchDate);
      const workLog = state.workLogs.get(expectedWorkLogId);

      if (workLog) {
        return {
          status: workLog.status,
          workLog: workLog,
          workLogId: workLog.id,
        };
      }

      return null;
    },
    [state.workLogs, jobPosting?.id]
  );

  const applyOptimisticUpdate = useCallback(
    (workLogId: string, status: string) => {
      const existingWorkLog = Array.from(state.workLogs.values()).find(
        wl => wl.id === workLogId
      );

      if (existingWorkLog) {
        const optimisticWorkLog: Partial<WorkLog> = {
          ...existingWorkLog,
          status: status as any,
          updatedAt: Timestamp.fromDate(new Date()),
        };

        if (status === 'checked_in') {
          optimisticWorkLog.actualStartTime = Timestamp.fromDate(new Date());
        } else if (existingWorkLog.actualStartTime) {
          optimisticWorkLog.actualStartTime = existingWorkLog.actualStartTime;
        }

        if (status === 'checked_out') {
          optimisticWorkLog.actualEndTime = Timestamp.fromDate(new Date());
        } else if (existingWorkLog.actualEndTime) {
          optimisticWorkLog.actualEndTime = existingWorkLog.actualEndTime;
        }

        updateWorkLogOptimistic(optimisticWorkLog as WorkLog);
      }
    },
    [state.workLogs, updateWorkLogOptimistic]
  );

  const formatTimeDisplay = useCallback((timeValue: string | number | undefined) => {
    if (!timeValue) return '';
    if (typeof timeValue === 'string') return timeValue;
    return String(timeValue);
  }, []);

  const getTimeSlotColor = useCallback((timeSlot?: string) => {
    if (!timeSlot) return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    const colors = {
      '09:00~18:00': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      '18:00~24:00': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      '24:00~06:00': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    };
    return colors[timeSlot as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  }, []);

  const getStaffWorkLog = useCallback(
    (staffId: string, date: string) => {
      if (!jobPosting?.id) return null;

      const expectedWorkLogId = createWorkLogId(jobPosting.id, staffId, date);
      let workLog = state.workLogs?.get(expectedWorkLogId);

      if (workLog && workLog.eventId === jobPosting.id) {
        return workLog;
      }

      const candidates = generateWorkLogIdCandidates(jobPosting.id, staffId, date);
      workLog = undefined;

      for (const candidateId of candidates) {
        const candidateLog = state.workLogs?.get(candidateId);
        if (candidateLog && candidateLog.eventId === jobPosting.id) {
          workLog = candidateLog;
          break;
        }
      }

      logger.info('getStaffWorkLog - WorkLog 조회 결과', {
        component: 'StaffManagementTab',
        data: {
          requestedStaffId: staffId,
          requestedDate: date,
          eventId: jobPosting.id,
          workLogFound: !!workLog,
        },
      });

      return workLog;
    },
    [state.workLogs, jobPosting?.id]
  );

  // 🎯 핸들러 함수들
  const handleEditWorkTime = useCallback(
    async (staffId: string, timeType?: 'start' | 'end', targetDate?: string) => {
      const workLog = await actions.handleEditWorkTime(staffId, timeType, targetDate);
      if (workLog) {
        modals.workTimeEditor.open(workLog);
      }
    },
    [actions, modals.workTimeEditor]
  );

  const handleWorkTimeUpdate = useCallback(
    (updatedWorkLog: WorkLogWithTimestamp) => {
      updateWorkLogOptimistic(updatedWorkLog as WorkLog);
      modals.workTimeEditor.setWorkLog(updatedWorkLog);
    },
    [updateWorkLogOptimistic, modals.workTimeEditor]
  );

  const deleteStaffWrapper = useCallback(
    async (staffId: string) => {
      const staff = staffData.find(s => s.id === staffId);
      if (staff) {
        const staffName = staff.name || '이름 미정';
        const date = staff.assignedDate || getTodayString();
        if (date) {
          modals.deleteConfirmModal.open(staffId, staffName, date);
        }
      }
    },
    [staffData, modals.deleteConfirmModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    const { staffId, staffName, date } = modals.deleteConfirmModal.data;
    if (staffId && staffName && date) {
      await actions.deleteStaff(staffId, staffName, date);
      modals.deleteConfirmModal.close();
    }
  }, [modals.deleteConfirmModal, actions]);

  const handleStaffSelect = useCallback(
    (staffId: string) => {
      selection.toggleStaffSelection(staffId);
    },
    [selection]
  );

  const handleMultiSelectToggle = useCallback(() => {
    selection.toggleMultiSelectMode();
  }, [selection]);

  const handleReport = useCallback(
    (staffId: string, staffName: string) => {
      modals.reportModal.open(staffId, staffName);
    },
    [modals.reportModal]
  );

  const handleShowProfile = (staffId: string) => {
    const staff = staffData.find(s => s.id === staffId);
    if (staff) {
      modals.profileModal.open(staff);
    }
  };

  const handleBulkDelete = async (staffIds: string[]) => {
    await actions.handleBulkDelete(staffIds);
    selection.resetSelection();
  };

  // Early return if no job posting data
  if (!jobPosting) {
    return (
      <div className="p-1 sm:p-4">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg text-gray-500">공고 정보를 불러올 수 없습니다.</div>
        </div>
      </div>
    );
  }

  if (loading?.initial) {
    return (
      <div className="p-1 sm:p-4">
        <div className="flex justify-center items-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 ml-4">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-1 sm:p-4">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">{jobPosting.title} - 스태프 관리</h3>

          {/* 데스크톱 컨트롤 */}
          {!isMobile && !isTablet && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 font-medium">
                총 {uniqueStaffCount}명
                {filteredStaffCount !== uniqueStaffCount &&
                  ` (${filteredStaffCount}명 필터됨)`}
              </span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="스태프 검색..."
                  value={filters.searchTerm}
                  onChange={e => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {canEdit && (
                <>
                  <button
                    onClick={handleMultiSelectToggle}
                    className={`px-3 py-2 rounded-md transition-colors flex items-center space-x-2 ${
                      selection.multiSelectMode
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title={selection.multiSelectMode ? '선택 모드 종료' : '스태프를 선택하여 일괄 수정'}
                  >
                    <span>{selection.multiSelectMode ? '선택 완료' : '선택 모드'}</span>
                    {selection.multiSelectMode && (
                      <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded text-sm">
                        {selection.selectedStaff.size}/{filteredStaffCount}
                      </span>
                    )}
                  </button>
                  {selection.multiSelectMode && selection.selectedStaff.size > 0 && (
                    <>
                      <button
                        onClick={() => modals.bulkTimeEditModal.open()}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2"
                        title={`선택된 ${selection.selectedStaff.size}명 일괄 수정`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        <span>선택 항목 수정 ({selection.selectedStaff.size}명)</span>
                      </button>
                      <button
                        onClick={() => {
                          selection.selectAll(staffData.map(s => s.id));
                          modals.bulkTimeEditModal.open();
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                        title={`전체 ${uniqueStaffCount}명 수정`}
                      >
                        전체 수정
                      </button>
                    </>
                  )}
                </>
              )}
              <button
                onClick={() => modals.qrModal.open()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                QR 스캔
              </button>
            </div>
          )}
        </div>

        {error.global && (
          <div className="bg-red-50 p-4 rounded-lg mb-4">
            <p className="text-red-600">{error.global}</p>
          </div>
        )}

        {/* 모바일 컨트롤 */}
        {(isMobile || isTablet) && (
          <div className="mb-4 space-y-3">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  총 {uniqueStaffCount}명
                  {filteredStaffCount !== uniqueStaffCount &&
                    ` (${filteredStaffCount}명 필터됨)`}
                </span>
                <div className="flex space-x-2">
                  {canEdit && (
                    <button
                      onClick={handleMultiSelectToggle}
                      className={`px-3 py-1 rounded text-sm ${
                        selection.multiSelectMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {selection.multiSelectMode ? '선택 취소' : '선택 모드'}
                    </button>
                  )}
                  <button
                    onClick={() => modals.qrModal.open()}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    QR 스캔
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="스태프 검색..."
                value={filters.searchTerm}
                onChange={e => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* 선택 모드 안내 */}
        {selection.multiSelectMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-blue-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-blue-800">
                <strong>선택 모드:</strong> {isMobile ? '카드를 터치' : '스태프 행을 클릭'}
                하여 선택하세요
              </span>
            </div>
          </div>
        )}

        {/* 스태프 목록 */}
        {uniqueStaffCount === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <p className="text-gray-600 mb-4">이 공고에 할당된 스태프가 없습니다.</p>
            <p className="text-sm text-gray-500">
              지원자 목록에서 지원자를 확정하면 자동으로 스태프로 등록됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(isMobile || isTablet) ? (
              // 모바일 카드 레이아웃
              groupedStaffData.sortedDates.map(date => {
                const staffForDate = groupedStaffData.grouped[date];
                const isExpanded = expandedDates.has(date);

                if (!staffForDate) return null;

                return (
                  <StaffDateGroupMobile
                    key={date}
                    date={date}
                    staffList={staffForDate as any}
                    isExpanded={isExpanded}
                    onToggleExpansion={toggleDateExpansion}
                    onEditWorkTime={handleEditWorkTime}
                    onDeleteStaff={deleteStaffWrapper}
                    getStaffAttendanceStatus={getStaffAttendanceStatus}
                    attendanceRecords={attendanceRecords}
                    formatTimeDisplay={formatTimeDisplay}
                    getTimeSlotColor={getTimeSlotColor}
                    selectedStaff={selection.selectedStaff}
                    onStaffSelect={handleStaffSelect}
                    multiSelectMode={selection.multiSelectMode}
                    onShowProfile={handleShowProfile}
                    eventId={jobPosting?.id}
                    getStaffWorkLog={getStaffWorkLog as any}
                    onReport={handleReport}
                  />
                );
              })
            ) : (
              // 데스크톱 테이블 레이아웃
              groupedStaffData.sortedDates.map(date => {
                const staffForDate = groupedStaffData.grouped[date];
                const isExpanded = expandedDates.has(date);

                if (!staffForDate) return null;

                return (
                  <StaffDateGroup
                    key={date}
                    date={date}
                    staffList={staffForDate as any}
                    isExpanded={isExpanded}
                    onToggleExpansion={toggleDateExpansion}
                    onEditWorkTime={handleEditWorkTime}
                    onDeleteStaff={deleteStaffWrapper}
                    getStaffAttendanceStatus={getStaffAttendanceStatus}
                    attendanceRecords={attendanceRecords}
                    formatTimeDisplay={formatTimeDisplay}
                    getTimeSlotColor={getTimeSlotColor}
                    onShowProfile={handleShowProfile}
                    eventId={jobPosting?.id}
                    canEdit={!!canEdit}
                    getStaffWorkLog={getStaffWorkLog as any}
                    applyOptimisticUpdate={applyOptimisticUpdate}
                    multiSelectMode={selection.multiSelectMode}
                    selectedStaff={selection.selectedStaff}
                    onStaffSelect={handleStaffSelect}
                    onReport={handleReport}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* QR 스캔 모달 */}
      {modals.qrModal.isOpen && jobPosting && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <ManagerScannerModal
            isOpen={modals.qrModal.isOpen}
            onClose={modals.qrModal.close}
            eventId={jobPosting.id}
            eventTitle={jobPosting.title}
            managerId={currentUser?.uid || ''}
            initialMode="check-in"
          />
        </React.Suspense>
      )}

      {/* 시간 수정 모달 */}
      <WorkTimeEditor
        isOpen={modals.workTimeEditor.isOpen}
        onClose={modals.workTimeEditor.close}
        workLog={modals.workTimeEditor.workLog}
        onUpdate={handleWorkTimeUpdate}
      />

      {/* 스태프 프로필 모달 */}
      <StaffProfileModal
        isOpen={modals.profileModal.isOpen}
        onClose={modals.profileModal.close}
        staff={modals.profileModal.staff as any}
        attendanceRecord={
          modals.profileModal.staff
            ? getStaffAttendanceStatus(modals.profileModal.staff.id)
            : undefined
        }
        workLogRecord={
          modals.profileModal.staff
            ? attendanceRecords.find(r => r.staffId === modals.profileModal.staff?.id)
            : undefined
        }
      />

      {/* 일괄 시간 수정 모달 */}
      <BulkTimeEditModal
        isOpen={modals.bulkTimeEditModal.isOpen}
        onClose={() => {
          modals.bulkTimeEditModal.close();
          selection.resetSelection();
        }}
        selectedStaff={staffData
          .filter(staff => selection.selectedStaff.has(staff.id))
          .map(staff => {
            const dateString = staff.assignedDate || getTodayString();
            const workLog = getStaffWorkLog(staff.id, dateString);

            return {
              id: staff.id,
              name: staff.name || '이름 미정',
              assignedDate: dateString,
              ...(staff.assignedTime && { assignedTime: staff.assignedTime }),
              ...(workLog?.id && { workLogId: workLog.id }),
            };
          })}
        eventId={jobPosting?.id || 'default-event'}
        onComplete={() => {
          // 실시간 구독으로 자동 업데이트
        }}
      />

      {/* 신고 모달 */}
      {modals.reportModal.isOpen && modals.reportModal.target && (
        <ReportModal
          isOpen={modals.reportModal.isOpen}
          onClose={modals.reportModal.close}
          targetUser={modals.reportModal.target}
          event={{
            id: jobPosting?.id || '',
            title: jobPosting?.title || '',
            date: getTodayString(),
          }}
          reporterType="employer"
        />
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={modals.deleteConfirmModal.data.isOpen}
        onClose={modals.deleteConfirmModal.close}
        onConfirm={handleDeleteConfirm}
        title="스태프 삭제 확인"
        message={`${modals.deleteConfirmModal.data.staffName} 스태프를 ${modals.deleteConfirmModal.data.date} 날짜에서 삭제하시겠습니까?\n\n⚠️ 주의사항:\n• 확정 스태프 목록에서 제거됩니다\n• 관련 WorkLog가 삭제됩니다\n• 이 작업은 되돌릴 수 없습니다`}
        confirmText="삭제"
        cancelText="취소"
        isDangerous={true}
        isLoading={loading?.initial || false}
      />

      {/* 모바일 선택 바 */}
      {selection.multiSelectMode &&
        selection.selectedStaff.size > 0 &&
        canEdit &&
        (isMobile || isTablet) && (
          <MobileSelectionBar
            selectedCount={selection.selectedStaff.size}
            totalCount={uniqueStaffCount}
            onSelectAll={() => selection.selectAll(staffData.map(s => s.id))}
            onDeselectAll={selection.deselectAll}
            onBulkEdit={() => modals.bulkTimeEditModal.open()}
            onBulkDelete={() => {
              if (selection.selectedStaff.size === 0) return;
              handleBulkDelete(Array.from(selection.selectedStaff));
            }}
            onCancel={() => {
              selection.deselectAll();
              selection.toggleMultiSelectMode();
            }}
            isAllSelected={selection.isAllSelected(staffData.map(s => s.id))}
          />
        )}

      {/* 데스크톱 플로팅 선택 정보 */}
      {selection.multiSelectMode &&
        selection.selectedStaff.size > 0 &&
        canEdit &&
        !isMobile &&
        !isTablet && (
          <div className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-4 z-50 floating-selection-info">
            <span className="font-medium">{selection.selectedStaff.size}명 선택됨</span>
            <button
              onClick={() => modals.bulkTimeEditModal.open()}
              className="bg-white text-blue-600 px-4 py-1 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              일괄 수정
            </button>
            <button
              onClick={() => handleBulkDelete(Array.from(selection.selectedStaff))}
              className="bg-red-600 text-white px-4 py-1 rounded-full text-sm font-medium hover:bg-red-700 transition-colors"
            >
              삭제
            </button>
            <button
              onClick={() => {
                selection.deselectAll();
                selection.toggleMultiSelectMode();
              }}
              className="text-white hover:text-blue-200 transition-colors"
              aria-label="선택 취소"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
    </>
  );
};

export default StaffManagementTab;
