import { describe, it, expect } from 'vitest'
import {
  normalizeEmail,
  normalizePhone,
  normalizeDomain,
  normalizeCompanyName,
  normalizeAddressKey,
  detectDuplicateGroups,
  getDuplicateLeadIds,
  DUPLICATE_REASON_CODES,
} from '@/lib/leads/detect-duplicates'
import type { Lead, LeadStatus } from '@/lib/domain/lead'

const createMockLead = (overrides: Partial<Lead> = {}): Lead => {
  const id = overrides.id ?? `lead-${Math.random().toString(36).slice(2)}`
  const slug = id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return {
    id,
    url: `https://notion.so/${slug}`,
    companyName: `Company ${slug}`,
    website: `https://${slug}.example.com`,
    phone: `+34 600 ${slug.slice(-3).padStart(3, '0')} 111`,
    address: `Calle ${slug} 123`,
    postalCode: '46001',
    city: 'Valencia',
    cityCanonical: 'Valencia',
    province: 'Valencia',
    employees: 10,
    linkedin: `https://linkedin.com/company/${slug}`,
    services: ['Asesoría'],
    status: 'Nuevo' as LeadStatus,
    lastActivity: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    discoveredAt: new Date().toISOString(),
    notes: null,
    notesOverflow: null,
    email: `${slug}@example.com`,
    emailCommercial: null,
    emailManager: null,
    emailSubject: null,
    emailBody: null,
    score: 0,
    manager: null,
    role: null,
    confidence: null,
    software: null,
    source: 'n8n',
    favorite: false,
    archived: false,
    aiAnalysis: null,
    lastContact: null,
    nextFollowUp: null,
    lastEditedTime: null,
    responsibleId: null,
    ...overrides,
  }
}

