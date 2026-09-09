#!/usr/bin/env bash
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
helper="$repo/scripts/lib/sakura-remote-metadata.sh"
work=$(mktemp -d "${TMPDIR:-/tmp}/abroad-o-metadata.XXXXXX")
cleanup() { rm -rf "$work"; }
trap cleanup EXIT
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

public="$work/public"
backups="$work/backups"
mkdir -p "$public/pdfjs" "$backups"

run_helper() {
  env \
    SAKURA_METADATA_PUBLIC_ROOT="$public" \
    SAKURA_METADATA_BACKUP_DIRECTORY="$backups" \
    SAKURA_METADATA_RETIRED_EXACT='pdfjs/LICENSE' \
    SAKURA_METADATA_RETIRED_PREFIX_1='TOOL/' \
    SAKURA_METADATA_RETIRED_PREFIX_2='pdfjs/build/' \
    SAKURA_METADATA_RETIRED_PREFIX_3='pdfjs/web/' \
    sh "$helper"
}

snapshot() {
  # Test-only integrity evidence deliberately reads fixture payloads. The
  # production helper is separately guarded against opening those payloads.
  find "$work" -mindepth 1 -exec sh -c '
    for item do
      metadata=$(stat -c "%a %Y" "$item" 2>/dev/null || stat -f "%Lp %m" "$item") || exit 33
      if [ -L "$item" ]; then
        printf "L %s %s %s\n" "$metadata" "$item" "$(readlink "$item")"
      elif [ -f "$item" ]; then
        printf "F %s %s %s %s\n" "$metadata" "$item" "$(wc -c < "$item" | tr -d "[:space:]")" "$(cksum < "$item")"
      elif [ -d "$item" ]; then
        printf "D %s %s\n" "$metadata" "$item"
      else
        printf "O %s %s\n" "$metadata" "$item"
      fi
    done
  ' sh {} + | LC_ALL=C sort
}

before=$(snapshot)
normal=$(run_helper)
[ "$before" = "$(snapshot)" ] || fail 'normal metadata read changed the fixture tree'
grep -Fxq 'METADATA schema=1' <<<"$normal" || fail 'schema line missing'
grep -Fxq 'DEPLOY_LOCK exists=false symlink=false ready=true' <<<"$normal" || fail 'absent lock was not reported safely'
grep -Fxq 'LATEST_ARCHIVE present=false basename=- bytes=0' <<<"$normal" || fail 'empty archive state missing'
grep -Fxq 'READY value=true' <<<"$normal" || fail 'empty safe fixture should be ready'

printf 'archive' > "$backups/abroad-o-before-20260910-000000.sra.tgz"
archive=$(run_helper)
grep -Fxq 'LATEST_ARCHIVE present=true basename=abroad-o-before-20260910-000000.sra.tgz bytes=7' <<<"$archive" || fail 'latest archive metadata is wrong'

mkdir "$backups/.abroad-o-deploy.lock"
locked=$(run_helper)
grep -Fxq 'DEPLOY_LOCK exists=true symlink=false ready=false' <<<"$locked" || fail 'held lock was not reported'
grep -Fxq 'READY value=false' <<<"$locked" || fail 'held lock did not block readiness'
rmdir "$backups/.abroad-o-deploy.lock"

ln -s missing-target "$backups/.abroad-o-deploy.lock"
dangling=$(run_helper)
grep -Fxq 'DEPLOY_LOCK exists=true symlink=true ready=false' <<<"$dangling" || fail 'dangling lock symlink was treated as absent'
rm "$backups/.abroad-o-deploy.lock"

mkdir -p "$public/TOOL/sub" "$public/pdfjs/build" "$public/pdfjs/web"
printf 'abc' > "$public/pdfjs/LICENSE"
printf '12345' > "$public/TOOL/a"
printf '1234567' > "$public/TOOL/sub/b"
retired=$(run_helper)
grep -Fxq 'RETIRED id=pdfjs_license exists=true type=file files=1 bytes=3' <<<"$retired" || fail 'exact retired file metadata is wrong'
grep -Fxq 'RETIRED id=tool exists=true type=directory files=2 bytes=12' <<<"$retired" || fail 'retired directory aggregate is wrong'
grep -Fxq 'READY value=false' <<<"$retired" || fail 'retired content did not block readiness'
[[ $retired != *12345* && $retired != *sub/b* ]] || fail 'retired output leaked file content or a file name'

