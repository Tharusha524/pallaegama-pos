import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrganization } from '../api/OrganizationSettings/organizationSettingsApi';
import { resolveLogoSrc } from './logoUrl';

export function useCurrentOrganization() {
  const { data } = useQuery({
    queryKey: ['organization'],
    queryFn: getOrganization,
  });

  const logoEntry = Array.isArray(data?.logoUrl) ? data.logoUrl[0] : data?.logoUrl;
  const logoUrl = resolveLogoSrc(
    logoEntry && typeof logoEntry === "object"
      ? (logoEntry as { imageUrl?: string }).imageUrl
      : typeof logoEntry === "string"
        ? logoEntry
        : undefined
  );

  return {
    organizationName: data?.organizationName ?? 'Grow Ledger',
    organizationLogo: logoUrl,
  };
}

export function OrganizationHeadSetter() {
  const { organizationName, organizationLogo } = useCurrentOrganization();
  
  useEffect(() => {
    document.title = organizationName;
    if (organizationLogo) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = organizationLogo;
    }
  }, [organizationName, organizationLogo]);
  
  return null;
}

