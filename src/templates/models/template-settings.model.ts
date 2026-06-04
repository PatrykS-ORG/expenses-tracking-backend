import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TemplateSettings {
  @Field(() => String, { nullable: true })
  active_template_id: string | null;

  @Field(() => String, { nullable: true })
  nextcloud_file_path: string | null;
}
