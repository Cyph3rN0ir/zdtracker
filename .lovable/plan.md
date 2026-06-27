## Problem

In the ZeroDesk Classic theme, active/hovered sidebar nav items and active chat conversation rows render with **white text on bright lime** — unreadable.

Root cause: the affected components use Tailwind class pairs like
`bg-accent` + `text-foreground` (not `text-accent-foreground`). On most themes `--accent` is a subtle tint so light `--foreground` text still reads, but on ZeroDesk `--accent` is bright lime, so the light foreground collapses into the background.

Affected spots (verified):
- `src/routes/_app.tsx` NavLink — `data-[status=active]:bg-accent data-[status=active]:text-foreground` and `hover:bg-accent hover:text-foreground`
- `src/routes/_app.chat.tsx` conversation row — `hover:bg-accent active:bg-accent/80 data-[status=active]:bg-accent` with inherited light text
- `src/components/ui/sidebar.tsx` already pairs `bg-sidebar-accent` with `text-sidebar-accent-foreground` correctly — no change needed there

## Fix

### 1. ZeroDesk theme tokens (`src/styles.css`)
Make every "bright surface" token pair with dark text and every "dark surface" token pair with light text. Final mapping:

```
--background        #0F0F0F   --foreground        #E8E8E8
--card              #1A1A1A   --card-foreground   #E8E8E8
--popover           #212121   --popover-foreground #E8E8E8
--primary           #B6D733   --primary-foreground #0F0F0F   (bright → dark)
--secondary         #212121   --secondary-foreground #E8E8E8
--muted             #1A1A1A   --muted-foreground  #888888
--accent            #B6D733   --accent-foreground #0F0F0F   (bright → dark, was #91AB26)
--destructive       #FF4545   --destructive-foreground #0F0F0F
--border / --input  #2E2E2E
--ring              #B6D733

--sidebar           #1A1A1A   --sidebar-foreground #E8E8E8
--sidebar-primary   #B6D733   --sidebar-primary-foreground #0F0F0F
--sidebar-accent    #B6D733   --sidebar-accent-foreground #0F0F0F
--sidebar-border    #2E2E2E   --sidebar-ring #B6D733
```

### 2. Active/hover text color in nav and chat list
Switch the two component spots from `text-foreground` to `text-accent-foreground` so the active text follows whatever the accent token defines — readable on every theme:

- `src/routes/_app.tsx` NavLink className:
  `hover:bg-accent hover:text-accent-foreground … data-[status=active]:bg-accent data-[status=active]:text-accent-foreground`
- `src/routes/_app.chat.tsx` conversation row:
  add `hover:text-accent-foreground data-[status=active]:text-accent-foreground` and let the inner secondary text use `text-accent-foreground/70` when active so the timestamp/preview stays readable.

This is a token-correct change and improves all themes, not just ZeroDesk.

### 3. Quick audit pass
Grep for `bg-accent` / `bg-primary` / `bg-sidebar-accent` paired with `text-foreground` or `text-muted-foreground` in `src/routes/**` and `src/components/**`, and fix any remaining mismatches the same way (use the matching `*-foreground` token). Expected hits are small (nav + chat row); the rest of the app already uses the correct pairs.

### Out of scope

No component restructure, no other themes touched, no business logic.

## Verification

After build, open the app under ZeroDesk Classic and confirm:
- Sidebar active item ("Chat" in screenshot) shows **#0F0F0F text on #B6D733**.
- Sidebar hover state shows the same dark text on lime.
- Active chat conversation row ("Summer 2026") shows dark text on lime, secondary line slightly muted but still dark.
- Light themes (Light, Forest, Ocean, Sand) and other dark themes (Dark, Midnight, Ember, Noir) still look correct since `text-accent-foreground` resolves per-theme.