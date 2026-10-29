import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { calculate, chargeLabel, extraCharges, fromRow, money, newForm, optionSpecs, isFinalQuotation, STEPS, validate } from './model';
import { brandedTemplate } from './branding';
import { quotationRepository as repo } from './client';
import { readRecovery, removeRecovery, writeRecovery } from './recovery';
import { useGlobalPopup } from '../components/GlobalPopup';
import { calculateSystemCapacityKwp } from '../utils/capacity';
const showDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value).split('-').reverse().join('-') : (value || '');

const customerFields = [
    ['customer_name','Customer name','text',160],['customer_phone','Phone number','tel',20],['customer_email','Email address','email',160],
    ['full_address','Full address','textarea',400],['village','Village','text',100],['taluka','Taluka / subdivision','text',100],
    ['district','District','text',100],['pincode','Pincode','text',6],['quotation_date','Quotation date','date'],
    ['valid_until','Valid until','date'],['owner_name_snapshot','Salesperson name (automatic)','text',120,true],['owner_phone_snapshot','Salesperson phone','tel',20],
];
function Field({ label,value,onChange,type = 'text',maxLength,readOnly = false,children }) {
    return <label className="q-field"><span>{label}</span>{children || (type === 'textarea'
        ? <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} maxLength={maxLength} rows={3} readOnly={readOnly} />
        : <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} maxLength={maxLength} readOnly={readOnly} aria-readonly={readOnly || undefined} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} inputMode={type === 'number' ? 'decimal' : undefined} />)}</label>;
}
// Same lists as Add Lead (Settings metadata), with the lead form's Wp defaults.
const DEFAULT_MODULE_WP = ['540','545','550','570','575','580','585','590','600','610','615','620'];
function OptionSelect({ label,value,options,onChange,placeholder }) {
    const list = [...new Set(options.map(String).filter(Boolean))];
    const current = String(value ?? '');
    if (current && !list.includes(current)) list.unshift(current);
    return <Field label={label}><select value={current} onChange={e => onChange(e.target.value)}><option value="">{placeholder}</option>{list.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>;
}
function ModuleCountSelect({ value, onChange }) {
    const [custom, setCustom] = useState(false);
    if (custom) return <Field label="No of Modules"><span className="q-auto-field">
        <input aria-label="No of Modules" type="number" min="1" step="1" value={value ?? ''} onChange={e => onChange(e.target.value)} />
        <button type="button" onClick={() => setCustom(false)}>List</button>
    </span></Field>;
    return <OptionSelect label="No of Modules" placeholder="Select module count…" value={value}
        options={[...Array.from({length:200},(_,index) => String(index + 1)), 'Other quantity…']}
        onChange={next => next === 'Other quantity…' ? setCustom(true) : onChange(next)} />;
}
export default function QuotationForm({ id,initialRow,user,meta = {},onDirty,onSaved,onPreview,onDraftSaved }) {
    const { showAlert,showConfirm } = useGlobalPopup();
    const [form,setForm] = useState(() => initialRow ? fromRow(initialRow,user) : newForm(user));
    const [template,setTemplate] = useState(() => initialRow?.quotation_data?.template || brandedTemplate());
    const [step,setStep] = useState(0);
    const [otherPicked,setOtherName] = useState(false);
    const otherName = otherPicked || !!form.print_owner_name;
    const [saveState,setSaveState] = useState(initialRow ? 'Saved' : 'Enter customer name and phone to start saving');
    const [error,setError] = useState('');
    const [busy,setBusy] = useState(false);
    const [recovery,setRecovery] = useState(() => readRecovery(user.id,id));
    const rowRef = useRef(initialRow);
    const formRef = useRef(form);
    const templateRef = useRef(template);
    const changed = useRef(false);
    const saving = useRef(null);
    const active = useRef(true);
    const blocked = useRef(false);
    formRef.current = form; templateRef.current = template;
    const markDirty = () => { changed.current = true; onDirty(true); };
    const update = (key,value) => {
        const next = { ...formRef.current,[key]:value };
        formRef.current = next; setForm(next); markDirty();
        const stored = writeRecovery(user.id,id,{ form:next,template:templateRef.current,base_updated_at:rowRef.current?.updated_at || null });
        setSaveState(stored ? (navigator.onLine ? 'Unsaved changes' : 'Offline — recovery saved on this device') : 'Unsaved — device recovery unavailable');
    };
    async function save() {
        if (saving.current) return saving.current;
        if (blocked.current) throw new Error('Reopen the quotation to resolve the conflicting changes before saving.');
        if (!formRef.current.customer_name.trim() || !String(formRef.current.customer_phone).trim()) throw new Error('Enter customer name and phone to save a draft.');
        const work = async () => {
            do {
                const captured = formRef.current;
                if (active.current) { setSaveState('Saving…'); setError(''); }
                const saved = await repo.save(id,rowRef.current,captured,templateRef.current,user);
                rowRef.current = saved;
                onSaved(saved);
                if (captured === formRef.current) {
                    changed.current = false; onDirty(false); removeRecovery(user.id,id);
                    if (active.current) setSaveState('Saved');
                }
            } while (changed.current && active.current);
            return rowRef.current;
        };
        saving.current = work().catch(err => {
            if (/another session/.test(err.message)) blocked.current = true;
            if (active.current) { setError(err.message); setSaveState(navigator.onLine ? 'Save failed' : 'Offline — recovery saved on this device'); }
            throw err;
        }).finally(() => { saving.current = null; });
        return saving.current;
    }
    const saveRef = useRef(save); saveRef.current = save;
    useEffect(() => {
        active.current = true;
        if (changed.current) { onDirty(true); writeRecovery(user.id,id,{form:formRef.current,template:templateRef.current,base_updated_at:rowRef.current?.updated_at || null}); }
        const online = () => { if (changed.current) void saveRef.current().catch(() => {}); };
        const offline = () => setSaveState('Offline — recovery saved on this device');
        window.addEventListener('online',online); window.addEventListener('offline',offline);
        return () => { active.current = false; window.removeEventListener('online',online); window.removeEventListener('offline',offline); };
    // The editor is keyed by quotation ID; these values describe its initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[]);
    useEffect(() => {
        if (!changed.current || recovery || blocked.current) return;
        const timer = setTimeout(() => { if (navigator.onLine) void saveRef.current().catch(() => {}); },900);
        return () => clearTimeout(timer);
    },[form,recovery]);
    const fillTestValues = () => {
        const testData = {
            customer_name: 'Test Customer',
            customer_phone: '9876543210',
            customer_email: 'test.customer@example.com',
            full_address: '101 Solar Park, Main Road',
            village: 'Patan',
            taluka: 'Patan',
            district: 'Patan',
            pincode: '384265',
            capacity_kw: '3.48',
            project_type: 'Residential',
            solar_panel_make: 'Waaree 580',
            solar_panel_qty: '6',
            panel_wattage: '580',
            inverter_option: 'Option 1',
            inverter_brand: 'Solaryan',
            geb_geda_charge: 'Including',
            geb_charge: '',
            geda_charge: '',
            options: [
                { brandName: 'Waaree Solar', panel_wattage: '580', solar_panel_qty: '6', capacity_kw: '3.48', baseValue: '189000', discount: '5000', subsidy: '78000' },
                { brandName: 'Tata Power Solar', panel_wattage: '600', solar_panel_qty: '6', capacity_kw: '3.6', baseValue: '198000', discount: '5000', subsidy: '78000' },
                { brandName: 'Adani Solar', panel_wattage: '550', solar_panel_qty: '7', capacity_kw: '3.85', baseValue: '205000', discount: '5000', subsidy: '78000' },
            ],
            custom_notes: ['Standard installation warranty included', 'Special seasonal discount applied'],
        };
        const next = { ...formRef.current, ...testData };
        formRef.current = next;
        setForm(next);
        markDirty();
        writeRecovery(user.id, id, { form: next, template: templateRef.current, base_updated_at: rowRef.current?.updated_at || null });
    };
    const totals = calculate(form.options, extraCharges(form));
    const panelMakes = meta?.module_brand || [];
    const inverterMakes = meta?.inverter_make?.length ? meta.inverter_make : ['Solaryan','Growatt','Sungrow','TATA Approved / UTL'];
    const moduleWps = meta?.module_wp?.length ? meta.module_wp : DEFAULT_MODULE_WP;
    const lastStep = STEPS.length - 1;
    const saveDraft = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const draft = await save();
            onDraftSaved?.(draft);
            void showAlert('Your draft is saved. You can continue editing it from the quotation list.', { title: 'Draft saved', type: 'success' });
        } catch (err) {
            setError(err.message);
            void showAlert(err.message, { title: 'Draft not saved', type: 'warning' });
        } finally {
            if (active.current) setBusy(false);
        }
    };
    const updateOption = (index, key, value) => {
        update('options', form.options.map((option, i) => {
            if (i !== index) return option;
            const next = { ...option, [key]: value };
            if (['panel_wattage', 'solar_panel_qty'].includes(key)) next.capacity_kw = calculateSystemCapacityKwp(next.panel_wattage, next.solar_panel_qty) ?? '';
            return next;
        }));
    };
    const restore = async () => {
        if (recovery.base_updated_at !== (rowRef.current?.updated_at || null) && !await showConfirm('The server has a newer version. Restore your local copy into the editor for review?',{confirmLabel:'Restore for review'})) return;
        setTemplate(recovery.template || template); templateRef.current = recovery.template || template;
        formRef.current = recovery.form; setForm(recovery.form); markDirty(); setRecovery(null);
    };
    const preview = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const issues = validate(formRef.current);
            if (issues.length) throw new Error(issues.join('\n'));
            const savedRow = await save();
            onPreview(savedRow);
        } catch (err) {
            setError(err.message);
            void showAlert(err.message, { title: 'Quotation not ready', type: 'warning' });
        } finally {
            if (active.current) setBusy(false);
        }
    };
    return <div className="q-editor">
        <div className="q-stepper" aria-label="Quotation steps">{STEPS.map((title,i) => <button key={title} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}><span>{i + 1}</span><small>{title}</small></button>)}</div>
        <div className="q-save-state" role="status">{saveState}</div>
        {error && <div className="q-error" role="alert">{error}</div>}
        {recovery && <div className="q-notice"><strong>A recovery copy is available on this device.</strong><p>Restore it to review your unsaved edits.</p><button onClick={restore}>Restore copy</button><button onClick={() => { removeRecovery(user.id,id); setRecovery(null); }}>Use server version</button></div>}
        <div className="q-panel">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <h2 style={{margin:0}}>{STEPS[step]}</h2>
                {import.meta.env.DEV && <button type="button" onClick={fillTestValues} style={{background:'#fef3c7',borderColor:'#f59e0b',color:'#92400e',fontSize:12,padding:'4px 10px',minHeight:32}}>⚡ Fill Test Values</button>}
            </div>
            {isFinalQuotation(initialRow) && <p className="q-notice">Final quotation: selected panel only. You can edit it, preview it, or save as draft and return later. Download again after changes to save an updated PDF in the lead’s documents.</p>}
            {step === 0 && <div className="q-grid">{customerFields.map(([key,label,type,maxLength,readOnly]) => <Fragment key={key}><Field label={label} type={type} maxLength={maxLength} readOnly={readOnly} value={form[key]} onChange={value => update(key,value)} />
                {/* Temporary: another salesperson name printed on this quotation only; owner_name_snapshot is unchanged. */}
                {key === 'owner_phone_snapshot' && <><Field label="Salesperson name on quotation"><select value={otherName ? 'other' : 'default'} onChange={e => { const other = e.target.value === 'other'; setOtherName(other); update('print_owner_name', other ? form.print_owner_name || form.owner_name_snapshot : ''); }}><option value="default">Use my name</option><option value="other">Use another name</option></select></Field>
                {otherName && <Field label="Salesperson name printed on quotation" maxLength={120} value={form.print_owner_name} onChange={value => update('print_owner_name',value)} />}</>}</Fragment>)}</div>}
            {step === 1 && <><div className="q-grid">
                <Field label="Project type"><select value={form.project_type} onChange={e => update('project_type',e.target.value)}><option>Residential</option><option>Commercial</option></select></Field>
                <OptionSelect label="Inverter brand / make" placeholder="Select inverter…" value={form.inverter_brand} options={inverterMakes} onChange={v => update('inverter_brand',v)} />
                <Field label="GEB charge (₹)"><input aria-label="GEB charge" type="number" min="0" step="any" inputMode="decimal" placeholder="Included" value={form.geb_charge ?? ''} onChange={e => update('geb_charge',e.target.value)} /></Field>
                <Field label="GEDA charge (₹)"><input aria-label="GEDA charge" type="number" min="0" step="any" inputMode="decimal" placeholder="Included" value={form.geda_charge ?? ''} onChange={e => update('geda_charge',e.target.value)} /></Field>
                <p className="q-muted">GEB and GEDA: leave blank to show "Included". An amount is added to each option's net payable.</p>
                <p className="q-muted">Enter Module Wp and module count separately for each panel option. Capacity is calculated automatically.</p>
            </div>
            <h3 style={{marginTop:20}}>Price options</h3>
            <div className="q-price-options">{form.options.map((option,i) => <section className="q-option" key={i}><h3>{isFinalQuotation(initialRow) ? 'Selected panel' : `Panel option ${i + 1}`}</h3>
                <div className="q-grid">
                    <OptionSelect label={`Option ${i + 1} Module Wp`} placeholder="Select Module Wp…" value={optionSpecs(form, option).panel_wattage} options={moduleWps} onChange={value => updateOption(i, 'panel_wattage', value)} />
                    <ModuleCountSelect value={optionSpecs(form, option).solar_panel_qty} onChange={value => updateOption(i, 'solar_panel_qty', value)} />
                    <Field label="System Capacity (kWp)"><input aria-label={`Option ${i + 1} capacity (kWp)`} readOnly value={optionSpecs(form, option).capacity_kw} /></Field>
                    <OptionSelect label="Solar panel brand" placeholder="Select panel brand…" value={option.brandName} options={panelMakes} onChange={value => update('options',form.options.map((o,index) => index === i ? {...o,brandName:value} : o))} />{[['baseValue','Base value (₹)','number'],['discount','Discount (₹)','number'],['subsidy','Subsidy (₹)','number']].map(([key,label,type]) => <Field key={key} label={label} type={type} maxLength={80} value={option[key]} onChange={value => update('options',form.options.map((o,index) => index === i ? {...o,[key]:value} : o))} />)}</div>
                <dl><div><dt>Net payable</dt><dd>{money(totals[i].netPayableAmount)}</dd></div><div><dt>After subsidy</dt><dd>{money(totals[i].netPriceAfterSubsidy)}</dd></div></dl>
                {i === 0 && form.options.length > 1 && <div className="q-actions"><button onClick={() => update('options',form.options.map(o => ({...o,discount:option.discount})))}>Apply discount to all</button><button onClick={() => update('options',form.options.map(o => ({...o,subsidy:option.subsidy})))}>Apply subsidy to all</button></div>}
            </section>)}</div></>}
            {step === 1 && <>
                <h3>Standard notes</h3><ul className="q-standard-notes">{template.page2.notes.map(note => <li key={note}>{note}</li>)}</ul>
                <h3>Additional notes</h3>{form.custom_notes.map((note,i) => <div key={i} className="q-note"><Field label={`Note ${i + 1}`} type="textarea" maxLength={250} value={note} onChange={v => update('custom_notes',form.custom_notes.map((n,index) => index === i ? v : n))} /><button aria-label={`Remove note ${i + 1}`} onClick={() => update('custom_notes',form.custom_notes.filter((_,index) => index !== i))}><Trash2 size={18} /></button></div>)}
                {form.custom_notes.length < 5 && <button onClick={() => update('custom_notes',[...form.custom_notes,''])}><Plus size={16} /> Add note</button>}
                <h3 className="q-summary-title">Review quotation</h3><dl className="q-summary">{customerFields.map(([key,label,type]) => <div key={key}><dt>{label}</dt><dd>{(type === 'date' ? showDate(form[key]) : form[key]) || '—'}</dd></div>)}{[['project_type','Project type'],['inverter_brand','Inverter brand / make']].map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{form[key] || '—'}</dd></div>)}{[['geb_charge','GEB charge'],['geda_charge','GEDA charge']].map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{typeof chargeLabel(form[key]) === 'number' ? money(chargeLabel(form[key])) : 'Included'}</dd></div>)}</dl>
                {totals.map((option,i) => <div className="q-option" key={i}><strong>{option.brandName}</strong><p>{form.options[i].solar_panel_qty} modules × {form.options[i].panel_wattage} Wp · {form.options[i].capacity_kw} kWp</p><p>Base {money(option.baseValue)} · Discount {money(option.discount)} · Subsidy {money(option.subsidy)}</p><p>Net payable <strong>{money(option.netPayableAmount)}</strong> · After subsidy <strong>{money(option.netPriceAfterSubsidy)}</strong></p></div>)}
                <details><summary>Company, terms, warranty, BOM and bank details</summary><div className="q-template-summary"><h3>{template.company.name} {template.company.tagline}</h3><p>GST: {template.company.gstNo} · CIN: {template.company.cinNo}</p><p>{template.company.email}</p>{[['Terms and conditions',template.page3.termsAndConditions],['Warranties',template.page3.warranties]].map(([title,items]) => <section key={title}><h3>{title}</h3><dl className="q-summary">{items.map(item => <div key={item.sr}><dt>{item.parameter}</dt><dd>{item.remarks}</dd></div>)}</dl></section>)}<h3>Bill of materials</h3>{template.page3.bomItems.map(item => <p key={item.sr}><strong>{item.description}</strong> — {item.qty} {item.unit}, {item.size}, {item.make}</p>)}<h3>Other charges</h3><p>{template.page3.otherChargesText}</p><h3>Bank details</h3><p>{template.page3.bankDetails.accountName}</p><p>{template.page3.bankDetails.bankName} · {template.page3.bankDetails.branchName}</p><p>Account: {template.page3.bankDetails.accountNumber} · IFSC: {template.page3.bankDetails.ifscCode}</p><h3>Offices</h3><p>{template.footer.corporateOffice}</p><p>{template.footer.branchOffice}</p></div></details>
            </>}
        </div>
        <div className="q-editor-actions"><button disabled={step === 0 || busy} onClick={() => setStep(s => s - 1)}><ChevronLeft size={16} /> Back</button><button disabled={busy || !!recovery} onClick={saveDraft}><Save size={16} /> Save as draft</button>{step < lastStep ? <button className="q-primary" onClick={() => setStep(s => s + 1)}>Next <ChevronRight size={16} /></button> : <button className="q-primary" disabled={busy || !!recovery} onClick={preview}>{busy ? 'Saving…' : 'Preview'}</button>}</div>
    </div>;
}
