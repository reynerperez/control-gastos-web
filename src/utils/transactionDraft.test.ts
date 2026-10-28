import { describe, expect, it } from 'vitest'

import type { Transaction } from '@/types'
import {
  buildTransactionUpdate,
  createTransactionDraft,
  getEditableTransactionFields,
  isTransactionDraftDirty,
  parseDraftAmount,
  validateTransactionDraft,
} from '@/utils/transactionDraft'

const makeTransaction = (
  overrides: Partial<Transaction> = {}
): Transaction => ({
  id: 't1',
  user_id: 'u1',
  amount: 764.15,
  type: 'expense',
  breakdown_status: 'completed',
  payment_method_id: 'pm1',
  merchant: 'Liverpool',
  note: 'Regalo',
  date: '2026-10-24',
  latitude: null,
  longitude: null,
  created_at: '',
  purchase_type: 'one_time',
  details: [
    {
      id: 'd1',
      transaction_id: 't1',
      category_id: 'cat1',
      description: 'Compra de ropa',
      quantity: 1,
      unit_price: 764.15,
      created_at: '',
    },
  ],
  ...overrides,
})

describe('getEditableTransactionFields', () => {
  it('permite editar todos los campos simples en un movimiento normal', () => {
    const fields = getEditableTransactionFields(makeTransaction())
    expect(fields).toEqual({
      amount: true,
      category: true,
      description: true,
      paymentMethod: true,
      date: true,
    })
  })

  it('protege monto, tipo, categoría y concepto cuando el desglose está completo', () => {
    const fields = getEditableTransactionFields(
      makeTransaction({
        details: [
          ...makeTransaction().details!,
          {
            id: 'd2',
            transaction_id: 't1',
            category_id: 'cat2',
            description: 'Segundo ítem',
            quantity: 1,
            unit_price: 10,
            created_at: '',
          },
        ],
      })
    )

    expect(fields).toEqual({
      amount: false,
      category: false,
      description: false,
      paymentMethod: true,
      date: true,
    })
  })

  it('protege monto, tipo, fecha y tarjeta en una compra a MSI', () => {
    const fields = getEditableTransactionFields(
      makeTransaction({
        purchase_type: 'installments',
        installments_count: 6,
        installments_start_date: '2026-11-09',
      })
    )

    expect(fields).toEqual({
      amount: false,
      category: true,
      description: true,
      paymentMethod: false,
      date: false,
    })
  })
})

describe('borrador de edición', () => {
  it('parte de los datos del movimiento y conserva dos decimales en el monto', () => {
    const transaction = makeTransaction({ amount: 1234.5 })
    const draft = createTransactionDraft(transaction)

    expect(draft).toEqual({
      amount: '1234.50',
      merchant: 'Liverpool',
      description: 'Compra de ropa',
      categoryId: 'cat1',
      paymentMethodId: 'pm1',
      date: '2026-10-24',
      note: 'Regalo',
    })
  })

  it('detecta cambios solo en campos editables', () => {
    const transaction = makeTransaction()
    const fields = getEditableTransactionFields(transaction)
    const draft = createTransactionDraft(transaction)

    expect(isTransactionDraftDirty(transaction, draft, fields)).toBe(false)
    expect(
      isTransactionDraftDirty(
        transaction,
        { ...draft, note: 'Otra nota' },
        fields
      )
    ).toBe(true)
    expect(
      isTransactionDraftDirty(
        transaction,
        { ...draft, amount: '999.00' },
        fields
      )
    ).toBe(true)
    expect(
      isTransactionDraftDirty(
        transaction,
        { ...draft, amount: '999.00' },
        { ...fields, amount: false }
      )
    ).toBe(false)
  })

  it('acepta coma decimal al interpretar el monto', () => {
    expect(parseDraftAmount('1.234,56')).toBe(1234.56)
    expect(parseDraftAmount('764,15')).toBe(764.15)
  })
})

