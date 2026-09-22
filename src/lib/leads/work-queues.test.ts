import { describe, it, expect } from 'vitest'
import { buildWorkQueues, WORK_QUEUE_IDS, type WorkQueueId } from '@/lib/leads/work-queues'
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
    score: 50,
    manager: 'John Doe',
    role: 'CEO',
    confidence: 'Alta',
    software: 'ERP',
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

describe('work-queues - buildWorkQueues', () => {
  it('returns 5 queues with correct IDs', () => {
    const leads = [createMockLead({ id: '1' })]
    const queues = buildWorkQueues(leads)

    expect(queues).toHaveLength(5)
    expect(queues.map((q) => q.id)).toEqual([...WORK_QUEUE_IDS])
    expect(queues.map((q) => q.id)).toEqual([
      'pendiente_revisar',
      'faltan_datos',
      'emails_listos',
      'followup_overdue',
      'duplicados',
    ])
  })

  describe('pendiente_revisar queue', () => {
    it('includes leads with status Nuevo', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Nuevo' }),
        createMockLead({ id: '2', status: 'Validado' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'pendiente_revisar')

      expect(queue?.count).toBe(1)
      expect(queue?.firstLeadId).toBe('1')
      expect(queue?.leadIds).toEqual(['1'])
    })

    it('includes leads with status Pendiente revisar', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Pendiente revisar' }),
        createMockLead({ id: '2', status: 'Validado' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'pendiente_revisar')

      expect(queue?.count).toBe(1)
      expect(queue?.firstLeadId).toBe('1')
    })

    it('combines Nuevo and Pendiente revisar', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Nuevo' }),
        createMockLead({ id: '2', status: 'Pendiente revisar' }),
        createMockLead({ id: '3', status: 'Validado' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'pendiente_revisar')

      expect(queue?.count).toBe(2)
      expect(queue?.leadIds.sort()).toEqual(['1', '2'])
    })
  })

  describe('faltan_datos queue', () => {
    it('includes leads missing email, phone, and web', () => {
      const leads = [
        createMockLead({ id: '1', email: null, phone: null, website: null }),
        createMockLead({ id: '2', email: 'test@test.com', phone: null, website: null }),
        createMockLead({ id: '3', email: null, phone: '+34 600 111 222', website: null }),
        createMockLead({ id: '4', email: null, phone: null, website: 'https://test.com' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'faltan_datos')

      expect(queue?.count).toBe(1)
      expect(queue?.firstLeadId).toBe('1')
    })
  })

  describe('emails_listos queue', () => {
    it('includes leads with status Email preparado', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Email preparado' }),
        createMockLead({ id: '2', status: 'Validado' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'emails_listos')

      expect(queue?.count).toBe(1)
      expect(queue?.firstLeadId).toBe('1')
    })

    it('includes leads with email draft in Nuevo', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Nuevo', emailBody: 'Draft email', emailSubject: 'Subject' }),
        createMockLead({ id: '2', status: 'Nuevo', emailBody: '', emailSubject: '' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'emails_listos')

      expect(queue?.count).toBe(1)
      expect(queue?.firstLeadId).toBe('1')
    })

    it('includes leads with email draft in Pendiente revisar', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Pendiente revisar', emailBody: 'Draft', emailSubject: 'Subj' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'emails_listos')

      expect(queue?.count).toBe(1)
    })

    it('includes leads with email draft in Validado', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Validado', emailBody: 'Draft', emailSubject: 'Subj' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'emails_listos')

      expect(queue?.count).toBe(1)
    })

    it('excludes leads without email draft in Nuevo/Pendiente/Validado', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Nuevo', emailBody: '', emailSubject: '' }),
        createMockLead({ id: '2', status: 'Pendiente revisar', emailBody: '', emailSubject: '' }),
        createMockLead({ id: '3', status: 'Validado', emailBody: '', emailSubject: '' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'emails_listos')

      expect(queue?.count).toBe(0)
    })
  })

  describe('followup_overdue queue', () => {
    it('includes leads with nextFollowUp before today and active status', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const leads = [
        createMockLead({ id: '1', nextFollowUp: yesterday, status: 'Nuevo' }),
        createMockLead({ id: '2', nextFollowUp: yesterday, status: 'Validado' }),
        createMockLead({ id: '3', nextFollowUp: yesterday, status: 'Descartado' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'followup_overdue')

      expect(queue?.count).toBe(2)
      expect(queue?.leadIds.sort()).toEqual(['1', '2'])
    })

    it('excludes leads with nextFollowUp today or future', () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const leads = [
        createMockLead({ id: '1', nextFollowUp: tomorrow, status: 'Nuevo' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'followup_overdue')

      expect(queue?.count).toBe(0)
    })

    it('excludes leads without nextFollowUp', () => {
      const leads = [
        createMockLead({ id: '1', nextFollowUp: null, status: 'Nuevo' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'followup_overdue')

      expect(queue?.count).toBe(0)
    })

    it('excludes Descartado status even if overdue', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const leads = [
        createMockLead({ id: '1', nextFollowUp: yesterday, status: 'Descartado' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'followup_overdue')

      expect(queue?.count).toBe(0)
    })
  })

  describe('duplicados queue', () => {
    it('includes leads that are in duplicate groups', () => {
      const leads = [
        createMockLead({ id: '1', email: 'same@test.com', website: null, phone: null, address: null, postalCode: null }),
        createMockLead({ id: '2', email: 'same@test.com', website: null, phone: null, address: null, postalCode: null }),
        createMockLead({ id: '3', email: 'unique@test.com', website: null, phone: null, address: null, postalCode: null }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'duplicados')

      expect(queue?.count).toBe(2)
      expect(queue?.leadIds.sort()).toEqual(['1', '2'])
    })

    it('excludes unique leads', () => {
      const leads = [
        createMockLead({ id: '1', email: 'unique1@test.com', website: null, phone: null, address: null, postalCode: null }),
        createMockLead({ id: '2', email: 'unique2@test.com', website: null, phone: null, address: null, postalCode: null }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'duplicados')

      expect(queue?.count).toBe(0)
    })
  })

  describe('queue structure', () => {
    it('each queue has id, title, description, count, leadIds, firstLeadId, previewNames', () => {
      const leads = [createMockLead({ id: '1', status: 'Nuevo' })]
      const queues = buildWorkQueues(leads)

      for (const queue of queues) {
        expect(queue).toHaveProperty('id')
        expect(queue).toHaveProperty('title')
        expect(queue).toHaveProperty('description')
        expect(queue).toHaveProperty('count')
        expect(queue).toHaveProperty('leadIds')
        expect(queue).toHaveProperty('firstLeadId')
        expect(queue).toHaveProperty('previewNames')
        expect(typeof queue.count).toBe('number')
        expect(Array.isArray(queue.leadIds)).toBe(true)
        expect(Array.isArray(queue.previewNames)).toBe(true)
      }
    })

    it('firstLeadId is first lead in queue or null', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Nuevo' }),
        createMockLead({ id: '2', status: 'Nuevo' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'pendiente_revisar')

      expect(queue?.firstLeadId).toBe('1')
    })

    it('firstLeadId is null for empty queue', () => {
      const leads = [createMockLead({ id: '1', status: 'Validado' })]
      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'pendiente_revisar')

      expect(queue?.firstLeadId).toBeNull()
    })

    it('previewNames shows up to 3 company names', () => {
      const leads = [
        createMockLead({ id: '1', status: 'Nuevo', companyName: 'Alpha' }),
        createMockLead({ id: '2', status: 'Nuevo', companyName: 'Beta' }),
        createMockLead({ id: '3', status: 'Nuevo', companyName: 'Gamma' }),
        createMockLead({ id: '4', status: 'Nuevo', companyName: 'Delta' }),
      ]

      const queues = buildWorkQueues(leads)
      const queue = queues.find((q) => q.id === 'pendiente_revisar')

      expect(queue?.previewNames).toEqual(['Alpha', 'Beta', 'Gamma'])
    })
  })

  describe('WorkQueueId type', () => {
    it('includes all 5 queue IDs', () => {
      const validIds: WorkQueueId[] = [
        'pendiente_revisar',
        'faltan_datos',
        'emails_listos',
        'followup_overdue',
        'duplicados',
      ]

      expect(validIds).toEqual([...WORK_QUEUE_IDS])
    })
  })
})
