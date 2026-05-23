/** Display name from Supabase user_metadata (email/password or Google OAuth). */
export function displayNameFromAuthUser(user: {
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata || {};
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (typeof meta.name === 'string' && meta.name.trim()) {
    return meta.name.trim();
  }
  const given = typeof meta.given_name === 'string' ? meta.given_name.trim() : '';
  const family = typeof meta.family_name === 'string' ? meta.family_name.trim() : '';
  if (given || family) {
    return [given, family].filter(Boolean).join(' ');
  }
  return '';
}
