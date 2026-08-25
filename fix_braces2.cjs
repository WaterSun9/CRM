const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `            )}
        </div>
    );
}`;

const replacement = `            )}
        </>
    );
}`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed ending tag');
