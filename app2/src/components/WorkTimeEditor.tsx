import { doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { logger } from '../utils/logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SaveIcon, TimesIcon, EditIcon } from './Icons';

import { db } from '../firebase';
import { useToast } from '../hooks/useToast';
import { parseToDate } from '../utils/jobPosting/dateUtils';
import { useAttendanceStatus } from '../hooks/useAttendanceStatus';
import { calculateMinutes, formatMinutesToTime } from '../utils/timeUtils';

import Modal from './Modal';
// import { WorkLog } from '../hooks/useShiftSchedule';

// WorkTimeEditor에서 사용할 WorkLog 타입 (Firebase에서 가져온 실제 데이터 또는 가상 데이터)
interface WorkLogWithTimestamp {
  id: string;
  eventId: string;
  staffId: string;
  dealerId?: string; // dealerId 추가 (선택적 속성)
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
  timeType?: 'start' | 'end'; // 편집할 시간 타입
}

const WorkTimeEditor: React.FC<WorkTimeEditorProps> = ({
  isOpen,
  onClose,
  workLog,
  onUpdate,
  timeType
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  useAttendanceStatus({
    ...(workLog?.eventId && { eventId: workLog.eventId }),
    ...(workLog?.date && { date: workLog.date })
  });
  
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
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
      const timeParts = timeString.split(':').map(Number);
      if (timeParts.length !== 2) {
        // Invalid time string format
        return null;
      }
      
      const [hours, minutes] = timeParts;
      
      // 유효하지 않은 시간 값 검사
      if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        // Invalid time string
        return null;
      }
      
      // baseDate가 유효한지 확인
      let validBaseDate = baseDate;
      if (!baseDate || isNaN(baseDate.getTime())) {
        // Invalid baseDate, using current date
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
        if (startTimeParts.length === 2 && startTimeParts[0]) {
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
        // Invalid date created
        return null;
      }
      
      // 날짜가 유효한 범위 내에 있는지 확인 (1970~2038)
      const year = date.getFullYear();
      if (year < 1970 || year > 2038) {
        // Date out of valid range
        return null;
      }
      
      return Timestamp.fromDate(date);
    } catch (error) {
      // Error parsing time string
      return null;
    }
  };

  // Timestamp 또는 Date를 Date로 변환하는 헬퍼 함수
  const toDate = (timestamp: Timestamp | Date | any | null): Date => {
    if (!timestamp) return new Date();
    
    const parsedDate = parseToDate(timestamp);
    return parsedDate || new Date(); // parseToDate가 null을 반환하면 현재 날짜 사용
  };

  // 유효성 검사
  const validateTimes = () => {
    const errors: string[] = [];
    
    // 시작시간 유효성 검사
    if (startTime && startTime.trim() !== '' && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime)) {
      errors.push('시작 시간 형식이 올바르지 않습니다.');
    }
    
    // 종료시간 유효성 검사 (선택사항)
    if (endTime && endTime.trim() !== '' && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
      errors.push('종료 시간 형식이 올바르지 않습니다.');
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // 시간 수정 함수
  const handleUpdateTime = async () => {
    
    if (!workLog) {
      // workLog가 없습니다
      return;
    }
    
    const isValid = validateTimes();
    
    if (!isValid) {
      // 유효성 검사 실패
      return;
    }
    
    setIsUpdating(true);
    try {
      const baseDate = toDate(workLog.scheduledStartTime || new Date());
      logger.debug('handleUpdateTime - baseDate:', { component: 'WorkTimeEditor', data: baseDate });
      
      const newStartTime = startTime && startTime.trim() !== '' ? 
        parseTimeString(startTime, baseDate, false) : null;
      const newEndTime = endTime && endTime.trim() !== '' ? 
        parseTimeString(endTime, baseDate, true, startTime) : null;
      
      console.log('handleUpdateTime - parsed times:', {
        startTime,
        endTime,
        newStartTime,
        newEndTime
      });
      
      // 시작 시간과 종료 시간이 모두 없는 경우 스태프의 assignedTime을 '미정'로 설정
      
      // 가상 WorkLog인지 확인 (ID가 'virtual_'로 시작하는 경우)
      const isVirtual = workLog.id.startsWith('virtual_');
      
      if (isVirtual) {
        // 가상 WorkLog의 경우 새로운 문서 생성
        const realWorkLogId = `${workLog.eventId}_${workLog.staffId}_${workLog.date}`;
        const workLogRef = doc(db, 'workLogs', realWorkLogId);
        
        // 통합된 시간 처리: 입력된 시간을 scheduledStartTime으로 사용
        let scheduledStartTimestamp = newStartTime;
        let scheduledEndTimestamp = null;
        
        if (workLog.scheduledEndTime) {
          try {
            const scheduledEndDate = toDate(workLog.scheduledEndTime);
            scheduledEndTimestamp = Timestamp.fromDate(scheduledEndDate);
          } catch (error) {
            logger.error('Error converting scheduledEndTime:', error instanceof Error ? error : new Error(String(error)), { component: 'WorkTimeEditor' });
          }
        }
        
        await setDoc(workLogRef, {
          eventId: workLog.eventId,
          dealerId: workLog.staffId,
          dealerName: 'Unknown',
          type: 'schedule',
          date: workLog.date,
          scheduledStartTime: scheduledStartTimestamp,
          scheduledEndTime: scheduledEndTimestamp,
          // actualStartTime과 actualEndTime은 설정하지 않음 (출석 상태와 독립적으로 관리)
          totalWorkMinutes: 0,
          totalBreakMinutes: 0,
          tableAssignments: [],
          status: 'scheduled', // 시간 수정은 상태에 영향 없음
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      } else {
        // 기존 WorkLog 업데이트
        const workLogRef = doc(db, 'workLogs', workLog.id);
        const updateData: any = {
          scheduledStartTime: newStartTime, // 예정 시작 시간만 수정
          scheduledEndTime: newEndTime, // 예정 종료 시간만 수정
          // actualStartTime과 actualEndTime은 수정하지 않음 (출석 상태와 독립적으로 관리)
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(workLogRef, updateData);
      }
      
      // 날짜별 시간 관리를 위해 staff 컬렉션 업데이트 제거
      // workLogs 컬렉션만 업데이트하고, 화면 표시는 workLogs 데이터 우선 사용
      // workLogs 컬렉션만 업데이트 (날짜별 개별 시간 관리)
      
      // 업데이트된 데이터로 콜백 호출
      if (onUpdate) {
        const updatedWorkLog = {
          ...workLog,
          scheduledStartTime: newStartTime,
          scheduledEndTime: newEndTime,
          updatedAt: Timestamp.now()
        };
        onUpdate(updatedWorkLog);
      }
      
      showSuccess(t('attendance.messages.timeUpdated'));
      onClose();
    } catch (error) {
      logger.error('Error updating work time:', error instanceof Error ? error : new Error(String(error)), { component: 'WorkTimeEditor' });
      showError(t('attendance.messages.updateError'));
    } finally {
      setIsUpdating(false);
    }
  };

  // 모달이 열릴 때 기존 시간 값 설정
  useEffect(() => {
    if (isOpen && workLog) {
      // 실제시간이 있으면 실제시간 우선, 없으면 예정시간 사용
      const actualStartTimeString = formatTimeForInput(workLog.actualStartTime);
      const scheduledStartTimeString = formatTimeForInput(workLog.scheduledStartTime);
      const startTimeString = actualStartTimeString || scheduledStartTimeString;
      
      // 퇴근시간은 예정시간(scheduledEndTime)만 사용
      const scheduledEndTimeString = formatTimeForInput(workLog.scheduledEndTime);
      const endTimeString = scheduledEndTimeString; // 실제시간 제외
      
      setStartTime(startTimeString);
      setEndTime(endTimeString);
      
      // 분리된 시간 상태 초기화
      const startParts = parseTime(startTimeString);
      setStartHour(startParts.hour);
      setStartMinute(startParts.minute);
      
      const endParts = parseTime(endTimeString);
      setEndHour(endParts.hour);
      setEndMinute(endParts.minute);
      
      setValidationErrors([]);
    }
  }, [isOpen, workLog]);

  // timeType에 따른 모달 제목 생성
  const getModalTitle = () => {
    if (timeType === 'start') {
      return '출근 시간 수정';
    } else if (timeType === 'end') {
      return '퇴근 시간 수정';
    }
    return t('attendance.editWorkTime');
  };

  // 시간과 분 옵션 생성
  const generateHourOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      options.push({
        value: hour.toString().padStart(2, '0'),
        label: `${hour.toString().padStart(2, '0')}시`
      });
    }
    return options;
  };

  const generateMinuteOptions = () => {
    const options = [];
    for (let minute = 0; minute < 60; minute += 5) {
      options.push({
        value: minute.toString().padStart(2, '0'),
        label: `${minute.toString().padStart(2, '0')}분`
      });
    }
    return options;
  };

  const hourOptions = generateHourOptions();
  const minuteOptions = generateMinuteOptions();

  // 시간 분리 함수
  const parseTime = (timeString: string) => {
    if (!timeString) return { hour: '', minute: '' };
    const [hour, minute] = timeString.split(':');
    return { hour: hour || '', minute: minute || '' };
  };

  const combineTime = (hour: string, minute: string) => {
    // 시간과 분이 모두 있을 때만 결합
    if (hour && minute) {
      return `${hour}:${minute}`;
    }
    // 둘 중 하나라도 없으면 빈 문자열 반환 (이는 '미정' 상태를 의미)
    return '';
  };

  // 시작 시간 분리
  const [startHour, setStartHour] = useState('');
  const [startMinute, setStartMinute] = useState('');

  // 종료 시간 분리
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('');

  // 시간 업데이트 핸들러
  const handleStartTimeChange = (hour: string, minute: string) => {
    setStartHour(hour);
    setStartMinute(minute);
    setStartTime(combineTime(hour, minute));
  };

  const handleEndTimeChange = (hour: string, minute: string) => {
    setEndHour(hour);
    setEndMinute(minute);
    setEndTime(combineTime(hour, minute));
  };


  if (!workLog) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getModalTitle()}
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
                // Error displaying date
                return workLog.date ? String(workLog.date) : '날짜 오류';
              }
            })()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {t('attendance.eventId')}: {workLog.eventId}
          </p>
        </div>

        {/* 시간 편집 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            <EditIcon className="w-5 h-5 mr-2 text-blue-600" />
            시간 설정
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            시간을 입력하지 않으면 '미정'로 표시됩니다.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className={timeType === 'start' ? 'ring-2 ring-blue-500 rounded-lg p-2 -m-2' : ''}>
              <label className={`block text-sm font-medium mb-1 ${timeType === 'start' ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>
                시작 시간
                {timeType === 'start' && <span className="ml-1 text-blue-600">← 편집 중</span>}
              </label>
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <select
                    value={startHour}
                    onChange={(e) => handleStartTimeChange(e.target.value, startMinute)}
                    className={`flex-1 px-3 py-2 border rounded-md font-mono text-lg ${
                      timeType === 'start' 
                        ? 'border-blue-500 focus:ring-blue-500 focus:border-blue-500' 
                        : 'border-gray-300'
                    }`}
                    autoFocus={timeType === 'start'}
                  >
                    <option value="">시</option>
                    {hourOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={startMinute}
                    onChange={(e) => handleStartTimeChange(startHour, e.target.value)}
                    className={`flex-1 px-3 py-2 border rounded-md font-mono text-lg ${
                      timeType === 'start' 
                        ? 'border-blue-500 focus:ring-blue-500 focus:border-blue-500' 
                        : 'border-gray-300'
                    }`}
                  >
                    <option value="">분</option>
                    {minuteOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 시작시간이 이미 설정되어 있고, end 타입이 아닌 경우에만 지우기 버튼 표시 */}
                {startTime && timeType !== 'end' && (
                  <button
                    onClick={() => {
                      setStartHour('');
                      setStartMinute('');
                      setStartTime('');
                    }}
                    className="w-full px-3 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                    title="시작시간 지우기 (미정로 되돌리기)"
                  >
                    🗑️ 시작시간 지우기 (미정로 되돌리기)
                  </button>
                )}
              </div>
            </div>
            <div className={timeType === 'end' ? 'ring-2 ring-green-500 rounded-lg p-2 -m-2' : ''}>
              <label className={`block text-sm font-medium mb-1 ${timeType === 'end' ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>
                종료 시간
                <span className="text-gray-500 text-xs">(선택사항)</span>
                {timeType === 'end' && <span className="ml-1 text-green-600">← 편집 중</span>}
              </label>
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <select
                    value={endHour}
                    onChange={(e) => handleEndTimeChange(e.target.value, endMinute)}
                    className={`flex-1 px-3 py-2 border rounded-md font-mono text-lg ${
                      timeType === 'end' 
                        ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                        : 'border-gray-300'
                    }`}
                    autoFocus={timeType === 'end'}
                  >
                    <option value="">시</option>
                    {hourOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={endMinute}
                    onChange={(e) => handleEndTimeChange(endHour, e.target.value)}
                    className={`flex-1 px-3 py-2 border rounded-md font-mono text-lg ${
                      timeType === 'end' 
                        ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                        : 'border-gray-300'
                    }`}
                  >
                    <option value="">분</option>
                    {minuteOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setEndHour('');
                    setEndMinute('');
                    setEndTime('');
                  }}
                  className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  title="종료시간을 미정으로 설정"
                >
                  🗑️ 종료시간 지우기 (미정으로 설정)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 근무 시간 요약 */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3">근무 시간 요약</h3>
          <div className="text-center">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              근무시간
            </label>
            <div className="text-2xl font-mono font-bold text-blue-600">
              {startTime ? (() => {
                if (endTime) {
                  // 시작/종료 시간 모두 있는 경우
                  const baseDate = toDate(workLog.scheduledStartTime || new Date());
                  const parsedStartTime = parseTimeString(startTime, baseDate, false);
                  const parsedEndTime = parseTimeString(endTime, baseDate, true, startTime);
                  const minutes = calculateMinutes(parsedStartTime, parsedEndTime);
                  
                  const startHour = parseInt(startTime.split(':')[0] || '0');
                  const endHour = parseInt(endTime.split(':')[0] || '0');
                  const isNextDay = endHour < startHour; // 다음날 여부 판단
                  
                  return (
                    <div>
                      <div>{formatMinutesToTime(minutes)}</div>
                      {isNextDay && (
                        <div className="text-sm text-orange-600 mt-1">
                          (다음날 {endTime}까지)
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // 시작시간만 있는 경우
                  return (
                    <div>
                      <div className="text-lg">시작시간: {startTime}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        (종료시간 미정)
                      </div>
                    </div>
                  );
                }
              })() : (
                <div>
                  <div className="text-lg text-gray-500">시간 미정</div>
                  <div className="text-sm text-gray-400 mt-1">
                    시작시간을 설정해주세요
                  </div>
                </div>
              )}
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
            <TimesIcon className="w-4 h-4 mr-2" />
            {t('common.cancel')}
          </button>
          <button
            onClick={handleUpdateTime}
            disabled={isUpdating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <SaveIcon className="w-4 h-4 mr-2" />
            {isUpdating ? t('common.updating') : t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default WorkTimeEditor;