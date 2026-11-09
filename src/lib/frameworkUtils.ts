export const STANDARD_NAMES = [
  'ISO 27001',
  'SOC 2',
  'NIST CSF',
  'NIST 800-53',
  'PCI DSS',
  'GDPR',
  'HIPAA',
  'DPDPA',
  'CERT-In',
  'RBI CSF',
  'SEBI CSCRF',
  'DPDP',
];

export function isStandardFramework(name?: string): boolean {
  const n = (name ?? '').toLowerCase();
  return STANDARD_NAMES.some((s) => n.includes(s.toLowerCase()));
}

export const CATEGORIES = [
  'Compliance',
  'Risk',
  'Audit',
  'Security',
  'Privacy',
  'Vendor Management',
  'Business Continuity',
  'Custom',
];
