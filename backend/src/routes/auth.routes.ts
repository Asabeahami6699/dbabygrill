// backend/src/routes/auth.routes.ts
import { Router, Request, Response } from 'express';
import { supabase, supabaseAuth } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// ======================
// SIGN UP
// ======================
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phone, role, companyName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
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

    res.status(201).json({
      success: true,
      message: 'User created successfully',
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
// SIGN IN
// ======================
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user data returned');

    if (!data.session?.refresh_token) {
      console.error('[signin] WARNING: refresh_token missing from session');
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
          full_name: data.user.user_metadata?.full_name || '',
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
      const { error: addressError } = await supabase
        .from('addresses')
        .update(addressPayload)
        .eq('id', existingAddress.id);
      if (addressError) console.warn('Address update warning:', addressError.message);
    } else if (street || cityVal) {
      const { error: addressError } = await supabase
        .from('addresses')
        .insert({ ...addressPayload, created_at: new Date().toISOString() });
      if (addressError) console.warn('Address insert warning:', addressError.message);
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
      console.warn('Auth metadata sync warning:', metaErr);
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
// RESET PASSWORD
// ======================
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`,
    });

    if (error) throw error;

    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message || 'Failed to send reset email' });
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