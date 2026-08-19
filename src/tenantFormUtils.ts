import { k8sCreate, k8sGet, k8sUpdate } from '@openshift-console/dynamic-plugin-sdk';
import {
  DEFAULT_MY_ASN,
  DEFAULT_NAMESPACE,
  DEFAULT_UDN_SUBNET,
  IdentityForm,
  MetallbForm,
  SeedStarterVmForm,
  ClusterAsAServiceForm,
  TenantFormMode,
  TenantResource,
  TenantSpecForm,
  WorkloadProfile,
} from './tenantFormTypes';

export const SecretModel = {
  apiVersion: 'v1',
  kind: 'Secret',
  plural: 'secrets',
  namespaced: true,
  abbr: 'SEC',
  label: 'Secret',
  labelPlural: 'Secrets',
};

/**
 * Spoke + hub quota defaults keyed by workload profile (form create / profile switch).
 *
 * TODO(https://github.com/mandibuswell/tenant-form-acm-gui/issues/8): Load these from
 * operator config (ConfigMap / Helm values) so platform admins can set hub + VM defaults
 * per profile without rebuilding the plugin.
 */
export const PROFILE_QUOTA_DEFAULTS: Record<
  WorkloadProfile,
  {
    resourceQuota: TenantSpecForm['resourceQuota'];
    vmQuota: TenantSpecForm['vmQuota'];
    limitRange: TenantSpecForm['limitRange'];
    hubCpu: string;
    hubMemory: string;
    hubPods: string;
  }
> = {
  vms: {
    resourceQuota: { cpu: '86', memory: '332Gi', pods: '15', storage: '2000Gi' },
    vmQuota: { cpu: '80', memory: '320Gi' },
    limitRange: { maxCpu: '32', maxMemory: '128Gi', maxStorage: '1Ti' },
    // Hub HCP defaults (used when switching to clusters) — sized for one HA HCP
    hubCpu: '12',
    hubMemory: '32Gi',
    hubPods: '150',
  },
  containers: {
    resourceQuota: { cpu: '86', memory: '332Gi', pods: '15', storage: '2000Gi' },
    vmQuota: { cpu: '', memory: '' },
    limitRange: { maxCpu: '32', maxMemory: '128Gi', maxStorage: '1Ti' },
    hubCpu: '12',
    hubMemory: '32Gi',
    hubPods: '150',
  },
  both: {
    resourceQuota: { cpu: '86', memory: '332Gi', pods: '15', storage: '2000Gi' },
    vmQuota: { cpu: '80', memory: '320Gi' },
    limitRange: { maxCpu: '32', maxMemory: '128Gi', maxStorage: '1Ti' },
    hubCpu: '12',
    hubMemory: '32Gi',
    hubPods: '150',
  },
  // CaaS: hub HCP quota only (one HA HCP); spoke/VM constraints optional (blank until set)
  clusters: {
    resourceQuota: { cpu: '', memory: '', pods: '', storage: '' },
    vmQuota: { cpu: '', memory: '' },
    limitRange: { maxCpu: '', maxMemory: '', maxStorage: '' },
    hubCpu: '12',
    hubMemory: '32Gi',
    hubPods: '150',
  },
};

/** Apply profile quota defaults when the administrator changes Workload profile. */
export function applyWorkloadProfileQuotaDefaults(
  prev: TenantSpecForm,
  profile: WorkloadProfile,
): TenantSpecForm {
  const d = PROFILE_QUOTA_DEFAULTS[profile];
  return {
    ...prev,
    workloadProfile: profile,
    resourceQuota: { ...d.resourceQuota },
    vmQuota: { ...d.vmQuota },
    limitRange: { ...d.limitRange },
    seedStarterVm: {
      ...prev.seedStarterVm,
      enabled: profile === 'vms' || profile === 'both',
    },
    // CaaS: no hub console IdP at create — guest SSO is an edit-after step.
    identity: {
      ...prev.identity,
      enabled: profile === 'clusters' ? false : prev.identity.enabled,
    },
    clusterAsAService: {
      ...prev.clusterAsAService,
      hubCpu: prev.clusterAsAService.hubCpu.trim() || d.hubCpu,
      hubMemory: prev.clusterAsAService.hubMemory.trim() || d.hubMemory,
      hubPods: prev.clusterAsAService.hubPods.trim() || d.hubPods,
    },
  };
}

