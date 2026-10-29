# PulseNews
Next.js 14 + TypeScript + Tailwind live news reader on the Currents API.

1. `cp .env.example .env.local` and set `CURRENTS_API_KEY` (server-only).
2. `npm install && npm run dev`
3. Deploy: import into Vercel, add `CURRENTS_API_KEY` in Project Settings → Environment Variables.

Updates: the client polls `/api/news` every 60 s (paused in hidden tabs); the route is CDN-cached 60 s so all visitors share one upstream call.
Before launch, check category/country/language values against https://currentsapi.services/en/docs/ (the lists in `components/NewsApp.tsx`).