real_stat=$(command -v stat)
fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/stat" <<'EOF'
#!/bin/sh
case "$1:$2" in
  -f:%m) exec "$REAL_STAT" -c '%Y' "$3" ;;
  -f:%z) exec "$REAL_STAT" -c '%s' "$3" ;;
  -c:*) exit 41 ;;
  *) exit 42 ;;
esac
EOF
chmod 700 "$fake_bin/stat"
bsd=$(REAL_STAT="$real_stat" PATH="$fake_bin:$PATH" run_helper)
grep -Fxq 'LATEST_ARCHIVE present=true basename=abroad-o-before-20260910-000000.sra.tgz bytes=7' <<<"$bsd" || fail 'BSD stat archive size is wrong'
grep -Fxq 'RETIRED id=tool exists=true type=directory files=2 bytes=12' <<<"$bsd" || fail 'BSD stat directory aggregation is wrong'
rm -rf "$fake_bin"

fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/stat" <<'EOF'
#!/bin/sh
case "$1:$2" in
  -f:*) exit 41 ;;
  -c:%Y) exec "$REAL_STAT" -c '%Y' "$3" ;;
  -c:%s) exec "$REAL_STAT" -c '%s' "$3" ;;
  *) exit 42 ;;
esac
EOF
chmod 700 "$fake_bin/stat"
gnu=$(REAL_STAT="$real_stat" PATH="$fake_bin:$PATH" run_helper)
grep -Fxq 'LATEST_ARCHIVE present=true basename=abroad-o-before-20260910-000000.sra.tgz bytes=7' <<<"$gnu" || fail 'GNU stat archive size is wrong'
grep -Fxq 'RETIRED id=tool exists=true type=directory files=2 bytes=12' <<<"$gnu" || fail 'GNU stat directory aggregation is wrong'
rm -rf "$fake_bin"

payload_open_marker="$work/payload-open-marker"
fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/payload-reader" <<'EOF'
#!/bin/sh
printf 'payload-open\n' >> "$PAYLOAD_OPEN_MARKER"
exit 41
EOF
chmod 700 "$fake_bin/payload-reader"
for reader in wc cat cksum sha256sum shasum; do cp "$fake_bin/payload-reader" "$fake_bin/$reader"; done
PAYLOAD_OPEN_MARKER="$payload_open_marker" PATH="$fake_bin:$PATH" run_helper >/dev/null
[ ! -e "$payload_open_marker" ] || fail 'production helper invoked a payload-reading utility'
rm -rf "$fake_bin"

before=$(snapshot)
run_helper >/dev/null
[ "$before" = "$(snapshot)" ] || fail 'retired metadata read changed file contents or tree shape'
[ -z "$(find "$work" \( -name '.*codex*' -o -name '*.tmp' \) -print -quit)" ] || fail 'metadata read created a temporary file'

rm -rf "$public/TOOL" "$public/pdfjs/build" "$public/pdfjs/web" "$public/pdfjs/LICENSE"
rm -rf "$backups"
missing_backup=$(run_helper)
grep -Fxq 'BACKUP_DIRECTORY state=absent symlink=false realpath=false' <<<"$missing_backup" || fail 'missing backup directory state is wrong'
mkdir "$backups"

rm -rf "$backups"; printf x > "$backups"
if run_helper >/dev/null 2>&1; then fail 'non-directory backup path was accepted'; fi
rm "$backups"; mkdir "$backups"

rm -rf "$backups"; ln -s "$work" "$backups"
if run_helper >/dev/null 2>&1; then fail 'symlink backup directory was accepted'; fi
rm "$backups"; mkdir "$backups"

printf x > "$backups/abroad-o-before-bad name.sra.tgz"
if run_helper >/dev/null 2>&1; then fail 'invalid archive basename was accepted'; fi
rm "$backups/abroad-o-before-bad name.sra.tgz"

printf x > "$backups/abroad-o-before-ExampleCustomer.sra.tgz"
if run_helper >/dev/null 2>&1; then fail 'non-timestamp archive basename was accepted'; fi
rm "$backups/abroad-o-before-ExampleCustomer.sra.tgz"

printf x > "$backups/abroad-o-before-20260910-000000.sra.tgz"
fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/stat" <<'EOF'
#!/bin/sh
case "$1:$2" in
  -f:%m) exec "$REAL_STAT" -c '%Y' "$3" ;;
  -f:%z) printf '999\n'; exit 41 ;;
  -c:%s) exec "$REAL_STAT" -c '%s' "$3" ;;
  *) exit 42 ;;
