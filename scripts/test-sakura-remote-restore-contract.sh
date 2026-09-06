#!/usr/bin/env bash
# E2E for the shell emitted by Invoke-RemoteSanitizedRestore.  It has no
# network path: production and this test execute the exact same generated body.
set -euo pipefail
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    printf 'SKIP: remote RestoreSafe shell E2E runs on the Ubuntu CI runner; PowerShell tests still run on Windows.\n'
    exit 0
    ;;
esac
if ! command -v pwsh >/dev/null 2>&1; then
  printf 'SKIP: remote RestoreSafe shell E2E requires bash and pwsh in one environment.\n'
  exit 0
fi

repo=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/abroad-o-remote-restore.XXXXXX")
home="$work/home" public="$work/public" backups="$work/backups" previous="$work/previous"
cleanup() { rm -rf "$work" "$repo/_site/foo" "$repo/_site/woff" "$repo/_site/woff2"; }
trap cleanup EXIT
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
sha() { sha256sum "$1" | awk '{print $1}'; }
tree() { (cd "$1" && find . -type f -printf '%P\0' | LC_ALL=C sort -z | xargs -0 -r sha256sum); }
absent() { [ ! -e "$1" ] && [ ! -L "$1" ] || fail "expected absent: $1"; }

# Sakura uses BSD realpath, which accepts paths but not GNU's -e option.
# Put an equivalent compatibility shim first so the generated remote scripts
# would fail if they regress to `realpath -e`.
system_realpath=$(command -v realpath)
compat_bin="$work/bsd-realpath-bin"
mkdir -p "$compat_bin"
cat > "$compat_bin/realpath" <<EOF
#!/bin/sh
if [ "\${1:-}" = '-e' ]; then
  echo 'realpath: illegal option -- e' >&2
  exit 64
fi
exec "$system_realpath" "\$@"
EOF
chmod 700 "$compat_bin/realpath"
cat > "$compat_bin/sha256sum" <<'EOF'
#!/bin/sh
echo 'sha256sum: not found' >&2
exit 127
EOF
chmod 700 "$compat_bin/sha256sum"
remote_path="$compat_bin:$PATH"

cd "$repo"
pwsh -NoProfile -Command 'npm run build:site' >/dev/null
mkdir -p _site/foo _site/woff _site/woff2 "$home" "$backups"
printf 'before foo\n' > _site/foo/foo.map
printf 'before woff\n' > _site/woff/font.woff
printf 'before woff2\n' > _site/woff2/font.woff2

config="$work/config.json"
node - deploy/sakura-public-files.json "$config" "$public" "$backups" <<'NODE'
const fs = require('fs'); const [src, out, root, backups] = process.argv.slice(2);
const c = JSON.parse(fs.readFileSync(src));
for (const key of ['includeDirectories', 'managedDirectories']) c[key] = [...new Set([...c[key], 'foo', 'woff', 'woff2'])];
c.restoreContract.remotePublicRoot = root; c.restoreContract.backupDirectory = backups;
fs.writeFileSync(out, JSON.stringify(c));
NODE
pkgout=$(env SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE=1 pwsh -NoProfile -File scripts/deploy-sakura.ps1 -Mode Package -ConfigPath "$config" -WorkDir "$work/package")
package=$(printf '%s\n' "$pkgout" | sed -n 's/^Package: //p' | tail -1)
manifest=$(printf '%s\n' "$pkgout" | sed -n 's/^Manifest: //p' | tail -1)
path_sha=$(printf '%s\n' "$pkgout" | sed -n 's/^Path manifest SHA-256: //p' | tail -1)
evidence_sha=$(printf '%s\n' "$pkgout" | sed -n 's/^Content evidence SHA-256: //p' | tail -1)
[ -s "$package" ] && [ -s "$manifest" ] || fail 'generated package or manifest missing'
[[ $path_sha =~ ^[0-9a-f]{64}$ && $evidence_sha =~ ^[0-9a-f]{64}$ ]] || fail 'invalid deployment bindings'
cp -a _site "$previous"
rm -f "$previous/style.css"
printf 'prior release\n' > "$previous/index.html"
cp -a "$previous" "$public"

