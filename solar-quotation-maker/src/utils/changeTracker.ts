import { QuotationData } from '../types';
import { INITIAL_QUOTATION } from '../data/initialData';

export function getChangedFields(current: QuotationData, baseline: QuotationData = INITIAL_QUOTATION): Set<string> {
  const changed = new Set<string>();

  // Page 1
  if (current.page1.customerName !== baseline.page1.customerName) changed.add('page1.customerName');
  if (current.page1.customerPhone !== baseline.page1.customerPhone) changed.add('page1.customerPhone');
  if (current.page1.quotationNo !== baseline.page1.quotationNo) changed.add('page1.quotationNo');
  if (current.page1.date !== baseline.page1.date) changed.add('page1.date');
  if (current.page1.capacityKw !== baseline.page1.capacityKw) changed.add('page1.capacityKw');
  if (current.page1.yoursTrulyName !== baseline.page1.yoursTrulyName) changed.add('page1.yoursTrulyName');
  if (current.page1.yoursTrulyPhone !== baseline.page1.yoursTrulyPhone) changed.add('page1.yoursTrulyPhone');

  // Page 2
  if (current.page2.solarPanelMake !== baseline.page2.solarPanelMake) changed.add('page2.solarPanelMake');
  if (String(current.page2.solarPanelQty) !== String(baseline.page2.solarPanelQty)) changed.add('page2.solarPanelQty');
  if (current.page2.inverterOption !== baseline.page2.inverterOption) changed.add('page2.inverterOption');
  if (current.page2.inverterBrand !== baseline.page2.inverterBrand) changed.add('page2.inverterBrand');
  if (current.page2.gebGedaCharge !== baseline.page2.gebGedaCharge) changed.add('page2.gebGedaCharge');
  if (current.page2.projectType !== baseline.page2.projectType) changed.add('page2.projectType');
  if (current.page2.projectSize !== baseline.page2.projectSize) changed.add('page2.projectSize');

  // Brand Options Financials
  if (current.page2.brandOptions && baseline.page2.brandOptions) {
    current.page2.brandOptions.forEach((bo, idx) => {
      const baseBo = baseline.page2.brandOptions[idx];
      if (!baseBo) return;
      if (bo.brandName !== baseBo.brandName) changed.add(`page2.brandOptions.${idx}.brandName`);
      if (bo.baseValue !== baseBo.baseValue) changed.add(`page2.brandOptions.${idx}.baseValue`);
      if (bo.discount !== baseBo.discount) changed.add(`page2.brandOptions.${idx}.discount`);
      if (bo.subsidy !== baseBo.subsidy) changed.add(`page2.brandOptions.${idx}.subsidy`);
      if (bo.netPriceAfterSubsidy !== baseBo.netPriceAfterSubsidy) changed.add(`page2.brandOptions.${idx}.netPriceAfterSubsidy`);
    });
  }

  // Financials (legacy)
  if (current.page2.baseValue !== baseline.page2.baseValue) changed.add('page2.baseValue');
  if (current.page2.discount !== baseline.page2.discount) changed.add('page2.discount');
  if (current.page2.subsidy !== baseline.page2.subsidy) changed.add('page2.subsidy');
  if (current.page2.netPayableAmount !== baseline.page2.netPayableAmount) changed.add('page2.netPayableAmount');
  if (current.page2.netPriceAfterSubsidy !== baseline.page2.netPriceAfterSubsidy) changed.add('page2.netPriceAfterSubsidy');

  // Notes
  if (JSON.stringify(current.page2.notes) !== JSON.stringify(baseline.page2.notes)) {
    changed.add('page2.notes');
  }

  return changed;
}
