// frontend/src/components/companyDashboard/Settings.tsx
import React, { useState, useEffect } from 'react';
import { Company } from './hooks/useCompanyData';
import { toast } from 'react-hot-toast';
import { getValidToken } from '../../api/authToken';
import { api } from '../../services/apiClient';

interface SettingsProps {
  company: Company | null;
  onUpdate: () => void;
  /** Driven by setup guide / tour */
  guideSubTab?: SubTab | null;
}

interface Category {
  id: string;
  name: string;
}

interface DeliveryArea {
  id: string;
  area_name: string;
  delivery_fee: number;
  is_active: boolean;
}

interface PickupBranch {
  id: string;
  branch_name: string;
  address: string;
  phone: string;
  is_active: boolean;
}

interface DeliveryGuy {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
}

type SubTab = 'company' | 'delivery-areas' | 'pickup-branches' | 'delivery-guys';

const fetchWithAuth = async (url: string, options: any = {}) => {
  const token = await getValidToken();
  const { data } = await api({
    url,
    method: options.method || 'GET',
    data: options.body ? JSON.parse(options.body) : undefined,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  return data;
};

export default function Settings({ company, onUpdate, guideSubTab }: SettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('company');

  useEffect(() => {
    if (guideSubTab) setActiveSubTab(guideSubTab);
  }, [guideSubTab]);

  // Company info state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: company?.name || '',
    description: company?.description || '',
    location: company?.location || '',
    phone: company?.phone || '',
    email: company?.email || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delivery areas state
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('');
  const [savingAreaId, setSavingAreaId] = useState<string | null>(null);

  // Pickup branches state
  const [pickupBranches, setPickupBranches] = useState<PickupBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [newBranch, setNewBranch] = useState({
    branch_name: '',
    address: '',
    phone: '',
  });

  // Delivery guys state
  const [deliveryGuys, setDeliveryGuys] = useState<DeliveryGuy[]>([]);
  const [loadingDeliveryGuys, setLoadingDeliveryGuys] = useState(false);
  const [savingDeliveryGuyId, setSavingDeliveryGuyId] = useState<string | null>(null);
  const [newDeliveryGuy, setNewDeliveryGuy] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
  });

  // Data fetching
  useEffect(() => {
    if (activeSubTab === 'delivery-areas') fetchDeliveryAreas();
    if (activeSubTab === 'pickup-branches') fetchPickupBranches();
    if (activeSubTab === 'delivery-guys') fetchDeliveryGuys();
  }, [activeSubTab]);

  const fetchDeliveryAreas = async () => {
    setLoadingAreas(true);
    try {
      const data = await fetchWithAuth('/company/delivery-areas');
      setDeliveryAreas(data);
    } catch (error) {
      console.error('Error fetching delivery areas:', error);
      toast.error('Failed to load delivery areas');
    } finally {
      setLoadingAreas(false);
    }
  };

  const fetchPickupBranches = async () => {
    setLoadingBranches(true);
    try {
      const data = await fetchWithAuth('/company/pickup-branches');
      setPickupBranches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching pickup branches:', error);
      toast.error('Failed to load pickup branches');
    } finally {
      setLoadingBranches(false);
    }
  };

  const fetchDeliveryGuys = async () => {
    setLoadingDeliveryGuys(true);
    try {
      const data = await fetchWithAuth('/company/delivery-guys');
      setDeliveryGuys(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching delivery guys:', error);
      toast.error('Failed to load delivery guys');
    } finally {
      setLoadingDeliveryGuys(false);
    }
  };

  // Company handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveCompany = async () => {
    setIsSaving(true);
    try {
      await fetchWithAuth('/company/profile', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      toast.success('Company information updated successfully!');
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update company information');
    } finally {
      setIsSaving(false);
    }
  };

  // Delivery area handlers
  const handleAddArea = async () => {
    if (!newAreaName.trim()) { toast.error('Please enter area name'); return; }
    if (!newAreaFee || parseFloat(newAreaFee) < 0) { toast.error('Please enter a valid delivery fee'); return; }
    setLoadingAreas(true);
    try {
      const newArea = await fetchWithAuth('/company/delivery-areas', {
        method: 'POST',
        body: JSON.stringify({ area_name: newAreaName.trim(), delivery_fee: parseFloat(newAreaFee), is_active: true }),
      });
      setDeliveryAreas(prev => [...prev, newArea]);
      setNewAreaName('');
      setNewAreaFee('');
      toast.success('Delivery area added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add delivery area');
    } finally {
      setLoadingAreas(false);
    }
  };

  const handleUpdateAreaFee = async (areaId: string, fee: number) => {
    setSavingAreaId(areaId);
    try {
      const updated = await fetchWithAuth(`/company/delivery-areas/${areaId}`, {
        method: 'PUT',
        body: JSON.stringify({ delivery_fee: fee }),
      });
      setDeliveryAreas(prev => prev.map(a => (a.id === areaId ? updated : a)));
      toast.success('Delivery fee updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update delivery fee');
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleToggleAreaActive = async (area: DeliveryArea) => {
    setSavingAreaId(area.id);
    try {
      const updated = await fetchWithAuth(`/company/delivery-areas/${area.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !area.is_active }),
      });
      setDeliveryAreas(prev => prev.map(a => (a.id === area.id ? updated : a)));
      toast.success(updated.is_active ? 'Area activated' : 'Area deactivated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update area status');
    } finally {
      setSavingAreaId(null);
    }
  };

  const handleDeleteArea = async (areaId: string, areaName: string) => {
    if (!confirm(`Delete delivery area "${areaName}"?`)) return;
    setSavingAreaId(areaId);
    try {
      await fetchWithAuth(`/company/delivery-areas/${areaId}`, { method: 'DELETE' });
      setDeliveryAreas(prev => prev.filter(a => a.id !== areaId));
      toast.success('Delivery area deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete delivery area');
    } finally {
      setSavingAreaId(null);
    }
  };

  // Pickup branch handlers
  const handleAddBranch = async () => {
    if (!newBranch.branch_name.trim()) { toast.error('Please enter branch name'); return; }
    if (!newBranch.address.trim()) { toast.error('Please enter branch address'); return; }
    setLoadingBranches(true);
    try {
      const created = await fetchWithAuth('/company/pickup-branches', {
        method: 'POST',
        body: JSON.stringify({
          branch_name: newBranch.branch_name.trim(),
          address: newBranch.address.trim(),
          phone: newBranch.phone.trim(),
          is_active: true,
        }),
      });
      setPickupBranches(prev => [...prev, created]);
      setNewBranch({ branch_name: '', address: '', phone: '' });
      toast.success('Pickup branch added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add pickup branch');
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleToggleBranchActive = async (branch: PickupBranch) => {
    setSavingBranchId(branch.id);
    try {
      const updated = await fetchWithAuth(`/company/pickup-branches/${branch.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !branch.is_active }),
      });
      setPickupBranches(prev => prev.map(b => (b.id === branch.id ? updated : b)));
      toast.success(updated.is_active ? 'Branch activated' : 'Branch deactivated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update branch status');
    } finally {
      setSavingBranchId(null);
    }
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Delete pickup branch "${branchName}"?`)) return;
    setSavingBranchId(branchId);
    try {
      await fetchWithAuth(`/company/pickup-branches/${branchId}`, { method: 'DELETE' });
      setPickupBranches(prev => prev.filter(b => b.id !== branchId));
      toast.success('Pickup branch deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete pickup branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  // Delivery guy handlers
  const handleAddDeliveryGuy = async () => {
    if (!newDeliveryGuy.full_name.trim()) { toast.error('Please enter full name'); return; }
    if (!newDeliveryGuy.email.trim()) { toast.error('Please enter email'); return; }
    if (!newDeliveryGuy.password.trim()) { toast.error('Please enter password'); return; }
    if (!newDeliveryGuy.phone.trim()) { toast.error('Please enter phone number'); return; }

    setLoadingDeliveryGuys(true);
    try {
      const created = await fetchWithAuth('/company/delivery-guys', {
        method: 'POST',
        body: JSON.stringify({
          full_name: newDeliveryGuy.full_name.trim(),
          email: newDeliveryGuy.email.trim(),
          password: newDeliveryGuy.password.trim(),
          phone: newDeliveryGuy.phone.trim(),
          role: 'delivery_guy',
          company_id: company?.id,
        }),
      });
      setDeliveryGuys(prev => [...prev, created]);
      setNewDeliveryGuy({ full_name: '', email: '', password: '', phone: '' });
      toast.success('Delivery guy added successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add delivery guy');
    } finally {
      setLoadingDeliveryGuys(false);
    }
  };

  const handleToggleDeliveryGuyActive = async (guy: DeliveryGuy) => {
    setSavingDeliveryGuyId(guy.id);
    try {
      const updated = await fetchWithAuth(`/company/delivery-guys/${guy.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !guy.is_active }),
      });
      setDeliveryGuys(prev => prev.map(g => (g.id === guy.id ? updated : g)));
      toast.success(updated.is_active ? 'Delivery guy activated' : 'Delivery guy deactivated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update delivery guy status');
    } finally {
      setSavingDeliveryGuyId(null);
    }
  };

  const handleDeleteDeliveryGuy = async (guyId: string, guyName: string) => {
    if (!confirm(`Delete delivery guy "${guyName}"?`)) return;
    setSavingDeliveryGuyId(guyId);
    try {
      await fetchWithAuth(`/company/delivery-guys/${guyId}`, { method: 'DELETE' });
      setDeliveryGuys(prev => prev.filter(g => g.id !== guyId));
      toast.success('Delivery guy deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete delivery guy');
    } finally {
      setSavingDeliveryGuyId(null);
    }
  };

  // Sub-tabs definition
  const subTabs: { id: SubTab; label: string; icon: string }[] = [
    { id: 'company', label: 'Company Info', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'delivery-areas', label: 'Delivery Areas', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'pickup-branches', label: 'Pickup Branches', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
    { id: 'delivery-guys', label: 'Delivery Guys', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Settings</h2>
      </div>

      {/* Sub-tab navigation – responsive scrollable */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max sm:min-w-0">
            {subTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all ${
                  activeSubTab === tab.id
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content based on active sub-tab */}
      <div className="space-y-6">
        {/* Company Information */}
        {activeSubTab === 'company' && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-base sm:text-lg">Company Information</h3>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
                  Edit Profile
                </button>
              )}
            </div>
            <div className="space-y-3 sm:space-y-4">
              {(['name', 'description', 'location', 'phone', 'email'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 capitalize">{field}</label>
                  {isEditing ? (
                    field === 'description' ? (
                      <textarea name={field} value={formData[field]} onChange={handleChange} rows={3}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 text-sm" />
                    ) : (
                      <input type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                        name={field} value={formData[field]} onChange={handleChange}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 text-sm" />
                    )
                  ) : (
                    <p className="text-sm text-gray-900">{(company as any)?.[field] || 'Not set'}</p>
                  )}
                </div>
              ))}
              {isEditing && (
                <div className="flex gap-3 pt-4">
                  <button onClick={handleSaveCompany} disabled={isSaving}
                    className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => { setIsEditing(false); setFormData({ name: company?.name || '', description: company?.description || '', location: company?.location || '', phone: company?.phone || '', email: company?.email || '' }); }}
                    className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 text-sm">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Areas */}
        {activeSubTab === 'delivery-areas' && (
          <div data-guide="settings-delivery-areas" className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="font-semibold text-base sm:text-lg mb-4">Delivery Areas</h3>
            <p className="text-sm text-gray-500 mb-4">Set delivery fees for different areas.</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Delivery Area</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="Area name (e.g., East Legon, Spintex, Osu)" value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                <div className="flex gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₵</span>
                    <input type="number" step="0.5" placeholder="Fee" value={newAreaFee}
                      onChange={e => setNewAreaFee(e.target.value)} className="w-28 pl-7 pr-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <button onClick={handleAddArea} disabled={loadingAreas}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap">
                    {loadingAreas ? 'Adding...' : 'Add Area'}
                  </button>
                </div>
              </div>
            </div>
            {loadingAreas && deliveryAreas.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
              </div>
            ) : (
              <div className="space-y-2">
                {deliveryAreas.map(area => (
                  <div key={area.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-lg gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-800">{area.area_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${area.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                          {area.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₵</span>
                          <input type="number" step="0.5" value={area.delivery_fee}
                            onChange={e => { const f = parseFloat(e.target.value); if (!isNaN(f)) setDeliveryAreas(prev => prev.map(a => a.id === area.id ? { ...a, delivery_fee: f } : a)); }}
                            onBlur={() => handleUpdateAreaFee(area.id, area.delivery_fee)}
                            disabled={savingAreaId === area.id}
                            className="w-24 pl-7 pr-2 py-1 border rounded text-sm" />
                        </div>
                        <span className="text-gray-500 text-sm">delivery fee</span>
                        {savingAreaId === area.id && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleAreaActive(area)} disabled={savingAreaId === area.id}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm ${area.is_active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {savingAreaId === area.id ? '...' : area.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => handleDeleteArea(area.id, area.area_name)} disabled={savingAreaId === area.id}
                        className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {deliveryAreas.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No delivery areas yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pickup Branches */}
        {activeSubTab === 'pickup-branches' && (
          <div data-guide="settings-pickup-branches" className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <h3 className="font-semibold text-base sm:text-lg">Pickup Branches</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Customers who pick up their orders at your grill point will not be charged a delivery fee.</p>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Pickup Branch</h4>
              <div className="space-y-3">
                <input type="text" placeholder="Branch name (e.g., DBaby Grills - Osu)" value={newBranch.branch_name}
                  onChange={e => setNewBranch(prev => ({ ...prev, branch_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="text" placeholder="Address" value={newBranch.address}
                  onChange={e => setNewBranch(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div className="flex gap-3">
                  <input type="tel" placeholder="Branch phone (optional)" value={newBranch.phone}
                    onChange={e => setNewBranch(prev => ({ ...prev, phone: e.target.value }))}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                  <button onClick={handleAddBranch} disabled={loadingBranches || !newBranch.branch_name.trim() || !newBranch.address.trim()}
                    className="bg-orange-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
                    {loadingBranches ? 'Adding...' : 'Add Branch'}
                  </button>
                </div>
              </div>
            </div>
            {loadingBranches && pickupBranches.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {pickupBranches.map(branch => (
                  <div key={branch.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800">{branch.branch_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${branch.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {branch.address}
                      </p>
                      {branch.phone && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">{branch.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleBranchActive(branch)} disabled={savingBranchId === branch.id}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm ${branch.is_active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {savingBranchId === branch.id ? '...' : branch.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => handleDeleteBranch(branch.id, branch.branch_name)} disabled={savingBranchId === branch.id}
                        className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {pickupBranches.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No pickup branches yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delivery Guys */}
        {activeSubTab === 'delivery-guys' && (
          <div data-guide="settings-delivery-guys" className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="font-semibold text-base sm:text-lg">Delivery Guys</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Create and manage delivery guy accounts for your company.</p>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Delivery Guy</h4>
              <div className="space-y-3">
                <input type="text" placeholder="Full Name" value={newDeliveryGuy.full_name}
                  onChange={e => setNewDeliveryGuy(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="email" placeholder="Email Address" value={newDeliveryGuy.email}
                  onChange={e => setNewDeliveryGuy(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="password" placeholder="Password" value={newDeliveryGuy.password}
                  onChange={e => setNewDeliveryGuy(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div className="flex gap-3">
                  <input type="tel" placeholder="Phone Number" value={newDeliveryGuy.phone}
                    onChange={e => setNewDeliveryGuy(prev => ({ ...prev, phone: e.target.value }))}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                  <button onClick={handleAddDeliveryGuy} disabled={loadingDeliveryGuys || !newDeliveryGuy.full_name.trim() || !newDeliveryGuy.email.trim() || !newDeliveryGuy.password.trim() || !newDeliveryGuy.phone.trim()}
                    className="bg-orange-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
                    {loadingDeliveryGuys ? 'Adding...' : 'Add Delivery Guy'}
                  </button>
                </div>
              </div>
            </div>
            {loadingDeliveryGuys && deliveryGuys.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {deliveryGuys.map(guy => (
                  <div key={guy.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800">{guy.full_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${guy.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                          {guy.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{guy.email}</p>
                      <p className="text-sm text-gray-500">{guy.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleDeliveryGuyActive(guy)} disabled={savingDeliveryGuyId === guy.id}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm ${guy.is_active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {savingDeliveryGuyId === guy.id ? '...' : guy.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => handleDeleteDeliveryGuy(guy.id, guy.full_name)} disabled={savingDeliveryGuyId === guy.id}
                        className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {deliveryGuys.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No delivery guys yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}