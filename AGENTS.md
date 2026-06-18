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

## A-Level Combination → Subjects Assignment

### Problem
When an A-Level student was assigned a combination, SUBSIDIARY and OPTIONAL subjects were not auto-populated into `student_subjects`, causing "No students assigned to this subject" in EnterMarks.

### Fixes

**1. ClassSubjects.jsx bug** (`src/pages/ClassSubjects.jsx:283-299`)
- **Before**: `handleSetStudentCombination` only inserted COMPULSORY subjects
- **After**: Inserts ALL subjects (CORE + SUBSIDIARY + OPTIONAL) from the combination

**2. Database seed for combination_subjects**
- Ran `scripts/seed-combination-subjects.js` (deleted afterward) to populate `combination_subjects` with all 30 subject-combination mappings using existing A-Level subjects (CHEM, GEOG, PHY, BIOS, A/COMM, ECO) and combinations (PCM, PCB, CBG, EGM, HGL, PAM) in the database.

## A-Level Points Calculation

### Problem
A-Level points and division were calculated using ALL subjects (including ELECTIVE/SUBSIDIARY) instead of only the 3 PRINCIPAL subjects. Also, `BEST_N = 7` was hardcoded even for A-Level (should be 3).

### Fixes

**1. Results.jsx** (`src/pages/academic/Results.jsx:501-525`)
- **Best N**: Changed from hardcoded `BEST_N = 7` to `classLevel === 'A_LEVEL' ? 3 : 7`
- **Subject filter**: Added `if (classLevel === 'A_LEVEL' && subject.subject_type === 'ELECTIVE') return` to exclude SUBSIDIARY subjects from points
- **Division**: Added `calcDivision()` helper and `division` field to `studentsWithResults` so the division summary uses frontend-calculated division (not the SQL function's all-subjects division)

**2. StudentReports.jsx** (`src/pages/academic/StudentReports.jsx:480-506`)
- Added `principalValid` that filters out ELECTIVE subjects for A-Level
- Points and division now calculated from PRINCIPAL subjects only
- `avgPct` and `overallGrade` still include all subjects for display

### Key file locations
- `src/pages/academic/Results.jsx:41-58` — `calcDivision()` helper function
- `src/pages/academic/Results.jsx:501-525` — Fixed `studentsWithResults` with BEST_N=3 and subject filter
- `src/pages/academic/StudentReports.jsx:480-506` — Fixed `principalValid` filter for A-Level
- `src/pages/ClassSubjects.jsx:283-299` — A-Level combination assignment (fixed: now inserts all subjects)
- `src/pages/Students.jsx:432-480` — A-Level combo assignment via Subjects modal (already correct)
- `node_modules/html2canvas/dist/html2canvas.esm.js:1831-1860` — Patched `oklch()` color function handler
- `src/layouts/MainLayout.jsx:184` — `h-screen overflow-hidden` layout container
- `src/index.css` — `@media print` overrides, custom `@theme` colors

## School Logo Integration

Uploaded school logo (`school_settings.logo_url`) now displayed in:
- **Login.jsx** — desktop left panel, mobile banner, and reset password mode
- **ForgotPassword.jsx** — desktop left panel and mobile banner  
- **Landing.jsx** — nav header and footer (falls back to inline SVG shield logo)
- **MainLayout.jsx** — sidebar header and topbar (replaces graduate-cap icon)
- **All 4 dashboards** (Admin, Headmaster, Academic, Teacher) — left of the page title
- **Results.jsx & StudentReports.jsx** — `logo_url` right + `national_logo_url` left (already done)
- Falls back to the original inline SVG logo if no logo_url is set in school_settings
- Uses `crossOrigin="anonymous"` for html2canvas PDF compatibility
- Fetched from `school_settings` table via useEffect on mount
- Logo wrapped in `bg-white/10 backdrop-blur-sm border border-white/20` glass container on dark backgrounds (Login left panel, Landing footer) for visibility
- **Required**: Run `migration_fix_public_read_school_settings.sql` to add public SELECT policy, otherwise logo won't load on Login/Landing/ForgotPassword pages

## Known DB issues
- `compute_student_result()` in `migration_grading_update.sql` still sums ALL subjects for A-Level division — fix in `migration_fix_alevel_points_db.sql` (not yet applied to DB)
- A-Level division on Results page now uses frontend calculation (`calcDivision`) so the page displays correctly regardless of DB state
