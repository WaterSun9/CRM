import { payload, fromRow, validate, revisionInfo, finalForm, quoteLabel, isFinalQuotation } from './model.js';

export const LIST_COLUMNS = 'id,quotation_no,owner_id,owner_name_snapshot,customer_name,customer_phone,quotation_date,capacity_kw,starting_price,status,source_lead_id,converted_lead_id,issued_at,created_at,updated_at,revision:quotation_data->revision,superseded_by:quotation_data->superseded_by,selected_option,kind:quotation_data->>kind,final_of_label:quotation_data->>final_of_label,chosen_brands:quotation_data->form->options,final_id:quotation_data->>final_id';
export const STATUSES = ['draft','issued','converted','lost'];
export const PAGE_SIZE = 20;
// PostgreSQL jsonb reorders object keys; compare canonical values, not wire key order.
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k,canonical(value[k])])) : value;
const same = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const fail = error => { if (error) throw error; };
// Only a revised-away (replaced) version is read-only; every live quotation stays editable.
export const locked = () => new Error('This quotation was revised, so this old version is read-only. Open the newest version to edit.');
export const conflict = () => new Error('This quotation changed in another session. Reopen it to review the latest version. Your local recovery copy is retained.');
const event = (type, user, extra = {}) => ({ type, actor_id: user.id, at: new Date().toISOString(), ...extra });
const activityData = (row, entry) => ({ ...row.quotation_data, activity: [...(row.quotation_data?.activity || []), entry] });
// Stable identifier makes simultaneous creation and retry after a lost response safe.
export async function finalQuotationId(parentId, leadId) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`watersun-final:${parentId}:${leadId}`)));
    digest[6] = (digest[6] & 15) | 128; digest[8] = (digest[8] & 63) | 128;
    const hex = Array.from(digest.slice(0,16), n => n.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function createQuotationRepository(client) {
    const get = async id => {
        const { data, error } = await client.from('quotations').select('*').eq('id',id).single();
        fail(error); return data;
    };
    const update = async (row, changes) => {
        const { data, error } = await client.from('quotations').update(changes).eq('id',row.id).eq('updated_at',row.updated_at).select('*').maybeSingle();
        fail(error); if (!data) throw conflict(); return data;
    };
    return {
        get, update,
        async list({ search = '', status = 'all', page = 0, size = PAGE_SIZE }) {
            let query = client.from('quotations').select(LIST_COLUMNS,{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false});
            if (status !== 'all') query = query.eq('status',status);
            // Never interpolate PostgREST filter punctuation or wildcards supplied by users.
            const term = search.replace(/[^\p{L}\p{N}\s+-]/gu,'').trim().slice(0,100);
            if (term) {
                const number = term.replace(/^quote-?/i,'').trim();
                const numberFilter = /^\d{1,15}$/.test(number) ? `,quotation_no.eq.${number}` : '';
                query = query.or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%${numberFilter}`);
            }
            const { data,error,count } = await query.range(page * size, (page + 1) * size - 1);
            fail(error); return { rows:data, count };
        },
        // Every quotation matching the search (up to 1000), so the status tabs and
        // their counts are worked out in the browser and switch instantly.
        async listAll({ search = '' } = {}) {
            const { rows } = await this.list({ search, status:'all', page:0, size:1000 });
            return rows;
        },
        // Deferred lead integration: these helpers have no active UI entry point while
        // LEAD_INTEGRATION_ENABLED is false in QuotationModule.
        async leads(search, page = 0) {
            let query = client.from('admin').select('id,customer_name,phone_number,email_address,full_address,villages,sub_divisions,district,pincode,system_capacity_kwp,module_brand,no_of_modules,module_wp,stage').is('deleted_at',null).not('customer_name','is',null).neq('customer_name','').neq('customer_name','.').order('created_at',{ascending:false}).order('id',{ascending:false});
            const term = search.replace(/[^\p{L}\p{N}\s+-]/gu,'').trim().slice(0,100);
            if (term) query = query.or(`customer_name.ilike.%${term}%,phone_number.ilike.%${term}%`);
            const { data,error } = await query.range(page * PAGE_SIZE,(page + 1) * PAGE_SIZE - 1); fail(error); return data;
        },
        // Count per status for the sidebar badge and the filter buttons.
        // open and won follow statusOf (model.js); final copies of a won quote are
        // not counted as open or won.
        async counts() {
            // Replaced (revised) versions are not counted - only the newest one is live.
            const live = () => client.from('quotations').select('id',{count:'exact',head:true}).is('quotation_data->superseded_by',null);
            const notFinal = query => query.or('quotation_data->>kind.is.null,quotation_data->>kind.neq.final');
            const tally = async query => { const { count, error } = await query; fail(error); return count || 0; };
            const [entries, open, wonChosen, wonLinked] = await Promise.all([
                Promise.all(STATUSES.map(async status => [status, await tally(live().eq('status',status))])),
                tally(notFinal(live().in('status',['draft','issued']).is('selected_option',null).is('converted_lead_id',null))),
                tally(notFinal(live().in('status',['draft','issued']).not('selected_option','is',null).is('converted_lead_id',null))),
                // A quotation linked to a lead is converted unless it was later marked lost
                // (status converted always has a lead).
                tally(notFinal(live().neq('status','lost').not('converted_lead_id','is',null))),
            ]);
            const counts = Object.fromEntries(entries);
            counts.all = STATUSES.reduce((sum, status) => sum + counts[status], 0);
            counts.open = open;
            counts.won = wonChosen;
            counts.converted = wonLinked;
            return counts;
        },
        // A quotation can say "converted" only while its lead still exists. If the
        // lead was deleted (or moved to Trash), unlink it so the quotation shows
        // as issued again and can be added to leads once more.
        async verifyConversion(row) {
            if (!row?.converted_lead_id) return row;
            const { data, error } = await client.from('admin').select('id').eq('id',row.converted_lead_id).is('deleted_at',null).maybeSingle();
            fail(error);
            if (data) return row;
            const fresh = await get(row.id);
            if (!fresh.converted_lead_id) return fresh;
            const quotationData = activityData(fresh,{ type:'conversion_cleared', at:new Date().toISOString(), lead_id:fresh.converted_lead_id });
            // The old lead row still exists in Trash with this id, so the next
            // conversion must use a new one.
            quotationData.next_lead_id = crypto.randomUUID();
            return update(fresh,{ status:fresh.status === 'lost' ? 'lost' : fresh.issued_at ? 'issued' : 'draft', converted_lead_id:null, converted_at:null, quotation_data:quotationData });
        },
        // Issued quotations are locked. Revise copies it into a new draft
        // (Quote-<no>-R1, -R2 ...) and marks the original as replaced.
        async revise(row, user) {
            const fresh = await get(row.id);
            if (fresh.quotation_data?.superseded_by) throw new Error('This quotation was already revised. Open the newest version.');
            if (fresh.converted_lead_id || fresh.status === 'converted') throw new Error('A converted quotation cannot be revised.');
            const info = revisionInfo(fresh);
            const id = crypto.randomUUID();
            const body = payload(fromRow(fresh,user),fresh.quotation_data?.template);
            body.quotation_data.revision = { base_no: info.baseNo, n: info.n + 1, of_id: fresh.id };
            body.quotation_data.activity = [event('created',user,{ revision_of: fresh.id })];
            const { data, error } = await client.from('quotations').insert({ ...body, id, owner_id:user.id }).select('*').single();
            fail(error);
            await update(fresh,{ quotation_data:{ ...activityData(fresh,event('revised',user,{ new_id:id })), superseded_by:{ id, label:`Quote-${info.baseNo}-R${info.n + 1}` } } });
            return data;
        },
        async ensureFinal(row, user) {
            let original = await get(row.id);
            if (isFinalQuotation(original)) return original;
            if (!original.selected_option) throw new Error('Choose a panel before creating its final quotation.');
            if (!original.converted_lead_id && !original.quotation_data?.final_id) {
                const finalId = await finalQuotationId(original.id,'won');
                try { original = await update(original,{ quotation_data:{ ...original.quotation_data, final_id:finalId } }); }
                catch (error) {
                    const latest = await get(original.id);
                    if (latest.quotation_data?.final_id !== finalId || latest.selected_option !== original.selected_option) throw error;
                    original = latest;
                }
            }
            const form = finalForm(fromRow(original), original.selected_option);
            const id = original.quotation_data?.final_id || await finalQuotationId(original.id, original.converted_lead_id || 'won');
            const { data: existing, error: readError } = await client.from('quotations').select('*').eq('id',id).maybeSingle();
            fail(readError);
            if (existing) {
                if (existing.quotation_data?.final_of !== original.id || (existing.source_lead_id && existing.source_lead_id !== original.converted_lead_id)) throw conflict();
                if (original.converted_lead_id && !existing.source_lead_id) return update(existing,{ source_lead_id:original.converted_lead_id, quotation_data:{ ...existing.quotation_data, form:{ ...existing.quotation_data.form, source_lead_id:original.converted_lead_id } } });
                return existing;
            }
            const body = payload({ ...form, source_lead_id: original.converted_lead_id || null }, original.quotation_data.template);
            body.quotation_data = { ...body.quotation_data, kind:'final', final_of:original.id, final_of_label:quoteLabel(original),
                selected_option:original.selected_option, activity:[event('final_created',user,{ quotation_id:original.id })] };
            const { data, error } = await client.from('quotations').insert({ ...body, id, owner_id:original.owner_id }).select('*').single();
            if (error?.code === '23505') {
                const latest = await get(id);
                if (latest.quotation_data?.final_of !== original.id || (latest.source_lead_id || null) !== (original.converted_lead_id || null)) throw conflict();
                return latest;
            }
            fail(error); return data;
        },
        async save(id, previous, form, template, user) {
            // Quotations stay editable after download, Won and Lost. Only a revised-away
            // old version (hidden behind its newer revision) refuses edits.
            if (previous && !isFinalQuotation(previous) && previous.quotation_data?.superseded_by) throw locked();
            const body = payload(form,template);
            if (isFinalQuotation(previous)) body.status = 'draft';
            // Fewer options than the recorded Won choice: one option is that choice, else it is cleared.
            if (previous?.selected_option > form.options.length) body.selected_option = form.options.length === 1 ? 1 : null;
            body.quotation_data = { ...previous?.quotation_data, ...body.quotation_data };
            if (!previous) {
                body.quotation_data.activity = [event('created',user)];
                const { data,error } = await client.from('quotations').insert({ ...body,id,owner_id:user.id }).select('*').single();
                if (error?.code !== '23505') { fail(error); return data; }
                const existing = await get(id);
                if (same(existing.quotation_data.form,body.quotation_data.form)) return existing;
                throw conflict();
            }
            if (previous.issued_at && !same(previous.quotation_data.form,body.quotation_data.form)) {
                body.quotation_data.activity = [...(previous.quotation_data.activity || []),event('edited_after_issue',user)];
            }
            try { return await update(previous,body); }
            catch (error) {
                // A request can commit and then lose its response. Recognize a successful retry.
                const latest = await get(id);
                if (same(latest.quotation_data.form,body.quotation_data.form)) return latest;
                throw error;
            }
        },
        async generated(row, user) {
            const errors = validate(fromRow(row));
            if (errors.length) throw new Error(errors.join('\n'));
            const document = row.quotation_data;
            const entry = event(row.issued_at ? 'pdf_generated' : 'issued',user);
            const changes = { quotation_data: activityData(row,entry) };
            // Preserve a complete copy of each generated version, independent of later edits/templates.
            const revisions = document.issued_versions || [];
            const last = revisions.at(-1);
            if (!last || !same(last.form,document.form)) {
                changes.quotation_data.issued_versions = [...revisions,{ at:entry.at,actor_id:user.id,form:document.form,template:document.template,quotation_no:row.quotation_no }];
            }
            // Downloading or sharing never changes the status: issued_at only records
            // when it was first sent.
            if (!row.issued_at) changes.issued_at = entry.at;
            return update(row,changes);
        },
        // Won: the customer chose option `option` (1-based; 1 for a one-option quote).
        // Recorded on this quotation only - no separate final quotation is made.
        async markWon(row, option, user) {
            const fresh = await get(row.id);
            const count = fromRow(fresh).options?.length || 0;
            if (!Number.isInteger(option) || option < 1 || option > count) throw new Error(`Choose an option from 1 to ${count}.`);
            return update(fresh,{ selected_option:option, status:fresh.status === 'lost' ? 'draft' : fresh.status,
                lost_at:null, lost_reason:null, lost_remark:null,
                quotation_data:activityData(fresh,event('won',user,{ option })) });
        },
        // Lost: reason and remark are both optional. Allowed from any state.
        async markLost(row, reason, user, remark = '') {
            const fresh = await get(row.id);
            const why = String(reason ?? '').trim(), note = String(remark ?? '').trim();
            return update(fresh,{ status:'lost', selected_option:null, lost_at:new Date().toISOString(),
                lost_reason:why || null, lost_remark:note || null,
                quotation_data:activityData(fresh,event('lost',user,{ reason:why, remark:note })) });
        },
        // Back to Open: clears the chosen option and any lost reason.
        async markOpen(row, user) {
            const fresh = await get(row.id);
            return update(fresh,{ status:'draft', selected_option:null, lost_at:null, lost_reason:null, lost_remark:null,
                quotation_data:activityData(fresh,event('reopened',user)) });
        },
        async outcome(row, type, user, reason = '', remark = '') {
            if (row.converted_lead_id || row.status === 'converted') throw new Error('A converted quotation cannot be marked lost or reopened.');
            if (type === 'lost' && !reason.trim()) throw new Error('A lost reason is required.');
            const now = new Date().toISOString();
            return update(row,{ status:type === 'lost' ? 'lost' : row.issued_at ? 'issued' : 'draft',
                lost_at:type === 'lost' ? now : null, lost_reason:type === 'lost' ? reason.trim() : null,
                lost_remark:type === 'lost' ? remark.trim() : null,
                quotation_data:activityData(row,event(type,user,{ reason,remark })) });
        },
        async lead(id) {
            const { data,error } = await client.from('admin').select('*').eq('id',id).is('deleted_at',null).single(); fail(error); return data;
        },
        async link(row, leadId, user) {
            const fresh = await get(row.id);
            if (fresh.converted_lead_id) {
                if (fresh.converted_lead_id !== leadId) throw conflict();
                return fresh;
            }
            return update(fresh,{ status:'converted',converted_lead_id:leadId,converted_at:new Date().toISOString(),
                quotation_data:activityData(fresh,event('converted',user,{ lead_id:leadId })) });
        },
        // A stable lead UUID makes retries idempotent, including two devices converting together.
        async insertConversionLead(row, insertData, user) {
            const fresh = await get(row.id);
            let leadId = fresh.converted_lead_id || fresh.quotation_data?.next_lead_id || fresh.id;
            let lead;
            if (!fresh.converted_lead_id) {
                const result = await client.from('admin').insert({ ...insertData,id:leadId }).select('*').single();
                if (result.error?.code !== '23505') fail(result.error);
                lead = result.data;
            }
            if (!lead) {
                const result = await client.from('admin').select('*').eq('id',leadId).is('deleted_at',null).single();
                fail(result.error); lead = result.data;
            }
            await this.link(fresh,leadId,user);
            return { data:lead,error:null };
        },
    };
}
