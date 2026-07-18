# SIORG - Agent Rules

## Next.js 16

This version has breaking changes. Key notes:
- `middleware.ts` is deprecated → use `proxy.ts` (function export: `proxy`)
- Edge runtime is NOT supported in proxy. Use Node.js runtime only.
- Config flags renamed: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`

## Project Conventions

- **Framework:** Next.js 16 App Router + Turbopack
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase SSR (`@supabase/ssr`)
- **Validation:** Zod v4 (note: `z.coerce.date()` has no `required_error`, use default messages)
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript strict

## File Structure

- Pages: `src/app/(dashboard)/<module>/page.tsx`
- API: `src/app/api/<module>/route.ts`
- Components: `src/components/ui/` and `src/components/layout/`
- Types: `src/lib/types/database.ts`, `src/lib/types/api.ts`
- Validations: `src/lib/validations/`
- Proxy: `src/proxy.ts`

## API Response Format

All API routes return standardized envelope:
```typescript
ApiSuccess<T> | ApiError
// { success: true, data: T, meta?: ApiMeta }
// { success: false, error: { code: string, message: string } }
```

## Auth Flow

1. `src/proxy.ts` intercepts all `/api/*` requests
2. Refreshes Supabase session cookies
3. Attaches `x-user-id`, `x-user-email`, `x-user-role`, `x-user-status` to request headers
4. API routes read user info via `getUid(request)` and `getUserRole(request)` from `src/lib/api-response.ts`

## RLS Policies

- All policies are in `schema.sql`
- If changing RLS, must run SQL in Supabase Dashboard SQL Editor
- `schema.sql` is NOT auto-applied to database
