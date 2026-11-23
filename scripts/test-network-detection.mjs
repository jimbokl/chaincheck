import assert from 'node:assert/strict';
import app, { NETWORKS, detectTransactionNetwork } from '../worker/index.js';

const hex = 'a'.repeat(64);
const evmHash = '0x' + hex;
const signature = '2mF7BdG2ADz7itv5xPtsrpiftimjRAVLWDMap9p2S9Kz4uxkfvG9dybyo1cEyouLP8fnwfivK4C5QrjxAc2BTdLL';
const chainByEndpoint = new Map(Object.values(NETWORKS).flatMap(network =>
  network.rpc.map(endpoint => [endpoint, network.id])));
const originalFetch = globalThis.fetch;
const calls = [];
let scenario;
globalThis.fetch = async (endpoint, options) => {
  calls.push(endpoint);
  const body = options?.body && JSON.parse(options.body);
  const result = data => Response.json({ jsonrpc: '2.0', id: 1, result: data });

  if (chainByEndpoint.has(endpoint)) {
    const id = chainByEndpoint.get(endpoint);
    if (scenario === 'mixed' && id === 137 && endpoint.includes('publicnode')) return new Response('', { status: 503 });
    if (scenario === 'mixed' && id === 8453) return new Response('', { status: 403 });
    if (body.method === 'eth_chainId') return result('0x' + (scenario === 'wrong-chain' && id === 196 ? 1 : id).toString(16));
    assert.equal(body.method, 'eth_getTransactionByHash');
    assert.equal(body.params[0], evmHash);
    if (scenario === 'mixed' && (id === 196 || id === 1)) return result({ hash: evmHash, blockNumber: null });
    return result(null);
  }
  if (endpoint.includes('solana')) {
    if (body.method === 'getGenesisHash') return result('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
    assert.deepEqual(body.params, [[signature], { searchTransactionHistory: true }]);
    return result({ value: [{ slot: 121 }] });
  }
  if (endpoint.includes('tonapi.io/v2/blockchain/messages/') && scenario === 'ton-message') {
    return Response.json({ hash: 'b'.repeat(64), in_msg: { hash: hex } });
  }
  if (endpoint.includes('trongrid.io')) return Response.json({});
  return new Response('', { status: 404 });
};

try {
  scenario = 'mixed';
  const mixed = await detectTransactionNetwork(evmHash.toUpperCase());
  assert.deepEqual(mixed.matches.map(match => match.network), ['xlayer', 'ethereum']);
  assert.equal(mixed.checks.length, 9);
  assert.equal(mixed.checks.find(check => check.network === 'polygon').state, 'partial');
  assert.equal(mixed.checks.find(check => check.network === 'base').state, 'unavailable');
  assert.equal(mixed.checks.find(check => check.network === 'bitcoin').state, 'not_found');

  scenario = 'wrong-chain';
  const wrongChain = await detectTransactionNetwork(hex);
  assert.equal(wrongChain.checks.find(check => check.network === 'xlayer').state, 'unavailable');
  assert.equal(wrongChain.matches.length, 0);

  scenario = 'ton-message';
  const base64 = Buffer.from(hex, 'hex').toString('base64url');
  const ton = await detectTransactionNetwork(base64);
  assert.equal(ton.checks.length, 1);
  assert.equal(ton.matches[0].network, 'ton');
  assert.equal(ton.matches[0].hash, 'b'.repeat(64));

  const request = new Request('https://chaincheck.local/api/check', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ network: 'auto', hash: signature }),
  });
  const detection = await (await app.fetch(request)).json();
  assert.deepEqual(detection.matches.map(match => match.network), ['solana']);
  assert.equal(detection.checks.length, 1);
  const before = calls.length;
  await assert.rejects(() => detectTransactionNetwork('invalid-hash'), /Введите хеш/);
  assert.equal(calls.length, before);
  console.log('PASS network detection, multiple matches, partial outages, TON message mapping and Solana signatures');
} finally {
  globalThis.fetch = originalFetch;
}
