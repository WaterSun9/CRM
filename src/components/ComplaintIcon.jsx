// "Raise complaint" icon: a wrench crossed with a screwdriver, drawn in the
// lucide style (24 x 24, 2px stroke) so it sits next to lucide icons. Not a flag,
// so it is never mixed up with the red-flag button beside it.
export default function ComplaintIcon({ size = 24, className = '', ...props }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
            {/* wrench, bottom-left to top-right (lucide "wrench") */}
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            {/* screwdriver, top-left to bottom-right: handle, shaft, tip */}
            <path d="m2.5 4.5 2-2 4 4-2 2z" />
            <path d="m7.5 7.5 11 11" />
            <path d="m18.5 18.5 2.5 2.5" />
        </svg>
    );
}
