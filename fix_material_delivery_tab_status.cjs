const fs = require('fs');
let file = 'src/components/modal-tabs/MaterialDeliveryTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the select from the top bar
const oldTopBarRegex = /<h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-3">\s*Material Delivery & Dispatch[\s\S]*?<\/select>\s*<\/h4>/;
content = content.replace(oldTopBarRegex, '<h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Material Delivery & Dispatch</h4>');

// 2. Add local optimistic state
content = content.replace(
    /const \[vendorConfirm, setVendorConfirm\] = useState\(\{ isOpen: false, vendorName: '' \}\);/,
    "const [vendorConfirm, setVendorConfirm] = useState({ isOpen: false, vendorName: '' });\n    const [localDeliveryStatus, setLocalDeliveryStatus] = useState(null);"
);

// 3. Replace the SectionHeader for equip_details with a custom one
const oldSectionHeader = `<SectionHeader 
                    title="Material Delivery Details" 
                    id="equip_details" 
                    icon={Zap} 
                    isEditable={isEditable} 
                    editingSection={editingSection} 
                    setEditingSection={setEditingSection} 
                />`;

const newSectionHeader = `<div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-4">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Zap size={12} /> Material Delivery Details
                    </h3>
                    <div className="flex items-center gap-3">
                        <select
                            value={localDeliveryStatus || editData.delivery_status || 'PENDING'}
                            onChange={async (e) => {
                                const newStat = e.target.value;
                                setLocalDeliveryStatus(newStat);
                                setEditData(p => ({ ...p, delivery_status: newStat }));
                                try {
                                    await onUpdate(customer.id, { delivery_status: newStat });
                                } catch(err) {}
                            }}
                            className={\`text-[9px] font-extrabold px-2 py-0.5 rounded-full outline-none cursor-pointer tracking-normal shadow-xs \${
                                (localDeliveryStatus || editData.delivery_status) === 'DELIVERED' 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                    : (localDeliveryStatus || editData.delivery_status) === 'IN_TRANSIT'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-stone-100 text-stone-600 border border-stone-300'
                            }\`}
                        >
                            <option value="PENDING">Status: Pending</option>
                            <option value="IN_TRANSIT">Status: In Transit</option>
                            <option value="DELIVERED">Status: Delivered</option>
                        </select>
                        {isEditable && (
                            <button 
                                type="button"
                                onClick={() => {
                                    const isOpening = editingSection !== 'equip_details';
                                    if (setEditingSection) {
                                        setEditingSection(isOpening ? 'equip_details' : null);
                                    }
                                }}
                                className="text-stone-400 hover:text-amber-600 transition cursor-pointer"
                                title="Edit Section"
                            >
                                <Edit3 size={13} />
                            </button>
                        )}
                    </div>
                </div>`;

content = content.replace(oldSectionHeader, newSectionHeader);

fs.writeFileSync(file, content, 'utf8');
console.log("Moved status dropdown and made it optimistic.");
