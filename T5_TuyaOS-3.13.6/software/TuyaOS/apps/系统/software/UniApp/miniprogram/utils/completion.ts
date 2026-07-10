import { resolvePublicUrl } from './media-url';

export type CompletionMedicationMode = '' | 'none' | 'has';

export interface CompletionMedicationItem {
  id?: string;
  name?: string;
  usage?: string;
  reminderTime?: string;
  startDate?: string;
  endDate?: string;
}

export interface CompletionFileItem {
  url: string;
  name: string;
}

export interface CompletionEvaluation {
  summaryReady: boolean;
  proofReady: boolean;
  medicationReady: boolean;
  ready: boolean;
  readyCount: number;
  proofCount: number;
  medicationMode: CompletionMedicationMode;
  images: string[];
  files: CompletionFileItem[];
  medications: CompletionMedicationItem[];
  missingItems: string[];
}

function decodeName(value?: string): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveCompletionAssetUrl(url?: string): string {
  return resolvePublicUrl(url);
}

export function getCompletionFileName(url?: string, name?: string): string {
  const fallback = name || (url ? String(url).split('?')[0].split('/').pop() || '附件' : '附件');
  return decodeName(fallback);
}

export function normalizeCompletionFiles(
  files: Array<string | { url?: string; path?: string; name?: string }> | undefined | null,
): CompletionFileItem[] {
  if (!Array.isArray(files)) return [];
  const seen = new Set<string>();
  return files
    .map((file) => {
      const url = typeof file === 'string'
        ? file
        : String(file?.url || file?.path || '');
      return {
        url,
        name: getCompletionFileName(url, typeof file === 'string' ? '' : file?.name),
      };
    })
    .filter((file) => {
      const key = file.url.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeCompletionMedications(value: any): CompletionMedicationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      id: item?.id ? String(item.id) : String(Date.now() + Math.random()),
      name: String(item?.name || '').trim(),
      usage: String(item?.usage || '').trim(),
      reminderTime: String(item?.reminderTime || ''),
      startDate: String(item?.startDate || ''),
      endDate: String(item?.endDate || ''),
    }))
    .filter((item) => item.name || item.usage || item.reminderTime || item.startDate || item.endDate);
}

export function isCompletionMedicationValid(item: CompletionMedicationItem): boolean {
  return !!(
    String(item?.name || '').trim() &&
    String(item?.usage || '').trim() &&
    String(item?.reminderTime || '').trim() &&
    String(item?.startDate || '').trim() &&
    String(item?.endDate || '').trim()
  );
}

export function evaluateCompletionData(raw: any): CompletionEvaluation {
  const summaryReady = !!String(raw?.summary || raw?.doctorAdvice || '').trim();
  const images = Array.isArray(raw?.images)
    ? raw.images
        .map((item: any) => String(item || '').trim())
        .filter(Boolean)
    : [];
  const files = normalizeCompletionFiles(raw?.files);
  const proofCount = images.length + files.length;
  const proofReady = proofCount > 0;
  const medications = normalizeCompletionMedications(raw?.medications);

  const medicationMode: CompletionMedicationMode =
    raw?.medicationMode === 'has' || raw?.medicationMode === 'none'
      ? raw.medicationMode
      : medications.length > 0
        ? 'has'
        : '';
  const medicationReady =
    medicationMode === 'none' ||
    (medicationMode === 'has' && medications.length > 0 && medications.every(isCompletionMedicationValid));

  const missingItems: string[] = [];
  if (!summaryReady) missingItems.push('服务总结');
  if (!proofReady) missingItems.push('报告单据凭证');
  if (!medicationReady) missingItems.push('用药提醒确认');

  const readyCount = [summaryReady, proofReady, medicationReady].filter(Boolean).length;

  return {
    summaryReady,
    proofReady,
    medicationReady,
    ready: summaryReady && proofReady && medicationReady,
    readyCount,
    proofCount,
    medicationMode,
    images,
    files,
    medications,
    missingItems,
  };
}
