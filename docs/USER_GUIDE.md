# ZOPA P2P Suite — User Guide

**Version 1.1**  ·  Live at **https://p2p.zopapro.com**

---

## 1. What is ZOPA?

ZOPA P2P Suite is a web-based **Procure-to-Pay (P2P) Management System** that takes a
purchase from the first request all the way to payment, with approvals and a full
audit trail at every step. It is **multi-organization** (one platform serves several
client companies) and **role-based** (what you see and can do depends on your role).

The procurement journey:

```
Requisition (PR) → RFQ/Approval → Purchase Order (PO) → Approval →
Release to Vendor → Goods Receipt (GRN) → Invoice → Approval → Payment
```

---

## 2. Logging In

1. Go to **https://p2p.zopapro.com**.
2. Enter your **email** and **password**.
3. Click **Sign In**.

> The very first administrator account is **webmaster@zopapro.com**. All other
> users are created from inside the system (see *Section 9 — Administration*).

### Forgot your password?
1. On the login page, click **Forgot password?**.
2. Enter your account **email** and submit.
3. You'll receive an email with a **Reset Password** link (valid for **60 minutes**, single-use).
4. Click it, set a new password, and sign in. *(For security, the response is the same whether or not the email is registered.)*

### Your Profile (everyone)
Click your **name/avatar at the bottom-left** of the sidebar to open **My Profile**, where you can:
- Edit your **display name** and **phone number**.
- **Change your password** (this signs you out of all other devices for safety).
- See your **email**, **account type**, and the **organizations & roles** you hold.

---

## 3. Roles — Who Can Do What

Every user has a **role** inside an organization. There are two families:

### ZOPA (internal/platform) roles
| Role | Purpose |
|---|---|
| **ZOPA Super Admin** | Full control of the entire platform — manages clients, staff, and permissions |
| **ZOPA Buyer** | Creates and manages procurement documents (and client master data) on behalf of clients |
| **ZOPA Approver L1 / L2 / L3** | Reviews and approves documents at escalating levels |

### Client (customer organization) roles
| Role | Purpose |
|---|---|
| **Client Admin** | Full control within their own organization |
| **Client Buyer** | Creates and manages PRs, POs, GRNs, Invoices |
| **Client Approver L1 / L2 / L3** | Approves documents at escalating levels |

### Default permissions (per module)
Permissions are **View / Create / Edit / Delete** per module. These defaults can
be changed at any time by the Super Admin (see *Access Control*, Section 9).

| Module | Super Admin | Buyer (ZOPA/Client) | Approvers L1–L3 | Client Admin |
|---|---|---|---|---|
| Requisitions (PR) | Full | View, Create, Edit | View only | Full |
| Purchase Orders | Full | View, Create, Edit | View only | Full |
| Goods Receipt (GRN) | Full | View, Create, Edit | View only | Full |
| Invoices | Full | View, Create, Edit | View only | Full |
| Approvals | Full | Act on assigned | **Act on assigned** | Full |
| Vendors | Full | View (ZOPA buyer: +manage) | View only | Full |
| Products / Categories | Full | View (ZOPA buyer: +manage) | View only | Full |
| Cost Centers & Budget | Full | View (ZOPA buyer: +manage) | View only | Full |
| Org Masters | Full | View (ZOPA buyer: +manage) | View only | Full |
| Reports | Full | View | View | Full |
| Staff Management | Full | — | — | Full |

> **Important:** Buttons (Edit / Delete / Create) appear only if your role is
> allowed. If you don't see a button, your role doesn't permit that action — ask
> your admin to adjust it in **Access Control**.

---

## 4. Navigation (the left sidebar)

| Section | Menu items |
|---|---|
| **Main** | Dashboard · Help & Manual |
| **Procurement** | Requisitions · Purchase Orders · Approvals · Goods Receipt · Invoices · Reports |
| **Master Data** | Vendors · Products · Categories · Cost Centers · Org Masters |
| **Administration** (Client Admin) | Staff Management |
| **Administration** (ZOPA Super Admin only) | ZOPA Dashboard · ZOPA Staff · Client Management · Platform Settings · Access Control · Email Templates |

Menu items you don't have permission to **view** are hidden automatically.

### Switching organization (multi-org users & Super Admins)
If you belong to more than one organization, an **organization switcher** appears at the
top of the sidebar.
- Click it (or press **Ctrl / ⌘ + K**) to open a **searchable picker** — type to filter
  by name; use **↑ / ↓** to move, **Enter** to switch, **Esc** to close. Built to handle
  hundreds of organizations.
