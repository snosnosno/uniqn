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
  // const { t } = useTranslation(); // 현재 미사용
  
  // UnifiedDataContext에서 applications 데이터 가져오기
  const { applications, loading, error: _error, refresh } = useApplicationData();
  
  // eventId에 해당하는 applications 필터링 및 Applicant 타입으로 변환
  const applicants = useMemo(() => {
    if (!eventId) {
      // logger.debug('🔍 useApplicantData: eventId가 없습니다', { component: 'useApplicantData' });
      return [];
    }
    
    // logger.debug('🔍 useApplicantData: 지원서 필터링 시작', {
    //   component: 'useApplicantData',
    //   data: {
    //     eventId,
    //     totalApplications: applications.length,
    //     applicationsById: applications.map(app => ({ id: app.id, postId: app.postId }))
    //   }
    // });
    
    const filteredApplications = applications.filter(app => 
      app.eventId === eventId || app.postId === eventId
    );
    
    // logger.info('✅ useApplicantData: 지원서 필터링 완료', {
    //   component: 'useApplicantData',
    //   data: {
    //     eventId,
    //     filteredCount: filteredApplications.length,
    //     filteredApplications: filteredApplications.map(app => ({ 
    //       id: app.id, 
    //       postId: app.postId, 
    //       applicantName: app.applicantName,
    //       status: app.status
    //     }))
    //   }
    // });
    
    return filteredApplications.map((app: Application) => {
      // Application 타입을 Applicant 타입으로 매핑
      // assignments에서 첫 번째 assignment의 정보를 사용 (하위 호환성)
      const firstAssignment = app.assignments && app.assignments.length > 0 ? app.assignments[0] : null;
      const assignedDate = firstAssignment && firstAssignment.dates.length > 0 ? firstAssignment.dates[0] : '';
      
      return {
        id: app.id,
        applicantId: app.applicantId,
        applicantName: app.applicantName,
        applicantPhone: app.applicantPhone,
        applicantEmail: app.applicantEmail,
        status: app.status,
        // 🔍 임시 디버깅: status 값 확인
        // ...(app.status && logger.debug('🔍 useApplicantData: applicant status', {
        //   component: 'useApplicantData',
        //   data: { 
        //     applicantName: app.applicantName, 
        //     status: app.status,
        //     statusType: typeof app.status,
        //     isConfirmed: app.status === 'confirmed',
        //     rawStatus: JSON.stringify(app.status)
        //   }
        // }) as any),
        role: firstAssignment?.role || '',
        assignedRole: firstAssignment?.role || '',
        assignedTime: firstAssignment?.timeSlot || '',
        assignedDate: assignedDate,
        assignedRoles: app.assignments?.map(a => a.role) || [],
        assignedTimes: app.assignments?.map(a => a.timeSlot) || [],
        assignedDates: app.assignments?.flatMap(a => a.dates) || [],
        assignedDurations: app.assignments?.map(a => a.duration || null) || [],
        assignedGroups: [], // 빈 배열로 초기화 (레거시 호환성)
        confirmedRole: firstAssignment?.role || '',
        confirmedTime: firstAssignment?.timeSlot || '',
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        appliedAt: app.appliedAt,
        confirmedAt: app.confirmedAt,
        eventId: app.eventId || app.postId,
        // 🎯 중요: assignments 필드 추가 - Firebase 데이터의 assignments 배열을 그대로 전달
        assignments: app.assignments || [],
        // 🆕 사전질문 답변 필드 추가
        preQuestionAnswers: app.preQuestionAnswers || []
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