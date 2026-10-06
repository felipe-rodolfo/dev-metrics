import type { Collected, Period, SourceName } from '../model.js';

export interface SourceAdapter {
  name: SourceName;
  identify(): Promise<void>;
  collect(period: Period): Promise<Collected>;
}