describe('detect-duplicates - Normalizers', () => {
  describe('normalizeEmail', () => {
    it('lowercases email', () => {
      expect(normalizeEmail('TEST@DOMAIN.COM')).toBe('test@domain.com')
    })

    it('removes +alias from local part', () => {
      expect(normalizeEmail('user+alias@domain.com')).toBe('user@domain.com')
      expect(normalizeEmail('USER+TAG@DOMAIN.COM')).toBe('user@domain.com')
    })

    it('returns email as-is (does not filter public domains)', () => {
      // normalizeEmail doesn't filter domains - that's done in normalizeDomain
      expect(normalizeEmail('test@gmail.com')).toBe('test@gmail.com')
      expect(normalizeEmail('test@hotmail.com')).toBe('test@hotmail.com')
    })

    it('returns null for invalid emails', () => {
      expect(normalizeEmail('invalid')).toBeNull()
      expect(normalizeEmail('@domain.com')).toBeNull()
      expect(normalizeEmail('user@')).toBeNull()
      expect(normalizeEmail('')).toBeNull()
      expect(normalizeEmail(null)).toBeNull()
      expect(normalizeEmail(undefined)).toBeNull()
    })

    it('preserves valid corporate domains', () => {
      expect(normalizeEmail('user@empresa.es')).toBe('user@empresa.es')
      expect(normalizeEmail('contact@company.com')).toBe('contact@company.com')
    })
  })

  describe('normalizePhone', () => {
    it('extracts digits only', () => {
      expect(normalizePhone('+34 600 111 222')).toBe('600111222')
      expect(normalizePhone('600-111-222')).toBe('600111222')
      expect(normalizePhone('(600) 111 222')).toBe('600111222')
    })

    it('strips ES country code 34 when length >= 11', () => {
      // +34 600 111 222 -> 34600111222 (11 digits) -> strips 34 -> 600111222
      expect(normalizePhone('+34 600 111 222')).toBe('600111222')
      expect(normalizePhone('0034 600 111 222')).toBe('600111222')
      expect(normalizePhone('34600111222')).toBe('600111222')
    })

    it('does not strip 34 when digit length is under 11', () => {
      expect(normalizePhone('3491123456')).toBe('3491123456')
    })

    it('returns null for short numbers', () => {
      expect(normalizePhone('123456')).toBeNull()
      expect(normalizePhone('600111')).toBeNull()
    })

    it('returns null for invalid input', () => {
      expect(normalizePhone('abc')).toBeNull()
      expect(normalizePhone('')).toBeNull()
      expect(normalizePhone(null)).toBeNull()
      expect(normalizePhone(undefined)).toBeNull()
    })
  })

  describe('normalizeDomain', () => {
    it('extracts hostname from URL', () => {
      expect(normalizeDomain('https://www.example.com/path')).toBe('example.com')
      expect(normalizeDomain('http://example.com')).toBe('example.com')
      expect(normalizeDomain('example.com')).toBe('example.com')
    })

    it('removes www prefix', () => {
      expect(normalizeDomain('www.test.com')).toBe('test.com')
    })

    it('returns null for public webmail/social domains', () => {
      expect(normalizeDomain('gmail.com')).toBeNull()
      expect(normalizeDomain('linkedin.com')).toBeNull()
      expect(normalizeDomain('facebook.com')).toBeNull()
      expect(normalizeDomain('twitter.com')).toBeNull()
    })

    it('returns null for invalid input', () => {
      expect(normalizeDomain('')).toBeNull()
      expect(normalizeDomain(null)).toBeNull()
      expect(normalizeDomain(undefined)).toBeNull()
    })

    it('preserves valid corporate domains', () => {
      expect(normalizeDomain('empresa.es')).toBe('empresa.es')
      expect(normalizeDomain('company.com')).toBe('company.com')
    })
  })

  describe('normalizeCompanyName', () => {
    it('folds accents and punctuation', () => {
      expect(normalizeCompanyName('Asesoría Sánchez S.L.')).toBe('asesoria sanchez s l')
      expect(normalizeCompanyName('Gestoría Pérez & Asociados')).toBe('gestoria perez asociados')
    })

    it('removes legal form tokens', () => {
      expect(normalizeCompanyName('Mi Empresa SL')).toBe('mi empresa')
      // SA gets filtered but results in empty name -> null
      expect(normalizeCompanyName('Test SA')).toBeNull()
      expect(normalizeCompanyName('Company S.L.U.')).toBe('company s l u')
      expect(normalizeCompanyName('Firm LTDA')).toBeNull() // "firm" is too short (< 5 chars)
      expect(normalizeCompanyName('Acme Firm LTDA')).toBe('acme firm')
    })

    it('filters generic company names', () => {
      expect(normalizeCompanyName('Asesoría')).toBeNull()
      expect(normalizeCompanyName('Gestoría')).toBeNull()
      expect(normalizeCompanyName('Consultoría')).toBeNull()
      expect(normalizeCompanyName('Empresa')).toBeNull()
    })

    it('returns null for short names', () => {
      expect(normalizeCompanyName('AB')).toBeNull()
      expect(normalizeCompanyName('A')).toBeNull()
    })

    it('returns null for invalid input', () => {
      expect(normalizeCompanyName('')).toBeNull()
      expect(normalizeCompanyName(null)).toBeNull()
      expect(normalizeCompanyName(undefined)).toBeNull()
    })
  })

  describe('normalizeAddressKey', () => {
    it('combines street + postal code', () => {
      const lead = createMockLead({ address: 'Calle Mayor 12', postalCode: '46001', city: 'Valencia', cityCanonical: 'Valencia' })
      expect(normalizeAddressKey(lead)).toBe('mayor 12|46001')
    })

    it('combines street + city when no postal code', () => {
      const lead = createMockLead({ address: 'Calle Mayor 12', postalCode: '', city: 'Valencia', cityCanonical: 'Valencia' })
      expect(normalizeAddressKey(lead)).toBe('mayor 12|valencia')
    })

    it('returns street only if long enough (>=12 chars) and no CP/city', () => {
      const lead = createMockLead({ address: 'Calle Muy Larga Nombre 123', postalCode: '', city: '', cityCanonical: '' })
      expect(normalizeAddressKey(lead)).toBe('muy larga nombre 123')
    })

    it('returns null for short address without CP/city', () => {
      const lead = createMockLead({ address: 'Calle A', postalCode: '', city: '', cityCanonical: '' })
      expect(normalizeAddressKey(lead)).toBeNull()
    })

    it('returns null for invalid input', () => {
      expect(normalizeAddressKey({ address: null, postalCode: null, city: null, cityCanonical: null })).toBeNull()
    })
  })
})

