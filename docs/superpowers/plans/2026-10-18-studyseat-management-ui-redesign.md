# StudySeat Management UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign StudySeat’s dummy-data UI as one calm management system: owner dashboard panels, ranked operational work, dense desktop rows, focused mobile records and text-first discovery cards.

**Architecture:** Keep the existing React/Vite route, hooks → services → repository boundaries and dummy-data behavior. Add small pure presentation helpers for layout selection, card availability labels and owner attention ranking, then refactor each role’s existing pages to consume the shared panel/row contracts. Do not change tables, RLS rules, payment behavior or shift business rules.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7, Vitest 5, Lucide React, existing mock repositories.

**Spec:** `docs/superpowers/specs/2026-10-17-studyseat-management-ui-redesign.md`

## Global Constraints

- Preserve dummy-data services, routes, role guards, plan rules, shifts, memberships and payment behavior exactly as they work now.
- Use the existing warm neutral / teal semantic tokens; do not introduce raw hex values in components.
- Use dashboard panels only for summaries, selected contexts, focused forms and status; use rows/tables for operational work on desktop.
- Owner Home ranks requests first, overdue members second, expiring members third.
- Requests, Admin Libraries and Admin Payments use dense rows on desktop and focused records on phones.
- Public library cards are text-first, equal-height records; do not render seat-dot, seat-bar or graph visuals in cards or library detail.
- The full `SeatGrid` remains the signature visual on Owner Seats and the public homepage hero only.
- Text always communicates availability/status; colour and icons are supplementary.
- Keep target size at least 44px for touch controls, visible keyboard focus, one H1 per page and reduced-motion support.
- Verify 320px, 390px, 768px, 1280px and 200% text scale with no horizontal overflow.
- Add no open version dependency. If Playwright is added for regression verification, use exact `@playwright/test@1.52.0`.
- Do not commit unless the product owner explicitly asks for a commit. Run the relevant verification at the end of every task instead.

---

## File and boundary map

| Area | Files | Responsibility after redesign |
|---|---|---|
| Pure UI decisions | Create `src/domain/presentation.ts`, `src/domain/presentation.test.ts` | Equal-grid layout, text availability labels, attention ranking and visible-row limits; no React imports. |
| Shared UI contracts | Modify `src/components/CardGrid.tsx`, `Card.tsx`, `PageParts.tsx`, `ShiftTabs.tsx`; create `OperationalRow.tsx`, `Panel.tsx` | Reusable panel anatomy, desktop row / mobile record layout and no-orphan grid decisions. |
| Owner shell + Home | Modify `src/components/layouts/OwnerLayout.tsx`, `src/pages/owner/Dashboard.tsx`, `components/owner/home/AttentionList.tsx`, `DashboardLists.tsx` | Owner navigation and Today hierarchy. |
| Owner operations | Modify `src/pages/owner/Students.tsx`, `Seats.tsx`, `Requests.tsx`, `components/owner/members/*` | Dense desktop management lists, compact mobile records and focused dialogs. |
| Owner plan/profile | Modify `src/pages/owner/Plan.tsx`, `LibraryProfile.tsx`, `components/owner/plan/*`, `components/owner/profile/*` | One save model, grouped profile panels and clear plan/payment panel. |
| Admin | Modify `src/pages/admin/Libraries.tsx`, `Payments.tsx`, `Places.tsx`, `components/admin/*`, `layouts/AdminLayout.tsx` | Desktop row queues and mobile records. |
| Public/student discovery | Modify `src/pages/Home.tsx`, `Discover.tsx`, `LibraryDetail.tsx`, `components/student/*`, `components/landing/*`, `layouts/PublicLayout.tsx` | Seat-grid hero only, text cards, shift detail and request action. |
| Student account pages | Modify `src/pages/student/MyRequests.tsx`, `MyMembership.tsx` | Compact status records and membership tickets without decorative seat charts. |
| Tests and visual regression | Create `src/domain/presentation.test.ts`; optionally create `e2e/ui-redesign.spec.ts`, `playwright.config.ts` and update `package.json` | Validate pure layout logic, critical dummy flows and visual viewport constraints. |

## Shared interfaces introduced by this plan

```ts
// src/domain/presentation.ts
export type AvailabilityTone = 'neutral' | 'warning' | 'success'
export type AttentionKind = 'request' | 'overdue' | 'expiring'

export type AttentionInput = {
  id: string
  kind: AttentionKind
  createdAt?: string
  daysLeft?: number
}

export function cardColumnsFor(count: number): 1 | 2 | 3
export function availabilityLabel(seatsLeft: number): {
  label: string
  tone: AvailabilityTone
}
export function rankAttention(items: AttentionInput[]): AttentionInput[]
export function limitVisible<T>(items: T[], limit: number): {
  visible: T[]
  remaining: number
}
```

