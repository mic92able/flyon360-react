# FlyOn360 — Immersive Virtual Tour Platform

[**Live Website ↗**](https://flyon360.pages.dev/)

FlyOn360 is an interactive web application developed for a client to explore cultural and historical sites across Basilicata, Italy. Built with **React and TypeScript**, the application combines interactive maps, immersive 360° experiences, multimedia content, and browser-based VR support.

The interface is designed to make geographically distributed destinations accessible through a single, responsive experience, connecting map-based exploration with rich visual storytelling.

## Key Features

- **Interactive maps:** Explore locations through a Leaflet map with markers and navigation between sites.
- **360° experiences:** View panoramic scenes powered by Three.js and navigate through interactive hotspots.
- **Immersive media:** Access audio guides, video content, and contextual information about locations.
- **Bilingual interface:** Browse content in Italian and English.
- **WebXR support:** Access supported immersive experiences through compatible browsers and devices.
- **Progressive asset loading:** Load scene assets progressively to support the multimedia experience.
- **Structured data:** Use typed metadata and organized content modules to manage locations, sites, and media assets.

The application contains **8 geographic panoramas, 38 sites, and 126 Three.js hotspots**.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, TypeScript |
| Build tooling | Vite |
| 3D experiences | Three.js |
| Interactive maps | Leaflet |
| Immersive web | WebXR |
| Styling | CSS |
| Deployment | Cloudflare Pages |
| Media hosting | Cloudflare R2 |

## Architecture

The codebase is structured around focused modules for application state, content, maps, 3D scenes, and UI:

```text
src/
├── App.tsx       # Application state and navigation
├── data/         # Typed content catalog, metadata, asset resolution
├── map/          # Leaflet map and location markers
├── scene/        # Three.js scenes, hotspots, progressive loading, WebXR
└── ui/           # Interface, information panels, language and media

scripts/          # Asset validation and R2 upload utilities
public/assets/    # Local multimedia assets for development
```

The frontend is deployed as a static build without a dedicated application backend. In production, media assets are served from Cloudflare R2.

## Run Locally

**Requirements:** Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Create a production build and preview it:

```bash
npm run build
npm run preview
```

Run the available asset validation and TypeScript checks:

```bash
npm test
npm run typecheck
```

## Deployment

The production site is hosted on **Cloudflare Pages**. Build output is generated with:

```bash
npm run build
```

Publish the generated `dist` directory.

Multimedia assets are served from **Cloudflare R2** in production. To configure the public asset location, set the following build-time variable:

```text
VITE_ASSET_BASE_URL=https://assets.example.com/
```

Replace the sample URL with your actual public R2 asset endpoint. Include the trailing slash. For local development, assets are loaded from `public/assets`.

The Vite build uses relative asset paths (`base: './'`) for static deployment.

## Technical Highlights

- Component-based frontend development using React and typed TypeScript modules.
- Interactive 3D scene rendering and hotspot navigation with Three.js.
- Integration of map navigation, geographic content, and immersive media.
- Management of bilingual content and multimedia asset paths.
- Separation of application UI, map rendering, scene rendering, and data modules.
- Static deployment and external media delivery with Cloudflare Pages and R2.

---

**[Explore FlyOn360 →](https://flyon360.pages.dev/)**
