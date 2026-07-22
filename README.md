# Tenant Management — OpenShift Console Plugin

An OpenShift Dynamic Console Plugin for **listing, creating, editing, and deleting**
`Tenant` custom resources (`tenants.dusty-seahorse.io`) from the ACM console.
The UI is PatternFly-based and drives ACM policy from Tenant CRs in the hub
`tenancies` namespace.

Operators can provision a tenant with a name and workload profile; RBAC groups,
control-plane namespaces, and similar values use smart defaults. Jump links and
progressive disclosure keep VMs, containers, and CaaS forms focused.

Companion policies live in
[tenancy-by-acm-policy](https://github.com/mandibuswell/tenancy-by-acm-policy).

## Prerequisites

| Requirement       | Version |
| ----------------- | ------- |
| OpenShift cluster | 4.14+   |
| ACM hub           | 2.9+    |
| `oc` CLI          | 4.14+   |
| Node.js           | 22+     |
| Podman or Docker  | optional (on-cluster build does not need local containers) |

The Tenant CRD must be installed before create/edit can succeed:

```bash
oc apply -f deployment/01-tenant-crd.yaml
# or: oc apply -f tenant-crd.yaml
```

## Console routes

After the plugin is enabled, **Fleet Management → Tenants** appears in the ACM
perspective.

| Path | Purpose |
| ---- | ------- |
| `/tenants` | Hub tenant list (search, create, profile-aware actions) |
| `/tenants/create` | Create Tenant form |
| `/tenants/edit/:name` | Edit Tenant (CR always in `tenancies`) |
| `/tenants/edit/:ns/:name` | Edit with explicit namespace (legacy shape) |

Legacy redirects still work: `/tenant-create`, `/tenant-edit/ns/:ns/:name`.

Hub vs fleet discovery:

| View | Scope | Editable here |
| ---- | ----- | ------------- |
| **Tenants** list | Hub `tenancies` | Yes |
| **Fleet-wide search** | All managed clusters (`kind:Tenant`) | No — read-only |

## Tenants list

Each row has an **Actions** menu shaped by **workload profile**:

| Profile | Actions |
| ------- | ------- |
| **VMs** | Edit, List VMs, Delete |
| **Containers** | Edit, List Workloads, Delete |
| **Both** | Edit, List VMs, List Workloads, Delete |
| **CaaS** | Edit, List CaaS, Delete |

- **List VMs** — ACM search: `VirtualMachine` in the tenant workload namespace (all clusters)
- **List CaaS** — managed clusters filtered by `tenant=<name>`
- **List Workloads** — ACM search for common workloads in the tenant namespace
- **Delete** — deletes the hub Tenant CR (policy cleanup follows; some hub RBAC/themes may need manual removal)

## Create / Edit form

Shared form (`TenantFormPage`) with jump links: **Basics**, **Capacity**,
**Identity**, **Networking** (when applicable), **Advanced**.

### Workload profiles

| Profile | What policies provision |
| ------- | ----------------------- |
| **VMs (Fleet Virtualization)** | Spoke VM placement (AAQ, KubeVirt RBAC), optional starter VM |
| **Containers** | Spoke ResourceQuota / LimitRange (no AAQ) |
| **Both** | VM + container policy sets |
| **Clusters (CaaS via Hosted Control Plane)** | Hub control-plane namespace `{tenant}-hcp` + hub ResourceQuota; no spoke VM quotas |

Narrowing a profile does **not** delete previously provisioned resources.
Widening adds resources on the next policy cycle on capable clusters.

### Form sections (by profile)

| Section | VMs / Both | Containers | CaaS |
| ------- | ---------- | ---------- | ---- |
| **Basics** | Name, display name, namespace for tenant resources, profile, owner | same | same |
| **Capacity** | ResourceQuota, VM quota, max VM size; optional starter VM | ResourceQuota + LimitRange | Hub control-plane CPU / memory / pods only (`{tenant}-hcp` is fixed) |
| **Identity** | Optional hub console SSO (Keycloak realm / seed users; External OIDC marked not yet supported) | same | Instruction only — configure guest SSO **after** the Hosted Cluster exists (no hub IdP at create) |
| **Networking** | UDN CIDR + MetalLB / BGP | same | Hidden |
| **Advanced** | Access group overrides; BGP advanced (when networking shown) | Access groups | Access groups |

Tenant CRs always live in **`tenancies`** (not form-editable). Workload namespace
defaults to the tenant name and is locked after create.

### Smart defaults

| Field | Default | Override |
| ----- | ------- | -------- |
| Tenant CR namespace | `tenancies` | — (fixed) |
| Namespace for tenant resources | `{tenant name}` | Basics (create only) |
| Admin / User / Viewer groups | `{name}-tenant-admin` / `-user` / `-viewer` | Advanced → Access Groups |
| UDN CIDR | `10.128.0.0/16` | Networking |
| VRF | `{name}-vrf` | Advanced → BGP |
| Cluster ASN | `64500` | Advanced → BGP |
| CaaS control-plane namespace | `{tenant}-hcp` | — (fixed; policy default) |
| CaaS hub quota | 12 CPU / 32Gi / 150 pods | Capacity (CaaS) |

Blank derived fields are filled at submit.

More edit behaviour notes: [`docs/EDIT-TENANT.md`](docs/EDIT-TENANT.md).

## Local development

```bash
npm install
npm start   # webpack-dev-server on port 9001
```

Proxy into a running OpenShift console with
[bridge](https://github.com/openshift/console):

```bash
./bin/bridge --plugins="tenant-form-acm-gui=http://localhost:9001"
```

Then open `https://localhost:9000/tenants`.

## Build

```bash
npm run build       # production → dist/
npm run build-dev   # unminified + source maps
```

## Cluster deployment

Manifests and scripts live under `deployment/`.

### On-cluster build (recommended for workshops / RHDP)

```bash
# Example with demo-setups SOCKS + kubeconfig:
cd demo-setups && ./bin/connect demo-4vs6v
export KUBECONFIG="$PWD/tmp/demo-4vs6v.kubeconfig"
export HTTPS_PROXY="socks5://localhost:9050"

cd ../tenant-form-acm-gui
./deployment/deploy-cluster-build.sh   # binary upload of local tree
# or: ./deployment/deploy-git-build.sh
```

| Script | Use when |
| ------ | -------- |
| `deploy-cluster-build.sh` | Local clone / uncommitted changes (`oc start-build --from-dir=.`) |
| `deploy-git-build.sh` | Build from a pushed GitHub ref |
| `deploy-local.sh` | Local Podman build → integrated registry |
| `deploy.sh` | Deploy a pre-built image (Quay or registry URL via `IMAGE=`) |
| `undeploy.sh` | Remove plugin + namespace (optional CRD delete) |

Git build overrides:

```bash
GIT_REPO=https://github.com/mandibuswell/tenant-form-acm-gui.git \
GIT_REF=main \
./deployment/deploy-git-build.sh
```

### Pre-built image

```bash
git clone https://github.com/mandibuswell/tenant-form-acm-gui.git
cd tenant-form-acm-gui
oc login https://<api-server>:6443 -u <user>
./deployment/deploy.sh
# or: IMAGE=quay.io/myorg/tenant-form-acm-gui:v1.2.0 ./deployment/deploy.sh
```

### What gets created

| File | Resources |
| ---- | --------- |
| `deployment/00-namespace.yaml` | Namespace `tenant-form-acm-gui` |
| `deployment/01-tenant-crd.yaml` | CRD `tenants.dusty-seahorse.io` |
| `deployment/02-deployment.yaml` | Deployment + Service (nginx TLS on 9443 via service-CA) |
| `deployment/03-consoleplugin.yaml` | ConsolePlugin registration |

### Verify

```bash
oc get builds,pods -n tenant-form-acm-gui
oc get consoleplugins tenant-form-acm-gui
```

Open **Fleet Management → Tenants** or `https://<console-url>/tenants`.
Hard-refresh if the console caches an old plugin bundle (~30–60s after rollout).

## Container image

```bash
./deployment/build.sh
# or: IMAGE=quay.io/myorg/tenant-form-acm-gui:v1.2.0 ./deployment/build.sh
```

Multi-stage UBI9 Node.js 22 → UBI9 nginx 1.20; `nginx.conf` serves HTTPS on
9443 for the console plugin proxy.

## Project layout

```
├── console-extensions.json   # ACM nav + routes (list / create / edit + legacy)
├── Dockerfile
├── nginx.conf
├── package.json              # consolePlugin exposed modules
├── tenant-crd.yaml           # CRD source (also under deployment/)
├── docs/
│   └── EDIT-TENANT.md
├── deployment/               # namespace, CRD, deploy scripts
└── src/
    ├── models.ts
    ├── tenantFormTypes.ts
    ├── tenantFormUtils.ts
    ├── tenantRoutes.ts
    ├── useTenantEditParams.ts
    └── components/
        ├── TenantsListPage.tsx
        ├── CreateTenantPage.tsx
        ├── EditTenantPage.tsx
        ├── TenantFormPage.tsx    # shared create/edit form
        ├── LegacyCreateRedirect.tsx
        └── LegacyEditRedirect.tsx
```

## License

Apache-2.0
