#!/usr/bin/env bash
# Pull a private GoAccess visit report for travelthebackroads.com to Rob's PC.
# Run from Git Bash with W: mounted, from the repo folder:
#   bash src/ops/analytics/pull-report.sh
# Totals only: IPs shortened, hosts / remote-user / referrer-URL / keyphrase / UTM panels off,
# crawlers ignored, no query strings. Never web-served; nothing saved on the box
# (GoAccess reads stdin, writes HTML to stdout, no --persist).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CONF="$ROOT/analytics/webbox.env"
if [ ! -f "$CONF" ]; then
  echo "Missing analytics/webbox.env (local, gitignored). It needs TTBR_SSH_TARGET and TTBR_SSH_KEY." >&2
  exit 1
fi
# shellcheck disable=SC1090
. "$CONF"
: "${TTBR_SSH_TARGET:?set TTBR_SSH_TARGET in analytics/webbox.env}"
: "${TTBR_SSH_KEY:?set TTBR_SSH_KEY in analytics/webbox.env}"
KEY="$TTBR_SSH_KEY"
if [ ! -f "$KEY" ]; then
  echo "Key file not found. Mount the W: drive in VeraCrypt, then run this again." >&2
  exit 1
fi
OUT_DIR="$ROOT/analytics/reports"
OUT="$OUT_DIR/ttbr-visits-$(date -u +%F).html"
mkdir -p "$OUT_DIR"
trap 'rm -f "$OUT.part"' EXIT

ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$HOME/webbox_known_hosts" "$TTBR_SSH_TARGET" \
  'sudo sh -c "cd /var/log/httpd/sites/travelthebackroads.com && zcat -f access.log-* access.log" \
   | /usr/local/bin/goaccess - --no-global-config \
       --log-format=COMBINED \
       --anonymize-ip --ignore-crawlers --no-query-string \
       --ignore-panel=HOSTS --ignore-panel=REMOTE_USER \
       --ignore-panel=REFERRERS --ignore-panel=KEYPHRASES \
       --ignore-panel=UTM_CAMPAIGNS --no-progress \
       --html-report-title="travelthebackroads.com visits (private)" \
       -o html' > "$OUT.part"

mv "$OUT.part" "$OUT"
echo "Report: $OUT"
