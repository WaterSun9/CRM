/**
 * Watersun CRM - Sync Storage Bucket Files to Database
 * 
 * Scans the 'customer-documents' bucket in Supabase and creates the database
 * records in the 'documents' table matching each file to its customer by
 * customer_id, folder_no, or consumer_no.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_OR_ANON = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_OR_ANON) {
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_OR_ANON);

// Document type detector based on file name
function detectDocType(fileName) {
    const name = fileName.toLowerCase();
    if (name.includes('adhaar_front') || name.includes('aadhar_front') || name.includes('adhaar_card_front')) return 'adhaar_card_front';
    if (name.includes('adhaar_back') || name.includes('aadhar_back') || name.includes('adhaar_card_back')) return 'adhaar_card_back';
    if (name.includes('adhaar') || name.includes('aadhar')) return 'adhaar_card_front';
    if (name.includes('pan')) return 'pan_card';
    if (name.includes('light_bill') || name.includes('bill') || name.includes('electricity')) return 'light_bill';
    if (name.includes('index') || name.includes('index_2')) return 'index_2';
    if (name.includes('bank') || name.includes('passbook') || name.includes('cheque')) return 'bank_details';
    if (name.includes('stamp') || name.includes('pm_surya')) return 'pm_surya_ghar_stamp';
    if (name.includes('geo') || name.includes('geotag')) return 'geo_tag_image';
    if (name.includes('feasibility')) return 'feasibilty_document';
    if (name.includes('token')) return 'subsidy_token_photo';
    if (name.includes('dcr')) return 'dcr_certificate';
    if (name.includes('sign') || name.includes('signature')) return 'signature_pic';
    return 'extra_docs';
}

function getMimeType(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'application/octet-stream';
}

async function syncBucket() {
    console.log('🔍 Fetching customers from database...');
    const { data: customers, error: custError } = await supabase
        .from('admin')
        .select('id, folder_no, consumer_no, phone_number, customer_name')
        .is('deleted_at', null);

    if (custError) {
        console.error('❌ Error fetching customers:', custError);
        return;
    }

    console.log(`Found ${customers.length} customers in database.`);

    // Build lookup maps
    const idMap = new Map();
    const folderMap = new Map();
    const consumerMap = new Map();

    customers.forEach(c => {
        if (c.id) idMap.set(c.id, c);
        if (c.folder_no) folderMap.set(String(c.folder_no).trim(), c);
        if (c.consumer_no) consumerMap.set(String(c.consumer_no).trim(), c);
    });

    console.log('📂 Scanning bucket "customer-documents"...');

    // List top-level folders/files
    const { data: rootItems, error: listError } = await supabase.storage
        .from('customer-documents')
        .list('', { limit: 1000 });

    if (listError) {
        console.error('❌ Error listing bucket:', listError);
        return;
    }

    console.log(`Found ${rootItems.length} top-level folders/items.`);
    let syncedCount = 0;

    for (const item of rootItems) {
        // If it's a folder (e.g. named by customer_id or folder_no)
        if (item.id === null || !item.metadata) {
            const folderName = item.name;
            const targetCust = idMap.get(folderName) || folderMap.get(folderName) || consumerMap.get(folderName);

            if (targetCust) {
                // List files in this subfolder
                const { data: subFiles } = await supabase.storage
                    .from('customer-documents')
                    .list(folderName, { limit: 100 });

                if (subFiles && subFiles.length > 0) {
                    for (const f of subFiles) {
                        if (f.name === '.emptyFolderPlaceholder') continue;
                        const storagePath = `${folderName}/${f.name}`;
                        const docType = detectDocType(f.name);
                        const fileType = getMimeType(f.name);

                        // Upsert into documents table
                        await supabase.from('documents').upsert({
                            customer_id: targetCust.id,
                            file_name: f.name,
                            storage_path: storagePath,
                            file_type: fileType,
                            doc_type: docType
                        }, { onConflict: 'storage_path' });

                        syncedCount++;
                    }
                }
            }
        } else {
            // Direct root file: try matching by filename prefix (e.g. "4848_adhaar.pdf")
            const cleanName = item.name;
            const prefixMatch = cleanName.match(/^([0-9a-zA-Z_-]+?)[_.-]/);
            if (prefixMatch) {
                const key = prefixMatch[1];
                const targetCust = idMap.get(key) || folderMap.get(key) || consumerMap.get(key);
                if (targetCust) {
                    const docType = detectDocType(cleanName);
                    const fileType = getMimeType(cleanName);

                    await supabase.from('documents').upsert({
                        customer_id: targetCust.id,
                        file_name: cleanName,
                        storage_path: cleanName,
                        file_type: fileType,
                        doc_type: docType
                    }, { onConflict: 'storage_path' });

                    syncedCount++;
                }
            }
        }
    }

    console.log(`\n🎉 DONE! Synced ${syncedCount} documents into the database.`);
}

syncBucket();
