import { describe, it, expect } from 'vitest'
import {
  htmlEmailToPlain,
  splitNotes,
  combineNotes,
  domainFromUrl,
  OBSERVACIONES_HARD_LIMIT,
} from '@/lib/utils/email-plain'

describe('utils/email-plain - htmlEmailToPlain', () => {
  it('converts br and p tags to newlines', () => {
    expect(htmlEmailToPlain('Hola<br>mundo')).toContain('Hola')
    expect(htmlEmailToPlain('<p>Uno</p><p>Dos</p>')).toContain('Uno')
  })

  it('strips remaining HTML tags', () => {
    expect(htmlEmailToPlain('<b>Bold</b> text')).toBe('Bold text')
  })

  it('decodes common entities', () => {
    expect(htmlEmailToPlain('A&nbsp;B &amp; C')).toBe('A B & C')
  })

  it('returns empty string for nullish', () => {
    expect(htmlEmailToPlain(null)).toBe('')
    expect(htmlEmailToPlain(undefined)).toBe('')
  })
})

describe('utils/email-plain - splitNotes', () => {
  it('keeps short notes in observaciones', () => {
    const result = splitNotes('nota corta')
    expect(result.observaciones).toBe('nota corta')
    expect(result.overflow).toBeNull()
  })

  it('splits notes over hard limit', () => {
    const long = 'x'.repeat(OBSERVACIONES_HARD_LIMIT + 50)
    const result = splitNotes(long)
    expect(result.observaciones).toHaveLength(OBSERVACIONES_HARD_LIMIT)
    expect(result.overflow).toHaveLength(50)
  })

  it('handles empty string', () => {
    expect(splitNotes('')).toEqual({ observaciones: '', overflow: null })
  })
})

describe('utils/email-plain - combineNotes', () => {
  it('joins observaciones and overflow', () => {
    expect(combineNotes('a', 'b')).toBe('ab')
    expect(combineNotes('a', null)).toBe('a')
    expect(combineNotes(null, 'b')).toBe('b')
    expect(combineNotes(null, null)).toBe('')
  })
})

describe('utils/email-plain - domainFromUrl', () => {
  it('extracts domain from https URL', () => {
    expect(domainFromUrl('https://example.com')).toBe('example.com')
    expect(domainFromUrl('https://www.example.com')).toBe('example.com')
    expect(domainFromUrl('https://sub.example.com/path')).toBe('sub.example.com')
  })

  it('extracts domain from http URL', () => {
    expect(domainFromUrl('http://example.com')).toBe('example.com')
    expect(domainFromUrl('http://www.example.com')).toBe('example.com')
  })

  it('extracts domain from bare domain', () => {
    expect(domainFromUrl('example.com')).toBe('example.com')
    expect(domainFromUrl('www.example.com')).toBe('example.com')
  })

  it('returns empty string for nullish/empty', () => {
    expect(domainFromUrl('')).toBe('')
    expect(domainFromUrl(null)).toBe('')
    expect(domainFromUrl(undefined)).toBe('')
  })

  it('returns hostname without port', () => {
    expect(domainFromUrl('https://example.com:8080')).toBe('example.com')
  })

  it('handles URLs with path and query', () => {
    expect(domainFromUrl('https://example.com/path?query=1')).toBe('example.com')
  })
})

describe('utils/email-plain - htmlEmailToPlain sanitization', () => {
  it('does not double-unescape entities', () => {
    expect(htmlEmailToPlain('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;')
  })
  it('removes nested/split tags completely', () => {
    expect(htmlEmailToPlain('<scr<script>ipt>alert(1)</script>')).not.toMatch(/<|>/)
  })
})
