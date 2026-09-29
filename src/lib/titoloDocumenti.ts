/** Id su cui leggere i documenti del dettaglio titolo. */

export function resolveTitoloDocumentiReadIds(opts: {
  titoloId: string;
  chainIds?: string[];
  isAppendiceView: boolean;
}): string[] {
  const madreId = opts.chainIds?.[0] ?? opts.titoloId;
  const isMadreView = !opts.isAppendiceView && opts.titoloId === madreId;
  if (isMadreView && opts.chainIds && opts.chainIds.length > 0) {
    return opts.chainIds;
  }
  return [opts.titoloId];
}
