// pdf-generator.service.ts
// PDF Generation service for Principal Registry Weekly Reports
// Styled to match the official "OFFICE OF THE REGISTRAR HIGH COURT" reporting template:
// dual crest header, coloured section banners, and the "Justice Be Our Shield and Defender" footer.

import { jsPDF } from 'jspdf';
import type {
  PrincipalRegistryWeeklyReport,
  PDFGenerationOptions,
  PDFGenerationResult,
  PDFSectionContent,
  PDFContentItem,
} from './principal-registry-report.types';
import { formatReportForPDF, generatePDFFileName, getWeekEndingString } from './pdf-report-formatter';

// ─── Template Assets & Colours ────────────────────────────────
// Replace these with your actual Cloudinary asset URLs (same ones used elsewhere
// in OFFICE_SYSTEM, e.g. JOB_LOGO_ubls4m.jpg / footer-emblem_n0ncm9.jpg).

const CREST_LOGO_URL =
  'https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg';
const FOOTER_EMBLEM_URL =
  'https://res.cloudinary.com/do0yflasl/image/upload/v1784364354/ORHC_EMBLEM_wzmp94.jpg';

// Banner colours pulled from the template: the "Administrative Overview" section
// uses a blue banner with a lighter blue sub-banner; every other numbered
// section ("Case Management", "Automating the Principal Registry", etc.) uses
// an olive-green banner.
const BANNER_BLUE = '#8EA9DB';
const BANNER_GREEN = '#9BBB59';
const TEXT_DARK = '#1F1F1F';
const FOOTER_NAVY = '#1F3864';

// Court contact details shown in the footer's right-hand block, matching the
// ORHC internal-memo/approval-stamp template.
const COURT_CONTACT = {
  address: 'Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi',
  phone: '+254 0730 181478',
  email: 'registrarhighcourt@court.go.ke',
  website: 'www.judiciary.go.ke',
};

// ─── Default PDF Options ──────────────────────────────────────

const DEFAULT_PDF_OPTIONS: Required<PDFGenerationOptions> = {
  title: 'PRINCIPAL REGISTRY WEEKLY REPORTING TEMPLATE',
  showWatermark: false,
  watermarkText: 'DRAFT',
  includeFooter: true,
  footerText: 'Justice Be Our Shield and Defender',
  pageSize: 'A4',
  orientation: 'portrait',
  margin: {
    top: 16,
    bottom: 20,
    left: 18,
    right: 18,
  },
};

// ─── Image Fetch Helper ───────────────────────────────────────

interface FetchedImage {
  data: string;
  format: 'JPEG' | 'PNG';
  width: number;
  height: number;
  aspectRatio: number; // width / height
}

/**
 * Reads pixel dimensions straight out of the raw file bytes so images render
 * at their true aspect ratio instead of being squished into a fixed box.
 * Supports JPEG (SOF markers) and PNG (IHDR chunk) — the two formats
 * Cloudinary will realistically serve here.
 */