```tsx
// src/components/Panel.tsx
export function Panel(props: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}): React.ReactElement

// src/components/OperationalRow.tsx
export function OperationalRow(props: {
  primary: React.ReactNode
  context?: React.ReactNode
  status?: React.ReactNode
  primaryAction?: React.ReactNode
  moreAction?: React.ReactNode
  mobileFooter?: React.ReactNode
}): React.ReactElement
```

---

### Task 1: Lock the reusable visual contracts with pure tests

**Files:**
- Create: `src/domain/presentation.ts`
- Create: `src/domain/presentation.test.ts`
- Modify: `src/components/CardGrid.tsx`
- Create: `src/components/Panel.tsx`
- Create: `src/components/OperationalRow.tsx`
- Modify: `src/components/Card.tsx`
- Modify: `src/components/PageParts.tsx`

**Interfaces:**
- Consumes: existing semantic Tailwind token classes, `cx()` from `src/lib/cx.ts`, `Button` and `Card`.
- Produces: `cardColumnsFor`, `availabilityLabel`, `rankAttention`, `limitVisible`, `Panel` and `OperationalRow` for every later UI slice.

- [ ] **Step 1: Write the failing pure-presentation tests**

```ts
// src/domain/presentation.test.ts
import { describe, expect, it } from 'vitest'
import {
  availabilityLabel,
  cardColumnsFor,
  limitVisible,
  rankAttention,
} from '@/domain/presentation'

describe('cardColumnsFor', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 2],
    [5, 3],
  ] as const)('uses %i clean columns for %i records', (count, expected) => {
    expect(cardColumnsFor(count)).toBe(expected)
  })
})

describe('availabilityLabel', () => {
  it('writes status in words, not colour only', () => {
    expect(availabilityLabel(0)).toEqual({ label: 'Full', tone: 'neutral' })
    expect(availabilityLabel(3)).toEqual({ label: '3 free', tone: 'warning' })
    expect(availabilityLabel(18)).toEqual({ label: '18 free', tone: 'success' })
  })
})

describe('rankAttention', () => {
  it('orders request before overdue before expiring, then urgent records first', () => {
    const ranked = rankAttention([
      { id: 'expire-3', kind: 'expiring', daysLeft: 3 },
      { id: 'overdue-2', kind: 'overdue', daysLeft: -2 },
      { id: 'request-old', kind: 'request', createdAt: '2026-10-10T10:00:00Z' },
      { id: 'overdue-6', kind: 'overdue', daysLeft: -6 },
      { id: 'request-new', kind: 'request', createdAt: '2026-10-16T10:00:00Z' },
    ])
    expect(ranked.map((item) => item.id)).toEqual([
      'request-old', 'request-new', 'overdue-6', 'overdue-2', 'expire-3',
    ])
  })
})

describe('limitVisible', () => {
  it('returns visible records and a remaining count', () => {
    expect(limitVisible(['a', 'b', 'c'], 2)).toEqual({ visible: ['a', 'b'], remaining: 1 })
  })
})
```

- [ ] **Step 2: Run the focused tests and confirm they fail because the module does not exist**

Run: `npm test -- src/domain/presentation.test.ts`

Expected: FAIL with an import/module-not-found error for `@/domain/presentation`.

- [ ] **Step 3: Implement pure presentation helpers**

```ts
// src/domain/presentation.ts
export function cardColumnsFor(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1
  if (count === 2 || count === 4) return 2
  return 3
}

export function availabilityLabel(seatsLeft: number) {
  if (seatsLeft <= 0) return { label: 'Full', tone: 'neutral' as const }
  if (seatsLeft <= 5) return { label: `${seatsLeft} free`, tone: 'warning' as const }
  return { label: `${seatsLeft} free`, tone: 'success' as const }
}

const priority = { request: 0, overdue: 1, expiring: 2 } as const

export function rankAttention(items: AttentionInput[]): AttentionInput[] {
  return [...items].sort((a, b) => {
    const type = priority[a.kind] - priority[b.kind]
    if (type !== 0) return type
    if (a.kind === 'request') return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    return (a.daysLeft ?? 0) - (b.daysLeft ?? 0)
  })
}

export function limitVisible<T>(items: T[], limit: number) {
  return { visible: items.slice(0, limit), remaining: Math.max(0, items.length - limit) }
}
```

- [ ] **Step 4: Refactor `CardGrid` to use `cardColumnsFor` and add the panel/row components**