/** Keep only non-empty string fields; omit the object when nothing is set. */
const compactStringFields = <T extends Record<string, string>>(
  obj: T,
): Record<string, string> | undefined => {
  const out: Record<string, string> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v.trim()) out[k] = v.trim();
  });
  return Object.keys(out).length ? out : undefined;
};

export const defaultTenantSpec = (): TenantSpecForm => {
  const d = PROFILE_QUOTA_DEFAULTS.vms;
  return {
    displayName: '',
    owner: '',
    workloadNamespace: '',
    workloadProfile: 'vms',
    adminGroup: '',
    userGroup: '',
    viewerGroup: '',
    resourceQuota: { ...d.resourceQuota },
    vmQuota: { ...d.vmQuota },
    limitRange: { ...d.limitRange },
    network: {
      udnSubnet: DEFAULT_UDN_SUBNET,
      metallb: { myASN: DEFAULT_MY_ASN, peerASN: '', peerAddress: '', vrf: '', addresses: [] },
    },
    seedStarterVm: {
      enabled: true,
      mode: 'all',
      cluster: '',
      zones: [],
      clusters: [],
      vmName: '',
    },
    clusterAsAService: {
      hcpNamespace: '',
      hubCpu: d.hubCpu,
      hubMemory: d.hubMemory,
      hubPods: d.hubPods,
    },
    identity: {
      enabled: false,
      provider: 'keycloak',
      clientSecret: '',
      consoleLoginName: '',
      oidcIssuer: '',
      keycloakNamespace: 'keycloak-system',
      keycloakInstance: 'main',
      manageRealm: false,
      seedUsers: false,
      seedPassword: 'password',
      requirePasswordChange: false,
    },
  };
};

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

export const specField = str;

const parseMetallb = (raw: Record<string, unknown> | undefined): MetallbForm => {
  if (!raw) {
    return defaultTenantSpec().network.metallb;
  }
  const addresses = Array.isArray(raw.addresses)
    ? raw.addresses.map((a) => str(a)).filter(Boolean)
    : [];
  return {
    myASN: raw.myASN !== undefined ? str(raw.myASN) : DEFAULT_MY_ASN,
    peerASN: raw.peerASN !== undefined ? str(raw.peerASN) : '',
    peerAddress: str(raw.peerAddress),
    vrf: str(raw.vrf),
    addresses: addresses.length ? addresses : [''],
  };
};

const parseIdentity = (raw: Record<string, unknown> | undefined): IdentityForm => {
  const base = defaultTenantSpec().identity;
  if (!raw?.enabled) {
    return { ...base, enabled: false, clientSecret: '' };
  }
  const keycloak = (raw.keycloak ?? {}) as Record<string, unknown>;
  const oidc = (raw.oidc ?? {}) as Record<string, unknown>;
  return {
    enabled: true,
    provider: raw.provider === 'oidc' ? 'oidc' : 'keycloak',
    clientSecret: '',
    consoleLoginName: str(raw.consoleLoginName),
    oidcIssuer: str(oidc.issuer),
    keycloakNamespace: str(keycloak.namespace) || 'keycloak-system',
    keycloakInstance: str(keycloak.instanceName) || 'main',
    manageRealm: Boolean(keycloak.manageRealm),
    seedUsers: Boolean(keycloak.seedUsers),
    seedPassword: str(keycloak.seedPassword) || 'password',
    requirePasswordChange: Boolean(keycloak.requirePasswordChange),
  };
};

