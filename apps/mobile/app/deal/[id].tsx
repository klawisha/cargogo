import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch, uploadDealHandoverEvidence } from '@/api/client';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import type { Deal } from '@/api/types';
import {colors,themedStyleSheet} from '@/theme/tokens';
import { Screen } from '@/ui/screen';
import {useLiveVersion} from '@/live/live-context';

const statusLabels: Record<Deal['status'], string> = {
  awaiting_payment: 'ОЧІКУЄ ОПЛАТИ', payment_secured: 'ОПЛАТА ЗАБЕЗПЕЧЕНА', awaiting_pickup: 'ОЧІКУЄ ЗАБОРУ',
  picked_up: 'ВАНТАЖ ЗАБРАНО', in_transit: 'В ДОРОЗІ', arrived: 'ВОДІЙ ПРИБУВ', delivered: 'ДОСТАВЛЕНО',
  completed: 'ЗАВЕРШЕНО', cancelled: 'СКАСОВАНО', disputed: 'СПІР', refunded: 'ПОВЕРНЕНО',
};

function apiMessage(data: any, fallback: string) {
  const code = data?.code ?? data?.error?.code;
  const messages: Record<string,string> = {
    PICKUP_CODE_INVALID: 'Невірний код забору.', PICKUP_CODE_LOCKED: 'Забагато невірних спроб. Код забору тимчасово заблоковано.',
    DELIVERY_CODE_INVALID: 'Невірний код доставки.', DELIVERY_CODE_LOCKED: 'Забагато невірних спроб. Код доставки тимчасово заблоковано.',
    PICKUP_EVIDENCE_REQUIRED: 'Спочатку зробіть фото вантажу при заборі.', DELIVERY_EVIDENCE_REQUIRED: 'Спочатку зробіть фото вантажу при доставці.', EVIDENCE_LIMIT_REACHED:'Для цього етапу вже додано максимум фото.', EVIDENCE_STATE_INVALID:'Фото зараз не можна додати на цьому етапі угоди.', EVIDENCE_IMAGE_REQUIRED:'Потрібне фото JPEG або PNG.',
    MOCK_PAYMENT_DISABLED: 'Тестова оплата вимкнена на сервері.', PAYMENT_PROVIDER_DISABLED: 'Платіжний провайдер не налаштований.', PAYMENT_PROVIDER_UNAVAILABLE: 'LiqPay тимчасово недоступний.', REVIEW_TOO_EARLY: 'Відгук можна залишити після завершення угоди.',
  };
  return messages[code] ?? data?.message ?? data?.error?.message ?? fallback;
}

