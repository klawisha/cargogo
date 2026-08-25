import fs from 'node:fs';
const need=(file,parts)=>{const s=fs.readFileSync(file,'utf8');for(const p of parts)if(!s.includes(p))throw new Error(`${file}: missing ${p}`)};
need('infra/postgres/migrations/025_live_experience.sql',['CREATE TABLE IF NOT EXISTS live_signal','CREATE TABLE IF NOT EXISTS push_delivery_outbox','archived_at','cg_live_message']);
need('apps/api/src/chats/chat.service.ts',["24*60*60*1000",'pushTransient','CHAT_READ_ONLY']);
need('apps/api/src/notifications/notification.service.ts',['archiveRead','push_delivery_outbox','exp.host/--/api/v2/push/send']);
need('apps/mobile/src/live/live-context.tsx',['/live/poll','useLiveVersion']);
need('apps/mobile/src/notifications/push-bridge.tsx',['getExpoPushTokenAsync','deal-events']);
need('apps/mobile/src/ui/waiting-pulse.tsx',['ROUTE PULSE','ЗЛОВИТИ']);
console.log('PASS live experience architecture fixture');
