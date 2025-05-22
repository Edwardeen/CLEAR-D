import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const downloadComponentAsPdf = async (element: HTMLElement, filename: string) => {
  if (!element) {
    console.error('Element not provided for PDF download.');
    return;
  }

  // Find and remove any existing notifications first
  const existingNotifications = document.querySelectorAll('div[style*="position: fixed"][style*="zIndex: 9999"]');
  existingNotifications.forEach(notification => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });

  // Find and remove any existing loading indicators
  const existingLoaders = document.querySelectorAll('div[style*="position: fixed"][style*="zIndex: 10000"]');
  existingLoaders.forEach(loader => {
    if (loader.parentNode) {
      loader.parentNode.removeChild(loader);
    }
  });

  // Create new loading indicator with proper ID for easier removal
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'pdf-loading-indicator';
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

  try {
    // Preload all images in the element before generating PDF
    const images = element.querySelectorAll('img');
    
    // Force all images to load completely - critical step
    await Promise.all(Array.from(images).map(img => 
      new Promise((resolve) => {
        // Make sure image has crossOrigin set
        img.crossOrigin = 'anonymous';
        
        // If image is already loaded, resolve immediately
        if (img.complete) {
          resolve(null);
        } else {
          // Set up load and error handlers
          img.onload = () => resolve(null);
          img.onerror = () => {
            console.warn('Image failed to load:', img.src);
            resolve(null);
          };
          
          // For Next.js Image components, ensure unoptimized and priority are set
          img.setAttribute('unoptimized', 'true');
          img.setAttribute('priority', 'true');
        }
      })
    ));
    
    // Additional wait time for images to fully render
    await new Promise(resolve => setTimeout(resolve, 3000));

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

    // Capture options with higher quality
    const options = {
      scale: 3, // Higher scale for better quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      imageTimeout: 15000, // Longer timeout for images
      logging: true, // Enable logging to debug image issues
      onclone: (clonedDoc: Document) => {
        const clonedImages = clonedDoc.querySelectorAll('img');
        clonedImages.forEach(img => {
          img.crossOrigin = 'anonymous';
          img.setAttribute('unoptimized', 'true');
        });
      }
    };

    // Generate canvas
    const canvas = await html2canvas(element, options);
    
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

    // Clean up - remove all loading indicators and notifications
    removeAllNotifications();

  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Clean up - remove all loading indicators and notifications
    removeAllNotifications();
    
    // Show error alert
    alert('Error generating PDF. Please try again.');
  }
};

// Helper function to remove all notifications and loading indicators
function removeAllNotifications() {
  // Remove loading indicator by ID
  const loadingIndicator = document.getElementById('pdf-loading-indicator');
  if (loadingIndicator) {
    document.body.removeChild(loadingIndicator);
  }
  
  // Remove any other loading indicators by style
  const otherLoadingIndicators = document.querySelectorAll('div[style*="position: fixed"][style*="zIndex: 10000"]');
  otherLoadingIndicators.forEach(indicator => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  });
  
  // Remove notifications by style
  const notifications = document.querySelectorAll('div[style*="position: fixed"][style*="zIndex: 9999"]');
  notifications.forEach(notification => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });
  
  // Look for elements with text "Preparing PDF"
  const preparingElements = Array.from(document.querySelectorAll('div')).filter(el => 
    el.innerText && el.innerText.includes('Preparing PDF')
  );
  preparingElements.forEach(el => {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
} 