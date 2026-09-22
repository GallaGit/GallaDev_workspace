import { describe, it, expect } from 'vitest'
import {
  LEAD_STATUSES,
  PROVINCES,
  isLeadStatus,
  type Lead,
} from '@/lib/domain/lead'

describe('domain/lead - Constants', () => {
  it('LEAD_STATUSES has 9 statuses in canonical order', () => {
    expect(LEAD_STATUSES).toHaveLength(9)
    expect(LEAD_STATUSES).toEqual([
      'Nuevo',
      'Pendiente revisar',
      'Validado',
      'Email preparado',
      'Email enviado',
      'Respondió',
      'Reunión',
      'Cliente',
      'Descartado',
    ])
  })

  it('PROVINCES has expected provinces', () => {
    expect(PROVINCES).toContain('Valencia')
    expect(PROVINCES).toContain('Castellón')
    expect(PROVINCES).toContain('Alicante')
    expect(PROVINCES.length).toBeGreaterThanOrEqual(3)
  })
})

describe('domain/lead - isLeadStatus', () => {
  it('returns true for valid statuses', () => {
    for (const status of LEAD_STATUSES) {
      expect(isLeadStatus(status)).toBe(true)
    }
  })

  it('returns false for invalid statuses', () => {
    expect(isLeadStatus('Invalido')).toBe(false)
    expect(isLeadStatus('Pendiente')).toBe(false) // legacy
    expect(isLeadStatus('Contactado')).toBe(false) // legacy
    expect(isLeadStatus('Contratado')).toBe(false) // legacy
    expect(isLeadStatus('')).toBe(false)
    expect(isLeadStatus(null)).toBe(false)
    expect(isLeadStatus(undefined)).toBe(false)
  })
})

describe('domain/lead - Lead type structure', () => {
  it('Lead type has all required fields', () => {
    const lead: Lead = {
      id: 'test-id',
      url: '',
      companyName: 'Test Company',
      website: 'https://test.com',
      phone: '+34 600 111 222',
      address: 'Calle Test 123',
      postalCode: '46001',
      city: 'Valencia',
      cityCanonical: 'Valencia',
      province: 'Valencia',
      employees: 10,
      linkedin: 'https://linkedin.com/company/test',
      services: ['Asesoría'],
      status: 'Nuevo',
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      notes: 'Test notes',
      notesOverflow: null,
      emailSubject: 'Subject',
      emailBody: 'Body',
      score: 50,
      manager: 'John Doe',
      role: 'CEO',
      confidence: 'Alta',
      software: 'ERP',
      source: 'n8n',
      email: 'test@test.com',
      emailCommercial: 'comercial@test.com',
      emailManager: 'gerente@test.com',
      favorite: false,
      archived: false,
      aiAnalysis: null,
      lastContact: null,
      lastEditedTime: null,
      nextFollowUp: null,
      responsibleId: null,
    }

    expect(lead.id).toBe('test-id')
    expect(lead.companyName).toBe('Test Company')
    expect(lead.status).toBe('Nuevo')
    expect(typeof lead.score).toBe('number')
    expect(typeof lead.favorite).toBe('boolean')
    expect(typeof lead.archived).toBe('boolean')
  })

  it('Lead type allows optional fields to be null/undefined', () => {
    const minimalLead: Lead = {
      id: 'minimal',
      url: '',
      companyName: 'Minimal',
      website: null,
      phone: null,
      address: null,
      postalCode: null,
      city: null,
      cityCanonical: null,
      province: null,
      employees: null,
      linkedin: null,
      services: [],
      status: 'Nuevo',
      lastActivity: new Date().toISOString(),
      createdAt: null,
      discoveredAt: new Date().toISOString(),
      notes: '',
      notesOverflow: null,
      emailSubject: '',
      emailBody: '',
      score: 0,
      manager: null,
      role: null,
      confidence: null,
      software: null,
      source: null,
      email: null,
      emailCommercial: null,
      emailManager: null,
      favorite: false,
      archived: false,
      aiAnalysis: null,
      lastContact: null,
      lastEditedTime: null,
      nextFollowUp: null,
      responsibleId: null,
    }

    expect(minimalLead.website).toBeNull()
    expect(minimalLead.services).toEqual([])
    expect(minimalLead.favorite).toBe(false)
  })
})