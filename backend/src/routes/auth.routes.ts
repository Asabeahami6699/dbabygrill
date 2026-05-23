// backend/src/routes/auth.routes.ts
import { Router, Request, Response } from 'express';
import { supabase, supabaseAuth } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { verifyTurnstileToken } from '../lib/turnstile';
import { displayNameFromAuthUser } from '../lib/authUserMeta';

const router = Router();

const frontendBaseUrl = () =>
  (process.env.FRONTEND_URL || process.env.SITE_URL || 'http://localhost:5173').replace(
    /\/$/,
    ''
  );

/** Only email_confirmed_at counts — confirmed_at alone can be set before the user clicks the link. */
const isEmailVerified = (user: { email_confirmed_at?: string | null }) =>
  Boolean(user.email_confirmed_at);

const emailConfirmRedirectUrl = () =>
  `${frontendBaseUrl()}/login?verified=1`;

const clientIp = (req: Request) =>
  (req.headers['cf-connecting-ip'] as string) ||
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress;

// ======================
// SIGN UP
// ======================
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      fullName,
      phone,
      role,
      companyName,
      turnstileToken,
      digital_address,
      street_address,
      region,
      city,
      landmark,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const captcha = await verifyTurnstileToken(turnstileToken, clientIp(req));
    if (!captcha.ok) {
      return res.status(400).json({ error: captcha.error || 'Security verification failed' });
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailConfirmRedirectUrl(),
        data: {
          full_name: fullName || '',
          phone: phone || '',
          role: role || 'customer',
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email,
        full_name: fullName || '',
        phone: phone || '',
        role: role || 'customer',
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      throw profileError;
    }

    if (role === 'company_admin') {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName || `${fullName || 'New'}'s Restaurant`,
          email,
          phone: phone || '',
          location: '',
          description: '',
        })
        .select('id')
        .single();

      if (companyError) {
        console.error('Company creation error:', companyError);
      } else if (companyData?.id) {
        const { error: linkError } = await supabase
          .from('users')
          .update({ company_id: companyData.id })
          .eq('id', authData.user.id);

        if (linkError) console.error('Company link error:', linkError);
      }
    }

    if ((role || 'customer') === 'customer' && street_address) {
      const { error: addressError } = await supabase.from('addresses').insert({
        user_id: authData.user.id,
        address_type: 'shipping',
        is_default: true,
        digital_address: digital_address || null,
        street_address,
        region: region || null,
        city: city || null,
        landmark: landmark || null,
        phone: phone || null,
        recipient_name: fullName || null,
      });
      if (addressError) console.error('Signup address error:', addressError);
    }

    res.status(201).json({
      success: true,
      message:
        'Account created. Please check your email and click the verification link before signing in.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: role || 'customer',
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// ======================
// RESEND EMAIL VERIFICATION
// ======================
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabaseAuth.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: emailConfirmRedirectUrl(),
      },
    });

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Verification email sent. Check your inbox and spam folder.',
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return res.status(500).json({
      error: error.message || 'Could not send verification email',
    });
  }
});

