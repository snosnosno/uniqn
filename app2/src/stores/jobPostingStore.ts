import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, Unsubscribe, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { JobPosting } from '../types/jobPosting';
import { Applicant } from '../types/applicant';
import { Staff } from '../types/common';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { logger } from '../utils/logger';

interface JobPostingState {
  // 상태
  jobPostingId: string | null;
  jobPosting: JobPosting | null;
  loading: boolean;
  error: string | null;
  applicants: Applicant[];
  staff: Staff[];
  
  // 구독 해제 함수들
  unsubscribers: {
    jobPosting?: Unsubscribe;
    applicants?: Unsubscribe;
    staff?: Unsubscribe;
  };
  
  // 액션
  setJobPostingId: (id: string | null) => void;
  refreshJobPosting: () => Promise<void>;
  refreshApplicants: () => Promise<void>;
  refreshStaff: () => Promise<void>;
  cleanup: () => void;
}

export const useJobPostingStore = create<JobPostingState>()(
  devtools(
    subscribeWithSelector(
      (set, get) => ({
        // 초기 상태
        jobPostingId: null,
        jobPosting: null,
        loading: true,
        error: null,
        applicants: [],
        staff: [],
        unsubscribers: {},
        
        // 액션
        setJobPostingId: (id) => {
          const state = get();
          
          // 같은 ID면 무시
          if (state.jobPostingId === id) return;
          
          // 이전 구독만 해제 (상태는 초기화하지 않음)
          Object.values(state.unsubscribers).forEach(unsubscribe => {
            if (unsubscribe) unsubscribe();
          });
          
          set({ 
            jobPostingId: id, 
            loading: true, 
            error: null,
            unsubscribers: {} 
          });
          
          if (!id) {
            set({ loading: false });
            return;
          }
          
          // 공고 데이터 실시간 구독
          const jobPostingRef = doc(db, 'jobPostings', id);
          const unsubscribeJobPosting = onSnapshot(
            jobPostingRef,
            async (docSnapshot) => {
              if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const jobPostingData = { id: docSnapshot.id, ...data } as JobPosting;
                
                // confirmedStaff가 이미 문서에 배열로 있는지 확인
                if (data.confirmedStaff && Array.isArray(data.confirmedStaff)) {
                  logger.debug('confirmedStaff가 문서 필드로 존재', {
                    component: 'jobPostingStore',
                    data: {
                      jobPostingId: id,
                      confirmedStaffCount: data.confirmedStaff.length,
                      confirmedStaff: data.confirmedStaff
                    }
                  });
                  // 이미 jobPostingData에 포함되어 있음
                } else {
                  // 서브컬렉션으로 시도 (실패할 가능성 있음)
                  try {
                    const confirmedStaffRef = collection(db, 'jobPostings', id, 'confirmedStaff');
                    const confirmedStaffSnapshot = await getDocs(confirmedStaffRef);
                    
                    if (!confirmedStaffSnapshot.empty) {
                      const confirmedStaffList: ConfirmedStaff[] = confirmedStaffSnapshot.docs.map(doc => ({
                        ...doc.data()
                      } as ConfirmedStaff));
                      
                      jobPostingData.confirmedStaff = confirmedStaffList;
                      
                      logger.debug('confirmedStaff 서브컬렉션에서 로드', {
                        component: 'jobPostingStore',
                        data: {
                          jobPostingId: id,
                          confirmedStaffCount: confirmedStaffList.length
                        }
                      });
                    } else {
                      // 서브컬렉션이 비어있거나 없음
                      jobPostingData.confirmedStaff = [];
                      logger.debug('confirmedStaff가 없음', {
                        component: 'jobPostingStore',
                        data: { jobPostingId: id }
                      });
                    }
                  } catch (error) {
                    // 권한 오류 등으로 서브컬렉션 접근 실패
                    logger.warn('confirmedStaff 서브컬렉션 접근 실패, 필드 데이터 사용', {
                      component: 'jobPostingStore',
                      data: { 
                        jobPostingId: id,
                        error: error instanceof Error ? error.message : String(error)
                      }
                    });
                    // 필드에 없으면 빈 배열
                    if (!jobPostingData.confirmedStaff) {
                      jobPostingData.confirmedStaff = [];
                    }
                  }
                }
                
                set({ 
                  jobPosting: jobPostingData,
                  error: null,
                  loading: false
                });
              } else {
                set({ 
                  error: '공고를 찾을 수 없습니다.',
                  loading: false
                });
              }
            },
            (error) => {
              logger.error('공고 데이터 로딩 오류:', error instanceof Error ? error : new Error(String(error)), { 
                component: 'jobPostingStore' 
              });
              set({ 
                error: '공고 데이터를 불러오는데 실패했습니다.',
                loading: false
              });
            }
          );
          
          set((state) => ({
            unsubscribers: {
              ...state.unsubscribers,
              jobPosting: unsubscribeJobPosting
            }
          }));
        },
        
        refreshJobPosting: async () => {
          const { jobPostingId } = get();
          if (!jobPostingId) return;
          
          try {
            const jobPostingRef = doc(db, 'jobPostings', jobPostingId);
            const docSnap = await getDoc(jobPostingRef);
            
            if (docSnap.exists()) {
              const data = docSnap.data();
              const jobPostingData = { id: docSnap.id, ...data } as JobPosting;
              
              // confirmedStaff가 이미 문서에 배열로 있는지 확인
              if (data.confirmedStaff && Array.isArray(data.confirmedStaff)) {
                logger.debug('refreshJobPosting - confirmedStaff가 문서 필드로 존재', {
                  component: 'jobPostingStore',
                  data: {
                    jobPostingId,
                    confirmedStaffCount: data.confirmedStaff.length
                  }
                });
              } else {
                // 서브컬렉션 시도
                try {
                  const confirmedStaffRef = collection(db, 'jobPostings', jobPostingId, 'confirmedStaff');
                  const confirmedStaffSnapshot = await getDocs(confirmedStaffRef);
                  
                  if (!confirmedStaffSnapshot.empty) {
                    const confirmedStaffList: ConfirmedStaff[] = confirmedStaffSnapshot.docs.map(doc => ({
                      ...doc.data()
                    } as ConfirmedStaff));
                    
                    jobPostingData.confirmedStaff = confirmedStaffList;
                    
                    logger.debug('refreshJobPosting - confirmedStaff 서브컬렉션에서 로드', {
                      component: 'jobPostingStore',
                      data: {
                        jobPostingId,
                        confirmedStaffCount: confirmedStaffList.length
                      }
                    });
                  } else {
                    jobPostingData.confirmedStaff = [];
                  }
                } catch (error) {
                  logger.warn('refreshJobPosting - confirmedStaff 접근 실패', {
                    component: 'jobPostingStore',
                    data: { 
                      jobPostingId,
                      error: error instanceof Error ? error.message : String(error)
                    }
                  });
                  if (!jobPostingData.confirmedStaff) {
                    jobPostingData.confirmedStaff = [];
                  }
                }
              }
              
              set({ 
                jobPosting: jobPostingData,
                error: null
              });
            } else {
              set({ error: '공고를 찾을 수 없습니다.' });
            }
          } catch (error) {
            logger.error('공고 새로고침 오류:', error instanceof Error ? error : new Error(String(error)), { 
              component: 'jobPostingStore' 
            });
            set({ error: '공고를 새로고침하는데 실패했습니다.' });
          }
        },
        
        refreshApplicants: async () => {
          const { jobPostingId } = get();
          if (!jobPostingId) return;
          
          // 지원자 데이터 실시간 구독 설정
          const applicantsQuery = query(
            collection(db, 'applications'),
            where('postId', '==', jobPostingId),
            orderBy('createdAt', 'desc')
          );
          
          const unsubscribeApplicants = onSnapshot(
            applicantsQuery,
            (snapshot) => {
              const applicantList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              } as Applicant));
              
              set({ applicants: applicantList });
            },
            (error) => {
              logger.error('지원자 데이터 로딩 오류:', error instanceof Error ? error : new Error(String(error)), { 
                component: 'jobPostingStore' 
              });
            }
          );
          
          set((state) => ({
            unsubscribers: {
              ...state.unsubscribers,
              applicants: unsubscribeApplicants
            }
          }));
        },
        
        refreshStaff: async () => {
          // persons 컬렉션에서 스태프 데이터 실시간 구독 설정
          const staffQuery = query(
            collection(db, 'persons'),
            where('type', 'in', ['staff', 'both']),
            orderBy('name')
          );
          
          const unsubscribeStaff = onSnapshot(
            staffQuery,
            (snapshot) => {
              const staffList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              } as Staff));
              
              set({ staff: staffList });
            },
            (error) => {
              logger.error('스태프 데이터 로딩 오류:', error instanceof Error ? error : new Error(String(error)), { 
                component: 'jobPostingStore' 
              });
            }
          );
          
          set((state) => ({
            unsubscribers: {
              ...state.unsubscribers,
              staff: unsubscribeStaff
            }
          }));
        },
        
        cleanup: () => {
          const state = get();
          
          // 모든 구독 해제
          Object.values(state.unsubscribers).forEach(unsubscribe => {
            if (unsubscribe) unsubscribe();
          });
          
          // 상태 초기화 (store를 완전히 리셋)
          set({
            jobPostingId: null,
            jobPosting: null,
            applicants: [],
            staff: [],
            loading: false,
            error: null,
            unsubscribers: {}
          });
        }
      })
    ),
    {
      name: 'job-posting-storage',
    }
  )
);

// 컨텍스트와 동일한 인터페이스를 제공하는 hook
export const useJobPostingContext = () => {
  const store = useJobPostingStore();
  
  return {
    jobPosting: store.jobPosting,
    loading: store.loading,
    error: store.error,
    refreshJobPosting: store.refreshJobPosting,
    applicants: store.applicants,
    staff: store.staff,
    refreshApplicants: store.refreshApplicants,
    refreshStaff: store.refreshStaff,
  };
};