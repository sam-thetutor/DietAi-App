import { createWalletClient, createPublicClient, custom, http } from 'viem'
import { base } from 'viem/chains'

export const publicClient = createPublicClient({
  chain: base,
  transport: http()
})

export const walletClient = createWalletClient({
  chain: base,
  transport: custom(window.ethereum)
})

// Function to get the account address
export async function getAccount() {
  const [account] = await walletClient.getAddresses()
  return account
}

//export account
export const account = getAccount