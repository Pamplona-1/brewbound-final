# BrewBound

BrewBound is a Vite + React app for coffee-shop discovery and GIS navigation in Calamba. The bundled shop catalogue is in [`src/data/deployedShops.json`](./src/data/deployedShops.json), and shop edits and uploaded photos are saved in the current browser's local storage.

## Run locally

1. Install Node.js.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

## Google Sheets catalogue

The app loads the shop catalogue from the Apps Script web app and writes admin edits, deletions, and resets back to the sheet. It refreshes the catalogue when the app is opened or refocused, and periodically while visible. The web app URL is configured in [`src/utils/googleSheets.ts`](./src/utils/googleSheets.ts).

For all admin fields and uploaded photos to sync, update the bound Apps Script with [`Code.gs`](./Code.gs) and deploy a new web app version. This adds columns for the full shop records while retaining the existing catalogue columns and sheet data. The script uses spreadsheet ID `16oBhwwDdGxsEfuDcAvoVma1KV34dN6-ZzQaGEileV1U`; set the deployment to execute as the spreadsheet owner and allow access to the app. Then redeploy the Vercel app. The Apps Script deployment ID already in `googleSheets.ts` can remain the same if you update its deployment in place.

The web app endpoint accepts writes from app users. Do not store private data in this sheet; use access restrictions suitable for your use case.

## Admin access and saved changes

Open the admin login from the app and enter the initial password `admin2026`. You can change it under **Security & Backups**. The password is stored only in that browser's local storage. Shop data is saved locally and synced with Google Sheets when the Apps Script is available.

The local copy is a fallback and does not synchronize by itself. With Google Sheets connected, the catalogue fields supported by the existing sheet are shared across devices and browsers. Edits are not written back to GitHub or Vercel. Use **Export Dataset** in the admin area to back up your changes.

The client-side admin password is only a convenience screen, not secure server-side authentication. Do not use it to protect sensitive information.

## Deploy to Vercel

Import the project repository into Vercel and use:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Commit [`src/data/deployedShops.json`](./src/data/deployedShops.json) and the files in [`public/images`](./public/images) to include the bundled catalogue and assets in the deployment.
