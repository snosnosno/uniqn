import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getTodayString } from '../../../utils/jobPosting/dateUtils';
import { parseTimeToString, calculateWorkHours } from '../../../utils/workLogMapper';
import { 
  FaInfoCircle,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle,
  FaTrash
} from '../../../components/Icons/ReactIconsReplacement';
import { ScheduleEvent } from '../../../types/schedule';
import { JobPosting } from '../../../types/jobPosting/jobPosting';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logger } from '../../../utils/logger';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { UnifiedWorkLog } from '../../../types/unified/workLog';

interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleEvent | null;
  onCheckOut?: (scheduleId: string) => void;
  onCancel?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
}

const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  isOpen: _isOpen,
  onClose,
  schedule,
  onCheckOut,
  onCancel,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'work' | 'calculation'>('basic');
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [_loadingJobPosting, setLoadingJobPosting] = useState(false);
  const [realTimeWorkLogs, setRealTimeWorkLogs] = useState<UnifiedWorkLog[]>([]);

  // JobPosting 데이터 조회
  useEffect(() => {
    const fetchJobPosting = async () => {
      if (!schedule?.eventId) {
        setJobPosting(null);
        return;
      }

      setLoadingJobPosting(true);
      try {
        const jobPostingDoc = await getDoc(doc(db, 'jobPostings', schedule.eventId));
        if (jobPostingDoc.exists()) {
          const jobPostingData = {
            id: jobPostingDoc.id,
            ...jobPostingDoc.data()
          } as JobPosting;
          setJobPosting(jobPostingData);
          
          logger.debug('ScheduleDetailModal - JobPosting 조회 성공', {
            component: 'ScheduleDetailModal',
            data: {
              eventId: schedule.eventId,
              title: jobPostingData.title,
              location: jobPostingData.location,
              detailedAddress: jobPostingData.detailedAddress,
              hasRoleSalaries: !!jobPostingData.roleSalaries
            }
          });
        } else {
          setJobPosting(null);
          logger.warn('ScheduleDetailModal - JobPosting 문서 없음', {
            component: 'ScheduleDetailModal',
            data: { eventId: schedule.eventId }
          });
        }
      } catch (error) {
        logger.error('ScheduleDetailModal - JobPosting 조회 실패:', error instanceof Error ? error : new Error(String(error)), {
          component: 'ScheduleDetailModal',
          data: { eventId: schedule.eventId }
        });
        setJobPosting(null);
      } finally {
        setLoadingJobPosting(false);
      }
    };

    fetchJobPosting();
  }, [schedule?.eventId]);

  // WorkLog 데이터 구독
  useEffect(() => {
    if (!schedule?.eventId) {
      setRealTimeWorkLogs([]);
      return;
    }

    const workLogsQuery = query(
      collection(db, 'workLogs'),
      where('eventId', '==', schedule.eventId)
    );

    const unsubscribe = onSnapshot(
      workLogsQuery,
      (snapshot) => {
        const workLogsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UnifiedWorkLog[];
        
        setRealTimeWorkLogs(workLogsData);
        
        logger.debug('ScheduleDetailModal - WorkLog 구독 업데이트', {
          component: 'ScheduleDetailModal',
          data: {
            eventId: schedule.eventId,
            workLogsCount: workLogsData.length
          }
        });
      },
      (error) => {
        logger.error('ScheduleDetailModal - WorkLog 구독 오류:', error instanceof Error ? error : new Error(String(error)), {
          component: 'ScheduleDetailModal',
          data: { eventId: schedule.eventId }
        });
      }
    );

    return () => unsubscribe();
  }, [schedule?.eventId]);

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

  // 통합 급여 계산 유틸리티 사용
  const getSalaryInfo = useCallback(async () => {
    if (!schedule) return { salaryType: 'hourly' as const, baseSalary: 10000, totalHours: 0, totalDays: 1, basePay: 0 };
    
    // UnifiedWorkLog 형태로 변환
    const workLogData = {
      id: schedule.id,
      scheduledStartTime: schedule.startTime,
      scheduledEndTime: schedule.endTime,
      date: schedule.date,
      role: schedule.role,
      eventId: schedule.eventId
    };

    const { calculateSingleWorkLogPayroll, calculateWorkHours } = await import('../../../utils/payrollCalculations');
    
    // 근무시간 계산
    const totalHours = calculateWorkHours(workLogData as any);
    
    // 급여 계산
    const totalPay = calculateSingleWorkLogPayroll(workLogData as any, schedule.role, jobPosting);
    
    // 급여 정보 추출 (기존 getSalaryInfo와 호환성을 위해)
    const { getRoleSalaryInfo } = await import('../../../utils/payrollCalculations');
    const { salaryType, salaryAmount } = getRoleSalaryInfo(schedule.role, jobPosting);

    logger.debug('ScheduleDetailModal - 급여 정보 계산', {
      component: 'ScheduleDetailModal',
      data: {
        role: schedule.role,
        salaryType,
        salaryAmount,
        totalHours,
        totalPay,
        hasJobPosting: !!jobPosting
      }
    });

    return {
      salaryType: salaryType as 'hourly' | 'daily' | 'monthly' | 'other',
      baseSalary: salaryAmount,
      totalHours,
      totalDays: 1, // 일정은 하루
      basePay: schedule.payrollAmount || totalPay
    };
  }, [schedule, jobPosting]);

  // 급여 정보 상태 관리
  const [salaryInfo, setSalaryInfo] = useState<{
    salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
    baseSalary: number;
    totalHours: number;
    totalDays: number;
    basePay: number;
  }>({
    salaryType: 'hourly',
    baseSalary: 10000,
    totalHours: 0,
    totalDays: 1,
    basePay: 0
  });

  // 급여 정보 업데이트
  useEffect(() => {
    const updateSalaryInfo = async () => {
      const info = await getSalaryInfo();
      setSalaryInfo(info);
    };
    updateSalaryInfo();
  }, [getSalaryInfo]);

  // WorkLog 조회 공통 함수
  const getTargetWorkLog = useCallback(() => {
    if (!schedule) return null;
    
    let targetWorkLog = null;
    
    if (schedule.sourceCollection === 'workLogs' && schedule.workLogId) {
      // workLogId가 있으면 직접 사용
      targetWorkLog = realTimeWorkLogs.find(log => log.id === schedule.workLogId);
    } else if (schedule.sourceCollection === 'workLogs' && schedule.sourceId) {
      // sourceId로 WorkLog 찾기
      targetWorkLog = realTimeWorkLogs.find(log => log.id === schedule.sourceId);
    }
    
    // WorkLog를 찾지 못했거나 applications에서 온 경우
    if (!targetWorkLog) {
      // eventId + date + role로 정확한 WorkLog 찾기
      targetWorkLog = realTimeWorkLogs.find(log => 
        log.eventId === schedule.eventId && 
        log.date === schedule.date &&
        log.role === schedule.role &&
        log.type === 'schedule'
      );
    }
    
    return targetWorkLog;
  }, [schedule, realTimeWorkLogs]);

  // 근무 내역 생성 - 공통 함수 사용
  const workHistory = useMemo(() => {
    if (!schedule) return [];
    
    // 1. 공통 함수로 WorkLog 찾기
    let targetWorkLog = getTargetWorkLog();
    
    // 여전히 찾지 못한 경우 기본 schedule 데이터 사용
    if (!targetWorkLog) {
      targetWorkLog = {
        id: schedule.id,
        staffId: schedule.sourceCollection === 'applications' ? '' : schedule.sourceId || '',
        staffName: '사용자',
        date: schedule.date,
        role: schedule.role,
        scheduledStartTime: schedule.startTime,
        scheduledEndTime: schedule.endTime,
        status: 'scheduled' as any,
        type: 'schedule',
        eventId: schedule.eventId
      };
    }
    
    // 2. WorkLog 존재 확인
    if (!targetWorkLog) {
      return [];
    }
    
    // 3. UI 표시용 형태로 변환
    const log = targetWorkLog;
    
    try {
      // 날짜 파싱
      let dateStr = '날짜 없음';
      let dayName = '';
      
      if (log.date) {
        const dateValue = new Date(log.date);
        if (!isNaN(dateValue.getTime())) {
          const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
          dayName = dayNames[dateValue.getDay()] || '';
          dateStr = `${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
        }
      }
      
      // 시간 파싱 - DetailEditModal과 동일한 parseTime 로직
      const parseTime = (timeValue: any): string => {
        const result = parseTimeToString(timeValue);
        return result || '미정';
      };

      // DetailEditModal과 동일: scheduledTime 우선 사용
      let startTime = '미정';
      let endTime = '미정';
      
      if (log.scheduledStartTime) {
        startTime = parseTime(log.scheduledStartTime);
      }
      if (log.scheduledEndTime) {
        endTime = parseTime(log.scheduledEndTime);
      }
      
      // 근무 시간 계산 - DetailEditModal과 동일한 calculateWorkHours 유틸 함수 사용
      let workHours = 0;
      try {
        workHours = calculateWorkHours(log as any);
      } catch (error) {
        logger.error('근무 시간 계산 오류:', error instanceof Error ? error : new Error(String(error)));
      }
      
      return [{
        date: dateStr,
        dayName,
        role: log.role || '',
        startTime,
        endTime,
        workHours: workHours.toFixed(1),
        status: log.status || 'not_started'
      }];
    } catch (error) {
      logger.error('근무 내역 파싱 오류:', error instanceof Error ? error : new Error(String(error)));
      return [{
        date: '오류',
        dayName: '',
        role: log.role || '',
        startTime: '미정',
        endTime: '미정',
        workHours: '0.0',
        status: 'not_started'
      }];
    }
  }, [schedule, getTargetWorkLog]);
  
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

  // formatTime은 이미 utils/dateUtils에서 import됨


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
  const canCheckOut = isToday && schedule.type === 'confirmed' && schedule.status === 'checked_in';
  
  // 삭제 가능한 일정인지 확인 (완료되지 않은 일정만)
  const canDelete = onDelete && 
    schedule.type !== 'completed' && 
    schedule.status !== 'checked_in' && // 이미 출근한 일정은 삭제 제한
    (schedule.sourceCollection === 'applications' || schedule.sourceCollection === 'workLogs');

  // 탭 정의
  const tabs = [
    { id: 'basic' as const, name: '정보', icon: '👤' },
    { id: 'work' as const, name: '근무', icon: '🕐' },
    { id: 'calculation' as const, name: '급여', icon: '💰' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/5 shadow-lg rounded-md bg-white">
        {/* 헤더 */}
        <div className="flex justify-between items-center pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-medium text-sm">
                {schedule?.eventName?.charAt(0) || 'S'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                일정 상세
              </h3>
              <p className="text-sm text-gray-500">{schedule?.role}</p>
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
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">기본 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">공고:</span>
                    <span className="text-sm text-gray-900">{schedule.eventName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">역할:</span>
                    <span className="text-sm text-gray-900">
                      {(() => {
                        const targetWorkLog = getTargetWorkLog();
                        // WorkLog의 역할 정보 우선 사용, 없으면 schedule 역할 사용
                        return targetWorkLog?.role || schedule.role || '미정';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">날짜:</span>
                    <span className="text-sm text-gray-900">{formatDate(schedule.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">장소:</span>
                    <span className="text-sm text-gray-900">
                      {(jobPosting?.location || schedule.location) || '미정'}
                    </span>
                  </div>
                  {(jobPosting?.detailedAddress || schedule.detailedAddress) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">상세주소:</span>
                      <span className="text-sm text-gray-900">
                        {jobPosting?.detailedAddress || schedule.detailedAddress}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">근무시간:</span>
                    <span className="text-sm text-gray-900">
                      {(() => {
                        const targetWorkLog = getTargetWorkLog();
                        
                        // WorkLog에서 스태프탭 설정 시간 우선 사용
                        if (targetWorkLog?.scheduledStartTime && targetWorkLog?.scheduledEndTime) {
                          const startTime = parseTimeToString(targetWorkLog.scheduledStartTime) || '미정';
                          const endTime = parseTimeToString(targetWorkLog.scheduledEndTime) || '미정';
                          return `${startTime} - ${endTime}`;
                        }
                        
                        // 스태프탭 설정이 없으면 기본 스케줄 시간 사용
                        return schedule.startTime && schedule.endTime 
                          ? `${parseTimeToString(schedule.startTime) || '미정'} - ${parseTimeToString(schedule.endTime) || '미정'}` 
                          : '미정';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">상태:</span>
                    <span className={`text-sm px-2 py-1 rounded-full ${typeDisplay.color}`}>
                      {typeDisplay.text}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">급여 정보</h4>
                <div className="space-y-2">
                  {/* 급여 설정 소스 표시 */}
                  {jobPosting?.useRoleSalary && jobPosting.roleSalaries?.[schedule.role] ? (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">설정:</span>
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">역할별 급여</span>
                    </div>
                  ) : jobPosting?.salaryType ? (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">설정:</span>
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">공고 기본급여</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">설정:</span>
                      <span className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">시스템 기본값</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">급여 유형:</span>
                    <span className="text-sm text-gray-900">{getSalaryTypeLabel(salaryInfo.salaryType)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">
                      {salaryInfo.salaryType === 'hourly' ? '시급:' : 
                       salaryInfo.salaryType === 'daily' ? '일급:' : 
                       salaryInfo.salaryType === 'monthly' ? '월급:' : '급여:'}
                    </span>
                    <span className="text-sm text-gray-900">
                      {salaryInfo.baseSalary.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">예상 기본급:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {salaryInfo.basePay.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  {schedule.payrollAmount && schedule.payrollAmount !== salaryInfo.basePay && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">정산 금액:</span>
                      <span className="text-sm font-medium text-indigo-600">
                        {schedule.payrollAmount.toLocaleString('ko-KR')}원
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">근무 요약</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">{salaryInfo.totalDays}</div>
                  <div className="text-xs text-gray-500">근무일수</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">{salaryInfo.totalHours.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">근무시간</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-indigo-600">
                    {(schedule.payrollAmount || (salaryInfo.totalHours * salaryInfo.baseSalary)).toLocaleString('ko-KR')}
                  </div>
                  <div className="text-xs text-gray-500">예상 지급액</div>
                </div>
              </div>
            </div>
            
            {/* 메모 */}
            {schedule.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">메모</h4>
                <p className="text-sm text-gray-600">{schedule.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* 근무 탭 */}
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
                              history.status === 'not_started' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {history.status === 'checked_out' ? '퇴근' :
                               history.status === 'checked_in' ? '출근' :
                               history.status === 'not_started' ? '예정' :
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
                      {getSalaryTypeLabel(salaryInfo.salaryType)} × {salaryInfo.salaryType === 'hourly' ? `${salaryInfo.totalHours.toFixed(1)}시간` : `${salaryInfo.totalDays}일`}
                    </span>
                    <span className="font-medium text-gray-900">
                      {salaryInfo.baseSalary.toLocaleString('ko-KR')}원 × {salaryInfo.salaryType === 'hourly' ? salaryInfo.totalHours.toFixed(1) : salaryInfo.totalDays}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="text-sm font-medium text-gray-700">기본급 합계</span>
                    <span className="text-base font-bold text-gray-900">
                      {(salaryInfo.totalHours * salaryInfo.baseSalary).toLocaleString('ko-KR')}원
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 수당 정보 (읽기 전용) */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">🎁 수당 정보</h4>
              <div className="space-y-3">
                {[
                  { name: '식비', amount: 0, description: '식사 지원' },
                  { name: '교통비', amount: 0, description: '교통 지원' },
                  { name: '숙소비', amount: 0, description: '숙박 지원' },
                  { name: '보너스', amount: 0, description: '성과급' }
                ].map((allowance, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-700">{allowance.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({allowance.description})</span>
                    </div>
                    <span className="text-sm text-gray-900">
                      {allowance.amount.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 총 계산 */}
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">기본급</span>
                  <span className="text-gray-900">
                    {(salaryInfo.totalHours * salaryInfo.baseSalary).toLocaleString('ko-KR')}원
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">수당 합계</span>
                  <span className="text-gray-900">0원</span>
                </div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between">
                  <span className="text-base font-medium text-gray-800">총 지급액</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {(schedule.payrollAmount || (salaryInfo.totalHours * salaryInfo.baseSalary)).toLocaleString('ko-KR')}원
                  </span>
                </div>
              </div>
            </div>

            {/* 계산 안내 */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FaInfoCircle className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-700">급여 계산 안내</p>
              </div>
              <p className="text-sm text-blue-600">
                예정 근무 시간을 기준으로 자동 계산된 예상 급여입니다.
                실제 지급 금액은 관리자 확인 후 결정됩니다.
              </p>
            </div>
          </div>
        )}
        </div>

        {/* 액션 버튼 */}
        <div className="mt-6 flex gap-3">
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
    </div>
  );
};

export default ScheduleDetailModal;