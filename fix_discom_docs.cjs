const fs = require('fs');
const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetDocsStr = `                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">File Status</span>
                                            {renderStatusBadge(selectedCust.file_status ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DCR Certificate</span>
                                            {renderStatusBadge(selectedCust.dcr_certificate ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Signature Photo</span>
                                            {renderStatusBadge(selectedCust.signature_pic ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Stamp</span>
                                            {renderStatusBadge(selectedCust.stamp ? 'Yes' : 'Pending', 'Pending')}
                                        </div>`;

const newDocsStr = `                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">File Status</span>
                                            <div className="flex items-center gap-2">
                                                {selectedCust.file_status && <a href={getViewUrl(selectedCust.file_status)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-1"><Download size={14} /></a>}
                                                {renderStatusBadge(selectedCust.file_status ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DCR Certificate</span>
                                            <div className="flex items-center gap-2">
                                                {selectedCust.dcr_certificate && <a href={getViewUrl(selectedCust.dcr_certificate)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-1"><Download size={14} /></a>}
                                                {renderStatusBadge(selectedCust.dcr_certificate ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Signature Photo</span>
                                            <div className="flex items-center gap-2">
                                                {selectedCust.signature_pic && <a href={getViewUrl(selectedCust.signature_pic)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-1"><Download size={14} /></a>}
                                                {renderStatusBadge(selectedCust.signature_pic ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Stamp</span>
                                            <div className="flex items-center gap-2">
                                                {selectedCust.stamp && <a href={getViewUrl(selectedCust.stamp)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-1"><Download size={14} /></a>}
                                                {renderStatusBadge(selectedCust.stamp ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>`;

content = content.replace(targetDocsStr, newDocsStr);

fs.writeFileSync(file, content, 'utf8');
console.log('Added Discom Submission download links');