describe('validación', () => {
  const transaction = makeTransaction()
  const fields = getEditableTransactionFields(transaction)

  it('rechaza montos vacíos, cero o inválidos', () => {
    const draft = createTransactionDraft(transaction)
    expect(validateTransactionDraft({ ...draft, amount: '' }, fields)).toBe(
      'Monto inválido: ingresa un monto mayor a cero.'
    )
    expect(validateTransactionDraft({ ...draft, amount: '0' }, fields)).toBe(
      'Monto inválido: ingresa un monto mayor a cero.'
    )
    expect(
      validateTransactionDraft({ ...draft, amount: 'abc' }, fields)
    ).toBe('Monto inválido: ingresa un monto mayor a cero.')
  })

  it('exige método de pago y fecha cuando son editables', () => {
    const draft = createTransactionDraft(transaction)
    expect(
      validateTransactionDraft({ ...draft, paymentMethodId: null }, fields)
    ).toBe('Selecciona un método de pago.')
    expect(validateTransactionDraft({ ...draft, date: '' }, fields)).toBe(
      'Selecciona una fecha.'
    )
  })

  it('exige comercio o concepto en movimientos simples', () => {
    const draft = createTransactionDraft(transaction)
    expect(
      validateTransactionDraft(
        { ...draft, merchant: '  ', description: '  ' },
        fields
      )
    ).toBe('Llena al menos uno de los dos campos: comercio o concepto.')
  })

  it('no exige comercio ni concepto en un desglose completo', () => {
    const brokenDown = makeTransaction({
      details: [
        ...makeTransaction().details!,
        {
          id: 'd2',
          transaction_id: 't1',
          category_id: 'cat2',
          description: 'Segundo ítem',
          quantity: 1,
          unit_price: 10,
          created_at: '',
        },
      ],
    })
    const brokenFields = getEditableTransactionFields(brokenDown)
    const draft = createTransactionDraft(brokenDown)
    expect(
      validateTransactionDraft(
        { ...draft, merchant: '', description: '' },
        brokenFields
      )
    ).toBeNull()
  })

  it('acepta un borrador válido', () => {
    expect(
      validateTransactionDraft(createTransactionDraft(transaction), fields)
    ).toBeNull()
  })
})

describe('payload de actualización', () => {
  it('incluye todos los campos simples en un movimiento normal', () => {
    const transaction = makeTransaction()
    const draft = createTransactionDraft(transaction)
    const fields = getEditableTransactionFields(transaction)

    expect(buildTransactionUpdate(draft, fields)).toEqual({
      merchant: 'Liverpool',
      note: 'Regalo',
      payment_method_id: 'pm1',
      date: '2026-10-24',
      amount: 764.15,
      category_id: 'cat1',
      description: 'Compra de ropa',
    })
    expect('type' in buildTransactionUpdate(draft, fields)).toBe(false)
  })

  it('omite los campos que pertenecen al desglose completo', () => {
    const transaction = makeTransaction({
      details: [
        ...makeTransaction().details!,
        {
          id: 'd2',
          transaction_id: 't1',
          category_id: 'cat2',
          description: 'Segundo ítem',
          quantity: 1,
          unit_price: 10,
          created_at: '',
        },
      ],
    })
    const draft = createTransactionDraft(transaction)
    const fields = getEditableTransactionFields(transaction)
    const update = buildTransactionUpdate(draft, fields)

    expect(update).toEqual({
      merchant: 'Liverpool',
      note: 'Regalo',
      payment_method_id: 'pm1',
      date: '2026-10-24',
    })
    expect('amount' in update).toBe(false)
    expect('category_id' in update).toBe(false)
    expect('description' in update).toBe(false)
  })

  it('omite monto, fecha y tarjeta en una compra a MSI', () => {
    const transaction = makeTransaction({
      purchase_type: 'installments',
      installments_count: 6,
      installments_start_date: '2026-11-09',
    })
    const draft = createTransactionDraft(transaction)
    const fields = getEditableTransactionFields(transaction)
    const update = buildTransactionUpdate(draft, fields)

    expect(update).toEqual({
      merchant: 'Liverpool',
      note: 'Regalo',
      category_id: 'cat1',
      description: 'Compra de ropa',
    })
    expect('amount' in update).toBe(false)
    expect('date' in update).toBe(false)
    expect('payment_method_id' in update).toBe(false)
  })
})
