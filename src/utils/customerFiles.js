// Every stored file of one customer in the customer-documents bucket: the paths
// its documents rows point to, plus anything else in its folder (<id>/...).
export async function customerFilePaths(client, customerId) {
    const paths = new Set();
    const { data: docs } = await client.from('documents').select('storage_path').eq('customer_id', customerId);
    for (const doc of docs || []) if (doc.storage_path && !doc.storage_path.startsWith('mock/')) paths.add(doc.storage_path);
    for (let offset = 0; ; offset += 1000) {
        const { data: listed, error } = await client.storage.from('customer-documents').list(customerId, { limit: 1000, offset });
        if (error || !listed?.length) break;
        // Folders come back with no id; documents are stored flat under <id>/.
        for (const item of listed) if (item.id && item.name) paths.add(`${customerId}/${item.name}`);
        if (listed.length < 1000) break;
    }
    return [...paths];
}
