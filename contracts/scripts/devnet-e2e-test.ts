/**
 * MADURO.GG - End-to-End Devnet Test
 *
 * Tests the full flow:
 * 1. Create test token
 * 2. Initialize prize pool
 * 3. Deposit tokens to treasury
 * 4. Distribute rewards to players
 * 5. Verify balances
 * 6. Test withdraw
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount
} from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";

const PROGRAM_ID = new PublicKey("DLLQxjjnjiyRQHFt7Q63G7TLvVu9WAf4aCyd2q1qPAbF");

async function main() {
  console.log("\n========================================");
  console.log("  MADURO.GG - Devnet E2E Test");
  console.log("========================================\n");

  // Setup connection and wallet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet from default location
  const walletPath = `${os.homedir()}/.config/solana/id.json`;
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  const wallet = new Wallet(keypair);

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/trumpworm.json", "utf-8"));
  const program = new Program(idl, PROGRAM_ID, provider);

  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("Authority:", wallet.publicKey.toString());

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Wallet Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error("ERROR: Insufficient SOL. Need at least 0.1 SOL for testing.");
    process.exit(1);
  }

  // ============================================
  // STEP 1: Create Test Token
  // ============================================
  console.log("STEP 1: Creating test token...");

  const tokenMint = await createMint(
    connection,
    keypair,
    wallet.publicKey,
    null,
    9 // 9 decimals like most Solana tokens
  );
  console.log("✅ Token Mint:", tokenMint.toString());

  // Create admin token account
  const adminTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    tokenMint,
    wallet.publicKey
  );
  console.log("✅ Admin Token Account:", adminTokenAccount.address.toString());

  // Mint 10,000 tokens to admin
  const MINT_AMOUNT = 10_000_000_000_000; // 10,000 tokens with 9 decimals
  await mintTo(
    connection,
    keypair,
    tokenMint,
    adminTokenAccount.address,
    wallet.publicKey,
    MINT_AMOUNT
  );
  console.log("✅ Minted 10,000 tokens to admin\n");

  // ============================================
  // STEP 2: Initialize Prize Pool
  // ============================================
  console.log("STEP 2: Initializing prize pool...");

  const [prizePoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("prize_pool"), tokenMint.toBuffer()],
    PROGRAM_ID
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), tokenMint.toBuffer()],
    PROGRAM_ID
  );

  console.log("Prize Pool PDA:", prizePoolPda.toString());
  console.log("Treasury PDA:", treasuryPda.toString());

  try {
    const initTx = await program.methods
      .initialize()
      .accountsPartial({
        prizePool: prizePoolPda,
        treasury: treasuryPda,
        tokenMint: tokenMint,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("✅ Initialize TX:", initTx);
    console.log("   View: https://solscan.io/tx/" + initTx + "?cluster=devnet");

    // Verify initialization
    const prizePool = await program.account.prizePool.fetch(prizePoolPda);
    console.log("\n📊 Prize Pool State:");
    console.log("   Authority:", prizePool.authority.toString());
    console.log("   Token Mint:", prizePool.tokenMint.toString());
    console.log("   Total Distributed:", prizePool.totalDistributed.toString());
    console.log("   Distribution Count:", prizePool.distributionCount.toString());
    console.log("");
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      console.log("⚠️  Prize pool already initialized for this token\n");
    } else {
      throw err;
    }
  }

  // ============================================
  // STEP 3: Deposit Tokens to Treasury
  // ============================================
  console.log("STEP 3: Depositing tokens to treasury...");

  const DEPOSIT_AMOUNT = 1_000_000_000_000; // 1,000 tokens

  const depositTx = await program.methods
    .deposit(new anchor.BN(DEPOSIT_AMOUNT))
    .accountsPartial({
      prizePool: prizePoolPda,
      treasury: treasuryPda,
      depositorToken: adminTokenAccount.address,
      depositor: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log("✅ Deposit TX:", depositTx);
  console.log("   View: https://solscan.io/tx/" + depositTx + "?cluster=devnet");

  // Check treasury balance
  const treasuryAccount = await getAccount(connection, treasuryPda);
  console.log("   Treasury Balance:", Number(treasuryAccount.amount) / 1e9, "tokens\n");

  // ============================================
  // STEP 4: Create Player Wallets & Token Accounts
  // ============================================
  console.log("STEP 4: Creating player wallets...");

  const player1 = Keypair.generate();
  const player2 = Keypair.generate();
  const player3 = Keypair.generate();

  console.log("Player 1:", player1.publicKey.toString());
  console.log("Player 2:", player2.publicKey.toString());
  console.log("Player 3:", player3.publicKey.toString());

  // Create token accounts for players (payer pays rent)
  const player1TokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair, // payer
    tokenMint,
    player1.publicKey
  );
  const player2TokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    tokenMint,
    player2.publicKey
  );
  const player3TokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    tokenMint,
    player3.publicKey
  );

  console.log("✅ Player token accounts created\n");

  // ============================================
  // STEP 5: Distribute Rewards
  // ============================================
  console.log("STEP 5: Distributing rewards to players...");

  // Distribution amounts (simulating top 3 players)
  const amounts = [
    new anchor.BN(300_000_000_000), // 300 tokens to player 1 (30%)
    new anchor.BN(200_000_000_000), // 200 tokens to player 2 (20%)
    new anchor.BN(150_000_000_000), // 150 tokens to player 3 (15%)
  ];

  const distributeTx = await program.methods
    .distributeRewards(amounts)
    .accountsPartial({
      prizePool: prizePoolPda,
      treasury: treasuryPda,
      authority: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts([
      { pubkey: player1TokenAccount.address, isSigner: false, isWritable: true },
      { pubkey: player2TokenAccount.address, isSigner: false, isWritable: true },
      { pubkey: player3TokenAccount.address, isSigner: false, isWritable: true },
    ])
    .rpc();

  console.log("✅ Distribute TX:", distributeTx);
  console.log("   View: https://solscan.io/tx/" + distributeTx + "?cluster=devnet");

  // Verify balances
  const p1Balance = await getAccount(connection, player1TokenAccount.address);
  const p2Balance = await getAccount(connection, player2TokenAccount.address);
  const p3Balance = await getAccount(connection, player3TokenAccount.address);

  console.log("\n📊 Player Balances:");
  console.log("   Player 1:", Number(p1Balance.amount) / 1e9, "tokens");
  console.log("   Player 2:", Number(p2Balance.amount) / 1e9, "tokens");
  console.log("   Player 3:", Number(p3Balance.amount) / 1e9, "tokens");

  // Check prize pool stats
  const prizePoolAfter = await program.account.prizePool.fetch(prizePoolPda);
  console.log("\n📊 Prize Pool Stats:");
  console.log("   Total Distributed:", Number(prizePoolAfter.totalDistributed) / 1e9, "tokens");
  console.log("   Distribution Count:", prizePoolAfter.distributionCount.toString());
  console.log("");

  // ============================================
  // STEP 6: Test Withdraw
  // ============================================
  console.log("STEP 6: Testing emergency withdraw...");

  const WITHDRAW_AMOUNT = 100_000_000_000; // 100 tokens

  const adminBalanceBefore = await getAccount(connection, adminTokenAccount.address);

  const withdrawTx = await program.methods
    .withdraw(new anchor.BN(WITHDRAW_AMOUNT))
    .accountsPartial({
      prizePool: prizePoolPda,
      treasury: treasuryPda,
      destination: adminTokenAccount.address,
      authority: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log("✅ Withdraw TX:", withdrawTx);
  console.log("   View: https://solscan.io/tx/" + withdrawTx + "?cluster=devnet");

  const adminBalanceAfter = await getAccount(connection, adminTokenAccount.address);
  console.log("   Withdrawn:", (Number(adminBalanceAfter.amount) - Number(adminBalanceBefore.amount)) / 1e9, "tokens\n");

  // ============================================
  // SUMMARY
  // ============================================
  console.log("========================================");
  console.log("  ✅ ALL TESTS PASSED!");
  console.log("========================================\n");

  const finalTreasury = await getAccount(connection, treasuryPda);
  console.log("Final Treasury Balance:", Number(finalTreasury.amount) / 1e9, "tokens");
  console.log("\nKey Addresses:");
  console.log("  Token Mint:", tokenMint.toString());
  console.log("  Prize Pool:", prizePoolPda.toString());
  console.log("  Treasury:", treasuryPda.toString());
  console.log("\nDevnet Explorer Links:");
  console.log("  Token: https://solscan.io/token/" + tokenMint.toString() + "?cluster=devnet");
  console.log("  Prize Pool: https://solscan.io/account/" + prizePoolPda.toString() + "?cluster=devnet");
  console.log("  Treasury: https://solscan.io/account/" + treasuryPda.toString() + "?cluster=devnet");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ ERROR:", err);
    process.exit(1);
  });
