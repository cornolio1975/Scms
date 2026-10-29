import { describe, expect, it } from 'vitest';
import { athleteDiscipline, nonActiveMessage } from './athlete-discipline';
import { KarateTechSyncService, toKarateTechPayload } from './karatetech-sync';

const member = { id:'test', fullName:'Test Athlete', gender:'Male', dob:'2000-01-15', icPassport:'TEST-001',
  sportData:{weightKg:70,heightCm:175} };
describe('discipline transfer contract', () => {
  it.each([
    ['Both (Kata & Kumite)', 'Both', true, true],
    ['Kumite Only', 'Kumite', true, false],
    ['Kata Only', 'Kata', false, true],
  ])('maps saved %s discipline through repeated payload normalization', (saved, discipline, isKumite, isKata) => {
    const payload = toKarateTechPayload({...member,sportData:{...member.sportData,preferredDiscipline:saved}});
    expect(payload).toMatchObject({discipline,isKumite,isKata});
    expect(toKarateTechPayload(payload)).toMatchObject({discipline,isKumite,isKata});
    expect(()=>KarateTechSyncService.validatePayload(payload)).not.toThrow();
  });
  it('rejects non-active even when stale event flags say both', () => {
    const payload=toKarateTechPayload({...member,sportData:{...member.sportData,preferredDiscipline:'Non-Active',competitionEvents:['Kata','Kumite']}});
    expect(()=>KarateTechSyncService.validatePayload(payload)).toThrow('Non-active athlete: Test Athlete');
    expect(nonActiveMessage(['Test Athlete'])).toContain('Transfer blocked');
  });
  it('supports database sport_data and legacy event lists', () => {
    expect(athleteDiscipline({sport_data:{preferredDiscipline:'Kumite Only'}})).toBe('Kumite');
    expect(athleteDiscipline({sportData:{competitionEvents:['Kata']}})).toBe('Kata');
    expect(athleteDiscipline({sportData:{competitionEvents:[]}})).toBeUndefined();
  });
  it('does not invent a discipline for older profiles', () => {
    expect(athleteDiscipline({})).toBeUndefined();
    expect(toKarateTechPayload(member).isKumite).toBeUndefined();
  });
});
