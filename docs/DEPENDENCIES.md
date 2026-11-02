# ApplyIQ dependency maintenance

All direct dependencies were checked against npm's stable `latest` tag on November 2 2026. Installed versions are pinned in `package.json`, and the lockfile includes compatible transitive updates.

The update includes Next.js 16.4.4, React 19.3.1, Stripe 23.1.0, Anthropic SDK 1.4.0, Supabase JS 2.118.0, Supabase SSR 0.12.7, and Vitest 5.1.0. The installed dependency tree passes `npm ls --depth=0`.

## Version exceptions

| Package | Installed | Latest checked | Reason |
| --- | --- | --- | --- |
| `eslint` | 9.39.5 | 10.14.0 | The current Next.js lint plugin dependencies do not declare support for ESLint 10. |
| `typescript` | 6.0.3 | 7.0.2 | The current TypeScript ESLint dependencies require TypeScript below 6.1. |
| `tailwindcss` | 4.3.3 | 4.3.4 | Installing 4.3.4 failed because `@tailwindcss/node@4.3.4` was unavailable. |
| `@tailwindcss/postcss` | 4.3.3 | 4.3.4 | Kept aligned with the installable Tailwind set. |

No dependency was forced past its peer requirements to make the version list appear current. Recheck these constraints on the next maintenance pass.

## Audit result

The production-only audit reported zero findings. The full audit retained 16 moderate findings in development lint tooling, rooted in legacy minimatch dependencies. npm suggested incompatible downgrades for that chain, so `npm audit fix --force` was not used. The remaining findings are not reported as resolved.

```sh
npm outdated
npm audit
npm audit --omit=dev
npm ls --depth=0
```

Apply compatible updates first, review major-version migration notes and peer ranges, then run type checks, lint, tests, and the production build. Verify actual billing and database behavior when upgrading those SDKs; type assertions must not hide changed response fields.
