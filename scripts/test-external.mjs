import assert from 'node:assert/strict';
import {nonEvmWallet,nonEvmCheck,parseLossless} from '../worker/non-evm.js';
const originalFetch=globalThis.fetch,source='T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',destination='TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',contract='TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',hash='a'.repeat(64);let gridRequests=0;
globalThis.fetch=async(url,options)=>{
 if(url.includes('/wallet/getaccount'))return Response.json({address:source,balance:0});
 if(url.includes('/wallet/triggerconstantcontract')){const b=JSON.parse(options.body);return Response.json({result:{result:true},constant_result:[(b.function_selector==='decimals()'?'6':'0').padStart(64,'0')]});}
 if(url.includes('/v1/accounts/')){gridRequests++;return new Response('Rate limit',{status:429});}
 if(url.includes('tronscanapi.com'))return Response.json({token_transfers:[{transaction_id:hash,from_address:source,to_address:destination,contract_address:contract,event_type:'Transfer',confirmed:true,revert:false,finalResult:'SUCCESS',quant:'107320000',tokenInfo:{tokenDecimal:6,tokenAbbr:'USDT'},block_ts:1795430000000}]});
 if(url.includes('/blockchain/transactions/'))return Response.json({hash,account:{address:'0:'+'0'.repeat(64)},aborted:true,success:true,lt:'12345678901234567890',block:'test',utime:1795430000,total_fees:1,out_msgs:[]});
 throw Error('Unexpected mock URL '+url);
};
try{
 const r=await nonEvmWallet({network:'tron',sourceAddress:source,walletContract:contract}),w=r.addressReports[0];
 assert.equal(w.nativeBalance,'0');assert.equal(w.token.amount,'0');assert.equal(w.history.ok,true);assert.equal(w.history.source,'https://apilist.tronscanapi.com');assert.equal(w.history.items[0].amount,'107.32');assert.equal(w.agreement,false);assert.equal(gridRequests,2);
 await nonEvmWallet({network:'tron',sourceAddress:source,walletContract:contract,cursor:'scan:20'});assert.equal(gridRequests,2);
 const t=await nonEvmCheck({network:'ton',hash});assert.equal(t.status,'reverted');assert.notEqual(t.validation.status,'validated');
 assert.deepEqual(parseLossless('{"n":12345678901234567890,"s":"memo [12345678901234567890]","escaped":"a\\\"b"}'),{n:'12345678901234567890',s:'memo [12345678901234567890]',escaped:'a"b'});
 console.log('PASS TRON rate limit retry, fallback history, cursor, exact amounts, TON aborted state, lossless JSON');
}finally{globalThis.fetch=originalFetch;}
