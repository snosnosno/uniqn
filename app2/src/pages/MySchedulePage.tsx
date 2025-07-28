import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaInfoCircle } from 'react-icons/fa';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

interface ScheduleItem {
  id: string;
  date: string;
  scheduledStartTime: Timestamp | null;
  scheduledEndTime: Timestamp | null;
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  eventId: string;
  eventName?: string;
  location?: string;
  status: 'not_started' | 'checked_in' | 'checked_out';
  notes?: string;
}

const MySchedulePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    // workLogs에서 현재 사용자의 스케줄 가져오기
    const scheduleQuery = query(
      collection(db, 'workLogs'),
      where('dealerId', '==', currentUser.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(
      scheduleQuery,
      (snapshot) => {
        const scheduleData: ScheduleItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          scheduleData.push({
            id: doc.id,
            date: data.date,
            scheduledStartTime: data.scheduledStartTime,
            scheduledEndTime: data.scheduledEndTime,
            actualStartTime: data.actualStartTime,
            actualEndTime: data.actualEndTime,
            eventId: data.eventId,
            eventName: data.eventName || '이벤트',
            location: data.location,
            status: data.status || 'not_started',
            notes: data.notes
          });
        });
        setSchedules(scheduleData);
        setLoading(false);
      },
      (error) => {
        console.error('스케줄 조회 오류:', error);
        showError('스케줄을 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, showError]);

  // 날짜 필터링
  const filteredSchedules = schedules.filter(schedule => {
    const scheduleDate = new Date(schedule.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDateFilter === 'upcoming') {
      return scheduleDate >= today;
    } else if (selectedDateFilter === 'past') {
      return scheduleDate < today;
    }
    return true;
  });

  // 시간 포맷팅
  const formatTime = (timestamp: Timestamp | null | undefined) => {
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

  // 상태 표시
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'checked_in':
        return { label: '출근', color: 'text-green-600 bg-green-100' };
      case 'checked_out':
        return { label: '퇴근', color: 'text-blue-600 bg-blue-100' };
      default:
        return { label: '예정', color: 'text-gray-600 bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">내 스케줄</h1>
        <p className="text-gray-600">근무 일정을 확인하고 관리하세요</p>
      </div>

      {/* 필터 버튼 */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setSelectedDateFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedDateFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setSelectedDateFilter('upcoming')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedDateFilter === 'upcoming'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          예정된 일정
        </button>
        <button
          onClick={() => setSelectedDateFilter('past')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedDateFilter === 'past'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          지난 일정
        </button>
      </div>

      {/* 스케줄 목록 */}
      {filteredSchedules.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <FaCalendarAlt className="text-4xl text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {selectedDateFilter === 'upcoming' 
              ? '예정된 일정이 없습니다.'
              : selectedDateFilter === 'past'
              ? '지난 일정이 없습니다.'
              : '등록된 일정이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSchedules.map((schedule) => {
            const statusInfo = getStatusDisplay(schedule.status);
            const isToday = new Date(schedule.date).toDateString() === new Date().toDateString();
            
            return (
              <div 
                key={schedule.id} 
                className={`bg-white rounded-lg shadow-md p-6 ${
                  isToday ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {/* 날짜 헤더 */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FaCalendarAlt className="text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {formatDate(schedule.date)}
                    </h3>
                    {isToday && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                        오늘
                      </span>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* 시간 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <FaClock className="text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">예정 시간</p>
                      <p className="font-medium">
                        {formatTime(schedule.scheduledStartTime)} - {formatTime(schedule.scheduledEndTime)}
                      </p>
                    </div>
                  </div>
                  
                  {(schedule.actualStartTime || schedule.actualEndTime) && (
                    <div className="flex items-center gap-2">
                      <FaClock className="text-green-500" />
                      <div>
                        <p className="text-sm text-gray-500">실제 시간</p>
                        <p className="font-medium text-green-600">
                          {formatTime(schedule.actualStartTime)} - {formatTime(schedule.actualEndTime)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 이벤트 정보 */}
                <div className="flex items-start gap-4 text-sm text-gray-600">
                  {schedule.eventName && (
                    <div className="flex items-center gap-1">
                      <FaInfoCircle className="text-gray-400" />
                      <span>{schedule.eventName}</span>
                    </div>
                  )}
                  {schedule.location && (
                    <div className="flex items-center gap-1">
                      <FaMapMarkerAlt className="text-gray-400" />
                      <span>{schedule.location}</span>
                    </div>
                  )}
                </div>

                {/* 메모 */}
                {schedule.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">{schedule.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MySchedulePage;