/** Disciplina (raiz da árvore) usada como base para completar tópicos. */
export type CompleteSubject = {
  id: string;
  name: string;
  topicNames: string[];
};

export type NewTopicSuggestion = {
  subjectId: string;
  subjectName: string;
  name: string;
  reason: string;
};
