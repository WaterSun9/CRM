const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `            </main>
            )}

            {/* Unified Add Lead Modal */}`;

const replacement = `            </main>
            </div>
            )}

            {/* Unified Add Lead Modal */}`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed missing closing div');
