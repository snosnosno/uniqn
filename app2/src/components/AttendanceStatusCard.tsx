
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

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-5 h-5';
    }
  };

  const getStatusConfig = () => {
    const iconSize = getIconSize();
    // 출석 상태별 설정
    switch (status) {
      case 'not_started':
        return {
          icon: <ClockIcon className={`${iconSize} text-attendance-notStarted-text`} />,
          text: t('attendance.status.notStarted', '출근 전'),
          bgColor: 'bg-attendance-notStarted-bg',
          textColor: 'text-attendance-notStarted-text',
          borderColor: 'border-attendance-notStarted-border'
        };
      case 'checked_in':
        return {
          icon: <CheckCircleIcon className={`${iconSize} text-attendance-checkedIn-text`} />,
          text: t('attendance.status.checkedIn', '출근'),
          bgColor: 'bg-attendance-checkedIn-bg',
          textColor: 'text-attendance-checkedIn-text',
          borderColor: 'border-attendance-checkedIn-border'
        };
      case 'checked_out':
        return {
          icon: <CheckCircleIcon className={`${iconSize} text-attendance-checkedOut-text`} />,
          text: t('attendance.status.checkedOut', '퇴근'),
          bgColor: 'bg-attendance-checkedOut-bg',
          textColor: 'text-attendance-checkedOut-text',
          borderColor: 'border-attendance-checkedOut-border'
        };
      default:
        return {
          icon: <ExclamationTriangleIcon className={`${iconSize} text-warning`} />,
          text: t('attendance.status.unknown', '알 수 없음'),
          bgColor: 'bg-warning-light/20',
          textColor: 'text-warning-dark',
          borderColor: 'border-warning'
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