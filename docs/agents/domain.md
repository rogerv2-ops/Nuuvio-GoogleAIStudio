# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root, or
- **`GLOSSARY-MAP.md`** at the repo root if it exists: it points at one `GLOSSARY.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This is a **single-context** repo:

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-....md
│   └── 0002-....md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (…), but worth reopening because…_

## The documents this repo already has

These are hand-written and are the source of truth for their subject. A glossary entry that
contradicts one of them is wrong.

- **`AGENTS.md`** — the non-negotiable rules of this repo (WhatsApp links, credentials, schema changes, verification gotchas). Read it before touching anything.
- **`odd/tasks/mapa-del-sistema.md`** — the verified map: endpoints, tables, events and the findings with their business consequence.
- **`odd/tasks/punto-10-modularizar-server.md`** — the control document: specs, tasks and the running log of every change.
- **`docs/reglas-whatsapp.md`** — the spec of the WhatsApp links (app choice, the phone is never exposed, tracking, opt-out).
- **`docs/auditoria-2026-10-19.md`** — the twelve findings that started this work.
- **`FLUJOS.md`** — per-feature request/response flows.
