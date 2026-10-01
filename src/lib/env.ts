export function env(name: string): string | undefined {
  return (import.meta.env[name] as string | undefined) ?? process.env[name];
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
