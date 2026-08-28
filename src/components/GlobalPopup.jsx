// ─── GlobalPopup.jsx ────────────────────────────────────────────────────────
// A single, app-wide replacement for native alert()/confirm(). Generalizes
// the custom popup design that already existed locally in StampPortal.jsx
// so every component can use the same look via useGlobalPopup(), instead of
// each screen inventing its own or falling back to the plain browser dialog.
// ────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

const GlobalPopupContext = createContext(null);

const ICONS = {
    error: { Icon: AlertCircle, className: 'bg-rose-100 text-rose-600' },
    warning: { Icon: AlertTriangle, className: 'bg-amber-100 text-amber-700' },
    success: { Icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
};

export function GlobalPopupProvider({ children }) {
    const [popup, setPopup] = useState(null);

    const showAlert = useCallback((message, opts = {}) => {
        return new Promise((resolve) => {
            setPopup({
                mode: 'alert',
                message,
                title: opts.title || 'Attention',
                type: opts.type || 'warning',
                onResolve: () => { setPopup(null); resolve(); },
            });
        });
    }, []);

    // Save / Discard / Keep Editing. showConfirm only offers save-or-stay, which
    // traps the user whenever validation makes saving impossible — there was no
    // way out of the Add Lead form once it was dirty.
    const showChoice = useCallback((message, opts = {}) => {
        return new Promise((resolve) => {
            setPopup({
                mode: 'choice',
                message,
                title: opts.title || 'Unsaved changes',
                type: opts.type || 'warning',
                confirmLabel: opts.confirmLabel || 'Save',
                discardLabel: opts.discardLabel || 'Discard',
                cancelLabel: opts.cancelLabel || 'Keep Editing',
                onResolve: (result) => { setPopup(null); resolve(result); },
            });
        });
    }, []);

    const showConfirm = useCallback((message, opts = {}) => {
        return new Promise((resolve) => {
            setPopup({
                mode: 'confirm',
                message,
                title: opts.title || 'Please confirm',
                type: opts.type || 'warning',
                confirmLabel: opts.confirmLabel || 'Continue',
                cancelLabel: opts.cancelLabel || 'Cancel',
                onResolve: (result) => { setPopup(null); resolve(result); },
            });
        });
    }, []);

    return (
        <GlobalPopupContext.Provider value={{ showAlert, showConfirm, showChoice }}>
            {children}
            {popup && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={() => { if (popup.mode === 'alert') popup.onResolve(); else if (popup.mode === 'choice') popup.onResolve('cancel'); }}
                >
                    <div
                        className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl border border-stone-150 animate-in zoom-in-95 duration-200 text-center space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${ICONS[popup.type].className}`}>
                            {(() => { const { Icon } = ICONS[popup.type]; return <Icon size={24} />; })()}
                        </div>
                        <div>
                            <h4 className="text-sm font-extrabold text-stone-850">{popup.title}</h4>
                            <p className="text-xs text-stone-500 font-medium mt-1.5 leading-relaxed whitespace-pre-line">{popup.message}</p>
                        </div>
                        {popup.mode === 'choice' ? (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => popup.onResolve('confirm')}
                                    className={`w-full py-3 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-[0.98] ${popup.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                                >
                                    {popup.confirmLabel}
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => popup.onResolve('cancel')}
                                        className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-[0.98]"
                                    >
                                        {popup.cancelLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => popup.onResolve('discard')}
                                        className="flex-1 py-3 bg-white border border-stone-200 text-stone-500 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 rounded-xl text-xs font-bold transition cursor-pointer active:scale-[0.98]"
                                    >
                                        {popup.discardLabel}
                                    </button>
                                </div>
                            </div>
                        ) : popup.mode === 'alert' ? (
                            <button
                                type="button"
                                onClick={() => popup.onResolve()}
                                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-[0.98]"
                            >
                                Understood
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => popup.onResolve(false)}
                                    className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-[0.98]"
                                >
                                    {popup.cancelLabel}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => popup.onResolve(true)}
                                    className={`flex-1 py-3 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-[0.98] ${popup.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                                >
                                    {popup.confirmLabel}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </GlobalPopupContext.Provider>
    );
}

export function useGlobalPopup() {
    const ctx = useContext(GlobalPopupContext);
    if (!ctx) throw new Error('useGlobalPopup must be used within a GlobalPopupProvider');
    return ctx;
}
