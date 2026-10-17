import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCustomerHistory } from '../src/utils/customerHistory.js';
function fixture(total, failure) {
    const ranges = [], orders = [], filters = [];
    const records = Array.from({length:total}, (_,id)=>({id:String(id)}));
    const query = { select(){return this;}, or(filter){filters.push(filter);return this;},
        order(key, options){orders.push([key,options]);return this;},
        async range(from,to){ranges.push([from,to]);return failure ? {error:failure} : {data:records.slice(from,to+1)};} };
    return {client:{from:()=>query}, ranges, orders, filters};
}
test('customer history keeps paging beyond 35 and finishes without a redundant button',async()=>{
    const f=fixture(47);
    const first=await loadCustomerHistory(f.client,'customer',0);
    const second=await loadCustomerHistory(f.client,'customer',25);
    assert.equal(first.rows.length,25);assert.equal(first.hasMore,true);
    assert.equal(second.rows.length,22);assert.equal(second.hasMore,false);
    assert.equal(new Set([...first.rows,...second.rows].map(row=>row.id)).size,47);
    assert.ok(f.filters.every(filter=>filter==='customer_id.eq.customer,new_value.eq.customer'));
    assert.ok(f.orders.some(([field])=>field==='id'));
});
test('refreshing an expanded history stays below server row limits and preserves all loaded entries',async()=>{
    const f=fixture(1201);
    const result=await loadCustomerHistory(f.client,'customer',0,1200);
    assert.equal(result.rows.length,1200);assert.equal(result.hasMore,true);
    assert.deepEqual(f.ranges,[[0,500],[500,1000],[1000,1200]]);
    assert.equal(new Set(result.rows.map(row=>row.id)).size,1200);
});
test('an exact last page has no more button and errors propagate for retry',async()=>{
    const f=fixture(25);
    assert.equal((await loadCustomerHistory(f.client,'customer')).hasMore,false);
    await assert.rejects(loadCustomerHistory(fixture(0,new Error('Connection lost')).client,'customer'),/Connection lost/);
});
