import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  PageSection,
  Title,
} from '@patternfly/react-core';
import { TENANTS_LIST_PATH } from '../tenantRoutes';
import TenantsHelpContent from './TenantsHelpContent';

/** Full-page tenant overview — linked from the list page (no separate nav item). */
const TenantsHelpPage: React.FC = () => (
  <>
    <PageSection type="breadcrumb">
      <Breadcrumb>
        <BreadcrumbItem>
          <Link to={TENANTS_LIST_PATH}>Tenants</Link>
        </BreadcrumbItem>
        <BreadcrumbItem isActive>How tenants work</BreadcrumbItem>
      </Breadcrumb>
    </PageSection>
    <PageSection>
      <Title headingLevel="h1" style={{ marginBottom: '1rem' }}>
        How tenants work
      </Title>
      <TenantsHelpContent />
    </PageSection>
  </>
);

export default TenantsHelpPage;
