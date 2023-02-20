const express = require('express');
const bodyParser = require('body-parser');
const { keccak256, ecsign, toRpcSig } = require('ethereumjs-util');

const { personalSign, typedSignatureHash } = require('eth-sig-util');

class DogePoundProxy {
  async getWalletAddress() {
    const response = await fetch('http://localhost:3000/wallet');
    const data = await response.json();
    return data.address;
  }

  async getAccounts() {
    const accounts = await global.keyringController.getAccounts();
    return accounts;
  }

  async getPrivateKey() {
    const accounts = await this.getAccounts();
    const privateKey = await global.keyringController.exportAccount(accounts[0]);
    return privateKey;
  }

  async getPersonalMessageSignature(message) {
    const privateKey = await this.getPrivateKey();
    const messageHash = keccak256(message);
    const { v, r, s } = ecsign(messageHash, privateKey);
    const signature = toRpcSig(v, r, s);
    return signature;
  }

  async getTypedDataSignature(typedData, version) {
    const privateKey = await this.getPrivateKey();
    const typedDataHash = typedSignatureHash(typedData, version);
    const { v, r, s } = ecsign(typedDataHash, privateKey);
    const signature = toRpcSig(v, r, s);
    return signature;
  }

  async handleGetWalletAddress(req, res) {
    try {
      // Retrieve the wallet address associated with the current account
      const walletAddress = await this.getWalletAddress();
      res.json({ walletAddress });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handlePostSign(req, res) {
    const { message, typedData, version = 'V1' } = req.body;

    try {
      let signature;

      if (message) {
        // Sign a personal message using the current account
        signature = await this.getPersonalMessageSignature(message);
      } else if (typedData) {
        // Sign a typed data message using the current account
        signature = await this.getTypedDataSignature(typedData, version);
      } else {
        throw new Error('Invalid request: message or typedData property is missing');
      }

      res.json({ signature });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async start() {
    const app = express();
    app.use(bodyParser.json());

    // Define a GET endpoint for the /wallet route
    app.get('/wallet', this.handleGetWalletAddress.bind(this));

    // Define a POST endpoint for the /sign route
    app.post('/sign', this.handlePostSign.bind(this));

    // Start the server
    const port = process.env.PORT || 3000;

    // Use dynamic import to import index.js
    const module = await import('./index.js');
    const proxy = new module.DogePoundProxy();
    await proxy.start(port);
  }
}

module.exports = DogePoundProxy;
