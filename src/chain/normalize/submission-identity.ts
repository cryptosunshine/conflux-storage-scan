import { concat, type Hex, isHex, keccak256, size } from "viem"

export function calculateSubmissionIdentity(nodeRoots: readonly Hex[]): Hex {
	for (const root of nodeRoots) {
		if (!isHex(root, { strict: true }) || size(root) !== 32) {
			throw new TypeError(`Submission node root must be 32 bytes: ${root}`)
		}
	}

	return keccak256(concat(nodeRoots))
}
