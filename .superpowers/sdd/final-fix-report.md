# Folder City 最终审查修复报告

日期：2026-07-13（Asia/Shanghai）

## 修复范围与结果

1. **大城市紧凑总览**：全城级先按 LOD 生成可见展示项，再为每个街区生成确定性的展示专用网格坐标；街区底板、标题和全城 `contentBounds` 均只由这些展示项推导。源 `CityBuilding` 坐标不改，文件数/字节数保持精确，街区下钻仍使用完整源建筑与源坐标。
2. **601–1,000 聚合键**：改为 `districtKey + category + freshness`。`districtKey` 已携带首层目录与目录深度；同名首层目录但不同深度不再跨街区合并，每个群只下钻到自己的 `districtKey`。
3. **建筑级状态**：`selectedPath` 精确命中当前街区可见源建筑时显示“建筑级”；选择建筑不重新适配街区视口。Escape 顺序为建筑级 → 街区级 → 全城级。
4. **真实视口飞行**：程序化全城/街区适配使用 180ms `requestAnimationFrame` 四维 `viewBox` 插值；用户缩放或拖动会取消未完成动画；`prefers-reduced-motion: reduce` 精确走即时设置分支，不请求动画帧。
5. **新旧纹理**：三种 freshness 都有独立 SVG 图案覆盖层：斜线（recent）、圆点（current）、横线（aged），图例“明暗与纹理”描述与实际一致。
6. **移动导航**：≤900px 提供紧凑街区下拉框，包含“全城总览”和全部街区，且与地图受控状态同步；桌面仍使用街区索引。
7. **非法边界降级**：展示计算或 fit 发生非法 bounds 时捕获异常，保留 `0 0 960 640` 安全视图并在 SVG 内显示可理解的错误状态，不再让 React 渲染崩溃。
8. **清理**：删除未使用的 `.city-building*`、旧 `.city-district*` CSS；保留标题边界计算但未增加超出证据的文案声明；补充 data-URI favicon，消除验收时无关的 404 控制台错误。
9. **真实浏览器补充修复**：浏览器首次验收发现 SVG 只有 `min-height`，超高街区源 `viewBox` 会触发 SVG 内在宽高比，把移动地图撑至约 18,124px，并造成 ResizeObserver/飞行动画反馈环。已将桌面、平板、移动地图改为明确响应式 `height`（558px / 416px / 70svh），复测高度稳定。

## TDD 证据

先新增聚焦回归并运行：

```text
npm test -- --run src/lib/cityPresentation.test.ts src/components/BuildingGlyph.test.tsx src/components/CityNavigation.test.tsx src/components/CityMap.test.tsx src/App.test.tsx
Test Files 5 failed (5)
Tests 11 failed | 49 passed (60)
```

失败项准确覆盖：跨深度聚合、700 文件紧凑边界、freshness 纹理、移动导航、建筑级、RAF 插值/减弱动态、非法 bounds。完成最小实现后同一聚焦集合为 60/60 通过。

最终自动化门禁：

```text
npm test -- --run
Test Files 14 passed (14)
Tests 100 passed (100)

npm run typecheck
exit 0

npm run build
vite v6.4.3
41 modules transformed
dist/assets/index-CRfQlYHm.css 8.56 kB (gzip 2.61 kB)
dist/assets/index-BHWk9H72.js 173.36 kB (gzip 56.51 kB)
exit 0

git diff --check
exit 0
```

## 浏览器验收

方式：本地 Vite + headed Chromium。仅通过浏览器会话的临时 `addInitScript` 提供 File System Access API mock directory/file handles；未增加生产参数、隐藏入口或测试后门。每轮真实点击“选择文件夹”，扫描 20/200/700/1,000 个 mock 文件。

| 视口 | 文件数 | 精确统计 | 全城底板位于 viewBox | 街区进入/返回 | 地图渲染高度 | 导航 |
| --- | ---: | --- | --- | --- | ---: | --- |
| 1440×900 | 20 | 通过 | 通过 | 通过 | 558px | 桌面索引 |
| 1440×900 | 200 | 通过 | 通过 | 通过 | 558px | 桌面索引 |
| 1440×900 | 700 | 通过 | 通过 | 通过 | 558px | 桌面索引 |
| 1440×900 | 1,000 | 通过 | 通过 | 通过 | 558px | 桌面索引 |
| 390×844 | 20 | 通过 | 通过 | 通过 | 590.8px | 移动下拉 |
| 390×844 | 200 | 通过 | 通过 | 通过 | 590.8px | 移动下拉 |
| 390×844 | 700 | 通过 | 通过 | 通过 | 590.8px | 移动下拉 |
| 390×844 | 1,000 | 通过 | 通过 | 通过 | 590.8px | 移动下拉 |

附加交互证据：

- 正常动态偏好下，8 个场景的街区程序化跳转均在交互后观察到 flight 状态；240ms 后 flight 状态全部清除。
- 减弱动态偏好下，700 文件首次适配即时完成，flight 状态为 false；聚焦 fake-RAF 单测同时证明没有请求动画帧。
- 移动 20 文件场景：点击建筑后为“建筑级”且详情抽屉可见；第一次 Escape 回“街区级”，第二次 Escape 回“全城级”。
- 1,000 文件移动稳定截图确认：街区板、标题、两个 freshness 建筑群和 334/666 群数量徽标可读且位于地图内。
- 浏览器控制台：0 errors，0 warnings（仅 React DevTools info）。

## 限制与未冒充的验收项

- 原生系统文件夹选择器和真实文件系统权限提示不能在该无产品后门的自动化矩阵中可靠驱动。本轮验证的是应用通过真实点击调用 picker 后，对外部临时 mock handles 的端到端扫描、展示和交互。
- 因此未声称已自动化验证 macOS 原生 picker UI、真实权限授予/拒绝或真实磁盘目录；这些仍需人工 smoke test。
- 浏览器矩阵使用单街区大数据来直接覆盖 700 文件紧凑回归；跨目录深度的多街区聚合与精确下钻由纯函数回归测试覆盖。
