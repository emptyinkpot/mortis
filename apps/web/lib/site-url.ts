const DEFAULT_SITE_URL = "https://mortis.tengokukk.com";

export function getSiteUrl(): string {
  const raw =
    process.env.MULTICA_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_SITE_URL;

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

