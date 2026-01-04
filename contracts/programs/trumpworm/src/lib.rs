use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("TRUMPworm111111111111111111111111111111111");

#[program]
pub mod trumpworm {
    use super::*;

    /// Initialize the game treasury and leaderboard
    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        let game_state = &mut ctx.accounts.game_state;
        game_state.authority = ctx.accounts.authority.key();
        game_state.treasury = ctx.accounts.treasury.key();
        game_state.token_mint = ctx.accounts.token_mint.key();
        game_state.total_distributed = 0;
        game_state.distribution_count = 0;
        game_state.bump = bump;

        msg!("TRUMPWORM Game State initialized!");
        Ok(())
    }

    /// Register a player (creates on-chain record)
    pub fn register_player(ctx: Context<RegisterPlayer>, username: String) -> Result<()> {
        require!(username.len() <= 15, TrumpwormError::UsernameTooLong);

        let player = &mut ctx.accounts.player_account;
        player.wallet = ctx.accounts.player.key();
        player.username = username;
        player.total_score = 0;
        player.total_kills = 0;
        player.games_played = 0;
        player.rewards_earned = 0;
        player.registered_at = Clock::get()?.unix_timestamp;

        msg!("Player registered: {}", player.username);
        Ok(())
    }

    /// Update player stats after a game session
    pub fn update_stats(
        ctx: Context<UpdateStats>,
        score: u64,
        kills: u32,
    ) -> Result<()> {
        let player = &mut ctx.accounts.player_account;

        // Only authority (game server) can update stats
        require!(
            ctx.accounts.authority.key() == ctx.accounts.game_state.authority,
            TrumpwormError::Unauthorized
        );

        player.total_score = player.total_score.checked_add(score).unwrap();
        player.total_kills = player.total_kills.checked_add(kills).unwrap();
        player.games_played = player.games_played.checked_add(1).unwrap();

        msg!("Stats updated for {}: +{} score, +{} kills", player.username, score, kills);
        Ok(())
    }

    /// Distribute rewards to top players
    /// Called hourly by the game server
    pub fn distribute_rewards(
        ctx: Context<DistributeRewards>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.game_state.authority,
            TrumpwormError::Unauthorized
        );
        require!(amounts.len() <= 10, TrumpwormError::TooManyRecipients);
        require!(
            amounts.len() == ctx.remaining_accounts.len(),
            TrumpwormError::MismatchedRecipients
        );

        let game_state = &mut ctx.accounts.game_state;
        let seeds = &[
            b"treasury",
            game_state.token_mint.as_ref(),
            &[game_state.bump],
        ];
        let signer = &[&seeds[..]];

        let mut total_distributed: u64 = 0;

        // Distribute to each recipient
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
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

            token::transfer(cpi_ctx, *amount)?;
            total_distributed = total_distributed.checked_add(*amount).unwrap();

            msg!("Distributed {} tokens to recipient {}", amount, i + 1);
        }

        game_state.total_distributed = game_state.total_distributed
            .checked_add(total_distributed)
            .unwrap();
        game_state.distribution_count = game_state.distribution_count
            .checked_add(1)
            .unwrap();
        game_state.last_distribution = Clock::get()?.unix_timestamp;

        msg!("Distribution #{} complete: {} tokens to {} players",
            game_state.distribution_count,
            total_distributed,
            amounts.len()
        );

        Ok(())
    }

    /// Withdraw tokens from treasury (admin only)
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.game_state.authority,
            TrumpwormError::Unauthorized
        );

        let game_state = &ctx.accounts.game_state;
        let seeds = &[
            b"treasury",
            game_state.token_mint.as_ref(),
            &[game_state.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, amount)?;

        msg!("Withdrawn {} tokens from treasury", amount);
        Ok(())
    }
}

// ============ ACCOUNTS ============

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GameState::INIT_SPACE,
        seeds = [b"game_state", token_mint.key().as_ref()],
        bump
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        init,
        payer = authority,
        seeds = [b"treasury", token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = treasury,
    )]
    pub treasury: Account<'info, TokenAccount>,

    /// CHECK: Token mint for the game token ($TRUMPWORM)
    pub token_mint: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterPlayer<'info> {
    #[account(
        init,
        payer = player,
        space = 8 + PlayerAccount::INIT_SPACE,
        seeds = [b"player", player.key().as_ref()],
        bump
    )]
    pub player_account: Account<'info, PlayerAccount>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateStats<'info> {
    #[account(
        seeds = [b"game_state", game_state.token_mint.as_ref()],
        bump = game_state.bump,
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [b"player", player_account.wallet.as_ref()],
        bump
    )]
    pub player_account: Account<'info, PlayerAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DistributeRewards<'info> {
    #[account(
        mut,
        seeds = [b"game_state", game_state.token_mint.as_ref()],
        bump = game_state.bump,
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [b"treasury", game_state.token_mint.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"game_state", game_state.token_mint.as_ref()],
        bump = game_state.bump,
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        seeds = [b"treasury", game_state.token_mint.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============ STATE ============

#[account]
#[derive(InitSpace)]
pub struct GameState {
    pub authority: Pubkey,          // Game server wallet
    pub treasury: Pubkey,           // Treasury token account
    pub token_mint: Pubkey,         // $TRUMPWORM token mint
    pub total_distributed: u64,     // Total tokens distributed
    pub distribution_count: u64,    // Number of distributions
    pub last_distribution: i64,     // Timestamp of last distribution
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerAccount {
    pub wallet: Pubkey,             // Player's wallet address
    #[max_len(15)]
    pub username: String,           // In-game username
    pub total_score: u64,           // Cumulative score
    pub total_kills: u32,           // Cumulative kills
    pub games_played: u32,          // Number of games played
    pub rewards_earned: u64,        // Total tokens earned
    pub registered_at: i64,         // Registration timestamp
}

// ============ ERRORS ============

#[error_code]
pub enum TrumpwormError {
    #[msg("Username must be 15 characters or less")]
    UsernameTooLong,
    #[msg("Unauthorized: Only game authority can perform this action")]
    Unauthorized,
    #[msg("Too many recipients (max 10)")]
    TooManyRecipients,
    #[msg("Number of amounts must match number of recipient accounts")]
    MismatchedRecipients,
}
