export const NON_EVM={ton:{name:'TON',symbol:'TON'},tron:{name:'TRON',symbol:'TRX'},solana:{name:'Solana',symbol:'SOL'},bitcoin:{name:'Bitcoin',symbol:'BTC'}};
const neHex=/^[0-9a-f]{64}$/i,ne58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const neUnits=(v,d)=>{const s=BigInt(v).toString().padStart(d+1,'0');return d?(s.slice(0,-d)+'.'+s.slice(-d)).replace(/\.?0+$/,''):s;};
const neTokenUnits=(v,d)=>{d=Number(d);if(!Number.isInteger(d)||d<0||d>36)throw Error('Неподдерживаемые decimals');return neUnits(v,d);};
const neUnsigned=v=>{if(!/^\d+$/.test(String(v)))throw Error('Некорректное целое число от провайдера');return BigInt(v);};
export function parseLossless(text){let out='',i=0;while(i<text.length){const c=text[i];if(c==='"'){const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"')break;}out+=text.slice(start,i);}else if(c==='-'||/[0-9]/.test(c)){const start=i++;while(i<text.length&&/[0-9.eE+-]/.test(text[i]))i++;const n=text.slice(start,i);out+=/^-?\d{16,}$/.test(n)?JSON.stringify(n):n;}else{out+=c;i++;}}return JSON.parse(out);}
const neSchedule=new Map();
async function neFetch(url,body){const host=new URL(url).hostname;for(let attempt=0;attempt<2;attempt++){const delay=host==='api.trongrid.io'?600:host==='toncenter.com'?1100:0,now=Date.now(),scheduled=Math.max(now,neSchedule.get(host)||0);if(delay){neSchedule.set(host,scheduled+delay);if(scheduled>now)await new Promise(resolve=>setTimeout(resolve,scheduled-now));}const r=await fetch(url,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(14000)});if(r.status===429&&attempt===0){await new Promise(resolve=>setTimeout(resolve,1600));continue;}if(!r.ok)throw Error('HTTP '+r.status+' · '+host);return parseLossless(await r.text());}}
async function neRpc(url,method,params){const r=await neFetch(url,{jsonrpc:'2.0',id:1,method,params});if(r.error||!Object.hasOwn(r,'result'))throw Error(r.error?.message||'Неверный RPC-ответ');return r.result;}
const neTry=async(endpoint,fn)=>{try{return{endpoint,ok:true,data:await fn()};}catch(e){return{endpoint,ok:false,error:e.message.slice(0,180)};}};
export function tonAddress(value){const s=value.trim();if(/^(0|-1):[0-9a-f]{64}$/i.test(s))return s.toLowerCase();if(!/^[A-Za-z0-9_+/-]{48}$/.test(s))throw Error('Неверный TON-адрес.');const b=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(b.length!==36||(b[0]&0x80)||![0x11,0x51].includes(b[0]))throw Error('Нужен TON mainnet-адрес.');let crc=0;for(const x of b.slice(0,34)){crc^=x<<8;for(let i=0;i<8;i++)crc=((crc<<1)^((crc&0x8000)?0x1021:0))&65535;}if(b[34]!==crc>>8||b[35]!==(crc&255))throw Error('Неверная контрольная сумма TON-адреса.');const wc=b[1]>127?b[1]-256:b[1];if(![0,-1].includes(wc))throw Error('Неподдерживаемый workchain.');return wc+':'+Array.from(b.slice(2,34),x=>x.toString(16).padStart(2,'0')).join('');}
function neDecode58(s){let n=0n;for(const c of s){const i=ne58.indexOf(c);if(i<0)throw Error('Неверный Base58');n=n*58n+BigInt(i);}const bytes=[];while(n){bytes.unshift(Number(n&255n));n>>=8n;}for(const c of s){if(c!=='1')break;bytes.unshift(0);}return new Uint8Array(bytes);}
async function neSha(b){return new Uint8Array(await crypto.subtle.digest('SHA-256',b));}
async function neTronAddress(s){if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s))throw Error('Неверный TRON-адрес.');const b=neDecode58(s),c=await neSha(await neSha(b.slice(0,21)));if(b.length!==25||b[0]!==65||!b.slice(21).every((x,i)=>x===c[i]))throw Error('Неверная контрольная сумма TRON-адреса.');return s;}
async function neTronHex(s){await neTronAddress(s);return Array.from(neDecode58(s).slice(0,21),b=>b.toString(16).padStart(2,'0')).join('');}
async function neTronBase58(hex){if(!/^41[0-9a-f]{40}$/i.test(hex))return hex;const b=Uint8Array.from(hex.match(/../g),v=>parseInt(v,16)),cs=await neSha(await neSha(b));let n=BigInt('0x'+hex+Array.from(cs.slice(0,4),v=>v.toString(16).padStart(2,'0')).join('')),out='';while(n){out=ne58[Number(n%58n)]+out;n/=58n;}return out;}
async function neAddress(network,value){const s=value.trim();if(network==='ton')return tonAddress(s);if(network==='tron')return neTronAddress(s);if(network==='solana'){if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)||neDecode58(s).length!==32)throw Error('Неверный Solana-адрес.');return s;}if(network==='bitcoin'){if(!/^(bc1[ac-hj-np-z02-9]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{24,34})$/.test(s))throw Error('Нужен Bitcoin mainnet-адрес.');return s;}throw Error('Неподдерживаемая сеть.');}
const neNetwork=key=>({key,...NON_EVM[key]});
const neNotes=['Данные получены от внешних RPC и индексаторов; доступность и глубина истории зависят от провайдера.','Проверка адреса не доказывает владение им и не является AML-проверкой. Балансы не означают зачисление на внутренний баланс биржи.'];
function neBtcItems(txs,address){return txs.map(t=>{const incoming=t.vout.filter(v=>v.scriptpubkey_address===address).reduce((s,v)=>s+neUnsigned(v.value),0n),spent=t.vin.filter(v=>v.prevout?.scriptpubkey_address===address).reduce((s,v)=>s+neUnsigned(v.prevout.value),0n),delta=incoming-spent;return{hash:t.txid,direction:delta>0n?'in':delta<0n?'out':'self',amount:neUnits(delta<0n?-delta:delta,8),symbol:'BTC (изменение баланса)',from:[...new Set(t.vin.map(v=>v.prevout?.scriptpubkey_address).filter(Boolean))].join(', '),to:[...new Set(t.vout.map(v=>v.scriptpubkey_address).filter(Boolean))].join(', '),block:t.status.block_height??'mempool',status:t.status.confirmed?'confirmed':'pending'};});}
async function neBtcWallet(address,cursor){if(cursor&&!neHex.test(cursor))throw Error('Неверный курсор BTC.');const sources=await Promise.all(['https://mempool.space/api','https://blockstream.info/api'].map(base=>neTry(base,async()=>{const a=await neFetch(base+'/address/'+address);if(a.address!==address||!a.chain_stats)throw Error('Адрес в ответе не совпал');return{balance:(neUnsigned(a.chain_stats.funded_txo_sum)-neUnsigned(a.chain_stats.spent_txo_sum)).toString(),pendingDelta:(neUnsigned(a.mempool_stats.funded_txo_sum)-neUnsigned(a.mempool_stats.spent_txo_sum)).toString(),txCount:a.chain_stats.tx_count};})));
 const first=sources.find(s=>s.ok);let history={ok:false,items:[],error:'Нет доступного источника'};if(first){const h=await neTry(first.endpoint,()=>neFetch(first.endpoint+'/address/'+address+'/txs/chain'+(cursor?'/'+cursor:'')));history=h.ok?{ok:true,source:first.endpoint,agreement:false,items:neBtcItems(h.data,address),nextCursor:h.data.length===25?h.data.at(-1).txid:null,total:h.data.length}:{ok:false,error:h.error,items:[]};}
 return{address,agreement:sources.every(s=>s.ok)&&sources[0].data.balance===sources[1].data.balance,nativeBalance:first?neUnits(first.data.balance,8):null,accountType:'Bitcoin-адрес · UTXO',details:first?{'Подтверждённых транзакций':first.data.txCount,'Изменение mempool, sat':first.data.pendingDelta}:{},history,providers:sources};}
