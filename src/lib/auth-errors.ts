/** Traduz mensagens de erro do Supabase Auth para PT-BR. */
export function translateAuthError(message: string | undefined | null): string {
  if (!message) return "Erro desconhecido. Tente novamente.";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Este e-mail já está cadastrado.";
  if (m.includes("user not found")) return "Usuário não encontrado.";
  if (m.includes("password should be")) return "A senha não atende aos requisitos mínimos.";
  if (m.includes("rate limit") || m.includes("too many requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (m.includes("token") && m.includes("expired")) return "Link expirado. Solicite um novo.";
  if (m.includes("invalid") && m.includes("token")) return "Token inválido ou já utilizado.";
  if (m.includes("session") && m.includes("expired")) return "Sua sessão expirou. Entre novamente.";
  if (m.includes("network")) return "Falha de conexão. Verifique sua internet.";
  return message;
}