- A **context bar** under the top bar always shows **which organization you're working in**
  and whether it's a **Client** or **ZOPA Internal** org — so anything you add (masters,
  documents) clearly belongs to that organization.
- Super Admins can switch into **any** client organization to set it up or act on its behalf.

---

## 5. Dashboards & KPIs

### 5a. Client / Organization Dashboard *(all transactional users)*
Opens on login. Shows your organization's procurement health. It refreshes automatically
when you switch organization.

**Top stat cards (KPIs):**
| KPI | Meaning |
|---|---|
| **Total POs** | All purchase orders in your organization |
| **Pending Approvals** | Documents waiting for **you** to approve (click → goes to Approvals) |
| **Approved** | Count of approved POs |
| **Released / Delivered / Invoiced** | POs at each later stage of the lifecycle |
| **Total PO Value** | Combined ₹ value of purchase orders |

**Budget summary (per Cost Center):**
| Field | Meaning |
|---|---|
| **Annual** | The budget allocated for the cost center |
| **Frozen** | Amount reserved by draft/pending POs |
| **Consumed** | Amount actually spent (approved/released) |
| **Available** | What's left to spend |

**Recent activity:** latest 5 Purchase Orders and latest 10 Requisitions.

**Turnaround (TAT) tables:**
- **PO cycle:** Days to Approve · Days to Release · Total Cycle Days (last 30 POs).
- **PR cycle:** Days to Submit · Days in RFQ-Create · Days in RFQ-Approve · Days to Convert · Total Cycle Days (last 20 PRs).

---

### 5b. ZOPA Admin Dashboard *(Super Admin only)*
A consolidated, cross-organization view. A **searchable organization picker** (top-right)
lets you filter to **All Organizations** or any single one — type to find an org, or use
the keyboard (↑/↓/Enter).

**Headline KPI band:**
| KPI | Meaning |
|---|---|
| **Total POs** | Purchase orders across all organizations |
| **Total PRs** | Requisitions across all organizations |
| **GRNs** | Goods receipts recorded |
| **Invoices** | Invoices in the system |
| **Pending Approvals** | All approvals currently waiting |
| **Total PO Value** | Combined ₹ value of all POs |

**Charts & breakdowns:**
| Widget | What it shows |
|---|---|
| **PO Status Distribution** (donut) | POs split by status: Draft, Pending, Approved, Released, Delivered, Invoiced, Payment Released, Cancelled |
| **Value at a Glance** | PO Value · PR Estimated Value · Invoice Total · Approved PO Value |
| **PO Value by Organization** | Ranks organizations by purchase value |
| **Purchase Orders by Status** | Bar breakdown of every PO status |
| **PR Pipeline** | Draft → Submitted → In RFQ → Converted → Rejected |
| **Invoice Summary** | Total · Pending · Approved · Rejected · Total Value |
| **GRN Summary** | Total · Pending · Confirmed |
| **Organization Overview** (table) | Per organization: POs, PRs, PO Value, Pending Approvals, Active/Inactive |

---

## 6. Master Data (set this up first)

Before creating documents, an Admin sets up the foundation. Menu: **Master Data**.

| Screen | What to add | Notes |
|---|---|---|
| **Org Masters** | Departments, Projects, Locations | Locations capture a full address (see below) |
| **Cost Centers** | Budgets per department/project/location | Set Annual Budget + fiscal year; this enforces spend limits |
| **Categories** | Product categories & sub-categories | Hierarchical (parent → child) |
| **Products** | Catalogue items (name, HSN, GST %, unit, rate) | Speeds up PR/PO line entry |
| **Vendors** | Suppliers (codes, PAN/GST, bank, addresses, documents) | Pincode auto-fills city/state; upload PAN/GST/cheque docs |

