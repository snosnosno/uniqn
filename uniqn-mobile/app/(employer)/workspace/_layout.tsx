/**
 * UNIQN Mobile - Workspace Stack Layout
 * 공고 워크스페이스 협업 (PR #3) — 3 화면 (index / invite / invitations)
 */

import { Stack } from 'expo-router';

export default function WorkspaceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
