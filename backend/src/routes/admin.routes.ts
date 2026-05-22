import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { supabase } from '../config/supabase';

const router = Router();

// Get all companies
router.get(
  '/companies',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  }
);

// Create a new company
router.post(
  '/companies',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, location, phone, email } = req.body;
      
      const { data, error } = await supabase
        .from('companies')
        .insert([{ name, description, location, phone, email, is_active: true }])
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(data);
    } catch (error) {
      console.error('Create company error:', error);
      res.status(500).json({ error: 'Failed to create company' });
    }
  }
);

// Update company
router.put(
  '/companies/:id',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Update company error:', error);
      res.status(500).json({ error: 'Failed to update company' });
    }
  }
);

// Delete company
router.delete(
  '/companies/:id',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(204).send();
    } catch (error) {
      console.error('Delete company error:', error);
      res.status(500).json({ error: 'Failed to delete company' });
    }
  }
);

// Delete a user (company admin)
router.post(
  '/delete-user',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      console.log('Deleting user:', userId);
      
      // Delete the user from auth (this will cascade to public.users if properly set up)
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ error: error.message });
      }
      
      console.log('User deleted successfully');
      
      res.json({ message: 'User deleted successfully' });
      
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// Get all company admins
router.get(
  '/company-admins',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, companies(name)')
        .eq('role', 'company_admin')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error('Get company admins error:', error);
      res.status(500).json({ error: 'Failed to fetch company admins' });
    }
  }
);

// Create company owner/admin
router.post(
  '/create-company-owner',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { email, password, full_name, phone, company_id } = req.body;
      
      console.log('=== Creating company admin ===');
      console.log('Request body:', { email, full_name, company_id, phone });
      
      // Validate required fields
      if (!email || !password || !full_name || !company_id) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['email', 'password', 'full_name', 'company_id'],
          received: { email, full_name, company_id }
        });
      }
      
      // Check if company exists
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', company_id)
        .single();
      
      if (companyError || !company) {
        console.error('Company not found:', company_id);
        return res.status(400).json({ error: 'Company not found' });
      }
      
      console.log('Company found:', company.name);
      
      // Check if user already exists in auth using listUsers
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        return res.status(500).json({ error: 'Failed to check existing users' });
      }
      
      // Safely find existing user by email
      const existingUser = existingUsers?.users?.find((user: any) => user.email === email);
      let userId;
      
      if (existingUser) {
        console.log('User already exists in auth:', existingUser.id);
        userId = existingUser.id;
        
        // Update user metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          userId,
          {
            user_metadata: {
              full_name,
              phone,
              role: 'company_admin',
              company_id
            }
          }
        );
        
        if (updateError) {
          console.error('Error updating user metadata:', updateError);
          // Don't return error, continue with profile update
        }
      } else {
        // Create new user in auth
        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name,
            phone,
            role: 'company_admin',
            company_id
          }
        });
        
        if (createError) {
          console.error('Error creating auth user:', createError);
          return res.status(500).json({ error: `Auth creation failed: ${createError.message}` });
        }
        
        if (!authData.user) {
          return res.status(500).json({ error: 'Failed to create auth user - no user returned' });
        }
        
        userId = authData.user.id;
        console.log('Auth user created:', userId);
      }
      
      // Now handle public.users - UPSERT (insert or update)
      const userProfile = {
        id: userId,
        email,
        role: 'company_admin',
        company_id,
        full_name,
        phone: phone || null,
      };
      
      console.log('Upserting profile:', userProfile);
      
      // Use upsert to avoid duplicate key error
      const { error: profileError } = await supabase
        .from('users')
        .upsert(userProfile, { onConflict: 'id' });
      
      if (profileError) {
        console.error('Error upserting profile:', profileError);
        return res.status(500).json({ 
          error: `Failed to create user profile: ${profileError.message}`,
          details: profileError.details
        });
      }
      
      console.log('✅ Company admin created/updated successfully!');
      
      res.status(201).json({
        message: existingUser ? 'Company admin updated successfully' : 'Company admin created successfully',
        user: {
          id: userId,
          email,
          full_name,
          phone,
          company_id,
          company_name: company.name
        }
      });
      
    } catch (error) {
      console.error('Create company owner error:', error);
      res.status(500).json({ error: 'Failed to create company owner: ' + (error as Error).message });
    }
  }
);

// Reset company admin password
router.post(
  '/reset-password',
  authenticate,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      console.log('Resetting password for:', email);
      
      // Use generateLink for password recovery
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/update-password`
        }
      });
      
      if (error) {
        console.error('Error generating recovery link:', error);
        return res.status(500).json({ error: error.message });
      }
      
      console.log('Password reset email sent to:', email);
      
      res.json({ 
        message: 'Password reset email sent successfully',
        email: email 
      });
      
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password: ' + (error as Error).message });
    }
  }
);

export default router;