```tsx
// src/components/Panel.tsx
export function Panel({ title, action, children, footer, className }: PanelProps) {
  return (
    <Card className={cx('flex min-w-0 flex-col overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 sm:px-5">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="min-w-0 flex-1 p-4 sm:p-5">{children}</div>
      {footer && <div className="border-t border-border px-4 py-3 sm:px-5">{footer}</div>}
    </Card>
  )
}
```

Implement `OperationalRow` as a semantic `div` with desktop grid columns and a mobile stacked layout. It must render `primary`, `context`, `status`, `primaryAction`, `moreAction` and an optional mobile footer without changing their order.

- [ ] **Step 5: Run focused tests and static checks**

Run:

```bash
npm test -- src/domain/presentation.test.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

Expected: all four pure tests pass; no TypeScript or lint errors introduced.

---

### Task 2: Make shells and shared navigation follow the management hierarchy

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layouts/OwnerLayout.tsx`
- Modify: `src/components/layouts/AdminLayout.tsx`
- Modify: `src/components/layouts/PublicLayout.tsx`
- Modify: `src/components/layouts/Nav.tsx`
- Modify: `src/components/TrialBanner.tsx`
- Modify: `src/components/UpdatesBanner.tsx`
- Modify: `src/components/ShiftTabs.tsx`
- Modify: `src/pages/dev/Styleguide.tsx`

**Interfaces:**
- Consumes: `Panel`, `OperationalRow`, `cardColumnsFor`, existing role route definitions and `NavItemDef`.
- Produces: stable desktop/sidebar, phone/bottom-nav and panel-preview patterns used by every screen task.

- [ ] **Step 1: Extend the development styleguide with approved visual contracts**

Add examples under `src/pages/dev/Styleguide.tsx` for:

```tsx
<Panel title="Needs your attention" action={<Button>Review requests</Button>}>
  <OperationalRow
    primary="Ishita Nair"
    context="Morning · Seat 1"
    status={<Badge tone="danger">Overdue by 6 days</Badge>}
    primaryAction={<Button>Renew</Button>}
    moreAction={<Button variant="secondary">More</Button>}
  />
</Panel>
```

Add desktop and 390px screenshots to the validation checklist in the styleguide comments.

- [ ] **Step 2: Move page-level Suspense fallbacks inside the role layouts**

Keep route lazy loading, but make owner/admin/public chrome remain mounted during page chunk loading:

```tsx
// In each layout main content region
<Suspense fallback={<PageFallback />}>
  <Outlet />
</Suspense>
```

Remove the global app-level page fallback that replaces the entire shell. Retain `AuthProvider`, `ToastProvider`, route guards and all route paths.

- [ ] **Step 3: Apply fixed navigation grammar**

In `OwnerLayout` and `AdminLayout`:
- Keep a 256px desktop sidebar and max-width 1280px main work area.
- Owner sidebar order: Home, Seats, Students, Requests, Plan, Library profile.
- Admin sidebar order: Libraries, Payments, Cities.
- Keep request/payment badges only for pending work.

In `PublicLayout`:
- Keep public/student navigation compact.
- Preserve the student bottom tab bar with exactly Find, Requests and Membership.

- [ ] **Step 4: Standardise banners and shift controls**

- `TrialBanner` must be the only routine plan status surface on owner pages.
- `UpdatesBanner` appears above page content and may be dismissed; it must not duplicate the current page’s primary panel.
- `ShiftTabs` must show only shift name, time and textual free-seat count. Do not add seat-dot or bar graphics.

- [ ] **Step 5: Run shell verification**

