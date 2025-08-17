import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { EnhancedPayrollCalculation, AllowanceType } from '../../types/payroll';
import { formatCurrency } from '../../i18n-helpers';

interface DetailEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: EnhancedPayrollCalculation | null;
  onSave: (staff: EnhancedPayrollCalculation, allowances: EnhancedPayrollCalculation['allowances']) => void;
}

const DetailEditModal: React.FC<DetailEditModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSave
}) => {
  const [allowances, setAllowances] = useState({
    meal: 0,
    transportation: 0,
    accommodation: 0,
    bonus: 0,
    other: 0,
    otherDescription: ''
  });

  // staff 데이터가 변경될 때 allowances 초기화
  useEffect(() => {
    if (staff) {
      // 디버깅을 위한 로그
      console.log('DetailEditModal - staff 데이터:', staff);
      if (staff.workLogs && staff.workLogs.length > 0) {
        const firstLog = staff.workLogs[0];
        console.log('DetailEditModal - workLogs 샘플:', firstLog);
        if (firstLog) {
          console.log('DetailEditModal - workLog 필드들:', {
            actualStartTime: firstLog.actualStartTime,
            actualEndTime: firstLog.actualEndTime,
            scheduledStartTime: firstLog.scheduledStartTime,
            scheduledEndTime: firstLog.scheduledEndTime,
            status: firstLog.status
          });
        }
      }
      
      setAllowances({
        meal: staff.allowances.meal || 0,
        transportation: staff.allowances.transportation || 0,
        accommodation: staff.allowances.accommodation || 0,
        bonus: staff.allowances.bonus || 0,
        other: staff.allowances.other || 0,
        otherDescription: staff.allowances.otherDescription || ''
      });
    }
  }, [staff]);

  const handleAmountChange = useCallback((type: AllowanceType, value: string) => {
    const numValue = parseInt(value) || 0;
    setAllowances(prev => ({
      ...prev,
      [type]: numValue
    }));
  }, []);

  const handleDescriptionChange = useCallback((value: string) => {
    setAllowances(prev => ({
      ...prev,
      otherDescription: value
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (staff) {
      onSave(staff, allowances);
      onClose();
    }
  }, [staff, allowances, onSave, onClose]);

  // 날짜별 근무 내역 계산
  const workHistory = useMemo(() => {
    if (!staff || !staff.workLogs || staff.workLogs.length === 0) return [];
    
    // 디버그 로그
    console.log('DetailEditModal - workLogs 원본 데이터:', staff.workLogs);
    console.log('DetailEditModal - 첫 번째 workLog 상세:', staff.workLogs[0]);
    
    try {
      // workLogs를 날짜별로 정렬
      const sortedLogs = [...staff.workLogs].sort((a, b) => {
        // 안전한 날짜 파싱
        const getDateValue = (date: any) => {
          if (!date) return 0;
          try {
            // Firebase Timestamp 처리
            if (typeof date === 'object' && 'seconds' in date) {
              return date.seconds * 1000;
            } else if (typeof date === 'string') {
              return new Date(date).getTime();
            } else if (date instanceof Date) {
              return date.getTime();
            }
            return 0;
          } catch {
            return 0;
          }
        };
        
        return getDateValue(a.date) - getDateValue(b.date);
      });
      
      return sortedLogs.map(log => {
        try {
          // 날짜 파싱 (안전하게)
          let dateStr = '날짜 없음';
          let dayName = '';
          
          if (log.date) {
            // Firebase Timestamp 처리
            let dateValue: Date | null = null;
            const logDate = log.date as any;
            
            if (typeof logDate === 'object' && 'seconds' in logDate) {
              // Firebase Timestamp
              dateValue = new Date(logDate.seconds * 1000);
            } else if (typeof logDate === 'string') {
              // 문자열 날짜
              dateValue = new Date(logDate);
            } else if (logDate instanceof Date) {
              // Date 객체
              dateValue = logDate;
            }
            
            if (dateValue && !isNaN(dateValue.getTime())) {
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              dayName = dayNames[dateValue.getDay()] || '';
              dateStr = `${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
            }
          }
          
          // 시간 데이터 파싱 (Firebase Timestamp 처리)
          const parseTime = (timeValue: any): string => {
            if (!timeValue) return '미정';
            
            try {
              // Firebase Timestamp 처리
              if (typeof timeValue === 'object' && 'seconds' in timeValue) {
                const date = new Date(timeValue.seconds * 1000);
                return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
              }
              // 문자열인 경우 그대로 반환
              if (typeof timeValue === 'string') {
                return timeValue;
              }
              // Date 객체인 경우
              if (timeValue instanceof Date) {
                return `${String(timeValue.getHours()).padStart(2, '0')}:${String(timeValue.getMinutes()).padStart(2, '0')}`;
              }
            } catch (error) {
              console.error('시간 파싱 오류:', error);
            }
            
            return '미정';
          };
          
          // actualStartTime/actualEndTime 또는 scheduledStartTime/scheduledEndTime 사용
          // actualStartTime/actualEndTime이 있으면 우선 사용
          const hasActualTimes = log.actualStartTime || log.actualEndTime;
          
          let startTime = '미정';
          let endTime = '미정';
          
          if (hasActualTimes) {
            // 실제 출퇴근 시간이 있는 경우
            startTime = parseTime(log.actualStartTime);
            endTime = parseTime(log.actualEndTime);
          } else {
            // 예정 시간만 있는 경우
            startTime = parseTime(log.scheduledStartTime);
            endTime = parseTime(log.scheduledEndTime);
          }
          
          console.log('DetailEditModal - WorkLog 시간 파싱:', {
            date: log.date,
            hasActualTimes,
            actualStart: log.actualStartTime,
            actualEnd: log.actualEndTime,
            scheduledStart: log.scheduledStartTime,
            scheduledEnd: log.scheduledEndTime,
            parsedStart: startTime,
            parsedEnd: endTime
          });
          
          // 근무시간 계산
          let workHours = '계산중';
          if (startTime !== '미정' && endTime !== '미정') {
            try {
              const startParts = startTime.split(':');
              const endParts = endTime.split(':');
              
              if (startParts.length === 2 && endParts.length === 2) {
                const startHour = Number(startParts[0]) || 0;
                const startMin = Number(startParts[1]) || 0;
                const endHour = Number(endParts[0]) || 0;
                const endMin = Number(endParts[1]) || 0;
                
                let startMinutes = startHour * 60 + startMin;
                let endMinutes = endHour * 60 + endMin;
                
                // 종료 시간이 시작 시간보다 작으면 다음날로 간주
                if (endMinutes < startMinutes) {
                  endMinutes += 24 * 60;
                }
                
                const diffMinutes = endMinutes - startMinutes;
                const hours = Math.floor(diffMinutes / 60);
                const minutes = diffMinutes % 60;
                
                if (minutes > 0) {
                  workHours = `${hours}시간 ${minutes}분`;
                } else {
                  workHours = `${hours}시간`;
                }
              } else {
                workHours = '계산 오류';
              }
            } catch {
              workHours = '계산 오류';
            }
          } else {
            workHours = '미정';
          }
          
          const role = (log as any).role || staff.role || '';
          
          return {
            date: dateStr,
            day: dayName,
            startTime,
            endTime,
            workHours,
            role
          };
        } catch (error) {
          console.error('Error processing work log:', error);
          return {
            date: '오류',
            day: '',
            startTime: '오류',
            endTime: '오류',
            workHours: '오류',
            role: ''
          };
        }
      });
    } catch (error) {
      console.error('Error processing work history:', error);
      return [];
    }
  }, [staff]);

  const getTotalAllowances = useCallback(() => {
    return allowances.meal + 
           allowances.transportation + 
           allowances.accommodation + 
           allowances.bonus + 
           allowances.other;
  }, [allowances]);

  const getTotalAmount = useCallback(() => {
    if (!staff) return 0;
    return staff.basePay + getTotalAllowances();
  }, [staff, getTotalAllowances]);

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {String(staff.staffName || '')} - 상세 편집
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 기본 정보 */}
        <div className="px-6 py-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-3">기본 정보</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">역할:</span>
              <span className="font-medium">{String(staff.role || '')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">근무일수:</span>
              <span className="font-medium">{String(staff.totalDays || 0)}일</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">근무시간:</span>
              <span className="font-medium">{String((staff.totalHours || 0).toFixed(1))}시간</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">기본급:</span>
              <span className="font-medium text-indigo-600">
                {formatCurrency(staff.basePay, 'KRW', 'ko')}
              </span>
            </div>
          </div>
        </div>

        {/* 날짜별 근무 내역 */}
        {workHistory.length > 0 ? (
          <div className="px-6 py-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-3">📅 근무 내역</h4>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {workHistory.map((history, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-2 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">
                      {String(history.date || '')}({String(history.day || '')})
                    </span>
                    {history.role && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {history.role}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">출근: </span>
                      <span className="text-gray-900 font-medium">{String(history.startTime || '미정')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">퇴근: </span>
                      <span className="text-gray-900 font-medium">{String(history.endTime || '미정')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">근무: </span>
                      <span className="text-gray-900 font-medium">{String(history.workHours || '미정')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-3">📅 근무 내역</h4>
            <div className="text-center py-4 text-sm text-gray-500">
              근무 내역이 없습니다.
            </div>
          </div>
        )}

        {/* 수당 설정 */}
        <div className="px-6 py-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">수당 설정</h4>
          <div className="space-y-3">
            {/* 식비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.meal > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleAmountChange('meal', '0');
                    } else if (allowances.meal === 0) {
                      handleAmountChange('meal', '50000');
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">식비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.meal}
                  onChange={(e) => handleAmountChange('meal', e.target.value)}
                  disabled={allowances.meal === 0}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>

            {/* 교통비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.transportation > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleAmountChange('transportation', '0');
                    } else if (allowances.transportation === 0) {
                      handleAmountChange('transportation', '30000');
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">교통비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.transportation}
                  onChange={(e) => handleAmountChange('transportation', e.target.value)}
                  disabled={allowances.transportation === 0}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>

            {/* 숙소비 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.accommodation > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleAmountChange('accommodation', '0');
                    } else if (allowances.accommodation === 0) {
                      handleAmountChange('accommodation', '100000');
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">숙소비</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.accommodation}
                  onChange={(e) => handleAmountChange('accommodation', e.target.value)}
                  disabled={allowances.accommodation === 0}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>

            {/* 보너스 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowances.bonus > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleAmountChange('bonus', '0');
                    } else if (allowances.bonus === 0) {
                      handleAmountChange('bonus', '100000');
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">보너스</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={allowances.bonus}
                  onChange={(e) => handleAmountChange('bonus', e.target.value)}
                  disabled={allowances.bonus === 0}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">원</span>
              </div>
            </div>

            {/* 기타 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allowances.other > 0}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        handleAmountChange('other', '0');
                        handleDescriptionChange('');
                      } else if (allowances.other === 0) {
                        handleAmountChange('other', '50000');
                      }
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">기타</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={allowances.other}
                    onChange={(e) => handleAmountChange('other', e.target.value)}
                    disabled={allowances.other === 0}
                    className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  />
                  <span className="text-sm text-gray-500">원</span>
                </div>
              </div>
              {allowances.other > 0 && (
                <input
                  type="text"
                  value={allowances.otherDescription || ''}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="기타 수당 설명 (예: 야간수당)"
                />
              )}
            </div>
          </div>
        </div>

        {/* 합계 */}
        <div className="px-6 py-4 bg-gray-50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">수당 합계:</span>
            <span className="font-medium">
              {formatCurrency(getTotalAllowances(), 'KRW', 'ko')}
            </span>
          </div>
          <div className="flex justify-between text-base">
            <span className="font-medium text-gray-700">총 지급액:</span>
            <span className="font-bold text-indigo-600">
              {formatCurrency(getTotalAmount(), 'KRW', 'ko')}
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailEditModal;