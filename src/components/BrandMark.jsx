// ─── BrandMark.jsx ────────────────────────────────────────────────────────────
// The Watersun logo lock-up, used by every portal header and the login screen.
//
// One component so the branding cannot drift between portals again - the mark
// previously existed as five hand-rolled copies of an amber square with a
// generic sun icon and the word "Watersun" typed beside it.
//
// Two artworks ship with the brand:
//   blue  - navy wordmark, for LIGHT surfaces (all current headers)
//   white - white wordmark, for DARK surfaces (the stone-900 hero banners)
// The logo is 1500x330 (4.55:1), so it is always sized by HEIGHT and left to
// scale its own width.
// ──────────────────────────────────────────────────────────────────────────────

import logoBlue from '../assets/watersun-logo-blue.png';
import logoWhite from '../assets/watersun-logo-white.png';

const HEIGHTS = {
    sm: 'h-6',    // compact portal headers
    md: 'h-8',    // sidebar
    lg: 'h-11',   // login screen
};

export default function BrandMark({
    label = null,          // e.g. "Vendor Portal" - shown beside the mark
    variant = 'blue',      // 'blue' on light surfaces, 'white' on dark
    size = 'sm',
    className = '',
}) {
    const onDark = variant === 'white';

    return (
        <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
            <img
                src={onDark ? logoWhite : logoBlue}
                alt="Watersun Solar Energy"
                className={`${HEIGHTS[size] || HEIGHTS.sm} w-auto shrink-0 select-none`}
                draggable="false"
            />
            {label && (
                <>
                    <span className={`w-px self-stretch my-0.5 shrink-0 ${onDark ? 'bg-white/25' : 'bg-stone-200'}`} />
                    <span
                        className={`text-[9px] font-bold uppercase tracking-widest leading-tight truncate ${
                            onDark ? 'text-amber-300' : 'text-amber-600'
                        }`}
                    >
                        {label}
                    </span>
                </>
            )}
        </div>
    );
}
