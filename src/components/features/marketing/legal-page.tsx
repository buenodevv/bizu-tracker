export function LegalPage({
  title,
  updatedAt,
  sections,
}: {
  title: string;
  updatedAt: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Última atualização: {updatedAt}.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p
                key={paragraph}
                className="text-muted-foreground text-sm leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
