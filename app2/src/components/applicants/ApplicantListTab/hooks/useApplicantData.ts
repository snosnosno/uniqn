import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../../utils/logger';
import { db } from '../../../../firebase';
import { Applicant } from '../types';
import { useApplicationData } from '../../../../hooks/useUnifiedData';
import { Application } from '../../../../types/unifiedData';

/**
 * 지원자 데이터를 관리하는 Custom Hook (UnifiedDataContext 통합)
 */
export const useApplicantData = (eventId?: string) => {
  const { t } = useTranslation();
  
  // UnifiedDataContext에서 applications 데이터 가져오기
  const { applications, loading, error, refresh } = useApplicationData();
  
  // eventId에 해당하는 applications 필터링 및 Applicant 타입으로 변환
  const applicants = useMemo(() => {
    if (!eventId) {
      logger.debug('🔍 useApplicantData: eventId가 없습니다', { component: 'useApplicantData' });
      return [];
    }
    
    logger.debug('🔍 useApplicantData: 지원서 필터링 시작', {
      component: 'useApplicantData',
      data: {
        eventId,
        totalApplications: applications.length,
        applicationsById: applications.map(app => ({ id: app.id, postId: app.postId }))
      }
    });
    
    const filteredApplications = applications.filter(app => 
      app.eventId === eventId || app.postId === eventId
    );
    
    logger.info('✅ useApplicantData: 지원서 필터링 완료', {
      component: 'useApplicantData',
      data: {
        eventId,
        filteredCount: filteredApplications.length,
        filteredApplications: filteredApplications.map(app => ({ 
          id: app.id, 
          postId: app.postId, 
          applicantName: app.applicantName,
          status: app.status
        }))
      }
    });
    
    return filteredApplications.map((app: Application) => {
      // Application 타입을 Applicant 타입으로 매핑
      let dateString = '';
      if (app.assignedDate) {
        try {
          if (app.assignedDate && typeof app.assignedDate === 'object' && 'toDate' in app.assignedDate) {
            // Firestore Timestamp 객체인 경우
            const date = (app.assignedDate as any).toDate();
            dateString = date.toISOString().split('T')[0]; // yyyy-MM-dd 형식
          } else if (typeof app.assignedDate === 'string') {
            dateString = app.assignedDate;
          }
        } catch (error) {
          logger.error('날짜 변환 오류:', error instanceof Error ? error : new Error(String(error)), { 
            component: 'useApplicantData' 
          });
        }
      }
      
      return {
        id: app.id,
        applicantId: app.applicantId,
        applicantName: app.applicantName,
        applicantPhone: app.applicantPhone,
        applicantEmail: app.applicantEmail,
        status: app.status,
        role: app.role,
        assignedRole: app.assignedRole || app.role,
        assignedTime: app.assignedTime,
        assignedDate: dateString || '',
        assignedRoles: app.assignedRoles || (app.assignedRole ? [app.assignedRole] : app.role ? [app.role] : []),
        assignedTimes: app.assignedTimes || (app.assignedTime ? [app.assignedTime] : []),
        assignedDates: dateString ? [dateString] : [],
        assignedDurations: [],
        confirmedRole: app.confirmedRole,
        confirmedTime: app.confirmedTime,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        appliedAt: app.appliedAt,
        confirmedAt: app.confirmedAt,
        eventId: app.postId
      } as Applicant;
    });
  }, [applications, eventId]);

  // 사용자 정보를 추가로 가져오는 상태
  const [applicantsWithUserInfo, setApplicantsWithUserInfo] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // 사용자 정보 추가 로딩
  useEffect(() => {
    const loadUserInfo = async () => {
      if (applicants.length === 0) {
        setApplicantsWithUserInfo([]);
        return;
      }

      setLoadingApplicants(true);
      try {
        const applicantsWithUserInfo = await Promise.all(
          applicants.map(async (applicant) => {
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
                  phone: userData.phone
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

        setApplicantsWithUserInfo(applicantsWithUserInfo);
      } catch (error) {
        logger.error('Error fetching user info: ', error instanceof Error ? error : new Error(String(error)), { 
          component: 'useApplicantData' 
        });
      } finally {
        setLoadingApplicants(false);
      }
    };

    loadUserInfo();
  }, [applicants]);

  const refreshApplicants = useCallback(() => {
    refresh();
  }, [refresh]);

  return {
    applicants: applicantsWithUserInfo,
    loadingApplicants: loading || loadingApplicants,
    refreshApplicants
  };
};