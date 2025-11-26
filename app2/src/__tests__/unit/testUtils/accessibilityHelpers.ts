import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

// Jest matcher 확장 (toHaveNoViolations)
expect.extend(toHaveNoViolations);

/**
 * 접근성 테스트 헬퍼 함수
 * axe-core를 사용하여 WCAG 2.1 AA 준수 여부를 검증합니다.
 *
 * @param container - 테스트할 DOM 컨테이너
 * @param options - axe-core 옵션 (선택사항)
 * @throws 접근성 위반 사항이 있으면 테스트 실패
 *
 * @example
 * const { container } = render(<MyComponent />);
 * await testAccessibility(container);
 */
export const testAccessibility = async (container: Element, options?: any): Promise<void> => {
  const results = await axe(container, options);
  expect(results).toHaveNoViolations();
};

/**
 * 키보드 포커스 순서 검증 헬퍼 함수
 * Tab 키를 눌러 포커스가 예상 순서대로 이동하는지 검증합니다.
 *
 * @param elements - 포커스 가능한 요소들 (순서대로)
 *
 * @example
 * const button1 = screen.getByRole('button', { name: '첫 번째' });
 * const button2 = screen.getByRole('button', { name: '두 번째' });
 * await testFocusOrder([button1, button2]);
 */
export const testFocusOrder = async (elements: HTMLElement[]): Promise<void> => {
  const user = userEvent.setup();

  for (const element of elements) {
    await user.tab();
    expect(element).toHaveFocus();
  }
};

/**
 * 스크린 리더 텍스트 검증 헬퍼 함수
 * aria-label 또는 textContent가 예상 텍스트를 포함하는지 검증합니다.
 *
 * @param element - 검증할 HTML 요소
 * @param expectedText - 예상되는 접근성 텍스트
 *
 * @example
 * const button = screen.getByRole('button');
 * testScreenReaderText(button, '알림');
 */
export const testScreenReaderText = (element: HTMLElement, expectedText: string): void => {
  const accessibleName = element.getAttribute('aria-label') || element.textContent;
  expect(accessibleName).toContain(expectedText);
};
