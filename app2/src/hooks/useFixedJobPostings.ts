import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { FixedJobPosting } from '../types/jobPosting/jobPosting';
import { logger } from '../utils/logger';

export interface UseFixedJobPostingsReturn {
  postings: FixedJobPosting[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
}

const PAGE_SIZE = 20;

/**
 * 고정공고 목록 조회 Hook
 *
 * 초기 20개는 onSnapshot으로 실시간 구독하고,
 * 추가 페이지는 getDocs로 일회성 조회합니다.
 *
 * @returns {UseFixedJobPostingsReturn} 공고 목록, 로딩 상태, 에러, 추가 로드 함수
 */
export function useFixedJobPostings(): UseFixedJobPostingsReturn {
  const [postings, setPostings] = useState<FixedJobPosting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);

  // 초기 20개 실시간 구독
  useEffect(() => {
    logger.info('useFixedJobPostings: 초기 구독 시작', {
      component: 'useFixedJobPostings',
    });

    const q = query(
      collection(db, 'jobPostings'),
      where('postingType', '==', 'fixed'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const fetchedPostings: FixedJobPosting[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();

            // fixedData 검증 - 없으면 스킵
            if (!data.fixedData || !data.fixedData.workSchedule) {
              logger.warn('useFixedJobPostings: fixedData 또는 workSchedule 누락', {
                component: 'useFixedJobPostings',
                additionalData: { postingId: doc.id },
              });
              return;
            }

            fetchedPostings.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
            } as FixedJobPosting);
          });

          setPostings(fetchedPostings);
          setHasMore(snapshot.docs.length === PAGE_SIZE);

          // 마지막 문서 저장 (추가 페이지 로드용)
          if (snapshot.docs.length > 0) {
            lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
          }

          if (isInitialLoadRef.current) {
            setLoading(false);
            isInitialLoadRef.current = false;
          }

          logger.info('useFixedJobPostings: 초기 데이터 로드 성공', {
            component: 'useFixedJobPostings',
            additionalData: {
              count: fetchedPostings.length,
              hasMore: snapshot.docs.length === PAGE_SIZE,
            },
          });
        } catch (err) {
          logger.error(
            'useFixedJobPostings: 데이터 파싱 에러',
            err instanceof Error ? err : new Error(String(err)),
            { component: 'useFixedJobPostings' }
          );
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      },
      (err) => {
        logger.error(
          'useFixedJobPostings: Firestore 구독 에러',
          err,
          { component: 'useFixedJobPostings' }
        );
        setError(err);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Cleanup: 구독 해제
    return () => {
      if (unsubscribeRef.current) {
        logger.info('useFixedJobPostings: 구독 해제', {
          component: 'useFixedJobPostings',
        });
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // 추가 페이지 로드 (getDocs 일회성 조회)
  const loadMore = useCallback(() => {
    if (isFetching || !hasMore || loading) {
      logger.info('useFixedJobPostings: loadMore 중단 (중복 방지)', {
        component: 'useFixedJobPostings',
        additionalData: {
          isFetching,
          hasMore,
          loading,
        },
      });
      return;
    }

    if (!lastDocRef.current) {
      logger.warn('useFixedJobPostings: lastDoc 없음, loadMore 중단', {
        component: 'useFixedJobPostings',
      });
      setHasMore(false);
      return;
    }

    setIsFetching(true);
    logger.info('useFixedJobPostings: 추가 페이지 로드 시작', {
      component: 'useFixedJobPostings',
    });

    const q = query(
      collection(db, 'jobPostings'),
      where('postingType', '==', 'fixed'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      startAfter(lastDocRef.current),
      limit(PAGE_SIZE)
    );

    getDocs(q)
      .then((snapshot) => {
        const fetchedPostings: FixedJobPosting[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

          // fixedData 검증 - 없으면 스킵
          if (!data.fixedData || !data.fixedData.workSchedule) {
            logger.warn('useFixedJobPostings: fixedData 또는 workSchedule 누락 (loadMore)', {
              component: 'useFixedJobPostings',
              additionalData: { postingId: doc.id },
            });
            return;
          }

          fetchedPostings.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
          } as FixedJobPosting);
        });

        setPostings((prev) => [...prev, ...fetchedPostings]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);

        // 마지막 문서 업데이트
        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
        } else {
          lastDocRef.current = null;
        }

        logger.info('useFixedJobPostings: 추가 페이지 로드 성공', {
          component: 'useFixedJobPostings',
          additionalData: {
            count: fetchedPostings.length,
            hasMore: snapshot.docs.length === PAGE_SIZE,
          },
        });

        setIsFetching(false);
      })
      .catch((err) => {
        logger.error(
          'useFixedJobPostings: 추가 페이지 로드 실패',
          err instanceof Error ? err : new Error(String(err)),
          { component: 'useFixedJobPostings' }
        );
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsFetching(false);
      });
  }, [isFetching, hasMore, loading]);

  return {
    postings,
    loading,
    error,
    hasMore,
    loadMore,
  };
}
