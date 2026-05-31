# ZOPA Procurement Suite — User Guide

**Version 1.0**  ·  Live at **https://p2p.zopapro.com**

---

## 1. What is ZOPA?

ZOPA is a web-based **Procurement Management System** that takes a purchase from
the first request all the way to payment, with approvals and a full audit trail
at every step. It is **multi-organization** (one platform serves several client
companies) and **role-based** (what you see and can do depends on your role).

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
| **ZOPA Buyer** | Creates and manages procurement documents on behalf of clients |
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
| Products / Categories | Full | View only | View only | Full |
| Cost Centers & Budget | Full | View only | View only | Full |
| Org Masters | Full | View only | View only | Full |
| Reports | Full | View | View | Full |
| Staff Management | Full | — | — | Full |

> **Important:** Buttons (Edit / Delete / Create) appear only if your role is
> allowed. If you don't see a button, your role doesn't permit that action — ask
> your admin to adjust it in **Access Control**.

---

## 4. Navigation (the left sidebar)

| Section | Menu items |
|---|---|
| **Main** | Dashboard |
| **Procurement** | Requisitions · Purchase Orders · Approvals · Goods Receipt · Invoices · Reports |
| **Master Data** | Vendors · Products · Categories · Cost Centers · Org Masters |
| **Administration** (Client Admin) | Staff Management |
| **Administration** (ZOPA Super Admin only) | ZOPA Dashboard · ZOPA Staff · Client Management · Platform Settings · Access Control |

Menu items you don't have permission to **view** are hidden automatically.

---

## 5. Dashboards & KPIs

### 5a. Client / Organization Dashboard *(all transactional users)*
Opens on login. Shows your organization's procurement health.

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
A consolidated, cross-organization view. A dropdown lets you filter to **All Organizations** or a single one.

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
| **Org Masters** | Departments, Projects, Locations | Used on PRs/POs for tagging & GST |
| **Cost Centers** | Budgets per department/project/location | Set Annual Budget + fiscal year; this is what enforces spend limits |
| **Categories** | Product categories & sub-categories | Hierarchical |
| **Products** | Catalogue items (name, HSN, GST %, unit, rate) | Speeds up PR/PO line entry |
| **Vendors** | Suppliers (codes, PAN/GST, bank, addresses, documents) | Pincode auto-fills city/state; upload PAN/GST/cheque docs |

**Approval rules:** Inside each **Cost Center**, configure **Approval Configs** —
which user(s) approve at L1/L2/L3, and optional **amount limits** (e.g., POs over
₹1,00,000 also need L2). You can set separate chains for **PR**, **PO**, and **Invoice**.

---

## 7. The Procurement Workflow (step by step)

### 7a. Purchase Requisition (PR) — "I need to buy something"
1. **Requisitions → New Requisition**.
2. Fill title, cost center, project/location, priority, required-by date.
3. Add **line items** (description, qty, unit, estimated price).
4. **Save as Draft**, then **Submit**.
5. If an approval chain exists, the PR routes to approvers; otherwise it's ready to convert.
6. A PR can be **converted to one or more POs** (full or partial — the system tracks converted quantity).

PR statuses: *Draft → Submitted → (RFQ Created → RFQ Approved) → Converted / Partially Converted → Rejected.*

### 7b. Purchase Order (PO) — "Order it from the vendor"
1. **Purchase Orders → New Purchase Order** (or convert from a PR).
2. Choose **vendor**, **vendor address**, **cost center**, validity date.
3. Add line items (auto-fills from products); the system computes **GST** (IGST vs CGST+SGST based on locations) and totals.
4. Add **payment terms**, **freight**, **terms & conditions** (an AI helper can suggest terms).
5. **Submit** → routes through the PO approval chain (respecting amount limits).
6. On final approval, the PO gets a **PO number** and can be **Released** to the vendor.
7. Download the **PO PDF** (shows preparer & approver names) and email it to the vendor.

PO statuses: *Draft → Pending L1/L2/L3 → Approved → Released → Delivered → Invoiced → Payment Released* (or *Cancelled*).

### 7c. Approvals — "Review and decide"
Two ways to approve:

**In the app:** **Approvals** menu → see items assigned to you → open → **Approve**, **Return for Revision** (with a query), or **Reject** (with a reason).

**Straight from email (no login needed):** when a document reaches your level you
get an email containing the **full line-item details + a PDF**, and two buttons:
- **✓ Approve** — one click approves it.
- **✗ Reject** — opens a short form to enter a reason.

These email links are unique to you, **single-use**, and expire in **72 hours**.

When approved at the final level, the document advances automatically. When
rejected or returned, the **originator is notified by email** with the remarks.

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

> Emails are **transactional only** — sent to known users as a result of in-app actions.

---

## 9. Administration

### 9a. Client Admin — Staff Management
**Administration → Staff Management**: add users to your organization and assign
their role (Buyer, Approver L1/L2/L3). Deactivate users who leave.

### 9b. ZOPA Super Admin — Platform Administration
| Screen | What you do |
|---|---|
| **ZOPA Dashboard** | Cross-organization KPIs (see 5b) |
| **Client Management** | Create client organizations; add client users; assign ZOPA staff to a client; change roles; deactivate |
| **ZOPA Staff** | Create/manage internal ZOPA staff accounts |
| **Platform Settings** | Upload the parent-company logo (used in PDFs & as header fallback) |
| **Access Control** | **The permission matrix** — see below |

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

- **"I can't see a menu / button."** Your role lacks that permission. Ask your admin to enable it in **Access Control** (Super Admin) or check your assigned role.
- **"My document isn't moving."** It's probably waiting in **Approvals** for someone at the next level. Check the document's activity timeline (every action shows *who* did *what* and *when*).
- **"Budget says not enough available."** A draft/pending PO has *frozen* part of the budget, or it's truly consumed — review the Cost Center budget ledger.
- **Every action is logged.** Each PR/PO shows a full **activity timeline** with the user's name, action, time, and any comments — useful for audits.
- **PDFs** show the **preparer** and **approver** names on the signature block.

---

*For access changes or new accounts, contact your organization's Admin, or the
ZOPA Super Admin (webmaster@zopapro.com).*
