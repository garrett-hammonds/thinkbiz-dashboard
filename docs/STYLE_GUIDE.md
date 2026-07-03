# ThinkBiz.Solutions — AI Component Style Guide

## 1. Brand Philosophy
ThinkBiz uses a clean, modern, and professional aesthetic. 
**Anti-Patterns (DO NOT USE):** - Do not use neobrutalism, chunky elements, or thick black borders (`border-4 border-black`).
- Do not use harsh black drop shadows (`shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`). 
- Do not guess hex codes. Always use the semantic Tailwind configuration colors.

## 2. Color Palette
All colors are configured in the Tailwind theme. Use these specific utility names:
- **Primary (Teal):** `bg-primary`, `text-primary`, `border-primary`
- **Secondary (Navy Blue):** `bg-secondary`, `text-secondary` (Use this for all Headings!)
- **Accent (Yellow):** `bg-accent`, `text-accent` 
- **Surfaces:** `bg-white` (standard cards), `bg-slate-50` (alt backgrounds)
- **Text:** `text-gray-900` (standard body), `text-gray-500` (muted text)

## 3. Typography
The site uses **Lato** as the base font.
- **Headings:** Must ALWAYS use the `foreground` color for high contrast. 
  - *H1:* `text-4xl font-black leading-tight tracking-tight text-foreground`
  - *H2:* `text-3xl font-bold leading-snug text-foreground`
  - *H3:* `text-2xl font-bold leading-snug text-foreground`
  - *H4:* `text-xl font-semibold leading-normal text-foreground`
- **Body:** `text-base leading-relaxed text-gray-900`
- **Links:** `text-primary hover:text-secondary transition-colors duration-200`

## 4. UI Components

### Cards
Cards should be soft, clean, and elevated with a subtle teal shadow.
- **Base Card:** `bg-white rounded-xl border border-gray-100 shadow-card transition-all duration-200`
- **Hover State:** Add `hover:shadow-card-hover hover:-translate-y-[2px]`
- **Accented Card:** Add `border-t-4 border-primary` to the base classes.
- **Dark Card:** `bg-secondary text-white rounded-xl`

### Buttons
All buttons should be `rounded-lg`, `font-semibold`, and include focus states.
- **Primary:** `bg-primary text-white hover:bg-secondary focus-visible:outline-primary px-6 py-3`
- **Secondary:** `bg-secondary text-white hover:bg-primary focus-visible:outline-secondary px-6 py-3`
- **Outline:** `border-2 border-primary text-primary hover:bg-primary hover:text-white px-6 py-3`
- **Accent:** `bg-accent text-gray-900 hover:bg-yellow-400 px-6 py-3`
- **Ghost:** `text-primary hover:bg-primary/10 px-4 py-2`

### Badges & Tags
- **Base:** `inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium`
- **Primary:** Add `bg-primary/10 text-primary`
- **Secondary:** Add `bg-secondary/10 text-secondary`

## 5. Spacing & Layout
- **Container:** Main wrapper elements should use `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` (or the equivalent `.container-site`).
- **Section Padding:** Use `py-12 lg:py-16` for standard vertical spacing between dashboard sections.
- **Flex/Grid Gaps:** Use `gap-4` or `gap-6` for internal component spacing.