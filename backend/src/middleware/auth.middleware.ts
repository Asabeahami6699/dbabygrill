// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { displayNameFromAuthUser } from '../lib/authUserMeta';

export interface User {
  id: string;
  email: string;
  role: string;
  company_id?: string | null;
  full_name?: string;
  phone?: string;
}

export interface AuthRequest extends Request {
  user?: User;
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

const getErrorCode = (error: any): string | undefined =>
  error?.code ?? error?.cause?.code;

/** Network / Supabase reachability failures (not invalid credentials). */
const isRetryableNetworkError = (error: any): boolean => {
  if (!error) return false;
  const code = getErrorCode(error);
  return (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    error?.status === 0 ||
    error?.name === 'AuthRetryableFetchError' ||
    String(error?.message || '').toLowerCase().includes('fetch failed')
  );
};

const isAuthResultNetworkFailure = (authError: any): boolean =>
  isRetryableNetworkError(authError) || authError?.status === 0;

// Retry Supabase calls on transient network timeouts
const fetchWithRetry = async <T>(
  fn: () => Promise<T>,
  retries = 4,
  delay = 1500
): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (i === retries - 1 || !isRetryableNetworkError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw lastError ?? new Error('Request failed after retries');
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // ======================
    // 1. GET TOKEN
    // ======================
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // ======================
    // 2. VERIFY USER WITH RETRY
    // ======================
    let userResult: Awaited<ReturnType<typeof supabase.auth.getUser>>;
    try {
      userResult = await fetchWithRetry(() => supabase.auth.getUser(token));
    } catch (error: any) {
      console.error('Auth getUser failed:', error);
      if (isRetryableNetworkError(error)) {
        return res.status(503).json({
          error:
            'Cannot reach authentication service. Check your internet connection and try again.',
          code: 'AUTH_SERVICE_UNAVAILABLE',
        });
      }
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { data: { user }, error: authError } = userResult;

    if (authError || !user) {
      console.error('Auth error:', authError);
      if (isAuthResultNetworkFailure(authError)) {
        return res.status(503).json({
          error:
            'Cannot reach authentication service. Check your internet connection and try again.',
          code: 'AUTH_SERVICE_UNAVAILABLE',
        });
      }
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // ======================
    // 3. GET USER PROFILE
    // ======================
    // Check if user is a delivery guy first
    const { data: deliveryGuy } = await fetchWithRetry(async () => {
      const result = await supabase
        .from('delivery_guys')
        .select('id, full_name, phone, company_id, is_active')
        .eq('user_id', user.id)
        .single();
      return result;
    });

    if (deliveryGuy && deliveryGuy.is_active) {
      req.user = {
        id: user.id,
        email: user.email || '',
        role: 'delivery_guy',
        company_id: deliveryGuy.company_id,
        full_name: deliveryGuy.full_name,
        phone: deliveryGuy.phone
      };
      return next();
    }

    const { data: profile, error: profileError } = await fetchWithRetry(async () => {
      const result = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      return result;
    });

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      // Try to create profile if it doesn't exist
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            role: user.user_metadata?.role || 'customer',
            full_name:
              user.user_metadata?.full_name ||
              displayNameFromAuthUser(user) ||
              '',
            phone: user.user_metadata?.phone || '',
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!createError && newProfile) {
          req.user = {
            id: user.id,
            email: user.email || '',
            role: newProfile.role,
            company_id: null,
            full_name: newProfile.full_name,
            phone: newProfile.phone
          };
          return next();
        }
      }
      return res.status(404).json({ error: 'User profile not found' });
    }

    // ======================
    // 4. GET COMPANY ID
    // ======================
    let companyId = profile.company_id || null;

    // ======================
    // 5. VALIDATE ROLE LOGIC - Fetch company if needed
    // ======================
    if (profile.role === 'company_admin') {
      if (!companyId) {
        // Fallback for older records: try to locate company by admin email.
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('id')
          .ilike('email', user.email || '')
          .single();

        if (!companyError && company) {
          companyId = company.id;
          // Update user profile with company_id
          await supabase
            .from('users')
            .update({ company_id: companyId })
            .eq('id', user.id);
        }
      }

      if (!companyId) {
        return res.status(400).json({
          error: 'Company not linked to this admin user'
        });
      }
    }

    // ======================
    // 6. ATTACH USER TO REQUEST
    // ======================
    req.user = {
      id: user.id,
      email: user.email || '',
      role: profile.role,
      company_id: companyId,
      full_name: profile.full_name,
      phone: profile.phone
    };

    next();
  } catch (error: any) {
    console.error('Auth error:', error);
    if (isRetryableNetworkError(error)) {
      return res.status(503).json({
        error:
          'Cannot reach authentication service. Check your internet connection and try again.',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional: Middleware to check if user has specific role
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};