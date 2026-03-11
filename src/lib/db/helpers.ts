import { db } from './index';
import { groups } from './schema';
import { eq } from 'drizzle-orm';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function generateGroupCode(): Promise<string> {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    const existing = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.code, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
}