Run:

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm run build
```

Manual smoke script:
1. Sign in as Anil; navigate Owner Home → Seats → Students → Requests without the sidebar disappearing while each route loads.
2. At 390px, confirm five owner tabs fit without horizontal scrolling.
3. Sign in as Joel; confirm Admin sidebar has only Libraries, Payments and Cities.

---

### Task 3: Redesign Owner Home as Today with ranked attention panels

**Files:**
- Modify: `src/pages/owner/Dashboard.tsx`
- Modify: `src/components/owner/home/AttentionList.tsx`
- Modify: `src/components/owner/home/reminder.ts`
- Modify: `src/components/owner/DashboardLists.tsx`
- Modify: `src/components/owner/members/RenewModal.tsx`
- Test: `src/domain/presentation.test.ts`

**Interfaces:**
- Consumes: `rankAttention`, `limitVisible`, `Panel`, `OperationalRow`, `useOwnerLibrary`, `buildSeatCells`, `seatCounts`, `memberPhase`, `formatPhone`, `whatsappLink`.
- Produces: owner Today ordering and equal attention panels consumed only by the Owner dashboard.

- [ ] **Step 1: Add a failing ranking test covering dashboard inputs**

Append this case to `src/domain/presentation.test.ts`:

```ts
it('puts pending requests before overdue and expiring records for the Today panel', () => {
  const items = rankAttention([
    { id: 'expiry', kind: 'expiring', daysLeft: 1 },
    { id: 'overdue', kind: 'overdue', daysLeft: -1 },
    { id: 'request', kind: 'request', createdAt: '2026-10-15T10:00:00Z' },
  ])
  expect(items.map((item) => item.id)).toEqual(['request', 'overdue', 'expiry'])
})
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- src/domain/presentation.test.ts`

Expected: PASS after Task 1; this confirms the dashboard can rely on the shared ranking contract.

- [ ] **Step 3: Replace the current dashboard composition with the approved order**

In `Dashboard.tsx`:
1. Render `PageHeader title="Today"` with the library/date description.
2. Render the existing plan/trial banner only once through the owner layout.
3. Build one ranked `Needs attention` section:
   - request count and a single **Review requests** link;
   - `Overdue` panel;
   - `Expiring in 7 days` panel.
4. Render overdue and expiring as sibling `Panel`s using the same fixed header and footer anatomy. Limit each to five visible rows using `limitVisible`.
5. Use `OperationalRow` for each member: name, shift, seat, written urgency, Renew, WhatsApp reminder and Call.
6. Place selected shift tabs below attention, then four equal `StatCard`s: Total seats, Occupied, Available, Active students.
7. Replace all shift seat-strip/dot graphics with text: `39 of 39 seats taken`, `31 free`, `₹800 / month`.
8. Finish with two equal panels: Quick actions and Recent joins.

- [ ] **Step 4: Keep approved/pending/rejected/expired states explicit**

- Pending: status panel with one **View library details** action.
- Rejected: reason and **Fix and resubmit**.
- Expired: read-only explanation plus **Renew plan**; still render data below it.
- No library: use `SetupState` and **List your library**.

- [ ] **Step 5: Verify exact Home behaviour**

Run:

```bash
npm test -- src/domain/presentation.test.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

Manual dummy checks:
1. Sign in as Anil: verify `3 seat requests waiting` appears before overdue and expiring lists.
2. Sign in as Farah: verify read-only expired state has one Renew plan path.
3. Sign in as Deepak and Rekha: verify pending/rejected Home states do not show seat stats.
4. At 1280px, Overdue and Expiring panels have equal header/footer edges; at 390px they stack.

---

### Task 4: Refactor owner operational work into dense desktop rows and focused mobile records

**Files:**
- Modify: `src/pages/owner/Students.tsx`
- Modify: `src/pages/owner/Requests.tsx`
- Modify: `src/pages/owner/Seats.tsx`
- Modify: `src/components/owner/members/MemberActionsSheet.tsx`
- Modify: `src/components/owner/members/AddStudentModal.tsx`
- Modify: `src/components/owner/members/EditStudentModal.tsx`
- Modify: `src/components/owner/members/PaymentsModal.tsx`
- Modify: `src/components/owner/members/RenewModal.tsx`
- Modify: `src/components/owner/members/ExpiryBadge.tsx`
- Modify: `src/components/ShowMore.tsx`

**Interfaces:**
- Consumes: `OperationalRow`, `Panel`, `usePaged`, `memberPhase`, `memberDaysLeft`, `buildSeatCells`, `ShiftTabs`, mock service signatures in `createServices.ts`.
- Produces: consistent owner row/card behavior; no service or domain signature changes.

- [ ] **Step 1: Preserve and test pagination behaviour before changing row markup**

Add to `src/domain/presentation.test.ts`:

```ts
it('keeps the first 25 visible records and counts the remainder', () => {
  const members = Array.from({ length: 59 }, (_, i) => String(i + 1))
  expect(limitVisible(members, 25)).toEqual({
    visible: members.slice(0, 25),
    remaining: 34,
  })
})
```

Run: `npm test -- src/domain/presentation.test.ts`

Expected: PASS.

- [ ] **Step 2: Rebuild Students desktop table and mobile record**

In `Students.tsx`:
- Order controls: search, Needs attention, All, Expiring, Overdue, No seat, then shift filters.
- Desktop table columns: Student, Shift, Seat, Expires, Fees, Actions.
- Each desktop row exposes only **Renew** as immediate primary action; pass Edit, Payments and Remove to `MemberActionsSheet` through a **More** button.
- Phone member record shows the same field order and one visible **Renew** action.
- Keep `usePaged` at 25 and render `ShowMore` with the count.
- Do not create fixed-height member cards; records may grow naturally on phone.

- [ ] **Step 3: Make Requests a desktop queue**

