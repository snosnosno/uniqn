
import { useTranslation } from 'react-i18next';
import { FaClock, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';

import { AttendanceException, EXCEPTION_CONFIGS } from '../types/attendance';

export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out' | 'absent';

interface AttendanceStatusCardProps {
  status: AttendanceStatus;
  checkInTime?: string | undefined;
  checkOutTime?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  exception?: AttendanceException;
}

const AttendanceStatusCard: React.FC<AttendanceStatusCardProps> = ({
  status,
  checkInTime,
  checkOutTime,
  size = 'md',
  className = '',
  exception
}) => {
  const { t } = useTranslation();

  const getStatusConfig = () => {
    // 예외 상황이 있으면 예외 상황 우선 표시
    if (exception) {
      const exceptionConfig = EXCEPTION_CONFIGS[exception.type];
      return {
        icon: <span className="text-base">{exceptionConfig.icon}</span>,
        text: exception.description,
        bgColor: exceptionConfig.bgColor,
        textColor: exceptionConfig.textColor,
        borderColor: exceptionConfig.borderColor
      };
    }

    // 기본 출석 상태별 설정
    switch (status) {
      case 'not_started':
        return {
          icon: <FaClock className="text-gray-500" />,
          text: t('attendance.status.notStarted', '출근 전'),
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-300'
        };
      case 'checked_in':
        return {
          icon: <FaCheckCircle className="text-green-500" />,
          text: t('attendance.status.checkedIn', '출근'),
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          borderColor: 'border-green-300'
        };
      case 'checked_out':
        return {
          icon: <FaCheckCircle className="text-blue-500" />,
          text: t('attendance.status.checkedOut', '퇴근'),
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-300'
        };
      case 'absent':
        return {
          icon: <FaTimesCircle className="text-red-500" />,
          text: t('attendance.status.absent', '결근'),
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          borderColor: 'border-red-300'
        };
      default:
        return {
          icon: <FaExclamationTriangle className="text-yellow-500" />,
          text: t('attendance.status.unknown', '알 수 없음'),
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-700',
          borderColor: 'border-yellow-300'
        };
    }
  };

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

  const config = getStatusConfig();

  return (
    <div className={`
      flex items-center gap-2 rounded-lg border ${config.bgColor} ${config.borderColor} ${config.textColor} ${getSizeClasses()} ${className}
    `}>
      {config.icon}
      <div className="flex flex-col">
        <span className="font-medium">{config.text}</span>
        {size !== 'sm' && (checkInTime || checkOutTime) ? <div className="text-xs opacity-75">
            {checkInTime ? <span>{t('attendance.checkIn', '출근')}: {checkInTime}</span> : null}
            {checkInTime && checkOutTime ? <span className="mx-1">|</span> : null}
            {checkOutTime ? <span>{t('attendance.checkOut', '퇴근')}: {checkOutTime}</span> : null}
          </div> : null}
        {/* 예외 상황이 있으면 추가 정보 표시 */}
        {exception && exception.managerNote && size !== 'sm' ? <div className="text-xs opacity-75 mt-1">
            <span className="font-medium">{t('exceptions.note', '메모')}: </span>
            <span>{exception.managerNote}</span>
          </div> : null}
      </div>
    </div>
  );
};

export default AttendanceStatusCard;