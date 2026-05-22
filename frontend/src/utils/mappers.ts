import { User as BackendUser } from '../../../backend/src/types';
import { Company as BackendCompany } from '../../../backend/src/types';
import { User as FrontendUser, Company as FrontendCompany } from '../types';

export const mapUser = (backendUser: BackendUser): FrontendUser => ({
  id: backendUser.id,
  role: backendUser.role,
  email: backendUser.email,
  companyId: backendUser.company_id,
});

export const mapCompany = (backendCompany: BackendCompany): FrontendCompany => ({
  id: backendCompany.id,
  name: backendCompany.name,
  logo: backendCompany.logo,
  location: backendCompany.location,
});

export const mapCompanies = (backendCompanies: BackendCompany[]): FrontendCompany[] => 
  backendCompanies.map(mapCompany);