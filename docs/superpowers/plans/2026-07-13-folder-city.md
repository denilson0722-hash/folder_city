# Folder City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Build a local-only browser app that turns metadata from a selected folder into an explorable 2D city.

**Architecture:** React holds scan, filter and selection state. A file-system adapter is the only browser API boundary; pure city-model functions convert metadata into deterministic buildings. The SVG map only renders models and emits user interactions.

**Tech Stack:** Vite, React 18, TypeScript, Vitest, Testing Library, SVG and plain CSS.

## Global Constraints

- Read metadata only; never call \`file.text()\`, \`arrayBuffer()\`, upload APIs, browser persistence or a backend.
- Require \`showDirectoryPicker\`; unsupported browsers must show a clear no-action message.
- Categories are \`document\`, \`image\`, \`media\`, \`code\`, \`archive\`, and \`other\`.
- Height uses clamped logarithmic scaling from 24 to 180 SVG units.
- Retain only the newest 1,000 files after scanning; show the truncation warning.
- Freshness is recent (0–7 days), current (8–90), aged (91+); layout order is sorted relative path.
- Exclude 3D, file previews, write actions, ZIP uploads, exports, sharing, login, cloud sync and AI.

---

## Planned File Structure

| File | Responsibility |
| --- | --- |
| \`package.json\`, \`vite.config.ts\`, \`tsconfig*.json\`, \`index.html\` | Vite, TypeScript and Vitest setup. |
| \`src/types.ts\` | Domain types. |
| \`src/lib/cityModel.ts\` | Pure classification, layout, stories and statistics. |
| \`src/lib/fileSystem.ts\` | Feature detection and recursive metadata-only scan. |
| \`src/hooks/useFolderScan.ts\` | Picker lifecycle, progress and errors. |
| \`src/components/{CityMap,Controls,StatsBar,DetailsPanel}.tsx\` | City renderer and focused UI. |
| \`src/App.tsx\`, \`src/main.tsx\`, \`src/styles.css\` | Composition and visual system. |
| \`src/**/*.test.*\` | Model and component test coverage. |
| \`README.md\` | Runbook, browser requirement and privacy behavior. |

## Task 1: Bootstrap application and tests

**Files:**
- Create: \`package.json\`, \`vite.config.ts\`, \`tsconfig.json\`, \`tsconfig.app.json\`, \`index.html\`, \`.gitignore\`
- Create: \`src/main.tsx\`, \`src/App.tsx\`, \`src/App.test.tsx\`, \`src/test/setup.ts\`

**Interfaces:**
- Produces: \`npm run dev\`, \`npm run build\`, \`npm run typecheck\`, \`npm test\`.

- [ ] **Step 1: Write the failing smoke test**

\`\`\`tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the Folder City title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '文件夹城市' })).toBeInTheDocument();
});
\`\`\`

- [ ] **Step 2: Verify failure**

Run: \`npm install && npm test -- --run src/App.test.tsx\`

Expected: FAIL because scripts and \`App\` are absent.

- [ ] **Step 3: Implement the minimal bootstrap**

Create a Vite React config with Vitest \`environment: 'jsdom'\` and \`setupFiles: ['./src/test/setup.ts']\`. Use these exact package scripts:

\`\`\`json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest"
  }
}
\`\`\`

Install runtime dependencies \`react@^18.3.1\`, \`react-dom@^18.3.1\`, \`vite\`, \`typescript\`, \`@vitejs/plugin-react\`; install test dependencies \`vitest\`, \`jsdom\`, \`@testing-library/react\`, \`@testing-library/jest-dom\`, and \`@testing-library/user-event\`. In \`src/test/setup.ts\` import \`@testing-library/jest-dom/vitest\`. Implement:

\`\`\`tsx
export default function App() {
  return <main><h1>文件夹城市</h1></main>;
}
\`\`\`

Render it from \`main.tsx\` using \`createRoot\` and \`StrictMode\`. Ignore \`node_modules\`, \`dist\`, \`coverage\` and \`.DS_Store\`.

- [ ] **Step 4: Verify baseline**

Run: \`npm test -- --run src/App.test.tsx && npm run typecheck && npm run build\`

Expected: PASS; type-check and build exit 0.

- [ ] **Step 5: Commit**

\`\`\`bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json index.html src .gitignore
git commit -m "chore: bootstrap Folder City web app"
\`\`\`

## Task 2: Implement pure city model

**Files:**
- Create: \`src/types.ts\`, \`src/lib/cityModel.ts\`, \`src/lib/cityModel.test.ts\`

**Interfaces:**
- Produces: \`classifyFile(name): FileCategory\`, \`heightForBytes(size): number\`, \`freshnessFor(modified, now): Freshness\`, \`buildCity(entries, now): CityBuilding[]\`, \`storyFor(building): string\`, and \`summarize(buildings)\`.
- \`FileEntry\` has \`name\`, \`relativePath\`, \`size\`, \`lastModified\`, and \`type\`; \`CityBuilding\` adds \`category\`, \`freshness\`, \`height\`, \`x\`, \`y\`, \`width\`, and \`districtLabel\`.

- [ ] **Step 1: Write failing model tests**

\`\`\`ts
expect(classifyFile('design.png')).toBe('image');
expect(classifyFile('README')).toBe('other');
expect(heightForBytes(0)).toBe(24);
expect(heightForBytes(1024 ** 3)).toBe(180);
expect(freshnessFor(new Date('2026-07-06'), new Date('2026-07-13'))).toBe('recent');
expect(freshnessFor(new Date('2026-04-13'), new Date('2026-07-13'))).toBe('aged');
expect(buildCity(entries, now).map(({ relativePath }) => relativePath)).toEqual(['a/a.txt', 'z.png']);
\`\`\`

Also assert \`storyFor\` contains the name, Chinese district label, formatted date and formatted byte size.

- [ ] **Step 2: Verify failure**

Run: \`npm test -- --run src/lib/cityModel.test.ts\`

Expected: FAIL because \`cityModel.ts\` does not exist.

- [ ] **Step 3: Implement minimal model**

Use the exact sizing formula:

\`\`\`ts
const MIN_HEIGHT = 24;
const MAX_HEIGHT = 180;
const SCALE_MAX_BYTES = 1024 ** 3;

export function heightForBytes(size: number): number {
  const ratio = Math.log10(Math.max(0, size) + 1) / Math.log10(SCALE_MAX_BYTES + 1);
  return Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, MIN_HEIGHT + ratio * (MAX_HEIGHT - MIN_HEIGHT))));
}
\`\`\`

Map documented extensions to the six categories. Sort a copy with \`relativePath.localeCompare\`; assign fixed category order and category-local grid rows of six using \`width: 54\` and \`gap: 18\`. \`summarize\` returns \`fileCount\`, \`totalBytes\`, \`largestFile\`, and per-category counts.

- [ ] **Step 4: Verify and commit**

Run: \`npm test -- --run src/lib/cityModel.test.ts && npm run typecheck\`

Expected: PASS.

\`\`\`bash
git add src/types.ts src/lib/cityModel.ts src/lib/cityModel.test.ts
git commit -m "feat: add deterministic city model"
\`\`\`

## Task 3: Add safe directory scanning

**Files:**
- Create: \`src/lib/fileSystem.ts\`, \`src/lib/fileSystem.test.ts\`, \`src/hooks/useFolderScan.ts\`, \`src/vite-env.d.ts\`

**Interfaces:**
- Produces: \`isDirectoryPickerSupported(): boolean\`, \`scanDirectory(handle, onProgress): Promise<ScanResult>\`, and \`useFolderScan(): { status, result, error, pickFolder, reset }\`.
- \`ScanResult\` has \`entries\`, \`skippedCount\`, \`wasTruncated\`, and \`scannedAt\`.

- [ ] **Step 1: Write failing scanner tests**

Mock a directory handle with an async \`values()\` iterator. Verify recursive paths \`root.txt\` and \`nested/photo.jpg\`; a rejecting \`getFile()\` increments \`skippedCount\`; 1,001 files return 1,000 newest entries with \`wasTruncated: true\`; delete \`window.showDirectoryPicker\` and expect \`isDirectoryPickerSupported()\` false.

- [ ] **Step 2: Verify failure**

Run: \`npm test -- --run src/lib/fileSystem.test.ts\`

Expected: FAIL because scanner exports do not exist.

- [ ] **Step 3: Implement metadata-only scan**

For each file handle call only \`getFile()\`, then copy:

\`\`\`ts
{ name: file.name, relativePath, size: file.size, lastModified: new Date(file.lastModified), type: file.type }
\`\`\`

Never call content methods. Traverse child directories recursively, catch per-entry errors and increment skipped count. After traversal sort by \`lastModified\` descending, slice to 1,000, then pass entries to model code later. Provide local API declarations only if current DOM types lack them. In the hook, map picker \`AbortError\` to \`未选择文件夹，未读取任何数据。\` and report progress count.

- [ ] **Step 4: Verify and commit**

Run: \`npm test -- --run src/lib/fileSystem.test.ts && npm run typecheck\`

Expected: PASS.

\`\`\`bash
git add src/lib/fileSystem.ts src/lib/fileSystem.test.ts src/hooks/useFolderScan.ts src/vite-env.d.ts
git commit -m "feat: scan folder metadata locally"
\`\`\`

## Task 4: Build controls, statistics and details

**Files:**
- Create: \`src/components/Controls.tsx\`, \`src/components/StatsBar.tsx\`, \`src/components/DetailsPanel.tsx\`
- Create: \`src/components/Controls.test.tsx\`, \`src/components/DetailsPanel.test.tsx\`

**Interfaces:**
- \`Controls\` consumes controlled \`CityFilters\`, \`onPickFolder\`, \`onReset\`, \`onChange\`.
- \`DetailsPanel\` consumes \`CityBuilding | null\`, \`onClose\`.
- \`StatsBar\` consumes summary and scan status fields.

- [ ] **Step 1: Write failing interaction tests**

Render \`Controls\`, click the button named \`选择文件夹\`, and expect \`onPickFolder\` once. Change type to \`image\` and expect \`onChange({ category: 'image', freshness: 'all' })\`. Render an image \`DetailsPanel\`, assert its relative path and story, click \`关闭详情\`, and expect \`onClose\` once.

- [ ] **Step 2: Verify failure**

Run: \`npm test -- --run src/components/Controls.test.tsx src/components/DetailsPanel.test.tsx\`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement presentational components**

Render picker, category and freshness selects, reset and privacy explanation in Controls. In StatsBar render count, total bytes, largest file, skipped entries, and the exact warning \`目录包含超过 1,000 个文件；仅展示最近修改的 1,000 个文件。\` when truncated. Details must return null without selection; otherwise it renders \`<aside aria-label="文件详情">\` with story and \`<button aria-label="关闭详情">\`.

- [ ] **Step 4: Verify and commit**

Run: \`npm test -- --run src/components/Controls.test.tsx src/components/DetailsPanel.test.tsx && npm run typecheck\`

Expected: PASS.

\`\`\`bash
git add src/components/Controls.tsx src/components/StatsBar.tsx src/components/DetailsPanel.tsx src/components/Controls.test.tsx src/components/DetailsPanel.test.tsx
git commit -m "feat: add Folder City controls and details"
\`\`\`

## Task 5: Build accessible SVG city map

**Files:**
- Create: \`src/components/CityMap.tsx\`, \`src/components/CityMap.test.tsx\`

**Interfaces:**
- \`CityMap\` consumes \`buildings\`, \`selectedPath\`, \`onSelect(building)\`, and \`onClearSelection()\`.
- Produces: SVG buildings with keyboard selection plus wheel-zoom and pointer-pan.

- [ ] **Step 1: Write failing interaction tests**

Render two buildings; assert each has button role and accessible name with file name. Press Enter on a building and expect \`onSelect\`. Click SVG background and expect \`onClearSelection\`. Fire a wheel event and assert the \`viewBox\` changes from \`0 0 960 640\`.

- [ ] **Step 2: Verify failure**

Run: \`npm test -- --run src/components/CityMap.test.tsx\`

Expected: FAIL because \`CityMap.tsx\` does not exist.

- [ ] **Step 3: Implement interactive map**

Render \`<svg aria-label="文件夹城市地图" viewBox={viewBox}>\`. Each building is \`<g role="button" tabIndex={0} aria-label={...}>\` with rect and title; category maps to color, freshness maps to opacity and CSS class. Wheel prevents default and scales 0.9/1.1 clamped between 320 and 1,920 units. Pointer delta shifts x/y. Enter/space selects; Escape clears.

- [ ] **Step 4: Verify and commit**

Run: \`npm test -- --run src/components/CityMap.test.tsx && npm run typecheck\`

Expected: PASS.

\`\`\`bash
git add src/components/CityMap.tsx src/components/CityMap.test.tsx
git commit -m "feat: render interactive SVG city"
\`\`\`

## Task 6: Compose, style, document and validate release

**Files:**
- Modify: \`src/App.tsx\`, \`src/main.tsx\`, \`src/App.test.tsx\`
- Create: \`src/styles.css\`, \`README.md\`

**Interfaces:**
- App consumes \`useFolderScan\`, model functions and all four components.
- App owns \`filters\` and \`selectedPath\`.

- [ ] **Step 1: Add failing state tests**

Mock \`useFolderScan\`. Assert initial render contains \`不会上传或保存任何文件内容\`; assert a successful empty result contains \`这个文件夹还没有可建造的文件。\`.

- [ ] **Step 2: Verify failure**

Run: \`npm test -- --run src/App.test.tsx\`

Expected: FAIL because baseline App has only a heading.

- [ ] **Step 3: Compose app and visual system**

Map result entries through \`buildCity(result.entries, result.scannedAt)\`, apply category/freshness filters, and clear selected building if it becomes filtered. Render all specification states: initial, scanning, rejected/failed, unsupported, empty, and city. Import stylesheet in \`main.tsx\`. Define deep blue background, high contrast street colors, visible \`:focus-visible\`, responsive layout and a \`prefers-reduced-motion\` rule; no external fonts or network assets. README must give \`npm install\`, \`npm run dev\`, \`npm test\`, \`npm run typecheck\`, \`npm run build\`, Chromium requirement and metadata-only privacy boundary.

- [ ] **Step 4: Verify automated release gate**

Run: \`npm test -- --run && npm run typecheck && npm run build\`

Expected: all tests pass, check exits 0 and \`dist/\` exists.

- [ ] **Step 5: Browser acceptance check**

Run: \`npm run dev -- --host 127.0.0.1\`; use the local HTTP URL to test a populated folder, empty folder, filtering, wheel zoom, pointer pan, keyboard Enter/Escape and picker cancellation. Inspect browser network log: it must contain no request with local file metadata. Stop the server after testing.

- [ ] **Step 6: Commit final MVP**

\`\`\`bash
git add src/App.tsx src/App.test.tsx src/main.tsx src/styles.css README.md
git commit -m "feat: complete Folder City MVP"
\`\`\`

## Plan Self-Review

- **Spec coverage:** Tasks 2–3 implement all metadata rules, deterministic layout, local-only scan and truncation; Tasks 4–6 implement states, filters, statistics, details, accessibility and visual behavior; Task 6 verifies privacy and browser acceptance.
- **Scope check:** This remains one bounded frontend MVP. There is no backend, editor, sharing or 3D subsystem.
- **Placeholder scan:** No \`TBD\`, \`TODO\`, deferred work marker, or unspecified validation command remains.
- **Type consistency:** Scanner produces \`FileEntry\`; model produces \`CityBuilding\`; UI consumes buildings and \`CityFilters\`; hook owns scan state.

