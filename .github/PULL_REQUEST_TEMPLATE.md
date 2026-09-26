## Summary

<!-- What changes and why. Link the issue: Closes #NNN -->

## How it was verified

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:unit`
- [ ] `npm run test:component`
- [ ] `npm run build`
- [ ] `npm run test:e2e` (or explain why not run — CI covers it)

## Checklist

- [ ] PR title follows Conventional Commits (`feat|fix|docs|chore|refactor|test|ci(scope): ...`)
- [ ] No secrets committed (`.env.local`, keys, tokens, `data/settings.local.json`)
- [ ] UI changes include screenshots (light + dark if affected)
- [ ] Tests added/updated for new behavior (or N/A with reason)
- [ ] Docs updated if product behavior changed (`docs/`, `README.md`)
- [ ] Provider contract respected (`LeadRepository` interface; no provider imports in UI/routes)

## Breaking changes / migration notes

<!-- Env or schema changes — or "None". Notion is not part of the runtime. -->
