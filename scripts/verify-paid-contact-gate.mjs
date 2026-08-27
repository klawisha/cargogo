import fs from 'node:fs';
const chat=fs.readFileSync('apps/api/src/chats/chat.service.ts','utf8');
const deal=fs.readFileSync('apps/api/src/deals/deal.service.ts','utf8');
const checks=[
 ['chat list hides unpaid',chat.includes("d.payment_status IN ('secured','captured','released')")],
 ['chat endpoints reject unpaid',chat.includes('CHAT_PAYMENT_REQUIRED')],
 ['send checks payment',chat.includes('!this.paymentUnlocked(deal)')],
 ['deal selects phones',deal.includes('sender.phone_e164 AS sender_phone')&&deal.includes('driver.phone_e164 AS driver_phone')],
 ['phones gated by payment',deal.includes('contactUnlocked ? r.sender_phone : null')&&deal.includes('contactUnlocked ? r.driver_phone : null')],
 ['contact availability flag',deal.includes('contactsAvailable: contactUnlocked')],
];
for(const [n,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${n}`);
if(checks.some(x=>!x[1]))process.exit(1);
