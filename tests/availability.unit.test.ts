import { describe, expect, it } from 'vitest';
import { findFreeSlots, mergeIntervals } from '../src/services/availability.js';

const d = (hhmm: string) => new Date(`2030-03-04T${hhmm}:00.000Z`);
const iv = (a: string, b: string) => ({ start: d(a), end: d(b) });
const MIN = 60_000;
const iso = (slots: { start: Date; end: Date }[]) => slots.map((s) => [s.start.toISOString().slice(11, 16), s.end.toISOString().slice(11, 16)]);

describe('mergeIntervals', () => {
  it('merges overlapping and touching intervals', () => {
    expect(iso(mergeIntervals([iv('10:00', '11:00'), iv('09:00', '10:00'), iv('10:30', '12:00'), iv('13:00', '14:00')]))).toEqual([
      ['09:00', '12:00'],
      ['13:00', '14:00'],
    ]);
  });
});

describe('findFreeSlots', () => {
  it('returns back-to-back slots in an empty range', () => {
    expect(iso(findFreeSlots([], iv('08:00', '10:00'), 45 * MIN, 5))).toEqual([
      ['08:00', '08:45'],
      ['08:45', '09:30'],
    ]);
  });

  it('skips busy time and gaps that are too short', () => {
    const busy = [iv('08:30', '09:00'), iv('09:20', '10:00')];
    expect(iso(findFreeSlots(busy, iv('08:00', '11:00'), 30 * MIN, 5))).toEqual([
      ['08:00', '08:30'],
      ['10:00', '10:30'],
      ['10:30', '11:00'],
    ]);
  });

  it('handles busy time that starts before / ends after the range', () => {
    const busy = [iv('07:00', '08:30'), iv('09:30', '12:00')];
    expect(iso(findFreeSlots(busy, iv('08:00', '10:00'), 60 * MIN, 5))).toEqual([['08:30', '09:30']]);
  });

  it('returns nothing when everything is busy or the duration does not fit', () => {
    expect(findFreeSlots([iv('07:00', '12:00')], iv('08:00', '10:00'), MIN, 3)).toEqual([]);
    expect(findFreeSlots([], iv('08:00', '08:30'), 31 * MIN, 3)).toEqual([]);
  });

  it('stops at max', () => {
    expect(findFreeSlots([], iv('08:00', '18:00'), 15 * MIN, 3)).toHaveLength(3);
  });
});
