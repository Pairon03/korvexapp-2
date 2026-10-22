import "dotenv/config";
export const config = {
  preview:
    process.env.PUBLIC_PREVIEW === "true" ||
    !(process.env.DATABASE_URL && process.env.APP_DATABASE_URL),
  url: process.env.APP_URL || "http://localhost:3000",
  production: process.env.NODE_ENV === "production",
  database: process.env.DATABASE_URL,
  appDatabase: process.env.APP_DATABASE_URL,
};
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value)
    throw new AppError(
      503,
      "integration_unconfigured",
      `Integração não configurada: ${name}.`,
    );
  return value;
}
