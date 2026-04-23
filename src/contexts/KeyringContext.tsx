import { createContext, useContext, ReactNode } from 'react'
import { useKeyring } from '@/hooks/useKeyring'
import type { KeyringAccount } from '@/hooks/useKeyring'
import type { Bip39DerivationMaterial, RawKeyDerivationMaterial } from '@/utils/seedExport'

interface KeyringContextType {
  keyring: ReturnType<typeof useKeyring>['keyring']
  isReady: boolean
  accounts: KeyringAccount[]
  /** Cuenta elegida para firmar y flujos por defecto; persiste entre sesiones. */
  activeAccount: KeyringAccount | undefined
  activeAccountAddress: string | null
  setActiveAccountAddress: (address: string | null) => void
  isUnlocked: boolean
  hasStoredAccounts: boolean
  hasWebAuthnCredentials: boolean
  generateMnemonic: () => string
  unlock: (password: string) => Promise<boolean>
  unlockWithWebAuthn: (credentialId: string) => Promise<boolean>
  lock: () => void
  addFromMnemonic: (mnemonic: string, name?: string, type?: 'sr25519' | 'ed25519' | 'ecdsa', password?: string) => Promise<KeyringAccount | null>
  addFromUri: (uri: string, name?: string, type?: 'sr25519' | 'ed25519' | 'ecdsa', password?: string) => Promise<KeyringAccount | null>
  addFromJson: (jsonData: object, jsonPassword: string, password?: string) => Promise<KeyringAccount | null>
  removeAccount: (address: string) => Promise<boolean>
  getAccount: (address: string) => KeyringAccount | undefined
  /** BIP44 `0x`+64hex para `PRIVATE_KEY`; solo con frase/SURI en sesión, no con JSON puro. */
  getEvmBip44PrivateKey0x: (ss58Address: string) => `0x${string}` | null
  getDerivationMaterial: (ss58Address: string) => Bip39DerivationMaterial | RawKeyDerivationMaterial | null
  setSS58Format: (format: number) => void
  refreshWebAuthnCredentials: () => Promise<boolean>
  refreshStoredAccounts: () => Promise<boolean>
}

export const KeyringContext = createContext<KeyringContextType | undefined>(undefined)

export function KeyringProvider({ children }: { children: ReactNode }) {
  const keyringData = useKeyring()

  return (
    <KeyringContext.Provider value={keyringData}>
      {children}
    </KeyringContext.Provider>
  )
}

export function useKeyringContext() {
  const context = useContext(KeyringContext)
  if (context === undefined) {
    throw new Error('useKeyringContext debe usarse dentro de KeyringProvider')
  }
  return context
}