In `Requests.tsx`:
- Desktop columns: Student, Phone, Shift, Fee, Seats free, Requested, Actions.
- Primary **Approve**, secondary **Decline** and no extra competing action.
- Phone uses a focused record card with the same field order.
- Keep approve prefill logic: first free seat, today as start, 30 days as expiry and selected shift fee.
- The history list follows below as compact rows, not cards.

- [ ] **Step 4: Keep Seats visually singular**

In `Seats.tsx`:
- Retain the full `SeatGrid`, legend and selected-shift tabs as the only seat visual.
- Render text summary `0 free · 39 occupied`; do not use `SeatStrip` outside `SeatGrid`.
- Keep student search above the grid; selecting a result opens their existing seat dialog.
- Keep seat settings as a collapsed secondary panel below the grid.
- In seat dialogs, expose Renew as primary; place Free seat and Remove under a clear secondary/More path with confirmation or Undo when safe.

- [ ] **Step 5: Standardise member modals and sheet actions**

- `RenewModal`: title, current expiry, new expiry, amount, payment mode, **Renew**.
- `AddStudentModal`: title, shift before seat, start/expiry, optional first payment, **Add student**.
- `MemberActionsSheet`: preserve Edit, Payments and Remove; render each action at 44px minimum.
- `PaymentsModal`: dense payment rows; void action requires a reason.

- [ ] **Step 6: Verify owner operations**

Run:

```bash
npm test -- src/domain/presentation.test.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

Manual dummy checks:
1. Anil → Students: search for a name, filter Overdue, Renew the first member, verify a fee record appears.
2. Anil → Requests: approve Aman into an Afternoon free seat; verify the new member and seat grid agree.
3. Anil → Seats: free a seat, use Undo, then verify it is occupied again.
4. At 1280px, Students and Requests are rows; at 390px they are focused records without horizontal scrolling.

---

### Task 5: Rework owner profile and plan into grouped decision panels

**Files:**
- Modify: `src/pages/owner/LibraryProfile.tsx`
- Modify: `src/components/owner/profile/LibraryEditor.tsx`
- Modify: `src/components/owner/profile/OnboardingWizard.tsx`
- Modify: `src/components/owner/profile/ShiftsEditor.tsx`
- Modify: `src/components/owner/profile/PhotoPicker.tsx`
- Modify: `src/components/owner/profile/shiftDrafts.ts`
- Modify: `src/pages/owner/Plan.tsx`
- Modify: `src/components/owner/plan/PaymentCard.tsx`
- Modify: `src/components/owner/plan/PaymentHistory.tsx`
- Modify: `src/components/Steps.tsx`

**Interfaces:**
- Consumes: `Panel`, existing `validateLibraryInput`, `validateShiftSet`, `draftsToShiftInputs`, `submitPlanPayment`, `uqr.renderSVG` and plan domain helpers.
- Produces: one-save library editing and one clear payment path.

- [ ] **Step 1: Keep profile validation behaviour covered by current pure tests**

Run existing validation tests before refactoring:

```bash
npm test -- src/domain/shifts.test.ts src/domain/phone.test.ts src/domain/plan.test.ts
```

Expected: all pass. Do not change shift/no-overlap, phone normalization or plan-stacking rules.

- [ ] **Step 2: Implement grouped profile panels with one save model**

In `LibraryEditor.tsx`:
- Use `Panel` groups in this exact order: About; Where students find you; Seats and hours; Amenities; Shifts and fees; Photos.
- Desktop: place related panels in two columns when their field density is comparable; Shifts and Photos span the content width.
- Render one sticky Save bar only when the draft differs from original data.
- Save sequence: `updateLibrary`, then changed `updateShift` calls, then `addShift` calls. If a repository call fails, retain the draft and show its error.
- Preserve one immediate shift toggle; show the existing Undo toast only after a successful toggle.
- On `beforeunload`, warn only when dirty state is true.

- [ ] **Step 3: Keep onboarding as a true three-step form**

In `OnboardingWizard.tsx`:
- Steps: Your library → Seats and shifts → Photos and extras.
- Validate only current step before Continue; focus the first invalid field.
- Keep entered draft state while moving Back.
- Final submit calls `createLibrary(input, shifts)` once.
- Success uses `SuccessMoment` and explains review, 14-day trial start, and student visibility.

- [ ] **Step 4: Simplify the plan page to one payment decision**

In `Plan.tsx`, `PaymentCard.tsx` and `PaymentHistory.tsx`:
- Status panel: trial/active/expired message, end date and days left.
- Payment panel sequence: Pay ₹199 → Enter UTR → We verify.
- Desktop: UPI ID + Copy and QR. Phone: UPI deep link + Copy; QR under an explicit "Pay from another phone" disclosure.
- Keep UTR input exact at 12 digits, show `N of 12 digits`, and show failed reason inline.
- Payment history is a chronological row/table below or beside the payment panel; avoid oversized cards for each past payment.

- [ ] **Step 5: Verify profile and billing**

Run:

```bash
npm test -- src/domain/shifts.test.ts src/domain/phone.test.ts src/domain/plan.test.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

