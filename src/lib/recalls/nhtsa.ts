import type { NhtsaRecall } from '@/types';

type NhtsaResult = {
  NHTSACampaignNumber: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  ReportReceivedDate: string;
};

/**
 * Fetch open NHTSA safety recalls for a make/model/year from the public NHTSA API.
 * Only relevant for US-sourced vehicles. Returns [] on any failure.
 */
export async function fetchNhtsaRecalls(
  make: string,
  model: string,
  year: number
): Promise<NhtsaRecall[]> {
  try {
    const url =
      `https://api.nhtsa.gov/recalls/recallsByVehicle` +
      `?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return [];

    const json = (await res.json()) as { Count: number; results: NhtsaResult[] };

    return (json.results ?? []).map((r) => ({
      campaignNumber: r.NHTSACampaignNumber,
      component: r.Component,
      summary: r.Summary,
      consequence: r.Consequence,
      remedy: r.Remedy,
      recallDate: r.ReportReceivedDate,
    }));
  } catch {
    return [];
  }
}
