const fs = require('fs');

const file = 'src/utils.jsx';
let content = fs.readFileSync(file, 'utf8');

// I will rewrite uploadDocument to run storage upload and getSession concurrently.

const targetStr = `        const { error: uploadError } = await supabase.storage
            .from('customer-documents')
            .upload(filePath, processedFile, {
                cacheControl: '3600',
                upsert: true,
                contentType: processedFile.type || 'application/octet-stream'
            });

        if (uploadError) {
            console.error('Storage upload failed:', uploadError);
            throw new Error(uploadError.message || 'Storage upload failed');
        }

        // Validate UUID for uploaded_by column (PostgreSQL throws error if non-UUID is passed)
        const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        
        let validUserId = isUUID(passedUserId) ? passedUserId : null;
        if (!validUserId) {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                const sessionUserId = sessionData?.session?.user?.id;
                if (isUUID(sessionUserId)) {
                    validUserId = sessionUserId;
                }
            } catch {
                validUserId = null;
            }
        }`;

const replacementStr = `        // Validate UUID for uploaded_by column
        const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        
        let sessionPromise = null;
        if (!isUUID(passedUserId)) {
            sessionPromise = supabase.auth.getSession().catch(() => null);
        }

        const uploadPromise = supabase.storage
            .from('customer-documents')
            .upload(filePath, processedFile, {
                cacheControl: '3600',
                upsert: true,
                contentType: processedFile.type || 'application/octet-stream'
            });

        const [uploadRes, sessionData] = await Promise.all([uploadPromise, sessionPromise]);
        
        if (uploadRes.error) {
            console.error('Storage upload failed:', uploadRes.error);
            throw new Error(uploadRes.error.message || 'Storage upload failed');
        }

        let validUserId = isUUID(passedUserId) ? passedUserId : null;
        if (!validUserId && sessionData) {
            const sessionUserId = sessionData?.data?.session?.user?.id;
            if (isUUID(sessionUserId)) {
                validUserId = sessionUserId;
            }
        }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated utils.jsx for parallel upload and getSession");
} else {
    console.log("Target not found in utils.jsx");
}
