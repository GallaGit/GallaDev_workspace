import { describe, it, expect } from 'vitest'
import { isValidEmail, validateLeadCreate } from '@/lib/leads/validate-lead'
import type { LeadCreateInput } from '@/lib/domain/lead'

describe('validate-lead - validateLeadCreate', () => {
  const validInput: LeadCreateInput = {
    companyName: 'Test Company',
    website: 'https://test.com',
    phone: '+34 600 111 222',
    address: 'Calle Test 123',
    postalCode: '46001',
    city: 'Valencia',
    province: 'Valencia',
    employees: 10,
    linkedin: 'https://linkedin.com/company/test',
    services: ['Fiscal'],
    email: 'test@test.com',
    emailCommercial: 'comercial@test.com',
    emailManager: 'gerente@test.com',
    notes: 'Test notes',
  }

  it('passes for valid input', () => {
    const result = validateLeadCreate(validInput)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.value?.companyName).toBe('Test Company')
  })

  it('fails when companyName is missing', () => {
    const result = validateLeadCreate({ ...validInput, companyName: '' })
    expect(result.ok).toBe(false)
    expect(result.errors.companyName).toMatch(/empresa/i)
  })

  it('fails when companyName is whitespace only', () => {
    const result = validateLeadCreate({ ...validInput, companyName: '   ' })
    expect(result.ok).toBe(false)
    expect(result.errors.companyName).toMatch(/empresa/i)
  })

  it('fails when email is invalid format', () => {
    const result = validateLeadCreate({ ...validInput, email: 'invalid-email' })
    expect(result.ok).toBe(false)
    expect(result.errors.email).toMatch(/correo/i)
  })

  it('fails when emailCommercial is invalid format', () => {
    const result = validateLeadCreate({
      ...validInput,
      emailCommercial: 'invalid',
    })
    expect(result.ok).toBe(false)
    expect(result.errors.emailCommercial).toMatch(/correo comercial/i)
  })

  it('fails when emailManager is invalid format', () => {
    const result = validateLeadCreate({
      ...validInput,
      emailManager: 'invalid',
    })
    expect(result.ok).toBe(false)
    expect(result.errors.emailManager).toMatch(/gerente/i)
  })

  it('passes when optional emails are empty', () => {
    const result = validateLeadCreate({
      ...validInput,
      emailCommercial: '',
      emailManager: '',
    })
    expect(result.ok).toBe(true)
  })

  it('fails when phone format is invalid', () => {
    const result = validateLeadCreate({ ...validInput, phone: 'abc' })
    expect(result.ok).toBe(false)
    expect(result.errors.phone).toMatch(/teléfono/i)
  })

  it('passes when phone is valid Spanish format', () => {
    for (const phone of ['+34 600 111 222', '600111222', '91 123 45 67']) {
      expect(validateLeadCreate({ ...validInput, phone }).ok).toBe(true)
    }
  })

  it('passes when phone is empty if email/web present', () => {
    const result = validateLeadCreate({ ...validInput, phone: '' })
    expect(result.ok).toBe(true)
  })

  it('fails when no contact channel is provided', () => {
    const result = validateLeadCreate({
      ...validInput,
      email: '',
      phone: '',
      website: '',
    })
    expect(result.ok).toBe(false)
    expect(result.errors._form).toMatch(/contacto/i)
  })

  it('fails when employees is negative', () => {
    const result = validateLeadCreate({ ...validInput, employees: -5 })
    expect(result.ok).toBe(false)
    expect(result.errors.employees).toMatch(/empleados/i)
  })

  it('passes when employees is zero', () => {
    expect(validateLeadCreate({ ...validInput, employees: 0 }).ok).toBe(true)
  })

  it('passes when employees is undefined', () => {
    expect(
      validateLeadCreate({ ...validInput, employees: undefined }).ok,
    ).toBe(true)
  })

  it('collects multiple errors', () => {
    const result = validateLeadCreate({
      ...validInput,
      companyName: '',
      email: 'invalid',
      phone: 'abc',
      employees: -1,
    })
    expect(result.ok).toBe(false)
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(3)
  })
})

describe('leads/validate-lead - isValidEmail (linear, ReDoS-safe)', () => {
  it('accepts typical emails', () => {
    expect(isValidEmail('ana@empresa.es')).toBe(true)
    expect(isValidEmail('a.b+c@sub.dominio.com')).toBe(true)
  })
  it('rejects malformed emails', () => {
    for (const v of ['', 'a', 'a@b', '@b.c', 'a@.c', 'a@b.', 'a@@b.c', 'a@b@c.d', 'a b@c.d', 'a@b .c']) {
      expect(isValidEmail(v)).toBe(false)
    }
  })
  it('rejects emails over 254 chars', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBe(false)
  })
  it('handles pathological input fast', () => {
    const evil = `a@${'.'.repeat(50000)}`
    const t = performance.now()
    expect(isValidEmail(evil)).toBe(false)
    expect(isValidEmail(`a@${'a.'.repeat(50000)}`)).toBe(false)
    expect(performance.now() - t).toBeLessThan(50)
  })
})
