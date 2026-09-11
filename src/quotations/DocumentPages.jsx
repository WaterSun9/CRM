import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Page1 } from './template/components/pages/Page1';
import { Page2 } from './template/components/pages/Page2';
import { Page3 } from './template/components/pages/Page3';
import { documentFor } from './model';
import './quotation.css';

export function fitQuotationPages(root) {
    const pages = Array.from(root.querySelectorAll('.a4-page'));
    for (const page of pages) {
        const body = page.firstElementChild;
        const footer = page.lastElementChild;
        body.style.transform = ''; body.style.height = ''; body.style.width = '100%'; body.style.flex = '0 0 auto';
        const style = getComputedStyle(page);
        const available = page.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - footer.offsetHeight - 4;
        const height = body.scrollHeight;
        if (height > available) {
            const scale = available / height;
            if (scale < 0.67) throw new Error('The quotation content is too long for three readable A4 pages. Shorten the address or custom notes.');
            body.style.transformOrigin = 'top left';
            body.style.width = `${100 / scale}%`;
            body.style.transform = `scale(${scale})`;
            body.style.height = `${height * scale}px`;
        }
    }
    return pages;
}
export default function DocumentPages({ row,highlights = false,exportMode = false }) {
    const data = useMemo(() => documentFor(row),[row]);
    const root = useRef(null);
    const [error,setError] = useState('');
    useLayoutEffect(() => {
        const fit = () => { try { fitQuotationPages(root.current); setError(''); } catch (err) { setError(err.message); } };
        fit();
        document.fonts.ready.then(fit);
    },[data]);
    const fields = new Set(['page1.customerName','page1.customerPhone','page1.capacityKw','page1.yoursTrulyName','page1.yoursTrulyPhone','page2.solarPanelMake','page2.solarPanelQty','page2.inverterBrand',...data.page2.brandOptions.flatMap((_,i) => ['brandName','baseValue','discount','subsidy'].map(k => `page2.brandOptions.${i}.${k}`))]);
    return <div className="quotation-paper" ref={root}>{error && !exportMode && <p role="alert" className="q-error">{error}</p>}<Page1 data={data} highlightChanges={highlights} changedFields={fields} /><Page2 data={data} highlightChanges={highlights} changedFields={fields} /><Page3 data={data} /></div>;
}
