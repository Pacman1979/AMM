//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "./Token.sol";

contract AMM {
	Token public token1;
	Token public token2;

	uint256 public token1Balance;
	uint256 public token2Balance;
	uint256 public K;

	uint256 public totalShares;
	mapping(address => uint256) public shares;
	uint256 constant PRECISION = 10**18;

	event Swap(
		address user,
		address tokenGive,
		uint256 tokenGiveAmount,
		address tokenGet,
		uint256 tokenGetAmount,
		uint256 token1Balance,
		uint256 token2Balance,
		uint256 timestamp
	);

	constructor(Token _token1, Token _token2) {
		token1 = _token1;
		token2 = _token2;
	}

	function addLiquidity(uint256 _token1Amount, uint256 _token2Amount) external {
		require(
			token1.transferFrom(msg.sender, address(this), _token1Amount),
			"failed to transfer token 1"
		);

		require(
			token2.transferFrom(msg.sender, address(this), _token2Amount),
			"failed to transfer token 2"
		);

		// Issue shares
		uint256 share;

		// If first time adding liquidity, make share 100
		if (totalShares == 0) {
			share = 100 * PRECISION;
		} else {
			uint256 share1 = (totalShares * _token1Amount) / token1Balance;
			uint256 share2 = (totalShares * _token2Amount) / token2Balance;
			require(
				(share1 / 10**3) == (share2 / 10**3), // this is rounding to 3 decimal places so there's more leeway.
				"must provide equal share amounts"
			);
			share = share1; // assuming share1 and share2 are equal, which is required, otherwise diff coding required??
		}

		// Manage Pool
		token1Balance += _token1Amount;
		token2Balance += _token2Amount;
		K = token1Balance * token2Balance;

		// Update Shares
		totalShares += share;
		shares[msg.sender] += share;
	}

	// Determine how many token2 tokens must be deposited when depositing liquidity for token1

	function calculateToken2Deposit(uint256 _token1Amount)
		public
		view
		returns(uint256 token2Amount)
	{
		token2Amount = (token2Balance * _token1Amount) / token1Balance;
	}

	// Determine how many token1 tokens must be deposited when depositing liquidity for token2
	function calculateToken1Deposit(uint256 _token2Amount)
		public
		view
		returns(uint256 token1Amount)
	{
		token1Amount = (token1Balance * _token2Amount) / token2Balance;
	}

	function calculateToken1Swap(uint256 _token1Amount)
		public
		view
		returns(uint256 token2Amount)
	{
		// Calculate token 2 amount...
		uint256 token1After = token1Balance + _token1Amount;
		uint256 token2After = K / token1After; // Because this is Y=K/X from X*Y=K where Y=token2 and X=token1
		token2Amount = token2Balance - token2After;

		//Dont let pool go to 0
		if(token2Amount == token2Balance) {
			token2Amount--;
		}

		require(token2Amount < token2Balance, "swap cannot exceed pool balance");
	}

	function swapToken1(uint256 _token1Amount)
		external
		returns(uint256 token2Amount)
	{
		// Calculate token 2 amount
		token2Amount = calculateToken1Swap(_token1Amount);

		// Do swap
		// 1. Transfer token1 tokens out of user wallet to contract
		token1.transferFrom(msg.sender, address(this), _token1Amount);
		// 2. Update the token1 balance in the contract
		token1Balance += _token1Amount;
		// 3. Update the token2 balance
		token2Balance -= token2Amount;
		// 4. Transfer token2 tokens from contract to user wallet
		token2.transfer(msg.sender, token2Amount);

		// Emit an event
		emit Swap(
			msg.sender,
			address(token1),
			_token1Amount,
			address(token2),
			token2Amount,
			token1Balance,
			token2Balance,
			block.timestamp
		);
	}

	// Returns amount of token1 received when swapping token2
	function calculateToken2Swap(uint256 _token2Amount)
		public
		view
		returns(uint256 token1Amount)
	{
		// Calculate token 2 amount...
		uint256 token2After = token2Balance + _token2Amount;
		uint256 token1After = K / token2After; // Because this is Y=K/X from X*Y=K where Y=token2 and X=token1
		token1Amount = token1Balance - token1After;

		//Dont let pool go to 0
		if(token1Amount == token1Balance) {
			token1Amount--;
		}

		require(token1Amount < token1Balance, "swap cannot exceed pool balance");
	}

	function swapToken2(uint256 _token2Amount)
		external
		returns(uint256 token1Amount)
	{
		// Calculate token 1 amount...
		token1Amount = calculateToken2Swap(_token2Amount);

		// Do swap
		// 1. Transfer token1 tokens out of user wallet to contract
		token2.transferFrom(msg.sender, address(this), _token2Amount);
		// 2. Update the token1 balance in the contract
		token2Balance += _token2Amount;
		// 3. Update the token2 balance
		token1Balance -= token1Amount;
		// 4. Transfer token2 tokens from contract to user wallet
		token1.transfer(msg.sender, token1Amount);

		// Emit an event
		emit Swap(
			msg.sender,
			address(token2),
			_token2Amount,
			address(token1),
			token1Amount,
			token1Balance,
			token2Balance,
			block.timestamp
		);
	}
}