esac
EOF
chmod 700 "$fake_bin/stat"
archive_fallback=$(REAL_STAT="$real_stat" PATH="$fake_bin:$PATH" run_helper)
grep -Fxq 'LATEST_ARCHIVE present=true basename=abroad-o-before-20260910-000000.sra.tgz bytes=1' <<<"$archive_fallback" || fail 'failed BSD archive size was not replaced by successful GNU metadata'
rm -rf "$fake_bin"

fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/stat" <<'EOF'
#!/bin/sh
case "$1:$2" in
  -f:%m) exec "$REAL_STAT" -c '%Y' "$3" ;;
  -f:%z|-c:%s) printf '999\n'; exit 41 ;;
  *) exit 42 ;;
esac
EOF
chmod 700 "$fake_bin/stat"
if REAL_STAT="$real_stat" PATH="$fake_bin:$PATH" run_helper >/dev/null 2>&1; then fail 'archive size accepted numeric output from two failed stat dialects'; fi
rm -rf "$fake_bin"

fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/stat" <<'EOF'
#!/bin/sh
case "$1:$2" in
  -f:%m|-c:%Y) printf '123\n'; exit 0 ;;
  -f:%z|-c:%s) printf '%s\n' '-1'; exit 0 ;;
  *) exit 42 ;;
esac
EOF
chmod 700 "$fake_bin/stat"
if PATH="$fake_bin:$PATH" run_helper >/dev/null 2>&1; then fail 'signed or invalid stat size was accepted'; fi
rm -rf "$fake_bin"

fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/ls" <<'EOF'
#!/bin/sh
exit 41
EOF
chmod 700 "$fake_bin/ls"
if PATH="$fake_bin:$PATH" run_helper >/dev/null 2>&1; then fail 'failed archive directory enumeration was accepted'; fi
rm -rf "$fake_bin" "$backups/abroad-o-before-20260910-000000.sra.tgz"

printf abc > "$public/pdfjs/LICENSE"
fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/stat" <<'EOF'
#!/bin/sh
case "$1:$2" in
  -f:%z|-c:%s) printf '3\n'; exit 41 ;;
  *) exit 42 ;;
esac
EOF
chmod 700 "$fake_bin/stat"
if PATH="$fake_bin:$PATH" run_helper >/dev/null 2>&1; then fail 'exact retired size accepted numeric output from two failed stat dialects'; fi
rm -rf "$fake_bin" "$public/pdfjs/LICENSE"

rm -rf "$public/pdfjs"
printf x > "$public/pdfjs"
if run_helper >/dev/null 2>&1; then fail 'regular-file intermediate component was reported as absent'; fi
rm "$public/pdfjs"; mkdir "$public/pdfjs"

outside="$work/outside"; mkdir "$outside"; printf secret > "$outside/file"
ln -s "$outside" "$public/TOOL"
if run_helper >/dev/null 2>&1; then fail 'retired symlink escaping the fixed root was accepted'; fi
[ "$(cat "$outside/file")" = secret ] || fail 'failed symlink case changed outside content'
rm "$public/TOOL"

mkdir "$public/TOOL"
ln -s "$outside/file" "$public/TOOL/link"
if run_helper >/dev/null 2>&1; then fail 'nested retired symlink was accepted'; fi
rm -rf "$public/TOOL"

if command -v mkfifo >/dev/null 2>&1; then
  mkdir "$public/TOOL"
  mkfifo "$public/TOOL/pipe"
  if run_helper >/dev/null 2>&1; then fail 'nested special file was accepted'; fi
  rm -rf "$public/TOOL"
fi

mkdir "$public/TOOL"
printf 'first' > "$public/TOOL/a"
mkdir "$public/TOOL/sub"
printf 'TOP_SECRET_VALUE' > "$public/TOOL/sub/b"
fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/stat" <<'EOF'
#!/bin/sh
case "$1:$2" in
  -f:%z)
    case "$3" in
      */sub/b) printf '16\n'; exit 41 ;;
      *) exec "$REAL_STAT" -c '%s' "$3" ;;
    esac
    ;;
  -f:*) exit 41 ;;
  -c:%s)
    exec "$REAL_STAT" -c '%s' "$3"
    ;;
  *) exec "$REAL_STAT" "$@" ;;
