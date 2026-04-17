This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### First-time setup: authenticate wrangler

Before running `npm run dev` for the first time (or after your wrangler token expires), log in manually:

```bash
npx wrangler login
```

Why: `next.config.ts` calls `initOpenNextCloudflareForDev({ remoteBindings: true })` to connect dev to the real Cloudflare R2/D1 resources. Without a cached token, this kicks off a wrangler OAuth flow. With `next dev --turbopack`, the config is evaluated in two processes, and both race to bind wrangler's OAuth callback port (8976), causing:

```
Error: listen EADDRINUSE: address already in use ::1:8976
```

Logging in once caches the token, so the OAuth callback server is never started and the race goes away.

### Running the dev server

```bash
npm run dev
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
