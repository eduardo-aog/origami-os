import { ipcMain } from 'electron'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { IPC_CHANNELS } from '../../shared/native-api'
import { assertTrustedSender } from './trust'

// Parámetros fijos: cambiarlos invalidaría todos los hashes ya guardados.
const KEY_LENGTH = 64
const SALT_BYTES = 16
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const
const MAX_PASSWORD_LENGTH = 1024
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/i

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

function assertPassword(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > MAX_PASSWORD_LENGTH) {
    throw new TypeError('contraseña inválida')
  }
}

export function registerAuthIpc(): void {
  ipcMain.handle(IPC_CHANNELS.authHashPassword, async (event, password: unknown) => {
    assertTrustedSender(event)
    assertPassword(password)
    const salt = randomBytes(SALT_BYTES)
    const key = await deriveKey(password, salt)
    return { hash: key.toString('hex'), salt: salt.toString('hex') }
  })

  ipcMain.handle(
    IPC_CHANNELS.authVerifyPassword,
    async (event, password: unknown, hash: unknown, salt: unknown) => {
      assertTrustedSender(event)
      assertPassword(password)
      if (
        typeof hash !== 'string' ||
        typeof salt !== 'string' ||
        !HEX_PATTERN.test(hash) ||
        !HEX_PATTERN.test(salt)
      ) {
        return false
      }
      const expected = Buffer.from(hash, 'hex')
      if (expected.length !== KEY_LENGTH) return false
      const actual = await deriveKey(password, Buffer.from(salt, 'hex'))
      return timingSafeEqual(actual, expected)
    }
  )
}
