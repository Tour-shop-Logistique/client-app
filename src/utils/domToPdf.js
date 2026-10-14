import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Capture un noeud DOM (ex: le composant ReceiptA4 caché, rendu tel qu'à
 * l'impression) et le convertit en PDF A4 fidèle au rendu visuel - contrairement
 * à pdfExport.js qui redessine un document from scratch avec l'API jsPDF, ceci
 * réutilise directement la mise en page React existante sans la dupliquer.
 *
 * @param {HTMLElement} node - Le noeud à capturer (doit avoir une largeur ~210mm)
 * @returns {Promise<Blob>} Le PDF généré, au format Blob
 */
export async function domNodeToPdfBlob(node) {
    if (!node) {
        throw new Error('Aucun noeud DOM fourni pour la génération du PDF');
    }

    const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;

    // Le reçu tient normalement sur une page, mais on gère le débordement au
    // cas où (beaucoup de colis listés) en ajoutant des pages supplémentaires.
    while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    return pdf.output('blob');
}
