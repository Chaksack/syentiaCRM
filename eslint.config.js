import antfu from '@antfu/eslint-config'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(antfu({
  rules: {
    'style/no-trailing-spaces': [
      'error',
      { ignoreComments: true },
    ],
    'style/max-statements-per-line': [
      'error',
      { max: 2 },
    ],
  },
}))