function getImageDimensions(buffer: Buffer, format: 'JPEG' | 'PNG'): { width: number; height: number } | null {
  try {
    if (format === 'PNG') {
      // PNG: width/height are 4-byte big-endian ints at offset 16 / 20
      if (buffer.length < 24) return null;
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // JPEG: walk the marker segments looking for a Start-Of-Frame marker
    let offset = 2; // skip the 0xFFD8 SOI marker
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF0-SOF15 markers (excluding DHT/JPG/DAC) encode the frame dimensions
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches a remote image (e.g. a Cloudinary URL) and converts it to a base64
 * data string jsPDF's addImage() can consume, along with its real pixel
 * dimensions so callers can preserve aspect ratio instead of forcing a square.
 */
async function fetchImageAsBase64(url: string): Promise<FetchedImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    const format: 'JPEG' | 'PNG' = contentType.includes('png') ? 'PNG' : 'JPEG';

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mime = format === 'PNG' ? 'image/png' : 'image/jpeg';

    const dimensions = getImageDimensions(buffer, format);
    const width = dimensions?.width || 1;
    const height = dimensions?.height || 1;

    return {
      data: `data:${mime};base64,${base64}`,
      format,
      width,
      height,
      aspectRatio: width / height,
    };
  } catch (error) {
    console.error(`Failed to fetch logo image from ${url}:`, error);
    return null;
  }
}

// ─── PDF Generator Service ────────────────────────────────────

export class PDFGeneratorService {
  /**
   * Generate a PDF from a report
   */
  static async generateReportPDF(
    report: PrincipalRegistryWeeklyReport,
    options?: PDFGenerationOptions
  ): Promise<PDFGenerationResult> {
    try {
      const opts = { ...DEFAULT_PDF_OPTIONS, ...options };

      const doc = new jsPDF({
        orientation: opts.orientation,
        unit: 'mm',
        format: opts.pageSize.toLowerCase(),
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = opts.margin;

      const marginTop = margin.top ?? 16;
      const marginLeft = margin.left ?? 18;
      const marginRight = margin.right ?? 18;

      const contentWidth = pageWidth - marginLeft - marginRight;
      let yPos = marginTop;

      // Pre-fetch logos once, up front, so header/footer stay synchronous below.
      const [crestLogo, footerEmblem] = await Promise.all([
        fetchImageAsBase64(CREST_LOGO_URL),
        fetchImageAsBase64(FOOTER_EMBLEM_URL),
      ]);

      // ─── Header ─────────────────────────────────────────────
      yPos = this.addHeader(doc, report, opts, pageWidth, yPos, crestLogo);

      // ─── Sections ───────────────────────────────────────────
      const sections = formatReportForPDF(report);
      yPos = this.addSections(doc, sections, contentWidth, marginLeft, yPos);

      // ─── Footer (every page) ───────────────────────────────
      if (opts.includeFooter) {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          this.addFooter(doc, opts, pageWidth, pageHeight, footerEmblem);
        }
      }

      // ─── Watermark ──────────────────────────────────────────
      if (opts.showWatermark) {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          this.addWatermark(doc, opts.watermarkText, pageWidth, pageHeight);
        }
      }

      const pdfBlob = doc.output('blob');
      const fileName = generatePDFFileName(report);

      const arrayBuffer = await pdfBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64}`;

      return {
        success: true,
        pdfBlob,
        fileName,
        fileSize: pdfBlob.size,
        pdfUrl: dataUrl,
        downloadUrl: dataUrl,
        base64,
      };
    } catch (error) {
      console.error('PDF generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during PDF generation',
      };
    }
  }

  /**
   * Add the ORHC header: crest, court name, template title, week-ending line,
   * report period, status badge, then a divider — matching the uploaded template.
   */
  private static addHeader(
    doc: jsPDF,
    report: PrincipalRegistryWeeklyReport,
    opts: Required<PDFGenerationOptions>,
    pageWidth: number,
    yPos: number,
    crestLogo: FetchedImage | null
  ): number {
    // Crest, centered at the top. Sized by width with height derived from the
    // image's real aspect ratio (capped) so a wide side-by-side crest pair
    // never gets squished into a square.
    if (crestLogo) {
      const maxWidth = 46; // mm
      const maxHeight = 24; // mm
      let logoWidth = maxWidth;
      let logoHeight = logoWidth / crestLogo.aspectRatio;
      if (logoHeight > maxHeight) {
        logoHeight = maxHeight;
        logoWidth = logoHeight * crestLogo.aspectRatio;
      }
      const logoX = pageWidth / 2 - logoWidth / 2;
      try {
        doc.addImage(crestLogo.data, crestLogo.format, logoX, yPos, logoWidth, logoHeight);
      } catch (err) {
        console.error('Failed to embed crest logo:', err);
      }
      yPos += logoHeight + 5;
    }

    doc.setTextColor(TEXT_DARK);

    // Court name
    doc.setFontSize(12);
    doc.setFont('times', 'bold');
    doc.text('OFFICE OF THE REGISTRAR HIGH COURT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    // Template title
    doc.setFontSize(12);
    doc.setFont('times', 'bold');
    doc.text(opts.title.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    // Combined report / week-ending line
    const weekEnding = getWeekEndingString(report.weekEndingDates);
    if (weekEnding) {
      doc.setFontSize(11);
      doc.setFont('times', 'bold');
      doc.text(`REPORT FOR WEEKS ENDING ${weekEnding.toUpperCase()}`, pageWidth / 2, yPos, {
        align: 'center',
      });
      yPos += 7;
    }

    // Report period (italic, smaller — supporting detail rather than a title line)
    doc.setFontSize(9);
    doc.setFont('times', 'italic');
    const periodText = `Report Period: ${new Date(report.reportPeriodStart).toLocaleDateString()} - ${new Date(
      report.reportPeriodEnd
    ).toLocaleDateString()}`;
    doc.text(periodText, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    // Status badge
    const statusColors: Record<string, string> = {
      draft: '#6B7280',
      submitted: '#3B82F6',
      reviewed: '#22C55E',
      archived: '#8B5CF6',
    };
    const statusColor = statusColors[report.status] || '#6B7280';
    doc.setFontSize(9);
    doc.setFont('times', 'bold');
    doc.setTextColor(statusColor);
    doc.text(`Status: ${report.status.toUpperCase()}`, pageWidth / 2, yPos, { align: 'center' });
    doc.setTextColor(TEXT_DARK);
    yPos += 6;

    return yPos;
  }

  /**
   * Draws a full-width coloured banner with centered bold text — used for both
   * the numbered section titles (green) and the "Key activities undertaken" /
   * "Notable issues handled" style sub-banners (blue).
   */
  private static drawBanner(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    width: number,
    color: string,
    height = 6.5
  ): number {
    doc.setFillColor(color);
    doc.rect(x, y, width, height, 'F');
    doc.setFontSize(10.5);
    doc.setFont('times', 'bold');
    doc.setTextColor(TEXT_DARK);
    doc.text(text, x + width / 2, y + height / 2 + 1.3, { align: 'center' });
    return y + height + 3;
  }

  /**
   * Add sections to the PDF, alternating banner colour per the template
   * (blue for the first "Administrative Overview" section, olive-green for
   * every subsequent numbered section).
   */
  private static addSections(
    doc: jsPDF,
    sections: PDFSectionContent[],
    contentWidth: number,
    leftMargin: number,
    yPos: number
  ): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomLimit = pageHeight - 32; // leave room for the taller footer block

    sections.forEach((section, sectionIndex) => {
      if (yPos > bottomLimit - 12) {
        doc.addPage();
        yPos = 16;
      }

      const bannerColor = sectionIndex === 0 ? BANNER_BLUE : BANNER_GREEN;
      yPos = this.drawBanner(doc, section.title, leftMargin, yPos, contentWidth, bannerColor);

      for (const item of section.items) {
        if (yPos > bottomLimit) {
          doc.addPage();
          yPos = 16;
        }

        // Label on its own line — always. Mixing "same line" and "next line"
        // layouts based on measured width is what caused label/value text to
        // collide (e.g. a long label butting straight into its answer with no
        // gap). Stacking unconditionally guarantees consistent spacing no
        // matter how long the label or value is.
        doc.setFontSize(10.5);
        doc.setFont('times', 'bold');
        doc.setTextColor(TEXT_DARK);
        const labelLines = doc.splitTextToSize(`${item.label}:`, contentWidth - 4);
        doc.text(labelLines, leftMargin + 2, yPos);
        yPos += labelLines.length * 5 + 2; // gap between label and its answer

        const valueText = item.formattedValue || this.formatValueForDisplay(item);
        doc.setFontSize(10);
        doc.setFont('times', 'normal');
        doc.setTextColor('#33393F');
        const valueLines = doc.splitTextToSize(valueText, contentWidth - 8);
        doc.text(valueLines, leftMargin + 6, yPos);
        yPos += valueLines.length * 5.2;

        yPos += 6; // gap before the next question
      }

      yPos += 3; // spacing between sections
    });

    return yPos;
  }

  /**
   * Footer matching the ORHC template exactly: emblem + short tagline on the
   * left, and a right-aligned block of "Social Transformation through Access
   * to Justice" (bold), the court's address/contact line, and "Justice Be Our
   * Shield and Defender" (bold italic) as the closer. Page number sits
   * bottom-right, below that block.
   */
  private static addFooter(
    doc: jsPDF,
    opts: Required<PDFGenerationOptions>,
    pageWidth: number,
    pageHeight: number,
    footerEmblem: FetchedImage | null
  ): void {
    const rightEdge = pageWidth - 18;
    const leftEdge = 18;

    // Divider line above the whole footer block
    const dividerY = pageHeight - 26;
    doc.setDrawColor('#C4C4C4');
    doc.setLineWidth(0.2);
    doc.line(leftEdge, dividerY, rightEdge, dividerY);

    let blockY = dividerY + 5;

    // ─── Left: emblem + short tagline ──────────────────────
    let emblemWidth = 0;
    if (footerEmblem) {
      const maxHeight = 9; // mm
      const maxWidth = 12; // mm
      let height = maxHeight;
      let width = height * footerEmblem.aspectRatio;
      if (width > maxWidth) {
        width = maxWidth;
        height = width / footerEmblem.aspectRatio;
      }
      emblemWidth = width;
      try {
        doc.addImage(footerEmblem.data, footerEmblem.format, leftEdge, blockY - 2, width, height);
      } catch (err) {
        console.error('Failed to embed footer emblem:', err);
      }
    }
    doc.setFontSize(6.5);
    doc.setFont('times', 'bolditalic');
    doc.setTextColor(FOOTER_NAVY);
    doc.text('Social Transformation', leftEdge + emblemWidth + 2, blockY + 1);
    doc.text('through Access to Justice', leftEdge + emblemWidth + 2, blockY + 4);

    // ─── Right: contact block ──────────────────────────────
    doc.setFontSize(8.5);
    doc.setFont('times', 'bold');
    doc.setTextColor(FOOTER_NAVY);
    doc.text('Social Transformation through Access to Justice', rightEdge, blockY, { align: 'right' });

    doc.setFontSize(7);
    doc.setFont('times', 'normal');
    doc.text(COURT_CONTACT.address, rightEdge, blockY + 3.5, { align: 'right' });
    doc.text(
      `Tel. ${COURT_CONTACT.phone} | ${COURT_CONTACT.email} | ${COURT_CONTACT.website}`,
      rightEdge,
      blockY + 7,
      { align: 'right' }
    );

    doc.setFontSize(8.5);
    doc.setFont('times', 'bolditalic');
    doc.setTextColor(TEXT_DARK);
    doc.text(opts.footerText || 'Justice Be Our Shield and Defender', rightEdge, blockY + 11, {
      align: 'right',
    });

    // Page number, bottom-right corner
    const pageNumber = doc.getCurrentPageInfo().pageNumber;
    const totalPages = doc.getNumberOfPages();
    doc.setFontSize(7);
    doc.setFont('times', 'normal');
    doc.setTextColor('#4B5563');
    doc.text(`Page | ${pageNumber} of ${totalPages}`, rightEdge, blockY + 15, { align: 'right' });
  }

  /**
   * Add watermark to the PDF
   */
  private static addWatermark(doc: jsPDF, watermarkText: string, pageWidth: number, pageHeight: number): void {
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#E5E7EB');

    const angle = -40;
    const textWidth = doc.getStringUnitWidth(watermarkText) * 60;
    const x = (pageWidth - textWidth) / 2;
    const y = pageHeight / 2;

    doc.text(watermarkText, x, y, { angle });
    doc.setTextColor(TEXT_DARK);
  }

  /**
   * Format a value for display in PDF
   */
  private static formatValueForDisplay(item: PDFContentItem): string {
    if (item.formattedValue) {
      return item.formattedValue;
    }

    const { value, type } = item;

    if (value === null || value === undefined) {
      return 'Not provided';
    }

    switch (type) {
      case 'list':
        return Array.isArray(value) ? value.map((v, i) => `${i + 1}. ${v}`).join('\n') : String(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
        try {
          const date = new Date(value as string);
          return isNaN(date.getTime())
            ? 'Invalid date'
            : date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch {
          return String(value);
        }
      case 'date_list':
        if (Array.isArray(value)) {
          return value
            .map((v) => {
              try {
                const date = new Date(v);
                return isNaN(date.getTime())
                  ? v
                  : date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
              } catch {
                return v;
              }
            })
            .join(', ');
        }
        return String(value);
      default:
        return String(value);
    }
  }
}

// ─── Add default export ────────────────────────────────────────
export default PDFGeneratorService;