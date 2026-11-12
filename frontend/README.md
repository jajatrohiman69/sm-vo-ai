This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend URL

The frontend proxies API requests through Next.js to `http://127.0.0.1:8000`
by default. Set `VHQ_API_URL` in the frontend environment to use another
backend URL.

## Gemini API

To use a Google Gemini API key directly, set these values in `backend/.env`:

```env
VHQ_AI_PROVIDER=gemini
GEMINI_API_KEY=your-google-ai-studio-api-key
GEMINI_MODEL=gemini-2.5-flash
```

Keep the key private and restart the backend after changing the file. The
backend defaults to `gemini-2.5-flash`; set `GEMINI_MODEL` to another model
available to your key if needed. When this provider is active, chat, task
planning, agent tasks, and social content use the configured Gemini model.
OCTA remains the default provider when `VHQ_AI_PROVIDER` is not set.

## Custom OpenAI-compatible API

To use another provider with an OpenAI-compatible chat completions API, set
these values in `backend/.env`:

```env
VHQ_AI_PROVIDER=openai-compatible
VHQ_AI_API_KEY=your-api-key
VHQ_AI_BASE_URL=https://your-provider.example/v1
VHQ_AI_MODEL=your-model-id
```

Replace the URL and model with the values supplied by your provider. Keep the
API key private and restart the backend after changing the file.

## Founder login

Copy `../backend/.env.example` to `../backend/.env` and set a unique Founder password
of at least 12 characters plus a random signing secret of at least 32
characters. Start the backend from its `backend` directory so it loads that
file. Keep it private and never commit it. For production, serve the app over
HTTPS and set `VHQ_COOKIE_SECURE=true`.

The API is protected by a signed, HTTP-only, same-site session cookie. The
Next.js API rewrite keeps browser requests same-origin. The root and health
endpoints remain public for availability checks.

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
