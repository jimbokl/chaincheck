import assert from 'node:assert/strict';
import { nonEvmCheck } from '../worker/non-evm.js';

const hash = 'a'.repeat(64);
const receiptHash = 'b'.repeat(64);
const tonFrom = '0:' + '1'.repeat(64);
const tonTo = '0:' + '2'.repeat(64);
const tonMaster = '0:' + '3'.repeat(64);
const tonWalletFrom = '0:' + '4'.repeat(64);
const tonWalletTo = '0:' + '5'.repeat(64);
const tronFrom = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
const tronTo = 'TBPxhVAsuzoFnKyXtc1o2UySEydPHgATto';
const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const btcTo = '1JqDybm2nWTENrHvMyafbSXXtTk5Uv5QAn';
const solHash = '2mF7BdG2ADz7itv5xPtsrpiftimjRAVLWDMap9p2S9Kz4uxkfvG9dybyo1cEyouLP8fnwfivK4C5QrjxAc2BTdLL';
const solOwner = 'BJ5Ru4ouroWjXStKVaERihwpboUkzwtXvH9HgHJrH5pf';
const solMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const solSource = '3kpLh3WnCjkh1qZZjEKhiYvYS9Qf5QMFH2PBwEZTuUE8';
const solTo = 'Gzxe9fWYJrbpcizz3AyVsZNCnVsP3qsHaMMpaxXdYfJa';
const solTokenProgram = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

