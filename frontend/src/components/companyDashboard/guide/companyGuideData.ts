export type CompanyTab =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'ratings'
  | 'customers'
  | 'analytics'
  | 'settings';

export type SettingsSubTab = 'company' | 'categories' | 'delivery-areas' | 'pickup-branches' | 'delivery-guys';

export interface GuideChecklistItem {
  id: string;
  title: string;
  description: string;
  tab: CompanyTab;
  settingsSubTab?: SettingsSubTab;
}

export interface GuideTourStep {
  id: string;
  tab: CompanyTab;
  settingsSubTab?: SettingsSubTab;
  /** CSS selector, e.g. [data-guide="nav-orders"] */
  target?: string;
  title: string;
  body: string;
  checklistId?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const COMPANY_GUIDE_CHECKLIST: GuideChecklistItem[] = [
  {
    id: 'profile',
    title: 'Complete company profile',
    description: 'Add your restaurant name, location, phone, and description in Settings.',
    tab: 'settings',
    settingsSubTab: 'company',
  },
  {
    id: 'categories',
    title: 'Create menu categories',
    description: 'Add groups like Main dishes, Sides, and Drinks before adding products.',
    tab: 'settings',
    settingsSubTab: 'categories',
  },
  {
    id: 'delivery-areas',
    title: 'Set up delivery areas & fees',
    description: 'Define areas you deliver to and the fee for each zone.',
    tab: 'settings',
    settingsSubTab: 'delivery-areas',
  },
  {
    id: 'pickup-branches',
    title: 'Add pickup branches (optional)',
    description: 'Let customers collect orders from your branch locations.',
    tab: 'settings',
    settingsSubTab: 'pickup-branches',
  },
  {
    id: 'products',
    title: 'Add menu products',
    description: 'Create items with prices, photos, and stock so customers can order.',
    tab: 'products',
  },
  {
    id: 'delivery-guys',
    title: 'Add delivery staff (optional)',
    description: 'Create accounts for riders to receive and deliver orders.',
    tab: 'settings',
    settingsSubTab: 'delivery-guys',
  },
  {
    id: 'orders',
    title: 'Process your first order',
    description: 'Confirm → prepare → assign rider when ready → mark delivered.',
    tab: 'orders',
  },
  {
    id: 'ratings',
    title: 'Check customer ratings',
    description: 'Read feedback and improve your service over time.',
    tab: 'ratings',
  },
];

export const COMPANY_GUIDE_TOUR_STEPS: GuideTourStep[] = [
  {
    id: 'welcome',
    tab: 'dashboard',
    title: 'Welcome to your restaurant dashboard',
    body: 'This quick tour shows where to manage orders, menu items, delivery, and settings. You can reopen the guide anytime from the help button.',
    placement: 'center',
  },
  {
    id: 'dashboard',
    tab: 'dashboard',
    target: '[data-guide="dashboard-stats"]',
    title: 'Dashboard overview',
    body: 'See today’s orders, pending work, sales, and low-stock alerts at a glance. Tap any recent order to open details.',
    checklistId: 'profile',
    placement: 'bottom',
  },
  {
    id: 'notifications',
    tab: 'dashboard',
    target: '[data-guide="notifications"]',
    title: 'Order notifications',
    body: 'New orders and status updates appear here. Click a notification to jump straight to that order.',
    placement: 'bottom',
  },
  {
    id: 'add-item',
    tab: 'dashboard',
    target: '[data-guide="add-item"]',
    title: 'Add menu items quickly',
    body: 'Use “Add Item” to create a new product with name, price, image, and stock.',
    checklistId: 'products',
    placement: 'bottom',
  },
  {
    id: 'nav-products',
    tab: 'products',
    target: '[data-guide="nav-products"]',
    title: 'Products / menu',
    body: 'Edit prices, toggle availability, update stock, and delete items. Keep your menu accurate so customers see what you offer.',
    placement: 'right',
  },
  {
    id: 'nav-orders',
    tab: 'orders',
    target: '[data-guide="nav-orders"]',
    title: 'Orders workflow',
    body: 'Filter by status or date. Move orders: Pending → Confirmed → Preparing → Ready (assign a delivery guy) → Out for delivery → Delivered.',
    checklistId: 'orders',
    placement: 'right',
  },
  {
    id: 'orders-board',
    tab: 'orders',
    target: '[data-guide="orders-board"]',
    title: 'Manage each order',
    body: 'Open an order to see items, customer address, and payment. Update status or cancel when still early in the flow.',
    placement: 'top',
  },
  {
    id: 'nav-customers',
    tab: 'customers',
    target: '[data-guide="nav-customers"]',
    title: 'Customers',
    body: 'View people who have ordered from you and their order history.',
    placement: 'right',
  },
  {
    id: 'nav-ratings',
    tab: 'ratings',
    target: '[data-guide="nav-ratings"]',
    title: 'Ratings & reviews',
    body: 'See star ratings and comments from customers after delivery.',
    checklistId: 'ratings',
    placement: 'right',
  },
  {
    id: 'nav-analytics',
    tab: 'analytics',
    target: '[data-guide="nav-analytics"]',
    title: 'Analytics',
    body: 'Track sales trends, popular products, and performance over time.',
    placement: 'right',
  },
  {
    id: 'nav-settings',
    tab: 'settings',
    target: '[data-guide="nav-settings"]',
    title: 'Settings hub',
    body: 'Company profile, delivery zones, pickup branches, and delivery staff are all configured here.',
    checklistId: 'profile',
    placement: 'right',
  },
  {
    id: 'settings-categories',
    tab: 'settings',
    settingsSubTab: 'categories',
    target: '[data-guide="settings-categories"]',
    title: 'Menu categories',
    body: 'Create categories here first, then assign them when you add products. Customers can filter by category on the menu.',
    checklistId: 'categories',
    placement: 'top',
  },
  {
    id: 'settings-delivery',
    tab: 'settings',
    settingsSubTab: 'delivery-areas',
    target: '[data-guide="settings-delivery-areas"]',
    title: 'Delivery areas & fees',
    body: 'Add each area you serve and set the delivery fee. Customers outside these zones may get a fee confirmed later.',
    checklistId: 'delivery-areas',
    placement: 'top',
  },
  {
    id: 'settings-pickup',
    tab: 'settings',
    settingsSubTab: 'pickup-branches',
    target: '[data-guide="settings-pickup-branches"]',
    title: 'Pickup branches',
    body: 'Optional: list branch names and addresses for pickup orders.',
    checklistId: 'pickup-branches',
    placement: 'top',
  },
  {
    id: 'settings-riders',
    tab: 'settings',
    settingsSubTab: 'delivery-guys',
    target: '[data-guide="settings-delivery-guys"]',
    title: 'Delivery staff',
    body: 'Create rider logins. When an order is Ready, assign a delivery guy so they see it on their app.',
    checklistId: 'delivery-guys',
    placement: 'top',
  },
  {
    id: 'finish',
    tab: 'dashboard',
    title: 'You’re all set!',
    body: 'Use the setup checklist in the guide panel to track onboarding. Tap any task to jump to that section.',
    placement: 'center',
  },
];
