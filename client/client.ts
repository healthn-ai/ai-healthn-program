// Client - 代币转账客户端示例（修复版）
// No imports needed: web3, anchor, pg and more are globally available

console.log("My address:", pg.wallet.publicKey.toString());
const balance = await pg.connection.getBalance(pg.wallet.publicKey);
console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

// 超简化的转账函数 - 用户只需要传3个参数
async function simpleTransfer(tokenMint, receiverWallet, amount, decimals) {
  try {
    // ✅ 修复：计算正确的 vault authority PDA
    const [vaultAuthority] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("vault"), tokenMint.toBuffer()], // 使用 "vault" + mint
      pg.program.programId
    );

    // ✅ 修复：使用正确的 vault authority 计算发送方 ATA
    const senderATA = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: vaultAuthority, // 使用 vault authority 而不是 program ID
    });

    const receiverATA = await anchor.utils.token.associatedAddress({
      mint: tokenMint,
      owner: receiverWallet,
    });

    console.log(`\n=== 转账 ${amount} 个代币 ===`);
    console.log("代币Mint:", tokenMint.toString());
    console.log("Vault Authority:", vaultAuthority.toString());
    console.log("发送方ATA:", senderATA.toString());
    console.log("接收方钱包:", receiverWallet.toString());
    console.log("接收方ATA:", receiverATA.toString());

    // 检查发送方ATA是否存在
    try {
      const senderATAInfo = await pg.connection.getAccountInfo(senderATA);
      if (!senderATAInfo) {
        console.log("❌ 发送方ATA不存在:", senderATA.toString());
        console.log(
          "💡 提示：请先使用 create_program_token_account 创建程序的代币账户"
        );
        throw new Error("发送方ATA不存在，请先创建程序的代币账户");
      } else {
        console.log("✅ 发送方ATA存在");
        // 解析代币账户信息
        const tokenAccountData = await pg.connection.getParsedAccountInfo(
          senderATA
        );
        if (
          tokenAccountData.value &&
          tokenAccountData.value.data &&
          "parsed" in tokenAccountData.value.data
        ) {
          const parsedData = tokenAccountData.value.data.parsed;
          console.log("发送方ATA owner:", parsedData.info.owner);
          console.log("发送方ATA mint:", parsedData.info.mint);
          console.log(
            "发送方ATA amount:",
            parsedData.info.tokenAmount.uiAmount
          );
        }
      }
    } catch (error) {
      console.log("❌ 检查发送方ATA失败:", error.message);
      throw error;
    }

    const transferAmount = amount * 10 ** decimals;
    console.log("转账金额:", transferAmount.toString());

    // ✅ 修复：调用合约进行转账，使用正确的参数和账户名
    const transferTx = await pg.program.methods
      .transferTokens(
        new anchor.BN(transferAmount) // 只需要 amount 参数
      )
      .accounts({
        fromTokenAccount: senderATA,
        toTokenAccount: receiverATA,
        tokenMint: tokenMint,
        toWallet: receiverWallet,
        vaultAuthority: vaultAuthority, // 修复：使用正确的账户名
        payer: pg.wallet.publicKey, // 修复：使用正确的账户名
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ 转账成功: ${amount} 个代币 (decimals: ${decimals})`);
    console.log(`交易哈希: ${transferTx}`);
    return transferTx;
  } catch (error) {
    console.log(`❌ 转账失败:`, error.message);
    console.log("错误详情:", error);
    throw error;
  }
}

// 代币转账示例
console.log("\n=== 代币转账示例 ===");

// 代币信息
const tokenMint1 = new web3.PublicKey(
  "46TfUxewP8FftqfN8QJYjeBktGziPkgKrejYEzrazFHa"
);
const tokenMint2 = new web3.PublicKey(
  "5SWf8B895w5C2fDG4KXmEAE2ZZaeU6VYckWJ9BNbarBC"
);

// 接收者钱包地址
const receiverWallet = new web3.PublicKey(
  "FQnMNMoQJmMT9G6eZfUADXnyizX1vo2gMo4JBQjeWPU5"
);

console.log("代币1信息:");
console.log("  Mint:", tokenMint1.toString());
console.log("  Decimals: 9");

console.log("代币2信息:");
console.log("  Mint:", tokenMint2.toString());
console.log("  Decimals: 6");

console.log("接收者钱包:", receiverWallet.toString());

// 执行转账 - 完整流程
try {
  // SPL 转账
  console.log("\n💸 执行转账");
  await simpleTransfer(tokenMint1, receiverWallet, 1, 9);

  // USDT 转账
  await simpleTransfer(tokenMint2, receiverWallet, 2, 6);
} catch (error) {
  console.log("转账过程中出现错误:", error.message);
  console.log(
    "💡 提示：如果出现'发送方ATA不存在'错误，请先运行 init.ts 创建程序代币账户"
  );
}

console.log("\n=== 操作完成 ===");
console.log("程序地址:", pg.program.programId.toString());
