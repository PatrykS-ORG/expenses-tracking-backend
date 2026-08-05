import { Field, InputType } from '@nestjs/graphql';
import { DataSourceTypeEnum } from '../models/data-source-type.enum';

@InputType()
export class UpdateDataSourceInput {
  @Field(() => DataSourceTypeEnum)
  dataSourceType!: DataSourceTypeEnum;

  @Field(() => String, { nullable: true })
  nextcloudFilePath?: string;
}
