/**
 * E2E 테스트용 인증 헬퍼 
 * T-HOLDEM 프로젝트 통합 인증 시스템
 * 
 * @version 4.1
 * @since 2025-09-05 (클래스 구조로 변경)
 */

import { Page, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'staff' | 'user';
  displayName: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    email: 'admin@test.com',
    password: '456456',
    role: 'admin',
    displayName: '관리자 테스트'
  },
  manager: {
    email: 'manager@test.com', 
    password: 'manager123',
    role: 'manager',
    displayName: '매니저 테스트'
  },
  staff: {
    email: 'staff@test.com',
    password: 'staff123', 
    role: 'staff',
    displayName: '스태프 테스트'
  },
  user: {
    email: 'newuser@test.com',
    password: 'user123',
    role: 'user',
    displayName: '일반사용자 테스트'
  },
  testuser: {
    email: 'testuser@test.com',
    password: 'test123',
    role: 'user',
    displayName: '테스트사용자'
  }
};

/**
 * E2E 테스트용 인증 헬퍼 클래스
 */
export class AuthHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 사용자 로그인 수행
   */
  async loginUser(
    userKey: keyof typeof TEST_USERS = 'user',
    timeout: number = 15000
  ): Promise<void> {
    const user = TEST_USERS[userKey];
    
    console.log(`🔐 로그인 시도: ${user.displayName} (${user.email})`);
    
    // 로그인 페이지로 이동
    await this.page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
    
    // 로그인 폼이 로드될 때까지 대기
    await expect(this.page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout });
    
    // 이메일 입력
    await this.page.fill('input[type="email"], input[name="email"]', user.email);
    
    // 비밀번호 입력  
    await this.page.fill('input[type="password"], input[name="password"]', user.password);
    
    // 로그인 버튼 클릭
    const loginButton = this.page.locator('button').filter({ hasText: /Sign In|로그인|Login/i }).first();
    await loginButton.click();
    
    // 로그인 성공 대기 - 로그인 페이지가 아닌 다른 페이지로 리다이렉트
    await this.page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout });
    
    console.log(`✅ 로그인 성공: ${user.displayName}`);
  }

  /**
   * 관리자 로그인
   */
  async loginAsAdmin(timeout: number = 20000): Promise<void> {
    await this.loginUser('admin', timeout);
  }

  /**
   * 관리자 로그인 및 특정 페이지 접근
   */
  async navigateToAdminPage(
    targetPath: string = '/admin',
    timeout: number = 20000
  ): Promise<void> {
    console.log(`🔐 관리자 페이지 접근: ${targetPath}`);
    
    // 관리자 로그인
    await this.loginAsAdmin(timeout);
    
    // 목표 페이지로 이동
    await this.page.goto(targetPath, { waitUntil: 'networkidle', timeout });
    
    // 페이지 로딩 완료 대기
    await expect(this.page.locator('body')).toBeVisible({ timeout });
    
    console.log(`✅ 관리자 페이지 접근 완료: ${targetPath}`);
  }

  /**
   * 일반 사용자 로그인 및 특정 페이지 접근
   */
  async navigateToUserPage(
    targetPath: string = '/',
    timeout: number = 15000
  ): Promise<void> {
    console.log(`👤 사용자 페이지 접근: ${targetPath}`);
    
    // 일반 사용자 로그인
    await this.loginUser('user', timeout);
    
    // 목표 페이지로 이동
    await this.page.goto(targetPath, { waitUntil: 'networkidle', timeout });
    
    // 페이지 로딩 완료 대기
    await expect(this.page.locator('body')).toBeVisible({ timeout });
    
    console.log(`✅ 사용자 페이지 접근 완료: ${targetPath}`);
  }

  /**
   * 현재 사용자 로그아웃
   */
  async logout(): Promise<void> {
    console.log(`🚪 로그아웃 시도`);
    
    // 로그아웃 버튼 찾기 (헤더, 프로필 메뉴 등에서)
    const logoutSelectors = [
      'button[data-testid="logout"]',
      'button[aria-label="로그아웃"]', 
      '[data-testid="user-menu"] button',
      'button:has-text("로그아웃")',
      'button:has-text("Logout")'
    ];
    
    for (const selector of logoutSelectors) {
      const logoutButton = this.page.locator(selector);
      if (await logoutButton.count() > 0 && await logoutButton.isVisible()) {
        await logoutButton.click();
        break;
      }
    }
    
    // 로그인 페이지로 리다이렉트 대기 (에러 무시)
    try {
      await this.page.waitForURL('**/login', { timeout: 10000 });
      console.log(`✅ 로그아웃 완료`);
    } catch {
      console.log(`⚠️ 로그아웃 완료 (페이지 리다이렉트 감지 실패)`);
    }
  }

  /**
   * 인증 상태 확인
   */
  async isAuthenticated(): Promise<boolean> {
    // 로그인된 사용자만 접근 가능한 요소들 확인
    const authenticatedSelectors = [
      '[data-testid="user-menu"]',
      'button:has-text("로그아웃")',
      '.user-profile'
    ];
    
    for (const selector of authenticatedSelectors) {
      const element = this.page.locator(selector);
      if (await element.count() > 0 && await element.isVisible()) {
        return true;
      }
    }
    
    // 현재 URL이 로그인 페이지가 아닌지 확인
    const currentUrl = this.page.url();
    return !currentUrl.includes('/login') && !currentUrl.includes('/signup');
  }

  /**
   * 권한 확인 - 관리자 페이지 접근 가능 여부
   */
  async hasAdminAccess(): Promise<boolean> {
    // 관리자 권한 요소들 확인
    const adminSelectors = [
      '[href*="/admin"]',
      'button:has-text("관리")',
      '.admin-menu',
      '[data-testid="admin-panel"]'
    ];
    
    for (const selector of adminSelectors) {
      const element = this.page.locator(selector);
      if (await element.count() > 0 && await element.isVisible()) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 지정된 페이지에서 특정 사용자로 로그인 (멀티탭 지원)
   */
  async loginAsUser(
    userKey: keyof typeof TEST_USERS,
    password?: string, 
    targetPage?: Page,
    timeout: number = 15000
  ): Promise<void> {
    const page = targetPage || this.page;
    const user = TEST_USERS[userKey];
    const actualPassword = password || user.password;
    
    console.log(`🔐 로그인 시도: ${user.displayName} (${user.email})`);
    
    // 로그인 페이지로 이동
    await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
    
    // 로그인 폼이 로드될 때까지 대기
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout });
    
    // 이메일 입력
    await page.fill('input[type="email"], input[name="email"]', user.email);
    
    // 비밀번호 입력  
    await page.fill('input[type="password"], input[name="password"]', actualPassword);
    
    // 로그인 버튼 클릭
    const loginButton = page.locator('button').filter({ hasText: /Sign In|로그인|Login/i }).first();
    await loginButton.click();
    
    // 로그인 성공 대기 - 로그인 페이지가 아닌 다른 페이지로 리다이렉트
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout });
    
    console.log(`✅ 로그인 성공: ${user.displayName}`);
  }
}

// 기존 함수들도 호환성을 위해 유지 (내부적으로 클래스 사용)
export async function loginUser(
  page: Page,
  userKey: keyof typeof TEST_USERS = 'user',
  timeout: number = 15000
): Promise<void> {
  const helper = new AuthHelper(page);
  await helper.loginUser(userKey, timeout);
}

export async function navigateToAdminPage(
  page: Page, 
  targetPath: string = '/admin',
  timeout: number = 20000
): Promise<void> {
  const helper = new AuthHelper(page);
  await helper.navigateToAdminPage(targetPath, timeout);
}

export async function navigateToUserPage(
  page: Page,
  targetPath: string = '/',
  timeout: number = 15000
): Promise<void> {
  const helper = new AuthHelper(page);
  await helper.navigateToUserPage(targetPath, timeout);
}

export async function logoutUser(page: Page): Promise<void> {
  const helper = new AuthHelper(page);
  await helper.logout();
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  const helper = new AuthHelper(page);
  return helper.isAuthenticated();
}

export async function hasAdminAccess(page: Page): Promise<boolean> {
  const helper = new AuthHelper(page);
  return helper.hasAdminAccess();
}