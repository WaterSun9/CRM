import React from 'react';

export default class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('GLOBAL REACT ERROR:', error);
        console.error('COMPONENT STACK:', errorInfo?.componentStack);
        this.setState({ error, errorInfo });
    }

    handleReload = () => window.location.reload();
    handleReset = () => this.setState({ hasError: false, error: null, errorInfo: null });

    render() {
        if (!this.state.hasError) return this.props.children;
        const { error, errorInfo } = this.state;
        return (
            <div style={{ minHeight:'100vh', background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
                <div style={{ width:'100%', maxWidth:'760px', background:'#fff', border:'1px solid #fecaca', borderRadius:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', overflow:'hidden', fontFamily:'Inter, system-ui, sans-serif' }}>
                    <div style={{ padding:'20px 24px', borderBottom:'1px solid #fee2e2', background:'#fff5f5', display:'flex', alignItems:'center', gap:'12px' }}>
                        <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', color:'#dc2626', fontWeight:800, fontSize:'16px' }}>!</div>
                        <div>
                            <h1 style={{ margin:0, fontSize:'16px', fontWeight:700, color:'#7f1d1d' }}>Something went wrong</h1>
                            <p style={{ margin:'2px 0 0', fontSize:'13px', color:'#b91c1c' }}>The application encountered an unexpected error.</p>
                        </div>
                    </div>
                    <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'20px' }}>
                        <div>
                            <p style={{ margin:'0 0 8px', fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#a8a29e' }}>Error</p>
                            <div style={{ background:'#0c0a09', borderRadius:'10px', padding:'14px 16px', overflowX:'auto' }}>
                                <pre style={{ margin:0, fontSize:'12px', color:'#fca5a5', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{error?.message || 'Unknown error'}</pre>
                            </div>
                        </div>
                        {errorInfo?.componentStack && (
                            <div>
                                <p style={{ margin:'0 0 8px', fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#a8a29e' }}>Component Stack</p>
                                <div style={{ background:'#f5f5f4', borderRadius:'10px', padding:'14px 16px', overflowY:'auto', maxHeight:'220px' }}>
                                    <pre style={{ margin:0, fontSize:'11px', color:'#57534e', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{errorInfo.componentStack}</pre>
                                </div>
                            </div>
                        )}
                        {error?.stack && (
                            <details>
                                <summary style={{ cursor:'pointer', fontSize:'13px', fontWeight:600, color:'#44403c', userSelect:'none' }}>Full Stack Trace</summary>
                                <div style={{ marginTop:'8px', background:'#f5f5f4', borderRadius:'10px', padding:'14px 16px', overflowY:'auto', maxHeight:'220px' }}>
                                    <pre style={{ margin:0, fontSize:'11px', color:'#57534e', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{error.stack}</pre>
                                </div>
                            </details>
                        )}
                        <div style={{ display:'flex', gap:'10px' }}>
                            <button onClick={this.handleReload} style={{ padding:'10px 18px', borderRadius:'10px', background:'#1c1917', color:'#fff', fontSize:'13px', fontWeight:600, border:'none', cursor:'pointer' }}>Reload Application</button>
                            <button onClick={this.handleReset} style={{ padding:'10px 18px', borderRadius:'10px', background:'#f5f5f4', color:'#44403c', fontSize:'13px', fontWeight:600, border:'1px solid #e7e5e4', cursor:'pointer' }}>Try Again</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
