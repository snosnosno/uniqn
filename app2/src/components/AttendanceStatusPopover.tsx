import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
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
}

const AttendanceStatusPopover: React.FC<AttendanceStatusPopoverProps> = ({
  workLogId,
  currentStatus,
  staffId,
  staffName = '',
  size = 'md',
  className = '',
  eventId,
  onStatusChange
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

  const currentOption = statusOptions.find(option => option.value === currentStatus) || statusOptions[0];

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
  }, [isOpen]);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2.5 text-base';
      default:
        return 'px-3 py-1.5 text-sm';
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
      isVirtual: workLogId.startsWith('virtual_')
    });
    
    if (newStatus === currentStatus || isUpdating) return;

    setIsUpdating(true);
    setIsOpen(false);

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
          actualStaffId = parts[1];
          // 날짜가 언더스코어로 분리된 경우 (예: virtual_staffId_2025_01_28)
          if (parts.length > 3 && parts[2].length === 4 && /^\d{4}$/.test(parts[2])) {
            date = `${parts[2]}-${parts[3]}-${parts[4]}`;
          } else {
            date = parts[2];
          }
        } else if (parts.length === 2) {
          // virtual_스태프ID 형식인 경우 (날짜가 없는 경우)
          actualStaffId = parts[1];
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
        
        const newWorkLogData: any = {
          eventId: eventId || 'default-event',
          dealerId: actualStaffId,
          dealerName: staffName || 'Unknown',
          date: date,
          status: newStatus,
          scheduledStartTime: null,
          scheduledEndTime: null,
          createdAt: now,
          updatedAt: now
        };
        
        // 상태에 따른 실제 출퇴근 시간 설정
        if (newStatus === 'checked_in') {
          newWorkLogData.actualStartTime = now;
          newWorkLogData.actualEndTime = null;
        } else if (newStatus === 'checked_out') {
          newWorkLogData.actualStartTime = now;
          newWorkLogData.actualEndTime = now;
        } else {
          newWorkLogData.actualStartTime = null;
          newWorkLogData.actualEndTime = null;
        }
        
        const workLogRef = doc(db, 'workLogs', realWorkLogId);
        await setDoc(workLogRef, newWorkLogData);
        
        console.log('✅ 새 workLog 생성 완료:', {
          realWorkLogId,
          parsedDate: date,
          originalWorkLogId: workLogId,
          data: newWorkLogData
        });
      } else {
        // 기존 workLog 업데이트
        const updateData: any = {
          status: newStatus,
          updatedAt: now
        };

        // 상태에 따른 실제 출퇴근 시간 설정
        if (newStatus === 'checked_in') {
          updateData.actualStartTime = now;
        } else if (newStatus === 'checked_out') {
          updateData.actualEndTime = now;
          if (currentStatus === 'not_started') {
            updateData.actualStartTime = now;
          }
        } else if (newStatus === 'not_started') {
          updateData.actualStartTime = null;
          updateData.actualEndTime = null;
        }

        const workLogRef = doc(db, 'workLogs', workLogId);
        await updateDoc(workLogRef, updateData);
      }

      if (onStatusChange) {
        onStatusChange(newStatus);
      }

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
          setIsOpen(!isOpen);
        }}
        disabled={isUpdating}
        className={`
          inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200
          ${currentOption.bgColor} ${currentOption.color}
          ${getSizeClasses()}
          ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 cursor-pointer'}
          ${className}
        `}
      >
        {currentOption.icon}
        <span>{currentOption.label}</span>
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
            {statusOptions.map((option, index) => (
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