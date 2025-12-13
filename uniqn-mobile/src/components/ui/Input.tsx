/**
 * UNIQN Mobile - Input 컴포넌트
 *
 * @description 라벨, 에러, 힌트, 아이콘을 지원하는 텍스트 입력
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, TextInputProps } from 'react-native';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';

type InputType = 'text' | 'email' | 'password' | 'number' | 'phone';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  type?: InputType;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  type = 'text',
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = type === 'password';

  const getKeyboardType = (): TextInputProps['keyboardType'] => {
    switch (type) {
      case 'email':
        return 'email-address';
      case 'number':
        return 'numeric';
      case 'phone':
        return 'phone-pad';
      default:
        return 'default';
    }
  };

  const getBorderClass = () => {
    if (error) {
      return 'border-error-500 bg-error-50 dark:bg-error-900/20';
    }
    if (isFocused) {
      return 'border-primary-500 bg-white dark:bg-gray-800';
    }
    return 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800';
  };

  return (
    <View className="w-full">
      {label && (
        <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Text>
      )}

      <View
        className={`
          flex-row items-center rounded-lg border px-3
          ${getBorderClass()}
        `}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}

        <TextInput
          {...props}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={getKeyboardType()}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className="flex-1 py-3 text-base text-gray-900 dark:text-gray-100"
          placeholderTextColor="#9CA3AF"
        />

        {isPassword && (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            className="p-1"
            hitSlop={8}
          >
            {showPassword ? (
              <EyeSlashIcon size={20} color="#6B7280" />
            ) : (
              <EyeIcon size={20} color="#6B7280" />
            )}
          </Pressable>
        )}

        {rightIcon && !isPassword && <View className="ml-2">{rightIcon}</View>}
      </View>

      {(error || hint) && (
        <Text
          className={`mt-1 text-sm ${
            error ? 'text-error-500' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}

export default Input;
