// Which drawing and colour each topping or sauce gets.
export function toppingKind(topping) {
  const name = `${topping?.id} ${topping?.name}`.toLowerCase();
  if (/chispa|sprinkle|grana|confit/.test(name)) return 'sprinkles';
  if (/oreo|galleta|cookie/.test(name)) return 'cookie';
  if (/man[ií]|nuez|almendra|crocante|peanut/.test(name)) return 'peanut';
  if (/gomi|osito|gummy/.test(name)) return 'gummy';
  if (/lentej|m&m|choco/.test(name)) return 'candy';
  return 'other';
}

export function syrupColor(syrup) {
  const name = `${syrup?.id} ${syrup?.name}`.toLowerCase();
  if (/fresa|frutilla|strawberry|frambuesa/.test(name)) return '#d1344d';
  if (/manjar|dulce de leche|caramel|toffee/.test(name)) return '#c98a45';
  if (/maracu|mango|pi[ñn]a/.test(name)) return '#f2b705';
  if (/menta/.test(name)) return '#43c59e';
  return '#3b1d12';
}
