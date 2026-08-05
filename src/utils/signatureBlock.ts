import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import axios from 'axios';

export async function embedSignatureBlockIntoPDF(
    originalPdfUrl: string,
    signatureImageUrl: string,
    signatoryName: string,
    signatoryTitle: string,
    copyToRecipients: string[] = [] 
): Promise<Buffer> {
    // 1. Fetch original PDF
    const pdfRes = await axios.get<ArrayBuffer>(originalPdfUrl, { responseType: 'arraybuffer' });
    const pdfDoc = await PDFDocument.load(pdfRes.data);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // 2. Load Fonts
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    const marginX = 54;

    // --- 3. CALCULATE VERTICAL POSITIONS ---
    // In pdf-lib: higher Y = higher up on page.
    // We start at a comfortable Y baseline for the signature image.
    let currentY = 220; 

    // --- 4. DRAW SIGNATURE IMAGE ---
    const sigRes = await axios.get<ArrayBuffer>(signatureImageUrl, { responseType: 'arraybuffer' });
    const sigImage = await pdfDoc.embedPng(sigRes.data);

    const sigDims = sigImage.scaleToFit(160, 45);
    
    // Draw Signature Image
    lastPage.drawImage(sigImage, {
        x: marginX + 10,
        y: currentY,
        width: sigDims.width,
        height: sigDims.height,
    });

    // Move currentY down past signature image
    currentY -= 15;

    // Draw Signatory Name
    lastPage.drawText(signatoryName.toUpperCase(), {
        x: marginX,
        y: currentY,
        size: 11,
        font: boldFont,
        color: black,
    });

    // Draw Signatory Title (Underlined)
    currentY -= 14;
    const titleText = signatoryTitle.toUpperCase();
    lastPage.drawText(titleText, {
        x: marginX,
        y: currentY,
        size: 10,
        font: boldFont,
        color: black,
    });

    const titleWidth = boldFont.widthOfTextAtSize(titleText, 10);
    lastPage.drawLine({
        start: { x: marginX, y: currentY - 2 },
        end: { x: marginX + titleWidth, y: currentY - 2 },
        thickness: 1,
        color: black,
    });

    // --- 5. DRAW "COPY TO:" BLOCK (BELOW SIGNATURE TITLE) ---
    if (copyToRecipients.length > 0) {
        currentY -= 25; // Space below the title underline

        lastPage.drawText('Copy to:', {
            x: marginX,
            y: currentY,
            size: 10,
            font: boldFont,
            color: black,
        });

        currentY -= 14;
        for (let i = 0; i < copyToRecipients.length; i++) {
            let ccText = copyToRecipients[i];
            if (!ccText.toLowerCase().includes('hon') && !ccText.toLowerCase().includes('in-charge')) {
                ccText = `Hon. ${ccText}`;
            }

            lastPage.drawText(`${i + 1}. ${ccText}`, {
                x: marginX + 15,
                y: currentY,
                size: 9.5,
                font: regularFont,
                color: black,
            });
            currentY -= 14;
        }
    }

    return Buffer.from(await pdfDoc.save());
}