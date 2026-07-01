const loadedWeights = new Set<string>()

async function loadFontFamily(family: 'inter' | 'outfit' | 'jetbrains-mono', weights: string[]) {
  const imports = weights
    .filter(w => !loadedWeights.has(`${family}-${w}`))
    .map(async w => {
      loadedWeights.add(`${family}-${w}`)
      await import(`@fontsource/${family}/${w}.css`)
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
