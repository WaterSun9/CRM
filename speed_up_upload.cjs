const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `            if (replacingDocId) {
                const oldDoc = documents.find(d => d.id === replacingDocId);
                if (oldDoc) {
                    await deleteDocument(oldDoc.id, oldDoc.storage_path);
                }
            } else if (docType) {
                const existingDocs = documents.filter(d => d.doc_type === docType);
                for (const oldDoc of existingDocs) {
                    await deleteDocument(oldDoc.id, oldDoc.storage_path);
                }
            }

            const newDoc = await uploadDocument(file, customer.id, docType, user?.id);
            if (newDoc) {
                setDocuments(prev => [
                    newDoc,
                    ...prev.filter(d => replacingDocId ? d.id !== replacingDocId : (docType ? d.doc_type !== docType : true))
                ]);
                // Pre-cache the new doc URL
                getViewUrl(newDoc.storage_path).then(url => {
                    if (url) urlCacheRef.current[newDoc.storage_path] = url;
                });
                // Automatically mark checklist field as true and persist
                if (docType) {
                    setEditData(prev => ({ ...prev, [docType]: true }));
                    await onUpdate(customer.id, { [docType]: true });
                }
                await logActivity(
                    user?.id,
                    'upload',
                    \`Uploaded document: \${file.name}\`,
                    '',
                    customer.id
                );
            }`;

const replacementStr = `            if (replacingDocId) {
                const oldDoc = documents.find(d => d.id === replacingDocId);
                if (oldDoc) {
                    deleteDocument(oldDoc.id, oldDoc.storage_path).catch(console.error);
                }
            } else if (docType) {
                const existingDocs = documents.filter(d => d.doc_type === docType);
                existingDocs.forEach(oldDoc => {
                    deleteDocument(oldDoc.id, oldDoc.storage_path).catch(console.error);
                });
            }

            const newDoc = await uploadDocument(file, customer.id, docType, user?.id);
            if (newDoc) {
                setDocuments(prev => [
                    newDoc,
                    ...prev.filter(d => replacingDocId ? d.id !== replacingDocId : (docType ? d.doc_type !== docType : true))
                ]);
                // Pre-cache the new doc URL
                getViewUrl(newDoc.storage_path).then(url => {
                    if (url) urlCacheRef.current[newDoc.storage_path] = url;
                });
                // Automatically mark checklist field as true and persist
                if (docType) {
                    setEditData(prev => ({ ...prev, [docType]: true }));
                    onUpdate(customer.id, { [docType]: true }).catch(console.error);
                }
                logActivity(
                    user?.id,
                    'upload',
                    \`Uploaded document: \${file.name}\`,
                    '',
                    customer.id
                ).catch(console.error);
            }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated CustomerDetailModal.jsx to speed up uploads");
} else {
    console.log("Target not found in CustomerDetailModal.jsx");
}
