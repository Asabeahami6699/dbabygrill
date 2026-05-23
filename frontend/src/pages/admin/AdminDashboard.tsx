import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  Users,
  ShieldCheck,
  Plus,
  LogOut,
  Eye,
  EyeOff,
  MapPin,
  Mail,
  Phone,
  KeyRound,
  Trash2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../api/supabase';
import { api } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/companyDashboard/NotificationBell';
import { showAdminCredentialsToast } from '../../components/admin/AdminCredentialsToast';

interface CompanyWithAdmin {
  id: string;
  name: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
  admin_id?: string;
  admin_email?: string;
  admin_full_name?: string;
  admin_phone?: string;
}

const inputClass =
  'w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithAdmin[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [formData, setFormData] = useState({
    company_name: '',
    company_description: '',
    company_location: '',
    company_phone: '',
    company_email: '',
    admin_full_name: '',
    admin_email: '',
    admin_password: '',
    admin_phone: '',
  });

  useEffect(() => {
    fetchCompaniesWithAdmins();
  }, []);

  const fetchCompaniesWithAdmins = async () => {
    const { data: companiesData } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (!companiesData) {
      setCompanies([]);
      return;
    }

    const { data: adminsData } = await supabase
      .from('users')
      .select('id, email, full_name, phone, company_id')
      .eq('role', 'company_admin');

    const companiesWithAdmins = companiesData.map((company) => {
      const admin = adminsData?.find((a) => a.company_id === company.id);
      return {
        ...company,
        admin_id: admin?.id,
        admin_email: admin?.email,
        admin_full_name: admin?.full_name,
        admin_phone: admin?.phone,
      };
    });

    setCompanies(companiesWithAdmins);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleCreateCompanyWithAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([
          {
            name: formData.company_name,
            description: formData.company_description,
            location: formData.company_location,
            phone: formData.company_phone,
            email: formData.company_email,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (companyError) {
        console.error('Company creation error:', companyError);
        throw new Error(`Company creation failed: ${companyError.message}`);
      }

      if (!companyData) {
        throw new Error('Company created but no data returned');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session. Please log in again.');
      }

      await api.post(
        '/admin/create-company-owner',
        {
          email: formData.admin_email,
          password: formData.admin_password,
          full_name: formData.admin_full_name,
          phone: formData.admin_phone,
          company_id: companyData.id,
        },
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const createdPayload = {
        companyName: formData.company_name,
        adminEmail: formData.admin_email,
        adminPassword: formData.admin_password,
        adminName: formData.admin_full_name,
      };

      setFormData({
        company_name: '',
        company_description: '',
        company_location: '',
        company_phone: '',
        company_email: '',
        admin_full_name: '',
        admin_email: '',
        admin_password: '',
        admin_phone: '',
      });
      setShowAdminPassword(false);
      setShowForm(false);
      fetchCompaniesWithAdmins();

      showAdminCredentialsToast(createdPayload);
    } catch (error: unknown) {
      console.error('Error creating company with admin:', error);
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (error as Error)?.message ||
        'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCompanyStatus = async (companyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('companies')
      .update({ is_active: !currentStatus })
      .eq('id', companyId);

    if (error) {
      toast.error('Error updating company status');
    } else {
      toast.success(currentStatus ? 'Company deactivated' : 'Company activated');
      fetchCompaniesWithAdmins();
    }
  };

  const deleteCompany = async (company: CompanyWithAdmin) => {
    const confirmMessage = `Are you sure you want to delete "${company.name}"?

This will also delete:
- The company and all its data
- The company admin account (${company.admin_email})
- All products associated with this company

This action cannot be undone!`;

    if (!confirm(confirmMessage)) return;

    setDeleting(company.id);

    try {
      if (company.admin_id) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        await api.post(
          '/admin/delete-user',
          { userId: company.admin_id },
          {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          }
        );
      }

      const { error: companyError } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);

      if (companyError) {
        throw new Error(`Failed to delete company: ${companyError.message}`);
      }

      toast.success(`"${company.name}" deleted`);
      fetchCompaniesWithAdmins();
    } catch (error: unknown) {
      console.error('Error deleting company:', error);
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (error as Error)?.message ||
        'Something went wrong';
      toast.error(message);
    } finally {
      setDeleting(null);
    }
  };

  const resetCompanyAdminPassword = async (adminEmail: string) => {
    if (
      !confirm(
        `Reset password for ${adminEmail}? They will receive a password reset email.`
      )
    ) {
      return;
    }
    try {
      await api.post('/auth/reset-password', { email: adminEmail });
      toast.success(`Reset email sent to ${adminEmail}`);
    } catch (error: unknown) {
      console.error('Error resetting password:', error);
      toast.error('Could not send reset email');
    }
  };

  const activeCount = companies.filter((c) => c.is_active).length;
  const withAdminCount = companies.filter((c) => c.admin_email).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <Link
                  to="/"
                  className="text-xs font-medium text-orange-300/90 hover:text-orange-200"
                >
                  DBaby Grills
                </Link>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Platform Admin
                </h1>
                <p className="text-sm text-orange-100/70 truncate max-w-[240px] sm:max-w-none">
                  {user?.email || 'Administrator'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="p-1 rounded-xl bg-white/10">
                <NotificationBell />
              </div>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Company & Admin
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 px-4 py-2.5 rounded-xl font-medium text-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/20">
              <Building2 className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <p className="text-orange-200/80 text-sm font-medium">Total Companies</p>
              <p className="text-3xl font-bold text-white">{companies.length}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-orange-200/80 text-sm font-medium">Active</p>
              <p className="text-3xl font-bold text-white">{activeCount}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-orange-200/80 text-sm font-medium">With Admin</p>
              <p className="text-3xl font-bold text-white">{withAdminCount}</p>
            </div>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-2xl bg-white shadow-2xl shadow-black/20 overflow-hidden border border-orange-100/50">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
            <h2 className="text-lg font-bold text-gray-900">Restaurants & Admins</h2>
            <p className="text-sm text-gray-500">Manage partner companies and their dashboard access</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-orange-50/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{company.name}</div>
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {company.description || '—'}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                        {company.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {company.phone}
                          </span>
                        )}
                        {company.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {company.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                        {company.location || 'Not specified'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {company.admin_email ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {company.admin_full_name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">{company.admin_email}</div>
                        </div>
                      ) : (
                        <span className="text-amber-600 text-sm font-medium">No admin assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => toggleCompanyStatus(company.id, company.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          company.is_active
                            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-red-100 text-red-700 ring-1 ring-red-200'
                        }`}
                      >
                        {company.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {company.admin_email && (
                          <button
                            type="button"
                            onClick={() => resetCompanyAdminPassword(company.admin_email!)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Reset password
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteCompany(company)}
                          disabled={deleting === company.id}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deleting === company.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {companies.length === 0 && (
            <div className="text-center py-16 px-4">
              <Building2 className="w-14 h-14 text-orange-200 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No companies yet</p>
              <p className="text-gray-400 text-sm mt-1 mb-6">
                Add your first restaurant and company admin to get started.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-orange-700"
              >
                <Plus className="w-4 h-4" />
                Add Company & Admin
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-orange-600 to-amber-500 text-white shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">Create Company & Admin</h2>
                  <p className="text-orange-100 text-sm mt-0.5">
                    Set up a new restaurant and its dashboard login
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setShowAdminPassword(false);
                  }}
                  className="p-1 rounded-lg hover:bg-white/20 text-white/90"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <form
              onSubmit={handleCreateCompanyWithAdmin}
              className="overflow-y-auto p-6 space-y-6"
            >
              <section>
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
                  <Building2 className="w-4 h-4 text-orange-600" />
                  Company Information
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Company name *"
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                    required
                    className={inputClass}
                  />
                  <textarea
                    placeholder="Description"
                    value={formData.company_description}
                    onChange={(e) =>
                      setFormData({ ...formData, company_description: e.target.value })
                    }
                    rows={2}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={formData.company_location}
                    onChange={(e) =>
                      setFormData({ ...formData, company_location: e.target.value })
                    }
                    className={inputClass}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="tel"
                      placeholder="Company phone"
                      value={formData.company_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, company_phone: e.target.value })
                      }
                      className={inputClass}
                    />
                    <input
                      type="email"
                      placeholder="Company email"
                      value={formData.company_email}
                      onChange={(e) =>
                        setFormData({ ...formData, company_email: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
                  <Users className="w-4 h-4 text-orange-600" />
                  Admin Login
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Admin full name *"
                    value={formData.admin_full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, admin_full_name: e.target.value })
                    }
                    required
                    className={inputClass}
                  />
                  <input
                    type="email"
                    placeholder="Admin email *"
                    value={formData.admin_email}
                    onChange={(e) =>
                      setFormData({ ...formData, admin_email: e.target.value })
                    }
                    required
                    className={inputClass}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Admin password *
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        placeholder="Min. 6 characters"
                        value={formData.admin_password}
                        onChange={(e) =>
                          setFormData({ ...formData, admin_password: e.target.value })
                        }
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className={`${inputClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                      >
                        {showAdminPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <input
                    type="tel"
                    placeholder="Admin phone"
                    value={formData.admin_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, admin_phone: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </section>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-amber-500 text-white py-3 rounded-xl font-semibold hover:from-orange-500 hover:to-amber-400 disabled:opacity-50 shadow-lg shadow-orange-500/20"
                >
                  {loading ? 'Creating…' : 'Create Company & Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setShowAdminPassword(false);
                  }}
                  className="flex-1 border border-gray-200 py-3 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
