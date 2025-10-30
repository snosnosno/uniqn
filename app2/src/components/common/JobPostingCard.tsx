import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement, JobPostingUtils } from '../../types/jobPosting';
import { formatDate as formatDateUtil, formatDateRangeDisplay, generateDateRange, convertToDateString } from '../../utils/jobPosting/dateUtils';
import { formatSalaryDisplay, getBenefitDisplayNames, getStatusDisplayName, getTypeDisplayName, formatRoleSalaryDisplay } from '../../utils/jobPosting/jobPostingHelpers';
import { timestampToLocalDateString } from '../../utils/dateUtils';
import { useDateUtils } from '../../hooks/useDateUtils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import { extractNameFromDisplayName, extractNicknameFromDisplayName } from '../../utils/userUtils';

export interface JobPostingCardProps {
  post: JobPosting & { applicationCount?: number };
  variant: 'admin-list' | 'user-card' | 'detail-info';
  renderActions?: (post: JobPosting) => React.ReactNode;
  renderExtra?: (post: JobPosting) => React.ReactNode;
  showStatus?: boolean;
  showApplicationCount?: boolean;
  className?: string;
}

/**
 * 공통 구인공고 카드 컴포넌트
 * 모든 페이지에서 일관된 공고 정보 표시를 위한 공통 컴포넌트
 */
