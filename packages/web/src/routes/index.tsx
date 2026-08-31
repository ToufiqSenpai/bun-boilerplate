import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

export const Route = createFileRoute("/")({ component: App })

function App() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-14">
      <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-10 text-card-foreground sm:px-10 sm:py-14">
        <p className="mb-3 text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{t("home.kicker")}</p>
        <h1 className="mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight sm:text-6xl">
          {t("home.title")}
        </h1>
        <p className="mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">{t("home.description")}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://tanstack.com/router"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border bg-background px-5 py-2.5 text-sm font-semibold text-foreground no-underline transition hover:-translate-y-0.5"
          >
            Router Guide
          </a>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Type-Safe Routing", "Routes and links stay in sync across every page."],
          ["Server Functions", "Call server code from your UI without creating API boilerplate."],
          ["Streaming by Default", "Ship progressively rendered responses for faster experiences."],
          ["Tailwind Native", "Design quickly with utility-first styling and reusable tokens."]
        ].map(([title, desc]) => (
          <article key={title} className="rounded-2xl border bg-card p-5 text-card-foreground">
            <h2 className="mb-2 text-base font-semibold">{title}</h2>
            <p className="m-0 text-sm text-muted-foreground">{desc}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border bg-card p-6">
        <p className="mb-2 text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Quick Start</p>
        <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Edit <code>src/routes/index.tsx</code> to customize the home page.
          </li>
          <li>
            Add routes in <code>src/routes</code> and tweak visual tokens in <code>src/styles.css</code>.
          </li>
        </ul>
      </section>
    </main>
  )
}
