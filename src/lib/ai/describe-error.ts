/**
 * Converte falhas do provedor de IA em mensagens acionáveis para a UI.
 * `fallback` é o prefixo usado quando o erro não se encaixa em nenhum caso.
 */
export function describeAiError(
  err: unknown,
  fallback = "Falha inesperada na IA.",
): string {
  const message = err instanceof Error ? err.message : String(err);

  // Modelo inexistente/descontinuado.
  if (/no longer available|NOT_FOUND|is not found/i.test(message)) {
    return "O modelo de IA configurado não está disponível. Verifique LLM_MODEL no .env.local (ex.: gemini-flash-lite-latest).";
  }
  // Sobrecarga do provedor.
  if (/UNAVAILABLE|overloaded|high demand/i.test(message)) {
    return "O serviço de IA está sobrecarregado agora. Tente novamente em alguns instantes.";
  }
  // Cota / limite de uso do provedor.
  if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Limite de uso da IA atingido. Aguarde alguns minutos ou verifique sua cota no provedor.";
  }
  // Credencial inválida.
  if (
    /api key|permission|401|403|UNAUTHENTICATED|PERMISSION_DENIED/i.test(
      message,
    )
  ) {
    return "Chave da IA inválida ou sem permissão. Confira GEMINI_API_KEY no .env.local.";
  }

  return `${fallback} ${message}`.trim();
}
