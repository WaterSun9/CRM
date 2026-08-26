const fs = require('fs');

function updateFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    // bump text-[11px] to text-sm, text-[9px] to text-xs, etc. inside the print sections.
    // Actually, VendorPortal and AgentPortal use inline tailwind classes for printing.
    // It's safer to just inject a <style> block that overrides text sizes during print!
    
    if (content.includes('body.is-printing-document #native-print-portal * {') || content.includes('/* Print Styles for Vendor BOM */')) {
        const target = 'visibility: visible !important;\n                    }';
        const replace = `visibility: visible !important;
                    }
                    body.is-printing-document #native-print-portal,
                    body.is-printing-document #native-print-portal p,
                    body.is-printing-document #native-print-portal span,
                    body.is-printing-document #native-print-portal td,
                    body.is-printing-document #native-print-portal th,
                    body.is-printing-document #native-print-portal div {
                        font-size: 11pt !important;
                    }
                    body.is-printing-document #native-print-portal h1,
                    body.is-printing-document #native-print-portal h2,
                    body.is-printing-document #native-print-portal h3,
                    body.is-printing-document #native-print-portal h4 {
                        font-size: 14pt !important;
                    }`;
                    
        content = content.replace(target, replace);
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated print styles in ${file}`);
    }
}

updateFile('src/components/VendorPortal.jsx');
updateFile('src/components/AgentPortal.jsx');
