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

// Promise based client for the bchd gRPC-Web API, built on the bindings bchd
// publishes in bchrpc/pb-js (see vendor/bchrpc-pb/README.md). It keeps the
// method names and arguments of the grpc-bchrpc-web GrpcClient it replaces.

import { grpc } from "@improbable-eng/grpc-web";
import * as pb from "bchrpc-pb/bchrpc_pb";
import { bchrpcClient } from "bchrpc-pb/bchrpc_pb_service";
import { fromHex } from "./hex";

export { pb };
export const GrpcCode = grpc.Code;

// hashToBytes converts a hex hash to bytes. Hashes are displayed big-endian
// but sent little-endian, so displayed hashes need reversedHashOrder.
function hashToBytes(hash, reversedHashOrder) {
  const bytes = fromHex(hash);
  return reversedHashOrder ? bytes.reverse() : bytes;
}

export class BchrpcClient {
  constructor({ url }) {
    this.client = new bchrpcClient(url, {
      "grpc.max_receive_message_length": -1,
    });
  }

  unary(method, req) {
    return new Promise((resolve, reject) => {
      this.client[method](req, (err, data) => {
        if (err !== null) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  getBlockchainInfo() {
    return this.unary("getBlockchainInfo", new pb.GetBlockchainInfoRequest());
  }

  // getMempoolInfo returns the mempool's transaction count and size.
  getMempoolInfo() {
    return this.unary("getMempoolInfo", new pb.GetMempoolInfoRequest());
  }

  // getMempool lists the mempool's transactions: their hashes, or with
  // fullTransactions, the transactions (about 1.5 kB each).
  getMempool({ fullTransactions = false } = {}) {
    const req = new pb.GetMempoolRequest();
    req.setFullTransactions(fullTransactions);
    return this.unary("getMempool", req);
  }

  getBlockInfo({ index, hash, reversedHashOrder }) {
    const req = new pb.GetBlockInfoRequest();
    if (index !== null && index !== undefined) {
      req.setHeight(index);
    } else if (hash) {
      req.setHash(hashToBytes(hash, reversedHashOrder));
    } else {
      throw Error("No index or hash provided for block");
    }
    return this.unary("getBlockInfo", req);
  }

  // getBlock returns the block's info and its transaction hashes. Without
  // full transactions it needs no index on the node.
  getBlock({ index, hash, reversedHashOrder }) {
    const req = new pb.GetBlockRequest();
    if (index !== null && index !== undefined) {
      req.setHeight(index);
    } else if (hash) {
      req.setHash(hashToBytes(hash, reversedHashOrder));
    } else {
      throw Error("No index or hash provided for block");
    }
    req.setFullTransactions(false);
    return this.unary("getBlock", req);
  }

  getTransaction({ hash, reversedHashOrder, includeTokenMetadata = true }) {
    const req = new pb.GetTransactionRequest();
    req.setHash(hashToBytes(hash, reversedHashOrder));
    req.setIncludeTokenMetadata(includeTokenMetadata);
    return this.unary("getTransaction", req);
  }

  getAddressTransactions({ address, nbSkip, nbFetch }) {
    const req = new pb.GetAddressTransactionsRequest();
    req.setAddress(address);
    if (nbSkip) {
      req.setNbSkip(nbSkip);
    }
    if (nbFetch) {
      req.setNbFetch(nbFetch);
    }
    return this.unary("getAddressTransactions", req);
  }

  getAddressUtxos({ address, includeMempool, includeTokenMetadata = true }) {
    const req = new pb.GetAddressUnspentOutputsRequest();
    req.setAddress(address);
    req.setIncludeMempool(!!includeMempool);
    req.setIncludeTokenMetadata(includeTokenMetadata);
    return this.unary("getAddressUnspentOutputs", req);
  }

  // getDoubleSpendProof looks up a proof by mempool transaction. Unless
  // excludeAncestors is set, the transaction's unconfirmed ancestors are
  // searched too. Rejects with GrpcCode.NotFound when there is no proof.
  getDoubleSpendProof({ hash, reversedHashOrder, excludeAncestors = false }) {
    const req = new pb.GetDoubleSpendProofRequest();
    req.setTransactionHash(hashToBytes(hash, reversedHashOrder));
    req.setExcludeAncestors(excludeAncestors);
    return this.unary("getDoubleSpendProof", req);
  }

  // getDoubleSpendProofs lists the proofs for mempool transactions.
  getDoubleSpendProofs() {
    return this.unary(
      "getDoubleSpendProofs",
      new pb.GetDoubleSpendProofsRequest()
    );
  }

  // getDoubleSpendProofScore rejects with GrpcCode.NotFound when the
  // transaction is not in the mempool.
  getDoubleSpendProofScore({ hash, reversedHashOrder }) {
    const req = new pb.GetDoubleSpendProofScoreRequest();
    req.setTransactionHash(hashToBytes(hash, reversedHashOrder));
    return this.unary("getDoubleSpendProofScore", req);
  }
}
