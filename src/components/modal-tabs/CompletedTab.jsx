import React from 'react';

export default function CompletedTab() {
    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-2">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Project Completion</h4>
                <p className="text-xs text-stone-500 font-medium">This project has reached final completion.</p>
            </div>
        </div>
    );
}