// ======================
// SIGN IN
// ======================
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password, turnstileToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const captcha = await verifyTurnstileToken(turnstileToken, clientIp(req));
    if (!captcha.ok) {
      return res.status(400).json({ error: captcha.error || 'Security verification failed' });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
        return res.status(403).json({
          error:
            'Please verify your email before signing in. Check your inbox for the confirmation link.',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }
      throw error;
    }
    if (!data.user) throw new Error('No user data returned');

    // Customers must verify email (staff roles may use admin-created accounts)
    const { data: deliveryGuyPrecheck } = await supabase
      .from('delivery_guys')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    const { data: userPrecheck } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    const role = deliveryGuyPrecheck
      ? 'delivery_guy'
      : userPrecheck?.role || data.user.user_metadata?.role || 'customer';

    if (role === 'customer' && !isEmailVerified(data.user)) {
      if (data.session) {
        await supabase.auth.admin.signOut(data.user.id, 'global');
      }
      return res.status(403).json({
        error:
          'Please verify your email before signing in. Check your inbox for the confirmation link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    if (!data.session?.refresh_token) {
      // Session still returned; client may refresh via Supabase SDK
    }

    // Check delivery_guys first
    const { data: deliveryGuy } = await supabase
      .from('delivery_guys')
      .select('id, full_name, phone, company_id, is_active')
      .eq('user_id', data.user.id)
      .single();

    if (deliveryGuy) {
      if (!deliveryGuy.is_active) {
        return res.status(401).json({ error: 'Delivery guy account is inactive' });
      }

      return res.json({
        success: true,
        message: 'Login successful',
        session: data.session,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: 'delivery_guy',
          full_name: deliveryGuy.full_name,
          phone: deliveryGuy.phone,
          company_id: deliveryGuy.company_id,
          delivery_guy_id: deliveryGuy.id,
        },
      });
    }

    let userProfile = null;
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profile) {
      userProfile = profile;
    } else {
      const { data: newProfile } = await supabase
        .from('users')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          full_name:
            data.user.user_metadata?.full_name ||
            displayNameFromAuthUser(data.user) ||
            '',
          phone: data.user.user_metadata?.phone || '',
          role: data.user.user_metadata?.role || 'customer',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      userProfile = newProfile;
    }

    let company = null;
    if (userProfile?.role === 'company_admin') {
      let companyId = userProfile?.company_id;

      if (!companyId) {
        const { data: fallbackCompany } = await supabase
          .from('companies')
          .select('id')
          .ilike('email', data.user.email || '')
          .single();
        companyId = fallbackCompany?.id || null;

        if (companyId) {
          await supabase
            .from('users')
            .update({ company_id: companyId })
            .eq('id', data.user.id);
        }
      }

      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name, location, phone, email, logo')
        .eq('id', companyId)
        .single();
      company = companyData;
    }

    res.json({
      success: true,
      message: 'Login successful',
      session: data.session,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: userProfile?.role || 'customer',
        full_name: userProfile?.full_name || data.user.user_metadata?.full_name,
        phone: userProfile?.phone || data.user.user_metadata?.phone,
        company_id: company?.id,
        company,
      },
    });
  } catch (error: any) {
    console.error('Signin error:', error);
    res.status(401).json({ error: error.message || 'Invalid credentials' });
  }
});

// ======================
// SIGN OUT
// ─────────────────────
// DO NOT call supabaseAuth.auth.signOut() here — the service role key
// cannot sign out user sessions and returns 403, which the Supabase JS
// client misinterprets as a logout event, killing the session on refresh.
// The frontend handles the actual Supabase session signout itself.
// ======================
router.post('/signout', async (req: Request, res: Response) => {
  // Nothing to do server-side — just acknowledge.
  // Frontend calls supabase.auth.signOut() directly after this.
  res.json({ success: true, message: 'Signed out successfully' });
});

// ======================
// OAUTH SYNC (Google / other providers via Supabase)
// Ensures public.users row exists and name is filled from provider metadata.
// ======================
router.post('/oauth-sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const token = authHeader.split(' ')[1];

    const { data: authResult, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authResult.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    const authUser = authResult.user;

    const { data: deliveryGuy } = await supabase
      .from('delivery_guys')
      .select('id, full_name, phone, company_id, is_active')
      .eq('user_id', authUser.id)
      .single();

    if (deliveryGuy) {
      if (!deliveryGuy.is_active) {
        return res.status(401).json({ error: 'Delivery guy account is inactive' });
      }
      return res.json({
        success: true,
        user: {
          id: authUser.id,
          email: authUser.email,
          role: 'delivery_guy',
          full_name: deliveryGuy.full_name,
          phone: deliveryGuy.phone,
          company_id: deliveryGuy.company_id,
          delivery_guy_id: deliveryGuy.id,
        },
      });
    }

    const oauthName = displayNameFromAuthUser(authUser);
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .upsert(
        {
          id: authUser.id,
          email: authUser.email,
          role: existingProfile?.role || 'customer',
          full_name: existingProfile?.full_name?.trim() || oauthName || '',
          phone: existingProfile?.phone || '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (profileError) throw profileError;

    let company = null;
    if (userProfile?.role === 'company_admin') {
      let companyId = userProfile.company_id;
      if (!companyId) {
        const { data: fallback } = await supabase
          .from('companies')
          .select('id')
          .ilike('email', authUser.email || '')
          .maybeSingle();
        companyId = fallback?.id || null;
        if (companyId) {
          await supabase.from('users').update({ company_id: companyId }).eq('id', authUser.id);
        }
      }
      if (companyId) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name, location, phone, email, logo, description')
          .eq('id', companyId)
          .single();
        company = companyData;
      }
    }

    return res.json({
      success: true,
      user: {
        id: authUser.id,
        email: authUser.email,
        role: userProfile?.role || 'customer',
        full_name: userProfile?.full_name || oauthName,
        phone: userProfile?.phone || '',
        company_id: company?.id,
        company,
      },
    });
  } catch (error: any) {
    console.error('OAuth sync error:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync account' });
  }
});

