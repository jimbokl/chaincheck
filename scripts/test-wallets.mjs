import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import app,{checkWallets} from '../worker/index.js';
import {tonAddress,nonEvmWallet,nonEvmCheck,parseLossless} from '../worker/non-evm.js';
const fixture=JSON.parse((await readFile('sample-report.json','utf8')).replace(/^\uFEFF/,'')),p=fixture.providers[0],address=fixture.transfers[0].to,contract=fixture.transfers[0].contract;
const nativeFetch=globalThis.fetch;let mode='normal';
globalThis.fetch=async(url,options)=>{const{method,params}=JSON.parse(options.body),second=String(url).includes('okx.com');if(mode==='offline'&&second)throw Error('Offline');let result;
 if(method==='eth_chainId')result='0xc4';if(method==='eth_blockNumber')result=p.receipt.blockNumber;
 if(method==='eth_getBlockByNumber')result={hash:mode==='fork'&&second?'0x'+'a'.repeat(64):p.receipt.blockHash,timestamp:p.block.timestamp};
 if(method==='eth_getBalance')result=mode==='balance'&&second?'0x02':'0x01';if(method==='eth_getTransactionCount')result='0x0';if(method==='eth_getCode')result=params[0]===contract?'0xab':mode==='delegated'?'0xef0100'+'1'.repeat(40):'0x';
 if(method==='eth_call')result='0x'+(params[0].data==='0x313ce567'?'6':'66592c0').padStart(64,'0');
 if(method==='eth_getLogs'){if(mode==='logs'&&second)throw Error('History unavailable');result=params[0].topics.length===3?structuredClone(p.receipt.logs):[];}
 return Response.json({jsonrpc:'2.0',id:1,result});};
try{const input={network:'xlayer',sourceAddress:address,walletContract:contract};let r=await checkWallets(input);assert.equal(r.addressReports[0].agreement,true);assert.equal(r.addressReports[0].token.amount,'107.32');assert.equal(r.addressReports[0].history.agreement,true);assert.equal(r.addressReports[0].history.items[0].direction,'in');assert.equal(r.addressReports[0].history.items[0].amount,'107.32');assert.equal(BigInt(r.snapshot.block)-BigInt(r.snapshot.fromBlock),99n);
 for(mode of['offline','balance','fork']){r=await checkWallets(input);assert.equal(r.addressReports[0].agreement,false,mode);}
 mode='logs';r=await checkWallets(input);assert.equal(r.addressReports[0].agreement,true);assert.equal(r.addressReports[0].history.agreement,false);
 mode='delegated';r=await checkWallets(input);assert.match(r.addressReports[0].accountType,/Делегированный/);
 mode='normal';await assert.rejects(()=>checkWallets({...input,endBlock:'999999999999'}));await assert.rejects(()=>checkWallets({...input,sourceAddress:'not-an-address'}));
 assert.equal(parseLossless('{"value":12345678901234567890,"memo":"a:12345678901234567890"}').value,'12345678901234567890');assert.equal(tonAddress('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'),'0:'+'0'.repeat(64));assert.throws(()=>tonAddress('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9d'));assert.throws(()=>tonAddress('kQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHTW'));
 const bad=await app.fetch(new Request('https://test.local/api/wallets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,sourceAddress:7})}));assert.equal(bad.status,400);
 console.log('PASS wallet snapshot, balances, token history, provider failure, reorg, delegation, invalid addresses');
}finally{globalThis.fetch=nativeFetch;}
if(process.argv.includes('--live')){for(const network of['xlayer','ton','tron','solana','bitcoin']){const addr={xlayer:address,ton:'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',tron:'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',solana:'11111111111111111111111111111111',bitcoin:'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'}[network];try{const r=await checkWallets({network,sourceAddress:addr,...(network==='xlayer'?{walletContract:contract,endBlock:p.receipt.blockNumber?BigInt(p.receipt.blockNumber).toString():''}:{})});const w=r.addressReports[0];console.log(JSON.stringify({network,balance:w?.nativeBalance,agreement:w?.agreement,history:w?.history?.ok,items:w?.history?.items?.length,error:w?.history?.error,providers:(r.providers||w?.providers||[]).map(p=>({endpoint:p.endpoint,ok:p.ok,error:p.error}))}));if(w?.history?.items?.[0]?.hash&&network!=='xlayer'){const t=await nonEvmCheck({network,hash:w.history.items[0].hash});console.log('TX',network,t.status,t.transfers.length);}}catch(e){console.log('LIVE ERROR',network,e.message);process.exitCode=1;}}}
