import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { EnhancedPayrollCalculation, AllowanceType } from '../../types/payroll';
import { formatCurrency } from '../../i18n-helpers';
import { logger } from '../../utils/logger';
import { calculateWorkHours, parseTimeToString } from '../../utils/workLogMapper';
import { getStaffIdentifier, matchStaffIdentifier } from '../../utils/staffIdMapper';
import { findTargetWorkLog, filterWorkLogsByRole, normalizeRole } from '../../utils/workLogHelpers';

import { UnifiedWorkLog } from '../../types/unified/workLog';

interface DetailEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: EnhancedPayrollCalculation | null;
  workLogs: UnifiedWorkLog[];  // props로 workLogs 받기
  onSave: (staff: EnhancedPayrollCalculation, allowances: EnhancedPayrollCalculation['allowances']) => void;
}

const DetailEditModal: React.FC<DetailEditModalProps> = ({
  isOpen,
  onClose,
  staff,
  workLogs,  // props로 받은 workLogs 사용
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

  // 탭 상태 관리
  const [activeTab, setActiveTab] = useState<'basic' | 'work' | 'calculation'>('basic');

  // props로 받은 workLogs를 사용 (중복 구독 방지)
  const realTimeWorkLogs = workLogs;

  // 탭 정의
  const tabs = [
    { id: 'basic' as const, name: '정보', icon: '👤' },
    { id: 'work' as const, name: '근무', icon: '🕐' },
    { id: 'calculation' as const, name: '급여', icon: '💰' }
  ];

  // staff 데이터가 변경될 때 allowances 초기화
  useEffect(() => {
    if (staff) {
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

  // 역할 추론 함수 제거 - 정확한 역할 정보만 사용

  // getTargetWorkLog 패턴 적용 - ScheduleDetailModal 참고
  const getTargetWorkLog = useCallback((date: string) => {
    if (!staff) return null;
    
    const staffId = getStaffIdentifier(staff);
    
    // 1. 우선 정확한 조건으로 WorkLog 찾기
    let targetWorkLog = findTargetWorkLog(realTimeWorkLogs, {
      staffId,
      date,
      role: staff.role
    });
    
    // 2. 못찾으면 role 없이 찾기
    if (!targetWorkLog) {
      targetWorkLog = findTargetWorkLog(realTimeWorkLogs, {
        staffId,
        date
      });
    }
    
    return targetWorkLog;
  }, [staff, realTimeWorkLogs]);

  // 날짜별 근무 내역 계산 - getTargetWorkLog 패턴 사용
  const workHistory = useMemo(() => {
    if (!staff) return [];
    
    const staffId = getStaffIdentifier(staff);
    
    // 1. 스태프의 모든 WorkLog 가져오기
    const allStaffWorkLogs = realTimeWorkLogs.filter(log => {
      const matches = matchStaffIdentifier(log, [staffId]);
      return matches;
    });
    
    // 2. filterWorkLogsByRole 유틸리티 사용
    const staffRoleWorkLogs = filterWorkLogsByRole(allStaffWorkLogs, staff.role);

    // 3. 날짜별로 그룹화하여 중복 제거 (기존 로직 유지)
    const mergedLogsMap = new Map<string, any>();
    
    staffRoleWorkLogs.forEach(log => {
      const key = `${log.date}`;
      
      if (!mergedLogsMap.has(key)) {
        // 새로운 날짜인 경우 추가
        mergedLogsMap.set(key, { ...log, role: log.role || staff.role });
      } else {
        // 기존 데이터가 있는 경우 병합 (더 완전한 데이터 우선)
        const existingLog = mergedLogsMap.get(key);
        mergedLogsMap.set(key, {
          ...existingLog,
          // 실제 시간 정보가 있으면 우선 사용
          actualStartTime: log.actualStartTime || existingLog.actualStartTime,
          actualEndTime: log.actualEndTime || existingLog.actualEndTime,
          // 예정 시간 정보 우선순위: 더 완전한 데이터
          scheduledStartTime: log.scheduledStartTime || existingLog.scheduledStartTime,
          scheduledEndTime: log.scheduledEndTime || existingLog.scheduledEndTime,
          // 상태 정보 (더 진행된 상태 우선)
          status: log.status || existingLog.status,
          // 기타 정보 병합 (타입 안전성을 위해 any로 캐스팅)
          timeSlot: (log as any).timeSlot || (existingLog as any).timeSlot,
          assignedTime: (log as any).assignedTime || (existingLog as any).assignedTime
        });
      }
    });
    
    const uniqueWorkLogs = Array.from(mergedLogsMap.values());
    
    if (uniqueWorkLogs.length === 0) return [];
    
    try {
      // 실시간 WorkLogs를 날짜별로 정렬
      const sortedLogs = [...uniqueWorkLogs].sort((a, b) => {
        const getDateValue = (date: string | Date | { seconds: number } | null | undefined) => {
          if (!date) return 0;
          try {
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
          // 날짜 파싱
          let dateStr = '날짜 없음';
          let dayName = '';
          
          if (log.date) {
            let dateValue: Date | null = null;
            const logDate = log.date as any;
            
            if (typeof logDate === 'object' && 'seconds' in logDate) {
              dateValue = new Date(logDate.seconds * 1000);
            } else if (typeof logDate === 'string') {
              dateValue = new Date(logDate);
            } else if (logDate instanceof Date) {
              dateValue = logDate;
            }
            
            if (dateValue && !isNaN(dateValue.getTime())) {
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              dayName = dayNames[dateValue.getDay()] || '';
              dateStr = `${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
            }
          }
          
          // 시간 데이터 파싱 - workLogMapper의 함수 사용
          const parseTime = (timeValue: string | Date | { seconds: number } | null | undefined): string => {
            const result = parseTimeToString(timeValue);
            
            if (result) {
              return result;
            }
            
            return '미정';
          };

          // 정산 목적: scheduledStartTime/scheduledEndTime (스태프탭 설정)만 사용
          // 실제 시간으로 폴백하지 않음 - 정산은 스케줄된 시간 기준
          let startTime = '미정';
          let endTime = '미정';
          
          // scheduledTime이 있으면 사용
          if (log.scheduledStartTime) {
            startTime = parseTime(log.scheduledStartTime);
          }
          if (log.scheduledEndTime) {
            endTime = parseTime(log.scheduledEndTime);
          }
          
          // timeSlot 필드에서 직접 파싱 (백업)
          if ((startTime === '미정' || endTime === '미정') && (log as any).timeSlot) {
            const timeSlot = (log as any).timeSlot;
            if (timeSlot && timeSlot !== '미정' && timeSlot.includes('-')) {
              const parts = timeSlot.split('-').map((t: string) => t.trim());
              if (parts[0] && startTime === '미정') {
                startTime = parts[0];
              }
              if (parts[1] && endTime === '미정') {
                endTime = parts[1];
              }
            }
          }
          
          // assignedTime이 있으면 변환해서 사용 (최종 백업)
          if ((startTime === '미정' || endTime === '미정') && (log as any).assignedTime) {
            const assignedTime = (log as any).assignedTime;
            if (assignedTime && assignedTime.includes('-')) {
              const parts = assignedTime.split('-').map((t: string) => t.trim());
              if (parts[0] && startTime === '미정') startTime = parts[0];
              if (parts[1] && endTime === '미정') endTime = parts[1];
            }
          }
          
          // 근무 시간 계산 - calculateWorkHours 함수 사용
          let workHours = 0;
          try {
            workHours = calculateWorkHours(log);
          } catch (error) {
            logger.error('근무 시간 계산 오류', error instanceof Error ? error : new Error(String(error)), { 
              component: 'DetailEditModal',
              data: { logId: log.id }
            });
            // 백업 계산 로직
            if (startTime !== '미정' && endTime !== '미정') {
              const parseTimeToMinutes = (timeStr: string): number => {
                const parts = timeStr.split(':').map(Number);
                const hours = parts[0] || 0;
                const minutes = parts[1] || 0;
                return hours * 60 + minutes;
              };
              
              const startMinutes = parseTimeToMinutes(startTime);
              const endMinutes = parseTimeToMinutes(endTime);
              
              let totalMinutes = endMinutes - startMinutes;
              if (totalMinutes < 0) {
                totalMinutes += 24 * 60;
              }
              
              workHours = totalMinutes / 60;
            }
          }
          
          // 상태 결정 로직 개선
          let displayStatus = log.status || 'scheduled';
          
          // 시간정보가 없는 경우의 상태 처리
          if ((startTime === '미정' || endTime === '미정') && !log.actualStartTime && !log.actualEndTime) {
            displayStatus = 'scheduled'; // 예정 상태
          }
          
          // 실제 출퇴근 데이터가 있는 경우 상태 우선
          if (log.actualStartTime || log.actualEndTime || log.status === 'checked_out' || log.status === 'checked_in') {
            displayStatus = log.status || 'checked_in';
          }
          
          return {
            date: dateStr,
            dayName,
            role: log.role || staff.role,  // 역할 정보 (정확한 역할 사용)
            startTime,
            endTime,
            workHours: workHours.toFixed(1),
            status: displayStatus,
            rawLog: log,
            // 추가 정보
            hasTimeInfo: startTime !== '미정' && endTime !== '미정',
            hasActualTime: !!(log.actualStartTime || log.actualEndTime)
          };
        } catch (error) {
          logger.error('근무 내역 파싱 오류', error instanceof Error ? error : new Error(String(error)), { component: 'DetailEditModal' });
          return {
            date: '파싱 오류',
            dayName: '',
            startTime: '오류',
            endTime: '오류',
            workHours: '0.0',
            status: '오류',
            rawLog: log
          };
        }
      });
    } catch (error) {
      logger.error('근무 내역 전체 파싱 오류', error instanceof Error ? error : new Error(String(error)), { component: 'DetailEditModal' });
      return [];
    }
  }, [staff, realTimeWorkLogs]);

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

  // 급여 유형 한글 라벨
  const getSalaryTypeLabel = useCallback((type: string) => {
    const labels: Record<string, string> = {
      hourly: '시급',
      daily: '일급',
      monthly: '월급',
      other: '기타'
    };
    return labels[type] || type;
  }, []);

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/5 shadow-lg rounded-md bg-white">
        {/* 헤더 */}
        <div className="flex justify-between items-center pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-medium text-sm">
                {staff.staffName.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {staff.staffName} 정산 상세
              </h3>
              <p className="text-sm text-gray-500">{staff.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex space-x-1 mt-4 bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="mt-6 min-h-96">
          {/* 기본정보 탭 */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">기본 정보</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">이름:</span>
                      <span className="text-sm text-gray-900">{staff.staffName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">역할:</span>
                      <span className="text-sm text-gray-900">{staff.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">연락처:</span>
                      <span className="text-sm text-gray-900">{staff.phone || '미등록'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">급여 정보</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">급여 유형:</span>
                      <span className="text-sm text-gray-900">{getSalaryTypeLabel(staff.salaryType)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">기본 급여:</span>
                      <span className="text-sm text-gray-900">
                        {staff.baseSalary.toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">기본급:</span>
                      <span className="text-sm text-gray-900">
                        {staff.basePay.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">근무 요약</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gray-900">{staff.totalDays}</div>
                    <div className="text-xs text-gray-500">근무일수</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gray-900">{staff.totalHours.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">근무시간</div>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-indigo-600">
                      {staff.totalAmount.toLocaleString('ko-KR')}
                    </div>
                    <div className="text-xs text-gray-500">총 지급액</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 근무내역 탭 */}
          {activeTab === 'work' && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-4">📅 근무 내역</h4>
              {workHistory.length > 0 ? (
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            날짜
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            역할
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            시작시간
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            종료시간
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            근무시간
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            상태
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {workHistory.map((history, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center gap-2">
                                <span>{history.date}</span>
                                <span className="text-xs text-gray-500">({history.dayName})</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                history.role === 'floor' ? 'bg-purple-100 text-purple-800' :
                                history.role === 'dealer' ? 'bg-blue-100 text-blue-800' :
                                history.role === 'manager' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {history.role === 'floor' ? 'floor' :
                                 history.role === 'dealer' ? 'dealer' :
                                 history.role === 'manager' ? 'manager' :
                                 history.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {history.startTime}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {history.endTime}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                              {history.workHours}시간
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                history.status === 'checked_out' ? 'bg-green-100 text-green-800' :
                                history.status === 'checked_in' ? 'bg-blue-100 text-blue-800' :
                                history.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                                history.status === 'absent' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {history.status === 'checked_out' ? '퇴근' :
                                 history.status === 'checked_in' ? '출근' :
                                 history.status === 'scheduled' ? '예정' :
                                 history.status === 'absent' ? '결석' :
                                 history.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 총 근무시간 합계 */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">총 근무시간</span>
                      <span className="text-lg font-bold text-blue-600">
                        {workHistory.reduce((sum, h) => sum + parseFloat(h.workHours), 0).toFixed(1)}시간
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      총 {workHistory.length}일 근무
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="text-sm">근무 내역이 없습니다.</p>
                </div>
              )}
              
            </div>
          )}

          {/* 급여계산 탭 */}
          {activeTab === 'calculation' && (
            <div className="space-y-6">
              {/* 기본급 계산 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">💰 기본급 계산</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {getSalaryTypeLabel(staff.salaryType)} × {staff.salaryType === 'hourly' ? `${staff.totalHours.toFixed(1)}시간` : `${staff.totalDays}일`}
                      </span>
                      <span className="font-medium text-gray-900">
                        {staff.baseSalary.toLocaleString('ko-KR')} × {staff.salaryType === 'hourly' ? staff.totalHours.toFixed(1) : staff.totalDays}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="text-sm font-medium text-gray-700">기본급 합계</span>
                      <span className="text-base font-bold text-gray-900">
                        {staff.basePay.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 수당 설정 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">🎁 수당 설정</h4>
                <div className="space-y-3">
                  {/* 식비 */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={allowances.meal > 0}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            handleAmountChange('meal', '0');
                          } else if (allowances.meal === 0) {
                            handleAmountChange('meal', '10000');
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
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={allowances.transportation > 0}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            handleAmountChange('transportation', '0');
                          } else if (allowances.transportation === 0) {
                            handleAmountChange('transportation', '5000');
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
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={allowances.accommodation > 0}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            handleAmountChange('accommodation', '0');
                          } else if (allowances.accommodation === 0) {
                            handleAmountChange('accommodation', '50000');
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
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={allowances.bonus > 0}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            handleAmountChange('bonus', '0');
                          } else if (allowances.bonus === 0) {
                            handleAmountChange('bonus', '50000');
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
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={allowances.other > 0}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            handleAmountChange('other', '0');
                            handleDescriptionChange('');
                          } else if (allowances.other === 0) {
                            handleAmountChange('other', '10000');
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">기타</span>
                    </label>
                    {allowances.other > 0 && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={allowances.otherDescription}
                          onChange={(e) => handleDescriptionChange(e.target.value)}
                          placeholder="기타 수당 설명"
                          className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={allowances.other}
                            onChange={(e) => handleAmountChange('other', e.target.value)}
                            className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <span className="text-sm text-gray-500">원</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 총 계산 */}
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">기본급</span>
                    <span className="text-gray-900">
                      {formatCurrency(staff.basePay, 'KRW', 'ko')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">수당 합계</span>
                    <span className="text-gray-900">
                      {getTotalAllowances().toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="border-t border-indigo-200 pt-2 flex justify-between">
                    <span className="text-base font-medium text-gray-800">총 지급액</span>
                    <span className="text-lg font-bold text-indigo-600">
                      {getTotalAmount().toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-3 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            수당 저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailEditModal;