#!/bin/sh
# Fixed, read-only Sakura deployment metadata contract. The caller supplies
# validated values from deploy/sakura-public-files.json; no user command or
# path is accepted by this script.
set -eu

fail() {
  printf 'METADATA_ERROR code=%s\n' "$1"
  exit 1
}

require_value() {
  eval "value=\${$1-}"
  [ -n "$value" ] || fail missing_contract_value
}

for name in \
  SAKURA_METADATA_PUBLIC_ROOT \
  SAKURA_METADATA_BACKUP_DIRECTORY \
  SAKURA_METADATA_RETIRED_EXACT \
  SAKURA_METADATA_RETIRED_PREFIX_1 \
  SAKURA_METADATA_RETIRED_PREFIX_2 \
  SAKURA_METADATA_RETIRED_PREFIX_3
do
  require_value "$name"
done

public_root=$SAKURA_METADATA_PUBLIC_ROOT
backup_directory=$SAKURA_METADATA_BACKUP_DIRECTORY
ready=true

read_file_size() {
  size_path=$1
  size_value=
  if candidate_size=$(stat -f '%z' "$size_path" 2>/dev/null); then
    case "$candidate_size" in ''|*[!0-9]*) ;; *) size_value=$candidate_size ;; esac
  fi
  if [ -z "$size_value" ] && candidate_size=$(stat -c '%s' "$size_path" 2>/dev/null); then
    case "$candidate_size" in ''|*[!0-9]*) ;; *) size_value=$candidate_size ;; esac
  fi
  case "$size_value" in ''|*[!0-9]*) return 1 ;; esac
  printf '%s\n' "$size_value"
}

[ ! -L "$public_root" ] || fail public_root_symlink
[ -d "$public_root" ] || fail public_root_not_directory
[ -r "$public_root" ] && [ -x "$public_root" ] || fail public_root_not_accessible
public_real=$(realpath "$public_root" 2>/dev/null) || fail public_root_realpath
[ "$public_real" = "$public_root" ] || fail public_root_outside_fixed_path
printf 'METADATA schema=1\n'
printf 'PUBLIC_ROOT state=directory symlink=false realpath=true\n'

backup_state=absent
backup_realpath=false
if [ -L "$backup_directory" ]; then
  fail backup_directory_symlink
elif [ -e "$backup_directory" ]; then
  [ -d "$backup_directory" ] || fail backup_directory_not_directory
  [ -r "$backup_directory" ] && [ -x "$backup_directory" ] || fail backup_directory_not_accessible
  backup_real=$(realpath "$backup_directory" 2>/dev/null) || fail backup_directory_realpath
  [ "$backup_real" = "$backup_directory" ] || fail backup_directory_outside_fixed_path
  backup_state=directory
  backup_realpath=true
else
  backup_parent=${backup_directory%/*}
  [ -n "$backup_parent" ] || backup_parent=/
  [ ! -L "$backup_parent" ] || fail backup_parent_symlink
  [ -d "$backup_parent" ] || fail backup_parent_not_directory
  [ -r "$backup_parent" ] && [ -x "$backup_parent" ] || fail backup_parent_not_accessible
  backup_parent_real=$(realpath "$backup_parent" 2>/dev/null) || fail backup_parent_realpath
  [ "$backup_parent_real" = "$backup_parent" ] || fail backup_parent_outside_fixed_path
fi
printf 'BACKUP_DIRECTORY state=%s symlink=false realpath=%s\n' "$backup_state" "$backup_realpath"

lock_path=$backup_directory/.abroad-o-deploy.lock
lock_exists=false
lock_symlink=false
lock_ready=true
if [ -L "$lock_path" ]; then
  lock_exists=true
  lock_symlink=true
  lock_ready=false
  ready=false
elif [ -e "$lock_path" ]; then
  lock_exists=true
  lock_ready=false
  ready=false
fi
printf 'DEPLOY_LOCK exists=%s symlink=%s ready=%s\n' "$lock_exists" "$lock_symlink" "$lock_ready"

latest_name=-
latest_size=0
latest_mtime=-1
if [ "$backup_state" = directory ]; then
  ls -1 "$backup_directory" >/dev/null 2>&1 || fail archive_enumeration_failed
  for candidate in "$backup_directory"/abroad-o-before-*.sra.tgz; do
    if [ ! -e "$candidate" ] && [ ! -L "$candidate" ]; then
      if [ "$candidate" = "$backup_directory/abroad-o-before-*.sra.tgz" ]; then
        continue
      fi
      fail archive_changed_during_read
    fi
    [ ! -L "$candidate" ] || fail archive_symlink
    [ -f "$candidate" ] || fail archive_not_regular
    name=$(basename "$candidate")
    middle=${name#abroad-o-before-}
    middle=${middle%.sra.tgz}
    case "$middle" in
      [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]) ;;
      *) fail archive_name_invalid ;;
    esac
    mtime=
    if candidate_mtime=$(stat -f '%m' "$candidate" 2>/dev/null); then
      case "$candidate_mtime" in ''|*[!0-9]*) ;; *) mtime=$candidate_mtime ;; esac
    fi
    if [ -z "$mtime" ] && candidate_mtime=$(stat -c '%Y' "$candidate" 2>/dev/null); then
      case "$candidate_mtime" in ''|*[!0-9]*) ;; *) mtime=$candidate_mtime ;; esac
    fi
    case "$mtime" in ''|*[!0-9]*) fail archive_stat_unsupported ;; esac
    size=$(read_file_size "$candidate") || fail archive_size_failed
    if [ "$mtime" -gt "$latest_mtime" ]; then
      latest_mtime=$mtime
      latest_name=$name
      latest_size=$size
    fi
  done
fi
if [ "$latest_name" = - ]; then
  printf 'LATEST_ARCHIVE present=false basename=- bytes=0\n'
else
  printf 'LATEST_ARCHIVE present=true basename=%s bytes=%s\n' "$latest_name" "$latest_size"
fi

assert_no_symlink_component() {
  relative=$1
  current=$public_root
  remainder=${relative%/}
  while [ -n "$remainder" ]; do
    case "$remainder" in
      */*) component=${remainder%%/*}; remainder=${remainder#*/} ;;
      *) component=$remainder; remainder= ;;
    esac
    [ -n "$component" ] || fail retired_path_invalid
    current=$current/$component
    [ ! -L "$current" ] || fail retired_symlink
    if [ -n "$remainder" ]; then
      [ -d "$current" ] || fail retired_ancestor_not_directory
      [ -r "$current" ] && [ -x "$current" ] || fail retired_ancestor_not_accessible
    fi
  done
}

