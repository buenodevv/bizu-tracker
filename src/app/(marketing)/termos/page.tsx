import type { Metadata } from "next";

import { LegalPage } from "@/components/features/marketing/legal-page";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "Condições de uso do Bizu Tracker, ferramenta de organização de estudos para concursos e vestibulares.",
  alternates: { canonical: "/termos" },
};

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de uso"
      updatedAt="novembro de 2026"
      sections={[
        {
          heading: "Sobre o serviço",
          body: [
            "O Bizu Tracker é uma ferramenta web para organizar estudos, acompanhar tempo e registrar questões. O serviço está em desenvolvimento e é disponibilizado gratuitamente para uso pessoal.",
          ],
        },
        {
          heading: "Sua conta",
          body: [
            "Você é responsável por manter suas credenciais em segurança e pelas informações que cadastra. Informe um e-mail válido e não compartilhe sua senha.",
          ],
        },
        {
          heading: "Uso aceitável",
          body: [
            "Não use o serviço para atividades ilegais, para tentar acessar dados de outras pessoas, para sobrecarregar a infraestrutura ou para enviar conteúdo malicioso.",
          ],
        },
        {
          heading: "Conteúdo e extração por IA",
          body: [
            "A extração de editais por IA é um apoio e pode conter erros. Revise as disciplinas e os tópicos antes de usar o resultado. O conteúdo dos editais pertence aos seus respectivos autores.",
          ],
        },
        {
          heading: "Disponibilidade",
          body: [
            "Durante o desenvolvimento, funcionalidades podem mudar ou ficar temporariamente indisponíveis. Não há garantia de disponibilidade contínua ou de preservação indefinida dos dados; mantenha cópias do que for essencial.",
          ],
        },
        {
          heading: "Contato",
          body: [
            "Dúvidas sobre estes termos podem ser enviadas para rodrigojbueno@yahoo.com.br.",
          ],
        },
      ]}
    />
  );
}
