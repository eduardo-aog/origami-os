export interface LabeledValue {
  id: string
  label: string
  value: string
}

/** Un contacto en el `appData` de la app (clave `contact:<id>`). */
export interface Contact {
  id: string
  firstName: string
  lastName: string
  phones: LabeledValue[]
  emails: LabeledValue[]
  address: string
  /** Fecha en formato AAAA-MM-DD, o vacío. */
  birthday: string
  notes: string
  /** Imagen del sistema de archivos usada como foto. */
  photoNodeId: string | null
  createdAt: number
  updatedAt: number
}

export const CONTACT_PREFIX = 'contact:'
export const contactKey = (id: string) => `${CONTACT_PREFIX}${id}`

export const LABELS = [
  { value: 'móvil', label: 'Móvil' },
  { value: 'casa', label: 'Casa' },
  { value: 'trabajo', label: 'Trabajo' },
  { value: 'otro', label: 'Otro' }
]

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']

export function newContact(): Contact {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    firstName: '',
    lastName: '',
    phones: [],
    emails: [],
    address: '',
    birthday: '',
    notes: '',
    photoNodeId: null,
    createdAt: now,
    updatedAt: now
  }
}

export const newEntry = (): LabeledValue => ({ id: crypto.randomUUID(), label: LABELS[0]?.value ?? 'otro', value: '' })

/** Un contacto sin ningún dato no se guarda. */
export function isEmpty(contact: Contact): boolean {
  return (
    contact.firstName.trim() === '' &&
    contact.lastName.trim() === '' &&
    contact.phones.every((entry) => entry.value.trim() === '') &&
    contact.emails.every((entry) => entry.value.trim() === '') &&
    contact.address.trim() === '' &&
    contact.birthday === '' &&
    contact.notes.trim() === '' &&
    contact.photoNodeId === null
  )
}

export function displayName(contact: Contact): string {
  const full = [contact.firstName, contact.lastName].map((part) => part.trim()).filter(Boolean).join(' ')
  if (full !== '') return full
  const fallback = [...contact.phones, ...contact.emails].find((entry) => entry.value.trim() !== '')
  return fallback?.value.trim() ?? 'Sin nombre'
}

export function initials(contact: Contact): string {
  const letters = [contact.firstName, contact.lastName].map((part) => part.trim().charAt(0)).join('')
  return (letters || displayName(contact).charAt(0)).toUpperCase()
}

/** Se ordena por apellido y, si no hay, por nombre. */
const sortKey = (contact: Contact) => (contact.lastName.trim() || contact.firstName.trim() || displayName(contact)).toLowerCase()

export function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort(
    (a, b) => sortKey(a).localeCompare(sortKey(b), 'es') || displayName(a).localeCompare(displayName(b), 'es')
  )
}

/** Letra de la sección de la lista; `#` para lo que no empieza por una letra. */
export function sectionOf(contact: Contact): string {
  const letter = sortKey(contact).normalize('NFD').replace(/\p{Diacritic}/gu, '').charAt(0).toUpperCase()
  return /^[A-Z]$/.test(letter) ? letter : '#'
}

const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function matchesQuery(contact: Contact, query: string): boolean {
  const needle = plain(query.trim())
  if (needle === '') return true
  const haystack = [
    contact.firstName,
    contact.lastName,
    contact.address,
    contact.notes,
    ...contact.phones.map((entry) => entry.value),
    ...contact.emails.map((entry) => entry.value)
  ]
  return haystack.some((text) => plain(text).includes(needle))
}
