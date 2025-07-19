import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClock, FaSave, FaTimes, FaEdit } from 'react-icons/fa';

import { db } from '../firebase';
import { useToast } from '../hooks/useToast';

import Modal from './Modal';
// import { WorkLog } from '../hooks/useShiftSchedule';

// WorkTimeEditor에서 사용할 WorkLog 타입 (Firebase에서 가져온 실제 데이터)
interface WorkLogWithTimestamp {
  id: string;
  eventId: string;
  staffId: string;
  date: string;
  scheduledStartTime: Timestamp | null;
  scheduledEndTime: Timestamp | null;
  actualStartTime: Timestamp | null;
  actualEndTime: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface WorkTimeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  workLog: WorkLogWithTimestamp | null;
  onUpdate?: (updatedWorkLog: WorkLogWithTimestamp) => void;
}

const WorkTimeEditor: React.FC<WorkTimeEditorProps> = ({
  isOpen,
  onClose,
  workLog,
  onUpdate
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  
  const [actualStartTime, setActualStartTime] = useState('');
  const [actualEndTime, setActualEndTime] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 시간 형식 변환 함수
  const formatTimeForInput = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 시간 문자열을 Timestamp로 변환
  const parseTimeString = (timeString: string, baseDate: Date) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return Timestamp.fromDate(date);
  };

  // 근무 시간 계산 (분 단위)
  const calculateMinutes = (startTime: Timestamp | null, endTime: Timestamp | null) => {
    if (!startTime || !endTime) return 0;
    return Math.floor((endTime.toMillis() - startTime.toMillis()) / (1000 * 60));
  };

  // 분을 시간:분 형식으로 변환
  const formatMinutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
  };

  // 유효성 검사
  const validateTimes = () => {
    const errors: string[] = [];
    
    if (!actualStartTime) {
      errors.push(t('attendance.validation.startTimeRequired'));
    } else if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(actualStartTime)) {
      errors.push(t('attendance.validation.invalidTimeFormat'));
    }
    
    if (!actualEndTime) {
      errors.push(t('attendance.validation.endTimeRequired'));
    } else if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(actualEndTime)) {
      errors.push(t('attendance.validation.invalidTimeFormat'));
    }
    
    if (actualStartTime && actualEndTime) {
      const startTime = new Date(`2000-01-01T${actualStartTime}:00`);
      const endTime = new Date(`2000-01-01T${actualEndTime}:00`);
      if (endTime <= startTime) {
        errors.push(t('attendance.validation.endTimeAfterStart'));
      }
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // 시간 수정 함수
  const handleUpdateTime = async () => {
    if (!workLog || !validateTimes()) return;
    
    setIsUpdating(true);
    try {
      const baseDate = workLog.scheduledStartTime?.toDate() || new Date();
      const newStartTime = parseTimeString(actualStartTime, baseDate);
      const newEndTime = parseTimeString(actualEndTime, baseDate);
      
      const workLogRef = doc(db, 'workLogs', workLog.id);
      await updateDoc(workLogRef, {
        actualStartTime: newStartTime,
        actualEndTime: newEndTime,
        updatedAt: Timestamp.now()
      });
      
      // 업데이트된 데이터로 콜백 호출
      if (onUpdate) {
        const updatedWorkLog = {
          ...workLog,
          actualStartTime: newStartTime,
          actualEndTime: newEndTime,
          updatedAt: Timestamp.now()
        };
        onUpdate(updatedWorkLog);
      }
      
      showSuccess(t('attendance.messages.timeUpdated'));
      onClose();
    } catch (error) {
      console.error('Error updating work time:', error);
      showError(t('attendance.messages.updateError'));
    } finally {
      setIsUpdating(false);
    }
  };

  // 모달이 열릴 때 기존 시간 값 설정
  useEffect(() => {
    if (isOpen && workLog) {
      setActualStartTime(formatTimeForInput(workLog.actualStartTime));
      setActualEndTime(formatTimeForInput(workLog.actualEndTime));
      setValidationErrors([]);
    }
  }, [isOpen, workLog]);

  if (!workLog) return null;

  const scheduledMinutes = calculateMinutes(workLog.scheduledStartTime, workLog.scheduledEndTime);
  // const actualMinutes = calculateMinutes(workLog.actualStartTime, workLog.actualEndTime);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('attendance.editWorkTime')}
    >
      <div className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-2">{t('attendance.date')}</h3>
          <p className="text-gray-600">
            {workLog.scheduledStartTime?.toDate().toLocaleDateString('ko-KR')}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {t('attendance.eventId')}: {workLog.eventId}
          </p>
        </div>

        {/* 예정 시간 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            <FaClock className="mr-2 text-blue-600" />
            {t('attendance.scheduledTimes')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('attendance.scheduledStartTime')}
              </label>
              <div className="text-lg font-mono">
                {formatTimeForInput(workLog.scheduledStartTime) || 'N/A'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('attendance.scheduledEndTime')}
              </label>
              <div className="text-lg font-mono">
                {formatTimeForInput(workLog.scheduledEndTime) || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* 실제 시간 편집 */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            <FaEdit className="mr-2 text-green-600" />
            {t('attendance.actualTimes')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('attendance.actualStartTime')}
              </label>
              <input
                type="time"
                value={actualStartTime}
                onChange={(e) => setActualStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('attendance.actualEndTime')}
              </label>
              <input
                type="time"
                value={actualEndTime}
                onChange={(e) => setActualEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-lg"
              />
            </div>
          </div>
        </div>

        {/* 근무 시간 요약 */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3">{t('attendance.workTimeSummary')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('attendance.scheduledMinutes')}
              </label>
              <div className="text-lg font-mono">
                {formatMinutesToTime(scheduledMinutes)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('attendance.actualMinutes')}
              </label>
              <div className="text-lg font-mono">
                {actualStartTime && actualEndTime ? 
                  formatMinutesToTime(calculateMinutes(
                    parseTimeString(actualStartTime, workLog.scheduledStartTime?.toDate() || new Date()),
                    parseTimeString(actualEndTime, workLog.scheduledStartTime?.toDate() || new Date())
                  ))
                  : 'N/A'
                }
              </div>
            </div>
          </div>
        </div>

        {/* 유효성 검사 오류 */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2">오류</h4>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
          >
            <FaTimes className="mr-2" />
            {t('common.cancel')}
          </button>
          <button
            onClick={handleUpdateTime}
            disabled={isUpdating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <FaSave className="mr-2" />
            {isUpdating ? t('common.updating') : t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default WorkTimeEditor;