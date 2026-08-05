import { Field, ObjectType } from '@nestjs/graphql';
import { DataSourceTypeEnum } from '../../templates/models/data-source-type.enum';

@ObjectType()
export class UploadedExpenseFile {
  @Field(() => DataSourceTypeEnum)
  dataSourceType!: DataSourceTypeEnum;

  @Field()
  uploadedFilePath!: string;

  @Field()
  bucket!: string;

  @Field({ nullable: true })
  uploadedAt?: string;

  @Field({ nullable: true })
  originalFileName?: string;
}

@ObjectType()
export class CurrentExpenseFile extends UploadedExpenseFile {
  @Field()
  content!: string;
}
