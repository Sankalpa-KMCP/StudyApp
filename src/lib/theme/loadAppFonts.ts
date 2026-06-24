const loadedWeights = new Set<string>()

type FontFamily = 'inter' | 'outfit' | 'jetbrains-mono'

const fontModules: Record<FontFamily, Record<string, () => Promise<unknown>>> = {
  inter: {
    '400': () => import('@fontsource/inter/400.css'),
    '600': () => import('@fontsource/inter/600.css'),
  },
  outfit: {
    '400': () => import('@fontsource/outfit/400.css'),
    '600': () => import('@fontsource/outfit/600.css'),
  },
  'jetbrains-mono': {
    '400': () => import('@fontsource/jetbrains-mono/400.css'),
    '600': () => import('@fontsource/jetbrains-mono/600.css'),
  },
}

async function loadFontFamily(family: FontFamily, weights: string[]) {
  const imports = weights
    .filter(w => !loadedWeights.has(`${family}-${w}`))
    .map(async w => {
      loadedWeights.add(`${family}-${w}`)
      const load = fontModules[family][w]
      if (load) await load()
    })
  await Promise.all(imports)
}

/** Load only the UI and monospace families the user has selected. */
export async function loadAppFonts(uiFont: string, developerFont: string) {
  const jobs: Promise<void>[] = []

  if (uiFont === 'Inter') {
    jobs.push(loadFontFamily('inter', ['400', '600']))
  } else if (uiFont === 'Outfit') {
    jobs.push(loadFontFamily('outfit', ['400', '600']))
  }

  if (developerFont === 'JetBrains Mono') {
    jobs.push(loadFontFamily('jetbrains-mono', ['400', '600']))
  } else if (developerFont === 'Inter') {
    jobs.push(loadFontFamily('inter', ['400', '600']))
  } else if (developerFont === 'Outfit') {
    jobs.push(loadFontFamily('outfit', ['400', '600']))
  }

  await Promise.all(jobs)
}
