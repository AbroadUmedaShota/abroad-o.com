const SHA = /^[0-9a-f]{40}$/i;

export function selectTrustedSiteCheck({ targetSha, masterSha, runs }) {
  if (!SHA.test(targetSha)) throw new Error('target_sha must be a full 40-character Git SHA.');
  if (targetSha.toLowerCase() !== masterSha.toLowerCase()) {
    throw new Error('target_sha must exactly equal the current master SHA.');
  }
  const matching = runs.filter((run) => run.head_sha?.toLowerCase() === targetSha.toLowerCase() && run.head_branch === 'master' && run.event === 'push');
  if (!matching.length) throw new Error('No trusted push Site checks run exists for target_sha on master.');
  const latest = [...matching].sort((a, b) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at))[0];
  if (latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error('The latest trusted Site checks run for target_sha is not completed successfully.');
  }
  return latest;
}

export function assertTrustedSiteCheck({ targetSha, masterSha, runs, jobs }) {
  const latest = selectTrustedSiteCheck({ targetSha, masterSha, runs });
  if (!jobs.some((job) => job.name === 'site-gate' && job.conclusion === 'success' && job.run_attempt === latest.run_attempt)) {
    throw new Error('The latest trusted Site checks run did not complete a successful site-gate job.');
  }
  return latest;
}
