/**
 * P2 설정 테스트 (14 tests)
 * 인증된 staff 상태에서 실행
 */
import { test, expect } from '@playwright/test';
import { SettingsPage } from '../../pages/app/settings/settings.page';
import { ProfileEditPage } from '../../pages/app/settings/profile-edit.page';
import { ChangePasswordPage } from '../../pages/app/settings/change-password.page';
import { DeleteAccountPage } from '../../pages/app/settings/delete-account.page';

// storageState는 chromium 프로젝트에서 staff.json으로 자동 설정됨

// ==========================================================================
// 설정 메인
// ==========================================================================

test.describe('설정 메인', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('모든 설정 섹션이 표시된다', async () => {
    // 4개 섹션 제목 확인
    await expect(settingsPage.getSectionTitle('알림')).toBeVisible({ timeout: 10_000 });
    await expect(settingsPage.getSectionTitle('계정')).toBeVisible();
    await expect(settingsPage.getSectionTitle('앱 설정')).toBeVisible();
    await expect(settingsPage.getSectionTitle('정보')).toBeVisible();
  });

  test('계정 설정 항목이 표시된다', async () => {
    await expect(settingsPage.changePasswordItem).toBeVisible({ timeout: 10_000 });
    await expect(settingsPage.autoLoginLabel).toBeVisible();
  });

  test('앱 설정 항목이 표시된다', async () => {
    await expect(settingsPage.darkModeLabel).toBeVisible({ timeout: 10_000 });
    await expect(settingsPage.cacheClearItem).toBeVisible();
  });

  test('정보 섹션 항목이 표시된다', async () => {
    await expect(settingsPage.versionItem).toBeVisible({ timeout: 10_000 });
    await expect(settingsPage.getVersionValue()).toBeVisible();
    await expect(settingsPage.termsItem).toBeVisible();
    await expect(settingsPage.privacyItem).toBeVisible();
    await expect(settingsPage.businessInfoItem).toBeVisible();
  });

  test('비밀번호 변경 클릭 시 해당 페이지로 이동한다', async () => {
    await settingsPage.goToChangePassword();
    expect(settingsPage.getCurrentPath()).toContain('change-password');
  });

  test('이용약관 클릭 시 해당 페이지로 이동한다', async () => {
    await settingsPage.goToTerms();
    expect(settingsPage.getCurrentPath()).toContain('terms');
  });

  test('계정 삭제 버튼이 표시된다', async () => {
    // 스크롤하여 하단의 계정 삭제 버튼 확인
    await settingsPage.deleteAccountButton.scrollIntoViewIfNeeded();
    await expect(settingsPage.deleteAccountButton).toBeVisible();
  });

  test('마케팅 정보 수신 토글이 표시된다', async () => {
    await settingsPage.marketingLabel.scrollIntoViewIfNeeded();
    await expect(settingsPage.marketingLabel).toBeVisible();
  });
});

// ==========================================================================
// 프로필 수정
// ==========================================================================

test.describe('프로필 수정', () => {
  let profilePage: ProfileEditPage;

  test.beforeEach(async ({ page }) => {
    profilePage = new ProfileEditPage(page);
    await profilePage.goto();
  });

  test('읽기 전용 필드가 표시된다', async () => {
    await expect(profilePage.getSection('기본 정보')).toBeVisible({ timeout: 10_000 });
    await expect(profilePage.getReadOnlyField('이름')).toBeVisible();
    await expect(profilePage.getReadOnlyField('이메일')).toBeVisible();
  });

  test('수정 가능 필드와 저장 버튼이 표시된다', async () => {
    await expect(profilePage.getSection('추가 정보')).toBeVisible({ timeout: 10_000 });
    await expect(profilePage.nicknameInput).toBeVisible();
    await expect(profilePage.saveButton).toBeVisible();
  });
});

// ==========================================================================
// 비밀번호 변경
// ==========================================================================

test.describe('비밀번호 변경', () => {
  let changePwPage: ChangePasswordPage;

  test.beforeEach(async ({ page }) => {
    changePwPage = new ChangePasswordPage(page);
    await changePwPage.goto();
  });

  test('비밀번호 변경 폼이 표시된다', async () => {
    await expect(changePwPage.getGuideText()).toBeVisible({ timeout: 10_000 });
    await expect(changePwPage.currentPasswordInput).toBeVisible();
    await expect(changePwPage.newPasswordInput).toBeVisible();
    await expect(changePwPage.confirmPasswordInput).toBeVisible();
    await expect(changePwPage.submitButton).toBeVisible();
  });

  test('비밀번호 정책이 표시된다', async () => {
    await expect(changePwPage.getPolicySection()).toBeVisible({ timeout: 10_000 });
    await expect(changePwPage.getPolicyItem('최소 8자 이상')).toBeVisible();
    await expect(changePwPage.getPolicyItem('대문자 1개 이상 포함')).toBeVisible();
    await expect(changePwPage.getPolicyItem('소문자 1개 이상 포함')).toBeVisible();
    await expect(changePwPage.getPolicyItem('숫자 1개 이상 포함')).toBeVisible();
    await expect(changePwPage.getPolicyItem('특수문자 1개 이상 포함')).toBeVisible();
  });
});

// ==========================================================================
// 회원탈퇴
// ==========================================================================

test.describe('회원탈퇴', () => {
  let deleteAccountPage: DeleteAccountPage;

  test.beforeEach(async ({ page }) => {
    deleteAccountPage = new DeleteAccountPage(page);
    await deleteAccountPage.goto();
  });

  test('회원탈퇴 경고 문구와 사유 선택이 표시된다', async () => {
    await expect(deleteAccountPage.warningTitle).toBeVisible({ timeout: 10_000 });

    // 탈퇴 사유 옵션 확인
    await expect(deleteAccountPage.getReasonOption('더 이상 서비스를 이용하지 않아요')).toBeVisible();
    await expect(deleteAccountPage.getReasonOption('다른 서비스를 이용하게 되었어요')).toBeVisible();
    await expect(deleteAccountPage.getReasonOption('개인정보가 걱정돼요')).toBeVisible();
    await expect(deleteAccountPage.getReasonOption('알림이 너무 많아요')).toBeVisible();
    await expect(deleteAccountPage.getReasonOption('사용하기 어려워요')).toBeVisible();
    await expect(deleteAccountPage.getReasonOption('기타')).toBeVisible();
  });

  test('기타 사유 선택 시 텍스트 입력 필드가 나타난다', async () => {
    await deleteAccountPage.selectReason('기타');
    await deleteAccountPage.page.waitForTimeout(500);

    // 기타 사유 입력 필드가 표시되어야 함
    await expect(deleteAccountPage.getOtherReasonInput()).toBeVisible({ timeout: 3_000 });
  });
});
