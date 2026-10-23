# Pakka Local

The website for **Pakka Local**, an Indian street food truck in Chantilly, Virginia, is one picture: a living, game-like 2.5D sunset scene of the real truck and the Chat Bandi cart. There is no header, footer or scrolling page. Visitors:

- **talk to the vendor** at the truck window, or to the woman at the chaat cart (dialogue panel),
- **open the menu board** (the camera dollies into the A-frame board, and the board becomes a full-screen menu with an order tally, a text-your-order button and the photo of the real board),
- pick one of five languages (English, తెలుగు, हिन्दी, தமிழ், മലയാളം) from the pill at the top right.

Built with Vite, React 19 and Tailwind CSS v4. No backend and no routing: the build output is plain static files.

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
| `src/scene.js` | **Every coordinate of the scene, as data**: hotspots, the window and cart characters, layer polygons, depth of each layer, lights, clouds, birds, butterfly, layout rules |
| `src/menuData.js` | The menu as printed on the board, phone number and website. The only source of dishes and prices |
| `src/dialogue.js` | The vendor's and the chaat cart's dialogue trees (built from `menuData.js` + `i18n.js`) |
| `src/i18n.js` | Every UI string and dialogue line in the five languages, plus the dish notes |
| `src/dishInfo.js` | One-sentence general description of each dish (English; translations in `i18n.js`) |
| `src/orderStore.js` | The order tally (outside React state, so a change re-renders only what shows it) |
| `src/components/Scene.jsx` | Stage, layout, pan / tilt / gyro, layers, entrance, camera dolly |
| `src/components/SceneFx.jsx` | Clouds, birds, sunset glow, steam, dust motes, tree displacement filter |
| `src/components/Vendor.jsx` | The two SVG characters (man at the window, woman at the cart), idle life and wave |
| `src/components/Butterfly.jsx` | The butterfly that roams around the menu board |
| `src/components/Dialogue.jsx` | Dialogue panel (typewriter, choices, keyboard, swipe to close) |
| `src/components/MenuPanel.jsx`, `Order.jsx`, `Stepper.jsx`, `PhotoViewer.jsx`, `Mandala.jsx` | The menu board panel, order drawer and button, quantity control, board photo viewer, corner ornaments |
| `public/img/` | `scene.webp` (+ `-1200`, `-tiny`), `menu.webp`, `logo.png`, `logo-256.png` |
| `scripts/prepare-scene.mjs` | Builds the scene images from `source-photos/scene.webp` |
| `scripts/crop-images.mjs` | Builds `menu.webp` and the logos from `source-photos/` |

## How the scene works

One image, `public/img/scene.webp` (1750x1212), is the whole site. The real render is rows 256..956; the top and bottom 256 px are generated sky and gravel so the picture can cover any screen.

- **Layout.** Landscape screens (aspect 1.2 or wider) are covered, cropping the generated sky first. Portrait screens show the full height and the visitor drags (or tilts the phone) to pan; the first view centres the truck window.
- **Depth.** Copies of the image are cut out with clip-path polygons and stacked in a 3D container: sky at the back, the trees, the base (the image minus sky and trees), the truck lamps, the cart and the ground in front. Each layer is scaled so it registers exactly at rest; tilting with the mouse (or the drag / gyro on phones) reveals the depth.
- **Life.** Trees sway (plus a displacement shimmer on desktop), clouds drift, the sunset breathes, birds cross, lamps flicker, steam rises from the cart, dust drifts over the gravel, the two people breathe, blink, look around and wave when you hover their counter. Everything is transform / opacity / filter only, pauses when the tab is hidden or the menu is open, and is switched off for visitors who prefer reduced motion.

### Adjusting coordinates

All numbers in `src/scene.js` are **percent of the full 1750x1212 image**: a rect is `{ left, top, width, height }` (top-left corner and size), a point is `{ x, y }`, a polygon is a list of `[x, y]`. Because everything lives inside a box with the image's proportions, it stays glued to the picture at every screen size.

To tune a hotspot, run `npm run dev`, hover it (a thin outline shows), nudge the numbers by half a percent and save. The same goes for the vendor's window (`WINDOW_INTERIOR`), the woman at the cart (`CART_PERSON`; `occluder` is the polygon of food boxes drawn in front of her), the speech bubbles (`BUBBLES`), lamps and steam (`LIGHTS`) and the layer polygons (`POLYGONS`).

### Regenerating the scene

