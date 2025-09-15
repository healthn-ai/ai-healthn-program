// Init - 初始化程序代币账户
// No imports needed: web3, anchor, pg and more are globally available

console.log("My address:", pg.wallet.publicKey.toString());
const balance = await pg.connection.getBalance(pg.wallet.publicKey);
console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

// 创建程序代币账户的函数
async function createProgramTokenAccount(tokenMint) {
  try {
    // 计算 vault authority PDA
    const [vaultAuthority] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("vault"), tokenMint.toBuffer()],
      pg.program.programId
    );

    // 计算程序的 ATA
    const programATA = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: vaultAuthority,
    });

    console.log(`\n=== 创建程序代币账户 ===`);
    console.log("代币Mint:", tokenMint.toString());
    console.log("Vault Authority:", vaultAuthority.toString());
    console.log("程序ATA:", programATA.toString());

    // 检查账户是否已存在
    const accountInfo = await pg.connection.getAccountInfo(programATA);
    if (accountInfo) {
      console.log("✅ 程序代币账户已存在");
      return programATA;
    }

    // 调用合约创建账户
    const createTx = await pg.program.methods
      .createProgramTokenAccount()
      .accounts({
        programTokenAccount: programATA,
        tokenMint: tokenMint,
        vaultAuthority: vaultAuthority,
        payer: pg.wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ 程序代币账户创建成功`);
    console.log(`交易哈希: ${createTx}`);
    return programATA;
  } catch (error) {
    console.log(`❌ 创建程序代币账户失败:`, error.message);
    throw error;
  }
}

// 代币信息
const tokenMint1 = new web3.PublicKey(
  "46TfUxewP8FftqfN8QJYjeBktGziPkgKrejYEzrazFHa"
);
// PDA：CwtMAnrzqSCy7mzHnbGt4pBvqvQQSy7FBfdjycRFHEVy
// 程序ATA: 7YpntAGzd9461ZKELWEySxTysXHEHDikr43pa9kP3tfi

const tokenMint2 = new web3.PublicKey(
  "5SWf8B895w5C2fDG4KXmEAE2ZZaeU6VYckWJ9BNbarBC"
);
// PDA：Fm7neawTEPWvaD6zrSHjisrqzFKRh9yJSEhw42xVGLsk
// 程序ATA: 9Z2PkWSauKLQfcLMB5eKpR3GcChvxLnxjXZf4WAtiNbq

console.log("\n=== 初始化程序代币账户 ===");
console.log("代币1信息:");
console.log("  Mint:", tokenMint1.toString());
console.log("  Decimals: 9");

console.log("代币2信息:");
console.log("  Mint:", tokenMint2.toString());
console.log("  Decimals: 6");

// 执行初始化 - 创建程序代币账户
try {
  console.log("\n🔧 初始化代币1的程序账户");
  await createProgramTokenAccount(tokenMint1);

  console.log("\n🔧 初始化代币2的程序账户");
  await createProgramTokenAccount(tokenMint2);

  console.log("\n✅ 所有程序代币账户初始化完成");
} catch (error) {
  console.log("初始化过程中出现错误:", error.message);
}

console.log("\n=== 初始化完成 ===");
console.log("程序地址:", pg.program.programId.toString());
