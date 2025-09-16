import { collection, query, doc, deleteField, updateDoc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { logger } from '../utils/logger';
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCalendarAlt, FaClock, FaUsers, FaTable, FaPlus, FaCog, FaTrash, FaExclamationTriangle, FaCheckCircle, FaInfoCircle } from '../components/Icons/ReactIconsReplacement';

import ShiftGridComponent from '../components/ShiftGridComponent';
import TimeIntervalSelector from '../components/time/TimeIntervalSelector';
import { useAuth } from '../contexts/AuthContext';
import { useUnifiedData } from '../hooks/useUnifiedData';
import { WorkLog } from '../types/unifiedData';
import { db } from '../firebase';
import { useShiftSchedule, ShiftDealer } from '../hooks/useShiftSchedule';
import useTables from '../hooks/useTables';
import { useToast } from '../hooks/useToast';

const ShiftSchedulePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  
  // 현재 선택된 날짜 상태
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const datePart = today.toISOString().split('T')[0];
    return datePart || ''; // YYYY-MM-DD 형식
  });
  
  // 임시 이벤트 ID (추후 이벤트 선택 기능으로 확장)
  const [selectedEventId] = useState<string>('default-event');
  
  // 🚀 WorkLog에서 스태프 데이터 가져오기 (persons 컬렉션 통합)
  const { state, loading: loadingState } = useUnifiedData();
  const workLogs = Array.from(state.workLogs.values());
  const workLogsLoading = loadingState.workLogs;
  const { tables, loading: tablesLoading } = useTables();
  
  // 교대 스케줄 데이터
  const { 
    schedule, 
    loading: scheduleLoading, 
    error: scheduleError,
    timeSlots,
    dealers,
    validationResult,
    createSchedule,
    updateDealerAssignment,
    addDealer,
    updateScheduleSettings,
    generateWorkLogs,
    checkWorkLogsExist
  } = useShiftSchedule(selectedEventId, selectedDate);
  
  // 🚀 WorkLog에서 스태프 데이터 처리 (중복 제거)
  const allStaff = useMemo(() => {
    if (!workLogs) return [];
    
    // WorkLog에서 고유한 스태프 정보만 추출
    const staffMap = new Map<string, ShiftDealer>();
    
    workLogs.forEach((workLog: WorkLog) => {
      const staffId = workLog.staffInfo?.userId || workLog.staffId;
      if (staffId && !staffMap.has(staffId)) {
        staffMap.set(staffId, {
          id: staffId,
          name: workLog.staffInfo?.name || workLog.staffName || '이름 없음',
          role: workLog.staffInfo?.jobRole?.[0] || workLog.role || '딜러',
          phone: workLog.staffInfo?.phone || '',
          email: workLog.staffInfo?.email || '',
          isActive: workLog.staffInfo?.isActive !== false, // 기본값 true
          type: 'staff'
        } as ShiftDealer);
      }
    });
    
    return Array.from(staffMap.values());
  }, [workLogs]);
  
  const availableDealers = useMemo(() =>
    (allStaff?.filter(s => Array.isArray(s.jobRole) && s.jobRole.includes('Dealer')) as ShiftDealer[] || []), 
    [allStaff]
  );
  
  // 스케줄에 이미 추가된 딜러들을 제외한 사용 가능한 딜러들
  const dealersNotInSchedule = useMemo(() => {
    if (!schedule) return availableDealers;
    const scheduledDealerIds = Object.keys(schedule.scheduleData);
    return availableDealers.filter(dealer => !scheduledDealerIds.includes(dealer.id));
  }, [availableDealers, schedule]);
  
  const loading = workLogsLoading || tablesLoading || scheduleLoading;
  
  // 근무기록 상태
  const [isGeneratingWorkLogs, setIsGeneratingWorkLogs] = useState(false);
  const [workLogsGenerated, setWorkLogsGenerated] = useState(false);
  
  // 설정 모달 상태
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  // 근무기록 생성 여부 확인
  useEffect(() => {
    const checkLogs = async () => {
      if (selectedEventId && selectedDate) {
        const exists = await checkWorkLogsExist();
        setWorkLogsGenerated(exists);
      }
    };
    checkLogs();
  }, [selectedEventId, selectedDate, checkWorkLogsExist]);

  // 설정 상태 추가
  const [settings, setSettings] = useState({
    autoSave: true,
    conflictNotifications: true,
    defaultWorkTime: 4, // 기본 근무 시간 (시간)
    defaultBreakTime: 30 // 기본 휴식 시간 (분)
  });

  // 설정 로드
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem('shiftScheduleSettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        logger.error('설정 로드 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'ShiftSchedulePage' });
      }
    };
    loadSettings();
  }, []);

  // 설정 저장 함수
  const handleSaveSettings = async () => {
    try {
      // 로컬 스토리지에 저장
      localStorage.setItem('shiftScheduleSettings', JSON.stringify(settings));
      
      // Firebase에 사용자 설정 저장 (선택적)
      if (currentUser) {
        const userSettingsRef = doc(db, 'userSettings', currentUser.uid);
        await setDoc(userSettingsRef, {
          shiftScheduleSettings: settings,
          updatedAt: new Date()
        }, { merge: true });
      }
      
      showSuccess(t('shiftSchedule.settingsSaved'));
      setIsSettingsModalOpen(false);
    } catch (error) {
      logger.error('설정 저장 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'ShiftSchedulePage' });
      showError(t('shiftSchedule.settingsSaveError'));
    }
  };

  // 설정 변경 핸들러
  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // 날짜 변경 핸들러
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };
  
  // 스태프 추가 핸들러
  const handleAddStaff = async (staffId: string, staffName: string) => {
    if (!schedule) return;
    
    try {
      await addDealer(staffId, staffName, schedule.startTime);
    } catch (error) {
      logger.error('Error adding dealer:', error instanceof Error ? error : new Error(String(error)), { component: 'ShiftSchedulePage' });
    }
  };
  
  // 스태프 제거 핸들러 (스케줄에서 모든 할당 제거)
  const handleRemoveStaff = async (staffId: string) => {
    if (!schedule) return;
    
    try {
      const scheduleId = `${selectedEventId}_${selectedDate}`;
      const scheduleRef = doc(db, 'shiftSchedules', scheduleId);
      await updateDoc(scheduleRef, {
        [`scheduleData.${staffId}`]: deleteField(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      logger.error('Error removing dealer:', error instanceof Error ? error : new Error(String(error)), { component: 'ShiftSchedulePage' });
    }
  };
  
  // 근무기록 생성 핸들러
  const handleGenerateWorkLogs = async () => {
    if (!schedule || !selectedEventId || !selectedDate) {
      showError('스케줄 정보가 없습니다.');
      return;
    }

    if (workLogsGenerated) {
      const confirmed = window.confirm('이미 근무기록이 생성되었습니다. 다시 생성하시겠습니까?');
      if (!confirmed) return;
    }

    setIsGeneratingWorkLogs(true);
    try {
      const logs = await generateWorkLogs();
      setWorkLogsGenerated(true);
      showSuccess(`${logs.length}개의 근무기록이 성공적으로 생성되었습니다.`);
    } catch (error) {
      logger.error('Error generating work logs:', error instanceof Error ? error : new Error(String(error)), { component: 'ShiftSchedulePage' });
      showError('근무기록 생성에 실패했습니다.');
    } finally {
      setIsGeneratingWorkLogs(false);
    }
  };
  
  // 사용자 확인 모달 (스태프 제거용)
  const confirmRemoveStaff = (staffId: string, staffName: string) => {
    if (window.confirm(t('shiftSchedule.confirmRemoveStaff', { staffName: staffName }))) {
      handleRemoveStaff(staffId);
    }
  };
  
  // 새 스케줄 생성 핸들러
  const handleCreateSchedule = async () => {
    try {
      await createSchedule(selectedEventId, selectedDate);
    } catch (error) {
      logger.error('Error creating schedule:', error instanceof Error ? error : new Error(String(error)), { component: 'ShiftSchedulePage' });
    }
  };
  
  // 시간 간격 변경 핸들러
  const handleIntervalChange = async (newInterval: number) => {
    if (!schedule) return;
    
    try {
      await updateScheduleSettings(newInterval);
    } catch (error) {
      logger.error('Error updating interval:', error instanceof Error ? error : new Error(String(error)), { component: 'ShiftSchedulePage' });
    }
  };
  
  // 날짜 포맷팅
  const formatDate = (dateInput: any) => {
    if (!dateInput) return '';
    
    try {
      let date: Date;
      
      // Handle Firebase Timestamp object
      if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
        // Firebase Timestamp object
        date = new Date(dateInput.seconds * 1000);
      } else if (dateInput instanceof Date) {
        // Already a Date object
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        // String date
        date = new Date(dateInput);
      } else {
        logger.warn('Unknown date format:', { component: 'ShiftSchedulePage', data: dateInput });
        return String(dateInput); // Convert to string as fallback
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        logger.warn('Invalid date:', { component: 'ShiftSchedulePage', data: dateInput });
        return String(dateInput); // Convert to string as fallback
      }
      
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('ko-KR', options);
    } catch (error) {
      logger.error('Error formatting date:', error instanceof Error ? error : new Error(String(error)), { component: 'ShiftSchedulePage', data: { dateInput } });
      return String(dateInput); // Convert to string as fallback
    }
  };
  
  // 검증 결과 컴포넌트
  const ValidationSummary = () => {
    if (!validationResult) return null;

    const errorCount = validationResult.violations.filter(v => v.severity === 'error').length;
    const warningCount = validationResult.violations.filter(v => v.severity === 'warning').length;
    const infoCount = validationResult.violations.filter(v => v.severity === 'info').length;

    return (
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <FaCheckCircle className="w-5 h-5 mr-2 text-blue-600" />
          {t('shiftSchedule.validationResults')}
        </h3>
        
        <div className="flex items-center gap-4 mb-3">
          {errorCount > 0 && (
            <div className="flex items-center text-red-600">
              <FaExclamationTriangle className="w-4 h-4 mr-1" />
              <span className="font-semibold">{errorCount}{t('shiftSchedule.errors')}</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center text-yellow-600">
              <FaExclamationTriangle className="w-4 h-4 mr-1" />
              <span className="font-semibold">{warningCount}{t('shiftSchedule.warnings')}</span>
            </div>
          )}
          {infoCount > 0 && (
            <div className="flex items-center text-blue-600">
              <FaInfoCircle className="w-4 h-4 mr-1" />
              <span className="font-semibold">{infoCount}{t('shiftSchedule.infos')}</span>
            </div>
          )}
          {validationResult.violations.length === 0 && (
            <div className="flex items-center text-green-600">
              <FaCheckCircle className="w-4 h-4 mr-1" />
              <span className="font-semibold">{t('shiftSchedule.validationPassed')}</span>
            </div>
          )}
        </div>

        {validationResult.violations.length > 0 && (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {validationResult.violations.map((violation, index) => (
              <div key={index} className={`text-sm p-2 rounded ${
                violation.severity === 'error' ? 'bg-red-50 text-red-700' :
                violation.severity === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                'bg-blue-50 text-blue-700'
              }`}>
                <span className="font-medium">{violation.type}:</span> {violation.message}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('shiftSchedule.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 헤더 섹션 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {t('shiftSchedule.title')}
        </h1>
        <p className="text-gray-600">{t('shiftSchedule.subtitle')}</p>
      </div>

      {/* 날짜 선택 및 컨트롤 바 */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* 날짜 선택 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <label className="text-sm sm:text-base font-semibold text-gray-700">
                {t('shiftSchedule.selectDate')}:
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">({formatDate(selectedDate)})</span>
            </div>
          </div>
          
          {/* 시간 간격 선택 */}
          {schedule ? <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FaClock className="w-5 h-5 text-purple-600" />
                <label className="font-semibold text-gray-700">
                  {t('shiftSchedule.timeInterval')}:
                </label>
              </div>
              <div className="w-64">
                <TimeIntervalSelector
                  selectedInterval={schedule.timeInterval}
                  onIntervalChange={handleIntervalChange}
                  size="sm"
                />
              </div>
            </div> : null}
          
          {/* 컨트롤 버튼들 */}
          <div className="flex flex-wrap items-center gap-2">
            {schedule && dealers.length > 0 ? <button 
                onClick={handleGenerateWorkLogs}
                disabled={isGeneratingWorkLogs}
                className={`btn btn-xs sm:btn-sm flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                  workLogsGenerated ? 'btn-outline' : 'btn-secondary'
                } ${isGeneratingWorkLogs ? 'loading' : ''}`}
              >
                <FaClock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">
                  {isGeneratingWorkLogs ? t('shiftSchedule.generating') : 
                   workLogsGenerated ? t('shiftSchedule.regenerateWorkLogs') : t('shiftSchedule.generateWorkLogs')}
                </span>
                <span className="sm:hidden">
                  {isGeneratingWorkLogs ? '생성중' : 
                   workLogsGenerated ? '재생성' : '생성'}
                </span>
              </button> : null}
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="btn btn-outline btn-xs sm:btn-sm flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <FaCog className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('shiftSchedule.settings')}</span>
              <span className="sm:hidden">설정</span>
            </button>
            {!schedule && (
              <button 
                onClick={handleCreateSchedule}
                className="btn btn-primary btn-xs sm:btn-sm flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              >
                <FaPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{t('shiftSchedule.createSchedule')}</span>
                <span className="sm:hidden">생성</span>
              </button>
            )}
          </div>
        </div>
        
        {/* 근무기록 상태 표시 */}
        {schedule ? <div className="mt-3 p-2 rounded-md">
            {workLogsGenerated ? (
              <div className="flex items-center gap-2 text-green-600">
                <FaCheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{t('shiftSchedule.workLogsGenerated')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <FaClock className="w-4 h-4" />
                <span className="text-sm font-medium">{t('shiftSchedule.workLogsNotGenerated')}</span>
              </div>
            )}
          </div> : null}
      </div>

      {/* 검증 결과 */}
      {schedule ? <ValidationSummary /> : null}

      {/* 메인 콘텐츠 영역 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* 스케줄 그리드 영역 (3/4) */}
        <div className="xl:col-span-3">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-blue-600 flex items-center">
              <FaTable className="w-5 h-5 mr-2"/> 
              {t('shiftSchedule.scheduleGrid')}
              {schedule ? <span className="ml-2 text-sm font-normal text-gray-500">
                  ({schedule.timeInterval}{t('shiftSchedule.minuteInterval')})
                </span> : null}
            </h2>
            
            {schedule ? (
              <div className="space-y-4">
                {/* 시간 슬롯 정보 */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <FaClock className="w-4 h-4" />
                    <span>{schedule.startTime} - {schedule.endTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FaUsers className="w-4 h-4" />
                    <span>{dealers.length}{t('shiftSchedule.assignedDealer')}</span>
                  </div>
                </div>
                
                {/* 엑셀형 교대 스케줄 그리드 */}
                <ShiftGridComponent
                  dealers={dealers}
                  tables={tables}
                  timeSlots={timeSlots}
                  onCellChange={updateDealerAssignment}
                  readonly={false}
                  height={500}
                />
              </div>
            ) : (
              <div className="text-center py-12">
                <FaCalendarAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  {t('shiftSchedule.noSchedule')}
                </h3>
                <p className="text-gray-500 mb-4">
                  {formatDate(selectedDate)} {t('shiftSchedule.noScheduleMessage')}
                </p>
                <button 
                  onClick={handleCreateSchedule}
                  className="btn btn-primary flex items-center gap-2 mx-auto"
                >
                  <FaPlus className="w-4 h-4" />
                  {t('shiftSchedule.createSchedule')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 사이드바 - 딜러 목록 및 정보 (1/4) */}
        <div className="space-y-6">
          {/* 현재 스케줄의 딜러들 */}
          {schedule && dealers.length > 0 ? <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-blue-600 flex items-center">
                <FaUsers className="w-5 h-5 mr-2"/> 
                {t('shiftSchedule.assignedDealers')} ({dealers.length})
              </h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {dealers.map(dealer => (
                  <div key={dealer.id} className="flex items-center bg-blue-50 p-3 rounded-lg shadow-sm">
                    <div className="w-8 h-8 bg-blue-300 rounded-full flex items-center justify-center mr-3">
                      <span className="text-sm font-semibold text-blue-700">
                        {dealer.staffName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{dealer.staffName}</p>
                      <p className="text-sm text-gray-500">{t('shiftSchedule.startTime')}: {dealer.startTime}</p>
                    </div>
                    <button 
                      onClick={() => confirmRemoveStaff(dealer.id, dealer.staffName)}
                      className="btn btn-sm btn-outline btn-error"
                      title={t('shiftSchedule.removeFromSchedule')}
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div> : null}

          {/* 사용 가능한 딜러 */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-green-600 flex items-center">
              <FaUsers className="w-5 h-5 mr-2"/> 
              {t('shiftSchedule.availableDealers')} ({dealersNotInSchedule.length})
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {dealersNotInSchedule.map(dealer => (
                <div key={dealer.id} className="flex items-center bg-gray-50 p-3 rounded-lg shadow-sm">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-semibold text-gray-600">
                      {dealer.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{dealer.name}</p>
                    <p className="text-sm text-gray-500">{Array.isArray(dealer.jobRole) ? dealer.jobRole.join(', ') : ''}</p>
                  </div>
                  {schedule ? <button 
                      onClick={() => handleAddStaff(dealer.id, dealer.name)}
                      className="btn btn-sm btn-outline btn-success"
                    >
                      <FaPlus className="w-3 h-3 mr-1" />
                      {t('shiftSchedule.addToSchedule')}
                    </button> : null}
                </div>
              ))}
              {dealersNotInSchedule.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  {schedule ? t('shiftSchedule.allDealersAssigned') : t('shiftSchedule.noDealersAvailable')}
                </p>
              )}
            </div>
          </div>

          {/* 테이블 정보 */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-purple-600 flex items-center">
              <FaTable className="w-5 h-5 mr-2"/> 
              {t('shiftSchedule.availableTables')} ({tables?.length || 0})
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tables?.map(table => (
                <div key={table.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium text-gray-700">
                    Table {table.tableNumber}
                  </span>
                  <span className="text-sm text-gray-500">
                    {table.status || 'open'}
                  </span>
                </div>
              ))}
              {(!tables || tables.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">
                  {t('shiftSchedule.noTablesAvailable')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 에러 표시 */}
      {scheduleError ? <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">
            {t('shiftSchedule.error')}: {scheduleError.message}
          </p>
        </div> : null}
    </div>
    
    {/* 설정 모달 */}
    {isSettingsModalOpen ? <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">{t('shiftSchedule.settings')}</h3>
            <button 
              onClick={() => setIsSettingsModalOpen(false)}
              className="btn btn-sm btn-circle"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('shiftSchedule.defaultWorkTimeSettings')}
              </label>
              <div className="text-sm text-gray-600">
                새로운 스케줄 생성 시 사용되는 기본 시간 설정입니다.
              </div>
              </div>
              
              <div>
              <label className="block text-sm font-medium mb-2">
                {t('shiftSchedule.autoSaveSettings')}
              </label>
              <label className="cursor-pointer label">
                <span className="label-text text-sm">{t('shiftSchedule.autoSaveChanges')}</span>
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-sm" 
                  checked={settings.autoSave}
                  onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                />
              </label>
              </div>
              
              <div>
              <label className="block text-sm font-medium mb-2">
                {t('shiftSchedule.notificationSettings')}
              </label>
              <label className="cursor-pointer label">
                <span className="label-text text-sm">{t('shiftSchedule.conflictNotifications')}</span>
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-sm" 
                  checked={settings.conflictNotifications}
                  onChange={(e) => handleSettingChange('conflictNotifications', e.target.checked)}
                />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('shiftSchedule.defaultWorkTime')} (시간)
              </label>
              <input 
                type="number" 
                className="input input-bordered w-full" 
                min="1" 
                max="12"
                value={settings.defaultWorkTime}
                onChange={(e) => handleSettingChange('defaultWorkTime', parseInt(e.target.value) || 4)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('shiftSchedule.defaultBreakTime')} (분)
              </label>
              <input 
                type="number" 
                className="input input-bordered w-full" 
                min="0" 
                max="120"
                value={settings.defaultBreakTime}
                onChange={(e) => handleSettingChange('defaultBreakTime', parseInt(e.target.value) || 30)}
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-6">
            <button 
              onClick={() => setIsSettingsModalOpen(false)}
              className="btn btn-outline flex-1"
            >
              {t('shiftSchedule.cancel')}
            </button>
            <button 
              onClick={handleSaveSettings}
              className="btn btn-primary flex-1"
            >
              {t('shiftSchedule.save')}
            </button>
          </div>
        </div>
      </div> : null}
    </>
  );
};

export default ShiftSchedulePage;