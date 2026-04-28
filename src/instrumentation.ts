import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN;
const ENV = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";

export async function register() {
  if (!DSN) return; // DSN 없으면 비활성

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === "production",
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === "production",
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
