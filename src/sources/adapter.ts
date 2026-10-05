import type { Collected, Period, SourceName } from '../model.js';

export interface SourceAdapter {
  name: SourceName;
  /** Confirma que o token funciona. Lança AuthError se não funcionar. */
  identify(): Promise<void>;
  /** Busca os dados do usuário autenticado dentro do período. */
  collect(period: Period): Promise<Collected>;
}
