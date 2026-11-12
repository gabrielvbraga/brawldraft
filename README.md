# BrawlDraft

Brawler recommendations for Brawl Stars Ranked drafts, based on win rates collected from real matches.

**Live:** https://brawldraft-fawn.vercel.app

## Features

- Draft assistant with bans and pick-by-pick suggestions
- Shared rooms for drafting as a trio
- Meta by map, refreshed automatically from collected battles
- Import your brawlers by player tag
- Upgrade suggestions, match history, and shareable draft images
- Accounts, push notifications, and installable as a PWA

## Tech Stack

Next.js · React · TypeScript · Tailwind CSS · Supabase · Vercel

## Getting Started

    npm install
    npm run dev

Run `supabase.sql` in the Supabase SQL Editor, then create `.env.local` with:

    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_ANON_KEY=
    SUPABASE_SERVICE_ROLE_KEY=
    BRAWL_API_KEY=
    CRON_SECRET=
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=
    VAPID_PRIVATE_KEY=

## Disclaimer

This material is unofficial and is not endorsed by Supercell. For more information see Supercell's [Fan Content Policy](https://supercell.com/fan-content-policy).
