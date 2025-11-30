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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 실제 데이터 구조가 { workLog?: WorkLog, status?: string, ... } 형태로 타입 정의와 불일치
  attendanceRecord?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 실제 데이터 구조가 { workLog?: WorkLog } 형태로 WorkLog 타입과 불일치
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
  workLogRecord,
}) => {
  const { t } = useTranslation();
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<PreQuestionAnswer[]>([]);

  // 사전질문 답변 로드 함수
  const loadPreQuestionAnswers = async (staff: StaffData, userId: string) => {
    try {
      const eventId = staff?.postingId;
      if (!eventId) {
        return;
      }

      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef,
        where('eventId', '==', eventId),
        where('applicantId', '==', userId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const applications = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt,
            preQuestionAnswers: data.preQuestionAnswers,
          };
        });

        applications.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        const latestApplication = applications[0];
        if (latestApplication && latestApplication.preQuestionAnswers) {
          setPreQuestionAnswers(latestApplication.preQuestionAnswers);
        }
      }
    } catch (error) {
      logger.error(
        '사전질문 답변 로드 오류:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'StaffProfileModal',
          data: { eventId: staff?.postingId, userId },
        }
      );
    }
  };

  // 사용자 프로필 데이터 가져오기
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!staff) return;

      // staff 데이터에 이미 추가 정보가 있는지 확인
      const hasExtendedInfo = staff.gender || staff.age || staff.experience || staff.nationality;

      if (hasExtendedInfo) {
        setUserProfile(staff as ProfileData);
        setLoading(false);
        return;
      }

      let userId = staff.userId || staff.id;

      if (userId && userId.includes('_')) {
        userId = userId.replace(/_\d+$/, '');
      }

      if (!userId) {
        logger.warn('⚠️ userId를 찾을 수 없음', { component: 'StaffProfileModal', data: staff });
        setUserProfile(staff as ProfileData);
        return;
      }

      setLoading(true);
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
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
            ratingCount: userData.ratingCount,
          } as ProfileData);
        } else {
          logger.warn('❌ 사용자 프로필 문서 없음:', {
            component: 'StaffProfileModal',
            data: {
              userId: userId,
              docPath: `users/${userId}`,
              staffId: staff.id,
              staffName: staff.name,
            },
          });
          setUserProfile(staff as ProfileData);
        }

        // 사전질문 답변 가져오기
        await loadPreQuestionAnswers(staff, userId);
      } catch (error) {
        logger.error(
          '사용자 프로필 로드 오류:',
          error instanceof Error ? error : new Error(String(error)),
          { component: 'StaffProfileModal' }
        );
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
    const actualStartTime =
      workLogRecord?.workLog?.actualStartTime || attendanceRecord?.actualStartTime;
    const actualEndTime = workLogRecord?.workLog?.actualEndTime || attendanceRecord?.actualEndTime;

    // workLogs의 예정 시간
    const workLogScheduledStart =
      attendanceRecord?.workLog?.scheduledStartTime || workLogRecord?.workLog?.scheduledStartTime;
    const workLogScheduledEnd =
      attendanceRecord?.workLog?.scheduledEndTime || workLogRecord?.workLog?.scheduledEndTime;

    // formatTime은 이미 utils/dateUtils에서 import됨

    return {
      scheduledStart:
        formatTime(workLogScheduledStart, { defaultValue: '' }) ||
        staff.assignedTime ||
        t('common.tbd', '미정'),
      scheduledEnd: formatTime(workLogScheduledEnd, { defaultValue: t('common.tbd', '미정') }),
      actualStart: formatTime(actualStartTime, { defaultValue: '' }),
      actualEnd: formatTime(actualEndTime, { defaultValue: '' }),
    };
  };

  getWorkTimes();

  // 출석 상태 계산
  const getAttendanceStatus = () => {
    const status = attendanceRecord?.status || workLogRecord?.workLog?.status || 'not_started';
    const statusMap: { [key: string]: { label: string; color: string } } = {
      not_started: {
        label: t('attendance.status.notStarted', '출근 전'),
        color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
      },
      checked_in: {
        label: t('attendance.status.checkedIn', '출근'),
        color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
      },
      checked_out: {
        label: t('attendance.status.checkedOut', '퇴근'),
        color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
      },
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
    if (!nationality) return t('common.notProvided', '제공되지 않음');
    const country = countries.find((c) => c.code === nationality);
    return country ? `${country.flag} ${country.name}` : nationality;
  };

  // 지역 표시
  const getRegionDisplay = (region?: string) => {
    const regionMap: { [key: string]: string } = {
      seoul: t('region.seoul', '서울'),
      gyeonggi: t('region.gyeonggi', '경기'),
      incheon: t('region.incheon', '인천'),
      gangwon: t('region.gangwon', '강원'),
      daejeon: t('region.daejeon', '대전'),
      sejong: t('region.sejong', '세종'),
      chungnam: t('region.chungnam', '충남'),
      chungbuk: t('region.chungbuk', '충북'),
      gwangju: t('region.gwangju', '광주'),
      jeonnam: t('region.jeonnam', '전남'),
      jeonbuk: t('region.jeonbuk', '전북'),
      daegu: t('region.daegu', '대구'),
      gyeongbuk: t('region.gyeongbuk', '경북'),
      busan: t('region.busan', '부산'),
      ulsan: t('region.ulsan', '울산'),
      gyeongnam: t('region.gyeongnam', '경남'),
      jeju: t('region.jeju', '제주'),
    };
    return region ? regionMap[region] || region : t('common.notProvided', '제공되지 않음');
  };

  const genderDisplay = (genderKey: string | undefined) => {
    if (!genderKey) return t('common.notProvided', '제공되지 않음');
    const genderMap: { [key: string]: string } = {
      male: t('gender.male', '남성'),
      female: t('gender.female', '여성'),
      other: t('gender.other', '기타'),
    };
    return genderMap[genderKey.toLowerCase()] || genderKey;
  };

  // 로딩 중이면 staff 데이터를 사용하고, 로드 완료되면 userProfile 사용
  const extendedStaff = userProfile || (staff as ProfileData);

  const footerButtons = (
    <ModalFooter>
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
      >
        {t('common.close', '닫기')}
      </button>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('staffProfile.title', '스태프 프로필')}
      size="lg"
      footer={footerButtons}
      aria-label={t('staffProfile.title', '스태프 프로필')}
    >
      <div className="space-y-6">
        {loading && (
          <div className="absolute inset-0 bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        )}
        {/* 헤더 - 이름과 역할 */}
        <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {staff.name || t('common.nameTbd', '이름 미정')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {getNationalityDisplay(extendedStaff.nationality)}
          </p>
          {extendedStaff.rating && (
            <div className="flex items-center justify-center mb-2">
              <FaStar className="w-5 h-5 text-yellow-400 mr-1" />
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {t('staffProfile.rating', '평점')} {extendedStaff.rating.toFixed(1)}
              </span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">
                (
                {t('staffProfile.ratingCount', '{{count}}개 평점', {
                  count: extendedStaff.ratingCount || 0,
                })}
                )
              </span>
            </div>
          )}
        </div>

        {/* 사전질문 답변 */}
        {preQuestionAnswers && preQuestionAnswers.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('staffProfile.preQuestionAnswers', '사전질문 답변')}
            </h3>
            <div className="space-y-3">
              {preQuestionAnswers.map((answer, index) => (
                <div
                  key={answer.questionId || index}
                  className="border-l-2 border-yellow-300 dark:border-yellow-700 pl-3"
                >
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Q{index + 1}. {answer.question}
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {answer.answer || t('common.noAnswer', '답변 없음')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 연락처 정보 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="space-y-3">
            {staff.phone ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm">
                  <FaPhone className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                  <span className="text-gray-900 dark:text-gray-100">{staff.phone}</span>
                </div>
                <a
                  href={`tel:${staff.phone}`}
                  className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  {t('staffProfile.call', '전화하기')}
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                {t('staffProfile.noPhone', '전화번호 없음')}
              </p>
            )}

            {staff.email ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm">
                  <FaEnvelope className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                  <span className="text-gray-900 dark:text-gray-100 break-all">{staff.email}</span>
                </div>
                <a
                  href={`mailto:${staff.email}`}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  {t('staffProfile.email', '이메일')}
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                {t('staffProfile.noEmail', '이메일 없음')}
              </p>
            )}
          </div>
        </div>

        {/* 상세 정보 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {t('staffProfile.gender', '성별')}
              </p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {genderDisplay(extendedStaff.gender)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {t('staffProfile.age', '나이')}
              </p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {extendedStaff.age
                  ? t('staffProfile.ageYears', '{{age}}세', { age: extendedStaff.age })
                  : t('common.notProvided', '제공되지 않음')}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {t('staffProfile.region', '지역')}
              </p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {getRegionDisplay(extendedStaff.region)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {t('staffProfile.experience', '경력')}
              </p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {extendedStaff.experience || t('common.notProvided', '제공되지 않음')}
              </p>
            </div>
          </div>
        </div>

        {/* 이력 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('staffProfile.history', '이력')}
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {extendedStaff.history || t('common.notProvided', '제공되지 않음')}
          </p>
        </div>

        {/* 기타 사항 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('staffProfile.notes', '기타 사항')}
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {extendedStaff.notes || staff.notes || t('common.none', '없음')}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default StaffProfileModal;
