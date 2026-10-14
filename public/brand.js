export const brand = Object.freeze({
  name: 'Hourvia',
  parent: 'Living IT Solutions',
  endorsement: 'by Living IT Solutions',
  identity: 'Hourvia by Living IT Solutions',
  tagline: 'Time tracked. Progress made.',
  proposedProductionUrl: 'https://hourvia.livingitsolutions.com',
});

export function renderBrand() {
  document.querySelectorAll('[data-brand]').forEach((element) => {
    const value = brand[element.dataset.brand];
    if (value) element.textContent = value;
  });
}
