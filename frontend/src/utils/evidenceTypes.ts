export interface EvidenceTypeOption {
  value: string;
  label: string;
}

export const AUTHORITATIVE_EVIDENCE_TYPES: EvidenceTypeOption[] = [
  { value: 'FIR_REPORT', label: 'First Information Report (FIR)' },
  { value: 'CHARGE_SHEET', label: 'Charge Sheet / Indictment' },
  { value: 'WITNESS_STATEMENT', label: 'Witness Statement' },
  { value: 'FORENSIC_REPORT', label: 'Forensic Analysis / Cyber Audit' },
  { value: 'INSPECTION_REPORT', label: 'Site Inspection Report' },
  { value: 'EVIDENCE_LOG', label: 'Physical / Digital Evidence Log' },
  { value: 'SEIZURE_MEMO', label: 'Seizure Memo / Search Record' },
  { value: 'OTHER', label: 'Other Evidence Document' },
];

export function getEvidenceTypeLabel(typeValue: string): string {
  if (!typeValue) return 'Unspecified Evidence Type';
  const match = AUTHORITATIVE_EVIDENCE_TYPES.find(
    (t) => t.value.toUpperCase() === typeValue.toUpperCase()
  );
  if (match) return match.label;
  // Return formatted custom legacy string safely
  return typeValue.replace(/_/g, ' ');
}
