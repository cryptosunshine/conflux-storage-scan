import { defineChain, getAddress, type Hex } from "viem"

export const CONFLUX_ESPACE_TESTNET_CHAIN_ID = 71 as const
export const CONFLUX_ESPACE_TESTNET_RPC_URL = "https://evmtestnet.confluxrpc.com"
export const CONFLUX_ESPACE_TESTNET_EXPLORER_URL = "https://evmtestnet.confluxscan.org"

export const FIXED_PRICE_FLOW_PROXY = getAddress("0x3fF03285AA79027Ecc552432336FCB85eaD7199e")
export const FIXED_PRICE_FLOW_BEACON = getAddress("0x7322ba93f0b6061c6fce1af4ac5264cb252a0166")
export const FIXED_PRICE_FLOW_IMPLEMENTATION = getAddress("0xAd85554aa3446F7199644F852eC7bBa706af3eF9")
export const FIXED_PRICE_FLOW_MARKET = getAddress("0xB43eE2d86c4Ccb1e958a77a4c52937Cc22255Ac1")
export const FIXED_PRICE_FLOW_DEPLOYMENT_BLOCK = 253_160_870n

export const EIP1967_BEACON_SLOT: Hex = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"

export const STORAGE_SECTOR_BYTES = 256n
export const STORAGE_FEE_CFX = 0n
export const REORG_LOOKBACK_BLOCKS = 128n

export const confluxESpaceTestnet = defineChain({
	id: CONFLUX_ESPACE_TESTNET_CHAIN_ID,
	name: "Conflux eSpace Testnet",
	nativeCurrency: {
		decimals: 18,
		name: "Conflux",
		symbol: "CFX",
	},
	rpcUrls: {
		default: {
			http: [CONFLUX_ESPACE_TESTNET_RPC_URL],
		},
	},
	blockExplorers: {
		default: {
			name: "ConfluxScan",
			url: CONFLUX_ESPACE_TESTNET_EXPLORER_URL,
		},
	},
	testnet: true,
})
