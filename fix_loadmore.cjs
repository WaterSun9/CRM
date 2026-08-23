const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');

// Replace fetchStageCustomers with a robust version that handles appending and setHasMore
const oldFunc = `    const fetchStageCustomers = async (stage = selectedStage, page = 0) => {
        setLoading(true);
        let query = supabase
            .from('admin')
            .select('*')
            .eq('stage', stage)
            .order('created_at', { ascending: false })
            .range(page * 50, (page + 1) * 50 - 1);
            
        if (isChannelPartnerOffice) {
            query = query.ilike('channel_partner', partnerName);
        } else if (channelPartnerFilter) {
            query = query.ilike('channel_partner', channelPartnerFilter);
        }

        const { data, error } = await query;
        if (!error && data) {
            setCustomers(data);
        } else {
            console.error("Error fetching stage customers:", error);
            setCustomers([]);
        }
        setLoading(false);
    };`;

const newFunc = `    const fetchStageCustomers = async (stage = selectedStage, pageNum = 0) => {
        setLoading(true);
        let query = supabase
            .from('admin')
            .select('*')
            .eq('stage', stage)
            .order('created_at', { ascending: false })
            .range(pageNum * 50, (pageNum + 1) * 50 - 1);
            
        if (isChannelPartnerOffice) {
            query = query.ilike('channel_partner', partnerName);
        } else if (channelPartnerFilter) {
            query = query.ilike('channel_partner', channelPartnerFilter);
        }

        const { data, error } = await query;
        if (!error && data) {
            if (pageNum === 0) {
                setCustomers(data);
            } else {
                setCustomers(prev => {
                    // Prevent duplicate keys
                    const existingIds = new Set(prev.map(c => c.id));
                    const uniqueNew = data.filter(c => !existingIds.has(c.id));
                    return [...prev, ...uniqueNew];
                });
            }
            setHasMore(data.length === 50);
        } else {
            console.error("Error fetching stage customers:", error);
            if (pageNum === 0) setCustomers([]);
        }
        setLoading(false);
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchStageCustomers(selectedStage, nextPage);
    };`;

content = content.replace(oldFunc, newFunc);

// Also reset page to 0 on stage change
const oldEffect = `    useEffect(() => {

        fetchMetricsAndMeta();
        fetchStageCustomers(selectedStage, 0);
    }, [selectedStage, channelPartnerFilter, isChannelPartnerOffice, partnerName]);`;

const newEffect = `    useEffect(() => {
        setPage(0);
        fetchMetricsAndMeta();
        fetchStageCustomers(selectedStage, 0);
    }, [selectedStage, channelPartnerFilter, isChannelPartnerOffice, partnerName]);`;

content = content.replace(oldEffect, newEffect);

fs.writeFileSync('src/components/Dashboard.jsx', content);
console.log("LoadMore and page reset patched!");
