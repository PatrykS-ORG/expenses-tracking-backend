import { registerEnumType } from '@nestjs/graphql';

export enum DataSourceTypeEnum {
  FILE_UPLOAD = 'FILE_UPLOAD',
  NEXTCLOUD = 'NEXTCLOUD',
}

registerEnumType(DataSourceTypeEnum, {
  name: 'DataSourceType',
});
