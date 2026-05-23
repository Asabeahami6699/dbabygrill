/** Canonical public site URL (Vercel production). */
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://dbabygrill.vercel.app';

export const SITE_NAME = 'DBaby Grills';
