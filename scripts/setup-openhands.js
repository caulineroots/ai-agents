#!/usr/bin/env node
/**
 * setup-openhands.js
 *
 * Auto-detects the project stack and generates optimized AI agent instructions
 * for both OpenHands (.openhands_instructions) and Claude Code (CLAUDE.md).
 *
 * Usage:
 *   node scripts/setup-openhands.js [project-root]
 *
 * Outputs:
 *   .openhands_instructions  — loaded automatically by OpenHands
 *   CLAUDE.md                — loaded automatically by Claude Code
 */

const fs   = require('fs');
const path = require('path');

// ─── Stack detection ─────────────────────────────────────────────────────────

function detectStack(root) {
  const stack = {
    language:  null,
    framework: null,
    runtime:   null,
    testing:   null,
    database:  null,
    styling:   null,
    infra:     [],
    ai:        [],
    extras:    [],
  };

  // ── JavaScript / TypeScript (package.json) ──────────────────────────────
  const pkgFile = path.join(root, 'package.json');
  if (fs.existsSync(pkgFile)) {
    const pkg  = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const has  = (k) => Boolean(deps[k]);

    stack.language = has('typescript') ? 'TypeScript' : 'JavaScript';
    stack.runtime  = 'Node.js';

    // Framework
    if (has('next'))            stack.framework = 'Next.js';
    else if (has('nuxt'))       stack.framework = 'Nuxt.js';
    else if (has('react'))      stack.framework = 'React';
    else if (has('vue'))        stack.framework = 'Vue 3';
    else if (has('svelte'))     stack.framework = 'Svelte';
    else if (has('@nestjs/core')) stack.framework = 'NestJS';
    else if (has('fastify'))    stack.framework = 'Fastify';
    else if (has('express'))    stack.framework = 'Express';
    else if (has('hono'))       stack.framework = 'Hono';

    // Testing
    if (has('vitest'))          stack.testing = 'Vitest';
    else if (has('jest'))       stack.testing = 'Jest';
    else if (has('mocha'))      stack.testing = 'Mocha';
    else if (has('playwright')) stack.testing = 'Playwright';

    // Database / ORM
    if (has('prisma') || has('@prisma/client')) stack.database = 'Prisma (PostgreSQL/MySQL/SQLite)';
    else if (has('drizzle-orm'))                stack.database = 'Drizzle ORM';
    else if (has('mongoose'))                   stack.database = 'MongoDB + Mongoose';
    else if (has('pg'))                         stack.database = 'PostgreSQL (pg)';
    else if (has('mysql2'))                     stack.database = 'MySQL';
    else if (has('better-sqlite3'))             stack.database = 'SQLite';

    // Styling
    if (has('tailwindcss'))         stack.styling = 'Tailwind CSS';
    else if (has('@mui/material'))  stack.styling = 'Material UI';
    else if (has('styled-components')) stack.styling = 'Styled Components';
    else if (has('shadcn-ui') || has('@radix-ui/react-dialog')) stack.styling = 'shadcn/ui + Radix';

    // AI / LLM SDKs
    if (has('@anthropic-ai/sdk'))   stack.ai.push('Anthropic SDK');
    if (has('openai'))              stack.ai.push('OpenAI SDK');
    if (has('@langchain/core') || has('langchain')) stack.ai.push('LangChain');
    if (has('@ai-sdk/anthropic') || has('ai')) stack.ai.push('Vercel AI SDK');

    // Infra
    if (has('@supabase/supabase-js'))  stack.infra.push('Supabase');
    if (has('firebase'))               stack.infra.push('Firebase');
    if (has('@aws-sdk/client-s3'))     stack.infra.push('AWS S3');
    if (has('zod'))                    stack.extras.push('Zod (schema validation)');
    if (has('trpc') || has('@trpc/server')) stack.extras.push('tRPC');
    if (has('stripe'))                 stack.extras.push('Stripe');
  }

  // ── Python ──────────────────────────────────────────────────────────────
  const reqFile     = path.join(root, 'requirements.txt');
  const pyproject   = path.join(root, 'pyproject.toml');
  const pipfilePath = path.join(root, 'Pipfile');

  const pyFiles = [reqFile, pyproject, pipfilePath].filter(fs.existsSync);
  if (pyFiles.length > 0 && !stack.language) {
    stack.language = 'Python';
    const content = pyFiles.map(f => fs.readFileSync(f, 'utf8').toLowerCase()).join('\n');

    if (content.includes('django'))      stack.framework = 'Django';
    else if (content.includes('fastapi')) stack.framework = 'FastAPI';
    else if (content.includes('flask'))  stack.framework = 'Flask';
    else if (content.includes('litestar')) stack.framework = 'Litestar';

    if (content.includes('pytest'))      stack.testing  = 'pytest';
    if (content.includes('sqlalchemy'))  stack.database = 'SQLAlchemy';
    if (content.includes('alembic'))     stack.extras.push('Alembic migrations');
    if (content.includes('pydantic'))    stack.extras.push('Pydantic');
    if (content.includes('anthropic'))   stack.ai.push('Anthropic SDK');
    if (content.includes('openai'))      stack.ai.push('OpenAI SDK');
    if (content.includes('langchain'))   stack.ai.push('LangChain');
  }

  // ── Go ──────────────────────────────────────────────────────────────────
  const gomod = path.join(root, 'go.mod');
  if (fs.existsSync(gomod) && !stack.language) {
    stack.language = 'Go';
    const content = fs.readFileSync(gomod, 'utf8');
    if (content.includes('gin-gonic'))  stack.framework = 'Gin';
    else if (content.includes('fiber')) stack.framework = 'Fiber';
    else if (content.includes('echo'))  stack.framework = 'Echo';
    else if (content.includes('chi'))   stack.framework = 'Chi';
  }

  // ── Rust ────────────────────────────────────────────────────────────────
  const cargoToml = path.join(root, 'Cargo.toml');
  if (fs.existsSync(cargoToml) && !stack.language) {
    stack.language = 'Rust';
    const content = fs.readFileSync(cargoToml, 'utf8');
    if (content.includes('actix-web')) stack.framework = 'Actix-web';
    else if (content.includes('axum')) stack.framework = 'Axum';
    else if (content.includes('rocket')) stack.framework = 'Rocket';
  }

  // ── .NET / C# ───────────────────────────────────────────────────────────
  const csproj = fs.readdirSync(root).find(f => f.endsWith('.csproj'));
  if (csproj && !stack.language) {
    stack.language  = 'C#';
    stack.framework = '.NET';
    stack.testing   = 'xUnit';
  }

  return stack;
}

