import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {check,units,parseAmount,NETWORKS} from '../worker/index.js';
const fixture=JSON.parse((await readFile('sample-report.json','utf8')).replace(/^\uFEFF/,''));
const p=fixture.providers[0],hash=fixture.hash,input={network:'xlayer',hash,...fixture.expected};
const realFetch=globalThis.fetch;let mode='normal';
globalThis.fetch=async(url,options)=>{
 const {method}=JSON.parse(options.body),second=String(url).includes('okx.com');
 if(mode==='unavailable'&&second)throw Error('offline');
 let result;
 if(method==='eth_chainId')result=mode==='wrongchain'&&second?'0x1':'0xc4';
 if(method==='eth_getTransactionByHash')result=mode==='missing'?null:structuredClone(p.tx);
 if(method==='eth_getTransactionReceipt'){result=mode==='missing'||mode==='pending'?null:structuredClone(p.receipt);if(result&&mode==='reverted')result.status='0x0';if(result&&mode==='disagree'&&second)result.logs[0].data='0x'+(107319999n).toString(16).padStart(64,'0');if(result&&mode==='duplicate'){result.logs.push({...result.logs[0],logIndex:'0x4d'});}}
 if(method==='eth_blockNumber')result=mode==='young'?p.receipt.blockNumber:'0x'+(BigInt(p.receipt.blockNumber)+100n).toString(16);
 if(method==='eth_getBlockByNumber')result={...p.block,transactions:[hash],...(mode==='reorg'?{hash:'0x'+'a'.repeat(64)}:{})};
 if(method==='eth_call')result='0x'+(mode==='decimals'&&second?'12':'6').padStart(64,'0');
 return Response.json({jsonrpc:'2.0',id:1,result});
};
try{
 assert.equal(units(107320000n,6),'107.32');assert.equal(units(100000000n,6),'100');assert.equal(units(1n,18),'0.000000000000000001');assert.equal(parseAmount('107,32',6),107320000n);assert.throws(()=>parseAmount('1.0000001',6));
 assert.equal((await check(input)).validation.status,'validated');
 for(const overrides of[{amount:'107.31'},{recipient:'0x'+'1'.repeat(40)},{contract:'0x'+'2'.repeat(40)},{sender:'0x'+'3'.repeat(40)}])assert.equal((await check({...input,...overrides})).validation.status,'not_validated');
 assert.equal((await check({network:'xlayer',hash})).validation.status,'incomplete');
 for(mode of['unavailable','wrongchain','reverted','disagree','duplicate','young','decimals','reorg','missing','pending']){const r=await check(input);assert.notEqual(r.validation.status,'validated',mode);console.log('PASS rejection:',mode);}
 console.log('PASS exact amounts, expected fields, incomplete criteria');
}finally{globalThis.fetch=realFetch;}
if(process.argv.includes('--live')){
 const results=await Promise.all(Object.entries(NETWORKS).flatMap(([key,n])=>n.rpc.map(async url=>{try{const res=await realFetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),signal:AbortSignal.timeout(12000)});const b=await res.json();assert.equal(BigInt(b.result),BigInt(n.id));return[key,new URL(url).hostname,'OK'];}catch(e){return[key,new URL(url).hostname,e.message];}})));
 console.log(JSON.stringify(results,null,2));
}
