// The vendor's dialogue tree. Every dish, price, the phone number and the place come from
// src/menuData.js; the wording of each line comes from src/i18n.js. Nothing here may name
// a dish or a price directly.
//
// A node is { text, items?, choices }:
//   text   the vendor's line (typed out as the big heading)
//   items  optional [{ name, price }] rows shown under it (names as printed on the board)
// A choice is { label, kind, ... } where kind is how it is drawn:
//   'card'     a question card       { to: '<node id>' }
//   'primary'  a white button        { action: 'menu' } or { href }
//   'link'     an underlined link    { to } or { action: 'bye' }

import { MENU_SECTIONS, PHONE_DISPLAY, PHONE_HREF } from './menuData.js'
import { fill } from './i18n.js'

const sectionId = (title) => `section:${title}`
const rows = (items) => items.map(({ name, price }) => ({ name, price }))
const allItems = MENU_SECTIONS.flatMap((s) => s.items)
const addOns = MENU_SECTIONS.find((s) => s.title === 'Add Ons')

// Derived from the data: names containing neither "Chicken" nor "Egg".
const withoutChickenOrEgg = allItems.filter((i) => !/chicken|egg/i.test(i.name))

const cache = new Map()
const SMS_HREF = PHONE_HREF.replace(/^tel:/, 'sms:')

/**
 * Builds (once per language and speaker) the dialogue tree from the strings `s` of
 * src/i18n.js. `speaker` is 'truck' (the vendor at the window) or 'cart' (the chaat cart).
 */
export function buildDialogue(s, speaker = 'truck') {
  const cacheKey = `${speaker}:${s.vendorName}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)
  const section = (title) => s.sections[title] ?? title
  const ROOT = [
    { label: s.qServe, to: 'serve', kind: 'card' },
    { label: s.qNoChickenEgg, to: 'noChickenEgg', kind: 'card' },
    { label: s.qAddOns, to: 'addOns', kind: 'card' },
    { label: s.qOrder, to: 'order', kind: 'card' },
    { label: s.qWhere, to: 'where', kind: 'card' },
  ]
  const BYE = { label: s.bye, action: 'bye', kind: 'link' }
  const MENU = { label: s.openMenuBoard, action: 'menu', kind: 'primary' }
  const MORE = { label: s.anythingElse, to: 'root', kind: 'link', more: true }
  const back = (to) => ({ label: s.back, to, kind: 'link' })
  // An answer: its line and rows, its own actions, then "Anything else?" and "Bye".
  const answer = (text, items, extra = [], links = []) => ({ text, items, choices: [...extra, ...links, MORE, BYE] })

  const tree = {
    root: { text: s.greeting, choices: [...ROOT, BYE] },
    serve: {
      text: s.aServe,
      choices: [...MENU_SECTIONS.map((x) => ({ label: section(x.title), to: sectionId(x.title), kind: 'card' })), back('root'), BYE],
    },
    ...Object.fromEntries(
      MENU_SECTIONS.map((x) => [sectionId(x.title), answer(section(x.title), rows(x.items), [MENU], [back('serve')])]),
    ),
    noChickenEgg: answer(s.aNoChickenEgg, rows(withoutChickenOrEgg), [MENU]),
    addOns: answer(section(addOns?.title ?? 'Add Ons'), rows(addOns?.items ?? []), [MENU]),
    order: answer(fill(s.aOrder, { phone: PHONE_DISPLAY }), undefined, [
      { label: fill(s.callPhone, { phone: PHONE_DISPLAY }), href: PHONE_HREF, kind: 'primary' },
      { label: fill(s.textPhone, { phone: PHONE_DISPLAY }), href: SMS_HREF, kind: 'primary' },
      MENU,
    ]),
    where: answer(s.aWhere),
  }
  // The chaat cart: general knowledge only, plus the same order answer as the truck.
  const cart = {
    root: {
      text: s.cGreeting,
      choices: [
        { label: s.cQChaat, to: 'chaat', kind: 'card' },
        { label: s.cQPani, to: 'pani', kind: 'card' },
        { label: s.cQSell, to: 'sell', kind: 'card' },
        { label: s.qOrder, to: 'order', kind: 'card' },
        BYE,
      ],
    },
    chaat: answer(s.cAChaat),
    pani: answer(s.cAPani),
    sell: answer(s.cASell, undefined, [MENU]),
    order: tree.order,
  }
  const result = speaker === 'cart' ? cart : tree
  cache.set(cacheKey, result)
  return result
}

/** Plain-text version of a node for screen readers (the line, one row per item, the prompt). */
export const spoken = (node) =>
  [node.text, ...(node.items ?? []).map((i) => `${i.name}, ${i.price}`), node.choices.find((c) => c.more)?.label ?? '']
    .filter(Boolean)
    .join('\n')
