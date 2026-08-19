import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';

export const TenantModel: K8sModel = {
  apiGroup: 'dusty-seahorse.io',
  apiVersion: 'v1alpha1',
  kind: 'Tenant',
  plural: 'tenants',
  abbr: 'TN',
  namespaced: true,
  label: 'Tenant',
  labelPlural: 'Tenants',
};

export const ManagedClusterModel: K8sModel = {
  apiGroup: 'cluster.open-cluster-management.io',
  apiVersion: 'v1',
  kind: 'ManagedCluster',
  plural: 'managedclusters',
  abbr: 'MC',
  namespaced: false,
  label: 'Managed Cluster',
  labelPlural: 'Managed Clusters',
};
