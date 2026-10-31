# ZOPA P2P Suite — Comprehensive Feature Matrix & Capabilities Specification

**Platform URL:** [https://p2p.zopapro.com](https://p2p.zopapro.com)  
**Architecture:** Multi-Tenant Enterprise SaaS (Angular 19 + TypeScript Frontend, Laravel 11 REST API, MySQL 8, DomPDF / Snappy / WkHtmlToPdf Engine)

---

## 1. Executive Platform Architecture & Core Foundation

```
[ Requisition (PR) ] ──► [ Sourcing & RFQ Workbench ] ──► [ Purchase Order (PO) ]
                                                                 │
                                                       [ L1–L3 Approvals ]
                                                                 │
[ Invoice & Payment ] ◄── [ 3-Way Match ] ◄── [ Goods Receipt (GRN) ] ◄── [ Vendor Release ]
```

### 1.1. Multi-Tenant Enterprise Isolation
* **Strict Tenant Scoping:** Complete data, transactional, and master-record isolation across multiple legal entities, subsidiaries, academic institutions, and trusts (e.g., Total Health, Apollo Vidhyalayam, Aragonda Vikas Trust, Apollo Isha Vidhya Niketan).
* **Cross-Tenant Context Switcher:** Quick switcher keyboard shortcut (`Ctrl + K` or `⌘ + K`) with real-time searchable organization modal. Supports multi-org users and Super Admins seamlessly.
* **Custom Prefix & Numbering Sequences:** Independent sequential numbering configuration per organization for PRs (`PR-`, `AVTPR`, etc.), POs (`TH/2026-27/`, `AV/2026-27/`, `AVT2026-27`), and Products.
* **Tenant-Specific Branding & Settings:** Individual organization letterhead logos, tax profiles, GSTINs, and default billing/shipping locations.

### 1.2. Role-Based Access Control (RBAC) & Security
* **Granular Permission Matrix:** Per-module **View**, **Create**, **Edit**, and **Delete** controls configured dynamically from the Super Admin panel.
* **Supported Platform Roles:**
  * **ZOPA Super Admin:** Unrestricted cross-organization management, client provisioning, database backups, audit oversight, and global system configuration.
  * **ZOPA Buyer / Transact Staff:** Internal procurement officers operating on behalf of one or more client entities.
  * **Client Admin:** Departmental oversight, organization user provisioning, cost center budgeting, and local approvals.
  * **Client Buyer:** Requisition raising, RFQ tracking, PO drafting, and delivery follow-up.
  * **Approvers (L1, L2, L3):** Value-threshold and department-based authorization officers.
* **Sanctum Authentication & Session Hardening:** Secure token-based session lifecycle, bcrypt password hashing (cost factor 12), single-use 60-minute password reset links, and device revocation on password update.

---

## 2. Procure-to-Pay (P2P) Lifecycle Modules

### 2.1. Purchase Requisitions (PR)
* **Guided PR Creation:** Structured requisition forms capturing Title, Department, Project, Delivery Location, Priority (`Low`, `Normal`, `High`, `Urgent`), and Target Delivery Date.
* **Line-Item Management:** Detailed item specification with quantity, unit of measure, category classification, estimated unit price, and item-level delivery remarks.
* **Excel BOQ Bulk Importer:** Download standard Excel BOQ templates and upload dozens of line items simultaneously with automatic field mapping.
* **Interactive Clarification Engine:** Built-in two-way communication thread between Procurement Buyers and Requisition Raisers with multi-file attachment uploads and turn-around-time (TAT) duration tracking.
* **Status Updates & Stakeholder Broadcasting:** Buyer status updates dispatched directly to requesters and customizable CC lists via automated emails.
* **Line-Item Short-Closing:** Flexible per-line or complete PR short-closing with recorded audit justification and automated conversion calculation.
* **Audit Trail & Activity Log:** Immutable history recording every state transition, edits, clarification requests, and user timestamps.

### 2.2. Sourcing Workbench & RFQ Management
* **PR Line Item Sourcing Queue:** Direct queue filtering line items that require vendor identification, competitive benchmarking, or technical vetting.
* **Master Product Mapping & Promotion:** Smart string matching suggestions to link uncataloged PR descriptions to standardized Master Products or promote new items into the master repository.
* **Multi-Vendor RFQ Tracking:** Log multi-vendor price quotes, lead times, warranty periods, and payment term options side-by-side.
* **Vendor Contact Directory & Call Notes:** Capture supplier contacts, sales rep details, and chronological negotiation remarks per sourcing request.
* **Sourcing Excel Export:** Download complete sourcing pipelines into structured spreadsheets for offline procurement review meetings.

### 2.3. Purchase Orders (PO) & Precision Document Engine
* **Flexible Creation Paths:** Convert directly from single or multiple PRs (with automatic residual quantity deduction) or create ad-hoc standalone POs.
* **Automated Indian GST & Statutory Tax Math:**
  * Real-time determination of Intra-State (`CGST + SGST`) vs. Inter-State (`IGST`) based on vendor address vs. shipping location state codes.
  * Line-level percentage discounts, customized tax percentage per item, and statutory rupee round-off calculations.
* **11-Column Zero-Truncation A4 PDF Rendering:**
  * Custom PDF generation engine (DomPDF + Snappy/WkHtmlToPdf) formatted for standard A4 portrait and landscape layouts.
  * Formatted tables preventing text clipping, overflow, or broken pagination across multi-page purchase orders.
  * Dynamic inclusion of Preparer, Department Head, and Multi-Level Approver signature blocks with timestamps.
* **Dynamic Terms & AMC Clauses:**
  * Configurable commercial terms: Payment Terms, Delivery Timelines, Freight & Transit Insurance, Warranty clauses, and post-warranty AMC percentages.
  * AI-assisted clause generation tool to suggest tailored procurement conditions.
* **Direct Vendor Dispatch & One-Click PDF URL:**
  * Instant transactional email dispatch to the vendor with the official PDF attached and key order details highlighted.
  * Tokenized public PO PDF viewing link for vendors without requiring system logins.
* **Delivery Status & Milestones Tracking:** Granular delivery milestone progression: `Draft` → `Pending Approvals` → `Approved` → `Released` → `In Transit / Delivered` → `Invoiced` → `Payment Released`.

### 2.4. Multi-Tier Approval Workflow Engine
* **Threshold-Based Cascading Hierarchy:** Dynamic approval rules configured per Cost Center for Level 1 (L1), Level 2 (L2), and Level 3 (L3) approvers with optional amount limit ceilings.
* **Intelligent Auto-Finalization:** Automatically concludes approval routing when the highest required threshold level approves the document.
* **Email-Based 1-Click Actioning (Zero-Login):**
  * Approvers receive high-context transactional emails containing complete line items, financial totals, and attached PDF.
  * Secure single-use, 72-hour expiring signed tokens allowing **Approve** or **Reject with Reason** directly from the email client on any mobile device.
* **Return for Revision:** Approvers can return documents to the originator with specific review comments rather than issuing outright rejections.
* **Diagnostic & Oversight Tooling:** Super Admin approval diagnostic view identifying assigned users, pending queues, and active escalations.

### 2.5. Goods Receipt Note (GRN) & Physical Verification
* **PO-Linked Goods Receipt:** Create GRNs referencing released and active Purchase Orders.
* **Partial Receipts & Split Shipments:** Receive partial deliveries over multiple batches with running calculations of remaining expected quantities.
* **Delivery Challan & Invoice Document Upload:** Attach scanned vendor delivery challans, lorry receipts (LR), and physical inspection reports.
* **Formal GRN PDF Certificates:** Print-ready GRN inspection vouchers showing received vs. accepted quantities, batch details, and receiving officer verification.
* **Auto-Delivery State Transition:** Automatically transitions parent PO status to `Delivered` once all line items reach 100% receipt.

### 2.6. Invoice Management & 3-Way Matching
* **3-Way Matching Verification:** Cross-checks invoiced quantities and unit rates against the original Purchase Order and confirmed GRN inspection vouchers.
* **Invoice Classification:** Categorizes billings across Regular Invoices, Advance Payment Requests, and Proforma Invoices.
* **Approval Routing for Settlement:** Routes invoices through dedicated financial approval chains before authorizing payment release.
* **Disbursement Status Tracking:** Records payment settlement dates, bank transaction references, and payment advice status.

---

## 3. Financial Governance & Real-Time Spend Control

### 3.1. Cost Center Budget Ledger
* **Fiscal Year Budget Allocation:** Assign annual budget limits per department, project, or operational cost center across fiscal calendars.
* **Real-Time 3-Tier Spend Encumbrance:**
  * **Committed / Consumed:** Funds permanently allocated to approved and released Purchase Orders.
  * **Encumbered / Frozen:** Funds automatically locked when PRs or POs are submitted for review, preventing over-commitment.
  * **Available Balance:** Dynamic real-time calculation showing uncommitted spending power before approving new purchases.
* **Automated Budget Release on Rejection:** Instant unfreezing of reserved amounts if a requisition or purchase order is rejected, returned, or cancelled.
* **Ledger Audit Trail:** Searchable transaction history tracking every freeze, release, and consume event with user attribution.

---

## 4. Master Data & Vendor Relationship Hub

### 4.1. Vendor Master & Dynamic Onboarding
* **Comprehensive Supplier Profiles:** Legal vendor name, Trade Name, Global Vendor Code, PAN, GSTIN, MSME status, Bank Account details (Account Number, IFSC, Branch), and primary contacts.
* **Multiple Branch & Warehouse Addresses:** Multi-address support per vendor with Pincode API auto-detection (City, State, and State Code resolution).
* **Vendor Document Vault:** Secure storage for PAN cards, GST certificates, cancelled cheques, and compliance declarations.
* **Cross-Tenant Vendor Cloning:** Seamlessly duplicate verified vendors across sister organizations while maintaining separate tenant vendor codes.
* **Dynamic Vendor Form Builder:** Super Admins can construct customizable public onboarding forms with drag-and-drop fields.
* **Self-Service Supplier Onboarding Portal:** Email onboarding invitations with tokenized links allowing suppliers to enter their KYC, banking details, and upload documents directly.
* **Vendor Review & Promotion Workflow:** Review supplier submissions, verify GST/PAN, approve and automatically create live vendor records.

### 4.2. Product & Category Catalog
* **Hierarchical Classification:** Unlimited nested parent-to-child product categories and sub-categories.
* **Product Catalog:** SKU/item code, standard name, HSN/SAC code, default GST tax bracket, unit of measure, standard rate, and warranty duration.
* **Excel Bulk Import/Export:** Two-way synchronization with Excel workbooks, including auto-generated validation reference sheets for category lookups.

### 4.3. Organizational Hierarchy & Locations
* **Department & Project Master:** Departmental structures and project identifiers mapped to budget cost centers.
* **Structured Location Directory:** Bill-to and Ship-to facilities with complete physical addresses, pin codes, GSTIN numbers, and regional state designations.

---

## 5. Analytics, Executive Dashboards & Reporting

### 5.1. Role-Specific Dashboards
* **Client Transactional Dashboard:** High-priority KPI tiles (Total POs, Pending Approvals, Approved, Released, Delivered), active cost center budget health gauges, and recent activity feeds.
* **Executive Cross-Tenant Dashboard:** Multi-organization consolidation displaying cross-tenant spend distribution, volume by supplier, and budget utilization charts.
* **PR & PO Turnaround Time (TAT) Analytics:** Stage-by-stage cycle time measurement:
  * PR creation to submission
  * Clarification resolution duration
  * RFQ drafting and evaluation time
  * Multi-level approval latency per approver level
  * PO release to final goods delivery

### 5.2. Executive Operational Reporting
* **Weekly/Monthly Operational Dossiers:** Automated generation of operational review reports summarizing procurement throughput, open bottlenecks, and spend metrics.
* **Exportable Formats:** Instant client-ready PDF downloads and CSV/Excel exports across PR registers, PO summaries, GRN logs, and vendor directories.

---

## 6. Administration, DevOps & Platform Operations

* **Database Dump & Backup Management:** On-demand database snapshot generation and secure download for off-site disaster recovery.
* **Email Template Studio:** Preview, test, and validate all automated HTML transactional emails (Password Reset, Vendor PO Dispatch, Approval Action Requests, Status Updates) in real time.
* **Automated CI/CD Deployment:** GitHub Actions pipelines with linting, build verification, and zero-downtime production deployment.
* **Activity & Compliance Logging:** Centralized logging capturing all user actions, IP addresses, model changes, and system events for statutory procurement audits.

---

## 7. Complete Module Summary Table

| Module | Key Capabilities | Primary Users | Export Formats |
| :--- | :--- | :--- | :--- |
| **Requisitions (PR)** | Item capture, BOQ Excel upload, 2-way clarification engine, line-item short-close, status broadcasts | Initiators, Department Heads, Buyers | Excel, CSV |
| **Sourcing / RFQ** | PR queue filtering, product matching, quote comparison, supplier directory, negotiation notes | Procurement Buyers, Sourcing Leads | Excel |
| **Purchase Orders (PO)** | 11-column A4 PDF engine, GST/tax math, payment & AMC clauses, vendor dispatch, milestone tracking | Buyers, Procurement Heads, Approvers | PDF, Excel, CSV |
| **Approval Engine** | L1–L3 threshold routing, zero-login 1-click email approvals, return for revision, diagnostic tools | Approvers, Finance Directors, Super Admin | Audit Logs |
| **Budget Control** | Real-time freeze/commit/release spend locks, annual allocations, over-spend prevention | Finance Heads, Cost Center Managers | Ledger CSV |
| **Goods Receipt (GRN)** | Partial shipment tracking, delivery challan uploads, inspection certificates, auto PO delivery update | Warehouse Staff, Site Engineers, Buyers | PDF, CSV |
| **Invoices** | 3-way matching (PO-GRN-Invoice), payment approval routing, advance/proforma billing | Accounts Payable, Finance Managers | CSV |
| **Vendor Hub** | Form builder, public self-onboarding portal, document vault, KYC verification, cross-org sharing | Vendors, Buyers, Compliance Admins | PDF, Excel |
| **Catalogs & Masters** | Product SKU directory, HSN codes, hierarchical categories, location address books | Master Data Admins, Buyers | Excel Templates |
| **Dashboards & TAT** | Real-time KPIs, cross-tenant comparisons, cycle time bottlenecks, executive review dossiers | Executives, Super Admins, Department Heads | PDF, Excel |
