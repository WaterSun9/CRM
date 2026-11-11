// Live updates only while the page is on screen. Supabase checks every customer
// change against every connected subscriber, so tabs left open in the
// background all day multiplied that work for nothing. The channel closes when
// the tab is hidden and reopens when it is shown again; onResume catches up on
// what changed in between.
export function liveWhileVisible(client, createChannel, onResume) {
    let channel = null;
    const open = () => { if (!channel) channel = createChannel(); };
    const close = () => { if (channel) { client.removeChannel(channel); channel = null; } };
    const onVisibility = () => {
        if (document.visibilityState === 'hidden') close();
        else if (!channel) { open(); onResume?.(); }
    };
    if (document.visibilityState !== 'hidden') open();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); close(); };
}