Manual dummy checks:
1. Anil edits library name, an amenity and a shift fee, then uses one Save action; refresh and confirm all values persist.
2. Rekha sees rejection reason and **Save and resubmit**.
3. Farah sees profile read-only state and can submit a plan payment.
4. Manoj submits a valid UTR, then Joel verifies it; confirm payment history and extended plan date.

---

### Task 6: Convert admin into desktop review queues and mobile records

**Files:**
- Modify: `src/pages/admin/Libraries.tsx`
- Modify: `src/pages/admin/Payments.tsx`
- Modify: `src/pages/admin/Places.tsx`
- Modify: `src/components/admin/AdminBits.tsx`
- Modify: `src/components/admin/planView.ts`

**Interfaces:**
- Consumes: `Panel`, `OperationalRow`, `services.listLibrariesForAdmin`, `services.listAllPlanPayments`, `planState`, `planStatusView`, `formatShiftCount`, `formatShiftRange`.
- Produces: comparable row-queue UI for library and payment review.

- [ ] **Step 1: Add pure status ordering assertions**

Append to `src/domain/presentation.test.ts`:

```ts
it('keeps requests ahead of overdue and expiring items when mixing dashboard work', () => {
  expect(rankAttention([
    { id: 'e', kind: 'expiring', daysLeft: 7 },
    { id: 'r', kind: 'request', createdAt: '2026-10-17T12:00:00Z' },
    { id: 'o', kind: 'overdue', daysLeft: -1 },
  ]).map((x) => x.id)).toEqual(['r', 'o', 'e'])
})
```

Run: `npm test -- src/domain/presentation.test.ts`

Expected: PASS.

- [ ] **Step 2: Redesign Admin Libraries**

In `Libraries.tsx`:
- Keep summary stat tiles, filter tabs and search.
- Default to Needs review when pending rows exist.
- Desktop table columns: Library, Owner, Location, Seats, Shifts, Submitted, Status, Actions.
- Pending rows sort oldest first; other tabs newest first.
- Actions remain visible within the row: Approve, Reject, Details. Hide low-priority columns progressively before horizontal scrolling.
- Phone record shows the same field order and has a compact action footer.
- Detail dialog displays complete shifts as text: name, time, fee, On/Off.

- [ ] **Step 3: Redesign Admin Payments**

In `Payments.tsx`:
- Pending UTR is the one focused decision panel: UTR, Copy, amount, library, owner, submitted time, Verify, Mark failed.
- History becomes dense desktop rows with Library, Owner, Amount, UTR, Decided, Status; phone uses records.
- Preserve pending/verified/failed filters and failure reason.
- Do not create a card per payment on desktop.

- [ ] **Step 4: Make Cities and Areas two equal management panels**

In `Places.tsx`:
- Desktop: equal Cities and Areas panels, matching headers, padding and internal scroll max height.
- City row: name, number of areas, choose affordance, active toggle.
- Area row: name and active toggle.
- Phone: Cities above Areas, each record at least 44px high.

- [ ] **Step 5: Verify admin flow**

Run:

```bash
npm test -- src/repositories/mock/mockRules.test.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

Manual dummy checks:
1. Joel → Libraries: approve Lakshya, confirm its trial starts and it leaves Needs review.
2. Joel → Libraries: reject a pending library with reason; confirm owner sees it.
3. Joel → Payments: verify Quiet Hours payment once; attempt a second verify and confirm conflict feedback.
4. At 1280px actions are visible without horizontal scroll; at 390px all row information remains available in records.

---

### Task 7: Refactor public discovery and library detail to text-first availability

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/components/landing/HeroSeatGrid.tsx`
- Modify: `src/components/landing/OwnerProductPeek.tsx`
- Modify: `src/components/landing/LibraryTeaserCard.tsx`
- Modify: `src/pages/Discover.tsx`
- Modify: `src/components/student/LibraryCard.tsx`
- Modify: `src/components/student/FilterSheet.tsx`
- Modify: `src/components/student/discoverOptions.ts`
- Modify: `src/pages/LibraryDetail.tsx`
- Modify: `src/components/CardGrid.tsx`

