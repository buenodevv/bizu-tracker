import type { Metadata } from "next";

import { LegalPage } from "@/components/features/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacidade",
  description:
    "Como o Bizu Tracker coleta, usa e protege os dados da sua conta e dos seus estudos.",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Privacidade"
      updatedAt="novembro de 2026"
      sections={[
        {
          heading: "Dados que coletamos",
          body: [
            "Coletamos o e-mail e o nome informados no cadastro, além dos dados que você registra no app: áreas de estudo, editais, disciplinas, tópicos, ciclos, sessões de estudo, questões e, opcionalmente, uma foto de perfil.",
          ],
        },
        {
          heading: "Para que usamos",
          body: [
            "Usamos esses dados para autenticar sua conta e fazer o app funcionar: montar seus ciclos, calcular rendimento e exibir seu histórico. Não vendemos seus dados.",
          ],
        },
        {
          heading: "Onde os dados ficam",
          body: [
            "Os dados são armazenados no Supabase, com regras de acesso por usuário. Cada conta acessa apenas os próprios registros, com exceção de conteúdos que você decide tornar públicos.",
          ],
        },
        {
          heading: "Compartilhamento",
          body: [
            "Ciclos podem ser compartilhados por link público se você ativar essa opção. Nesse caso, o nome, a descrição e os blocos do ciclo ficam visíveis para quem tiver o link. Você pode desativar o compartilhamento a qualquer momento.",
          ],
        },
        {
          heading: "Integrações de IA",
          body: [
            "Quando você usa a extração automática, o texto do PDF é enviado ao provedor de IA configurado para gerar a estrutura de disciplinas e tópicos. Resultados de extração podem ser armazenados em cache para evitar chamadas repetidas ao provedor.",
          ],
        },
        {
          heading: "Cookies e preferências",
          body: [
            "Usamos cookies para manter sua sessão autenticada. A preferência de tema claro/escuro fica armazenada no seu navegador.",
          ],
        },
        {
          heading: "Seus direitos",
          body: [
            "Nos termos da LGPD, você pode solicitar acesso, correção ou exclusão dos seus dados. Para isso, escreva para rodrigojbueno@yahoo.com.br. A exclusão da conta remove os dados vinculados a ela.",
          ],
        },
      ]}
    />
  );
}
