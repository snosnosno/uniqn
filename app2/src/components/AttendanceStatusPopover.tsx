import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClock, FaCheckCircle } from './Icons/ReactIconsReplacement';
import { doc, Timestamp, runTransaction } from 'firebase/firestore';

import { db } from '../firebase';
import { useToast } from '../hooks/useToast';
import { getTodayString } from '../utils/jobPosting/dateUtils';
import { calculateMinutes } from '../utils/timeUtils';
import { formatTime } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { createWorkLogId } from '../utils/workLogSimplified';
import { useUnifiedData } from '../hooks/useUnifiedData';
import type { WorkLog } from '../types/unifiedData';

export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

interface AttendanceStatusPopoverProps {
  workLogId: string;
  currentStatus: AttendanceStatus | 'scheduled';
  staffId: string;
  staffName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  eventId?: string;
  onStatusChange?: (newStatus: AttendanceStatus) => void;
  actualStartTime?: Timestamp | Date | string | null; // 실제 출근 시간
  actualEndTime?: Timestamp | Date | string | null; // 실제 퇴근 시간
  canEdit?: boolean; // 수정 권한
  scheduledStartTime?: Timestamp | Date | string | null; // 예정 출근 시간
  scheduledEndTime?: Timestamp | Date | string | null; // 예정 퇴근 시간
  applyOptimisticUpdate?: (workLogId: string, newStatus: AttendanceStatus) => void;
  targetDate?: string; // 대상 날짜 (YYYY-MM-DD 형식)
}

