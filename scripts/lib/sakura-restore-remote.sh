#!/bin/sh
# Pure shell validation shared by Promote and RestoreSafe.  It only reads an
# archive and writes under the caller-provided verification directory.
sakura_sha256() {
  output=
  hash=
  if command -v sha256sum >/dev/null 2>&1; then
    if output=$(sha256sum "$1" 2>/dev/null); then
      hash=$(printf '%s\n' "$output" | awk 'NR == 1 { print $1 }')
      if [ "${#hash}" -eq 64 ] && printf '%s\n' "$hash" | LC_ALL=C grep -Eq '^[0-9a-f]{64}$'; then
        printf '%s\n' "$hash"
        return 0
      fi
    fi
  fi
  if command -v shasum >/dev/null 2>&1; then
    if output=$(shasum -a 256 "$1" 2>/dev/null); then
      hash=$(printf '%s\n' "$output" | awk 'NR == 1 { print $1 }')
      if [ "${#hash}" -eq 64 ] && printf '%s\n' "$hash" | LC_ALL=C grep -Eq '^[0-9a-f]{64}$'; then
        printf '%s\n' "$hash"
        return 0
      fi
    fi
  fi
  echo 'Neither sha256sum nor shasum produced a SHA-256 hash.' >&2
  return 1
}

validate_sanitized_archive() {
  archive=$1 verify_stage=$2 expected_archive_sha=$3 expected_manifest_sha=$4
  archive_root=$5 remote_public_root=$6 deployment_path_sha=$7 deployment_evidence_sha=$8
  test -f "$archive" && test ! -L "$archive"
  test "$(realpath "$archive")" = "$archive"
  test "$(sakura_sha256 "$archive")" = "$expected_archive_sha"
  test -z "$(tar -tzf "$archive" | awk '/^\// || /(^|\/)\.\.($|\/)/ || /\\/ { print; exit }')"
  test -z "$(tar -tvzf "$archive" | awk 'substr($1, 1, 1) == "l" || substr($1, 1, 1) == "h" { print; exit }')"
  tar -tzf "$archive" | awk -v root="$archive_root" '
    $0 == root "/" || $0 == root "/payload/" || $0 == root "/manifest.txt" || $0 == root "/manifest.sha256" || $0 == root "/metadata.json" { next }
    index($0, root "/payload/") == 1 { next }
    { exit 1 }'
  mkdir -p "$verify_stage"
  tar -xzf "$archive" -C "$verify_stage"
  test -d "$verify_stage/$archive_root/payload"
  test -f "$verify_stage/$archive_root/manifest.txt" && test -f "$verify_stage/$archive_root/manifest.sha256" && test -f "$verify_stage/$archive_root/metadata.json"
  manifest_sha=$(sakura_sha256 "$verify_stage/$archive_root/manifest.txt")
  test "$manifest_sha" = "$expected_manifest_sha"
  test "$(cat "$verify_stage/$archive_root/manifest.sha256")" = "$manifest_sha  manifest.txt"
  expected_metadata=$(printf '{"formatVersion":1,"archiveRoot":"%s","remotePublicRoot":"%s","deploymentPathManifestSha256":"%s","deploymentEvidenceSha256":"%s"}' "$archive_root" "$remote_public_root" "$deployment_path_sha" "$deployment_evidence_sha")
  test "$(tr -d '\r\n' < "$verify_stage/$archive_root/metadata.json")" = "$expected_metadata"
  test -z "$(find "$verify_stage/$archive_root" -type l -print -quit)"
}
