#!/usr/bin/env bash
# Pull private GoAccess visit reports for travelthebackroads.com to Rob's PC.
# Run from Git Bash with W: mounted, from the repo folder:
#   bash src/ops/analytics/pull-report.sh
# Totals only: IPs shortened, hosts / remote-user / referrer-URL / keyphrase / UTM panels off,
# crawlers ignored, no query strings. Never web-served; nothing saved on the box
# (GoAccess reads stdin, writes HTML to stdout, no --persist).
#
# Three reports, one SSH each. The main one keeps its old file name; the others sit beside it:
#   ttbr-visits-<date>.html   main report (visitor-days, pages, sources, missing files)
#   ttbr-readers-<date>.html  only ping lines (GET /v/<slug>.gif answered 200 or 304) = readers per day
#   ttbr-appjs-<date>.html    visitors who got /app.js with a 200 = backfill for days before the pings
# The box runs GoAccess 1.12 (read from the embedded report). --ignore-status=301 and
# --unknowns-as-crawlers are added only if the box's GoAccess lists them in --help,
# so an older GoAccess just runs without them.
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
DAY="$(date -u +%F)"
mkdir -p "$OUT_DIR"
trap 'rm -f "$OUT_DIR"/*.part' EXIT

# Line filters (POSIX ERE, run on the box). tests/readers-pattern.test.js applies these same lines.
READERS_RE='"GET /v/[a-z0-9-]+\.gif(\?[^" ]*)? HTTP/[0-9.]+" (200|304) '
APPJS_RE='"GET /app\.js(\?[^" ]*)? HTTP/[0-9.]+" 200 '

# pull <name> <title> [regex]  -> analytics/reports/ttbr-<name>-<date>.html
pull() {
  local name="$1" title="$2" re="${3:-}" out="$OUT_DIR/ttbr-$1-$DAY.html"
  local q
  q="$(printf '%q' "$re")"
  # shellcheck disable=SC2029
  if ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$HOME/webbox_known_hosts" "$TTBR_SSH_TARGET" \
    "RE=$q; GA=/usr/local/bin/goaccess; HELP=\$(\$GA --help 2>&1); X=''
     case \"\$HELP\" in *--ignore-status*) X=\"\$X --ignore-status=301\";; esac
     case \"\$HELP\" in *--unknowns-as-crawlers*) X=\"\$X --unknowns-as-crawlers\";; esac
     sudo sh -c 'cd /var/log/httpd/sites/travelthebackroads.com && zcat -f access.log-* access.log' \
       | if [ -n \"\$RE\" ]; then grep -E \"\$RE\"; else cat; fi \
       | \$GA - --no-global-config --log-format=COMBINED \$X \
           --anonymize-ip --ignore-crawlers --no-query-string \
           --ignore-panel=HOSTS --ignore-panel=REMOTE_USER \
           --ignore-panel=REFERRERS --ignore-panel=KEYPHRASES \
           --ignore-panel=UTM_CAMPAIGNS --no-progress \
           --html-report-title='$title' -o html" > "$out.part"; then
    mv "$out.part" "$out"
    echo "Report: $out"
  else
    rm -f "$out.part"
    echo "Report '$name' failed (no matching lines yet?). Skipped." >&2
    return 1
  fi
}

pull visits "travelthebackroads.com visits (private)"
# The extra reports are optional: if one fails, the main report and the rest still stand.
pull readers "travelthebackroads.com readers (private)" "$READERS_RE" || true
pull appjs "travelthebackroads.com app.js visitors (private)" "$APPJS_RE" || true