**Interfaces:**
- Consumes: `availabilityLabel`, `cardColumnsFor`, `PublicLibrary`, `PublicShift`, `searchLibraries`, `getPublicLibrary`, `requestSeat`.
- Produces: equal-height public listing cards and text-only shift choices.

- [ ] **Step 1: Add public availability-label tests**

Append to `src/domain/presentation.test.ts`:

```ts
it('labels public shift availability consistently', () => {
  expect(availabilityLabel(0).label).toBe('Full')
  expect(availabilityLabel(1).label).toBe('1 free')
  expect(availabilityLabel(31).label).toBe('31 free')
})
```

Run: `npm test -- src/domain/presentation.test.ts`

Expected: PASS.

- [ ] **Step 2: Build the final textual library card**

In `components/student/LibraryCard.tsx`:
- Header: initials tile or first real photo, one-line library name with `title`, area/city.
- Body: three fixed-height text shift rows: name + time on left; Full/N free badge on right.
- Footer: `from ₹X / month` and View.
- Use `CardGrid`/`GridCard`/`CardFooter`; no `SeatStrip`, `SeatGrid`, visual seat bars or decorative availability graph.
- Keep exactly one stretched Link for the full card.

- [ ] **Step 3: Rebuild Discover around search and rows of cards**

In `Discover.tsx`:
- Order: library-name search; city/area; Filters trigger; applied filter chips; result count + sort; cards.
- Keep fee and amenities inside the phone `FilterSheet`.
- Search matches library name, area and landmark.
- Keep URL query synchronization for search, city, area, filters and sort.
- Render `LoadingState` cards with the same card grid dimensions.

- [ ] **Step 4: Restrict seat visual to the homepage hero and Owner Seats**

- Home hero keeps `HeroSeatGrid` and its shift interaction; no repeated seat visuals elsewhere on Home.
- `OwnerProductPeek` uses text rows and status labels, not `SeatStrip`.
- `LibraryDetail` has no fake photo/seat cover when the library has no photo.
- Shift choice cards contain only shift name, time, fee and text availability.

- [ ] **Step 5: Keep library detail request flow explicit**

In `LibraryDetail.tsx`:
- Default to the first available shift.
- The action panel says `Request a seat in Afternoon` (or selected shift name).
- Signed out: Log in to request a seat.
- Student without a valid phone: link to Profile with a plain explanation.
- Pending: request sent + cancel.
- Existing member: `You're in this shift`.
- Full shift: still allow request but state the owner replies when a seat opens.
- Keep Call and Google Maps as clear secondary actions.

- [ ] **Step 6: Verify discovery and request loop**

Run:

```bash
npm test -- src/domain/presentation.test.ts src/repositories/mock/mockRules.test.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

Manual dummy checks:
1. At 1280px, four library cards form a 2×2 equal-height grid; at 390px cards stack.
2. Filter Lucknow → Aliganj and select Evening on Nalanda.
3. Sign in as a student with a phone, request a seat, then cancel it.
4. Confirm no mini seat-dot/bar graphics on Discover or library detail.

---

### Task 8: Simplify student request and membership pages

**Files:**
- Modify: `src/pages/student/MyRequests.tsx`
- Modify: `src/pages/student/MyMembership.tsx`
- Modify: `src/components/UpdatesBanner.tsx`
- Modify: `src/components/Panel.tsx`

**Interfaces:**
- Consumes: `Panel`, `availabilityLabel`, `MySeatRequest`, `MyMembership`, `memberPhase`, `memberDaysLeft`, `whatsappLink`, `formatPhone`.
- Produces: concise student status records and membership tickets that do not use seat charts.

- [ ] **Step 1: Keep membership expiry state under existing pure tests**

Run:

```bash
npm test -- src/domain/members.test.ts src/domain/dates.test.ts
```

Expected: PASS before markup changes.

- [ ] **Step 2: Refactor My Requests as two status lists**

In `MyRequests.tsx`:
- Render Waiting first, then Decided.
- Each request has Library, Shift, requested date and written status.
- Pending includes one Cancel action with confirmation.
- Approved includes View membership; rejected includes Find another library.
- Desktop uses concise rows; mobile uses focused records.

- [ ] **Step 3: Refactor My Membership as per-shift tickets**

In `MyMembership.tsx`:
- Group memberships by library name.
- Each ticket has seat number, shift/time, start/end dates, written days left and payment disclosure.
- Only expiring/overdue membership shows the attention panel plus Message on WhatsApp and Call.
- Active memberships say `No action needed right now`; do not give them a decorative progress graph or seat chart.
- Use equal cards only when multiple memberships share a desktop row; mobile stacks naturally.

- [ ] **Step 4: Ensure Updates banner does not double-show an action**

In `UpdatesBanner.tsx`:
- Keep request/payment events until dismissed.
- A banner links to the relevant page; it does not embed a second approve, renew or payment form.

- [ ] **Step 5: Verify student states**

Run:

```bash
npm test -- src/domain/members.test.ts src/repositories/mock/mockRules.test.ts
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

