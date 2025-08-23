import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../../utils/logger';
import { db } from '../../../../firebase';
import { Applicant } from '../types';

/**
 * 지원자 데이터를 관리하는 Custom Hook
 */
export const useApplicantData = (eventId?: string) => {
  const { t } = useTranslation();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const loadApplicants = useCallback(async (postId: string) => {
    setLoadingApplicants(true);
    try {
      const q = query(collection(db, 'applications'), where('eventId', '==', postId));
      const querySnapshot = await getDocs(q);
      const fetchedApplicants = querySnapshot.docs.map(doc => {
        const data = doc.data();
        logger.debug('🔍 Firebase 지원자 원본 데이터:', { 
          component: 'useApplicantData',
          data: { 
            id: doc.id, 
            data: data,
            role: data.role,
            timeSlot: data.timeSlot,
            date: data.date,
            assignedRole: data.assignedRole,
            assignedTime: data.assignedTime,
            assignedDate: data.assignedDate
          }
        });
        
        // Firebase 필드명을 Applicant 인터페이스에 맞게 매핑
        // assignedDate를 Timestamp에서 문자열로 변환
        let dateString = '';
        if (data.assignedDate) {
          try {
            if (data.assignedDate.toDate) {
              // Firestore Timestamp 객체인 경우
              const date = data.assignedDate.toDate();
              dateString = date.toISOString().split('T')[0]; // yyyy-MM-dd 형식
            } else if (typeof data.assignedDate === 'string') {
              dateString = data.assignedDate;
            }
          } catch (error) {
            logger.error('날짜 변환 오류:', error instanceof Error ? error : new Error(String(error)), { 
              component: 'useApplicantData' 
            });
          }
        }
        
        return { 
          id: doc.id, 
          ...data,
          // 필드명 매핑 (role -> assignedRole 등)
          assignedRole: data.assignedRole || data.role,
          assignedTime: data.assignedTime || data.timeSlot,
          assignedDate: dateString || data.date,
          // 다중 선택 필드도 매핑
          assignedRoles: data.assignedRoles || (data.assignedRole ? [data.assignedRole] : data.role ? [data.role] : []),
          assignedTimes: data.assignedTimes || (data.assignedTime ? [data.assignedTime] : data.timeSlot ? [data.timeSlot] : []),
          assignedDates: data.assignedDates || (dateString ? [dateString] : data.date ? [data.date] : [])
        } as Applicant;
      });
      
      // 사용자 정보를 추가로 가져오기
      const applicantsWithUserInfo = await Promise.all(
        fetchedApplicants.map(async (applicant) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', applicant.applicantId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                ...applicant,
                gender: userData.gender,
                age: userData.age,
                experience: userData.experience,
                email: userData.email,
                phone: userData.phone  // phoneNumber에서 phone으로 변경
              };
            }
            return applicant;
          } catch (error) {
            logger.error('Error fetching user data for applicant:', error instanceof Error ? error : new Error(String(error)), { 
              component: 'useApplicantData', 
              data: { applicantId: applicant.applicantId } 
            });
            return applicant;
          }
        })
      );

      setApplicants(applicantsWithUserInfo);
      
    } catch (error) {
      logger.error('Error fetching applicants: ', error instanceof Error ? error : new Error(String(error)), { 
        component: 'useApplicantData' 
      });
      alert(t('jobPostingAdmin.alerts.fetchApplicantsFailed'));
    } finally {
      setLoadingApplicants(false);
    }
  }, [t]);

  // Load applicants when eventId changes
  useEffect(() => {
    if (eventId) {
      loadApplicants(eventId);
    }
  }, [eventId, loadApplicants]);

  const refreshApplicants = useCallback(() => {
    if (eventId) {
      loadApplicants(eventId);
    }
  }, [eventId, loadApplicants]);

  return {
    applicants,
    loadingApplicants,
    refreshApplicants
  };
};