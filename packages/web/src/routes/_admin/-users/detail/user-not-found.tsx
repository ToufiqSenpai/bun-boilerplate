import { IconUserOff } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { Button } from "src/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "src/components/ui/empty"
import { i18n } from "src/i18n"

export function UserNotFound() {
  return (
    <div className="flex w-full flex-1 items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconUserOff />
          </EmptyMedia>
          <EmptyTitle>{i18n.t("admin.users.detail.notFound.title")}</EmptyTitle>
          <EmptyDescription>{i18n.t("admin.users.detail.notFound.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/admin/users" />} nativeButton={false} variant="outline" size="sm">
            {i18n.t("admin.users.detail.notFound.back")}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
