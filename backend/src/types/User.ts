export interface User {
  id: string;
  role: 'admin' | 'company_admin' | 'customer';
  email: string;
  company_id?: string;
  created_at: string;
}