import fs from 'node:fs';
const migration=fs.readFileSync('infra/postgres/migrations/021_handover_participant_limits.sql','utf8');
const service=fs.readFileSync('apps/api/src/deals/deal.service.ts','utf8');
const checks=[
 ['delivery limit is per participant',migration.includes("stage='delivery' AND participant_role=NEW.participant_role")],
 ['pickup remains stage-level',migration.includes("stage='pickup'")],
 ['legacy participant roles backfilled',migration.includes('e.actor_user_id = d.driver_id')&&migration.includes('e.actor_user_id = d.sender_id')],
 ['upload stores participant role',service.includes('participant_role,handover_session_id,synchronization_grade')],
 ['business conflict maps db race',service.includes("error?.code==='23514'")&&service.includes("EVIDENCE_LIMIT_REACHED")],
 ['counter query is role-aware',service.includes("participant_role=$3")],
];
for(const [name,ok] of checks){if(!ok){console.error('FAIL',name);process.exit(1)}}
console.log('PASS handover participant limits fixture');
