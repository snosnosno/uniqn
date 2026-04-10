import { Redirect, useLocalSearchParams } from 'expo-router';
import { buildBoardNoticePostId } from '@/shared/board/boardIds';

export default function NoticeDetailRedirectPage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return <Redirect href="/(app)/(tabs)/board/notice" />;
  }

  return <Redirect href={`/(app)/(tabs)/board/post/${buildBoardNoticePostId(id)}`} />;
}
