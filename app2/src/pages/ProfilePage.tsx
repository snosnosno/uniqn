import { StarIcon } from '@heroicons/react/24/solid';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import ProfileImageUpload from '../components/profile/ProfileImageUpload';

interface ProfileData {
  name: string;
  phone: string;
  email: string;
  role: string;
  experience: string;
  history?: string;
  notes?: string;
  rating?: number;
  ratingCount?: number;
  nationality?: string;
  region?: string;
  age?: number;
  bankName?: string;
  bankAccount?: string;
  residentId?: string;
  gender?: string;
  profileImageUrl?: string;
}

const ProfilePage = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    // isAdmin - 향후 사용 예정
    const { userId } = useParams<{ userId: string }>();
    const profileId = userId || currentUser?.uid;

    const profileRef = useMemo(() => {
        return profileId ? doc(db, 'users', profileId) : null;
    }, [profileId]);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [errorProfile, setErrorProfile] = useState<Error | null>(null);

    const [formData, setFormData] = useState<Partial<ProfileData>>({});
    const [isEditing, setIsEditing] = useState(false);

    const isOwnProfile = !userId || (currentUser?.uid === userId);

    const experienceLevels = [
        "1년 미만",
        "1년",
        "2년",
        "3년",
        "4년",
        "5년 이상",
        "10년 이상"
    ];
    
    const countries = [
        { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
        { code: 'US', name: 'United States', flag: '🇺🇸' },
        { code: 'JP', name: 'Japan', flag: '🇯🇵' },
        { code: 'CN', name: 'China', flag: '🇨🇳' },
        { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
        { code: 'DE', name: 'Germany', flag: '🇩🇪' },
        { code: 'FR', name: 'France', flag: '🇫🇷' },
        { code: 'CA', name: 'Canada', flag: '🇨🇦' },
        { code: 'AU', name: 'Australia', flag: '🇦🇺' },
        { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
        { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
        { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
        { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
        { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
        { code: 'IN', name: 'India', flag: '🇮🇳' },
        { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
        { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
        { code: 'RU', name: 'Russia', flag: '🇷🇺' },
        { code: 'IT', name: 'Italy', flag: '🇮🇹' },
        { code: 'ES', name: 'Spain', flag: '🇪🇸' }
    ];

    const locations = [
        'seoul', 'gyeonggi', 'incheon', 'gangwon', 'daejeon', 'sejong',
        'chungnam', 'chungbuk', 'gwangju', 'jeonnam', 'jeonbuk', 
        'daegu', 'gyeongbuk', 'busan', 'ulsan', 'gyeongnam', 'jeju', 'overseas', 'other'
    ];
    
    const getNationalityDisplay = (nationality?: string) => {
        if (!nationality) return t('profilePage.notProvided');
        const country = countries.find(c => c.code === nationality);
        return country ? `${country.flag} ${country.name}` : nationality;
    };

    const getRegionDisplay = (region?: string) => {
        if (!region) return t('profilePage.notProvided');
        return t(`locations.${region}`, region);
    };

    useEffect(() => {
        const fetchProfile = async () => {
            if (!profileRef) {
                setLoadingProfile(false);
                return;
            }
            try {
                const docSnap = await getDoc(profileRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as ProfileData;

                    setProfile(data);
                } else {

                    setErrorProfile(new Error(t('profilePage.userNotFound')));
                }
            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err));
                setErrorProfile(error);
            } finally {
                setLoadingProfile(false);
            }
        };

        fetchProfile();
    }, [profileRef, t]);

    const handleEditClick = () => {
        if (!isEditing) {
            setFormData(profile || {});
        }
        setIsEditing(!isEditing);
    };

    // 전화번호 포맷팅 함수
    const formatPhoneNumber = (value: string) => {
        // 숫자만 추출
        const numbers = value.replace(/\D/g, '');

        // 길이에 따라 포맷 적용
        if (numbers.length <= 3) {
            return numbers;
        } else if (numbers.length <= 7) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        } else {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // 전화번호 필드인 경우 포맷팅 적용
        if (name === 'phone') {
            const formattedValue = formatPhoneNumber(value);
            setFormData(prev => ({ ...prev, [name]: formattedValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleImageUpdate = async (imageUrl: string | null) => {
        if (!profileRef) return;

        try {
            await setDoc(profileRef, { profileImageUrl: imageUrl }, { merge: true });

            const updatedDoc = await getDoc(profileRef);
            if(updatedDoc.exists()) {
                setProfile(updatedDoc.data() as ProfileData);
            }

            logger.info('프로필 이미지 업데이트 완료', {
                component: 'ProfilePage',
                data: { imageUrl }
            });
        } catch (err: unknown) {
            logger.error("프로필 이미지 업데이트 실패", err instanceof Error ? err : new Error(String(err)), {
                operation: 'updateProfileImage',
                ...(profileId && { userId: profileId })
            });
            toast.error(t('profilePage.imageUpdateFailed'));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profileRef) {
            toast.error(t('profilePage.loginRequired'));
            return;
        }

        // 필수 필드 검증
        const requiredFields = [
            { field: 'nationality', label: '국적' },
            { field: 'region', label: '지역' },
            { field: 'phone', label: '연락처' },
            { field: 'age', label: '나이' },
            { field: 'experience', label: '경력' }
        ];

        const missingFields = requiredFields.filter(({ field }) => {
            const value = formData[field as keyof ProfileData];
            return !value || value === '';
        });

        if (missingFields.length > 0) {
            const missingFieldNames = missingFields.map(({ label }) => label).join(', ');
            toast.error(t('profilePage.requiredFields', { fields: missingFieldNames }));
            return;
        }

        try {
            const dataToSave = { ...formData };
            delete dataToSave.name; // 이름 필드 저장 제외
            delete dataToSave.gender; // 성별 필드 저장 제외

            await setDoc(profileRef, dataToSave, { merge: true });

            const updatedDoc = await getDoc(profileRef);
            if(updatedDoc.exists()) {
                setProfile(updatedDoc.data() as ProfileData);
            }

            setIsEditing(false);
            toast.success(t('profilePage.updateSuccess'));
        } catch (err: unknown) {
            logger.error("Error updating profile", err instanceof Error ? err : new Error(String(err)), {
                operation: 'updateProfile',
                ...(profileId && { userId: profileId })
            });
            const errorMessage = err instanceof Error ? err.message : String(err);
            toast.error(t('profilePage.updateFailed', { message: errorMessage }));
        }
    };

    if (loadingProfile) return <div className="p-6 text-center">{t('profilePage.loadingProfile')}</div>;
    if (errorProfile) return <div className="p-6 text-center text-red-500">{t('profilePage.error', { message: errorProfile.message })}</div>;
    if (!profile) return <div className="p-6 text-center">{t('profilePage.viewProfileLogin')}</div>;

    const genderDisplay = (genderKey: string | undefined) => {
        if (!genderKey) return t('profilePage.notProvided');
        return t(`gender.${genderKey.toLowerCase()}`, genderKey);
    };


    return (
        <div className="container">
            <div className="max-w-4xl mx-auto">
                {/* Profile Section */}
                <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                    <div className="flex flex-col md:flex-row items-center md:items-start">
                        {/* 프로필 사진 섹션 */}
                        <div className="flex-shrink-0 mb-6 md:mb-0 md:mr-6">
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                {profile.profileImageUrl ? (
                                    <img
                                        src={profile.profileImageUrl}
                                        alt={t('profilePage.profileImage')}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-bold text-gray-800">{profile.name}</h1>
                            <div className="mt-1">
                                <span className="text-lg text-gray-600">{getNationalityDisplay(profile.nationality)}</span>
                            </div>

                            <div className="flex items-center justify-center md:justify-start mt-2">
                                <StarIcon className="h-6 w-6 text-yellow-400 mr-1" />
                                <span className="text-lg font-semibold text-gray-700">{profile.rating?.toFixed(1) || t('profilePage.notAvailable')}</span>
                                <span className="text-sm text-gray-500 ml-2">({profile.ratingCount || 0} {t('profilePage.ratings')})</span>
                            </div>
                        </div>
                        <div className="mt-4 md:mt-0 flex gap-2">
                            {isOwnProfile && (
                                <>
                                    <Link
                                        to="/app/settings"
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2"
                                        title={t('settings.title', '설정')}
                                    >
                                        <Cog6ToothIcon className="h-5 w-5" />
                                        <span className="hidden sm:inline">{t('settings.title', '설정')}</span>
                                    </Link>
                                    <button
                                        onClick={handleEditClick}
                                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        {isEditing ? t('profilePage.cancel') : t('profilePage.editProfile')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 프로필 사진 업로드 (편집 모드에서만 표시) */}
                    {isEditing && isOwnProfile && (
                        <div className="mt-6 border-t pt-6">
                            <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('profilePage.profileImage')}</h3>
                            <ProfileImageUpload
                                currentImageUrl={profile.profileImageUrl || null}
                                onImageUpdate={handleImageUpdate}
                                className="max-w-md mx-auto md:mx-0"
                            />
                        </div>
                    )}

                    {!isEditing || !isOwnProfile ? (
                        <div className="mt-6 border-t pt-6">
                            <h2 className="text-xl font-semibold text-gray-700 mb-4">{t('profilePage.profileDetails', '상세 정보')}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                <div>
                                    <p className="font-semibold text-gray-600">{t('profilePage.email')}</p>
                                    <p>{profile.email}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('profilePage.phone')}</p>
                                    <p>{profile.phone || t('profilePage.notProvided')}</p>
                                </div>
                                
                                <div>
                                    <p className="font-semibold text-gray-600">{t('profilePage.gender')}</p>
                                    <p>{genderDisplay(profile.gender)}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('profilePage.age', '나이')}</p>
                                    <p>{profile.age ? `${profile.age}세` : t('profilePage.notProvided')}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('profile.region')}</p>
                                    <p>{getRegionDisplay(profile.region)}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('profilePage.experience')}</p>
                                    <p>{profile.experience || t('profilePage.notProvided')}</p>
                                </div>
                                
                                <div className="md:col-span-2">
                                    <p className="font-semibold text-gray-600">{t('profilePage.history')}</p>
                                    <p className="whitespace-pre-wrap">{profile.history || t('profilePage.notProvided')}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="font-semibold text-gray-600">{t('profilePage.notes', '기타 사항')}</p>
                                    <p className="whitespace-pre-wrap">{profile.notes || t('profilePage.notProvided', '없음')}</p>
                                </div>
                                
                                {isOwnProfile ? <div className="md:col-span-2 mt-4 border-t pt-4">
                                        <h3 className="text-lg font-semibold text-gray-700 mb-3">
                                            {t('profilePage.privateInfo', '개인 정보')}
                                            <span className="text-sm text-gray-500 ml-2 font-normal">{t('profilePage.privateInfoNote', '(정산시 필요, 허가된 사람에게만 보입니다)')}</span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                            <div>
                                                <p className="font-semibold text-gray-600">{t('profilePage.residentId')}</p>
                                                <p>{profile.residentId || t('profilePage.notProvided')}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-600">{t('profilePage.bankName', '은행명')}</p>
                                                <p>{profile.bankName || t('profilePage.notProvided')}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-600">{t('profilePage.bankAccount', '계좌번호')}</p>
                                                <p>{profile.bankAccount || t('profilePage.notProvided')}</p>
                                            </div>
                                        </div>
                                    </div> : null}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="mt-6 border-t pt-6">
                            <h2 className="text-xl font-semibold text-gray-700 mb-4">{t('profilePage.editDetails')}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">{t('profilePage.name')}</label>
                                    <input type="text" name="name" id="name" value={formData.name || ''} readOnly className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-100" />
                                </div>
                                <div>
                                    <label htmlFor="nationality" className="block text-sm font-medium text-gray-700">
                                        {t('profilePage.nationality', '국적')} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="nationality"
                                        id="nationality"
                                        value={formData.nationality || ''}
                                        onChange={handleChange}
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    >
                                        <option value="">{t('profilePage.selectNationality', '국적을 선택하세요')}</option>
                                        {countries.map(country => (
                                            <option key={country.code} value={country.code}>
                                                {country.flag} {country.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="region" className="block text-sm font-medium text-gray-700">
                                        {t('profile.region')} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="region"
                                        id="region"
                                        value={formData.region || ''}
                                        onChange={handleChange}
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    >
                                        <option value="">{t('profile.selectRegion')}</option>
                                        {locations.map(location => (
                                            <option key={location} value={location}>
                                                {t(`locations.${location}`, location)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                        {t('profilePage.phone')} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        id="phone"
                                        value={formData.phone || ''}
                                        onChange={handleChange}
                                        placeholder="010-1234-5678"
                                        maxLength={13}
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700">{t('profilePage.gender')}</label>
                                    <input type="text" name="gender" id="gender" value={genderDisplay(formData.gender)} readOnly className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-100" />
                                </div>
                                <div>
                                    <label htmlFor="age" className="block text-sm font-medium text-gray-700">
                                        {t('profilePage.age', '나이')} <span className="text-red-500">*</span>
                                    </label>
                                    <input type="number" name="age" id="age" value={formData.age ? formData.age.toString() : ''} onChange={handleChange} min="18" max="100" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="experience" className="block text-sm font-medium text-gray-700">
                                        {t('profilePage.experience')} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="experience"
                                        id="experience"
                                        value={formData.experience || ''}
                                        onChange={handleChange}
                                        required
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    >
                                        <option value="">{t('profilePage.selectExperience', '경력을 선택하세요')}</option>
                                        {experienceLevels.map(level => (
                                            <option key={level} value={level}>{level}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="md:col-span-2">
                                    <label htmlFor="history" className="block text-sm font-medium text-gray-700">{t('profilePage.history')}</label>
                                    <textarea name="history" id="history" value={formData.history || ''} onChange={handleChange} rows={4} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder={t('profilePage.historyPlaceholder')}></textarea>
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700">{t('profilePage.notes', '기타 사항')}</label>
                                    <textarea name="notes" id="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                                </div>
                                
                                <div className="md:col-span-2 mt-4 border-t pt-4">
                                    <h3 className="text-lg font-semibold text-gray-700 mb-3">
                                        {t('profilePage.privateInfo', '개인 정보')}
                                        <span className="text-sm text-gray-500 ml-2 font-normal">{t('profilePage.privateInfoNote', '(정산시 필요, 허가된 사람에게만 보입니다)')}</span>
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label htmlFor="residentId" className="block text-sm font-medium text-gray-700">{t('profilePage.residentId')}</label>
                                            <input type="text" name="residentId" id="residentId" value={formData.residentId || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">{t('profilePage.bankName', '은행명')}</label>
                                            <input type="text" name="bankName" id="bankName" value={formData.bankName || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-700">{t('profilePage.bankAccount', '계좌번호')}</label>
                                            <input type="text" name="bankAccount" id="bankAccount" value={formData.bankAccount || ''} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                    {t('profilePage.saveChanges')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;