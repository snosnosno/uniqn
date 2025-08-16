import React, { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { FaPhone, FaEnvelope, FaIdCard, FaStar, FaUser } from './Icons/ReactIconsReplacement';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Modal, { ModalFooter } from './ui/Modal';
import { StaffData } from '../hooks/useStaffManagement';

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

  // 사용자 프로필 데이터 가져오기
  useEffect(() => {
    const fetchUserProfile = async () => {
      // staff.userId 또는 staff.id를 사용 (staff 컬렉션에서 userId가 실제 사용자 ID)
      const userId = staff?.userId || staff?.id;
      if (!userId) {
        logger.debug('userId를 찾을 수 없습니다:', { component: 'StaffProfileModal', data: staff });
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
            ...userData,
            // userData의 값들을 우선 사용
            rating: userData.rating,
            ratingCount: userData.ratingCount,
            nationality: userData.nationality,
            region: userData.region,
            age: userData.age,
            experience: userData.experience,
            gender: userData.gender,
            bankName: userData.bankName,
            bankAccount: userData.bankAccount,
            residentId: userData.residentId,
            history: userData.history,
            notes: userData.notes || staff.notes
          } as ProfileData);
        } else {
          logger.debug('사용자 프로필 문서를 찾을 수 없습니다:', { component: 'StaffProfileModal', data: userId });
          setUserProfile(staff as ProfileData);
        }
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
    // actualStartTime/actualEndTime 우선, checkInTime/checkOutTime fallback
    const actualStartTime = workLogRecord?.workLog?.actualStartTime || attendanceRecord?.actualStartTime || attendanceRecord?.checkInTime;
    const actualEndTime = workLogRecord?.workLog?.actualEndTime || attendanceRecord?.actualEndTime || attendanceRecord?.checkOutTime;
    
    // workLogs의 예정 시간
    const workLogScheduledStart = attendanceRecord?.workLog?.scheduledStartTime || workLogRecord?.workLog?.scheduledStartTime;
    const workLogScheduledEnd = attendanceRecord?.workLog?.scheduledEndTime || workLogRecord?.workLog?.scheduledEndTime;
    
    // 시간 포맷팅
    const formatTime = (timeValue: any) => {
      if (!timeValue) return null;
      
      try {
        if (timeValue.toDate) {
          // Firestore Timestamp
          return timeValue.toDate().toLocaleTimeString('ko-KR', { 
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        } else if (typeof timeValue === 'string') {
          return timeValue;
        }
        return null;
      } catch (error) {
        logger.error('시간 포맷팅 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'StaffProfileModal' });
        return null;
      }
    };
    
    return {
      scheduledStart: formatTime(workLogScheduledStart) || staff.assignedTime || '미정',
      scheduledEnd: formatTime(workLogScheduledEnd) || '미정',
      actualStart: formatTime(actualStartTime),
      actualEnd: formatTime(actualEndTime)
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

  // 역할 표시 함수
  const getRoleDisplay = (role?: string) => {
    const roleMap: { [key: string]: string } = {
      'dealer': '딜러',
      'staff': '스태프',
      'admin': '관리자',
      'user': '사용자'
    };
    return role ? (roleMap[role] || role) : '역할 미정';
  };

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
          <p className="text-lg text-gray-600">
            {getRoleDisplay(staff.role)}
          </p>
        </div>

          
        {/* 연락처 정보 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <FaIdCard className="w-4 h-4 mr-2" />
            연락처 정보
          </h3>
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
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <FaUser className="w-4 h-4 mr-2" />
            상세 정보
          </h3>
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

        {/* 개인 정보 (정산시 필요) */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            개인 정보
            <span className="text-xs text-gray-500 ml-2 font-normal">(정산시 필요, 허가된 사람에게만 보입니다)</span>
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">주민등록번호</p>
                <p className="font-medium text-gray-900">{extendedStaff.residentId || '제공되지 않음'}</p>
              </div>
              <div>
                <p className="text-gray-600">은행명</p>
                <p className="font-medium text-gray-900">{extendedStaff.bankName || '제공되지 않음'}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-sm">계좌번호</p>
              <p className="font-medium text-gray-900">{extendedStaff.bankAccount || '제공되지 않음'}</p>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
};

export default StaffProfileModal;