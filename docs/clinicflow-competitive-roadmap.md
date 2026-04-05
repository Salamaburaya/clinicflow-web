# ClinicFlow Competitive Roadmap

## Goal

Bring `ClinicFlow` closer to clinic-management competitors such as Tipulog, PatientStudio, Zanda, TherapyPM, Prompt EMR, and Psyquel by focusing on the modules that repeatedly appear across mature products.

This roadmap is based on:

- the current `ClinicFlow` codebase
- public product information from competing clinic/practice management systems
- the principle of strengthening the clinical core before adding heavier financial workflows

## What ClinicFlow Already Has

The current app already includes a meaningful first product layer:

- patient management
- therapist management
- appointment scheduling
- treatment journal / progress notes
- room assignment
- WhatsApp confirmations and reminders
- operational dashboard and basic reports

That means ClinicFlow is not starting from zero. It is already past MVP and ready for product hardening.

## What Strong Competitors Usually Have

The same pillars appear again and again across competitors:

1. authentication, roles, and permission boundaries
2. configurable clinical documentation templates
3. patient intake and questionnaires
4. richer patient chart with files, tasks, history, and multiple providers
5. billing, invoices, payments, and funding sources
6. reporting, auditability, and compliance/security controls

## Product Gap Analysis

### 1. Auth, Users, Roles, Permissions

Current state:

- no real user accounts in the app flow
- no role-based restrictions
- no per-clinic / per-user visibility rules

Competitors usually provide:

- admin, therapist, receptionist, finance roles
- calendar visibility by role
- medical/financial data separation
- multi-staff access rules

Why this comes first:

- every serious expansion depends on it
- documentation, billing, and questionnaires all become messy without ownership and permissions
- it is the base for clinics with more than one staff member

### 2. Smart Documentation Templates

Current state:

- journal form is mostly fixed
- note-taking is useful but not configurable by discipline or visit type

Competitors usually provide:

- intake templates
- evaluation templates
- follow-up templates
- dynamic fields
- dropdowns, checkboxes, numeric fields, calculations
- reusable structured note layouts

Why this is the highest-value clinical upgrade:

- it directly improves daily work for therapists
- it makes the product feel specialized instead of generic
- it supports multiple professions without rewriting the UI each time

### 3. Patient Questionnaires and Intake Flows

Current state:

- no patient-facing form workflow
- no pre-visit intake, consent, or follow-up questionnaires

Competitors usually provide:

- sending forms before appointments
- storing responses directly in the patient chart
- reusable questionnaires by clinic
- status tracking: sent, opened, completed

Why this should come before billing:

- it improves clinical intake and operational efficiency immediately
- it creates patient participation without requiring a full portal at first

### 4. Richer Patient Chart

Current state:

- patient card has core fields and journal history
- therapist assignment is simple

Competitors usually provide:

- multiple providers per patient
- files and attachments
- internal tasks
- timeline of appointments, notes, forms, and communications
- funding / referral / insurance relationships

Why this matters:

- once documentation and questionnaires exist, the chart becomes the product center
- this is where “app that works” becomes “system clinics rely on”

### 5. Billing and Financial Workflows

Current state:

- no invoicing or payment ledger yet

Competitors usually provide:

- invoices / receipts
- payment collection
- debt tracking
- therapist compensation support
- funding-source handling

Why this is not first:

- it is important, but clinical workflow is the stickier product core
- finance gets easier to build once roles, patient records, and structured encounters exist

### 6. Compliance, Audit, and Security Operations

Current state:

- server-side reminder flows exist
- there is no visible audit or permission trail yet

Competitors usually highlight:

- auditability
- secure storage and backups
- data access boundaries
- compliance-oriented operational controls

Why this should be layered in as we grow:

- parts of it should start early
- the full compliance package makes more sense after auth and data structure solidify

## Recommended Build Order

### Phase 1: Foundation

Build first:

- user accounts with Supabase Auth
- clinic membership model
- roles: `admin`, `therapist`, `reception`, `finance`
- role checks in UI and API
- ownership rules for patients, appointments, notes

Expected outcome:

- the app becomes safe to scale beyond one operator

### Phase 2: Smart Clinical Notes

Build next:

- documentation template builder
- template assignment by discipline or visit type
- structured note responses
- note history rendered from template data

Expected outcome:

- the app becomes clinically differentiated

### Phase 3: Questionnaires and Intake

Build next:

- questionnaire templates
- send-to-patient flow
- saved patient responses
- appointment-linked intake checklist

Expected outcome:

- better intake process and stronger patient chart

### Phase 4: Rich Patient Workspace

Build next:

- chart timeline
- attachments
- multiple providers per patient
- staff tasks / follow-ups
- communication log

Expected outcome:

- the chart becomes the daily home screen for care teams

### Phase 5: Billing

Build next:

- invoices / receipts
- payments
- balances
- funding sources / payer entity support
- therapist payout reports

Expected outcome:

- operations and revenue move into the same product

### Phase 6: Advanced Reporting and Compliance

Build next:

- audit log
- access log
- stronger reporting
- clinic health metrics
- no-show and utilization reporting

Expected outcome:

- the app starts resembling mature clinic software operationally, not only functionally

## Immediate Recommendation

If the goal is to become truly comparable to competitors, the next implementation should be:

1. `Supabase Auth + roles + permissions`
2. `smart documentation templates`

This is the strongest move because it upgrades both product maturity and daily clinical usefulness.

## Proposed Next Execution Step

The next concrete implementation pass should include:

- schema proposal for users, clinics, memberships, roles
- row-level access strategy
- migration plan that does not break the current app
- UI update plan for role-aware navigation

After that, we should implement the documentation-template module.
