import { useMemo, useState } from 'react';
import { Order, Product } from './hooks/useCompanyData';

interface AnalyticsProps {
  orders: Order[];
  products: Product[];
}

export default function Analytics({ orders, products }: AnalyticsProps) {
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(today);
    rangeStart.setDate(today.getDate() - (range - 1));

    const scopedOrders = orders.filter(o => new Date(o.created_at) >= rangeStart);
    const todayOrders = scopedOrders.filter(o => new Date(o.created_at) >= today);
    const weekOrders = scopedOrders.filter(o => {
      const sevenDayStart = new Date(today);
      sevenDayStart.setDate(today.getDate() - 7);
      return new Date(o.created_at) >= sevenDayStart;
    });
    const monthOrders = scopedOrders.filter(o => {
      const thirtyDayStart = new Date(today);
      thirtyDayStart.setDate(today.getDate() - 30);
      return new Date(o.created_at) >= thirtyDayStart;
    });
    const completedOrders = scopedOrders.filter(o => o.status === 'delivered');
    const pendingOrders = scopedOrders.filter(o => o.status === 'pending');
    const preparingOrders = scopedOrders.filter(o => o.status === 'preparing');
    const readyOrders = scopedOrders.filter(o => o.status === 'ready');
    const cancelledOrders = scopedOrders.filter(o => o.status === 'cancelled');

    const todaySales = todayOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const weekSales = weekOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const monthSales = monthOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalSales = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const averageOrderValue = totalSales / (completedOrders.length || 1);

    const previousRangeStart = new Date(rangeStart);
    previousRangeStart.setDate(rangeStart.getDate() - range);
    const previousRangeOrders = orders.filter(
      o => new Date(o.created_at) >= previousRangeStart && new Date(o.created_at) < rangeStart
    );
    const previousRangeSales = previousRangeOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const growthPct = previousRangeSales
      ? ((monthSales - previousRangeSales) / previousRangeSales) * 100
      : monthSales > 0 ? 100 : 0;

    // Calculate top selling items based on order items.
    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    scopedOrders.forEach(order => {
      order.order_items?.forEach(item => {
        const existing = productSales.get(item.product_id);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.product_price * item.quantity;
        } else {
          productSales.set(item.product_id || item.product_name, {
            name: item.product_name,
            quantity: item.quantity,
            revenue: item.product_price  * item.quantity
          });
        }
      });
    });
    
    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const dayCount = Math.min(range, 14);
    const periodSeries = Array.from({ length: dayCount }).map((_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (dayCount - 1 - i));
      const dayKey = day.toDateString();
      const dayOrders = scopedOrders.filter(o => new Date(o.created_at).toDateString() === dayKey);
      return {
        label: day.toLocaleDateString(undefined, { weekday: 'short' }),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + o.total_amount, 0),
      };
    });

    const maxDailyRevenue = Math.max(...periodSeries.map(s => s.revenue), 1);
    const inStockProducts = products.filter(p => p.stock_quantity > 0).length;
    const lowStockProducts = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 10).length;
    const deliveredWithEndTime = completedOrders.filter((o) => !!o.updated_at);
    const fulfillmentMinutesAvg = deliveredWithEndTime.length
      ? deliveredWithEndTime.reduce((sum, o) => {
          const start = new Date(o.created_at).getTime();
          const end = new Date(o.updated_at as string).getTime();
          return sum + Math.max(0, (end - start) / 60000);
        }, 0) / deliveredWithEndTime.length
      : 0;
    const lateOrders = deliveredWithEndTime.filter((o) => {
      const start = new Date(o.created_at).getTime();
      const end = new Date(o.updated_at as string).getTime();
      return (end - start) / 60000 > 45;
    }).length;

    // Customer insights (purchase behavior)
    const customerMap = new Map<string, {
      name: string;
      phone: string;
      orders: number;
      revenue: number;
      lastOrderAt: string;
      area: string;
    }>();
    const areaMap = new Map<string, { orders: number; revenue: number; customers: Set<string> }>();

    scopedOrders.forEach((order) => {
      const customerKey = order.customer_phone || `${order.customer_name}-${order.customer_address}`;
      const parsedArea = (order.customer_address || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(-1)[0] || 'Unknown area';

      const existingCustomer = customerMap.get(customerKey);
      if (existingCustomer) {
        existingCustomer.orders += 1;
        existingCustomer.revenue += order.total_amount;
        if (new Date(order.created_at).getTime() > new Date(existingCustomer.lastOrderAt).getTime()) {
          existingCustomer.lastOrderAt = order.created_at;
          existingCustomer.area = parsedArea;
        }
      } else {
        customerMap.set(customerKey, {
          name: order.customer_name || 'Customer',
          phone: order.customer_phone || 'N/A',
          orders: 1,
          revenue: order.total_amount,
          lastOrderAt: order.created_at,
          area: parsedArea,
        });
      }

      const areaEntry = areaMap.get(parsedArea) || { orders: 0, revenue: 0, customers: new Set<string>() };
      areaEntry.orders += 1;
      areaEntry.revenue += order.total_amount;
      areaEntry.customers.add(customerKey);
      areaMap.set(parsedArea, areaEntry);
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => (b.orders === a.orders ? b.revenue - a.revenue : b.orders - a.orders))
      .slice(0, 6);

    const repeatCustomers = Array.from(customerMap.values()).filter((c) => c.orders >= 2).length;
    const uniqueCustomers = customerMap.size;

    const areaInsights = Array.from(areaMap.entries())
      .map(([area, value]) => ({
        area,
        orders: value.orders,
        revenue: value.revenue,
        customers: value.customers.size,
      }))
      .sort((a, b) => (b.orders === a.orders ? b.revenue - a.revenue : b.orders - a.orders))
      .slice(0, 8);

    return {
      todayOrders: todayOrders.length,
      weekOrders: weekOrders.length,
      monthOrders: monthOrders.length,
      todaySales,
      weekSales,
      monthSales,
      totalSales,
      averageOrderValue,
      topProducts,
      pendingOrders: pendingOrders.length,
      preparingOrders: preparingOrders.length,
      readyOrders: readyOrders.length,
      cancelledOrders: cancelledOrders.length,
      growthPct,
      periodSeries,
      maxDailyRevenue,
      inStockProducts,
      lowStockProducts,
      topCustomers,
      uniqueCustomers,
      repeatCustomers,
      areaInsights,
      fulfillmentMinutesAvg,
      lateOrders,
    };
  }, [orders, products, range]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-2xl p-5 sm:p-6 text-white shadow-lg">
        <p className="text-xs sm:text-sm uppercase tracking-wider text-orange-100">Dashboard Analytics</p>
        <h2 className="text-2xl sm:text-3xl font-bold mt-1">Performance Snapshot</h2>
        <p className="text-sm text-orange-100 mt-2">
          Revenue is {stats.growthPct >= 0 ? 'up' : 'down'} {Math.abs(stats.growthPct).toFixed(1)}%
          compared to the previous period.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        {[7, 30, 90].map((option) => (
          <button
            key={option}
            onClick={() => setRange(option as 7 | 30 | 90)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              range === option ? 'bg-orange-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            Last {option} days
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Today Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">₵{stats.todaySales.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.todayOrders} orders</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">7-Day Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">₵{stats.weekSales.toFixed(2)}</p>
          <p className={`text-xs mt-1 ${stats.growthPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.growthPct >= 0 ? '+' : ''}{stats.growthPct.toFixed(1)}% vs previous period
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">30-Day Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">₵{stats.monthSales.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.monthOrders} orders</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Average Order</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">₵{stats.averageOrderValue.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.totalSales.toFixed(2)} delivered total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-2 xl:col-span-1">
          <p className="text-xs text-gray-500">Inventory Health</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.inStockProducts} in stock</p>
          <p className="text-xs text-amber-600 mt-1">{stats.lowStockProducts} low-stock items</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-2 xl:col-span-1">
          <p className="text-xs text-gray-500">Customer Base</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.uniqueCustomers}</p>
          <p className="text-xs text-green-600 mt-1">{stats.repeatCustomers} repeat customers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-2 xl:col-span-1">
          <p className="text-xs text-gray-500">Avg Fulfillment</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.fulfillmentMinutesAvg.toFixed(0)} min</p>
          <p className="text-xs text-red-600 mt-1">{stats.lateOrders} late orders (&gt;45m)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base sm:text-lg text-gray-900">Revenue Trend</h3>
            <span className="text-xs text-gray-500">Daily gross sales</span>
          </div>
          <div className="grid gap-2 sm:gap-3 items-end h-48" style={{ gridTemplateColumns: `repeat(${stats.periodSeries.length}, minmax(0, 1fr))` }}>
            {stats.periodSeries.map((point, idx) => (
              <div key={point.label} className="flex flex-col items-center justify-end h-full">
                <span className="text-[10px] sm:text-xs text-gray-500 mb-1">₵{point.revenue.toFixed(0)}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-orange-500 to-orange-300"
                  style={{ height: `${(point.revenue / stats.maxDailyRevenue) * 100}%`, minHeight: '8px' }}
                />
                <span className="text-[10px] sm:text-xs text-gray-600 mt-2">{idx % 2 === 0 ? point.label : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-base sm:text-lg mb-4 text-gray-900">Order Status Mix</h3>
          <div className="space-y-3">
            {[
              { label: 'Pending', count: stats.pendingOrders, color: 'bg-yellow-500' },
              { label: 'Preparing', count: stats.preparingOrders, color: 'bg-blue-500' },
              { label: 'Ready', count: stats.readyOrders, color: 'bg-green-500' },
              { label: 'Cancelled', count: stats.cancelledOrders, color: 'bg-red-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`${item.color} h-2 rounded-full`}
                    style={{ width: `${(item.count / (orders.length || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-base sm:text-lg mb-4 text-gray-900">Top Selling Items</h3>
          <div className="space-y-3">
            {stats.topProducts.map((product, idx) => (
              <div key={`${product.name}-${idx}`} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{idx + 1}. {product.name}</p>
                  <p className="text-xs text-gray-500">{product.quantity} units sold</p>
                </div>
                <span className="text-sm font-semibold text-orange-600 ml-2">₵{product.revenue.toFixed(2)}</span>
              </div>
            ))}
            {stats.topProducts.length === 0 && <p className="text-sm text-gray-500">No sales yet.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-base sm:text-lg mb-4 text-gray-900">Sales Breakdown</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Today</span>
              <span className="font-semibold text-gray-900">₵{stats.todaySales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">This Week</span>
              <span className="font-semibold text-gray-900">₵{stats.weekSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">This Month</span>
              <span className="font-semibold text-gray-900">₵{stats.monthSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold text-gray-900">Delivered Total</span>
              <span className="font-bold text-orange-600">₵{stats.totalSales.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 xl:col-span-2">
          <h3 className="font-semibold text-base sm:text-lg mb-4 text-gray-900">Top Customers</h3>
          <div className="space-y-3">
            {stats.topCustomers.map((customer, idx) => (
              <div key={`${customer.phone}-${idx}`} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{idx + 1}. {customer.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {customer.phone} · {customer.orders} orders · Last area: {customer.area}
                  </p>
                </div>
                <span className="text-sm font-semibold text-orange-600">₵{customer.revenue.toFixed(2)}</span>
              </div>
            ))}
            {stats.topCustomers.length === 0 && <p className="text-sm text-gray-500">No customer data yet.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base sm:text-lg text-gray-900">Area Demand Insights</h3>
            <span className="text-xs text-gray-500">Best branch expansion candidates</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-medium">Area</th>
                  <th className="py-2 pr-3 font-medium">Orders</th>
                  <th className="py-2 pr-3 font-medium">Unique Customers</th>
                  <th className="py-2 pr-3 font-medium">Revenue</th>
                  <th className="py-2 font-medium">Expansion Signal</th>
                </tr>
              </thead>
              <tbody>
                {stats.areaInsights.map((area) => {
                  const expansionSignal =
                    area.orders >= 10 || area.customers >= 6
                      ? 'Strong'
                      : area.orders >= 5 || area.customers >= 3
                        ? 'Moderate'
                        : 'Early';
                  const signalClass =
                    expansionSignal === 'Strong'
                      ? 'text-green-700 bg-green-100'
                      : expansionSignal === 'Moderate'
                        ? 'text-amber-700 bg-amber-100'
                        : 'text-gray-700 bg-gray-100';
                  return (
                    <tr key={area.area} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium text-gray-900">{area.area}</td>
                      <td className="py-2 pr-3 text-gray-700">{area.orders}</td>
                      <td className="py-2 pr-3 text-gray-700">{area.customers}</td>
                      <td className="py-2 pr-3 text-gray-700">₵{area.revenue.toFixed(2)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${signalClass}`}>
                          {expansionSignal}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {stats.areaInsights.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-500">No area demand data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}