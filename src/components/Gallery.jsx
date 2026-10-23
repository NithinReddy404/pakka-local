import { memo } from 'react'
import { img } from '../imgPath.js'

const PHOTOS = [
  { src: img('food-noodles-800.webp'), width: 800, height: 627, caption: 'Chicken noodles & chicken pakodi' },
  { src: img('food-sandwich-800.webp'), width: 800, height: 474, caption: 'Grilled sandwich' },
  { src: img('chat-cart-night-800.webp'), width: 800, height: 553, caption: 'Chat Bandi cart at night' },
  { src: img('chat-bandi-800.webp'), width: 705, height: 820, caption: 'Pani puri at the Chat Bandi cart' },
]

function Gallery() {
  return (
    <section aria-labelledby="window-heading" className="bg-ink py-16 sm:py-24">
      <h2
        id="window-heading"
        className="mx-auto mb-8 max-w-6xl px-4 text-2xl font-semibold tracking-tight text-paper sm:px-8 sm:text-3xl"
      >
        From the window
      </h2>
      <div
        role="region"
        aria-label="Photos from the truck, scroll sideways"
        tabIndex={0}
        className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 sm:scroll-px-8 sm:gap-6 sm:px-8"
      >
        {PHOTOS.map((p) => (
          <figure key={p.src} className="m-0 shrink-0 snap-start">
            <img
              src={p.src}
              width={p.width}
              height={p.height}
              alt={p.caption}
              loading="lazy"
              decoding="async"
              className="h-[260px] w-auto rounded-xl sm:h-[340px] lg:h-[400px]"
            />
            <figcaption className="mt-3 text-sm text-paper/80">{p.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export default memo(Gallery)
