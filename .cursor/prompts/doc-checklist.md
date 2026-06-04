Run `git diff HEAD` (or `git diff --cached` if changes are staged) and review every changed file. Then go through the checklist below and flag any documentation that should be updated but wasn't.

## Checklist

### 1. `docs/architecture.md`
- [ ] New module added or removed under `src/`?
- [ ] New external integration (API, service, queue)?
- [ ] Change to the auth flow or guards?
- [ ] New or removed API endpoint?
- [ ] Module dependency graph changed?

### 2. `docs/database.md`
- [ ] Fields added, removed, or renamed in `prisma/schema.prisma`?
- [ ] New model or relation?
- [ ] New migration created under `prisma/migrations/`?
- [ ] Business rules around data changed?

### 3. `docs/conventions.md`
- [ ] New file-naming or folder pattern introduced?
- [ ] New shared pattern (decorator, pipe, filter, interceptor)?
- [ ] "How to add a feature module" checklist still accurate?

### 4. `docs/tech-stack.md`
- [ ] New dependency added to `package.json`?
- [ ] Major version bump of an existing dependency?
- [ ] Dependency removed?

### 5. `.env.example`
- [ ] New environment variable read via `ConfigService` or `process.env`?
- [ ] Existing variable renamed or removed?

### 6. `AGENTS.md`
- [ ] Directory structure section still matches `src/` layout?
- [ ] Commands table still accurate (new scripts in `package.json`)?
- [ ] Key architectural decisions section still current?

### 7. `.cursor/rules/rule.mdc`
- [ ] New convention established that the AI should always follow?
- [ ] Existing rule contradicted by the current changes?

## Output

For each item that needs attention, state:
- **Which doc** needs updating.
- **What changed** in the codebase (cite the diff).
- **What to add or fix** in the doc.

If everything is up to date, confirm that no documentation changes are needed.
