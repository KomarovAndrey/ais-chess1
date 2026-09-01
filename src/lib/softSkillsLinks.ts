/** Public profile opened on the Soft Skills tab. */
export function softSkillsProfileHref(username: string | null | undefined): string | null {
  const normalized = username?.trim();
  if (!normalized) return null;
  return `/user/${encodeURIComponent(normalized)}?area=soft`;
}
