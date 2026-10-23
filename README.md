# Pakka Local

Single-page website for **Pakka Local**, an Indian street food truck in Chantilly, Virginia.

- A full-screen photo of the real truck (night by default, day with the toggle).
- Visitors click the menu board in the photo, or the small label beside it, to open the full menu: the photo of the real menu board in a zoom and pan viewer, plus a plain text version with every item and price.
- A short "From the window" photo row and a footer. No invented hours, address or reviews.

Built with Vite, React 19 and Tailwind CSS v4. There is no backend and no routing, so the build output is plain static files.

## Run it

```
npm install
npm run dev       # local dev server (prints a localhost address)
npm run build     # production build into dist/
npm run preview   # serve dist/ locally to check the production build
npm run lint      # oxlint
```

Requires Node 20.19 or newer (or 22.12+).

## Where things are

| File | What it is |
| --- | --- |
| `src/scenes.js` | The two hero scenes (night, day): image files, size and the menu-board hotspot rectangle |
| `src/menuData.js` | Text version of the menu, phone number and website link |
| `src/components/Hero.jsx` | Full-screen photo, scene toggle, hotspot and label |
| `src/components/MenuOverlay.jsx` | Menu viewer (zoom, pan, pinch, keyboard) and the text version |
| `src/components/Gallery.jsx`, `Footer.jsx` | "From the window" row and footer |
| `public/img/` | All photos, served at `/img/...` |
| `source-photos/` | The original photos used to make `public/img/` |
| `scripts/crop-images.mjs` | Image preparation script (below) |
| `netlify.toml`, `vercel.json` | Hosting settings, read automatically |

## Replacing the photos

`scripts/crop-images.mjs` turns the original screenshots in `source-photos/` (`1.webp` ... `9.webp`) into the web files in `public/img/`:

- `1.webp` becomes `hero-night.webp` and `hero-night-800.webp` (the night hero). It paints over the screenshot's info card and thumbnail by mirroring a patch of nearby sky, then crops to 1202x800.
- `2.webp` becomes `hero-day.webp` and `hero-day-800.webp` (the day hero, cropped to 1212x735), and also the round logo `logo.png` (a 110x110 crop, scaled to 256x256).
- `4.webp` becomes `menu.webp` (the menu board, with the bottom watermark strip cropped off).
- `3.webp`, `6.webp`, `7.webp`, `8.webp` become `food-noodles-800.webp`, `food-sandwich-800.webp`, `chat-cart-night-800.webp` and `chat-bandi-800.webp` for the photo row.

All crop rectangles are written out in the script, so each one can be adjusted there. To swap photos:

1. Put your original photos in `source-photos/`, using the same file names (`1.webp` to `8.webp`), or edit the file names and crop rectangles in `scripts/crop-images.mjs`.
2. Run `node scripts/crop-images.mjs`.
3. Look at the result with `npm run dev`.
4. If a hero photo's size changed, update `width` and `height` in `src/scenes.js`. If you changed the size of a photo-row image, update its `width` and `height` in `src/components/Gallery.jsx`. If you changed `menu.webp`, update `IMG` in `src/components/MenuOverlay.jsx`.
5. Re-check the hotspot (next section).

## Adjusting the hotspot

The invisible button over the menu board is defined in `src/scenes.js`, once per scene:

```js
hotspot: { left: 67, top: 62, width: 8.5, height: 24.5 }
```

All four numbers are percentages of the photo itself: `left` and `top` are the distance of the rectangle's top-left corner from the photo's top-left corner, `width` and `height` are its size. Because the rectangle lives inside a box with the photo's own proportions, it stays on the board at every screen size. The "Click on the menu..." label is placed automatically to the left of the board, so it never covers it.

To tune it, run `npm run dev`, hover the board (a thin outline appears on hover), nudge the numbers by half a percent, and save.

## Hosting

The site is static. `npm run build` produces a `dist/` folder, and that folder is the whole website. All photo paths are absolute (`/img/...`) and there is no routing, so any host works as long as `dist/` is served from the root of a domain.

