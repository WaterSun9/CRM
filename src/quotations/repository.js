import { payload, fromRow, validate, revisionInfo, clientKey, groupClients, tallyClients, statusOf, liveQuotes, clientSeqOf, clientNoOf, MAX_QUOTES } from './model.js';

export const LIST_COLUMNS = 'id,quotation_no,owner_id,owner_name_snapshot,customer_name,customer_phone,quotation_date,capacity_kw,starting_price,status,source_lead_id,converted_lead_id,issued_at,created_at,updated_at,revision:quotation_data->revision,superseded_by:quotation_data->superseded_by,selected_option,kind:quotation_data->>kind,client_id:quotation_data->>client_id,final_of:quotation_data->>final_of,final_id:quotation_data->>final_id,client_no:quotation_data->>client_no,client_seq:quotation_data->>client_seq,village,district,options:quotation_data->form->options,activity:quotation_data->activity';
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
                // Quote-3255 or Quote-3255-2 finds all of that client's quotes.
                const number = term.replace(/^quote-?/i,'').trim().replace(/-\d$/,'');
                const numberFilter = /^\d{1,15}$/.test(number) ? `,quotation_no.eq.${number},quotation_data->>client_no.eq.${number}` : '';
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
        // Clients per status, for the sidebar badge (open = clients still waiting on an outcome).
        async counts() {
            const counts = tallyClients(groupClients(await this.listAll()));
            return { ...counts, open: counts.waiting };
        },
        // Every quote of this quote's client (see clientKey in model.js).
        async clientQuotes(row) {
            const key = clientKey(row);
            const { data, error } = await client.from('quotations').select('*')
                .or(`id.eq.${key},quotation_data->>client_id.eq.${key},quotation_data->>final_of.eq.${key}`);
            fail(error);
            return (data || []).filter(item => clientKey(item) === key);
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
            quotationData.form = { ...quotationData.form, source_lead_id:null };
            return update(fresh,{ status:fresh.status === 'lost' ? 'lost' : fresh.issued_at ? 'issued' : 'draft', converted_lead_id:null, converted_at:null, source_lead_id:null, quotation_data:quotationData });
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
        // Client picked this one: marks this quote and unmarks the client's other quotes.
        // `option` is 1, or the kept option of an older three-option quote.
        async pick(row, option, user) {
            const fresh = await get(row.id);
            const quotes = await this.clientQuotes(fresh);
            if (quotes.some(q => statusOf(q) === 'converted')) throw new Error('This client is already added to leads, so the picked quote cannot change.');
            const picked = await this.markWon(fresh, option, user);
            for (const other of quotes) {
                if (other.id === fresh.id || other.selected_option == null) continue;
                await update(other,{ selected_option:null, quotation_data:activityData(other,event('unpicked',user,{ picked:fresh.id })) });
            }
            return picked;
        },
        async save(id, previous, form, template, user) {
            // Quotations stay editable after download, Won and Lost. Only a revised-away
            // old version (hidden behind its newer revision) refuses edits.
            if (previous?.quotation_data?.superseded_by) throw locked();
            const body = payload(form,template);
            // Fewer options than the recorded Won choice: one option is that choice, else it is cleared.
            if (previous?.selected_option > form.options.length) body.selected_option = form.options.length === 1 ? 1 : null;
            body.quotation_data = { ...previous?.quotation_data, ...body.quotation_data };
            if (!previous) {
                // A client's first quote starts the group (Quote-<no>-1); "Another brand quote" passes
                // its key and gets the client's number with the next place, up to three quotes.
                body.quotation_data.client_id = form.client_id || id;
                body.quotation_data.client_seq = 1;
                if (form.client_id) {
                    const quotes = liveQuotes(await this.clientQuotes({ client_id:form.client_id }));
                    if (!quotes.some(q => q.id === id)) {
                        if (quotes.length >= MAX_QUOTES) throw new Error(`A client can have up to ${MAX_QUOTES} quotes. Edit one of them instead.`);
                        const first = quotes.find(q => q.id === form.client_id) || quotes[0];
                        if (first) {
                            body.quotation_data.client_no = Number(clientNoOf(first));
                            body.quotation_data.client_seq = Math.max(...quotes.map(q => clientSeqOf(q) || 1)) + 1;
                        }
                    }
                }
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
        // The client chose this quote (option 1, or the kept option of an older three-option quote).
        // Use pick(), which also unmarks the client's other quotes.
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
            // The quote also shows on its lead card (LeadQuotation reads source_lead_id). The form
            // keeps it too, so a later edit and save does not clear it.
            const quotationData = activityData(fresh,event('converted',user,{ lead_id:leadId }));
            quotationData.form = { ...quotationData.form, source_lead_id:leadId };
            return update(fresh,{ status:'converted',converted_lead_id:leadId,converted_at:new Date().toISOString(),source_lead_id:leadId,
                quotation_data:quotationData });
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
