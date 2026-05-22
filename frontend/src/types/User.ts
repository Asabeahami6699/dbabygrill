export interface User {
  id: string;
  role: 'admin' | 'company_admin' | 'customer';
  email: string;
  companyId?: string;
}