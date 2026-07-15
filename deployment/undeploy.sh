#!/usr/bin/env bash
set -euo pipefail

echo "==> Removing tenant-form-acm-gui plugin"
echo ""

if ! oc whoami &>/dev/null; then
  echo "ERROR: Not logged in to an OpenShift cluster. Run 'oc login' first."
  exit 1
fi

# 1. Remove only this plugin from the console operator (preserve other plugins)
echo "==> [1/4] Disabling plugin in the console..."
PLUGIN_NAME="tenant-form-acm-gui"
plugins_json="$(oc get console.operator cluster -o jsonpath='{.spec.plugins}' 2>/dev/null || echo '[]')"
idx="$(python3 - <<PY
import json
plugins = json.loads('''${plugins_json}''')
name = "${PLUGIN_NAME}"
print(next((i for i, p in enumerate(plugins) if p == name), -1))
PY
)"
if [ "${idx}" -ge 0 ]; then
  oc patch console.operator cluster --type=json \
    -p="[{\"op\":\"remove\",\"path\":\"/spec/plugins/${idx}\"}]"
else
  echo "    Plugin was not in the console plugins list (skipped)"
fi

# 2. Delete the ConsolePlugin CR
echo "==> [2/4] Deleting ConsolePlugin..."
oc delete consoleplugin tenant-form-acm-gui --ignore-not-found

# 3. Delete the namespace (takes the Deployment + Service with it)
echo "==> [3/4] Deleting namespace..."
oc delete namespace tenant-form-acm-gui --ignore-not-found

# 4. Optionally remove the CRD
echo ""
read -rp "==> [4/4] Delete the Tenant CRD? This removes ALL Tenant resources. [y/N] " REPLY
if [[ "${REPLY}" =~ ^[Yy]$ ]]; then
  oc delete -f "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/01-tenant-crd.yaml" --ignore-not-found
  echo "    CRD deleted."
else
  echo "    CRD kept."
fi

echo ""
echo "==> Uninstall complete."
