import React from 'react';
import { Order, Product } from './hooks/useCompanyData';

interface DashboardOverviewProps {
  orders: Order[];
  products: Product[];
  onOrderClick: (order: Order) => void;
}

export default function DashboardOverview({ orders, products, onOrderClick }: DashboardOverviewProps) {
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');
  const completedOrders = orders.filter(o => o.status === 'delivered');
  const totalSales = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const lowStockProducts = products.filter(p => p.stock_quantity < 10 && p.stock_quantity > 0);
  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Dashboard Overview</h2>
      
      {/* Stats Cards */}
      <div
        data-guide="dashboard-stats"
        className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6 mb-6 sm:mb-8"
      >
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-5 border-l-4 border-orange-500">
          <p className="text-xs sm:text-sm text-gray-500">Today's Orders</p>
          <p className="text-lg sm:text-2xl font-bold">{todayOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-5 border-l-4 border-yellow-500">
          <p className="text-xs sm:text-sm text-gray-500">Pending</p>
          <p className="text-lg sm:text-2xl font-bold text-yellow-600">{pendingOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-5 border-l-4 border-green-500">
          <p className="text-xs sm:text-sm text-gray-500">Completed</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{completedOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-5 border-l-4 border-blue-500">
          <p className="text-xs sm:text-sm text-gray-500">Total Sales</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">₵{totalSales.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-5 border-l-4 border-red-500 col-span-2 sm:col-span-2 lg:col-span-1">
          <p className="text-xs sm:text-sm text-gray-500">Low Stock</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600">{lowStockProducts.length}</p>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm mb-6 sm:mb-8">
        <div className="p-4 sm:p-5 border-b">
          <h3 className="font-semibold text-base sm:text-lg">Recent Orders</h3>
        </div>
        <div className="divide-y">
          {recentOrders.map(order => (
            <div key={order.id} className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer" onClick={() => onOrderClick(order)}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}</p>
                  <p className="font-medium text-sm sm:text-base">{order.customer_name}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">₵{order.total_amount.toFixed(2)}</span>
                <span className="text-gray-400 text-xs">{new Date(order.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order Status & Low Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-base sm:text-lg mb-4">Order Status</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Pending</span>
                <span className="font-medium">{pendingOrders.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${(pendingOrders.length / orders.length) * 100 || 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Preparing</span>
                <span className="font-medium">{preparingOrders.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(preparingOrders.length / orders.length) * 100 || 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Ready</span>
                <span className="font-medium">{readyOrders.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(readyOrders.length / orders.length) * 100 || 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-base sm:text-lg mb-4">Low Stock Alerts</h3>
          {lowStockProducts.length > 0 ? (
            <div className="space-y-2">
              {lowStockProducts.slice(0, 3).map(product => (
                <div key={product.id} className="flex justify-between items-center text-sm">
                  <span className="truncate">{product.name}</span>
                  <span className="text-red-600 font-medium">Only {product.stock_quantity} left</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">All products have sufficient stock.</p>
          )}
        </div>
      </div>
    </div>
  );
}