refresh() {
  local dir=$1 out=$2
  (cd "$dir/restore-contract-v1/payload" && find . -type f -printf '%P\n' | LC_ALL=C sort | while IFS= read -r p; do sha256sum "$p"; done) > "$dir/restore-contract-v1/manifest.txt"
  printf '%s  manifest.txt\n' "$(sha "$dir/restore-contract-v1/manifest.txt")" > "$dir/restore-contract-v1/manifest.sha256"
  printf '{"formatVersion":1,"archiveRoot":"restore-contract-v1","remotePublicRoot":"%s","deploymentPathManifestSha256":"%s","deploymentEvidenceSha256":"%s"}\n' "$public" "$path_sha" "$evidence_sha" > "$dir/restore-contract-v1/metadata.json"
  tar -czf "$out" -C "$dir" restore-contract-v1
}
invocations="$work/remote-script-invocations"
invocation_count() { if [ -f "$invocations" ]; then wc -l < "$invocations" | tr -d ' '; else printf '0\n'; fi; }
run() {
  local apply=${1:-0}
  env PATH="${remote_test_path:-$remote_path}" HOME="$home" SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE=1 SAKURA_LOCAL_REMOTE_SCRIPT_MARKER="$invocations" pwsh -NoProfile -File scripts/deploy-sakura.ps1 -Mode RestoreSafe -ConfigPath "$config" -WorkDir "$work/pkg-$RANDOM" -HostName local.invalid -UserName abroad-o -RemoteDir "$public" -SshKeyPath ignored -BackupFile "$archive" -BackupArchiveSha256 "$archive_sha" -BackupManifestSha256 "$manifest_sha" $( [ "$apply" = 1 ] && printf '%s' -RestoreApply )
}