const parseSeedStarterVm = (
  raw: Record<string, unknown> | undefined,
  workloadProfile: WorkloadProfile,
): SeedStarterVmForm => {
  const wantsVm = workloadProfile === 'vms' || workloadProfile === 'both';
  const base = defaultTenantSpec().seedStarterVm;
  if (!raw) {
    return { ...base, enabled: wantsVm };
  }
  // Explicit false opts out; omit / true keeps default-on for VM profiles
  const enabled = raw.enabled === false ? false : wantsVm ? true : Boolean(raw.enabled);
  const modeRaw = str(raw.mode);
  const mode =
    modeRaw === 'all' || modeRaw === 'selected' || modeRaw === 'single' ? modeRaw : 'single';
  const zones = Array.isArray(raw.zones)
    ? raw.zones.map((z) => str(z)).filter(Boolean)
    : [];
  const clusters = Array.isArray(raw.clusters)
    ? raw.clusters.map((c) => str(c)).filter(Boolean)
    : [];
  return {
    enabled,
    mode,
    cluster: str(raw.cluster),
    zones,
    clusters,
    vmName: str(raw.vmName),
  };
};

const parseClusterAsAService = (
  raw: Record<string, unknown> | undefined,
): ClusterAsAServiceForm => {
  const base = defaultTenantSpec().clusterAsAService;
  if (!raw) {
    return { ...base };
  }
  const hubRq = (raw.hubResourceQuota ?? {}) as Record<string, unknown>;
  return {
    hcpNamespace: str(raw.hcpNamespace),
    hubCpu: str(hubRq.cpu) || base.hubCpu,
    hubMemory: str(hubRq.memory) || base.hubMemory,
    hubPods: str(hubRq.pods) || base.hubPods,
  };
};

/** Map a Tenant CR from the API into form state. */
export function parseTenantResource(tenant: TenantResource): {
  name: string;
  namespace: string;
  spec: TenantSpecForm;
  originalWorkloadProfile: WorkloadProfile;
  originalIdentityEnabled: boolean;
} {
  const name = tenant.metadata.name;
  const namespace = tenant.metadata.namespace || DEFAULT_NAMESPACE;
  const s = tenant.spec ?? {};
  const network = (s.network ?? {}) as Record<string, unknown>;
  const workloadProfile = (s.workloadProfile as WorkloadProfile) || 'vms';
  const workloadNs = str(s.workloadNamespace);
  const rq = (s.resourceQuota ?? {}) as Record<string, string>;
  const vmq = (s.vmQuota ?? {}) as Record<string, string>;
  const lr = (s.limitRange ?? {}) as Record<string, string>;
  const qd = PROFILE_QUOTA_DEFAULTS[workloadProfile];

  const spec: TenantSpecForm = {
    displayName: str(s.displayName),
    owner: str(s.owner),
    workloadNamespace: workloadNs && workloadNs !== name ? workloadNs : '',
    workloadProfile,
    adminGroup: str(s.adminGroup),
    userGroup: str(s.userGroup),
    viewerGroup: str(s.viewerGroup),
    // Prefer values on the CR; fall back to profile defaults (blank for CaaS)
    resourceQuota: {
      cpu: rq.cpu !== undefined ? str(rq.cpu) : qd.resourceQuota.cpu,
      memory: rq.memory !== undefined ? str(rq.memory) : qd.resourceQuota.memory,
      pods: rq.pods !== undefined ? str(rq.pods) : qd.resourceQuota.pods,
      storage: rq.storage !== undefined ? str(rq.storage) : qd.resourceQuota.storage,
    },
    vmQuota: {
      cpu: vmq.cpu !== undefined ? str(vmq.cpu) : qd.vmQuota.cpu,
      memory: vmq.memory !== undefined ? str(vmq.memory) : qd.vmQuota.memory,
    },
    limitRange: {
      maxCpu: lr.maxCpu !== undefined ? str(lr.maxCpu) : qd.limitRange.maxCpu,
      maxMemory: lr.maxMemory !== undefined ? str(lr.maxMemory) : qd.limitRange.maxMemory,
      maxStorage: lr.maxStorage !== undefined ? str(lr.maxStorage) : qd.limitRange.maxStorage,
    },
    network: {
      udnSubnet: str(network.udnSubnet) || DEFAULT_UDN_SUBNET,
      metallb: parseMetallb(network.metallb as Record<string, unknown>),
    },
    seedStarterVm: parseSeedStarterVm(
      s.seedStarterVm as Record<string, unknown> | undefined,
      workloadProfile,
    ),
    clusterAsAService: parseClusterAsAService(
      s.clusterAsAService as Record<string, unknown> | undefined,
    ),
    identity: parseIdentity(s.identity as Record<string, unknown>),
  };

  return {
    name,
    namespace,
    spec,
    originalWorkloadProfile: workloadProfile,
    originalIdentityEnabled: spec.identity.enabled,
  };
}

