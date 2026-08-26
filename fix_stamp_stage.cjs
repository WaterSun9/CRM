const fs = require('fs');

const file = 'src/components/StampPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `            const { data, error } = await supabase
                .from("admin")
                .select("*")
                .eq("stage", "DISCOM SUBMISSION")
                .is("deleted_at", null)
                .order("created_at", { ascending: false });`;

const replacementStr = `            const { data, error } = await supabase
                .from("admin")
                .select("*")
                // Remove strict stage eq to allow records that were sent to stamp maker but might not be formally in DISCOM SUBMISSION stage
                .is("deleted_at", null)
                .order("created_at", { ascending: false });`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Fixed StampPortal fetch query");
}

const target2Str = `                const isStampActive = record && !record.deleted_at &&
                    record.stage === 'DISCOM SUBMISSION' &&
                    record.discom_submission?.sent_to_stamp_maker === true &&
                    !record.discom_submission?.stamp_sent;`;

const replacement2Str = `                const isStampActive = record && !record.deleted_at &&
                    record.discom_submission?.sent_to_stamp_maker === true &&
                    !record.discom_submission?.stamp_sent;`;

if (content.includes(target2Str)) {
    content = content.replace(target2Str, replacement2Str);
    console.log("Fixed StampPortal realtime query");
}

fs.writeFileSync(file, content, 'utf8');
