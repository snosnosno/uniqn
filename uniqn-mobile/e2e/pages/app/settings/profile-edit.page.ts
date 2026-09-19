/**
 * Profile Edit Page Object
 * 참조: app/(app)/settings/profile.tsx
 */
import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../../base.page';

export class ProfileEditPage extends BasePage {
  readonly nicknameInput: Locator;
  readonly regionInput: Locator;
  readonly experienceInput: Locator;
  readonly careerInput: Locator;
  readonly noteInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    // 🔑 placeholder 가 아니라 testID 로 잡는다. 라벨이 입력창 왼쪽으로 나가면서
    //    placeholder 가 '2-15자' 로 짧아졌고, 문구에 결합돼 있던 이 셀렉터가 깨졌다.
    //    placeholder 는 카피라 언제든 또 바뀐다.
    this.nicknameInput = page.getByTestId('profile-nickname-input');
    this.regionInput = page.getByPlaceholder('예: 서울 강남구');
    this.experienceInput = page.getByPlaceholder('예: 3');
    this.careerInput = page.getByPlaceholder('경력 및 이력을 입력해주세요');
    this.noteInput = page.getByPlaceholder('기타 참고사항을 입력해주세요');
    // 저장 버튼은 raw Pressable이므로 role="button"이 없음 — 텍스트 기반으로 찾기
    this.saveButton = page.getByText('저장', { exact: true }).last();
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/profile', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** 닉네임 입력 */
  async fillNickname(nickname: string): Promise<void> {
    await this.nicknameInput.clear();
    await this.nicknameInput.fill(nickname);
  }

  /** 지역 입력 */
  async fillRegion(region: string): Promise<void> {
    await this.regionInput.clear();
    await this.regionInput.fill(region);
  }

  /** 경력 입력 */
  async fillExperience(years: string): Promise<void> {
    await this.experienceInput.clear();
    await this.experienceInput.fill(years);
  }

  /** 저장 클릭 */
  async save(): Promise<void> {
    await this.saveButton.click();
  }

  /**
   * 읽기 전용 필드 확인.
   *
   * '이름'은 라벨-값 행이 아니라 신원 헤더의 제목이라 라벨 텍스트가 없다 — testID 로 잡는다.
   * (라벨 텍스트로 찾으면 '닉네임'이 '이름'을 부분 문자열로 포함해 엉뚱한 노드를 집는다.)
   */
  getReadOnlyField(label: '이름' | '이메일' | '전화번호' | '생년월일' | '성별'): Locator {
    if (label === '이름') {
      return this.page.getByTestId('profile-identity-name');
    }
    return this.page.getByText(label, { exact: true }).last();
  }

  /** 역할 표시(신원 헤더) */
  getRole(): Locator {
    return this.page.getByTestId('profile-identity-role');
  }

  /** 섹션 확인 */
  getSection(title: string): Locator {
    return this.page.getByText(new RegExp(title)).last();
  }

  /** 닉네임 사용 가능 메시지 확인 */
  getNicknameAvailable(): Locator {
    return this.page.getByText('사용 가능한 닉네임입니다');
  }

  /** 닉네임 중복 메시지 확인 */
  getNicknameTaken(): Locator {
    return this.page.getByText('이미 사용 중인 닉네임입니다');
  }

  /** 프로필 저장 성공 토스트 대기 */
  async waitForSaveSuccess(): Promise<void> {
    await this.page.getByText('프로필이 저장되었습니다').waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  }

  /** 변경 없음 토스트 대기 */
  async waitForNoChanges(): Promise<void> {
    await this.page.getByText('변경된 내용이 없습니다').waitFor({
      state: 'visible',
      timeout: 5_000,
    });
  }
}