/** Resolve immutable tenant identity from form state, parsed initial, or loaded CR. */
export function resolveTenantIdentity(params: {
  name: string;
  namespace: string;
  spec: TenantSpecForm;
  existing?: TenantResource;
  initial?: { name?: string; namespace?: string };
}): {
  tenantName: string;
  tenantNamespace: string;
  workloadNamespace: string;
} {
  const tenantName =
    params.name.trim() ||
    params.initial?.name?.trim() ||
    params.existing?.metadata?.name?.trim() ||
    '';
  const tenantNamespace =
    DEFAULT_NAMESPACE;
  const specWorkload = params.spec.workloadNamespace.trim();
  const existingWorkload = str(params.existing?.spec?.workloadNamespace);
  const workloadNamespace =
    specWorkload || (existingWorkload && existingWorkload !== tenantName ? existingWorkload : tenantName);
  return { tenantName, tenantNamespace, workloadNamespace };
}

export function derivedGroups(name: string) {
  const n = name.trim();
  return {
    admin: n ? `${n}-tenant-admin` : '',
    user: n ? `${n}-tenant-user` : '',
    viewer: n ? `${n}-tenant-viewer` : '',
    vrf: n ? `${n}-vrf` : '',
  };
}

export function validateTenantForm(params: {
  mode: TenantFormMode;
  name: string;
  effectiveAdminGroup: string;
  effectiveUserGroup: string;
  spec: TenantSpecForm;
  identitySecretUnchanged: boolean;
  existing?: TenantResource;
}): string[] {
  const {
    mode,
    name,
    effectiveAdminGroup,
    effectiveUserGroup,
    spec,
    identitySecretUnchanged,
    existing,
  } = params;
  const resolvedName = name.trim() || existing?.metadata?.name?.trim() || '';
  const resolvedAdmin =
    effectiveAdminGroup.trim() || str(existing?.spec?.adminGroup) || '';
  const resolvedUser = effectiveUserGroup.trim() || str(existing?.spec?.userGroup) || '';
  const errs: string[] = [];
  if (!resolvedName) errs.push('Tenant name is required.');
  if (!resolvedAdmin) errs.push('Admin Group is required.');
  if (!resolvedUser) errs.push('User Group is required.');
  if (
    (spec.workloadProfile === 'vms' || spec.workloadProfile === 'both') &&
    spec.seedStarterVm.enabled &&
    spec.seedStarterVm.mode === 'selected' &&
    !spec.seedStarterVm.zones.some((z) => z.trim()) &&
    !spec.seedStarterVm.clusters.some((c) => c.trim())
  ) {
    errs.push('Select at least one zone or cluster for starter VM seeding.');
  }
  if (spec.identity.enabled && spec.workloadProfile !== 'clusters') {
    const secretRequired =
      mode === 'create' || (mode === 'edit' && !identitySecretUnchanged);
    if (secretRequired && !spec.identity.clientSecret.trim()) {
      errs.push('Client secret is required when console SSO is enabled.');
    }
    if (spec.identity.provider === 'oidc' && !spec.identity.oidcIssuer.trim()) {
      errs.push('Issuer URL is required for external OIDC.');
    }
  }
  return errs;
}

