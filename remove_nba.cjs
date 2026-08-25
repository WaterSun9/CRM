const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const nbaStart = content.indexOf('<section>\n                            <h3 className="mb-2.5 px-1 text-[10px] font-black uppercase tracking-widest text-stone-400">Next best action</h3>');
const nbaEnd = content.indexOf('                        </button>\n                    </section>') + '                        </button>\n                    </section>'.length;

if (nbaStart !== -1 && nbaEnd !== -1) {
    content = content.substring(0, nbaStart) + content.substring(nbaEnd);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Removed Next Best Action block');
} else {
    console.error('Could not find Next Best Action block');
}

