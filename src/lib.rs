use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("5PkzwskiUGBr6HoqeALh3Y9k1kPK4a7xCZWi5q39LVLy");

#[program]
pub mod token_transfer {
    use super::*;

    /// 从程序拥有的ATA转账代币给用户（自动创建接收方ATA如果不存在）
    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // 校验payer必须是指定的公钥
        let authorized_payer = "E4tL4xNAmtrEMxd9yi2YupxzvB3XPV5eKo4z15oyphsk".parse::<Pubkey>()
            .map_err(|_| ErrorCode::Unauthorized)?;
        require!(
            ctx.accounts.payer.key() == authorized_payer,
            ErrorCode::Unauthorized
        );

        // Anchor 约束已经验证了所有必要的条件
        // 无需额外的手动验证

        let transfer_instruction = Transfer {
            from: ctx.accounts.from_token_account.to_account_info(),
            to: ctx.accounts.to_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };

        // 使用与账户约束相同的 seeds 进行 CPI 签名
        let bump = ctx.bumps.vault_authority;
        let token_mint_key = ctx.accounts.token_mint.key();
        let vault_seeds = &[b"vault", token_mint_key.as_ref(), &[bump]];
        let signer_seeds = &[&vault_seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            signer_seeds,
        );

        token::transfer(cpi_ctx, amount)?;

        msg!(
            "Transferred {} tokens from {} to {} (payer: {}, vault: {})",
            amount,
            ctx.accounts.from_token_account.key(),
            ctx.accounts.to_token_account.key(),
            ctx.accounts.payer.key(),
            ctx.accounts.vault_authority.key()
        );

        Ok(())
    }

    /// 创建程序拥有的代币账户（用于接收代币）
    pub fn create_program_token_account(ctx: Context<CreateProgramTokenAccount>) -> Result<()> {
        msg!(
            "Created program token account {} for mint: {} with vault authority: {}",
            ctx.accounts.program_token_account.key(),
            ctx.accounts.token_mint.key(),
            ctx.accounts.vault_authority.key()
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    /// 发送方的代币账户（程序拥有的ATA）
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority
    )]
    pub from_token_account: Account<'info, TokenAccount>,

    /// 接收方的ATA账户（如果不存在会自动创建，由调用者支付）
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = to_wallet
    )]
    pub to_token_account: Account<'info, TokenAccount>,

    /// 代币mint账户
    pub token_mint: Account<'info, Mint>,

    /// CHECK: 接收者钱包地址
    pub to_wallet: UncheckedAccount<'info>,

    /// PDA vault authority（每个代币mint对应一个独立的vault authority）
    #[account(
        seeds = [b"vault", token_mint.key().as_ref()],
        bump
    )]
    /// CHECK: PDA vault authority for the specific token mint
    pub vault_authority: UncheckedAccount<'info>,

    /// 调用者钱包（支付所有费用：gas + 账户创建）
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProgramTokenAccount<'info> {
    /// 程序的ATA账户（将被创建）
    #[account(
        init,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority
    )]
    pub program_token_account: Account<'info, TokenAccount>,

    /// 代币mint账户
    pub token_mint: Account<'info, Mint>,

    /// PDA vault authority（每个代币对应独立的vault）
    #[account(
        seeds = [b"vault", token_mint.key().as_ref()],
        bump
    )]
    /// CHECK: PDA vault authority for the specific token mint
    pub vault_authority: UncheckedAccount<'info>,

    /// 支付账户创建费用的账户
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount - must be greater than 0")]
    InvalidAmount,
    #[msg("Insufficient balance - not enough tokens to transfer")]
    InsufficientBalance,
    #[msg("Token mint mismatch - accounts must be for the same token")]
    TokenMintMismatch,
    #[msg("Invalid vault authority - must be the correct PDA for this token mint")]
    InvalidVaultAuthority,
    #[msg("Unauthorized transfer - payer must be the authorized address")]
    Unauthorized,
}
