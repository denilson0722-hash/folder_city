# Folder City Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed flat SVG map with a polished auto-fit city sandbox that shows the whole city before users drill into districts and buildings.

**Architecture:** Keep the existing scanner and exact `CityBuilding[]` source. Add pure viewport math and pure level-of-detail presentation logic, then render them through focused SVG components. `CityMap` coordinates view state and input; it does not own building geometry.

**Tech Stack:** React 18, TypeScript, SVG, ResizeObserver, Vitest, Testing Library, plain CSS.

## Global Constraints

- Keep data local-only; do not read file content, upload data, persist view state, add a backend, or write to disk.
- Keep React + SVG; do not add Three.js, WebGL, minimap, export, sharing, cloud sync, or AI.
- Auto-fit includes district labels, district plates, buildings, and 6% padding on every side of the unpadded content bounds.
- Auto-fit runs after scan, filter, container resize and “返回全城”; selection changes do not reset a manually moved view.
- Exact thresholds: 0–180 show all buildings; 181–600 show deterministic district representatives at city level; 601–1,000 aggregate by `districtKey + category + freshness` at city level. `districtKey` carries the first-level directory and directory depth, so clusters never cross district boundaries.
- Aggregation changes display only; source files, totals, sizes and category counts remain exact.
- Desktop uses top bar + left navigation + center sandbox + right information panel; mobile uses a bottom details drawer.
- `prefers-reduced-motion` disables view flight and building transitions.
- Existing unsupported, idle, scanning, error, empty and filtered-empty states remain outside viewport calculation.

---

## File Map

| File | Responsibility |
| --- | --- |
| `src/lib/cityViewport.ts` | Bounds union, 6% padding, aspect-fit, zoom clamp. |
| `src/lib/cityPresentation.ts` | LOD thresholds, representatives, clusters and visual bounds. |
| `src/components/BuildingGlyph.tsx` | Light-isometric file and cluster glyphs. |
| `src/components/DistrictLayer.tsx` | District plate, title, count and activation. |
| `src/components/CityControls.tsx` | Zoom, detail level and return-to-city. |
| `src/components/CityNavigation.tsx` | Desktop district navigation. |
| `src/components/CityMap.tsx` | Resize observation, view state, pan/zoom and drill-down. |
| `src/App.tsx`, `src/styles.css` | Responsive sandbox composition. |

## Task 1: Deterministic viewport math

**Files:**
- Create: `src/lib/cityViewport.ts`
- Create: `src/lib/cityViewport.test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Produce `Bounds { minX, minY, maxX, maxY }`, `ViewportSize { width, height }`, `ViewBox { x, y, width, height }`.
- Produce `unionBounds(bounds)`, `paddedBounds(bounds, ratio)`, `fitBounds(bounds, viewport, ratio)`, `clampZoom(viewBox, scale, anchor)`.

- [ ] **Step 1: Write failing tests**

```ts
expect(unionBounds([
  { minX: 20, minY: 10, maxX: 120, maxY: 90 },
  { minX: -10, minY: 30, maxX: 40, maxY: 150 },
])).toEqual({ minX: -10, minY: 10, maxX: 120, maxY: 150 });

const fitted = fitBounds(
  { minX: 0, minY: 0, maxX: 1000, maxY: 400 },
  { width: 1000, height: 700 },
  0.06,
);
expect(fitted.x).toBeLessThanOrEqual(-60);
expect(fitted.x + fitted.width).toBeGreaterThanOrEqual(1060);
expect(fitted.width / fitted.height).toBeCloseTo(1000 / 700);
```

Also assert empty input returns `null`, non-finite bounds throw `InvalidCityBoundsError`, portrait containers contain all padded content, and zoom width clamps to 320–1,920.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/lib/cityViewport.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal math**

```ts
export function paddedBounds(bounds: Bounds, ratio = 0.06): Bounds {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  return {
    minX: bounds.minX - width * ratio,
    minY: bounds.minY - height * ratio,
    maxX: bounds.maxX + width * ratio,
    maxY: bounds.maxY + height * ratio,
  };
}
```

Pad first, then expand the shorter dimension around the center to match the container aspect ratio. Reject zero/non-finite container sizes.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/lib/cityViewport.test.ts && npm run typecheck && npm run build`

Expected: tests and checks pass.