**Locations** now record structured address fields: **Address, City, State, State Code,
Pincode, Country**, plus **GSTIN**. These flow into the **Bill-to** and **Ship-to** blocks
printed on the PO (and the PR's delivery location).

### Bulk upload (Products & Vendors)
On the **Products** and **Vendors** lists, Admins (and ZOPA Buyers) get two buttons:
- **Template** — downloads a ready-to-fill Excel workbook. It includes a **"Categories
  (reference)"** sheet listing your existing categories so you enter valid names. The
  Vendor template also has an **"Allowed Values"** sheet (vendor type, entity type, GST status).
- **Bulk Upload** — upload the filled-in file. Valid rows are created; any skipped rows are
  listed with the reason so you can fix and re-upload.

> Add **Categories** manually first — products/vendors reference categories **by name**.

**Approval rules:** Inside each **Cost Center**, configure **Approval Configs** —
which user(s) approve at L1/L2/L3, and optional **amount limits** (e.g., POs over
₹1,00,000 also need L2). You can set separate chains for **PR**, **PO**, and **Invoice**.
The **highest level you configure is the final approver** — if you set only L1, L1 is final;
amount limits only **add** higher levels, they never leave a document stuck waiting for a
level you didn't configure (see *Section 7c*).

---

## 7. The Procurement Workflow (step by step)

### 7a. Purchase Requisition (PR) — "I need to buy something"
1. **Requisitions → New Requisition**.
2. Fill title, cost center, project/location, priority, required-by date.
3. Add **line items** (description, qty, unit, estimated price) — or use **BOQ upload** (below).
4. **Save as Draft**, then **Submit**.
5. If an approval chain exists, the PR routes to approvers; otherwise it's ready to convert.
6. A PR can be **converted to one or more POs** (full or partial — the system tracks converted quantity).

Selecting a **Delivery Location** shows its full address inline.

PR statuses: *Draft → Submitted → (RFQ Created → RFQ Approved) → Converted / Partially Converted → Rejected.*

### 7b. Purchase Order (PO) — "Order it from the vendor"
1. **Purchase Orders → New Purchase Order** (or convert from a PR).
2. Choose **vendor**, **vendor address**, **cost center**, **Bill-to** and **Ship-to** locations, validity date.
   - As you pick Bill-to / Ship-to, a **preview shows the exact address that will print** on the PO.
3. Add line items (auto-fills from products) — or use **BOQ upload** (below). The system computes
   **GST** (IGST vs CGST+SGST based on locations) and totals.
4. Add **payment terms**, **freight**, **terms & conditions** (an AI helper can suggest terms).
5. **Submit** → routes through the PO approval chain (respecting amount limits).
6. On final approval, the PO gets a **PO number** and can be **Released**.
7. **On Release the PO is automatically emailed to the vendor** (with the PO PDF). Use the
   **Send to Vendor** button to (re-)send it, e.g. after adding the vendor's email.
8. Download the **PO PDF** anytime (shows preparer & approver names, and full Bill-to/Ship-to).

PO statuses: *Draft → Pending L1/L2/L3 → Approved → Released → Delivered → Invoiced → Payment Released* (or *Cancelled*).

### BOQ bulk upload (PO & PR line items)
On a new PO or PR, use **BOQ Template** to download the line-item Excel template, fill it in,
then **Upload BOQ**. The rows populate the line-items grid so you can **review and edit before
submitting**. (PO columns: Description, HSN, Qty, Unit, Net Rate, GST Rate, Required By,
Warranty Months. PR columns: Description, Qty, Unit, Estimated Price, Remarks.)

### 7c. Approvals — "Review and decide"
Two ways to approve:

**In the app:** **Approvals** menu → see items assigned to you → open → **Approve**,
**Return for Revision** (with a query), or **Reject** (with a reason).

**Straight from email (no login needed):** when a document reaches your level you
get an email containing the **full line-item details + a PDF**, and two buttons:
- **✓ Approve** — one click approves it.
- **✗ Reject** — opens a short form to enter a reason.

These email links are unique to you, **single-use**, and expire in **72 hours**.

**How finalization works:** the **highest configured level that the document's amount
requires** is the final approver. So if a cost center only has L1, approving at L1 completes
it; if it has L1 + L2 and the amount is within L1's limit, L1 completes it. Approving the top
required level advances the document automatically; **Reject** or **Return** notifies the
originator by email with the remarks.

### 7d. Goods Receipt (GRN) — "The goods arrived"
1. **Goods Receipt → New GRN**.
2. Pick a released/approved **PO** (fully-received POs are hidden).
3. Enter **received quantity** per line (partial receipts allowed — record multiple GRNs over time).
4. **Save.** When all lines are fully received, the PO is automatically marked **Delivered**.

### 7e. Invoices — "Pay the vendor"
1. **Invoices → New Invoice**.
2. Link the **PO** (and optionally a GRN), enter invoice number, date, amount, freight, type (Regular / Advance / Proforma).
3. **Submit** → routes through the Invoice approval chain.
4. On approval, the PO moves to **Invoiced**; payment release follows.

### 7f. Reports
**Reports → TAT Reports**: turnaround-time analytics across the PR→PO→Approval→
Release→Delivery→Invoice journey. Filter by **date range** and **cost center**;
**Export to CSV or PDF**.

---

## 8. Email Notifications (summary)

| Event | Who is emailed | Contains |
|---|---|---|
| Document reaches an approver's level | The assigned approver(s) | Line items, PDF, one-click Approve/Reject |
| Document approved (final) | The originator | Confirmation + PDF |
| Document rejected | The originator | Reason/remarks |
| Document returned for revision | The originator | The reviewer's query |
| **PO released / "Send to Vendor"** | **The vendor** | Vendor-facing summary (see below) + full PO PDF |
| **Forgot password** | The requesting user | One-time reset link (60-minute expiry) |

**The vendor PO email is written for the vendor**, showing: **Issued By** (your organization +
GSTIN), **PO Date**, **Needed By** (earliest required-by date on the order), **Valid Till**,
the amounts, **Bill To / Ship To** addresses, the line items, and the attached PO PDF. (Internal
fields such as cost center are not shown to vendors.)

> Approval/status emails are **transactional** — sent to known users as a result of in-app
> actions. The vendor PO email goes to the email on the vendor's record.

---

## 9. Administration

### 9a. Client Admin — Staff Management
**Administration → Staff Management**: add users to your organization and assign
their role (Buyer, Approver L1/L2/L3). Deactivate users who leave. Re-adding someone you
previously removed simply **reactivates** their access (no "email already exists" error).

### 9b. ZOPA Super Admin — Platform Administration
| Screen | What you do |
|---|---|
| **ZOPA Dashboard** | Cross-organization KPIs (see 5b) |
| **Client Management** | Create client organizations; add client users; assign ZOPA staff to a client; change roles; deactivate |
| **ZOPA Staff** | Create/manage internal ZOPA staff accounts |
| **Platform Settings** | Upload the parent-company logo (used in PDFs & as header fallback) |
| **Access Control** | **The permission matrix** — see below |
| **Email Templates** | Preview every system email (Password Reset, PO Issued to Vendor, Approval Request, Status Update) rendered with sample data |

### 9c. Access Control (Super Admin) — fine-grained permissions
**Administration → Access Control**. For **each role**, toggle **View / Create /
Edit / Delete** for **every module**. Changes take effect immediately for all
users holding that role.

- **Super Admin is always unrestricted** (cannot be limited).
- Turning **off View** for a module hides its menu and blocks access entirely.
- Turning **off Create/Edit/Delete** hides those buttons and blocks the action on the server (it's enforced both in the screen and the API — not just hidden).

Example: To stop *Client Buyers* from deleting Purchase Orders, open Access
Control → **Client Buyer** tab → **Purchase Orders** row → turn **Delete** off → **Save**.

---

## 10. Tips & FAQ

- **"I forgot my password."** Use **Forgot password?** on the login page — you'll get a reset link (valid 60 minutes).
- **"How do I switch organization?"** Use the switcher at the top of the sidebar, or press **Ctrl / ⌘ + K** and search. The context bar shows which org you're currently in.
- **"Which organization am I adding this to?"** Check the **context bar** under the top bar — it names the active org and whether it's a Client or ZOPA Internal org.
- **"Can I add many products/vendors at once?"** Yes — use **Template → Bulk Upload** on the Products/Vendors lists. Add categories first; the template lists valid category names.
- **"Can I import PO/PR line items?"** Yes — **BOQ Template → Upload BOQ** on the create form fills the line items for you to review.
- **"The vendor didn't get the PO."** Check the vendor record has an **email**, then use **Send to Vendor** on the PO.
- **"I can't see a menu / button."** Your role lacks that permission. Ask your admin to enable it in **Access Control** (Super Admin) or check your assigned role.
- **"My document isn't moving."** It's probably waiting in **Approvals** for someone at the next level. Check the document's activity timeline (every action shows *who* did *what* and *when*).
- **"Budget says not enough available."** A draft/pending PO has *frozen* part of the budget, or it's truly consumed — review the Cost Center budget ledger.
- **Every action is logged.** Each PR/PO shows a full **activity timeline** with the user's name, action, time, and any comments — useful for audits.
- **PDFs** show the **preparer** and **approver** names on the signature block, plus full Bill-to/Ship-to addresses.

---

*For access changes or new accounts, contact your organization's Admin, or the
ZOPA Super Admin (webmaster@zopapro.com).*
