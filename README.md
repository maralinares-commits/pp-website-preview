# Personal Paparazzi: website refresh (local draft)

A refreshed version of [personalpaparazzi.com](https://personalpaparazzi.com/), rebuilt
against the Marketing Guidelines (draft 0.2) at
[personalpaparazzi.sandbox.designli.io](https://personalpaparazzi.sandbox.designli.io/).

It covers six live pages: the home page, the photographers page (now the "For local
creators" tab), the privacy policy, the terms, the tutorials page, and the orphaned
`/pricing` page, whose content is now a section on the home page.

Most of the written content is the client's own, kept word for word. What changed, and why,
is listed in [NOTES.md](NOTES.md). Anything that needs the client's decision is in the
**Open questions** section at the end of that file.

## Look at it

Double-click **`serve.command`**, then open <http://localhost:4321> in your browser.
A small black terminal window will stay open while the site is running. Close it when
you're done. It serves the files with caching turned off, so a reload always shows the
current version rather than a stale stylesheet.

If you'd rather do it by hand, open Terminal and run:

```
cd ~/personalpaparazzi-web
python3 -m http.server 4321
```

Both pages that matter are worth checking at phone width too. In Chrome or Safari, make
the window narrow, or use the browser's device preview.

## What's in here

| File | What it is |
| --- | --- |
| `index.html` | Home page |
| `become-a-paparazzi.html` | The "For local creators" tab |
| `tutorials.html` | Quick Tips and tutorials, for photographers |
| `privacy-policy.html` | Privacy policy, copy carried over unchanged |
| `terms.html` | Terms of service, copy carried over unchanged |
| `assets/styles.css` | All the styling, one file, commented |
| `assets/site.js` | Menu, sticky download bar, nav highlighting |
| `assets/og-card.png` | The image that shows when someone shares a link |
| `assets/*.svg` | Logos and the elephant, straight from the Figma design system |
| `assets/figtree-var.woff2` | Figtree, the brand typeface (free, SIL Open Font License) |

There is no build step and nothing to install. These are plain files: whatever you see
locally is exactly what a web host would serve.

## If it gets approved

The current live site is a React app. This refresh is plain HTML, so putting it live means
either replacing the React site or handing these files to whoever maintains it as the
reference for what the pages should say and look like.

Two things to remember at that point:

1. The live site loads `/analytics.js`. That script is not in this local copy, so it needs
   adding back before launch or you lose tracking.
2. The links to Privacy Policy, Terms, and Quick Tips use file names here
   (`privacy-policy.html`). On the real site those are paths (`/privacy-policy`), so they
   need updating to match.