// ─── Project metadata ────────────────────────────────────────────────────────

function getProjectMeta(root) {
  const pkgFile = path.join(root, 'package.json');
  let name = path.basename(root);
  let description = '';

  if (fs.existsSync(pkgFile)) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    if (pkg.name)        name = pkg.name;
    if (pkg.description) description = pkg.description;
  }

  // Detect if git repo and get last commit message
  let lastCommit = '';
  try {
    const { execSync } = require('child_process');
    lastCommit = execSync('git log -1 --pretty=%B', { cwd: root, stdio: ['pipe','pipe','ignore'] })
      .toString().trim();
  } catch (_) {}

  return { name, description, lastCommit };
}

// ─── System prompt generator ─────────────────────────────────────────────────

function generateInstructions(stack, meta, root) {
  const lines = [];

  lines.push(`# AI Agent Instructions — ${meta.name}`);
  lines.push('');
  lines.push('> Auto-generated by setup-openhands.js. Edit freely — this file is yours.');
  lines.push('');

  // ── Project summary ──────────────────────────────────────────────────────
  lines.push('## Project');
  if (meta.description) lines.push(`**${meta.description}**`);
  lines.push('');

  const stackSummary = [
    stack.language,
    stack.framework,
    stack.database,
    stack.styling,
  ].filter(Boolean).join(' · ');

  lines.push(`**Stack:** ${stackSummary || 'Not detected — add manually below'}`);
  if (stack.ai.length)    lines.push(`**AI/LLM:** ${stack.ai.join(', ')}`);
  if (stack.infra.length) lines.push(`**Infra:** ${stack.infra.join(', ')}`);
  if (stack.extras.length) lines.push(`**Extras:** ${stack.extras.join(', ')}`);
  lines.push('');

  // ── Core rules ───────────────────────────────────────────────────────────
  lines.push('## Rules — always follow');
  lines.push('');
  lines.push('- Never claim a file was edited unless you output the actual diff or new content.');
  lines.push('- Always prefer editing existing files over creating new ones.');
  lines.push('- Do not add comments that just describe what the code does. Only explain non-obvious intent.');
  lines.push('- Do not install new dependencies without asking first.');
  lines.push('- If something is unclear, ask one specific question instead of assuming.');
  lines.push('- After each change, summarize what was done and what still needs doing.');
  lines.push('');

  // ── Framework-specific rules ──────────────────────────────────────────────
  if (stack.framework === 'Next.js') {
    lines.push('## Next.js conventions');
    lines.push('');
    lines.push('- Use App Router (`app/`) unless the project already uses Pages Router (`pages/`).');
    lines.push('- Prefer Server Components by default. Use `"use client"` only when strictly needed (event handlers, browser APIs, hooks).');
    lines.push('- Data fetching happens in Server Components or Route Handlers, not in client components.');
    lines.push('- API routes live in `app/api/[route]/route.ts`.');
    lines.push('- Use `next/image` for all images. Use `next/link` for all internal navigation.');
    lines.push('- Environment variables exposed to the browser must be prefixed with `NEXT_PUBLIC_`.');
    lines.push('');
  }

  if (stack.framework === 'React') {
    lines.push('## React conventions');
    lines.push('');
    lines.push('- Functional components only. No class components.');
    lines.push('- Custom hooks for shared stateful logic (prefix with `use`).');
    lines.push('- Avoid prop drilling beyond 2 levels — use context or state management.');
    lines.push('');
  }

  if (stack.framework === 'FastAPI') {
    lines.push('## FastAPI conventions');
    lines.push('');
    lines.push('- Use Pydantic models for all request/response schemas.');
    lines.push('- Async endpoints (`async def`) for I/O-bound operations.');
    lines.push('- Dependency injection via `Depends()` for shared logic.');
    lines.push('- Router files in `routers/`, models in `models/`, schemas in `schemas/`.');
    lines.push('');
  }

  if (stack.framework === 'Django') {
    lines.push('## Django conventions');
    lines.push('');
    lines.push('- Follow the app-per-feature structure.');
    lines.push('- Use class-based views for CRUD, function-based for simple logic.');
    lines.push('- Migrations must be created and reviewed before any model change is considered done.');
    lines.push('- Never put business logic in views — use service functions or model methods.');
    lines.push('');
  }

  if (stack.framework === 'NestJS') {
    lines.push('## NestJS conventions');
    lines.push('');
    lines.push('- Module per feature. Each module has its own controller, service, and DTO.');
    lines.push('- Use DTOs with `class-validator` decorators for all inputs.');
    lines.push('- Dependency injection through constructor, not manual instantiation.');
    lines.push('');
  }

  // ── Language-specific rules ───────────────────────────────────────────────
  if (stack.language === 'TypeScript') {
    lines.push('## TypeScript rules');
    lines.push('');
    lines.push('- Strict mode is on. No `any` unless absolutely unavoidable — use `unknown` instead.');
    lines.push('- Prefer `interface` for objects, `type` for unions and aliases.');
    lines.push('- Always type function parameters and return values explicitly.');
    lines.push('- No non-null assertions (`!`) without a comment explaining why it\'s safe.');
    lines.push('');
  }

  if (stack.language === 'Python') {
    lines.push('## Python rules');
    lines.push('');
    lines.push('- Type hints on all function signatures.');
    lines.push('- Use `pathlib.Path` over `os.path`.');
    lines.push('- Prefer dataclasses or Pydantic models over raw dicts for structured data.');
    lines.push('- f-strings for string formatting, not `.format()` or `%`.');
    lines.push('');
  }

  // ── Database rules ────────────────────────────────────────────────────────
  if (stack.database?.includes('Prisma')) {
    lines.push('## Prisma rules');
    lines.push('');
    lines.push('- Schema changes must go through `prisma migrate dev`, never direct DB edits.');
    lines.push('- Use `select` to fetch only needed fields — never fetch full records when a subset suffices.');
    lines.push('- Wrap related mutations in `prisma.$transaction()` for atomicity.');
    lines.push('');
  }

  // ── Testing rules ─────────────────────────────────────────────────────────
  if (stack.testing) {
    lines.push(`## Testing (${stack.testing})`);
    lines.push('');
    lines.push('- Write tests alongside the feature, not after.');
    lines.push('- Unit tests for pure functions and utilities. Integration tests for API routes.');
    lines.push('- Test file naming: `*.test.ts` or `*.spec.ts` next to the source file.');
    lines.push('');
  }

  // ── AI SDK rules ──────────────────────────────────────────────────────────
  if (stack.ai.includes('Anthropic SDK')) {
    lines.push('## Anthropic SDK rules');
    lines.push('');
    lines.push('- Always handle API errors explicitly — never swallow `AnthropicError`.');
    lines.push('- Use streaming (`stream: true`) for long-running generations shown to users.');
    lines.push('- System prompts are strings, not messages. Keep them in separate `.md` files.');
    lines.push('- Token budgets: estimate input before calling, log actual usage in dev.');
    lines.push('');
  }

  // ── Styling rules ─────────────────────────────────────────────────────────
  if (stack.styling === 'Tailwind CSS') {
    lines.push('## Tailwind CSS rules');
    lines.push('');
    lines.push('- Utility classes directly in JSX. No custom CSS files unless Tailwind can\'t do it.');
    lines.push('- Use `cn()` (clsx + tailwind-merge) for conditional class merging.');
    lines.push('- Responsive breakpoints: mobile-first (`sm:`, `md:`, `lg:`).');
    lines.push('');
  }

  // ── Workflow ──────────────────────────────────────────────────────────────
  lines.push('## Workflow');
  lines.push('');
  lines.push('- Before touching any file, state which files will be changed and why.');
  lines.push('- Make one logical change at a time. Commit after each working change.');
  lines.push('- If a task requires 3+ files to be changed, break it into sub-steps and confirm each.');
  lines.push('- When you finish a task, tell me: what was done, what to test, and what to watch out for.');
  lines.push('');

  // ── Placeholder for team conventions ──────────────────────────────────────
  lines.push('## Team conventions (fill in manually)');
  lines.push('');
  lines.push('<!-- Add your specific naming conventions, folder structure, or business rules here. -->');
  lines.push('<!-- Examples:');
  lines.push('  - Branch naming: feature/TICKET-description');
  lines.push('  - Commit format: "type(scope): message"');
  lines.push('  - API versioning: /api/v1/...');
  lines.push('  - Specific business domain rules');
  lines.push('-->');
  lines.push('');

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const root = path.resolve(process.argv[2] || process.cwd());

  if (!fs.existsSync(root)) {
    console.error(`Directory not found: ${root}`);
    process.exit(1);
  }

  console.log(`\nScanning project: ${root}\n`);

  const stack = detectStack(root);
  const meta  = getProjectMeta(root);

  // Report what was detected
  console.log('Detected stack:');
  if (stack.language)  console.log(`  Language:  ${stack.language}`);
  if (stack.framework) console.log(`  Framework: ${stack.framework}`);
  if (stack.database)  console.log(`  Database:  ${stack.database}`);
  if (stack.styling)   console.log(`  Styling:   ${stack.styling}`);
  if (stack.testing)   console.log(`  Testing:   ${stack.testing}`);
  if (stack.ai.length) console.log(`  AI SDKs:   ${stack.ai.join(', ')}`);
  if (!stack.language) console.log('  (nothing detected — generic instructions will be generated)');
  console.log('');

  const content = generateInstructions(stack, meta, root);

  // Write .openhands_instructions (for OpenHands)
  const openhandsPath = path.join(root, '.openhands_instructions');
  fs.writeFileSync(openhandsPath, content, 'utf8');
  console.log(`Written: .openhands_instructions`);

  // Write CLAUDE.md (for Claude Code)
  const claudePath = path.join(root, 'CLAUDE.md');
  if (fs.existsSync(claudePath)) {
    const backup = claudePath + '.backup';
    fs.copyFileSync(claudePath, backup);
    console.log(`Backed up existing CLAUDE.md → CLAUDE.md.backup`);
  }
  fs.writeFileSync(claudePath, content, 'utf8');
  console.log(`Written: CLAUDE.md`);

  console.log('\nDone. Both files are now loaded automatically by OpenHands and Claude Code.');
  console.log('Edit the "Team conventions" section at the bottom to add your specific rules.\n');
}

main();