# Execute the exact generated Promote shell. The first run corrupts its newly
# created backup after hashing and must fail before changing the public root.
mkdir -p "$public/TOOL" "$public/pdfjs/build" "$public/pdfjs/web"
printf old > "$public/TOOL/index.html"; printf old > "$public/pdfjs/build/pdf.js"; printf old > "$public/pdfjs/web/viewer.html"; printf old > "$public/pdfjs/LICENSE"
printf unknown > "$public/unknown.txt"
release=restore-contract-e2e
cp -p "$package" "$home/$release.tgz"
mkdir -p "$home/.abroad-o-stages"
printf '%s  %s  %s\n' "$(sha "$home/$release.tgz")" "$path_sha" "$evidence_sha" > "$home/.abroad-o-stages/$release.meta"
run_promote() {
  env PATH="${remote_test_path:-$remote_path}" HOME="$home" SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE=1 ${1:-} pwsh -NoProfile -File scripts/deploy-sakura.ps1 -Mode Promote -ConfigPath "$config" -WorkDir "$work/promote-$RANDOM" -HostName local.invalid -UserName abroad-o -RemoteDir "$public" -SshKeyPath ignored -StagedReleaseId "$release"
}
before_failed_promote=$(tree "$public")
mkdir "$backups/.abroad-o-deploy.lock"
printf 'mode=operator-held\n' > "$backups/.abroad-o-deploy.lock/owner"
if run_promote >/dev/null 2>&1; then fail 'Promote accepted a second deployment lock'; fi
[ -f "$backups/.abroad-o-deploy.lock/owner" ] || fail 'Promote removed an operator-held lock'
[ "$before_failed_promote" = "$(tree "$public")" ] || fail 'locked Promote changed public root'
rm -f "$backups/.abroad-o-deploy.lock/owner"; rmdir "$backups/.abroad-o-deploy.lock"
if run_promote SAKURA_LOCAL_PROMOTE_FAIL_AFTER_TEMP=1 >/dev/null 2>&1; then fail 'Promote accepted injected temporary-file failure'; fi
[ "$before_failed_promote" = "$(tree "$public")" ] || fail 'temporary-file failure changed public root'
[ -z "$(find "$public" -type f -name '.*.codex.*' -print -quit)" ] || fail 'temporary-file failure left publish temp'
[ ! -e "$backups/.abroad-o-deploy.lock" ] || fail 'temporary-file failure left deployment lock'
find "$backups" -maxdepth 1 -type f -name 'abroad-o-before-*.sra.tgz' -delete
if run_promote SAKURA_LOCAL_PROMOTE_CORRUPT_BACKUP=1 >/dev/null 2>&1; then fail 'corrupt Promote backup was accepted'; fi
[ "$before_failed_promote" = "$(tree "$public")" ] || fail 'failed Promote changed public root'
[ -z "$(find "$backups" -maxdepth 1 -type f -name 'abroad-o-before-*.sra.tgz' -print -quit)" ] || fail 'failed Promote left an invalid backup'
[ ! -e "$backups/.abroad-o-deploy.lock" ] || fail 'failed Promote left deployment lock'
[ -z "$(find "$home" -maxdepth 1 \( -name 'abroad-o-stage.*' -o -name 'abroad-o-backup.*' -o -name 'abroad-o-backup-verify.*' \) -print -quit)" ] || fail 'failed Promote left temp'
run_promote >/dev/null
mapfile -t promote_backups < <(find "$backups" -maxdepth 1 -type f -name 'abroad-o-before-*.sra.tgz' -print)
[ "${#promote_backups[@]}" -eq 1 ] || fail 'valid Promote did not create exactly one sanitized backup'
archive=${promote_backups[0]}
archive_sha=$(sha "$archive")
stage="$work/stage"; mkdir -p "$stage"; tar -xzf "$archive" -C "$stage"
manifest_sha=$(sha "$stage/restore-contract-v1/manifest.txt")
valid_archive="$archive"; valid_archive_sha="$archive_sha"
[ "$(sha "$public/index.html")" = "$(sha _site/index.html)" ] || fail 'Promote did not publish the new index'
[ -f "$public/style.css" ] && [ -f _site/style.css ] || fail 'Promote new-only file fixture is missing'
[ "$(sha "$public/style.css")" = "$(sha _site/style.css)" ] || fail 'Promote did not publish the new-only file'
[ "$(cat "$public/unknown.txt")" = unknown ] || fail 'Promote changed unknown file'
for p in TOOL/index.html pdfjs/build/pdf.js pdfjs/web/viewer.html pdfjs/LICENSE; do absent "$public/$p"; done
[ ! -e "$home/$release.tgz" ] || fail 'Promote did not remove staged package'
[ -z "$(find "$home" -maxdepth 1 \( -name 'abroad-o-stage.*' -o -name 'abroad-o-backup.*' -o -name 'abroad-o-backup-verify.*' \) -print -quit)" ] || fail 'successful Promote left temp'
[ ! -e "$backups/.abroad-o-deploy.lock" ] || fail 'successful Promote left deployment lock'