Manual dummy checks:
1. Riya sees both Morning and Evening memberships.
2. Riya’s expiring membership exposes Message and Call; active membership does not.
3. Aman sees pending requests and can cancel one.
4. After owner approval, switch to the student account and confirm the updates banner links to membership.

---

### Task 9: Add repeatable visual and accessibility regression checks

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `e2e/ui-redesign.spec.ts`
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: existing dummy mode (`VITE_DATA_MODE=mock`), Demo login flow, page titles and aria labels introduced by prior tasks.
- Produces: `npm run test:e2e` and documented viewport/flow checks.

- [ ] **Step 1: Add exact Playwright dependency and scripts**

Add only this exact dev dependency:

```json
"@playwright/test": "1.52.0"
```

Add scripts:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 2: Configure local Vite for E2E**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
})
```

- [ ] **Step 3: Implement critical dummy-mode E2E flows**

Create `e2e/ui-redesign.spec.ts` with these tests:

```ts
import { expect, test } from '@playwright/test'

test('owner Today ranks requests before overdue and expiring work', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Owners' }).click()
  await page.getByRole('button', { name: /Anil Verma/ }).click()
  await expect(page).toHaveURL('/owner')
  await expect(page.getByRole('heading', { name: 'Needs your attention' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Review requests/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Overdue/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Expiring in 7 days/ })).toBeVisible()
})

test('library cards remain text-first at mobile width', async ({ page }) => {
  await page.goto('/discover')
  await expect(page.getByRole('heading', { name: 'Find a study library' })).toBeVisible()
  await expect(page.getByText('Morning')).toBeVisible()
  await expect(page.locator('[data-seat-strip], [data-availability-graph]')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
})

test('admin library review is a desktop row queue', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'Desktop table assertion')
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Admins' }).click()
  await page.getByRole('button', { name: /Joel/ }).click()
  await expect(page.getByRole('table', { name: 'Libraries' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Approve Lakshya/ })).toBeVisible()
})
```

If seat-strip markers do not exist, add `data-seat-strip` only to the approved full `SeatGrid`/homepage hero implementation; do not add them to public cards.

- [ ] **Step 4: Add viewport and text-scale manual checklist to README**

Append a `## UI verification` section:

```md
Before merging a UI change, test 320px, 390px, 768px and 1280px widths; Chrome text scale at 200%; keyboard-only tab order; reduced motion; and the owner/student/admin dummy flows from the E2E suite.
```

Update `docs/ROADMAP.md` Step 11 with the same viewport and operational-row checks.

- [ ] **Step 5: Run the full redesign verification suite**

Run:

```bash
npm test
npm run test:e2e
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm run build
```

Expected: all unit/E2E tests, type checks, lint and production build pass. Capture failures as Playwright trace/screenshot artifacts and fix before declaring the redesign complete.

---

## Plan self-review

### Spec coverage

| Spec requirement | Plan task(s) |
|---|---|
| Dashboard with panels and ranked Needs attention | 1, 3 |
| Desktop rows / phone records for operations | 1, 4, 6, 8 |
| Full SeatGrid only on Seats and hero | 4, 7 |
| Textual equal library cards and no card graphs | 1, 7 |
| Profile grouped panels and one save model | 5 |
| Payment decision clarity and history | 5, 6 |
| Admin libraries/payments/cities hierarchy | 6 |
| Student discovery, requests and membership | 7, 8 |
| Accessibility/responsive/error/empty requirements | 2–9, especially 9 |
| Dummy-data flows remain functional | 3–9 |

### Placeholder scan

Searched this plan for `TODO`, `TBD`, `implement later`, `similar to Task`, and vague validation instructions. None remain. Every test and interface introduced by later tasks is defined in Task 1 or described as an existing repository/service contract.

### Type consistency

- `AttentionInput`, `rankAttention`, `availabilityLabel`, `cardColumnsFor` and `limitVisible` are introduced in Task 1 and used consistently in later tasks.
- No service signatures change; all service calls stay those exposed by `src/services/createServices.ts`.
- UI components (`Panel`, `OperationalRow`) are introduced in Task 1 before their later use.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-18-studyseat-management-ui-redesign.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks and keep UI slices isolated.
2. **Inline Execution** — execute the tasks in this session using `executing-plans`, in batches with review checkpoints.

Choose one approach before implementation begins.
