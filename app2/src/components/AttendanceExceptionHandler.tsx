import { updateDoc, doc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

import { db } from '../firebase';
import { WorkLog } from '../hooks/useShiftSchedule';
import { useToast } from '../hooks/useToast';
import { AttendanceException, DEFAULT_EXCEPTION_SETTINGS, EXCEPTION_CONFIGS } from '../types/attendance';

interface AttendanceExceptionHandlerProps {
  workLog: WorkLog;
  onExceptionDetected?: (workLog: WorkLog, exception: AttendanceException) => void;
  onExceptionUpdated?: (workLog: WorkLog) => void;
}

export const AttendanceExceptionHandler: React.FC<AttendanceExceptionHandlerProps> = ({
  workLog,
  onExceptionDetected,
  onExceptionUpdated
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [detectedExceptions, setDetectedExceptions] = useState<AttendanceException[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [managerNote, setManagerNote] = useState('');
  const [loading, setLoading] = useState(false);

  // 예외 상황 자동 감지 로직
  useEffect(() => {
    const exceptions = detectExceptions(workLog);
    setDetectedExceptions(exceptions);
    
    // 새로운 예외 상황이 감지되면 콜백 실행
    if (exceptions.length > 0 && onExceptionDetected) {
      exceptions.forEach(exception => {
        onExceptionDetected(workLog, exception);
      });
    }
  }, [workLog, onExceptionDetected]);

  // 예외 상황 감지 함수
  const detectExceptions = (workLog: WorkLog): AttendanceException[] => {
    const exceptions: AttendanceException[] = [];
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5);

    // 1. 결근 체크 (QR 기록이 있어야 하는데 없는 경우)
    if (workLog.type === 'qr' && !workLog.actualStartTime && !workLog.actualEndTime) {
      const scheduledStart = workLog.scheduledStartTime;
      if (scheduledStart && currentTime > scheduledStart) {
        exceptions.push({
          type: 'absence',
          description: t('exceptions.absence.description', '출근 기록이 없습니다'),
          detectedAt: now.toISOString()
        });
      }
    }

    // 2. 지각 체크 (실제 출근 시간이 예정 시간보다 늦은 경우)
    if (workLog.actualStartTime && workLog.scheduledStartTime) {
      const scheduledMinutes = timeToMinutes(workLog.scheduledStartTime);
      const actualMinutes = timeToMinutes(workLog.actualStartTime);
      const diffMinutes = actualMinutes - scheduledMinutes;
      
      if (diffMinutes > DEFAULT_EXCEPTION_SETTINGS.lateThresholdMinutes) {
        exceptions.push({
          type: 'late',
          description: t('exceptions.late.description', '지각 ({{minutes}}분 늦음)', { minutes: diffMinutes }),
          detectedAt: now.toISOString()
        });
      }
    }

    // 3. 조퇴 체크 (실제 퇴근 시간이 예정 시간보다 이른 경우)
    if (workLog.actualEndTime && workLog.scheduledEndTime) {
      const scheduledMinutes = timeToMinutes(workLog.scheduledEndTime);
      const actualMinutes = timeToMinutes(workLog.actualEndTime);
      const diffMinutes = scheduledMinutes - actualMinutes;
      
      if (diffMinutes > DEFAULT_EXCEPTION_SETTINGS.earlyLeaveThresholdMinutes) {
        exceptions.push({
          type: 'early_leave',
          description: t('exceptions.earlyLeave.description', '조퇴 ({{minutes}}분 일찍 퇴근)', { minutes: diffMinutes }),
          detectedAt: now.toISOString()
        });
      }
    }

    // 4. 초과근무 체크 (실제 퇴근 시간이 예정 시간보다 늦은 경우)
    if (workLog.actualEndTime && workLog.scheduledEndTime) {
      const scheduledMinutes = timeToMinutes(workLog.scheduledEndTime);
      const actualMinutes = timeToMinutes(workLog.actualEndTime);
      const diffMinutes = actualMinutes - scheduledMinutes;
      
      if (diffMinutes > DEFAULT_EXCEPTION_SETTINGS.overtimeThresholdMinutes) {
        exceptions.push({
          type: 'overtime',
          description: t('exceptions.overtime.description', '초과근무 ({{minutes}}분 초과)', { minutes: diffMinutes }),
          detectedAt: now.toISOString()
        });
      }
    }

    return exceptions;
  };

  // 시간 문자열을 분으로 변환하는 유틸리티 함수
  const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours ?? 0) * 60 + (minutes ?? 0);
  };

  // 예외 상황 업데이트 함수
  const updateException = async (exception: AttendanceException) => {
    if (!workLog.id) return;

    setLoading(true);
    try {
      const updatedException = {
        ...exception,
        managerNote,
        resolvedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'workLogs', workLog.id), {
        exception: updatedException
      });

      showSuccess(t('exceptions.updateSuccess', '예외 상황이 업데이트되었습니다'));
      
      if (onExceptionUpdated) {
        onExceptionUpdated({ ...workLog, exception: updatedException });
      }
      
      setIsEditing(false);
      setManagerNote('');
    } catch (error) {
      console.error('예외 상황 업데이트 오류:', error);
      showError(t('exceptions.updateError', '예외 상황 업데이트에 실패했습니다'));
    } finally {
      setLoading(false);
    }
  };

  // 예외 상황 표시 컴포넌트
  const ExceptionBadge: React.FC<{ exception: AttendanceException }> = ({ exception }) => {
    const config = EXCEPTION_CONFIGS[exception.type];
    
    return (
      <div className={`
        inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
        ${config.bgColor} ${config.textColor} ${config.borderColor} border
      `}>
        <span className="text-base">{config.icon}</span>
        <span>{exception.description}</span>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="ml-2 text-sm opacity-70 hover:opacity-100"
            title={t('exceptions.edit', '수정')}
          >
            <FaEdit />
          </button>
        )}
      </div>
    );
  };

  // 예외 상황이 없으면 렌더링하지 않음
  if (detectedExceptions.length === 0 && !workLog.exception) {
    return null;
  }

  const currentException = workLog.exception || detectedExceptions[0];

  return (
    <div className="space-y-2">
      {currentException ? <ExceptionBadge exception={currentException} /> : null}
      
      {/* 예외 상황 수정 모달 */}
      {isEditing ? <div className="mt-2 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <FaExclamationTriangle className="text-yellow-500" />
            <h4 className="text-sm font-medium text-gray-700">
              {t('exceptions.managerNote', '매니저 메모')}
            </h4>
          </div>
          
          <textarea
            value={managerNote}
            onChange={(e) => setManagerNote(e.target.value)}
            placeholder={t('exceptions.managerNotePlaceholder', '예외 상황에 대한 설명을 입력하세요...')}
            className="w-full p-2 border border-gray-300 rounded-md text-sm resize-none"
            rows={3}
          />
          
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => currentException && updateException(currentException)}
              disabled={loading || !isEditing}
              className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              <FaSave />
              {loading ? t('common.saving', '저장 중...') : t('common.save', '저장')}
            </button>
            
            <button
              onClick={() => {
                setIsEditing(false);
                setManagerNote('');
              }}
              className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
            >
              <FaTimes />
              {t('common.cancel', '취소')}
            </button>
          </div>
        </div> : null}
    </div>
  );
};

export default AttendanceExceptionHandler;