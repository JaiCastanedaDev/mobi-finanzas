import { z } from 'zod';

const amount = z.number({ message: 'Escribe un monto' }).int('Debe ser un entero').positive('Debe ser mayor que 0').max(9_999_999_999, 'Monto demasiado grande');
const note = z.string().max(200).optional();

export function makeTransactionSchema(today: string) {
  const dateField = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .refine((d) => d <= today, 'La fecha no puede ser futura');
  const base = { amount, date: dateField, accountId: z.number({ message: 'Elige una cuenta' }).int(), note };
  return z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('gasto'), categoryId: z.number({ message: 'Elige una categoría' }).int(), ...base }),
      z.object({ kind: z.literal('ingreso'), categoryId: z.number({ message: 'Elige una categoría' }).int(), ...base }),
      z.object({ kind: z.literal('transferencia'), toAccountId: z.number({ message: 'Elige la cuenta destino' }).int(), ...base }),
    ])
    .refine((v) => v.kind !== 'transferencia' || v.toAccountId !== v.accountId, {
      message: 'Origen y destino deben ser cuentas distintas',
      path: ['toAccountId'],
    });
}

export type TransactionFormValues = z.infer<ReturnType<typeof makeTransactionSchema>>;

export const accountSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre'),
  type: z.enum(['debito', 'ahorro', 'efectivo']),
  initialBalance: z.number({ message: 'Escribe el saldo inicial' }).int(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre'),
  kind: z.enum(['gasto', 'ingreso']),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const goalSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre'),
  targetAmount: amount,
  accountId: z.number().int().nullable().optional(),
});
