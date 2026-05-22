import { useEffect, useState } from 'react';
import { supabase } from '../api/supabase';

interface Company {
  id: string;
  name: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  is_available: boolean;
  company_id: string;
  image_url?: string;
  companies?: { name: string };
}

export default function AdminDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'companies' | 'products'>('companies');
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [companyForm, setCompanyForm] = useState({
    name: '',
    description: '',
    location: '',
    phone: '',
    email: '',
  });

  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    company_id: '',
    image_url: '',
  });

  useEffect(() => {
    fetchCompanies();
    fetchProducts();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCompanies(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, companies(name)')
      .order('created_at', { ascending: false });
    if (data) setProducts(data);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('companies').insert([companyForm]);

    if (error) {
      alert('Error creating company: ' + error.message);
    } else {
      alert('Company created successfully!');
      setShowCompanyForm(false);
      setCompanyForm({ name: '', description: '', location: '', phone: '', email: '' });
      fetchCompanies();
    }
    setLoading(false);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('products').insert([
      {
        ...productForm,
        price: parseFloat(productForm.price),
        is_available: true,
      },
    ]);

    if (error) {
      alert('Error creating product: ' + error.message);
    } else {
      alert('Product created successfully!');
      setShowProductForm(false);
      setProductForm({
        name: '',
        description: '',
        price: '',
        category: '',
        company_id: '',
        image_url: '',
      });
      fetchProducts();
    }
    setLoading(false);
  };

  const toggleCompanyStatus = async (companyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('companies')
      .update({ is_active: !currentStatus })
      .eq('id', companyId);

    if (error) {
      alert('Error updating company status');
    } else {
      fetchCompanies();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* STICKY HEADER – Title + Tabs */}
      <div className="sticky top-14 sm:top-16 z-10 bg-gray-50 pb-4 -mt-8 pt-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('companies')}
              className={`pb-4 px-1 ${
                activeTab === 'companies'
                  ? 'border-b-2 border-orange-600 text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Companies
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`pb-4 px-1 ${
                activeTab === 'products'
                  ? 'border-b-2 border-orange-600 text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Products
            </button>
          </nav>
        </div>
      </div>

      {/* Companies Tab Content */}
      {activeTab === 'companies' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => setShowCompanyForm(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
            >
              + Add Company
            </button>
          </div>

          {/* Company Form Modal */}
          {showCompanyForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Add New Company</h2>
                <form onSubmit={handleCreateCompany} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <textarea
                    placeholder="Description"
                    value={companyForm.description}
                    onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={companyForm.location}
                    onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700"
                    >
                      {loading ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCompanyForm(false)}
                      className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Companies List */}
          <div className="grid gap-4">
            {companies.map((company) => (
              <div key={company.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{company.name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{company.description}</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-500">
                      <p>📍 {company.location}</p>
                      <p>📞 {company.phone}</p>
                      <p>✉️ {company.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleCompanyStatus(company.id, company.is_active)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      company.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {company.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Tab Content */}
      {activeTab === 'products' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => setShowProductForm(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
            >
              + Add Product
            </button>
          </div>

          {/* Product Form Modal */}
          {showProductForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">Add New Product</h2>
                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Product Name"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <textarea
                    placeholder="Description"
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Price (GHS)"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <select
                    value={productForm.company_id}
                    onChange={(e) => setProductForm({ ...productForm, company_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select Company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    placeholder="Image URL"
                    value={productForm.image_url}
                    onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700"
                    >
                      {loading ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductForm(false)}
                      className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Products List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {product.image_url && (
                  <img src={product.image_url} alt={product.name} className="w-full h-48 object-cover" />
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                  <p className="text-orange-600 font-bold mt-2">GHS {product.price}</p>
                  <p className="text-gray-500 text-xs mt-1">Category: {product.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}