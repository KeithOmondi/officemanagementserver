// src/features/surveys/surveys.export.service.ts

// npm install exceljs docx axios image-size
import axios from 'axios';
import { imageSize } from 'image-size';
import ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  TextRun,
  BorderStyle,
  ImageRun,
} from 'docx';
import type { Survey, SurveyResponseRecord } from './surveys.types';

// ─── Judiciary Theme Colors ──────────────────────────────────────────────
const JUDICIARY_GREEN = '1E4620';
const JUDICIARY_GOLD = 'C29B38';
const JUDICIARY_LIGHT_GRAY = 'F5F5F5';

// ─── ORHC Letterhead ──────────────────────────────────────────────────────
const ORHC_LOGO_URL =
  'https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg';
const ORHC_HEADER_TEXT = 'OFFICE OF THE REGISTRAR HIGH COURT';

// Cache the logo in-process so we don't re-fetch it on every export call.
let cachedLogoBuffer: Buffer | null = null;

async function getOrhcLogoBuffer(): Promise<Buffer | null> {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    const response = await axios.get(ORHC_LOGO_URL, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    cachedLogoBuffer = Buffer.from(response.data);
    return cachedLogoBuffer;
  } catch (err) {
    // Don't fail the whole export just because the logo couldn't be fetched
    console.error('Failed to fetch ORHC logo for export:', err);
    return null;
  }
}

/**
 * Scales the logo to a target height while preserving its real aspect
 * ratio (the source image is wider than it is tall — two emblems
 * side by side — so a fixed square size stretches/squishes it).
 */
function getLogoDimensions(buffer: Buffer, targetHeight: number): { width: number; height: number } {
  try {
    const { width, height } = imageSize(buffer);
    if (width && height) {
      return { width: Math.round((width / height) * targetHeight), height: targetHeight };
    }
  } catch (err) {
    console.error('Failed to read ORHC logo dimensions, falling back to square:', err);
  }
  return { width: targetHeight, height: targetHeight };
}

function cellText(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val.join(', ');
  return val ?? '';
}

/**
 * Format array values as numbered list for Excel
 */
function formatArrayForExcel(val: string | string[] | undefined): string {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }
  return val;
}

/**
 * Format array values as numbered list for Word
 * Returns flat array of Paragraph objects
 */
function formatArrayForWord(val: string | string[] | undefined): Paragraph[] {
  if (!val) return [new Paragraph({ text: '' })];
  if (Array.isArray(val) && val.length > 0) {
    return val.map((item, index) =>
      new Paragraph({
        text: `${index + 1}. ${item}`,
        spacing: { after: 60 },
      })
    );
  }
  if (typeof val === 'string' && val.includes(',')) {
    const items = val.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length > 1) {
      return items.map((item, index) =>
        new Paragraph({
          text: `${index + 1}. ${item}`,
          spacing: { after: 60 },
        })
      );
    }
  }
  const text = Array.isArray(val) ? '' : val;
  return [new Paragraph({ text })];
}

/**
 * Builds a header TableCell for the Word responses table.
 * Uses an explicit bold TextRun (rather than a built-in HeadingLevel
 * style) so the text color renders correctly against the gold fill —
 * built-in heading styles otherwise pull in theme-driven text colors
 * that can render too light to read.
 */
function wordHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            color: JUDICIARY_GREEN,
            size: 20,
            font: 'Arial',
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { fill: JUDICIARY_GOLD },
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: JUDICIARY_GOLD },
      bottom: { style: BorderStyle.SINGLE, color: JUDICIARY_GOLD },
      left: { style: BorderStyle.SINGLE, color: JUDICIARY_GOLD },
      right: { style: BorderStyle.SINGLE, color: JUDICIARY_GOLD },
    },
  });
}

