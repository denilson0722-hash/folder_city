import { storyFor } from '../lib/cityModel';
import type { CityBuilding } from '../types';

export interface DetailsPanelProps {
  building: CityBuilding | null;
  layout: 'sidebar' | 'drawer';
  onClose: () => void;
}

export function DetailsPanel({ building, layout, onClose }: DetailsPanelProps) {
  if (building === null) {
    return null;
  }

  return (
    <aside aria-label="文件详情" data-layout={layout}>
      <h2>文件详情</h2>
      <button type="button" aria-label="关闭详情" onClick={onClose}>关闭</button>
      <dl>
        <dt>名称</dt>
        <dd>{building.name}</dd>
        <dt>路径</dt>
        <dd>{building.relativePath}</dd>
        <dt>类型</dt>
        <dd>{building.type || '未标明'}</dd>
      </dl>
      <p>{storyFor(building)}</p>
    </aside>
  );
}
