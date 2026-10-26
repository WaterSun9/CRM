import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { COMMENT_MAX, canComment, canDeleteComment, cleanComment, commentError, commentFits, formatDateTime, missingTable } from './serviceLabels';

const SHOWN = 200;

// The comment thread of one complaint, oldest first. Anyone who can see the
// complaint (office, channel partners, the technician on the job) can add one;
// the database fills in the author's name and role. No editing; admin can delete.
// Reloads whenever `issue` changes (the complaint list reloads every 15 seconds).
export default function ComplaintComments({ issue, user, busy, run }) {
    const [comments, setComments] = useState(null);
    const [failed, setFailed] = useState('');
    const [reload, setReload] = useState(0);
    const [text, setText] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    // Shown next to the box too: on a phone the complaint's message line is far above.
    const [postError, setPostError] = useState('');
    const issueId = issue.id;
    const userType = user?.userType;

    useEffect(() => {
        let active = true;
        (async () => {
            // The newest SHOWN comments, then shown oldest first (newest last).
            const { data, error } = await supabase.from('service_issue_comments')
                .select('id, author_id, author_name, author_role, body, created_at')
                .eq('issue_id', issueId).order('created_at', { ascending: false }).limit(SHOWN);
            if (!active) return;
            if (error) { setFailed(missingTable(error) ? 'Comments are not set up yet.' : 'Could not load the comments. They load again in a few seconds.'); return; }
            setComments([...(data || [])].reverse()); setFailed('');
        })();
        return () => { active = false; };
    }, [issueId, issue, reload]);

    const post = event => {
        event.preventDefault();
        const body = cleanComment(text);
        if (!commentFits(body) || !run) return;
        setPostError('');
        run(async () => {
            const { error } = await supabase.from('service_issue_comments').insert({ issue_id: issueId, author_id: user.id, body });
            if (error) { const message = commentError(error); setPostError(message); throw new Error(message); }
            setText('');
            setReload(n => n + 1);
            return 'Comment added.';
        }, '', 'issue');
    };

    const remove = comment => run?.(async () => {
        const { data, error } = await supabase.from('service_issue_comments').delete().eq('id', comment.id).select('id');
        if (error) throw new Error(commentError(error));
        if (!data?.length) throw new Error('This comment could not be deleted. It may already be gone.');
        setConfirmId(null);
        setReload(n => n + 1);
        return 'Comment deleted.';
    }, '', 'issue');

    const canDelete = canDeleteComment(userType) && Boolean(run);
    return <section aria-label="Comments" className="space-y-2 border-t pt-3">
        <h3 className="text-sm font-bold">Comments{comments ? ` (${comments.length})` : ''}</h3>
        {failed && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{failed}</p>}
        {!comments && !failed && <p className="text-xs text-stone-400">Loading comments…</p>}
        {comments?.length === 0 && <p className="text-xs text-stone-500">No comments yet.</p>}
        {comments?.length > 0 && <ul className="space-y-2">{comments.map(comment => <li key={comment.id}
            className={`rounded-lg p-2 text-sm ${comment.author_id && comment.author_id === user?.id ? 'bg-amber-50' : 'bg-stone-50'}`}>
            <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <strong className="text-stone-800 break-words">{comment.author_name || 'Former user'}</strong>
                {comment.author_role && <span className="text-stone-500">{comment.author_role}</span>}
                <span className="text-stone-400">{formatDateTime(comment.created_at)}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words">{comment.body}</p>
            {canDelete && (confirmId === comment.id
                ? <span className="mt-1 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => remove(comment)} className="min-h-11 rounded-lg bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-50">Yes, delete</button>
                    <button type="button" onClick={() => setConfirmId(null)} className="min-h-11 rounded-lg border bg-white px-3 text-xs font-bold">Keep</button>
                </span>
                : <button type="button" disabled={busy} onClick={() => setConfirmId(comment.id)} className="mt-1 min-h-11 rounded-lg px-2 text-xs font-bold text-red-700 disabled:opacity-50">Delete</button>)}
        </li>)}</ul>}
        {canComment(userType) && comments && run && <form onSubmit={post} className="space-y-2">
            <label className="block text-xs font-semibold">Add a comment
                <textarea value={text} maxLength={COMMENT_MAX} rows={3} onChange={event => setText(event.target.value)}
                    className="mt-1 block w-full rounded-lg border p-2 text-sm" />
            </label>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-stone-500">{text.length}/{COMMENT_MAX}</span>
                <button disabled={busy || !commentFits(text)} className="min-h-11 rounded-lg bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40">Add comment</button>
            </div>
            {postError && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">{postError}</p>}
        </form>}
    </section>;
}
