export const DEFAULT_REDIRECT = "/dashboard";

/**
 * Aceita apenas caminhos internos. `//host` e `/\host` são interpretados
 * pelo navegador como URL protocol-relative e virariam open redirect.
 */
export function safeNextPath(
  value: string | null,
  fallback = DEFAULT_REDIRECT,
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}

/**
 * Origem confiável para redirects de auth. Preferimos a URL pública
 * configurada; `x-forwarded-host` não é usado porque é controlável.
 */
export function trustedOrigin(requestUrl: URL): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Configuração inválida: cai na origem da requisição.
    }
  }
  return requestUrl.origin;
}
