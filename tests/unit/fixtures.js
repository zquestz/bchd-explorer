/**
 * Copyright 2026 Josh Ellithorpe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Builders for bchrpc responses and a fake BchrpcClient, so the explorer can
// be tested without a node.

import { pb } from "@/bchrpc";

// hash returns the wire (little-endian) bytes of a displayed hash.
export function hash(display) {
  return Uint8Array.from(Buffer.from(display, "hex").reverse());
}

// hexHash makes a distinct 64-character displayed hash from a number.
export function hexHash(n) {
  return n.toString(16).padStart(64, "0");
}

export function blockchainInfo({
  net = 0,
  height = 1000,
  tipHash = hexHash(1000),
  txIndex = true,
  addrIndex = true,
  slpIndex = true,
} = {}) {
  const res = new pb.GetBlockchainInfoResponse();
  res.setBitcoinNet(net);
  res.setBestHeight(height);
  res.setBestBlockHash(hash(tipHash));
  res.setTxIndex(txIndex);
  res.setAddrIndex(addrIndex);
  res.setSlpIndex(slpIndex);
  return res;
}

export function cashToken({ category, amount, bitfield, commitment }) {
  const ct = new pb.CashToken();
  ct.setCategoryId(hash(category));
  ct.setBitfield(Uint8Array.from([bitfield]));
  if (amount !== undefined) {
    ct.setAmount(amount);
  }
  if (commitment) {
    ct.setCommitment(Uint8Array.from(Buffer.from(commitment, "hex")));
  }
  return ct;
}

// block builds a GetBlockResponse; next is the next block's hash, or "" at
// the tip.
export function block({
  height,
  blockHash = hexHash(height),
  previous = height > 0 ? hexHash(height - 1) : "",
  next = "",
  timestamp = 1700000000 + height * 600,
  size = 1000,
  txids = [hexHash(0xc0ffee + height)],
}) {
  const info = new pb.BlockInfo();
  info.setHeight(height);
  info.setHash(hash(blockHash));
  if (previous) {
    info.setPreviousBlock(hash(previous));
  }
  if (next) {
    info.setNextBlockHash(hash(next));
  }
  info.setMerkleRoot(hash(hexHash(0)));
  info.setTimestamp(timestamp);
  info.setMedianTime(timestamp - 3600);
  info.setSize(size);
  info.setBits(0x1d00ffff);
  const b = new pb.Block();
  b.setInfo(info);
  txids.forEach((txid) => {
    const td = new pb.Block.TransactionData();
    td.setTransactionHash(hash(txid));
    b.addTransactionData(td);
  });
  const res = new pb.GetBlockResponse();
  res.setBlock(b);
  return res;
}

// transaction builds a pb.Transaction. Inputs are { prev, vout, value,
// address, cashToken }; a prev of all zeros makes a coinbase input. Outputs
// are { value, address, cashToken, asm }.
export function transaction({
  txid,
  height = 0,
  confirmations = 0,
  timestamp = 0,
  size = 250,
  inputs = [],
  outputs = [],
}) {
  const tx = new pb.Transaction();
  tx.setHash(hash(txid));
  tx.setVersion(2);
  tx.setSize(size);
  tx.setConfirmations(confirmations);
  if (confirmations > 0) {
    tx.setBlockHeight(height);
    tx.setBlockHash(hash(hexHash(height)));
    tx.setTimestamp(timestamp);
  }
  inputs.forEach((i, index) => {
    const input = new pb.Transaction.Input();
    input.setIndex(index);
    const outpoint = new pb.Transaction.Input.Outpoint();
    outpoint.setHash(hash(i.prev));
    outpoint.setIndex(i.vout || 0);
    input.setOutpoint(outpoint);
    input.setValue(i.value || 0);
    input.setAddress(i.address || "");
    if (i.cashToken) {
      input.setCashToken(cashToken(i.cashToken));
    }
    tx.addInputs(input);
  });
  outputs.forEach((o, index) => {
    const output = new pb.Transaction.Output();
    output.setIndex(index);
    output.setValue(o.value || 0);
    output.setAddress(o.address || "");
    output.setScriptClass("pubkeyhash");
    output.setDisassembledScript(o.asm || "");
    if (o.cashToken) {
      output.setCashToken(cashToken(o.cashToken));
    }
    tx.addOutputs(output);
  });
  tx.setSlpTransactionInfo(new pb.SlpTransactionInfo());
  return tx;
}

export function transactionResponse(tx) {
  const res = new pb.GetTransactionResponse();
  res.setTransaction(tx);
  return res;
}

// unspentOutputs builds a GetAddressUnspentOutputsResponse from
// { txid, vout, value, height, cashToken }.
export function unspentOutputs(outputs) {
  const res = new pb.GetAddressUnspentOutputsResponse();
  outputs.forEach((o) => {
    const u = new pb.UnspentOutput();
    const outpoint = new pb.Transaction.Input.Outpoint();
    outpoint.setHash(hash(o.txid));
    outpoint.setIndex(o.vout || 0);
    u.setOutpoint(outpoint);
    u.setValue(o.value || 0);
    u.setBlockHeight(o.height);
    if (o.cashToken) {
      u.setCashToken(cashToken(o.cashToken));
    }
    res.addOutputs(u);
  });
  return res;
}

// addressTransactions builds a GetAddressTransactionsResponse. Confirmed
// transactions are newest first, as bchd returns them; unconfirmed ones are
// { tx, addedTime }.
export function addressTransactions({ confirmed = [], unconfirmed = [] }) {
  const res = new pb.GetAddressTransactionsResponse();
  confirmed.forEach((tx) => res.addConfirmedTransactions(tx));
  unconfirmed.forEach(({ tx, addedTime }) => {
    const m = new pb.MempoolTransaction();
    m.setTransaction(tx);
    m.setAddedTime(addedTime);
    res.addUnconfirmedTransactions(m);
  });
  return res;
}

export function mempoolInfo(count, bytes) {
  const res = new pb.GetMempoolInfoResponse();
  res.setSize(count);
  res.setBytes(bytes);
  return res;
}

// doubleSpendProofs builds a GetDoubleSpendProofsResponse from
// { proofHash, txid, outpointTxid, vout }.
export function doubleSpendProofs(proofs = []) {
  const res = new pb.GetDoubleSpendProofsResponse();
  proofs.forEach((p) => {
    const proof = new pb.DoubleSpendProof();
    proof.setHash(hash(p.proofHash));
    proof.setTransactionHash(hash(p.txid));
    const outpoint = new pb.Transaction.Input.Outpoint();
    outpoint.setHash(hash(p.outpointTxid));
    outpoint.setIndex(p.vout || 0);
    proof.setOutpoint(outpoint);
    res.addProofs(proof);
  });
  return res;
}

export function dsproofScore(score) {
  const res = new pb.GetDoubleSpendProofScoreResponse();
  res.setScore(score);
  return res;
}

// grpcError makes an error shaped like the ones the gRPC-Web client rejects
// with.
export function grpcError(code, message) {
  return Object.assign(new Error(message), { code });
}

// fakeClient returns a BchrpcClient stand-in. handlers maps method names to
// functions returning a response (or a promise); calls records every call.
export function fakeClient(handlers = {}) {
  const NOT_FOUND = 5;
  const calls = [];
  const defaults = {
    getBlockchainInfo: () => blockchainInfo(),
    getBlock: () => Promise.reject(grpcError(NOT_FOUND, "block not found")),
    getTransaction: () =>
      Promise.reject(grpcError(NOT_FOUND, "transaction not found")),
    getAddressUtxos: () => unspentOutputs([]),
    getAddressTransactions: () => addressTransactions({}),
    getDoubleSpendProof: () =>
      Promise.reject(grpcError(NOT_FOUND, "double spend proof not found")),
    getDoubleSpendProofScore: () => dsproofScore(1),
    getMempoolInfo: () => mempoolInfo(0, 0),
    getDoubleSpendProofs: () => doubleSpendProofs([]),
  };
  const client = { calls };
  Object.keys(defaults).forEach((method) => {
    const handler = handlers[method] || defaults[method];
    client[method] = (query) => {
      calls.push({ method, query });
      try {
        return Promise.resolve(handler(query));
      } catch (error) {
        return Promise.reject(error);
      }
    };
  });
  client.count = (method) => calls.filter((c) => c.method === method).length;
  return client;
}
