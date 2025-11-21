/**
 * Form Utilities
 *
 * 폼 상태 관리를 위한 제네릭 핸들러 모음
 * - TypeScript Generic을 사용한 타입 안전성
 * - React 폼 이벤트 처리 표준화
 * - 중복 코드 제거 및 재사용성 향상
 *
 * @version 1.0.0
 * @created 2025-11-20
 * @feature 002-phase3-integration
 */

import React from 'react';

/**
 * FormHandlers Interface
 *
 * 폼 상태 관리를 위한 핸들러 모음
 *
 * @template T - 폼 상태 객체의 타입
 */
export interface FormHandlers<T extends Record<string, any>> {
  /**
   * 일반 input 요소 변경 핸들러
   *
   * @param event - React change event
   *
   * @example
   * <input name="username" value={form.username} onChange={handleChange} />
   */
  handleChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;

  /**
   * Select 요소 변경 핸들러
   *
   * @param event - React change event
   *
   * @example
   * <select name="role" value={form.role} onChange={handleSelectChange}>
   *   <option value="user">User</option>
   *   <option value="admin">Admin</option>
   * </select>
   */
  handleSelectChange: (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => void;

  /**
   * Checkbox 요소 변경 핸들러
   *
   * @param event - React change event
   *
   * @example
   * <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleCheckboxChange} />
   */
  handleCheckboxChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;

  /**
   * 폼 상태 리셋 핸들러
   *
   * @param initialValues - 초기값 객체
   *
   * @example
   * <button onClick={() => handleReset({ username: '', email: '' })}>Reset</button>
   */
  handleReset: (initialValues: T) => void;
}

/**
 * FormHandler 생성 함수
 *
 * React useState의 setState 함수를 받아서
 * 폼 이벤트 핸들러들을 반환합니다.
 *
 * @template T - 폼 상태 객체의 타입
 * @param setState - React setState 함수
 * @returns FormHandlers 객체
 *
 * @example
 * ```typescript
 * interface UserForm {
 *   username: string;
 *   email: string;
 *   isActive: boolean;
 * }
 *
 * const [form, setForm] = useState<UserForm>({
 *   username: '',
 *   email: '',
 *   isActive: false,
 * });
 *
 * const { handleChange, handleCheckboxChange, handleReset } = createFormHandler(setForm);
 *
 * return (
 *   <form>
 *     <input name="username" value={form.username} onChange={handleChange} />
 *     <input name="email" value={form.email} onChange={handleChange} />
 *     <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleCheckboxChange} />
 *     <button onClick={() => handleReset({ username: '', email: '', isActive: false })}>Reset</button>
 *   </form>
 * );
 * ```
 */
export function createFormHandler<T extends Record<string, any>>(
  setState: React.Dispatch<React.SetStateAction<T>>
): FormHandlers<T> {
  /**
   * 일반 input/textarea 변경 핸들러
   */
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = event.target;
    setState((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  /**
   * Select 변경 핸들러
   */
  const handleSelectChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    const { name, value } = event.target;
    setState((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  /**
   * Checkbox 변경 핸들러
   */
  const handleCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, checked } = event.target;
    setState((prevState) => ({
      ...prevState,
      [name]: checked,
    }));
  };

  /**
   * 폼 리셋 핸들러
   */
  const handleReset = (initialValues: T): void => {
    setState(initialValues);
  };

  return {
    handleChange,
    handleSelectChange,
    handleCheckboxChange,
    handleReset,
  };
}
