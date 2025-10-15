/**
 * 알림 시스템 테스트 페이지
 *
 * @description
 * 8가지 알림 타입을 테스트할 수 있는 개발자 도구
 *
 * @version 1.2.0
 * @since 2025-10-02
 * @updated 2025-10-15
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import type { NotificationType, NotificationCategory, NotificationPriority } from '../types';

interface TestNotification {
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  action: {
    type: 'navigate';
    target: string;
  };
  relatedId: string | null;
  data: Record<string, unknown>;
}

const NotificationTestPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // 8가지 테스트 알림 데이터
  const testNotifications: Record<string, TestNotification> = {
    // 시스템 알림 (4개)
    job_posting_announcement: {
      type: 'job_posting_announcement',
      category: 'system',
      priority: 'high',
      title: '[공고 공지] 강남 홀덤펍 토너먼트',
      body: '5월 15일 강남점에서 딜러 3명을 모집합니다',
      action: { type: 'navigate', target: '/app/jobs' },
      relatedId: 'test-job-posting-123',
      data: {}
    },
    new_job_posting: {
      type: 'new_job_posting',
      category: 'system',
      priority: 'medium',
      title: '[신규 공고] 새로운 구인공고가 등록되었습니다',
      body: '홍대점에서 딜러 2명을 모집합니다',
      action: { type: 'navigate', target: '/app/jobs/test-job-posting-456' },
      relatedId: 'test-job-posting-456',
      data: { location: '홍대' }
    },
    system_announcement: {
      type: 'system_announcement',
      category: 'system',
      priority: 'medium',
      title: '[시스템 공지] 정기 점검 안내',
      body: '5월 16일 새벽 2시~4시 시스템 정기 점검이 있습니다',
      action: { type: 'navigate', target: '/app/announcements' },
      relatedId: null,
      data: {}
    },
    app_update: {
      type: 'app_update',
      category: 'system',
      priority: 'low',
      title: '[업데이트] T-HOLDEM v0.2.3 출시',
      body: '새로운 기능이 추가되었습니다. 앱을 업데이트하세요',
      action: { type: 'navigate', target: '/app/announcements' },
      relatedId: null,
      data: { version: '0.2.3' }
    },

    // 근무 알림 (3개)
    job_application: {
      type: 'job_application',
      category: 'work',
      priority: 'medium',
      title: '[지원 완료] 강남점 토너먼트 지원 완료',
      body: '귀하의 지원서가 접수되었습니다',
      action: { type: 'navigate', target: '/app/my-schedule' },
      relatedId: 'test-application-456',
      data: {}
    },
    staff_approval: {
      type: 'staff_approval',
      category: 'work',
      priority: 'high',
      title: '[확정] 5월 15일 강남점 스태프 확정',
      body: '축하합니다! 스태프로 확정되었습니다',
      action: { type: 'navigate', target: '/app/my-schedule' },
      relatedId: 'test-event-789',
      data: { eventDate: '2025-05-15' }
    },
    staff_rejection: {
      type: 'staff_rejection',
      category: 'work',
      priority: 'medium',
      title: '[취소] 5월 15일 강남점 지원 취소',
      body: '아쉽지만 이번에는 선정되지 못했습니다',
      action: { type: 'navigate', target: '/app/my-schedule' },
      relatedId: 'test-event-790',
      data: {}
    },

    // 일정 알림 (1개)
    schedule_change: {
      type: 'schedule_change',
      category: 'schedule',
      priority: 'high',
      title: '[일정 변경] 5월 15일 근무 시간 변경',
      body: '근무 시작 시간이 오후 5시로 변경되었습니다',
      action: { type: 'navigate', target: '/app/my-schedule' },
      relatedId: 'test-schedule-222',
      data: { oldTime: '18:00', newTime: '17:00' }
    }
  };

  /**
   * 단일 알림 생성
   */
  const createNotification = async (type: string) => {
    if (!currentUser) {
      setStatus({ type: 'error', message: '로그인이 필요합니다' });
      return;
    }

    setLoading(true);
    try {
      const data = testNotifications[type];
      if (!data) {
        throw new Error(`알림 타입을 찾을 수 없습니다: ${type}`);
      }
      await addDoc(collection(db, 'notifications'), {
        userId: currentUser.uid,
        ...data,
        isRead: false,
        createdAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: `✅ ${data.title} - 알림 생성 완료!` });
    } catch (error) {
      setStatus({ type: 'error', message: `❌ 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  /**
   * 전체 알림 생성
   */
  const createAllNotifications = async () => {
    if (!currentUser) {
      setStatus({ type: 'error', message: '로그인이 필요합니다' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: '🚀 8개의 알림을 생성하는 중...' });

    let successCount = 0;
    let errorCount = 0;

    for (const [type, data] of Object.entries(testNotifications)) {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: currentUser.uid,
          ...data,
          isRead: false,
          createdAt: serverTimestamp()
        });
        successCount++;
      } catch (error) {
        logger.error(`Failed to create ${type}:`, error instanceof Error ? error : undefined);
        errorCount++;
      }
    }

    setLoading(false);
    if (errorCount === 0) {
      setStatus({ type: 'success', message: `🎉 성공! ${successCount}개의 알림이 생성되었습니다!` });
    } else {
      setStatus({ type: 'error', message: `⚠️ ${successCount}개 성공, ${errorCount}개 실패` });
    }
    setTimeout(() => setStatus(null), 5000);
  };

  /**
   * 우선순위 배지 색상
   */
  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * 우선순위 한글명
   */
  const getPriorityText = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent': return '긴급';
      case 'high': return '높음';
      case 'medium': return '보통';
      case 'low': return '낮음';
      default: return '';
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">🔔 알림 테스트</h1>
          <p className="text-gray-600">로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🔔 알림 시스템 테스트</h1>
        <p className="text-purple-100">8가지 알림 타입을 테스트할 수 있습니다</p>
        <p className="text-purple-200 text-sm mt-2">현재 사용자: {currentUser.email || currentUser.uid}</p>
      </div>

      {/* 상태 메시지 */}
      {status && (
        <div className={`mb-6 p-4 rounded-lg ${
          status.type === 'success' ? 'bg-green-50 text-green-800' :
          status.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {status.message}
        </div>
      )}

      {/* 전체 테스트 버튼 */}
      <div className="mb-6">
        <button
          onClick={createAllNotifications}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? '생성 중...' : '🚀 전체 알림 테스트 (8개)'}
        </button>
      </div>

      {/* 시스템 알림 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b-2">📢 시스템 알림 (4개)</h2>
        <div className="space-y-4">
          {Object.entries(testNotifications).slice(0, 4).map(([type, data]) => (
            <div key={type} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{data.title}</h4>
                <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(data.priority)}`}>
                  {getPriorityText(data.priority)}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{data.body}</p>
              <button
                onClick={() => createNotification(type)}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded transition-colors disabled:bg-gray-300"
              >
                테스트
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 근무 알림 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b-2">💼 근무 알림 (3개)</h2>
        <div className="space-y-4">
          {Object.entries(testNotifications).slice(4, 7).map(([type, data]) => (
            <div key={type} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{data.title}</h4>
                <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(data.priority)}`}>
                  {getPriorityText(data.priority)}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{data.body}</p>
              <button
                onClick={() => createNotification(type)}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded transition-colors disabled:bg-gray-300"
              >
                테스트
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 일정 알림 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b-2">📅 일정 알림 (1개)</h2>
        <div className="space-y-4">
          {Object.entries(testNotifications).slice(7, 8).map(([type, data]) => (
            <div key={type} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{data.title}</h4>
                <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(data.priority)}`}>
                  {getPriorityText(data.priority)}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{data.body}</p>
              <button
                onClick={() => createNotification(type)}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded transition-colors disabled:bg-gray-300"
              >
                테스트
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationTestPage;
