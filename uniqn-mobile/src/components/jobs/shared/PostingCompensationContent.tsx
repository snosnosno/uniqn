import React from 'react';
import { Text, View } from 'react-native';
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
              <Text className="text-sm text-secondary-600 dark:text-secondary-400">
                {row.roleLabel}
              </Text>
              <Text className="text-sm font-medium text-secondary-900 dark:text-white">
                {row.text}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View className="py-1">
        <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
          {compensation.primaryText}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {!compensation.useSameSalary && compensation.rows.length > 0 ? (
        compensation.rows.map((row) => (
          <Text key={row.key} className="text-sm text-secondary-900 dark:text-white">
            {row.roleLabel}: {row.text}
          </Text>
        ))
      ) : (
        <Text className="text-sm font-medium text-secondary-900 dark:text-white">
          {compensation.primaryText}
        </Text>
      )}

      {compensation.allowanceLabels.length > 0 ? (
        <View className="mt-1">
          {compensation.allowanceLabels.map((item, index) => (
            <Text
              key={`${item}-${index}`}
              className="text-sm text-secondary-500 dark:text-secondary-400"
            >
              {item}
            </Text>
          ))}
        </View>
      ) : null}

      {compensation.taxLabel ? (
        <Text className="mt-1 text-xs text-secondary-400 dark:text-secondary-500">
          {compensation.taxLabel}
        </Text>
      ) : null}

      {compensation.overflowCount > 0 ? (
        <Text className="mt-1 text-xs text-secondary-400 dark:text-secondary-500">
          +{compensation.overflowCount}개 역할 급여 더 있음
        </Text>
      ) : null}
    </View>
  );
}

export default PostingCompensationContent;