describe('detect-duplicates - Group Detection', () => {
  it('groups leads with same email', () => {
    const leads = [
      createMockLead({ id: '1', email: 'same@test.com' }),
      createMockLead({ id: '2', email: 'same@test.com' }),
      createMockLead({ id: '3', email: 'different@test.com' }),
    ]

    const groups = detectDuplicateGroups(leads)

    expect(groups).toHaveLength(1)
    expect(groups[0].reasons.some((r) => r.code === 'email')).toBe(true)
    expect(groups[0].leads).toHaveLength(2)
    expect(groups[0].leads.map((l) => l.id).sort()).toEqual(['1', '2'])
  })

  it('groups leads with same phone', () => {
    const leads = [
      createMockLead({ id: '1', phone: '+34 600 111 222' }),
      createMockLead({ id: '2', phone: '+34 600 111 222' }),
      createMockLead({ id: '3', phone: '+34 600 333 444' }),
    ]

    const groups = detectDuplicateGroups(leads)

    expect(groups).toHaveLength(1)
    expect(groups[0].reasons.some((r) => r.code === 'phone')).toBe(true)
  })

  it('groups leads with same domain', () => {
    const leads = [
      createMockLead({ id: '1', website: 'https://empresa.com' }),
      createMockLead({ id: '2', website: 'https://www.empresa.com/page' }),
      createMockLead({ id: '3', website: 'https://otra.com' }),
    ]

    const groups = detectDuplicateGroups(leads)

    expect(groups).toHaveLength(1)
    expect(groups[0].reasons.some((r) => r.code === 'domain')).toBe(true)
  })

  it('groups leads with same normalized company name', () => {
    const leads = [
      createMockLead({ id: '1', companyName: 'Martínez Consultores SL', website: null, email: null, phone: null, address: null, postalCode: null }),
      createMockLead({ id: '2', companyName: 'Martinez Consultores SL', website: null, email: null, phone: null, address: null, postalCode: null }),
      createMockLead({ id: '3', companyName: 'Gestoría López SA', website: null, email: null, phone: null, address: null, postalCode: null }),
    ]

    const groups = detectDuplicateGroups(leads)

    expect(groups).toHaveLength(1)
    expect(groups[0].reasons.some((r) => r.code === 'name')).toBe(true)
  })

  it('groups leads with similar address', () => {
    const leads = [
      createMockLead({ id: '1', address: 'Calle Mayor 12', postalCode: '46001', city: 'Valencia', cityCanonical: 'Valencia' }),
      createMockLead({ id: '2', address: 'Calle Mayor 12', postalCode: '46001', city: 'Valencia', cityCanonical: 'Valencia' }),
      createMockLead({ id: '3', address: 'Calle Menor 5', postalCode: '46002', city: 'Valencia', cityCanonical: 'Valencia' }),
    ]

    const groups = detectDuplicateGroups(leads)

    expect(groups).toHaveLength(1)
    expect(groups[0].reasons.some((r) => r.code === 'address')).toBe(true)
  })

  it('transitive matching: A=B(email), B=C(phone) -> single group ABC', () => {
    const leads = [
      createMockLead({ id: 'A', email: 'shared@test.com', phone: '+34 600 111 111' }),
      createMockLead({ id: 'B', email: 'shared@test.com', phone: '+34 600 222 222' }),
      createMockLead({ id: 'C', email: 'other@test.com', phone: '+34 600 222 222' }),
    ]

    const groups = detectDuplicateGroups(leads)

    expect(groups).toHaveLength(1)
    expect(groups[0].leads).toHaveLength(3)
    const ids = groups[0].leads.map((l) => l.id).sort()
    expect(ids).toEqual(['A', 'B', 'C'])
  })

  it('includes archived leads in detection', () => {
    const leads = [
      createMockLead({ id: '1', email: 'shared@test.com', archived: false }),
      createMockLead({ id: '2', email: 'shared@test.com', archived: true }),
    ]

    const groups = detectDuplicateGroups(leads)

    expect(groups).toHaveLength(1)
    expect(groups[0].leads).toHaveLength(2)
    expect(groups[0].leads.some((l) => l.archived)).toBe(true)
  })

  it('orders groups by size desc, then name asc', () => {
    const leads = [
      createMockLead({ id: '1', companyName: 'Alpha Corp', email: 'a@test.com', website: null, phone: null, address: null, postalCode: null }),
      createMockLead({ id: '2', companyName: 'Alpha Corp', email: 'a@test.com', website: null, phone: null, address: null, postalCode: null }),
      createMockLead({ id: '3', companyName: 'Beta Corp', email: 'b@test.com', website: null, phone: null, address: null, postalCode: null }),
      createMockLead({ id: '4', companyName: 'Beta Corp', email: 'b@test.com', website: null, phone: null, address: null, postalCode: null }),
      createMockLead({ id: '5', companyName: 'Beta Corp', email: 'b@test.com', website: null, phone: null, address: null, postalCode: null }),
      createMockLead({ id: '6', companyName: 'Gamma Corp', email: 'c@test.com', website: null, phone: null, address: null, postalCode: null }),
      createMockLead({ id: '7', companyName: 'Gamma Corp', email: 'c@test.com', website: null, phone: null, address: null, postalCode: null }),
    ]

    const groups = detectDuplicateGroups(leads)

    expect(groups).toHaveLength(3)
    expect(groups[0].leads).toHaveLength(3) // Beta
    expect(groups[1].leads).toHaveLength(2) // Alpha
    expect(groups[2].leads).toHaveLength(2) // Gamma
    expect(groups[1].leads[0].companyName).toBe('Alpha Corp')
    expect(groups[2].leads[0].companyName).toBe('Gamma Corp')
  })

  it('returns empty array for less than 2 leads', () => {
    expect(detectDuplicateGroups([])).toEqual([])
    expect(detectDuplicateGroups([createMockLead()])).toEqual([])
  })

  it('reason codes are ordered by priority', () => {
    const leads = [
      createMockLead({ id: '1', email: 'same@test.com', phone: '+34 600 111 222' }),
      createMockLead({ id: '2', email: 'same@test.com', phone: '+34 600 111 222' }),
    ]

    const groups = detectDuplicateGroups(leads)

    const reasonCodes = groups[0].reasons.map((r) => r.code)
    const emailIdx = reasonCodes.indexOf('email')
    const phoneIdx = reasonCodes.indexOf('phone')
    expect(emailIdx).toBeLessThan(phoneIdx)
  })

  it('DUPLICATE_REASON_CODES has 5 entries in correct order', () => {
    expect(DUPLICATE_REASON_CODES).toEqual(['email', 'phone', 'domain', 'name', 'address'])
  })
})

describe('detect-duplicates - getDuplicateLeadIds', () => {
  it('returns set of all duplicate lead IDs', () => {
    const leads = [
      createMockLead({ id: '1', email: 'same@test.com' }),
      createMockLead({ id: '2', email: 'same@test.com' }),
      createMockLead({ id: '3', email: 'unique@test.com' }),
    ]

    const ids = getDuplicateLeadIds(leads)

    expect(ids).toEqual(new Set(['1', '2']))
  })

  it('returns empty set when no duplicates', () => {
    const leads = [
      createMockLead({ id: '1', email: 'a@test.com' }),
      createMockLead({ id: '2', email: 'b@test.com' }),
    ]

    const ids = getDuplicateLeadIds(leads)

    expect(ids.size).toBe(0)
  })
})