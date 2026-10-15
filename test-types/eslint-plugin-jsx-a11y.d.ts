// Installed plugin has no declarations. Describe the configuration API used by this repo.
declare module 'eslint-plugin-jsx-a11y' {
  import type { Linter } from 'eslint'
  const plugin: { flatConfigs: { recommended: Linter.Config } }
  export default plugin
}
