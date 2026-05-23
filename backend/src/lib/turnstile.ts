const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!token?.trim()) {
    return { ok: false, skipped: false, error: 'Security check required. Please complete the verification.' };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token.trim(),
    });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };

    if (data.success) {
      return { ok: true, skipped: false };
    }

    console.warn('[turnstile] verification failed:', data['error-codes']);
    return { ok: false, skipped: false, error: 'Security verification failed. Please try again.' };
  } catch (err) {
    console.error('[turnstile] verify error:', err);
    return { ok: false, skipped: false, error: 'Could not verify security check. Try again.' };
  }
}
