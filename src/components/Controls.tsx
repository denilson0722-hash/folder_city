import { FILE_CATEGORIES, type FileCategory, type Freshness } from '../types';

export interface CityFilters {
  category: FileCategory | 'all';
  freshness: Freshness | 'all';
}

export interface ControlsProps {
  filters: CityFilters;
  onPickFolder: () => void;
  onReset: () => void;
  onChange: (filters: CityFilters) => void;
}

const categoryLabels: Record<FileCategory, string> = {
  document: '文档',
  image: '图像',
  media: '媒体',
  code: '代码',
  archive: '压缩包',
  other: '其他',
};

const freshnessOptions: ReadonlyArray<{ value: CityFilters['freshness']; label: string }> = [
  { value: 'all', label: '全部时间' },
  { value: 'recent', label: '最近 7 天' },
  { value: 'current', label: '8 至 90 天' },
  { value: 'aged', label: '91 天前' },
];

export function Controls({ filters, onPickFolder, onReset, onChange }: ControlsProps) {
  return (
    <section aria-label="文件夹控制">
      <button type="button" onClick={onPickFolder}>选择文件夹</button>
      <button type="button" onClick={onReset}>重置</button>

      <label>
        文件类型
        <select
          value={filters.category}
          onChange={(event) => onChange({ ...filters, category: event.target.value as CityFilters['category'] })}
        >
          <option value="all">全部类型</option>
          {FILE_CATEGORIES.map((category) => (
            <option key={category} value={category}>{categoryLabels[category]}</option>
          ))}
        </select>
      </label>

      <label>
        修改时间
        <select
          value={filters.freshness}
          onChange={(event) => onChange({ ...filters, freshness: event.target.value as CityFilters['freshness'] })}
        >
          {freshnessOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <p>不会上传或保存任何文件内容。</p>
    </section>
  );
}
