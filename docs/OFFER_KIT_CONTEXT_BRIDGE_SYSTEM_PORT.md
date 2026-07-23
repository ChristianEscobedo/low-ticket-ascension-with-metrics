# Offer ⇄ Kit Context Bridge — System Port

A single shared abstraction (`ContextPack`) that lets front-end **offers** (and
their **bonuses**) and the three admin AI **kits** (Community, High Ticket, Lead
Gen) be attached as **authoritative context** to each other's generators, in
both directions, without bespoke plumbing per pairing.

See `OFFER_KIT_CONTEXT_BRIDGE_TASK.md` for the full task spec and rationale.

---

## Module map (`src/lib/mothermode/context/`)

| File | Responsibility | Env |
| --- | --- | --- |
| `types.ts` | `ContextSourceKind`, `ContextRef` (a saved *pointer*), `ContextPack` (a resolved, prompt-ready block), plus `normalizeContextRefs()` / `isContextSourceKind()` guards. | isomorphic |
| `prompt.ts` | `tidy()` (strip en/em dashes, collapse whitespace), `clampPack()` / `clampPacks()` (per-pack + total char caps), and `contextPacksToPromptBlock(packs, audience)` — frames the block as **OWNER CONTEXT** for kits or **PROMOTED RESOURCES** for content. | isomorphic |
| `fromOffer.ts` | Pure adapters `fromOffer()` and `fromOfferBonuses()` — turn a front-end offer into a pack. Defensive against lean offer shapes. | isomorphic |
| `fromKits.ts` | Pure adapters `fromCommunityKit()`, `fromHighTicketKit()`, `fromLeadGenKit()` — turn a kit store record into a pack. Defensive against partial/legacy records. | isomorphic |
| `resolve.ts` | **Server-only.** `resolveContextRefs(value)` normalizes refs, fetches each source from its source of truth (`getOffer`, kit stores' `getKitById`), runs the matching adapter, drops missing/deleted sources, and clamps the result. | server only |
| `index.ts` | Browser-safe barrel. Re-exports everything **except** `resolve.ts` (which pulls in service-role kit stores). | isomorphic |

### Why refs resolve *late*

A `ContextRef` is only a pointer (`{ kind, id, label? }`). Packs are built at
generation time, so: (a) injected facts always reflect the current offer/kit,
(b) a client can't spoof pack contents — it only supplies an id, and (c) a
deleted source degrades gracefully (the ref is silently dropped).

### Prompt safety

`clampPacks()` enforces a per-pack cap (`PACK_CHAR_CAP`) and a total cap
(`TOTAL_CHAR_CAP`) so several large attached refs can never crowd out the brief.
`tidy()` keeps injected text on-voice (no dashes) to match the suite's style.

---

## Direction B — Kits → Content (wired)

`POST /api/mothermode/content/generated` (the Generate drawer backend) accepts an
optional `contextRefs` array. In the `generate` branch it:

1. `const contextPacks = await resolveContextRefs(body.contextRefs)`
2. `const contextBlock = contextPacksToPromptBlock(contextPacks, 'content')`
3. folds the block into the existing `guides` field
   (`[baseGuides, contextBlock].filter(Boolean).join('\n\n')`).

Because `guides` already flows into `buildBatchSystem` inside
`openai-content.ts`, **no generator internals changed** — attached kits ride the
existing authoritative-context injection path. Removing a ref and regenerating
removes its influence; unknown/deleted refs drop out.

---

## Direction A — Offers → Kits (foundation ready)

The same abstraction covers Offers → Kits: a Community / High Ticket / Lead Gen
intake carries `contextRefs`, the kit API route calls `resolveContextRefs(...)`
and `contextPacksToPromptBlock(packs, 'kit')`, and prepends the **OWNER CONTEXT**
block to the framework/intake context before generation. The shared module
(`fromOffer` / `fromOfferBonuses`) already emits offer + bonus packs; wiring each
kit route + intake UI is the remaining step and follows the identical three-line
pattern used in Direction B.

---

## Tests

`tests/lib/context-packs.test.ts` (15 cases, all green) covers the pure surface:

- `normalizeContextRefs` keeps valid refs, drops malformed/blank ones, returns
  `[]` for non-arrays.
- `isContextSourceKind` recognizes the five kinds.
- `tidy` strips dashes and collapses whitespace.
- `clampPack` / `clampPacks` enforce per-pack and total caps and preserve order.
- `contextPacksToPromptBlock` frames kit vs content and numbers packs.
- Offer + kit adapters produce non-empty, grounded prompts and degrade
  gracefully on empty/partial input.

The resolver is intentionally untested here (server-only, hits the kit stores);
it is a thin switch over the already-tested pure adapters.
