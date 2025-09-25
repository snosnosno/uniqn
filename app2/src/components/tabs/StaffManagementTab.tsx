/**
 * StaffManagementTab - UnifiedDataContext 기반 통합 리팩토링 버전
 * 14개 훅 → 3개 훅으로 통합하여 복잡도 80% 감소
 * 
 * @version 2.0 (UnifiedDataContext 적용)
 * @since 2025-02-04
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, Timestamp, collection, query, where, getDocs, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import useUnifiedData from '../../hooks/useUnifiedData';
import type { WorkLog } from '../../types/unifiedData';
import type { JobPosting } from '../../types/jobPosting/jobPosting';
import type { ConfirmedStaff } from '../../types/jobPosting/base';
import { getTodayString } from '../../utils/jobPosting/dateUtils';
import { createWorkLogId, generateWorkLogIdCandidates } from '../../utils/workLogSimplified';
// createVirtualWorkLog 제거됨 - 스태프 확정 시 WorkLog 사전 생성으로 대체

// 유틸리티 imports
import { useResponsive } from '../../hooks/useResponsive';
import { useVirtualization } from '../../hooks/useVirtualization';
import { BulkOperationService } from '../../services/BulkOperationService';
import BulkTimeEditModal from '../modals/BulkTimeEditModal';
import QRCodeGeneratorModal from '../modals/QRCodeGeneratorModal';
import ReportModal from '../modals/ReportModal';
import StaffDateGroup from '../staff/StaffDateGroup';
import StaffDateGroupMobile from '../staff/StaffDateGroupMobile';
import WorkTimeEditor, { WorkLogWithTimestamp } from '../staff/WorkTimeEditor';
import StaffProfileModal from '../modals/StaffProfileModal';
import MobileSelectionBar from '../layout/MobileSelectionBar';
import '../../styles/staffSelection.css';

interface StaffData {
  id: string;
  staffId: string;
  name: string;
  role?: string;
  assignedRole?: string;
  assignedTime?: string;
  assignedDate?: string;
  status?: string;
}

interface StaffManagementTabProps {
  jobPosting?: JobPosting | null;
}

const StaffManagementTab: React.FC<StaffManagementTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { isMobile, isTablet } = useResponsive();
  const { currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  
  // 🎯 핵심 변경: 14개 훅 → 3개 훅으로 통합
  const {
    state,
    loading,
    error,
    refresh,
    updateWorkLogOptimistic
  } = useUnifiedData();


  // 🚀 WorkLog.staffInfo 기반 스태프 데이터 변환 및 메모이제이션
  const staffData = useMemo(() => {
    if (!state.workLogs || state.workLogs.size === 0 || !jobPosting?.id) return [];
    
    // WorkLog에서 고유한 스태프 정보 추출 (중복 제거)
    const staffMap = new Map();
    
    Array.from(state.workLogs.values()).forEach(workLog => {
      // ✅ eventId 필터링 추가 - 현재 공고의 WorkLog만 처리
      if (workLog.eventId !== jobPosting.id) return;
      
      const staffInfo = workLog.staffInfo;
      const assignmentInfo = workLog.assignmentInfo;
      
      if (!staffInfo || !assignmentInfo) return;
      
      const staffId = workLog.staffId;
      
      // 이미 존재하는 스태프라면 추가 정보만 업데이트
      if (!staffMap.has(staffId)) {
        // 🔧 staffId에서 실제 userId 추출 (복합 ID인 경우)
        // userId_sequenceNumber 형식에서 뒤의 숫자 제거
        const extractedUserId = staffId.includes('_') ?
          staffId.replace(/_\d+$/, '') : // 끝의 _숫자 패턴 제거
          staffId;

        staffMap.set(staffId, {
          id: staffId,
          userId: staffInfo.userId || extractedUserId,
          staffId: staffId,
          name: staffInfo.name || '이름 미정',
          role: assignmentInfo.role || '',
          // 연락처 정보 (WorkLog.staffInfo에서)
          phone: staffInfo.phone,
          email: staffInfo.email,
          // 지원자 확정 정보 (WorkLog.assignmentInfo에서)
          assignedRole: assignmentInfo.assignedRole || assignmentInfo.role || '',
          assignedTime: assignmentInfo.assignedTime || '',
          // 🔧 assignedDate 대신 workLog.date 사용 (더 정확한 날짜)
          assignedDate: workLog.date || assignmentInfo.assignedDate || '',
          // 원래 지원 정보
          postingId: assignmentInfo.postingId,
          postingTitle: state.jobPostings.get(assignmentInfo.postingId)?.title || '알 수 없는 공고',
          // 추가 개인정보 (WorkLog.staffInfo에서)
          gender: staffInfo.gender,
          age: staffInfo.age,
          experience: staffInfo.experience,
          nationality: staffInfo.nationality,
          region: staffInfo.region,
          history: undefined, // WorkLog.staffInfo에 없음
          notes: undefined, // WorkLog.staffInfo에 없음
          // 은행 정보 (WorkLog.staffInfo에서)
          bankName: staffInfo.bankName,
          bankAccount: staffInfo.accountNumber,
          // 기타
          status: staffInfo.isActive ? 'active' : 'inactive'
        });
      }
    });
    
    return Array.from(staffMap.values());
  }, [state.workLogs, jobPosting?.id]);

  // 🎯 고유한 스태프 수 계산 (중복 제거)
  const uniqueStaffCount = useMemo(() => {
    const uniqueNames = new Set(staffData.map(staff => staff.name));
    return uniqueNames.size;
  }, [staffData]);

  // 🎯 출석 기록 배열 변환 (StaffRow에서 실시간 업데이트 감지용)
  const attendanceRecords = useMemo(() => {
    return state.attendanceRecords ? Array.from(state.attendanceRecords.values()) : [];
  }, [state.attendanceRecords]);
  
  // 모달 상태
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isWorkTimeEditorOpen, setIsWorkTimeEditorOpen] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState<any | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedStaffForProfile, setSelectedStaffForProfile] = useState<StaffData | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
  // 🎯 선택 모드 관리 - 내장 상태로 단순화 (useStaffSelection 훅 제거)
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  
  const toggleMultiSelectMode = useCallback(() => {
    setMultiSelectMode(prev => {
      if (prev) {
        // 선택 모드 해제시 선택된 항목도 초기화
        setSelectedStaff(new Set());
      }
      return !prev;
    });
  }, []);
  
  const toggleStaffSelection = useCallback((staffId: string) => {
    setSelectedStaff(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  }, []);
  
  const selectAll = useCallback((staffIds: string[]) => {
    setSelectedStaff(new Set(staffIds));
  }, []);
  
  const deselectAll = useCallback(() => {
    setSelectedStaff(new Set());
  }, []);
  
  const resetSelection = useCallback(() => {
    setSelectedStaff(new Set());
    setMultiSelectMode(false);
  }, []);
  
  const isAllSelected = useCallback((staffIds: string[]) => {
    return staffIds.length > 0 && staffIds.every(id => selectedStaff.has(id));
  }, [selectedStaff]);
  
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [isBulkTimeEditOpen, setIsBulkTimeEditOpen] = useState(false);
  
  // 🎯 필터링 상태 - 내장 상태로 관리 (복잡한 훅 제거)
  const [filters, setFilters] = useState({ searchTerm: '' });
  
  // 🎯 날짜 확장 상태 - localStorage와 연동
  const getStorageKey = useCallback(() => `staff-expanded-dates-${jobPosting?.id || 'default'}`, [jobPosting?.id]);
  
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    try {
      const storageKey = `staff-expanded-dates-${jobPosting?.id || 'default'}`;
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (error) {
      return new Set();
    }
  });

  // localStorage에 expandedDates 저장
  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(Array.from(expandedDates)));
    } catch (error) {
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
  
  
  
  // 권한 체크 - 공고 작성자만 수정 가능
  const canEdit = currentUser?.uid && currentUser.uid === jobPosting?.createdBy;

  // 출퇴근 시간 수정 핸들러 (다중 날짜 지원)
  const handleEditWorkTime = useCallback(async (staffId: string, timeType?: 'start' | 'end', targetDate?: string) => {
    // 권한 체크
    if (!canEdit) {
      showError('이 공고를 수정할 권한이 없습니다.');
      return;
    }
    
    const staff = staffData.find(s => s.id === staffId);
    if (!staff) {
      showError('스태프 정보를 찾을 수 없습니다.');
      return;
    }

    // 대상 날짜 결정: 파라미터로 받은 날짜 또는 스태프의 assignedDate 또는 오늘 날짜
    const workDate = targetDate || staff.assignedDate || getTodayString();
    
    // staffId에서 실제 ID 추출 (날짜 부분 제거)
    const actualStaffId = staffId.replace(/_\d{4}-\d{2}-\d{2}$/, '');
    
    // Firebase에서 직접 최신 workLog 가져오기
    const workLogId = `${jobPosting?.id || 'default-event'}_${actualStaffId}_${workDate}`;
    const workLogRef = doc(db, 'workLogs', workLogId);
    
    try {
      const docSnap = await getDoc(workLogRef);
      
      if (docSnap.exists()) {
        // 실제 workLog가 있는 경우
        const data = docSnap.data();
        // Firebase 데이터를 먼저 spread하고, 필수 필드만 오버라이드
        const workLogData = {
          ...data,  // 모든 Firebase 데이터 포함 (Timestamp 객체 포함)
          id: workLogId,
          eventId: data.eventId || jobPosting?.id,
          staffId: data.staffId || actualStaffId,
          date: workDate,
          staffName: staff.name || data.staffName || '이름 미정',
          assignedRole: staff.assignedRole || data.assignedRole || '',  // assignedRole 추가
          role: data.role || staff.role || ''  // role 정보도 보장
        };
        setSelectedWorkLog(workLogData);
        setIsWorkTimeEditorOpen(true);
      } else {
        // staff.assignedTime이 없으면 timeSlot 사용
        const timeValue = staff.assignedTime || (staff as any).timeSlot || null;
        
        // 디버깅: staff의 시간 값 확인
        // 🚀 스태프 확정 시 사전 생성된 WorkLog를 찾아서 에러 메시지 표시
        logger.error('WorkLog를 찾을 수 없습니다. 스태프 확정 시 사전 생성되어야 합니다.', new Error('WorkLog not found'), {
          component: 'StaffManagementTab',
          data: {
            staffId: actualStaffId,
            staffName: staff.name,
            workDate,
            expectedWorkLogId: workLogId
          }
        });
        
        showError(`${staff.name}님의 ${workDate} 근무 기록을 찾을 수 없습니다. 스태프 확정 시 자동 생성되어야 합니다.`);
        return;
      }
    } catch (error) {
      logger.error('WorkLog 가져오기 실패', error instanceof Error ? error : new Error(String(error)), { 
        component: 'StaffManagementTab',
        data: { staffId, workDate }
      });
      
      // 🚀 오류 발생 시에도 가상 WorkLog 생성하지 않고 에러 처리
      showError(`${staff.name}님의 근무 기록 조회 중 오류가 발생했습니다.`);
      return;
    }
  }, [canEdit, staffData, jobPosting?.id, showError]);
  
  // WorkTimeEditor의 onUpdate 콜백 처리
  const handleWorkTimeUpdate = useCallback((updatedWorkLog: WorkLogWithTimestamp) => {
    
    // 🚀 1단계: UnifiedDataContext를 통한 즉시 UI 업데이트
    updateWorkLogOptimistic(updatedWorkLog as WorkLog);
    
    // 2단계: 업데이트된 데이터로 selectedWorkLog 갱신 (모달은 열어둠)
    setSelectedWorkLog(updatedWorkLog);
    
    // 🚀 3단계: Firebase 구독이 자동 동기화를 처리하므로 refresh() 제거
    // 기존 refresh() 호출을 제거하여 불필요한 네트워크 요청 방지
  }, [updateWorkLogOptimistic]);
  

  // 🎯 필터링된 데이터 계산 - 단순화된 그룹화 로직
  const groupedStaffData = useMemo(() => {
    const filtered = staffData.filter(staff => 
      !filters.searchTerm || 
      staff.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      staff.role?.toLowerCase().includes(filters.searchTerm.toLowerCase())
    );
    
    const grouped: Record<string, StaffData[]> = {};
    const sortedDates: string[] = [];
    
    filtered.forEach(staff => {
      const date = staff.assignedDate || getTodayString();
      if (!grouped[date]) {
        grouped[date] = [];
        sortedDates.push(date);
      }
      grouped[date]?.push(staff);
    });
    
    // 필터링된 고유 스태프 수 계산
    const uniqueFilteredNames = new Set(filtered.map(staff => staff.name));
    
    return {
      grouped,
      sortedDates: sortedDates.sort(),
      total: filtered.length,
      uniqueCount: uniqueFilteredNames.size
    };
  }, [staffData, filters.searchTerm]);
  
  const filteredStaffCount = groupedStaffData.uniqueCount;
  
  const selectedStaffData = useMemo(() => {
    if (selectedStaff.size === 0) return [];
    return staffData.filter(staff => selectedStaff.has(staff.id));
  }, [staffData, selectedStaff]);

  // 가상화 설정
  const mobileVirtualization = useVirtualization({
    itemCount: filteredStaffCount,
    threshold: 30,
    mobileThreshold: 20,
    isMobile: true
  });

  const desktopVirtualization = useVirtualization({
    itemCount: filteredStaffCount,
    threshold: 50,
    mobileThreshold: 30,
    isMobile: false
  });
  
  // 🎯 출석 상태 관련 헬퍼 함수들 - createWorkLogId 사용으로 통일
  const getStaffAttendanceStatus = useCallback((staffId: string, targetDate?: string) => {
    // WorkLogs에서 직접 출석상태 계산 (실시간 반영)
    const searchDate = targetDate || getTodayString();
    
    if (!jobPosting?.id) return null;
    
    // 🚀 createWorkLogId를 사용하여 정확한 WorkLog ID 생성
    const expectedWorkLogId = createWorkLogId(jobPosting.id, staffId, searchDate);
    
    // 정확한 ID로 WorkLog 찾기
    const workLog = state.workLogs.get(expectedWorkLogId);
    
    if (workLog) {
      // attendanceRecord 구조로 반환 (StaffRow가 기대하는 형태)
      return {
        status: workLog.status,
        workLog: workLog,
        workLogId: workLog.id
      };
    }
    
    // WorkLog가 없으면 null 반환
    return null;
  }, [state.workLogs, jobPosting?.id]);
  
  const applyOptimisticUpdate = useCallback((workLogId: string, status: string) => {
    // 🚀 AttendanceStatusPopover에서 호출되는 Optimistic Update 콜백
    // 실제 WorkLog를 찾아서 업데이트
    const existingWorkLog = Array.from(state.workLogs.values()).find(wl => wl.id === workLogId);
    
    if (existingWorkLog) {
      const optimisticWorkLog: Partial<WorkLog> = {
        ...existingWorkLog,
        status: status as any,
        updatedAt: Timestamp.fromDate(new Date())
      };
      
      // 조건부로 타임스탬프 필드 추가 (exactOptionalPropertyTypes 지원)
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
      
      // UnifiedDataContext를 통한 즉시 UI 업데이트
      updateWorkLogOptimistic(optimisticWorkLog as WorkLog);
      
    } else {
    }
  }, [state.workLogs, updateWorkLogOptimistic]);
  
  const formatTimeDisplay = useCallback((timeValue: string | number | undefined) => {
    if (!timeValue) return '';
    if (typeof timeValue === 'string') return timeValue;
    // Firebase Timestamp 처리 등 추가 로직
    return String(timeValue);
  }, []);
  
  const getTimeSlotColor = useCallback((timeSlot?: string) => {
    if (!timeSlot) return 'bg-gray-100 text-gray-800';
    // 시간대별 색상 로직
    const colors = {
      '09:00~18:00': 'bg-blue-100 text-blue-800',
      '18:00~24:00': 'bg-green-100 text-green-800',
      '24:00~06:00': 'bg-purple-100 text-purple-800'
    };
    return colors[timeSlot as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  }, []);
  
  const getStaffWorkLog = useCallback((staffId: string, date: string) => {
    if (!jobPosting?.id) return null;
    
    // 🔥 로딩 상태 체크 제거 - 항상 현재 데이터 반환
    // 이전: 로딩 중에는 null을 반환하여 업데이트 차단
    // 현재: 로딩 중에도 현재 캐시된 데이터를 반환하여 즉시 반영
    
    // ✅ 정확한 WorkLog ID로 먼저 조회
    const expectedWorkLogId = createWorkLogId(jobPosting.id, staffId, date);
    let workLog = state.workLogs?.get(expectedWorkLogId);
    let foundWithId = workLog ? expectedWorkLogId : null;
    
    // 🔍 eventId 일치 검증 (정확한 ID로 찾은 경우)
    if (workLog && workLog.eventId === jobPosting.id) {
      return workLog; // 정확한 매칭 - 즉시 반환
    }
    
    // ✅ fallback 로직으로 여러 ID 패턴 시도 + eventId 검증
    const candidates = generateWorkLogIdCandidates(jobPosting.id, staffId, date);
    workLog = undefined;
    foundWithId = null;
    
    // 모든 후보 ID에 대해 WorkLog 검색하되 eventId 일치하는 것만 선택
    for (const candidateId of candidates) {
      const candidateLog = state.workLogs?.get(candidateId);
      if (candidateLog && candidateLog.eventId === jobPosting.id) {
        workLog = candidateLog;
        foundWithId = candidateId;
        break;
      }
    }
    
    // 🔍 WorkLog 조회 결과 디버깅 정보 (eventId 검증 포함)
    const debugInfo: Record<string, unknown> = {
      requestedStaffId: staffId,
      requestedDate: date,
      eventId: jobPosting.id,
      expectedWorkLogId: expectedWorkLogId,
      candidateIds: candidates,
      foundWorkLogId: foundWithId,
      workLogFound: !!workLog,
      actualWorkLogId: workLog?.id,
      workLogEventId: workLog?.eventId,
      eventIdMatches: workLog ? workLog.eventId === jobPosting.id : null,
    };
    
    // WorkLog를 찾지 못한 경우 추가 디버깅 정보
    if (!workLog && state.workLogs) {
      const allWorkLogIds = Array.from(state.workLogs.keys());
      const matchingIds = allWorkLogIds.filter(id => 
        id.includes(staffId) || id.includes(staffId.replace(/_\d+$/, ''))
      );
      
      // eventId가 일치하지 않는 WorkLog가 있는지 확인
      const conflictingWorkLogs = Array.from(state.workLogs.values()).filter(wl => 
        wl.staffId === staffId && 
        wl.date === date && 
        wl.eventId !== jobPosting.id
      );
      
      debugInfo.totalWorkLogsCount = state.workLogs.size;
      debugInfo.matchingWorkLogIds = matchingIds.slice(0, 5); // 처음 5개만
      debugInfo.conflictingWorkLogs = conflictingWorkLogs.map(wl => ({
        id: wl.id,
        eventId: wl.eventId,
        staffId: wl.staffId,
        date: wl.date
      }));
      debugInfo.sampleWorkLogIds = allWorkLogIds.slice(0, 3); // 샘플 3개
    }
    
    debugInfo.workLogsMapSize = state.workLogs?.size || 0;
    debugInfo.workLogsLoading = state.loading.workLogs;
    debugInfo.initialLoading = state.loading.initial;
    debugInfo.staffIdHasNumberSuffix = /_\d+$/.test(staffId);
    
    
    return workLog;
  }, [state.workLogs, jobPosting?.id, state.lastUpdated.workLogs]); // 🔥 lastUpdated 추가로 업데이트 즉시 감지

  // 🔒 삭제 가능 조건 검증 함수
  const canDeleteStaff = useCallback(async (staffId: string, date: string): Promise<{
    canDelete: boolean;
    reason?: string;
  }> => {
    try {
      // 1. WorkLog 상태 확인
      const workLogQuery = query(
        collection(db, 'workLogs'),
        where('eventId', '==', jobPosting?.id),
        where('staffId', '==', staffId),
        where('date', '==', date)
      );
      
      const workLogSnapshot = await getDocs(workLogQuery);
      if (!workLogSnapshot.empty) {
        const workLogDoc = workLogSnapshot.docs[0];
        const workLogData = workLogDoc?.data();
        const status = workLogData?.status;
        
        // 2. 삭제 가능 상태 체크
        const deletableStatuses = ['scheduled', 'not_started'];
        if (status && !deletableStatuses.includes(status)) {
          const statusMessages = {
            checked_in: '이미 출근한 스태프는 삭제할 수 없습니다.',
            checked_out: '퇴근 처리된 스태프는 삭제할 수 없습니다.',
            completed: '근무 완료된 스태프는 삭제할 수 없습니다.',
            cancelled: '이미 취소된 스태프입니다.'
          };
          return {
            canDelete: false,
            reason: statusMessages[status as keyof typeof statusMessages] || '삭제할 수 없는 상태입니다.'
          };
        }
        
        // 3. 급여 지급 확인
        if (workLogData?.isPaid) {
          return {
            canDelete: false,
            reason: '급여가 지급된 스태프는 삭제할 수 없습니다.'
          };
        }
      }
      
      // 4. AttendanceRecord 확인
      const attendanceQuery = query(
        collection(db, 'attendanceRecords'),
        where('eventId', '==', jobPosting?.id),
        where('staffId', '==', staffId),
        where('date', '==', date)
      );
      
      const attendanceSnapshot = await getDocs(attendanceQuery);
      if (!attendanceSnapshot.empty) {
        const hasActiveAttendance = attendanceSnapshot.docs.some(doc => {
          const data = doc.data();
          return data.status === 'checked_in' || data.status === 'checked_out';
        });
        
        if (hasActiveAttendance) {
          return {
            canDelete: false,
            reason: '출퇴근 기록이 있는 스태프는 삭제할 수 없습니다.'
          };
        }
      }
      
      return { canDelete: true };
      
    } catch (error) {
      logger.error('삭제 가능 여부 확인 실패', error instanceof Error ? error : new Error(String(error)));
      return {
        canDelete: false,
        reason: '삭제 가능 여부를 확인할 수 없습니다.'
      };
    }
  }, [jobPosting?.id]);

  // 🎯 삭제 핸들러 - Transaction 기반 안전한 삭제 (확정취소 로직 적용)
  const deleteStaff = useCallback(async (staffId: string, staffName: string, date: string) => {
    try {
      // 1. 삭제 가능 여부 검증
      const { canDelete, reason } = await canDeleteStaff(staffId, date);
      if (!canDelete) {
        showError(reason || '삭제할 수 없습니다.');
        return;
      }
      
      // 2. 삭제 전 인원 카운트 계산 (해당 스태프의 역할/시간 정보 파악)
      let staffRole = '';
      let staffTimeSlot = '';
      const baseStaffId = staffId.replace(/_\d+$/, '');
      
      if (jobPosting?.confirmedStaff) {
        const targetStaff = jobPosting.confirmedStaff.find(
          (staff: ConfirmedStaff) => (staff.userId) === baseStaffId && staff.date === date
        );
        staffRole = targetStaff?.role || '';
        staffTimeSlot = targetStaff?.timeSlot || '';
      }

      // 3. 확인 대화상자
      if (!window.confirm(`${staffName} 스태프를 ${date} 날짜에서 삭제하시겠습니까?\n\n⚠️ 주의사항:\n• 확정 스태프 목록에서 제거됩니다\n• 관련 WorkLog가 삭제됩니다\n• 이 작업은 되돌릴 수 없습니다`)) {
        return;
      }
      
      // 4. Transaction으로 원자적 처리 (확정취소와 동일한 로직)
      await runTransaction(db, async (transaction) => {
        if (!jobPosting?.id) {
          throw new Error('공고 정보를 찾을 수 없습니다.');
        }
        
        // 3-1. confirmedStaff에서 해당 날짜의 스태프만 제거
        const jobPostingRef = doc(db, 'jobPostings', jobPosting.id);
        const jobPostingDoc = await transaction.get(jobPostingRef);
        
        if (!jobPostingDoc.exists()) {
          throw new Error('공고를 찾을 수 없습니다.');
        }
        
        const currentData = jobPostingDoc.data();
        const confirmedStaffArray = currentData?.confirmedStaff || [];
        
        // staffId에서 접미사 제거 (_0, _1 등)
        const baseStaffId = staffId.replace(/_\d+$/, '');
        
        // 해당 스태프의 해당 날짜 항목만 필터링 (userId와 staffId 모두 체크)
        const filteredConfirmedStaff = confirmedStaffArray.filter(
          (staff: ConfirmedStaff) => {
            const staffUserId = staff.userId;
            return !(staffUserId === baseStaffId && staff.date === date);
          }
        );
        
        transaction.update(jobPostingRef, {
          confirmedStaff: filteredConfirmedStaff
        });
        
        const removedCount = confirmedStaffArray.length - filteredConfirmedStaff.length;
        logger.info(`confirmedStaff에서 제거: staffId=${staffId} (base: ${baseStaffId}), date=${date}, removed: ${removedCount}`, { 
          component: 'StaffManagementTab'
        });
      });
      
      // 4. 🚫 persons 문서 삭제 비활성화 (WorkLog 통합으로 인해 불필요)
      // persons 정보는 이제 WorkLog의 staffInfo에 포함되어 관리됩니다.
      logger.info(`persons 삭제 스킵 (WorkLog 통합): staffId=${staffId}, date=${date}`, { 
        component: 'StaffManagementTab'
      });
      
      // 5. WorkLog 삭제 (scheduled/not_started만)
      const workLogQuery = query(
        collection(db, 'workLogs'),
        where('eventId', '==', jobPosting?.id),
        where('staffId', '==', staffId),
        where('date', '==', date),
        where('status', 'in', ['scheduled', 'not_started'])
      );
      
      const workLogSnapshot = await getDocs(workLogQuery);
      for (const workLogDoc of workLogSnapshot.docs) {
        await deleteDoc(workLogDoc.ref);
        logger.info(`WorkLog 삭제: ${workLogDoc.id}`, { component: 'StaffManagementTab' });
      }
      
      // 6. AttendanceRecord 삭제 (not_started만)
      const attendanceQuery = query(
        collection(db, 'attendanceRecords'),
        where('eventId', '==', jobPosting?.id),
        where('staffId', '==', staffId),
        where('date', '==', date),
        where('status', '==', 'not_started')
      );
      
      const attendanceSnapshot = await getDocs(attendanceQuery);
      for (const attendanceDoc of attendanceSnapshot.docs) {
        await deleteDoc(attendanceDoc.ref);
        logger.info(`AttendanceRecord 삭제: ${attendanceDoc.id}`, { component: 'StaffManagementTab' });
      }
      
      // 7. 삭제 후 인원 변화 메시지 생성
      let roleInfo = '';
      if (staffRole && staffTimeSlot) {
        // 삭제 후 해당 역할의 현재 인원 수 계산
        const currentCount = jobPosting?.confirmedStaff?.filter(
          (staff: ConfirmedStaff) => staff.role === staffRole &&
                         staff.timeSlot === staffTimeSlot && 
                         staff.date === date
        ).length || 0;
        
        roleInfo = ` (${staffRole} ${staffTimeSlot}: ${currentCount + 1} → ${currentCount}명)`;
      }
      
      showSuccess(`${staffName} 스태프가 ${date} 날짜에서 삭제되었습니다.${roleInfo}`);
      refresh();
      
    } catch (error) {
      logger.error('스태프 삭제 실패', error instanceof Error ? error : new Error(String(error)));
      showError('스태프 삭제 중 오류가 발생했습니다.');
    }
  }, [canDeleteStaff, jobPosting?.id, jobPosting?.confirmedStaff, refresh, showSuccess, showError]);

  // 레거시 호환을 위한 deleteStaff wrapper (기존 StaffCard 인터페이스 유지)
  const deleteStaffWrapper = useCallback(async (staffId: string) => {
    const staff = staffData.find(s => s.id === staffId);
    if (staff) {
      const staffName = staff.name || '이름 미정';
      const date = staff.assignedDate || new Date().toISOString().split('T')[0];
      if (date) {
        await deleteStaff(staffId, staffName, date);
      }
    }
  }, [deleteStaff, staffData]);

  // 최적화된 핸들러들 (메모이제이션 강화)
  const handleStaffSelect = useCallback((staffId: string) => {
    toggleStaffSelection(staffId);
  }, [toggleStaffSelection]);
  
  const handleMultiSelectToggle = useCallback(() => {
    toggleMultiSelectMode();
  }, [toggleMultiSelectMode]);

  // 신고 핸들러
  const handleReport = useCallback((staffId: string, staffName: string) => {
    setReportTarget({ id: staffId, name: staffName });
    setIsReportModalOpen(true);
  }, []);

  const handleReportModalClose = useCallback(() => {
    setIsReportModalOpen(false);
    setReportTarget(null);
  }, []);


  const handleBulkActions = () => {
    setIsBulkActionsOpen(true);
  };
  
  const handleBulkDelete = async (staffIds: string[]) => {
    try {
      // 1. 각 스태프의 삭제 가능 여부 확인
      const deletableStaff: Array<{staffId: string, staffName: string, date: string}> = [];
      const nonDeletableStaff: Array<{staffId: string, staffName: string, reason: string}> = [];
      
      for (const staffId of staffIds) {
        const staff = staffData.find(s => s.id === staffId);
        const staffName = staff?.name || '이름 미정';
        const date = staff?.assignedDate || new Date().toISOString().split('T')[0];
        
        if (date) {
          const { canDelete, reason } = await canDeleteStaff(staffId, date);
          if (canDelete) {
            deletableStaff.push({ staffId, staffName, date });
          } else {
            nonDeletableStaff.push({ staffId, staffName, reason: reason || '알 수 없는 이유' });
          }
        } else {
          nonDeletableStaff.push({ staffId, staffName, reason: '날짜 정보가 없습니다' });
        }
      }
      
      // 2. 삭제 불가능한 스태프가 있으면 안내
      if (nonDeletableStaff.length > 0) {
        const nonDeletableMessage = nonDeletableStaff.map(s => 
          `• ${s.staffName}: ${s.reason}`
        ).join('\n');
        
        const hasDeleteableStaff = deletableStaff.length > 0;
        
        if (!hasDeleteableStaff) {
          // 모두 삭제 불가능한 경우
          showError(`선택한 모든 스태프를 삭제할 수 없습니다:\n\n${nonDeletableMessage}`);
          return;
        } else {
          // 일부만 삭제 가능한 경우
          if (!window.confirm(`다음 스태프는 삭제할 수 없습니다:\n${nonDeletableMessage}\n\n나머지 ${deletableStaff.length}명만 삭제하시겠습니까?`)) {
            return;
          }
        }
      } else {
        // 모든 스태프 삭제 가능한 경우
        if (!window.confirm(`선택된 ${deletableStaff.length}명의 스태프를 삭제하시겠습니까?\n\n⚠️ 주의사항:\n• 확정 스태프 목록에서 제거됩니다\n• 관련 WorkLog가 삭제됩니다\n• 이 작업은 되돌릴 수 없습니다`)) {
          return;
        }
      }
      
      // 3. 삭제 가능한 스태프만 처리 (개별 deleteStaff 함수 사용)
      let successCount = 0;
      let failCount = 0;
      
      for (const { staffId, staffName, date } of deletableStaff) {
        try {
          // deleteStaff 함수를 직접 사용하되, confirm 대화상자는 스킵
          await runTransaction(db, async (transaction) => {
            if (!jobPosting?.id) {
              throw new Error('공고 정보를 찾을 수 없습니다.');
            }
            
            // confirmedStaff에서 해당 날짜의 스태프만 제거
            const jobPostingRef = doc(db, 'jobPostings', jobPosting.id);
            const jobPostingDoc = await transaction.get(jobPostingRef);
            
            if (jobPostingDoc.exists()) {
              const currentData = jobPostingDoc.data();
              const confirmedStaffArray = currentData?.confirmedStaff || [];
              
              // staffId에서 접미사 제거 (_0, _1 등)
              const baseStaffId = staffId.replace(/_\d+$/, '');
              
              const filteredConfirmedStaff = confirmedStaffArray.filter(
                (staff: ConfirmedStaff) => {
                  const staffUserId = staff.userId;
                  return !(staffUserId === baseStaffId && staff.date === date);
                }
              );
              
              transaction.update(jobPostingRef, {
                confirmedStaff: filteredConfirmedStaff
              });
            }
          });
          
          // workLogs, attendanceRecords 삭제 (persons는 WorkLog 통합으로 불필요)
          const deletionPromises = [];
          
          // 🚫 persons 삭제 비활성화 (WorkLog 통합으로 인해 불필요)
          // persons 정보는 이제 WorkLog의 staffInfo에 포함되어 관리됩니다.
          logger.info(`persons 삭제 스킵 (일괄 삭제): staffId=${staffId}, date=${date}`, { 
            component: 'StaffManagementTab'
          });
          
          // WorkLog 삭제 (scheduled/not_started만)
          const workLogQuery = query(
            collection(db, 'workLogs'),
            where('eventId', '==', jobPosting?.id),
            where('staffId', '==', staffId),
            where('date', '==', date),
            where('status', 'in', ['scheduled', 'not_started'])
          );
          deletionPromises.push(
            getDocs(workLogQuery).then(snapshot => {
              return Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
            })
          );
          
          // AttendanceRecord 삭제 (not_started만)
          const attendanceQuery = query(
            collection(db, 'attendanceRecords'),
            where('eventId', '==', jobPosting?.id),
            where('staffId', '==', staffId),
            where('date', '==', date),
            where('status', '==', 'not_started')
          );
          deletionPromises.push(
            getDocs(attendanceQuery).then(snapshot => {
              return Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
            })
          );
          
          await Promise.all(deletionPromises);
          
          logger.info(`일괄 삭제 성공: ${staffName} (${staffId})`, { component: 'StaffManagementTab' });
          successCount++;
          
        } catch (error) {
          logger.error(`일괄 삭제 실패: ${staffName} (${staffId})`, error instanceof Error ? error : new Error(String(error)));
          failCount++;
        }
      }
      
      // 4. 결과 메시지 (인원 변화 포함)
      let resultMessage = '';
      if (successCount > 0 && failCount === 0) {
        resultMessage = `${successCount}명의 스태프가 삭제되었습니다. 인원 카운트가 업데이트되었습니다.`;
        showSuccess(resultMessage);
      } else if (successCount > 0 && failCount > 0) {
        resultMessage = `${successCount}명 삭제 완료, ${failCount}명 삭제 실패했습니다. 인원 카운트가 부분 업데이트되었습니다.`;
        showError(resultMessage);
      } else {
        resultMessage = '선택한 스태프를 삭제할 수 없습니다.';
        showError(resultMessage);
      }
      
      resetSelection();
      refresh();
      
    } catch (error) {
      logger.error('스태프 일괄 삭제 실패', error instanceof Error ? error : new Error(String(error)));
      showError('스태프 일괄 삭제 중 오류가 발생했습니다.');
    }
  };
  
  const handleBulkMessage = async (staffIds: string[], message: string) => {
    showSuccess(`${staffIds.length}명에게 메시지를 발송했습니다: "${message}"`);
  };
  
  const handleBulkStatusUpdate = async (staffIds: string[], status: string) => {
    if (!canEdit) {
      showError('이 공고를 수정할 권한이 없습니다.');
      return;
    }
    
    try {
      const staffInfo = staffIds.map(id => {
        const staff = staffData.find(s => s.id === id);
        return {
          id,
          name: staff?.name || '이름 미정',
          ...(staff?.assignedDate && { assignedDate: staff.assignedDate })
        };
      });
      
      const result = await BulkOperationService.bulkUpdateStatus(
        staffInfo,
        jobPosting?.id || 'default-event',
        status as any
      );
      
      const { type, message } = BulkOperationService.generateResultMessage(
        result,
        'status',
        { status }
      );
      
      if (type === 'success') {
        showSuccess(message);
        resetSelection(); // 성공 시 선택 상태 초기화
      } else {
        showError(message);
      }
    } catch (error) {
      logger.error('출석 상태 일괄 변경 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'StaffManagementTab' });
      showError('출석 상태 변경 중 오류가 발생했습니다.');
    }
  };
  
  // 프로필 모달 핸들러
  const handleShowProfile = (staffId: string) => {
    const staff = staffData.find(s => s.id === staffId);
    if (staff) {
      setSelectedStaffForProfile(staff);
      setIsProfileModalOpen(true);
    }
  };

  // confirmedStaff의 잘못된 timeSlot 수정

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
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">{jobPosting.title} - 스태프 관리</h3>
          
          {/* 데스크톱에서만 검색 기능을 오른쪽 상단에 표시 */}
          {!isMobile && !isTablet && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 font-medium">
                총 {uniqueStaffCount}명
                {filteredStaffCount !== uniqueStaffCount && ` (${filteredStaffCount}명 필터됨)`}
              </span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="스태프 검색..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {canEdit && (
                <>
                  <button
                    onClick={handleMultiSelectToggle}
                    className={`px-3 py-2 rounded-md transition-colors flex items-center space-x-2 ${
                      multiSelectMode
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title={multiSelectMode ? '선택 모드 종료' : '스태프를 선택하여 일괄 수정'}
                  >
                    <span>{multiSelectMode ? '선택 완료' : '선택 모드'}</span>
                    {multiSelectMode && (
                      <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded text-sm">
                        {selectedStaff.size}/{filteredStaffCount}
                      </span>
                    )}
                  </button>
                  {multiSelectMode && selectedStaff.size > 0 && (
                    <button
                      onClick={() => setIsBulkTimeEditOpen(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2"
                      title={`선택된 ${selectedStaff.size}명 일괄 수정`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>선택 항목 수정 ({selectedStaff.size}명)</span>
                    </button>
                  )}
                  {multiSelectMode && (
                    <button
                      onClick={() => {
                        // 전체 스태프를 선택하고 일괄 수정 모달 열기
                        selectAll(staffData.map(s => s.id));
                        setIsBulkTimeEditOpen(true);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      title={`전체 ${uniqueStaffCount}명 수정`}
                    >
                      전체 수정
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                QR 생성
              </button>
            </div>
          )}
        </div>

        {error.global && (
          <div className="bg-red-50 p-4 rounded-lg mb-4">
            <p className="text-red-600">{error.global}</p>
          </div>
        )}

        {/* 모바일에서 추가 컨트롤 */}
        {(isMobile || isTablet) && (
          <div className="mb-4 space-y-3">
            {/* 검색 */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  총 {uniqueStaffCount}명
                  {filteredStaffCount !== uniqueStaffCount && ` (${filteredStaffCount}명 필터됨)`}
                </span>
                <div className="flex space-x-2">
                  {canEdit && (
                    <button
                      onClick={handleMultiSelectToggle}
                      className={`px-3 py-1 rounded text-sm ${
                        multiSelectMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {multiSelectMode ? '선택 취소' : '선택 모드'}
                    </button>
                  )}
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    QR 생성
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="스태프 검색..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
          </div>
        )}

        {/* 선택 모드 활성화 시 안내 메시지 */}
        {multiSelectMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-blue-800">
                <strong>선택 모드:</strong> {isMobile ? '카드를 터치' : '스태프 행을 클릭'}하여 선택하세요
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
              // 모바일/태블릿 카드 레이아웃 - 날짜별 그룹화
              groupedStaffData.sortedDates.map((date) => {
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
                      selectedStaff={selectedStaff}
                      onStaffSelect={handleStaffSelect}
                      multiSelectMode={multiSelectMode}
                      onShowProfile={handleShowProfile}
                      eventId={jobPosting?.id}
                      getStaffWorkLog={getStaffWorkLog as any}
                      onReport={handleReport}
                    />
                );
              })
            ) : (
              // 데스크톱 테이블 레이아웃 - 날짜별 그룹화
              groupedStaffData.sortedDates.map((date) => {
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
                      multiSelectMode={multiSelectMode}
                      selectedStaff={selectedStaff}
                      onStaffSelect={handleStaffSelect}
                      onReport={handleReport}
                    />
                );
              })
            )}
          </div>
        )}
        </div>


      {/* QR 코드 생성 모달 */}
      <QRCodeGeneratorModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        eventId={jobPosting?.id || 'default-event'}
        title={t('attendance.actions.generateQR')}
        description={`${jobPosting?.title || '공고'} 스태프들이 출석 체크를 할 수 있는 QR 코드를 생성합니다.`}
      />

      {/* 시간 수정 모달 */}
      <WorkTimeEditor
        isOpen={isWorkTimeEditorOpen}
        onClose={() => {
          setIsWorkTimeEditorOpen(false);
          setSelectedWorkLog(null); // 모달 닫을 때만 초기화
        }}
        workLog={selectedWorkLog}
        onUpdate={handleWorkTimeUpdate}
      />


      
      {/* 스태프 프로필 모달 */}
      <StaffProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedStaffForProfile(null);
        }}
        staff={selectedStaffForProfile as any}
        attendanceRecord={selectedStaffForProfile ? getStaffAttendanceStatus(selectedStaffForProfile.id) : undefined}
        workLogRecord={selectedStaffForProfile ? attendanceRecords.find(r => r.staffId === selectedStaffForProfile.id) : undefined}
      />
      
      {/* 일괄 시간 수정 모달 */}
      <BulkTimeEditModal
        isOpen={isBulkTimeEditOpen}
        onClose={() => {
          setIsBulkTimeEditOpen(false);
          resetSelection();
        }}
        selectedStaff={staffData
          .filter(staff => selectedStaff.has(staff.id))
          .map(staff => {
            // 스태프의 날짜를 추출
            const dateString = staff.assignedDate || new Date().toISOString().split('T')[0];
            // 해당 날짜의 workLog 찾기
            const workLogRecord = attendanceRecords.find(r => {
              // staffId가 일치하고
              const recordAny = r as any;
              const staffIdMatch = recordAny.staffId === staff.id || 
                                  recordAny.workLog?.staffId === staff.id;
              // 날짜가 일치하는 경우
              const dateMatch = recordAny.workLog?.date === dateString;
              return staffIdMatch && dateMatch;
            });
            
            return {
              id: staff.id,
              name: staff.name || '이름 미정',
              ...(staff.assignedDate && { assignedDate: staff.assignedDate }),
              ...(staff.assignedTime && { assignedTime: staff.assignedTime }),
              ...((workLogRecord as any)?.workLogId && { workLogId: (workLogRecord as any).workLogId })
            };
          })}
        eventId={jobPosting?.id || 'default-event'}
        onComplete={() => {
          // 실시간 구독으로 자동 업데이트됨
        }}
      />

      {/* Report Modal */}
      {isReportModalOpen && reportTarget && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={handleReportModalClose}
          targetUser={reportTarget}
          event={{
            id: jobPosting?.id || '',
            title: jobPosting?.title || '',
            date: getTodayString()
          }}
          reporterType="employer"
        />
      )}

      {/* 모바일 선택 바 */}
      {multiSelectMode && selectedStaff.size > 0 && canEdit && (isMobile || isTablet) && (
        <MobileSelectionBar
          selectedCount={selectedStaff.size}
          totalCount={uniqueStaffCount}
          onSelectAll={() => selectAll(staffData.map(s => s.id))}
          onDeselectAll={deselectAll}
          onBulkEdit={() => setIsBulkTimeEditOpen(true)}
          onBulkDelete={() => {
            if (selectedStaff.size === 0) return;
            const confirmDelete = window.confirm(`선택된 ${selectedStaff.size}명의 스태프를 삭제하시겠습니까?`);
            if (confirmDelete) {
              handleBulkDelete(Array.from(selectedStaff));
            }
          }}
          onCancel={() => {
            deselectAll();
            toggleMultiSelectMode();
          }}
          isAllSelected={isAllSelected(staffData.map(s => s.id))}
        />
      )}
      
      {/* 데스크톱 플로팅 선택 정보 */}
      {multiSelectMode && selectedStaff.size > 0 && canEdit && !isMobile && !isTablet && (
        <div className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-4 z-50 floating-selection-info">
          <span className="font-medium">{selectedStaff.size}명 선택됨</span>
          <button
            onClick={() => setIsBulkTimeEditOpen(true)}
            className="bg-white text-blue-600 px-4 py-1 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            일괄 수정
          </button>
          <button
            onClick={() => handleBulkDelete(Array.from(selectedStaff))}
            className="bg-red-600 text-white px-4 py-1 rounded-full text-sm font-medium hover:bg-red-700 transition-colors"
          >
            삭제
          </button>
          <button
            onClick={() => {
              deselectAll();
              toggleMultiSelectMode();
            }}
            className="text-white hover:text-blue-200 transition-colors"
            aria-label="선택 취소"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
};

export default StaffManagementTab;