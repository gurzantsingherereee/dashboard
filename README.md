# Design Team MERN Dashboard

Full dashboard for product asset handoff across e-commerce, quick commerce, and the design team.

## Features

- Product add, edit, delete
- Manual image URL and file upload previews
- Google Sheet sync with flexible column detection
- Separate e-commerce, quick commerce, and design-team views
- Design task API protected by `DESIGN_ACCESS_CODE`
- MongoDB support with local JSON fallback for immediate use

## Run

```bash
cp .env.example server/.env
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

Design access code defaults to `001Mutant`.

## Google Sheet Sync

The server can read a public/exportable Google Sheet as CSV. Use columns like:

- Product/Folder Name
- Google Drive Link
- Shared With
- Type
- Image URL or Preview Image
- Status
- Channel

When a row is added to the Sheet, the server syncs it on the interval in `.env`, and the dashboard can also trigger sync manually.
