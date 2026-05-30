import type { Listing, DamageFindings, CostBreakdown } from '@/types';
import { PANEL_LABELS } from './cost-model/defaults';

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB')}`;
}

function bar(char = '─', len = 60) {
  return char.repeat(len);
}

/**
 * Generate a plain-text repair specification document suitable for emailing
 * to bodyshops to request itemised quotes.
 */
export function generateBodyshopSpec(
  listing: Listing,
  damage: DamageFindings,
  cost: CostBreakdown
): string {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const lines: string[] = [];

  lines.push('REPAIR SPECIFICATION — REQUEST FOR QUOTE');
  lines.push(bar('═'));
  lines.push(`Generated:    ${date} via SalvageScore`);
  lines.push('');
  lines.push('VEHICLE DETAILS');
  lines.push(bar());
  lines.push(`Make/Model:   ${listing.year} ${listing.make} ${listing.model}${listing.trim ? ' ' + listing.trim : ''}`);
  if (listing.vin)          lines.push(`VIN:          ${listing.vin}`);
  lines.push(`Mileage:      ${listing.odometerMiles.toLocaleString()} miles`);
  lines.push(`Title status: ${listing.titleStatus}`);
  lines.push(`Source:       ${listing.source.toUpperCase()} Lot #${listing.lotNumber}`);
  lines.push(`Location:     ${listing.location}`);
  lines.push('');

  lines.push('KNOWN DAMAGE');
  lines.push(bar());
  lines.push(`Primary:      ${listing.primaryDamage}`);
  if (listing.secondaryDamage) lines.push(`Secondary:    ${listing.secondaryDamage}`);
  lines.push(`AI severity:  ${damage.overallSeverity.toUpperCase()}`);
  lines.push('');

  // Itemised repair line items
  lines.push('VISIBLE DAMAGE — REPAIRS REQUIRED');
  lines.push(bar());
  cost.repairLineItems.forEach((item, i) => {
    // Match to panel for zone/findings context
    const panelSlug = damage.damagedPanels[i];
    const photo = panelSlug
      ? damage.photos.find((p) =>
          p.findings.some((f) =>
            f.toLowerCase().includes((PANEL_LABELS[panelSlug] ?? panelSlug).split(' ')[0].toLowerCase())
          )
        )
      : undefined;
    lines.push(`${String(i + 1).padStart(2)}. ${item.label.padEnd(45)} ${fmt(item.amountGbp)}`);
    if (photo?.findings?.length) {
      lines.push(`    AI notes: ${photo.findings.slice(0, 2).join('; ')}`);
    }
  });
  lines.push('');
  lines.push(`    Subtotal (visible):                           ${fmt(cost.repairSubtotalGbp)}`);
  lines.push(`    + ${(cost.hiddenDamageContingencyPct * 100).toFixed(0)}% hidden damage buffer:                    ${fmt(cost.hiddenDamageContingencyGbp)}`);
  lines.push(`    TOTAL REPAIR ESTIMATE:                        ${fmt(cost.repairSubtotalGbp + cost.hiddenDamageContingencyGbp)}`);
  lines.push('');

  // Critical flags
  const flags = Object.entries(damage.criticalFlags).filter(([, v]) => v);
  if (flags.length > 0) {
    lines.push('CRITICAL FLAGS — MANDATORY ADDITIONAL WORK');
    lines.push(bar());
    if (damage.criticalFlags.deployedAirbag)
      lines.push('  ⚠  Deployed airbag(s) — ALL modules, trim covers, clock-spring and seatbelt pre-tensioners must be replaced. No refurbished units.');
    if (damage.criticalFlags.frameDamage)
      lines.push('  ⚠  Frame/structural damage — full chassis measurement and alignment report required before and after repair.');
    if (damage.criticalFlags.floodWaterline)
      lines.push('  ⚠  Flood damage — full interior strip, dry-out, ECU and harness inspection required.');
    if (damage.criticalFlags.fireDamage)
      lines.push('  ⚠  Fire damage — full inspection of underbonnet wiring, fuel and brake lines required.');
    if (damage.criticalFlags.theftStrip)
      lines.push('  ⚠  Theft recovery — itemised list of missing components required before quoting.');
    lines.push('');
  }

  // Hidden damage
  if (cost.hiddenRepairItems.length > 0) {
    lines.push('PROBABLE HIDDEN DAMAGE (not visible in photos — include contingency in quote)');
    lines.push(bar());
    cost.hiddenRepairItems.forEach((item) => {
      const range = `${fmt(item.minGbp)} – ${fmt(item.maxGbp)}`;
      const likelihood = item.likelihood === 'likely' ? '⚠ likely' : '  possible';
      lines.push(`  ${likelihood.padEnd(11)} ${item.label.padEnd(42)} ${range}`);
    });
    lines.push('');
  }

  // Make-specific note
  const makeNote = getMakeNote(listing.make);
  if (makeNote) {
    lines.push('MAKE-SPECIFIC NOTES');
    lines.push(bar());
    lines.push(`  ${makeNote}`);
    lines.push('');
  }

  // Quote requirements
  lines.push('PLEASE PROVIDE YOUR QUOTE INCLUDING:');
  lines.push(bar());
  lines.push('  ☐  Labour hours per panel / operation');
  lines.push('  ☐  Parts list — OEM vs pattern, with part numbers where possible');
  lines.push('  ☐  Paint materials and colour-match method');
  lines.push('  ☐  ADAS / radar / camera recalibration (if applicable)');
  if (damage.overallSeverity === 'structural' || damage.overallSeverity === 'frame')
    lines.push('  ☐  Structural assessment report (required for Cat S re-registration)');
  lines.push('  ☐  Any additional items not listed above');
  lines.push('  ☐  Estimated completion time');
  lines.push('');
  lines.push(bar('─'));
  lines.push('SalvageScore — salvagescore.com');

  return lines.join('\n');
}

function getMakeNote(make: string): string {
  const m = make.toLowerCase();
  if (m.includes('land rover') || m.includes('jaguar'))
    return 'Land Rover / Jaguar: use genuine or OEM-equivalent parts for structural elements. Aluminium body panels require specialist equipment and trained technicians.';
  if (m.includes('tesla'))
    return 'Tesla: structural repairs require Tesla-approved bodyshops only. Aluminium chassis — no heat straightening. Requires Tesla service centre alignment after repair.';
  if (m.includes('bmw') || m.includes('mercedes') || m.includes('audi') || m.includes('porsche'))
    return 'German premium make: ADAS recalibration (cameras, radar) required after any front-end structural work. Use genuine or OE-spec parts for safety systems.';
  if (m.includes('ferrari') || m.includes('lamborghini') || m.includes('bentley') || m.includes('rolls'))
    return 'Exotic/ultra-luxury make: manufacturer-approved bodyshop required. Parts lead times may be 4–16 weeks. Structural work requires factory alignment data.';
  return '';
}
