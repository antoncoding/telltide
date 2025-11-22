// Morpho Blue Market ABIs
import { event, indexed } from '@subsquid/evm-abi';
import * as p from '@subsquid/evm-codec';

// Morpho Supply event
// Supply(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)
export const supplyEvent = event(
  '0xedf8870433c83823eb071d3df1caa8d008f12f6440918c20d75a3602cda30fe0',
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
  '0xa56fc0ad5702ec05ce63666221f796fb62437c32db1aa1aa075fc6484cf58fbf',
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
  '0x570954540bed6b1304a87dfe815a5eda4a648f7097a16240dcd85c9b5fd42a43',
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
  '0x52acb05cebbd3cd39715469f22afbf5a17496295ef3bc9bb5944056c63ccaa09',
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
