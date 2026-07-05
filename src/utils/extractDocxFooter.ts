import AdmZip from 'adm-zip';

export interface DocxFooterAssets {
  footerImageBuffer: Buffer | null;
  footerImageMime: string | null;
  footerText: string;
}

/**
 * Pulls the "default" footer (the one Word actually renders on normal pages,
 * unless <w:titlePg/> is set) out of an uploaded .docx — image + text — so
 * it can be stored and reused at PDF-generation time. Mammoth deliberately
 * skips Word headers/footers, so this is the only way to keep the letterhead
 * footer without hand-coding it separately from the uploaded document.
 */
export function extractFooterAssets(docxBuffer: Buffer): DocxFooterAssets {
  const empty: DocxFooterAssets = { footerImageBuffer: null, footerImageMime: null, footerText: '' };
  const zip = new AdmZip(docxBuffer);

  const relsEntry = zip.getEntry('word/_rels/document.xml.rels');
  const documentEntry = zip.getEntry('word/document.xml');
  if (!relsEntry || !documentEntry) return empty;

  const relsXml = relsEntry.getData().toString('utf-8');
  const documentXml = documentEntry.getData().toString('utf-8');

  const defaultFooterMatch = documentXml.match(
    /<w:footerReference[^>]*w:type="default"[^>]*r:id="(rId\d+)"/
  );
  if (!defaultFooterMatch) return empty;

  const targetMatch = relsXml.match(
    new RegExp(`Id="${defaultFooterMatch[1]}"[^>]*Target="([^"]+)"`)
  );
  if (!targetMatch) return empty;

  const footerFile = `word/${targetMatch[1]}`;
  const footerEntry = zip.getEntry(footerFile);
  if (!footerEntry) return empty;

  const footerXml = footerEntry.getData().toString('utf-8');
  const footerText = Array.from(footerXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g))
    .map((m) => m[1])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const footerRelsFile = footerFile.replace('word/', 'word/_rels/') + '.rels';
  const footerRelsEntry = zip.getEntry(footerRelsFile);

  let footerImageBuffer: Buffer | null = null;
  let footerImageMime: string | null = null;

  if (footerRelsEntry) {
    const footerRelsXml = footerRelsEntry.getData().toString('utf-8');
    const imgMatch = footerRelsXml.match(/Type="[^"]*\/image"[^>]*Target="([^"]+)"/);
    if (imgMatch) {
      const imgEntry = zip.getEntry(`word/${imgMatch[1]}`);
      if (imgEntry) {
        footerImageBuffer = imgEntry.getData();
        footerImageMime = imgMatch[1].endsWith('.png') ? 'image/png' : 'image/jpeg';
      }
    }
  }

  return { footerImageBuffer, footerImageMime, footerText };
}