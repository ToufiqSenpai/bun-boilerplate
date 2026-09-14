import { api } from "src/utils/client"

export async function isRequiredSetup(): Promise<boolean> {
  const setup = await api.auth.setup.get()
  return setup.error === null && setup.status === 200 && setup.data.needed === true
}
