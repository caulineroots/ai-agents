import fs from 'fs';
import path from 'path';
import type { RegionsResponse } from '@/lib/leads-maps/types';

export function loadRegionsFromJson(keyword: string): RegionsResponse {
  const filePath = path.join(process.cwd(), 'data', 'maps_regions.json');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    states: Record<
      string,
      {
        code: string;
        name: string;
        parent_city: string;
        cities: string[];
      }
    >;
  };

  const states = Object.values(raw.states)
    .map((state) => ({
      code: state.code,
      name: state.name,
      parent_city: state.parent_city,
      city_count: state.cities.length,
      extracted_count: 0,
      cities: state.cities.map((name) => ({
        name,
        extracted: false,
        extracted_at: null,
        leads_count: 0,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return { keyword: keyword.trim(), states };
}
