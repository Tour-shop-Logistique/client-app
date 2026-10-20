// Saisie des numeros de telephone : CHIFFRES UNIQUEMENT.
// A appliquer dans le onChange de tout champ telephone « maison » (les champs
// react-phone-number-input filtrent deja eux-memes : chiffres + `+` initial).
// Couvre aussi le collage : « +225 01-02 (03) abc » -> « 22501 0203 »..
// `\d` ne reconnait que 0-9 : lettres, espaces, +, -, ., (), chiffres arabes
// ou pleine chasse sont tous retires.

// E.164 : 15 chiffres maximum, indicatif compris.
export const PHONE_MAX_DIGITS = 15;

export const digitsOnly = (value, max = PHONE_MAX_DIGITS) =>
  String(value ?? '').replace(/\D/g, '').slice(0, max);

// onChange pret a l'emploi pour un <input> : transmet la valeur nettoyee.
//   <input value={tel} onChange={onDigits(setTel)} />
export const onDigits = (setValue, max = PHONE_MAX_DIGITS) => (e) => setValue(digitsOnly(e.target.value, max));

// Props natives a poser sur un champ telephone : clavier numerique, saisie
// verifiee par le navigateur. A combiner avec `onDigits` (qui filtre vraiment).
export const digitsInputProps = {
  type: 'tel',
  inputMode: 'numeric',
  pattern: '[0-9]*',
  autoComplete: 'tel',
};
