// Morpho Blue Market ABIs
import { event, indexed } from '@subsquid/evm-abi';
import * as p from '@subsquid/evm-codec';

// Morpho Supply event
// Supply(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)
export const supplyEvent = event(
  '0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb',
  'Supply(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
  {
    id: indexed(p.bytes32),
    caller: indexed(p.address),
    onBehalf: indexed(p.address),
    assets: p.uint256,
    shares: p.uint256,
  }
);

// Morpho Withdraw event
// Withdraw(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)
export const withdrawEvent = event(
  '0x140e44d997f5b57a56b1c832e9e5a8beb00ca4dcfd92d8c794ac24fdce43d1e0',
  'Withdraw(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
  {
    id: indexed(p.bytes32),
    caller: p.address,
    onBehalf: indexed(p.address),
    receiver: indexed(p.address),
    assets: p.uint256,
    shares: p.uint256,
  }
);

// Morpho Borrow event
// Borrow(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)
export const borrowEvent = event(
  '0x570954540bed6b1304a87dfe815949eec4c3b4c5c07c7e6e7c2a5cabe9cf2fc0',
  'Borrow(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
  {
    id: indexed(p.bytes32),
    caller: p.address,
    onBehalf: indexed(p.address),
    receiver: indexed(p.address),
    assets: p.uint256,
    shares: p.uint256,
  }
);

// Morpho Repay event
// Repay(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)
export const repayEvent = event(
  '0x52acb05cebbd3cd39715469f22afbf5a17496295d84c3750c0071c03a635c238',
  'Repay(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
  {
    id: indexed(p.bytes32),
    caller: indexed(p.address),
    onBehalf: indexed(p.address),
    assets: p.uint256,
    shares: p.uint256,
  }
);

export const events = {
  Supply: supplyEvent,
  Withdraw: withdrawEvent,
  Borrow: borrowEvent,
  Repay: repayEvent,
};