let scenario = '';
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const u = new URL(url);
  const body = options?.body ? JSON.parse(options.body) : {};
  if (u.hostname === 'tonapi.io' && u.pathname.includes('/v2/jettons/')) {
    return Response.json({ metadata: { address: tonMaster, decimals: '6' } });
  }
  if (u.hostname === 'tonapi.io') {
    return Response.json({ hash, lt: '1', utime: 1, total_fees: 0, success: true, aborted: false });
  }
  if (u.hostname === 'toncenter.com') {
    const jetton = scenario.startsWith('jetton');
    const source = jetton ? tonWalletFrom : tonFrom;
    const destination = jetton ? tonWalletTo : tonTo;
    const details = jetton
      ? { sender: tonFrom, receiver: tonTo, asset: tonMaster, sender_jetton_wallet: source,
          receiver_jetton_wallet: destination, amount: '1230000', query_id: '7' }
      : { source, destination, value: '1230000000' };
    return Response.json({
      actions: [{
        action_id: 'action-1', type: jetton ? 'jetton_transfer' : 'ton_transfer', details,
        success: true, finality: scenario === 'pending' ? 'pending' : 'finalized',
        transactions: [scenario === 'unrelated' ? 'c'.repeat(64) : hash, receiptHash],
        transactions_full: [{
          hash: receiptHash, account: destination,
          description: { aborted: scenario === 'aborted', compute_ph: { success: true } },
          in_msg: { source, destination, bounced: scenario === 'bounced', value: details.value, opcode: '0x178d4519',
            message_content: { decoded: { query_id: '7', amount: { value: details.amount } } } },
        }],
      }],
      metadata: { [destination]: { token_info: [{
        type: 'jetton_wallets', valid: true, extra: { owner: scenario === 'jetton-wrong-owner' ? tonFrom : tonTo, jetton: tonMaster },
      }] } },
    });
  }
  if (u.hostname === 'api.trongrid.io') {
    if (u.pathname.endsWith('/gettransactionbyid')) {
      return Response.json({ txID: hash, ret: [{ contractRet: 'SUCCESS' }], raw_data: { contract: [] } });
    }
    return Response.json({
      id: scenario === 'wrong-receipt' ? receiptHash : hash, blockNumber: 100,
      receipt: { result: scenario === 'failed-receipt' ? 'OUT_OF_ENERGY' : 'SUCCESS' },
      log: [{ address: 'a614f803b6fd780986a42c78ec9c7f77e6ded13c', topics: [
        'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0'.repeat(64), '0'.repeat(24) + '0fa695d6b065707cb4e0ef73b751c93347682bf2',
      ], data: (1230000n).toString(16).padStart(64, '0') }],
    });
  }
  if (u.hostname.includes('solana')) {
    if (scenario === 'single-source' && u.hostname.includes('mainnet-beta')) return new Response('', { status: 403 });
    if (body.method === 'getGenesisHash') return Response.json({ result: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d' });
    assert.equal(body.params[1].maxSupportedTransactionVersion, 1);
    const alternate = scenario === 'disagree' && u.hostname.includes('publicnode');
    return Response.json({ result: {
      slot: 300, transaction: { signatures: [solHash], message: { accountKeys: [solSource, solTo], instructions: [
        { programId: solTokenProgram, parsed: { type: 'transfer', info: { source: solSource, destination: solTo, amount: '1230000' } } },
      ] } },
      meta: { err: scenario === 'failed' ? 'InstructionError' : null, fee: 17, postTokenBalances: [
        { accountIndex: 1, owner: scenario === 'missing-owner' ? undefined : alternate ? solSource : solOwner,
          mint: solMint, uiTokenAmount: { amount: '1230000', decimals: 6 } },
      ] },
    } });
  }
  if (u.pathname.endsWith('/blocks/tip/height')) return new Response('105');
  const confirmed = scenario !== 'mempool';
  const output = { scriptpubkey_address: btcTo, value: scenario === 'disagree' && u.hostname === 'blockstream.info' ? 122999999 : 123000000 };
  return Response.json({
    txid: hash, vin: [], fee: 3, vout: scenario === 'duplicate' ? [output, output] : [output],
    status: { confirmed, block_height: 100, block_hash: receiptHash },
  });
};

async function expect(input, status) {
  const report = await nonEvmCheck(input);
  assert.equal(report.validation.status, status, JSON.stringify(report.validation));
  return report;
}

try {
  const ton = { network: 'ton', hash, recipient: tonTo, asset: 'native', amount: '1,2300' };
  await expect(ton, 'validated');
  for (scenario of ['aborted', 'bounced', 'pending', 'unrelated']) await expect(ton, 'not_validated');
  scenario = 'jetton';
  const jetton = { ...ton, asset: 'token', contract: tonMaster };
  await expect(jetton, 'validated');
  await expect({ ...jetton, contract: tonFrom }, 'not_validated');
  scenario = 'jetton-wrong-owner';
  await expect(jetton, 'not_validated');

  scenario = '';
  const tron = { network: 'tron', hash, recipient: tronTo, asset: 'token', contract: usdt, amount: '1.23' };
  const report = await nonEvmCheck(tron);
  // The fixture's log address is explicit so tests can also assert checksummed conversion.
  assert.equal(report.transfers[0].from, tronFrom);
  assert.equal(report.transfers[0].to, tronTo);
  assert.equal(report.validation.status, 'validated');
  for (scenario of ['wrong-receipt', 'failed-receipt']) await expect(tron, 'not_validated');

  scenario = '';
  const solana = { network: 'solana', hash: solHash, recipient: solOwner, asset: 'token', contract: solMint, amount: '1.23' };
  await expect(solana, 'validated');
  await expect({ ...solana, recipient: solTo }, 'validated');
  await expect({ ...solana, recipient: solSource }, 'not_validated');
  scenario = 'single-source';
  const fallback = await expect(solana, 'validated');
  assert.equal(fallback.paymentSourceCount, 1);
  assert.equal(fallback.agreement, false);
  for (scenario of ['missing-owner', 'failed', 'disagree']) await expect(solana, 'not_validated');

  scenario = '';
  const bitcoin = { network: 'bitcoin', hash, recipient: btcTo, amount: '1.23' };
  await expect({ ...bitcoin, minConfirmations: '6' }, 'validated');
  await expect({ ...bitcoin, minConfirmations: '7' }, 'not_validated');
  await expect({ ...bitcoin, amount: '1.230000001' }, 'not_validated');
  await expect({ ...bitcoin, recipient: '' }, 'incomplete');
  for (scenario of ['mempool', 'duplicate', 'disagree']) await expect(bitcoin, 'not_validated');
  console.log('PASS TON/Jetton delivery, TRC-20 receipt, SPL recipient, Bitcoin confirmations, exact amounts and provider disagreement');
} finally {
  globalThis.fetch = originalFetch;
}
