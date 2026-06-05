import { DataSourceType, User } from '../generated/prisma/client';

export interface DataSourceProvider {
  readonly type: DataSourceType;
  validateConfig(config: User['data_source_config']): boolean;
  fetchExpenseContent(user: User): Promise<string>;
}
