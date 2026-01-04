// Phantom Wallet Integration for Solana
class WalletManager {
  constructor() {
    this.wallet = null;
    this.publicKey = null;
    this.isConnected = false;
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
        // Redirect to Phantom download page
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
        } else {
          this.disconnect();
        }
      });

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
}

// Global wallet instance
window.walletManager = new WalletManager();
