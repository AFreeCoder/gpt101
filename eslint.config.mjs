import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // 这些规则由 Next 16 随 React Compiler 检查引入。现有代码先保留
      // warning 信号，待按模块迁移后再提升为阻断规则。
      '@next/next/no-html-link-for-pages': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    '.source/**',
    'build/**',
    'coverage/**',
    'out/**',
    'next-env.d.ts',
  ]),
]);
