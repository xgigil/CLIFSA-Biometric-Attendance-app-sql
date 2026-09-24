import { describe, it, expect } from 'vitest';
import { createAdminClient } from './server';

describe('Supabase Client Exports', () => {
  it('should create an admin client bypassing RLS when requested', async () => {
    const client = await createAdminClient();
    expect(client).toBeDefined();
  });
});
