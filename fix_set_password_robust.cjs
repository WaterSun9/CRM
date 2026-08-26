const fs = require('fs');

const file = 'src/components/SetPassword.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        // Fallback: wait a moment for Supabase to process the URL hash before giving up
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

const replacementStr = `        // Fallback: wait for Supabase to fully consume the URL hash before checking the session
        let timeoutId;
        const checkSession = async (attempts = 0) => {
            // Supabase automatically clears the URL hash once it successfully logs the user in.
            // If the hash is still there, it's still processing. If we check getSession now, 
            // we might accidentally grab the OLD session (if an admin was already logged in).
            if (window.location.hash.includes('type=recovery') && attempts < 10) {
                timeoutId = setTimeout(() => checkSession(attempts + 1), 500);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setStatus(prev => (prev === 'checking' ? 'ready' : prev));
            } else {
                setStatus(prev => (prev === 'checking' ? 'invalid' : prev));
            }
        };

        // Give the listener 1 second to fire naturally, otherwise fallback to our manual check
        timeoutId = setTimeout(() => checkSession(0), 1000);

        return () => {
            listener.subscription.unsubscribe();
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated SetPassword.jsx to wait for hash consumption");
} else {
    console.log("Target not found!");
}
