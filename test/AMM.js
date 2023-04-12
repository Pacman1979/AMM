const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens

describe('AMM', () => {
  let accounts,
  		deployer,
  		liquidityProvider,
  		investor1,
  		investor2

  let token1,
  		token2,
  		amm

  beforeEach(async () => {
    accounts = await ethers.getSigners()
    deployer = accounts[0]
    liquidityProvider = accounts[1]
    investor1 = accounts[2]
    investor2 = accounts[3]

    const Token = await ethers.getContractFactory('Token')
    token1 = await Token.deploy('Dapp University', 'DAPP', '1000000')
    token2 = await Token.deploy('USD', 'USD', '1000000')

    let transaction = await token1.connect(deployer).transfer(liquidityProvider.address, tokens(100000))
    await transaction.wait()

    transaction = await token2.connect(deployer).transfer(liquidityProvider.address, tokens(100000))
    await transaction.wait()

    // Send token1 to investor1
    transaction = await token1.connect(deployer).transfer(investor1.address, tokens(100000))
    await transaction.wait()

    // Send token2 to investor2
    transaction = await token2.connect(deployer).transfer(investor2.address, tokens(100000))
    await transaction.wait()

    const AMM = await ethers.getContractFactory('AMM')
    amm = await AMM.deploy(token1.address, token2.address)

  })

  describe('Deployment', () => {

    it('has an address', async () => {
      expect(amm.address).to.not.equal(0x0)
    })

    it('tracks token1 address', async () => {
    	expect(await amm.token1()).to.equal(token1.address)
    })

    it('tracks token2 address', async () => {
    	expect(await amm.token2()).to.equal(token2.address)
    })
  })

  describe('Swapping tokens', () => {
  	let amount, transaction, result

  	it('facilitates swaps', async () => {
      // he sets up a dummy transfer from account1 to the contract...
      // address for e.g. 1 ether. He does this for token1 and token2

      amount = tokens(100000)
      transaction = await token1.connect(deployer).approve(amm.address, amount)
      await transaction.wait()

      transaction = await token2.connect(deployer).approve(amm.address, amount)
      await transaction.wait()

      transaction = await amm.connect(deployer).addLiquidity(amount, amount)
      await transaction.wait()

      expect(await token1.balanceOf(amm.address)).to.equal(amount)
      expect(await token2.balanceOf(amm.address)).to.equal(amount)

      expect(await amm.token1Balance()).to.equal(amount)
      expect(await amm.token2Balance()).to.equal(amount)

			let xBalance = await token1.balanceOf(amm.address)
			xBalance = ethers.utils.formatEther(xBalance.toString(), 'ether')
			let yBalance = await token1.balanceOf(amm.address)
			yBalance = ethers.utils.formatEther(yBalance.toString(), 'ether')
			let k = xBalance * yBalance

			// console.log(xBalance)
			// console.log(yBalance)

      console.log(`K value from token1 x token2: ${(k)}\n`)
	    // console.log(`Investor1 Token2 balance after swap: ${ethers.utils.formatEther(balance)}\n`)


      // check deployer has 100 shares
      expect(await amm.shares(deployer.address)).to.equal(tokens(100)) // use tokens helper to calculate shares

      // check pool has 100 shares
      expect(await amm.totalShares()).to.equal(tokens(100))

	    ////////////////////////////////////////////////////////////
	    // LP adds more Liquidity
	    //
	    // LP approves 50k tokens...
	    amount = tokens(50000)
	    transaction = await token1.connect(liquidityProvider).approve(amm.address, amount)
	    await transaction.wait()

	    transaction = await token2.connect(liquidityProvider).approve(amm.address, amount)
	    await transaction.wait()

	    // Calculate token2 deposit amount
	    let token2Deposit = await amm.calculateToken2Deposit(amount)

	    // LP adds liquidity
	    transaction = await amm.connect(liquidityProvider).addLiquidity(amount, token2Deposit)
	    await transaction.wait()

	    // LP should have 50 shares
	    expect(await amm.shares(liquidityProvider.address)).to.equal(tokens(50))

	    // Deployer should still have 100 shares
	    expect(await amm.shares(deployer.address)).to.equal(tokens(100))

	    // Pool should now have 150 shares
	    expect(await amm.totalShares()).to.equal(tokens(150))


	    ////////////////////////////////////////////////////////////
	    // Investor 1 swaps
	    //

	    // Investor1 approves all of the tokens. Usually best to only approve the amount required irl...
	    transaction = await token1.connect(investor1).approve(amm.address, tokens(100000))
	    await transaction.wait()

	    // Check investor1 balance before swap
	    balance = await token2.balanceOf(investor1.address)
	    console.log(`Investor1 Token2 balance before swap: ${ethers.utils.formatEther(balance)}\n`)

	    // Estimate amount of tokens investor1 will receive after swapping token2: include slippage
	    estimate = await amm.calculateToken1Swap(tokens(1))
	    console.log(`Token2 amount Investor1 will receive after swap: ${ethers.utils.formatEther(estimate)}\n`)

	    // Investor1 swaps 1 token1
	    transaction = await amm.connect(investor1).swapToken1(tokens(1))
	    result = await transaction.wait()

	    // Check for Swap Event
	    await expect(transaction).to.emit(amm, 'Swap').
	    	withArgs(
	    		investor1.address,
	    		token1.address,
	    		tokens(1),
	    		token2.address,
	    		estimate,
	    		await amm.token1Balance(),
	    		await amm.token2Balance(),
	    		(await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
	    	)

	    // Check investor1 balance after swap
	    balance = await token2.balanceOf(investor1.address)
	    console.log(`Investor1 Token2 balance after swap: ${ethers.utils.formatEther(balance)}\n`)
	    expect(estimate).to.equal(balance)

	    // Check AMM token balances are in sync
	    expect(await token1.balanceOf(amm.address)).to.equal(await amm.token1Balance())
	    expect(await token2.balanceOf(amm.address)).to.equal(await amm.token2Balance())

	    // Emit an event




	  })
  })
})
