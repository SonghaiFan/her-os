# Her OS Design Space

This system should make Her OS feel quieter, more intentional, and easier to extend.

The goal is not to invent more visual language. The goal is to encode the current one into fewer reusable parts so new screens stay cinematic without accumulating extra chrome.

## Design Direction

Her OS should remain:

- warm
- atmospheric
- sparse
- tactile
- feminine without becoming decorative
- intelligent without becoming enterprise

Her OS should avoid:

- dashboard density
- hard card grids
- neon sci-fi tropes
- loud CTA hierarchies
- duplicated glass layers

## Minimalism Rule

Reduce code by removing differences that do not change perception.

That means:

- one shared surface family, not a new panel style for every feature
- one shared control family, not separate bespoke button treatments
- one shared text hierarchy, not local typography resets
- one slot model for composition: `Positioner -> Surface -> Content`

If two components feel like the same object with different copy, they should share the same recipe.

## What Exists Now

The reusable system lives in:

- [her-os-tokens.ts](/Users/songhaifan/Documents/GitHub/her-os/components/ui/her-os-tokens.ts)
- [her-os-primitives.tsx](/Users/songhaifan/Documents/GitHub/her-os/components/ui/her-os-primitives.tsx)

`her-os-tokens.ts` defines the visual recipes.

`her-os-primitives.tsx` exposes the plug-in components:

- `HerOsPanel`
- `HerOsCard`
- `HerOsDialogueFragment`
- `HerOsControl`
- `HerOsChip`
- `HerOsComposerField`
- `HerOsComposerInput`
- `HerOsEyebrow`

These are intentionally few. Future UI should start from them before adding anything new.

## Foundations

Primary color variables still live in [globals.css](/Users/songhaifan/Documents/GitHub/her-os/app/globals.css).

Important foundations:

- `--bg-bright` and `--bg-main` own the ambient field
- `--accent` owns the luminous highlight
- `--text-main`, `--text-muted`, and `--text-faint` own hierarchy

New colors should be derived from these. Do not introduce unrelated blue, gray, or black systems unless the whole product language is being reconsidered.

## The New Component Grammar

Every screen should be assembled from a small set of object types.

### 1. Scene

The scene is the atmospheric field and focal object.

- it owns the background and the topology ring
- it stays visually dominant
- support UI should orbit it, not cover it

### 2. Panel

Panel is the support container.

Use `HerOsPanel` for:

- debug tools
- status clusters
- settings trays
- utility overlays

Panel should stay compact and edge-aligned.

### 3. Card

Card is the readable surface.

Use `HerOsCard` for:

- explanatory content
- modal fragments
- supporting narrative content

Card is slightly richer than panel, but it should still feel like the same material family.

### 4. Dialogue Fragment

Dialogue is not a chat bubble system. It is a floating fragment system.

Use `HerOsDialogueFragment` with `tone="assistant" | "user" | "system"` for:

- conversational replies
- status utterances
- ephemeral narration

The role should only shift warmth, weight, and offset. It should not create a whole new UI pattern.

### 5. Control

Use `HerOsControl` for circular or capsule actions.

Use `HerOsChip` for segmented or filter-like selection.

These should cover most action affordances in the OS. If a button needs a new style, first prove why the existing control family cannot carry it.

### 6. Composer

Use `HerOsComposerField` and `HerOsComposerInput` to build the bottom dock.

The composer should feel like a calm invitation, not a traditional app toolbar.

## Slot Ownership

This remains the key structural rule:

1. `Positioner` handles placement and motion.
2. `Surface` handles shape, fill, border, shadow, and clipping.
3. `Content` handles text, icons, spacing, and semantics.

Do not let one layer do all three jobs.

Bad:

- motion wrapper with its own painted background
- nested rounded glass shells for one perceived object
- content node redefining outer silhouette

Good:

```tsx
<motion.div className="dialogue-positioner">
  <HerOsDialogueFragment tone="assistant" role="Samantha">
    The system is ready.
  </HerOsDialogueFragment>
</motion.div>
```

## Reduction Strategy

When refining the app, remove complexity in this order:

1. Remove extra wrappers that do not own layout or semantics.
2. Merge similar surfaces into a shared recipe.
3. Push repeated Tailwind strings into `herOsRecipes`.
4. Promote stable patterns into a primitive component.
5. Update this document when the grammar changes.

This is how the codebase stays smaller while the UI still feels deliberate.

## Screen Composition Rules

### Center

- keep the center quiet
- allow the ring to remain the emotional anchor
- avoid stacking multiple competing panels near the focal object

### Edges

- place utilities near the perimeter
- keep edge controls compact
- prefer one grouped panel over several scattered controls

### Bottom Dock

- composer, trigger copy, and primary actions should read as one dock system
- keep the dock narrow enough to preserve empty space
- on mobile, collapse actions before compressing the field too hard

## Typography

Typography should stay human and light.

- body copy should remain airy
- uppercase should be reserved for labels and system framing
- avoid heavy-weight headings unless they are part of the boot moment
- use restrained letter spacing to create calm, not branding noise

## Motion

Motion should suggest emergence, not productivity software.

- prefer fade, blur, drift, and low-amplitude lift
- avoid sharp slide-ins and aggressive spring behavior
- repeated motion should feel ambient, not attention-seeking
- reduced motion must preserve hierarchy without relying on blur

## Copy Tone

Copy should sound like quiet system language.

Good:

- `System initialized.`
- `Tap anywhere to initialize`
- `Cloud voice on.`

Bad:

- `Get started`
- `Try the new experience`
- `Success! Everything is ready`

## Plugin Map

This is the intended extension surface for future work:

- ambient overlay: `HerOsPanel` + `HerOsEyebrow`
- settings sheet: `HerOsCard` + `HerOsControl`
- segmented state picker: `HerOsChip`
- conversational module: `HerOsDialogueFragment`
- bottom input dock: `HerOsComposerField` + `HerOsComposerInput` + `HerOsControl`

If a new feature does not fit one of these shapes, it should still borrow the same material and text recipes.

## Adoption Guidance

When touching an existing screen:

1. replace repeated class strings with `herOsRecipes`
2. swap ad hoc UI wrappers for the primitive components
3. keep the visual result the same unless the previous state was clearly noisier
4. remove local styling once the shared primitive covers it

The standard for changes is simple: less code, fewer object types, same or better atmosphere.
