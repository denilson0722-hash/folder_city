import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { StatsBar } from './StatsBar';

test('renders the current filtered type distribution from category counts', () => {
  render(
    <StatsBar
      status="success"
      skippedCount={0}
      wasTruncated={false}
      summary={{
        fileCount: 3,
        totalBytes: 12,
        largestFile: null,
        categoryCounts: {
          document: 0,
          image: 2,
          media: 0,
          code: 1,
          archive: 0,
          other: 0,
        },
      }}
    />,
  );

  const distribution = screen.getByLabelText('当前筛选结果按类型分布');
  expect(distribution).toHaveTextContent('文档：0');
  expect(distribution).toHaveTextContent('图像：2');
  expect(distribution).toHaveTextContent('代码：1');
});