// ======================
// GET CURRENT USER (Authenticated)
// ======================
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: deliveryGuy } = await supabase
      .from('delivery_guys')
      .select('id, full_name, phone, company_id, is_active')
      .eq('user_id', req.user.id)
      .single();

    if (deliveryGuy) {
      return res.json({
        id: req.user.id,
        email: req.user.email,
        role: 'delivery_guy',
        full_name: deliveryGuy.full_name,
        phone: deliveryGuy.phone,
        company_id: deliveryGuy.company_id,
      });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .upsert(
          {
            id: req.user.id,
            email: req.user.email,
            role: 'customer',
            full_name: '',
            phone: '',
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (createError) throw createError;

      return res.json({
        id: req.user.id,
        email: req.user.email,
        role: 'customer',
        full_name: '',
        phone: '',
      });
    }

    let company = null;
    if (profile.role === 'company_admin') {
      let companyId = profile.company_id;

      if (!companyId) {
        const { data: fallback } = await supabase
          .from('companies')
          .select('id')
          .ilike('email', req.user.email)
          .single();
        companyId = fallback?.id || null;

        if (companyId) {
          await supabase
            .from('users')
            .update({ company_id: companyId })
            .eq('id', req.user.id);
        }
      }

      if (companyId) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name, location, phone, email, logo, description')
          .eq('id', companyId)
          .single();
        company = companyData;
      }
    }

    res.json({
      id: req.user.id,
      email: req.user.email,
      role: profile.role,
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      company_id: company?.id || null,
      company,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

// ======================
// GET USER PROFILE (customer saved address + account info)
// ======================
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, full_name, phone, role')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const { data: address } = await supabase
      .from('addresses')
      .select('recipient_name, phone, street_address, city, region, landmark')
      .eq('user_id', userId)
      .eq('address_type', 'shipping')
      .eq('is_default', true)
      .maybeSingle();

    res.json({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name || address?.recipient_name || '',
      phone: profile.phone || address?.phone || '',
      address: address?.street_address || '',
      city: address?.city || '',
      region: address?.region || 'Ghana',
      landmark: address?.landmark || '',
      postal_code: '',
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to load profile' });
  }
});

// ======================
// UPDATE USER PROFILE
// ======================
router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { full_name, phone, address, city, region, landmark } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: full_name?.trim() || '',
        phone: phone?.trim() || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, email, full_name, phone, role')
      .single();

    if (error) throw error;

    // Sync default shipping address (used at checkout)
    const street = address?.trim() || '';
    const cityVal = city?.trim() || '';
    const regionVal = region?.trim() || cityVal || 'Ghana';

    const addressPayload: Record<string, unknown> = {
      user_id: userId,
      recipient_name: full_name?.trim() || '',
      phone: phone?.trim() || '',
      street_address: street || '—',
      city: cityVal || regionVal,
      region: regionVal,
      landmark: landmark?.trim() || null,
      address_type: 'shipping',
      is_default: true,
      updated_at: new Date().toISOString(),
    };
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', userId)
      .eq('address_type', 'shipping')
      .eq('is_default', true)
      .maybeSingle();

    if (existingAddress?.id) {
      await supabase
        .from('addresses')
        .update(addressPayload)
        .eq('id', existingAddress.id);
    } else if (street || cityVal) {
      await supabase
        .from('addresses')
        .insert({ ...addressPayload, created_at: new Date().toISOString() });
    }

    // Keep auth metadata in sync for display fallbacks
    try {
      await supabaseAuth.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: full_name?.trim() || '',
          phone: phone?.trim() || '',
          role: data.role || 'customer',
        },
      });
    } catch (metaErr) {
      console.error('Auth metadata sync error:', metaErr);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: data.id,
        email: data.email,
        role: data.role,
        full_name: data.full_name,
        phone: data.phone,
        address: street,
        city: cityVal,
        region: regionVal,
        landmark: landmark?.trim() || '',
        postal_code: '',
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

// ======================
// RESET PASSWORD (request email)
// ======================
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendBaseUrl()}/reset-password`,
    });

    if (error) {
      console.error('Reset password email error:', error);
      // Do not reveal whether the email exists
    }

    return res.json({
      success: true,
      message:
        'If an account exists for this email, a password reset link has been sent.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// ======================
// CHANGE PASSWORD (Authenticated)
// ======================
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: req.user?.email || '',
      password: currentPassword,
    });

    if (signInError) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const { error } = await supabaseAuth.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message || 'Failed to change password' });
  }
});

export default router;