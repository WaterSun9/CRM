const fs = require('fs');

const file = 'src/utils.jsx';
let content = fs.readFileSync(file, 'utf8');

const functionStart = content.indexOf('export async function compressImage');
const functionEnd = content.indexOf('export const uploadDocument');

if (functionStart !== -1 && functionEnd !== -1) {
    const originalFunction = `export async function compressImage(file, { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = {}) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
        return file;
    }

    // Skip SVGs or tiny images
    if (file.type === 'image/svg+xml' || file.size < 300 * 1024) {
        return file;
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width <= maxWidth && height <= maxHeight && file.size < 800 * 1024) {
                    return resolve(file);
                }

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob || blob.size >= file.size) {
                            return resolve(file);
                        }
                        const cleanExt = file.name.replace(/\\.[^/.]+$/, '.jpg');
                        const compressedFile = new File([blob], cleanExt, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
}

`;
    
    content = content.slice(0, functionStart) + originalFunction + content.slice(functionEnd);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Reverted compressImage to original FileReader logic");
} else {
    console.log("Could not find boundaries");
}