# RestoreSafe now consumes the archive produced by the real Promote shell.
printf changed > "$public/index.html"; printf changed > "$public/foo/foo.map"; printf changed > "$public/woff/font.woff"; printf changed > "$public/woff2/font.woff2"
for p in 1c_abroad.pdf 2c_abroad.pdf 4c_abroad.pdf; do printf changed > "$public/pdfjs/$p"; done
dry=$(tree "$public"); run 0 >/dev/null; [ "$dry" = "$(tree "$public")" ] || fail 'DryRun changed public root'
mkdir "$backups/.abroad-o-deploy.lock"
printf 'mode=operator-held\n' > "$backups/.abroad-o-deploy.lock/owner"
if run 1 >/dev/null 2>&1; then fail 'RestoreSafe accepted a second deployment lock'; fi
[ -f "$backups/.abroad-o-deploy.lock/owner" ] || fail 'RestoreSafe removed an operator-held lock'
[ "$dry" = "$(tree "$public")" ] || fail 'locked RestoreSafe changed public root'
rm -f "$backups/.abroad-o-deploy.lock/owner"; rmdir "$backups/.abroad-o-deploy.lock"
run 1 >/dev/null
for p in index.html foo/foo.map woff/font.woff woff2/font.woff2; do [ "$(sha "$public/$p")" = "$(sha "$previous/$p")" ] || fail "prefix collision restore failed: $p"; done
absent "$public/style.css"; [ "$(cat "$public/unknown.txt")" = unknown ] || fail 'unknown changed'
for p in TOOL/index.html pdfjs/build/pdf.js pdfjs/web/viewer.html pdfjs/LICENSE; do absent "$public/$p"; done
for p in 1c_abroad.pdf 2c_abroad.pdf 4c_abroad.pdf; do [ "$(sha "$public/pdfjs/$p")" = "$(sha "$previous/pdfjs/$p")" ] || fail "PDF changed: $p"; done
[ -z "$(find "$home" -maxdepth 1 -name 'abroad-o-restore.*' -print -quit)" ] || fail 'successful restore left temp'
[ ! -e "$backups/.abroad-o-deploy.lock" ] || fail 'successful RestoreSafe left deployment lock'
baseline=$(tree "$public")

# The helper must fail closed before Apply when neither supported hash command
# is available. The ordinary shim above already proves the shasum fallback.
nohash_bin="$work/no-hash-bin"
mkdir -p "$nohash_bin"
for command in sha256sum shasum; do
  cat > "$nohash_bin/$command" <<EOF
#!/bin/sh
echo '$command: not found' >&2
exit 127
EOF
  chmod 700 "$nohash_bin/$command"
done
remote_test_path="$nohash_bin:$remote_path"
if run 1 >/dev/null 2>&1; then fail 'RestoreSafe accepted an environment without a SHA-256 command'; fi
unset remote_test_path
[ "$baseline" = "$(tree "$public")" ] || fail 'missing hash commands changed public root'

invalid() {
  local candidate=$1 label=$2
  archive="$candidate"; archive_sha=$(sha "$candidate")
  if tar -tzf "$candidate" | grep -Fxq 'restore-contract-v1/manifest.txt'; then
    manifest_sha=$(tar -xOzf "$candidate" restore-contract-v1/manifest.txt | sha256sum | awk '{print $1}')
  else
    manifest_sha=$(printf '0%.0s' {1..64})
  fi
  local before_invocations after_invocations
  before_invocations=$(invocation_count)
  if run 1 >/dev/null 2>&1; then fail "accepted invalid archive: $label"; fi
  after_invocations=$(invocation_count)
  [ "$after_invocations" -eq "$((before_invocations + 1))" ] || fail "invalid $label did not reach the generated remote shell"
  [ "$baseline" = "$(tree "$public")" ] || fail "invalid $label changed public root"
  [ -z "$(find "$home" -maxdepth 1 -name 'abroad-o-restore.*' -print -quit)" ] || fail "failed $label left temp"
}
mutate() { rm -rf "$work/mutate"; mkdir -p "$work/mutate"; tar -xzf "$archive" -C "$work/mutate"; }
ret() { tar -czf "$1" -C "$work/mutate" restore-contract-v1; }

