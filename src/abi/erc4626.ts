// ERC4626 Tokenized Vault Standard ABIs

export const events = {
  Deposit: {
    topic: '0xdcbc1c05240f31ff3ad067ef1ccf4dbe1ed3c1719dd73307f2ad7c91ea5f4f55',
    decode: (log: { topics: string[]; data: string }) => {
      // event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)
      return {
        sender: '0x' + log.topics[1].slice(26),
        owner: '0x' + log.topics[2].slice(26),
        assets: BigInt('0x' + log.data.slice(2, 66)),
        shares: BigInt('0x' + log.data.slice(66, 130)),
      };
    },
  },
  Withdraw: {
    topic: '0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db',
    decode: (log: { topics: string[]; data: string }) => {
      // event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
      return {
        sender: '0x' + log.topics[1].slice(26),
        receiver: '0x' + log.topics[2].slice(26),
        owner: '0x' + log.topics[3].slice(26),
        assets: BigInt('0x' + log.data.slice(2, 66)),
        shares: BigInt('0x' + log.data.slice(66, 130)),
      };
    },
  },
};

// ERC4626 view function signatures for RPC calls
export const functions = {
  totalAssets: '0x01e1d114', // totalAssets()
  totalSupply: '0x18160ddd', // totalSupply()
};
