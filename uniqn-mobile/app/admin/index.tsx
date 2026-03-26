import { Redirect } from 'expo-router';
import { resolveAdminAliasHref } from '@/shared/navigation/webRouteAliases';

export default function AdminAliasIndex() {
  return <Redirect href={resolveAdminAliasHref()} />;
}
