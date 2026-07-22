export const DEFAULT_NAMESPACE = 'tenancies';
export const DEFAULT_MY_ASN = '64500';
/** Shared default UDN CIDR — overridable per tenant; overlap across tenants is valid (isolated UDNs). */
export const DEFAULT_UDN_SUBNET = '10.128.0.0/16';

export interface MetallbForm {
  myASN: string;
  peerASN: string;
  peerAddress: string;
  vrf: string;
  addresses: string[];
}

export interface IdentityForm {
  enabled: boolean;
  provider: 'keycloak' | 'oidc';
  clientSecret: string;
  consoleLoginName: string;
  oidcIssuer: string;
  keycloakNamespace: string;
  keycloakInstance: string;
  manageRealm: boolean;
  seedUsers: boolean;
  seedPassword: string;
  requirePasswordChange: boolean;
}

export type WorkloadProfile = 'vms' | 'containers' | 'both' | 'clusters';

export interface SeedStarterVmForm {
  /** Default true for vms/both — set false to opt out */
  enabled: boolean;
  cluster: string;
  vmName: string;
}

export interface ClusterAsAServiceForm {
  hcpNamespace: string;
  hubCpu: string;
  hubMemory: string;
  hubPods: string;
}

export interface TenantSpecForm {
  displayName: string;
  owner: string;
  workloadNamespace: string;
  workloadProfile: WorkloadProfile;
  adminGroup: string;
  userGroup: string;
  viewerGroup: string;
  resourceQuota: { cpu: string; memory: string; pods: string; storage: string };
  vmQuota: { cpu: string; memory: string };
  limitRange: { maxCpu: string; maxMemory: string; maxStorage: string };
  network: { udnSubnet: string; metallb: MetallbForm };
  seedStarterVm: SeedStarterVmForm;
  clusterAsAService: ClusterAsAServiceForm;
  identity: IdentityForm;
}

export interface TenantResource {
  apiVersion?: string;
  kind?: string;
  metadata: {
    name: string;
    namespace: string;
    uid?: string;
    resourceVersion?: string;
    labels?: Record<string, string>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: Record<string, any>;
}

export type TenantFormMode = 'create' | 'edit';
