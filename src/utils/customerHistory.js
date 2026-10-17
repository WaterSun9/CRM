export async function loadCustomerHistory(client, customerId, offset = 0, limit = 25) {
    const rows = [];
    let hasMore = false;
    while (rows.length < limit) {
        const size = Math.min(500, limit - rows.length);
        const from = offset + rows.length;
        const { data, error } = await client.from('activity_log').select('*, profiles(name)')
            .or(`customer_id.eq.${customerId},new_value.eq.${customerId}`)
            .order('created_at', { ascending: false }).order('id', { ascending: false })
            .range(from, from + size);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Customer history could not be loaded.');
        rows.push(...data.slice(0, size));
        hasMore = data.length > size;
        if (!hasMore) break;
    }
    return { rows, hasMore };
}
