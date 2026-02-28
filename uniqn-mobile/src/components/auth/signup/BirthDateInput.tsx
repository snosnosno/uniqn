/**
 * 생년월일 입력 컴포넌트 (년/월/일 3칸)
 *
 * @description YYYYMMDD 형식의 생년월일을 3개 필드로 분리 입력
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, type TextInput } from 'react-native';
import { Input } from '@/components/ui/Input';

interface BirthDateInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BirthDateInput({ value, onChange, disabled }: BirthDateInputProps) {
  const [year, setYear] = useState(value ? value.substring(0, 4) : '');
  const [month, setMonth] = useState(value ? value.substring(4, 6) : '');
  const [day, setDay] = useState(value ? value.substring(6, 8) : '');

  const monthRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);

  // [W4] 부모 value 변경 시 내부 state 동기화 (form reset 등)
  // 빈 문자열은 부분 입력 중 리셋이므로 내부 state 유지
  useEffect(() => {
    if (!value) return;
    const parentYear = value.substring(0, 4);
    const parentMonth = value.substring(4, 6);
    const parentDay = value.substring(6, 8);
    if (parentYear !== year || parentMonth !== month || parentDay !== day) {
      setYear(parentYear);
      setMonth(parentMonth);
      setDay(parentDay);
    }
    // value만 의존 (내부 state 변경 시 무한 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const updateValue = (y: string, m: string, d: string) => {
    if (y.length === 4 && m.length === 2 && d.length === 2) {
      onChange(`${y}${m}${d}`);
    } else {
      // 조건 미충족 시 빈 문자열로 리셋 → 폼 검증이 불완전 입력을 방지
      onChange('');
    }
  };

  const handleYearChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    setYear(cleaned);
    if (cleaned.length === 4) {
      monthRef.current?.focus();
    }
    updateValue(cleaned, month, day);
  };

  const handleMonthChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 2);
    setMonth(cleaned);
    if (cleaned.length === 2) {
      dayRef.current?.focus();
    }
    updateValue(year, cleaned, day);
  };

  const handleDayChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 2);
    setDay(cleaned);
    updateValue(year, month, cleaned);
  };

  return (
    <View className="flex-row gap-2">
      <View className="flex-[2]">
        <Input
          placeholder="YYYY"
          value={year}
          onChangeText={handleYearChange}
          keyboardType="number-pad"
          maxLength={4}
          editable={!disabled}
          accessibilityLabel="출생 연도"
        />
      </View>
      <View className="flex-1">
        <Input
          ref={monthRef}
          placeholder="MM"
          value={month}
          onChangeText={handleMonthChange}
          keyboardType="number-pad"
          maxLength={2}
          editable={!disabled}
          accessibilityLabel="출생 월"
        />
      </View>
      <View className="flex-1">
        <Input
          ref={dayRef}
          placeholder="DD"
          value={day}
          onChangeText={handleDayChange}
          keyboardType="number-pad"
          maxLength={2}
          editable={!disabled}
          accessibilityLabel="출생 일"
        />
      </View>
    </View>
  );
}
