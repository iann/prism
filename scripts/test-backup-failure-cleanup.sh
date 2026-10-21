#!/usr/bin/env bash
# Verifies that a failed database dump leaves nothing behind, and that a good
# dump is kept.
#
# Run manually:   bash scripts/test-backup-failure-cleanup.sh
# Wired into CI:  .github/workflows/ci.yml (typecheck-lint job)
#
# Why this exists: when the backup container's pg_dump could not talk to the
# database — a client/server major-version mismatch, for instance — the dump
# pipeline still wrote a truncated file, and the script only reported the
# failure afterwards. Those stubs sat in the backups directory looking like
# backups: they were picked up by "newest dump" lookups, they counted towards
# the local copy, and they only aged out on the retention window. The script
# now removes a failed dump, and this test keeps that behaviour from being
# undone.
#
# The failure path is exercised with a pg_dump stand-in that fails, exactly the
# way a real client/server mismatch does. The success path needs the
# retention sweep, which uses GNU date; it is skipped where that is
# unavailable.

set -euo pipefail

cd "$(dirname "$0")/.."

WORK_DIR=$(mktemp -d -t prism-backup-test.XXXXXX)
cleanup() {
  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

STUB_BIN="$WORK_DIR/bin"
mkdir -p "$STUB_BIN"

export BACKUP_DIR="$WORK_DIR/backups"
export POSTGRES_PASSWORD=unused
export HC_URL=""
export RETENTION_DAYS=7
mkdir -p "$BACKUP_DIR"

fail() {
  echo "ERROR: $1"
  exit 1
}

# A pg_dump that fails the way a version-mismatched client does.
cat > "$STUB_BIN/pg_dump" <<'STUB'
#!/bin/sh
echo "pg_dump: error: aborting because of server version mismatch" >&2
exit 1
STUB
chmod +x "$STUB_BIN/pg_dump"

PATH="$STUB_BIN:$PATH" bash scripts/backup.sh > "$WORK_DIR/failure.log" 2>&1 && status=0 || status=$?

if [ "$status" -ne 1 ]; then
  echo "ERROR: backup.sh should exit 1 when the dump fails, got $status"
  cat "$WORK_DIR/failure.log"
  exit 1
fi

leftovers=$(find "$BACKUP_DIR" -name 'prism_*.sql.gz' | wc -l | tr -d ' ')
if [ "$leftovers" != "0" ]; then
  echo "ERROR: a failed dump left $leftovers file(s) in $BACKUP_DIR"
  find "$BACKUP_DIR" -name 'prism_*.sql.gz'
  exit 1
fi

if ! grep -q "Backup failed or too small" "$WORK_DIR/failure.log"; then
  echo "ERROR: backup.sh did not report the failed dump"
  cat "$WORK_DIR/failure.log"
  exit 1
fi

echo "OK: a failed dump exits 1 and leaves no file behind."

# The success path runs the retention sweep, which uses GNU date.
if ! date -d "@0" +%Y%m%d >/dev/null 2>&1; then
  echo "SKIP: the success path needs GNU date for the retention sweep."
  exit 0
fi

cat > "$STUB_BIN/pg_dump" <<'STUB'
#!/bin/sh
# A dump big enough to clear the plausibility threshold. The threshold is
# applied to the compressed file, so the content has to be incompressible.
dd if=/dev/urandom bs=1024 count=16 2>/dev/null
STUB
chmod +x "$STUB_BIN/pg_dump"

PATH="$STUB_BIN:$PATH" bash scripts/backup.sh > "$WORK_DIR/success.log" 2>&1 || {
  echo "ERROR: backup.sh should succeed when the dump succeeds"
  cat "$WORK_DIR/success.log"
  exit 1
}

kept=$(find "$BACKUP_DIR" -name 'prism_*.sql.gz' | wc -l | tr -d ' ')
if [ "$kept" != "1" ]; then
  echo "ERROR: a successful dump should be kept, found $kept file(s)"
  exit 1
fi

echo "OK: a successful dump is kept."
