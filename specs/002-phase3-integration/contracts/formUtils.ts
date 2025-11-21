/**
 * FormUtils Contracts
 *
 * Generic form handler utilities for React state management
 * Reduces boilerplate code for form handling
 *
 * @module contracts/formUtils
 * @see app2/src/utils/formUtils.ts (implementation)
 */

import { ChangeEvent, Dispatch, SetStateAction } from 'react';

/**
 * Generic record type constraint
 * All form state must be objects with string keys
 */
export type FormState = Record<string, any>;

/**
 * Form handlers interface
 *
 * Generic handlers for common form operations
 */
export interface FormHandlers<T extends FormState> {
  /**
   * Handle input onChange event
   *
   * Generic handler for text inputs, textareas, etc.
   *
   * @param field - State field name
   * @returns onChange handler function
   *
   * @example
   * const { handleChange } = createFormHandler(setState);
   * <input name="name" onChange={handleChange('name')} />
   */
  handleChange: (
    field: keyof T
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

  /**
   * Handle select onChange event
   *
   * Generic handler for select, custom selects, etc.
   *
   * @param field - State field name
   * @returns onChange handler function
   *
   * @example
   * const { handleSelectChange } = createFormHandler(setState);
   * <select onChange={(e) => handleSelectChange('role')(e.target.value)} />
   */
  handleSelectChange: (field: keyof T) => (value: any) => void;

  /**
   * Handle checkbox onChange event
   *
   * Generic handler for checkboxes
   *
   * @param field - State field name
   * @returns onChange handler function
   *
   * @example
   * const { handleCheckboxChange } = createFormHandler(setState);
   * <input type="checkbox" onChange={handleCheckboxChange('agree')} />
   */
  handleCheckboxChange: (field: keyof T) => (e: ChangeEvent<HTMLInputElement>) => void;

  /**
   * Reset form to initial values
   *
   * @param initialValues - Initial form state
   *
   * @example
   * const { handleReset } = createFormHandler(setState);
   * <button onClick={() => handleReset(initialValues)}>Reset</button>
   */
  handleReset: (initialValues: T) => void;
}

/**
 * Form utility function contract
 */
export interface FormUtilsModule {
  /**
   * Create generic form handler
   *
   * Generates typed form handlers for React useState
   *
   * @param setState - React setState function
   * @returns Form handler object
   *
   * @example
   * const [formData, setFormData] = useState({ name: '', email: '' });
   * const { handleChange } = createFormHandler(setFormData);
   *
   * <input name="name" onChange={handleChange('name')} />
   * <input name="email" onChange={handleChange('email')} />
   */
  createFormHandler<T extends FormState>(
    setState: Dispatch<SetStateAction<T>>
  ): FormHandlers<T>;
}

/**
 * Form handler options
 */
export interface FormHandlerOptions {
  /**
   * Trim whitespace from string values
   * @default true
   */
  trimWhitespace?: boolean;

  /**
   * Convert empty strings to null
   * @default false
   */
  emptyAsNull?: boolean;

  /**
   * Validate on change
   * @default false
   */
  validateOnChange?: boolean;

  /**
   * Custom validation function
   */
  validator?: <T extends FormState>(field: keyof T, value: any) => boolean;
}

/**
 * TypeScript constraints
 */
export interface FormUtilsTypeConstraints {
  /**
   * State must be object with string keys
   */
  stateType: 'Record<string, any>';

  /**
   * Field names must be keyof T (type-safe)
   */
  fieldType: 'keyof T';

  /**
   * Handlers return void (side effects only)
   */
  returnType: 'void';

  /**
   * Full TypeScript strict mode compliance
   */
  strictMode: true;
}

/**
 * Usage pattern: Before → After
 */
export interface FormUtilsMigrationPattern {
  /**
   * Before: Duplicated handler code
   * @example
   * const [formData, setFormData] = useState({ name: '', email: '' });
   *
   * const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
   *   setFormData(prev => ({ ...prev, name: e.target.value })); // ❌ 중복
   * };
   *
   * const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
   *   setFormData(prev => ({ ...prev, email: e.target.value })); // ❌ 중복
   * };
   */
  before: string;

  /**
   * After: Generic handler
   * @example
   * import { createFormHandler } from '@/utils/formUtils';
   *
   * const [formData, setFormData] = useState({ name: '', email: '' });
   * const { handleChange } = createFormHandler(setFormData); // ✅ 한 줄
   *
   * <input name="name" onChange={handleChange('name')} /> // ✅
   * <input name="email" onChange={handleChange('email')} /> // ✅
   */
  after: string;

  /**
   * Benefits
   */
  benefits: {
    /**
     * Code reduction: ~70% (5 lines → 1 line)
     */
    codeReduction: '70%';

    /**
     * Type safety: Full TypeScript support
     */
    typeSafety: true;

    /**
     * Reusability: Works with any form state
     */
    reusability: true;
  };
}

/**
 * Integration with existing forms
 */
export interface FormUtilsIntegration {
  /**
   * Compatible with React Hook Form
   */
  reactHookForm: boolean;

  /**
   * Compatible with Formik
   */
  formik: boolean;

  /**
   * Compatible with plain useState
   */
  useState: boolean;

  /**
   * Compatible with Zustand stores
   */
  zustand: boolean;
}