```bash
git add src/types.ts src/lib/cityViewport.ts src/lib/cityViewport.test.ts
git commit -m "feat: add auto-fit city viewport math"
```

## Task 2: Level-of-detail presentation

**Files:**
- Create: `src/lib/cityPresentation.ts`
- Create: `src/lib/cityPresentation.test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Produce `CityLevel = 'city' | 'district' | 'building'`.
- Produce `CityVisualItem` as either exact `building` or display-only `cluster`.
- Produce `presentationFor(buildings, { level, districtKey })` returning items, districts, contentBounds and exact sourceCount.
- Produce `itemsIntersectingViewBox(items, viewBox, 0.12)` for 12% overscan rendering without changing presentation totals.

- [ ] **Step 1: Write failing threshold tests**

```ts
expect(presentationFor(makeBuildings(20), { level: 'city', districtKey: null }).items).toHaveLength(20);
expect(presentationFor(makeBuildings(200), { level: 'city', districtKey: null }).items.length).toBeLessThan(200);
expect(presentationFor(makeBuildings(700), { level: 'city', districtKey: null }).items.every(
  (item) => item.kind === 'cluster',
)).toBe(true);
expect(presentationFor(makeBuildings(1000), { level: 'city', districtKey: null }).sourceCount).toBe(1000);
```

Assert cluster counts sum to the source count, keys are deterministic, and district level contains all buildings in that district. Add a viewport-intersection test proving off-screen items are excluded from the render list while `sourceCount` and the presentation items remain unchanged.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/lib/cityPresentation.test.ts`

Expected: FAIL because presentation exports are absent.

- [ ] **Step 3: Implement exact strategies**

For 181–600, select representatives in sorted district order using stride `Math.ceil(count / 24)`, capped at 24 representatives, plus an explicit cluster badge for undisplayed members. For 601–1,000, group by `districtKey + category + freshness`; every cluster drills into that exact district. Cluster labels must say “建筑群” and expose count/totalBytes. Visual bounds include 10 units of roof depth, 12 units of shadow and 34 units above district plates for titles. `itemsIntersectingViewBox` expands the current view box by 12% on each side and returns only intersecting visual bounds.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/lib/cityPresentation.test.ts && npm run typecheck`

Expected: all threshold, count and deterministic grouping tests pass.

```bash
git add src/types.ts src/lib/cityPresentation.ts src/lib/cityPresentation.test.ts
git commit -m "feat: add city level-of-detail models"
```

## Task 3: Refined SVG primitives

**Files:**
- Create: `src/components/BuildingGlyph.tsx`
- Create: `src/components/BuildingGlyph.test.tsx`
- Create: `src/components/DistrictLayer.tsx`
- Create: `src/components/DistrictLayer.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `BuildingGlyph({ item, selected, onSelect })`.
- `DistrictLayer({ district, active, onActivate })`.

- [ ] **Step 1: Write failing semantic/geometry tests**

Assert a file glyph has `data-face="front"`, `data-face="side"`, `data-face="roof"` and `data-windows`. Assert a 37-file cluster has accessible name `src 的代码建筑群，共 37 个文件` and visible badge 37. Assert district Enter/space activation and selected `aria-pressed="true"`.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/components/BuildingGlyph.test.tsx src/components/DistrictLayer.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement glyph geometry**

Use the source rectangle as front face. Roof points: `x,y x+10,y-10 x+width+10,y-10 x+width,y`. Side points: `x+width,y x+width+10,y-10 x+width+10,y+height-10 x+width,y+height`. Add windows for heights ≥44. Cluster glyphs use a three-building stack and count badge. Districts use solid low-opacity plates, soft outline, title and count; they are keyboard buttons.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/components/BuildingGlyph.test.tsx src/components/DistrictLayer.test.tsx && npm run typecheck`

Expected: component tests pass.

```bash
git add src/components/BuildingGlyph.tsx src/components/BuildingGlyph.test.tsx src/components/DistrictLayer.tsx src/components/DistrictLayer.test.tsx src/styles.css
git commit -m "feat: render polished city glyphs"
```

## Task 4: Auto-fit CityMap and drill-down controls

**Files:**
- Create: `src/components/CityControls.tsx`
- Create: `src/components/CityControls.test.tsx`
- Modify: `src/components/CityMap.tsx`
- Modify: `src/components/CityMap.test.tsx`

**Interfaces:**
- Extend CityMap with controlled `activeDistrictKey` and `onDistrictChange`.
- CityMap owns level, viewBox, measured container size and manual-view flag.
- CityControls emits zoom in/out and fit city.

- [ ] **Step 1: Write failing transition tests**

Mock ResizeObserver at 1200×700. Assert initial viewBox is calculated rather than `0 0 960 640`, and all district/title bounds fit. Activate a district and assert level text `街区级`; use `返回全城` and assert `全城级`. Pan, select a building and assert viewBox does not reset. Test Escape clears selection first, then exits district. With 700 district-level items, assert only `itemsIntersectingViewBox` results render and panning reveals the next item set without changing totals.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/components/CityMap.test.tsx src/components/CityControls.test.tsx`

