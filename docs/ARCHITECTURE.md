# NearMe Library — Architecture

```
Browser (React + Vite + TypeScript + Tailwind)  — hosted on Render (static site)
   │  Pages → Hooks → Services → Repositories
   ▼
Supabase: Auth (Google) · Postgres (tables + RLS + functions) · Storage (photos)
```

No custom backend. The database is the authority for roles, plan dates, payment status, and visibility. Frontend rules exist only to display things.

## Layers

| Layer | Folder | Responsibility | May import |
|---|---|---|---|
| Pages | `src/pages` | Render a screen | components, hooks |
| Components | `src/components` | Reusable UI, no data access | domain |
| Hooks | `src/hooks` | Loading/error/data state for a screen | services, domain |
| Services | `src/services` | One use case each | repository **interfaces**, domain |
| Repositories | `src/repositories` | Interfaces + Supabase implementations | `lib/supabase`, domain |
| Domain | `src/domain` | Types and pure functions (no I/O) | nothing |
| Lib | `src/lib` | Supabase client, route guards, wiring | — |

Dependencies point downward only. Only `src/repositories/supabase/*` and `src/lib/supabase.ts` import `@supabase/supabase-js`.

```
src/
├─ pages/            Home, Discover, LibraryDetail, owner/*, student/*, admin/*
├─ components/       Button, Table, SeatGrid, TrialBanner, StateView
├─ hooks/            useAuth, useLibrary, useMembers, useSeats, usePlan
├─ services/         addMember, renewMember, requestSeat, submitPlanPayment ...
├─ repositories/
│  ├─ MemberRepository.ts        (interface)
│  ├─ SeatRepository.ts          (interface)
│  ├─ ...
│  └─ supabase/                  (implementations)
├─ payments/
│  ├─ PlanPaymentProvider.ts     (interface)
│  └─ ManualUpiProvider.ts
├─ domain/           types, isExpired, daysLeft, formatRupees, todayIST
└─ lib/              supabase.ts, guards.tsx, container.ts
```

## SOLID

### S — Single responsibility
Each file has one reason to change.
- `MemberRepository` reads/writes members only. `FeeRepository` handles fees only.
- `renewMember` service does one use case. It does not render, cache, or format.
- Pages do not call Supabase; hooks do not contain SQL or business rules.

### O — Open/closed
Add behaviour by adding code, not editing working code.
- New payment method = new class implementing `PlanPaymentProvider`; callers unchanged.
- New amenity or filter = data/config change, not a new branch in every page.

### L — Liskov substitution
Any implementation can replace another without callers noticing.
- `PlanPaymentProvider` returns a payment whose status the **database** decides. Manual UPI returns `pending` (admin verifies later). A future gateway also returns `pending` and is confirmed by a server webhook. Callers always re-read status, so both are interchangeable.
- In-memory fake repositories used in tests behave exactly like the Supabase ones (same errors, same return shapes).

### I — Interface segregation
Small interfaces per need instead of one `Database` interface.

```ts
// repositories/MemberRepository.ts
export interface MemberRepository {
  listByLibrary(libraryId: string): Promise<Member[]>;
  add(input: NewMember): Promise<Member>;
  update(id: string, patch: MemberPatch): Promise<Member>;
  remove(id: string): Promise<void>;          // sets status = 'removed'
  renew(input: RenewInput): Promise<void>;    // calls renew_member RPC
}
```

A service receives only the interfaces it uses.

### D — Dependency inversion
Services depend on interfaces; concrete Supabase classes are chosen in one place.

```ts
// services/renewMember.ts
export const makeRenewMember = (members: MemberRepository) =>
  async (input: RenewInput) => {
    assertValidRenewal(input);   // domain: amount > 0, new expiry after current
    await members.renew(input);  // database enforces the real rules
  };

// lib/container.ts — the only place that knows about Supabase classes
const members = new SupabaseMemberRepository(supabase);
export const services = {
  renewMember: makeRenewMember(members),
  // ...
};
```

## Guardrails (keep it simple)

- Plain TypeScript functions and small interfaces. No DI library, no class hierarchies beyond interface + implementation.
- One service per use case; thin is fine. Don't add a layer that only forwards calls unless it's a repository boundary.
- Business rules that protect money, roles, or visibility live in SQL. Frontend checks are for fast feedback only.
- Errors: repositories map Supabase errors to a small `AppError` type (`not_found`, `forbidden`, `conflict`, `network`, `unknown`) so hooks and pages never see Supabase-specific errors.

## Testing

- `domain/`: unit tests (Vitest) for pure functions.
- `services/`: unit tests with in-memory fake repositories.
- Database: RLS and function tests as described in `DATABASE.md`. These are the authoritative tests for business rules.