### a) Netlify drag and drop (fastest, no account linking)

1. On your computer, open a terminal in this folder and run `npm install` (only the first time), then `npm run build`. A `dist` folder appears.
2. In your browser, go to https://app.netlify.com/drop and sign in or sign up for a free account.
3. Drag the `dist` folder (the folder itself, not a zip) onto the "Drag and drop your site output folder here" area.
4. Wait a few seconds. Netlify shows a site address such as `something-random.netlify.app`. Open it to check the site.
5. To change the address: Site configuration, then "Change site name". To use your own domain: Domain management, then "Add a domain".
6. To update the site later, rebuild and drag the new `dist` folder onto the site's "Deploys" page.

### b) Netlify from a GitHub repository

1. Create a repository on GitHub and push this project to it (the `node_modules` and `dist` folders are already ignored).
2. In Netlify, choose "Add new site", then "Import an existing project", then GitHub, and pick the repository.
3. Leave the build settings as they are. They are read from `netlify.toml` (build command `npm run build`, publish directory `dist`, Node 22).
4. Click "Deploy". After the first build finishes you get a `.netlify.app` address.
5. Every later push to the main branch redeploys the site automatically.

### c) Vercel

1. Push this project to a GitHub repository.
2. Go to https://vercel.com/new and sign in with GitHub.
3. Import the repository. Vercel detects Vite and reads `vercel.json` (build `npm run build`, output `dist`), so keep the default settings.
4. Click "Deploy". You get a `.vercel.app` address, and every push to the main branch redeploys.

### d) GitHub Pages

A GitHub Pages "project" site lives under a sub-path (`https://YOUR-NAME.github.io/REPO-NAME/`), so Vite must be told about it.

1. Push this project to a GitHub repository.
2. In `vite.config.js`, add `base: '/REPO-NAME/',` inside `defineConfig({ ... })`, with `REPO-NAME` being the repository name exactly. (If the repository is called `YOUR-NAME.github.io`, or you use your own domain, keep the default `base: '/'`.) Photo paths follow `base` automatically. The `<link rel="preload">` line in `index.html` still points at `/img/...`; delete that one line for a sub-path site.
3. Run `npm install --save-dev gh-pages`.
4. Run `npx gh-pages -d dist` after `npm run build`, or in one go: `npm run build && npx gh-pages -d dist`. This pushes the built files to a branch called `gh-pages`.
5. On GitHub, open the repository, then Settings, then Pages. Under "Build and deployment" choose "Deploy from a branch", pick the `gh-pages` branch and the `/ (root)` folder, and save.
6. After a minute the site is live at `https://YOUR-NAME.github.io/REPO-NAME/`. Repeat step 4 to update it.

For Netlify, Vercel and a custom domain, never set `base`: leave it at `/`.

### Before you publish

- [ ] If the phone number or website changes, edit `src/menuData.js` (`PHONE_DISPLAY`, `PHONE_HREF`, `SITE_URL`). The number also appears in the `tel:` links, which come from the same file.
- [ ] If the menu changes, replace `public/img/menu.webp` and edit the text version in `src/menuData.js` to match the board exactly.
- [ ] After swapping photos, re-run `node scripts/crop-images.mjs`, then update image sizes as described above.
- [ ] Re-check the hotspot in `src/scenes.js` (hover the board in both Night and Day, at a phone width and a desktop width).
- [ ] Run `npm run build` and `npm run lint`; both must finish without errors.
- [ ] Open the live site on a phone: tap the board, check the menu is readable, close it with the Close button.

## Notes

- Cache headers: `netlify.toml` caches `/assets/*` (content-hashed) for a year and `/img/*` for 30 days. If you replace a photo and still see the old one, hard refresh or wait for the cache to expire.
- Accessibility: the menu opens as a modal dialog (focus is trapped and returned to the board button on close), `Esc` closes it, `+` `-` `0` zoom, arrow keys pan when zoomed, and animation is switched off for visitors who prefer reduced motion.
