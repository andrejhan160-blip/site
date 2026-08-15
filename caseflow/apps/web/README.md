# @caseflow/web

Next.js 15 App Router frontend: the desktop-first employee application and the
mobile-first client portal. See the [root README](../../README.md) for setup.

## Layout

```
src/
├── app/
│   ├── (app)/          employee app — dashboard, clients, cases, workflows, settings
│   ├── portal/         client portal — overview, documents, requests, messages
│   ├── login/          magic-link request
│   ├── auth/verify/    route handler that exchanges the token for a session
│   └── download/[id]/  redirects to a signed document URL
├── components/
│   ├── ui/             shadcn/ui-style primitives on Radix
│   ├── forms/          dialog + action plumbing, search, filters
│   ├── case/           stage timeline, documents, messages, case actions
│   └── layout/         shell, navigation, notifications, user menu
└── lib/                API client, session helpers, server actions, types
```

## How data flows

Pages are server components. `lib/api.ts` reads the session cookie from the
incoming request and forwards it to the API, so the browser never calls the API
directly and the token stays httpOnly on the web origin. Mutations are server
actions in `lib/actions.ts`, which call the API, revalidate the affected paths,
and return `{ ok, message }` for the form to render. Errors surface in the form
rather than as a crash.

`auth/verify` is a route handler, not a page: Next.js only allows cookies to be
written from route handlers and server actions.

## Design

Tokens live in `app/globals.css`. The organization's primary colour is applied
at runtime through `--brand-primary` on the layout, so branding follows the
tenant without a rebuild. Status colour is centralised in `components/ui/status.tsx`
— one place decides what "under review" looks like everywhere.

The employee app is desktop-first and information-dense where it needs to be;
the portal is mobile-first, one column, with large type and a single obvious
action per item.
