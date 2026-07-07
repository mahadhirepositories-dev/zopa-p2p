/**
 * Help Center content — structured, searchable, role-aware.
 *
 * Each article is tagged so the Help page can surface what's relevant to the
 * logged-in user:
 *   - modules:        relevant if the user can VIEW any of these modules
 *   - adminOnly:      only client_admin / super admin
 *   - superAdminOnly: only ZOPA super admin
 *   - (no tags):      general — relevant to everyone
 */

export interface HelpArticle {
  id: string;
  title: string;
  category: HelpCategory;
  icon: string;
  summary: string;
  keywords: string[];
  body: string;            // simple HTML (sanitized by Angular)
  modules?: string[];
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

export type HelpCategory =
  | 'Getting Started'
  | 'My Account'
  | 'Procurement'
  | 'Approvals'
  | 'Master Data'
  | 'Administration'
  | 'Dashboards & Reports';

export const HELP_CATEGORIES: { key: HelpCategory; icon: string }[] = [
  { key: 'Getting Started',     icon: 'rocket_launch' },
  { key: 'My Account',          icon: 'account_circle' },
  { key: 'Procurement',         icon: 'receipt_long' },
  { key: 'Approvals',           icon: 'task_alt' },
  { key: 'Master Data',         icon: 'folder_open' },
  { key: 'Dashboards & Reports',icon: 'insights' },
  { key: 'Administration',      icon: 'admin_panel_settings' },
];

/** Friendly labels for module keys (used in the "what you can do" panel). */
export const MODULE_LABELS: Record<string, { label: string; icon: string }> = {
  purchase_requisitions: { label: 'Requisitions',   icon: 'description' },
  purchase_orders:       { label: 'Purchase Orders', icon: 'receipt_long' },
  grns:                  { label: 'Goods Receipt',   icon: 'inventory_2' },
  invoices:              { label: 'Invoices',        icon: 'request_quote' },
  approvals:             { label: 'Approvals',       icon: 'task_alt' },
  vendors:               { label: 'Vendors',         icon: 'business' },
  products:              { label: 'Products',        icon: 'inventory' },
  cost_centers:          { label: 'Cost Centers',    icon: 'account_balance_wallet' },
  org_masters:           { label: 'Org Masters',     icon: 'corporate_fare' },
  reports:               { label: 'Reports',         icon: 'bar_chart' },
  org_staff:             { label: 'Staff',           icon: 'group' },
};

export const HELP_ARTICLES: HelpArticle[] = [
  // ── Getting Started ───────────────────────────────────────────────────────
  {
    id: 'welcome',
    title: 'Welcome to ZOPA — the procurement journey',
    category: 'Getting Started',
    icon: 'waving_hand',
    summary: 'How a purchase flows from request to payment.',
    keywords: ['overview', 'workflow', 'journey', 'introduction', 'start'],
    body: `<p>ZOPA takes a purchase from the first request all the way to payment, with approvals and a full audit trail at each step.</p>
      <p><strong>The journey:</strong></p>
      <ol>
        <li><strong>Requisition (PR)</strong> — someone requests what's needed</li>
        <li><strong>RFQ / Approval</strong> — the request is reviewed</li>
        <li><strong>Purchase Order (PO)</strong> — the order is placed with a vendor</li>
        <li><strong>Approval &amp; Release</strong> — the PO is approved and sent to the vendor</li>
        <li><strong>Goods Receipt (GRN)</strong> — goods are received</li>
        <li><strong>Invoice &amp; Payment</strong> — the vendor is paid</li>
      </ol>`,
  },
  {
    id: 'signing-in',
    title: 'Signing in',
    category: 'Getting Started',
    icon: 'login',
    summary: 'How to log into ZOPA.',
    keywords: ['login', 'sign in', 'password', 'access'],
    body: `<ol>
        <li>Open <code>https://p2p.zopapro.com</code>.</li>
        <li>Enter your <strong>email</strong> and <strong>password</strong>.</li>
        <li>Click <strong>Sign In</strong>.</li>
      </ol>
      <p>If you've forgotten your password, ask your organization's admin to reset it.</p>`,
  },
  {
    id: 'navigation',
    title: 'Finding your way around',
    category: 'Getting Started',
    icon: 'explore',
    summary: 'The sidebar menu and where things live.',
    keywords: ['menu', 'sidebar', 'navigate', 'navigation', 'find'],
    body: `<p>The left sidebar groups everything:</p>
      <ul>
        <li><strong>Main</strong> — Dashboard, Help</li>
        <li><strong>Procurement</strong> — Requisitions, Purchase Orders, Approvals, Goods Receipt, Invoices, Reports</li>
        <li><strong>Master Data</strong> — Vendors, Products, Categories, Cost Centers, Org Masters</li>
        <li><strong>Administration</strong> — staff / platform tools (depends on your role)</li>
      </ul>
      <p>Menu items you don't have permission to view are hidden automatically.</p>`,
  },
  {
    id: 'roles',
    title: 'Your role & permissions',
    category: 'Getting Started',
    icon: 'badge',
    summary: 'What roles can do and why some buttons are hidden.',
    keywords: ['role', 'permission', 'access', 'buyer', 'approver', 'admin', 'cannot see'],
    body: `<p>What you can see and do depends on your <strong>role</strong>. Common roles:</p>
      <ul>
        <li><strong>Buyer</strong> — creates and edits requisitions, POs, GRNs, invoices.</li>
        <li><strong>Approver (L1/L2/L3)</strong> — reviews and approves documents.</li>
        <li><strong>Admin</strong> — full control within the organization.</li>
        <li><strong>ZOPA Super Admin</strong> — manages the whole platform.</li>
      </ul>
      <p>Each role has <strong>View / Create / Edit / Delete</strong> permission per module. If a button or menu is missing, your role doesn't allow that action — ask your admin to adjust it in <em>Access Control</em>.</p>`,
  },

  // ── My Account ────────────────────────────────────────────────────────────
  {
    id: 'profile',
    title: 'Update your profile',
    category: 'My Account',
    icon: 'manage_accounts',
    summary: 'Edit your name and phone number.',
    keywords: ['profile', 'name', 'phone', 'account', 'details'],
    body: `<ol>
        <li>Click your <strong>name/avatar</strong> at the bottom-left of the sidebar.</li>
        <li>Under <strong>Personal Details</strong>, edit your <strong>name</strong> and <strong>phone</strong>.</li>
        <li>Click <strong>Save Changes</strong>.</li>
      </ol>
      <p>Your email is your login ID and can't be changed here. You can also see which organizations and roles you belong to.</p>`,
  },
  {
    id: 'password',
    title: 'Change your password',
    category: 'My Account',
    icon: 'key',
    summary: 'Set a new password securely.',
    keywords: ['password', 'security', 'change password', 'reset'],
    body: `<ol>
        <li>Open <strong>My Profile</strong> (your avatar, bottom-left).</li>
        <li>In the <strong>Security</strong> card, enter your current password and a new one (twice).</li>
        <li>Click <strong>Update Password</strong>.</li>
      </ol>
      <p>For your safety, changing your password signs you out of all <em>other</em> devices.</p>`,
  },

  // ── Procurement ───────────────────────────────────────────────────────────
  {
    id: 'create-pr',
    title: 'Create a Purchase Requisition (PR)',
    category: 'Procurement',
    icon: 'description',
    summary: 'Request something to be purchased.',
    keywords: ['pr', 'requisition', 'request', 'create', 'new'],
    modules: ['purchase_requisitions'],
    body: `<ol>
        <li>Go to <strong>Requisitions → New Requisition</strong>.</li>
        <li>Fill the title, cost center, project/location, priority and required-by date.</li>
        <li>Add <strong>line items</strong>: description, quantity, unit and estimated price.</li>
        <li><strong>Save as Draft</strong>, then <strong>Submit</strong>.</li>
      </ol>
      <p>If an approval chain is configured, the PR routes to approvers. A PR can later be converted into one or more POs (full or partial — converted quantity is tracked).</p>
      <p><strong>Statuses:</strong> Draft → Submitted → (RFQ Created → RFQ Approved) → Converted / Partially Converted → Rejected.</p>`,
  },
  {
    id: 'create-po',
    title: 'Create a Purchase Order (PO)',
    category: 'Procurement',
    icon: 'receipt_long',
    summary: 'Place an order with a vendor.',
    keywords: ['po', 'purchase order', 'create', 'vendor', 'order', 'gst'],
    modules: ['purchase_orders'],
    body: `<ol>
        <li>Go to <strong>Purchase Orders → New Purchase Order</strong> (or convert from a PR).</li>
        <li>Choose the <strong>vendor</strong>, vendor address, <strong>cost center</strong>, <strong>Bill-to</strong> and <strong>Ship-to</strong> locations and validity date — a preview shows the exact address that will print on the PO.</li>
        <li>Add line items — the system computes <strong>GST</strong> (IGST vs CGST+SGST) and totals automatically. (Tip: use <strong>BOQ Template → Upload BOQ</strong> to import line items from Excel.)</li>
        <li>Add payment terms, freight and terms &amp; conditions (an AI helper can suggest terms).</li>
        <li><strong>Submit</strong> — it routes through the PO approval chain (respecting amount limits).</li>
      </ol>
      <p><strong>Statuses:</strong> Draft → Pending L1/L2/L3 → Approved → Released → Delivered → Invoiced → Payment Released (or Cancelled).</p>`,
  },
  {
    id: 'release-po',
    title: 'Release a PO & download the PDF',
    category: 'Procurement',
    icon: 'picture_as_pdf',
    summary: 'Send the approved PO to the vendor.',
    keywords: ['release', 'pdf', 'download', 'vendor', 'send', 'po'],
    modules: ['purchase_orders'],
    body: `<p>Once a PO is fully approved it gets a <strong>PO number</strong>. Open the PO and use <strong>Release</strong> — the PO is then <strong>automatically emailed to the vendor</strong> with the PO PDF. Use <strong>Send to Vendor</strong> to (re-)send it, e.g. after adding the vendor's email address.</p>
      <p><strong>Download PDF</strong> gives a printable copy showing the line items, the <strong>preparer</strong> and <strong>approver</strong> names, and the full <strong>Bill-to / Ship-to</strong> addresses.</p>`,
  },
  {
    id: 'grn',
    title: 'Record a Goods Receipt (GRN)',
    category: 'Procurement',
    icon: 'inventory_2',
    summary: 'Confirm goods that have arrived.',
    keywords: ['grn', 'goods', 'receipt', 'received', 'delivery'],
    modules: ['grns'],
    body: `<ol>
        <li>Go to <strong>Goods Receipt → New GRN</strong>.</li>
        <li>Pick a released/approved <strong>PO</strong> (fully-received POs are hidden).</li>
        <li>Enter the <strong>received quantity</strong> for each line. Partial receipts are allowed — record several GRNs over time.</li>
        <li>Click <strong>Save</strong>.</li>
      </ol>
      <p>When every line is fully received, the PO is automatically marked <strong>Delivered</strong>.</p>`,
  },
  {
    id: 'invoice',
    title: 'Create an Invoice',
    category: 'Procurement',
    icon: 'request_quote',
    summary: 'Record a vendor invoice for payment.',
    keywords: ['invoice', 'bill', 'payment', 'create', 'freight'],
    modules: ['invoices'],
    body: `<ol>
        <li>Go to <strong>Invoices → New Invoice</strong>.</li>
        <li>Link the <strong>PO</strong> (and optionally a GRN), then enter invoice number, date, amount, freight and type (Regular / Advance / Proforma).</li>
        <li><strong>Submit</strong> — it routes through the Invoice approval chain.</li>
      </ol>
      <p>On approval the PO moves to <strong>Invoiced</strong>, and payment release follows.</p>`,
  },

  // ── Approvals ─────────────────────────────────────────────────────────────
  {
    id: 'approve-app',
    title: 'Approve in the app',
    category: 'Approvals',
    icon: 'task_alt',
    summary: 'Review and decide on documents assigned to you.',
    keywords: ['approve', 'reject', 'return', 'review', 'approval', 'decision'],
    modules: ['approvals'],
    body: `<ol>
        <li>Open the <strong>Approvals</strong> menu — it lists items waiting for you.</li>
        <li>Open an item to review the full details.</li>
        <li>Choose <strong>Approve</strong>, <strong>Return for Revision</strong> (with a query), or <strong>Reject</strong> (with a reason).</li>
      </ol>
      <p>Approving at the final level advances the document automatically. Returning or rejecting notifies the originator by email with your remarks.</p>`,
  },
  {
    id: 'approve-email',
    title: 'Approve straight from your email (no login)',
    category: 'Approvals',
    icon: 'mark_email_read',
    summary: 'One-click approve or reject from the notification email.',
    keywords: ['email', 'one click', 'approve', 'reject', 'notification', 'inbox'],
    modules: ['approvals'],
    body: `<p>When a document reaches your level you receive an email with the <strong>full line items + a PDF</strong> and two buttons:</p>
      <ul>
        <li><strong>✓ Approve</strong> — one click approves it.</li>
        <li><strong>✗ Reject</strong> — opens a short form to enter a reason.</li>
      </ul>
      <p>These links are unique to you, <strong>single-use</strong>, and expire in <strong>72 hours</strong>. No login required.</p>`,
  },

  // ── Master Data ───────────────────────────────────────────────────────────
  {
    id: 'vendors',
    title: 'Manage Vendors',
    category: 'Master Data',
    icon: 'business',
    summary: 'Add and maintain supplier records.',
    keywords: ['vendor', 'supplier', 'pan', 'gst', 'bank', 'address', 'documents'],
    modules: ['vendors'],
    body: `<p>Open <strong>Vendors</strong> to add suppliers with codes, PAN/GST, bank details, multiple addresses and documents (PAN, GST, cancelled cheque).</p>
      <p>Tip: entering a <strong>pincode</strong> auto-fills the city, state and country.</p>`,
  },
  {
    id: 'products',
    title: 'Products & Categories',
    category: 'Master Data',
    icon: 'inventory',
    summary: 'Maintain your catalogue.',
    keywords: ['product', 'category', 'catalogue', 'hsn', 'gst rate', 'unit'],
    modules: ['products'],
    body: `<p><strong>Categories</strong> organise items into hierarchical groups. <strong>Products</strong> hold catalogue details (name, HSN code, GST %, unit, rate). Adding products speeds up PR and PO line entry.</p>`,
  },
  {
    id: 'cost-centers',
    title: 'Cost Centers & Budgets',
    category: 'Master Data',
    icon: 'account_balance_wallet',
    summary: 'Control spend with budgets.',
    keywords: ['cost center', 'budget', 'spend', 'frozen', 'consumed', 'available'],
    modules: ['cost_centers'],
    body: `<p>A <strong>Cost Center</strong> ties a budget to a department/project/location. Set the <strong>Annual Budget</strong> and fiscal year. As POs are raised, the budget shows:</p>
      <ul>
        <li><strong>Frozen</strong> — reserved by draft/pending POs</li>
        <li><strong>Consumed</strong> — actually spent</li>
        <li><strong>Available</strong> — what's left</li>
      </ul>`,
  },
  {
    id: 'approval-rules',
    title: 'Set up approval rules',
    category: 'Master Data',
    icon: 'rule',
    summary: 'Define who approves what, and amount limits.',
    keywords: ['approval', 'config', 'rules', 'levels', 'limit', 'chain', 'l1', 'l2', 'l3'],
    modules: ['cost_centers'],
    adminOnly: true,
    body: `<p>Inside each <strong>Cost Center</strong>, configure <strong>Approval Configs</strong>: which user(s) approve at L1/L2/L3, and optional <strong>amount limits</strong> (e.g., POs over ₹1,00,000 also require L2). You can set separate chains for <strong>PR</strong>, <strong>PO</strong> and <strong>Invoice</strong>.</p>
      <p>The <strong>highest level you configure is the final approver</strong>. If you set only L1, approving at L1 completes the document; amount limits only <em>add</em> higher levels — a document never gets stuck waiting for a level you didn't set up.</p>`,
  },
  {
    id: 'org-masters',
    title: 'Org Masters (Departments, Projects, Locations)',
    category: 'Master Data',
    icon: 'corporate_fare',
    summary: 'The organizational building blocks.',
    keywords: ['department', 'project', 'location', 'org', 'master', 'gst'],
    modules: ['org_masters'],
    body: `<p><strong>Org Masters</strong> holds your Departments, Projects and Locations. A <strong>Location</strong> records a full address — <strong>Address, City, State, State Code, Pincode, Country</strong> and GSTIN — which flows into the <strong>Bill-to / Ship-to</strong> blocks printed on POs (and a PR's delivery location) and drives GST calculation (via state codes).</p>`,
  },

  // ── Dashboards & Reports ──────────────────────────────────────────────────
  {
    id: 'dashboard',
    title: 'Understanding your Dashboard KPIs',
    category: 'Dashboards & Reports',
    icon: 'dashboard',
    summary: 'What the home dashboard numbers mean.',
    keywords: ['dashboard', 'kpi', 'stats', 'budget', 'pending', 'home'],
    body: `<p>Your Dashboard shows your organization's procurement health:</p>
      <ul>
        <li><strong>Total POs</strong>, <strong>Pending Approvals</strong> (waiting for you — click to jump there), <strong>Approved</strong>, and later stages.</li>
        <li><strong>Total PO Value</strong> — combined ₹ value.</li>
        <li><strong>Budget per Cost Center</strong> — Annual · Frozen · Consumed · Available.</li>
        <li><strong>Recent activity</strong> and <strong>turnaround (TAT)</strong> tables for POs and PRs.</li>
      </ul>`,
  },
  {
    id: 'reports',
    title: 'TAT Reports & exports',
    category: 'Dashboards & Reports',
    icon: 'bar_chart',
    summary: 'Turnaround-time analytics and CSV/PDF export.',
    keywords: ['report', 'tat', 'turnaround', 'export', 'csv', 'pdf', 'analytics'],
    modules: ['reports'],
    body: `<p>Open <strong>Reports → TAT Reports</strong> for turnaround analytics across the PR → PO → Approval → Release → Delivery → Invoice journey. Filter by <strong>date range</strong> and <strong>cost center</strong>, and <strong>Export to CSV or PDF</strong>.</p>`,
  },
  {
    id: 'zopa-dashboard',
    title: 'ZOPA Admin Dashboard (cross-organization)',
    category: 'Dashboards & Reports',
    icon: 'monitor_heart',
    summary: 'Consolidated KPIs across all organizations.',
    keywords: ['zopa', 'admin', 'dashboard', 'consolidated', 'all organizations'],
    superAdminOnly: true,
    body: `<p>The <strong>ZOPA Dashboard</strong> consolidates every organization. Filter to <em>All Organizations</em> or any one using the <strong>searchable organization picker</strong> (type to find an org; ↑/↓/Enter). It shows the headline band (POs, PRs, GRNs, Invoices, Pending Approvals, PO Value), a PO status donut, value comparisons, PO value by organization, the PR pipeline, invoice &amp; GRN summaries, and an organization overview table.</p>`,
  },

  // ── Administration ────────────────────────────────────────────────────────
  {
    id: 'staff',
    title: 'Manage staff (add users & roles)',
    category: 'Administration',
    icon: 'group',
    summary: 'Add people to your organization.',
    keywords: ['staff', 'users', 'add user', 'role', 'team', 'invite'],
    modules: ['org_staff'],
    adminOnly: true,
    body: `<p>Open <strong>Staff Management</strong> to add users to your organization and assign their role (Buyer, Approver L1/L2/L3). Deactivate users who leave.</p>`,
  },
  {
    id: 'client-management',
    title: 'Client Management',
    category: 'Administration',
    icon: 'manage_accounts',
    summary: 'Create client organizations and their users.',
    keywords: ['client', 'organization', 'tenant', 'onboard', 'create client'],
    superAdminOnly: true,
    body: `<p>(<strong>ZOPA Super Admin</strong>) <strong>Client Management</strong> lets you create client organizations, add client users, assign ZOPA staff to a client, change roles, and deactivate accounts.</p>
      <p>You can also configure the numbering sequence for Purchase Orders (PO) and Purchase Requisitions (PR) by setting a custom Prefix and Starting Series.</p>`,
  },
  {
    id: 'access-control',
    title: 'Access Control — fine-grained permissions',
    category: 'Administration',
    icon: 'admin_panel_settings',
    summary: 'Decide what each role can view/create/edit/delete.',
    keywords: ['access control', 'permission', 'role', 'matrix', 'restrict', 'security'],
    superAdminOnly: true,
    body: `<p>(<strong>ZOPA Super Admin</strong>) Open <strong>Access Control</strong>. For each role, toggle <strong>View / Create / Edit / Delete</strong> for every module. Changes take effect immediately.</p>
      <ul>
        <li>Super Admin is always unrestricted.</li>
        <li>Turning off <strong>View</strong> hides the module's menu and blocks access.</li>
        <li>Turning off Create/Edit/Delete hides those buttons and blocks the action on the server too (not just hidden).</li>
      </ul>`,
  },
  {
    id: 'platform-settings',
    title: 'Platform Settings (branding)',
    category: 'Administration',
    icon: 'tune',
    summary: 'Upload the parent-company logo.',
    keywords: ['settings', 'logo', 'branding', 'platform'],
    superAdminOnly: true,
    body: `<p>(<strong>ZOPA Super Admin</strong>) Upload the parent-company logo, used in PDF footers and as a header fallback when a client has no logo of their own.</p>`,
  },
  {
    id: 'email-templates',
    title: 'Email Templates (preview)',
    category: 'Administration',
    icon: 'mail',
    summary: 'Preview the emails the system sends.',
    keywords: ['email', 'templates', 'preview', 'notifications', 'mail'],
    superAdminOnly: true,
    body: `<p>(<strong>ZOPA Super Admin</strong>) <strong>Email Templates</strong> shows a live preview of every automated email — Password Reset, PO Issued to Vendor, Approval Request, and Status Update — rendered with sample data, so you can see exactly what recipients receive.</p>`,
  },

  // ── New-feature articles ──────────────────────────────────────────────────
  {
    id: 'forgot-password',
    title: 'Reset a forgotten password',
    category: 'My Account',
    icon: 'lock_reset',
    summary: 'Get back in if you forgot your password.',
    keywords: ['forgot', 'reset', 'password', 'recover', 'email', 'login', 'locked out'],
    body: `<p>On the login page click <strong>Forgot password?</strong>, enter your account email, and submit. You'll receive an email with a <strong>Reset Password</strong> link, valid for <strong>60 minutes</strong> and usable once.</p>
      <p>For security, the confirmation message is the same whether or not the email is registered.</p>`,
  },
  {
    id: 'switch-org',
    title: 'Switch organization (multi-org users)',
    category: 'Getting Started',
    icon: 'corporate_fare',
    summary: 'Move between organizations you belong to.',
    keywords: ['switch', 'organization', 'org', 'tenant', 'change', 'context', 'ctrl k', 'cmd k'],
    body: `<p>If you belong to more than one organization, use the <strong>organization switcher</strong> at the top of the sidebar — or press <strong>Ctrl / ⌘ + K</strong>. It's a searchable picker: type to filter, then ↑/↓ and Enter to switch (built for hundreds of organizations).</p>
      <p>The <strong>context bar</strong> under the top bar always shows which organization you're working in, and whether it's a <strong>Client</strong> or <strong>ZOPA Internal</strong> org — so anything you add belongs to that organization.</p>`,
  },
  {
    id: 'bulk-upload',
    title: 'Bulk-upload products & vendors (Excel)',
    category: 'Master Data',
    icon: 'upload_file',
    summary: 'Import many products or vendors at once.',
    keywords: ['bulk', 'upload', 'import', 'excel', 'template', 'products', 'vendors', 'csv', 'xlsx'],
    modules: ['products', 'vendors'],
    adminOnly: true,
    body: `<p>On the <strong>Products</strong> and <strong>Vendors</strong> lists use <strong>Template</strong> to download a ready-to-fill Excel file, then <strong>Bulk Upload</strong> to import it.</p>
      <ul>
        <li>The template includes a <strong>Categories (reference)</strong> sheet — enter category names exactly as listed. (Add categories first; they're matched by name.)</li>
        <li>The Vendor template also has an <strong>Allowed Values</strong> sheet for vendor type, entity type and GST status.</li>
        <li>Valid rows are created; any skipped rows are listed with the reason so you can fix and re-upload.</li>
      </ul>`,
  },
  {
    id: 'boq-upload',
    title: 'Bulk-add line items with BOQ upload',
    category: 'Procurement',
    icon: 'request_quote',
    summary: 'Import PO/PR line items from Excel.',
    keywords: ['boq', 'bill of quantities', 'line items', 'upload', 'excel', 'import', 'po', 'pr'],
    modules: ['purchase_orders', 'purchase_requisitions'],
    body: `<p>On a new <strong>PO</strong> or <strong>PR</strong>, use <strong>BOQ Template</strong> to download the line-item Excel template, fill it in, then <strong>Upload BOQ</strong>. The rows populate the line-items grid so you can <strong>review and edit before submitting</strong>.</p>`,
  },
  {
    id: 'document-numbering',
    title: 'Customizing PO and PR Numbering',
    category: 'Administration',
    icon: 'pin',
    summary: 'Set up custom prefixes and starting numbers for documents.',
    keywords: ['numbering', 'prefix', 'series', 'po number', 'pr number', 'sequence', 'format'],
    superAdminOnly: true,
    body: `<p>(<strong>ZOPA Super Admin</strong>) When editing a client in <strong>Client Management</strong>, you can configure a custom sequence for their documents.</p>
      <ul>
        <li><strong>Prefix</strong> — The text that appears before the number (e.g., <code>TH/2026-27/</code>). Always ensure you include any necessary separators like a trailing slash or hyphen.</li>
        <li><strong>Starting Series</strong> — The number to start counting from (e.g., <code>1</code> or <code>49</code>).</li>
      </ul>
      <p>The system will combine these to generate the final document numbers (e.g., <code>TH/2026-27/49</code>). Changing this configuration applies to all future documents generated.</p>`,
  },
];
