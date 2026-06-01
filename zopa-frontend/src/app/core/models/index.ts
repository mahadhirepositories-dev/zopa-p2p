export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  is_zopa_staff: boolean;
  created_at?: string;
}

export interface TenantContext {
  tenant_id: number;
  tenant_name: string;
  role: string;
}

export interface Tenant {
  id: number;
  name: string;
  code: string;
  gstin?: string;
  po_prefix: string;
  fiscal_year_start: number;
  is_active: boolean;
}

export interface CostCenter {
  id: number;
  name: string;
  annual_budget: number;
  budget_from?: string | null;
  budget_to?: string | null;
  current_fiscal_year?: number;
  is_active?: boolean;
  department?: { id: number; name: string };
  project?: { id: number; name: string };
  location?: { id: number; name: string };
  approvalConfigs?: ApprovalConfig[];
}

export interface BudgetAdjustment {
  id: number;
  action: 'freeze' | 'release' | 'consume' | 'adjust';
  adjust_amount: number;
  freeze_amount: number;
  consume_amount: number;
  narration?: string;
  created_at: string;
  created_by?: { id: number; name: string };
}

export interface ApprovalConfig {
  id?: number;
  cost_center_id: number;
  level: 1 | 2 | 3;
  user_id: number;
  amount_limit?: number | null;
  is_active: boolean;
  user?: { id: number; name: string; email: string };
}

export interface Category {
  id: number;
  name: string;
  parent_id?: number | null;
  children?: Category[];
}

export interface Department { id: number; name: string; is_active: boolean; }
export interface Project { id: number; name: string; is_active: boolean; }
export interface Location { id: number; name: string; state?: string; state_code?: string; address?: string; gstin?: string; is_active: boolean; }

export interface VendorCategoryEntry {
  id?: number;
  category_id: number | null;
  subcategory_id?: number | null;
  category?: { id: number; name: string };
  subcategory?: { id: number; name: string };
}

export interface VendorDocument {
  id: number;
  document_type: 'pan' | 'gst' | 'cancelled_cheque' | 'additional';
  original_name: string;
  file_name: string;
  file_path: string;
  size?: number;
  url?: string;
  created_at?: string;
}

export interface Vendor {
  id: number;
  name: string;
  global_vendor_code?: string;
  entity_code?: string;
  vendor_type?: 'manufacturer' | 'distributor' | 'service_provider' | 'consultant';
  entity_type?: 'public' | 'pvt_ltd' | 'llp' | 'partnership' | 'individual' | 'overseas_company' | 'others';
  pan?: string;
  pan_not_available?: boolean;
  gst_status?: 'registered' | 'unregistered' | 'overseas';
  gstin?: string;
  email?: string;
  phone?: string;
  currency?: string;
  account_no?: string;
  ifsc?: string;
  micr?: string;
  bank_name?: string;
  branch_name?: string;
  special_status?: 'msme' | 'non_msme' | 'sez' | 'others';
  special_status_reg_no?: string;
  special_status_start_date?: string;
  special_status_end_date?: string;
  is_active: boolean;
  category_id?: number | null;
  subcategory_id?: number | null;
  category?: { id: number; name: string } | null;
  subcategory?: { id: number; name: string } | null;
  vendor_categories?: VendorCategoryEntry[];
  addresses?: VendorAddress[];
  documents?: VendorDocument[];
}

export interface VendorAddress {
  id: number;
  label: string;
  state?: string;
  state_code?: string;
  address?: string;
  gstin?: string;
  contact_name?: string;
  contact_phone?: string;
  is_default: boolean;
}

export interface Product {
  id: number;
  code?: string;
  name: string;
  description?: string | null;
  unit: string;
  net_rate: number;
  gst_rate: number;
  hsn_code?: string;
  warranty_months: number;
  is_active: boolean;
  category_id?: number | null;
  subcategory_id?: number | null;
  category?: { id: number; name: string } | null;
  subcategory?: { id: number; name: string } | null;
}

export interface PoItem {
  id?: number;
  sno?: number;
  pr_item_id?: number | null;
  pr_item?: { id: number; description: string; qty: number } | null;
  product_id?: number;
  product?: { id: number; name: string; code?: string; hsn_code?: string };
  description: string;
  category_id?: number;
  qty: number;
  net_rate: number;
  gst_rate: number;
  gross_rate?: number;
  amount?: number;
  required_by?: string;
  warranty_months?: number;
}

export interface PrItem {
  id: number;
  sno: number;
  product_id?: number;
  product?: { id: number; name: string; unit?: string };
  description: string;
  category_id?: number;
  category?: { id: number; name: string };
  qty: number;
  converted_qty: number;
  unit?: string;
  estimated_price?: number;
  remarks?: string;
}

export interface PrSummary {
  id: number;
  pr_number?: string;
  title?: string;
  status: string;
}

export interface PurchaseOrder {
  id?: number;
  pr_id?: number;
  pr?: PrSummary;
  prs?: PrSummary[];
  pr_reference?: string;
  po_number?: string;
  po_date?: string;
  status: string;
  vendor_id: number;
  vendor?: Vendor;
  vendor_address_id?: number;
  vendor_address?: VendorAddress;
  cost_center_id: number;
  cost_center?: CostCenter;
  bill_to_location_id?: number;
  ship_to_location_id?: number;
  po_valid_till?: string;
  payment_terms_json?: PaymentTerm[];
  warranty_months?: number;
  terms_conditions?: string;
  freight?: number;
  net_total?: number;
  tax_amount?: number;
  grand_total?: number;
  round_off?: number;
  items?: PoItem[];
  attachments?: any[];
  approvals?: Approval[];
  invoices?: any[];
  created_by?: number;
  created_by_role?: string;
  created_at?: string;
  invoiced_at?: string;
}

export interface PaymentTerm {
  stage: string;
  percentage: number;
  credit_days: number;
}

export interface Budget {
  annual: number;
  frozen: number;
  consumed: number;
  available: number;
}

export interface Approval {
  id: number;
  entity_type: string;
  entity_id: number;
  level: number;
  assigned_to_user_id: number;
  assigned_to?: User;
  action: 'pending' | 'approved' | 'returned' | 'rejected';
  comments?: string;
  acted_at?: string;
}

// ── Access Control ──────────────────────────────────────────────────────────

export interface ModulePermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

/** Full permissions matrix: role name → module name → CRUD flags */
export type PermissionsMatrix = Record<string, Record<string, ModulePermissions>>;

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export type Role =
  | 'zopa_super_admin'
  | 'zopa_buyer'
  | 'zopa_approver_l1'
  | 'zopa_approver_l2'
  | 'zopa_approver_l3'
  | 'client_admin'
  | 'client_buyer'
  | 'client_approver_l1'
  | 'client_approver_l2'
  | 'client_approver_l3';
