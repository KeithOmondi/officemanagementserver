import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import axios from 'axios';

export async function embedSignatureBlockIntoPDF(
    originalPdfUrl: string,
    signatureImageUrl: string,
    signatoryName: string,
    signatoryTitle: string
): Promise<Buffer> {
    // 1. Fetch original PDF
    const pdfRes = await axios.get<ArrayBuffer>(originalPdfUrl, { responseType: 'arraybuffer' });
    const pdfDoc = await PDFDocument.load(pdfRes.data);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // --- CALCULATE SIGNATURE BLOCK SPACE ---
    // Height required for image (50px) + gaps + text rows + safety margin (~180px total)
    const REQUIRED_SIGNATURE_HEIGHT = 180;
    const BOTTOM_MARGIN = 40; // minimum distance from bottom of page

    let targetPage: PDFPage = lastPage;
    let sigTopY = 220; // Default height position from bottom for the top of the sig block

    const availableSpace = height - 250;

    if (availableSpace < (REQUIRED_SIGNATURE_HEIGHT + BOTTOM_MARGIN)) {
        // Not enough space on current page -> Append a new page
        targetPage = pdfDoc.addPage([width, height]);
        sigTopY = height - 100; // Reset Y position near top of the new blank page
    } else {
        // Fits on last page!
        sigTopY = 220; // Position near bottom of last page
    }

    // 2. Fetch and embed signature image
    const sigRes = await axios.get<ArrayBuffer>(signatureImageUrl, { responseType: 'arraybuffer' });
    const sigImage = await pdfDoc.embedPng(sigRes.data);

    // 3. Set fonts and colors
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const marginX = 60;

    // 4. Draw Signature Image on chosen targetPage
    const sigWidth = 200;
    const sigHeight = 50;
    const sigDims = sigImage.scaleToFit(sigWidth, sigHeight);
    targetPage.drawImage(sigImage, {
        x: marginX,
        y: sigTopY,
        width: sigDims.width,
        height: sigDims.height,
    });

    // 5. Draw Signatory Name
    const nameY = sigTopY - 20;
    targetPage.drawText(signatoryName.toUpperCase(), {
        x: marginX,
        y: nameY,
        size: 14,
        font: boldFont,
        color: black,
    });

    // 6. Draw Signatory Title (Underlined)
    const titleY = nameY - 24;
    const titleText = signatoryTitle.toUpperCase();
    targetPage.drawText(titleText, {
        x: marginX,
        y: titleY,
        size: 12,
        font: boldFont,
        color: black,
    });
    
    const titleWidth = boldFont.widthOfTextAtSize(titleText, 12);
    targetPage.drawLine({
        start: { x: marginX, y: titleY - 3 },
        end: { x: marginX + titleWidth, y: titleY - 3 },
        thickness: 1.5,
        color: black,
    });

    // ❌ REMOVED: Date section - the date is already in the memo header

    return Buffer.from(await pdfDoc.save());
}