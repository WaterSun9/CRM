const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldFilterBar = `<div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs">
                <div className="relative w-full sm:w-80 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search batch #, driver, vehicle..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:border-amber-400 transition"
                        />
                    </div>
                    <div className="flex gap-1">
                        <input
                            type="month"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 outline-none focus:bg-white focus:border-amber-400 transition"
                        />
                        <button 
                            type="button" 
                            onClick={() => setAppliedMonthFilter(monthFilter)} 
                            className="bg-stone-800 hover:bg-stone-700 text-white px-3 rounded-xl text-xs font-bold cursor-pointer transition"
                        >
                            Apply
                        </button>
                        {appliedMonthFilter && (
                            <button 
                                type="button" 
                                onClick={() => { setMonthFilter(''); setAppliedMonthFilter(''); }} 
                                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 rounded-xl text-xs font-bold cursor-pointer transition"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {['ALL', 'IN_TRANSIT', 'DELIVERED'].map((status) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            className={\`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer \${
                                statusFilter === status
                                    ? 'bg-stone-900 text-white shadow-xs'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                            }\`}
                        >
                            {status === 'ALL' ? 'All Batches' : status === 'IN_TRANSIT' ? 'In Transit' : 'Delivered'}
                        </button>
                    ))}
                </div>
            </div>`;

const newFilterBar = `<div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search batch #, driver, vehicle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:border-amber-400 transition"
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    {/* Month Filter Moved to Right Side */}
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">Dispatch Month</span>
                        <input
                            type="month"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="bg-stone-50 border border-stone-200 rounded-xl px-2 py-1.5 text-xs font-medium text-stone-800 outline-none focus:bg-white focus:border-amber-400 transition"
                        />
                        <button 
                            type="button" 
                            onClick={() => setAppliedMonthFilter(monthFilter)} 
                            className="bg-stone-800 hover:bg-stone-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition"
                        >
                            Apply
                        </button>
                        {appliedMonthFilter && (
                            <button 
                                type="button" 
                                onClick={() => { setMonthFilter(''); setAppliedMonthFilter(''); }} 
                                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="h-6 w-px bg-stone-200 hidden sm:block"></div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {['ALL', 'IN_TRANSIT', 'DELIVERED'].map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setStatusFilter(status)}
                                className={\`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer \${
                                    statusFilter === status
                                        ? 'bg-stone-900 text-white shadow-xs'
                                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                                }\`}
                            >
                                {status === 'ALL' ? 'All Batches' : status === 'IN_TRANSIT' ? 'In Transit' : 'Delivered'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>`;

content = content.replace(oldFilterBar, newFilterBar);

fs.writeFileSync(file, content, 'utf8');
console.log("Moved month filter to the right side.");
