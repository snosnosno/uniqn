import React from 'react';
import { render } from '@testing-library/react-native';
import { NotificationList } from '../NotificationList';
import { NotificationType } from '@/types/notification';

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
  }: {
    data: unknown[];
    renderItem: ({ item, index }: { item: unknown; index: number }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return (
      <ReactNative.View>
        {data.length > 0
          ? data.map((item, index) => (
              <ReactNative.View key={String(index)}>{renderItem({ item, index })}</ReactNative.View>
            ))
          : ListEmptyComponent}
        {ListFooterComponent}
      </ReactNative.View>
    );
  },
}));

jest.mock('../NotificationItem', () => ({
  NotificationItem: ({ notification }: { notification: { title: string } }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.Text>{notification.title}</ReactNative.Text>;
  },
  NotificationItemSkeleton: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.Text>loading</ReactNative.Text>;
  },
}));

jest.mock('../NotificationGroupItem', () => ({
  NotificationGroupItem: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.Text>group</ReactNative.Text>;
  },
}));

describe('NotificationList', () => {
  it('keeps the current list visible when a refresh error happens with existing notifications', () => {
    const notifications = [
      {
        id: 'notification-1',
        recipientId: 'user-1',
        type: NotificationType.ANNOUNCEMENT,
        title: '기존 알림',
        body: '이미 보던 알림입니다.',
        isRead: false,
        createdAt: new (global as any).MockTimestamp(0, 0),
      },
    ] as any;

    const { getByText, queryByText } = render(
      <NotificationList notifications={notifications} error={new Error('network')} />
    );

    expect(getByText('기존 알림')).toBeTruthy();
    expect(
      getByText('새 알림을 가져오지 못했어요. 보고 있던 목록은 그대로 유지했습니다.')
    ).toBeTruthy();
    expect(queryByText('알림을 불러오지 못했습니다.')).toBeNull();
  });
});
