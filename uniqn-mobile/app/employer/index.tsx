import { Redirect } from 'expo-router';
import { resolveEmployerAliasHref } from '@/shared/navigation/webRouteAliases';

export default function EmployerAliasIndex() {
  return <Redirect href={resolveEmployerAliasHref()} />;
}
