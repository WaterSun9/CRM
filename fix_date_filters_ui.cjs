const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// Dashboard month filter
const target1 = `<div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search batch #, driver, vehicle, vendor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:border-amber-400 transition"
                    />
                </div>`;
const replacement1 = `<div className="relative w-full sm:w-80 flex gap-2">
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
                    <input
                        type="month"
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 outline-none focus:bg-white focus:border-amber-400 transition"
                    />
                </div>`;
content = content.replace(target1, replacement1);

// Project selection month filter
const target2 = `<input
                                            type="text"
                                            placeholder="Filter projects..."
                                            value={projectSearchQuery}
                                            onChange={e => setProjectSearchQuery(e.target.value)}
                                            className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:bg-white focus:border-amber-400 w-44"
                                        />`;
const replacement2 = `<input
                                            type="text"
                                            placeholder="Filter projects..."
                                            value={projectSearchQuery}
                                            onChange={e => setProjectSearchQuery(e.target.value)}
                                            className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:bg-white focus:border-amber-400 w-44"
                                        />
                                        <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-0.5">
                                            <span className="text-[10px] font-bold text-stone-500 whitespace-nowrap">Del. Month:</span>
                                            <input
                                                type="month"
                                                value={projectMonthFilter}
                                                onChange={e => setProjectMonthFilter(e.target.value)}
                                                className="bg-transparent border-none py-1 text-[10px] font-bold text-stone-700 outline-none w-24"
                                            />
                                        </div>`;
content = content.replace(target2, replacement2);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed month filter UI rendering.");
