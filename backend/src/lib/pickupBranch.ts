import { supabase } from '../config/supabase';

export interface PickupBranchInfo {
  id: string;
  branch_name: string;
  address: string;
  phone: string | null;
}

export interface PickupFormFields {
  pickupBranchId: string | null;
  pickupBranchName: string | null;
  pickupBranchAddress: string | null;
}

/** Normalize camelCase / snake_case pickup fields from checkout or Paystack metadata. */
export function extractPickupFromForm(formData: Record<string, unknown> | null | undefined): PickupFormFields {
  const fd = formData || {};
  const id =
    (fd.pickupBranchId as string) ||
    (fd.pickup_branch_id as string) ||
    null;
  const name =
    (fd.pickupBranchName as string) ||
    (fd.pickup_branch_name as string) ||
    (fd.pickup_branch as string) ||
    null;
  const address =
    (fd.pickupBranchAddress as string) ||
    (fd.pickup_branch_address as string) ||
    null;
  return {
    pickupBranchId: id?.trim() || null,
    pickupBranchName: name?.trim() || null,
    pickupBranchAddress: address?.trim() || null,
  };
}

/** Merge Paystack top-level metadata strings into formData (metadata values must be strings). */
export function normalizeCheckoutFormData(
  formData: Record<string, unknown> | string | null | undefined,
  meta?: Record<string, unknown>
): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (typeof formData === 'string') {
    try {
      base = JSON.parse(formData) as Record<string, unknown>;
    } catch {
      base = {};
    }
  } else if (formData && typeof formData === 'object') {
    base = { ...formData };
  }

  const pickup = extractPickupFromForm(base);
  const metaPickup = extractPickupFromForm(meta as Record<string, unknown>);

  return {
    ...base,
    fulfillmentMode: base.fulfillmentMode || meta?.fulfillmentMode || 'delivery',
    pickupBranchId: pickup.pickupBranchId || metaPickup.pickupBranchId || null,
    pickupBranchName: pickup.pickupBranchName || metaPickup.pickupBranchName || null,
    pickupBranchAddress: pickup.pickupBranchAddress || metaPickup.pickupBranchAddress || null,
  };
}

/** Load pickup branch from DB by id; fall back to client-sent name/address. */
export async function resolvePickupBranch(
  companyId: string,
  pickupBranchId: string | null | undefined,
  pickupBranchNameFromClient?: string | null,
  pickupBranchAddressFromClient?: string | null
): Promise<PickupBranchInfo | null> {
  if (pickupBranchId) {
    const { data, error } = await supabase
      .from('pickup_branches')
      .select('id, branch_name, address, phone, company_id')
      .eq('id', pickupBranchId)
      .maybeSingle();

    if (error) {
      console.error('[pickupBranch] lookup error:', error);
    }

    if (data) {
      if (companyId && data.company_id && data.company_id !== companyId) {
        console.warn('[pickupBranch] company mismatch for branch', pickupBranchId);
      }
      return {
        id: data.id,
        branch_name: data.branch_name,
        address: data.address || '',
        phone: data.phone ?? null,
      };
    }
  }

  const fallbackName = pickupBranchNameFromClient?.trim();
  if (fallbackName) {
    return {
      id: pickupBranchId || '',
      branch_name: fallbackName,
      address: pickupBranchAddressFromClient?.trim() || '',
      phone: null,
    };
  }

  return null;
}

export function formatPickupLocationLine(branch: PickupBranchInfo | null): string {
  if (!branch?.branch_name) return 'Pickup location not specified';
  if (branch.address?.trim()) {
    return `${branch.branch_name} — ${branch.address.trim()}`;
  }
  return branch.branch_name;
}

export function formatPickupOrderAddress(branch: PickupBranchInfo | null): string {
  if (!branch?.branch_name) return 'Pickup';
  return formatPickupLocationLine(branch);
}

/** One-line fulfillment summary for order notifications (no duplicate "Pickup Pickup…"). */
export function buildOrderFulfillmentSummary(opts: {
  isPickup: boolean;
  paymentLabel: string;
  pickupBranch: PickupBranchInfo | null;
  deliveryAddress: string;
  /** When true, prefix with "Paid by " (card payments). */
  paidPrefix?: boolean;
}): string {
  const { isPickup, paymentLabel, pickupBranch, deliveryAddress, paidPrefix } = opts;
  const pay = paidPrefix ? `Paid by ${paymentLabel}` : paymentLabel;
  if (isPickup) {
    return `${pay} | Pickup at ${formatPickupLocationLine(pickupBranch)}`;
  }
  return `${pay} | Delivery — ${deliveryAddress}`;
}

export function paymentLabelForOrder(
  paymentMethodRaw: string | undefined,
  isPickup: boolean
): string {
  const method = paymentMethodRaw || 'cash';
  if (method === 'cash') return isPickup ? 'Pay at Branch' : 'Cash on Delivery';
  if (method === 'mobile_money') return 'Mobile Money';
  if (method === 'card') return 'Card';
  return method;
}
