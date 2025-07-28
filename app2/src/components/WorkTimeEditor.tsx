import { doc, updateDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClock, FaSave, FaTimes, FaEdit } from 'react-icons/fa';

import { db } from '../firebase';
import { useToast } from '../hooks/useToast';
import { parseToDate } from '../utils/jobPosting/dateUtils';

import Modal from './Modal';
// import { WorkLog } from '../hooks/useShiftSchedule';

// WorkTimeEditor에서 사용할 WorkLog 타입 (Firebase에서 가져온 실제 데이터 또는 가상 데이터)
interface WorkLogWithTimestamp {
  id: string;
  eventId: string;
  staffId: string;
  date: string;
  scheduledStartTime: Timestamp | Date | null;
  scheduledEndTime: Timestamp | Date | null;
  actualStartTime: Timestamp | Date | null;
  actualEndTime: Timestamp | Date | null;
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
  const formatTimeForInput = (timestamp: Timestamp | Date | null) => {
    if (!timestamp) return '';
    
    // Date 객체인 경우 직접 사용
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 시간 문자열을 Timestamp로 변환 (다음날 계산 지원)
  const parseTimeString = (timeString: string, baseDate: Date, isEndTime = false, startTimeString = '') => {
    if (!timeString) return null;
    
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      
      // 유효하지 않은 시간 값 검사
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.error('Invalid time string:', timeString);
        return null;
      }
      
      // baseDate가 유효한지 확인
      let validBaseDate = baseDate;
      if (!baseDate || isNaN(baseDate.getTime())) {
        console.warn('Invalid baseDate, using current date');
        validBaseDate = new Date();
      }
      
      // 새로운 Date 객체 생성 시 연, 월, 일을 명시적으로 설정
      const date = new Date();
      date.setFullYear(validBaseDate.getFullYear());
      date.setMonth(validBaseDate.getMonth());
      date.setDate(validBaseDate.getDate());
      date.setHours(hours, minutes, 0, 0);
      
      // 종료 시간이고 시작 시간이 있는 경우, 다음날 여부 판단
      if (isEndTime && startTimeString) {
        const startTimeParts = startTimeString.split(':');
        if (startTimeParts.length === 2) {
          const startHour = parseInt(startTimeParts[0]);
          const endHour = hours;
          
          // 종료 시간이 시작 시간보다 이른 경우 다음날로 설정
          if (endHour < startHour) {
            date.setDate(date.getDate() + 1);
          }
        }
      }
      
      // 날짜가 유효한지 확인
      if (isNaN(date.getTime())) {
        console.error('Invalid date created:', date);
        return null;
      }
      
      // 날짜가 유효한 범위 내에 있는지 확인 (1970~2038)
      const year = date.getFullYear();
      if (year < 1970 || year > 2038) {
        console.error('Date out of valid range:', date);
        return null;
      }
      
      return Timestamp.fromDate(date);
    } catch (error) {
      console.error('Error parsing time string:', error, timeString);
      return null;
    }
  };

  // Timestamp 또는 Date를 Date로 변환하는 헬퍼 함수
  const toDate = (timestamp: Timestamp | Date | any | null): Date => {
    if (!timestamp) return new Date();
    
    const parsedDate = parseToDate(timestamp);
    return parsedDate || new Date(); // parseToDate가 null을 반환하면 현재 날짜 사용
  };

  // 근무 시간 계산 (분 단위) - 다음날 계산 지원
  const calculateMinutes = (startTime: Timestamp | Date | null, endTime: Timestamp | Date | null) => {
    if (!startTime || !endTime) return 0;
    
    // Date로 통일
    const startDate = startTime instanceof Timestamp ? startTime.toDate() : startTime;
    let endDate = endTime instanceof Timestamp ? endTime.toDate() : endTime;
    
    // 종료 시간이 시작 시간보다 이전인 경우 (다음날로 계산)
    if (endDate.getTime() <= startDate.getTime()) {
      // 다음날로 설정
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // 실제 시간 차이 계산
    return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));
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
    
    if (actualEndTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(actualEndTime)) {
      errors.push(t('attendance.validation.invalidTimeFormat'));
    }
    
    // 다음날 계산을 지원하므로 종료 시간이 시작 시간보다 이른 것을 허용
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // 시간 수정 함수
  const handleUpdateTime = async () => {
    if (!workLog || !validateTimes()) return;
    
    setIsUpdating(true);
    try {
      const baseDate = toDate(workLog.scheduledStartTime);
      console.log('handleUpdateTime - baseDate:', baseDate);
      
      const newStartTime = parseTimeString(actualStartTime, baseDate, false);
      const newEndTime = actualEndTime ? parseTimeString(actualEndTime, baseDate, true, actualStartTime) : null;
      
      console.log('handleUpdateTime - parsed times:', {
        actualStartTime,
        actualEndTime,
        newStartTime,
        newEndTime
      });
      
      // 시작 시간이 null인 경우 오류 처리
      if (!newStartTime) {
        showError('유효하지 않은 시작 시간입니다.');
        setIsUpdating(false);
        return;
      }
      
      // 가상 WorkLog인지 확인 (ID가 'virtual_'로 시작하는 경우)
      const isVirtual = workLog.id.startsWith('virtual_');
      
      if (isVirtual) {
        // 가상 WorkLog의 경우 새로운 문서 생성
        const realWorkLogId = `${workLog.eventId}_${workLog.staffId}_${workLog.date}`;
        const workLogRef = doc(db, 'workLogs', realWorkLogId);
        
        // Timestamp 변환 시 오류 처리
        let scheduledStartTimestamp = null;
        let scheduledEndTimestamp = null;
        
        if (workLog.scheduledStartTime) {
          try {
            const scheduledStartDate = toDate(workLog.scheduledStartTime);
            scheduledStartTimestamp = Timestamp.fromDate(scheduledStartDate);
          } catch (error) {
            console.error('Error converting scheduledStartTime:', error);
          }
        }
        
        if (workLog.scheduledEndTime) {
          try {
            const scheduledEndDate = toDate(workLog.scheduledEndTime);
            scheduledEndTimestamp = Timestamp.fromDate(scheduledEndDate);
          } catch (error) {
            console.error('Error converting scheduledEndTime:', error);
          }
        }
        
        await setDoc(workLogRef, {
          eventId: workLog.eventId,
          staffId: workLog.staffId,
          date: workLog.date,
          scheduledStartTime: scheduledStartTimestamp,
          scheduledEndTime: scheduledEndTimestamp,
          actualStartTime: newStartTime,
          actualEndTime: newEndTime,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      } else {
        // 기존 WorkLog 업데이트
        const workLogRef = doc(db, 'workLogs', workLog.id);
        await updateDoc(workLogRef, {
          actualStartTime: newStartTime,
          actualEndTime: newEndTime,
          updatedAt: Timestamp.now()
        });
      }
      
      // 스태프의 assignedTime도 업데이트 (시간 열 동기화를 위해)
      if (workLog.staffId && newStartTime) {
        try {
          const newTimeString = newStartTime.toDate().toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // staff 컬렉션에서 해당 스태프 찾아서 assignedTime 업데이트
          const staffQuery = query(
            collection(db, 'staff'), 
            where('userId', '==', workLog.staffId),
            where('postingId', '==', workLog.eventId)
          );
          
          const staffSnapshot = await getDocs(staffQuery);
          const updatePromises = staffSnapshot.docs.map(staffDoc => 
            updateDoc(doc(db, 'staff', staffDoc.id), {
              assignedTime: newTimeString,
              updatedAt: Timestamp.now()
            })
          );
          
          await Promise.all(updatePromises);
          console.log('스태프 assignedTime 업데이트 완료:', newTimeString);
        } catch (error) {
          console.error('스태프 assignedTime 업데이트 오류:', error);
          // 이 오류는 전체 프로세스를 중단시키지 않음
        }
      }
      
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
            {(() => {
              try {
                // 1. scheduledStartTime이 있으면 우선 사용
                if (workLog.scheduledStartTime) {
                  const date = parseToDate(workLog.scheduledStartTime);
                  if (date) {
                    return date.toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit', 
                      day: '2-digit',
                      weekday: 'short'
                    });
                  }
                }
                
                // 2. workLog.date가 있으면 사용
                if (workLog.date) {
                  const date = parseToDate(workLog.date);
                  if (date) {
                    return date.toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit', 
                      weekday: 'short'
                    });
                  }
                  // parseToDate가 실패한 경우 원본 값 표시 (디버깅용)
                  return String(workLog.date);
                }
                
                return '날짜 정보 없음';
              } catch (error) {
                console.error('Error displaying date:', error, { 
                  workLog: workLog,
                  scheduledStartTime: workLog.scheduledStartTime,
                  date: workLog.date 
                });
                return workLog.date ? String(workLog.date) : '날짜 오류';
              }
            })()}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('attendance.scheduledStartTime')}
            </label>
            <div className="text-lg font-mono">
              {formatTimeForInput(workLog.scheduledStartTime) || 'N/A'}
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
                {t('attendance.actualEndTime')} <span className="text-gray-500 text-xs">(선택사항)</span>
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
          <div className="text-center">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              실제 근무시간
            </label>
            <div className="text-2xl font-mono font-bold text-blue-600">
              {actualStartTime ? (() => {
                if (actualEndTime) {
                  // 출근/퇴근 시간 모두 있는 경우
                  const baseDate = toDate(workLog.scheduledStartTime);
                  const startTime = parseTimeString(actualStartTime, baseDate, false);
                  const endTime = parseTimeString(actualEndTime, baseDate, true, actualStartTime);
                  const minutes = calculateMinutes(startTime, endTime);
                  
                  const startHour = parseInt(actualStartTime.split(':')[0]);
                  const endHour = parseInt(actualEndTime.split(':')[0]);
                  const isNextDay = endHour < startHour; // 다음날 여부 판단
                  
                  return (
                    <div>
                      <div>{formatMinutesToTime(minutes)}</div>
                      {isNextDay && (
                        <div className="text-sm text-orange-600 mt-1">
                          (다음날 {actualEndTime}까지)
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // 출근시간만 있는 경우
                  return (
                    <div>
                      <div className="text-lg">출근시간: {actualStartTime}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        (퇴근시간 미입력)
                      </div>
                    </div>
                  );
                }
              })() : 'N/A'}
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