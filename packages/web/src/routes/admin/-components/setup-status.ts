export interface SetupStatus {
  readonly needed: boolean
}

export interface SetupStatusResult {
  readonly data: SetupStatus | null | undefined
  readonly error: unknown
  readonly status: number
}
