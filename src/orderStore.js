// The order tally lives outside React state so adding an item re-renders only the item's
// own count chip and the order button, never the whole menu panel. It survives closing and
// reopening the menu for the rest of the visit.
import { useSyncExternalStore } from 'react'
import { MENU_SECTIONS } from './menuData.js'

let counts = {}
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

export const orderStore = {
  get: () => counts,
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  add(key) {
    counts = { ...counts, [key]: (counts[key] ?? 0) + 1 }
    emit()
  },
  dec(key) {
    const n = (counts[key] ?? 0) - 1
    const next = { ...counts }
    if (n > 0) next[key] = n
    else delete next[key]
    counts = next
    emit()
  },
  remove(key) {
    const next = { ...counts }
    delete next[key]
    counts = next
    emit()
  },
  clear() {
    counts = {}
    emit()
  },
}

/** The whole tally ({ key: count }). */
export const useOrder = () => useSyncExternalStore(orderStore.subscribe, orderStore.get)

/** The summed count of some keys (a number, so other keys changing never re-renders). */
export const useCount = (keys) =>
  useSyncExternalStore(orderStore.subscribe, () => keys.reduce((n, k) => n + (counts[k] ?? 0), 0))

// ---- Entries derived from the board ----

/** An item with "a / b" prices (the add-on) becomes one order entry per price. */
export const variantsOf = (item) => {
  const prices = item.price.split('/').map((p) => p.trim())
  return prices.map((p, i) => ({
    key: prices.length > 1 ? `${item.name}#${i}` : item.name,
    label: prices.length > 1 ? `${item.name} (${p})` : item.name,
    price: p,
    cents: Math.round(parseFloat(p.replace(/[^0-9.]/g, '')) * 100),
  }))
}

const ENTRIES = Object.fromEntries(MENU_SECTIONS.flatMap((s) => s.items.flatMap(variantsOf)).map((v) => [v.key, v]))

/** The order as lines { key, label, price, cents, n } plus totals, from a counts object. */
export const linesOf = (counts) => {
  const lines = Object.entries(counts)
    .filter(([key]) => ENTRIES[key])
    .map(([key, n]) => ({ ...ENTRIES[key], n }))
  return {
    lines,
    totalCents: lines.reduce((s, l) => s + l.cents * l.n, 0),
    totalItems: lines.reduce((s, l) => s + l.n, 0),
  }
}
