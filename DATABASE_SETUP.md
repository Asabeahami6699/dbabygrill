# Database Setup Instructions for Delivery Guys

## To create the `delivery_guys` table:

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the following SQL:

```sql
-- Create delivery_guys table
CREATE TABLE IF NOT EXISTS public.delivery_guys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_delivery_guy_email UNIQUE(email),
  CONSTRAINT unique_delivery_guy_per_company UNIQUE(company_id, email)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_delivery_guys_company_id ON public.delivery_guys(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_guys_email ON public.delivery_guys(email);

-- Enable RLS
ALTER TABLE public.delivery_guys ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "delivery_guys_company_admin_policy" ON public.delivery_guys
  FOR ALL
  USING (
    company_id = (SELECT company_id FROM auth.users WHERE auth.users.id = auth.uid())
  );
```

5. Click "Run" or press Ctrl+Enter
6. The table will be created and you can start using the delivery guy management feature!

## After setup:
- Company admins can now add, edit, and delete delivery guys from the Settings page
- Each delivery guy will have their own login credentials (email + password)
