# StudySeat Management UI Redesign

**Status:** Approved design direction; awaiting review of this written specification  
**Date:** 2026-10-17  
**Scope:** UI/UX and information hierarchy only. Dummy-data behaviour, domain rules, routes and Supabase migration work are out of scope for this redesign spec.

## 1. Purpose

StudySeat has two jobs:

1. Help students find a study library with a seat in the shift they want.
2. Help owners run a library quickly between students: handle requests, seats, memberships, fees and expiry.

The current dummy-data UI has the right product capabilities, but its visual grammar is inconsistent. Public pages, owner pages and admin pages switch between large cards, small cards, tables, seat-dot strips and lists. The same information is often shown twice. Operational screens spend too much screen area on presentation rather than decisions.

The redesign makes StudySeat feel like one calm, modern management system. It uses a dashboard with panels for owner overview, dense operational rows on desktop, focused records on phones, and the full seat grid as the only repeated signature visual.

## 2. Decisions confirmed with the product owner

| Decision | Chosen direction |
|---|---|
| Primary owner visual direction | Dashboard with panels |
| Owner Home priority | Ranked **Needs attention**: requests → overdue members → expiring members |
| Requests, admin libraries and admin payments | Dense desktop rows; focused mobile cards |
| Seat visual | Full seat grid only on Seats and public homepage hero; no mini seat-dot/bars in cards, dashboard or library detail |
| Public discovery | Compact equal-height textual library cards |
| Shifts | Per-shift fees and availability remain; text, time and status express shifts outside the full seat grid |

## 3. Product personality

### Intended feeling

- **Quiet confidence:** a library is a focused environment, not a noisy consumer marketplace.
- **Fast operational clarity:** owners should scan decisions without reading decoration.
- **Local and practical:** plain language, Indian ₹ formatting, phone-first interactions.
- **Deliberate restraint:** teal supports primary actions and availability; orange is rare and means a time-sensitive action; red means a real issue.

### Explicitly avoid

- Oversized generic dashboard cards.
- Mini charts, seat-dot strips or visual seat summaries outside the actual seat grid and homepage hero.
- Different card structures for the same type of information.
- Multiple competing primary buttons in one row.
- Decorative gradients, repeated icon circles and animations that do not explain a change.

## 4. Design system and layout grammar

### 4.1 Existing visual tokens to retain

- Canvas: warm off-white (`canvas`), not cool grey.
- Surface: white (`surface`).
- Ink: near-black warm text (`ink`) and a readable muted text (`ink-muted`).
- Primary: dark teal for primary actions, active navigation and availability.
- Accent: orange only for urgent conversion actions such as **Review requests** or **Activate plan**.
- Status: success, warning, danger always combine colour with text/icon.
- Type: Inter with tabular figures only for amounts, dates, seat numbers and counts.
- Two radii: `rounded-control` for fields/buttons and `rounded-card` for containers.
- Light mode only in v1.

### 4.2 Panel contract

A panel is used only for a summary, a group of closely related work, a form section, a selected shift or an important status.

Every panel has the same anatomy:

```
Optional panel header: title + one contextual action
───────────────────────────────────────────────
Content
───────────────────────────────────────────────
Optional footer: one next action or “View all”
```

Rules:
- Standard desktop padding: 20–24px. Mobile padding: 16px.
- Header, content and footer use the same divider colour.
- Equal sibling panels align their header and footer edges.
- A panel may have one primary action. Secondary actions are text links or go into a More menu.
- No panel uses a decorative availability graph.

### 4.3 Operational row contract

Desktop operations use rows, not large cards.

```
Name + context | shift/status | amount/date | primary action | More
```

- Rows have one compact primary action: **Renew**, **Approve** or **Verify**.
- Secondary actions go under **More** or in a focused modal.
- The row itself never depends on colour alone; shift, status and urgency are written as text.
- Rows become one focused record card on phone. The card keeps the same field order and only exposes the primary action immediately.

### 4.4 Public library card contract

Public cards are concise textual records, not visual seat graphs.

```
Initials or real photo | Library name | Area, city
───────────────────────────────────────────────
Morning     8:30 am–12:30 pm     18 free
Afternoon   1:00 pm–5:00 pm      Full
Evening     6:00 pm–9:00 pm      27 free
───────────────────────────────────────────────
from ₹500 / month                         View ›
```

Rules:
- Every card reserves three shift rows so all card footers align.
- Long names truncate after one line in listing cards; the full name appears as the browser title and on the library detail page.
- A real photo replaces the initials tile when present; no photo-specific empty art is displayed.
- Four cards render as a 2×2 grid; three as a 3-column desktop grid; phones always use one column.

### 4.5 Responsive grid

| Context | Desktop | Phone |
|---|---|---|
| Owner/Admin shell | 256px sidebar + max-width 1280px main work area | top bar + bottom tab bar |
| Dashboard summary stats | 4 equal columns | 2×2 grid |
| Attention panels | 2 equal columns | stacked |
| Public library cards | 2 or 3 equal columns based on item count | one column |
| Operational lists | dense rows/table | focused cards |
| Forms | grouped panels, 2 columns when related | one column |

No page may horizontally scroll at 320px or at 200% text size.

## 5. Screen hierarchy

### 5.1 Owner Home: Today

Purpose: tell an owner what needs a decision now.

Order:
1. Plan/trial banner, if relevant.
2. **Needs attention**:
   - Request count with **Review requests** primary action.
   - Overdue members first.
   - Expiring-in-7-days members second.
