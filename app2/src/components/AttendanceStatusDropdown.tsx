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

  const statusOptions: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
    {
      value: 'not_started',
      label: t('attendance.status.notStarted', '출근 전'),
      icon: <FaClock className="text-gray-500" />,
      color: 'text-gray-700'
    },
    {
      value: 'checked_in',
      label: t('attendance.status.checkedIn', '출근'),
      icon: <FaCheckCircle className="text-green-500" />,
      color: 'text-green-700'
    },
    {
      value: 'checked_out',
      label: t('attendance.status.checkedOut', '퇴근'),
      icon: <FaCheckCircle className="text-blue-500" />,
      color: 'text-blue-700'
    },
    {
      value: 'absent',
      label: t('attendance.status.absent', '결근'),
      icon: <FaTimesCircle className="text-red-500" />,
      color: 'text-red-700'
    }
  ];

  const currentOption = statusOptions.find(option => option.value === currentStatus) || statusOptions[0];

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
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
          flex items-center gap-2 w-full rounded-lg border border-gray-300 
          bg-white hover:bg-gray-50 transition-colors
          ${getSizeClasses()}
          ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${currentOption.color}
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
          
          {/* 드롭다운 메뉴 */}
          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-20">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors
                  ${option.value === currentStatus ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
                  ${option.color}
                  first:rounded-t-lg last:rounded-b-lg
                `}
              >
                {option.icon}
                <span className="font-medium">{option.label}</span>
                {option.value === currentStatus && (
                  <span className="ml-auto text-blue-500 text-xs font-medium">현재</span>
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