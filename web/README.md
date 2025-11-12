This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Analytics (Umami)

This app includes optional [Umami](https://umami.is) analytics. The script is injected by `src/components/Umami.tsx` and wired in `src/app/layout.tsx`.

Configure via environment variables (e.g. in `.env.local`):

```bash
# Required: Your Umami website ID (UUID from Umami dashboard)
NEXT_PUBLIC_UMAMI_WEBSITE_ID=00000000-0000-0000-0000-000000000000

# Required: Base URL (or full script URL) to your Umami instance
# - Umami Cloud (US): https://us.umami.is
# - Umami Cloud (EU): https://eu.umami.is
# - Self-hosted: https://your-domain
# You may also set the full script URL (ending with script.js)
NEXT_PUBLIC_UMAMI_URL=https://eu.umami.is

# Optional: Set to true to enable analytics outside production
# By default, analytics run only in production
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

Notes:
- By default, analytics load only in production (`NODE_ENV=production`). Set `NEXT_PUBLIC_ENABLE_ANALYTICS=true` to test locally.
- If `NEXT_PUBLIC_UMAMI_URL` does not end with `.js`, `/script.js` is appended automatically.
- No additional code changes are required; once env vars are set and the site is built, Umami will start tracking.

## Node version

This project targets Node 20.x. The version is declared in `package.json` under `engines` so platforms like Railway/Nixpacks pick it automatically.

If you use `nvm`, run:

```bash
nvm use 20
```
