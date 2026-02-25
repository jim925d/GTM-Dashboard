/**
 * Hash account data for staleness detection. Must match client hashAccountData exactly.
 */
export function hashAccountData(account) {
  const significant = JSON.stringify({
    mrr: account.mrr,
    products: (account.cur || []).sort(),
    quotes: (account.qt || []).map((q) => `${q.name}:${q.st}:${q.mrr}`).sort(),
    lastEngagement: account.eng?.[0]?.d,
    lastEngagementNote: account.eng?.[0]?.n,
    engagementCount: (account.eng || []).length,
    contactCount: (account.con || []).length,
    locationCount: (account.loc || []).length,
  });
  let hash = 5381;
  for (let i = 0; i < significant.length; i++) {
    hash = (hash << 5) + hash + significant.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
