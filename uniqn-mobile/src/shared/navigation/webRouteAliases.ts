export function resolveAdminAliasHref(slug?: string[] | string): string {
  const segments = Array.isArray(slug) ? slug : slug ? [slug] : [];

  if (segments.length === 0 || segments[0] === 'dashboard') {
    return '/(admin)';
  }

  if (segments[0] === 'users') {
    if (segments[1]) {
      return `/(admin)/users/${segments[1]}`;
    }
    return '/(admin)/users';
  }

  if (segments[0] === 'reports') {
    if (segments[1]) {
      return `/(admin)/reports/${segments[1]}`;
    }
    return '/(admin)/reports';
  }

  if (segments[0] === 'inquiries') {
    if (segments[1]) {
      return `/(admin)/inquiries/${segments[1]}`;
    }
    return '/(admin)/inquiries';
  }

  if (segments[0] === 'tournaments') {
    return '/(admin)/tournaments';
  }

  if (segments[0] === 'stats') {
    return '/(admin)/stats';
  }

  if (segments[0] === 'announcements') {
    if (segments[1] === 'create') {
      return '/(admin)/announcements/create';
    }

    if (segments[1] && segments[2] === 'edit') {
      return `/(admin)/announcements/${segments[1]}/edit`;
    }

    if (segments[1]) {
      return `/(admin)/announcements/${segments[1]}`;
    }

    return '/(admin)/announcements';
  }

  return '/(admin)';
}

export function resolveEmployerAliasHref(slug?: string[] | string): string {
  const segments = Array.isArray(slug) ? slug : slug ? [slug] : [];

  if (segments.length === 0) {
    return '/(app)/(tabs)/employer';
  }

  if (segments[0] === 'my-postings') {
    if (segments[1] === 'create') {
      return '/(employer)/my-postings/create';
    }

    if (segments[1]) {
      return `/(employer)/my-postings/${segments[1]}`;
    }

    return '/(app)/(tabs)/employer';
  }

  if (segments[0] === 'applicants' && segments[1]) {
    return `/(employer)/my-postings/${segments[1]}/applicants`;
  }

  if (segments[0] === 'settlement' && segments[1]) {
    return `/(employer)/my-postings/${segments[1]}/settlements`;
  }

  return '/(app)/(tabs)/employer';
}
