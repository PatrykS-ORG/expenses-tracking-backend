import { Field, Int, ObjectType } from '@nestjs/graphql';
import { DataSourceTypeEnum } from './data-source-type.enum';

@ObjectType()
export class TemplateSettings {
  @Field(() => String, { nullable: true })
  active_template_id!: string | null;

  @Field(() => DataSourceTypeEnum)
  data_source_type!: DataSourceTypeEnum;

  @Field(() => String, { nullable: true })
  nextcloud_file_path!: string | null;

  @Field(() => String, { nullable: true })
  uploaded_file_path!: string | null;

  @Field(() => Int, { nullable: true })
  salary_cents!: number | null;
}
