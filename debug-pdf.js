// Debugging tool for InsightEngine Enterprise PDF generation
// Add this to your browser console to debug PDF issues

export const PDFDebugger = {
  // Test print CSS media queries
  testPrintMediaQuery() {
    const mediaQuery = window.matchMedia('print');
    console.log('🖨️ Print Media Query Test:');
    console.log('- Supports print media:', !!mediaQuery);
    console.log('- Media query matches:', mediaQuery.matches);
    
    // Listen for changes
    mediaQuery.addListener((mq) => {
      console.log('🖨️ Print media query changed:', mq.matches);
    });
  },

  // Test print functionality
  async testPrint() {
    console.log('🖨️ Testing print functionality...');
    
    // Test window.print
    if (typeof window.print === 'function') {
      console.log('✅ window.print is available');
    } else {
      console.log('❌ window.print is NOT available');
    }
    
    // Test document visibility
    console.log('📄 Document visibility state:', document.visibilityState);
    
    // Test CSS computed styles
    const printContent = document.querySelector('.print-content');
    if (printContent) {
      const styles = window.getComputedStyle(printContent);
      console.log('🎨 Print content styles:');
      console.log('- visibility:', styles.visibility);
      console.log('- color:', styles.color);
      console.log('- background:', styles.backgroundColor);
      console.log('- z-index:', styles.zIndex);
    }
    
    // Test all print-content elements
    const allPrintElements = document.querySelectorAll('.print-content *');
    console.log(`📊 Found ${allPrintElements.length} print-content elements`);
    allPrintElements.forEach((el, i) => {
      const styles = window.getComputedStyle(el);
      if (styles.visibility === 'hidden' || styles.display === 'none') {
        console.log(`⚠️ Element ${i} (${el.tagName}) is hidden:`, styles);
      }
    });
  },

  // Generate diagnostic report
  generateDiagnosticReport() {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      printContent: document.querySelector('.print-content') ? true : false,
      printStyles: {},
      bodyStyles: {},
      hiddenElements: []
    };

    // Get print content styles
    const printContent = document.querySelector('.print-content');
    if (printContent) {
      report.printStyles = {
        visibility: window.getComputedStyle(printContent).visibility,
        color: window.getComputedStyle(printContent).color,
        background: window.getComputedStyle(printContent).backgroundColor,
        zIndex: window.getComputedStyle(printContent).zIndex
      };
    }

    // Get body styles
    report.bodyStyles = {
      visibility: window.getComputedStyle(document.body).visibility,
      background: window.getComputedStyle(document.body).backgroundColor
    };

    // Find hidden elements
    document.querySelectorAll('.print-content *').forEach((el, i) => {
      const styles = window.getComputedStyle(el);
      if (styles.visibility === 'hidden' || styles.display === 'none') {
        report.hiddenElements.push({
          index: i,
          tagName: el.tagName,
          className: el.className,
          visibility: styles.visibility,
          display: styles.display
        });
      }
    });

    console.log('📋 Diagnostic Report:', report);
    return report;
  },

  // Fix common print issues
  fixPrintIssues() {
    console.log('🔧 Attempting to fix common print issues...');
    
    // Force visibility of print content
    const printContent = document.querySelector('.print-content');
    if (printContent) {
      printContent.style.visibility = 'visible';
      printContent.style.display = 'block';
      printContent.style.color = 'black';
      printContent.style.backgroundColor = 'white';
      printContent.style.zIndex = '9999';
      
      // Force all child elements to be visible
      printContent.querySelectorAll('*').forEach(el => {
        const styles = window.getComputedStyle(el);
        if (styles.visibility === 'hidden' || styles.display === 'none') {
          console.log('🔧 Fixing hidden element:', el);
          el.style.visibility = 'visible';
          el.style.display = styles.display === 'none' ? 'block' : styles.display;
          el.style.color = 'black';
        }
      });
    }
    
    // Hide everything else
    document.body.style.visibility = 'hidden';
    document.body.style.backgroundColor = 'white';
    
    // Hide all elements except print content
    document.querySelectorAll('body > *').forEach(el => {
      if (!el.classList.contains('print-content') && !el.closest('.print-content')) {
        el.style.display = 'none';
      }
    });
  }
};

// Export for easy access in console
window.PDFDebugger = PDFDebugger;

// Auto-run basic tests
console.log('🖨️ PDF Debugger loaded. Use PDFDebugger.testPrint() to test print functionality');
PDFDebugger.testPrintMediaQuery();