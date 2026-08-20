// src/features/surveys/surveys.export.service.ts

// npm install exceljs docx
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, WidthType } from 'docx';
import type { Survey, SurveyResponseRecord } from './surveys.types';

function cellText(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val.join(', ');
  return val ?? '';
}

export class SurveyExportService {
  static async toExcelBuffer(survey: Survey, responses: SurveyResponseRecord[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    // Use permanent_slug or title for the sheet name
    const sheetName = (survey.permanent_slug || survey.title || 'Responses').substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = [
      { header: 'Submitted At', key: 'submitted_at', width: 22 },
      ...survey.fields.map((f) => ({ header: f.label, key: f.id, width: 30 })),
    ];
    sheet.getRow(1).font = { bold: true };

    for (const r of responses) {
      const row: Record<string, string> = {
        submitted_at: new Date(r.submitted_at).toLocaleString(),
      };
      for (const f of survey.fields) {
        row[f.id] = cellText(r.response_data[f.id]);
      }
      sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  static async toWordBuffer(survey: Survey, responses: SurveyResponseRecord[]): Promise<Buffer> {
    const headerRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Submitted At', heading: HeadingLevel.HEADING_6 })] }),
        ...survey.fields.map(
          (f) => new TableCell({ children: [new Paragraph({ text: f.label, heading: HeadingLevel.HEADING_6 })] }),
        ),
      ],
    });

    const dataRows = responses.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(new Date(r.submitted_at).toLocaleString())] }),
            ...survey.fields.map(
              (f) => new TableCell({ children: [new Paragraph(cellText(r.response_data[f.id]))] }),
            ),
          ],
        }),
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: survey.title, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: survey.description ?? '', spacing: { after: 200 } }),
            new Paragraph({ text: `Total responses: ${responses.length}`, spacing: { after: 200 } }),
            new Paragraph({ 
              text: `Survey ID: ${survey.permanent_slug}`,
              spacing: { after: 200 },
              style: 'Normal'
            }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }
}