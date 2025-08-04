import React from 'react';
import { getTodayString } from '../../../utils/jobPosting/dateUtils';
import { 
  FaCalendarAlt, 
  FaClock, 
  FaMapMarkerAlt, 
  FaInfoCircle,
  FaMoneyBillWave,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle,
  FaTrash
} from '../../../components/Icons/ReactIconsReplacement';
import Modal from '../../../components/Modal';
import { ScheduleEvent } from '../../../types/schedule';

interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleEvent | null;
  onCheckIn?: (scheduleId: string) => void;
  onCheckOut?: (scheduleId: string) => void;
  onCancel?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
}

const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onCheckIn,
  onCheckOut,
  onCancel,
  onDelete
}) => {
  if (!schedule) return null;

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 시간 포맷팅
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '미정';
    try {
      const date = timestamp.toDate();
      return date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch (error) {
      return '미정';
    }
  };

  // 근무 시간 계산
  const calculateDuration = (start: any, end: any) => {
    if (!start || !end) return null;
    try {
      const startDate = start.toDate();
      const endDate = end.toDate();
      const diffMs = endDate.getTime() - startDate.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}시간 ${minutes > 0 ? `${minutes}분` : ''}`;
    } catch (error) {
      return null;
    }
  };

  // 상태별 아이콘과 색상
  const getTypeDisplay = () => {
    switch (schedule.type) {
      case 'applied':
        return {
          icon: <FaHourglassHalf className="w-5 h-5 text-yellow-500" />,
          text: '지원중',
          color: 'text-yellow-600 bg-yellow-100'
        };
      case 'confirmed':
        return {
          icon: <FaCheckCircle className="w-5 h-5 text-green-500" />,
          text: '확정',
          color: 'text-green-600 bg-green-100'
        };
      case 'completed':
        return {
          icon: <FaCheckCircle className="w-5 h-5 text-blue-500" />,
          text: '완료',
          color: 'text-blue-600 bg-blue-100'
        };
      case 'cancelled':
        return {
          icon: <FaTimesCircle className="w-5 h-5 text-red-500" />,
          text: '취소',
          color: 'text-red-600 bg-red-100'
        };
      default:
        return {
          icon: null,
          text: '',
          color: ''
        };
    }
  };

  const typeDisplay = getTypeDisplay();
  const isToday = schedule.date === getTodayString();
  const canCheckIn = isToday && schedule.type === 'confirmed' && schedule.status === 'not_started';
  const canCheckOut = isToday && schedule.type === 'confirmed' && schedule.status === 'checked_in';
  
  // 삭제 가능한 일정인지 확인 (완료되지 않은 일정만)
  const canDelete = onDelete && 
    schedule.type !== 'completed' && 
    schedule.status !== 'checked_in' && // 이미 출근한 일정은 삭제 제한
    (schedule.sourceCollection === 'applications' || schedule.sourceCollection === 'workLogs');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="일정 상세">
      <div className="p-6">
        {/* 헤더 정보 */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {schedule.eventName}
            </h3>
            <div className="flex items-center gap-3">
              {typeDisplay.icon}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${typeDisplay.color}`}>
                {typeDisplay.text}
              </span>
              {isToday && (
                <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                  오늘
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 상세 정보 */}
        <div className="space-y-4">
          {/* 날짜 */}
          <div className="flex items-start gap-3">
            <FaCalendarAlt className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm text-gray-500">날짜</p>
              <p className="font-medium">{formatDate(schedule.date)}</p>
            </div>
          </div>

          {/* 시간 */}
          <div className="flex items-start gap-3">
            <FaClock className="w-5 h-5 text-gray-400 mt-1" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">근무 시간</p>
              <p className="font-medium">
                {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                {calculateDuration(schedule.startTime, schedule.endTime) && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({calculateDuration(schedule.startTime, schedule.endTime)})
                  </span>
                )}
              </p>
              
              {(schedule.actualStartTime || schedule.actualEndTime) && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">실제 근무</p>
                  <p className="font-medium text-green-600">
                    {formatTime(schedule.actualStartTime)} - {formatTime(schedule.actualEndTime)}
                    {calculateDuration(schedule.actualStartTime, schedule.actualEndTime) && (
                      <span className="text-sm ml-2">
                        ({calculateDuration(schedule.actualStartTime, schedule.actualEndTime)})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 역할 */}
          <div className="flex items-start gap-3">
            <FaInfoCircle className="w-5 h-5 text-gray-400 mt-1" />
            <div>
              <p className="text-sm text-gray-500">역할</p>
              <p className="font-medium">{schedule.role}</p>
            </div>
          </div>

          {/* 장소 */}
          {schedule.location && (
            <div className="flex items-start gap-3">
              <FaMapMarkerAlt className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">장소</p>
                <p className="font-medium">{schedule.location}</p>
                {schedule.detailedAddress && (
                  <p className="text-sm text-gray-600">{schedule.detailedAddress}</p>
                )}
              </div>
            </div>
          )}

          {/* 급여 정보 */}
          {schedule.payrollAmount && schedule.type === 'completed' && (
            <div className="flex items-start gap-3">
              <FaMoneyBillWave className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">급여</p>
                <p className="font-medium text-green-600">
                  ₩{schedule.payrollAmount.toLocaleString()}
                </p>
                {schedule.payrollStatus && (
                  <p className="text-sm text-gray-600">
                    상태: {
                      schedule.payrollStatus === 'completed' ? '지급완료' :
                      schedule.payrollStatus === 'processing' ? '처리중' : '대기중'
                    }
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 메모 */}
          {schedule.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{schedule.notes}</p>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="mt-6 flex gap-3">
          {canCheckIn && onCheckIn && (
            <button
              onClick={() => {
                onCheckIn(schedule.id);
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
            >
              출근하기
            </button>
          )}
          
          {canCheckOut && onCheckOut && (
            <button
              onClick={() => {
                onCheckOut(schedule.id);
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              퇴근하기
            </button>
          )}
          
          {schedule.type === 'applied' && onCancel && (
            <button
              onClick={() => {
                if (window.confirm('지원을 취소하시겠습니까?')) {
                  onCancel(schedule.id);
                  onClose();
                }
              }}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              지원 취소
            </button>
          )}
          
          {/* 삭제 버튼 */}
          {canDelete && (
            <button
              onClick={() => {
                onDelete(schedule.id);
                onClose();
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center gap-2"
              title="일정 삭제"
            >
              <FaTrash className="w-4 h-4" />
              삭제
            </button>
          )}
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ScheduleDetailModal;