async function neTonWallet(address,contract,cursor){if(cursor&&!/^\d{1,25}$/.test(cursor))throw Error('Неверный TON LT.');const encoded=encodeURIComponent(address),sources=await Promise.all([
 neTry('https://tonapi.io',async()=>{const a=await neFetch('https://tonapi.io/v2/blockchain/accounts/'+encoded);if(tonAddress(a.address)!==address)throw Error('Адрес не совпал');return{balance:neUnsigned(a.balance).toString(),lt:String(a.last_transaction_lt),status:a.status};}),
 neTry('https://toncenter.com',async()=>{const a=await neFetch('https://toncenter.com/api/v2/getAddressInformation?address='+encoded);if(!a.ok)throw Error(a.error||'Ошибка TON Center');return{balance:neUnsigned(a.result.balance).toString(),lt:String(a.result.last_transaction_id.lt),status:a.result.state};})]);
 const first=sources.find(s=>s.ok),h=await neTry('https://tonapi.io',()=>neFetch('https://tonapi.io/v2/blockchain/accounts/'+encoded+'/transactions?limit=20'+(cursor?'&before_lt='+cursor:'')));
 const history=h.ok?{ok:true,source:h.endpoint,agreement:false,total:h.data.transactions.length,nextCursor:h.data.transactions.length===20?String(h.data.transactions.at(-1).lt):null,items:h.data.transactions.flatMap(t=>{const messages=[...(t.in_msg?[t.in_msg]:[]),...(t.out_msgs||[])].filter(m=>m.msg_type==='int_msg');return messages.map((m,i)=>({hash:t.hash,eventIndex:i,direction:m.destination?.address===address?'in':'out',from:m.source?.address,to:m.destination?.address,amount:neUnits(neUnsigned(m.value||0),9),symbol:'TON',block:t.block,status:t.aborted||m.bounced?'aborted / bounced':'message',lt:String(t.lt)}));})}:{ok:false,error:h.error,items:[]};
 let token=null;if(contract){const master=tonAddress(contract),r=await neTry('https://tonapi.io',()=>neFetch('https://tonapi.io/v2/accounts/'+encoded+'/jettons/'+encodeURIComponent(master)));token=r.ok?{contract:master,amount:neTokenUnits(neUnsigned(r.data.balance),r.data.jetton.decimals),symbol:r.data.jetton.symbol||'Jetton',agreement:false}: {contract:master,amount:null,error:r.error,agreement:false};}
 return{address,agreement:sources.every(s=>s.ok)&&sources[0].data.balance===sources[1].data.balance&&sources[0].data.lt===sources[1].data.lt,nativeBalance:first?neUnits(first.data.balance,9):null,accountType:first?'TON account · '+first.data.status:'Не получен',history,token,providers:sources};}
