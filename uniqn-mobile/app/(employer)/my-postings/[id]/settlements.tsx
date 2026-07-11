/**
 * UNIQN Mobile - 스태프/정산 관리 화면
 * 특정 공고의 스태프 관리 및 정산
 *
 * @description v2.0 - 탭 구조 (스태프 관리 / 정산)
 * @version 2.1.0
 */

import React, { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPostingSettlementContext } from '@/domains/job-posting';
import { SettlementList, StaffManagementTab } from '@/components/employer';
import { SettlementModals } from '@/features/employer/settlements/SettlementModals';
import { Loading, ErrorState } from '@/components';
import { StackHeader } from '@/components/headers';
import { useSettlement } from '@/hooks/useSettlement';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useSettlementModals } from '@/hooks/useSettlementModals';
import { useToastStore } from '@/stores/toastStore';
import { STATUS } from '@/constants';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import {
  deriveSalaryConfig,
  deriveRolesForList,
  deriveAvailableRoles,
} from '@/features/employer/settlements/settlementCalc';
import { useStaffSettlementsHandlers } from '@/features/employer/settlements/useStaffSettlementsHandlers';
import { TabHeader, type TabType } from '@/features/employer/settlements/TabHeader';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';

// ============================================================================
// Main Component
// ============================================================================

export default function StaffSettlementsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const { addToast } = useToastStore();
  const { job: contextJob, isFixed, handleShowQR } = useJobDetailContext();
  const headerBackHref = `/(employer)/my-postings/${jobPostingId ?? ''}`;
  const headerRightAction = !isFixed ? <HeaderQRAction onPress={handleShowQR} /> : null;

  // 탭 상태 (진입 동기 대부분이 "누가 왔나 확인" — 정산은 근무 종료 후 업무)
  const [activeTab, setActiveTab] = useState<TabType>('staff');

  // 공고 정보 (시급 포함)
  const { job: posting, refresh: refreshJobDetail } = useJobDetail(jobPostingId || '');
  const headerJobTitle = posting?.title ?? contextJob?.title ?? null;
  const headerTitleSuffix = <JobTitleSuffix jobTitle={headerJobTitle} />;
  const postingSettlement = useMemo(
    () => (posting ? getPostingSettlementContext(posting) : undefined),
    [posting]
  );

  // 스태프 관리 훅
  const { stats: staffStats, changeRole } = useConfirmedStaff(jobPostingId || '');

  // 정산 관리 훅
  const {
    workLogs,
    isLoading,
    isRefreshing,
    error,
    refresh,
    updateWorkTime,
    settleWorkLog,
    bulkSettle,
    isUpdatingTime: isUpdating,
    isSettling: _isSettling,
    isBulkSettling: _isBulkSettling,
  } = useSettlement(jobPostingId || '');

  // 모달 상태 관리
  const modals = useSettlementModals();

  // 급여 설정 (v2.0 - 역할별 급여, 수당 포함)
  const salaryConfig = useMemo(() => deriveSalaryConfig(postingSettlement), [postingSettlement]);

  // SettlementList용 역할 목록 (급여 포함)
  const rolesForList = useMemo(() => deriveRolesForList(salaryConfig.roles), [salaryConfig.roles]);

  // RoleChangeModal용 역할 키 목록
  const availableRoles = useMemo(() => deriveAvailableRoles(rolesForList), [rolesForList]);

  // 핸들러 다발 (클로저 의존은 인자로 주입해 deps 보존)
  const {
    handleRoleChangeSave,
    handleReportSubmit,
    handleSettleFromDetail,
    handleSettle,
    handleBulkSettle,
    handleConfirmSettle,
    handleSaveTimeEdit,
    handleSaveAmountEdit,
    handleSaveSettings,
  } = useStaffSettlementsHandlers({
    jobPostingId,
    modals,
    salaryConfig,
    rolesForList,
    addToast,
    refresh,
    refreshJobDetail,
    changeRole,
    updateWorkTime,
    settleWorkLog,
    bulkSettle,
  });

  // ============================================================================
  // Render
  // ============================================================================

  const stackHeader = (
    <StackHeader
      title="스태프 관리/정산"
      titleSuffix={headerTitleSuffix}
      fallbackHref={headerBackHref}
      rightAction={headerRightAction}
    />
  );

  if (posting && !isCanonicalDatedPosting(posting)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        {stackHeader}
        <ErrorState
          title="지원하지 않는 화면입니다"
          message="고정공고는 1차 범위에서 정산과 근무 운영을 지원하지 않습니다."
        />
      </SafeAreaView>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        {stackHeader}
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-content-secondary font-sans">데이터를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        {stackHeader}
        <ErrorState title="데이터를 불러올 수 없습니다" error={error} onRetry={() => refresh()} />
      </SafeAreaView>
    );
  }

  // 카운트 계산
  const staffCount = staffStats?.total ?? 0;
  const pendingSettlementCount = workLogs.filter(
    (log) => log.payrollStatus !== STATUS.PAYROLL.COMPLETED
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      {stackHeader}
      {/* 탭 헤더 */}
      <TabHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        staffCount={staffCount}
        settlementCount={pendingSettlementCount}
      />

      {/* 탭 컨텐츠 */}
      {activeTab === 'staff' ? (
        <StaffManagementTab
          jobPostingId={jobPostingId || ''}
          jobPosting={posting ?? undefined}
          onShowEventQR={modals.openEventQRModal}
          onShowRoleChange={modals.openRoleChangeModal}
          onShowReport={modals.openReportModal}
        />
      ) : (
        <SettlementList
          workLogs={workLogs}
          roles={rolesForList}
          defaultSalary={salaryConfig.defaultSalary}
          allowances={salaryConfig.allowances}
          taxSettings={postingSettlement?.taxSettings}
          isLoading={isLoading}
          error={error}
          onRefresh={() => refresh()}
          isRefreshing={isRefreshing}
          onWorkLogPress={modals.openDetailModal}
          onSettle={handleSettle}
          onBulkSettle={handleBulkSettle}
          showBulkActions={true}
          onOpenSettings={modals.openSettingsModal}
          enableGrouping={true}
        />
      )}

      {/* 모달들 */}
      <SettlementModals
        modals={modals}
        jobPostingId={jobPostingId || ''}
        posting={posting}
        postingSettlement={postingSettlement}
        rolesForList={rolesForList}
        salaryConfig={salaryConfig}
        availableRoles={availableRoles}
        isUpdating={isUpdating}
        onRoleChangeSave={handleRoleChangeSave}
        onReportSubmit={handleReportSubmit}
        onSettleFromDetail={handleSettleFromDetail}
        onConfirmSettle={handleConfirmSettle}
        onSaveTimeEdit={handleSaveTimeEdit}
        onSaveAmountEdit={handleSaveAmountEdit}
        onSaveSettings={handleSaveSettings}
      />
    </SafeAreaView>
  );
}
