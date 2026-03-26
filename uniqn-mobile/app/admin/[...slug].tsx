import { Redirect, useLocalSearchParams } from 'expo-router';
import { resolveAdminAliasHref } from '@/shared/navigation/webRouteAliases';

export default function AdminAliasCatchAll() {
  const { slug } = useLocalSearchParams<{ slug?: string[] | string }>();
  return <Redirect href={resolveAdminAliasHref(slug)} />;
}
