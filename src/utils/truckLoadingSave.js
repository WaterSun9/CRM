import { isSolarPanelName } from './truckLoad.js';

const UUID_RE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// Keep quantity-level ticks available before panel serials are assigned.
// When serials exist, the truck tick updates the same serial records as the card.
// keepPanelsLoaded: per customer, the serials that were loaded before this
// sheet ticked the panel line (say on the first truck of a partly delivered
// customer). Undo leaves those loaded instead of clearing every serial.
export async function saveTruckLoadingTicks(client, { row, targets, value, panelSerialsByCustomer = {}, keepPanelsLoaded = {} }) {
    const ids = [...new Set(targets.flatMap(target => target.lines.map(line => line.id)))];
    if (!ids.length || ids.some(id => !UUID_RE.test(String(id || '')))) {
        throw new Error('Save the customer’s Bill of Materials before marking it loaded.');
    }
    if (isSolarPanelName(row.name)) {
        for (const { project } of targets) {
            const keep = new Set(value ? [] : keepPanelsLoaded[project.id] || []);
            const serials = [...new Set(panelSerialsByCustomer[project.id] || [])].filter(serial => !keep.has(serial));
            if (!serials.length) continue;
            const { data, error } = await client.from('panel_loading')
                .upsert(serials.map(serial_no => ({ customer_id: project.id, serial_no, loaded: value })), { onConflict: 'customer_id,serial_no' })
                .select('serial_no');
            if (error || data?.length !== serials.length) throw error || new Error('The panel loading status was not saved.');
        }
    }
    const { data, error } = await client.from('bom_items').update({ loaded: value }).in('id', ids).select('id');
    if (error || data?.length !== ids.length) throw error || new Error('Some ticks were not saved. Reopen the sheet and check the loading status.');
}

// A plain-language reason for a failed save. A dropped connection reaches us
// as "Failed to fetch" (Chrome), "Load failed" (Safari) or "NetworkError".
export function describeSaveError(error, fallback = 'This was not saved.') {
    const message = String(error?.message || '');
    const offline = (typeof navigator !== 'undefined' && navigator.onLine === false)
        || /failed to fetch|fetch failed|load failed|networkerror|network request failed/i.test(message);
    if (offline) return 'No internet connection, so this was NOT saved. The sheet shows only what is saved. Try again when you are back online.';
    return message || fallback;
}

export const TRUCK_LOADED_MIGRATION = 'supabase/migrations/20261017120000_truck_loaded_stamp.sql';
const LOADED_COLUMNS = 'id, loaded_at, loaded_by, loaded_by_name';
const missingLoadedColumns = error => /loaded_(at|by)/.test(String(error?.message || ''))
    && (['PGRST204', '42703'].includes(error?.code) || /does not exist|could not find/i.test(String(error?.message || '')));

// Records the truck as loaded, once. The database stamps its own time and the
// signed-in user. A truck already marked loaded (say from another phone)
// keeps its first stamp, which comes back with alreadyLoaded.
export async function markBatchLoaded(client, { batchId, user }) {
    const { data, error } = await client.from('delivery_batches')
        .update({
            loaded_at: new Date().toISOString(),
            loaded_by: UUID_RE.test(String(user?.id || '')) ? user.id : null,
            loaded_by_name: user?.name || null
        })
        .eq('id', batchId).is('loaded_at', null).select(LOADED_COLUMNS);
    if (error) {
        throw missingLoadedColumns(error)
            ? new Error(`Recording who loaded the truck needs a one-time database update. Run ${TRUCK_LOADED_MIGRATION} in Supabase first. The ticks themselves are saved.`)
            : error;
    }
    if (data?.length === 1) return { stamp: data[0], alreadyLoaded: false };
    const { data: current, error: readError } = await client.from('delivery_batches').select(LOADED_COLUMNS).eq('id', batchId).maybeSingle();
    if (readError) throw readError;
    if (current?.loaded_at) return { stamp: current, alreadyLoaded: true };
    throw new Error('The truck was not marked loaded. Your account may not have permission, or the batch was deleted.');
}

// "Loaded by Asha on 17 Oct 2026, 3:05 pm", or '' while not loaded.
export function truckLoadedLabel(batch) {
    if (!batch?.loaded_at) return '';
    const when = new Date(batch.loaded_at).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata'
    });
    return `Loaded by ${batch.loaded_by_name || 'someone'} on ${when}`;
}

// Customers on the truck with items still unticked.
export function loadingShortfall({ projects = [], progressByCustomer = {} } = {}) {
    return projects
        .map(project => ({ id: project.id, name: project.customer_name || project.id, ...(progressByCustomer[project.id] || { loaded: 0, total: 0 }) }))
        .filter(entry => entry.total > 0 && entry.loaded < entry.total);
}

// The card's "Material Loaded Date" on each BOM. Set for customers with
// something loaded when they were ticked on this sheet, or have no date yet,
// so an older truck marked late does not move a later date back.
export async function stampBomLoadedDates(client, { sheet, date, tickedIds = new Set() }) {
    const failed = [];
    for (const project of sheet.projects || []) {
        const bomId = sheet.bomIdByCustomer?.[project.id];
        if (!bomId || !sheet.progressByCustomer?.[project.id]?.loaded) continue;
        if (!tickedIds.has(project.id) && sheet.bomLoadedDateByCustomer?.[project.id]) continue;
        const { data, error } = await client.from('bom').update({ material_loaded_date: date }).eq('id', bomId).select('id');
        if (error || data?.length !== 1) failed.push(project.customer_name || project.id);
    }
    return failed;
}
