// ERC4626 Tokenized Vault Standard ABIs
import { event, indexed } from '@subsquid/evm-abi';
import * as p from '@subsquid/evm-codec'


// ERC4626 Deposit event
export const depositEvent = event(
  '0xdcbc1c05240f31ff3ad067ef1ccf4dbe1ed3c1719dd73307f2ad7c91ea5f4f55',
  'Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  {
    sender: indexed(p.address),
    owner: indexed(p.address),
    assets: p.uint256,
    shares: p.uint256,
  }
);

// ERC4626 Withdraw event
export const withdrawEvent = event(
  '0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db',
  'Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  {
    sender: indexed(p.address),
    receiver: indexed(p.address),
    owner: indexed(p.address),
    assets: p.uint256,
    shares: p.uint256,
  }
);

export const events = {
  Deposit: depositEvent,
  Withdraw: withdrawEvent,
};
