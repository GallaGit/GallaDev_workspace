# Design System — Leads CRM v1.2

**Versión**: 1.2.0
**Fuente Brand**: `.agents/GallaDev_brand-identity/`
**Generado**: ui-ux-pro-max skill + brand identity manual

---

## 1. Design Tokens (Tailwind v4 `@theme`)

### Colores — Brand Identity
```css
/* Paleta principal */
--color-rojo: #C62828;        /* Identidad / Acento (5-10%) */
--color-grafito: #1F2328;     /* Estructura / Texto principal (20-30%) */
--color-blanco: #FFFFFF;      /* Base / Espacio (60-70%) */

/* Escala de grises */
--color-gris-claro: #F3F4F6;  /* Fondos secundarios, tarjetas */
--color-gris-medio: #9CA3AF;  /* Texto secundario, metadata, disabled */
--color-gris-oscuro: #4B5563; /* Subtítulos, nav secundaria */

/* Colores funcionales (NO son brand) */
--color-exito: #16A34A;
--color-advertencia: #D97706;
--color-error: #DC2626;
--color-info: #2563EB;
```

### Tailwind v4 Config (`app/globals.css` o `theme.css`)
```css
@theme {
  /* Brand colors */
  --color-rojo: #C62828;
  --color-rojo-hover: #B71C1C;
  --color-rojo-light: #EF5350;
  --color-grafito: #1F2328;
  --color-grafito-light: #2D333A;

  /* Neutrals */
  --color-gris-50: #F9FAFB;
  --color-gris-100: #F3F4F6;
  --color-gris-200: #E5E7EB;
  --color-gris-300: #D1D5DB;
  --color-gris-400: #9CA3AF;
  --color-gris-500: #6B7280;
  --color-gris-600: #4B5563;
  --color-gris-700: #374151;
  --color-gris-800: #1F2937;
  --color-gris-900: #111827;

  /* Functional */
  --color-exito: #16A34A;
  --color-advertencia: #D97706;
  --color-error: #DC2626;
  --color-info: #2563EB;

  /* Spacing scale (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --shadow-glow-rojo: 0 0 20px -5px rgb(198 40 40 / 0.4);

  /* Transitions */
  --transition-fast: 100ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 200ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  --font-sans: 'Manrope', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Font sizes */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */

  /* Font weights */
  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Z-index scale */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-popover: 400;
  --z-toast: 500;
  --z-tooltip: 600;
}
```

---

## 2. Motion Specs

### Duraciones
| Tipo | Duración | Easing | Uso |
|------|----------|--------|-----|
| **Micro** | 100ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Hover states, focus rings |
| **Base** | 150ms | `cubic-bezier(0.4, 0, 0.2, 1)` | **Default** — transitions, drag, expand |
| **Macro** | 200-300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Page transitions, modal entry |
| **Count-up** | 800-1200ms | `easeOutExpo` | KPI counters |
| **Stagger** | 50ms delay | `cubic-bezier(0.4, 0, 0.2, 1)` | List items, grid children |

### Framer Motion Presets
```tsx
// lib/motion/presets.ts
export const motionPresets = {
  // Entrada suave
  fadeInUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] }
  },

  // Stagger para listas
  staggerContainer: {
    animate: { transition: { staggerChildren: 0.05 } }
  },
  staggerItem: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] }
  },

  // Hover lift (cards, rows)
  hoverLift: {
    whileHover: { y: -2, boxShadow: 'var(--shadow-lg)' },
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] }
  },

  // Tap press
  tapScale: {
    whileTap: { scale: 0.98 },
    transition: { duration: 0.05 }
  },

  // Drag active
  dragActive: {
    drag: { y: 0 }, // horizontal only for kanban
    whileDrag: { boxShadow: 'var(--shadow-xl)', zIndex: 100 },
    transition: { duration: 0.1 }
  },

  // Page transition
  pageTransition: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
  },

  // Count-up numbers
  countUp: {
    animate: (value: number) => ({ 
      // custom hook handles interpolation
    }),
    transition: { duration: 1, ease: 'easeOutExpo' }
  }
} as const;
```

### Reduced Motion
```tsx
// hooks/useReducedMotion.ts
import { useMediaQuery } from '@react-hookz/web';

export const useReducedMotion = () => 
  useMediaQuery('(prefers-reduced-motion: reduce)');

// Uso en componentes:
const reduced = useReducedMotion();
const transition = reduced ? { duration: 0 } : motionPresets.hoverLift.transition;
```

---

## 3. Typography System

### Jerarquía (Manrope)
| Elemento | Peso | Tamaño | Line-height | Uso |
|----------|------|--------|-------------|-----|
| H1 | Bold (700) | 48-64px (3-4xl) | 1.25 | Page titles |
| H2 | Semibold (600) | 32-40px (2xl-3xl) | 1.25 | Section headers |
| H3 | Semibold (600) | 24-28px (xl-2xl) | 1.3 | Card titles |
| H4 | Semibold (600) | 20-22px (lg-xl) | 1.4 | Sub-sections |
| Body | Regular (400) | 16-18px (base-lg) | 1.5 | Paragraphs |
| Small | Medium (500) | 14px (sm) | 1.5 | Labels, metadata |
| Caption | Regular (400) | 12-13px (xs) | 1.4 | Timestamps, helpers |
| Button | Medium/Semibold | 14-16px (sm-base) | 1.4 | Actions |

### Código (JetBrains Mono)
- Code blocks, inline code, technical IDs, JSON, endpoints
- Tamaño: 13px (xs-sm), line-height 1.6

### Tailwind Classes
```tsx
// Usage examples
<h1 className="font-bold text-4xl leading-tight">Page Title</h1>
<h2 className="font-semibold text-2xl leading-tight">Section</h2>
<p className="text-base leading-normal">Body text</p>
<code className="font-mono text-xs leading-relaxed">code</code>
```

---

## 4. Component Inventory

### Current (shadcn/ui basic)
| Component | File | Status v1.2 |
|-----------|------|-------------|
| Button | `src/components/ui/button.tsx` | ✅ Extend variants |
| Dialog | `src/components/ui/dialog.tsx` | ✅ Add motion |
| Input | `src/components/ui/input.tsx` | ✅ Add floating label |
| Switch | `src/components/ui/switch.tsx` | ✅ Keep |

### Target (Elevated + New)
| Component | Source | Priority | Brand Adaptation |
|-----------|--------|----------|------------------|
| **KanbanBoard** | Own (framer-motion) | P0 | 9 cols, Rojo drag line, Grafito cols |
| **DataTable** | TanStack + virtual | P0 | Row hover lift, inline actions |
| **CommandPalette** | ui-ux-pro-max pattern | P1 | `Cmd+K`, Grafito bg, Rojo highlights |
| **Toast** | Sonner extended | P1 | Progress, variants, Rojo error |
| **Skeleton** | 21st.dev shimmer | P1 | Gallo runner (CSS v1.2) |
| **KPICard** | 21st.dev Spotlight | P1 | Count-up, sparkline, hover lift |
| **StatCard** | 21st.dev Display Cards | P2 | Micro-chart, animated values |
| **FilterChips** | Own + shadcn | P1 | AND logic, Rojo active |
| **Drawer** | shadcn + motion | P1 | Slide-in, focus trap |
| **EmptyState** | 21st.dev Onboarding | P2 | Gallo searching (400) |
| **ProgressRing** | Recharts/custom | P2 | Inbox queues |
| **SplitView** | Custom | P2 | Email editor/preview |

### Component API Patterns
```tsx
// Base props all elevated components share
interface BaseComponentProps {
  className?: string;
  'data-testid'?: string;
}

// Motion props
interface MotionProps {
  reducedMotion?: boolean;
  transition?: Transition;
}

// Loading props
interface LoadingProps {
  isLoading?: boolean;
  skeleton?: React.ReactNode;
}
```

---

## 5. Page-Specific Specs

### Home (`/`)
```
Hero KPI Section
├── KPICard × 4 (primary metrics)
│   ├── Icon (Lucide, Rojo)
│   ├── Count-up number (1.5s)
│   ├── Label (Gris-oscuro)
│   ├── Sparkline (Recharts, 60px height)
│   └── Hover: lift + shadow + Rojo accent line
├── Scroll-reveal sections (IntersectionObserver)
└── CTA section (Rojo button)
```

### Leads (`/leads`)
```
Toolbar
├── Search (Debounced 300ms)
├── FilterChips (Provincia, Ciudad, Estado, Empleados, Fechas, Has...)
├── ColumnPicker (Persist localStorage)
└── Sync Button (Progress toast)

Table (Virtualized)
├── Row hover: lift 2px + shadow-md
├── Inline StatusSelect (shadcn Select)
├── Quick actions: Favorite, Archive, Open Drawer
├── Skeleton rows (8) while loading
└── Empty state: Gallo searching + "No leads match"
```

### Kanban (`/kanban`)
```
Header
├── Title + Lead count
├── FilterChips (Estado, Score, Assignee)
├── View toggles: Board / List
└── Sync indicator

Board (9 columns)
├── Column: Grafito bg, Rojo badge count
├── Header: Drag handle, title, count
├── Cards: 
│   ├── Drag: Rojo border, lift, shadow-xl
│   ├── Drop indicator: Rojo line (2px)
│   ├── Content: Title, meta (city, score)
│   └── Hover: Quick actions (archive, edit)
├── No inline Add Card form (leads are created outside the board)
└── Archive column: Burn barrel → Archive icon
```

### Stats (`/stats`)
```
Chart type selector (radiogroup "Tipo de gráfico"): Barras | Circular (donut) | Área
Preference: localStorage `gdw-stats-chart-type`
Circular is not drawn when fewer than two statuses have leads
Área is a wave across the nine pipeline states, not a time series

Tab Content
├── Summary cards
├── Breakdown tables
└── Rates / funnel stay visible when the chart type changes
```

---

## 6. Accessibility Checklist (WCAG 2.2 AA)

### Must Have
- [ ] Contrast 4.5:1 (Rojo `#C62828` on White ✅, on Grafito ⚠️ verify)
- [ ] Focus visible: `focus-visible:ring-2 focus-visible:ring-rojo focus-visible:ring-offset-2`
- [ ] Keyboard nav: Tab order, Escape closes, Arrow keys in composites
- [ ] ARIA labels: Icon-only buttons, status announcements
- [ ] Live regions: `aria-live="polite"` for sync status, toasts
- [ ] Reduced motion: Respect `prefers-reduced-motion`
- [ ] Skip links: "Saltar al contenido principal"

### Testing
```bash
# Automated
npm run test:a11y  # axe-core via Playwright

# Manual
# - NVDA / VoiceOver
# - Tab-only navigation
# - Zoom 200%
# - High contrast mode
```

---

## 7. Iconography

### Lucide (Functional)
- Style: Outline, 24×24, stroke-2, round caps
- Color: `text-gris-500` default, `text-rojo` active/primary
- Sizes: `w-4 h-4` (16px), `w-5 h-5` (20px), `w-6 h-6` (24px)

### Gallo (Brand Microinteractions)
| State | Animation | Implementation |
|-------|-----------|----------------|
| Loading | Corriendo + alas | CSS keyframes / Lottie v1.3 |
| 400 Error | Picoteando suelo | CSS keyframes / Lottie v1.3 |
| Success (v1.3) | Alas arriba orgulloso | Lottie |
| Empty (v1.3) | Mirando curioso | Lottie |

---

## 8. Responsive Breakpoints

| Breakpoint | Tailwind | Usage |
|------------|----------|-------|
| Mobile | `< 640px` | Stack columns, drawer full-screen |
| Tablet | `640px - 1024px` | 2-col grids, sidebar collapsible |
| Desktop | `1024px - 1280px` | Full layout |
| Wide | `> 1280px` | Max-width containers, comfortable reading |

---

## 9. Dark Mode

### Strategy
- CSS custom properties + `class="dark"` on `<html>`
- Tailwind `dark:` variants on all components
- No FOUC: inline script in `<head>` reads localStorage

### Token Overrides (Dark)
```css
.dark {
  --color-blanco: #111827;        /* Grafito becomes base */
  --color-grafito: #F9FAFB;       /* White becomes text */
  --color-gris-claro: #1F2937;    /* Card backgrounds */
  --color-gris-medio: #9CA3AF;    /* Secondary text */
  --color-gris-oscuro: #D1D5DB;   /* Subtitles */
  --shadow-glow-rojo: 0 0 20px -5px rgb(198 40 40 / 0.3);
}
```

---

## 10. Implementation Checklist

### Phase 1: Tokens & Foundation
- [ ] Add `@theme` to `app/globals.css`
- [ ] Configure dark mode script
- [ ] Create `lib/motion/presets.ts`
- [ ] Create `hooks/useReducedMotion.ts`
- [ ] Update shadcn components with brand tokens

### Phase 2: Core Components
- [ ] KanbanBoard (adapt existing framer-motion)
- [ ] DataTableVirtualized
- [ ] CommandPalette
- [ ] ToastProvider (Sonner config)
- [ ] Skeleton components

### Phase 3: Pages
- [ ] Home page with KPICards
- [ ] Leads page with DataTable
- [ ] Kanban page with Board
- [ ] Stats page with tabs + charts
- [ ] Inbox page with ProgressRings
- [ ] Email page with SplitView
- [ ] Settings polish

### Phase 4: Accessibility
- [ ] Focus management audit
- [ ] ARIA live regions
- [ ] Keyboard shortcuts
- [ ] Contrast verification
- [ ] Reduced motion test

---

## 11. 21st.dev Prompt Templates

### Para componentes futuros
```
"Create a [component] for a SaaS dashboard using:
- Tech: Next.js 16, React 19, Tailwind v4, shadcn/ui, framer-motion
- Brand: Minimal tech human — Rojo #C62828 (accent 5-10%), Grafito #1F2328, Manrope font
- Motion: 150ms base, cubic-bezier(0.4, 0, 0.2, 1), prefers-reduced-motion
- Style: Clean, professional, subtle motion — reference 21st.dev [component name]
- Accessibility: WCAG 2.2 AA, focus visible, keyboard nav, ARIA
- Dark mode: Full support via CSS variables"
```

### Referencias específicas a usar
- `Spotlight Card` → KPICard, StatCard
- `Display Cards` → Lead cards, Stat breakdowns
- `Scroll Choreography` → Home page sections
- `Container Scroll Animation` → Page transitions
- `Skeleton shimmer` → Loading states
- `Command Palette` → Global search
- `Tilt card` → Hover interactions (subtle)

---

## 12. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2026-09-11 | Initial v1.2 design system from brand identity |
| 1.0.0 | 2026-09-11 | Baseline (shadcn defaults) |