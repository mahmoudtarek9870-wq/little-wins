# Local Android development

The mobile app now prefers `EXPO_PUBLIC_API_URL`. If it is not set, Expo Go/development builds automatically use the Metro host on port 8080 (the existing API service port).

Run the API and database first, then run the mobile app:

```bash
pnpm --filter @workspace/api-server run dev
```

In a second terminal:

```bash
cd artifacts/little-wins-mobile
pnpm exec expo start
```

If the API is deployed remotely, create `artifacts/little-wins-mobile/.env.local`:

```env
EXPO_PUBLIC_API_URL=https://YOUR-API-DOMAIN
```

Do not use `localhost` for the API URL when the app runs on a physical phone. Use the PC LAN IP (the app can derive it automatically from Expo's host URI for local development).

The local API still requires `DATABASE_URL` because the existing backend uses PostgreSQL.