printf raw > "$work/raw"; raw_archive="$backups/abroad-o-before-invalid-raw.sra.tgz"; tar -czf "$raw_archive" -C "$work" raw; invalid "$raw_archive" raw
mkdir -p "$work/odd"; printf x > "$work/odd/x"; absolute_archive="$backups/abroad-o-before-invalid-absolute.sra.tgz"; tar -czf "$absolute_archive" --transform='s,^,/,' -C "$work/odd" x; invalid "$absolute_archive" absolute
traversal_archive="$backups/abroad-o-before-invalid-traversal.sra.tgz"; tar -czf "$traversal_archive" --transform='s,^,../,' -C "$work/odd" x; invalid "$traversal_archive" traversal
backslash_archive="$backups/abroad-o-before-invalid-backslash.sra.tgz"
python3 - "$backslash_archive" <<'PY'
import io, tarfile, sys
with tarfile.open(sys.argv[1], "w:gz") as archive:
    entry = tarfile.TarInfo(r"a\b")
    entry.size = 1
    archive.addfile(entry, io.BytesIO(b"x"))
PY
invalid "$backslash_archive" backslash

# Mutations start from the valid archive and intentionally retain valid outer
# SHA arguments, exercising each inner validator before Apply.
archive="$backups/abroad-o-before-contract.sra.tgz"
for kind in extra symlink hardlink duplicate invalid empty pdfmissing crlf; do
  archive="$valid_archive"
  mutate; candidate="$backups/abroad-o-before-invalid-$kind.sra.tgz"
  case "$kind" in
    extra) printf x > "$work/mutate/restore-contract-v1/unexpected"; ret "$candidate" ;;
    symlink) ln -s /etc/passwd "$work/mutate/restore-contract-v1/payload/link"; ret "$candidate"; tar -tvzf "$candidate" | awk 'substr($1, 1, 1) == "l" { found = 1 } END { exit !found }' || fail 'symlink fixture is not a symlink entry' ;;
    hardlink) ln "$work/mutate/restore-contract-v1/payload/index.html" "$work/mutate/restore-contract-v1/payload/index-copy.html"; ret "$candidate"; tar -tvzf "$candidate" | awk 'substr($1, 1, 1) == "h" { found = 1 } END { exit !found }' || fail 'hardlink fixture is not a hardlink entry' ;;
    duplicate) head -1 "$work/mutate/restore-contract-v1/manifest.txt" >> "$work/mutate/restore-contract-v1/manifest.txt"; printf '%s  manifest.txt\n' "$(sha "$work/mutate/restore-contract-v1/manifest.txt")" > "$work/mutate/restore-contract-v1/manifest.sha256"; ret "$candidate" ;;
    invalid) sed -i '1s/^[0-9a-f]/z/' "$work/mutate/restore-contract-v1/manifest.txt"; printf '%s  manifest.txt\n' "$(sha "$work/mutate/restore-contract-v1/manifest.txt")" > "$work/mutate/restore-contract-v1/manifest.sha256"; ret "$candidate" ;;
    empty) : > "$work/mutate/restore-contract-v1/manifest.txt"; printf '%s  manifest.txt\n' "$(sha "$work/mutate/restore-contract-v1/manifest.txt")" > "$work/mutate/restore-contract-v1/manifest.sha256"; ret "$candidate" ;;
    pdfmissing) rm -f "$work/mutate/restore-contract-v1/payload/pdfjs/1c_abroad.pdf"; grep -v '  pdfjs/1c_abroad.pdf$' "$work/mutate/restore-contract-v1/manifest.txt" > "$work/mutate/x"; mv "$work/mutate/x" "$work/mutate/restore-contract-v1/manifest.txt"; printf '%s  manifest.txt\n' "$(sha "$work/mutate/restore-contract-v1/manifest.txt")" > "$work/mutate/restore-contract-v1/manifest.sha256"; ret "$candidate" ;;
    crlf) sed -i 's/$/\r/' "$work/mutate/restore-contract-v1/manifest.txt"; printf '%s  manifest.txt\n' "$(sha "$work/mutate/restore-contract-v1/manifest.txt")" > "$work/mutate/restore-contract-v1/manifest.sha256"; ret "$candidate" ;;
  esac
  invalid "$candidate" "$kind"