export default function DealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const live=useLiveVersion('deals','disputes');
  const [deal,setDeal] = useState<Deal|null>(null);
  const [reason,setReason] = useState('Змінилися плани');
  const [pickupCode,setPickupCode] = useState('');
  const [deliveryCode,setDeliveryCode] = useState('');
  const [deliveryProblemReason,setDeliveryProblemReason] = useState<'recipient_refuses_code'|'recipient_claims_damage'|'recipient_unavailable'|'other'>('recipient_refuses_code');
  const [deliveryProblemNote,setDeliveryProblemNote] = useState('Одержувач відмовляється повідомити код підтвердження доставки.');
  const [rating,setRating] = useState('5');
  const [reviewComment,setReviewComment] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState('');
  const paymentOpened = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await apiFetch(`/deals/${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(apiMessage(d,'Не вдалося завантажити угоду'));
      setDeal(d);
    } catch(e) { setError(e instanceof Error ? e.message : 'Помилка'); }
  },[id]);

  useFocusEffect(useCallback(() => { void load(); }, [load])); useEffect(()=>{void load()},[live,load]);

  async function post(path:string, body?:object, success?:string) {
    if (!id) return;
    setBusy(path); setError(''); setNotice('');
    try {
      const r = await apiFetch(`/deals/${id}${path}`, { method:'POST', body: body ? JSON.stringify(body) : undefined });
      const d = await r.json();
      if (!r.ok) throw new Error(apiMessage(d,'Операцію не виконано'));
      if (d?.id === id) setDeal(d); else await load();
      if (success) setNotice(success);
      return d;
    } catch(e) { setError(e instanceof Error ? e.message : 'Помилка'); }
    finally { setBusy(''); }
  }

  async function cancel() { await post('/cancel',{reason},'Угоду скасовано'); }
  async function securePayment() { await post('/dev/secure-payment',undefined,'Тестову оплату захищено сервером'); }
  async function startHostedPayment() {
    if (!id) return;
    setBusy('payment-checkout'); setError(''); setNotice('');
    try {
      const r = await apiFetch(`/payments/deals/${id}/checkout`, { method:'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(apiMessage(d,'Не вдалося створити платіж'));
      if (d.alreadySecured) { await load(); return; }
      if (!d.checkoutUrl) throw new Error('Платіжний URL не отримано');
      paymentOpened.current = true;
      await Linking.openURL(d.checkoutUrl);
    } catch(e) { setError(e instanceof Error ? e.message : 'Помилка платежу'); }
    finally { setBusy(''); }
  }
  async function syncHostedPayment(showNotice=true) {
    if (!id) return;
    try {
      const r = await apiFetch(`/payments/deals/${id}/sync`, { method:'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(apiMessage(d,'Не вдалося перевірити платіж'));
      setDeal(d);
      if (showNotice) setNotice(d.paymentStatus==='secured' ? 'LiqPay підтвердив оплату' : 'Платіж ще не підтверджено');
    } catch(e) { if(showNotice)setError(e instanceof Error ? e.message : 'Помилка перевірки платежу'); }
  }
  async function getEvidenceLocation() {
    try {
      const permission=await Location.requestForegroundPermissionsAsync();
      if(!permission.granted) return {status:'permission_denied' as const};
      const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
      return {
        status:'captured' as const,
        latitude:pos.coords.latitude,
        longitude:pos.coords.longitude,
        accuracyMeters:pos.coords.accuracy,
        capturedAt:new Date(pos.timestamp).toISOString(),
      };
    } catch {
      return {status:'unavailable' as const};
    }
  }

  async function captureEvidence(stage:'pickup'|'delivery') {
    if(!id)return;
    setError('');setNotice('');setBusy(`evidence-${stage}`);
    try{
      const permission=await ImagePicker.requestCameraPermissionsAsync();
      if(!permission.granted)throw new Error('Дозвольте CargoGo доступ до камери, щоб зафіксувати стан вантажу.');
      const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:false,quality:.8,exif:false});
      if(result.canceled)return;
      const asset=result.assets?.[0];if(!asset?.uri)throw new Error('Фото не отримано від камери.');
      const mime=(asset.mimeType==='image/png'?'image/png':'image/jpeg') as 'image/jpeg'|'image/png';
      const location=await getEvidenceLocation();
      const uploaded=await uploadDealHandoverEvidence(String(id),stage,asset.uri,mime,undefined,location.status==='captured'?location:{status:location.status,latitude:0,longitude:0});
      if(!uploaded.ok)throw new Error(apiMessage(uploaded.data,'Не вдалося зберегти фото доказу'));
      setNotice(stage==='pickup'?'Фото при заборі захищено збережено. Місцезнаходження зафіксовано, якщо доступ дозволено. Тепер можна ввести код клієнта.':'Фото при доставці захищено збережено. Місцезнаходження зафіксовано, якщо доступ дозволено. Тепер можна ввести код отримувача.');
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Не вдалося зробити фото');}
    finally{setBusy('');}
  }
  async function openEvidence(evidenceId:string){
    if(!id)return;setError('');
    try{const r=await apiFetch(`/deals/${id}/evidence/${evidenceId}/access-url`,{method:'POST',body:JSON.stringify({purpose:'participant handover evidence review'})});const d=await r.json();if(!r.ok)throw new Error(apiMessage(d,'Не вдалося відкрити доказ'));await Linking.openURL(d.url)}catch(e){setError(e instanceof Error?e.message:'Не вдалося відкрити доказ')}
  }

  async function confirmPickup() { const ok = await post('/pickup/confirm',{code:pickupCode},'Код забору підтверджено'); if(ok)setPickupCode(''); }
  async function startTransit() { await post('/transit/start',undefined,'Перевезення розпочато'); }
  async function arrive() { await post('/arrive',undefined,'Прибуття зафіксовано'); }
  async function recipientPresent(){const loc=await getEvidenceLocation();const body:any={locationStatus:loc.status};if(loc.status==='captured'){body.latitude=loc.latitude;body.longitude=loc.longitude;body.accuracyMeters=loc.accuracyMeters??undefined}await post('/handover/recipient-present',body,'Вашу присутність підтверджено');}
  async function startHandover(){await post('/handover/start',undefined,'Сесію передачі розпочато — зробіть перше фото протягом 60 секунд');}
  async function confirmDelivery() { const ok = await post('/delivery/confirm',{code:deliveryCode},'Доставку підтверджено'); if(ok)setDeliveryCode(''); }
  async function reportDeliveryProblem() {
    if(!id)return;
    setBusy('delivery-problem');setError('');setNotice('');
    try{
      const loc=await getEvidenceLocation();
      const body:any={reason:deliveryProblemReason,note:deliveryProblemNote.trim()||'Проблема з підтвердженням доставки.',locationStatus:loc.status};
      if(loc.status==='captured'){
        body.latitude=loc.latitude;body.longitude=loc.longitude;
        if(loc.accuracyMeters!==null&&loc.accuracyMeters!==undefined)body.accuracyMeters=loc.accuracyMeters;
        if(loc.capturedAt)body.locationCapturedAt=loc.capturedAt;
      }
      const r=await apiFetch(`/deals/${id}/delivery/report-problem`,{method:'POST',body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok)throw new Error(apiMessage(d,'Не вдалося відкрити перевірку доставки'));
      setNotice('Підтвердження доставки передано на перевірку. Кошти заморожені до рішення.');
      await load();
      router.push({pathname:'/dispute/[dealId]',params:{dealId:String(id)}});
    }catch(e){setError(e instanceof Error?e.message:'Не вдалося повідомити про проблему');}
    finally{setBusy('');}
  }

  async function review() {
    const value = Number(rating);
    if (!Number.isInteger(value) || value < 1 || value > 5) { setError('Оцінка має бути від 1 до 5'); return; }
    await post('/reviews',{rating:value,comment:reviewComment.trim()||undefined},'Відгук збережено');
    await load();
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && paymentOpened.current) {
        paymentOpened.current = false;
        void syncHostedPayment(false);
      }
    });
    return () => sub.remove();
  }, [id]);

  const myReview = deal?.reviews?.find((x)=>x.isMine);

  return <Screen><ScrollView contentContainerStyle={{paddingBottom:40}} showsVerticalScrollIndicator={false}>
    <View style={s.header}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>←</Text></Pressable><View><Text style={s.eye}>УГОДА</Text><Text style={s.title}>{deal?.cargo.title??'Завантаження...'}</Text></View></View>
    {!!error&&<Text style={s.error}>{error}</Text>}{!!notice&&<Text style={s.success}>{notice}</Text>}
    {deal&&<>
      <View style={s.summary}><View style={s.row}><Text style={s.status}>{statusLabels[deal.status]}</Text><Text style={s.price}>{Math.round(deal.agreedAmountMinor/100)} ₴</Text></View><Text style={s.route}>{deal.cargo.pickupLabel} → {deal.cargo.deliveryLabel}</Text><Text style={s.meta}>Ви: {deal.role==='sender'?'ВІДПРАВНИК':'ПЕРЕВІЗНИК'} · PAYMENT: {deal.paymentStatus.toUpperCase()}</Text><Text style={s.meta}>Сервісний збір: {(deal.platformFeeMinor/100).toFixed(2)} ₴ · Перевізнику: {(deal.carrierAmountMinor/100).toFixed(2)} ₴ · SETTLEMENT: {deal.settlementStatus.toUpperCase()} · PAYOUT: {(deal.payoutStatus??'—').toUpperCase()}</Text></View>


      <View style={s.finance}><Text style={s.eye}>ФІНАНСИ УГОДИ</Text><View style={s.financeRow}><Text style={s.meta}>Сума клієнта</Text><Text style={s.financeValue}>{(deal.agreedAmountMinor/100).toFixed(2)} ₴</Text></View><View style={s.financeRow}><Text style={s.meta}>Отримає перевізник</Text><Text style={s.financeValue}>{(deal.carrierAmountMinor/100).toFixed(2)} ₴</Text></View><View style={s.financeRow}><Text style={s.meta}>Marketplace fee</Text><Text style={s.financeValue}>{(deal.platformFeeMinor/100).toFixed(2)} ₴</Text></View>{deal.role==='driver'&&<Text style={s.meta}>Сума виплати зафіксована в момент прийняття пропозиції та не зміниться для цієї угоди.</Text>}{deal.status==='completed'&&deal.platformNetRevenueMinor!==null&&<><View style={s.financeRow}><Text style={s.meta}>Acquiring</Text><Text style={s.financeCost}>− {(Number(deal.actualAcquiringFeeMinor??0)/100).toFixed(2)} ₴</Text></View><View style={s.financeRow}><Text style={s.meta}>Payout cost</Text><Text style={s.financeCost}>− {(Number(deal.actualPayoutFeeMinor??0)/100).toFixed(2)} ₴</Text></View><View style={s.financeRow}><Text style={s.meta}>CargoGo net</Text><Text style={s.financeNet}>{(deal.platformNetRevenueMinor/100).toFixed(2)} ₴ · {((deal.actualNetMarginBps??0)/100).toFixed(2)}%</Text></View></>}</View>

      <View style={s.progress}><Step label="ОПЛАТА" active={deal.paymentStatus==='secured'||deal.paymentStatus==='released'} /><Step label="ЗАБІР" active={['picked_up','in_transit','arrived','delivered','completed'].includes(deal.status)} /><Step label="В ДОРОЗІ" active={['in_transit','arrived','delivered','completed'].includes(deal.status)} /><Step label="ДОСТАВКА" active={deal.status==='completed'||deal.status==='delivered'} /></View>

      <View style={s.party}><Text style={s.label}>ВІДПРАВНИК</Text><Text style={s.value}>{deal.sender.displayName} · {deal.sender.verificationStatus}</Text><Text style={s.label}>ПЕРЕВІЗНИК</Text><Text style={s.value}>{deal.driver.displayName} · {deal.driver.verificationStatus}</Text>{deal.contactsAvailable?<><Text style={s.label}>КОНТАКТ ПІСЛЯ ОПЛАТИ</Text><Pressable onPress={()=>{const phone=deal.role==='sender'?deal.driver.phone:deal.sender.phone;if(phone)void Linking.openURL(`tel:${phone}`)}}><Text style={s.address}>{deal.role==='sender'?deal.driver.phone:deal.sender.phone}</Text></Pressable></>:<><Text style={s.label}>КОНТАКТИ ЗАХИЩЕНІ</Text><Text style={s.meta}>Номер телефону та приватний чат відкриються лише після server-confirmed secured payment.</Text></>}</View>

      {deal.contactsAvailable?<Pressable onPress={()=>router.push({pathname:'/chat/[dealId]',params:{dealId:String(id)}})} style={s.outline}><Text style={s.outlineText}>ВІДКРИТИ ЧАТ УГОДИ</Text><Text style={s.outlineText}>→</Text></Pressable>:<View style={s.privacy}><Text style={s.eye}>PRIVATE CHANNEL</Text><Text style={s.privacyTitle}>Чат відкриється після оплати</Text><Text style={s.meta}>До підтвердження платежу backend не повертає повідомлення, стан чату або номер іншої сторони.</Text></View>}
      {deal.actions.canOpenDispute&&<Pressable onPress={()=>router.push({pathname:'/dispute/[dealId]',params:{dealId:String(id)}})} style={[s.outline,{borderColor:colors.danger}]}><Text style={[s.outlineText,{color:colors.danger}]}>ВІДКРИТИ СПІР</Text><Text style={[s.outlineText,{color:colors.danger}]}>→</Text></Pressable>}

      <View style={s.privacy}><Text style={s.eye}>PRIVACY GATE</Text><Text style={s.privacyTitle}>{deal.privateLocationsAvailable?'Точні адреси відкриті':'Точні адреси приховані'}</Text>{deal.privateLocationsAvailable?<><Text style={s.label}>ЗАБРАТИ</Text><Text style={s.address}>{deal.cargo.privatePickupAddress}</Text><Text style={s.label}>ДОСТАВИТИ</Text><Text style={s.address}>{deal.cargo.privateDeliveryAddress}</Text></>:<Text style={s.meta}>Backend не повертає точні адреси до server-confirmed secured payment.</Text>}</View>

      {deal.actions.canDevSecurePayment&&<Action title="DEV: ЗАБЕЗПЕЧИТИ ОПЛАТУ" note="Лише для локальної Alpha. У production цей endpoint заборонений сервером." busy={!!busy} onPress={securePayment}/>} 
      {deal.actions.canStartHostedPayment&&<Action title={deal.paymentMode==='liqpay_sandbox'?'ОПЛАТИТИ ЧЕРЕЗ LIQPAY · SANDBOX':'ОПЛАТИТИ ЧЕРЕЗ LIQPAY'} note={deal.paymentMode==='liqpay_sandbox'?'Відкриється справжня тестова платіжна сторінка LiqPay. Реальні кошти не списуються.':'Відкриється захищена платіжна сторінка LiqPay.'} busy={!!busy} onPress={startHostedPayment}/>}
      {deal.actions.canSyncHostedPayment&&<Pressable disabled={!!busy} onPress={()=>void syncHostedPayment(true)} style={s.outline}><Text style={s.outlineText}>ПЕРЕВІРИТИ СТАТУС ОПЛАТИ</Text><Text style={s.outlineText}>↻</Text></Pressable>} 

      <View style={s.evidencePanel}>
        <Text style={s.eye}>HANDOVER EVIDENCE</Text>
        <Text style={s.evidenceTitle}>Фотофіксація передачі</Text>
        <Text style={s.meta}>При доставці обидві сторони роблять 1–3 фото в одній серверній сесії. Перше фото за 60 с = STRONG, 61–120 с = ACCEPTABLE, пізніше = LATE. Сервер фіксує час, GPS/accuracy та SHA-256.</Text>
        <View style={s.evidenceStats}><Text style={s.meta}>Забір: {deal.evidenceSummary.pickupCount}/3</Text><Text style={s.meta}>Доставка: водій {deal.evidenceSummary.driverDeliveryCount}/3 · клієнт {deal.evidenceSummary.senderDeliveryCount}/3</Text></View>
        {deal.role==='driver'&&deal.actions.canUploadPickupEvidence&&<Pressable disabled={!!busy} onPress={()=>void captureEvidence('pickup')} style={s.camera}><Text style={s.cameraText}>{busy==='evidence-pickup'?'ЗБЕРЕЖЕННЯ...':'ЗРОБИТИ ФОТО ПРИ ЗАБОРІ'}</Text><Text style={s.cameraText}>◎</Text></Pressable>}
        {deal.actions.canUploadDeliveryEvidence&&<Pressable disabled={!!busy} onPress={()=>void captureEvidence('delivery')} style={s.camera}><Text style={s.cameraText}>{busy==='evidence-delivery'?'ЗБЕРЕЖЕННЯ...':deal.role==='driver'?'ФОТО ВОДІЯ · ДОСТАВКА':'МОЄ ФОТО · СТАН ВАНТАЖУ'}</Text><Text style={s.cameraText}>◎</Text></Pressable>}
        {!!deal.handoverEvidence?.length&&<View style={s.evidenceList}>{deal.handoverEvidence.map((e)=><Pressable key={e.id} onPress={()=>void openEvidence(e.id)} style={s.evidenceRow}><View><Text style={s.value}>{e.stage==='pickup'?'ЗАБІР':e.participantRole==='sender'?'ДОСТАВКА · КЛІЄНТ':'ДОСТАВКА · ВОДІЙ'} · ФОТО</Text><Text style={s.meta}>{new Date(e.capturedAt).toLocaleString()}{e.synchronizationGrade?` · ${e.synchronizationGrade.toUpperCase()}`:''} · SHA {e.sha256.slice(0,10)}…{e.location?` · GPS ±${Math.round(e.location.accuracyMeters??0)}м`:''}</Text></View><Text style={s.outlineText}>ПЕРЕГЛЯНУТИ →</Text></Pressable>)}</View>}
      </View>
      {deal.role==='sender'&&deal.status==='awaiting_pickup'&&!deal.evidenceSummary.pickupReady&&<View style={s.waitingEvidence}><Text style={s.label}>КОД ЗАБОРУ ЗАБЛОКОВАНО</Text><Text style={s.meta}>Код з'явиться після того, як перевізник зробить фото вантажу при передачі.</Text></View>}
      {deal.role==='sender'&&deal.status==='arrived'&&!deal.evidenceSummary.deliveryReady&&<View style={s.waitingEvidence}><Text style={s.label}>КОД ДОСТАВКИ ЗАБЛОКОВАНО</Text><Text style={s.meta}>Код з'явиться після фото вантажу в місці доставки.</Text></View>}

      {deal.role==='sender'&&deal.codes.pickup&&<CodeCard title="КОД ЗАБОРУ" code={deal.codes.pickup} note="Повідомте його водію тільки після фактичної передачі вантажу."/>}
      {deal.role==='sender'&&deal.codes.delivery&&<><CodeCard title="КОД ДОСТАВКИ" code={deal.codes.delivery} note="Повідомте його водію тільки після того, як отримали й оглянули вантаж."/><View style={s.waitingEvidence}><Text style={s.label}>Є ПРОБЛЕМА З ВАНТАЖЕМ?</Text><Text style={s.meta}>Не повідомляйте код. Відкрийте спір одразу та зробіть фото стану вантажу — кошти залишаться замороженими до перевірки.</Text></View></>}

      {deal.role==='driver'&&deal.status==='awaiting_pickup'&&!deal.evidenceSummary.pickupReady&&<Text style={s.flowHint}>1. Зробіть фото вантажу → 2. отримайте код від клієнта → 3. введіть код.</Text>}
      {deal.actions.canConfirmPickup&&<CodeInput title="ПІДТВЕРДИТИ ЗАБІР" value={pickupCode} setValue={setPickupCode} button="ПІДТВЕРДИТИ КОД ЗАБОРУ" busy={!!busy} onPress={confirmPickup}/>} 
      {deal.actions.canStartTransit&&<Action title="ПОЧАТИ ПЕРЕВЕЗЕННЯ" note="Натискайте після того, як вантаж уже фізично у вас." busy={!!busy} onPress={startTransit}/>} 
      {deal.actions.canMarkArrived&&<Action title="Я ПРИБУВ ДО ОТРИМУВАЧА" note="Після цього попросіть код доставки." busy={!!busy} onPress={arrive}/>} 
      {deal.actions.canConfirmRecipientPresent&&<Action title="Я НА МІСЦІ" note="Підтвердіть, що ви зустрілися з водієм. Геолокація буде зафіксована, якщо дозволена." busy={!!busy} onPress={recipientPresent}/>}
      {deal.actions.canStartHandover&&<Action title="ПОЧАТИ ПЕРЕДАЧУ ВАНТАЖУ" note="Після натискання обидві сторони мають зробити перше фото протягом 60 секунд." busy={!!busy} onPress={startHandover}/>}
      {deal.status==='arrived'&&deal.handoverSession?.startedAt&&<View style={s.waitingEvidence}><Text style={s.label}>СИНХРОННА ФОТОФІКСАЦІЯ</Text><Text style={s.meta}>Сесію розпочато {new Date(deal.handoverSession.startedAt).toLocaleTimeString()}. Зробіть щонайменше одне фото кожна сторона. Код відкриється тільки після обох фото.</Text></View>}
      {deal.role==='driver'&&deal.status==='arrived'&&!deal.evidenceSummary.deliveryReady&&<Text style={s.flowHint}>1. Зробіть фото доставки → 2. отримайте код від одержувача → 3. введіть код.</Text>}
      {deal.actions.canConfirmDelivery&&<CodeInput title="ПІДТВЕРДИТИ ДОСТАВКУ" value={deliveryCode} setValue={setDeliveryCode} button="ЗАВЕРШИТИ ДОСТАВКУ" busy={!!busy} onPress={confirmDelivery}/>} 
      {deal.actions.canReportDeliveryProblem&&<View style={s.problemBox}><Text style={s.eye}>НЕМАЄ КОДУ?</Text><Text style={s.actionTitle}>Проблема з підтвердженням доставки</Text><Text style={s.meta}>Використовуйте лише якщо вантаж уже доставлено/пред'явлено отримувачу, фото зроблено, але код отримати неможливо. Виплата автоматично не відбудеться — відкриється спір.</Text><View style={s.reasonRow}>{[
        ['recipient_refuses_code','НЕ ДАЄ КОД'],['recipient_claims_damage','КАЖЕ, ЩО ПОШКОДЖЕНО'],['recipient_unavailable','НЕМАЄ ОТРИМУВАЧА']
      ].map(([v,l])=><Pressable key={v} onPress={()=>setDeliveryProblemReason(v as any)} style={[s.reasonChip,deliveryProblemReason===v&&s.reasonChipActive]}><Text style={[s.reasonChipText,deliveryProblemReason===v&&s.reasonChipTextActive]}>{l}</Text></Pressable>)}</View><TextInput value={deliveryProblemNote} onChangeText={setDeliveryProblemNote} multiline maxLength={1500} style={[s.input,{minHeight:76,textAlignVertical:'top',paddingTop:12}]}/><Pressable disabled={!!busy||deliveryProblemNote.trim().length<3} onPress={()=>void reportDeliveryProblem()} style={s.problemButton}><Text style={s.problemButtonText}>{busy==='delivery-problem'?'ФІКСУЄМО...':'ОТРИМУВАЧ НЕ ПІДТВЕРДЖУЄ ДОСТАВКУ'}</Text></Pressable></View>}

      {deal.status==='completed'&&<View style={s.completed}><Text style={s.eye}>COMPLETED</Text><Text style={s.completedTitle}>Перевезення завершено</Text><Text style={s.meta}>Платіж захоплено після підтвердження доставки, комісія CargoGo зафіксована, а виплата перевізнику завершена або передана payout-провайдеру.</Text></View>}

      {deal.actions.canReview&&!myReview&&<View style={s.review}><Text style={s.eye}>ВІДГУК</Text><Text style={s.label}>ОЦІНКА 1–5</Text><TextInput value={rating} onChangeText={setRating} keyboardType="number-pad" maxLength={1} style={s.input}/><TextInput value={reviewComment} onChangeText={setReviewComment} placeholder="Коментар (необов'язково)" placeholderTextColor={colors.muted} multiline maxLength={1000} style={[s.input,{minHeight:80,textAlignVertical:'top',paddingTop:12}]}/><Pressable disabled={!!busy} onPress={review} style={s.primary}><Text style={s.primaryText}>ЗАЛИШИТИ ВІДГУК</Text></Pressable></View>}
      {myReview&&<View style={s.reviewDone}><Text style={s.eye}>ВАШ ВІДГУК</Text><Text style={s.reviewStars}>{'★'.repeat(myReview.rating)}{'☆'.repeat(5-myReview.rating)}</Text>{myReview.comment&&<Text style={s.meta}>{myReview.comment}</Text>}</View>}

      {deal.actions.canCancel&&<View style={s.cancel}><Text style={s.label}>СКАСУВАТИ ДО ОПЛАТИ</Text><TextInput value={reason} onChangeText={setReason} style={s.input}/><Pressable disabled={!!busy} onPress={cancel} style={s.danger}><Text style={s.dangerText}>СКАСУВАТИ УГОДУ</Text></Pressable></View>}

      {!!deal.events?.length&&<View style={s.timeline}><Text style={s.eye}>AUDIT TIMELINE</Text>{deal.events.map((e,i)=><View key={`${e.createdAt}-${i}`} style={s.event}><Text style={s.eventType}>{e.type}</Text><Text style={s.meta}>{new Date(e.createdAt).toLocaleString()}</Text></View>)}</View>}
    </>}
  </ScrollView></Screen>;
}

function Step({label,active}:{label:string;active:boolean}){return <View style={s.step}><View style={[s.dot,active&&s.dotActive]}/><Text style={[s.stepText,active&&s.stepTextActive]}>{label}</Text></View>}
function Action({title,note,busy,onPress}:{title:string;note:string;busy:boolean;onPress:()=>void}){return <View style={s.actionBox}><Text style={s.actionTitle}>{title}</Text><Text style={s.meta}>{note}</Text><Pressable disabled={busy} onPress={onPress} style={s.primary}><Text style={s.primaryText}>{busy?'...':'ПРОДОВЖИТИ'}</Text><Text style={s.primaryText}>→</Text></Pressable></View>}
function CodeCard({title,code,note}:{title:string;code:string;note:string}){return <View style={s.codeCard}><Text style={s.eye}>{title}</Text><Text style={s.code}>{code}</Text><Text style={s.meta}>{note}</Text></View>}
function CodeInput({title,value,setValue,button,busy,onPress}:{title:string;value:string;setValue:(v:string)=>void;button:string;busy:boolean;onPress:()=>void}){return <View style={s.actionBox}><Text style={s.actionTitle}>{title}</Text><TextInput value={value} onChangeText={(v)=>setValue(v.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor={colors.muted} style={s.codeInput}/><Pressable disabled={busy||value.length!==6} onPress={onPress} style={[s.primary,(busy||value.length!==6)&&{opacity:.5}]}><Text style={s.primaryText}>{button}</Text></Pressable></View>}

const s=themedStyleSheet(()=>({
  header:{minHeight:84,flexDirection:'row',alignItems:'center',gap:15,borderBottomWidth:1,borderBottomColor:colors.border},back:{width:40,height:40,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},backText:{color:colors.text,fontSize:20,fontWeight:'900'},eye:{color:colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.3},title:{color:colors.text,fontSize:20,fontWeight:'900',marginTop:4},error:{color:colors.danger,fontSize:12,marginTop:10},success:{color:colors.success,fontSize:12,marginTop:10},
  summary:{padding:17,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,marginTop:12},finance:{padding:16,borderWidth:1,borderColor:colors.border,marginTop:12},financeRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,marginTop:8},financeValue:{color:colors.text,fontSize:12,fontWeight:'900'},financeCost:{color:colors.textSecondary,fontSize:12,fontWeight:'900'},financeNet:{color:colors.accent,fontSize:12,fontWeight:'900'},row:{flexDirection:'row',justifyContent:'space-between',gap:12},status:{color:colors.text,fontSize:12,fontWeight:'900'},price:{color:colors.accent,fontSize:20,fontWeight:'900'},route:{color:colors.text,fontSize:15,fontWeight:'900',marginTop:12},meta:{color:colors.textSecondary,fontSize:10,lineHeight:16,marginTop:5},
  progress:{flexDirection:'row',justifyContent:'space-between',paddingVertical:16,borderBottomWidth:1,borderBottomColor:colors.border},step:{alignItems:'center',flex:1},dot:{width:8,height:8,borderWidth:1,borderColor:colors.muted,marginBottom:6},dotActive:{backgroundColor:colors.accent,borderColor:colors.accent},stepText:{color:colors.muted,fontSize:7,fontWeight:'900'},stepTextActive:{color:colors.text},
  party:{paddingVertical:16,borderBottomWidth:1,borderBottomColor:colors.border},label:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:1.1,marginTop:8},value:{color:colors.text,fontSize:13,fontWeight:'800',marginTop:4},outline:{minHeight:48,borderWidth:1,borderColor:colors.accent,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:14},outlineText:{color:colors.accent,fontSize:10,fontWeight:'900'},
  privacy:{padding:17,borderWidth:1,borderColor:colors.border,marginTop:14},privacyTitle:{color:colors.text,fontSize:17,fontWeight:'900',marginTop:5},address:{color:colors.text,fontSize:13,fontWeight:'800',marginTop:4},actionBox:{padding:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,marginTop:12},actionTitle:{color:colors.text,fontSize:15,fontWeight:'900'},primary:{minHeight:48,backgroundColor:colors.accent,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:12},primaryText:{color:colors.accentText,fontSize:10,fontWeight:'900'},
  evidencePanel:{padding:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,marginTop:12},evidenceTitle:{color:colors.text,fontSize:17,fontWeight:'900',marginTop:5},evidenceStats:{flexDirection:'row',justifyContent:'space-between',marginTop:10},camera:{minHeight:50,borderWidth:1,borderColor:colors.accent,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:12},cameraText:{color:colors.accent,fontSize:10,fontWeight:'900'},evidenceList:{marginTop:10},evidenceRow:{borderTopWidth:1,borderTopColor:colors.border,paddingVertical:11,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},waitingEvidence:{padding:14,borderWidth:1,borderColor:colors.border,marginTop:12},flowHint:{color:colors.textSecondary,fontSize:10,lineHeight:16,marginTop:10},problemBox:{padding:16,borderWidth:1,borderColor:colors.danger,backgroundColor:colors.surface,marginTop:12},reasonRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},reasonChip:{borderWidth:1,borderColor:colors.border,paddingHorizontal:9,paddingVertical:8},reasonChipActive:{borderColor:colors.danger},reasonChipText:{color:colors.textSecondary,fontSize:8,fontWeight:'900'},reasonChipTextActive:{color:colors.danger},problemButton:{minHeight:48,borderWidth:1,borderColor:colors.danger,alignItems:'center',justifyContent:'center',paddingHorizontal:12,marginTop:10},problemButtonText:{color:colors.danger,fontSize:9,fontWeight:'900',textAlign:'center'},
  codeCard:{padding:18,borderWidth:1,borderColor:colors.accent,marginTop:12},code:{color:colors.accent,fontSize:36,fontWeight:'900',letterSpacing:7,marginVertical:8},codeInput:{height:60,borderWidth:1,borderColor:colors.border,color:colors.text,fontSize:28,fontWeight:'900',letterSpacing:8,textAlign:'center',marginTop:12},completed:{padding:17,borderWidth:1,borderColor:colors.success,marginTop:12},completedTitle:{color:colors.text,fontSize:18,fontWeight:'900',marginTop:5},
  review:{padding:16,borderWidth:1,borderColor:colors.border,marginTop:12},input:{minHeight:48,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:12,marginTop:8},reviewDone:{padding:16,borderWidth:1,borderColor:colors.border,marginTop:12},reviewStars:{color:colors.accent,fontSize:20,letterSpacing:3,marginTop:8},cancel:{marginTop:16,padding:16,borderWidth:1,borderColor:colors.border},danger:{height:46,borderWidth:1,borderColor:colors.danger,alignItems:'center',justifyContent:'center',marginTop:10},dangerText:{color:colors.danger,fontSize:10,fontWeight:'900'},timeline:{marginTop:18},event:{borderTopWidth:1,borderTopColor:colors.border,paddingVertical:11},eventType:{color:colors.text,fontSize:12,fontWeight:'900'},
}));