const neSolRpc=['https://api.mainnet-beta.solana.com','https://solana-rpc.publicnode.com'];
async function neSolIdentity(url){if(await neRpc(url,'getGenesisHash',[])!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error('Не Solana mainnet');}
async function neSolWallet(address,contract,cursor){if(cursor&&(!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(cursor)||neDecode58(cursor).length!==64))throw Error('Неверный курсор Solana.');const sources=await Promise.all(neSolRpc.map(url=>neTry(url,async()=>{await neSolIdentity(url);const a=await neRpc(url,'getAccountInfo',[address,{encoding:'jsonParsed',commitment:'finalized'}]);return{balance:neUnsigned(a.value?.lamports??0).toString(),slot:a.context.slot,executable:a.value?.executable??false,owner:a.value?.owner??null};})));
 const first=sources.find(s=>s.ok);let history={ok:false,items:[],error:'RPC недоступны'},token=null;
 if(first){const h=await neTry(first.endpoint,()=>neRpc(first.endpoint,'getSignaturesForAddress',[address,{limit:20,commitment:'finalized',...(cursor?{before:cursor}:{})}]));history=h.ok?{ok:true,source:first.endpoint,agreement:false,total:h.data.length,nextCursor:h.data.length===20?h.data.at(-1).signature:null,items:h.data.map(t=>({hash:t.signature,direction:'reference',block:t.slot,status:t.err?'failed':'finalized',timestamp:t.blockTime?new Date(t.blockTime*1000).toISOString():null,memo:t.memo}))}:{ok:false,error:h.error,items:[]};
  if(contract){const mint=await neAddress('solana',contract),r=await neTry(first.endpoint,()=>neRpc(first.endpoint,'getTokenAccountsByOwner',[address,{mint},{encoding:'jsonParsed',commitment:'finalized'}]));if(r.ok){const vals=r.data.value.map(x=>x.account.data.parsed.info.tokenAmount);if(vals.some(x=>!Number.isInteger(x.decimals)||x.decimals<0||x.decimals>36)||new Set(vals.map(x=>x.decimals)).size>1)throw Error('Несогласованные decimals SPL');token={contract:mint,amount:vals.length?neUnits(vals.reduce((s,v)=>s+neUnsigned(v.amount),0n),vals[0].decimals):'0',symbol:'SPL-токен',agreement:false};}else token={contract:mint,amount:null,error:r.error,agreement:false};}}
 return{address,agreement:sources.every(s=>s.ok)&&sources[0].data.balance===sources[1].data.balance&&sources[0].data.slot===sources[1].data.slot,nativeBalance:first?neUnits(first.data.balance,9):null,accountType:first?.data.executable?'Исполняемая программа':'Solana account',details:first?{owner:first.data.owner,'Слот состояния':first.data.slot}:{},history,token,providers:sources};}
const neTronApi='https://api.trongrid.io';
async function neTronWallet(address,contract,cursor){if(cursor&&!/^(scan:\d{1,7}|[\w+/=-]{1,1500})$/.test(cursor))throw Error('Неверный курсор TRON.');const a=await neTry(neTronApi,()=>neFetch(neTronApi+'/wallet/getaccount',{address,visible:true}));if(a.ok&&a.data.address&&a.data.address!==address)throw Error('Адрес TRON не совпал');let token=null;
 if(contract){const c=await neTronAddress(contract),raw=await neTronHex(address),r=await neTry(neTronApi,async()=>{const[b,d]=await Promise.all([neFetch(neTronApi+'/wallet/triggerconstantcontract',{owner_address:address,contract_address:c,function_selector:'balanceOf(address)',parameter:raw.slice(2).padStart(64,'0'),visible:true}),neFetch(neTronApi+'/wallet/triggerconstantcontract',{owner_address:address,contract_address:c,function_selector:'decimals()',visible:true})]);if(!b.result?.result||!d.result?.result||!neHex.test(b.constant_result?.[0])||!neHex.test(d.constant_result?.[0]))throw Error('Не удалось прочитать TRC-20');const decimals=Number(BigInt('0x'+d.constant_result[0]));if(decimals>36)throw Error('decimals не поддерживается');return{amount:neUnits(BigInt('0x'+b.constant_result[0]),decimals)};});token={contract:c,amount:r.ok?r.data.amount:null,symbol:c==='TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'?'USDT':'TRC-20',agreement:false,error:r.error};}
 const path='/v1/accounts/'+address+'/transactions'+(contract?'/trc20':'')+'?limit=20&only_confirmed=true&order_by=block_timestamp,desc'+(contract?'&contract_address='+contract:'')+(cursor?'&fingerprint='+encodeURIComponent(cursor):'');let h=cursor.startsWith('scan:')?{ok:false}:await neTry(neTronApi,()=>neFetch(neTronApi+path));
 if(contract&&!h.ok){const start=cursor.startsWith('scan:')?Number(cursor.slice(5)):0;const scan=await neTry('https://apilist.tronscanapi.com',()=>neFetch('https://apilist.tronscanapi.com/api/token_trc20/transfers?relatedAddress='+address+'&contract_address='+contract+'&limit=20&start='+start));if(scan.ok&&Array.isArray(scan.data.token_transfers)){h={ok:true,endpoint:scan.endpoint,data:{data:scan.data.token_transfers.filter(t=>t.contract_address===contract&&(t.from_address===address||t.to_address===address)&&t.event_type==='Transfer'&&t.confirmed&&!t.revert&&t.finalResult==='SUCCESS').map(t=>({transaction_id:t.transaction_id,from:t.from_address,to:t.to_address,value:t.quant,token_info:{decimals:t.tokenInfo.tokenDecimal,symbol:t.tokenInfo.tokenAbbr},block_timestamp:t.block_ts})),meta:{fingerprint:scan.data.token_transfers.length===20&&start+20<10000?'scan:'+(start+20):null}}};}else if(!h.error)h={ok:false,error:scan.error||'Некорректный ответ TronScan'};}
 const items=[];if(h.ok){for(const t of h.data.data||[]){if(contract){items.push({hash:t.transaction_id,direction:t.from===address?'out':'in',from:t.from,to:t.to,amount:neTokenUnits(neUnsigned(t.value),t.token_info.decimals),symbol:t.token_info.symbol||'TRC-20',timestamp:new Date(t.block_timestamp).toISOString()});}else{for(const c of t.raw_data?.contract||[]){if(c.type!=='TransferContract')continue;const v=c.parameter.value,from=await neTronBase58(v.owner_address),to=await neTronBase58(v.to_address);items.push({hash:t.txID,direction:from===address?'out':'in',from,to,amount:neUnits(neUnsigned(v.amount),6),symbol:'TRX',block:t.blockNumber,status:t.ret?.[0]?.contractRet});}}}}
 return{address,agreement:false,nativeBalance:a.ok?neUnits(neUnsigned(a.data.balance||0),6):null,accountType:a.ok?(a.data.address?a.data.type==='Contract'?'Смарт-контракт TRON':'TRON account':'Неактивированный адрес'):'Не получен',token,history:h.ok?{ok:true,source:h.endpoint,agreement:false,total:items.length,items,nextCursor:h.data.meta?.fingerprint||null}:{ok:false,error:h.error,items:[]},providers:[a]};}
export async function nonEvmWallet(input){const key=input.network,net=NON_EVM[key];if(!net)throw Error('Неподдерживаемая сеть');const specs=[['Источник',input.sourceAddress],['Получатель',input.destinationAddress]].filter(([,v])=>v?.trim());if(!specs.length)throw Error('Укажите хотя бы один адрес.');if(input.cursor&&specs.length!==1)throw Error('Для пагинации оставьте один адрес.');const reports=[];for(const[role,value]of specs){const address=await neAddress(key,value),contract=(input.walletContract||'').trim(),cursor=input.cursor||'';const r=key==='bitcoin'?await neBtcWallet(address,cursor):key==='ton'?await neTonWallet(address,contract,cursor):key==='solana'?await neSolWallet(address,contract,cursor):await neTronWallet(address,contract,cursor);reports.push({...r,role});}
 return{kind:'wallets',checkedAt:new Date().toISOString(),network:neNetwork(key),addressReports:reports,notes:[...neNotes,'История — страница индексатора/RPC, не полная история адреса. Для более ранних записей используйте курсор.','Символы токенов от индексатора не являются проверкой эмитента. Сверяйте полный адрес контракта / mint / Jetton master.',...(key==='solana'?['История Solana показывает ссылки на аккаунт. Она не охватывает автоматически отдельные SPL token accounts и не доказывает направление перевода.']:[]),...(key==='ton'?['В TON история показывает сообщения TON, а не завершение всей цепочки сообщений. Bounced/aborted требуют отдельной проверки. Jetton-баланс загружается отдельно; история Jetton здесь не декодируется.']:[]),...(key==='tron'?['Состояние TRON получено из TronGrid; для истории TRC-20 при отказе доступен резервный TronScan. Независимая сверка пока отсутствует. История TRX включает TransferContract; внутренние переводы контрактов в неё не входят.']:[])]};}


const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRON_TRANSFER = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const SOLANA_TOKEN_PROGRAMS = new Set([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
]);
const BITCOIN_SOURCES = ['https://mempool.space/api', 'https://blockstream.info/api'];
const TON_API = 'https://tonapi.io';
const TON_CENTER = 'https://toncenter.com';

function paymentAmount(raw, decimals) {
  const amount = neUnsigned(raw).toString();
  return { rawAmount: amount, decimals, amount: decimals === null ? null : neUnits(amount, decimals) };
}

function paymentDecimals(value) {
  return /^\d{1,2}$/.test(String(value)) && Number(value) <= 36 ? Number(value) : null;
}

function expectedUnits(amount, decimals) {
  const [whole, fraction = ''] = amount.replace(',', '.').split('.');
  if (fraction.slice(decimals).replace(/0/g, '')) return null;
  return BigInt(whole + fraction.slice(0, decimals).padEnd(decimals, '0')).toString();
}

async function paymentAddress(key, address) {
  if (key === 'bitcoin' && /^BC1[0-9A-Z]+$/.test(address)) address = address.toLowerCase();
  if (key === 'tron' && /^(?:0x)?41[0-9a-f]{40}$/i.test(address)) address = await neTronBase58(address.replace(/^0x/i, ''));
  return neAddress(key, address);
}

async function getExpectedPayment(input) {
  const { network } = input;
  const recipient = (input.recipient || '').trim();
  const amount = (input.amount || '').trim();
  const token = (input.contract || '').trim();
  const asset = input.asset || (token ? 'token' : 'native');
  if (!['native', 'token', 'erc20'].includes(asset)) throw Error('Выберите актив.');
  if (network === 'bitcoin' && asset !== 'native') throw Error('Для Bitcoin поддерживается BTC.');
  if (amount && (!/^\d{1,78}([.,]\d{1,36})?$/.test(amount) || !/[1-9]/.test(amount))) {
    throw Error('Укажите положительную сумму без экспоненты.');
  }
  const minConfirmations = network === 'bitcoin' ? String(input.minConfirmations ?? '1').trim() : null;
  if (minConfirmations !== null && (!/^\d{1,7}$/.test(minConfirmations) || Number(minConfirmations) < 1)) {
    throw Error('Укажите от 1 до 9999999 подтверждений Bitcoin.');
  }
  return {
    recipient: recipient ? await paymentAddress(network, recipient) : '',
    amount,
    asset: asset === 'native' ? 'native' : 'token',
    contract: asset !== 'native' && token ? await paymentAddress(network, token) : '',
    minConfirmations,
  };
}

function validateExternalPayment(report) {
  const { expected, transfers } = report;
  if (!expected.recipient || !expected.amount || (expected.asset === 'token' && !expected.contract)) {
    return { status: 'incomplete', reasons: ['Укажите получателя и сумму. Для токена также нужен адрес его контракта или mint.'] };
  }
  if (report.paymentBlocker) return { status: 'not_validated', reasons: [report.paymentBlocker] };

  const assets = transfers.filter(transfer => expected.asset === 'native'
    ? transfer.asset === 'native'
    : transfer.asset === 'token' && transfer.contract === expected.contract);
  const payee = assets.filter(transfer => transfer.to === expected.recipient
    || (report.network.key === 'solana' && transfer.destinationTokenAccount === expected.recipient));
  const matches = payee.filter(transfer => transfer.credited && transfer.decimals !== null
    && expectedUnits(expected.amount, transfer.decimals) === transfer.rawAmount);
  const failed = message => ({ status: 'not_validated', reasons: [message] });
  if (!assets.length) return failed('Не найден перевод указанного актива.');
  if (!payee.length) return failed('Не найден перевод этого актива на указанный адрес получателя.');
  if (!payee.some(transfer => transfer.credited && transfer.decimals !== null)) {
    return failed('Получение перевода или точность токена не подтверждены доступными данными.');
  }
  if (!matches.length) return failed('Точная сумма отдельного перевода или выхода не совпала.');
  if (matches.length > 1) return failed('Найдено несколько одинаковых переводов или выходов. Нужна ручная сверка.');
  return {
    status: 'validated',
    matchedTransferId: matches[0].id,
    reasons: ['Актив, точная сумма и адрес получателя совпали с подтверждённым переводом.'],
  };
}

function tonHash(value) {
  if (typeof value !== 'string') return '';
  if (neHex.test(value)) return value.toLowerCase();
  if (!/^[a-z0-9+/_-]{43}=?$/i.test(value)) return '';
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Array.from(raw, ch => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

function isSolanaSignature(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(value) && neDecode58(value).length === 64;
}

export function externalLookupTargets(value) {
  const hash = value.replace(/^0x/i, '');
  const targets = [];
  if (neHex.test(hash)) {
    targets.push(['tron', hash.toLowerCase()], ['bitcoin', hash.toLowerCase()]);
  }
  const ton = tonHash(hash);
  if (ton) targets.push(['ton', ton]);
  if (isSolanaSignature(value)) targets.push(['solana', value]);
  return targets;
}

async function lookupTonHash(hash) {
  const direct = await neTry(TON_API, () => neFetch(TON_API + '/v2/blockchain/transactions/' + hash));
  if (direct.ok) {
    if (tonHash(direct.data.hash) !== hash) throw Error('Хеш транзакции TON не совпал.');
    return hash;
  }
  if (!direct.error.startsWith('HTTP 404 ·')) throw Error(direct.error);

  const message = await neTry(TON_API, () => neFetch(TON_API + '/v2/blockchain/messages/' + hash + '/transaction'));
  if (!message.ok && message.error.startsWith('HTTP 404 ·')) return null;
  if (!message.ok) throw Error(message.error);
  const transaction = tonHash(message.data.hash);
  if (!transaction || tonHash(message.data.in_msg?.hash) !== hash) throw Error('Хеш входящего сообщения TON не совпал.');
  return transaction;
}

export async function lookupExternalTransaction(network, hash) {
  const sources = {
    ton: [TON_API],
    tron: [neTronApi],
    bitcoin: BITCOIN_SOURCES,
    solana: neSolRpc,
  };
  return Promise.all(sources[network].map(async endpoint => {
    const response = await neTry(endpoint, async () => {
      if (network === 'ton') return lookupTonHash(hash);
      if (network === 'tron') {
        const tx = await neFetch(endpoint + '/wallet/gettransactionbyid', { value: hash });
        if (tx.txID?.toLowerCase() === hash) return hash;
        if (Object.keys(tx).length === 0) return null;
        throw Error('TronGrid не вернул транзакцию с указанным хешем.');
      }
      if (network === 'bitcoin') {
        const tx = await neTry(endpoint, () => neFetch(endpoint + '/tx/' + hash));
        if (!tx.ok && tx.error.startsWith('HTTP 404 ·')) return null;
        if (!tx.ok) throw Error(tx.error);
        if (tx.data.txid?.toLowerCase() !== hash) throw Error('Txid Bitcoin не совпал.');
        return hash;
      }
      await neSolIdentity(endpoint);
      const statuses = await neRpc(endpoint, 'getSignatureStatuses', [[hash], { searchTransactionHistory: true }]);
      if (!Array.isArray(statuses.value) || statuses.value.length !== 1) throw Error('Некорректный ответ RPC Solana.');
      const signature = statuses.value[0];
      if (signature === null) return null;
      if (!signature || !Number.isSafeInteger(signature.slot)) throw Error('RPC Solana не вернул слот транзакции.');
      return hash;
    });
    if (!response.ok) return { endpoint, state: 'unavailable', error: response.error };
    return { endpoint, state: response.data ? 'found' : 'not_found', hash: response.data };
  }));
}

async function tonActions(hash) {
  const hashBase64 = btoa(String.fromCharCode(...hash.match(/../g).map(byte => parseInt(byte, 16))));
  const query = new URLSearchParams({
    tx_hash: hashBase64, include_transactions: 'true', limit: '50',
  });
  const response = await neFetch(TON_CENTER + '/api/v3/actions?' + query);
  if (!Array.isArray(response.actions)) throw Error('Некорректный ответ TON Center.');
  return response;
}

function tonInternalDelivery(action, from, to, rawAmount, jetton) {
  return (action.transactions_full || []).filter(tx => {
    const message = tx.in_msg;
    if (!message || tx.description?.aborted !== false || message.bounced !== false) return false;
    if (!action.transactions?.some(hash => tonHash(hash) === tonHash(tx.hash))) return false;
    if (tx.account?.toLowerCase() !== to || message.source?.toLowerCase() !== from || message.destination?.toLowerCase() !== to) return false;
    const decoded = message.message_content?.decoded;
    return jetton
      ? tx.description.compute_ph?.success === true && message.opcode?.toLowerCase() === '0x178d4519'
        && String(decoded?.amount?.value) === rawAmount
        && String(decoded?.query_id) === String(action.details.query_id)
      : String(message.value) === rawAmount;
  });
}

async function inspectTonPayment(report) {
  const direct = neTry(TON_API, () => neFetch(TON_API + '/v2/blockchain/transactions/' + report.hash));
  let [transaction, actions] = await Promise.all([direct, neTry(TON_CENTER, () => tonActions(report.hash))]);
  let transactionHash = report.hash;
  if (transaction.data && tonHash(transaction.data.hash) !== transactionHash) {
    transaction = { endpoint: TON_API, ok: false, error: 'Хеш транзакции не совпал.' };
  }
  if (!transaction.ok && !actions.data?.actions.length && transaction.error?.startsWith('HTTP 404')) {
    const byMessage = await neTry(TON_API, async () => {
      const tx = await neFetch(TON_API + '/v2/blockchain/messages/' + report.hash + '/transaction');
      if (!tonHash(tx.hash) || tonHash(tx.in_msg?.hash) !== report.hash) throw Error('Связь хеша сообщения с транзакцией не подтверждена.');
      return tx;
    });
    if (byMessage.ok) {
      transaction = byMessage;
      transactionHash = tonHash(byMessage.data.hash);
      actions = await neTry(TON_CENTER, () => tonActions(transactionHash));
      report.rows.push(['Транзакция по хешу сообщения', transactionHash]);
    }
  }
  report.providers = [transaction, actions];
  if (transaction.ok) {
    const tx = transaction.data;
    report.status = tx.aborted ? 'reverted' : tx.success ? 'success' : 'inconclusive';
    report.rows.push(['Аккаунт транзакции', tx.account?.address], ['Блок', tx.block], ['LT', String(tx.lt)],
      ['Время', new Date(tx.utime * 1000).toISOString()], ['Комиссия TON', neUnits(tx.total_fees, 9)]);
  }
  if (!actions.ok || actions.data.actions.length >= 50) {
    report.paymentBlocker = 'TON Center не вернул полный список действий. Повторите проверку.';
  } else {
    const seen = new Set();
    const metadata = new Map();
    const walletMetadata = new Map(Object.entries(actions.data.metadata || {}).map(([address, data]) => [address.toLowerCase(), data]));
    for (const action of actions.data.actions) {
      if (!action.transactions?.some(hash => tonHash(hash) === transactionHash)) continue;
      if (!['ton_transfer', 'jetton_transfer'].includes(action.type)) continue;
      if (!action.action_id || seen.has(action.action_id)) continue;
      seen.add(action.action_id);
      const details = action.details;
      const jetton = action.type === 'jetton_transfer';
      const from = tonAddress(jetton ? details.sender : details.source);
      const to = tonAddress(jetton ? details.receiver : details.destination);
      const contract = jetton ? tonAddress(details.asset) : null;
      let decimals = jetton ? null : 9;
      let symbol = jetton ? 'Jetton' : 'TON';
      if (jetton && (!report.expected.contract || report.expected.contract === contract)) {
        if (!metadata.has(contract)) {
          const source = await neTry(TON_API, async () => {
            const response = await neFetch(TON_API + '/v2/jettons/' + encodeURIComponent(contract));
            const mint = response.metadata;
            if (tonAddress(mint.address) !== contract) throw Error('Jetton master не совпал.');
            return { contract, decimals: paymentDecimals(mint.decimals), symbol: mint.symbol };
          });
          metadata.set(contract, source.data);
          report.providers.push({ ...source, lookup: 'Метаданные Jetton' });
        }
        const token = metadata.get(contract);
        decimals = token?.decimals ?? null;
        symbol = token?.symbol || symbol;
      }
      const amount = paymentAmount(jetton ? details.amount : details.value, decimals);
      const receivingWallet = jetton ? tonAddress(details.receiver_jetton_wallet) : to;
      const deliveries = tonInternalDelivery(action,
        jetton ? tonAddress(details.sender_jetton_wallet) : from, receivingWallet, amount.rawAmount, jetton);
      const ownerVerified = !jetton || walletMetadata.get(receivingWallet)?.token_info?.some(token =>
        token.valid === true && token.type === 'jetton_wallets'
        && token.extra?.owner?.toLowerCase() === to && token.extra?.jetton?.toLowerCase() === contract);
      report.transfers.push({
        id: action.action_id, from, to, asset: jetton ? 'token' : 'native', contract, symbol, ...amount,
        credited: Boolean(action.success === true && action.finality === 'finalized'
          && deliveries.length === 1 && ownerVerified && from !== to),
        evidenceTransaction: deliveries.length === 1 ? tonHash(deliveries[0].hash) : null,
      });
    }
    if (report.transfers.some(transfer => transfer.credited)) report.status = 'success';
    if (!report.transfers.length) {
      report.paymentBlocker = 'В TON Center пока нет связанного действия перевода. Проверьте хеш и повторите запрос после индексации.';
    }
  }
  if (!report.transfers.length && transaction.ok) {
    const tx = transaction.data;
    const messages = [tx.in_msg, ...(tx.out_msgs || [])].filter(msg => msg?.msg_type === 'int_msg');
    report.transfers = messages.map((msg, index) => ({
      id: 'message:' + index, from: msg.source?.address, to: msg.destination?.address, ...paymentAmount(msg.value, 9),
      symbol: msg.bounced ? 'TON · возврат' : 'TON · сообщение', credited: false,
    }));
  }
  report.notes.push('Сверка TON опирается на финализированное действие TON Center и успешную транзакцию получателя. Для Jetton получатель сверяется по владельцу Jetton-кошелька.');
}

async function inspectTronPayment(report) {
  const source = await neTry(neTronApi, async () => {
    const [tx, info] = await Promise.all([
      neFetch(neTronApi + '/walletsolidity/gettransactionbyid', { value: report.hash }),
      neFetch(neTronApi + '/walletsolidity/gettransactioninfobyid', { value: report.hash }),
    ]);
    if (!tx.txID && !info.id) return null;
    if (tx.txID?.toLowerCase() !== report.hash || info.id?.toLowerCase() !== report.hash || !/^[1-9]\d*$/.test(String(info.blockNumber))) {
      throw Error('TronGrid не вернул согласованную транзакцию и квитанцию блока.');
    }
    return { tx, info };
  });
  report.providers = [source];
  if (!source.data) {
    report.status = source.ok ? 'not_found' : 'inconclusive';
    report.paymentBlocker = 'TronGrid не подтвердил включение транзакции в solidified-блок.';
    return;
  }
  const { tx, info } = source.data;
  const result = tx.ret?.[0]?.contractRet;
  const receiptResult = info.receipt?.result;
  const executed = result === 'SUCCESS'
    && (!info.result || info.result === 'SUCCESS')
    && (!receiptResult || receiptResult === 'SUCCESS');
  report.status = executed ? 'success' : 'reverted';
  report.rows = [['Блок (solidified)', info.blockNumber], ['Комиссия TRX', neUnits(info.fee || 0, 6)], ['Результат', receiptResult || result]];
  if (!executed) report.paymentBlocker = 'Транзакция TRON завершилась с ошибкой или отсутствует успешная квитанция.';
  const transfers = [];
  for (const [index, instruction] of (tx.raw_data?.contract || []).entries()) {
    if (instruction.type !== 'TransferContract') continue;
    const value = instruction.parameter.value;
    transfers.push({
      id: 'contract:' + index, asset: 'native', symbol: 'TRX', ...paymentAmount(value.amount, 6),
      from: await neTronBase58(value.owner_address), to: await neTronBase58(value.to_address), credited: executed,
    });
  }
  const metadata = new Map([[TRON_USDT, 6]]);
  for (const [index, log] of (info.log || []).entries()) {
    if (log.topics?.[0]?.toLowerCase() !== TRON_TRANSFER || log.topics.length !== 3 || !neHex.test(log.data)
      || !log.topics.slice(1).every(topic => /^0{24}[0-9a-f]{40}$/i.test(topic)) || !/^[0-9a-f]{40}$/i.test(log.address)) continue;

    const contract = await neTronBase58('41' + log.address);
    const from = await neTronBase58('41' + log.topics[1].slice(-40));
    const to = await neTronBase58('41' + log.topics[2].slice(-40));
    if (!metadata.has(contract) && report.expected.contract === contract && executed) {
      const source = await neTry(neTronApi, async () => {
        const data = await neFetch(neTronApi + '/walletsolidity/triggerconstantcontract', {
          owner_address: from, contract_address: contract, function_selector: 'decimals()', visible: true,
        });
        if (!data.result?.result || !neHex.test(data.constant_result?.[0])) throw Error('Не удалось прочитать decimals токена.');
        return paymentDecimals(BigInt('0x' + data.constant_result[0]).toString());
      });
      metadata.set(contract, source.data ?? null);
      report.providers.push({ ...source, lookup: 'Точность TRC-20' });
    }
    transfers.push({
      id: 'log:' + index, from, to, asset: 'token', contract, symbol: contract === TRON_USDT ? 'USDT' : 'TRC-20',
      ...paymentAmount(BigInt('0x' + log.data), metadata.get(contract) ?? null),
      credited: executed && receiptResult === 'SUCCESS' && from !== to,
    });
  }
  report.transfers = transfers;
  report.notes.push('TRON проверяется через solidified RPC TronGrid. Для TRC-20 используется событие Transfer указанного контракта, а точность произвольного токена читается из его текущего solidified состояния.');
}

function solanaPayments(tx) {
  const groups = [tx.transaction.message.instructions, ...(tx.meta.innerInstructions || []).map(group => group.instructions)];
  const keys = tx.transaction.message.accountKeys || [];
  const account = (balance, address) => (keys[balance.accountIndex]?.pubkey ?? keys[balance.accountIndex]) === address;
  const post = tx.meta.postTokenBalances || [];
  const pre = tx.meta.preTokenBalances || [];
  const transfers = [];
  for (const [groupIndex, instructions] of groups.entries()) {
    for (const [index, instruction] of instructions.entries()) {
      const { programId, parsed } = instruction;
      const value = parsed?.info;
      if (!value || !['transfer', 'transferWithSeed', 'transferChecked', 'transferCheckedWithFee'].includes(parsed.type)) continue;
      const id = groupIndex + ':' + index;
      if (programId === '11111111111111111111111111111111' && ['transfer', 'transferWithSeed'].includes(parsed.type)) {
        transfers.push({ id, from: value.source, to: value.destination, asset: 'native', symbol: 'SOL',
          ...paymentAmount(value.lamports, 9), credited: tx.meta.err === null && value.source !== value.destination });
      }
      if (!SOLANA_TOKEN_PROGRAMS.has(programId)) continue;
      const receiving = post.find(balance => account(balance, value.destination));
      const sending = pre.find(balance => account(balance, value.source)) || post.find(balance => account(balance, value.source));
      const mint = value.mint || receiving?.mint || sending?.mint;
      const decimals = paymentDecimals(value.tokenAmount?.decimals ?? receiving?.uiTokenAmount?.decimals);
      const quantity = neUnsigned(value.tokenAmount?.amount ?? value.amount);
      const feeRaw = value.feeAmount?.amount ?? value.feeAmount ?? 0;
      const fee = neUnsigned(feeRaw);
      const token2022 = programId !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      const amount = quantity >= fee ? quantity - fee : 0n;
      const before = pre.find(balance => account(balance, value.destination));
      const credited = tx.meta.err === null && Boolean(receiving?.owner) && Boolean(mint) && mint === receiving?.mint
        && (!before || before.mint === mint) && decimals !== null && decimals === receiving?.uiTokenAmount?.decimals
        && value.source !== value.destination && receiving.owner !== sending?.owner && amount > 0n;
      transfers.push({
        id, asset: 'token', contract: mint, symbol: 'SPL', from: sending?.owner || value.source, to: receiving?.owner,
        destinationTokenAccount: value.destination, sourceTokenAccount: value.source, ...paymentAmount(amount, decimals),
        credited, token2022, balanceChange: receiving
          ? (neUnsigned(receiving.uiTokenAmount.amount) - neUnsigned(before?.uiTokenAmount?.amount ?? 0)).toString() : null,
      });
    }
  }
  for (const transfer of transfers) {
    if (!transfer.token2022) continue;
    const incoming = transfers.filter(other => other.destinationTokenAccount === transfer.destinationTokenAccount);
    transfer.credited = transfer.credited && incoming.length === 1 && transfer.balanceChange === transfer.rawAmount;
  }
  return transfers;
}

async function inspectSolanaPayment(report) {
  report.providers = await Promise.all(neSolRpc.map(endpoint => neTry(endpoint, async () => {
    await neSolIdentity(endpoint);
    const tx = await neRpc(endpoint, 'getTransaction', [report.hash, {
      encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 1,
    }]);
    if (!tx) return null;
    if (tx.transaction.signatures[0] !== report.hash || !tx.meta || !Object.hasOwn(tx.meta, 'err')) {
      throw Error('Подпись не совпала или отсутствуют данные выполнения.');
    }
    return { slot: tx.slot, blockTime: tx.blockTime, fee: tx.meta.fee, error: tx.meta.err, transfers: solanaPayments(tx) };
  })));
  const [left, right] = report.providers.map(source => source.data);
  const tx = left || right;
  if (!tx) {
    report.status = report.providers.every(source => source.ok) ? 'not_found' : 'inconclusive';
    report.paymentBlocker = 'Не получена финализированная транзакция Solana.';
  } else {
    report.rows = [['Слот', tx.slot], ['Время', tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null],
      ['Комиссия SOL', neUnits(tx.fee, 9)], ['Commitment', 'finalized']];
    report.transfers = tx.transfers;
    const twoResponses = Boolean(left && right);
    report.agreement = twoResponses && left.slot === right.slot && JSON.stringify(left.error) === JSON.stringify(right.error)
      && JSON.stringify(left.transfers) === JSON.stringify(right.transfers);
    const disagreement = twoResponses && !report.agreement;
    report.status = disagreement ? 'inconclusive' : (tx.error === null ? 'success' : 'reverted');
    report.rows.push(['Сверка источников', report.agreement ? 'Два RPC совпали' : disagreement ? 'RPC расходятся' : 'Данные одного RPC']);
    report.paymentSourceCount = disagreement ? 0 : twoResponses ? 2 : 1;
    if (disagreement) report.paymentBlocker = 'Два RPC Solana вернули разные данные финализированной транзакции.';
    else if (tx.error !== null) report.paymentBlocker = 'Транзакция Solana завершилась с ошибкой.';
  }
  report.notes.push('SPL-токен сверяется по mint и владельцу token account получателя на момент транзакции. Для Token-2022 с комиссией требуется подтверждение суммы изменением баланса.');
}

async function inspectBitcoinPayment(report) {
  report.providers = await Promise.all(BITCOIN_SOURCES.map(endpoint => neTry(endpoint, async () => {
    const tx = await neFetch(endpoint + '/tx/' + report.hash);
    if (tx.txid?.toLowerCase() !== report.hash || typeof tx.status?.confirmed !== 'boolean' || !Array.isArray(tx.vout)) {
      throw Error('Txid не совпал или отсутствуют выходы.');
    }
    let confirmations = null;
    if (tx.status.confirmed) {
      if (!neHex.test(tx.status.block_hash) || !/^[1-9]\d*$/.test(String(tx.status.block_height))) throw Error('Некорректные данные блока.');
      const height = neUnsigned(await neFetch(endpoint + '/blocks/tip/height'));
      if (height < neUnsigned(tx.status.block_height)) throw Error('Источник отстаёт от блока транзакции.');
      confirmations = (height - neUnsigned(tx.status.block_height) + 1n).toString();
    }
    return { tx, confirmations };
  })));
  const [left, right] = report.providers.map(source => source.data);
  const data = left || right;
  if (!data) {
    report.paymentBlocker = 'Индексаторы Bitcoin не вернули транзакцию.';
    return;
  }
  const { tx } = data;
  const inputs = tx.vin.map(v => v.prevout?.scriptpubkey_address || 'coinbase / script');
  const confirmations = [left, right].reduce((minimum, value) => {
    if (minimum === null || value?.confirmations === null || value?.confirmations === undefined) return null;
    return BigInt(value.confirmations) < BigInt(minimum) ? value.confirmations : minimum;
  }, left?.confirmations ?? null);
  const payout = item => JSON.stringify([item.tx.status.confirmed, item.tx.status.block_height, item.tx.status.block_hash,
    item.tx.vout.map(v => [v.scriptpubkey, v.scriptpubkey_address, String(v.value)])]);
  report.agreement = Boolean(left && right && payout(left) === payout(right));
  report.rows = [['Блок', tx.status.block_height ?? 'mempool'], ['Хеш блока', tx.status.block_hash],
    ['Подтверждения · минимум двух источников', confirmations], ['Комиссия BTC', neUnits(tx.fee, 8)], ['Входы', inputs.join(', ')]];
  report.transfers = tx.vout.map((output, index) => ({
    id: 'vout:' + index, from: 'Входы UTXO', to: output.scriptpubkey_address, asset: 'native', symbol: 'BTC',
    ...paymentAmount(output.value, 8), credited: Boolean(tx.status.confirmed && output.scriptpubkey_address),
  }));
  report.status = report.agreement ? (tx.status.confirmed ? 'success' : 'pending') : 'inconclusive';
  if (!report.agreement) report.paymentBlocker = 'Два индексатора Bitcoin не подтвердили одинаковые выходы и блок.';
  else if (!tx.status.confirmed) report.paymentBlocker = 'Транзакция Bitcoin пока в mempool.';
  else if (confirmations === null || BigInt(confirmations) < BigInt(report.expected.minConfirmations)) {
    report.paymentBlocker = 'Недостаточно подтверждений Bitcoin для заданного порога.';
  }
  report.notes.push('Сумма Bitcoin сверяется по одному выходу (vout). Сдача и несколько одинаковых выходов требуют проверки назначения платежа.');
}

export async function nonEvmCheck(input) {
  const network = input.network;
  if (!Object.hasOwn(NON_EVM, network)) throw Error('Неподдерживаемая сеть.');
  let hash = (input.hash || '').trim();
  if (network !== 'solana') hash = hash.replace(/^0x/i, '');
  if (network === 'ton') {
    hash = tonHash(hash);
    if (!hash) throw Error('Нужен хеш TON в hex или Base64.');
  } else if (network === 'solana') {
    if (!isSolanaSignature(hash)) {
      throw Error('Нужна подпись транзакции Solana в Base58.');
    }
  } else {
    if (!neHex.test(hash)) throw Error('Нужен txid из 64 hex-символов.');
    hash = hash.toLowerCase();
  }
  const report = {
    kind: 'externalTransaction', checkedAt: new Date().toISOString(), network: neNetwork(network),
    hash, expected: await getExpectedPayment(input), status: 'inconclusive', rows: [], transfers: [], providers: [],
    notes: [...neNotes, 'Сверка опирается на данные указанных сетевых источников. Криптографические доказательства локально не проверяются.'],
  };
  const inspectors = { ton: inspectTonPayment, tron: inspectTronPayment, solana: inspectSolanaPayment, bitcoin: inspectBitcoinPayment };
  await inspectors[network](report);
  report.validation = validateExternalPayment(report);
  if (report.validation.status === 'validated' && report.paymentSourceCount === 1) {
    report.validation.reasons.push('Совпадение проверено по одному RPC Solana. Второй источник не предоставил транзакцию.');
  }
  return report;
}
