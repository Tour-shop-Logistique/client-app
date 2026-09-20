import { parsePhoneNumber } from 'react-phone-number-input';
import { Metadata } from 'libphonenumber-js/min';

// The registration API stores the phone as two fields — `indicatif_telephone`
// ("+225") and `telephone` (national number only, "0575081162"). The PhoneInput
// widget gives us one E.164 string ("+2250575081162"), so we split it here.
//
// We slice by the calling-code length instead of using libphonenumber's
// `nationalNumber`: the latter strips a leading trunk zero, but Côte d'Ivoire
// (and others) keep that zero as part of the number — we want it preserved
// exactly as the user typed it after the flag.
//
// Only import this from lazy-loaded UI (AuthSheet, profile screens): it pulls in
// react-phone-number-input, which we deliberately keep out of the main bundle.
export function splitPhone(e164) {
  if (!e164 || !e164.startsWith('+')) return { indicatif: '', national: e164 || '' };
  try {
    const cc = parsePhoneNumber(e164)?.countryCallingCode;
    if (cc) return { indicatif: `+${cc}`, national: e164.slice(1 + cc.length) };
  } catch {
    /* not parseable — fall through */
  }
  return { indicatif: '', national: e164 };
}

// Valid national-number digit counts for a country (e.g. `[10]` for Côte
// d'Ivoire, `[7, 8, 9, 10]` for a country with variable-length numbers).
// Same metadata `<PhoneInput limitMaxLength>` uses to trim input — here it
// only drives the on-screen "expected digits" hint.
export function getPhoneDigitLengths(country) {
  if (!country) return [];
  try {
    const metadata = new Metadata();
    metadata.selectNumberingPlan(country.toUpperCase());
    return metadata.numberingPlan.possibleLengths();
  } catch {
    return [];
  }
}

// "10 chiffres" or "7 à 10 chiffres" depending on whether the country has a
// single fixed length or several valid lengths.
export function getPhoneLengthHint(country) {
  const lengths = getPhoneDigitLengths(country);
  if (!lengths.length) return '';
  const min = lengths[0];
  const max = lengths[lengths.length - 1];
  return min === max ? `${min} chiffres` : `${min} à ${max} chiffres`;
}

// Rebuild an E.164 string from the two stored fields, e.g. to prefill PhoneInput.
export function joinPhone(indicatif, national) {
  const dial = (indicatif || '').replace(/[^\d+]/g, '');
  const digits = (national || '').replace(/\D/g, '');
  if (!dial) return digits ? `+${digits}` : '';
  return `${dial.startsWith('+') ? dial : `+${dial}`}${digits}`;
}
