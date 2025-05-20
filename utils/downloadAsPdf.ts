import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const downloadComponentAsPdf = async (element: HTMLElement, filename: string) => {
  if (!element) {
    console.error('Element not provided for PDF download.');
    return;
  }

  try {
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '0';
    loadingIndicator.style.left = '0';
    loadingIndicator.style.width = '100%';
    loadingIndicator.style.height = '100%';
    loadingIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    loadingIndicator.style.display = 'flex';
    loadingIndicator.style.flexDirection = 'column';
    loadingIndicator.style.alignItems = 'center';
    loadingIndicator.style.justifyContent = 'center';
    loadingIndicator.style.zIndex = '10000';
    loadingIndicator.innerHTML = `
      <div style="width: 40px; height: 40px; border: 3px solid #f3f3f3; 
                  border-top: 3px solid #3498db; border-radius: 50%; 
                  animation: spin 1s linear infinite;"></div>
      <p style="margin-top: 10px; font-family: sans-serif;">Generating PDF...</p>
      <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}</style>
    `;
    document.body.appendChild(loadingIndicator);

    // Wait for images to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Store original element dimensions and styles
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalPosition = element.style.position;
    const originalZIndex = element.style.zIndex;
    const originalOpacity = element.style.opacity;

    // Set up element for optimal capture
    element.style.width = '520px'; // Slightly wider for better quality
    element.style.maxWidth = 'none';
    element.style.position = 'relative';
    element.style.zIndex = '1';
    element.style.opacity = '1';

    // Create a clone of the element in a better positioned container for capture
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '520px';
    container.style.height = 'auto';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.overflow = 'hidden';
    
    const clone = element.cloneNode(true) as HTMLElement;
    container.appendChild(clone);
    document.body.appendChild(container);

    // Force all images to load and be fully rendered
    const images = container.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => 
      new Promise((resolve, reject) => {
        if (img.complete) {
          resolve(img);
        } else {
          img.onload = () => resolve(img);
          img.onerror = reject;
          // Make sure src is absolute URL
          if (img.src.startsWith('/')) {
            img.src = window.location.origin + img.src;
          }
        }
      })
    ));

    // Capture options with higher quality
    const options = {
      scale: 3, // Higher scale for better quality
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 5000, // Longer timeout for images
    };

    const canvas = await html2canvas(clone, options);
    
    // Clean up temp elements
    document.body.removeChild(container);
    
    // Restore original element properties
    element.style.width = originalWidth;
    element.style.maxWidth = originalMaxWidth;
    element.style.position = originalPosition;
    element.style.zIndex = originalZIndex;
    element.style.opacity = originalOpacity;

    // Get image data with high quality
    const imgData = canvas.toDataURL('image/png', 1.0);
    
    // Calculate dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Create PDF with proper dimensions
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    
    // Get PDF dimensions
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Leave margins and calculate fitting
    const margin = 15; // mm
    const availableWidth = pdfWidth - (margin * 2);
    
    // Scale to fit width with margins
    const scale = availableWidth / canvasWidth;
    const scaledHeight = canvasHeight * scale;
    
    // Center on page - both horizontally and vertically
    const xPos = margin;
    const yPos = (pdfHeight - scaledHeight) / 2;
    
    // Add title at top
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(30, 64, 175); // Dark blue, matches card title
    pdf.text('CLEAR-D HEALTH CARD', pdfWidth / 2, margin, { align: 'center' });
    
    // Add the card image
    pdf.addImage(imgData, 'PNG', xPos, yPos, availableWidth, scaledHeight);
    
    // Add footer with explanatory text and date
    pdf.setFontSize(9);
    pdf.setTextColor(75, 85, 99); // Gray
    pdf.setFont('helvetica', 'normal');
    const today = new Date().toLocaleDateString();
    const footerY = pdfHeight - (margin / 2);
    pdf.text(`Generated on: ${today} | This card shows your current health risk assessment.`, 
             pdfWidth / 2, footerY, { align: 'center' });
    
    // Add page border for professional look
    pdf.setDrawColor(226, 232, 240); // Light gray
    pdf.setLineWidth(0.5);
    pdf.rect(5, 5, pdfWidth - 10, pdfHeight - 10);
    
    // Save the PDF
    pdf.save(filename);

    // Remove loading indicator
    document.body.removeChild(loadingIndicator);

  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Try to remove loading indicator if it exists
    const loadingIndicator = document.querySelector('div[style*="position: fixed"][style*="zIndex: 10000"]');
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.parentNode.removeChild(loadingIndicator);
    }
    
    alert('Error generating PDF. Please try again or check browser console for details.');
  }
}; 