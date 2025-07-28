import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClock, FaCheckCircle, FaTimesCircle, FaChevronDown } from 'react-icons/fa';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

import { db } from '../firebase';
import { useToast } from '../hooks/useToast';

export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out' | 'absent';

interface AttendanceStatusDropdownProps {
  workLogId: string;
  currentStatus: AttendanceStatus;
  staffId: string;
  staffName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onStatusChange?: (newStatus: AttendanceStatus) => void;
}

const AttendanceStatusDropdown: React.FC<AttendanceStatusDropdownProps> = ({
  workLogId,
  currentStatus,
  staffId,
  staffName = '',
  size = 'md',
  className = '',
  onStatusChange
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const statusOptions: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    {
      value: 'not_started',
      label: t('attendance.status.notStarted', '출근 전'),
      icon: <FaClock className="text-gray-500" />,
      color: 'text-gray-700',
      bgColor: 'bg-gray-50 hover:bg-gray-100'
    },
    {
      value: 'checked_in',
      label: t('attendance.status.checkedIn', '출근'),
      icon: <FaCheckCircle className="text-green-500" />,
      color: 'text-green-700',
      bgColor: 'bg-green-50 hover:bg-green-100'
    },
    {
      value: 'checked_out',
      label: t('attendance.status.checkedOut', '퇴근'),
      icon: <FaCheckCircle className="text-blue-500" />,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 hover:bg-blue-100'
    },
    {
      value: 'absent',
      label: t('attendance.status.absent', '결근'),
      icon: <FaTimesCircle className="text-red-500" />,
      color: 'text-red-700',
      bgColor: 'bg-red-50 hover:bg-red-100'
    }
  ];

  const currentOption = statusOptions.find(option => option.value === currentStatus) || statusOptions[0];

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-xs';
      case 'lg':
        return 'px-4 py-3 text-base';
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const handleStatusChange = async (newStatus: AttendanceStatus) => {
    if (newStatus === currentStatus || isUpdating) return;

    setIsUpdating(true);
    setIsOpen(false);

    try {
      const now = Timestamp.now();
      const updateData: any = {
        status: newStatus,
        updatedAt: now
      };

      // 상태에 따른 실제 출퇴근 시간 설정
      if (newStatus === 'checked_in') {
        // 출근 상태로 변경시 actualStartTime 설정
        updateData.actualStartTime = now;
      } else if (newStatus === 'checked_out') {
        // 퇴근 상태로 변경시 actualEndTime 설정 (actualStartTime이 없으면 함께 설정)
        updateData.actualEndTime = now;
        // 출근 시간이 없는 경우 함께 설정
        if (currentStatus === 'not_started') {
          updateData.actualStartTime = now;
        }
      } else if (newStatus === 'not_started') {
        // 출근 전 상태로 변경시 실제 시간들을 null로 설정
        updateData.actualStartTime = null;
        updateData.actualEndTime = null;
      } else if (newStatus === 'absent') {
        // 결근 상태로 변경시 실제 시간들을 null로 설정
        updateData.actualStartTime = null;
        updateData.actualEndTime = null;
      }

      // WorkLog 문서 업데이트
      const workLogRef = doc(db, 'workLogs', workLogId);
      await updateDoc(workLogRef, updateData);

      // 콜백 호출
      if (onStatusChange) {
        onStatusChange(newStatus);
      }

      showSuccess(`${staffName}의 출석 상태가 "${currentOption.label}"로 변경되었습니다.`);
      
    } catch (error) {
      console.error('출석 상태 업데이트 오류:', error);
      showError('출석 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={`
          flex items-center gap-2 w-full rounded-lg border transition-all duration-200
          ${currentOption.bgColor}
          ${getSizeClasses()}
          ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${currentOption.color}
          ${
            currentStatus === 'checked_in' ? 'border-green-300' :
            currentStatus === 'checked_out' ? 'border-blue-300' :
            currentStatus === 'absent' ? 'border-red-300' :
            'border-gray-300'
          }
        `}
      >
        {currentOption.icon}
        <span className="font-medium">{currentOption.label}</span>
        <FaChevronDown className={`ml-auto text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* 오버레이 */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* 드롭다운 메뉴 - 항상 위로 열림 */}
          <div 
            className="absolute bottom-full left-0 mb-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden"
            style={{
              maxHeight: '240px',
              overflowY: 'auto'
            }}
          >
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150
                  ${option.value === currentStatus 
                    ? `${option.bgColor} border-l-4 ${
                        option.value === 'checked_in' ? 'border-green-500' :
                        option.value === 'checked_out' ? 'border-blue-500' :
                        option.value === 'absent' ? 'border-red-500' :
                        'border-gray-500'
                      }` 
                    : 'hover:bg-gray-50'
                  }
                  ${option.color}
                `}
              >
                <div className="flex-shrink-0">{option.icon}</div>
                <div className="flex-grow">
                  <span className="font-medium block">{option.label}</span>
                  {option.value === currentStatus && (
                    <span className="text-xs opacity-75">현재 상태</span>
                  )}
                </div>
                {option.value === currentStatus && (
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 rounded-full ${
                      option.value === 'checked_in' ? 'bg-green-500' :
                      option.value === 'checked_out' ? 'bg-blue-500' :
                      option.value === 'absent' ? 'bg-red-500' :
                      'bg-gray-500'
                    } animate-pulse"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default AttendanceStatusDropdown;