3. Selected shift control: Morning / Afternoon / Evening, showing textual free-seat counts.
4. Four equal stats for the selected shift: total, occupied, available, active members.
5. All shifts textual summary: shift name, time, fee, `N of M seats taken`, member count.
6. Quick actions plus Recent joins.

Limits:
- Show at most 5 expiring rows in Home and a **Show all** link.
- Home does not duplicate the trial banner as a second plan card.
- Home does not show miniature seat diagrams.

### 5.2 Owner Seats

Purpose: manage physical seats for the chosen shift.

- Shift selector is a compact text-and-count control.
- The full seat grid is the primary visual and only appears here.
- A selected seat opens a focused bottom sheet on phone / dialog on desktop.
- Seat settings are secondary and collapsed below the grid.
- The full grid may use colour, outline, icon and accessible label to distinguish free, occupied, expiring, overdue and disabled states.

### 5.3 Owner Students

Purpose: find, renew and manage memberships quickly.

- Search is first.
- Filters: Needs attention, All, Expiring, Overdue, No seat, then shift filters.
- Desktop: dense table with Student, Shift, Seat, Expiry, Fees, Actions.
- Phone: one compact record per member; one visible **Renew** action; More menu for edit, payments and remove.
- Page size: 25 records then **Show more**.

### 5.4 Owner Requests

Purpose: decide requests without context switching.

- Desktop: request queue rows, ordered oldest first.
- Phone: one request card at a time.
- Each record shows student, phone, selected shift, shift fee, free seats in that shift and request time.
- Primary action: **Approve**. Secondary: **Decline**.
- Approval opens one focused form prefilled with the first free seat, current date, shift fee and 30-day expiry.

### 5.5 Owner Plan

Purpose: renew without uncertainty.

- Status panel: active/trial/expired, plan end date and days left.
- One three-step payment panel: Pay ₹199 → Enter UTR → We verify.
- Desktop displays QR + UPI ID; phone prioritises the UPI-app action.
- Payment history is a dense, chronological list/table.

### 5.6 Owner Library Profile

Purpose: edit library information safely.

- Grouped panels: About; Where students find you; Seats and hours; Amenities; Shifts and fees; Photos.
- One Save bar for all changes. No per-shift save buttons.
- Shifts and fees use equal form panels on desktop; one column on phone.
- Rejected status shows the reason and changes the single save action to **Save and resubmit**.

### 5.7 Admin

#### Libraries
- Summary stat tiles at top.
- Filter tabs and search below.
- Desktop: dense row queue with Library, Owner, Location, Seats, Shifts, Submitted, Status and Actions.
- Phone: focused cards.
- Pending library row exposes Approve and Reject. Other rows expose Details.

#### Payments
- Pending payment is the focused review panel: UTR, amount, library, owner, submitted time, Verify, Mark failed.
- History is a dense table on desktop and cards on phone.

#### Cities and areas
- Two equal panels: Cities and selected City’s Areas.
- Each row is a simple name/count/active toggle row.

### 5.8 Student discovery and membership

- Discover: Search, city/area, a Filters modal on phone, sort, then equal textual library cards.
- Library detail: title and location; textual shift choice cards; one request action tied to the chosen shift; address and amenities below.
- My requests: Waiting then Decided, in concise status records.
- My membership: one calm membership ticket per shift, showing seat, shift, dates, payments and action only if the membership needs attention.

## 6. Interaction and content rules

- All primary actions use direct verbs: **Renew**, **Approve**, **Review requests**, **Submit payment**, **Save changes**.
- A destructive or reversible action supplies an Undo toast where safe; permanent removal requires confirmation.
- Dialogs use a full-width bottom sheet on phones and a centred modal on desktop.
- Loading shows skeletons shaped like the target rows/panels.
- Empty state uses one sentence plus one next action.
- Error state says what failed and what the user can do next.
- Links and buttons have a 44px minimum touch target.
- All forms have visible labels, inline validation and a clear focus target after errors.

## 7. Accessibility and quality requirements

- One H1 per page, then ordered headings.
- Visible keyboard focus on all interactive controls.
- Semantic buttons for actions, links for navigation, real form labels and real tables for desktop tabular data.
- Status text is always written; colour is supplementary.
- WCAG AA contrast: 4.5:1 text, 3:1 components.
- Respect reduced motion.
- Test at 320px, 390px, 768px, 1280px and 200% text size.

## 8. Out of scope

- Domain/business changes: roles, shift constraints, fees, payment verification, visibility rules and Supabase/RLS.
- New external notifications or a payment gateway.
- Dark mode.
- Hindi localisation. Copy is kept central and simple so localisation can be added later.

## 9. Acceptance criteria for a future implementation

1. Owner Home makes requests, overdue members and expiring members visible without scrolling on a standard desktop viewport.
2. Admin Libraries and Payments use dense rows on desktop, with actions visible without horizontal scrolling.
3. The same information type follows the same structure across owner, admin and mobile screens.
4. Library listing cards are textual, equal-height and do not contain seat-dot/bar graphics.
5. Only Seats and the homepage hero show a seat-grid visual.
6. Every operational screen has loading, empty, error and populated states.
7. No horizontal overflow at 320px or 200% text size.
8. The full dummy-data flow remains working: find → request a shift → approve → membership; add → assign → renew → remove; submit UTR → admin verify.
