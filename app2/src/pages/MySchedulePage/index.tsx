import React, { useState, useEffect } from 'react';
// import { useTranslation } from 'react-i18next'; // not used
import { 
  FaCalendarAlt, 
  FaSync,
  FaCamera,
  FaList,
  FaClock,
  FaMapMarkerAlt,
  FaInfoCircle,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useScheduleData } from '../../hooks/useScheduleData';
import { CalendarView, ScheduleEvent, ATTENDANCE_STATUS_COLORS } from '../../types/schedule';
import { getTodayString } from '../../utils/jobPosting/dateUtils';

// 스타일 임포트
import './MySchedulePage.css';

// 컴포넌트 임포트
import ScheduleCalendar from './components/ScheduleCalendar';
import ScheduleDetailModal from './components/ScheduleDetailModal';
import ScheduleFilters from './components/ScheduleFilters';
import ScheduleStats from './components/ScheduleStats';
import QRScannerModal from '../../components/QRScannerModal';
import LoadingSpinner from '../../components/LoadingSpinner';

// Firebase 함수
import { doc, updateDoc, deleteDoc, Timestamp, collection, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const MySchedulePage: React.FC = () => {
  // const { t } = useTranslation(); // not used
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 시간 포맷팅 함수
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

  // 상태 아이콘 렌더링
  const renderStatusIcon = (event: ScheduleEvent) => {
    switch (event.type) {
      case 'applied':
        return <FaHourglassHalf className="text-yellow-500" />;
      case 'confirmed':
        return <FaCheckCircle className="text-green-500" />;
      case 'completed':
        return <FaCheckCircle className="text-blue-500" />;
      case 'cancelled':
        return <FaTimesCircle className="text-red-500" />;
      default:
        return null;
    }
  };

  // 캘린더 뷰 상태
  const [calendarView, setCalendarView] = useState<CalendarView>('dayGridMonth');
  
  // 뷰 모드 상태 (모바일에서 사용)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  
  // 모달 상태
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [pendingCheckInSchedule, setPendingCheckInSchedule] = useState<ScheduleEvent | null>(null);
  
  // 데이터 가져오기
  const {
    schedules,
    loading,
    error,
    stats,
    filters,
    setFilters,
    refreshData
  } = useScheduleData();
  
  // 스케줄 데이터 디버깅
  useEffect(() => {
    console.log('\n🎯 ========== MySchedulePage 렌더링 ==========');
    console.log('현재 스케줄 수:', schedules.length);
    console.log('로딩 상태:', loading);
    console.log('에러:', error);
    console.log('필터:', filters);
    console.log('통계:', stats);
    
    if (schedules.length > 0) {
      console.log('스케줄 샘플:');
      schedules.slice(0, 3).forEach((schedule, index) => {
        console.log(`  [${index}]`, {
          id: schedule.id,
          date: schedule.date,
          eventName: schedule.eventName,
          type: schedule.type,
          status: schedule.status
        });
      });
    }
    console.log('========================================\n');
  }, [schedules, loading, error, filters, stats]);

  // 이벤트 클릭 핸들러
  const handleEventClick = (event: ScheduleEvent) => {
    setSelectedSchedule(event);
    setIsDetailModalOpen(true);
  };

  // 출근하기 버튼 클릭 (QR 스캐너 열기)
  const handleCheckInClick = (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      showError('일정 정보를 찾을 수 없습니다.');
      return;
    }
    
    setPendingCheckInSchedule(schedule);
    setIsQRScannerOpen(true);
    console.log('🔍 QR 스캐너 열기 - 출근 대기:', scheduleId);
  };

  // 실제 출근 처리 (QR 스캔 완료 후 실행)
  const processCheckIn = async (schedule: ScheduleEvent) => {
    try {
      let workLogId = schedule.workLogId;
      
      // 🔥 workLogId가 없는 경우 자동 생성 (applications → workLogs 변환)
      if (!workLogId && schedule.sourceCollection === 'applications') {
        console.log('🏗️ 확정된 지원서에 대한 workLog 자동 생성:', schedule.eventName);
        
        // 새 workLog 문서 생성
        const newWorkLogRef = doc(collection(db, 'workLogs'));
        await setDoc(newWorkLogRef, {
          // 기본 정보
          dealerId: currentUser?.uid,
          staffId: currentUser?.uid, // dealerId와 동일
          
          // 일정 정보
          eventId: schedule.eventId,
          eventName: schedule.eventName,
          postId: schedule.eventId, // applications의 postId
          postTitle: schedule.eventName,
          
          // 날짜 및 시간
          date: Timestamp.fromDate(new Date(schedule.date + 'T00:00:00')),
          scheduledStartTime: schedule.startTime,
          scheduledEndTime: schedule.endTime,
          
          // 위치 및 역할
          location: schedule.location || '',
          role: schedule.role || '딜러',
          
          // 상태 및 타임스탬프
          status: 'checked_in',
          actualStartTime: Timestamp.now(),
          
          // 연결 정보
          applicationId: schedule.applicationId,
          
          // 메타데이터
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        
        workLogId = newWorkLogRef.id;
        console.log('✅ workLog 자동 생성 완료:', workLogId);
        
      } else if (!workLogId) {
        throw new Error('워크로그 정보를 찾을 수 없습니다.');
      } else {
        // 기존 workLog 업데이트
        await updateDoc(doc(db, 'workLogs', workLogId), {
          actualStartTime: Timestamp.now(),
          status: 'checked_in',
          updatedAt: Timestamp.now()
        });
      }

      showSuccess(`${schedule.eventName} 출근 처리가 완료되었습니다.`);
      console.log('✅ 출근 처리 완료:', schedule.id);
    } catch (error) {
      console.error('❌ 출근 처리 오류:', error);
      showError('출근 처리 중 오류가 발생했습니다.');
    }
  };

  // 퇴근 처리
  const handleCheckOut = async (scheduleId: string) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule || !schedule.workLogId) {
        throw new Error('스케줄 정보를 찾을 수 없습니다.');
      }

      // workLogs 업데이트
      await updateDoc(doc(db, 'workLogs', schedule.workLogId), {
        actualEndTime: Timestamp.now(),
        status: 'checked_out',
        updatedAt: Timestamp.now()
      });

      showSuccess('퇴근 처리되었습니다.');
      console.log('✅ 퇴근 처리 완료:', scheduleId);
    } catch (error) {
      console.error('❌ 퇴근 처리 오류:', error);
      showError('퇴근 처리 중 오류가 발생했습니다.');
    }
  };

  // QR 스캔 완료 핸들러
  const handleQRScanComplete = async (data: string) => {
    try {
      console.log('🔍 QR 스캔 데이터:', data);
      
      if (!pendingCheckInSchedule) {
        showError('출근 처리할 일정이 없습니다.');
        setIsQRScannerOpen(false);
        return;
      }

      // QR 스캔 성공 - 출근 처리 실행
      await processCheckIn(pendingCheckInSchedule);
      
      // 상태 초기화
      setIsQRScannerOpen(false);
      setPendingCheckInSchedule(null);
      
      console.log('✅ QR 인증 및 출근 처리 완료');
    } catch (error) {
      console.error('❌ QR 처리 오류:', error);
      showError('QR 코드 처리 중 오류가 발생했습니다.');
      
      // 에러 시에도 상태 초기화
      setIsQRScannerOpen(false);
      setPendingCheckInSchedule(null);
    }
  };

  // 지원 취소
  const handleCancelApplication = async (scheduleId: string) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule || !schedule.applicationId) {
        throw new Error('지원 정보를 찾을 수 없습니다.');
      }

      // applications 컬렉션에서 상태 업데이트
      await updateDoc(doc(db, 'applications', schedule.applicationId), {
        status: 'cancelled',
        updatedAt: Timestamp.now()
      });

      showSuccess('지원이 취소되었습니다.');
      console.log('✅ 지원 취소 완료:', scheduleId);
    } catch (error) {
      console.error('❌ 지원 취소 오류:', error);
      showError('지원 취소 중 오류가 발생했습니다.');
    }
  };

  // 일정 삭제 (미완료 일정만)
  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule) {
        throw new Error('스케줄 정보를 찾을 수 없습니다.');
      }

      console.log('🗑️ 일정 삭제 시작:', {
        scheduleId,
        eventName: schedule.eventName,
        type: schedule.type,
        status: schedule.status,
        sourceCollection: schedule.sourceCollection
      });

      // 삭제 가능한 일정인지 확인 (완료된 일정은 삭제 불가)
      if (schedule.type === 'completed') {
        showError('완료된 일정은 삭제할 수 없습니다.');
        return;
      }

      // 이미 출근한 일정은 삭제 제한 (선택적)
      if (schedule.status === 'checked_in') {
        showError('이미 출근한 일정은 삭제할 수 없습니다.');
        return;
      }

      // 사용자 확인
      const confirmed = window.confirm(`"${schedule.eventName}" 일정을 삭제하시겠습니까?\n\n삭제된 일정은 복구할 수 없습니다.`);
      if (!confirmed) {
        console.log('ℹ️ 사용자가 삭제를 취소했습니다.');
        return;
      }

      // 소스 컬렉션에 따른 삭제 처리
      if (schedule.sourceCollection === 'applications' && schedule.applicationId) {
        // applications: 완전 삭제
        await deleteDoc(doc(db, 'applications', schedule.applicationId));
        console.log('✅ applications 문서 삭제 완료:', schedule.applicationId);
        
      } else if (schedule.sourceCollection === 'workLogs' && schedule.workLogId) {
        // workLogs: 이력 보존을 위해 상태만 변경
        await updateDoc(doc(db, 'workLogs', schedule.workLogId), {
          status: 'cancelled',
          cancelledAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        console.log('✅ workLogs 상태 변경 완료:', schedule.workLogId);
        
      } else if (schedule.sourceCollection === 'staff' && schedule.sourceId) {
        // staff: 해당 일정 정보만 제거 (전체 문서는 보존)
        // 실제 구현은 staff 문서 구조에 따라 달라질 수 있음
        console.log('⚠️ staff 컬렉션 삭제는 추가 구현이 필요합니다:', schedule.sourceId);
        showError('직원 일정 삭제는 관리자에게 문의하세요.');
        return;
        
      } else {
        throw new Error('지원되지 않는 일정 타입입니다.');
      }

      showSuccess('일정이 삭제되었습니다.');
      console.log('✅ 일정 삭제 완료:', {
        scheduleId,
        eventName: schedule.eventName,
        sourceCollection: schedule.sourceCollection
      });

    } catch (error) {
      console.error('❌ 일정 삭제 오류:', error);
      showError('일정 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">내 스케줄</h1>
            <p className="text-gray-600 mt-1">근무 일정을 확인하고 관리하세요</p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 뷰 토글 버튼 (모바일) */}
            {isMobile && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'calendar' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title="캘린더 뷰"
                >
                  <FaCalendarAlt />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title="리스트 뷰"
                >
                  <FaList />
                </button>
              </div>
            )}
            
            {/* QR 스캔 버튼 (모바일) */}
            {isMobile && (
              <button
                onClick={() => setIsQRScannerOpen(true)}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                title="QR 출퇴근"
              >
                <FaCamera />
              </button>
            )}
            
            {/* 새로고침 버튼 */}
            <button
              onClick={refreshData}
              className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="새로고침"
            >
              <FaSync />
            </button>
          </div>
        </div>

        {/* 통계 */}
        <ScheduleStats stats={stats} isMobile={isMobile} />
      </div>

      {/* 필터 */}
      <div className="mb-4">
        <ScheduleFilters 
          filters={filters} 
          onFiltersChange={setFilters}
          isMobile={isMobile}
        />
      </div>

      {/* 메인 콘텐츠 */}
      {isMobile && viewMode === 'list' ? (
        /* 모바일 리스트 뷰 */
        <div className="bg-white rounded-lg shadow-sm">
          {schedules.length === 0 ? (
            <div className="p-8 text-center">
              <FaCalendarAlt className="text-4xl text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">등록된 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {schedules.map((schedule) => {
                const isToday = schedule.date === getTodayString();
                const statusColorClass = ATTENDANCE_STATUS_COLORS[schedule.status];
                
                return (
                  <div
                    key={schedule.id}
                    onClick={() => handleEventClick(schedule)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isToday ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        {renderStatusIcon(schedule)}
                        <h4 className="font-semibold text-gray-900 truncate">
                          {schedule.eventName}
                        </h4>
                        {isToday && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                            오늘
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColorClass}`}>
                        {schedule.status === 'not_started' && '예정'}
                        {schedule.status === 'checked_in' && '출근'}
                        {schedule.status === 'checked_out' && '퇴근'}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <FaCalendarAlt className="text-gray-400 w-3 h-3" />
                        <span>
                          {new Date(schedule.date).toLocaleDateString('ko-KR', {
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <FaClock className="text-gray-400 w-3 h-3" />
                        <span>
                          {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <FaInfoCircle className="text-gray-400 w-3 h-3" />
                        <span>{schedule.role}</span>
                      </div>

                      {schedule.location && (
                        <div className="flex items-center gap-2">
                          <FaMapMarkerAlt className="text-gray-400 w-3 h-3" />
                          <span className="truncate">{schedule.location}</span>
                        </div>
                      )}
                    </div>

                    {/* 오늘 일정인 경우 출퇴근 버튼 */}
                    {isToday && schedule.type === 'confirmed' && (
                      <div className="flex gap-2 mt-3">
                        {schedule.status === 'not_started' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckInClick(schedule.id);
                            }}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
                          >
                            출근하기
                          </button>
                        )}
                        {schedule.status === 'checked_in' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckOut(schedule.id);
                            }}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                          >
                            퇴근하기
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 캘린더 뷰 */
        <ScheduleCalendar
          schedules={schedules}
          currentView={calendarView}
          onViewChange={setCalendarView}
          onEventClick={handleEventClick}
        />
      )}

      {/* 일정 상세 모달 */}
      <ScheduleDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedSchedule(null);
        }}
        schedule={selectedSchedule}
        onCheckIn={handleCheckInClick}
        onCheckOut={handleCheckOut}
        onCancel={handleCancelApplication}
        onDelete={handleDeleteSchedule}
      />

      {/* QR 스캐너 모달 */}
      {isQRScannerOpen && (
        <QRScannerModal
          isOpen={isQRScannerOpen}
          onClose={() => {
            setIsQRScannerOpen(false);
            setPendingCheckInSchedule(null);
            console.log('🔍 QR 스캐너 취소됨');
          }}
          onScan={(data) => {
            if (data) {
              handleQRScanComplete(data);
            }
          }}
          onError={(error) => {
            console.error('❌ QR 스캔 오류:', error);
            showError('QR 코드 스캔 중 오류가 발생했습니다. 다시 시도해주세요.');
          }}
        />
      )}
    </div>
  );
};

export default MySchedulePage;