done

# A real short/long manifest pair must be treated as distinct paths. The
# archive intentionally omits the WOFF file, while retaining its WOFF2 peer.
pair_short=$(grep -m1 '^vendor/bootstrap3/fonts/glyphicons-halflings-regular\.woff$' "$manifest" || true)
pair_long="${pair_short}2"
if [ -n "$pair_short" ] && grep -Fxq "$pair_long" "$manifest"; then
  rm -rf "$work/pair-stage"; cp -a "$stage" "$work/pair-stage"
  rm -f "$work/pair-stage/restore-contract-v1/payload/$pair_short"
  pair_archive="$backups/abroad-o-before-pair.sra.tgz"; refresh "$work/pair-stage" "$pair_archive"
  archive="$pair_archive"; archive_sha=$(sha "$archive"); manifest_sha=$(sha "$work/pair-stage/restore-contract-v1/manifest.txt")
  printf changed > "$public/$pair_short"; printf changed > "$public/$pair_long"
  run 1 >/dev/null
  absent "$public/$pair_short"
  [ "$(sha "$public/$pair_long")" = "$(sha "$previous/$pair_long")" ] || fail 'long WOFF2 path was not restored exactly'
else
  fail 'required Bootstrap 3 WOFF/WOFF2 prefix-collision fixture is absent from package manifest'
fi
baseline=$(tree "$public")
valid_archive="$archive"; valid_archive_sha="$archive_sha"

# A symlink public root and symlink backup parent are both fail-closed.
ln -s "$public" "$work/public-link"; link_config="$work/link-config.json"
node - "$config" "$link_config" "$work/public-link" "$backups" <<'NODE'
const fs=require('fs'); const c=JSON.parse(fs.readFileSync(process.argv[2])); c.restoreContract.remotePublicRoot=process.argv[4]; c.restoreContract.backupDirectory=process.argv[5]; fs.writeFileSync(process.argv[3],JSON.stringify(c));
NODE
if env HOME="$home" SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE=1 pwsh -NoProfile -File scripts/deploy-sakura.ps1 -Mode RestoreSafe -ConfigPath "$link_config" -WorkDir "$work/link-pkg" -HostName local.invalid -UserName abroad-o -RemoteDir "$work/public-link" -SshKeyPath ignored -BackupFile "$valid_archive" -BackupArchiveSha256 "$valid_archive_sha" -BackupManifestSha256 "$manifest_sha" -RestoreApply >/dev/null 2>&1; then fail 'symlink public root accepted'; fi
[ "$baseline" = "$(tree "$public")" ] || fail 'symlink public root changed contents'

ln -s "$backups" "$work/backups-link"; backup_link_config="$work/backup-link-config.json"
node - "$config" "$backup_link_config" "$public" "$work/backups-link" <<'NODE'
const fs=require('fs'); const c=JSON.parse(fs.readFileSync(process.argv[2])); c.restoreContract.remotePublicRoot=process.argv[4]; c.restoreContract.backupDirectory=process.argv[5]; fs.writeFileSync(process.argv[3],JSON.stringify(c));
NODE
if env HOME="$home" SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE=1 pwsh -NoProfile -File scripts/deploy-sakura.ps1 -Mode RestoreSafe -ConfigPath "$backup_link_config" -WorkDir "$work/backup-link-pkg" -HostName local.invalid -UserName abroad-o -RemoteDir "$public" -SshKeyPath ignored -BackupFile "$work/backups-link/abroad-o-before-contract.sra.tgz" -BackupArchiveSha256 "$valid_archive_sha" -BackupManifestSha256 "$manifest_sha" -RestoreApply >/dev/null 2>&1; then fail 'symlink backup parent accepted'; fi
[ "$baseline" = "$(tree "$public")" ] || fail 'symlink backup parent changed contents'

printf 'Sakura remote RestoreSafe shell E2E passed.\n'