const AttendanceStatusPopover: React.FC<AttendanceStatusPopoverProps> = ({
  workLogId,
  currentStatus,
  staffId,
  staffName = '',
  targetDate,
  size = 'md',
  className = '',
  eventId,
  onStatusChange,
  actualStartTime,
  actualEndTime,
  canEdit = true,
  scheduledStartTime,
  scheduledEndTime,
  applyOptimisticUpdate
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { updateWorkLogOptimistic } = useUnifiedData();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [localStatus, setLocalStatus] = useState<AttendanceStatus | 'scheduled'>(currentStatus);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // currentStatus가 변경되면 localStatus 업데이트
  useEffect(() => {
    setLocalStatus(currentStatus);
  }, [currentStatus]);

  const statusOptions: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    {
      value: 'not_started',
      label: t('attendance.status.notStarted', '출근 전'),
      icon: <FaClock className="w-5 h-5" />,
      color: 'text-attendance-notStarted-text',
      bgColor: 'bg-attendance-notStarted-bg'
    },
    {
      value: 'checked_in',
      label: t('attendance.status.checkedIn', '출근'),
      icon: <FaCheckCircle className="w-5 h-5" />,
      color: 'text-attendance-checkedIn-text',
      bgColor: 'bg-attendance-checkedIn-bg'
    },
    {
      value: 'checked_out',
      label: t('attendance.status.checkedOut', '퇴근'),
      icon: <FaCheckCircle className="w-5 h-5" />,
      color: 'text-attendance-checkedOut-text',
      bgColor: 'bg-attendance-checkedOut-bg'
    }
  ];

  // 'scheduled' 상태는 'not_started'로 매핑하여 처리 (기존 데이터 호환성)
  const normalizedStatus = localStatus === 'scheduled' ? 'not_started' : localStatus;
  const currentOption = statusOptions.find(option => option.value === normalizedStatus) || statusOptions[0]!;

  // 팝오버 위치 계산
  useEffect(() => {
    if (isOpen && buttonRef.current && popoverRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = buttonRect.bottom + 8;
      let left = buttonRect.left + (buttonRect.width / 2) - (popoverRect.width / 2);
      
      // 화면 하단 체크
      if (top + popoverRect.height > viewportHeight - 20) {
        top = buttonRect.top - popoverRect.height - 8;
      }
      
      // 화면 좌우 체크
      if (left < 10) {
        left = 10;
      } else if (left + popoverRect.width > viewportWidth - 10) {
        left = viewportWidth - popoverRect.width - 10;
      }
      
      setPopoverPosition({ top, left });
    }
  }, [isOpen]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && 
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return undefined;
  }, [isOpen]);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2.5 text-base';
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const handleStatusChange = async (newStatus: AttendanceStatus) => {
    
    if (newStatus === localStatus || isUpdating) return;
    
    // 즉시 UI 업데이트 (Optimistic Update)
    setLocalStatus(newStatus);
    
    // 출근 상태로 변경 시 출근 시간이 미정인지 확인
    if (newStatus === 'checked_in' && (!scheduledStartTime || scheduledStartTime === '미정')) {
      showError('출근 시간이 설정되지 않았습니다. 먼저 출근 시간을 설정해주세요.');
      // 실패 시 원래 상태로 복원
      setLocalStatus(currentStatus);
      return;
    }

    setIsUpdating(true);
    setIsOpen(false);

    // 🚀 1단계: Optimistic Update 즉시 적용 - createWorkLogId 사용
    let targetWorkLogId = workLogId;
    if (workLogId.startsWith('virtual_') && eventId) {
      const parts = workLogId.split('_');
      const actualStaffId = parts[1] || staffId;
      const date = parts.length > 2 ? parts.slice(2).join('-') : getTodayString();
      targetWorkLogId = createWorkLogId(eventId, actualStaffId, date);
    }
    
    // WorkLog 객체 생성 for Optimistic Update
    const now = Timestamp.now();
    const workLogDate = targetDate || getTodayString();
    
    
    const optimisticWorkLog: Partial<WorkLog> = {
      id: targetWorkLogId,
      eventId: eventId || 'default-event',
      staffId: staffId,
      staffName: staffName,
      date: workLogDate, // 디버깅을 위해 변수로 분리
      role: 'staff', // 기본값
      status: newStatus as any,
      updatedAt: now,
      createdAt: now // 기본값
    };
    
    // 조건부로 타임스탬프 필드 추가 (exactOptionalPropertyTypes 지원)
    if (scheduledStartTime instanceof Timestamp) {
      optimisticWorkLog.scheduledStartTime = scheduledStartTime;
    }
    if (scheduledEndTime instanceof Timestamp) {
      optimisticWorkLog.scheduledEndTime = scheduledEndTime;
    }
    if (newStatus === 'checked_in') {
      optimisticWorkLog.actualStartTime = now;
    } else if (actualStartTime instanceof Timestamp) {
      optimisticWorkLog.actualStartTime = actualStartTime;
    }
    if (newStatus === 'checked_out') {
      optimisticWorkLog.actualEndTime = now;
    } else if (actualEndTime instanceof Timestamp) {
      optimisticWorkLog.actualEndTime = actualEndTime;
    }
    
    // UnifiedDataContext를 통한 즉시 UI 업데이트
    updateWorkLogOptimistic(optimisticWorkLog as WorkLog);
    
    // 레거시 콜백 호출 (호환성 유지)
    if (applyOptimisticUpdate) {
      applyOptimisticUpdate(targetWorkLogId, newStatus);
    }
    
    // 즉시 콜백 실행 (기존 100ms 지연 제거)
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
    

    try {
      const now = Timestamp.now();
      
      // 🔄 통합 WorkLog 업데이트 로직 - createWorkLogId 사용으로 단순화
      let realWorkLogId = workLogId;
      
      // virtual_ 프리픽스가 있으면 실제 workLog ID로 변환
      if (workLogId.startsWith('virtual_') && eventId) {
        const parts = workLogId.split('_');
        const actualStaffId = parts[1] || staffId;
        let date = '';
        
        // 날짜 파싱 (여러 형식 지원)
        if (parts.length >= 3) {
          if (parts.length > 3 && parts[2] && parts[2].length === 4 && /^\d{4}$/.test(parts[2])) {
            // virtual_staffId_2025_01_28 형식
            date = `${parts[2]}-${parts[3] || ''}-${parts[4] || ''}`;
          } else {
            // virtual_staffId_2025-01-28 형식
            date = parts.slice(2).join('-');
          }
        } else {
          date = getTodayString();
        }
        
        // 날짜 형식 검증 및 복구
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          date = getTodayString();
        }
        
        // ✅ createWorkLogId 함수 사용으로 통일된 ID 생성
        realWorkLogId = createWorkLogId(eventId, actualStaffId, date);
      }
      
      // 🚀 통합 workLog 업데이트 - 트랜잭션 사용
      const workLogRef = doc(db, 'workLogs', realWorkLogId);
      
      // 트랜잭션을 사용하여 원자적 업데이트 보장
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(workLogRef);
        
        if (docSnap.exists()) {
          // ✅ 기존 workLog 업데이트 - actual 시간과 상태만 업데이트 (scheduled 시간 유지)
          // UI 상태를 Firebase에 그대로 저장 (변환하지 않음)
          const updateData: Record<string, any> = {
            status: newStatus,
            updatedAt: now
          };

          // 출근 상태로 변경 시 actualStartTime 설정
          if (newStatus === 'checked_in') {
            updateData.actualStartTime = now;
          }
          // 퇴근 상태로 변경 시 actualEndTime 설정
          if (newStatus === 'checked_out') {
            updateData.actualEndTime = now;
            // actualStartTime이 없으면 현재 시간으로 설정
            const existingData = docSnap.data();
            if (!existingData?.actualStartTime) {
              updateData.actualStartTime = now;
            }
          }
          // 출근 전으로 변경 시 actual 시간들 초기화
          if (newStatus === 'not_started') {
            updateData.actualStartTime = null;
            updateData.actualEndTime = null;
          }

          transaction.update(workLogRef, updateData);
          
        } else {
          // 🚀 WorkLog가 존재하지 않으면 새로 생성 (fallback 로직)
          
          const newWorkLogData: Record<string, any> = {
            id: realWorkLogId,
            eventId: eventId || 'default-event',
            staffId: staffId,
            staffName: staffName,
            date: workLogDate,
            role: 'staff',
            status: newStatus,
            createdAt: now,
            updatedAt: now
          };

          // 출근 상태로 생성 시 actualStartTime 설정
          if (newStatus === 'checked_in') {
            newWorkLogData.actualStartTime = now;
          }
          // 퇴근 상태로 생성 시 actualEndTime도 설정
          if (newStatus === 'checked_out') {
            newWorkLogData.actualStartTime = now;
            newWorkLogData.actualEndTime = now;
          }
          
          // 스케줄된 시간이 있으면 추가
          if (scheduledStartTime instanceof Timestamp) {
            newWorkLogData.scheduledStartTime = scheduledStartTime;
          }
          if (scheduledEndTime instanceof Timestamp) {
            newWorkLogData.scheduledEndTime = scheduledEndTime;
          }

          transaction.set(workLogRef, newWorkLogData);
          
          // 생성 완료 로깅
        }
      });

      // 트랜잭션 완료 후 로깅

      // 3. 성공 메시지 표시
      const statusLabel = statusOptions.find(opt => opt.value === newStatus)?.label || newStatus;
      showSuccess(`${staffName}의 출석 상태가 "${statusLabel}"로 변경되었습니다.`);
      
    } catch (error) {
      logger.error('AttendanceStatusPopover 상태 변경 오류', error instanceof Error ? error : new Error(String(error)));
      
      // 에러 발생 시 localStatus를 원래 상태로 복원
      setLocalStatus(currentStatus);
      
      // 🚀 3단계: 에러 발생 시 Optimistic Update 롤백
      const rollbackWorkLog: Partial<WorkLog> = {
        id: targetWorkLogId,
        eventId: eventId || 'default-event',
        staffId: staffId,
        staffName: staffName,
        date: getTodayString(),
        role: 'staff',
        status: currentStatus as any, // 원래 상태로 복원
        updatedAt: Timestamp.now(),
        createdAt: now
      };
      
      // 조건부로 타임스탬프 필드 추가 (rollback)
      if (scheduledStartTime instanceof Timestamp) {
        rollbackWorkLog.scheduledStartTime = scheduledStartTime;
      }
      if (scheduledEndTime instanceof Timestamp) {
        rollbackWorkLog.scheduledEndTime = scheduledEndTime;
      }
      if (actualStartTime instanceof Timestamp) {
        rollbackWorkLog.actualStartTime = actualStartTime;
      }
      if (actualEndTime instanceof Timestamp) {
        rollbackWorkLog.actualEndTime = actualEndTime;
      }
      
      // UnifiedDataContext를 통한 롤백
      updateWorkLogOptimistic(rollbackWorkLog as WorkLog);
      
      
      // 레거시 콜백 롤백 (호환성 유지)
      if (applyOptimisticUpdate) {
        applyOptimisticUpdate(targetWorkLogId, normalizedStatus);
      }
      
      // 에러 콜백 실행 (원래 상태로 복원)
      if (onStatusChange) {
        onStatusChange(normalizedStatus);
      }
      
      showError('출석 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (canEdit) {
            setIsOpen(!isOpen);
          }
        }}
        disabled={isUpdating || !canEdit}
        className={`
          inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200
          ${currentOption.bgColor} ${currentOption.color}
          ${getSizeClasses()}
          ${isUpdating || !canEdit ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 cursor-pointer'}
          ${className}
        `}
        title={!canEdit ? '수정 권한이 없습니다' : ''}
      >
        {currentOption.icon}
        <div className="flex flex-col items-start">
          <span>{currentOption.label}</span>
          {currentStatus === 'checked_in' && actualStartTime && (
            <span className="text-xs opacity-75">출근: {formatTime(actualStartTime)}</span>
          )}
          {currentStatus === 'checked_out' && (() => {
            // scheduled 시간으로 근무시간 계산 (급여 정산용)
            const totalMinutes = calculateMinutes(scheduledStartTime, scheduledEndTime);
            
            if (totalMinutes > 0) {
              const hours = Math.floor(totalMinutes / 60);
              const minutes = totalMinutes % 60;
              const timeString = `${hours}:${minutes.toString().padStart(2, '0')}`;
              
              return (
                <div className="text-xs opacity-75">
                  {actualEndTime && <div>퇴근: {formatTime(actualEndTime)}</div>}
                  <div className="font-semibold text-blue-600">근무: {timeString}</div>
                </div>
              );
            }
            return actualEndTime ? (
              <div className="text-xs opacity-75">
                {actualEndTime && <div>퇴근: {formatTime(actualEndTime)}</div>}
              </div>
            ) : null;
          })()}
        </div>
      </button>

      {/* 팝오버 */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="fixed z-40 bg-background-primary rounded-xl shadow-2xl border border-border-DEFAULT p-2"
          style={{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
            minWidth: '200px'
          }}
        >
          {/* 화살표 */}
          <div 
            className="absolute w-3 h-3 bg-background-primary border-t border-l border-border-light transform rotate-45"
            style={{
              top: popoverPosition.top > buttonRef.current!.getBoundingClientRect().bottom ? '-6px' : 'auto',
              bottom: popoverPosition.top < buttonRef.current!.getBoundingClientRect().bottom ? '-6px' : 'auto',
              left: '50%',
              marginLeft: '-6px'
            }}
          />
          
          {/* 상태 옵션들 */}
          <div className="relative">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150
                  ${option.value === currentStatus 
                    ? `${option.bgColor} ${option.color} font-medium` 
                    : 'hover:bg-background-hover text-text-secondary'
                  }
                `}
              >
                <div className={option.value === currentStatus ? option.color : 'text-text-disabled'}>
                  {option.icon}
                </div>
                <span className="flex-grow text-left">{option.label}</span>
                {option.value === currentStatus && (
                  <div className={`w-2 h-2 rounded-full ${
                    option.value === 'checked_in' ? 'bg-success' :
                    option.value === 'checked_out' ? 'bg-info' :
                    'bg-text-tertiary'
                  }`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 로딩 오버레이 */}
      {isUpdating && (
        <div className="fixed inset-0 bg-black bg-opacity-10 z-30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </div>
      )}
    </>
  );
};

export default AttendanceStatusPopover;