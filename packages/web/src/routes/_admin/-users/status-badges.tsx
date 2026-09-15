import { IconCheck } from "@tabler/icons-react"
import { Badge } from "src/components/ui/badge"
import { i18n } from "src/i18n"

export function VerificationBadge({ verified }: { readonly verified: boolean }) {
  if (!verified) {
    return <span className="text-muted-foreground">{i18n.t("admin.users.verification.unverified")}</span>
  }

  return (
    <Badge variant="outline">
      <IconCheck aria-hidden="true" />
      {i18n.t("admin.users.verification.verified")}
    </Badge>
  )
}

export function BanBadge({ banned }: { readonly banned: boolean }) {
  if (!banned) {
    return <span className="text-muted-foreground">{i18n.t("admin.users.ban.active")}</span>
  }

  return <Badge variant="destructive">{i18n.t("admin.users.ban.banned")}</Badge>
}
