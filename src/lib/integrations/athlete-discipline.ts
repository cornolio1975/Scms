export type AthleteDiscipline = 'Both' | 'Kumite' | 'Kata' | 'Non-Active';

/** Use the saved discipline before legacy event flags. Never infer it from a category. */
export function athleteDiscipline(input: any): AthleteDiscipline | undefined {
  const sport = input.sportData || input.sport_data || {};
  const raw = sport.preferredDiscipline || input.preferredDiscipline || input.discipline;
  if (raw != null && raw !== '') {
    const value = String(raw).trim().toLowerCase();
    if (value.includes('non-active') || value === 'inactive') return 'Non-Active';
    if (value.includes('both')) return 'Both';
    if (value.includes('kumite') && !value.includes('kata')) return 'Kumite';
    if (value.includes('kata') && !value.includes('kumite')) return 'Kata';
    throw new Error('Unknown athlete discipline. Update the athlete profile before sending.');
  }
  if (String(sport.competitionCategory || '').includes('Non-Active')) return 'Non-Active';
  const events = sport.competitionEvents || input.competitionEvents;
  if (Array.isArray(events)) {
    const kumite = events.includes('Kumite');
    const kata = events.includes('Kata');
    return kumite && kata ? 'Both' : kumite ? 'Kumite' : kata ? 'Kata' : undefined;
  }
  if (typeof input.isKumite === 'boolean' && typeof input.isKata === 'boolean') {
    return input.isKumite && input.isKata ? 'Both' : input.isKumite ? 'Kumite' : input.isKata ? 'Kata' : 'Non-Active';
  }
  return undefined;
}

export function disciplineFlags(discipline: AthleteDiscipline | undefined) {
  return discipline == null ? {} : {
    discipline,
    isKumite: discipline === 'Both' || discipline === 'Kumite',
    isKata: discipline === 'Both' || discipline === 'Kata',
  };
}

export function nonActiveMessage(names: string[]) {
  return `Non-active athlete: ${names.join(', ')}. Transfer blocked. Select Kumite, Kata or Both in the athlete profile before sending.`;
}
