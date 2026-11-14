# Gates: pre-implementation foundation

OWNS: .env.example, .env.cloudflare.example, .gitignore, AGENTS.md, docs/ARCHITECTURE.md, docs/README.md, CODEBOOK.md, infra/cloudflare/**, src/**, tests/**, scripts/**, package.json, package-lock.json

Scope: Prepare environment templates, scalable repository guidance, and clearly safe cleanup for the landing migration without implementing the migration itself.

- [x] G1: Environment templates contain the required current and target configuration names without real credentials, and ignore rules prevent local secret files from being committed.
  CHECK: node -e "const fs=require('node:fs');const app=fs.readFileSync('.env.example','utf8');const cf=fs.readFileSync('.env.cloudflare.example','utf8');const ignore=fs.readFileSync('.gitignore','utf8');for(const k of ['NEXTAP_ENV','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SITE_URL','E2E_USER_OWNER_PASSWORD','SENTRY_AUTH_TOKEN'])if(!new RegExp('^'+k+'=', 'm').test(app))throw Error('missing app variable '+k);for(const k of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ZONE_ID','CLOUDFLARE_ACCESS_TEAM_DOMAIN','CLOUDFLARE_ACCESS_AUD'])if(!new RegExp('^'+k+'=', 'm').test(cf))throw Error('missing Cloudflare variable '+k);if(!/^CLOUDFLARE_API_TOKEN=$/m.test(cf))throw Error('Cloudflare token example must be blank');if(!ignore.includes('.env*')||!ignore.includes('!.env.cloudflare.example'))throw Error('env ignore/exception missing');console.log('environment templates gate passed')"
  EXPECT: environment templates gate passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=e8d111bb5942d6ae63d9c02601e1eb933c0b8a225ecd8914de40b18ab48995ad; exit=0; EXPECT=matched; output-sha256=43320f869fb319889308e7321a1f419a773829064888b5e5e859ee0c1091416b; output-bytes=34; shell=/bin/sh; cwd=/mnt/f/projects/NextapCloudflareMigration; path=58c2ec1854e7/52 entries

- [x] G2: Architecture and codebook guidance match the actual repository layout, and every linked local guide exists.
  CHECK: node -e "const fs=require('node:fs');for(const p of ['docs/ARCHITECTURE.md','docs/README.md','CODEBOOK.md','AGENTS.md'])if(!fs.existsSync(p))throw Error('missing '+p);console.log('repository guide gate passed')"
  EXPECT: repository guide gate passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=c2e856d9313f4c9026afab8e154b93e4f98eedb683c92ee986bc3cd631bba3dd; exit=0; EXPECT=matched; output-sha256=a66f45b32439465c5354b34148ce139bfae07ae98790999cf11c048cc1b5a31e; output-bytes=29; shell=/bin/sh; cwd=/mnt/f/projects/NextapCloudflareMigration; path=58c2ec1854e7/52 entries

- [ ] G3: Existing application behavior remains unchanged by this preparation.
  CHECK: npm run typecheck && npm test
  EXPECT: Test Files
  EVIDENCE: `npm run typecheck` passed. `npm test` failed only in the pre-existing `tests/unit/public-publication.test.ts`: the snapshot resolver test timed out and the fallback test received an undefined mocked RPC result. No preparation file is imported by that module.

- [x] G4: No production configuration or customer data is changed, and every removed file has no active source, route, CI, or documentation references.
  EVIDENCE: Reviewed tracked paths and references; no files were removed because no candidate was proven unused or safe to delete. No production data or provider configuration was touched.

- [x] G5: Lint and a production build pass using non-secret local validation settings.
  EVIDENCE: `npm run lint` exited 0 with 13 existing warnings; isolated `NEXTAP_BUILD_DIR=.next-foundation npm run build` exited 0 and generated all 15 routes. Temporary build output and Next.js generated config edits were removed/restored afterward.
