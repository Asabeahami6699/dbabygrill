// frontend/src/components/company/CustomersList.tsx
import React, { useMemo } from 'react';
import { Order } from './hooks/useCompanyData';

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  region_city: string;          // extracted from address if possible
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  last_order_date: string;
  last_order_status: string;
  preferred_payment_method: string;
}

interface CustomersListProps {
  orders: Order[];
}

// Helper to extract region/city from a full address
function extractRegionCity(address: string): string {
  if (!address) return '—';
  // Try to split by comma and take last parts (e.g. "Street, Accra" -> "Accra")
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return parts.slice(-2).join(', '); // last two parts (city, region)
  }
  return address; // fallback
}

export default function CustomersList({ orders }: CustomersListProps) {
  const customers = useMemo(() => {
    const customerMap = new Map<string, Customer>();

    orders.forEach(order => {
      const customerId = order.user_id;
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: customerId,
          full_name: order.customer_name,
          phone: order.customer_phone,
          address: order.customer_address,
          region_city: extractRegionCity(order.customer_address),
          total_orders: 0,
          total_spent: 0,
          average_order_value: 0,
          last_order_date: order.created_at,
          last_order_status: order.status,
          preferred_payment_method: order.payment_method,
        });
      }

      const customer = customerMap.get(customerId)!;
      customer.total_orders++;
      customer.total_spent += order.total_amount;
      customer.average_order_value = customer.total_spent / customer.total_orders;

      // Update last order date and status if newer
      if (new Date(order.created_at) > new Date(customer.last_order_date)) {
        customer.last_order_date = order.created_at;
        customer.last_order_status = order.status;
        customer.address = order.customer_address;
        customer.region_city = extractRegionCity(order.customer_address);
      }

      // Track payment method frequency (simple majority)
      const paymentMethods = customer.preferred_payment_method
        ? [customer.preferred_payment_method, order.payment_method]
        : [order.payment_method];
      const mostFrequent = paymentMethods.sort((a,b) =>
        paymentMethods.filter(v => v === a).length - paymentMethods.filter(v => v === b).length
      ).pop();
      customer.preferred_payment_method = mostFrequent || order.payment_method;
    });

    // sort by total spent descending
    return Array.from(customerMap.values()).sort((a, b) => b.total_spent - a.total_spent);
  }, [orders]);

  const totalCustomers = customers.length;
  const averageOrderValueGlobal = totalCustomers
    ? customers.reduce((sum, c) => sum + c.average_order_value, 0) / totalCustomers
    : 0;

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Customers</h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900">{totalCustomers}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500">Avg. Order Value (Overall)</p>
          <p className="text-2xl font-bold text-orange-600">₵{averageOrderValueGlobal.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">
            ₵{customers.reduce((sum, c) => sum + c.total_spent, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region/City</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Order</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Order Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preferred Payment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Last Order Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {customer.full_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {customer.phone || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {customer.region_city}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={customer.address}>
                    {customer.address || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                    {customer.total_orders}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-orange-600 text-right">
                    ₵{customer.total_spent.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                    ₵{customer.average_order_value.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium
                      ${customer.last_order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                        customer.last_order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'}`}>
                      {customer.last_order_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {customer.preferred_payment_method === 'mobile_money' ? '📱 MoMo' :
                     customer.preferred_payment_method === 'cash' ? '💵 Cash' :
                     customer.preferred_payment_method === 'card' ? '💳 Card' :
                     customer.preferred_payment_method || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                    {new Date(customer.last_order_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {customers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No customers yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}