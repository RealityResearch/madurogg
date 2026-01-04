// Phantom Wallet Integration for Solana
// With TRUMPWORM contract interaction

const PROGRAM_ID = 'TRUMPworm111111111111111111111111111111111';
const DEVNET_RPC = 'https://api.devnet.solana.com';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

class WalletManager {
  constructor() {
    this.wallet = null;
    this.publicKey = null;
    this.isConnected = false;
    this.isMainnet = false; // Toggle for mainnet vs devnet
    this.playerRegistered = false;
  }

  // Get RPC endpoint
  getRpcUrl() {
    return this.isMainnet ? MAINNET_RPC : DEVNET_RPC;
  }

  // Check if Phantom is installed
  isPhantomInstalled() {
    return window.phantom?.solana?.isPhantom;
  }

  // Get Phantom provider
  getProvider() {
    if ('phantom' in window) {
      const provider = window.phantom?.solana;
      if (provider?.isPhantom) {
        return provider;
      }
    }
    return null;
  }

  // Connect to Phantom wallet
  async connect() {
    try {
      const provider = this.getProvider();

      if (!provider) {
        window.open('https://phantom.app/', '_blank');
        throw new Error('Phantom wallet not installed');
      }

      // Connect to the wallet
      const response = await provider.connect();
      this.publicKey = response.publicKey.toString();
      this.wallet = provider;
      this.isConnected = true;

      // Listen for disconnect
      provider.on('disconnect', () => {
        this.disconnect();
      });

      // Listen for account change
      provider.on('accountChanged', (publicKey) => {
        if (publicKey) {
          this.publicKey = publicKey.toString();
          this.playerRegistered = false;
        } else {
          this.disconnect();
        }
      });

      console.log('Wallet connected:', this.publicKey);
      return this.publicKey;
    } catch (error) {
      console.error('Wallet connection error:', error);
      throw error;
    }
  }

  // Disconnect wallet
  disconnect() {
    if (this.wallet) {
      this.wallet.disconnect();
    }
    this.wallet = null;
    this.publicKey = null;
    this.isConnected = false;
    this.playerRegistered = false;
  }

  // Get truncated address for display
  getTruncatedAddress() {
    if (!this.publicKey) return null;
    return `${this.publicKey.slice(0, 4)}...${this.publicKey.slice(-4)}`;
  }

  // Sign a message (for authentication)
  async signMessage(message) {
    if (!this.wallet || !this.isConnected) {
      throw new Error('Wallet not connected');
    }

    const encodedMessage = new TextEncoder().encode(message);
    const signature = await this.wallet.signMessage(encodedMessage, 'utf8');
    return signature;
  }

  // Verify wallet ownership by signing a message
  async verifyOwnership() {
    try {
      const timestamp = Date.now();
      const message = `TRUMPWORM.IO Verification\nWallet: ${this.publicKey}\nTimestamp: ${timestamp}`;

      const signature = await this.signMessage(message);

      return {
        wallet: this.publicKey,
        message,
        signature: Array.from(signature.signature),
        timestamp
      };
    } catch (error) {
      console.error('Verification failed:', error);
      throw error;
    }
  }

  // Register player on-chain (creates PlayerAccount PDA)
  async registerPlayer(username) {
    if (!this.wallet || !this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const verification = await this.verifyOwnership();
      verification.username = username;

      // Send to server for on-chain registration
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verification)
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const result = await response.json();
      this.playerRegistered = true;

      return result;
    } catch (error) {
      console.error('Player registration failed:', error);
      throw error;
    }
  }

  // Get SOL balance
  async getSolBalance() {
    if (!this.publicKey) return 0;

    try {
      const response = await fetch(this.getRpcUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [this.publicKey]
        })
      });

      const data = await response.json();
      return (data.result?.value || 0) / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('Failed to get SOL balance:', error);
      return 0;
    }
  }

  // Check pending rewards
  async checkPendingRewards() {
    if (!this.publicKey) return { pending: 0, claimed: 0 };

    try {
      const response = await fetch(`/api/rewards/${this.publicKey}`);
      if (!response.ok) {
        return { pending: 0, claimed: 0 };
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to check rewards:', error);
      return { pending: 0, claimed: 0 };
    }
  }

  // Claim rewards
  async claimRewards() {
    if (!this.wallet || !this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const verification = await this.verifyOwnership();

      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verification)
      });

      if (!response.ok) {
        throw new Error('Claim failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Claim failed:', error);
      throw error;
    }
  }

  // Sign and send transaction
  async signAndSendTransaction(transaction) {
    if (!this.wallet || !this.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const { signature } = await this.wallet.signAndSendTransaction(transaction);
      return signature;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }
}

// Global wallet instance
window.walletManager = new WalletManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WalletManager;
}
