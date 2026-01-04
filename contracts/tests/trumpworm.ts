import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Trumpworm } from "../target/types/trumpworm";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount
} from "@solana/spl-token";
import { assert } from "chai";

describe("MADURO.GG Escrow Contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Trumpworm as Program<Trumpworm>;

  let tokenMint: PublicKey;
  let prizePoolPda: PublicKey;
  let treasuryPda: PublicKey;
  let adminTokenAccount: PublicKey;
  let player1TokenAccount: PublicKey;
  let player2TokenAccount: PublicKey;
  let player3TokenAccount: PublicKey;

  const player1 = Keypair.generate();
  const player2 = Keypair.generate();
  const player3 = Keypair.generate();

  before(async () => {
    // Airdrop to players for token accounts
    const airdropSig1 = await provider.connection.requestAirdrop(
      player1.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig1);

    // Create test token mint
    tokenMint = await createMint(
      provider.connection,
      (provider.wallet as any).payer,
      provider.wallet.publicKey,
      null,
      9
    );
    console.log("Token Mint:", tokenMint.toString());

    // Derive PDAs
    [prizePoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("prize_pool"), tokenMint.toBuffer()],
      program.programId
    );
    [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), tokenMint.toBuffer()],
      program.programId
    );
    console.log("Prize Pool PDA:", prizePoolPda.toString());
    console.log("Treasury PDA:", treasuryPda.toString());

    // Create admin token account
    adminTokenAccount = await createAccount(
      provider.connection,
      (provider.wallet as any).payer,
      tokenMint,
      provider.wallet.publicKey
    );

    // Mint tokens to admin for testing
    await mintTo(
      provider.connection,
      (provider.wallet as any).payer,
      tokenMint,
      adminTokenAccount,
      provider.wallet.publicKey,
      1_000_000_000_000 // 1000 tokens (9 decimals)
    );
    console.log("Minted 1000 tokens to admin");
  });

  describe("1. Initialize", () => {
    it("initializes the prize pool", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          prizePool: prizePoolPda,
          treasury: treasuryPda,
          tokenMint: tokenMint,
          authority: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("Initialize TX:", tx);

      const prizePool = await program.account.prizePool.fetch(prizePoolPda);
      assert.equal(prizePool.authority.toString(), provider.wallet.publicKey.toString());
      assert.equal(prizePool.tokenMint.toString(), tokenMint.toString());
      assert.equal(prizePool.totalDistributed.toNumber(), 0);
      assert.equal(prizePool.distributionCount.toNumber(), 0);

      console.log("Prize Pool initialized successfully!");
    });
  });

  describe("2. Deposit", () => {
    it("deposits tokens to prize pool", async () => {
      const depositAmount = 100_000_000_000; // 100 tokens

      const treasuryBefore = await getAccount(provider.connection, treasuryPda);

      const tx = await program.methods
        .deposit(new anchor.BN(depositAmount))
        .accounts({
          prizePool: prizePoolPda,
          treasury: treasuryPda,
          depositorToken: adminTokenAccount,
          depositor: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Deposit TX:", tx);

      const treasuryAfter = await getAccount(provider.connection, treasuryPda);
      assert.equal(
        Number(treasuryAfter.amount) - Number(treasuryBefore.amount),
        depositAmount
      );

      console.log(`Deposited ${depositAmount / 1e9} tokens to treasury`);
    });

    it("fails to deposit zero tokens", async () => {
      try {
        await program.methods
          .deposit(new anchor.BN(0))
          .accounts({
            prizePool: prizePoolPda,
            treasury: treasuryPda,
            depositorToken: adminTokenAccount,
            depositor: provider.wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.include(err.message, "ZeroAmount");
        console.log("Correctly rejected zero deposit");
      }
    });
  });

  describe("3. Distribute Rewards", () => {
    before(async () => {
      // Create token accounts for players
      player1TokenAccount = await createAccount(
        provider.connection,
        (provider.wallet as any).payer,
        tokenMint,
        player1.publicKey
      );
      player2TokenAccount = await createAccount(
        provider.connection,
        (provider.wallet as any).payer,
        tokenMint,
        player2.publicKey
      );
      player3TokenAccount = await createAccount(
        provider.connection,
        (provider.wallet as any).payer,
        tokenMint,
        player3.publicKey
      );
    });

    it("distributes rewards to winners", async () => {
      const amounts = [
        new anchor.BN(30_000_000_000), // 30 tokens to player 1
        new anchor.BN(20_000_000_000), // 20 tokens to player 2
        new anchor.BN(10_000_000_000), // 10 tokens to player 3
      ];

      const tx = await program.methods
        .distributeRewards(amounts)
        .accounts({
          prizePool: prizePoolPda,
          treasury: treasuryPda,
          authority: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: player1TokenAccount, isSigner: false, isWritable: true },
          { pubkey: player2TokenAccount, isSigner: false, isWritable: true },
          { pubkey: player3TokenAccount, isSigner: false, isWritable: true },
        ])
        .rpc();

      console.log("Distribute TX:", tx);

      // Verify balances
      const p1Balance = await getAccount(provider.connection, player1TokenAccount);
      const p2Balance = await getAccount(provider.connection, player2TokenAccount);
      const p3Balance = await getAccount(provider.connection, player3TokenAccount);

      assert.equal(Number(p1Balance.amount), 30_000_000_000);
      assert.equal(Number(p2Balance.amount), 20_000_000_000);
      assert.equal(Number(p3Balance.amount), 10_000_000_000);

      // Verify prize pool stats
      const prizePool = await program.account.prizePool.fetch(prizePoolPda);
      assert.equal(prizePool.distributionCount.toNumber(), 1);
      assert.equal(prizePool.totalDistributed.toNumber(), 60_000_000_000);

      console.log("Distributed 60 tokens to 3 players");
    });

    it("fails when non-authority tries to distribute", async () => {
      const fakeAuthority = Keypair.generate();

      try {
        await program.methods
          .distributeRewards([new anchor.BN(1000)])
          .accounts({
            prizePool: prizePoolPda,
            treasury: treasuryPda,
            authority: fakeAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts([
            { pubkey: player1TokenAccount, isSigner: false, isWritable: true },
          ])
          .signers([fakeAuthority])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.include(err.message, "Unauthorized");
        console.log("Correctly rejected unauthorized distribution");
      }
    });

    it("fails with too many recipients", async () => {
      const amounts = Array(11).fill(new anchor.BN(1000));
      const accounts = Array(11).fill({
        pubkey: player1TokenAccount,
        isSigner: false,
        isWritable: true,
      });

      try {
        await program.methods
          .distributeRewards(amounts)
          .accounts({
            prizePool: prizePoolPda,
            treasury: treasuryPda,
            authority: provider.wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts(accounts)
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.include(err.message, "TooManyRecipients");
        console.log("Correctly rejected >10 recipients");
      }
    });
  });

  describe("4. Withdraw", () => {
    it("allows authority to withdraw", async () => {
      const withdrawAmount = 10_000_000_000; // 10 tokens

      const adminBefore = await getAccount(provider.connection, adminTokenAccount);

      const tx = await program.methods
        .withdraw(new anchor.BN(withdrawAmount))
        .accounts({
          prizePool: prizePoolPda,
          treasury: treasuryPda,
          destination: adminTokenAccount,
          authority: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Withdraw TX:", tx);

      const adminAfter = await getAccount(provider.connection, adminTokenAccount);
      assert.equal(
        Number(adminAfter.amount) - Number(adminBefore.amount),
        withdrawAmount
      );

      console.log("Withdrew 10 tokens successfully");
    });

    it("fails when non-authority tries to withdraw", async () => {
      const fakeAuthority = Keypair.generate();

      try {
        await program.methods
          .withdraw(new anchor.BN(1000))
          .accounts({
            prizePool: prizePoolPda,
            treasury: treasuryPda,
            destination: adminTokenAccount,
            authority: fakeAuthority.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([fakeAuthority])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.include(err.message, "Unauthorized");
        console.log("Correctly rejected unauthorized withdrawal");
      }
    });
  });

  describe("5. Transfer Authority", () => {
    it("transfers authority to new wallet", async () => {
      const newAuthority = Keypair.generate();

      const tx = await program.methods
        .transferAuthority()
        .accounts({
          prizePool: prizePoolPda,
          authority: provider.wallet.publicKey,
          newAuthority: newAuthority.publicKey,
        })
        .rpc();

      console.log("Transfer Authority TX:", tx);

      const prizePool = await program.account.prizePool.fetch(prizePoolPda);
      assert.equal(prizePool.authority.toString(), newAuthority.publicKey.toString());

      console.log("Authority transferred to:", newAuthority.publicKey.toString());

      // Transfer back for other tests
      await program.methods
        .transferAuthority()
        .accounts({
          prizePool: prizePoolPda,
          authority: newAuthority.publicKey,
          newAuthority: provider.wallet.publicKey,
        })
        .signers([newAuthority])
        .rpc();

      console.log("Authority transferred back");
    });
  });
});