report_retired() {
  id=$1
  relative=$2
  expected_type=$3
  target=$public_root/${relative%/}
  assert_no_symlink_component "$relative"

  if [ ! -e "$target" ] && [ ! -L "$target" ]; then
    printf 'RETIRED id=%s exists=false type=absent files=0 bytes=0\n' "$id"
    return
  fi
  [ ! -L "$target" ] || fail retired_symlink
  resolved=$(realpath "$target" 2>/dev/null) || fail retired_realpath
  [ "$resolved" = "$target" ] || fail retired_outside_fixed_root
  ready=false

  if [ -f "$target" ]; then
    [ "$expected_type" = file ] || fail retired_prefix_not_directory
    bytes=$(read_file_size "$target") || fail retired_size_failed
    printf 'RETIRED id=%s exists=true type=file files=1 bytes=%s\n' "$id" "$bytes"
    return
  fi

  [ -d "$target" ] || fail retired_special_type
  [ "$expected_type" = directory ] || fail retired_exact_not_file
  nested_link=$(find "$target" -type l -print -quit 2>/dev/null) || fail retired_scan_failed
  [ -z "$nested_link" ] || fail retired_nested_symlink
  nested_special=$(find "$target" ! -type d ! -type f ! -type l -print -quit 2>/dev/null) || fail retired_scan_failed
  [ -z "$nested_special" ] || fail retired_nested_special_type
  sizes=$(find "$target" -type f -exec sh -c '
    for item do
      size=
      if candidate_size=$(stat -f "%z" "$item" 2>/dev/null); then
        case "$candidate_size" in ""|*[!0-9]*) ;; *) size=$candidate_size ;; esac
      fi
      if [ -z "$size" ] && candidate_size=$(stat -c "%s" "$item" 2>/dev/null); then
        case "$candidate_size" in ""|*[!0-9]*) ;; *) size=$candidate_size ;; esac
      fi
      case "$size" in ""|*[!0-9]*) exit 32 ;; esac
      printf "%s\n" "$size"
    done
  ' sh {} + 2>/dev/null) || fail retired_scan_failed
  files=0
  bytes=0
  for size in $sizes; do
    files=$((files + 1))
    bytes=$((bytes + size))
  done
  printf 'RETIRED id=%s exists=true type=directory files=%s bytes=%s\n' "$id" "$files" "$bytes"
}

report_retired pdfjs_license "$SAKURA_METADATA_RETIRED_EXACT" file
report_retired tool "$SAKURA_METADATA_RETIRED_PREFIX_1" directory
report_retired pdfjs_build "$SAKURA_METADATA_RETIRED_PREFIX_2" directory
report_retired pdfjs_web "$SAKURA_METADATA_RETIRED_PREFIX_3" directory
printf 'READY value=%s\n' "$ready"
