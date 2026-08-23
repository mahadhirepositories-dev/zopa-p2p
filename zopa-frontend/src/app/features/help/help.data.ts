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
  sourcing:              { label: 'Sourcing',        icon: 'travel_explore' },
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
        <li><strong>Buyer</strong> — creates and edits requisitions, POs, GRNs, invoices. <em>(Note: Buyers can only edit documents while they are in <strong>Draft</strong> status)</em>.</li>
        <li><strong>PR User</strong> — restricted specifically to creating and viewing Purchase Requisitions.</li>
        <li><strong>GRN User</strong> — restricted specifically to creating and viewing Goods Receipt Notes (GRNs).</li>
        <li><strong>Approver (L1/L2/L3)</strong> — reviews and approves documents. <em>(Note: Approvers cannot edit documents; they can only approve or reject them)</em>.</li>
        <li><strong>Admin</strong> — full control within the organization.</li>
        <li><strong>ZOPA Super Admin</strong> — manages the whole platform.</li>
      </ul>
      <p>Each role has <strong>View / Create / Edit / Delete</strong> permission per module. If a button or menu is missing, your role doesn't allow that action — ask your admin to adjust it in <em>Access Control</em>.</p>`,
  },
  {
    id: 'editing-immutability',
    title: 'Document Editing & Immutability',
    category: 'Getting Started',
    icon: 'lock',
    summary: 'When you can edit documents and why submitted ones are locked.',
    keywords: ['edit', 'immutable', 'lock', 'snapshot', 'change', 'mistake', 'fix', 'reject'],
    body: `<h3>Drafts are Editable</h3>
      <p>While a PR or PO is in <strong>Draft</strong> status, the <strong>Buyer</strong> who created it can freely edit quantities, prices, and line items.</p>
      <h3>Submitted Documents are Locked (Immutable)</h3>
      <p>For financial compliance and auditing, once a PR or PO is submitted for approval, it becomes <strong>locked and immutable</strong>.</p>
      <ul>
        <li><strong>Master Data Snapshot:</strong> The exact product name, description, and HSN code at the time of creation are "snapshotted" into the document. If an Admin changes the product master data later, historical POs will not change.</li>
        <li><strong>Approvers Cannot Edit:</strong> To maintain strict segregation of duties, Approvers cannot edit line items or prices. They can only Approve or Reject.</li>
        <li><strong>Fixing Mistakes:</strong> If a submitted document has an error, you must ask your Approver to <strong>Reject</strong> it. You can then correct the rejected document (if applicable) or create a new one.</li>
      </ul>`,
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
  // ── Procurement ───────────────────────────────────────────────────────────
  {
    id: 'create-pr',
    title: 'Create & Manage Purchase Requisitions (PR)',
    category: 'Procurement',
    icon: 'description',
    summary: 'Request items, request clarifications, and manage PR short-closing.',
    keywords: ['pr', 'requisition', 'request', 'create', 'new', 'clarification', 'short close'],
    modules: ['purchase_requisitions'],
    body: `<ol>
        <li>Go to <strong>Requisitions → New Requisition</strong>.</li>
        <li>Select title, cost center, project/location, priority, and required-by date.</li>
        <li>Add <strong>line items</strong>: description, quantity, unit, and estimated price.</li>
        <li><strong>Save as Draft</strong>, then <strong>Submit for Procurement</strong>.</li>
      </ol>
      <p><strong>PR Needs Clarification Workflow:</strong></p>
      <ul>
        <li>If a Buyer finds missing specifications or details, they click <strong>Request Clarification</strong>. The PR moves to <em>Needs Clarification</em> (Amber Badge) and standard PR TAT processing calculation <strong>pauses</strong>.</li>
        <li>The Requester receives a notification banner <code>⚠️ Action Required: Clarification Requested</code> and clicks <strong>Provide Clarification</strong> to post response notes and edit line items, resuming PR processing.</li>
      </ul>
      <p><strong>PR Short-Close:</strong> If a PR is partially converted into POs and remaining items are no longer required, click <strong>Short Close PR</strong> to transition status to <em>Converted &amp; Short Closed</em>.</p>
      <p><strong>Statuses:</strong> Draft → Submitted → Needs Clarification → (RFQ Created → RFQ Approved) → Converted / Partially Converted → Short Closed / Rejected.</p>`,
  },
  {
    id: 'pr-clarification-workflow',
    title: 'PR Clarification & TAT Pause Workflow',
    category: 'Procurement',
    icon: 'help_outline',
    summary: 'How buyers request clarification and requesters respond with TAT pause calculation.',
    keywords: ['pr clarification', 'need clarification', 'tat pause', 'missing info', 'query', 'response'],
    modules: ['purchase_requisitions'],
    body: `<p>When clients or requesters submit PRs with incomplete or ambiguous specifications, Buyers can request clarification without hurting PR-to-PO Turnaround Time (TAT) metrics.</p>
      <ol>
        <li><strong>Buyer Requests Clarification:</strong> Click <strong>Request Clarification</strong> on a submitted PR and type query notes. The PR status changes to <em>Needs Clarification</em> and standard PR processing TAT is <strong>paused</strong>.</li>
        <li><strong>Requester Responds:</strong> The Requester or Creator sees the amber alert banner and clicks <strong>Provide Clarification</strong> or <strong>Edit PR</strong>. They input resolution notes, update item specs, and click <strong>Submit Response</strong>.</li>
        <li><strong>TAT Calculation Adjustment:</strong> The system automatically calculates clarification pause duration (<code>provided_at - requested_at</code>) and subtracts it from PR-to-PO TAT.</li>
        <li><strong>Clarification TAT KPI:</strong> The Executive Dashboard tracks <strong>PR Clarification TAT</strong> (average hours taken to resolve queries) as a dedicated performance metric.</li>
      </ol>`,
  },
  {
    id: 'create-po',
    title: 'Create a Purchase Order & Mark Delivery',
    category: 'Procurement',
    icon: 'receipt_long',
    summary: 'Place orders with vendors and punch delivery status updates.',
    keywords: ['po', 'purchase order', 'create', 'vendor', 'order', 'delivery', 'mark delivered', 'gst'],
    modules: ['purchase_orders'],
    body: `<ol>
        <li>Go to <strong>Purchase Orders → New Purchase Order</strong> (or click <strong>Convert to PO</strong> from an approved PR).</li>
        <li>Choose vendor, cost center, Bill-to and Ship-to locations — a preview shows the exact address printed on the PO.</li>
        <li>Add line items — GST (IGST vs CGST+SGST) and grand total calculate automatically.</li>
        <li>Add payment terms (must total 100%) and freight details.</li>
        <li><strong>Submit</strong> — routes through L1/L2/L3 approval workflows.</li>
      </ol>
      <p><strong>Delivery Status Punching:</strong></p>
      <ul>
        <li>Once a PO is released and vendor delivers goods, Buyers click <strong>Partially Delivered</strong> or <strong>Mark Delivered</strong> on the PO detail view.</li>
        <li>Comment fields reset blank on every modal invocation so previous notes never persist.</li>
        <li>Punching delivery records the <em>Delivery Marked Date (Vendor Word)</em> and enables the <strong>Mark GRN</strong> option for stores.</li>
      </ul>
      <p><strong>Statuses:</strong> Draft → Pending L1/L2/L3 → Approved → Released → Partially Delivered / Delivered → Invoiced → Payment Released (or Cancelled).</p>`,
  },
  {
    id: 'grn',
    title: 'Record & Verify Goods Receipt (GRN)',
    category: 'Procurement',
    icon: 'inventory_2',
    summary: 'Strict GRN gating, physical item verification, overflow warnings, and auto-completion.',
    keywords: ['grn', 'goods receipt', 'received qty', 'rejection reason', 'date constraint', 'gating', 'toast'],
    modules: ['grns'],
    body: `<p>Store and Site Engineers perform physical item verification and log Goods Receipt Notes (GRNs):</p>
      <ol>
        <li><strong>GRN Creation Gating:</strong> The <strong>Mark GRN</strong> button is strictly gated and only appears <em>after</em> delivery status has been punched on the PO.</li>
        <li><strong>Delivery Marked Date:</strong> The Create GRN page displays a read-only <em>Delivery Marked Date (Vendor Word)</em> header auto-populated from vendor delivery punching.</li>
        <li><strong>Max Date Limits:</strong> <em>Received Date</em> and <em>DC Date</em> are strictly capped to <strong>Today's Date</strong> (future dates disabled).</li>
        <li><strong>Quantity Overflow Error Toasts:</strong> Entering a received or accepted quantity greater than available PO item remaining quantity triggers a real-time error toast: <code>❌ Cannot receive/accept more than remaining quantity</code>.</li>
        <li><strong>Rejection Reason Selection:</strong> If items are rejected, store officers must select a valid reason from the dropdown (<em>Damaged</em>, <em>Not as per specification</em>, <em>Others</em>).</li>
        <li><strong>Automated Completion:</strong> Displays <em>Partial GRN Captured</em> vs <em>GRN Captured</em> badges. Once all PO items are fully accepted across confirmed GRNs, the PO automatically transitions to <strong>✓ Delivered &amp; GRN Captured</strong>.</li>
      </ol>`,
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
  {
    id: 'sourcing-overview',
    title: 'Sourcing & Price Discovery Workbench (ZOPA Buyers)',
    category: 'Procurement',
    icon: 'travel_explore',
    summary: 'Discover vendors, record quotations, and resolve uncatalogued PR items across all client organizations.',
    keywords: ['sourcing', 'price discovery', 'vendor quote', 'typo', 'master match', 'rfq', 'uncatalogued', 'call log', 'buyer', 'promote'],
    modules: ['sourcing'],
    body: `<p>The <strong>Sourcing &amp; Price Discovery Workbench</strong> is a specialized tool designed exclusively for ZOPA internal buyers to discover vendors, record multi-supplier quotations, and manage price negotiations across all client organizations.</p>
      <p><strong>Key Features &amp; Workflows:</strong></p>
      <ul>
        <li><strong>Automatic Uncatalogued PR Stream:</strong> Any PR line item submitted without an existing master catalog product (<code>product_id = null</code>) automatically streams into the <em>Uncatalogued PR Items</em> tab. Buyers no longer need to manually search and push PR items one by one.</li>
        <li><strong>Smart Typo &amp; Fuzzy Master Matching:</strong> When requesters make spelling errors or write variations in free-text fields (e.g. <code>Mous</code> instead of <code>Mouse</code>, <code>Paracetmol 500</code> instead of <code>Paracetamol 500mg</code>), the system automatically performs fuzzy string matching against the <strong>Product Master</strong>.
          <ul>
            <li>Displays match confidence (e.g. <code>91% Match: Optical Mouse USB</code>).</li>
            <li>Click <strong>Map &amp; Resolve Typo</strong> to link the PR item directly to the master product with 1-click, updating standard rates and removing it from Sourcing.</li>
          </ul>
        </li>
        <li><strong>Direct Sourcing Entry:</strong> Create standalone sourcing requests with item specifications, required quantities, target budget price, and RFQ references.</li>
        <li><strong>Multiple Vendor Contacts &amp; Quotations:</strong> Any ZOPA buyer can add multiple vendor quotes per item (Company name, contact person, phone, email, quoted price, GST %, lead time in days, payment terms, and notes). The best quoted price is automatically highlighted.</li>
        <li><strong>Working Remarks &amp; Call Logs:</strong> Real-time chronological timeline where any buyer can log vendor phone calls, negotiation notes, and pricing updates.</li>
        <li><strong>Promote to Product Master:</strong> Once a genuine new item is sourced and quotes are finalized, buyers can click <strong>Promote to Product Master</strong> with 1-click to permanently add the item and rate to the master catalog for future requisitions.</li>
      </ul>`,
  },
  {
    id: 'pr-vs-sourcing',
    title: 'Requisitions (PR) vs Sourcing — Catalogued vs Custom Items',
    category: 'Procurement',
    icon: 'hub',
    summary: 'How catalogued items use pre-approved vendor pricing while uncatalogued items route to Sourcing.',
    keywords: ['pr', 'sourcing', 'catalog', 'master', 'custom item', 'free text', 'pricing'],
    modules: ['purchase_requisitions', 'sourcing'],
    body: `<p>Understanding how item selection in Requisitions connects to Sourcing:</p>
      <ol>
        <li><strong>Catalogued Master Items:</strong> When a requester selects an item from the Product Master dropdown, it already has an approved rate, HSN code, and established vendors. These items proceed directly to standard RFQ/PO generation and <em>do not require sourcing</em>.</li>
        <li><strong>Uncatalogued / Custom Free-Text Items:</strong> When an item is not in the catalog, the requester types into the description field. These items are uncatalogued and automatically flow to the <strong>Sourcing Workbench</strong> for ZOPA buyers to discover suppliers and negotiate prices.</li>
        <li><strong>Catalog Deduplication:</strong> If a custom item was typed due to a typo or spelling difference, ZOPA buyers can resolve it with 1-click via <strong>Map &amp; Resolve Typo</strong>, keeping the catalog clean and avoiding redundant negotiations.</li>
      </ol>`,
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
    title: 'Executive Summary Dashboard & Organization Data Privacy',
    category: 'Dashboards & Reports',
    icon: 'dashboard',
    summary: 'Understanding Executive KPIs and strict organization data isolation.',
    keywords: ['dashboard', 'kpi', 'stats', 'budget', 'executive', 'privacy', 'tenant', 'isolation'],
    body: `<p>The Executive Summary Dashboard provides real-time procurement health and risk metrics tailored to your role:</p>
      <p><strong>🔒 Strict Organization Data Isolation:</strong></p>
      <ul>
        <li><strong>Organization Data Privacy Guarantee:</strong> All document records (PRs, POs, GRNs, Invoices), budgets, cost centers, and report analytics are strictly isolated per Organization (<code>tenant_id</code>).</li>
        <li><strong>Organization Users:</strong> Organization Admins, Buyers, Requesters, and Approvers exclusively view their own Organization's Executive Summary Dashboard. Non-associated organization data is strictly inaccessible.</li>
        <li><strong>ZOPA Super Admins:</strong> Only platform Super Admins can access cross-organization aggregate stats or use the Organization Switcher picker.</li>
      </ul>
      <p><strong>18 Executive KPIs Tracked:</strong></p>
      <ul>
        <li><strong>Headline Volume &amp; Spend:</strong> Orders Processed, Total Value Managed, Active Vendors, Categories Handled, Projects &amp; Locations Served.</li>
        <li><strong>Savings Realized:</strong> Total Savings Realized &amp; Average Savings % against PR budgets.</li>
        <li><strong>Turnaround (TAT) Analytics:</strong> PR Net TAT (excluding clarification pauses), Dedicated <strong>PR Clarification TAT</strong> (hours taken to respond to missing info queries), and PO Issue TAT.</li>
        <li><strong>Risk &amp; Outage Metrics:</strong> PR TAT distribution (1d, 3d, 7d, 7d+), Max TAT case trace, Risk Delay Mapping (Approvals, Vendor Release, GRN Lead Times), and Medicine/Lab Outage Rates.</li>
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
  {
    id: 'export-data',
    title: 'Export Data to Excel',
    category: 'Dashboards & Reports',
    icon: 'file_download',
    summary: 'Download lists as Excel spreadsheets.',
    keywords: ['export', 'excel', 'csv', 'download', 'spreadsheet', 'data', 'reports'],
    body: `<p>You can export data from almost any list view in the system, including <strong>Requisitions, Purchase Orders, Approvals, Goods Receipts, Invoices, Vendors, Products, and Categories</strong>.</p>
      <ol>
        <li>Navigate to the relevant list screen.</li>
        <li>Click the <strong>Export</strong> button near the search bar.</li>
        <li>An Excel file (<code>.xlsx</code>) will be generated and downloaded to your computer containing the current data.</li>
      </ol>
      <p>This is useful for offline analysis or sharing data outside the system.</p>`,
  },
  {
    id: 'draft-visibility',
    title: 'Draft Document Visibility',
    category: 'Approvals',
    icon: 'visibility_off',
    summary: 'Understanding who can see Draft PRs and POs.',
    keywords: ['draft', 'visibility', 'hidden', 'approver', 'buyer', 'see', 'access'],
    body: `<p>Documents in <strong>Draft</strong> status are works-in-progress. To keep workflows clean, their visibility is restricted based on your role permissions.</p>
      <ul>
        <li><strong>Buyers & Creators</strong> — can see Draft documents so they can continue working on them.</li>
        <li><strong>Approvers (without Create/Edit permissions)</strong> — <em>cannot</em> see Draft documents in the list. They will only see the document once it is submitted and officially enters the approval workflow.</li>
      </ul>
      <p>If you are an Approver and need to see drafts, contact your administrator to adjust your role's Access Control permissions.</p>`,
  },
  {
    id: 'product-auto-code',
    title: 'Product Auto-Coding & Cataloguing',
    category: 'Master Data',
    icon: 'pin',
    summary: 'How product codes are automatically generated using organization prefixes.',
    keywords: ['product', 'catalog', 'code', 'auto', 'generate', 'prefix', 'series'],
    modules: ['products'],
    body: `<p>When creating a new product in the Product Master, you can leave the **Product Code** field blank to let the system generate it automatically.</p>
      <ul>
        <li><strong>Organization Prefix</strong> — The system uses the <code>product_prefix</code> configured by the Administrator (e.g., <code>PRD-</code> or <code>ZP-</code>).</li>
        <li><strong>Incrementing Series</strong> — It appends a zero-padded running counter (e.g., <code>0001</code>) that increments atomically with each new product.</li>
        <li><strong>Custom Code</strong> — You can still type a custom product code manually to override the auto-generation.</li>
      </ul>
      <p>Admins can configure the prefix and start counter under **Client Management** in the administration settings.</p>`,
  },
  {
    id: 'vendor-compliance',
    title: 'Vendor Compliance & Special Status',
    category: 'Master Data',
    icon: 'verified',
    summary: 'MSME registration, document requirements, and upload safety.',
    keywords: ['vendor', 'msme', 'compliance', 'duplicate', 'upload', 'phone', 'history', 'timeline'],
    modules: ['vendors'],
    body: `<p>Maintaining clean vendor master data is essential for smooth procurement audits. ZOPA now includes stricter compliance checks:</p>
      <ul>
        <li><strong>Special Status (MSME)</strong> — When marking a vendor with a special status (such as MSME or SC/ST), you must provide their registration number and registration start date. Use the **No End Date** checkbox if the registration is valid indefinitely.</li>
        <li><strong>Duplicate File Prevention</strong> — The system checks the file name of all uploaded vendor documents (PAN, GST, Cancelled Cheque). You cannot upload the exact same file name twice. Delete the old version first if you need to upload a replacement.</li>
        <li><strong>Phone Number Validation</strong> — Vendor phone numbers require a country code prefix (e.g., <code>+91</code>) to ensure correct routing.</li>
        <li><strong>Change Audit Log</strong> — Open any vendor details screen to see a chronological **Activity Log Timeline** detailing who changed what field (e.g., from old bank account to new).</li>
      </ul>`,
  },
  {
    id: 'cost-center-enhancements',
    title: 'Cost Center & Budget Setup Enhancements',
    category: 'Master Data',
    icon: 'account_balance_wallet',
    summary: 'Budget dates validation, user assignments, and multi-location support.',
    keywords: ['cost center', 'budget', 'dates', 'valid', 'user', 'location', 'assign'],
    modules: ['cost_centers'],
    adminOnly: true,
    body: `<p>Cost Center managers now have more control over budget windows and visibility:</p>
      <ul>
        <li><strong>Budget Dates Validation</strong> — The system ensures the Budget To (end) date is always after or equal to the Budget From (start) date, using calendar date pickers. If dates are invalid, saving is blocked and an inline warning appears.</li>
        <li><strong>Multi-Location Cost Center</strong> — You can associate a single cost center with multiple delivery locations. Requisition (PR) forms automatically filter delivery locations based on the chosen cost center.</li>
        <li><strong>User Assignments</strong> — Restrict cost center access to specified users. Only assigned users can raise transactions or view details for that cost center.</li>
      </ul>`,
  },
];
