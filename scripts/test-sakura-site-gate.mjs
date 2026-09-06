import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTrustedSiteCheck } from './lib/sakura-site-gate.mjs';

const sha = 'a'.repeat(40);
const good = [{ id: 1, head_sha: sha, head_branch: 'master', event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1, created_at: '2026-09-06T00:00:00Z', updated_at: '2026-09-06T00:01:00Z' }];
const goodJobs = [{ name: 'site-gate', conclusion: 'success', run_attempt: 1 }];

test('accepts a successful Site checks run for the selected master SHA', () => {
  assert.doesNotThrow(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: sha, runs: good, jobs: goodJobs }));
});
test('rejects a selected SHA that is not current master', () => {
  assert.throws(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: 'b'.repeat(40), runs: good, jobs: goodJobs }), /current master/);
});
test('rejects a success for another SHA or branch', () => {
  assert.throws(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: sha, runs: [{ ...good[0], head_sha: 'b'.repeat(40) }], jobs: goodJobs }), /No trusted/);
  assert.throws(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: sha, runs: [{ ...good[0], head_branch: 'feature/x' }], jobs: goodJobs }), /No trusted/);
});
test('fails closed when Site checks are missing', () => {
  assert.throws(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: sha, runs: [], jobs: goodJobs }), /No trusted/);
});
test('rejects a legacy run without site-gate and a newer failed attempt', () => {
  assert.throws(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: sha, runs: good, jobs: [] }), /site-gate/);
  assert.throws(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: sha, runs: [...good, { ...good[0], id: 2, conclusion: 'failure', created_at: '2026-09-06T01:00:00Z', updated_at: '2026-09-06T01:01:00Z' }], jobs: goodJobs }), /latest trusted/);
});
test('rejects a newer in-progress rerun and a job from another attempt', () => {
  assert.throws(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: sha, runs: [...good, { ...good[0], id: 2, status: 'in_progress', conclusion: null, run_attempt: 2, updated_at: '2026-09-06T02:00:00Z' }], jobs: goodJobs }), /not completed successfully/);
  assert.throws(() => assertTrustedSiteCheck({ targetSha: sha, masterSha: sha, runs: good, jobs: [{ ...goodJobs[0], run_attempt: 2 }] }), /site-gate/);
});
