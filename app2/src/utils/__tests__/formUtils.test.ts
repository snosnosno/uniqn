/**
 * FormUtils Unit Tests
 *
 * TDD 접근법: 테스트 먼저 작성, 구현 전 FAIL 확인
 *
 * @version 1.0.0
 * @created 2025-11-20
 * @feature 002-phase3-integration
 */

import { createFormHandler } from '../formUtils';

describe('FormUtils', () => {
  describe('T065: createFormHandler returns typed handlers', () => {
    it('should return all required handler functions', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      expect(handlers).toHaveProperty('handleChange');
      expect(handlers).toHaveProperty('handleSelectChange');
      expect(handlers).toHaveProperty('handleCheckboxChange');
      expect(handlers).toHaveProperty('handleReset');

      expect(typeof handlers.handleChange).toBe('function');
      expect(typeof handlers.handleSelectChange).toBe('function');
      expect(typeof handlers.handleCheckboxChange).toBe('function');
      expect(typeof handlers.handleReset).toBe('function');
    });
  });

  describe('T066: handleChange updates state correctly', () => {
    it('should update state with input value', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      const event = {
        target: {
          name: 'username',
          value: 'testuser',
        },
      } as React.ChangeEvent<HTMLInputElement>;

      handlers.handleChange(event);

      expect(setState).toHaveBeenCalledWith(
        expect.any(Function)
      );

      // setState의 updater 함수를 실제로 실행해서 결과 확인
      const updaterFn = setState.mock.calls[0][0];
      const prevState = { username: '', email: '' };
      const newState = updaterFn(prevState);

      expect(newState).toEqual({
        username: 'testuser',
        email: '',
      });
    });

    it('should preserve other state properties', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      const event = {
        target: {
          name: 'email',
          value: 'test@example.com',
        },
      } as React.ChangeEvent<HTMLInputElement>;

      handlers.handleChange(event);

      const updaterFn = setState.mock.calls[0][0];
      const prevState = { username: 'john', email: '', age: 25 };
      const newState = updaterFn(prevState);

      expect(newState).toEqual({
        username: 'john',
        email: 'test@example.com',
        age: 25,
      });
    });
  });

  describe('T067: handleSelectChange updates state correctly', () => {
    it('should update state with select value', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      const event = {
        target: {
          name: 'role',
          value: 'admin',
        },
      } as React.ChangeEvent<HTMLSelectElement>;

      handlers.handleSelectChange(event);

      expect(setState).toHaveBeenCalledWith(
        expect.any(Function)
      );

      const updaterFn = setState.mock.calls[0][0];
      const prevState = { role: 'user', username: 'john' };
      const newState = updaterFn(prevState);

      expect(newState).toEqual({
        role: 'admin',
        username: 'john',
      });
    });
  });

  describe('T068: handleCheckboxChange updates state correctly', () => {
    it('should update state with checkbox checked status', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      const event = {
        target: {
          name: 'isActive',
          checked: true,
        },
      } as React.ChangeEvent<HTMLInputElement>;

      handlers.handleCheckboxChange(event);

      expect(setState).toHaveBeenCalledWith(
        expect.any(Function)
      );

      const updaterFn = setState.mock.calls[0][0];
      const prevState = { isActive: false, username: 'john' };
      const newState = updaterFn(prevState);

      expect(newState).toEqual({
        isActive: true,
        username: 'john',
      });
    });

    it('should toggle checkbox value', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      const eventChecked = {
        target: {
          name: 'subscribe',
          checked: true,
        },
      } as React.ChangeEvent<HTMLInputElement>;

      handlers.handleCheckboxChange(eventChecked);

      const updaterFn1 = setState.mock.calls[0][0];
      const state1 = updaterFn1({ subscribe: false });
      expect(state1.subscribe).toBe(true);

      setState.mockClear();

      const eventUnchecked = {
        target: {
          name: 'subscribe',
          checked: false,
        },
      } as React.ChangeEvent<HTMLInputElement>;

      handlers.handleCheckboxChange(eventUnchecked);

      const updaterFn2 = setState.mock.calls[0][0];
      const state2 = updaterFn2({ subscribe: true });
      expect(state2.subscribe).toBe(false);
    });
  });

  describe('T069: handleReset resets to initial values', () => {
    it('should reset state to initial values', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      const initialValues = {
        username: '',
        email: '',
        isActive: false,
      };

      handlers.handleReset(initialValues);

      expect(setState).toHaveBeenCalledWith(initialValues);
    });

    it('should reset to empty object if no initial values provided', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      handlers.handleReset({});

      expect(setState).toHaveBeenCalledWith({});
    });

    it('should reset all properties including nested objects', () => {
      const setState = jest.fn();
      const handlers = createFormHandler(setState);

      const initialValues = {
        username: 'admin',
        settings: {
          theme: 'dark',
          notifications: true,
        },
      };

      handlers.handleReset(initialValues);

      expect(setState).toHaveBeenCalledWith(initialValues);
    });
  });
});
