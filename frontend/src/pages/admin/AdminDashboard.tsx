import { useEffect, useState } from 'react';
import { supabase } from '../../api/supabase';
import { api } from '../../services/apiClient';
import NotificationBell from '../../components/companyDashboard/NotificationBell';

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

export default function AdminDashboard() {
  const [companies, setCompanies] = useState<CompanyWithAdmin[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    // Company fields
    company_name: '',
    company_description: '',
    company_location: '',
    company_phone: '',
    company_email: '',
    // Admin fields
    admin_full_name: '',
    admin_email: '',
    admin_password: '',
    admin_phone: '',
  });

  useEffect(() => {
    fetchCompaniesWithAdmins();
  }, []);

  const fetchCompaniesWithAdmins = async () => {
    // Fetch all companies
    const { data: companiesData } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!companiesData) {
      setCompanies([]);
      return;
    }

    // Fetch all company admins
    const { data: adminsData } = await supabase
      .from('users')
      .select('id, email, full_name, phone, company_id')
      .eq('role', 'company_admin');
    
    // Combine companies with their admins
    const companiesWithAdmins = companiesData.map(company => {
      const admin = adminsData?.find(a => a.company_id === company.id);
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

    // Create admin via backend
    const response = await api.post(
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

    // ✅ Axios already parses JSON
      const result = response.data;

    alert(`✅ Company and Admin created successfully!

Company: ${formData.company_name}
Admin Email: ${formData.admin_email}
Admin Password: ${formData.admin_password}

Please share these credentials with the company admin.`);

    // Reset form
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

    setShowForm(false);

    // Refresh
    fetchCompaniesWithAdmins();
  } catch (error: any) {
    console.error('Error creating company with admin:', error);

    // Axios error handling
    const message =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error.message ||
      'Something went wrong';

    alert('Error: ' + message);
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
      alert('Error updating company status');
    } else {
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

  if (!confirm(confirmMessage)) {
    return;
  }

  setDeleting(company.id);

  try {
    // Step 1: Delete admin user
    if (company.admin_id) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await api.post(
        '/admin/delete-user',
        {
          userId: company.admin_id,
        },
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

    alert(
      `Company "${company.name}" and its associated admin have been deleted successfully.`
    );

    // Refresh
    fetchCompaniesWithAdmins();
  } catch (error: any) {
    console.error('Error deleting company:', error);

    const message =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error.message ||
      'Something went wrong';

    alert('Error deleting company: ' + message);
  } finally {
    setDeleting(null);
  }
};

  const resetCompanyAdminPassword = async (adminEmail: string) => {
    if (confirm(`Reset password for ${adminEmail}? They will receive a password reset email.`)) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(adminEmail, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        
        if (error) {
          console.error('Error resetting password:', error);
          alert('Error resetting password: ' + error.message);
        } else {
          alert(`Password reset email sent to ${adminEmail}`);
        }
      } catch (error: any) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            onClick={() => setShowForm(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
          >
            + Add Company & Admin
          </button>
        </div>
      </div>

      {/* Combined Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create Company & Admin</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateCompanyWithAdmin} className="space-y-6">
              {/* Company Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Company Information</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Company Name *"
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <textarea
                    placeholder="Company Description"
                    value={formData.company_description}
                    onChange={(e) => setFormData({...formData, company_description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={formData.company_location}
                    onChange={(e) => setFormData({...formData, company_location: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="tel"
                      placeholder="Company Phone"
                      value={formData.company_phone}
                      onChange={(e) => setFormData({...formData, company_phone: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <input
                      type="email"
                      placeholder="Company Email"
                      value={formData.company_email}
                      onChange={(e) => setFormData({...formData, company_email: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Admin Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Admin Information</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Admin Full Name *"
                    value={formData.admin_full_name}
                    onChange={(e) => setFormData({...formData, admin_full_name: e.target.value})}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="email"
                    placeholder="Admin Email *"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({...formData, admin_email: e.target.value})}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="password"
                    placeholder="Admin Password *"
                    value={formData.admin_password}
                    onChange={(e) => setFormData({...formData, admin_password: e.target.value})}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="tel"
                    placeholder="Admin Phone"
                    value={formData.admin_phone}
                    onChange={(e) => setFormData({...formData, admin_phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700"
                >
                  {loading ? 'Creating...' : 'Create Company & Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Combined Table - Companies with their Admins */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{company.name}</div>
                      <div className="text-sm text-gray-500">{company.description}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        📞 {company.phone || 'N/A'} | ✉️ {company.email || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {company.location || 'Not specified'}
                  </td>
                  <td className="px-6 py-4">
                    {company.admin_email ? (
                      <div>
                        <div className="font-medium text-gray-900">{company.admin_full_name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{company.admin_email}</div>
                        <div className="text-xs text-gray-400">📞 {company.admin_phone || 'N/A'}</div>
                      </div>
                    ) : (
                      <span className="text-yellow-600 text-sm">No admin assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleCompanyStatus(company.id, company.is_active)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        company.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {company.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {company.admin_email && (
                        <button
                          onClick={() => resetCompanyAdminPassword(company.admin_email!)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Reset Password
                        </button>
                      )}
                      <button
                        onClick={() => deleteCompany(company)}
                        disabled={deleting === company.id}
                        className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                      >
                        {deleting === company.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {companies.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No companies yet. Click "Add Company & Admin" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}