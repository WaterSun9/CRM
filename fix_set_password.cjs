const fs = require('fs');

const file = 'src/components/SetPassword.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        // Fallback: if the event already fired before this component mounted,
        // check for an existing session directly.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setStatus(prev => (prev === 'checking' ? 'ready' : prev));
            else setStatus(prev => (prev === 'checking' ? 'invalid' : prev));
        });

        return () => listener.subscription.unsubscribe();
    }, []);`;

const replacementStr = `        // Fallback: wait a moment for Supabase to process the URL hash before giving up
        let timeoutId;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setStatus(prev => (prev === 'checking' ? 'ready' : prev));
            } else {
                // Wait up to 3 seconds for the PASSWORD_RECOVERY event to fire
                timeoutId = setTimeout(() => {
                    setStatus(prev => (prev === 'checking' ? 'invalid' : prev));
                }, 3000);
            }
        });

        return () => {
            listener.subscription.unsubscribe();
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated SetPassword.jsx to handle race condition");
} else {
    console.log("Target not found!");
}
