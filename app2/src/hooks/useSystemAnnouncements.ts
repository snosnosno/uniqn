/**
 * 시스템 공지사항 관리 Hook
 *
 * @description
 * Firestore 시스템 공지사항 컬렉션을 실시간으로 구독하고 관리하는 Hook
 *
 * @version 1.0.0
 * @since 2025-10-25
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

import { db } from '../firebase';
import { logger } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './useToast';
import type {
  SystemAnnouncement,
  CreateSystemAnnouncementInput,
  UpdateSystemAnnouncementInput,
  SystemAnnouncementFilter
} from '../types';

/**
 * displayName에서 이름만 추출
 * @example "김승호 [{"phone":"010-1234-5678","gender":"male"}]" → "김승호"
 */
function extractNameFromDisplayName(displayName: string | null | undefined): string {
  if (!displayName) return '관리자';

  // JSON 배열 형식이 포함된 경우 이름만 추출
  const match = displayName.match(/^(.+?)\s*\[/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return displayName;
}

export interface UseSystemAnnouncementsReturn {
  // 데이터
  announcements: SystemAnnouncement[];
  activeAnnouncements: SystemAnnouncement[];
  totalCount: number;

  // 상태
  loading: boolean;
  error: Error | null;

  // 액션
  createAnnouncement: (input: CreateSystemAnnouncementInput) => Promise<string>;
  updateAnnouncement: (id: string, input: UpdateSystemAnnouncementInput) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  incrementViewCount: (id: string) => Promise<void>;

  // 필터
  filter: SystemAnnouncementFilter;
  setFilter: (filter: SystemAnnouncementFilter) => void;
}

/**
 * 시스템 공지사항 Hook
 *
 * @example
 * ```tsx
 * const { announcements, createAnnouncement, loading } = useSystemAnnouncements();
 * ```
 */
export const useSystemAnnouncements = (): UseSystemAnnouncementsReturn => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filter, setFilter] = useState<SystemAnnouncementFilter>({
    activeOnly: true
  });

  /**
   * Firestore Timestamp를 Date로 변환
   */
  const convertTimestamp = useCallback((timestamp: Timestamp | Date): Date => {
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return timestamp.toDate();
  }, []);

  /**
   * Firestore 실시간 구독
   */
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return undefined;
    }

    try {
      const announcementsRef = collection(db, 'systemAnnouncements');
      let q = query(announcementsRef, orderBy('createdAt', 'desc'));

      // 활성 공지사항만 필터링
      if (filter.activeOnly) {
        q = query(q, where('isActive', '==', true));
      }

      // 우선순위 필터
      if (filter.priority) {
        q = query(q, where('priority', '==', filter.priority));
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const announcementsData = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              startDate: data.startDate,
              endDate: data.endDate || null,
              sendResult: data.sendResult || undefined
            } as SystemAnnouncement;
          });

          // 날짜 필터 적용
          let filteredAnnouncements = announcementsData;
          const now = new Date();

          if (filter.activeOnly) {
            filteredAnnouncements = filteredAnnouncements.filter((announcement) => {
              const startDate = convertTimestamp(announcement.startDate);
              const endDate = announcement.endDate ? convertTimestamp(announcement.endDate) : null;

              // 시작일 이전이면 제외
              if (startDate > now) return false;

              // 종료일이 지났으면 제외
              if (endDate && endDate < now) return false;

              return true;
            });
          }

          setAnnouncements(filteredAnnouncements);
          setLoading(false);
          setError(null);

          logger.info('시스템 공지사항 조회 완료', {
            component: 'useSystemAnnouncements',
            data: { count: filteredAnnouncements.length }
          });
        },
        (err) => {
          logger.error('시스템 공지사항 구독 실패:', err instanceof Error ? err : new Error(String(err)), {
            component: 'useSystemAnnouncements'
          });
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      logger.error('시스템 공지사항 구독 설정 실패:', err instanceof Error ? err : new Error(String(err)), {
        component: 'useSystemAnnouncements'
      });
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
      return undefined;
    }
  }, [currentUser, filter]);

  /**
   * 활성 공지사항만 필터링
   */
  const activeAnnouncements = useMemo(() => {
    const now = new Date();
    return announcements.filter((announcement) => {
      if (!announcement.isActive) return false;

      const startDate = convertTimestamp(announcement.startDate);
      const endDate = announcement.endDate ? convertTimestamp(announcement.endDate) : null;

      if (startDate > now) return false;
      if (endDate && endDate < now) return false;

      return true;
    });
  }, [announcements]);

  /**
   * 전체 공지사항 수
   */
  const totalCount = announcements.length;

  /**
   * 공지사항 생성 및 알림 전송
   */
  const createAnnouncement = useCallback(
    async (input: CreateSystemAnnouncementInput): Promise<string> => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        // 1. Firestore에 공지사항 문서 생성
        const announcementsRef = collection(db, 'systemAnnouncements');
        const docRef = await addDoc(announcementsRef, {
          title: input.title,
          content: input.content,
          priority: input.priority,
          startDate: Timestamp.fromDate(input.startDate),
          endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
          createdBy: currentUser.uid,
          createdByName: extractNameFromDisplayName(currentUser.displayName) || currentUser.email || '관리자',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isActive: true,
          viewCount: 0
        });

        logger.info('시스템 공지사항 생성 완료', {
          component: 'useSystemAnnouncements',
          data: { id: docRef.id, title: input.title }
        });

        // 2. Firebase Functions 호출하여 모든 사용자에게 알림 전송
        try {
          const { callFunctionLazy } = await import('../utils/firebase-dynamic');
          const result = await callFunctionLazy('sendSystemAnnouncement', {
            announcementId: docRef.id,
            title: input.title,
            content: input.content,
            priority: input.priority
          });

          logger.info('시스템 공지사항 알림 전송 완료', {
            component: 'useSystemAnnouncements',
            data: { id: docRef.id, result }
          });
        } catch (funcErr) {
          // 알림 전송 실패 시에도 공지사항은 생성된 상태 유지
          logger.error('시스템 공지사항 알림 전송 실패 (공지사항은 생성됨):', funcErr instanceof Error ? funcErr : new Error(String(funcErr)), {
            component: 'useSystemAnnouncements',
            data: { id: docRef.id }
          });
        }

        return docRef.id;
      } catch (err) {
        logger.error('시스템 공지사항 생성 실패:', err instanceof Error ? err : new Error(String(err)), {
          component: 'useSystemAnnouncements'
        });
        throw err;
      }
    },
    [currentUser]
  );

  /**
   * 공지사항 수정
   */
  const updateAnnouncement = useCallback(
    async (id: string, input: UpdateSystemAnnouncementInput): Promise<void> => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        const announcementRef = doc(db, 'systemAnnouncements', id);
        const updateData: Record<string, unknown> = {
          updatedAt: serverTimestamp()
        };

        if (input.title !== undefined) updateData.title = input.title;
        if (input.content !== undefined) updateData.content = input.content;
        if (input.priority !== undefined) updateData.priority = input.priority;
        if (input.startDate !== undefined) {
          updateData.startDate = Timestamp.fromDate(input.startDate);
        }
        if (input.endDate !== undefined) {
          updateData.endDate = input.endDate ? Timestamp.fromDate(input.endDate) : null;
        }
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        await updateDoc(announcementRef, updateData as Partial<SystemAnnouncement>);

        logger.info('시스템 공지사항 수정 완료', {
          component: 'useSystemAnnouncements',
          data: { id }
        });

        showSuccess('공지사항이 수정되었습니다.');
      } catch (err) {
        logger.error('시스템 공지사항 수정 실패:', err instanceof Error ? err : new Error(String(err)), {
          component: 'useSystemAnnouncements'
        });
        showError('공지사항 수정에 실패했습니다.');
        throw err;
      }
    },
    [currentUser, showSuccess, showError]
  );

  /**
   * 공지사항 삭제
   */
  const deleteAnnouncement = useCallback(
    async (id: string): Promise<void> => {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        const announcementRef = doc(db, 'systemAnnouncements', id);
        await deleteDoc(announcementRef);

        logger.info('시스템 공지사항 삭제 완료', {
          component: 'useSystemAnnouncements',
          data: { id }
        });

        showSuccess('공지사항이 삭제되었습니다.');
      } catch (err) {
        logger.error('시스템 공지사항 삭제 실패:', err instanceof Error ? err : new Error(String(err)), {
          component: 'useSystemAnnouncements'
        });
        showError('공지사항 삭제에 실패했습니다.');
        throw err;
      }
    },
    [currentUser, showSuccess, showError]
  );

  /**
   * 조회수 증가
   */
  const incrementViewCount = useCallback(
    async (id: string): Promise<void> => {
      try {
        const announcementRef = doc(db, 'systemAnnouncements', id);
        await updateDoc(announcementRef, {
          viewCount: increment(1)
        });

        logger.info('공지사항 조회수 증가', {
          component: 'useSystemAnnouncements',
          data: { id }
        });
      } catch (err) {
        logger.error('조회수 증가 실패:', err instanceof Error ? err : new Error(String(err)), {
          component: 'useSystemAnnouncements'
        });
      }
    },
    []
  );

  return {
    announcements,
    activeAnnouncements,
    totalCount,
    loading,
    error,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    incrementViewCount,
    filter,
    setFilter
  };
};
