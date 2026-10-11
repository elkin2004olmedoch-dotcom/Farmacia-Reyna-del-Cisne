const TAX_RATES = new Set([0, 13, 14, 15]);
export function linePricing(product, quantity = 1) {
  const cents = Math.round(Number(product.precio) * 100) * quantity;
  const rate = product.ivaPorcentaje;
  if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isInteger(quantity) || quantity < 1) throw new Error('Precio o cantidad no válidos.');
  if (!TAX_RATES.has(rate)) return {total: cents, base: null, iva: null, rate: null};
  const base = Math.round(cents * 100 / (100 + rate));
  return {total: cents, base, iva: cents - base, rate};
}
export function cartPricing(lines) {
  const result = {total: 0, base: 0, iva: 0, complete: true, rates: {}};
  for (const line of lines) {
    if (!line.producto) { result.complete = false; continue; }
    const value = linePricing(line.producto, line.cantidad);
    result.total += value.total;
    if (value.rate === null) { result.complete = false; continue; }
    result.base += value.base; result.iva += value.iva;
    result.rates[value.rate] = (result.rates[value.rate] || 0) + value.iva;
  }
  return result;
}
