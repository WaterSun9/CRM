const fs = require('fs');
const file = 'src/utils.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;`;

const replacementStr = `    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let width = img.width;
            let height = img.height;`;

const targetStr2 = `            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });`;

const replacementStr2 = `        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };
        img.src = objectUrl;
    });`;

if (content.includes(targetStr) && content.includes(targetStr2)) {
    content = content.replace(targetStr, replacementStr);
    content = content.replace(targetStr2, replacementStr2);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated compressImage to use createObjectURL");
} else {
    console.log("Target strings not found!");
}
