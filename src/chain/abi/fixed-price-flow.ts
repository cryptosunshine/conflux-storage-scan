export const fixedPriceFlowAbi = [
	{
		type: "event",
		name: "Submit",
		inputs: [
			{ indexed: true, name: "sender", type: "address" },
			{ indexed: true, name: "identity", type: "bytes32" },
			{ indexed: false, name: "submissionIndex", type: "uint256" },
			{ indexed: false, name: "startPos", type: "uint256" },
			{ indexed: false, name: "length", type: "uint256" },
			{
				indexed: false,
				name: "submission",
				type: "tuple",
				components: [
					{ name: "length", type: "uint256" },
					{ name: "tags", type: "bytes" },
					{
						name: "nodes",
						type: "tuple[]",
						components: [
							{ name: "root", type: "bytes32" },
							{ name: "height", type: "uint256" },
						],
					},
				],
			},
		],
	},
	{
		type: "function",
		name: "submissionIndex",
		stateMutability: "view",
		inputs: [],
		outputs: [{ type: "uint256" }],
	},
	{
		type: "function",
		name: "tree",
		stateMutability: "view",
		inputs: [],
		outputs: [
			{ name: "currentLength", type: "uint256" },
			{ name: "unstagedHeight", type: "uint256" },
		],
	},
	{
		type: "function",
		name: "paused",
		stateMutability: "view",
		inputs: [],
		outputs: [{ type: "bool" }],
	},
	{
		type: "function",
		name: "market",
		stateMutability: "view",
		inputs: [],
		outputs: [{ type: "address" }],
	},
	{
		type: "function",
		name: "getFlowRootByTxSeq",
		stateMutability: "view",
		inputs: [{ name: "txSeq", type: "uint256" }],
		outputs: [{ type: "bytes32" }],
	},
] as const
