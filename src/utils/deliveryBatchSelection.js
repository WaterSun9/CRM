// Existing batch members must remain visible while editing even after their
// customer records advance beyond Material Delivery.
// partialIds: customers ticked "Partly delivered" on an earlier batch. They can
// join a new batch for the rest of their material.
export function getEligibleBatchProjects(customers, selectedProjectIds, editingBatch, searchQuery, stageFilter, partialIds = new Set()) {
    const selectedOrder = new Map(selectedProjectIds.map((id, index) => [String(id), index]));
    const search = String(searchQuery || '').trim().toLowerCase();
    return customers.filter(customer => {
        if (customer.deleted_at) return false;
        if (selectedOrder.has(String(customer.id))) return true;
        const partial = partialIds.has(String(customer.id)) || customer.delivery_partial === true;
        if (customer.delivery_batch_id && customer.delivery_batch_id !== editingBatch?.batch_no && !partial) return false;
        if (stageFilter !== 'ALL' && customer.stage !== stageFilter) return false;
        return !search || [customer.customer_name, customer.phone_number, customer.villages, customer.consumer_no]
            .some(value => String(value || '').toLowerCase().includes(search));
    }).sort((a, b) => {
        const aSelected = selectedOrder.has(String(a.id));
        const bSelected = selectedOrder.has(String(b.id));
        if (aSelected && bSelected) return selectedOrder.get(String(a.id)) - selectedOrder.get(String(b.id));
        if (aSelected) return -1;
        if (bSelected) return 1;
        return 0;
    });
}
