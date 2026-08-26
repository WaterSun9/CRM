const fs = require('fs');
let file = 'src/components/Dashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update fetchMetricsAndMeta
const oldFetch = `    const fetchMetricsAndMeta = async () => {
        if (isDemoMode) {
            setMetrics(getDemoMetrics(isChannelPartnerOffice ? partnerName : channelPartnerFilter));
            setMeta(getDemoMetadata());
            return;
        }
        const targetPartner = isChannelPartnerOffice ? partnerName : (channelPartnerFilter?.trim() || null);
        const [metricsRes, metaRes] = await Promise.all([
            supabase.rpc('get_dashboard_metrics', { 
                p_channel_partner: targetPartner 
            }),
            supabase.from('metadata').select('category, label'),
        ]);

        if (!metricsRes.error && metricsRes.data) {
            setMetrics(metricsRes.data);
        } else {
            console.error('Metrics fetch error:', metricsRes.error);
            setMetrics({
                totalProjects: 0, completedCount: 0, liveProjects: 0, loanCount: 0, cashCount: 0, stageCounts: {}
            });
        }

        if (!metaRes.error && metaRes.data) {
            const grouped = {};
            metaRes.data.forEach(({ category, label }) => {
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(label);
            });
            setMeta(grouped);
        }
    };`;

const newFetch = `    const fetchMetricsAndMeta = async () => {
        if (isDemoMode) {
            const demoBatches = JSON.parse(localStorage.getItem('watersun_demo_delivery_batches') || '[]');
            setMetrics({
                ...getDemoMetrics(isChannelPartnerOffice ? partnerName : channelPartnerFilter),
                deliveryBatchesCount: demoBatches.length
            });
            setMeta(getDemoMetadata());
            return;
        }
        const targetPartner = isChannelPartnerOffice ? partnerName : (channelPartnerFilter?.trim() || null);
        const [metricsRes, metaRes, batchesRes] = await Promise.all([
            supabase.rpc('get_dashboard_metrics', { 
                p_channel_partner: targetPartner 
            }),
            supabase.from('metadata').select('category, label'),
            supabase.from('delivery_batches').select('*', { count: 'exact', head: true })
        ]);

        let finalMetrics = {
            totalProjects: 0, completedCount: 0, liveProjects: 0, loanCount: 0, cashCount: 0, stageCounts: {}, deliveryBatchesCount: 0
        };

        if (!metricsRes.error && metricsRes.data) {
            finalMetrics = { ...metricsRes.data };
        } else {
            console.error('Metrics fetch error:', metricsRes.error);
        }
        
        if (!batchesRes.error) {
            finalMetrics.deliveryBatchesCount = batchesRes.count || 0;
        }
        setMetrics(finalMetrics);

        if (!metaRes.error && metaRes.data) {
            const grouped = {};
            metaRes.data.forEach(({ category, label }) => {
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(label);
            });
            setMeta(grouped);
        }
    };`;

content = content.replace(oldFetch, newFetch);

// 2. Extract deliveryBatchesCount and pass it to NavBtn
const oldCounts = `    const subsidyTagCount = metrics?.subsidyTagCount || 0;
    const loanTagCount = metrics?.loanTagCount || 0;`;

const newCounts = `    const subsidyTagCount = metrics?.subsidyTagCount || 0;
    const loanTagCount = metrics?.loanTagCount || 0;
    const deliveryBatchesCount = metrics?.deliveryBatchesCount || 0;`;

content = content.replace(oldCounts, newCounts);

const oldNavBtn = `<NavBtn view="delivery_batches" icon={Truck} label="Delivery Batches" count={0} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />`;
const newNavBtn = `<NavBtn view="delivery_batches" icon={Truck} label="Delivery Batches" count={deliveryBatchesCount} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />`;

content = content.replace(oldNavBtn, newNavBtn);

fs.writeFileSync(file, content, 'utf8');
console.log("Added batch counts to sidebar");
