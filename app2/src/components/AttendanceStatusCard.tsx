
import { useTranslation } from 'react-i18next';
import { ClockIcon, CheckCircleIcon, ExclamationTriangleIcon } from './Icons';

export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

interface AttendanceStatusCardProps {
  status: AttendanceStatus;
  checkInTime?: string | undefined;
  checkOutTime?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AttendanceStatusCard: React.FC<AttendanceStatusCardProps> = ({
  status,
  checkInTime,
  checkOutTime,
  size = 'md',
  className = ''
}) => {
  const { t } = useTranslation();

  const getStatusConfig = () => {
    // 출석 상태별 설정
    switch (status) {
      case 'not_started':
        return {
          icon: <ClockIcon className="text-gray-500" />,
          text: t('attendance.status.notStarted', '출근 전'),
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-300'
        };
      case 'checked_in':
        return {
          icon: <CheckCircleIcon className="text-green-500" />,
          text: t('attendance.status.checkedIn', '출근'),
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          borderColor: 'border-green-300'
        };
      case 'checked_out':
        return {
          icon: <CheckCircleIcon className="text-blue-500" />,
          text: t('attendance.status.checkedOut', '퇴근'),
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-300'
        };
      default:
        return {
          icon: <ExclamationTriangleIcon className="text-yellow-500" />,
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
      </div>
    </div>
  );
};

export default AttendanceStatusCard;