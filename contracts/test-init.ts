import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint } from "@solana/spl-token";

async function main() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const idl = require("./target/idl/trumpworm.json");
  const programId = new PublicKey("Hqp3bwuxLTJGjsacPzo7Q2bpW9snYyDzxQXq1gY1e9EK");
  const program = new Program(idl, programId, provider);
  
  console.log("Program ID:", programId.toString());
  console.log("Authority:", provider.wallet.publicKey.toString());
  
  // Create a test token mint
  console.log("\nCreating test token mint...");
  const mintKeypair = Keypair.generate();
  const tokenMint = await createMint(
    provider.connection,
    (provider.wallet as any).payer,
    provider.wallet.publicKey,
    null,
    9, // decimals
    mintKeypair
  );
  console.log("Test Token Mint:", tokenMint.toString());
  
  // Derive PDAs
  const [prizePoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("prize_pool"), tokenMint.toBuffer()],
    programId
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), tokenMint.toBuffer()],
    programId
  );
  
  console.log("\nPrize Pool PDA:", prizePoolPda.toString());
  console.log("Treasury PDA:", treasuryPda.toString());
  
  // Initialize
  console.log("\nInitializing prize pool...");
  try {
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
    
    console.log("✅ Initialize TX:", tx);
    
    // Fetch and display the prize pool state
    const prizePool = await program.account.prizePool.fetch(prizePoolPda);
    console.log("\n📊 Prize Pool State:");
    console.log("  Authority:", prizePool.authority.toString());
    console.log("  Token Mint:", prizePool.tokenMint.toString());
    console.log("  Total Distributed:", prizePool.totalDistributed.toString());
    console.log("  Distribution Count:", prizePool.distributionCount.toString());
    
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
