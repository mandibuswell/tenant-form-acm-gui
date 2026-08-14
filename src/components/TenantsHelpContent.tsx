import * as React from 'react';
import { Link } from 'react-router-dom';
import { Content, ContentVariants, List, ListItem, Title } from '@patternfly/react-core';
import { TENANTS_CREATE_PATH } from '../tenantRoutes';

/** High-level tenant overview body — used by the Help page. */
const TenantsHelpContent: React.FC = () => (
  <div>
    <Content component={ContentVariants.p}>
      A tenant is an isolated customer or team boundary. You define it once as a Tenant resource
      on the Fleet Management console (aka Hub). Governance policies then create matching namespaces, access, quotas, and
      networking on the clusters that tenant is allowed to use. The tenant configuration is stored as a Custom Resource Definition or (CRD) on the hub.

    </Content>

    <Title headingLevel="h3" size="md" style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
      What happens when you create one
    </Title>
    <List>
      <ListItem>
        You submit the Create tenant form (or apply a Tenant CRD manifest). The Tenant lives in the{' '}
        <strong>tenancies</strong> namespace on the hub.
      </ListItem>
      <ListItem>
        ACM policies watch Tenants created on the hub and provision the tenants on any applicable clusters:
        namespace, RBAC groups, resource limits, and network boundaries.
      </ListItem>
      <ListItem>
        Each tenant has a workload profile; this determines the type of workloads that can be
        deployed to the tenant. Each cluster has a tenant capability label that determines the
        type of tenants that can be deployed to the cluster.
      </ListItem>
      <ListItem>
        Optional console SSO registers a Keycloak realm and OpenShift login IdP when you enable
        identity on the form.
      </ListItem>
      <ListItem>
        For tenants with VM workload profiles, a starter virtual machine can be seeded automatically so the
        tenant has something to open on day one.
      </ListItem>
    </List>

    <Title headingLevel="h3" size="md" style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
      Workload profiles
    </Title>
    <List>
      <ListItem>
        <strong>VMs</strong> — virtualization quotas and console access (default for most demos).
      </ListItem>
      <ListItem>
        <strong>Containers</strong> — container workloads only.
      </ListItem>
      <ListItem>
        <strong>Containers + VMs</strong> — both workloads are supported.
      </ListItem>
      <ListItem>
        <strong>Clusters (CaaS)</strong> — this tenant will host their own clusters of OpenShift. This may be used for full providing full OpenShift-as-a-Service, or AI-aaS platform services.
      </ListItem>
    </List>

    <Title headingLevel="h3" size="md" style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
      How isolation is enforced
    </Title>
    <List>
      <ListItem>
        <strong>Namespace</strong> — dedicated workload namespace on target clusters (defaults to
        the tenant name).
      </ListItem>
      <ListItem>
        <strong>Access</strong> — admin, user, and viewer groups map to fixed role tiers.
      </ListItem>
      <ListItem>
        <strong>Capacity</strong> — ResourceQuota, LimitRange, and VM-aware quotas cap usage.
      </ListItem>
      <ListItem>
        <strong>Network</strong> — a primary user-defined network separates tenant traffic;
        optional MetalLB covers external addressing.
      </ListItem>
    </List>

    <Title headingLevel="h3" size="md" style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
      Who uses which console
    </Title>
    <Content component={ContentVariants.p}>
      Platform operators stay in Fleet Management (this Tenants view) to create and edit tenants.
      Tenant users typically land in a scoped perspective such as VMaaS or Developer, depending on
      workload profile — not the full fleet admin experience.
    </Content>
    <Content component={ContentVariants.p} style={{ marginTop: '0.75rem' }}>
      Ready to onboard? <Link to={TENANTS_CREATE_PATH}>Create a tenant</Link>.
    </Content>
  </div>
);

export default TenantsHelpContent;
