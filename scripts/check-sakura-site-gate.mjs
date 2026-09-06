import { assertTrustedSiteCheck, selectTrustedSiteCheck } from './lib/sakura-site-gate.mjs';

const targetSha = process.env.TARGET_SHA;
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!targetSha || !token || !repository) throw new Error('TARGET_SHA, GITHUB_TOKEN, and GITHUB_REPOSITORY are required.');
if (process.env.GITHUB_REF !== 'refs/heads/master') throw new Error('Sakura preflight/deploy must run from refs/heads/master.');
const [owner, repo] = repository.split('/');
if (!owner || !repo) throw new Error('GITHUB_REPOSITORY must be owner/repo.');
const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
async function get(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${path} failed with HTTP ${response.status}.`);
  return response.json();
}
const master = await get(`/repos/${owner}/${repo}/branches/master`);
const workflowRuns = await get(`/repos/${owner}/${repo}/actions/workflows/site-check.yml/runs?head_sha=${encodeURIComponent(targetSha)}&event=push&per_page=100`);
const latest = selectTrustedSiteCheck({ targetSha, masterSha: master.commit.sha, runs: workflowRuns.workflow_runs });
const jobs = await get(`/repos/${owner}/${repo}/actions/runs/${latest.id}/jobs?filter=latest&per_page=100`);
assertTrustedSiteCheck({ targetSha, masterSha: master.commit.sha, runs: workflowRuns.workflow_runs, jobs: jobs.jobs });
console.log(`Trusted Site checks gate passed: run=${latest.id} sha=${targetSha}`);
