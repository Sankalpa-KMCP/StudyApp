let prefetched = false

/** Warm the lazy Settings ControlDeck chunk on idle or nav hover. */
export function prefetchControlDeck() {
  if (prefetched) return
  prefetched = true
  void import('../components/ControlDeck')
}
