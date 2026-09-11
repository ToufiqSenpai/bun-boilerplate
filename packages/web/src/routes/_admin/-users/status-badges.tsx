import { Badge } from "src/components/ui/badge"
import { i18n } from "src/i18n"

export function VerificationBadge({ verified }: { readonly verified: boolean }) {
  return verified ? (
    <Badge>{i18n.t("admin.users.verification.verified")}</Badge>
  ) : (
    <Badge variant="outline">{i18n.t("admin.users.verification.unverified")}</Badge>
  )
}

export function BanBadge({ banned }: { readonly banned: boolean }) {
  return banned ? (
    <Badge variant="destructive">{i18n.t("admin.users.ban.banned")}</Badge>
  ) : (
    <Badge variant="secondary">{i18n.t("admin.users.ban.active")}</Badge>
  )
}
