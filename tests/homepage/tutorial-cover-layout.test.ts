import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

test('教程卡片头图以卡片宽度保留 16:9 懒加载占位', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/themes/default/blocks/blog.tsx'),
    'utf8'
  );

  assert.match(
    source,
    /className="aspect-video w-full overflow-hidden"/,
    '头图容器必须在图片加载前预留稳定的 16:9 空间'
  );
  assert.match(
    source,
    /wrapperClassName="!block !h-full !w-full"/,
    '懒加载组件的固定像素 wrapper 必须收敛到卡片尺寸'
  );
  assert.match(
    source,
    /className="h-full w-full object-cover object-center"/,
    '图片必须填满头图容器并保持居中裁切'
  );
});