export function buildTenantResource(params: {
  name: string;
  namespace: string;
  spec: TenantSpecForm;
  effectiveAdminGroup: string;
  effectiveUserGroup: string;
  effectiveViewerGroup: string;
  effectiveVrf: string;
  existing?: TenantResource;
}): Record<string, unknown> {
  const {
    name,
    namespace,
    spec,
    effectiveAdminGroup,
    effectiveUserGroup,
    effectiveViewerGroup,
    effectiveVrf,
    existing,
  } = params;
  const tenantName =
    name.trim() || existing?.metadata?.name?.trim() || '';
  const tenantNamespace =
    namespace.trim() || existing?.metadata?.namespace?.trim() || DEFAULT_NAMESPACE;

  const tenant: Record<string, unknown> = {
    apiVersion: 'dusty-seahorse.io/v1alpha1',
    kind: 'Tenant',
    metadata: {
      ...(existing?.metadata ?? {}),
      name: tenantName,
      namespace: tenantNamespace,
      labels: { ...(existing?.metadata?.labels ?? {}), tenant: tenantName },
    },
    spec: {
      adminGroup: effectiveAdminGroup,
      userGroup: effectiveUserGroup,
      viewerGroup: effectiveViewerGroup,
      workloadProfile: spec.workloadProfile,
    },
  };

  const tenantSpec = tenant.spec as Record<string, unknown>;
  const resourceQuota = compactStringFields(spec.resourceQuota);
  if (resourceQuota) tenantSpec.resourceQuota = resourceQuota;
  const vmQuota = compactStringFields(spec.vmQuota);
  if (vmQuota) tenantSpec.vmQuota = vmQuota;
  const limitRange = compactStringFields(spec.limitRange);
  if (limitRange) tenantSpec.limitRange = limitRange;

  if (spec.displayName.trim()) {
    tenantSpec.displayName = spec.displayName.trim();
  }
  if (spec.owner.trim()) {
    tenantSpec.owner = spec.owner.trim();
  }
  if (spec.workloadNamespace.trim() && spec.workloadNamespace.trim() !== tenantName) {
    tenantSpec.workloadNamespace = spec.workloadNamespace.trim();
  }

  const network: Record<string, unknown> = {};
  network.udnSubnet = spec.network.udnSubnet.trim() || DEFAULT_UDN_SUBNET;
  const mb = spec.network.metallb;
  const hasMetallb =
    mb.peerASN || mb.peerAddress || effectiveVrf || mb.addresses.some((a) => a.trim());
  if (hasMetallb) {
    const metallb: Record<string, unknown> = {
      myASN: parseInt(mb.myASN, 10) || parseInt(DEFAULT_MY_ASN, 10),
    };
    if (mb.peerASN) metallb.peerASN = parseInt(mb.peerASN, 10);
    if (mb.peerAddress.trim()) metallb.peerAddress = mb.peerAddress.trim();
    metallb.vrf = effectiveVrf;
    const filteredAddrs = mb.addresses.map((a) => a.trim()).filter(Boolean);
    if (filteredAddrs.length) metallb.addresses = filteredAddrs;
    network.metallb = metallb;
  }
  if (Object.keys(network).length) {
    (tenant.spec as Record<string, unknown>).network = network;
  }

  const wantsVmProfile =
    spec.workloadProfile === 'vms' || spec.workloadProfile === 'both';
  if (wantsVmProfile) {
    const seed: Record<string, unknown> = {
      enabled: spec.seedStarterVm.enabled,
      mode: spec.seedStarterVm.mode,
    };
    if (spec.seedStarterVm.mode === 'single' && spec.seedStarterVm.cluster.trim()) {
      seed.cluster = spec.seedStarterVm.cluster.trim();
    }
    if (spec.seedStarterVm.mode === 'selected') {
      const zones = spec.seedStarterVm.zones.map((z) => z.trim()).filter(Boolean);
      const clusters = spec.seedStarterVm.clusters.map((c) => c.trim()).filter(Boolean);
      if (zones.length) seed.zones = zones;
      if (clusters.length) seed.clusters = clusters;
    }
    if (spec.seedStarterVm.vmName.trim()) {
      seed.vmName = spec.seedStarterVm.vmName.trim();
    }
    (tenant.spec as Record<string, unknown>).seedStarterVm = seed;
  } else if (existing?.spec?.seedStarterVm) {
    (tenant.spec as Record<string, unknown>).seedStarterVm = { enabled: false };
  }

  if (spec.workloadProfile === 'clusters') {
    const hub = PROFILE_QUOTA_DEFAULTS.clusters;
    const caas: Record<string, unknown> = {
      hubResourceQuota: {
        cpu: spec.clusterAsAService.hubCpu.trim() || hub.hubCpu,
        memory: spec.clusterAsAService.hubMemory.trim() || hub.hubMemory,
        pods: spec.clusterAsAService.hubPods.trim() || hub.hubPods,
      },
    };
    // Control plane namespace is fixed as {tenant}-hcp (policy default); not form-overridable.
    tenantSpec.clusterAsAService = caas;
  }

  // CaaS tenants never register a hub oauth/cluster IdP; guest SSO is edit-after.
  const hubIdentityEnabled =
    spec.identity.enabled && spec.workloadProfile !== 'clusters';

  if (hubIdentityEnabled) {
    const idpName = spec.identity.consoleLoginName.trim() || `${tenantName}-idp`;
    const identity: Record<string, unknown> = {
      enabled: true,
      provider: spec.identity.provider,
      consoleLoginName: idpName,
      clientId: `openshift-${tenantName}`,
      clientSecretRef: {
        name: `${tenantName}-client-secret`,
        namespace: 'openshift-config',
      },
    };
    if (spec.identity.provider === 'keycloak') {
      identity.keycloak = {
        namespace: spec.identity.keycloakNamespace.trim() || 'keycloak-system',
        instanceName: spec.identity.keycloakInstance.trim() || 'main',
        realm: tenantName,
        manageRealm: spec.identity.manageRealm,
        // Match pre-mounted themes/<tenant>.css from apply-themes --no-tenant
        loginTheme: tenantName,
      };
      if (spec.identity.manageRealm && spec.identity.seedUsers) {
        (identity.keycloak as Record<string, unknown>).seedUsers = true;
        (identity.keycloak as Record<string, unknown>).seedPassword =
          spec.identity.seedPassword.trim() || 'password';
        if (spec.identity.requirePasswordChange) {
          (identity.keycloak as Record<string, unknown>).requirePasswordChange = true;
        }
      }
    } else {
      identity.oidc = { issuer: spec.identity.oidcIssuer.trim() };
    }
    (tenant.spec as Record<string, unknown>).identity = identity;
  } else if (existing?.spec?.identity) {
    const prev = existing.spec.identity as Record<string, unknown>;
    const prevKeycloak = (prev.keycloak ?? {}) as Record<string, unknown>;
    (tenant.spec as Record<string, unknown>).identity = {
      enabled: false,
      ...(prev.clientSecretRef ? { clientSecretRef: prev.clientSecretRef } : {}),
      ...(prevKeycloak.manageRealm
        ? {
            keycloak: {
              namespace: str(prevKeycloak.namespace) || 'keycloak-system',
              instanceName: str(prevKeycloak.instanceName) || 'main',
              realm: str(prevKeycloak.realm) || tenantName,
              manageRealm: true,
              loginTheme: str(prevKeycloak.loginTheme) || tenantName,
            },
          }
        : {}),
    };
  }

  return tenant;
}

