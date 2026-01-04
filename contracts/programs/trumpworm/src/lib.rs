use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("DLLQxjjnjiyRQHFt7Q63G7TLvVu9WAf4aCyd2q1qPAbF");

/// MADURO.GG - Trustless Prize Pool Escrow
///
/// Simple escrow contract for hourly reward distribution:
/// 1. Treasury PDA holds the prize pool (not a personal wallet)
/// 2. Server calls distribute_rewards with top 10 wallet addresses
/// 3. Contract transfers tokens directly - all visible on Solscan
/// 4. Anyone can deposit to prize pool (from creator fees)

#[program]
pub mod trumpworm {
    use super::*;

    /// Initialize the prize pool treasury
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let pool = &mut ctx.accounts.prize_pool;
        pool.authority = ctx.accounts.authority.key();
        pool.token_mint = ctx.accounts.token_mint.key();
        pool.total_distributed = 0;
        pool.distribution_count = 0;
        pool.bump = ctx.bumps.prize_pool;

        msg!("MADURO.GG Prize Pool initialized!");
        msg!("Authority: {}", pool.authority);
        msg!("Token: {}", pool.token_mint);
        Ok(())
    }

    /// Deposit tokens into the prize pool (anyone can call)
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, MaduroError::ZeroAmount);

        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor_token.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        msg!("Deposited {} tokens to prize pool", amount);
        Ok(())
    }

    /// Distribute rewards to top players (authority only)
    /// Called hourly by the game server
    pub fn distribute_rewards<'info>(
        ctx: Context<'_, '_, 'info, 'info, DistributeRewards<'info>>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.prize_pool.authority,
            MaduroError::Unauthorized
        );
        require!(amounts.len() <= 10, MaduroError::TooManyRecipients);
        require!(
            amounts.len() == ctx.remaining_accounts.len(),
            MaduroError::RecipientMismatch
        );

        let pool = &ctx.accounts.prize_pool;
        let seeds = &[
            b"prize_pool",
            pool.token_mint.as_ref(),
            &[pool.bump],
        ];
        let signer = &[&seeds[..]];

        let mut total: u64 = 0;

        // Transfer to each recipient
        for (i, amount) in amounts.iter().enumerate() {
            if *amount == 0 {
                continue;
            }

            let recipient = &ctx.remaining_accounts[i];

            let cpi_accounts = Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: recipient.to_account_info(),
                authority: ctx.accounts.treasury.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );
            token::transfer(cpi_ctx, *amount)?;

            total = total.checked_add(*amount).unwrap();
            msg!("Sent {} tokens to player #{}", amount, i + 1);
        }

        // Update stats
        let pool = &mut ctx.accounts.prize_pool;
        pool.total_distributed = pool.total_distributed.checked_add(total).unwrap();
        pool.distribution_count = pool.distribution_count.checked_add(1).unwrap();
        pool.last_distribution = Clock::get()?.unix_timestamp;

        msg!(
            "Distribution #{}: {} tokens to {} players",
            pool.distribution_count,
            total,
            amounts.len()
        );
        Ok(())
    }

    /// Emergency withdrawal (authority only)
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.prize_pool.authority,
            MaduroError::Unauthorized
        );

        let pool = &ctx.accounts.prize_pool;
        let seeds = &[
            b"prize_pool",
            pool.token_mint.as_ref(),
            &[pool.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        msg!("Emergency withdrawal: {} tokens", amount);
        Ok(())
    }

    /// Transfer authority to new wallet
    pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.prize_pool.authority,
            MaduroError::Unauthorized
        );

        let pool = &mut ctx.accounts.prize_pool;
        pool.authority = ctx.accounts.new_authority.key();

        msg!("Authority transferred to {}", pool.authority);
        Ok(())
    }
}

// ============ ACCOUNTS ============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PrizePool::INIT_SPACE,
        seeds = [b"prize_pool", token_mint.key().as_ref()],
        bump
    )]
    pub prize_pool: Account<'info, PrizePool>,

    #[account(
        init,
        payer = authority,
        seeds = [b"treasury", token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = treasury,
    )]
    pub treasury: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, token::Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"prize_pool", prize_pool.token_mint.as_ref()],
        bump = prize_pool.bump,
    )]
    pub prize_pool: Account<'info, PrizePool>,

    #[account(
        mut,
        seeds = [b"treasury", prize_pool.token_mint.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor_token: Account<'info, TokenAccount>,

    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DistributeRewards<'info> {
    #[account(
        mut,
        seeds = [b"prize_pool", prize_pool.token_mint.as_ref()],
        bump = prize_pool.bump,
    )]
    pub prize_pool: Account<'info, PrizePool>,

    #[account(
        mut,
        seeds = [b"treasury", prize_pool.token_mint.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"prize_pool", prize_pool.token_mint.as_ref()],
        bump = prize_pool.bump,
    )]
    pub prize_pool: Account<'info, PrizePool>,

    #[account(
        mut,
        seeds = [b"treasury", prize_pool.token_mint.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(
        mut,
        seeds = [b"prize_pool", prize_pool.token_mint.as_ref()],
        bump = prize_pool.bump,
    )]
    pub prize_pool: Account<'info, PrizePool>,

    pub authority: Signer<'info>,

    /// CHECK: New authority, just need the pubkey
    pub new_authority: AccountInfo<'info>,
}

// ============ STATE ============

#[account]
#[derive(InitSpace)]
pub struct PrizePool {
    pub authority: Pubkey,          // Server wallet that can distribute
    pub token_mint: Pubkey,         // $MADURO token mint
    pub total_distributed: u64,     // Lifetime tokens distributed
    pub distribution_count: u64,    // Number of hourly distributions
    pub last_distribution: i64,     // Unix timestamp of last distribution
    pub bump: u8,
}

// ============ ERRORS ============

#[error_code]
pub enum MaduroError {
    #[msg("Unauthorized: Only authority can perform this action")]
    Unauthorized,
    #[msg("Cannot deposit zero tokens")]
    ZeroAmount,
    #[msg("Too many recipients (max 10)")]
    TooManyRecipients,
    #[msg("Number of amounts must match number of recipient accounts")]
    RecipientMismatch,
}
