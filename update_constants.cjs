const fs = require('fs');
let file = 'src/constants.js';
let content = fs.readFileSync(file, 'utf8');

const target = `export const DOC_TYPE_LABELS = {`;
const replacement = `export const DOC_TYPE_LABELS = {
    application_acknowledgment: 'Application Acknowledgment',
    vendor_feasibility: 'Vendor Feasibility',
    site_feasibility: 'Site Feasibility',`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated DOC_TYPE_LABELS in constants.js");
