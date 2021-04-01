import CreatedUpdatedProps from './CreatedUpdatedProps';
import { ServerAction } from './Server';

export default interface AsyncTask extends CreatedUpdatedProps {
  id: string;
  name: AsyncTasks;
  action: ServerAction;
  type: AsyncTaskType;
  tenantID: string;
  status?: AsyncTaskStatus;
  parent?: string;
  execHost?: string;
  execTimestamp?: Date;
  module: string;
  method: string;
  message?: string;
  parameters?: Record<string, string>;
}

export enum AsyncTaskType {
  TASK = 'T',
  TASK_GROUP = 'G',
}

export enum AsyncTaskStatus {
  PENDING = 'P',
  RUNNING = 'R',
  ERROR = 'E',
}


export enum AsyncTasks {
  TAGS_IMPORT = 'TagsImportAsyncTask',
  USERS_IMPORT = 'UsersImportAsyncTask',
}

