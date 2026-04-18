import React from 'react';
import { Text, View } from 'react-native';
import { NumericText } from '@/components/ui';
import type { PostingCompensationSource } from './postingSurfaceModel';
import { buildPostingCompensationModel } from './postingSurfaceModel';

interface PostingCompensationContentProps extends PostingCompensationSource {
  display: 'card' | 'detail';
}

export function PostingCompensationContent({
  display,
  ...source
}: PostingCompensationContentProps) {
  const compensation = buildPostingCompensationModel(source, { display });

  if (display === 'detail') {
    if (!compensation.useSameSalary && compensation.rows.length > 0) {
      return (
        <View className="py-1">
          {compensation.rows.map((row) => (
            <View key={row.key} className="flex-row items-center justify-between py-1">
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                {row.roleLabel}
              </Text>
              <NumericText className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                {row.text}
              </NumericText>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View className="py-1">
        <NumericText className="text-lg font-display text-primary-600 dark:text-primary-400">
          {compensation.primaryText}
        </NumericText>
      </View>
    );
  }

  return (
    <View>
      {!compensation.useSameSalary && compensation.rows.length > 0 ? (
        compensation.rows.map((row) => (
          <NumericText
            key={row.key}
            className="text-sm text-content-primary dark:text-off-white font-sans"
          >
            {row.roleLabel}: {row.text}
          </NumericText>
        ))
      ) : (
        <NumericText className="text-sm font-sans-medium text-content-primary dark:text-off-white">
          {compensation.primaryText}
        </NumericText>
      )}

      {compensation.allowanceLabels.length > 0 ? (
        <View className="mt-1">
          {compensation.allowanceLabels.map((item, index) => (
            <Text
              key={`${item}-${index}`}
              className="text-sm text-secondary-500 dark:text-secondary-400 font-sans"
            >
              {item}
            </Text>
          ))}
        </View>
      ) : null}

      {compensation.taxLabel ? (
        <Text className="mt-1 text-xs text-content-placeholder font-sans">
          {compensation.taxLabel}
        </Text>
      ) : null}

      {compensation.overflowCount > 0 ? (
        <Text className="mt-1 text-xs text-content-placeholder font-sans">
          +{compensation.overflowCount}개 역할 급여 더 있음
        </Text>
      ) : null}
    </View>
  );
}

export default PostingCompensationContent;