1. Put the new render at `source-photos/scene.webp`.
2. Run `node scripts/prepare-scene.mjs`. It writes `scene.webp`, `scene-1200.webp` and `scene-tiny.webp` to `public/img/`.
3. If the size of the render changed, update `SCENE_W` / `SCENE_H` in `src/scene.js`, the `SEAM` row and every coordinate that moved.

## The dialogue

`src/dialogue.js` builds two trees from `src/menuData.js` (dishes, prices, phone) and `src/i18n.js` (wording): the truck vendor (greeting, what we serve with prices per section, items without chicken or egg, add-ons, how to order, where we are) and the chaat cart (what chaat and pani puri are, what the cart sells, how to order). Lists of items are always derived from the menu data, never typed by hand. To change a line, edit it in `src/i18n.js` for every language.

Keyboard: arrow keys move between choices, number keys pick one, Space shows the whole line at once, Esc closes. On phones the panel is a bottom sheet that can be swiped down.

## The menu and the order

The menu panel is styled like the real A-frame board. Each row has a "+ Add" pill that becomes a "− n +" stepper with a remove button; the yellow order pill shows the running count and total. The order drawer offers **Text your order** (opens the phone's SMS app to the board's number with the order filled in, in English; nothing is sent by the site), **Call to order**, and **Share order image** (a receipt PNG through the share sheet, or a download). The "i" button on each dish shows a general description of what the dish usually is.

## Hosting

The site is static. `npm run build` produces a `dist/` folder, and that folder is the whole website. All image paths are absolute (`/img/...`) and there is no routing, so any host works as long as `dist/` is served from the root of a domain.

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
2. In `vite.config.js`, add `base: '/REPO-NAME/',` inside `defineConfig({ ... })`, with `REPO-NAME` being the repository name exactly. (If the repository is called `YOUR-NAME.github.io`, or you use your own domain, keep the default `base: '/'`.) Image paths in the page code follow `base` automatically; also update the `/img/...` paths in `index.html` (favicon and preload) to `/REPO-NAME/img/...`.
3. Run `npm install --save-dev gh-pages`.
4. Run `npx gh-pages -d dist` after `npm run build`, or in one go: `npm run build && npx gh-pages -d dist`. This pushes the built files to a branch called `gh-pages`.
5. On GitHub, open the repository, then Settings, then Pages. Under "Build and deployment" choose "Deploy from a branch", pick the `gh-pages` branch and the `/ (root)` folder, and save.
6. After a minute the site is live at `https://YOUR-NAME.github.io/REPO-NAME/`. Repeat step 4 to update it.

For Netlify, Vercel and a custom domain, never set `base`: leave it at `/`.

### Before you publish

- [ ] If the phone number or website changes, edit `src/menuData.js` (`PHONE_DISPLAY`, `PHONE_HREF`, `SITE_URL`). The call and text links come from the same place.
- [ ] If the menu changes, replace `public/img/menu.webp`, edit `src/menuData.js` to match the board exactly, and add a note for any new dish to `src/dishInfo.js` and to `dishes` in `src/i18n.js`.
- [ ] Run `npm run build` and `npm run lint`; both must finish without errors.
- [ ] Open the live site on a phone: drag around, talk to the vendor, tap the menu board, add an item, close the menu.

## Notes

- Cache headers: `public/_headers` is copied into `dist/`, so Netlify applies it for Git deploys and for a drag-and-drop of `dist/` alike. It caches `/assets/*` (content-hashed) for a year, `/img/*` (including the scene images) for one day, and always revalidates `/img/menu.webp` so a new menu board shows up immediately. `vercel.json` carries the same rules for Vercel. GitHub Pages ignores both files and sets its own caching.
- The display font (Archivo Black) loads from Google Fonts; Telugu, Hindi, Tamil and Malayalam use the system font.
- Accessibility: every hotspot is a real button reachable with Tab, the dialogue and the menu are modal dialogs (focus trapped and returned, Esc closes), screen readers get the full dialogue text at once, and reduced-motion visitors get a still scene with instant transitions.

## Removing clutter from the render

`node scripts/clean-scene.mjs` rebuilds `source-photos/scene-clean.png` from `source-photos/scene.webp`
with the propane cylinder, the trash can and the folding chair cloned out (truck body, the door seam,
the lower trim and clean gravel are copied over them with feathered edges). `prepare-scene.mjs` uses
the clean file automatically when it exists. Delete `scene-clean.png` to go back to the untouched render.
