export function getOwnerUsername(): string {
  return process.env.ICETV_USERNAME || process.env.MOONTV_USERNAME || '';
}

export function getOwnerPassword(): string {
  return process.env.ICETV_PASSWORD || process.env.MOONTV_PASSWORD || '';
}