export async function upsertClientSecret(tenantName: string, secret: string): Promise<void> {
  const secretName = `${tenantName}-client-secret`;
  const secretNs = 'openshift-config';
  const payload = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: secretName, namespace: secretNs, labels: { tenant: tenantName } },
    type: 'Opaque',
    stringData: { clientSecret: secret },
  };
  try {
    await k8sCreate({ model: SecretModel, data: payload });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('AlreadyExists') && !msg.includes('409')) {
      if (msg.includes('Forbidden') || msg.includes('403')) {
        throw new Error(
          'Cannot create client secret in openshift-config — cluster-admin (or equivalent) is required for console SSO.',
        );
      }
      throw err;
    }
    const existing = await k8sGet({ model: SecretModel, name: secretName, ns: secretNs });
    await k8sUpdate({
      model: SecretModel,
      name: secretName,
      ns: secretNs,
      data: { ...existing, stringData: { clientSecret: secret } },
    });
  }
}

export function shouldExpandNetwork(spec: TenantSpecForm): boolean {
  const mb = spec.network.metallb;
  return Boolean(
    spec.network.udnSubnet.trim() ||
      mb.peerAddress.trim() ||
      mb.peerASN ||
      mb.vrf.trim() ||
      mb.addresses.some((a) => a.trim()),
  );
}

/** Generate a URL-safe random OIDC client secret (base64url, 32 chars). */
export function generateClientSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}