Expected: FAIL because auto-fit controls are missing.

- [ ] **Step 3: Implement map coordination**

Use ResizeObserver, with window resize fallback. Memoize `presentationFor`; feed contentBounds to `fitBounds`. Refit only for source/filter identity, measured size, active district and explicit fit. Pointer/wheel set manual-view true. At district level with more than 600 source files, render the 12%-overscanned intersection list while retaining all items in the presentation model. Apply flight class only for programmatic changes and omit it when reduced-motion matches.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/components/CityMap.test.tsx src/components/CityControls.test.tsx && npm run typecheck && npm run build`

Expected: transition, viewport and existing interaction tests pass.

```bash
git add src/components/CityMap.tsx src/components/CityMap.test.tsx src/components/CityControls.tsx src/components/CityControls.test.tsx
git commit -m "feat: add city auto-fit drill-down"
```

## Task 5: Responsive sandbox composition and release QA

**Files:**
- Create: `src/components/CityNavigation.tsx`
- Create: `src/components/CityNavigation.test.tsx`
- Modify: `src/components/DetailsPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`
- Modify: `README.md`

**Interfaces:**
- `CityNavigation({ city, activeDistrictKey, onSelectDistrict, onShowCity })`.
- DetailsPanel gains `layout: 'sidebar' | 'drawer'` for presentation only.
- App retains exact relative-path building selection and synchronizes active district with CityMap/navigation.

- [ ] **Step 1: Write failing composition tests**

Assert populated desktop view contains navigation, sandbox and information panel. Select the code/src district from navigation and assert map level changes. Filter away the active district and assert return to city. At narrow viewport assert details use `data-layout="drawer"` with identical story text. Add table-driven 20/200/700/1000 tests for exact source count and correct city-level strategy.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/App.test.tsx src/components/CityNavigation.test.tsx`

Expected: FAIL because the sandbox shell is absent.

- [ ] **Step 3: Implement responsive shell**

Desktop grid: `12rem minmax(0, 1fr) 18rem`; center must use `min-width: 0`. At ≤900px hide navigation and use bottom drawer with max-height 45vh. At ≤640px keep map at least 70svh. Preserve existing non-city state copy exactly and do not render viewport logic for those states. Update README with three levels, auto-fit, aggregation semantics, local-only privacy and commands.

- [ ] **Step 4: Run automated release gate**

Run: `npm test -- --run && npm run typecheck && npm run build && git diff --check`

Expected: all tests pass, checks exit 0 and dist exists.

- [ ] **Step 5: Run browser acceptance**

Start `npm run dev -- --host 127.0.0.1`. Validate 20, 200, 700 and 1,000 simulated files at 1440×900 and 390×844: whole city fits, labels are not clipped, drill-down/return works, mobile details are a drawer, reduced-motion disables flights and console has no relevant errors. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/CityNavigation.tsx src/components/CityNavigation.test.tsx src/components/DetailsPanel.tsx src/styles.css README.md
git commit -m "feat: complete responsive city sandbox"
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–2 implement auto-fit, 6% padding, thresholds and exact aggregation; Tasks 3–5 implement visual polish, navigation, responsive drawer, reduced motion and browser QA.
- **Scope:** Scanner, backend, persistence, export, minimap and WebGL remain excluded.
- **Types:** CityBuilding[] remains exact source; CityPresentation owns display-only items; ViewBox is pure viewport output; selection remains an exact relative path.
- **Placeholder scan:** No deferred marker, vague error instruction or unspecified validation command remains.
