import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClock, FaCheckCircle } from 'react-icons/fa';
import { doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';

import { db } from '../firebase';
import { useToast } from '../hooks/useToast';
import { getTodayString } from '../utils/jobPosting/dateUtils';

export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

interface AttendanceStatusPopoverProps {
  workLogId: string;
  currentStatus: AttendanceStatus;
  staffId: string;
  staffName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  eventId?: string;
  onStatusChange?: (newStatus: AttendanceStatus) => void;
  actualStartTime?: any; // 실제 출근 시간
  actualEndTime?: any; // 실제 퇴근 시간
  canEdit?: boolean; // 수정 권한
  scheduledStartTime?: any; // 예정 출근 시간
  applyOptimisticUpdate?: (workLogId: string, newStatus: AttendanceStatus) => void;
}

const AttendanceStatusPopover: React.FC<AttendanceStatusPopoverProps> = ({
  workLogId,
  currentStatus,
  staffId,
  staffName = '',
  size = 'md',
  className = '',
  eventId,
  onStatusChange,
  actualStartTime,
  actualEndTime,
  canEdit = true,
  scheduledStartTime,
  applyOptimisticUpdate
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const statusOptions: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    {
      value: 'not_started',
      label: t('attendance.status.notStarted', '출근 전'),
      icon: <FaClock className="w-5 h-5" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    },
    {
      value: 'checked_in',
      label: t('attendance.status.checkedIn', '출근'),
      icon: <FaCheckCircle className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      value: 'checked_out',
      label: t('attendance.status.checkedOut', '퇴근'),
      icon: <FaCheckCircle className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    }
  ];

  const currentOption = statusOptions.find(option => option.value === currentStatus) || statusOptions[0]!;
  
  // 시간 포맷팅 함수
  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    
    try {
      let date: Date;
      
      // Timestamp 객체인 경우
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      }
      // Date 객체인 경우
      else if (timestamp instanceof Date) {
        date = timestamp;
      }
      // 숫자인 경우 (milliseconds)
      else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      }
      // 문자열인 경우
      else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      }
      else {
        return '';
      }
      
      // 유효한 날짜인지 확인
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // HH:MM 형식으로 반환
      return date.toLocaleTimeString('ko-KR', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('시간 포맷팅 오류:', error);
      return '';
    }
  };

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
    console.log('🔄 출석 상태 변경 시도:', {
      workLogId,
      currentStatus,
      newStatus,
      staffId,
      staffName,
      eventId,
      eventIdType: typeof eventId,
      eventIdValue: eventId || '없음',
      isVirtual: workLogId.startsWith('virtual_'),
      scheduledStartTime
    });
    
    if (newStatus === currentStatus || isUpdating) return;
    
    // 출근 상태로 변경 시 출근 시간이 미정인지 확인
    if (newStatus === 'checked_in' && (!scheduledStartTime || scheduledStartTime === '미정')) {
      showError('출근 시간이 설정되지 않았습니다. 먼저 출근 시간을 설정해주세요.');
      return;
    }

    setIsUpdating(true);
    setIsOpen(false);

    // Optimistic update 즉시 적용
    const targetWorkLogId = workLogId.startsWith('virtual_') ? 
      `${eventId || 'default-event'}_${workLogId.split('_')[1]}_${workLogId.split('_')[2]}` : 
      workLogId;
    
    if (applyOptimisticUpdate) {
      console.log('🚀 AttendanceStatusPopover - Optimistic update 호출:', {
        workLogId: targetWorkLogId,
        newStatus
      });
      applyOptimisticUpdate(targetWorkLogId, newStatus);
    }

    try {
      const now = Timestamp.now();
      
      // virtual_ 프리픽스가 있으면 새로운 workLog 생성
      if (workLogId.startsWith('virtual_')) {
        // 날짜 형식 파싱을 더 안전하게 처리
        const parts = workLogId.split('_');
        let actualStaffId = '';
        let date = '';
        
        // virtual_스태프ID_날짜 형식 파싱
        if (parts.length >= 3) {
          actualStaffId = parts[1] || '';
          // 날짜가 언더스코어로 분리된 경우 (예: virtual_staffId_2025_01_28)
          if (parts.length > 3 && parts[2] && parts[2].length === 4 && /^\d{4}$/.test(parts[2])) {
            date = `${parts[2]}-${parts[3] || ''}-${parts[4] || ''}`;
          } else {
            date = parts[2] || '';
          }
        } else if (parts.length === 2) {
          // virtual_스태프ID 형식인 경우 (날짜가 없는 경우)
          actualStaffId = parts[1] || '';
          date = getTodayString();
        }
        
        // 날짜 형식 검증 및 복구
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          console.warn('⚠️ AttendanceStatusPopover - 잘못된 날짜 형식, 오늘 날짜로 대체:', {
            originalDate: date,
            workLogId
          });
          date = getTodayString();
        }
        
        console.log('🔍 AttendanceStatusPopover - virtual workLogId 파싱 결과:', {
          originalWorkLogId: workLogId,
          parts,
          actualStaffId,
          date,
          dateValid: /^\d{4}-\d{2}-\d{2}$/.test(date)
        });
        
        // eventId가 없으면 에러 로그 출력
        if (!eventId) {
          console.warn('⚠️ AttendanceStatusPopover - eventId가 없습니다. 기본값 사용');
        }
        
        const realWorkLogId = `${eventId || 'default-event'}_${actualStaffId}_${date}`;
        
        console.log('🔄 AttendanceStatusPopover - 새 workLog 생성:', {
          virtualWorkLogId: workLogId,
          realWorkLogId,
          actualStaffId,
          date,
          eventId,
          newStatus
        });
        
        const newWorkLogData: any = {
          eventId: eventId || 'default-event',
          dealerId: actualStaffId,
          staffId: actualStaffId, // staffId 필드도 추가
          dealerName: staffName || 'Unknown',
          date: date,
          status: newStatus,
          scheduledStartTime: null,
          scheduledEndTime: null,
          actualStartTime: null,
          actualEndTime: null,
          createdAt: now,
          updatedAt: now
        };
        
        // 출석 상태 변경은 실제 시간에 영향을 주지 않음
        // actualStartTime과 actualEndTime은 시간 수정 기능에서만 변경
        
        const workLogRef = doc(db, 'workLogs', realWorkLogId);
        await setDoc(workLogRef, newWorkLogData);
        
        console.log('✅ 새 workLog 생성 완료:', {
          realWorkLogId,
          parsedDate: date,
          originalWorkLogId: workLogId,
          data: newWorkLogData
        });
      } else {
        // 기존 workLog 업데이트 또는 생성
        const updateData: any = {
          status: newStatus,
          updatedAt: now
        };

        // 출석 상태 변경은 실제 시간에 영향을 주지 않음
        // actualStartTime과 actualEndTime은 시간 수정 기능에서만 변경

        const workLogRef = doc(db, 'workLogs', workLogId);
        
        try {
          // 먼저 문서 업데이트 시도
          await updateDoc(workLogRef, updateData);
        } catch (updateError: any) {
          // 문서가 존재하지 않는 경우 생성
          if (updateError.code === 'not-found' || updateError.message?.includes('No document to update')) {
            console.log('📝 AttendanceStatusPopover - workLog 문서가 없어서 새로 생성:', workLogId);
            
            // workLogId에서 정보 추출 (eventId_staffId_date 형식)
            const parts = workLogId.split('_');
            let extractedEventId = eventId || 'default-event';
            let extractedStaffId = staffId;
            let extractedDate = getTodayString();
            
            if (parts.length >= 3) {
              // 첫 번째 부분은 eventId, 마지막 부분은 날짜, 중간은 staffId
              extractedEventId = parts[0] || 'default-event';
              extractedDate = parts[parts.length - 1] || getTodayString();
              // 중간 부분들을 모두 합쳐서 staffId로 처리 (언더스코어가 포함된 staffId 처리)
              extractedStaffId = parts.slice(1, -1).join('_');
            }
            
            const newWorkLogData: any = {
              eventId: extractedEventId,
              dealerId: extractedStaffId,
              staffId: extractedStaffId,
              dealerName: staffName || 'Unknown',
              date: extractedDate,
              status: newStatus,
              scheduledStartTime: null,
              scheduledEndTime: null,
              actualStartTime: null,
              actualEndTime: null,
              createdAt: now,
              updatedAt: now
            };
            
            await setDoc(workLogRef, newWorkLogData);
            console.log('✅ workLog 생성 완료:', { workLogId, data: newWorkLogData });
          } else {
            // 다른 종류의 오류는 다시 throw
            throw updateError;
          }
        }
      }

      // Firebase 데이터 전파를 위한 짧은 지연
      setTimeout(() => {
        if (onStatusChange) {
          onStatusChange(newStatus);
        }
      }, 100);

      // 성공 메시지 표시
      const statusLabel = statusOptions.find(opt => opt.value === newStatus)?.label || newStatus;
      showSuccess(`${staffName}의 출석 상태가 "${statusLabel}"로 변경되었습니다.`);
      
    } catch (error) {
      console.error('❌ 출석 상태 업데이트 오류:', {
        workLogId,
        currentStatus,
        newStatus,
        staffId,
        staffName,
        error
      });
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
          {currentStatus === 'checked_out' && actualEndTime && (
            <span className="text-xs opacity-75">퇴근: {formatTime(actualEndTime)}</span>
          )}
        </div>
      </button>

      {/* 팝오버 */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="fixed z-40 bg-white rounded-xl shadow-2xl border border-gray-300 p-2"
          style={{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
            minWidth: '200px'
          }}
        >
          {/* 화살표 */}
          <div 
            className="absolute w-3 h-3 bg-white border-t border-l border-gray-200 transform rotate-45"
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
                    : 'hover:bg-gray-50 text-gray-700'
                  }
                `}
              >
                <div className={option.value === currentStatus ? option.color : 'text-gray-400'}>
                  {option.icon}
                </div>
                <span className="flex-grow text-left">{option.label}</span>
                {option.value === currentStatus && (
                  <div className={`w-2 h-2 rounded-full ${
                    option.value === 'checked_in' ? 'bg-green-500' :
                    option.value === 'checked_out' ? 'bg-blue-500' :
                    'bg-gray-500'
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      )}
    </>
  );
};

export default AttendanceStatusPopover;