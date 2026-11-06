import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { formatDateTime } from './serviceLabels';

// "Raised 26 Oct 2026, 11:40 am by SUN PARTNER OFFICE": who raised the complaint, from its
// history (service_issue_events 'raised', written by the database with the login's name).
export default function RaisedBy({ issue }) {
    const [name, setName] = useState(null);
    useEffect(() => {
        let active = true;
        setName(null);
        supabase.from('service_issue_events').select('actor_name').eq('issue_id', issue.id).eq('event', 'raised').limit(1)
            .then(({ data }) => { if (active) setName(data?.[0]?.actor_name || ''); });
        return () => { active = false; };
    }, [issue.id]);
    return <p className="text-xs text-stone-600">Raised {formatDateTime(issue.created_at)}{name ? <> by <strong className="text-stone-800">{name}</strong></> : ''}{issue.channel_partner_name ? ` · Partner: ${issue.channel_partner_name}` : ''}</p>;
}