const JobPostingCard: React.FC<JobPostingCardProps> = ({
  post,
  variant,
  renderActions,
  renderExtra,
  showStatus = true,
  showApplicationCount = false,
  className = ''
}) => {
  const { t } = useTranslation();
  const { formatDateDisplay } = useDateUtils();
  const [creatorInfo, setCreatorInfo] = useState<{ name: string; nickname?: string } | null>(null);

  // 구인자 정보 가져오기
  useEffect(() => {
    const fetchCreatorInfo = async () => {
      if (!post.createdBy) {
        logger.warn('구인자 정보 없음: createdBy 필드가 없습니다', {
          component: 'JobPostingCard',
          data: { postId: post.id, title: post.title }
        });
        return;
      }

      try {
        logger.info('구인자 정보 조회 시작', {
          component: 'JobPostingCard',
          data: { postId: post.id, createdBy: post.createdBy }
        });

        // 1. 프로필의 name, nickname 확인
        const profileDocRef = doc(db, 'users', post.createdBy, 'profile', 'basic');
        const profileDoc = await getDoc(profileDocRef);

        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          const profileName = profileData?.name;
          const profileNickname = profileData?.nickname;

          if (profileName) {
            logger.info('프로필에서 구인자 이름 발견', {
              component: 'JobPostingCard',
              data: { name: profileName, nickname: profileNickname }
            });

            // exactOptionalPropertyTypes를 위해 조건부로 객체 생성
            if (profileNickname) {
              setCreatorInfo({ name: profileName, nickname: profileNickname });
            } else {
              setCreatorInfo({ name: profileName });
            }
            return;
          }
        }

        // 2. users 문서에서 여러 필드 확인
        const userDocRef = doc(db, 'users', post.createdBy);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();

          // displayName이 있으면 이름과 닉네임 추출
          if (userData?.displayName) {
            const name = extractNameFromDisplayName(userData.displayName);
            const nickname = extractNicknameFromDisplayName(userData.displayName);

            logger.info('users 문서의 displayName에서 구인자 정보 발견', {
              component: 'JobPostingCard',
              data: { displayName: userData.displayName, extractedName: name, extractedNickname: nickname }
            });

            // exactOptionalPropertyTypes를 위해 조건부로 객체 생성
            if (nickname) {
              setCreatorInfo({ name, nickname });
            } else {
              setCreatorInfo({ name });
            }
            return;
          }

          // name과 nickname 필드가 있으면 사용
          if (userData?.name) {
            logger.info('users 문서의 name 필드에서 구인자 이름 발견', {
              component: 'JobPostingCard',
              data: { name: userData.name, nickname: userData.nickname }
            });

            // exactOptionalPropertyTypes를 위해 조건부로 객체 생성
            if (userData.nickname) {
              setCreatorInfo({ name: userData.name, nickname: userData.nickname });
            } else {
              setCreatorInfo({ name: userData.name });
            }
            return;
          }

          // email을 fallback으로 사용
          if (userData?.email) {
            logger.info('users 문서의 email을 fallback으로 사용', {
              component: 'JobPostingCard',
              data: { email: userData.email }
            });
            setCreatorInfo({ name: userData.email });
            return;
          }

          logger.warn('users 문서에 이름 정보가 없습니다', {
            component: 'JobPostingCard',
            data: { userId: post.createdBy, availableFields: Object.keys(userData) }
          });
        } else {
          logger.warn('users 문서가 존재하지 않습니다', {
            component: 'JobPostingCard',
            data: { userId: post.createdBy }
          });
        }
      } catch (error) {
        logger.error('구인자 정보 조회 오류', error instanceof Error ? error : new Error(String(error)), {
          component: 'JobPostingCard',
          data: { postId: post.id, createdBy: post.createdBy }
        });
      }
    };

    fetchCreatorInfo();
  }, [post.createdBy, post.id, post.title]);

  // 구인자 표시 텍스트 생성
  const getCreatorDisplayText = () => {
    if (!creatorInfo) return '';

    // 닉네임이 있으면 "이름(닉네임)" 형식으로 표시
    if (creatorInfo.nickname) {
      return `구인자: ${creatorInfo.name}(${creatorInfo.nickname})`;
    }

    return `구인자: ${creatorInfo.name}`;
  };

  // 날짜 변환 처리
  const formatDate = (date: string | Date | { toDate: () => Date } | { seconds: number } | null | undefined): string => {
    if (!date) return '미정';
    
    // Firebase Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
      return formatDateUtil(date.toDate());
    }
    
    // seconds 형식 (Firebase에서 가져온 데이터)
    if (date && typeof date === 'object' && 'seconds' in date) {
      return formatDateUtil(new Date(date.seconds * 1000));
    }
    
    // 일반 Date 객체나 문자열
    return formatDateUtil(date);
  };

  // 날짜 범위 표시 개선
  const getDateRangeDisplay = () => {
    const dates: string[] = [];
    
    // 모든 날짜 수집
    post.dateSpecificRequirements?.forEach(req => {
      dates.push(convertToDateString(req.date));
      
      // multi duration 처리
      req.timeSlots?.forEach(slot => {
        if (slot.duration?.type === 'multi' && slot.duration.endDate) {
          const rangeDates = generateDateRange(
            convertToDateString(req.date),
            slot.duration.endDate
          );
          // 시작일 제외하고 추가 (중복 방지)
          rangeDates.slice(1).forEach(d => dates.push(d));
        }
      });
    });
    
    // 중복 제거 및 정렬
    const uniqueDates = Array.from(new Set(dates)).sort();
    
    return formatDateRangeDisplay(uniqueDates);
  };
  
  const dateRangeDisplay = getDateRangeDisplay();

  // 전체 진행률 계산 (관리자용)
  const getProgressInfo = () => {
    if (variant !== 'admin-list') return null;
    
    const progressMap = JobPostingUtils.getRequirementProgress(post);
    let totalConfirmed = 0;
    let totalRequired = 0;
    
    progressMap.forEach(progress => {
      totalConfirmed += progress.confirmed;
      totalRequired += progress.required;
    });

    return { totalConfirmed, totalRequired };
  };

  const _progressInfo = getProgressInfo();

  // variant별 레이아웃 클래스
  const getContainerClasses = () => {
    const baseClasses = 'bg-white dark:bg-gray-800 shadow rounded-lg';

    switch (variant) {
      case 'admin-list':
        return `${baseClasses} hover:bg-gray-50 dark:hover:bg-gray-700`;
      case 'user-card':
        return `${baseClasses} overflow-hidden`;
      case 'detail-info':
        return `${baseClasses} shadow-md`;
      default:
        return baseClasses;
    }
  };

  const getContentClasses = () => {
    switch (variant) {
      case 'admin-list':
        return 'p-3 sm:p-4 md:p-6';
      case 'user-card':
        return 'p-3 sm:p-4 md:p-6';
      case 'detail-info':
        return 'p-3 sm:p-4 md:p-6';
      default:
        return 'p-3 sm:p-4 md:p-6';
    }
  };

  // 기본 정보 섹션 레이아웃 클래스
  const getBasicInfoClasses = () => {
    switch (variant) {
      case 'admin-list':
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3';
      case 'user-card':
        return 'space-y-2 mb-3';
      case 'detail-info':
        return 'grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-300 mb-4';
      default:
        return 'space-y-2 mb-3';
    }
  };

  // 정보 아이템 클래스
  const getInfoItemClasses = () => {
    switch (variant) {
      case 'admin-list':
        return 'flex items-center min-w-0';
      case 'user-card':
        return 'text-sm text-gray-500 dark:text-gray-400';
      case 'detail-info':
        return 'flex items-center min-w-0';
      default:
        return 'text-sm text-gray-500 dark:text-gray-400';
    }
  };

  // 시간대 및 역할 렌더링
  const renderTimeSlots = () => {
    // 날짜별 요구사항 표시
    const dateReqs = post.dateSpecificRequirements || [];
    if (dateReqs.length > 0) {
      // 모든 날짜를 표시하도록 변경 (expandTimeSlots 조건 제거)
      const displayReqs = dateReqs;

      return (
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {displayReqs.map((req: DateSpecificRequirement, index: number) => {
            // 다중일 체크 - 첫 번째 timeSlot의 duration을 확인 (모든 timeSlot이 동일한 duration을 가짐)
            const firstTimeSlot = req.timeSlots?.[0];
            const hasMultiDuration = firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;
            
            let dateDisplay = formatDate(req.date);
            if (hasMultiDuration && firstTimeSlot?.duration?.endDate) {
              dateDisplay = `${formatDate(req.date)} ~ ${formatDate(firstTimeSlot.duration.endDate)}`;
            }
            
            return (
              <div key={index} className="mb-3">
                <div className="font-medium text-gray-700 dark:text-gray-200 mb-1 flex items-center text-sm">
                  📅 {dateDisplay} 일정
                </div>
              <div className="ml-4 space-y-1">
                {(req.timeSlots || []).map((ts: TimeSlot, tsIndex: number) => (
                  <div key={tsIndex} className="mb-2">
                    {ts.isTimeToBeAnnounced ? (
                      <>
                        <>
                          {(ts.roles || []).map((role: RoleRequirement, roleIndex: number) => {
                            const dateString = timestampToLocalDateString(req.date);
                            const confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                              post,
                              dateString,
                              ts.time,
                              role.name
                            );
                            const isFull = confirmedCount >= role.count;
                            return (
                              <div key={roleIndex} className="text-sm text-gray-600 dark:text-gray-300">
                                {roleIndex === 0 ? (
                                  <>
                                    <span className="font-medium text-orange-600 dark:text-orange-400">
                                      미정
                                      {ts.tentativeDescription && (
                                        <span className="text-gray-600 dark:text-gray-300 font-normal ml-1">({ts.tentativeDescription})</span>
                                      )}
                                    </span>
                                    <span className="ml-3">
                                      {t(`roles.${role.name}`, role.name)}: {role.count}명
                                      <span className={`ml-1 ${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        ({confirmedCount}/{role.count})
                                      </span>
                                    </span>
                                  </>
                                ) : (
                                  <div className="pl-[50px]">
                                    {t(`roles.${role.name}`, role.name)}: {role.count}명
                                    <span className={`ml-1 ${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                      ({confirmedCount}/{role.count})
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      </>
                    ) : (
                      <>
                        <>
                          {(ts.roles || []).map((role: RoleRequirement, roleIndex: number) => {
                            const dateString = timestampToLocalDateString(req.date);
                            const confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                              post,
                              dateString,
                              ts.time,
                              role.name
                            );
                            const isFull = confirmedCount >= role.count;
                            return (
                              <div key={roleIndex} className="text-sm text-gray-600 dark:text-gray-300">
                                {roleIndex === 0 ? (
                                  <>
                                    <span className="font-medium text-gray-700 dark:text-gray-200">{ts.time}</span>
                                    <span className="ml-3">
                                      {t(`roles.${role.name}`, role.name)}: {role.count}명
                                      <span className={`ml-1 ${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        ({confirmedCount}/{role.count})
                                      </span>
                                    </span>
                                  </>
                                ) : (
                                  <div className="pl-[50px]">
                                    {t(`roles.${role.name}`, role.name)}: {role.count}명
                                    <span className={`ml-1 ${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                      ({confirmedCount}/{role.count})
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      );
    } else {
      // 날짜별 요구사항이 없는 경우
      return (
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          시간대 정보가 없습니다.
        </div>
      );
    }
  };

  // 사용자 카드용 상세 시간대 렌더링
  const renderDetailedTimeSlots = () => {
    if (variant !== 'user-card') return null;

    if ((post.dateSpecificRequirements || []).length > 0) {
      return (
        <div className="mb-2">
          <div className="space-y-2">
            {post.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => {
              // 다중일 체크 - 첫 번째 timeSlot의 duration을 확인 (모든 timeSlot이 동일한 duration을 가짐)
              const firstTimeSlot = dateReq.timeSlots?.[0];
              const hasMultiDuration = firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;
              
              let dateDisplay = formatDateUtil(dateReq.date);
              let expandedDates: string[] = [];
              
              if (hasMultiDuration && firstTimeSlot?.duration?.endDate) {
                const startDate = convertToDateString(dateReq.date);
                const endDate = convertToDateString(firstTimeSlot.duration.endDate);
                expandedDates = generateDateRange(startDate, endDate);
                dateDisplay = `${formatDateUtil(dateReq.date)} ~ ${formatDateUtil(firstTimeSlot.duration.endDate)}`;
              }
              
              return (
                <div key={dateIndex} className="">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    📅 {dateDisplay}
                    {expandedDates.length > 0 && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                        {expandedDates.length}일
                      </span>
                    )}
                  </div>
                <div className="space-y-2">
                  {(dateReq.timeSlots || []).map((ts: TimeSlot, tsIndex: number) => (
                    <div key={`${dateIndex}-${tsIndex}`} className="ml-2 mb-2">
                      {ts.isTimeToBeAnnounced ? (
                        <>
                          {(ts.roles || []).map((r: RoleRequirement, roleIndex: number) => {
                            // 다중일인 경우 모든 날짜의 확정 인원 합산
                            let confirmedCount = 0;
                            let confirmedCountPerDay = 0;

                            if (expandedDates.length > 0) {
                              // 다중일 근무는 첫 날 기준으로만 확정 인원 계산
                              // (같은 사람이 여러 날 근무하는 개념)
                              confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                                post,
                                expandedDates[0] || '', // 첫 날짜만 사용
                                ts.time,
                                r.name
                              );
                              confirmedCountPerDay = confirmedCount;
                            } else {
                              // 단일 날짜
                              const dateString = timestampToLocalDateString(dateReq.date);
                              confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                                post,
                                dateString,
                                ts.time,
                                r.name
                              );
                              confirmedCountPerDay = confirmedCount;
                            }
                            
                            const displayCount = expandedDates.length > 0 ? confirmedCountPerDay : confirmedCount;
                            const isFull = displayCount >= r.count;
                            return (
                              <div key={roleIndex} className="text-sm text-gray-600 dark:text-gray-300">
                                {roleIndex === 0 ? (
                                  <>
                                    <span className="font-medium text-orange-600 dark:text-orange-400">
                                      미정
                                      {ts.tentativeDescription && (
                                        <span className="text-gray-600 dark:text-gray-300 font-normal ml-1">({ts.tentativeDescription})</span>
                                      )}
                                    </span>
                                    <span className="ml-3">
                                      {t(`roles.${r.name}`, r.name)}: {r.count}명
                                      {expandedDates.length > 0 && (
                                        <span className="text-blue-600 dark:text-blue-400 ml-1">({expandedDates.length}일)</span>
                                      )}
                                      <span className={`ml-1 ${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        {isFull ? '(마감)' : `(${displayCount}/${r.count})`}
                                      </span>
                                    </span>
                                  </>
                                ) : (
                                  <div className="pl-[50px]">
                                    {t(`roles.${r.name}`, r.name)}: {r.count}명
                                    {expandedDates.length > 0 && (
                                      <span className="text-blue-600 dark:text-blue-400 ml-1">({expandedDates.length}일)</span>
                                    )}
                                    <span className={`ml-1 ${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                      {isFull ? '(마감)' : `(${displayCount}/${r.count})`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          {(ts.roles || []).map((r: RoleRequirement, roleIndex: number) => {
                            // 다중일인 경우 모든 날짜의 확정 인원 합산
                            let confirmedCount = 0;
                            let confirmedCountPerDay = 0;

                            if (expandedDates.length > 0) {
                              // 다중일 근무는 첫 날 기준으로만 확정 인원 계산
                              // (같은 사람이 여러 날 근무하는 개념)
                              confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                                post,
                                expandedDates[0] || '', // 첫 날짜만 사용
                                ts.time,
                                r.name
                              );
                              confirmedCountPerDay = confirmedCount;
                            } else {
                              // 단일 날짜
                              const dateString = timestampToLocalDateString(dateReq.date);
                              confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                                post,
                                dateString,
                                ts.time,
                                r.name
                              );
                              confirmedCountPerDay = confirmedCount;
                            }
                            
                            const displayCount = expandedDates.length > 0 ? confirmedCountPerDay : confirmedCount;
                            const isFull = displayCount >= r.count;
                            return (
                              <div key={roleIndex} className="text-sm text-gray-600 dark:text-gray-300">
                                {roleIndex === 0 ? (
                                  <>
                                    <span className="font-medium text-gray-700 dark:text-gray-200">{ts.time}</span>
                                    <span className="ml-3">
                                      {t(`roles.${r.name}`, r.name)}: {r.count}명
                                      {expandedDates.length > 0 && (
                                        <span className="text-blue-600 dark:text-blue-400 ml-1">({expandedDates.length}일)</span>
                                      )}
                                      <span className={`ml-1 ${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        {isFull ? '(마감)' : `(${displayCount}/${r.count})`}
                                      </span>
                                    </span>
                                  </>
                                ) : (
                                  <div className="pl-[50px]">
                                    {t(`roles.${r.name}`, r.name)}: {r.count}명
                                    {expandedDates.length > 0 && (
                                      <span className="text-blue-600 dark:text-blue-400 ml-1">({expandedDates.length}일)</span>
                                    )}
                                    <span className={`ml-1 ${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                      {isFull ? '(마감)' : `(${displayCount}/${r.count})`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    } else {
      return (
        <div className="mb-4">
          <div className="font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center text-sm">
            <span className="mr-2">⏰</span>
            <span>모집 시간대</span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            시간대 정보가 없습니다.
          </div>
        </div>
      );
    }
  };

  return (
    <div className={`${getContainerClasses()} ${className}`}>
      <div className={getContentClasses()}>
        <div className={variant === 'user-card' ? 'flex flex-col lg:flex-row lg:items-start lg:justify-between' : 'flex justify-between items-start'}>
          <div className={variant === 'user-card' ? 'flex-1 mb-4 lg:mb-0' : 'flex-1 min-w-0'}>
            {/* 제목과 상태/타입 배지 */}
            <div className="flex items-center space-x-2 mb-2">
              <h3 className={`font-medium text-gray-900 dark:text-gray-100 truncate ${
                variant === 'user-card' ? 'text-base sm:text-lg font-semibold break-words max-w-full' : 'text-lg'
              }`}>
                {post.title}
              </h3>
              
              {/* 상태 배지 (모집중/마감) */}
              {showStatus && post.status && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  post.status === 'open'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : post.status === 'closed'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                }`}>
                  {getStatusDisplayName(post.status)}
                </span>
              )}
              
              {/* 모집타입 배지 (고정/지원) */}
              {post.recruitmentType && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  post.recruitmentType === 'fixed'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                }`}>
                  {post.recruitmentType === 'fixed' ? '고정' : '지원'}
                </span>
              )}
            </div>

            {/* 기본 정보 */}
            <div className={getBasicInfoClasses()}>
              {/* 날짜 */}
              <div className={getInfoItemClasses()}>
                <span className="flex items-center">
                  <span className="mr-2">📅</span>
                  <span className="break-words whitespace-pre-line">{dateRangeDisplay}</span>
                </span>
              </div>
              
              {/* 위치 */}
              <div className={getInfoItemClasses()}>
                <span className="flex items-center">
                  <span className="mr-2">📍</span>
                  <span className="break-words">
                    {/* 지역(시/군/구) 상세주소 형식으로 표시 */}
                    {post.location}
                    {post.district && `(${post.district})`}
                    {post.detailedAddress && ` ${post.detailedAddress}`}
                  </span>
                </span>
              </div>

              {/* 문의 연락처는 하단으로 이동 */}

              {/* 유형 (관리자용) */}
              {variant === 'admin-list' && post.type && (
                <div className={getInfoItemClasses()}>
                  <span className="flex items-center">
                    <span className="mr-2">📋</span>
                    <span>{getTypeDisplayName(post.type)}</span>
                  </span>
                </div>
              )}
              
              
              {/* 급여 */}
              {post.useRoleSalary && post.roleSalaries ? (
                <div className={variant === 'admin-list' ? 'col-span-full' : getInfoItemClasses()}>
                  <span className="flex items-start">
                    <span className="mr-2 mt-0.5">💰</span>
                    <div className="break-words">
                      <span className="font-medium text-gray-700 dark:text-gray-200">역할별 급여</span>
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(post.roleSalaries).slice(0, 3).map(([role, salary]) => (
                          <div key={role} className="text-xs text-gray-600 dark:text-gray-300">
                            • {formatRoleSalaryDisplay(role, salary)}
                          </div>
                        ))}
                        {Object.keys(post.roleSalaries).length > 3 && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            외 {Object.keys(post.roleSalaries).length - 3}개 역할
                          </div>
                        )}
                      </div>
                    </div>
                  </span>
                </div>
              ) : (
                post.salaryType && post.salaryAmount && (
                  <div className={getInfoItemClasses()}>
                    <span className="flex items-center">
                      <span className="mr-2">💰</span>
                      <span className="break-words">{formatSalaryDisplay(post.salaryType, post.salaryAmount)}</span>
                    </span>
                  </div>
                )
              )}
              
              {/* 복리후생 */}
              {post.benefits && Object.keys(post.benefits || {}).length > 0 && (
                <div className={variant === 'admin-list' ? 'col-span-full' : getInfoItemClasses()}>
                  <span className="flex items-start">
                    <span className="mr-2 mt-0.5">🎁</span>
                    <div className="break-words leading-relaxed">
                      {(() => {
                        const benefits = getBenefitDisplayNames(post.benefits || {});
                        const midPoint = Math.ceil(benefits.length / 2);
                        const firstLine = benefits.slice(0, midPoint);
                        const secondLine = benefits.slice(midPoint);
                        
                        return (
                          <>
                            <div className="mb-0.5">
                              {firstLine.join(', ')}
                            </div>
                            {secondLine.length > 0 && (
                              <div>
                                {secondLine.join(', ')}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </span>
                </div>
              )}
            </div>

            {/* 시간대 정보 */}
            {variant === 'admin-list' ? renderTimeSlots() : renderDetailedTimeSlots()}

            {/* 지원자 수 */}
            {showApplicationCount && post.applicants && (post.applicants || []).length > 0 && (
              <div className="text-sm text-blue-600 dark:text-blue-400">
                🙋‍♂️ {(post.applicants || []).length}명 지원
              </div>
            )}

            {/* 추가 콘텐츠 */}
            {renderExtra && renderExtra(post)}
          </div>

          {/* 액션 버튼 영역 - admin-list가 아닌 경우만 여기에 표시 */}
          {renderActions && variant !== 'admin-list' && (
            <div className="">
              {renderActions(post)}
            </div>
          )}
        </div>

        {/* 문의 연락처 및 구인자 정보 - 카드 하단 */}
        {(post.contactPhone || creatorInfo) && (
          <div className="mt-2 flex justify-between items-center gap-1">
            {/* 문의 연락처 - 왼쪽 */}
            {post.contactPhone && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                📞 {post.contactPhone}
              </span>
            )}

            {/* 구인자 정보 - 오른쪽 */}
            {creatorInfo && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {getCreatorDisplayText()}
              </span>
            )}
          </div>
        )}

        {/* 관리자용 - 생성/수정 정보 */}
        {variant === 'admin-list' && (
          <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 flex justify-between">
            <span>생성: {formatDateDisplay(post.createdAt)}</span>
            {post.updatedAt && (
              <span>수정: {formatDateDisplay(post.updatedAt)}</span>
            )}
          </div>
        )}

        {/* 관리자용 액션 버튼 - 카드 하단에 균등 배치 */}
        {renderActions && variant === 'admin-list' && (
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {renderActions(post)}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(JobPostingCard);