/** Set VITE_REQUIRE_EMAIL_VERIFICATION=true when Supabase "Confirm email" + SMTP are enabled. */
export const requireEmailVerification =
  import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION === 'true';
