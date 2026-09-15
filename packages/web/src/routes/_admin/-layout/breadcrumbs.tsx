import { Link, useLocation, useMatches } from "@tanstack/react-router"
import type { ParseKeys } from "i18next"
import { Fragment } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "src/components/ui/breadcrumb"
import { i18n } from "src/i18n"
import { z } from "zod"

interface CrumbItem {
  path: "/admin" | "/admin/users" | "/admin/users/create"
  labelKey: ParseKeys
}

const ROOT_CRUMB: CrumbItem = { path: "/admin", labelKey: "admin.nav.dashboard" }

const CRUMB_ITEMS: readonly CrumbItem[] = [
  ROOT_CRUMB,
  { path: "/admin/users", labelKey: "admin.nav.users" },
  { path: "/admin/users/create", labelKey: "admin.users.create.title" }
]

const userCrumbSchema = z.object({ name: z.string() })

const DETAIL_ROUTE_ID = "/_admin/admin/users_/$userId"

interface RenderedCrumb {
  key: string
  label: string
  to?: CrumbItem["path"]
}

export function AdminBreadcrumbs() {
  const { pathname } = useLocation()
  const matches = useMatches()

  const detailMatch = matches.find(match => match.routeId === DETAIL_ROUTE_ID)
  const detailUser = detailMatch ? userCrumbSchema.safeParse(detailMatch.loaderData) : undefined
  const crumbs: readonly RenderedCrumb[] = [
    ...CRUMB_ITEMS.filter(crumb => pathname === crumb.path || pathname.startsWith(`${crumb.path}/`)).map(crumb => ({
      key: crumb.path,
      label: i18n.t(crumb.labelKey),
      to: crumb.path
    })),
    ...(detailMatch
      ? [
          {
            key: pathname,
            label: detailUser?.success ? detailUser.data.name : i18n.t("admin.users.detail.crumb")
          }
        ]
      : [])
  ]
  const currentCrumb = crumbs.at(-1) ?? { key: ROOT_CRUMB.path, label: i18n.t(ROOT_CRUMB.labelKey) }

  return (
    <>
      <h1 className="sr-only">{currentCrumb.label}</h1>
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const isCurrent = index === crumbs.length - 1

            return (
              <Fragment key={crumb.key}>
                <BreadcrumbItem>
                  {isCurrent || !crumb.to ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isCurrent && <BreadcrumbSeparator />}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  )
}
