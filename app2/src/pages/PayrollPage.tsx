import { doc, getDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { callFunctionLazy } from '../utils/firebase-dynamic';
import { formatCurrency, formatDate } from '../i18n-helpers';

interface Payroll {
    id: string;
    eventId: string;
    eventName?: string;
    workDurationInHours: number;
    calculatedPay: number;
    status: string;
    calculationDate: { toDate: () => Date };
    userId: string;
}

interface UserProfile {
    name: string;
    email: string;
    role: string;
}

const PayrollPage = () => {
    const { t, i18n } = useTranslation();
    const { currentUser, isAdmin, role } = useAuth();
    const { userId } = useParams<{ userId: string }>();
    
    const [payrolls, setPayrolls] = useState<Payroll[]>([]);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 접근 권한 확인
    const targetUserId = userId || currentUser?.uid;
    const isOwnPayroll = !userId || (currentUser?.uid === userId);
    const canViewPayroll = isOwnPayroll || isAdmin;

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        if (!canViewPayroll) {
            setError(t('payrollPage.accessDenied', '접근 권한이 없습니다.'));
            setLoading(false);
            return;
        }

        fetchPayrollData();
    }, [currentUser, targetUserId, canViewPayroll, t]);

    const fetchPayrollData = async () => {
        if (!targetUserId) {
            setLoading(false);
            return;
        }

        try {
            // 사용자 프로필 정보 가져오기
            if (targetUserId !== currentUser?.uid) {
                const userDoc = await getDoc(doc(db, 'users', targetUserId));
                if (userDoc.exists()) {
                    setUserProfile(userDoc.data() as UserProfile);
                } else {
                    setError(t('payrollPage.userNotFound', '사용자를 찾을 수 없습니다.'));
                    setLoading(false);
                    return;
                }
            }

            // 급여 데이터 가져오기
            let payrollData: Payroll[] = [];

            if (isAdmin && targetUserId !== currentUser?.uid) {
                // 관리자가 다른 사용자의 급여를 조회하는 경우
                const result: any = await callFunctionLazy('getPayrollsForUser', { userId: targetUserId });
                payrollData = result?.payrolls || [];
            } else {
                // 본인 급여 조회
                const result: any = await callFunctionLazy('getPayrolls');
                payrollData = result?.payrolls || [];
            }

            // 이벤트 이름 추가
            const payrollsWithEventNames = await Promise.all(
                payrollData.map(async (p: Payroll) => {
                    if (!p.eventId) {
                        return { ...p, eventName: t('payrollPage.eventIdMissing', '이벤트 ID 없음') };
                    }
                    try {
                        const eventDoc = await getDoc(doc(db, 'events', p.eventId));
                        return { 
                            ...p, 
                            eventName: eventDoc.exists() ? eventDoc.data()?.title : t('payrollPage.unknownEvent', '알 수 없는 이벤트')
                        };
                    } catch (err) {
                        console.error(`Error fetching event ${p.eventId}:`, err);
                        return { ...p, eventName: t('payrollPage.unknownEvent', '알 수 없는 이벤트') };
                    }
                })
            );
            
            setPayrolls(payrollsWithEventNames);
        } catch (err) {
            console.error("Failed to fetch payroll data:", err);
            setError(t('payrollPage.fetchError', '급여 데이터를 불러오는데 실패했습니다.'));
        } finally {
            setLoading(false);
        }
    };

    // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // 접근 권한이 없는 경우
    if (!canViewPayroll) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <h1 className="text-2xl font-bold text-red-800 mb-2">
                            {t('payrollPage.accessDenied', '접근 권한이 없습니다.')}
                        </h1>
                        <p className="text-red-600">
                            {t('payrollPage.accessDeniedMessage', '본인의 급여내역만 조회할 수 있습니다.')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">{t('payrollPage.loading', '급여 데이터를 불러오는 중...')}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <h1 className="text-2xl font-bold text-red-800 mb-2">
                            {t('payrollPage.error', '오류')}
                        </h1>
                        <p className="text-red-600">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    // 급여 통계 계산
    const totalPay = payrolls.reduce((sum, p) => sum + p.calculatedPay, 0);
    const totalHours = payrolls.reduce((sum, p) => sum + p.workDurationInHours, 0);
    const paidPayrolls = payrolls.filter(p => p.status === 'paid');
    const paidAmount = paidPayrolls.reduce((sum, p) => sum + p.calculatedPay, 0);
    const pendingAmount = totalPay - paidAmount;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* 헤더 */}
                <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">
                                {t('payrollPage.title', '급여 내역')}
                            </h1>
                            {userProfile ? <p className="text-lg text-gray-600 mt-1">
                                    {userProfile.name} ({userProfile.email})
                                </p> : null}
                            {!isOwnPayroll && (
                                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2">
                                    {t('payrollPage.adminView', '관리자 조회')}
                                </span>
                            )}
                        </div>
                        <div className="mt-4 md:mt-0">
                            <button
                                onClick={() => window.history.back()}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            >
                                {t('payrollPage.goBack', '뒤로 가기')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 급여 통계 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">{t('payrollPage.totalEvents', '총 이벤트 수')}</h3>
                        <p className="text-2xl font-bold text-gray-900">{payrolls.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">{t('payrollPage.totalHours', '총 근무 시간')}</h3>
                        <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">{t('payrollPage.totalPay', '총 급여')}</h3>
                        <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(totalPay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">{t('payrollPage.paidAmount', '지급 완료')}</h3>
                        <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(paidAmount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                        </p>
                        {pendingAmount > 0 && (
                            <p className="text-sm text-orange-600 mt-1">
                                {t('payrollPage.pendingAmount', '대기중')}: {formatCurrency(pendingAmount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                            </p>
                        )}
                    </div>
                </div>

                {/* 급여 내역 테이블 */}
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">
                        {t('payrollPage.payrollHistory', '급여 내역')}
                    </h2>
                    
                    {payrolls.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {t('payrollPage.tableEvent', '이벤트')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {t('payrollPage.tableDate', '날짜')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {t('payrollPage.tableHours', '근무시간')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {t('payrollPage.tablePay', '급여')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {t('payrollPage.tableStatus', '상태')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {payrolls.map(p => (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{p.eventName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {formatDate(p.calculationDate.toDate(), i18n.language)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{p.workDurationInHours.toFixed(2)}h</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {formatCurrency(p.calculatedPay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    p.status === 'paid' 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {p.status === 'paid' 
                                                        ? t('payrollPage.statusPaid', '지급완료') 
                                                        : t('payrollPage.statusPending', '지급대기')
                                                    }
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="text-gray-400 text-6xl mb-4">💰</div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                {t('payrollPage.noPayroll', '급여 내역이 없습니다')}
                            </h3>
                            <p className="text-gray-500">
                                {t('payrollPage.noPayrollMessage', '아직 급여 내역이 생성되지 않았습니다.')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayrollPage;