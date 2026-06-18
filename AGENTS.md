# Project Context — Kizaga RMS

## PDF Generation Feature (Results Page)

### Goal
Add PDF download button to Results page (and StudentReports) using html2canvas + jsPDF.

### Status — COMPLETED

### What was done
| Item | Status | Details |
|------|--------|---------|
| "Download PDF" button (red) in Results toolbar | ✅ Done | Next to Print and Export Excel |
| `generatePDF()` with A4 landscape, multi-page, JPEG compression | ✅ Done | Uses `html2canvas` → `canvas.toDataURL('image/jpeg')` → `jsPDF.addImage()` |
| Multi-page handling with `heightLeft` loop | ✅ Done | Correctly splits long canvases across pages |
| `injectHexColors()` for PDF color fidelity | ✅ Done | Injects hex CSS variable overrides in cloned document |
| Loading/error state (`generatingPDF`) | ✅ Done | Button disabled + spinner during generation |
| StudentReports.jsx PDF generation | ✅ Done | Same `generatePDF` pattern, portrait A4 |
| 3-part student names (`first_name middle_name surname`) | ✅ Done | Fixed in student list + tables |
| Print CSS overrides | ✅ Done | `@media print` in `index.css` hiding sidebar/header, full-width content |

### Key Fix: html2canvas `oklch()` crash

**Problem**: Tailwind v4 uses `oklch()` for default color palette (e.g., `--color-gray-50: oklch(0.985 0.002 247.839)`). html2canvas v1.4.1 only supports `hsl`, `hsla`, `rgb`, `rgba` color functions. Any CSS rule containing `oklch()` caused html2canvas to throw, crashing PDF generation.

**Root cause fix**: Patched `node_modules/html2canvas/dist/html2canvas.esm.js:1862` — added `oklch` to `SUPPORTED_COLOR_FUNCTIONS` with full OKLCH → OKLab → sRGB conversion using the standard transformation matrix:

```
oklch(L C H / A) → oklab(L, a, b) → linear sRGB → sRGB [0-255]
```

**Removed**: `removeOklch` workaround in `onclone` callback (was ineffective because `<link>` stylesheet `.sheet` is null in cloned iframe).

**Also handled**: NUMBER_TOKEN vs PERCENTAGE_TOKEN for L/C (Tailwind uses raw numbers like `0.985` not percentages).

### Top 10 / Bottom 10 showing 8 rows
Not a bug — the data filter `sortedStudents.filter(s => s.result?.position != null)` only includes students with processed exam results. If the class has <10 students with assigned positions, both Top 10 and Bottom 10 will show fewer than 10 rows.

### Print issues (single-page print)
Root cause: `MainLayout.jsx:184` — `<div className="h-screen bg-gray-50 flex overflow-hidden">` constrains viewport height. Fix: CSS `@media print` overrides in `src/index.css` set `html, body { overflow: visible !important; height: auto !important }` and hide sidebar/header.

### Key file locations
- `src/pages/academic/Results.jsx` — Main results page with PDF generation, Top/Bottom tables
- `src/pages/academic/StudentReports.jsx` — Report cards with PDF generation  
- `node_modules/html2canvas/dist/html2canvas.esm.js:1831-1860` — Patched `oklch()` color function handler
- `src/layouts/MainLayout.jsx:184` — `h-screen overflow-hidden` layout container
- `src/index.css` — `@media print` overrides, custom `@theme` colors