esac
EOF
chmod 700 "$fake_bin/stat"
nested_fallback=$(REAL_STAT="$real_stat" PATH="$fake_bin:$PATH" run_helper)
grep -Fxq 'RETIRED id=tool exists=true type=directory files=2 bytes=21' <<<"$nested_fallback" || fail 'failed BSD nested size was not replaced by successful GNU metadata'
rm -rf "$fake_bin"

fake_bin="$work/fake-bin"; mkdir "$fake_bin"
cat > "$fake_bin/stat" <<'EOF'
#!/bin/sh
case "$1:$2" in
  -f:%z)
    case "$3" in
      */sub/b) printf '16\n'; exit 41 ;;
      *) exec "$REAL_STAT" -c '%s' "$3" ;;
    esac
    ;;
  -f:*) exit 41 ;;
  -c:%s)
    case "$3" in
      */sub/b) printf '16\n'; exit 41 ;;
      *) exec "$REAL_STAT" -c '%s' "$3" ;;
    esac
    ;;
  *) exec "$REAL_STAT" "$@" ;;
esac
EOF
chmod 700 "$fake_bin/stat"
partial_before=$(snapshot)
if REAL_STAT="$real_stat" PATH="$fake_bin:$PATH" run_helper >/dev/null 2>&1; then fail 'partial stat size failure was accepted'; fi
[ "$partial_before" = "$(snapshot)" ] || fail 'partial failure changed the fixture tree'
rm -rf "$public/TOOL" "$fake_bin"

injected="$work/injected"
if env \
  SAKURA_METADATA_PUBLIC_ROOT="$public;touch $injected" \
  SAKURA_METADATA_BACKUP_DIRECTORY="$backups" \
  SAKURA_METADATA_RETIRED_EXACT='pdfjs/LICENSE' \
  SAKURA_METADATA_RETIRED_PREFIX_1='TOOL/' \
  SAKURA_METADATA_RETIRED_PREFIX_2='pdfjs/build/' \
  SAKURA_METADATA_RETIRED_PREFIX_3='pdfjs/web/' \
  sh "$helper" >/dev/null 2>&1; then
  fail 'command-injection path was accepted'
fi
[ ! -e "$injected" ] || fail 'command-injection text was executed'

# On Linux CI, execute the exact PowerShell-generated shell through the explicit
# local harness. Windows runs the helper fixture above and reports this OS layer
# as deferred to the existing Ubuntu site-check job.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) ;;
  *)
    if command -v pwsh >/dev/null 2>&1; then
      config="$work/config.json"
      node - "$repo/deploy/sakura-public-files.json" "$config" "$public" "$backups" <<'NODE'
const fs = require('fs');
const [source, destination, publicRoot, backupDirectory] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(source));
config.restoreContract.remotePublicRoot = publicRoot;
config.restoreContract.backupDirectory = backupDirectory;
fs.writeFileSync(destination, JSON.stringify(config));
NODE
      marker="$work/invocations"
      network="$work/network"
      output=$(env SAKURA_LOCAL_REMOTE_SCRIPT_EXECUTE=1 SAKURA_LOCAL_REMOTE_SCRIPT_MARKER="$marker" SAKURA_TEST_NETWORK_BLOCK_MARKER="$network" \
        pwsh -NoProfile -File "$repo/scripts/deploy-sakura.ps1" -Mode Metadata -SelectedSha "$(git -C "$repo" rev-parse HEAD)" \
        -ConfigPath "$config" -WorkDir "$work/generated" -HostName local.invalid -UserName local -RemoteDir "$public" -SshKeyPath ignored)
      [ "$(wc -l < "$marker" | tr -d '[:space:]')" = 1 ] || fail 'generated metadata used more than one transport invocation'
      grep -Fxq 'invoke-metadata' "$marker" || fail 'generated shell did not cross the local fake SSH boundary'
      [ ! -e "$network" ] || fail 'generated metadata shell attempted a real network operation'
      grep -Fxq 'METADATA schema=1' <<<"$output" || fail 'generated shell output was not accepted'
      [[ $output != *'Package:'* && $output != *'Stage completed:'* && $output != *'Promote completed:'* ]] || fail 'generated metadata fell through into package or deployment work'
      [ -z "$(find "$work/generated" \( -name '*.tgz' -o -name 'manifest-*' \) -print -quit 2>/dev/null)" ] || fail 'generated metadata created package artifacts'
    fi
    ;;
esac

printf 'Sakura remote metadata read-only tests passed.\n'
