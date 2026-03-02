'use client';

import { SA_BANKS, ACCOUNT_TYPES } from '@/lib/types';

type BankFieldsProps = {
  bank?: string | null;
  accNum?: string | null;
  accType?: string | null;
  branch?: string | null;
  phone?: string | null;
};

export default function BankFields({ bank, accNum, accType, branch, phone }: BankFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium opacity-70">Banking Details</label>

      <select name="bank" defaultValue={bank || ''} className="input-field">
        <option value="">Select bank</option>
        {SA_BANKS.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <input
        name="acc_num"
        type="text"
        placeholder="Account number"
        defaultValue={accNum || ''}
        className="input-field font-mono"
      />

      <select name="acc_type" defaultValue={accType || ''} className="input-field">
        <option value="">Account type</option>
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <input
        name="branch"
        type="text"
        placeholder="Branch code (optional)"
        defaultValue={branch || ''}
        className="input-field"
      />

      <input
        name="phone"
        type="text"
        placeholder="Phone / reference (optional)"
        defaultValue={phone || ''}
        className="input-field"
      />
    </div>
  );
}
