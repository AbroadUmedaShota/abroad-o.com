import { assertTrustedSiteCheck, selectTrustedSiteCheck } from './lib/sakura-site-gate.mjs';
import { pathToFileURL } from 'node:url';

export async function runTrustedSiteGate({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const targetSha = env.TARGET_SHA;
  const token = env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  if (!targetSha || !repository) throw new Error('TARGET_SHA and GITHUB_REPOSITORY are required.');
  if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_REF !== 'refs/heads/master') {
    throw new Error('Sakura preflight/deploy must run from refs/heads/master.');
  }
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY must be owner/repo.');
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  async function get(path) {
    const response = await fetchImpl(`https://api.github.com${path}`, { headers });
    if (!response.ok) throw new Error(`GitHub API ${path} failed with HTTP ${response.status}.`);
    return response.json();
  }
  const master = await get(`/repos/${owner}/${repo}/branches/master`);
  const workflowRuns = await get(`/repos/${owner}/${repo}/actions/workflows/site-check.yml/runs?head_sha=${encodeURIComponent(targetSha)}&event=push&per_page=100`);
  const latest = selectTrustedSiteCheck({ targetSha, masterSha: master.commit.sha, runs: workflowRuns.workflow_runs });
  const jobs = await get(`/repos/${owner}/${repo}/actions/runs/${latest.id}/jobs?filter=latest&per_page=100`);
  assertTrustedSiteCheck({ targetSha, masterSha: master.commit.sha, runs: workflowRuns.workflow_runs, jobs: jobs.jobs });
  return { runId: latest.id, targetSha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTrustedSiteGate()
    .then(({ runId, targetSha }) => console.log(`Trusted Site checks gate passed: run=${runId} sha=${targetSha}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
