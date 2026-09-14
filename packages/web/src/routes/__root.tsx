import { DEFAULT_LOCALE, getTextDirection, isLocale } from "@bun-boilerplate/i18n"
import type { QueryClient } from "@tanstack/react-query"
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import appCss from "../styles.css?url"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8"
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      {
        title: "TanStack Start Starter"
      }
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss
      }
    ]
  }),
  shellComponent: RootDocument
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const lang = isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE

  return (
    <html lang={lang} dir={getTextDirection(lang)} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere]">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
