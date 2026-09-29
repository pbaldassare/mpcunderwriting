import { describe, it, expect, vi } from 'vitest';
import { applySoloMadriFilter, mergePolizze } from '../polizzeSearch';

describe('applySoloMadriFilter', () => {
  it('aggiunge il filtro sostituisce_polizza IS NULL quando soloMadri=true', () => {
    const isFn = vi.fn().mockReturnThis();
    const q: any = { is: isFn };
    const out = applySoloMadriFilter(q, true);
    expect(isFn).toHaveBeenCalledTimes(1);
    expect(isFn).toHaveBeenCalledWith('sostituisce_polizza', null);
    expect(out).toBe(q);
  });

  it('NON aggiunge il filtro quando soloMadri=false (tutte le polizze)', () => {
    const isFn = vi.fn().mockReturnThis();
    const q: any = { is: isFn };
    const out = applySoloMadriFilter(q, false);
    expect(isFn).not.toHaveBeenCalled();
    expect(out).toBe(q);
  });
});

describe('mergePolizze', () => {
  const madre = { id: 't1', numero_titolo: 'POL-001', sostituisce_polizza: null };
  const quietanza1 = { id: 't2', numero_titolo: 'POL-001', sostituisce_polizza: 't1' };
  const quietanza2 = { id: 't3', numero_titolo: 'POL-001', sostituisce_polizza: 't1' };
  const altraMadre = { id: 't4', numero_titolo: 'POL-002', sostituisce_polizza: null };

  it('deduplica per numero_titolo: 1 sola riga per POL-001 (preferendo la madre)', () => {
    const merged = mergePolizze([madre, quietanza1, quietanza2, altraMadre], []);
    expect(merged).toHaveLength(2);
    const numeri = merged.map((r: any) => r.numero_titolo).sort();
    expect(numeri).toEqual(['POL-001', 'POL-002']);
    const pol001: any = merged.find((r: any) => r.numero_titolo === 'POL-001');
    expect(pol001.sostituisce_polizza).toBeNull();
  });

  it('se manca la madre, tiene la quietanza più recente per numero', () => {
    const q1 = { id: 't2', numero_titolo: 'POL-001', sostituisce_polizza: 't1', created_at: '2026-01-01T00:00:00Z' };
    const q2 = { id: 't3', numero_titolo: 'POL-001', sostituisce_polizza: 't1', created_at: '2026-06-01T00:00:00Z' };
    const merged = mergePolizze([q1, q2], []);
    expect(merged).toHaveLength(1);
    expect((merged[0] as any).id).toBe('t3');
  });

  it('quando il caller passa solo le madri, restituisce solo le madri', () => {
    const merged = mergePolizze([madre, altraMadre], []);
    expect(merged).toHaveLength(2);
    expect(merged.every((r: any) => !r.sostituisce_polizza)).toBe(true);
  });

  it('include le polizze CGA mappate e filtra le righe senza numero', () => {
    const cga = [
      { id: 'c1', numero_polizza: 'CGA-1', cliente_id: 'x', prodotti_cga: { nome_prodotto: 'P', compagnia: 'C', ramo: 'RCA' } },
      { id: 'c2', numero_polizza: null, cliente_id: 'x' } as any,
    ];
    const merged = mergePolizze([madre], cga);
    expect(merged).toHaveLength(2); // madre + CGA-1; quella senza numero scartata
    const cgaRow: any = merged.find((r: any) => r._isCga);
    expect(cgaRow.numero_titolo).toBe('CGA-1');
    expect(cgaRow.id).toBe('cga:c1');
    expect(cgaRow.ramo).toEqual({ descrizione: 'RCA', gruppo_ramo: null });
  });

  it('marca correttamente _isCga sulle due fonti', () => {
    const merged = mergePolizze([madre], [
      { id: 'c1', numero_polizza: 'CGA-1', cliente_id: 'x' } as any,
    ]);
    expect(merged.find((r: any) => r.numero_titolo === 'POL-001')!._isCga).toBe(false);
    expect(merged.find((r: any) => r.numero_titolo === 'CGA-1')!._isCga).toBe(true);
  });
});
