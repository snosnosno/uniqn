import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FaCalendarAlt, 
  FaSync,
  FaQrcode,
  FaCamera
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useScheduleData } from '../../hooks/useScheduleData';
import { CalendarView, ScheduleEvent } from '../../types/schedule';

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
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const MySchedulePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 캘린더 뷰 상태
  const [calendarView, setCalendarView] = useState<CalendarView>('dayGridMonth');
  
  // 모달 상태
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  
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

  // 출근 처리
  const handleCheckIn = async (scheduleId: string) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule || !schedule.workLogId) {
        throw new Error('스케줄 정보를 찾을 수 없습니다.');
      }

      // workLogs 업데이트
      await updateDoc(doc(db, 'workLogs', schedule.workLogId), {
        actualStartTime: Timestamp.now(),
        status: 'checked_in',
        updatedAt: Timestamp.now()
      });

      showSuccess('출근 처리되었습니다.');
      console.log('✅ 출근 처리 완료:', scheduleId);
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
      // QR 데이터 파싱 및 처리
      console.log('QR 스캔 데이터:', data);
      
      // TODO: QR 데이터에서 스케줄 ID 추출 및 출퇴근 처리
      // 현재는 임시로 메시지만 표시
      showInfo('QR 코드가 스캔되었습니다.');
      setIsQRScannerOpen(false);
    } catch (error) {
      console.error('QR 처리 오류:', error);
      showError('QR 코드 처리 중 오류가 발생했습니다.');
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

      {/* 메인 콘텐츠 - 캘린더 */}
      <ScheduleCalendar
        schedules={schedules}
        currentView={calendarView}
        onViewChange={setCalendarView}
        onEventClick={handleEventClick}
      />

      {/* 일정 상세 모달 */}
      <ScheduleDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedSchedule(null);
        }}
        schedule={selectedSchedule}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onCancel={handleCancelApplication}
      />

      {/* QR 스캐너 모달 */}
      {isQRScannerOpen && (
        <QRScannerModal
          isOpen={isQRScannerOpen}
          onClose={() => setIsQRScannerOpen(false)}
          onScan={(data) => {
            if (data) {
              handleQRScanComplete(data);
            }
          }}
          onError={(error) => {
            console.error('QR 스캔 오류:', error);
            showError('QR 코드 스캔 중 오류가 발생했습니다.');
          }}
        />
      )}
    </div>
  );
};

export default MySchedulePage;