export class SurveyExportService {
  static async toExcelBuffer(survey: Survey, responses: SurveyResponseRecord[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheetName = (survey.permanent_slug || survey.title || 'Responses').substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    const totalCols = survey.fields.length + 1; // +1 for "Submitted At"
    const lastColLetter = String.fromCharCode(64 + totalCols);

    // Running row cursor so we can slot the logo/header in without having
    // to re-derive every subsequent row index by hand.
    let row = 1;

    // ─── Letterhead: logo ───────────────────────────────────────────────
    const logoBuffer = await getOrhcLogoBuffer();
    if (logoBuffer) {
      // ExcelJS's `Image.buffer` type doesn't line up with Node's Buffer
      // type across all @types/node versions (Buffer<ArrayBufferLike> vs
      // Buffer). Passing base64 avoids that type mismatch entirely.
      const imageId = workbook.addImage({
        base64: `data:image/jpeg;base64,${logoBuffer.toString('base64')}`,
        extension: 'jpeg',
      });
      const { width: logoWidth, height: logoHeight } = getLogoDimensions(logoBuffer, 60);
      // Roughly center the logo over the table width
      const centerCol = Math.max(0, totalCols / 2 - logoWidth / 2 / 64);
      sheet.addImage(imageId, {
        tl: { col: centerCol, row: row - 1 + 0.1 },
        ext: { width: logoWidth, height: logoHeight },
      });
      sheet.getRow(row).height = 50;
      row++;
    }

    // ─── Letterhead: "OFFICE OF THE REGISTRAR HIGH COURT" ────────────────
    sheet.mergeCells(`A${row}:${lastColLetter}${row}`);
    const orgHeaderCell = sheet.getCell(`A${row}`);
    orgHeaderCell.value = ORHC_HEADER_TEXT;
    orgHeaderCell.font = { bold: true, size: 14, name: 'Arial', color: { argb: `FF${JUDICIARY_GREEN}` } };
    orgHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(row).height = 26;
    row++;

    // ─── Title row ────────────────────────────────────────────────────
    sheet.mergeCells(`A${row}:${lastColLetter}${row}`);
    const titleCell = sheet.getCell(`A${row}`);
    titleCell.value = survey.title;
    titleCell.font = { bold: true, size: 16, name: 'Arial', color: { argb: `FF${JUDICIARY_GREEN}` } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(row).height = 40;
    row++;

    // ─── Description row ──────────────────────────────────────────────
    if (survey.description) {
      sheet.mergeCells(`A${row}:${lastColLetter}${row}`);
      const descCell = sheet.getCell(`A${row}`);
      descCell.value = survey.description;
      descCell.font = { size: 11, name: 'Arial', italic: true, color: { argb: 'FF666666' } };
      descCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      sheet.getRow(row).height = 30;
      row++;
    }

    // ─── Total responses count ────────────────────────────────────────
    sheet.mergeCells(`A${row}:${lastColLetter}${row}`);
    const totalCell = sheet.getCell(`A${row}`);
    totalCell.value = `Total Responses: ${responses.length}`;
    totalCell.font = { bold: true, size: 12, name: 'Arial', color: { argb: `FF${JUDICIARY_GREEN}` } };
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
    row++;

    // ─── Headers row ──────────────────────────────────────────────────
    const headerRowIndex = row;
    const headerRow = sheet.getRow(headerRowIndex);
    const headers = ['Submitted At', ...survey.fields.map(f => f.label)];
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 11, name: 'Arial', color: { argb: `FF${JUDICIARY_GREEN}` } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${JUDICIARY_GOLD}` } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: `FF${JUDICIARY_GOLD}` } },
        bottom: { style: 'thin', color: { argb: `FF${JUDICIARY_GOLD}` } },
        left: { style: 'thin', color: { argb: `FF${JUDICIARY_GOLD}` } },
        right: { style: 'thin', color: { argb: `FF${JUDICIARY_GOLD}` } },
      };
    });
    headerRow.height = 35;

    // Data rows
    for (const r of responses) {
      const rowData: string[] = [
        new Date(r.submitted_at).toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      ];
      for (const f of survey.fields) {
        const val = r.response_data[f.id];
        rowData.push(formatArrayForExcel(val));
      }
      const dataRow = sheet.addRow(rowData);
      dataRow.height = 60;
      dataRow.alignment = { vertical: 'top', wrapText: true };
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    }

    // Auto-fit columns
    sheet.columns.forEach(col => {
      col.width = Math.max(20, col.width || 20);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  static async toWordBuffer(survey: Survey, responses: SurveyResponseRecord[]): Promise<Buffer> {
    const logoBuffer = await getOrhcLogoBuffer();

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          children: [
            // ─── Letterhead: logo ───────────────────────────────────────────
            ...(logoBuffer
              ? [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        // `type` is required by docx v8+; drop it if you're on an
                        // older docx version where it isn't part of the type.
                        type: 'jpg',
                        data: logoBuffer,
                        transformation: getLogoDimensions(logoBuffer, 70),
                      } as ConstructorParameters<typeof ImageRun>[0]),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 120 },
                  }),
                ]
              : []),

            // ─── Letterhead: "OFFICE OF THE REGISTRAR HIGH COURT" ────────────
            new Paragraph({
              children: [
                new TextRun({
                  text: ORHC_HEADER_TEXT,
                  size: 24,
                  bold: true,
                  font: 'Arial',
                  color: JUDICIARY_GREEN,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            // ─── Title ──────────────────────────────────────────────────────
            new Paragraph({
              children: [
                new TextRun({
                  text: survey.title,
                  size: 28,
                  bold: true,
                  font: 'Arial',
                  color: JUDICIARY_GREEN,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            // ─── Description ────────────────────────────────────────────────
            ...(survey.description ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: survey.description,
                    size: 20,
                    font: 'Arial',
                    italics: true,
                    color: '555555',
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 },
              })
            ] : []),

            // ─── Divider: single gold rule ────────────────────────────────
            new Paragraph({
              text: '',
              border: {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 8,
                  color: JUDICIARY_GOLD,
                  space: 1,
                },
              },
              spacing: { after: 400 },
            }),

            // ─── Responses Table ────────────────────────────────────────────
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header row — Judiciary Gold background, dark green text
                new TableRow({
                  children: [
                    wordHeaderCell('Submitted At', 15),
                    ...survey.fields.map((f) =>
                      wordHeaderCell(f.label, Math.floor(85 / survey.fields.length))
                    ),
                  ],
                }),
                // Data rows with alternating shading
                ...responses.map((r, rowIndex) => {
                  const isEven = rowIndex % 2 === 0;
                  return new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({
                          text: new Date(r.submitted_at).toLocaleString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }),
                          alignment: AlignmentType.LEFT,
                        })],
                        width: { size: 15, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.SINGLE, color: 'CCCCCC' },
                          bottom: { style: BorderStyle.SINGLE, color: 'CCCCCC' },
                          left: { style: BorderStyle.SINGLE, color: 'CCCCCC' },
                          right: { style: BorderStyle.SINGLE, color: 'CCCCCC' },
                        },
                        ...(isEven ? {} : { shading: { fill: JUDICIARY_LIGHT_GRAY } }),
                      }),
                      ...survey.fields.map((f) => {
                        const val = r.response_data[f.id];
                        const content = formatArrayForWord(val);
                        return new TableCell({
                          children: content,
                          width: { size: Math.floor(85 / survey.fields.length), type: WidthType.PERCENTAGE },
                          borders: {
                            top: { style: BorderStyle.SINGLE, color: 'CCCCCC' },
                            bottom: { style: BorderStyle.SINGLE, color: 'CCCCCC' },
                            left: { style: BorderStyle.SINGLE, color: 'CCCCCC' },
                            right: { style: BorderStyle.SINGLE, color: 'CCCCCC' },
                          },
                          ...(isEven ? {} : { shading: { fill: JUDICIARY_LIGHT_GRAY } }),
                        });
                      }),
                    ],
                  });
                }),
              ],
            }),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }
}