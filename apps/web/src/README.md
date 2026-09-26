# Frontend Source Note

The hackathon MVP serves `apps/web/public/app.js` directly to avoid install-time dependency risk.
The code is intentionally written as a small TypeScript-like module with the same domain model as
the API. In a production version, this folder would become a Next.js app with wagmi/viem wallet
integration and the existing o1.exchange design system.
