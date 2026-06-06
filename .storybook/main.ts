import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
  addons: [],
  async viteFinal(config) {
    config.plugins = (config.plugins ?? []).filter(
      plugin =>
        plugin &&
        typeof plugin === 'object' &&
        'name' in plugin &&
        !String((plugin as { name: string }).name).includes('pwa'),
    )
    return config
  },
}

export default config
