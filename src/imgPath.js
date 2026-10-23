// Every photo is addressed through here. With the default `base: "/"` this gives
// "/img/<name>" (absolute, works from any route and from Netlify Drop). If you deploy
// under a sub-path (GitHub Pages project site) set `base` in vite.config.js and
// everything follows.
export const img = (name) => `${import.meta.env.BASE_URL}img/${name}`
