import React, { useEffect, useState } from 'react';
import { logger } from '../../utils/logger';
import { formatTime } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { FaPhone, FaEnvelope, FaStar } from '../Icons/ReactIconsReplacement';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import Modal, { ModalFooter } from '../ui/Modal';
import { StaffData } from '../../hooks/useStaffManagement';
import { PreQuestionAnswer } from '../../types/jobPosting';

interface StaffProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffData | null;
  attendanceRecord?: any;
  workLogRecord?: any;
}

interface ProfileData extends StaffData {
  rating?: number;
  ratingCount?: number;
  nationality?: string;
  region?: string;
  age?: number;
  experience?: string;
  gender?: string;
  bankName?: string;
  bankAccount?: string;
  residentId?: string;
  history?: string;
  preQuestionAnswers?: PreQuestionAnswer[];
}

const StaffProfileModal: React.FC<StaffProfileModalProps> = ({
  isOpen,
  onClose,
  staff,
  attendanceRecord,
  workLogRecord
}) => {
  useTranslation();
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<PreQuestionAnswer[]>([]);

  // 사전질문 답변 로드 함수
  const loadPreQuestionAnswers = async (staff: StaffData, userId: string) => {
    try {
      // postingId 확인 (여러 필드에서 확인)
      const eventId = staff?.postingId;
      if (!eventId) {
        logger.debug('postingId를 찾을 수 없습니다:', { 
          component: 'StaffProfileModal', 
          data: { staff: staff?.name, postingId: eventId } 
        });
        return;
      }

      logger.debug('🔍 사전질문 답변 조회 시작:', { 
        component: 'StaffProfileModal', 
        data: { eventId, userId, staffName: staff.name }
      });

      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef, 
        where('eventId', '==', eventId),
        where('applicantId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // 가장 최근 지원서를 사용 (여러 개 있을 경우)
        const applications = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt,
            preQuestionAnswers: data.preQuestionAnswers
          };
        });
        
        // createdAt 기준으로 정렬하여 가장 최근 것 사용
        applications.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        const latestApplication = applications[0];
        if (latestApplication && latestApplication.preQuestionAnswers) {
          logger.debug('🔍 사전질문 답변 로드 성공:', { 
            component: 'StaffProfileModal', 
            data: { 
              count: latestApplication.preQuestionAnswers.length,
              applicationId: latestApplication.id 
            }
          });
          setPreQuestionAnswers(latestApplication.preQuestionAnswers);
        } else {
          logger.debug('사전질문 답변이 없습니다:', { 
            component: 'StaffProfileModal', 
            data: { applicationId: latestApplication?.id }
          });
        }
      } else {
        logger.debug('해당하는 지원서를 찾을 수 없습니다:', { 
          component: 'StaffProfileModal', 
          data: { eventId, userId }
        });
      }
    } catch (error) {
      logger.error('사전질문 답변 로드 오류:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'StaffProfileModal',
        data: { eventId: staff?.postingId, userId }
      });
    }
  };

  // 사용자 프로필 데이터 가져오기
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!staff) return;
      
      // staff 데이터에 이미 추가 정보가 있는지 확인
      const hasExtendedInfo = staff.gender || staff.age || staff.experience || staff.nationality;
      
      if (hasExtendedInfo) {
        // staff 데이터에 이미 추가 정보가 포함되어 있으면 바로 사용
        logger.debug('🔍 Staff 데이터에서 추가 정보 사용:', { component: 'StaffProfileModal', data: staff });
        setUserProfile(staff as ProfileData);
        setLoading(false);
        return;
      }
      
      // staff 데이터에 추가 정보가 없으면 users 컬렉션에서 조회
      const userId = staff.userId || staff.id;
      if (!userId) {

        setUserProfile(staff as ProfileData);
        return;
      }
      
      setLoading(true);
      try {
        logger.debug('🔍 사용자 프로필 조회 시작:', { component: 'StaffProfileModal', data: userId });
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          logger.debug('🔍 사용자 프로필 데이터 로드:', { component: 'StaffProfileModal', data: userData });
          setUserProfile({
            ...staff,
            // userData의 값들을 우선 사용 (staff에 없는 경우)
            nationality: staff.nationality || userData.nationality,
            region: staff.region || userData.region,
            age: staff.age || userData.age,
            experience: staff.experience || userData.experience,
            gender: staff.gender || userData.gender,
            bankName: staff.bankName || userData.bankName,
            bankAccount: staff.bankAccount || userData.bankAccount,
            residentId: staff.residentId || userData.residentId,
            history: staff.history || userData.history,
            notes: staff.notes || userData.notes,
            // 평점은 users에서만 가져옴 (제외 요청되었지만 기존 코드 호환성)
            rating: userData.rating,
            ratingCount: userData.ratingCount
          } as ProfileData);
        } else {

          setUserProfile(staff as ProfileData);
        }

        // 사전질문 답변 가져오기
        await loadPreQuestionAnswers(staff, userId);
      } catch (error) {
        logger.error('사용자 프로필 로드 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'StaffProfileModal' });
        setUserProfile(staff as ProfileData);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && staff) {
      fetchUserProfile();
    }
  }, [isOpen, staff]);

  if (!staff) return null;

  // 출근/퇴근 시간 계산
  const getWorkTimes = () => {
    // actualStartTime/actualEndTime 사용
    const actualStartTime = workLogRecord?.workLog?.actualStartTime || attendanceRecord?.actualStartTime;
    const actualEndTime = workLogRecord?.workLog?.actualEndTime || attendanceRecord?.actualEndTime;
    
    // workLogs의 예정 시간
    const workLogScheduledStart = attendanceRecord?.workLog?.scheduledStartTime || workLogRecord?.workLog?.scheduledStartTime;
    const workLogScheduledEnd = attendanceRecord?.workLog?.scheduledEndTime || workLogRecord?.workLog?.scheduledEndTime;
    
    // formatTime은 이미 utils/dateUtils에서 import됨
    
    return {
      scheduledStart: formatTime(workLogScheduledStart, { defaultValue: '' }) || staff.assignedTime || '미정',
      scheduledEnd: formatTime(workLogScheduledEnd, { defaultValue: '미정' }),
      actualStart: formatTime(actualStartTime, { defaultValue: '' }),
      actualEnd: formatTime(actualEndTime, { defaultValue: '' })
    };
  };

  getWorkTimes();

  // 출석 상태 계산
  const getAttendanceStatus = () => {
    const status = attendanceRecord?.status || workLogRecord?.workLog?.status || 'not_started';
    const statusMap: { [key: string]: { label: string; color: string } } = {
      'not_started': { label: '출근 전', color: 'text-gray-600 bg-gray-100' },
      'checked_in': { label: '출근', color: 'text-green-600 bg-green-100' },
      'checked_out': { label: '퇴근', color: 'text-blue-600 bg-blue-100' }
    };
    
    return statusMap[status] || statusMap['not_started'];
  };

  getAttendanceStatus();

  // 국가 표시
  const countries = [
    { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: 'CN', name: 'China', flag: '🇨🇳' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  ];

  const getNationalityDisplay = (nationality?: string) => {
    if (!nationality) return '제공되지 않음';
    const country = countries.find(c => c.code === nationality);
    return country ? `${country.flag} ${country.name}` : nationality;
  };

  // 지역 표시
  const getRegionDisplay = (region?: string) => {
    const regionMap: { [key: string]: string } = {
      'seoul': '서울',
      'gyeonggi': '경기',
      'incheon': '인천',
      'gangwon': '강원',
      'daejeon': '대전',
      'sejong': '세종',
      'chungnam': '충남',
      'chungbuk': '충북',
      'gwangju': '광주',
      'jeonnam': '전남',
      'jeonbuk': '전북',
      'daegu': '대구',
      'gyeongbuk': '경북',
      'busan': '부산',
      'ulsan': '울산',
      'gyeongnam': '경남',
      'jeju': '제주',
    };
    return region ? (regionMap[region] || region) : '제공되지 않음';
  };

  const genderDisplay = (genderKey: string | undefined) => {
    if (!genderKey) return '제공되지 않음';
    const genderMap: { [key: string]: string } = {
      'male': '남성',
      'female': '여성',
      'other': '기타'
    };
    return genderMap[genderKey.toLowerCase()] || genderKey;
  };

  // 로딩 중이면 staff 데이터를 사용하고, 로드 완료되면 userProfile 사용
  const extendedStaff = userProfile || (staff as ProfileData);


  const footerButtons = (
    <ModalFooter>
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
      >
        닫기
      </button>
    </ModalFooter>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="스태프 프로필"
      size="lg"
      footer={footerButtons}
      aria-label="스태프 프로필"
    >
      <div className="space-y-6">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        {/* 헤더 - 이름과 역할 */}
        <div className="text-center pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {staff.name || '이름 미정'}
          </h2>
          <p className="text-sm text-gray-500 mb-2">
            {getNationalityDisplay(extendedStaff.nationality)}
          </p>
          {extendedStaff.rating && (
            <div className="flex items-center justify-center mb-2">
              <FaStar className="w-5 h-5 text-yellow-400 mr-1" />
              <span className="font-medium">평점 {extendedStaff.rating.toFixed(1)}</span>
              <span className="text-gray-500 ml-1">({extendedStaff.ratingCount || 0}개 평점)</span>
            </div>
          )}
        </div>

        {/* 사전질문 답변 */}
        {preQuestionAnswers && preQuestionAnswers.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">사전질문 답변</h3>
            <div className="space-y-3">
              {preQuestionAnswers.map((answer, index) => (
                <div key={answer.questionId || index} className="border-l-2 border-yellow-300 pl-3">
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    Q{index + 1}. {answer.question}
                  </p>
                  <p className="text-sm text-gray-800">
                    {answer.answer || '답변 없음'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 연락처 정보 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-3">
            {staff.phone ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm">
                  <FaPhone className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{staff.phone}</span>
                </div>
                <a
                  href={`tel:${staff.phone}`}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium hover:bg-green-200 transition-colors"
                >
                  전화하기
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">전화번호 없음</p>
            )}
            
            {staff.email ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm">
                  <FaEnvelope className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900 break-all">{staff.email}</span>
                </div>
                <a
                  href={`mailto:${staff.email}`}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
                >
                  이메일
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">이메일 없음</p>
            )}
          </div>
        </div>

        {/* 상세 정보 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">성별</p>
              <p className="font-medium text-gray-900">{genderDisplay(extendedStaff.gender)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">나이</p>
              <p className="font-medium text-gray-900">{extendedStaff.age ? `${extendedStaff.age}세` : '제공되지 않음'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">지역</p>
              <p className="font-medium text-gray-900">{getRegionDisplay(extendedStaff.region)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">경력</p>
              <p className="font-medium text-gray-900">{extendedStaff.experience || '제공되지 않음'}</p>
            </div>
          </div>
        </div>

        {/* 이력 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">이력</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {extendedStaff.history || '제공되지 않음'}
          </p>
        </div>

        {/* 기타 사항 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">기타 사항</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {extendedStaff.notes || staff.notes || '없음'}
          </p>
        </div>

      </div>
    </Modal>
  );
};

export default StaffProfileModal;