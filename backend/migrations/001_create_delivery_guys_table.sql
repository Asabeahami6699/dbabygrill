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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_delivery_guys_company_id ON public.delivery_guys(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_guys_email ON public.delivery_guys(email);

-- Enable RLS (Row Level Security)
ALTER TABLE public.delivery_guys ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for company admins to see only their delivery guys
CREATE POLICY "delivery_guys_company_admin_policy" ON public.delivery_guys
  FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.users WHERE public.users.id = auth.uid())
  );
